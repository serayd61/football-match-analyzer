import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketFlag, riskWithMarket, marketFavourite, TIGHT_FAV } from '@/lib/site/risk';

test('market favourite by argmax', () => {
  assert.equal(marketFavourite({ pHome: 0.5, pDraw: 0.25, pAway: 0.25 }), '1');
  assert.equal(marketFavourite({ pHome: 0.3, pDraw: 0.3, pAway: 0.4 }), '2');
  assert.equal(marketFavourite({ pHome: 0.3, pDraw: 0.4, pAway: 0.3 }), 'X');
});

test('disagreement escalates to high regardless of confidence', () => {
  const m = { pHome: 0.55, pDraw: 0.25, pAway: 0.20 };
  assert.equal(marketFlag('2', m), 'disagree');
  assert.deepEqual(riskWithMarket(0.8, '2', m), { risk: 'high', flag: 'disagree' });
});

test('tight market escalates even when model agrees', () => {
  const m = { pHome: 0.40, pDraw: 0.28, pAway: 0.32 };
  assert.equal(marketFlag('1', m), 'tight');
  assert.equal(riskWithMarket(0.76, '1', m).risk, 'high');
  assert.ok(0.40 < TIGHT_FAV);
});

test('agreement on a clear favourite keeps the confidence label', () => {
  const m = { pHome: 0.58, pDraw: 0.24, pAway: 0.18 };
  assert.equal(marketFlag('1', m), null);
  assert.deepEqual(riskWithMarket(0.76, '1', m), { risk: 'low', flag: null });
  assert.deepEqual(riskWithMarket(0.68, '1', m), { risk: 'medium', flag: null });
});

test('no market → unchanged', () => {
  assert.deepEqual(riskWithMarket(0.7, '1', null), { risk: 'medium', flag: null });
  assert.deepEqual(riskWithMarket(null, '1', undefined), { risk: 'high', flag: null });
});
