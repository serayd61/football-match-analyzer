import { NextRequest, NextResponse } from 'next/server';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysisCache';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ============================================================================
// 🧠 AI BRAIN ARCHITECTURE - ROL TANIMLARI
// ============================================================================

type AIRole = 'tactical' | 'statistical' | 'pattern' | 'contextual';

interface AIConfig {
  name: string;
  role: AIRole;
  weight: number;        // Consensus'taki ağırlık
  temperature: number;   // Yaratıcılık seviyesi
  specialization: string;
}

const AI_BRAIN_CONFIG: Record<string, AIConfig> = {
  claude: {
    name: 'Claude',
    role: 'tactical',
    weight: 0.30,
    temperature: 0.3,
    specialization: 'Tactical Analysis - Momentum, playing styles, psychological factors'
  },
  openai: {
    name: 'GPT-4',
    role: 'statistical',
    weight: 0.30,
    temperature: 0.2,
    specialization: 'Statistical Engine - xG analysis, Poisson distribution, odds value'
  },
  gemini: {
    name: 'Gemini',
    role: 'pattern',
    weight: 0.25,
    temperature: 0.4,
    specialization: 'Pattern Recognition - H2H trends, seasonality, streak analysis'
  },
  perplexity: {
    name: 'Perplexity',
    role: 'contextual',
    weight: 0.15,
    temperature: 0.5,
    specialization: 'Contextual Analysis - News, injuries, external factors'
  }
};

// ============================================================================
// TİPLER (mevcut koddan)
// ============================================================================

interface MatchData {
  date: string;
  opponent: string;
  opponentId: number;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
  firstHalfGoalsFor: number;
  firstHalfGoalsAgainst: number;
  secondHalfGoalsFor: number;
  secondHalfGoalsAgainst: number;
}

interface TeamStats {
  name: string;
  teamId: number;
  totalMatches: number;
  form: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  homeMatches: number;
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  avgHomeGoalsFor: number;
  avgHomeGoalsAgainst: number;
  awayMatches: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  avgAwayGoalsFor: number;
  avgAwayGoalsAgainst: number;
  cleanSheets: number;
  cleanSheetPercent: number;
  failedToScore: number;
  failedToScorePercent: number;
  bttsMatches: number;
  bttsPercent: number;
  over25Matches: number;
  over25Percent: number;
  over15Matches: number;
  over15Percent: number;
  firstHalfGoalsFor: number;
  firstHalfGoalsAgainst: number;
  secondHalfGoalsFor: number;
  secondHalfGoalsAgainst: number;
  avgFirstHalfGoals: number;
  avgSecondHalfGoals: number;
  currentStreak: string;
  longestWinStreak: number;
  longestLossStreak: number;
  recentMatches: MatchData[];
  last5Form: string;
  last5GoalsFor: number;
  last5GoalsAgainst: number;
}

interface H2HStats {
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1Goals: number;
  team2Goals: number;
  avgGoals: number;
  bttsCount: number;
  bttsPercent: number;
  over25Count: number;
  over25Percent: number;
  over15Count: number;
  over15Percent: number;
  recentMatches: {
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    winner: string;
  }[];
  team1HomeRecord: { wins: number; draws: number; losses: number };
  team1AwayRecord: { wins: number; draws: number; losses: number };
}

// ============================================================================
// 🧠 ROL BAZLI VERİ PAKETLERİ - FARKLI AI'LARA FARKLI VERİ
// ============================================================================

function generateTacticalDataPackage(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats
): string {
  // CLAUDE için: Momentum, form, taktik analiz odaklı
  const homeMomentum = calculateMomentum(homeStats);
  const awayMomentum = calculateMomentum(awayStats);
  
  return `
═══════════════════════════════════════════════════════════════
🧠 TACTICAL ANALYSIS DATA PACKAGE
Role: Tactical Analyst - Focus on HOW teams play, not just stats
═══════════════════════════════════════════════════════════════

📊 ${homeTeam.toUpperCase()} - TACTICAL PROFILE (HOME)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOMENTUM SCORE: ${homeMomentum.score}/10 (${homeMomentum.trend})
Current Streak: ${homeStats.currentStreak}
Form Trajectory: ${homeStats.form.slice(0, 5)} → ${analyzeFormTrajectory(homeStats.form)}

PLAYING STYLE INDICATORS:
• Goals per match: ${homeStats.avgGoalsFor} (${homeStats.avgGoalsFor > 1.5 ? 'ATTACKING' : homeStats.avgGoalsFor > 1.0 ? 'BALANCED' : 'DEFENSIVE'})
• Goals conceded: ${homeStats.avgGoalsAgainst} (${homeStats.avgGoalsAgainst < 1.0 ? 'SOLID DEFENSE' : homeStats.avgGoalsAgainst < 1.5 ? 'AVERAGE DEFENSE' : 'VULNERABLE'})
• Clean sheet rate: ${homeStats.cleanSheetPercent}%
• First half goals avg: ${homeStats.avgFirstHalfGoals} (${homeStats.avgFirstHalfGoals > homeStats.avgSecondHalfGoals ? 'FAST STARTERS' : 'SLOW STARTERS'})

HOME FORTRESS ANALYSIS:
• Home win rate: ${homeStats.homeMatches > 0 ? Math.round((homeStats.homeWins / homeStats.homeMatches) * 100) : 0}%
• Home goals/match: ${homeStats.avgHomeGoalsFor}
• Home advantage factor: ${calculateHomeAdvantage(homeStats)}

RECENT FORM BREAKDOWN (Last 5):
${homeStats.recentMatches.slice(0, 5).map(m => 
  `  ${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent} (${m.isHome ? 'H' : 'A'}) - ${analyzeMatchPerformance(m)}`
).join('\n')}

CONFIDENCE INDICATORS:
• Longest win streak: ${homeStats.longestWinStreak}
• Longest loss streak: ${homeStats.longestLossStreak}
• Failed to score rate: ${homeStats.failedToScorePercent}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ${awayTeam.toUpperCase()} - TACTICAL PROFILE (AWAY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOMENTUM SCORE: ${awayMomentum.score}/10 (${awayMomentum.trend})
Current Streak: ${awayStats.currentStreak}
Form Trajectory: ${awayStats.form.slice(0, 5)} → ${analyzeFormTrajectory(awayStats.form)}

PLAYING STYLE INDICATORS:
• Goals per match: ${awayStats.avgGoalsFor} (${awayStats.avgGoalsFor > 1.5 ? 'ATTACKING' : awayStats.avgGoalsFor > 1.0 ? 'BALANCED' : 'DEFENSIVE'})
• Goals conceded: ${awayStats.avgGoalsAgainst} (${awayStats.avgGoalsAgainst < 1.0 ? 'SOLID DEFENSE' : awayStats.avgGoalsAgainst < 1.5 ? 'AVERAGE DEFENSE' : 'VULNERABLE'})
• Away resilience: ${awayStats.awayMatches > 0 ? Math.round((awayStats.awayWins / awayStats.awayMatches) * 100) : 0}% win rate away

AWAY PERFORMANCE:
• Away goals/match: ${awayStats.avgAwayGoalsFor}
• Away goals conceded: ${awayStats.avgAwayGoalsAgainst}
• Away mentality: ${awayStats.awayWins > awayStats.awayLosses ? 'CONFIDENT TRAVELERS' : 'STRUGGLES AWAY'}

RECENT FORM BREAKDOWN (Last 5):
${awayStats.recentMatches.slice(0, 5).map(m => 
  `  ${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent} (${m.isHome ? 'H' : 'A'}) - ${analyzeMatchPerformance(m)}`
).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 TACTICAL MATCHUP ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOMENTUM BATTLE: ${homeTeam} (${homeMomentum.score}) vs ${awayTeam} (${awayMomentum.score})
→ ${homeMomentum.score > awayMomentum.score ? homeTeam + ' has psychological edge' : awayMomentum.score > homeMomentum.score ? awayTeam + ' has psychological edge' : 'Even psychological battle'}

STYLE CLASH:
• ${homeTeam}: ${homeStats.avgGoalsFor > 1.5 ? 'Attacking' : 'Defensive'} approach
• ${awayTeam}: ${awayStats.avgGoalsFor > 1.5 ? 'Attacking' : 'Defensive'} approach
→ ${predictStyleClash(homeStats, awayStats)}

KEY TACTICAL FACTORS:
1. ${homeTeam} home record: ${homeStats.homeWins}W-${homeStats.homeDraws}D-${homeStats.homeLosses}L
2. ${awayTeam} away record: ${awayStats.awayWins}W-${awayStats.awayDraws}D-${awayStats.awayLosses}L
3. Form comparison: ${compareForm(homeStats.last5Form, awayStats.last5Form)}
`;
}

