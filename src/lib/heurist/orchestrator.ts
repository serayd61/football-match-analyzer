// src/lib/heurist/orchestrator.ts
import { runScoutAgent } from './agents/scout';
import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
import { runStrategyAgent } from './agents/strategy';
import { MatchData } from './types';

// Agent ağırlıkları
const AGENT_WEIGHTS = {
  stats: 0.40,
  odds: 0.35,
  strategy: 0.25,
};

// Çok dilli metinler
const CONSENSUS_LABELS = {
  tr: {
    weightedAnalysis: 'Stats (%40) + Odds (%35) + Strategy (%25) ağırlıklı analiz',
    agentConsensus: '3 agent konsensüsü',
    goalStatsBased: 'Gol istatistiklerine dayalı',
    bestBetReason: 'En yüksek ağırlıklı güven skoruna sahip bahis',
    weight: 'ağırlık',
  },
  en: {
    weightedAnalysis: 'Stats (40%) + Odds (35%) + Strategy (25%) weighted analysis',
    agentConsensus: '3 agent consensus',
    goalStatsBased: 'Based on goal statistics',
    bestBetReason: 'Highest weighted confidence score',
    weight: 'weight',
  },
  de: {
    weightedAnalysis: 'Stats (40%) + Odds (35%) + Strategy (25%) gewichtete Analyse',
    agentConsensus: '3-Agenten-Konsens',
    goalStatsBased: 'Basierend auf Torstatistiken',
    bestBetReason: 'Höchster gewichteter Konfidenzwert',
    weight: 'Gewichtung',
  },
};

export interface AgentReport {
  scout?: any;
  stats?: any;
  odds?: any;
  strategy?: any;
  weightedConsensus?: any;
}

export interface AnalysisResult {
  success: boolean;
  reports: AgentReport;
  timing: number;
  errors: string[];
  weights: typeof AGENT_WEIGHTS;
}

// Confidence'ı normalize et (max 85%, min 45%)
function normalizeConfidence(rawConfidence: number, voteCount: number): number {
  // Eğer sadece 1-2 agent oy verdiyse, confidence düşür
  const voteMultiplier = Math.min(voteCount / 3, 1); // 3 agent = full confidence
  
  // Raw confidence'ı 45-85 aralığına map et
  const normalized = 45 + (rawConfidence - 50) * 0.8;
  
  // Vote count'a göre ayarla
  const adjusted = normalized * (0.7 + 0.3 * voteMultiplier);
  
  return Math.round(Math.min(85, Math.max(45, adjusted)));
}

