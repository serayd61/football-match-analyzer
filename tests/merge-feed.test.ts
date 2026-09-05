import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFeed, type FeedRow } from '@/lib/site/merge-feed';
import { statusOfRow } from '@/lib/site/status';
import { applyFilters } from '@/lib/site/filters';
import type { SitePrediction } from '@/lib/site/predictions';

const day = { from: Date.UTC(2026, 8, 5), to: Date.UTC(2026, 8, 6) };
const feed = (o: Partial<FeedRow>): FeedRow => ({
  id: 1, homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeTeamId: 1, awayTeamId: 2, homeTeamLogo: '', awayTeamLogo: '',
  league: 'Premier League', leagueId: 47, leagueLogo: '', leagueCountry: 'ENG', date: '2026-09-05T14:00:00Z', status: 'NS', ...o,
});
const rated = (o: Partial<SitePrediction>): SitePrediction => ({
  fixtureId: 1, league: null, leagueName: 'Premier League', leagueId: 47, covered: true, homeId: 1, homeName: 'Arsenal', awayId: 2, awayName: 'Chelsea',
  homeCrest: null, awayCrest: null, kickoff: '2026-09-05T14:00:00Z', pHome: 0.5, pDraw: 0.3, pAway: 0.2, lambdaHome: 1.5, lambdaAway: 1,
  pick: '1', confidence: 0.55, confidenceRaw: 0.5, doubleChance: null, overUnder: null, btts: null, rationale: null, settled: false,
  homeScore: null, awayScore: null, result: null, outcome: 'pending', modelVersion: 'dc-1.0', updatedAt: null, hasModel: true,
  status: 'scheduled', modelStatus: 'ready', publishedAfterKickoff: false, ...o,
});

test('LIVE feed state is merged onto a rated row with the running score; settlement stays untouched', () => {
  const out = mergeFeed([rated({})], [feed({ status: 'LIVE', homeScore: 1, awayScore: 0 })], new Map(), day);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'live');
  assert.equal(out[0].homeScore, 1);
  assert.equal(out[0].settled, false);
  assert.equal(out[0].outcome, 'pending');
  assert.equal(out[0].modelStatus, 'ready');
});

test('a finished feed fixture without a model row is "finished / model pending", not upcoming', () => {
  const out = mergeFeed([], [feed({ id: 9, status: 'FT', homeScore: 2, awayScore: 2 })], new Map(), day);
  assert.equal(out[0].status, 'finished');
  assert.equal(out[0].modelStatus, 'pending');
  assert.equal(out[0].hasModel, false);
  assert.equal(applyFilters(out, { status: 'upcoming' }).length, 0);
});

test('cancelled feed-only fixtures are dropped; fixtures outside the day window are ignored', () => {
  const out = mergeFeed([], [feed({ id: 2, status: 'CANC' }), feed({ id: 3, date: '2026-09-06T10:00:00Z' })], new Map(), day);
  assert.equal(out.length, 0);
});

test('engine rows: settled → finished, future → scheduled, past unsettled → unknown', () => {
  const now = Date.UTC(2026, 8, 5, 12);
  assert.equal(statusOfRow({ settled: true, result: 'H', kickoff: '2026-09-04T14:00:00Z' }, now), 'finished');
  assert.equal(statusOfRow({ settled: true, result: null, kickoff: '2026-09-04T14:00:00Z' }, now), 'unknown');
  assert.equal(statusOfRow({ settled: false, result: null, kickoff: '2026-09-05T14:00:00Z' }, now), 'scheduled');
  assert.equal(statusOfRow({ settled: false, result: null, kickoff: '2026-09-05T10:00:00Z' }, now), 'unknown');
});

test('list filters: team search, status, rated-only and confidence sort', () => {
  const rows = [
    rated({ fixtureId: 1, homeName: 'Arsenal', awayName: 'Chelsea', confidence: 0.4 }),
    rated({ fixtureId: 2, homeName: 'Milan', awayName: 'Inter', confidence: 0.7, status: 'live' }),
    rated({ fixtureId: 3, homeName: 'Ajax', awayName: 'PSV', hasModel: false, confidence: null, confidenceRaw: null }),
  ];
  assert.deepEqual(applyFilters(rows, { q: 'chel' }).map((r) => r.fixtureId), [1]);
  assert.deepEqual(applyFilters(rows, { status: 'live' }).map((r) => r.fixtureId), [2]);
  assert.deepEqual(applyFilters(rows, { ready: true }).map((r) => r.fixtureId), [1, 2]);
  assert.deepEqual(applyFilters(rows, { sort: 'confidence' }).map((r) => r.fixtureId), [2, 1, 3]);
});
