// src/lib/heurist/orchestrator.ts
import { runScoutAgent } from './agents/scout';
import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
import { runStrategyAgent } from './agents/strategy';
import { MatchData } from './types';

// Agent ağırlıkları
const AGENT_WEIGHTS = {
  stats: 0.40,    // %40 - En güvenilir, veriye dayalı
  odds: 0.35,     // %35 - Piyasa bilgisi
  strategy: 0.25, // %25 - Risk ve strateji
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
  const overUnderVotes = {
    over: 0,
    under: 0,
  };
  
  // Stats agent görüşü
  if (stats?.overUnder) {
    const isOver = stats.overUnder.toLowerCase().includes('over') || 
                   stats.overUnder.toLowerCase().includes('üst');
    if (isOver) overUnderVotes.over += weights.stats * (stats.confidence || 70);
    else overUnderVotes.under += weights.stats * (stats.confidence || 70);
  }
  
  // Odds agent görüşü
  if (odds?.recommendation) {
    const isOver = odds.recommendation.toLowerCase().includes('over') || 
                   odds.recommendation.toLowerCase().includes('üst');
    if (isOver) overUnderVotes.over += weights.odds * (odds.confidence || 70);
    else overUnderVotes.under += weights.odds * (odds.confidence || 70);
  }
  
  // Strategy agent görüşü
  if (strategy?.recommendedBets?.[0]) {
    const bet = strategy.recommendedBets[0];
    const isOver = bet.type?.toLowerCase().includes('over') || 
                   bet.selection?.toLowerCase().includes('over') ||
                   bet.type?.toLowerCase().includes('üst');
    if (isOver) overUnderVotes.over += weights.strategy * (bet.confidence || 70);
    else overUnderVotes.under += weights.strategy * (bet.confidence || 70);
  }
  
  const overUnderTotal = overUnderVotes.over + overUnderVotes.under;
  const overUnderPrediction = overUnderVotes.over >= overUnderVotes.under ? 'Over' : 'Under';
  const overUnderConfidence = overUnderTotal > 0 
    ? Math.round((Math.max(overUnderVotes.over, overUnderVotes.under) / overUnderTotal) * 100)
    : 50;

  // Match Result hesaplama
  const matchVotes = { '1': 0, 'X': 0, '2': 0 };
  
  if (stats?.matchResult) {
    const result = stats.matchResult.toString();
    if (result.includes('1') || result.toLowerCase().includes('home')) matchVotes['1'] += weights.stats * 70;
    else if (result.includes('2') || result.toLowerCase().includes('away')) matchVotes['2'] += weights.stats * 70;
    else matchVotes['X'] += weights.stats * 70;
  }
  
  if (odds?.matchWinnerValue) {
    const bestValue = odds.matchWinnerValue;
    if (bestValue.includes('home') || bestValue.includes('1')) matchVotes['1'] += weights.odds * 70;
    else if (bestValue.includes('away') || bestValue.includes('2')) matchVotes['2'] += weights.odds * 70;
    else matchVotes['X'] += weights.odds * 70;
  }
  
  if (strategy?.recommendedBets) {
    strategy.recommendedBets.forEach((bet: any) => {
      if (bet.type?.toLowerCase().includes('result') || bet.type?.toLowerCase().includes('sonuç')) {
        if (bet.selection?.includes('1') || bet.selection?.toLowerCase().includes('home')) matchVotes['1'] += weights.strategy * 60;
        else if (bet.selection?.includes('2') || bet.selection?.toLowerCase().includes('away')) matchVotes['2'] += weights.strategy * 60;
        else matchVotes['X'] += weights.strategy * 60;
      }
    });
  }
  
  const matchTotal = matchVotes['1'] + matchVotes['X'] + matchVotes['2'];
  const matchResultPrediction = Object.entries(matchVotes).sort((a, b) => b[1] - a[1])[0][0];
  const matchResultConfidence = matchTotal > 0 
    ? Math.round((Math.max(matchVotes['1'], matchVotes['X'], matchVotes['2']) / matchTotal) * 100)
    : 33;

  // BTTS hesaplama
  const bttsVotes = { yes: 0, no: 0 };
  
  if (stats?.btts) {
    const isBttsYes = stats.btts.toLowerCase().includes('yes') || 
                      stats.btts.toLowerCase().includes('var') ||
                      stats.btts.toLowerCase().includes('evet');
    if (isBttsYes) bttsVotes.yes += weights.stats * 70;
    else bttsVotes.no += weights.stats * 70;
  }
  
  if (odds?.bttsValue) {
    const isBttsYes = odds.bttsValue.toLowerCase().includes('yes') || 
                      odds.bttsValue.toLowerCase().includes('var');
    if (isBttsYes) bttsVotes.yes += weights.odds * 70;
    else bttsVotes.no += weights.odds * 70;
  }
  
  const bttsTotal = bttsVotes.yes + bttsVotes.no;
  const bttsPrediction = bttsVotes.yes >= bttsVotes.no ? 'Yes' : 'No';
  const bttsConfidence = bttsTotal > 0 
    ? Math.round((Math.max(bttsVotes.yes, bttsVotes.no) / bttsTotal) * 100)
    : 50;

  // En iyi bahis seçimi
  const allBets = [
    { type: 'Over/Under 2.5', selection: overUnderPrediction, confidence: overUnderConfidence, weight: overUnderTotal },
    { type: 'Match Result', selection: matchResultPrediction, confidence: matchResultConfidence, weight: matchTotal },
    { type: 'BTTS', selection: bttsPrediction, confidence: bttsConfidence, weight: bttsTotal },
  ];
  
  const bestBet = allBets.sort((a, b) => (b.confidence * b.weight) - (a.confidence * a.weight))[0];

  return {
    overUnder: {
      prediction: overUnderPrediction,
      confidence: overUnderConfidence,
      reasoning: labels.weightedAnalysis,
    },
    matchResult: {
      prediction: matchResultPrediction,
      confidence: matchResultConfidence,
      reasoning: labels.agentConsensus,
    },
    btts: {
      prediction: bttsPrediction,
      confidence: bttsConfidence,
      reasoning: labels.goalStatsBased,
    },
    bestBet: {
      type: bestBet.type,
      selection: bestBet.selection,
      confidence: bestBet.confidence,
      reasoning: labels.bestBetReason,
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

    // Phase 3: Weighted Consensus (Kod ile hesaplama - AI değil)
    console.log('⚖️ Phase 3: Calculating weighted consensus...');
    const weightedConsensus = calculateWeightedConsensus(statsResult, oddsResult, strategyResult, language);
    reports.weightedConsensus = weightedConsensus;
    console.log(`✅ Phase 3 complete: Consensus calculated`);

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
