// ============================================================================
// CRON: engine_predictions settlement
// Geçmiş (kickoff < now) ve henüz sonuçlanmamış motor tahminlerini, tahminin
// geldiği AYNI kaynaktan (FotMob / free-football, fixture_id ile birebir) çekip
// sonuçlandırır: home_score, away_score, result (H/D/A), correct, settled=true.
// Sonuçlananlar dashboard'dan düşer, performans takibine geçer.
// Saatlik cron (vercel.json). Açık (diğer cron'larla aynı desen); CRON_SECRET
// ayarlıysa Bearer ister.
// ============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getMatchesByDate, type FFMatch } from '@/lib/data-sources/free-football';

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

  // Sonuçlanmamış geçmiş tahminleri al (en eskiden başla)
  const { data: rows, error } = await sb()
    .from('engine_predictions')
    .select('id, fixture_id, kickoff, pick')
    .eq('settled', false)
    .lt('kickoff', new Date().toISOString())
    .order('kickoff', { ascending: true })
    .limit(120);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, settled: 0, note: 'no pending past matches' });
  }

  // Tarihe göre grupla → her tarih için tek FotMob çağrısı
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = ymd(r.kickoff);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  let settled = 0;
  let checked = 0;

  for (const [date, items] of byDate) {
    let matches: FFMatch[] = [];
    try {
      matches = await getMatchesByDate(date);
    } catch {
      continue; // bu tarih çekilemedi, atla
    }
    const map = new Map<number, FFMatch>();
    for (const m of matches) map.set(Number(m.id), m);

    for (const r of items) {
      checked++;
      const m = map.get(Number(r.fixture_id));
      if (!m || !m.finished || m.homeScore == null || m.awayScore == null) continue;

      const result: 'H' | 'D' | 'A' =
        m.homeScore > m.awayScore ? 'H' : m.homeScore < m.awayScore ? 'A' : 'D';

      const { error: upErr } = await sb()
        .from('engine_predictions')
        .update({
          home_score: m.homeScore,
          away_score: m.awayScore,
          result,
          correct: isCorrect(r.pick, result),
          settled: true,
        })
        .eq('id', r.id);

      if (!upErr) settled++;
    }
  }

  return NextResponse.json({ ok: true, checked, settled, dates: byDate.size });
}
