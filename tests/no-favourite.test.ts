import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noFavourite, MODEL_FLAT } from '../src/lib/site/risk';
import { settledVerdict } from '../src/lib/site/match-public';
import type { SitePrediction } from '../src/lib/site/predictions';

test('noFavourite: üç sonuç yakınsa true, net favoride false', () => {
  assert.equal(MODEL_FLAT, 0.45);
  assert.equal(noFavourite(0.35, 0.32, 0.33), true);
  assert.equal(noFavourite(0.44, 0.28, 0.28), true);
  assert.equal(noFavourite(0.45, 0.28, 0.27), false);
  assert.equal(noFavourite(0.62, 0.22, 0.16), false);
});

const base = (over: Partial<SitePrediction>): SitePrediction => ({
  fixtureId: 1, leagueId: 55, leagueName: 'Serie A', league: null, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', homeCrest: null, awayCrest: null,
  kickoff: '2026-10-30T18:00:00Z', pHome: 0.35, pDraw: 0.32, pAway: 0.33, lambdaHome: 1.2, lambdaAway: 1.1, pick: '1', noFavourite: true,
  confidence: 0.35, confidenceRaw: 0.35, confidenceCalibrated: false, calibrationSegment: null, doubleChance: null as any, overUnder: null, btts: null,
  rationale: null, settled: true, homeScore: 0, awayScore: 1, result: 'A', outcome: 'nopick', modelVersion: 'dc-1.0', updatedAt: null, hasModel: true,
  status: 'finished', modelStatus: 'ready', publishedAfterKickoff: false, ...over,
} as unknown as SitePrediction);

test('settledVerdict: favori yok → kamu sayfaları bu maçı tuttu/tutmadı saymaz', () => {
  assert.equal(settledVerdict(base({})), null);
  const v = settledVerdict(base({ noFavourite: false, pHome: 0.62, pDraw: 0.22, pAway: 0.16, outcome: 'lost' }));
  assert.deepEqual(v, { pick: '1', p: 0.62, outcome: 'lost' });
});
