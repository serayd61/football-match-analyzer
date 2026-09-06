import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  outcomeOf, score1x2, scoreBinary, rowScores, isoWeekOf, parseIsoWeek, isoWeekLabel, previousIsoWeek,
  binIndex, makeBinAccs, addToBins, eceFromBins, mergeBins,
} from '@/lib/engine/scoring';

test('1X2 scores: certain right answer → 0, uniform → random baselines', () => {
  assert.equal(outcomeOf(2, 1), 'H');
  assert.equal(outcomeOf(0, 0), 'D');
  assert.equal(outcomeOf(0, 3), 'A');
  const sure = score1x2({ home: 1, draw: 0, away: 0 }, 'H');
  assert.ok(sure.ll < 1e-5 && sure.brier === 0);
  const uni = score1x2({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, 'D');
  assert.equal(uni.ll, 1.0986);
  assert.equal(uni.brier, 0.6667);
  // wrong and confident is punished hard, but clipped (no Infinity)
  const wrong = score1x2({ home: 1, draw: 0, away: 0 }, 'A');
  assert.ok(Number.isFinite(wrong.ll) && wrong.ll > 10);
  assert.equal(wrong.brier, 2);
});

test('1X2 probabilities off by the ingest tolerance are renormalised, not penalised', () => {
  const a = score1x2({ home: 0.5, draw: 0.3, away: 0.2 }, 'H');
  const b = score1x2({ home: 0.51, draw: 0.306, away: 0.204 }, 'H'); // ×1.02
  assert.equal(a.ll, b.ll);
});

test('binary scores', () => {
  assert.deepEqual(scoreBinary(0.5, true), { ll: 0.6931, brier: 0.25 });
  assert.equal(scoreBinary(0.9, true).brier, 0.01);
  assert.equal(scoreBinary(0.9, false).brier, 0.81);
  assert.ok(Number.isFinite(scoreBinary(1, false).ll));
});

test('rowScores settles every market from the score; missing probabilities stay null (never 0)', () => {
  const row = { p_home: 0.6, p_draw: 0.25, p_away: 0.15, p_over25: 0.7, p_btts_yes: 0.4, pick: '1' };
  const s = rowScores(row, 2, 1);
  assert.equal(s.result, 'H');
  assert.equal(s.correct, true);
  assert.equal(s.ou_pick, 'over');
  assert.equal(s.ou_correct, true);           // 3 goals
  assert.equal(s.btts_pick, 'no');
  assert.equal(s.btts_correct, false);        // both scored
  assert.equal(s.ll_1x2, 0.5108);
  assert.equal(s.brier_ou25, 0.09);           // (0.7-1)^2
  assert.equal(s.brier_btts, 0.36);           // (0.4-1)^2

  const partial = rowScores({ p_home: 0.6, p_draw: 0.25, p_away: 0.15, p_over25: null, p_btts_yes: '', pick: 'X' }, 0, 0);
  assert.equal(partial.result, 'D');
  assert.equal(partial.correct, true);
  assert.equal(partial.ou_pick, null);
  assert.equal(partial.ou_correct, null);
  assert.equal(partial.ll_ou25, null);
  assert.equal(partial.btts_pick, null);
  assert.equal(partial.brier_btts, null);
  assert.ok(partial.ll_1x2! > 0);

  const no1x2 = rowScores({ p_home: null, p_draw: null, p_away: null, pick: '2' }, 0, 1);
  assert.equal(no1x2.correct, true);
  assert.equal(no1x2.ll_1x2, null);
  assert.equal(no1x2.brier_1x2, null);
});

test('ISO weeks: Monday start, year boundary, round-trip label', () => {
  const w = isoWeekOf(new Date('2026-09-06T21:00:00Z')); // Sunday
  assert.equal(isoWeekLabel(w), '2026-W36');
  assert.equal(w.weekStart.toISOString(), '2026-08-31T00:00:00.000Z');
  assert.equal(w.weekEnd.toISOString(), '2026-09-07T00:00:00.000Z');
  assert.equal(isoWeekLabel(isoWeekOf(new Date('2027-01-01T12:00:00Z'))), '2026-W53');
  assert.equal(isoWeekLabel(isoWeekOf(new Date('2026-01-01T12:00:00Z'))), '2026-W01');
  const p = parseIsoWeek('2026-W36')!;
  assert.equal(p.weekStart.toISOString(), w.weekStart.toISOString());
  assert.equal(parseIsoWeek('2026-W60'), null);
  assert.equal(parseIsoWeek('nope'), null);
  assert.equal(isoWeekLabel(previousIsoWeek(new Date('2026-09-07T05:00:00Z'))), '2026-W36');
});

test('calibration bins and ECE', () => {
  assert.equal(binIndex(0), 0);
  assert.equal(binIndex(0.55), 5);
  assert.equal(binIndex(1), 9);
  assert.equal(binIndex(NaN), -1);
  const a = makeBinAccs();
  addToBins(a, 0.62, true); addToBins(a, 0.64, false); // bin 6: pred .63, obs .5
  addToBins(a, 0.9, true);                              // bin 9: pred .9, obs 1
  const ece = eceFromBins(a)!;
  assert.equal(ece, 0.1200); // (2/3)*|0.63-0.5| + (1/3)*|0.9-1| = 0.0867+0.0333
  const merged = mergeBins([a, a]);
  assert.equal(merged[6].n, 4);
  assert.equal(eceFromBins(merged), ece); // ECE is scale-free over identical weeks
  assert.equal(eceFromBins(makeBinAccs()), null);
});
