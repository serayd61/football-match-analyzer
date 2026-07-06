// ============================================================================
// CRON: engine_predictions settlement
// Geçmiş (kickoff < now) ve henüz sonuçlanmamış motor tahminlerini, tahminin
// geldiği AYNI kaynaktan (FotMob / free-football, fixture_id ile birebir) çekip
// sonuçlandırır: home_score, away_score, result (H/D/A), correct, settled=true.
// Sonuçlananlar dashboard'dan düşer, performans takibine geçer.
//
// KUYRUK GARANTİSİ: kaynak API'de bulunamayan / hiç bitmeyen (iptal, ertelenen,
// allowlist dışı kalan) fikstürler kuyruğun başını sonsuza dek işgal edebilir —
// 13 Haz 2026'da settlement bu yüzden sessizce durdu. Artık 7 günden eski ve bu
// çalıştırmada sonuçlanamayan satırlar VOID edilir: settled=true, result=NULL,
// correct=NULL. Performans rotası `result IS NOT NULL` filtrelediği için void'ler
// isabet istatistiğine girmez; kuyruk her çalıştırmada mutlaka ilerler.
//
// Saatlik cron (vercel.json). Açık (diğer cron'larla aynı desen); CRON_SECRET
// ayarlıysa Bearer ister. Backfill için manuel tetiklemede ?limit= (en çok 400)
// yükseltilebilir.
// ============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getMatchesByDate, type FFMatch } from '@/lib/data-sources/free-football';

const VOID_AFTER_DAYS = 7;

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _sb;
}

function ymd(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

// pick: '1'|'X'|'2'  result: 'H'|'D'|'A'
function isCorrect(pick: string | null, result: 'H' | 'D' | 'A'): boolean {
  if (!pick) return false;
  return (pick === '1' && result === 'H')
    || (pick === 'X' && result === 'D')
    || (pick === '2' && result === 'A');
}

export async function GET(request: NextRequest) {
  // Opsiyonel koruma: CRON_SECRET ayarlıysa Bearer iste
  const secret = process.env.CRON_SECRET || process.env.PREDICTIONS_API_SECRET || '';
  if (secret) {
    const auth = request.headers.get('authorization')?.replace('Bearer ', '');
    const isVercelCron = !!request.headers.get('x-vercel-cron');
    if (!isVercelCron && auth !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '120', 10) || 120, 1), 400);

  // Sonuçlanmamış geçmiş tahminleri al (en eskiden başla)
  const { data: rows, error } = await sb()
    .from('engine_predictions')
    .select('id, fixture_id, kickoff, pick')
    .eq('settled', false)
    .lt('kickoff', new Date().toISOString())
    .order('kickoff', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, settled: 0, voided: 0, note: 'no pending past matches' });
  }

  // Tarihe göre grupla → her tarih için tek FotMob çağrısı
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = ymd(r.kickoff);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  const voidCutoff = new Date(Date.now() - VOID_AFTER_DAYS * 24 * 60 * 60 * 1000);
  let settled = 0;
  let checked = 0;
  const voidIds: number[] = [];
  const failedDates: string[] = [];
  const skipped: Record<string, number> = { notFound: 0, notFinished: 0, noScore: 0, updateError: 0 };

  for (const [date, items] of byDate) {
    let matches: FFMatch[] = [];
    try {
      matches = await getMatchesByDate(date);
    } catch (e: any) {
      // Kaynak hatası: bu tarihi atla ama VOID ETME — bir sonraki çalıştırmada
      // yeniden denenir. (Void yalnızca "kaynak cevap verdi ama maç yok/bitmedi"
      // durumunda; yoksa geçici API arızası kalıcı veri kaybına dönüşür.)
      failedDates.push(date);
      console.error(`[settle-engine] ${date}: getMatchesByDate failed (${items.length} rows deferred):`, e?.message);
      continue;
    }
    const map = new Map<number, FFMatch>();
    for (const m of matches) map.set(Number(m.id), m);

    for (const r of items) {
      checked++;
      const m = map.get(Number(r.fixture_id));
      const reason = !m ? 'notFound'
        : !m.finished ? 'notFinished'
        : (m.homeScore == null || m.awayScore == null) ? 'noScore'
        : null;

      if (reason) {
        skipped[reason]++;
        if (new Date(r.kickoff) < voidCutoff) {
          voidIds.push(r.id);
        } else {
          console.log(`[settle-engine] ${date} fixture=${r.fixture_id}: skipped (${reason})`);
        }
        continue;
      }

      const result: 'H' | 'D' | 'A' =
        m!.homeScore! > m!.awayScore! ? 'H' : m!.homeScore! < m!.awayScore! ? 'A' : 'D';

      const { error: upErr } = await sb()
        .from('engine_predictions')
        .update({
          home_score: m!.homeScore,
          away_score: m!.awayScore,
          result,
          correct: isCorrect(r.pick, result),
          settled: true,
        })
        .eq('id', r.id);

      if (upErr) {
        skipped.updateError++;
        console.error(`[settle-engine] ${date} fixture=${r.fixture_id}: update failed:`, upErr.message);
      } else {
        settled++;
      }
    }
  }

  // 7 günden eski, sonuçlanamayan satırları toplu void et (kuyruğu açar)
  let voided = 0;
  if (voidIds.length > 0) {
    const { error: voidErr } = await sb()
      .from('engine_predictions')
      .update({ settled: true, result: null, correct: null })
      .in('id', voidIds);
    if (voidErr) {
      console.error(`[settle-engine] void update failed (${voidIds.length} rows):`, voidErr.message);
    } else {
      voided = voidIds.length;
      console.log(`[settle-engine] voided ${voided} stale rows (>${VOID_AFTER_DAYS}d, unsettleable)`);
    }
  }

  console.log(
    `[settle-engine] done: checked=${checked} settled=${settled} voided=${voided} ` +
    `skipped=${JSON.stringify(skipped)} dates=${byDate.size} failedDates=${failedDates.join(',') || '-'}`,
  );

  return NextResponse.json({
    ok: true,
    checked,
    settled,
    voided,
    skipped,
    dates: byDate.size,
    failedDates,
  });
}