function generateStatisticalDataPackage(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats
): string {
  // GPT-4 için: Pure numbers, xG simulation, Poisson, odds value
  const homeExpectedGoals = calculateExpectedGoals(homeStats, awayStats, true);
  const awayExpectedGoals = calculateExpectedGoals(awayStats, homeStats, false);
  const poissonMatrix = calculatePoissonMatrix(homeExpectedGoals, awayExpectedGoals);
  
  return `
═══════════════════════════════════════════════════════════════
📊 STATISTICAL ENGINE DATA PACKAGE
Role: Statistical Analyst - Pure numbers, probabilities, value finding
═══════════════════════════════════════════════════════════════

🔢 EXPECTED GOALS (xG) SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${homeTeam} xG: ${homeExpectedGoals.toFixed(2)}
${awayTeam} xG: ${awayExpectedGoals.toFixed(2)}
Total xG: ${(homeExpectedGoals + awayExpectedGoals).toFixed(2)}

Calculation basis:
• ${homeTeam} avg goals scored: ${homeStats.avgGoalsFor}
• ${homeTeam} avg home goals: ${homeStats.avgHomeGoalsFor}
• ${awayTeam} avg goals conceded: ${awayStats.avgGoalsAgainst}
• ${awayTeam} avg away conceded: ${awayStats.avgAwayGoalsAgainst}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 POISSON DISTRIBUTION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Most Likely Scorelines:
${poissonMatrix.topScores.map((s, i) => `${i + 1}. ${s.score}: ${s.probability.toFixed(1)}%`).join('\n')}

Outcome Probabilities:
• Home Win: ${poissonMatrix.homeWin.toFixed(1)}%
• Draw: ${poissonMatrix.draw.toFixed(1)}%
• Away Win: ${poissonMatrix.awayWin.toFixed(1)}%

Goals Probabilities:
• Over 0.5: ${poissonMatrix.over05.toFixed(1)}%
• Over 1.5: ${poissonMatrix.over15.toFixed(1)}%
• Over 2.5: ${poissonMatrix.over25.toFixed(1)}%
• Over 3.5: ${poissonMatrix.over35.toFixed(1)}%

BTTS Probability: ${poissonMatrix.btts.toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RAW STATISTICS COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      ${homeTeam.padEnd(15)} ${awayTeam.padEnd(15)}
Total Matches:        ${String(homeStats.totalMatches).padEnd(15)} ${String(awayStats.totalMatches).padEnd(15)}
Win Rate:             ${String(Math.round((homeStats.wins / homeStats.totalMatches) * 100) + '%').padEnd(15)} ${String(Math.round((awayStats.wins / awayStats.totalMatches) * 100) + '%').padEnd(15)}
Goals/Match:          ${String(homeStats.avgGoalsFor).padEnd(15)} ${String(awayStats.avgGoalsFor).padEnd(15)}
Conceded/Match:       ${String(homeStats.avgGoalsAgainst).padEnd(15)} ${String(awayStats.avgGoalsAgainst).padEnd(15)}
Clean Sheet %:        ${String(homeStats.cleanSheetPercent + '%').padEnd(15)} ${String(awayStats.cleanSheetPercent + '%').padEnd(15)}
Failed to Score %:    ${String(homeStats.failedToScorePercent + '%').padEnd(15)} ${String(awayStats.failedToScorePercent + '%').padEnd(15)}
BTTS %:               ${String(homeStats.bttsPercent + '%').padEnd(15)} ${String(awayStats.bttsPercent + '%').padEnd(15)}
Over 2.5 %:           ${String(homeStats.over25Percent + '%').padEnd(15)} ${String(awayStats.over25Percent + '%').padEnd(15)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 VALUE BET INDICATORS (Calculate your own odds comparison)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Statistical Fair Odds (no margin):
• Home Win: ${(100 / poissonMatrix.homeWin).toFixed(2)}
• Draw: ${(100 / poissonMatrix.draw).toFixed(2)}
• Away Win: ${(100 / poissonMatrix.awayWin).toFixed(2)}
• Over 2.5: ${(100 / poissonMatrix.over25).toFixed(2)}
• Under 2.5: ${(100 / (100 - poissonMatrix.over25)).toFixed(2)}
• BTTS Yes: ${(100 / poissonMatrix.btts).toFixed(2)}
• BTTS No: ${(100 / (100 - poissonMatrix.btts)).toFixed(2)}

If bookmaker odds > these values = VALUE BET
`;
}

function generatePatternDataPackage(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats
): string {
  // GEMINI için: H2H patterns, streaks, seasonality
  return `
═══════════════════════════════════════════════════════════════
🔍 PATTERN RECOGNITION DATA PACKAGE
Role: Pattern Hunter - Find trends, cycles, historical patterns
═══════════════════════════════════════════════════════════════

🔄 HEAD-TO-HEAD HISTORICAL PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total H2H Meetings: ${h2h.totalMatches}

DOMINANCE PATTERN:
• ${homeTeam}: ${h2h.team1Wins} wins (${h2h.totalMatches > 0 ? Math.round((h2h.team1Wins / h2h.totalMatches) * 100) : 0}%)
• ${awayTeam}: ${h2h.team2Wins} wins (${h2h.totalMatches > 0 ? Math.round((h2h.team2Wins / h2h.totalMatches) * 100) : 0}%)
• Draws: ${h2h.draws} (${h2h.totalMatches > 0 ? Math.round((h2h.draws / h2h.totalMatches) * 100) : 0}%)

→ H2H DOMINANCE: ${h2h.team1Wins > h2h.team2Wins ? homeTeam + ' DOMINANT' : h2h.team2Wins > h2h.team1Wins ? awayTeam + ' DOMINANT' : 'BALANCED'}

SCORING PATTERNS IN H2H:
• Average total goals: ${h2h.avgGoals}
• ${homeTeam} avg in H2H: ${h2h.totalMatches > 0 ? (h2h.team1Goals / h2h.totalMatches).toFixed(2) : 0}
• ${awayTeam} avg in H2H: ${h2h.totalMatches > 0 ? (h2h.team2Goals / h2h.totalMatches).toFixed(2) : 0}
• BTTS in H2H: ${h2h.bttsPercent}%
• Over 2.5 in H2H: ${h2h.over25Percent}%

WHEN ${homeTeam} HOSTS ${awayTeam}:
• Record: ${h2h.team1HomeRecord.wins}W-${h2h.team1HomeRecord.draws}D-${h2h.team1HomeRecord.losses}L
• ${homeTeam} home win rate vs ${awayTeam}: ${(h2h.team1HomeRecord.wins + h2h.team1HomeRecord.draws + h2h.team1HomeRecord.losses) > 0 ? Math.round((h2h.team1HomeRecord.wins / (h2h.team1HomeRecord.wins + h2h.team1HomeRecord.draws + h2h.team1HomeRecord.losses)) * 100) : 0}%

RECENT H2H MEETINGS:
${h2h.recentMatches.slice(0, 5).map(m => 
  `  ${m.date}: ${m.homeTeam} ${m.homeGoals}-${m.awayGoals} ${m.awayTeam} → ${m.winner}`
).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 STREAK ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${homeTeam} STREAKS:
• Current: ${homeStats.currentStreak}
• Best win streak: ${homeStats.longestWinStreak} games
• Worst loss streak: ${homeStats.longestLossStreak} games
• ${analyzeStreakPattern(homeStats)}

${awayTeam} STREAKS:
• Current: ${awayStats.currentStreak}
• Best win streak: ${awayStats.longestWinStreak} games
• Worst loss streak: ${awayStats.longestLossStreak} games
• ${analyzeStreakPattern(awayStats)}

REGRESSION TO MEAN INDICATORS:
• ${homeTeam}: ${identifyRegressionRisk(homeStats)}
• ${awayTeam}: ${identifyRegressionRisk(awayStats)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔁 RECURRING PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${homeTeam} PATTERNS:
${identifyPatterns(homeStats)}

${awayTeam} PATTERNS:
${identifyPatterns(awayStats)}

H2H PATTERNS:
${identifyH2HPatterns(h2h)}
`;
}

function generateContextualDataPackage(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats
): string {
  // PERPLEXITY için: Context, external factors, news hints
  return `
═══════════════════════════════════════════════════════════════
📰 CONTEXTUAL ANALYSIS DATA PACKAGE
Role: Context Analyst - Look beyond numbers, find hidden factors
═══════════════════════════════════════════════════════════════

⚠️ FORM CONTEXT & CONFIDENCE INDICATORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${homeTeam} MORALE ASSESSMENT:
• Recent form: ${homeStats.last5Form}
• Goals in last 5: ${homeStats.last5GoalsFor} scored, ${homeStats.last5GoalsAgainst} conceded
• Momentum trend: ${analyzeFormTrajectory(homeStats.form)}
• Confidence level: ${assessConfidenceLevel(homeStats)}

${awayTeam} MORALE ASSESSMENT:
• Recent form: ${awayStats.last5Form}
• Goals in last 5: ${awayStats.last5GoalsFor} scored, ${awayStats.last5GoalsAgainst} conceded
• Momentum trend: ${analyzeFormTrajectory(awayStats.form)}
• Confidence level: ${assessConfidenceLevel(awayStats)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏟️ VENUE & HOME ADVANTAGE FACTORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${homeTeam} HOME FORTRESS:
• Home record: ${homeStats.homeWins}W-${homeStats.homeDraws}D-${homeStats.homeLosses}L
• Home win rate: ${homeStats.homeMatches > 0 ? Math.round((homeStats.homeWins / homeStats.homeMatches) * 100) : 0}%
• Home scoring: ${homeStats.avgHomeGoalsFor} goals/match
• Home advantage strength: ${calculateHomeAdvantage(homeStats)}

${awayTeam} AWAY PERFORMANCE:
• Away record: ${awayStats.awayWins}W-${awayStats.awayDraws}D-${awayStats.awayLosses}L
• Away win rate: ${awayStats.awayMatches > 0 ? Math.round((awayStats.awayWins / awayStats.awayMatches) * 100) : 0}%
• Away scoring: ${awayStats.avgAwayGoalsFor} goals/match
• Travel factor: ${assessTravelFactor(awayStats)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ POTENTIAL GAME CHANGERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on available data, watch for:

1. SCORING PATTERNS:
   • ${homeTeam}: ${homeStats.avgFirstHalfGoals > homeStats.avgSecondHalfGoals ? 'Scores early (1st half dominant)' : 'Scores late (2nd half dominant)'}
   • ${awayTeam}: ${awayStats.avgFirstHalfGoals > awayStats.avgSecondHalfGoals ? 'Scores early (1st half dominant)' : 'Scores late (2nd half dominant)'}

2. DEFENSIVE VULNERABILITIES:
   • ${homeTeam}: ${homeStats.cleanSheetPercent < 30 ? 'Concedes often - BTTS likely' : 'Solid defense - BTTS less likely'}
   • ${awayTeam}: ${awayStats.cleanSheetPercent < 30 ? 'Concedes often - BTTS likely' : 'Solid defense - BTTS less likely'}

3. PSYCHOLOGICAL EDGE:
   • H2H history favors: ${h2h.team1Wins > h2h.team2Wins ? homeTeam : h2h.team2Wins > h2h.team1Wins ? awayTeam : 'Neither (balanced)'}
   • Current form favors: ${compareFormAdvantage(homeStats, awayStats)}

4. RISK FACTORS:
${identifyRiskFactors(homeStats, awayStats, h2h)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 CONTEXTUAL QUESTIONS TO CONSIDER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Is ${homeTeam} on a confidence high or struggling?
• Can ${awayTeam} handle away pressure?
• What does H2H psychology suggest?
• Are there any obvious trap indicators?
`;
}

