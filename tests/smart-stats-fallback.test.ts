import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStatisticalPrediction, NO_DATA_CAP } from '../src/lib/smart-prompt';

const team = (o: Partial<any> = {}) => ({
  teamId: 1, teamName: 'T', recentForm: 'WWDLW', formPoints: 10, goalsScored: 0, goalsConceded: 0,
  avgGoalsScored: 1.5, avgGoalsConceded: 1.2, homeAvgGoalsScored: 1.6, homeAvgGoalsConceded: 1.0, awayAvgGoalsScored: 1.2, awayAvgGoalsConceded: 1.4,
  homeWins: 3, homeDraws: 1, homeLosses: 1, awayWins: 2, awayDraws: 1, awayLosses: 2, bttsPercentage: 60, over25Percentage: 60, under25Percentage: 40,
  cleanSheets: 0, failedToScore: 0, avgCornersFor: 5, avgCornersAgainst: 5, totalCorners: 0, ...o,
});
const h2hEmpty = { totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0, avgGoals: 0, bttsPercentage: 0, over25Percentage: 0, avgCorners: 0, over85CornersPercentage: 0, over95CornersPercentage: 0, recentMatches: [] };
const h2hRich = { ...h2hEmpty, totalMatches: 6, team1Wins: 4, team2Wins: 1, draws: 1, avgGoals: 3.4, bttsPercentage: 83, over25Percentage: 83 };
const ctx = (h2h: any, home = team(), away = team({ teamId: 2 })) => ({ homeTeam: home, awayTeam: away, h2h, homeInjuries: [], awayInjuries: [] }) as any;

test('H2H yokken 0 değerleri sızmaz: takım oranlarından hesaplanır', () => {
  const r = calculateStatisticalPrediction(ctx(h2hEmpty));
  assert.equal(r.btts.prediction, 'yes');                 // takımlar %60/%60 → eski kod %0 H2H ile "no" diyordu
  assert.ok(!/H2H %0/.test(r.btts.reason) && /H2H yok/.test(r.btts.reason), r.btts.reason);
  assert.ok(!/H2H ortalaması: 0\.0/.test(r.overUnder.reason), r.overUnder.reason);
  assert.ok(r.overUnder.confidence >= 50 && r.overUnder.confidence <= 75);
});

test('takım istatistiği de H2H de yoksa güven tavanı ve "veri yetersiz"', () => {
  const r = calculateStatisticalPrediction(ctx(h2hEmpty), { teamStatsReal: false });
  for (const m of [r.btts, r.overUnder, r.matchResult]) {
    assert.ok(m.confidence <= NO_DATA_CAP, `${m.confidence}`);
    assert.match(m.reason, /Veri yetersiz/);
  }
});

test('takım istatistiği yok ama H2H varsa yalnız H2H kullanılır', () => {
  const r = calculateStatisticalPrediction(ctx(h2hRich), { teamStatsReal: false });
  assert.equal(r.btts.prediction, 'yes');
  assert.ok(r.btts.confidence > NO_DATA_CAP, `${r.btts.confidence}`);
  assert.equal(r.overUnder.prediction, 'over');            // H2H 3,4 gol
  assert.ok(r.matchResult.confidence <= NO_DATA_CAP);      // ev/dep performansı sabit → tavan
  assert.doesNotMatch(r.btts.reason, /Veri yetersiz/);
});

test('her iki kaynak varken eski ağırlıklar (0,3/0,3/0,4) korunur', () => {
  const r = calculateStatisticalPrediction(ctx(h2hRich));
  // bttsScore = (60+60)*0.3 + 83*0.4 = 69,2 → conf 50 + 9,6 = 60
  assert.equal(r.btts.confidence, 60);
});
