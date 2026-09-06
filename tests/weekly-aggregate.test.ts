import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateWeek, type WeekRow } from '@/lib/engine/weekly-aggregate';
import { parseIsoWeek } from '@/lib/engine/scoring';

const key = parseIsoWeek('2026-W36')!;

function row(o: Partial<WeekRow> & { fixture_id: number; result: 'H' | 'D' | 'A'; home_score: number; away_score: number }): WeekRow {
  return {
    model_version: 'dc-1.0', updated_at: '2026-09-01T00:00:00Z', league_id: 47, league_name: 'Premier League',
    kickoff: '2026-09-05T14:00:00Z', p_home: 0.5, p_draw: 0.3, p_away: 0.2, p_over25: 0.6, p_btts_yes: 0.55,
    pick: '1', confidence: 0.5, correct: null, covered: true, ...o,
  };
}

test('aggregates per version and league, with a covered total (league 0) and an official view', () => {
  const rows: WeekRow[] = [
    row({ fixture_id: 1, result: 'H', home_score: 2, away_score: 1 }),                     // 1X2 ✓ over ✓ btts ✓
    row({ fixture_id: 2, result: 'A', home_score: 0, away_score: 1 }),                     // 1X2 ✗ under(=over ✗) btts ✗
    row({ fixture_id: 3, result: 'H', home_score: 1, away_score: 0, league_id: 999, league_name: 'Elsewhere', covered: false }),
  ];
  const out = aggregateWeek({ key, rows });
  const m = (v: string, league: number, market: string) => out.metrics.find((x) => x.model_version === v && x.league_id === league && x.market === market);

  const total = m('dc-1.0', 0, '1x2')!;
  assert.equal(total.n, 2, 'league 0 counts covered rows only');
  assert.equal(total.n_correct, 1);
  assert.equal(total.accuracy, 0.5);
  assert.equal(total.week_start, '2026-08-31');
  assert.equal(m('dc-1.0', 47, '1x2')!.n, 2);
  assert.equal(m('dc-1.0', 999, '1x2')!.n, 1);
  assert.equal(m('official', 0, '1x2')!.n, 2);
  assert.equal(m('dc-1.0', 0, 'ou25')!.n_correct, 1);
  assert.equal(m('dc-1.0', 0, 'btts')!.n_correct, 1);
  assert.equal(m('dc-1.0', 0, 'dc')!.n, 2);            // 1X: H ✓, A ✗
  assert.equal(m('dc-1.0', 0, 'dc')!.n_correct, 1);
  assert.ok(total.log_loss! > 0 && total.brier! > 0);
  assert.equal(total.ece != null, true);
  assert.equal(total.odds_n, null, 'no odds supplied → market columns null, not 0');
  assert.equal(out.quality.scoredOnTheFly, 3, 'rows without stored scores are scored in memory');

  // bins only for league 0, three 1X2 outcomes + over + yes
  const outcomes = new Set(out.bins.filter((b) => b.model_version === 'dc-1.0').map((b) => b.outcome));
  assert.deepEqual([...outcomes].sort(), ['A', 'D', 'H', 'over', 'yes']);
  assert.equal(out.pairs.length, 0);
});

test('two versions on the same fixtures → paired rows against the reference (most rows) version', () => {
  const rows: WeekRow[] = [];
  for (let f = 1; f <= 40; f++) {
    const home = f % 3 !== 0; // 2/3 home wins
    const result = home ? 'H' : 'A';
    const hs = home ? 2 : 0, as = home ? 0 : 1;
    rows.push(row({ fixture_id: f, result, home_score: hs, away_score: as, p_home: 0.5, p_draw: 0.3, p_away: 0.2, pick: '1' }));
    // candidate is sharper on the true outcome
    rows.push(row({ fixture_id: f, result, home_score: hs, away_score: as, model_version: 'dc-2.0-xg', updated_at: '2026-09-02T00:00:00Z',
      p_home: home ? 0.6 : 0.4, p_draw: 0.25, p_away: home ? 0.15 : 0.35, pick: home ? '1' : '2' }));
  }
  const out = aggregateWeek({ key, rows });
  assert.equal(out.referenceVersion, 'dc-1.0', 'tie on count → lexicographic');
  assert.deepEqual(out.versions, ['dc-1.0', 'dc-2.0-xg']);
  const p = out.pairs.find((x) => x.market === '1x2')!;
  assert.equal(p.version_b, 'dc-2.0-xg');
  assert.equal(p.n, 40);
  assert.ok(p.sum_d < 0, 'candidate has lower log-loss');
  assert.ok(p.bootstrap!.bBetter);
  assert.equal(p.acc_a, 27); // 1X2 pick '1' correct on home wins only
  assert.equal(p.acc_b, 40);
  // official view picks the newest updated_at → the candidate rows
  const official = out.metrics.find((x) => x.model_version === 'official' && x.league_id === 0 && x.market === '1x2')!;
  assert.equal(official.n, 40);
  assert.equal(official.n_correct, 40);
});

test('missing / invalid inputs never become zeros', () => {
  const rows: WeekRow[] = [
    row({ fixture_id: 1, result: 'D', home_score: 1, away_score: 1, p_over25: null, p_btts_yes: '' as any, confidence: null }),
    row({ fixture_id: 2, result: 'H', home_score: 1, away_score: 0, home_score_x: 1 } as any),
    { ...row({ fixture_id: 3, result: 'H', home_score: 1, away_score: 0 }), home_score: null } as any,
  ];
  const out = aggregateWeek({ key, rows });
  assert.equal(out.quality.usable, 2);
  const ou = out.metrics.find((x) => x.model_version === 'dc-1.0' && x.league_id === 0 && x.market === 'ou25')!;
  assert.equal(ou.n, 1, 'row with null p_over25 is excluded from the goal market, not counted as 0');
});