// ============================================================================
// YARDIMCI FONKSIYONLAR - DATA PACKAGE İÇİN
// ============================================================================

function calculateMomentum(stats: TeamStats): { score: number; trend: string } {
  const formPoints = stats.form.slice(0, 5).split('').reduce((acc, r) => {
    if (r === 'W') return acc + 3;
    if (r === 'D') return acc + 1;
    return acc;
  }, 0);
  
  const maxPoints = 15;
  const score = Math.round((formPoints / maxPoints) * 10);
  
  const recentForm = stats.form.slice(0, 3);
  const olderForm = stats.form.slice(3, 6);
  const recentPoints = recentForm.split('').filter(r => r === 'W').length * 3 + recentForm.split('').filter(r => r === 'D').length;
  const olderPoints = olderForm.split('').filter(r => r === 'W').length * 3 + olderForm.split('').filter(r => r === 'D').length;
  
  let trend = 'STABLE';
  if (recentPoints > olderPoints + 2) trend = 'RISING ↑';
  else if (recentPoints < olderPoints - 2) trend = 'FALLING ↓';
  
  return { score, trend };
}

function analyzeFormTrajectory(form: string): string {
  const recent = form.slice(0, 3);
  const older = form.slice(3, 6);
  
  const recentWins = (recent.match(/W/g) || []).length;
  const olderWins = (older.match(/W/g) || []).length;
  
  if (recentWins > olderWins) return 'IMPROVING';
  if (recentWins < olderWins) return 'DECLINING';
  return 'STABLE';
}

function calculateHomeAdvantage(stats: TeamStats): string {
  if (stats.homeMatches === 0) return 'UNKNOWN';
  const homeWinRate = (stats.homeWins / stats.homeMatches) * 100;
  if (homeWinRate >= 70) return 'FORTRESS (Very Strong)';
  if (homeWinRate >= 50) return 'STRONG';
  if (homeWinRate >= 35) return 'MODERATE';
  return 'WEAK';
}

function analyzeMatchPerformance(match: MatchData): string {
  const goalDiff = match.goalsFor - match.goalsAgainst;
  if (match.result === 'W' && goalDiff >= 2) return 'Dominant win';
  if (match.result === 'W') return 'Solid win';
  if (match.result === 'D' && match.goalsFor > 0) return 'Fighting draw';
  if (match.result === 'D') return 'Goalless stalemate';
  if (match.result === 'L' && goalDiff >= -1) return 'Narrow loss';
  return 'Heavy defeat';
}

function predictStyleClash(home: TeamStats, away: TeamStats): string {
  const homeAttacking = home.avgGoalsFor > 1.3;
  const awayAttacking = away.avgGoalsFor > 1.3;
  
  if (homeAttacking && awayAttacking) return 'OPEN GAME EXPECTED - High scoring potential';
  if (!homeAttacking && !awayAttacking) return 'TIGHT GAME EXPECTED - Low scoring likely';
  if (homeAttacking) return 'HOME PRESSURE - Expect home team dominance';
  return 'AWAY THREAT - Visitors could cause problems';
}

function compareForm(home: string, away: string): string {
  const homePoints = home.split('').reduce((acc, r) => r === 'W' ? acc + 3 : r === 'D' ? acc + 1 : acc, 0);
  const awayPoints = away.split('').reduce((acc, r) => r === 'W' ? acc + 3 : r === 'D' ? acc + 1 : acc, 0);
  
  if (homePoints > awayPoints + 3) return 'Home team significantly better form';
  if (awayPoints > homePoints + 3) return 'Away team significantly better form';
  return 'Similar form levels';
}

function calculateExpectedGoals(team: TeamStats, opponent: TeamStats, isHome: boolean): number {
  const teamAvg = isHome ? team.avgHomeGoalsFor : team.avgAwayGoalsFor;
  const oppAvg = isHome ? opponent.avgAwayGoalsAgainst : opponent.avgHomeGoalsAgainst;
  
  // Simple xG approximation
  const leagueAvg = 1.3; // Assumed average
  const xG = (teamAvg + oppAvg) / 2;
  
  // Home advantage adjustment
  return isHome ? xG * 1.1 : xG * 0.9;
}

function calculatePoissonMatrix(homeXG: number, awayXG: number) {
  // Poisson probability calculation
  const poisson = (lambda: number, k: number): number => {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
  };
  
  const factorial = (n: number): number => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };
  
  let homeWin = 0, draw = 0, awayWin = 0;
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
  let btts = 0;
  const scores: { score: string; probability: number }[] = [];
  
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const prob = poisson(homeXG, h) * poisson(awayXG, a) * 100;
      
      if (h > a) homeWin += prob;
      else if (h < a) awayWin += prob;
      else draw += prob;
      
      if (h + a > 0.5) over05 += prob;
      if (h + a > 1.5) over15 += prob;
      if (h + a > 2.5) over25 += prob;
      if (h + a > 3.5) over35 += prob;
      
      if (h > 0 && a > 0) btts += prob;
      
      scores.push({ score: `${h}-${a}`, probability: prob });
    }
  }
  
  scores.sort((a, b) => b.probability - a.probability);
  
  return {
    homeWin, draw, awayWin,
    over05, over15, over25, over35,
    btts,
    topScores: scores.slice(0, 5)
  };
}

function analyzeStreakPattern(stats: TeamStats): string {
  const streak = stats.currentStreak;
  if (streak.includes('W') && parseInt(streak) >= 3) {
    return 'HOT STREAK - But regression possible';
  }
  if (streak.includes('L') && parseInt(streak) >= 3) {
    return 'COLD STREAK - Due for turnaround?';
  }
  return 'No significant streak';
}

function identifyRegressionRisk(stats: TeamStats): string {
  if (stats.currentStreak.includes('W') && parseInt(stats.currentStreak.replace(/\D/g, '')) >= 4) {
    return 'HIGH - Long win streak may end';
  }
  if (stats.currentStreak.includes('L') && parseInt(stats.currentStreak.replace(/\D/g, '')) >= 4) {
    return 'HIGH - Long loss streak may end (bounce back)';
  }
  return 'LOW - Normal variance expected';
}

function identifyPatterns(stats: TeamStats): string {
  const patterns: string[] = [];
  
  if (stats.bttsPercent > 60) patterns.push('• BTTS happens frequently (60%+)');
  if (stats.bttsPercent < 40) patterns.push('• BTTS rare (<40%)');
  if (stats.over25Percent > 60) patterns.push('• High-scoring matches common');
  if (stats.over25Percent < 40) patterns.push('• Low-scoring matches typical');
  if (stats.cleanSheetPercent > 40) patterns.push('• Strong defensive record');
  if (stats.failedToScorePercent > 30) patterns.push('• Struggles to score frequently');
  
  return patterns.length > 0 ? patterns.join('\n') : '• No strong patterns identified';
}

function identifyH2HPatterns(h2h: H2HStats): string {
  const patterns: string[] = [];
  
  if (h2h.bttsPercent > 65) patterns.push('• Both teams usually score in H2H');
  if (h2h.over25Percent > 65) patterns.push('• H2H matches tend to be high-scoring');
  if (h2h.avgGoals > 3) patterns.push('• Goal-fests common in this fixture');
  if (h2h.avgGoals < 2) patterns.push('• Tight, low-scoring affairs historically');
  
  return patterns.length > 0 ? patterns.join('\n') : '• Limited H2H pattern data';
}

function assessConfidenceLevel(stats: TeamStats): string {
  const wins = stats.form.slice(0, 5).split('').filter(r => r === 'W').length;
  if (wins >= 4) return 'VERY HIGH - On fire';
  if (wins >= 3) return 'HIGH - Playing well';
  if (wins >= 2) return 'MODERATE - Inconsistent';
  if (wins >= 1) return 'LOW - Struggling';
  return 'VERY LOW - Crisis mode';
}

