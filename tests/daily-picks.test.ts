import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDailyPicks, settlePick, tallyPicks, MIN_BTTS, MIN_OVER, ODDS_MAX } from '@/lib/site/daily-picks-rule';

const row = (o: Partial<Parameters<typeof selectDailyPicks>[0][number]>) => ({
  fixtureId: 1, leagueSlug: 'bundesliga', kickoff: '2026-09-12T14:30:00Z', pBttsYes: 0.5, pOver25: 0.5, ...o,
});

test('only whitelisted leagues and only above-threshold goal markets qualify', () => {
  const picks = selectDailyPicks([
    row({ fixtureId: 1, leagueSlug: 'ligue-1', pOver25: 0.9 }),          // lig dışı
    row({ fixtureId: 2, leagueSlug: 'bundesliga', pOver25: MIN_OVER - 0.01, pBttsYes: MIN_BTTS - 0.01 }), // eşik altı
    row({ fixtureId: 3, leagueSlug: 'eredivisie', pOver25: 0.70 }),
  ]);
  assert.deepEqual(picks.map((p) => p.fixtureId), [3]);
  assert.equal(picks[0].market, 'ou25');
  assert.equal(picks[0].oddsSource, 'fair');
  assert.equal(picks[0].odds, 1.43);
});

test('one leg per fixture: the market that clears its threshold by more wins', () => {
  const [p] = selectDailyPicks([row({ pOver25: 0.78, pBttsYes: 0.77 })]);
  assert.equal(p.market, 'btts'); // +17 > +13
});

test('book odds outside the band drop the leg; fair odds use the same band', () => {
  const picks = selectDailyPicks([
    row({ fixtureId: 1, pBttsYes: 0.7, bttsYesOdds: ODDS_MAX + 0.1 }),
    row({ fixtureId: 2, pBttsYes: 0.7, bttsYesOdds: 1.45 }),
    row({ fixtureId: 3, pBttsYes: 0.62 }),
    row({ fixtureId: 4, pOver25: 0.87 }), // adil oran 1.15 < 1.25 → dışarıda (PSV–Sparta, 2026-09-13)
  ]);
  assert.deepEqual(picks.map((p) => [p.fixtureId, p.oddsSource]), [[2, 'book'], [3, 'fair']]);
});

test('takes the top three by probability, skips kicked-off matches', () => {
  const now = Date.parse('2026-09-12T15:00:00Z');
  const picks = selectDailyPicks([
    row({ fixtureId: 1, pOver25: 0.9, kickoff: '2026-09-12T14:30:00Z' }), // başlamış
    row({ fixtureId: 2, pOver25: 0.70, kickoff: '2026-09-12T16:00:00Z' }),
    row({ fixtureId: 3, pOver25: 0.80, kickoff: '2026-09-12T16:00:00Z' }),
    row({ fixtureId: 4, pOver25: 0.75, kickoff: '2026-09-12T16:00:00Z' }),
    row({ fixtureId: 5, pOver25: 0.66, kickoff: '2026-09-12T16:00:00Z' }),
  ], now);
  assert.deepEqual(picks.map((p) => p.fixtureId), [3, 4, 2]);
});

test('settlement follows the score', () => {
  assert.equal(settlePick('btts', 1, 1), true);
  assert.equal(settlePick('btts', 2, 0), false);
  assert.equal(settlePick('ou25', 2, 1), true);
  assert.equal(settlePick('ou25', 1, 1), false);
});

test('fair-odds legs count for the hit rate but never enter the real return', () => {
  // denetimdeki karşı örnek: p=0,70 → adil 1,43; tek kazanan adil ayak eskiden +%43 "getiri" üretiyordu
  const onlyFair = tallyPicks([{ market: 'ou25', odds: 1.43, oddsSource: 'fair', won: true }]);
  assert.equal(onlyFair.n, 1); assert.equal(onlyFair.won, 1);
  assert.equal(onlyFair.roi, null); assert.equal(onlyFair.nBook, 0);
  assert.ok(Math.abs(onlyFair.roiFair! - 0.43) < 1e-9);

  const mixed = tallyPicks([
    { market: 'btts', odds: 1.60, oddsSource: 'book', won: true },
    { market: 'btts', odds: 1.50, oddsSource: 'book', won: false },
    { market: 'ou25', odds: 1.43, oddsSource: 'fair', won: true },
  ]);
  assert.equal(mixed.n, 3); assert.equal(mixed.won, 2);
  assert.equal(mixed.nBook, 2); assert.equal(mixed.nFair, 1);
  assert.ok(Math.abs(mixed.roi! - (1.60 - 2) / 2) < 1e-9); // −%20, adil ayak paydada yok
  assert.deepEqual(mixed.byMarket, { btts: { n: 2, won: 1 }, ou25: { n: 1, won: 1 } });
});
