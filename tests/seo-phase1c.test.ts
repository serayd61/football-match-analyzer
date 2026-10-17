import { test } from 'node:test';
import assert from 'node:assert/strict';
import IntlMessageFormat from 'intl-messageformat';
import { xgTable, goalsTable, leagueGoalSummary, seasonStart, type SettledLeagueRow } from '@/lib/site/league-tables';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// SEO Faz 1c (2026-10-17): per-league xG/xPTS table and goal statistics from settled rows.
const row = (o: Partial<SettledLeagueRow>): SettledLeagueRow => ({
  fixtureId: 1, kickoff: '2026-09-01T18:00:00Z', homeId: 1, homeName: 'A', awayId: 2, awayName: 'B', homeScore: 0, awayScore: 0,
  lambdaHome: 1.5, lambdaAway: 1.0, pHome: 0.5, pDraw: 0.25, pAway: 0.25, hasModel: true, ...o,
});

test('xG table: model goal expectations, xPTS and luck per club; unrated rows are skipped', () => {
  const rows = [
    row({ fixtureId: 1, homeScore: 2, awayScore: 1 }),                                   // A beats B at home: A xG 1.5, xPTS 1.75
    row({ fixtureId: 2, homeId: 2, homeName: 'B', awayId: 1, awayName: 'A', homeScore: 0, awayScore: 0, lambdaHome: 1.2, lambdaAway: 1.3, pHome: 0.4, pDraw: 0.3, pAway: 0.3 }), // draw
    row({ fixtureId: 3, homeId: 3, homeName: 'C', awayId: 1, awayName: 'A', homeScore: 1, awayScore: 3, hasModel: false }),   // not rated → excluded
    row({ fixtureId: 4, homeId: 3, homeName: 'C', awayId: 2, awayName: 'B', homeScore: null, awayScore: null }),             // no score → excluded
  ];
  const t = xgTable(rows);
  assert.deepEqual(t.map((r) => r.name), ['A', 'B']);
  const a = t[0];
  assert.equal(a.n, 2); assert.equal(a.gf, 2); assert.equal(a.ga, 1); assert.equal(a.pts, 4);
  assert.ok(Math.abs(a.xgf - (1.5 + 1.3)) < 1e-9 && Math.abs(a.xga - (1.0 + 1.2)) < 1e-9);
  assert.ok(Math.abs(a.xpts - ((0.5 * 3 + 0.25) + (0.3 * 3 + 0.3))) < 1e-9);
  assert.ok(Math.abs(a.luck - (4 - a.xpts)) < 1e-9);
  const b = t[1];
  assert.equal(b.pts, 1); assert.ok(Math.abs(b.xpts - ((0.25 * 3 + 0.25) + (0.4 * 3 + 0.3))) < 1e-9);
});

test('goal statistics: shares per club from every scored match, league summary, sort by over-2.5 share', () => {
  const rows = [
    row({ fixtureId: 1, homeScore: 2, awayScore: 1 }),                 // over, btts
    row({ fixtureId: 2, homeScore: 3, awayScore: 0, hasModel: false }), // over, A clean sheet, B failed to score
    row({ fixtureId: 3, homeId: 2, homeName: 'B', awayId: 3, awayName: 'C', homeScore: 1, awayScore: 1 }), // under, btts
    row({ fixtureId: 4, homeScore: null, awayScore: null }),
  ];
  const g = goalsTable(rows);
  const a = g.find((r) => r.name === 'A')!, b = g.find((r) => r.name === 'B')!;
  assert.equal(a.n, 2); assert.equal(a.over25, 1); assert.equal(a.btts, 0.5); assert.equal(a.cleanSheets, 1); assert.equal(a.failedToScore, 0); assert.equal(a.avgTotal, 3);
  assert.equal(b.n, 3); assert.ok(Math.abs(b.over25 - 2 / 3) < 1e-9); assert.equal(b.failedToScore, 1); assert.ok(Math.abs(b.btts - 2 / 3) < 1e-9);
  assert.equal(g[0].name, 'A');
  assert.deepEqual(leagueGoalSummary(rows), { n: 3, avgGoals: 8 / 3, over25: 2 / 3, btts: 2 / 3 });
  assert.equal(leagueGoalSummary([row({ homeScore: null })]), null);
});

test('season start: 1 July of the running European season, 1 January for the Brasileirão', () => {
  assert.equal(seasonStart({ slug: 'bundesliga' }, new Date('2026-10-17T00:00:00Z')).toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(seasonStart({ slug: 'bundesliga' }, new Date('2027-03-01T00:00:00Z')).toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(seasonStart({ slug: 'brasileirao' }, new Date('2026-10-17T00:00:00Z')).toISOString(), '2026-01-01T00:00:00.000Z');
});

test('Faz 1c strings compile in every locale, render, and carry no gambling-coded wording', () => {
  const sample: Record<string, unknown> = { league: 'L', country: 'C', team: 'T', xgd: '+3.2', n: 8, luck: '+2.1', unlucky: 'U', uluck: '-2.4', avg: '2.85', over: '58%', btts: '52%', low: 'W', lowOver: '30%', cs: 'K', csN: 5, ou: '61.8%', bt: '49.1%' };
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    for (const ns of ['xgTable', 'goalsStats']) {
      for (const [k, v] of Object.entries(m[ns] as Record<string, string>)) {
        const out = new IntlMessageFormat(v, name === 'de' ? 'de-CH' : name).format(sample) as string;
        assert.ok(out.length > 0 && !/\{[a-z]+\}/i.test(out), `${name} ${ns}.${k}: ${out}`);
      }
    }
    const text = JSON.stringify([m.xgTable, m.goalsStats]).toLowerCase();
    assert.ok(!/18\+|bookmaker|buchmacher|bahisçi|iddaa|wett-?tipp|scommess|kumar|gambl/.test(text), `${name}: Faz 1c strings carry gambling-coded wording`);
    // the honesty line: model figures, not shot xG
    assert.ok(/shot|schuss|tiri|şut/i.test(m.xgTable.whatIsP2), `${name}: xG table must say the figures are not shot-based xG`);
  }
});
