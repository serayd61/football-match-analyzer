import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFeedRow, feedStatus, recentDays, dayRange } from '@/lib/site/feed-matches-pure';
import type { FFMatch } from '@/lib/data-sources/free-football';

const base: FFMatch = {
  id: 6106266, leagueId: 943230, leagueName: 'Champions League', leagueLogo: '', leagueCountry: 'INT',
  homeId: 9906, homeName: 'Atlético Madrid', homeLogo: '', awayId: 9823, awayName: 'Bayern München', awayLogo: '',
  homeScore: 2, awayScore: 1, utcTime: '2026-11-03T20:00:00.000Z', finished: true, started: true, cancelled: false,
};
const NOW = new Date('2026-11-04T03:40:00Z');

test('toFeedRow: bitmiş maç skoruyla, FotMob id\'leri olduğu gibi', () => {
  const r = toFeedRow(base, NOW)!;
  assert.equal(r.fixture_id, 6106266);
  assert.equal(r.league_id, 943230);
  assert.equal(r.home_id, 9906);
  assert.equal(r.away_id, 9823);
  assert.equal(r.home_score, 2);
  assert.equal(r.away_score, 1);
  assert.equal(r.status, 'finished');
  assert.equal(r.kickoff, '2026-11-03T20:00:00.000Z');
  assert.equal(r.updated_at, NOW.toISOString());
});

test('toFeedRow: bitmemiş maçta skor yazılmaz (yarım skor sonuç sanılmasın)', () => {
  const live = toFeedRow({ ...base, finished: false, started: true, homeScore: 1, awayScore: 0 }, NOW)!;
  assert.equal(live.status, 'live');
  assert.equal(live.home_score, null);
  assert.equal(live.away_score, null);
  const sched = toFeedRow({ ...base, finished: false, started: false, homeScore: null, awayScore: null }, NOW)!;
  assert.equal(sched.status, 'scheduled');
});

test('feedStatus: iptal, bitiş ve canlı önceliği', () => {
  assert.equal(feedStatus({ cancelled: true, finished: true, started: true }), 'cancelled');
  assert.equal(feedStatus({ cancelled: false, finished: true, started: true }), 'finished');
  assert.equal(feedStatus({ cancelled: false, finished: false, started: true }), 'live');
  assert.equal(feedStatus({ cancelled: false, finished: false, started: false }), 'scheduled');
});

test('toFeedRow: eksik id veya saat → null (satır atlanır)', () => {
  assert.equal(toFeedRow({ ...base, utcTime: '' }, NOW), null);
  assert.equal(toFeedRow({ ...base, utcTime: 'not-a-date' }, NOW), null);
  assert.equal(toFeedRow({ ...base, homeId: undefined as unknown as number }, NOW), null);
});

test('recentDays: bugün dahil geriye N gün, UTC, eskiden yeniye', () => {
  assert.deepEqual(recentDays(3, new Date('2026-11-04T01:00:00Z')), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.deepEqual(recentDays(0, new Date('2026-11-04T23:59:00Z')), ['2026-11-04']);
  // ileri günler: akışın gün kovası UTC değil, günün geç maçları yarın altında gelir
  assert.deepEqual(recentDays(1, new Date('2026-11-03T13:00:00Z'), 2), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
});

test('dayRange: ikisi dahil; ters veya bozuk aralık boş', () => {
  assert.deepEqual(dayRange('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(dayRange('2026-11-02', '2026-10-30'), []);
  assert.deepEqual(dayRange('x', '2026-10-30'), []);
});