function assessTravelFactor(stats: TeamStats): string {
  if (stats.awayWins > stats.awayLosses) return 'STRONG TRAVELERS';
  if (stats.awayWins === stats.awayLosses) return 'MIXED AWAY FORM';
  return 'STRUGGLES ON THE ROAD';
}

function compareFormAdvantage(home: TeamStats, away: TeamStats): string {
  const homeRecent = home.last5Form.split('').filter(r => r === 'W').length;
  const awayRecent = away.last5Form.split('').filter(r => r === 'W').length;
  
  if (homeRecent > awayRecent + 1) return home.name;
  if (awayRecent > homeRecent + 1) return away.name;
  return 'Even';
}

function identifyRiskFactors(home: TeamStats, away: TeamStats, h2h: H2HStats): string {
  const risks: string[] = [];
  
  if (home.currentStreak.includes('W') && parseInt(home.currentStreak.replace(/\D/g, '')) >= 4) {
    risks.push(`   • ${home.name} on long win streak - regression risk`);
  }
  if (away.currentStreak.includes('W') && parseInt(away.currentStreak.replace(/\D/g, '')) >= 4) {
    risks.push(`   • ${away.name} confident away team - dangerous`);
  }
  if (h2h.draws > h2h.team1Wins && h2h.draws > h2h.team2Wins) {
    risks.push('   • H2H shows draw tendency');
  }
  
  return risks.length > 0 ? risks.join('\n') : '   • No major risk factors identified';
}

// ============================================================================
// 🧠 ROL BAZLI PROMPTLAR - HER AI İÇİN FARKLI TALİMAT
// ============================================================================

function createTacticalPrompt(homeTeam: string, awayTeam: string, dataPackage: string, lang: string): string {
  const instructions = lang === 'tr' ? `
Sen CLAUDE - TAKTİK & MOTİVASYON ANALİSTİSİN.

🎯 ZORUNLU ANALİZLER:

1. MOTİVASYON SKORU (1-10):
   Her takım için hesapla:
   - Lig sırası baskısı: Üst 6 = +2, Alt 6 = +2, Orta = 0
   - Son 5 maç puan oranı × 3
   - Ev/Deplasman: Ev +1, Dep -1
   HESAPLAMAYI GÖSTER!

2. EV/DEPLASMAN FORM KARŞILAŞTIRMASI:
   - ${homeTeam} EVDEKİ son 5: ?W-?D-?L, ? gol attı
   - ${awayTeam} DEPLASMANDAKİ son 5: ?W-?D-?L, ? gol yedi
   ⚠️ GENEL FORM DEĞİL, VENUE-SPECIFIC FORM KULLAN!

3. TAKTİKSEL AVANTAJ:
   - Stil çatışması analizi
   - Rotasyon riski değerlendirmesi

❌ YASAKLI İFADELER:
- "güçlü performans", "istikrarlı", "momentum taşıyor"
- Somut veriye dayanmayan genel ifadeler

✅ DOĞRU ÖRNEK:
"${homeTeam} evde 3G-1B-1M, 7 gol attı. ${awayTeam} deplasmanda 1G-2B-2M. Form farkı: +5 puan ev lehine."

⚠️ CONFIDENCE KURALLARI:
- MAÇ SONUCU: Max %70 (futbol belirsizdir!)
- Veriler güçlü ise: %60-70
- Veriler karışık ise: %50-60
- ASLA %75 üstü verme!` 
  : lang === 'de' ? `
Du bist CLAUDE - DER TAKTIK & MOTIVATIONS-ANALYST.

🎯 PFLICHTANALYSEN:
1. MOTIVATIONS-SCORE (1-10) mit Berechnungsformel
2. HEIM/AUSWÄRTS FORM-VERGLEICH (venue-spezifisch!)
3. TAKTISCHER VORTEIL

❌ VERBOTENE PHRASEN: "starke Leistung", "stabil"
✅ NUR konkrete Daten verwenden

⚠️ CONFIDENCE REGELN:
- SPIELERGEBNIS: Max 70%
- NIEMALS über 75%!`
  : `
You are CLAUDE - THE TACTICAL & MOTIVATION ANALYST.

🎯 MANDATORY ANALYSES:

1. MOTIVATION SCORE (1-10):
   Calculate for each team:
   - League position pressure: Top 6 = +2, Bottom 6 = +2, Mid = 0
   - Last 5 matches points ratio × 3
   - Home/Away: Home +1, Away -1
   SHOW YOUR CALCULATION!

2. HOME/AWAY FORM COMPARISON:
   - ${homeTeam} HOME last 5: ?W-?D-?L, ? goals scored
   - ${awayTeam} AWAY last 5: ?W-?D-?L, ? goals conceded
   ⚠️ USE VENUE-SPECIFIC FORM, NOT OVERALL FORM!

3. TACTICAL ADVANTAGE:
   - Style clash analysis
   - Rotation risk assessment

❌ BANNED PHRASES:
- "strong performance", "consistent", "carrying momentum"
- Any statement without concrete data

✅ CORRECT EXAMPLE:
"${homeTeam} at home: 3W-1D-1L, 7 goals scored. ${awayTeam} away: 1W-2D-2L. Form gap: +5 points home advantage."

⚠️ CONFIDENCE RULES:
- MATCH RESULT: Max 70% (football is uncertain!)
- Strong data alignment: 60-70%
- Mixed signals: 50-60%
- NEVER give above 75%!`;

  return `${instructions}

${dataPackage}

${getOutputFormat(lang, 'Claude Tactical Analyst')}`;
}

function createStatisticalPrompt(homeTeam: string, awayTeam: string, dataPackage: string, lang: string): string {
  const instructions = lang === 'tr' ? `
Sen GPT-4 - İSTATİSTİK MOTORU ve VALUE BET UZMANSIN.

🎯 ZORUNLU HESAPLAMALAR:

1. BEKLENEN GOL HESABI:
   λ_home = (homeAvgGoalsScored × awayAvgGoalsConceded) / leagueAvg
   λ_away = (awayAvgGoalsScored × homeAvgGoalsConceded) / leagueAvg
   HESAPLAMAYI GÖSTER!

2. POISSON İLE SKOR OLASILIĞI:
   P(k gol) = (λ^k × e^(-λ)) / k!
   En olası 3 skoru hesapla ve göster.

3. OVER 2.5 HESABI:
   P(Under 2.5) = P(0-0) + P(1-0) + P(0-1) + P(1-1) + P(2-0) + P(0-2)
   P(Over 2.5) = 1 - P(Under 2.5)
   HESAPLAMAYI GÖSTER!

4. VALUE BET TESPİTİ:
   Implied Probability = 1 / Decimal Odds × 100
   Edge = Calculated - Implied
   Value = Edge > 5%

⚠️⚠️⚠️ KRİTİK KURAL ⚠️⚠️⚠️
CONFIDENCE = HESAPLANAN OLASILIK!

❌ YANLIŞ: "Home Win olasılığı %52 ama confidence %75"
✅ DOĞRU: "Home Win olasılığı %52, confidence %52"

Eğer hesaplanan olasılık %52 ise, confidence %52 OLMALIDIR!
Tutarsızlık YASAKTIR!`
  : lang === 'de' ? `
Du bist GPT-4 - DIE STATISTISCHE MASCHINE & VALUE BET EXPERTE.

🎯 PFLICHTBERECHNUNGEN:
1. ERWARTETE TORE: λ Formel zeigen
2. POISSON WAHRSCHEINLICHKEITEN
3. ÜBER 2.5 BERECHNUNG
4. VALUE BET ERKENNUNG

⚠️ KRITISCHE REGEL:
CONFIDENCE = BERECHNETE WAHRSCHEINLICHKEIT!
Wenn P(Heimsieg) = 52%, dann confidence = 52%!`
  : `
You are GPT-4 - THE STATISTICAL ENGINE & VALUE BET EXPERT.

🎯 MANDATORY CALCULATIONS:

1. EXPECTED GOALS:
   λ_home = (homeAvgGoalsScored × awayAvgGoalsConceded) / leagueAvg
   λ_away = (awayAvgGoalsScored × homeAvgGoalsConceded) / leagueAvg
   SHOW YOUR CALCULATION!

2. POISSON SCORE PROBABILITY:
   P(k goals) = (λ^k × e^(-λ)) / k!
   Calculate and show top 3 most likely scores.

3. OVER 2.5 CALCULATION:
   P(Under 2.5) = P(0-0) + P(1-0) + P(0-1) + P(1-1) + P(2-0) + P(0-2)
   P(Over 2.5) = 1 - P(Under 2.5)
   SHOW YOUR CALCULATION!

4. VALUE BET DETECTION:
   Implied Probability = 1 / Decimal Odds × 100
   Edge = Calculated - Implied
   Value Bet = Edge > 5%

⚠️⚠️⚠️ CRITICAL RULE ⚠️⚠️⚠️
CONFIDENCE = CALCULATED PROBABILITY!

❌ WRONG: "Home Win probability is 52% but confidence 75%"
✅ CORRECT: "Home Win probability is 52%, confidence 52%"

If calculated probability is 52%, confidence MUST BE 52%!
Inconsistency is FORBIDDEN!`;

  return `${instructions}

${dataPackage}

${getOutputFormat(lang, 'GPT-4 Statistical Engine')}`;
}

