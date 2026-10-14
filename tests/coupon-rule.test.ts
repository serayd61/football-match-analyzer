import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCoupon, settleCoupon, addCoupon, emptyCouponTally, couponHit, couponRoi, couponText, couponResultText, TARGET_MIN, TARGET_MAX, type CouponLeg } from '@/lib/site/coupon-rule';

const NOW = Date.parse('2026-10-14T07:30:00Z');
const leg = (id: number, p: number, odds: number, market: CouponLeg['market'] = '1x2', selection: CouponLeg['selection'] = '1', ko = '2026-10-14T18:00:00Z'): CouponLeg =>
  ({ fixtureId: id, kickoff: ko, leagueLabel: 'L', homeName: `H${id}`, awayName: `A${id}`, market, selection, p, odds });

test('selectCoupon picks the highest joint probability pair inside the 2.0–2.6 band', () => {
  const c = selectCoupon([leg(1, 0.80, 1.30), leg(2, 0.72, 1.45), leg(3, 0.70, 1.70), leg(4, 0.65, 1.90)], NOW)!;
  assert.ok(c);
  // 1×3 = 2.21 (p .56), 2×3 = 2.465 (p .504), 1×4 = 2.47 (p .52), 1×2 = 1.885 (<2.0 ✗)
  assert.deepEqual(c.legs.map((l) => l.fixtureId), [1, 3]);
  assert.equal(c.totalOdds, 2.21);
  assert.ok(c.totalOdds >= TARGET_MIN && c.totalOdds <= TARGET_MAX);
});

test('selectCoupon: below band → null; above band → lowest total; filters p, odds, started, duplicate fixture', () => {
  assert.equal(selectCoupon([leg(1, 0.80, 1.30), leg(2, 0.78, 1.35)], NOW), null);
  const hi = selectCoupon([leg(1, 0.62, 1.70), leg(2, 0.61, 1.60), leg(3, 0.60, 1.80)], NOW)!;
  assert.equal(hi.totalOdds, 2.72); // 1.70×1.60 en düşük bant-üstü
  assert.equal(selectCoupon([leg(1, 0.59, 1.5), leg(2, 0.9, 1.5)], NOW), null);               // p < 0.60
  assert.equal(selectCoupon([leg(1, 0.9, 1.1), leg(2, 0.9, 2.0)], NOW), null);                // oran ≤ 1.15
  assert.equal(selectCoupon([leg(1, 0.9, 1.5, '1x2', '1', '2026-10-14T07:00:00Z'), leg(2, 0.9, 1.5)], NOW), null); // başlamış
  assert.equal(selectCoupon([leg(1, 0.9, 1.5), leg(1, 0.8, 1.5, 'ou25', 'over')], NOW), null); // aynı maç
});

test('settleCoupon: won / lost / void / pending and tallies with ROI', () => {
  const legs = [leg(1, 0.7, 1.5), leg(2, 0.7, 1.5, 'ou25', 'over')];
  assert.equal(settleCoupon(legs, new Map([[1, [2, 0]], [2, [2, 1]]])).status, 'won');
  assert.equal(settleCoupon(legs, new Map([[1, [0, 0]]])).status, 'lost');          // bir bacak düştü, diğeri beklemeden
  assert.equal(settleCoupon(legs, new Map([[1, [2, 0]]])).status, 'pending');
  assert.equal(settleCoupon(legs, new Map([[1, [2, 0]], [2, null]])).status, 'void');
  const t = emptyCouponTally();
  addCoupon(t, 'won', 2.25, settleCoupon(legs, new Map([[1, [2, 0]], [2, [2, 1]]])).legs);
  addCoupon(t, 'lost', 2.4, settleCoupon(legs, new Map([[1, [0, 0]], [2, [2, 1]]])).legs);
  addCoupon(t, 'pending', 2.4, legs); addCoupon(t, 'void', 2.4, legs);
  assert.equal(t.n, 2); assert.equal(t.pending, 1); assert.equal(t.voided, 1);
  assert.equal(couponHit(t), 0.5);
  assert.ok(Math.abs(couponRoi(t)! - 0.125) < 1e-12);
  assert.equal(t.legsN, 4); assert.equal(t.legsWon, 3);
});

test('coupon texts carry legs, total odds, record and link', () => {
  const c = selectCoupon([leg(1, 0.80, 1.30), leg(3, 0.70, 1.70)], NOW)!;
  const t = emptyCouponTally(); addCoupon(t, 'won', 2.2, c.legs.map((l) => ({ ...l, won: true })));
  const tr = couponText(c, '2026-10-14', 'tr', t, 'https://x.y/z');
  assert.ok(tr.includes('Günün kuponu') && tr.includes('Toplam oran 2,21') && tr.includes('1/1 kupon tuttu') && tr.includes('ROI +120%') && tr.endsWith('https://x.y/z'));
  const en = couponText(c, '2026-10-14', 'en', null, 'https://x.y/z');
  assert.ok(en.includes('Coupon of the day') && en.includes('Total odds 2.21') && en.includes('Record just started'));
  const res = couponResultText({ legs: settleCoupon(c.legs, new Map([[1, [1, 0]], [3, [0, 1]]])).legs, totalOdds: 2.21, status: 'lost' }, '2026-10-14', 'tr', t);
  assert.ok(res.includes('Kupon sonucu') && res.includes('✗') && res.includes('Tutmadı'));
});
