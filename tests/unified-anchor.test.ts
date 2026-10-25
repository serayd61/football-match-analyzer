import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorMatchResultConfidence } from '../src/lib/unified-consensus/anchor';

const probs = { home: 0.62, draw: 0.23, away: 0.15 };
test('1X2 güveni seçilen sonucun motor olasılığıdır', () => {
  assert.equal(anchorMatchResultConfidence('1', probs), 62);
  assert.equal(anchorMatchResultConfidence('X', probs), 23);
  assert.equal(anchorMatchResultConfidence('2', probs), 20); // taban 20
});
test('motor yoksa veya seçim tanınmıyorsa dokunmaz', () => {
  assert.equal(anchorMatchResultConfidence('1', null), null);
  assert.equal(anchorMatchResultConfidence('HOME', probs), null);
  assert.equal(anchorMatchResultConfidence('1', { home: NaN, draw: 0.3, away: 0.3 }), null);
});
test('tavan 95', () => { assert.equal(anchorMatchResultConfidence('1', { home: 0.99, draw: 0.005, away: 0.005 }), 95); });
