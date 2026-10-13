import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusBoard, focusRecord, recordKey } from '@/lib/site/focus-board';
import type { SignalTable } from '@/lib/site/signal-buckets';
import type { StandingDay } from '@/lib/site/standing-picks-rule';

const lg = (slug: string, name: string) => ({ slug, name, ccode: 'XX', fdCode: slug, ids: [], country: 'X' }) as any;
const c = (won: number, n: number) => ({ n, won, acc: n ? won / n : null });
const LEVEL = ['<50%', '50–60%', '60–70%', '≥70%'];
const EDGE = ['≤−5', '−5…0', '0…+5', '+5…+10', '>+10'];

const tables: SignalTable[] = [
  { market: '1x2', kind: 'level', buckets: LEVEL, all: [c(135, 358), c(65, 144), c(58, 77), c(37, 50)], leagues: [] },
  { market: '1x2', kind: 'edge', buckets: EDGE, all: [c(81, 138), c(58, 109), c(51, 108), c(28, 65), c(19, 78)], leagues: [
    { league: lg('laliga', 'LaLiga'), n: 68, cells: [c(15, 23), c(8, 14), c(10, 17), c(0, 7), c(0, 7)] },
    { league: lg('liga-portugal', 'Liga Portugal'), n: 57, cells: [c(9, 16), c(4, 9), c(7, 11), c(8, 10), c(4, 11)] },
    { league: lg('serie-a', 'Serie A'), n: 17, cells: [c(4, 5), c(2, 6), c(1, 2), c(1, 3), c(1, 3)] },
  ] },
  { market: 'ou25', kind: 'level', buckets: LEVEL, all: [c(0, 0), c(197, 346), c(126, 217), c(43, 66)], leagues: [
    { league: lg('laliga', 'LaLiga'), n: 68, cells: [c(0, 0), c(27, 38), c(14, 19), c(8, 11)] },
    { league: lg('liga-portugal', 'Liga Portugal'), n: 66, cells: [c(0, 0), c(17, 31), c(16, 30), c(2, 5)] },
    { league: lg('serie-a', 'Serie A'), n: 51, cells: [c(0, 0), c(16, 27), c(11, 21), c(2, 3)] },
  ] },
  { market: 'btts', kind: 'level', buckets: LEVEL, all: [c(0, 0), c(215, 417), c(116, 191), c(15, 21)], leagues: [
    { league: lg('laliga', 'LaLiga'), n: 68, cells: [c(0, 0), c(24, 44), c(12, 22), c(2, 2)] },
  ] },
  { market: 'btts', kind: 'edge', buckets: EDGE, all: [c(17, 28), c(62, 105), c(108, 169), c(59, 133), c(27, 58)], leagues: [] },
];

