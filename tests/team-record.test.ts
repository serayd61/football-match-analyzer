import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamRecord, teamVerdict, MIN_TEAM_N } from '@/lib/site/team-record';

const row = (o: Partial<Parameters<typeof teamRecord>[0][number]>) => ({ home_id: 10, away_id: 20, pick: '1', correct: true, ou_pick: 'over', ou_correct: true, btts_pick: 'yes', btts_correct: false, home_score: 2, away_score: 1, kickoff: '2026-09-01T12:00:00Z', ...o });

test('teamRecord splits 1X2, picked-to-win, over and btts cells for the given team', () => {
  const rows = [
    row({ kickoff: '2026-09-20T12:00:00Z' }),                                             // 10 ev, pick 1 ✓, Üst ✓, KG ✗
    row({ home_id: 30, away_id: 10, pick: '2', correct: false, ou_pick: 'under', ou_correct: true, btts_pick: 'no', kickoff: '2026-09-13T12:00:00Z' }), // 10 dep, pick 10 ✗
    row({ pick: 'X', correct: false, kickoff: '2026-09-06T12:00:00Z' }),                  // pick X ✗ (toWin'e girmez)
    row({ home_id: 40, away_id: 50, kickoff: '2026-09-07T12:00:00Z' }),                   // başka takımlar → atla
    row({ home_score: null, kickoff: '2026-09-25T12:00:00Z' }),                            // skorsuz → atla
  ];
  const r = teamRecord(rows, 10);
  assert.equal(r.n, 3);
  assert.deepEqual(r.x12, { n: 3, won: 1 });
  assert.deepEqual(r.toWin, { n: 2, won: 1 });
  assert.deepEqual(r.ou25, { n: 3, won: 3 });
  assert.deepEqual(r.over, { n: 2, won: 2 });
  assert.deepEqual(r.btts, { n: 2, won: 0 });
  assert.deepEqual(r.last.map((l) => l.won), [true, false, false]);   // en yeni önce
});

test('teamVerdict needs MIN_TEAM_N matches', () => {
  assert.equal(MIN_TEAM_N, 5);
  assert.equal(teamVerdict({ n: 4, won: 4 }), 'thin');
  assert.equal(teamVerdict({ n: 6, won: 4 }), 'strong');
  assert.equal(teamVerdict({ n: 6, won: 3 }), 'mid');
  assert.equal(teamVerdict({ n: 10, won: 4 }), 'weak');
});