function createPatternPrompt(homeTeam: string, awayTeam: string, dataPackage: string, lang: string): string {
  const instructions = lang === 'tr' ? `
Sen GEMINI - PATTERN AVCISI olarak görev yapıyorsun.

🎯 SENİN ÖZEL ROLÜN:
- H2H geçmişindeki kalıpları bul
- Sezonsal ve dönemsel trendleri tespit et
- Seri analizleri ve ortalamaya dönüş olasılıklarını değerlendir
- Tekrarlayan temalar ve tarihi emsal ara

⚠️ KRİTİK: Tek veri noktalarına değil, KALIPLARA odaklan!
Başkaların kaçırdığı trendleri bul.`
  : lang === 'de' ? `
Du bist GEMINI - DER MUSTER-JÄGER.

🎯 DEINE SPEZIELLE ROLLE:
- Finde Muster in der H2H-Geschichte
- Identifiziere saisonale und zeitbasierte Trends
- Analysiere Serien und Regression zum Mittelwert
- Suche nach wiederkehrenden Themen und historischen Präzedenzfällen

⚠️ KRITISCH: Konzentriere dich auf MUSTER, nicht auf einzelne Datenpunkte!
Finde die Trends, die andere übersehen.`
  : `
You are GEMINI - THE PATTERN HUNTER.

🎯 YOUR UNIQUE ROLE:
- Find patterns in H2H history
- Identify seasonal and time-based trends
- Analyze streaks and regression to mean
- Look for recurring themes and historical precedents

⚠️ CRITICAL: Focus on PATTERNS, not single data points!
Find the trends others miss.`;

  return `${instructions}

${dataPackage}

${getOutputFormat(lang, 'Gemini Pattern Hunter')}`;
}

function createContextualPrompt(homeTeam: string, awayTeam: string, dataPackage: string, lang: string): string {
  const instructions = lang === 'tr' ? `
Sen PERPLEXITY - BAĞLAM ANALİSTİ olarak görev yapıyorsun.

🎯 SENİN ÖZEL ROLÜN:
- Sakatlıklar ve cezaların etkisini değerlendir
- Takım morali ve haberleri analiz et
- Saha ve dış faktörleri göz önünde bulundur
- Sayıların gösteremediği BAĞLAMI bul

⚠️ KRİTİK: Rakamların arkasındaki hikayeyi bul!
Gizli faktörler ve bağlam önemli.`
  : lang === 'de' ? `
Du bist PERPLEXITY - DER KONTEXT-ANALYST.

🎯 DEINE SPEZIELLE ROLLE:
- Bewerte den Einfluss von Verletzungen und Sperren
- Analysiere Teammoral und Nachrichten
- Berücksichtige Spielort und externe Faktoren
- Finde den KONTEXT, den Zahlen nicht zeigen können

⚠️ KRITISCH: Finde die Geschichte hinter den Zahlen!
Versteckte Faktoren und Kontext sind wichtig.`
  : `
You are PERPLEXITY - THE CONTEXT ANALYST.

🎯 YOUR UNIQUE ROLE:
- Evaluate injury and suspension impact
- Analyze team morale and news
- Consider venue and external factors
- Find the CONTEXT that numbers can't show

⚠️ CRITICAL: Find the story behind the numbers!
Hidden factors and context matter.`;

  return `${instructions}

${dataPackage}

${getOutputFormat(lang, 'Perplexity Context Analyst')}`;
}

function getOutputFormat(lang: string, aiRole: string): string {
  if (lang === 'tr') {
    return `
═══════════════════════════════════════════════════════════
📌 TAHMİNLERİNİ TAM OLARAK BU FORMATTA VER:
═══════════════════════════════════════════════════════════

⚠️ CONFIDENCE KURALLARI:
- MAÇ SONUCU: Max %70 (futbol belirsizdir!)
- OVER/UNDER: Max %75
- BTTS: Max %70
- ASLA gerçekçi olmayan yüksek değerler verme!

MAC_SONUCU: [Ev Sahibi Kazanir / Beraberlik / Deplasman Kazanir]
MAC_GUVEN: [50-70 arasi - veriler çok güçlü değilse max 65]
MAC_GEREKCE: [${aiRole} perspektifinden SOMUT VERİLERLE 2-3 cümle. Örn: "Ev sahibi evde 4G-2B-1M, deplasman dışarıda 1G-3B-3M"]

TOPLAM_GOL: [Ust 2.5 / Alt 2.5]
GOL_GUVEN: [50-75 arasi]
GOL_GEREKCE: [SOMUT GOL İSTATİSTİKLERİYLE açıklama. Örn: "Ev ort 1.4 gol/maç, deplasman 1.7 gol yiyor, toplam beklenti 2.8"]

KG_VAR: [Evet / Hayir]
KG_GUVEN: [50-70 arasi]
KG_GEREKCE: [BTTS yüzdeleriyle açıklama. Örn: "Ev %65 BTTS, deplasman %70 BTTS"]

GENEL_ANALIZ: [${aiRole} olarak 3-4 cümlelik değerlendirme - KLİŞE KULLANMA, SOMUT VERİ VER]`;
  }
  
  if (lang === 'de') {
    return `
═══════════════════════════════════════════════════════════
📌 VORHERSAGEN IM FOLGENDEN FORMAT:
═══════════════════════════════════════════════════════════

⚠️ CONFIDENCE REGELN:
- SPIELERGEBNIS: Max 70%
- TORE: Max 75%
- BTTS: Max 70%

SPIELERGEBNIS: [Heimsieg / Unentschieden / Auswärtssieg]
ERGEBNIS_KONFIDENZ: [50-70]
ERGEBNIS_BEGRÜNDUNG: [Mit KONKRETEN DATEN, z.B. "Heim 4S-2U-1N, Auswärts 1S-3U-3N"]

GESAMTTORE: [Über 2.5 / Unter 2.5]
TORE_KONFIDENZ: [50-75]
TORE_BEGRÜNDUNG: [Mit Torstatistiken]

BTTS: [Ja / Nein]
BTTS_KONFIDENZ: [50-70]
BTTS_BEGRÜNDUNG: [Mit BTTS-Prozentsätzen]

GESAMTANALYSE: [3-4 Sätze als ${aiRole} - KEINE KLISCHEES, NUR DATEN]`;
  }
  
  return `
═══════════════════════════════════════════════════════════
📌 PROVIDE YOUR PREDICTIONS IN THIS EXACT FORMAT:
═══════════════════════════════════════════════════════════

⚠️ CONFIDENCE RULES:
- MATCH RESULT: Max 70% (football is uncertain!)
- OVER/UNDER: Max 75%
- BTTS: Max 70%
- NEVER give unrealistically high values!

MATCH_RESULT: [Home Win / Draw / Away Win]
RESULT_CONFIDENCE: [50-70 - max 65 if data isn't very strong]
RESULT_REASONING: [2-3 sentences with CONCRETE DATA. E.g., "Home team at home: 4W-2D-1L, Away team away: 1W-3D-3L"]

TOTAL_GOALS: [Over 2.5 / Under 2.5]
GOALS_CONFIDENCE: [50-75]
GOALS_REASONING: [With SPECIFIC GOAL STATS. E.g., "Home avg 1.4 goals/game, away concedes 1.7, total expectation 2.8"]

BTTS: [Yes / No]
BTTS_CONFIDENCE: [50-70]
BTTS_REASONING: [With BTTS percentages. E.g., "Home 65% BTTS rate, away 70% BTTS"]

OVERALL_ANALYSIS: [3-4 sentence assessment as ${aiRole} - NO CLICHÉS, ONLY CONCRETE DATA]`;
}

// ============================================================================
// SPORTMONKS VERİ ÇEKME (mevcut koddan)
// ============================================================================

