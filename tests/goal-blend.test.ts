import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketYes, blendYes, blendCall, yesSideP, rawEdge, shownP, GOAL_BLEND_WEIGHT, GOAL_BLEND_WEIGHT_BTTS } from '@/lib/site/goal-blend';

const noCurve = (raw: number) => raw;

test('marketYes devigs two-way odds multiplicatively; missing or invalid odds → null', () => {
  const p = marketYes(1.57, 2.30)!;
  assert.ok(Math.abs(p - (1 / 1.57) / (1 / 1.57 + 1 / 2.30)) < 1e-9);
  assert.equal(marketYes(1.57, null), null);
  assert.equal(marketYes(1.0, 2.0), null);
});

test('blend is (1-w)·model + w·market with w=0.7', () => {
  assert.equal(GOAL_BLEND_WEIGHT, 0.7);
  assert.ok(Math.abs(blendYes(0.66, 0.60) - (0.3 * 0.66 + 0.7 * 0.60)) < 1e-12);
  assert.equal(blendYes(0.66, null), 0.66);
});

test('blendCall: without odds behaves like the old derive + curve; with odds the shown p is blended and pRaw stays model', () => {
  const plain = blendCall(0.66, null, null, 'yes', 'no', (r) => r - 0.05)!;
  assert.deepEqual(plain, { pick: 'yes', p: 0.61, pRaw: 0.66, pMarket: null, blended: false });
  // Feyenoord–Utrecht KG: model %66, oran 1.57/2.30 → piyasa ≈ %59 → harman ≈ %61
  const b = blendCall(0.66, 1.57, 2.30, 'yes', 'no', noCurve)!;
  assert.equal(b.pick, 'yes'); assert.equal(b.blended, true); assert.equal(b.pRaw, 0.66);
  assert.ok(b.p! > 0.60 && b.p! < 0.63);
  assert.ok(b.pMarket! > 0.58 && b.pMarket! < 0.60);
});

test('blendCall flips the pick when the market disagrees strongly', () => {
  // model %55 Üst, piyasa Üst 2.20 / Alt 1.65 → piyasa ≈ %43 → harman ≈ %47 → Alt
  const c = blendCall(0.55, 2.20, 1.65, 'over', 'under', noCurve)!;
  assert.equal(c.pick, 'under');
  assert.ok(c.p! > 0.5);
  assert.ok(Math.abs(c.pRaw - 0.45) < 1e-12); // seçilen (Alt) tarafın model hamı
});

test('yesSideP returns the yes-side probability, blended when available', () => {
  const c = blendCall(0.55, 2.20, 1.65, 'over', 'under', noCurve)!;
  const y = yesSideP(c, 'over')!;
  assert.ok(y < 0.5 && y > 0.45);
  assert.equal(yesSideP(blendCall(0.40, null, null, 'yes', 'no', noCurve), 'yes'), 0.4);
  assert.equal(yesSideP(null, 'yes'), null);
});

test('rawEdge: ham model − marjsız piyasa; harman yoksa null', () => {
  assert.equal(rawEdge(null), null);
  assert.equal(rawEdge({ pick: 'over', p: 0.6, pRaw: 0.6, pMarket: null, blended: false }), null);
  const e = rawEdge({ pick: 'yes', p: 0.57, pRaw: 0.64, pMarket: 0.54, blended: true });
  assert.ok(e != null && Math.abs(e - 0.10) < 1e-9);
  assert.ok(rawEdge({ pick: 'under', p: 0.5, pRaw: 0.48, pMarket: 0.51, blended: true })! < 0);
});

test('KG (2026-11-06): oran varsa saf piyasa (w=1), ham model yalnız pRaw olarak kalır; oran yoksa eğri', () => {
  assert.equal(GOAL_BLEND_WEIGHT_BTTS, 1.0);
  const noCurve = (r: number) => r;
  // model %75 KG Var, piyasa 1,80/1,95 → marjsız ≈ %52: gösterilen %52, seçim yine Var; pRaw %75 kalır
  const c = blendCall(0.75, 1.80, 1.95, 'yes', 'no', noCurve, GOAL_BLEND_WEIGHT_BTTS)!;
  assert.equal(c.blended, true); assert.equal(c.pick, 'yes');
  assert.ok(Math.abs(c.p! - c.pMarket!) < 1e-9);           // model payı sıfır
  assert.equal(c.pRaw, 0.75);
  assert.ok(Math.abs(shownP(c)! - c.pMarket!) < 1e-9);
  // piyasa KG Yok diyorsa seçim ters döner (model %75 olsa da)
  const d = blendCall(0.75, 2.40, 1.55, 'yes', 'no', noCurve, GOAL_BLEND_WEIGHT_BTTS)!;
  assert.equal(d.pick, 'no');
  // oran yok → eğriden geçen değer gösterilir, shownP de onu verir
  const e = blendCall(0.75, null, null, 'yes', 'no', (r) => r - 0.12, GOAL_BLEND_WEIGHT_BTTS)!;
  assert.equal(e.blended, false); assert.ok(Math.abs(e.p! - 0.63) < 1e-9); assert.equal(shownP(e), e.p);
  assert.equal(shownP(null), null);
});