test('focusBoard: strong zones per league × market in the primary evidence kind, sorted by strong count', () => {
  const b = focusBoard(tables);
  // Tüm ligler: 1X2 fark ≤−5 %58,7 güçlü; Üst ≥70% %65,2 güçlü; KG ≥70% %71,4 güçlü
  assert.deepEqual(b.all.cells['1x2']!.zones.map((z) => z.bucket), ['≤−5']);
  assert.equal(b.all.cells['1x2']!.kind, 'edge');
  assert.deepEqual(b.all.cells.ou25!.zones.map((z) => z.bucket), ['≥70%']);
  assert.deepEqual(b.all.cells.btts!.zones.map((z) => z.bucket), ['≥70%']);
  assert.equal(b.all.strong, 3);
  // LaLiga: 1X2 ≤−5 %65, −5…0 %57, 0…+5 %59 güçlü (33/54), +5 üstü 0/7 n<10; Üst üç dilim de güçlü → 49/68; KG dilimi yok (%54,5 / %54,5 → 'mid', ≥70 n<10)
  const la = b.leagues.find((r) => r.league!.slug === 'laliga')!;
  assert.deepEqual(la.cells['1x2']!.zones.map((z) => z.bucket), ['≤−5', '−5…0', '0…+5']);
  assert.equal(la.cells['1x2']!.n, 54); assert.equal(la.cells['1x2']!.won, 33);
  assert.deepEqual(la.cells.ou25!.zones.map((z) => z.bucket), ['50–60%', '60–70%', '≥70%']);
  assert.equal(la.cells.ou25!.n, 68); assert.equal(la.cells.ou25!.won, 49);
  assert.equal(la.cells.btts!.verdict, 'mid'); assert.equal(la.cells.btts!.zones.length, 0);
  assert.equal(la.cells.btts!.best!.bucket, '50–60%'); // eşitlikte büyük örneklem
  assert.equal(la.strong, 2);
  // Liga Portugal: 1X2 ≤−5 %56, 0…+5 %64, +5…+10 %80 güçlü; −5…0 n<10, >+10 %36; Üst güçlü dilim yok (%54,8 / %53,3 → mid)
  const pt = b.leagues.find((r) => r.league!.slug === 'liga-portugal')!;
  assert.deepEqual(pt.cells['1x2']!.zones.map((z) => z.bucket), ['≤−5', '0…+5', '+5…+10']);
  assert.equal(pt.cells['1x2']!.best!.bucket, '+5…+10');
  assert.equal(pt.cells.ou25!.verdict, 'mid');
  assert.equal(pt.strong, 1);
  // Serie A: 1X2 kovalarının hiçbiri ≥10 değil → hücre null; Üst 50–60 %59 → mid
  const sa = b.leagues.find((r) => r.league!.slug === 'serie-a')!;
  assert.equal(sa.cells['1x2'], null);
  assert.equal(sa.cells.ou25!.verdict, 'mid');
  assert.equal(sa.cells.btts, null); // tabloda satırı yok, kaydı yok
  assert.deepEqual(b.leagues.map((r) => r.league!.slug), ['laliga', 'liga-portugal', 'serie-a']);
});

test('focusRecord: frozen picks aggregated per league × market and overall; pending excluded', () => {
  const pick = (fixtureId: number, market: any, leagueSlug: string | null, leagueLabel: string, won: boolean | null) => ({
    fixtureId, market, selection: '1', kickoff: '2026-10-10T18:00:00Z', leagueLabel, leagueSlug, covered: !!leagueSlug,
    homeName: 'A', awayName: 'B', homeCrest: null, awayCrest: null, modelP: 0.6, marketP: null, edge: null, verdict: 'strong',
    acc: 0.6, evidenceN: 20, evidenceWon: 12, scope: 'league', homeScore: won == null ? null : 1, awayScore: won == null ? null : 0, won,
  });
  const days: StandingDay[] = [{ day: '2026-10-10', n: 3, won: 2, pending: 1, byMarket: {} as any, picks: [
    pick(1, 'ou25', 'laliga', 'LaLiga', true), pick(2, 'ou25', 'laliga', 'LaLiga', false), pick(3, 'btts', null, 'WAL · Premier League', true), pick(4, 'ou25', 'laliga', 'LaLiga', null),
  ] }];
  const rec = focusRecord(days);
  assert.deepEqual(rec.get(recordKey('laliga', 'ou25')), { n: 2, won: 1 });
  assert.deepEqual(rec.get(recordKey('WAL · Premier League', 'btts')), { n: 1, won: 1 });
  assert.deepEqual(rec.get(recordKey(null, 'ou25')), { n: 2, won: 1 });
  assert.equal(rec.get(recordKey('laliga', 'btts')), undefined);
  // kayıt hücreye iliştirilir
  const b = focusBoard(tables, rec);
  assert.deepEqual(b.leagues.find((r) => r.league!.slug === 'laliga')!.cells.ou25!.record, { n: 2, won: 1 });
  assert.deepEqual(b.all.cells.ou25!.record, { n: 2, won: 1 });
});
