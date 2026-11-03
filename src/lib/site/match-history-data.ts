import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { type FeedMatchRecord, fromFeedRow, type HistoryRow } from './match-history';

// feed_matches okumaları (feed-1.1, 2026-11-03). Yazan: api/cron/feed-matches.
// Form ve H2H "bu maçtan önce" kesitiyle okunur (before = maçın başlama saati)
// ki bitmiş maç kendini ya da sonraki maçları form sanmasın.

const COLS = 'fixture_id, league_id, league_name, league_ccode, home_id, home_name, away_id, away_name, home_score, away_score, kickoff, status, updated_at';

export const getFeedMatch = unstable_cache(
  async (fixtureId: number): Promise<FeedMatchRecord | null> => {
    const { data, error } = await db().from('feed_matches').select(COLS).eq('fixture_id', fixtureId).maybeSingle();
    if (error) { console.warn('[feed_matches] read failed', error.message); return null; }
    return (data as FeedMatchRecord | null) ?? null;
  },
  ['site-feed-match-v1'],
  { revalidate: REVALIDATE.fixtures },
);

export const getFeedTeamForm = unstable_cache(
  async (teamId: number, limit = 5, before: string | null = null): Promise<HistoryRow[]> => {
    const { data, error } = await db().from('feed_matches').select(COLS)
      .eq('status', 'finished').not('home_score', 'is', null).not('away_score', 'is', null)
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`)
      .lt('kickoff', before ?? new Date().toISOString())
      .order('kickoff', { ascending: false }).limit(limit);
    if (error) { console.warn('[feed_matches] form failed', error.message); return []; }
    return ((data ?? []) as FeedMatchRecord[]).map(fromFeedRow);
  },
  ['site-feed-form-v1'],
  { revalidate: REVALIDATE.results },
);

export const getFeedHeadToHead = unstable_cache(
  async (homeId: number, awayId: number, limit = 6, before: string | null = null): Promise<HistoryRow[]> => {
    const { data, error } = await db().from('feed_matches').select(COLS)
      .eq('status', 'finished').not('home_score', 'is', null).not('away_score', 'is', null)
      .or(`and(home_id.eq.${homeId},away_id.eq.${awayId}),and(home_id.eq.${awayId},away_id.eq.${homeId})`)
      .lt('kickoff', before ?? new Date().toISOString())
      .order('kickoff', { ascending: false }).limit(limit);
    if (error) { console.warn('[feed_matches] h2h failed', error.message); return []; }
    return ((data ?? []) as FeedMatchRecord[]).map(fromFeedRow);
  },
  ['site-feed-h2h-v1'],
  { revalidate: REVALIDATE.results },
);
