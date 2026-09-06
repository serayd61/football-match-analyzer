// ============================================================================
// SETTLEMENT — engine_predictions sonuçlandırma (cron gövdesi, yeniden kullanılır)
// ----------------------------------------------------------------------------
// Geçmiş (kickoff < now) ve henüz sonuçlanmamış motor tahminlerini, tahminin
// geldiği AYNI kaynaktan (FotMob / free-football, fixture_id ile birebir) çekip
// sonuçlandırır. Faz 1 (2026-09-07): 1X2 `correct`in yanında Ü/A ve KG seçim +
// doğruluk ve satır başına log-loss/Brier de yazılır (lib/engine/scoring.ts).
//
// KUYRUK GARANTİSİ: kaynak API'de bulunamayan / hiç bitmeyen (iptal, ertelenen,
// allowlist dışı) fikstürler kuyruğun başını sonsuza dek işgal edebilir — 13 Haz
// 2026'da settlement bu yüzden sessizce durdu. 7 günden eski ve bu çalıştırmada
// sonuçlanamayan satırlar VOID edilir: settled=true, result=NULL, correct=NULL.
// Performans rotaları `result IS NOT NULL` filtrelediği için void'ler isabet
// istatistiğine girmez; kuyruk her çalıştırmada mutlaka ilerler.
//
// KUYRUK BAŞI TIKANMASI (2026-08-25): limit=120 iken void eşiğinden GENÇ 139
// notFound satır kuyruğun başını kapladı → saatlik tur sıfır settlement yaptı.
// Asıl maliyet satır sayısı değil TARİH başına 1 API çağrısı; satır limiti bu
// yüzden geniş, tarih sayısı ayrıca sınırlı (MAX_DATES).
//
// Kaynak hatası (getMatchesByDate throw): o tarih atlanır ama VOID EDİLMEZ —
// geçici API arızası kalıcı veri kaybına dönüşmesin.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getMatchesByDate, type FFMatch } from '@/lib/data-sources/free-football';
import { rowScores } from './scoring';

export const VOID_AFTER_DAYS = 7;
export const MAX_DATES = 10;

export interface SettleOptions {
  /** en fazla kaç bekleyen satır okunur (1..1000, varsayılan 900) */
  limit?: number;
  now?: Date;
}

export interface SettleResult {
  checked: number;
  settled: number;
  voided: number;
  skipped: { notFound: number; notFinished: number; noScore: number; updateError: number };
  dates: number;
  failedDates: string[];
}

const ymd = (iso: string) => new Date(iso).toISOString().split('T')[0];

const PENDING_COLS = 'id, fixture_id, kickoff, pick, p_home, p_draw, p_away, p_over25, p_btts_yes';

