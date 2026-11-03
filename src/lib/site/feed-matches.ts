// ============================================================================
// feed_matches ingest (feed-1.0, 2026-11-03): günün akışını tabloya upsert eder.
// Çağıranlar: api/cron/feed-matches (günlük) · scripts/backfill-feed-matches.ts.
// Akış hatası (429/403/ağ) günü "feedUnavailable" sayar, satır silmez/boşaltmaz.
// ============================================================================
import { getMatchesByDateStrict, FeedUnavailableError } from '@/lib/data-sources/free-football';
import { dbFresh } from '@/lib/site/db';
import { toFeedRow, type FeedMatchRow } from '@/lib/site/feed-matches-pure';

export const TABLE = 'feed_matches';
const CHUNK = 500;

export interface IngestDayResult { date: string; fetched: number; written: number; finished: number; error?: string }

export async function ingestFeedDay(date: string, now = new Date()): Promise<IngestDayResult> {
  let list;
  try {
    list = await getMatchesByDateStrict(date);
  } catch (e) {
    const msg = e instanceof FeedUnavailableError ? 'feedUnavailable' : (e instanceof Error ? e.message : String(e));
    return { date, fetched: 0, written: 0, finished: 0, error: msg };
  }
  const rows = list.map((m) => toFeedRow(m, now)).filter((r): r is FeedMatchRow => !!r);
  let written = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await dbFresh().from(TABLE).upsert(chunk, { onConflict: 'fixture_id' });
    if (error) errors.push(error.message); else written += chunk.length;
  }
  return {
    date, fetched: list.length, written,
    finished: rows.filter((r) => r.status === 'finished').length,
    ...(errors.length ? { error: errors.join('; ') } : {}),
  };
}

/** Günleri sırayla işler (akış kotasına nazik: ardışık, paralel değil). */
export async function ingestFeedDays(dates: string[], now = new Date()): Promise<IngestDayResult[]> {
  const out: IngestDayResult[] = [];
  for (const d of dates) out.push(await ingestFeedDay(d, now));
  return out;
}
