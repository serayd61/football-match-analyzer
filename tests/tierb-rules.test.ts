import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTierB, candidateLegs, legWon, priceLeg, withMargin, tierBRecord, formatTierBDm, TIER_B_THRESHOLDS, type TierBInput } from '@/lib/tierb/rules';

const now = new Date('2026-09-23T06:30:00Z');
const row = (o: Partial<TierBInput>): TierBInput => ({ fixtureId: 1, leagueId: 100, leagueName: 'Eliteserien', home: 'Bodø/Glimt', away: 'Sandefjord', kickoff: '2026-09-23T17:00:00Z', pHome: 0.5, pDraw: 0.25, pAway: 0.25, pOver25: 0.5, pBtts: 0.5, lambdaHome: 1.5, lambdaAway: 1.2, ...o });

test('one leg per match: the market furthest above its threshold wins; whitelist, noise and past kickoffs are skipped', () => {
  const legs = selectTierB([
    row({ fixtureId: 1, pHome: 0.82, pDraw: 0.1, pAway: 0.08, pOver25: 0.90 }),                 // MS1 +2 vs Üst +5 → Üst
    row({ fixtureId: 2, leagueId: 47, leagueName: 'Premier League', pHome: 0.9 }),              // beyaz liste → atla
    row({ fixtureId: 3, leagueName: 'Eliteserien Women', pHome: 0.9 }),                          // gürültü → atla
    row({ fixtureId: 4, kickoff: '2026-09-23T05:00:00Z', pHome: 0.9 }),                          // başlamış → atla
    row({ fixtureId: 5, pOver25: 0.2 }),                                                          // Alt %80 ≥ 75 → Alt
    row({ fixtureId: 6, pBtts: 0.84, lambdaHome: 2.5, lambdaAway: 1.0 }),                        // λ oranı 2,5 → KG yok
    row({ fixtureId: 7, pBtts: 0.84, kickoff: '2026-09-23T12:00:00Z' }),                          // KG ✓ (erken saat → önce)
  ], { whitelist: new Set([47]), now });
  assert.deepEqual(legs.map((l) => [l.fixtureId, l.market, l.selection, l.modelP]), [[7, 'btts', 'yes', 0.84], [1, 'ou25', 'over', 0.9], [5, 'ou25', 'under', 0.8]]);
  assert.equal(candidateLegs(row({ pHome: 0.79 })).length, 0);
  assert.equal(TIER_B_THRESHOLDS.x12, 0.8);
});

test('legWon settles every market', () => {
  assert.equal(legWon('1x2', '1', 2, 1), true); assert.equal(legWon('1x2', 'X', 1, 1), true); assert.equal(legWon('1x2', '2', 1, 1), false);
  assert.equal(legWon('ou25', 'over', 2, 1), true); assert.equal(legWon('ou25', 'under', 2, 1), false);
  assert.equal(legWon('btts', 'yes', 1, 0), false); assert.equal(legWon('btts', 'yes', 1, 1), true);
});

test('priceLeg devigs the selected market and withMargin gives model-minus-market in points', () => {
  const odds = { bookmaker: 'Bet365', home: 1.25, draw: 5.5, away: 11, over25: 1.4, under25: 2.9, bttsYes: null, bttsNo: null };
  const p = priceLeg('1x2', '1', odds)!;
  assert.equal(p.odds, 1.25);
  assert.ok(p.marketP > 0.74 && p.marketP < 0.75);   // 0.8/(0.8+0.182+0.091) = 0.745
  const o = withMargin(priceLeg('ou25', 'over', odds)!, 0.9);
  assert.ok(o.marketP > 0.67 && o.marketP < 0.68);   // (1/1.4)/(1/1.4+1/2.9) = 0.714/1.059 = 0.674
  assert.equal(o.margin, 22.6);
  assert.equal(priceLeg('btts', 'yes', odds), null);
});

test('record and DM text', () => {
  const rec = tierBRecord([
    { market: 'ou25', won: true, odds: 1.4, settled_at: 'x' }, { market: 'ou25', won: false, odds: 1.5, settled_at: 'x' },
    { market: '1x2', won: true, odds: null, settled_at: 'x' }, { market: 'btts', won: null, odds: null, settled_at: null }, { market: 'btts', won: null, odds: null, settled_at: 'x' },
  ]);
  assert.deepEqual([rec.n, rec.won, rec.lost, rec.pending, rec.void, rec.priced, rec.roi], [3, 2, 1, 1, 1, 2, -30]);
  const text = formatTierBDm('2026-09-23', [{ ...candidateLegs(row({ pOver25: 0.9 }))[0], price: { odds: 1.4, marketP: 0.674, margin: 22.6 } }], rec, { date: '2026-09-22', rows: [{ home: 'A', away: 'B', market: 'ou25', selection: 'over', won: true, hs: 3, as: 1 }] });
  assert.match(text, /• .*Bodø\/Glimt – Sandefjord · Üst 2,5 %90 @1\.40 \(piyasa %67, marj \+22\.6\)/);
  assert.match(text, /Dün \(2026-09-22\): 1\/1/);
  assert.match(text, /Karne 30 gün: 2\/3 \(%67\) — MS 1\/1 · Ü\/A 1\/2 · ROI -30% \(2 oranlı\) · 1 bekliyor/);
});