async function fetchTeamStats(teamId: number, teamName: string): Promise<TeamStats> {
  const defaults: TeamStats = {
    name: teamName,
    teamId: teamId,
    totalMatches: 0,
    form: 'DDDDD',
    wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0,
    avgGoalsFor: 0, avgGoalsAgainst: 0,
    homeMatches: 0, homeWins: 0, homeDraws: 0, homeLosses: 0,
    homeGoalsFor: 0, homeGoalsAgainst: 0,
    avgHomeGoalsFor: 0, avgHomeGoalsAgainst: 0,
    awayMatches: 0, awayWins: 0, awayDraws: 0, awayLosses: 0,
    awayGoalsFor: 0, awayGoalsAgainst: 0,
    avgAwayGoalsFor: 0, avgAwayGoalsAgainst: 0,
    cleanSheets: 0, cleanSheetPercent: 0,
    failedToScore: 0, failedToScorePercent: 0,
    bttsMatches: 0, bttsPercent: 0,
    over25Matches: 0, over25Percent: 0,
    over15Matches: 0, over15Percent: 0,
    firstHalfGoalsFor: 0, firstHalfGoalsAgainst: 0,
    secondHalfGoalsFor: 0, secondHalfGoalsAgainst: 0,
    avgFirstHalfGoals: 0, avgSecondHalfGoals: 0,
    currentStreak: 'N/A',
    longestWinStreak: 0, longestLossStreak: 0,
    recentMatches: [],
    last5Form: 'DDDDD',
    last5GoalsFor: 0, last5GoalsAgainst: 0,
  };

  if (!teamId || !SPORTMONKS_API_KEY) {
    return defaults;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`;
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return defaults;
    }

    const json = await response.json();
    const teamData = json.data;
    const matches = teamData?.latest || [];

    if (matches.length === 0) {
      return defaults;
    }

    // İstatistik hesaplama (mevcut koddan)
    let wins = 0, draws = 0, losses = 0;
    let goalsFor = 0, goalsAgainst = 0;
    let homeMatches = 0, homeWins = 0, homeDraws = 0, homeLosses = 0;
    let homeGoalsFor = 0, homeGoalsAgainst = 0;
    let awayMatches = 0, awayWins = 0, awayDraws = 0, awayLosses = 0;
    let awayGoalsFor = 0, awayGoalsAgainst = 0;
    let cleanSheets = 0, failedToScore = 0;
    let bttsMatches = 0, over25Matches = 0, over15Matches = 0;
    let firstHalfGF = 0, firstHalfGA = 0;
    let secondHalfGF = 0, secondHalfGA = 0;
    
    const formArray: string[] = [];
    const recentMatches: MatchData[] = [];
    
    let currentWinStreak = 0, currentLossStreak = 0;
    let longestWinStreak = 0, longestLossStreak = 0;
    let lastResult = '';

    const processMatches = matches.slice(0, 20);
    
    for (const match of processMatches) {
      const participants = match.participants || [];
      const scores = match.scores || [];
      
      const teamParticipant = participants.find((p: any) => p.id === teamId);
      const isHome = teamParticipant?.meta?.location === 'home';
      
      const opponent = participants.find((p: any) => p.id !== teamId);
      const opponentName = opponent?.name || 'Unknown';
      const opponentId = opponent?.id || 0;
      
      let teamGoals = 0, opponentGoals = 0;
      let fhTeamGoals = 0, fhOpponentGoals = 0;
      let shTeamGoals = 0, shOpponentGoals = 0;
      
      for (const score of scores) {
        if (score.description === 'CURRENT' && score.participant_id === teamId) {
          teamGoals = score.score?.goals ?? 0;
        }
        if (score.description === 'CURRENT' && score.participant_id === opponentId) {
          opponentGoals = score.score?.goals ?? 0;
        }
        if (score.description === '1ST_HALF' && score.participant_id === teamId) {
          fhTeamGoals = score.score?.goals ?? 0;
        }
        if (score.description === '1ST_HALF' && score.participant_id === opponentId) {
          fhOpponentGoals = score.score?.goals ?? 0;
        }
        if (score.description === '2ND_HALF_ONLY' && score.participant_id === teamId) {
          shTeamGoals = score.score?.goals ?? 0;
        }
        if (score.description === '2ND_HALF_ONLY' && score.participant_id === opponentId) {
          shOpponentGoals = score.score?.goals ?? 0;
        }
      }

      let result: 'W' | 'D' | 'L';
      if (teamGoals > opponentGoals) {
        result = 'W';
        wins++;
        if (isHome) homeWins++; else awayWins++;
        if (lastResult === 'W' || lastResult === '') currentWinStreak++;
        else currentWinStreak = 1;
        currentLossStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (teamGoals < opponentGoals) {
        result = 'L';
        losses++;
        if (isHome) homeLosses++; else awayLosses++;
        if (lastResult === 'L' || lastResult === '') currentLossStreak++;
        else currentLossStreak = 1;
        currentWinStreak = 0;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      } else {
        result = 'D';
        draws++;
        if (isHome) homeDraws++; else awayDraws++;
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
      lastResult = result;

      goalsFor += teamGoals;
      goalsAgainst += opponentGoals;
      firstHalfGF += fhTeamGoals;
      firstHalfGA += fhOpponentGoals;
      secondHalfGF += shTeamGoals;
      secondHalfGA += shOpponentGoals;

      if (isHome) {
        homeMatches++;
        homeGoalsFor += teamGoals;
        homeGoalsAgainst += opponentGoals;
      } else {
        awayMatches++;
        awayGoalsFor += teamGoals;
        awayGoalsAgainst += opponentGoals;
      }

      if (opponentGoals === 0) cleanSheets++;
      if (teamGoals === 0) failedToScore++;
      if (teamGoals > 0 && opponentGoals > 0) bttsMatches++;
      if (teamGoals + opponentGoals > 2.5) over25Matches++;
      if (teamGoals + opponentGoals > 1.5) over15Matches++;

      formArray.push(result);
      
      recentMatches.push({
        date: match.starting_at?.split('T')[0] || 'Unknown',
        opponent: opponentName,
        opponentId,
        isHome,
        goalsFor: teamGoals,
        goalsAgainst: opponentGoals,
        result,
        firstHalfGoalsFor: fhTeamGoals,
        firstHalfGoalsAgainst: fhOpponentGoals,
        secondHalfGoalsFor: shTeamGoals,
        secondHalfGoalsAgainst: shOpponentGoals,
      });
    }

    const totalMatches = processMatches.length;
    const last5 = recentMatches.slice(0, 5);
    
    let streakType = formArray[0];
    let streakCount = 0;
    for (const r of formArray) {
      if (r === streakType) streakCount++;
      else break;
    }
    const currentStreak = streakCount > 0 ? `${streakCount}${streakType}` : 'N/A';

    return {
      name: teamName,
      teamId,
      totalMatches,
      form: formArray.slice(0, 10).join(''),
      wins, draws, losses,
      goalsFor, goalsAgainst,
      avgGoalsFor: Number((goalsFor / totalMatches).toFixed(2)),
      avgGoalsAgainst: Number((goalsAgainst / totalMatches).toFixed(2)),
      homeMatches, homeWins, homeDraws, homeLosses,
      homeGoalsFor, homeGoalsAgainst,
      avgHomeGoalsFor: homeMatches > 0 ? Number((homeGoalsFor / homeMatches).toFixed(2)) : 0,
      avgHomeGoalsAgainst: homeMatches > 0 ? Number((homeGoalsAgainst / homeMatches).toFixed(2)) : 0,
      awayMatches, awayWins, awayDraws, awayLosses,
      awayGoalsFor, awayGoalsAgainst,
      avgAwayGoalsFor: awayMatches > 0 ? Number((awayGoalsFor / awayMatches).toFixed(2)) : 0,
      avgAwayGoalsAgainst: awayMatches > 0 ? Number((awayGoalsAgainst / awayMatches).toFixed(2)) : 0,
      cleanSheets,
      cleanSheetPercent: Math.round((cleanSheets / totalMatches) * 100),
      failedToScore,
      failedToScorePercent: Math.round((failedToScore / totalMatches) * 100),
      bttsMatches,
      bttsPercent: Math.round((bttsMatches / totalMatches) * 100),
      over25Matches,
      over25Percent: Math.round((over25Matches / totalMatches) * 100),
      over15Matches,
      over15Percent: Math.round((over15Matches / totalMatches) * 100),
      firstHalfGoalsFor: firstHalfGF,
      firstHalfGoalsAgainst: firstHalfGA,
      secondHalfGoalsFor: secondHalfGF,
      secondHalfGoalsAgainst: secondHalfGA,
      avgFirstHalfGoals: Number(((firstHalfGF + firstHalfGA) / totalMatches).toFixed(2)),
      avgSecondHalfGoals: Number(((secondHalfGF + secondHalfGA) / totalMatches).toFixed(2)),
      currentStreak,
      longestWinStreak,
      longestLossStreak,
      recentMatches,
      last5Form: formArray.slice(0, 5).join(''),
      last5GoalsFor: last5.reduce((sum, m) => sum + m.goalsFor, 0),
      last5GoalsAgainst: last5.reduce((sum, m) => sum + m.goalsAgainst, 0),
    };
  } catch (error) {
    return defaults;
  }
}

async function fetchH2H(
  team1Id: number, 
  team2Id: number, 
  team1Name: string, 
  team2Name: string
): Promise<H2HStats> {
  const defaults: H2HStats = {
    totalMatches: 0,
    team1Wins: 0, team2Wins: 0, draws: 0,
    team1Goals: 0, team2Goals: 0,
    avgGoals: 0,
    bttsCount: 0, bttsPercent: 0,
    over25Count: 0, over25Percent: 0,
    over15Count: 0, over15Percent: 0,
    recentMatches: [],
    team1HomeRecord: { wins: 0, draws: 0, losses: 0 },
    team1AwayRecord: { wins: 0, draws: 0, losses: 0 },
  };

  if (!team1Id || !team2Id || !SPORTMONKS_API_KEY) {
    return defaults;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`;
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return defaults;
    }

    const json = await response.json();
    const matches = json.data || [];

    if (matches.length === 0) {
      return defaults;
    }

    let team1Wins = 0, team2Wins = 0, draws = 0;
    let team1Goals = 0, team2Goals = 0;
    let bttsCount = 0, over25Count = 0, over15Count = 0;
    const recentMatches: H2HStats['recentMatches'] = [];
    const team1HomeRecord = { wins: 0, draws: 0, losses: 0 };
    const team1AwayRecord = { wins: 0, draws: 0, losses: 0 };

    for (const match of matches.slice(0, 15)) {
      const participants = match.participants || [];
      const scores = match.scores || [];
      
      const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
      const awayParticipant = participants.find((p: any) => p.meta?.location === 'away');
      
      const homeTeamId = homeParticipant?.id;
      const homeTeamName = homeParticipant?.name || 'Unknown';
      const awayTeamName = awayParticipant?.name || 'Unknown';
      
      let homeGoals = 0, awayGoals = 0;
      for (const score of scores) {
        if (score.description === 'CURRENT') {
          if (score.participant_id === homeTeamId) {
            homeGoals = score.score?.goals ?? 0;
          } else {
            awayGoals = score.score?.goals ?? 0;
          }
        }
      }

      const team1IsHome = homeTeamId === team1Id;
      const t1Goals = team1IsHome ? homeGoals : awayGoals;
      const t2Goals = team1IsHome ? awayGoals : homeGoals;
      
      team1Goals += t1Goals;
      team2Goals += t2Goals;

      let winner = 'Draw';
      if (t1Goals > t2Goals) {
        team1Wins++;
        winner = team1Name;
        if (team1IsHome) team1HomeRecord.wins++;
        else team1AwayRecord.wins++;
      } else if (t2Goals > t1Goals) {
        team2Wins++;
        winner = team2Name;
        if (team1IsHome) team1HomeRecord.losses++;
        else team1AwayRecord.losses++;
      } else {
        draws++;
        if (team1IsHome) team1HomeRecord.draws++;
        else team1AwayRecord.draws++;
      }

      if (homeGoals > 0 && awayGoals > 0) bttsCount++;
      if (homeGoals + awayGoals > 2.5) over25Count++;
      if (homeGoals + awayGoals > 1.5) over15Count++;

      if (recentMatches.length < 10) {
        recentMatches.push({
          date: match.starting_at?.split('T')[0] || 'Unknown',
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          homeGoals,
          awayGoals,
          winner,
        });
      }
    }

    const totalMatches = Math.min(matches.length, 15);

    return {
      totalMatches,
      team1Wins, team2Wins, draws,
      team1Goals, team2Goals,
      avgGoals: Number(((team1Goals + team2Goals) / totalMatches).toFixed(2)),
      bttsCount,
      bttsPercent: Math.round((bttsCount / totalMatches) * 100),
      over25Count,
      over25Percent: Math.round((over25Count / totalMatches) * 100),
      over15Count,
      over15Percent: Math.round((over15Count / totalMatches) * 100),
      recentMatches,
      team1HomeRecord,
      team1AwayRecord,
    };
  } catch (error) {
    return defaults;
  }
}