export async function settleEnginePredictions(sb: SupabaseClient, opts: SettleOptions = {}): Promise<SettleResult> {
  const now = opts.now ?? new Date();
  const limit = Math.min(Math.max(opts.limit ?? 900, 1), 1000);
  const empty: SettleResult = {
    checked: 0, settled: 0, voided: 0,
    skipped: { notFound: 0, notFinished: 0, noScore: 0, updateError: 0 },
    dates: 0, failedDates: [],
  };

  const { data: rows, error } = await sb
    .from('engine_predictions')
    .select(PENDING_COLS)
    .eq('settled', false)
    .lt('kickoff', now.toISOString())
    .order('kickoff', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return empty;

  // Tarihe göre grupla → her tarih için tek FotMob çağrısı (en eskiler önce).
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = ymd(r.kickoff);
    if (!byDate.has(d)) {
      if (byDate.size >= MAX_DATES) continue;
      byDate.set(d, []);
    }
    byDate.get(d)!.push(r);
  }

  const voidCutoff = new Date(now.getTime() - VOID_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const out: SettleResult = { ...empty, skipped: { ...empty.skipped }, dates: byDate.size, failedDates: [] };
  const voidIds: number[] = [];
  const settledAt = now.toISOString();

  for (const [date, items] of byDate) {
    let matches: FFMatch[] = [];
    try {
      matches = await getMatchesByDate(date);
    } catch (e: any) {
      out.failedDates.push(date);
      console.error(`[settle-engine] ${date}: getMatchesByDate failed (${items.length} rows deferred):`, e?.message);
      continue;
    }
    const map = new Map<number, FFMatch>();
    for (const m of matches) map.set(Number(m.id), m);

    for (const r of items) {
      out.checked++;
      const m = map.get(Number(r.fixture_id));
      const reason = !m ? 'notFound'
        : !m.finished ? 'notFinished'
        : (m.homeScore == null || m.awayScore == null) ? 'noScore'
        : null;

      if (reason) {
        out.skipped[reason]++;
        if (new Date(r.kickoff) < voidCutoff) voidIds.push(r.id);
        else console.log(`[settle-engine] ${date} fixture=${r.fixture_id}: skipped (${reason})`);
        continue;
      }

      const hs = m!.homeScore!, as = m!.awayScore!;
      const scores = rowScores(r, hs, as);
      const { error: upErr } = await sb
        .from('engine_predictions')
        .update({ home_score: hs, away_score: as, settled: true, settled_at: settledAt, ...scores })
        .eq('id', r.id);

      if (upErr) {
        out.skipped.updateError++;
        console.error(`[settle-engine] ${date} fixture=${r.fixture_id}: update failed:`, upErr.message);
      } else {
        out.settled++;
      }
    }
  }

  if (voidIds.length > 0) {
    const { error: voidErr } = await sb
      .from('engine_predictions')
      .update({ settled: true, settled_at: settledAt, result: null, correct: null })
      .in('id', voidIds);
    if (voidErr) console.error(`[settle-engine] void update failed (${voidIds.length} rows):`, voidErr.message);
    else {
      out.voided = voidIds.length;
      console.log(`[settle-engine] voided ${out.voided} stale rows (>${VOID_AFTER_DAYS}d, unsettleable)`);
    }
  }

  console.log(
    `[settle-engine] done: checked=${out.checked} settled=${out.settled} voided=${out.voided} ` +
    `skipped=${JSON.stringify(out.skipped)} dates=${out.dates} failedDates=${out.failedDates.join(',') || '-'}`,
  );
  return out;
}

export interface BackfillResult { scanned: number; updated: number; errors: number; remaining: number | null }

/**
 * Faz 1 geri dolumu: zaten sonuçlanmış (skoru olan) ama satır skoru
 * yazılmamış satırları KAYITLI skordan puanlar. Dış API çağrısı yok;
 * idempotent (ll_1x2 dolu satır bir daha seçilmez). Tek çağrıda en fazla
 * `limit` satır (varsayılan 1000); kalan sayısı döner.
 */
const BACKFILL_CONCURRENCY = 25;

/**
 * @param limit    sayfa büyüklüğü (1..1000)
 * @param budgetMs 0 → tek sayfa; >0 → süre dolana dek sayfa sayfa devam et
 *                 (2026-09-06: 1000 sıralı update 120 sn'ye sığmadı → eşzamanlı + bütçeli)
 */
export async function backfillRowScores(sb: SupabaseClient, limit = 1000, budgetMs = 0): Promise<BackfillResult> {
  const started = Date.now();
  let scanned = 0, updated = 0, errors = 0;
  const pageSize = Math.min(Math.max(limit, 1), 1000);

  for (;;) {
    const { data, error } = await sb
      .from('engine_predictions')
      .select('id, pick, p_home, p_draw, p_away, p_over25, p_btts_yes, home_score, away_score')
      .eq('settled', true)
      .not('result', 'is', null)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .is('ll_1x2', null)
      .order('kickoff', { ascending: true })
      .limit(pageSize);
    if (error) throw new Error(error.message);
    const rows = data || [];
    scanned += rows.length;

    const jobs: Array<{ id: number; scores: ReturnType<typeof rowScores> }> = [];
    for (const r of rows) {
      const hs = Number(r.home_score), as = Number(r.away_score);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
      const scores = rowScores(r, hs, as);
      // 1X2 olasılığı yoksa ll_1x2 null kalır → sonsuz kuyruk olmasın diye atla
      if (scores.ll_1x2 == null) continue;
      jobs.push({ id: r.id, scores });
    }
    for (let i = 0; i < jobs.length; i += BACKFILL_CONCURRENCY) {
      const results = await Promise.all(
        jobs.slice(i, i + BACKFILL_CONCURRENCY).map((j) => sb.from('engine_predictions').update(j.scores).eq('id', j.id).then(({ error: e }) => ({ id: j.id, e }))),
      );
      for (const r of results) {
        if (r.e) { errors++; console.error(`[settle-engine backfill] id=${r.id}:`, r.e.message); }
        else updated++;
      }
    }

    // Skorlanamayan satırlar (ll_1x2 null kalanlar) sayfayı sonsuza dek işgal edebilir:
    // hiç güncelleme yapamadıysak ya da sayfa dolmadıysa dur.
    const progressed = jobs.length > 0 && updated > 0;
    if (!budgetMs || rows.length < pageSize || !progressed || Date.now() - started > budgetMs) break;
  }

  const { count } = await sb
    .from('engine_predictions')
    .select('id', { count: 'exact', head: true })
    .eq('settled', true)
    .not('result', 'is', null)
    .not('home_score', 'is', null)
    .is('ll_1x2', null);

  return { scanned, updated, errors, remaining: count ?? null };
}