// Ağırlıklı konsensüs hesaplama (AI değil, matematik)
function calculateWeightedConsensus(
  stats: any, 
  odds: any, 
  strategy: any, 
  language: 'tr' | 'en' | 'de' = 'en'
): any {
  const weights = AGENT_WEIGHTS;
  const labels = CONSENSUS_LABELS[language] || CONSENSUS_LABELS.en;
  
  // Over/Under hesaplama
  const overUnderVotes = { over: 0, under: 0 };
  let overUnderVoteCount = 0;
  
  // Stats agent görüşü
  if (stats?.overUnder) {
    const isOver = stats.overUnder.toLowerCase().includes('over') || 
                   stats.overUnder.toLowerCase().includes('üst');
    const conf = Math.min(stats.confidence || 65, 80);
    if (isOver) overUnderVotes.over += weights.stats * conf;
    else overUnderVotes.under += weights.stats * conf;
    overUnderVoteCount++;
  }
  
  // Odds agent görüşü
  if (odds?.recommendation) {
    const isOver = odds.recommendation.toLowerCase().includes('over') || 
                   odds.recommendation.toLowerCase().includes('üst');
    const conf = Math.min(odds.confidence || 65, 80);
    if (isOver) overUnderVotes.over += weights.odds * conf;
    else overUnderVotes.under += weights.odds * conf;
    overUnderVoteCount++;
  }
  
  // Strategy agent görüşü
  if (strategy?.recommendedBets?.[0]) {
    const bet = strategy.recommendedBets[0];
    const isOver = bet.type?.toLowerCase().includes('over') || 
                   bet.selection?.toLowerCase().includes('over') ||
                   bet.type?.toLowerCase().includes('üst');
    const conf = Math.min(bet.confidence || 65, 80);
    if (isOver) overUnderVotes.over += weights.strategy * conf;
    else overUnderVotes.under += weights.strategy * conf;
    overUnderVoteCount++;
  }
  
  const overUnderTotal = overUnderVotes.over + overUnderVotes.under;
  const overUnderPrediction = overUnderVotes.over >= overUnderVotes.under ? 'Over' : 'Under';
  const overUnderRawConf = overUnderTotal > 0 
    ? (Math.max(overUnderVotes.over, overUnderVotes.under) / overUnderTotal) * 100
    : 50;
  const overUnderConfidence = normalizeConfidence(overUnderRawConf, overUnderVoteCount);

  // Match Result hesaplama
  const matchVotes = { '1': 0, 'X': 0, '2': 0 };
  let matchVoteCount = 0;
  
  if (stats?.matchResult) {
    const result = stats.matchResult.toString().toUpperCase();
    const conf = Math.min(stats.confidence || 60, 75);
    if (result.includes('1') || result.toLowerCase().includes('home')) {
      matchVotes['1'] += weights.stats * conf;
    } else if (result.includes('2') || result.toLowerCase().includes('away')) {
      matchVotes['2'] += weights.stats * conf;
    } else {
      matchVotes['X'] += weights.stats * conf;
    }
    matchVoteCount++;
  }
  
  if (odds?.matchWinnerValue) {
    const bestValue = odds.matchWinnerValue.toLowerCase();
    const conf = Math.min(odds.confidence || 60, 75);
    if (bestValue.includes('home') || bestValue.includes('1')) {
      matchVotes['1'] += weights.odds * conf;
    } else if (bestValue.includes('away') || bestValue.includes('2')) {
      matchVotes['2'] += weights.odds * conf;
    } else {
      matchVotes['X'] += weights.odds * conf;
    }
    matchVoteCount++;
  }
  
  if (strategy?.recommendedBets) {
    const resultBet = strategy.recommendedBets.find((bet: any) => 
      bet.type?.toLowerCase().includes('result') || 
      bet.type?.toLowerCase().includes('winner') ||
      bet.type?.toLowerCase().includes('sonuç')
    );
    if (resultBet) {
      const conf = Math.min(resultBet.confidence || 60, 75);
      if (resultBet.selection?.includes('1') || resultBet.selection?.toLowerCase().includes('home')) {
        matchVotes['1'] += weights.strategy * conf;
      } else if (resultBet.selection?.includes('2') || resultBet.selection?.toLowerCase().includes('away')) {
        matchVotes['2'] += weights.strategy * conf;
      } else {
        matchVotes['X'] += weights.strategy * conf;
      }
      matchVoteCount++;
    }
  }
  
  const matchTotal = matchVotes['1'] + matchVotes['X'] + matchVotes['2'];
  const sortedMatches = Object.entries(matchVotes).sort((a, b) => b[1] - a[1]);
  const matchResultPrediction = sortedMatches[0][0];
  const matchRawConf = matchTotal > 0 
    ? (sortedMatches[0][1] / matchTotal) * 100
    : 33;
  const matchResultConfidence = normalizeConfidence(matchRawConf, matchVoteCount);

  // BTTS hesaplama
  const bttsVotes = { yes: 0, no: 0 };
  let bttsVoteCount = 0;
  
  if (stats?.btts) {
    const isBttsYes = stats.btts.toLowerCase().includes('yes') || 
                      stats.btts.toLowerCase().includes('var') ||
                      stats.btts.toLowerCase().includes('evet');
    const conf = Math.min(stats.confidence || 65, 80);
    if (isBttsYes) bttsVotes.yes += weights.stats * conf;
    else bttsVotes.no += weights.stats * conf;
    bttsVoteCount++;
  }
  
  if (odds?.bttsValue) {
    const isBttsYes = odds.bttsValue.toLowerCase().includes('yes') || 
                      odds.bttsValue.toLowerCase().includes('var');
    const conf = Math.min(odds.confidence || 65, 80);
    if (isBttsYes) bttsVotes.yes += weights.odds * conf;
    else bttsVotes.no += weights.odds * conf;
    bttsVoteCount++;
  }
  
  const bttsTotal = bttsVotes.yes + bttsVotes.no;
  const bttsPrediction = bttsVotes.yes >= bttsVotes.no ? 'Yes' : 'No';
  const bttsRawConf = bttsTotal > 0 
    ? (Math.max(bttsVotes.yes, bttsVotes.no) / bttsTotal) * 100
    : 50;
  const bttsConfidence = normalizeConfidence(bttsRawConf, bttsVoteCount);

  // En iyi bahis seçimi - confidence ve agreement'a göre
  const allBets = [
    { 
      type: 'Over/Under 2.5', 
      selection: overUnderPrediction, 
      confidence: overUnderConfidence, 
      votes: overUnderVoteCount,
      score: overUnderConfidence * overUnderVoteCount 
    },
    { 
      type: 'Match Result', 
      selection: matchResultPrediction, 
      confidence: matchResultConfidence, 
      votes: matchVoteCount,
      score: matchResultConfidence * matchVoteCount 
    },
    { 
      type: 'BTTS', 
      selection: bttsPrediction, 
      confidence: bttsConfidence, 
      votes: bttsVoteCount,
      score: bttsConfidence * bttsVoteCount 
    },
  ];
  
  const bestBet = allBets.sort((a, b) => b.score - a.score)[0];

  return {
    overUnder: {
      prediction: overUnderPrediction,
      confidence: overUnderConfidence,
      reasoning: labels.weightedAnalysis,
      votes: overUnderVoteCount,
    },
    matchResult: {
      prediction: matchResultPrediction,
      confidence: matchResultConfidence,
      reasoning: labels.agentConsensus,
      votes: matchVoteCount,
    },
    btts: {
      prediction: bttsPrediction,
      confidence: bttsConfidence,
      reasoning: labels.goalStatsBased,
      votes: bttsVoteCount,
    },
    bestBet: {
      type: bestBet.type,
      selection: bestBet.selection,
      confidence: bestBet.confidence,
      reasoning: labels.bestBetReason,
      votes: bestBet.votes,
    },
    agentContributions: {
      stats: `${Math.round(weights.stats * 100)}% ${labels.weight}`,
      odds: `${Math.round(weights.odds * 100)}% ${labels.weight}`,
      strategy: `${Math.round(weights.strategy * 100)}% ${labels.weight}`,
    },
  };
}

