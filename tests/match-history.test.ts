import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromFeedRow, fromEngineRow, mergeHistory, feedPublicMatch, feedStatusToMatchStatus, type FeedMatchRecord, type HistoryRow } from '@/lib/site/match-history';
import { PREMIUM_FIELDS } from '@/lib/site/match-public';
import type { SitePrediction } from '@/lib/site/predictions';

// feed-1.1 (2026-11-03): akış arşivi + motor arşivi birleşimi ve "açık maç" görünümü.

const feed = (o: Partial<FeedMatchRecord> = {}): FeedMatchRecord => ({
  fixture_id: 6106266, league_id: 943230, league_name: 'Champions League', league_ccode: 'INT-2',
  home_id: 9906, home_name: 'Atlético Madrid', away_id: 9823, away_name: 'Bayern München',
  home_score: 2, away_score: 1, kickoff: '2026-11-03T20:00:00.000Z', status: 'finished', updated_at: '2026-11-04T03:40:00Z', ...o,
});
const row = (fixtureId: number, kickoff: string, hs: number | null = 1, as: number | null = 0, leagueName = 'Bundesliga'): HistoryRow => ({
  fixtureId, league: null, leagueName, homeId: 9823, homeName: 'Bayern München', awayId: 1, awayName: 'X', homeScore: hs, awayScore: as, kickoff,
});

test('fromFeedRow: CL/AL mevsimlik id → slug; bilinmeyen lig → null', () => {
  const r = fromFeedRow(feed());
  assert.equal(r.league?.slug, 'champions-league');
  assert.equal(r.leagueName, 'Champions League');
  assert.equal(r.homeId, 9906); assert.equal(r.awayScore, 1);
  // 2026-11-04: Avrupa Ligi artık kapsamda → slug çözülür; bilinmeyen kupa hâlâ null
  assert.equal(fromFeedRow(feed({ league_id: 73, league_name: 'Europa League', league_ccode: 'INT-2' })).league?.slug, 'europa-league');
  assert.equal(fromFeedRow(feed({ league_id: 10613, league_name: 'Europa League Qualification', league_ccode: 'INT' })).league, null);
});

test('mergeHistory: akış önce, fixture id tekil, yeniden eskiye, limit, skorsuz atılır', () => {
  const primary = [row(1, '2026-10-31T17:30:00Z'), row(2, '2026-10-28T19:45:00Z', null, null, 'DFB Pokal')];
  const secondary = [row(1, '2026-10-31T17:30:00Z', 9, 9, 'Bundesliga (motor)'), row(3, '2026-10-25T13:30:00Z'), row(4, '2026-10-21T19:00:00Z', 2, 2, 'Champions League')];
  const out = mergeHistory(primary, secondary, 2);
  assert.deepEqual(out.map((r) => r.fixtureId), [1, 3]);
  assert.equal(out[0].leagueName, 'Bundesliga'); // akış satırı kazandı
  assert.equal(mergeHistory(primary, secondary, 10).length, 3); // 2 skorsuz → düştü
});

test('fromEngineRow: yalnız olgu alanları taşınır', () => {
  const p = { fixtureId: 5, league: null, leagueName: 'Serie A', homeId: 1, homeName: 'A', awayId: 2, awayName: 'B', homeScore: 0, awayScore: 3, kickoff: '2026-09-01T18:00:00Z', pHome: 0.5, pick: '1', confidence: 0.9 } as unknown as SitePrediction;
  const r = fromEngineRow(p);
  assert.deepEqual(Object.keys(r).sort(), ['awayId', 'awayName', 'awayScore', 'fixtureId', 'homeId', 'homeName', 'homeScore', 'kickoff', 'league', 'leagueName']);
});

test('feedPublicMatch: açık maç görünümü — openMatch, verdict null, premium alan yok, slug kanonik', () => {
  const v = feedPublicMatch(feed());
  assert.equal(v.openMatch, true);
  assert.equal(v.verdict, null);
  for (const k of PREMIUM_FIELDS) assert.ok(!(k in v), `premium field leaked: ${k}`);
  assert.equal(v.slug, 'atletico-madrid-vs-bayern-munchen-6106266');
  assert.equal(v.league?.slug, 'champions-league');
  assert.equal(v.status, 'finished'); assert.equal(v.settled, true);
  assert.equal(v.homeScore, 2); assert.equal(v.awayScore, 1);
  assert.ok(v.homeCrest?.includes('/9906.png'));
});

test('feedPublicMatch: bitmemiş maçta skor yok, durum eşlemesi', () => {
  const v = feedPublicMatch(feed({ status: 'scheduled', home_score: 1, away_score: 0 }));
  assert.equal(v.status, 'scheduled'); assert.equal(v.settled, false);
  assert.equal(v.homeScore, null); assert.equal(v.awayScore, null);
  assert.equal(feedStatusToMatchStatus('live'), 'live');
  assert.equal(feedStatusToMatchStatus('cancelled'), 'cancelled');
  assert.equal(feedStatusToMatchStatus('weird'), 'unknown');
});
