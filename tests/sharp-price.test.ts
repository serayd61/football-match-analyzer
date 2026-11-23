import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAfBooks, parseAfOdds } from '@/lib/data-sources/api-football-pure';
import { sharpEdges, sharpFair, selectionWon, type BookRow } from '@/lib/site/sharp-price';

const bet = (id: number, values: Array<[string, string]>) => ({ id, values: values.map(([value, odd]) => ({ value, odd })) });
const RESP = [{
  bookmakers: [
    { id: 8, name: 'Bet365', bets: [bet(1, [['Home', '2.10'], ['Draw', '3.40'], ['Away', '3.60']]), bet(5, [['Over 2.5', '1.90'], ['Under 2.5', '1.90']]), bet(8, [['Yes', '1.80'], ['No', '2.00']])] },
    { id: 4, name: 'Pinnacle', bets: [bet(1, [['Home', '2.00'], ['Draw', '3.50'], ['Away', '4.00']]), bet(5, [['Over 2.5', '1.95'], ['Under 2.5', '1.95']])] },
    { id: 99, name: 'HalfBook', bets: [bet(1, [['Home', '2.30']])] },
    { id: 8, name: 'Bet365 duplicate', bets: [bet(1, [['Home', '9'], ['Draw', '9'], ['Away', '9']])] },
  ],
}];

const row = (b: ReturnType<typeof parseAfBooks>[number]): BookRow => ({
  bookmaker_id: b.bookmakerId, bookmaker: b.bookmaker, home: b.home, draw: b.draw, away: b.away,
  over25: b.over25, under25: b.under25, btts_yes: b.bttsYes, btts_no: b.bttsNo,
});

test('parseAfBooks returns every bookmaker with a complete market, once', () => {
  const books = parseAfBooks(RESP);
  assert.deepEqual(books.map((b) => b.bookmakerId), [8, 4]);
  assert.equal(books[0].home, 2.1);
  assert.equal(books[1].bttsYes, null);
  assert.deepEqual(parseAfBooks([]), []);
  assert.equal(parseAfOdds(RESP)?.bookmaker, 'Bet365'); // mevcut tek-bahisçi yolu değişmedi
});

test('sharpFair de-vigs each complete Pinnacle market and skips missing ones', () => {
  const fair = sharpFair(parseAfBooks(RESP).map(row).find((b) => b.bookmaker_id === 4));
  assert.ok(Math.abs((fair.home ?? 0) + (fair.draw ?? 0) + (fair.away ?? 0) - 1) < 1e-9);
  assert.ok(Math.abs((fair.over25 ?? 0) - 0.5) < 1e-9);
  assert.equal(fair.btts_yes, undefined);
  assert.deepEqual(sharpFair(null), {});
});

test('sharpEdges compares the best soft price with the sharp fair price', () => {
  const edges = sharpEdges(parseAfBooks(RESP).map(row));
  assert.deepEqual(edges.map((e) => e.selection), ['home', 'draw', 'away', 'over25', 'under25']); // KG: Pinnacle'da yok
  const home = edges.find((e) => e.selection === 'home')!;
  assert.equal(home.odds, 2.1);
  assert.equal(home.bookmaker, 'Bet365');
  assert.ok(Math.abs(home.edge - (home.fair * 2.1 - 1)) < 1e-12);
  assert.ok(home.edge > 0 && edges.find((e) => e.selection === 'away')!.edge < 0);
  assert.deepEqual(sharpEdges(parseAfBooks(RESP).map(row), { only: [16] }), []);
  assert.deepEqual(sharpEdges(parseAfBooks(RESP).map(row).filter((b) => b.bookmaker_id !== 4)), []); // keskin yoksa kural yok
});

test('selectionWon settles every selection and returns null without a score', () => {
  assert.equal(selectionWon('home', 2, 1), true);
  assert.equal(selectionWon('draw', 1, 1), true);
  assert.equal(selectionWon('away', 2, 1), false);
  assert.equal(selectionWon('over25', 2, 1), true);
  assert.equal(selectionWon('under25', 2, 1), false);
  assert.equal(selectionWon('btts_yes', 2, 0), false);
  assert.equal(selectionWon('btts_no', 2, 0), true);
  assert.equal(selectionWon('home', null, null), null);
});