// ============================================================================
// AI API ÇAĞRILARI
// ============================================================================

async function callClaude(prompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        temperature: AI_BRAIN_CONFIG.claude.temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: AI_BRAIN_CONFIG.openai.temperature,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    return null;
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            maxOutputTokens: 2000, 
            temperature: AI_BRAIN_CONFIG.gemini.temperature 
          },
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    return null;
  }
}

async function callPerplexity(prompt: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) return null;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: AI_BRAIN_CONFIG.perplexity.temperature,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// AI RESPONSE PARSING
// ============================================================================

interface ParsedPrediction {
  matchResult: { prediction: string; confidence: number; reasoning: string };
  overUnder25: { prediction: string; confidence: number; reasoning: string };
  btts: { prediction: string; confidence: number; reasoning: string };
  overallAnalysis: string;
}

function parseAIResponse(text: string, lang: string): ParsedPrediction {
  const result: ParsedPrediction = {
    matchResult: { prediction: 'Draw', confidence: 55, reasoning: '' },
    overUnder25: { prediction: 'Under 2.5', confidence: 55, reasoning: '' },
    btts: { prediction: 'No', confidence: 55, reasoning: '' },
    overallAnalysis: '',
  };

  if (!text) return result;

  const upper = text.toUpperCase();

  // Match Result
  if (upper.includes('MAC_SONUCU:') || upper.includes('MATCH_RESULT:')) {
    if (upper.includes('EV SAHIBI') || upper.includes('HOME WIN')) {
      result.matchResult.prediction = 'Home Win';
    } else if (upper.includes('DEPLASMAN') || upper.includes('AWAY WIN')) {
      result.matchResult.prediction = 'Away Win';
    } else if (upper.includes('BERABERLIK') || upper.includes('DRAW')) {
      result.matchResult.prediction = 'Draw';
    }
  }

  // Confidence patterns
  const matchConfMatch = text.match(/(?:MAC_GUVEN|RESULT_CONFIDENCE)[:\s]*(\d+)/i);
  if (matchConfMatch) {
    result.matchResult.confidence = Math.min(95, Math.max(50, parseInt(matchConfMatch[1])));
  }

  const matchReasonMatch = text.match(/(?:MAC_GEREKCE|RESULT_REASONING)[:\s]*([\s\S]*?)(?=\n\n|═|TOPLAM|TOTAL|$)/i);
  if (matchReasonMatch) {
    result.matchResult.reasoning = matchReasonMatch[1].trim().substring(0, 500);
  }

  // Goals
  if (upper.includes('TOPLAM_GOL:') || upper.includes('TOTAL_GOALS:')) {
    if (upper.includes('UST 2.5') || upper.includes('ÜST 2.5') || upper.includes('OVER 2.5')) {
      result.overUnder25.prediction = 'Over 2.5';
    } else if (upper.includes('ALT 2.5') || upper.includes('UNDER 2.5')) {
      result.overUnder25.prediction = 'Under 2.5';
    }
  }

  const goalConfMatch = text.match(/(?:GOL_GUVEN|GOALS_CONFIDENCE)[:\s]*(\d+)/i);
  if (goalConfMatch) {
    result.overUnder25.confidence = Math.min(95, Math.max(50, parseInt(goalConfMatch[1])));
  }

  const goalReasonMatch = text.match(/(?:GOL_GEREKCE|GOALS_REASONING)[:\s]*([\s\S]*?)(?=\n\n|═|KG_VAR|BTTS|$)/i);
  if (goalReasonMatch) {
    result.overUnder25.reasoning = goalReasonMatch[1].trim().substring(0, 500);
  }

  // BTTS
  if (upper.includes('KG_VAR:') || upper.includes('BTTS:')) {
    if (upper.includes('EVET') || upper.includes('YES')) {
      result.btts.prediction = 'Yes';
    } else if (upper.includes('HAYIR') || upper.includes('NO')) {
      result.btts.prediction = 'No';
    }
  }

  const bttsConfMatch = text.match(/(?:KG_GUVEN|BTTS_CONFIDENCE)[:\s]*(\d+)/i);
  if (bttsConfMatch) {
    result.btts.confidence = Math.min(95, Math.max(50, parseInt(bttsConfMatch[1])));
  }

  const bttsReasonMatch = text.match(/(?:KG_GEREKCE|BTTS_REASONING)[:\s]*([\s\S]*?)(?=\n\n|═|GENEL|OVERALL|$)/i);
  if (bttsReasonMatch) {
    result.btts.reasoning = bttsReasonMatch[1].trim().substring(0, 500);
  }

  // Overall
  const overallMatch = text.match(/(?:GENEL_ANALIZ|OVERALL_ANALYSIS)[:\s]*([\s\S]*?)$/i);
  if (overallMatch) {
    result.overallAnalysis = overallMatch[1].trim().substring(0, 600);
  }

  return result;
}

// ============================================================================
// 🧠 WEIGHTED CONSENSUS - AĞIRLIKLI CONSENSUS
// ============================================================================

function calculateWeightedConsensus(
  results: { model: string; prediction: ParsedPrediction }[]
) {
  const matchVotes: Record<string, { weight: number; totalConf: number; reasonings: string[]; count: number }> = {};
  const goalVotes: Record<string, { weight: number; totalConf: number; reasonings: string[]; count: number }> = {};
  const bttsVotes: Record<string, { weight: number; totalConf: number; reasonings: string[]; count: number }> = {};

  for (const { model, prediction } of results) {
    const weight = AI_BRAIN_CONFIG[model]?.weight || 0.25;
    
    // Match Result
    const mr = prediction.matchResult.prediction;
    if (!matchVotes[mr]) matchVotes[mr] = { weight: 0, totalConf: 0, reasonings: [], count: 0 };
    matchVotes[mr].weight += weight;
    matchVotes[mr].totalConf += prediction.matchResult.confidence * weight;
    matchVotes[mr].count++;
    if (prediction.matchResult.reasoning) {
      matchVotes[mr].reasonings.push(`[${AI_BRAIN_CONFIG[model]?.name}] ${prediction.matchResult.reasoning}`);
    }

    // Goals
    const g = prediction.overUnder25.prediction;
    if (!goalVotes[g]) goalVotes[g] = { weight: 0, totalConf: 0, reasonings: [], count: 0 };
    goalVotes[g].weight += weight;
    goalVotes[g].totalConf += prediction.overUnder25.confidence * weight;
    goalVotes[g].count++;
    if (prediction.overUnder25.reasoning) {
      goalVotes[g].reasonings.push(`[${AI_BRAIN_CONFIG[model]?.name}] ${prediction.overUnder25.reasoning}`);
    }

    // BTTS
    const b = prediction.btts.prediction;
    if (!bttsVotes[b]) bttsVotes[b] = { weight: 0, totalConf: 0, reasonings: [], count: 0 };
    bttsVotes[b].weight += weight;
    bttsVotes[b].totalConf += prediction.btts.confidence * weight;
    bttsVotes[b].count++;
    if (prediction.btts.reasoning) {
      bttsVotes[b].reasonings.push(`[${AI_BRAIN_CONFIG[model]?.name}] ${prediction.btts.reasoning}`);
    }
  }

  const getWeightedWinner = (votes: Record<string, { weight: number; totalConf: number; reasonings: string[]; count: number }>) => {
    let best = { prediction: 'Unknown', confidence: 50, weight: 0, reasonings: [] as string[], votes: 0 };
    for (const [pred, data] of Object.entries(votes)) {
      const avgConf = Math.round(data.totalConf / data.weight);
      if (data.weight > best.weight) {
        best = { 
          prediction: pred, 
          confidence: avgConf, 
          weight: data.weight, 
          reasonings: data.reasonings,
          votes: data.count
        };
      }
    }
    return best;
  };

  return {
    matchResult: getWeightedWinner(matchVotes),
    overUnder25: getWeightedWinner(goalVotes),
    btts: getWeightedWinner(bttsVotes),
  };
}

