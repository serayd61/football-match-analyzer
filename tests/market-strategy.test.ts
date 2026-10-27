import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strategy1x2, strategyBtts, devigYes, devig1x2, STRATEGY } from '../src/lib/unified-consensus/market-strategy';

test('1X2: motor ve piyasa aynı favori, harman ≥60 → seçim', () => {
  const r = strategy1x2({ home: 0.62, draw: 0.22, away: 0.16 }, { home: 0.66, draw: 0.2, away: 0.14 })!;
  assert.equal(r.prediction, '1'); assert.equal(r.abstain, false); assert.equal(r.confidence, 65); assert.equal(r.source, 'dc+market');
});
test('1X2: motor ile piyasa ayrışırsa çekimser, güven tavanı 49', () => {
  const r = strategy1x2({ home: 0.5, draw: 0.25, away: 0.25 }, { home: 0.3, draw: 0.25, away: 0.45 })!;
  assert.equal(r.abstain, true); assert.ok(r.confidence <= STRATEGY.abstainCap); assert.match(r.reasoning, /ayrışıyor/);
});
test('1X2: aynı favori ama harman <60 → çekimser', () => {
  const r = strategy1x2({ home: 0.5, draw: 0.3, away: 0.2 }, { home: 0.52, draw: 0.28, away: 0.2 })!;
  assert.equal(r.prediction, '1'); assert.equal(r.abstain, true);
});
test('1X2: tek kaynak eşik üstü → seçim, veri yok → null', () => {
  assert.equal(strategy1x2({ home: 0.7, draw: 0.2, away: 0.1 }, null)!.abstain, false);
  assert.equal(strategy1x2(null, { home: 0.3, draw: 0.3, away: 0.4 })!.abstain, true);
  assert.equal(strategy1x2(null, null), null);
  assert.equal(strategy1x2({ home: NaN, draw: 0.3, away: 0.3 } as any, null), null);
});
test('KG: piyasa ≥60 ve motor ≥55 → Var', () => {
  const r = strategyBtts(0.58, 0.64)!; assert.equal(r.prediction, 'Yes'); assert.equal(r.abstain, false); assert.equal(r.confidence, 62);
});
test('KG: piyasa eşik altı veya motor eşik altı → çekimser; Yok asla önerilmez', () => {
  assert.equal(strategyBtts(0.7, 0.55)!.abstain, true);
  assert.equal(strategyBtts(0.5, 0.65)!.abstain, true);
  const no = strategyBtts(0.3, 0.35)!; assert.equal(no.prediction, 'No'); assert.equal(no.abstain, true); assert.ok(no.confidence <= STRATEGY.abstainCap);
  assert.equal(strategyBtts(0.7, null)!.abstain, true); // piyasa yoksa KG önerilmez
  assert.equal(strategyBtts(null, null), null);
});
test('devig', () => {
  assert.ok(Math.abs(devigYes(1.8, 2.0)! - 0.526) < 0.001);
  assert.equal(devigYes(1.0, 2.0), null);
  const p = devig1x2({ home: 2.0, draw: 3.5, away: 4.0 })!; assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9); assert.ok(p.home > p.away);
});
