import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAfOdds, teamSim, matchFixtures, afSeasonFor, afToMatchOdds } from '@/lib/data-sources/api-football-pure';

test('parseAfOdds prefers Bet365 and reads O/U 2.5, BTTS and 1X2', () => {
  const resp = [{ bookmakers: [
    { id: 4, name: 'Pinnacle', bets: [{ id: 5, values: [{ value: 'Over 2.5', odd: '1.90' }, { value: 'Under 2.5', odd: '1.95' }] }] },
    { id: 8, name: 'Bet365', bets: [
      { id: 1, values: [{ value: 'Home', odd: '2.10' }, { value: 'Draw', odd: '3.40' }, { value: 'Away', odd: '3.50' }] },
      { id: 5, values: [{ value: 'Over 1.5', odd: '1.25' }, { value: 'Over 2.5', odd: '1.80' }, { value: 'Under 2.5', odd: '2.00' }] },
      { id: 8, values: [{ value: 'Yes', odd: '1.66' }, { value: 'No', odd: '2.10' }] },
    ] },
  ] }];
  const o = parseAfOdds(resp)!;
  assert.equal(o.bookmaker, 'Bet365');
  assert.deepEqual([o.home, o.draw, o.away, o.over25, o.under25, o.bttsYes, o.bttsNo], [2.1, 3.4, 3.5, 1.8, 2.0, 1.66, 2.1]);
  assert.equal(parseAfOdds([]), null);
  assert.equal(parseAfOdds([{ bookmakers: [{ id: 9, name: 'X', bets: [{ id: 12, values: [] }] }] }]), null);
});

test('team similarity survives suffixes, diacritics and partial stems', () => {
  assert.ok(teamSim('Borussia Mönchengladbach', 'Borussia Monchengladbach') >= 0.99);
  assert.ok(teamSim('Inter', 'Internazionale') >= 0.7);
  assert.ok(teamSim('Manchester United', 'Manchester City') < 0.6);
  assert.ok(teamSim('Gençlerbirliği', 'Genclerbirligi') >= 0.99);
  assert.ok(teamSim('PSV Eindhoven', 'PSV') >= 0.5);
});

test('matchFixtures pairs by names within the same day and skips ambiguous ones', () => {
  const ours = [
    { fixtureId: 1, kickoff: '2026-09-14T18:45:00Z', home: 'Inter', away: 'Udinese' },
    { fixtureId: 2, kickoff: '2026-09-14T16:30:00Z', home: 'Como', away: 'Parma' },
    { fixtureId: 3, kickoff: '2026-09-14T16:30:00Z', home: 'Nowhere FC', away: 'Nobody' },
  ];
  const theirs = [
    { id: 101, dateUtc: '2026-09-14T18:45:00+00:00', home: 'Internazionale', away: 'Udinese', homeId: 1, awayId: 2, status: 'NS' },
    { id: 102, dateUtc: '2026-09-14T16:30:00+00:00', home: 'Como 1907', away: 'Parma', homeId: 3, awayId: 4, status: 'NS' },
    { id: 103, dateUtc: '2026-09-14T16:30:00+00:00', home: 'Torino', away: 'Roma', homeId: 5, awayId: 6, status: 'NS' },
  ];
  const m = matchFixtures(ours, theirs);
  assert.deepEqual(m.map((x) => [x.fixtureId, x.afId]), [[1, 101], [2, 102]]);
});

test('season year: Aug–May leagues use start year, Brazil uses calendar year', () => {
  assert.equal(afSeasonFor('serie-a', '2026-09-14T16:30:00Z'), 2026);
  assert.equal(afSeasonFor('serie-a', '2027-03-01T16:30:00Z'), 2026);
  assert.equal(afSeasonFor('brasileirao', '2026-09-14T23:00:00Z'), 2026);
});

test('afToMatchOdds builds margin-free probabilities and tags the provider', () => {
  const o = afToMatchOdds({ bookmaker: 'Bet365', home: 1.44, draw: 4.5, away: 7, over25: null, under25: null, bttsYes: null, bttsNo: null })!;
  assert.equal(o.provider, 'API-Football/Bet365');
  assert.ok(Math.abs(o.pHome + o.pDraw + o.pAway - 1) < 1e-9);
  assert.ok(o.overround > 1.05 && o.overround < 1.1);
  assert.ok(o.pHome > 0.65 && o.pHome < 0.67);
  assert.equal(afToMatchOdds(null), null);
  assert.equal(afToMatchOdds({ bookmaker: 'X', home: 2, draw: null, away: 3, over25: 1.8, under25: 2, bttsYes: null, bttsNo: null }), null);
});
