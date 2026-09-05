import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRoi, finishRoi, mkRoi, isPickCorrect } from '@/lib/site/roi';
import { asOfFilter } from '@/lib/site/asof';

const od = (o: Partial<Parameters<typeof addRoi>[2]>) => ({ fixture_id: 1, phase: 'closing' as const, provider: 'Bet365', home_odds: 2.0, draw_odds: 3.5, away_odds: 4.0, captured_at: '2026-09-01T00:00:00Z', ...o });

test('ROI shows its denominator: missing odds are counted, not dropped', () => {
  const acc = mkRoi();
  addRoi(acc, { pick: '1', result: 'H', kickoff: '2026-09-01T14:00:00Z' }, od({}), true);
  addRoi(acc, { pick: 'X', result: 'A', kickoff: '2026-09-02T14:00:00Z' }, od({ provider: 'Pinnacle' }), false);
  const roi = finishRoi(acc, 'closing', 5)!;
  assert.equal(roi.bets, 2);
  assert.equal(roi.missing, 3);
  assert.equal(roi.coverage, 0.4);
  assert.deepEqual(roi.providers, ['Bet365', 'Pinnacle']);
  assert.equal(roi.profit, 2.0 - 2);
  assert.equal(roi.marketAcc, 0.5);
});

test('a price ≤ 1 or an incomplete 1X2 line is not a bet', () => {
  const acc = mkRoi();
  assert.equal(addRoi(acc, { pick: '1', result: 'H', kickoff: 'k' }, od({ home_odds: 1 }), true), false);
  assert.equal(addRoi(acc, { pick: '2', result: 'A', kickoff: 'k' }, od({ draw_odds: 0 }), true), false);
  assert.equal(finishRoi(acc, 'opening', 2), null);
});

test('correct=null settled rows are re-derived from pick and result', () => {
  assert.equal(isPickCorrect('1', 'H'), true);
  assert.equal(isPickCorrect('X', 'D'), true);
  assert.equal(isPickCorrect('2', 'H'), false);
  assert.equal(isPickCorrect(null, 'H'), false);
});

test('form / H2H queries are bounded to kick-offs strictly before the examined match', () => {
  const calls: Array<[string, string]> = [];
  const stub = { lt(col: string, v: string) { calls.push([col, v]); return stub; } };
  asOfFilter(stub, '2026-09-05T14:00:00Z');
  assert.deepEqual(calls, [['kickoff', '2026-09-05T14:00:00Z']]);
  asOfFilter(stub, null);
  assert.equal(calls.length, 1, 'no bound when not requested');
  assert.throws(() => asOfFilter(stub, 'nope'));
});