export async function runFullAnalysis(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const reports: AgentReport = {};

  console.log(`🚀 Starting full analysis for ${matchData.homeTeam} vs ${matchData.awayTeam} [${language.toUpperCase()}]`);

  try {
    // Phase 1: Scout, Stats, Odds parallel
    console.log('📊 Phase 1: Running Scout, Stats, Odds agents in parallel...');
    const [scoutResult, statsResult, oddsResult] = await Promise.all([
      runScoutAgent(matchData, language).catch(e => { errors.push(`Scout: ${e.message}`); return null; }),
      runStatsAgent(matchData, language).catch(e => { errors.push(`Stats: ${e.message}`); return null; }),
      runOddsAgent(matchData, language).catch(e => { errors.push(`Odds: ${e.message}`); return null; }),
    ]);

    reports.scout = scoutResult;
    reports.stats = statsResult;
    reports.odds = oddsResult;

    console.log(`✅ Phase 1 complete: Scout=${scoutResult ? 'OK' : 'FAIL'}, Stats=${statsResult ? 'OK' : 'FAIL'}, Odds=${oddsResult ? 'OK' : 'FAIL'}`);

    // Phase 2: Strategy
    console.log('🧠 Phase 2: Running Strategy agent...');
    const strategyResult = await runStrategyAgent(
      matchData,
      { scout: scoutResult, stats: statsResult, odds: oddsResult },
      language
    ).catch(e => { errors.push(`Strategy: ${e.message}`); return null; });

    reports.strategy = strategyResult;
    console.log(`✅ Phase 2 complete: Strategy=${strategyResult ? 'OK' : 'FAIL'}`);

    // Phase 3: Weighted Consensus
    console.log('⚖️ Phase 3: Calculating weighted consensus...');
    const weightedConsensus = calculateWeightedConsensus(statsResult, oddsResult, strategyResult, language);
    reports.weightedConsensus = weightedConsensus;
    console.log(`✅ Phase 3 complete: Consensus calculated`);
    console.log(`   Over/Under: ${weightedConsensus.overUnder.prediction} (${weightedConsensus.overUnder.confidence}%)`);
    console.log(`   Match Result: ${weightedConsensus.matchResult.prediction} (${weightedConsensus.matchResult.confidence}%)`);
    console.log(`   BTTS: ${weightedConsensus.btts.prediction} (${weightedConsensus.btts.confidence}%)`);
    console.log(`   Best Bet: ${weightedConsensus.bestBet.type} - ${weightedConsensus.bestBet.selection} (${weightedConsensus.bestBet.confidence}%)`);

    const timing = Date.now() - startTime;
    console.log(`⏱️ Total time: ${timing}ms`);

    return {
      success: true,
      reports,
      timing,
      errors,
      weights: AGENT_WEIGHTS,
    };
  } catch (error: any) {
    console.error('❌ Analysis failed:', error);
    return {
      success: false,
      reports,
      timing: Date.now() - startTime,
      errors: [...errors, error.message],
      weights: AGENT_WEIGHTS,
    };
  }
}
