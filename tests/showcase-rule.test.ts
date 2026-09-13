import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showcaseFor, settleShowcase, EDGE_MAX_1X2 } from '@/lib/site/showcase-rule';

const base = { fixtureId: 1, leagueSlug: 'bundesliga', kickoff: '2026-09-13T13:30:00Z', pick: '1' as const, pHome: 0.55, pDraw: 0.25, pAway: 0.20, pBttsYes: 0.5, pOver25: 0.5, market: { pHome: 0.53, pDraw: 0.25, pAway: 0.22, phase: 'h12' } };

test('goal market wins first; the market clearing its threshold by more is chosen', () => {
  const p = showcaseFor({ ...base, pBttsYes: 0.63, pOver25: 0.70 }); // KG +3, Üst +5
  assert.equal(p.market, 'ou25'); assert.equal(p.selection, 'over'); assert.equal(p.reason, 'goal');
  const q = showcaseFor({ ...base, pBttsYes: 0.66, pOver25: 0.66 }); // KG +6, Üst +1
  assert.equal(q.market, 'btts'); assert.equal(q.selection, 'yes');
});

test('1X2 only when edge is below the cap', () => {
  const ok = showcaseFor(base);
  assert.equal(ok.market, '1x2'); assert.equal(ok.selection, '1'); assert.ok(Math.abs(ok.edge1x2! - 0.02) < 1e-9);
  const hi = showcaseFor({ ...base, market: { pHome: 0.55 - EDGE_MAX_1X2, pDraw: 0.25, pAway: 0.25, phase: 'opening' } });
  assert.equal(hi.market, null); assert.equal(hi.reason, 'edge_high');
});

test('no market → no 1X2; weak league → no 1X2; goal picks unaffected', () => {
  assert.equal(showcaseFor({ ...base, market: null }).reason, 'no_market');
  assert.equal(showcaseFor({ ...base, leagueSlug: 'premier-league' }).reason, 'league_no_1x2');
  const g = showcaseFor({ ...base, leagueSlug: 'premier-league', market: null, pBttsYes: 0.7 });
  assert.equal(g.market, 'btts');
});

test('settlement', () => {
  assert.equal(settleShowcase('1x2', '2', 0, 1), true);
  assert.equal(settleShowcase('1x2', 'X', 1, 1), true);
  assert.equal(settleShowcase('1x2', '1', 1, 1), false);
  assert.equal(settleShowcase('ou25', 'over', 2, 1), true);
  assert.equal(settleShowcase('btts', 'yes', 2, 0), false);
});