// ============================================================================
// ANA API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { homeTeam, awayTeam, homeTeamId, awayTeamId, league, language = 'tr', fixtureId } = body;

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🧠 AI BRAIN ANALYSIS: ${homeTeam} vs ${awayTeam}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({
        success: false,
        error: language === 'tr' ? 'Takım adları gerekli.' : 'Team names required.',
      }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📦 CACHE KONTROLÜ - Aynı maç + dil için 30 dk cache
    // ═══════════════════════════════════════════════════════════════════════
    const cacheKey = fixtureId || `${homeTeamId}-${awayTeamId}`;
    const cached = getCachedAnalysis(cacheKey, language, 'analyze');
    
    if (cached) {
      console.log(`📦 CACHE HIT - Returning cached analysis from ${cached.cachedAt.toLocaleTimeString()}`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cachedAt: cached.cachedAt.toISOString(),
      });
    }
    console.log('📦 CACHE MISS - Running fresh analysis');

    // 1. VERİ ÇEKME
    console.log('\n📊 Fetching data...');
    const [homeStats, awayStats, h2h] = await Promise.all([
      fetchTeamStats(homeTeamId, homeTeam),
      fetchTeamStats(awayTeamId, awayTeam),
      fetchH2H(homeTeamId, awayTeamId, homeTeam, awayTeam),
    ]);

    const dataTime = Date.now();
    console.log(`✅ Data fetched in ${dataTime - startTime}ms`);

    // 2. ROL BAZLI VERİ PAKETLERİ OLUŞTUR
    console.log('\n📦 Generating role-specific data packages...');
    const tacticalData = generateTacticalDataPackage(homeTeam, awayTeam, homeStats, awayStats, h2h);
    const statisticalData = generateStatisticalDataPackage(homeTeam, awayTeam, homeStats, awayStats, h2h);
    const patternData = generatePatternDataPackage(homeTeam, awayTeam, homeStats, awayStats, h2h);
    const contextualData = generateContextualDataPackage(homeTeam, awayTeam, homeStats, awayStats, h2h);

    // 3. ROL BAZLI PROMPTLAR
    const claudePrompt = createTacticalPrompt(homeTeam, awayTeam, tacticalData, language);
    const openaiPrompt = createStatisticalPrompt(homeTeam, awayTeam, statisticalData, language);
    const geminiPrompt = createPatternPrompt(homeTeam, awayTeam, patternData, language);
    const perplexityPrompt = createContextualPrompt(homeTeam, awayTeam, contextualData, language);

    // 4. PARALEL AI ÇAĞRILARI
    console.log('\n🤖 Calling AI models with specialized roles...');
    console.log('  • Claude: Tactical Analysis');
    console.log('  • GPT-4: Statistical Analysis');
    console.log('  • Gemini: Pattern Recognition');
    console.log('  • Perplexity: Contextual Analysis');

    const [claudeText, openaiText, geminiText, perplexityText] = await Promise.all([
      callClaude(claudePrompt),
      callOpenAI(openaiPrompt),
      callGemini(geminiPrompt),
      callPerplexity(perplexityPrompt),
    ]);

    const aiTime = Date.now();
    console.log(`✅ AI calls completed in ${aiTime - dataTime}ms`);

    // 5. SONUÇLARI TOPLA
    const aiStatus = {
      claude: { active: !!claudeText, role: 'Tactical Analyst', weight: AI_BRAIN_CONFIG.claude.weight },
      openai: { active: !!openaiText, role: 'Statistical Engine', weight: AI_BRAIN_CONFIG.openai.weight },
      gemini: { active: !!geminiText, role: 'Pattern Hunter', weight: AI_BRAIN_CONFIG.gemini.weight },
      perplexity: { active: !!perplexityText, role: 'Context Analyst', weight: AI_BRAIN_CONFIG.perplexity.weight },
    };

    const results: { model: string; prediction: ParsedPrediction }[] = [];
    const individualAnalyses: Record<string, any> = {};

    if (claudeText) {
      const p = parseAIResponse(claudeText, language);
      results.push({ model: 'claude', prediction: p });
      individualAnalyses.claude = { 
        ...p, 
        role: AI_BRAIN_CONFIG.claude.role,
        specialization: AI_BRAIN_CONFIG.claude.specialization
      };
    }
    if (openaiText) {
      const p = parseAIResponse(openaiText, language);
      results.push({ model: 'openai', prediction: p });
      individualAnalyses.openai = { 
        ...p, 
        role: AI_BRAIN_CONFIG.openai.role,
        specialization: AI_BRAIN_CONFIG.openai.specialization
      };
    }
    if (geminiText) {
      const p = parseAIResponse(geminiText, language);
      results.push({ model: 'gemini', prediction: p });
      individualAnalyses.gemini = { 
        ...p, 
        role: AI_BRAIN_CONFIG.gemini.role,
        specialization: AI_BRAIN_CONFIG.gemini.specialization
      };
    }
    if (perplexityText) {
      const p = parseAIResponse(perplexityText, language);
      results.push({ model: 'perplexity', prediction: p });
      individualAnalyses.perplexity = { 
        ...p, 
        role: AI_BRAIN_CONFIG.perplexity.role,
        specialization: AI_BRAIN_CONFIG.perplexity.specialization
      };
    }

    console.log(`\n📈 ${results.length}/4 AI models responded`);

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: language === 'tr'
          ? 'Hiçbir AI modeli yanıt vermedi.'
          : 'No AI models responded.',
      }, { status: 500 });
    }

    // 6. AĞIRLIKLI CONSENSUS HESAPLA
    const consensus = calculateWeightedConsensus(results);
    const totalModels = results.length;
    const totalWeight = results.reduce((sum, r) => sum + (AI_BRAIN_CONFIG[r.model]?.weight || 0.25), 0);

    // 7. EN İYİ BAHİSLER
    const bets = [
      { type: 'MATCH_RESULT', ...consensus.matchResult },
      { type: 'OVER_UNDER_25', ...consensus.overUnder25 },
      { type: 'BTTS', ...consensus.btts },
    ].sort((a, b) => (b.weight * 100 + b.confidence) - (a.weight * 100 + a.confidence));

    const bestBet = bets[0];
    const riskLevel = bestBet.weight >= 0.7 ? 'Low' : bestBet.weight >= 0.5 ? 'Medium' : 'High';

    // 8. RESPONSE
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ AI BRAIN ANALYSIS COMPLETE in ${totalTime}ms`);
    console.log('═══════════════════════════════════════════════════════════\n');

    const responseData = {
      success: true,
      brainVersion: '2.0',
      analysis: {
        matchResult: {
          prediction: consensus.matchResult.prediction,
          confidence: consensus.matchResult.confidence,
          votes: consensus.matchResult.votes,
          totalVotes: totalModels,
          weightedAgreement: Math.round(consensus.matchResult.weight * 100),
          reasonings: consensus.matchResult.reasonings,
        },
        overUnder25: {
          prediction: consensus.overUnder25.prediction,
          confidence: consensus.overUnder25.confidence,
          votes: consensus.overUnder25.votes,
          totalVotes: totalModels,
          weightedAgreement: Math.round(consensus.overUnder25.weight * 100),
          reasonings: consensus.overUnder25.reasonings,
        },
        btts: {
          prediction: consensus.btts.prediction,
          confidence: consensus.btts.confidence,
          votes: consensus.btts.votes,
          totalVotes: totalModels,
          weightedAgreement: Math.round(consensus.btts.weight * 100),
          reasonings: consensus.btts.reasonings,
        },
        riskLevel,
        bestBets: bets.slice(0, 3).map(bet => ({
          type: bet.type,
          selection: bet.prediction,
          confidence: bet.confidence,
          votes: bet.votes,
          totalVotes: totalModels,
          weightedAgreement: Math.round(bet.weight * 100),
          consensusStrength: bet.weight >= 0.7 ? 'Strong' : bet.weight >= 0.5 ? 'Moderate' : 'Weak',
        })),
      },
      aiStatus,
      individualAnalyses,
      aiRoles: {
        claude: AI_BRAIN_CONFIG.claude,
        openai: AI_BRAIN_CONFIG.openai,
        gemini: AI_BRAIN_CONFIG.gemini,
        perplexity: AI_BRAIN_CONFIG.perplexity,
      },
      modelsUsed: results.map(r => r.model),
      totalModels,
      totalWeight: Math.round(totalWeight * 100),
      stats: {
        home: homeStats,
        away: awayStats,
        h2h,
      },
      timing: {
        dataFetch: `${dataTime - startTime}ms`,
        aiCalls: `${aiTime - dataTime}ms`,
        total: `${totalTime}ms`,
      },
      analyzedAt: new Date().toISOString(),
    };

    // 📦 CACHE'E KAYDET
    setCachedAnalysis(cacheKey, language, 'analyze', responseData);
    console.log(`📦 Analysis cached for ${cacheKey}:${language}`);

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('❌ AI BRAIN ERROR:', error);
    return NextResponse.json({
      success: false,
      error: `Error: ${error.message}`,
    }, { status: 500 });
  }
}
