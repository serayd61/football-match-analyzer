// src/lib/heurist/orchestrator.ts
// Multi-Agent Football Analysis Orchestrator - FIXED v4
// ═══════════════════════════════════════════════════════════════════════════════

import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
import { runSentimentAgent, SentimentResult } from './agents/sentimentAgent';
import { runDeepAnalysisAgent } from './agents/deepAnalysis';
import { runMasterStrategist, MasterStrategistResult } from './agents/masterStrategist';
import { runGeniusAnalyst, GeniusAnalystResult } from './agents/geniusAnalyst';
import { runClaudeDataCollector, CollectedData } from './agents/claudeDataCollector';
import { fetchCompleteMatchData, fetchMatchDataByFixtureId, CompleteMatchData } from './sportmonks-data';
import { MatchData } from './types';

// ==================== TYPES ====================

export interface AgentResult {
  matchResult: string;
  matchResultReasoning: string;
  matchResultConfidence?: number;
  overUnder: string;
  overUnderReasoning?: string;
  overUnderConfidence?: number;
  btts: string;
  bttsReasoning?: string;
  bttsConfidence?: number;
  confidence: number;
  agentSummary?: string;
  [key: string]: any;
}

export type SentimentAgentResult = SentimentResult;

export interface ConsensusResult {
  matchResult: {
    prediction: string;
    confidence: number;
    votes: { [key: string]: string };
    reasoning: string;
    isConsensus: boolean;
  };
  overUnder: {
    prediction: string;
    confidence: number;
    votes: { [key: string]: string };
    reasoning: string;
    isConsensus: boolean;
  };
  btts: {
    prediction: string;
    confidence: number;
    votes: { [key: string]: string };
    reasoning: string;
    isConsensus: boolean;
  };
}

export interface OrchestratorResult {
  success: boolean;
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    fixtureId: number;
  };
  dataQuality: {
    homeFormMatches: number;
    awayFormMatches: number;
    h2hMatches: number;
    hasOdds: boolean;
    hasOddsHistory: boolean;
    score: number;
  };
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: SentimentAgentResult | null;
    deepAnalysis: any | null;
    masterStrategist?: MasterStrategistResult | null;
    geniusAnalyst?: GeniusAnalystResult | null;
  };
  consensus: ConsensusResult;
  finalPrediction: {
    matchResult: string;
    matchResultConfidence: number;
    overUnder: string;
    overUnderConfidence: number;
    btts: string;
    bttsConfidence: number;
    overallConfidence: number;
    recommendation: string;
  };
  sharpMoneyAlert?: {
    detected: boolean;
    direction: string;
    confidence: string;
    message: string;
  };
  valueBets: string[];
  warnings: string[];
  timestamp: string;
  reports?: {
    deepAnalysis: any;
    stats: any;
    odds: any;
    sentiment: any;
    strategy: any;
    weightedConsensus: any;
    masterStrategist?: MasterStrategistResult | null;
    geniusAnalyst?: GeniusAnalystResult | null;
  };
  timing?: {
    total: number;
    dataFetch: number;
    agents: number;
  };
  errors?: string[];
}

// ==================== VOTING SYSTEM ====================

function calculateVotes(
  results: { [agent: string]: AgentResult | null },
  field: 'matchResult' | 'overUnder' | 'btts'
): { winner: string; votes: { [key: string]: string }; count: { [key: string]: number }; confidence: number } {
  const votes: { [key: string]: string } = {};
  const count: { [key: string]: number } = {};
  const confidences: { [key: string]: number[] } = {};
  // Agent ağırlıkları (Stats: 30%, Odds: 35%, Deep: 20%, Sentiment: 15%)
  const agentWeights: { [key: string]: number } = {
    stats: 30,
    odds: 35,
    deepAnalysis: 20,
    sentiment: 15
  };
  
  for (const [agent, result] of Object.entries(results)) {
    if (!result) continue;
    
    let value: string;
    let conf: number;
    
    if (field === 'matchResult') {
      value = result.matchResult || result.matchWinnerValue || 'X';
      if (value.toLowerCase() === 'home') value = '1';
      else if (value.toLowerCase() === 'away') value = '2';
      else if (value.toLowerCase() === 'draw') value = 'X';
      value = value.toUpperCase();
      conf = result.matchResultConfidence || result.confidence || 50;
    } else if (field === 'overUnder') {
      value = result.overUnder || result.recommendation || 'Over';
      value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      conf = result.overUnderConfidence || result.confidence || 50;
    } else {
      value = result.btts || result.bttsValue || 'No';
      value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      conf = result.bttsConfidence || result.confidence || 50;
    }
    
    votes[agent] = value;
    count[value] = (count[value] || 0) + 1;
    
    if (!confidences[value]) confidences[value] = [];
    confidences[value].push(conf);
  }
  
  let winner = '';
  let maxVotes = 0;
  
  for (const [option, voteCount] of Object.entries(count)) {
    if (voteCount > maxVotes) {
      maxVotes = voteCount;
      winner = option;
    }
  }
  
  // Ağırlıklı ortalama confidence (agent weight'e göre)
  const winnerAgents: Array<{ agent: string; conf: number; weight: number }> = [];
  
  for (const [agent, result] of Object.entries(results)) {
    if (!result || votes[agent] !== winner) continue;
    
    let conf: number;
    if (field === 'matchResult') {
      conf = result.matchResultConfidence || result.confidence || 50;
    } else if (field === 'overUnder') {
      conf = result.overUnderConfidence || result.confidence || 50;
    } else {
      conf = result.bttsConfidence || result.confidence || 50;
    }
    
    const weight = agentWeights[agent] || 25;
    winnerAgents.push({ agent, conf, weight });
  }
  
  let weightedConfSum = 0;
  let totalWeight = 0;
  
  for (const { conf, weight } of winnerAgents) {
    weightedConfSum += conf * weight;
    totalWeight += weight;
  }
  
  const avgConfidence = totalWeight > 0 
    ? Math.round(weightedConfSum / totalWeight)
    : confidences[winner]?.length > 0
      ? Math.round(confidences[winner].reduce((a, b) => a + b, 0) / confidences[winner].length)
      : 50;
  
  return { winner, votes, count, confidence: avgConfidence };
}

function buildConsensus(agentResults: { [agent: string]: AgentResult | null }, language: 'tr' | 'en' | 'de'): ConsensusResult {
  const matchResultVotes = calculateVotes(agentResults, 'matchResult');
  const overUnderVotes = calculateVotes(agentResults, 'overUnder');
  const bttsVotes = calculateVotes(agentResults, 'btts');
  
  const totalAgents = Object.values(agentResults).filter(r => r !== null).length;
  
  const messages = {
    tr: {
      consensus: (count: number, total: number) => `${count}/${total} agent hemfikir`,
      noConsensus: 'Agent\'lar farklı görüşte',
      unanimous: 'Tüm agent\'lar hemfikir!',
    },
    en: {
      consensus: (count: number, total: number) => `${count}/${total} agents agree`,
      noConsensus: 'Agents disagree',
      unanimous: 'All agents agree!',
    },
    de: {
      consensus: (count: number, total: number) => `${count}/${total} Agenten stimmen überein`,
      noConsensus: 'Agenten sind unterschiedlicher Meinung',
      unanimous: 'Alle Agenten stimmen überein!',
    },
  };
  
  const msg = messages[language] || messages.en;
  
  const buildReasoning = (votes: typeof matchResultVotes) => {
    const maxCount = Math.max(...Object.values(votes.count));
    if (maxCount === totalAgents) return msg.unanimous;
    if (maxCount >= 2) return msg.consensus(maxCount, totalAgents);
    return msg.noConsensus;
  };
  
  return {
    matchResult: {
      prediction: matchResultVotes.winner || 'X',
      confidence: matchResultVotes.confidence,
      votes: matchResultVotes.votes,
      reasoning: buildReasoning(matchResultVotes),
      isConsensus: Math.max(...Object.values(matchResultVotes.count)) >= 2,
    },
    overUnder: {
      prediction: overUnderVotes.winner || 'Over',
      confidence: overUnderVotes.confidence,
      votes: overUnderVotes.votes,
      reasoning: buildReasoning(overUnderVotes),
      isConsensus: Math.max(...Object.values(overUnderVotes.count)) >= 2,
    },
    btts: {
      prediction: bttsVotes.winner || 'No',
      confidence: bttsVotes.confidence,
      votes: bttsVotes.votes,
      reasoning: buildReasoning(bttsVotes),
      isConsensus: Math.max(...Object.values(bttsVotes.count)) >= 2,
    },
  };
}

// ==================== DATA QUALITY ASSESSMENT ====================

function assessDataQuality(matchData: CompleteMatchData): {
  homeFormMatches: number;
  awayFormMatches: number;
  h2hMatches: number;
  hasOdds: boolean;
  hasOddsHistory: boolean;
  score: number;
} {
  const homeFormMatches = matchData.homeForm?.matchCount || 0;
  const awayFormMatches = matchData.awayForm?.matchCount || 0;
  const h2hMatches = matchData.h2h?.totalMatches || 0;
  const hasOdds = !!(matchData.odds?.matchWinner?.home && matchData.odds.matchWinner.home > 1);
  const hasOddsHistory = !!(matchData.oddsHistory?.homeWin?.opening);

  // 🆕 IMPROVED SCORING - More gradual, less permissive
  let score = 0;

  // Home form scoring (max 25): 10+ matches = full score
  if (homeFormMatches >= 10) score += 25;
  else if (homeFormMatches >= 7) score += 20;
  else if (homeFormMatches >= 5) score += 15;
  else if (homeFormMatches >= 3) score += 10;
  else score += homeFormMatches * 3; // 1-2 matches

  // Away form scoring (max 25): 10+ matches = full score
  if (awayFormMatches >= 10) score += 25;
  else if (awayFormMatches >= 7) score += 20;
  else if (awayFormMatches >= 5) score += 15;
  else if (awayFormMatches >= 3) score += 10;
  else score += awayFormMatches * 3; // 1-2 matches

  // H2H scoring (max 20): 5+ matches = full score
  if (h2hMatches >= 5) score += 20;
  else if (h2hMatches >= 3) score += 15;
  else score += h2hMatches * 5; // 1-2 matches

  // Odds data (max 30 total)
  score += hasOdds ? 15 : 0;
  score += hasOddsHistory ? 15 : 0;

  // 🆕 PENALTY for missing critical data
  const detailedStats = (matchData as any).detailedStats;
  const hasVenueStats = !!(matchData.homeForm as any)?.venueAvgScored || !!(matchData.awayForm as any)?.venueAvgScored;
  const hasInjuries = !!(matchData as any).injuries?.home || !!(matchData as any).injuries?.away;

  // Small bonus for having detailed stats
  if (detailedStats?.home && detailedStats?.away) score += 5;
  if (hasVenueStats) score += 3;
  if (hasInjuries) score += 2;

  return {
    homeFormMatches,
    awayFormMatches,
    h2hMatches,
    hasOdds,
    hasOddsHistory,
    score: Math.min(100, score),
  };
}

// ==================== FINAL PREDICTION ====================

function buildFinalPrediction(
  consensus: ConsensusResult,
  agentResults: { stats: AgentResult | null; odds: AgentResult | null; sentiment: SentimentAgentResult | null },
  dataQuality: { score: number },
  language: 'tr' | 'en' | 'de'
): OrchestratorResult['finalPrediction'] {
  
  let matchResultConf = consensus.matchResult.confidence;
  let overUnderConf = consensus.overUnder.confidence;
  let bttsConf = consensus.btts.confidence;
  
  if (consensus.matchResult.isConsensus) matchResultConf += 5;
  if (consensus.overUnder.isConsensus) overUnderConf += 5;
  if (consensus.btts.isConsensus) bttsConf += 5;
  
  if (agentResults.odds?.hasSharpConfirmation) {
    const sharpDir = agentResults.odds.sharpMoneyAnalysis?.direction;
    if (sharpDir === 'home' && consensus.matchResult.prediction === '1') matchResultConf += 8;
    if (sharpDir === 'away' && consensus.matchResult.prediction === '2') matchResultConf += 8;
    if (sharpDir === 'over' && consensus.overUnder.prediction === 'Over') overUnderConf += 8;
    if (sharpDir === 'under' && consensus.overUnder.prediction === 'Under') overUnderConf += 8;
  }
  
  if (agentResults.sentiment?.psychologicalEdge) {
    const edge = agentResults.sentiment.psychologicalEdge;
    if (edge.confidence >= 70) {
      if (edge.team === 'home' && consensus.matchResult.prediction === '1') matchResultConf += 5;
      if (edge.team === 'away' && consensus.matchResult.prediction === '2') matchResultConf += 5;
    }
  }
  
  const qualityMultiplier = 0.85 + (dataQuality.score / 100) * 0.15;
  matchResultConf = Math.round(matchResultConf * qualityMultiplier);
  overUnderConf = Math.round(overUnderConf * qualityMultiplier);
  bttsConf = Math.round(bttsConf * qualityMultiplier);
  
  matchResultConf = Math.min(90, Math.max(45, matchResultConf));
  overUnderConf = Math.min(90, Math.max(45, overUnderConf));
  bttsConf = Math.min(90, Math.max(45, bttsConf));
  
  const overallConfidence = Math.round((matchResultConf + overUnderConf + bttsConf) / 3);
  
  const recommendations = {
    tr: {
      high: '🔥 GÜÇLÜ TAHMİN - Yüksek güvenle oyna',
      medium: '✅ İYİ TAHMİN - Makul güvenle oyna',
      low: '⚠️ RİSKLİ - Dikkatli ol',
      veryLow: '❌ ZAYIF - Geçmeyi düşün',
    },
    en: {
      high: '🔥 STRONG PICK - Play with high confidence',
      medium: '✅ GOOD PICK - Play with reasonable confidence',
      low: '⚠️ RISKY - Be careful',
      veryLow: '❌ WEAK - Consider skipping',
    },
    de: {
      high: '🔥 STARKE WAHL - Mit hohem Vertrauen spielen',
      medium: '✅ GUTE WAHL - Mit vernünftigem Vertrauen spielen',
      low: '⚠️ RISKANT - Vorsichtig sein',
      veryLow: '❌ SCHWACH - Überspringen erwägen',
    },
  };
  
  const msg = recommendations[language] || recommendations.en;
  let recommendation: string;
  
  if (overallConfidence >= 75) recommendation = msg.high;
  else if (overallConfidence >= 65) recommendation = msg.medium;
  else if (overallConfidence >= 55) recommendation = msg.low;
  else recommendation = msg.veryLow;
  
  return {
    matchResult: consensus.matchResult.prediction,
    matchResultConfidence: matchResultConf,
    overUnder: consensus.overUnder.prediction,
    overUnderConfidence: overUnderConf,
    btts: consensus.btts.prediction,
    bttsConfidence: bttsConf,
    overallConfidence,
    recommendation,
  };
}

// ==================== COLLECT VALUE BETS ====================

function collectValueBets(agentResults: { stats: AgentResult | null; odds: AgentResult | null }): string[] {
  const valueBets: string[] = [];
  
  if (agentResults.odds?.valueBets) {
    valueBets.push(...agentResults.odds.valueBets);
  }
  
  if (agentResults.odds?.realValueChecks) {
    const checks = agentResults.odds.realValueChecks;
    
    if (checks.home?.isValue && checks.home.confidence === 'high') {
      if (!valueBets.some(v => v.includes('MS 1') || v.includes('Home'))) {
        valueBets.push(`🔥 MS 1 (REAL VALUE - Sharp money confirms)`);
      }
    }
    if (checks.over25?.isValue && checks.over25.confidence === 'high') {
      if (!valueBets.some(v => v.includes('Over 2.5'))) {
        valueBets.push(`🔥 Over 2.5 (REAL VALUE - Sharp money confirms)`);
      }
    }
    if (checks.btts?.isValue && checks.btts.confidence === 'high') {
      if (!valueBets.some(v => v.includes('BTTS') || v.includes('KG'))) {
        valueBets.push(`🔥 BTTS Yes (REAL VALUE - Sharp money confirms)`);
      }
    }
  }
  
  return valueBets;
}

// ==================== COLLECT WARNINGS ====================

function collectWarnings(
  agentResults: { stats: AgentResult | null; odds: AgentResult | null; sentiment: SentimentAgentResult | null },
  dataQuality: { score: number; homeFormMatches: number; awayFormMatches: number; h2hMatches: number },
  consensus: ConsensusResult,
  language: 'tr' | 'en' | 'de'
): string[] {
  const warnings: string[] = [];
  
  const messages = {
    tr: {
      lowData: '📊 Veri kalitesi düşük - tahminler daha az güvenilir',
      noConsensusMatch: '⚠️ Agent\'lar maç sonucunda hemfikir değil',
      noConsensusOU: '⚠️ Agent\'lar Over/Under\'da hemfikir değil',
      noConsensusBtts: '⚠️ Agent\'lar BTTS\'de hemfikir değil',
      oddsRising: '⚠️ Oranlar yükseliyor - bahisçi bir şey biliyor olabilir',
      noH2H: '📊 H2H verisi yok veya yetersiz',
    },
    en: {
      lowData: '📊 Low data quality - predictions less reliable',
      noConsensusMatch: '⚠️ Agents disagree on match result',
      noConsensusOU: '⚠️ Agents disagree on Over/Under',
      noConsensusBtts: '⚠️ Agents disagree on BTTS',
      oddsRising: '⚠️ Odds rising - bookies may know something',
      noH2H: '📊 No or insufficient H2H data',
    },
    de: {
      lowData: '📊 Geringe Datenqualität - Vorhersagen weniger zuverlässig',
      noConsensusMatch: '⚠️ Agenten uneinig beim Spielergebnis',
      noConsensusOU: '⚠️ Agenten uneinig bei Over/Under',
      noConsensusBtts: '⚠️ Agenten uneinig bei BTTS',
      oddsRising: '⚠️ Quoten steigen - Buchmacher wissen vielleicht etwas',
      noH2H: '📊 Keine oder unzureichende H2H-Daten',
    },
  };
  
  const msg = messages[language] || messages.en;
  
  if (dataQuality.score < 50) warnings.push(msg.lowData);
  if (dataQuality.h2hMatches === 0) warnings.push(msg.noH2H);
  
  if (!consensus.matchResult.isConsensus) warnings.push(msg.noConsensusMatch);
  if (!consensus.overUnder.isConsensus) warnings.push(msg.noConsensusOU);
  if (!consensus.btts.isConsensus) warnings.push(msg.noConsensusBtts);
  
  if (agentResults.odds?.realValueChecks) {
    const checks = agentResults.odds.realValueChecks;
    if (
      (checks.home?.reason?.en?.includes('rising')) ||
      (checks.over25?.reason?.en?.includes('rising')) ||
      (checks.btts?.reason?.en?.includes('rising'))
    ) {
      warnings.push(msg.oddsRising);
    }
  }
  
  if (agentResults.sentiment?.criticalWarnings && agentResults.sentiment.criticalWarnings.length > 0) {
    warnings.push(...agentResults.sentiment.criticalWarnings);
  }
  
  return warnings;
}

// ==================== BUILD REPORTS FOR UI ====================

function buildReports(
  matchData: CompleteMatchData,
  statsResult: AgentResult | null,
  oddsResult: AgentResult | null,
  sentimentResult: SentimentAgentResult | null,
  deepAnalysisResult: any | null,
  consensus: ConsensusResult,
  finalPrediction: OrchestratorResult['finalPrediction'],
  valueBets: string[],
  warnings: string[],
  dataQuality: { score: number; hasOdds: boolean; hasOddsHistory: boolean; homeFormMatches: number; awayFormMatches: number; h2hMatches: number },
  sharpMoneyAlert: OrchestratorResult['sharpMoneyAlert'],
  masterStrategistResult?: MasterStrategistResult | null,
  geniusAnalystResult?: GeniusAnalystResult | null
): OrchestratorResult['reports'] {
  // Deep Analysis Agent'tan gelen veriyi kullan, yoksa fallback
  const deepAnalysis = deepAnalysisResult ? {
    matchAnalysis: deepAnalysisResult.matchAnalysis || `${matchData.homeTeam} vs ${matchData.awayTeam} maçının detaylı analizi.`,
    criticalFactors: deepAnalysisResult.criticalFactors || [
      `Ev sahibi son 5 maç: ${matchData.homeForm?.record || 'N/A'}`,
      `Deplasman son 5 maç: ${matchData.awayForm?.record || 'N/A'}`,
      `H2H: ${matchData.h2h?.totalMatches || 0} maç oynandı`,
    ],
    probabilities: deepAnalysisResult.probabilities || {
      homeWin: Math.round(consensus.matchResult.prediction === '1' ? consensus.matchResult.confidence : 33),
      draw: Math.round(consensus.matchResult.prediction === 'X' ? consensus.matchResult.confidence : 25),
      awayWin: Math.round(consensus.matchResult.prediction === '2' ? consensus.matchResult.confidence : 33),
    },
    scorePrediction: deepAnalysisResult.scorePrediction || {
      score: consensus.matchResult.prediction === '1' ? '2-1' : 
             consensus.matchResult.prediction === '2' ? '1-2' : '1-1',
      reasoning: finalPrediction.recommendation,
    },
    overUnder: deepAnalysisResult.overUnder || {
      prediction: consensus.overUnder.prediction,
      confidence: consensus.overUnder.confidence,
      reasoning: statsResult?.overUnderReasoning || 'İstatistiksel analiz bazlı tahmin',
    },
    btts: deepAnalysisResult.btts || {
      prediction: consensus.btts.prediction,
      confidence: consensus.btts.confidence,
      reasoning: statsResult?.bttsReasoning || 'Form analizi bazlı tahmin',
    },
    matchResult: deepAnalysisResult.matchResult || {
      prediction: consensus.matchResult.prediction,
      confidence: consensus.matchResult.confidence,
      reasoning: statsResult?.matchResultReasoning || 'Konsensüs bazlı tahmin',
    },
    bestBet: deepAnalysisResult.bestBet || {
      type: valueBets.length > 0 ? 'Value Bet' : 'Over/Under',
      selection: valueBets.length > 0 ? valueBets[0] : consensus.overUnder.prediction,
      confidence: finalPrediction.overallConfidence,
      reasoning: finalPrediction.recommendation,
    },
    riskLevel: deepAnalysisResult.riskLevel || (finalPrediction.overallConfidence >= 70 ? 'Low' : 
               finalPrediction.overallConfidence >= 55 ? 'Medium' : 'High'),
    expectedScores: deepAnalysisResult.expectedScores || ['1-1', '2-1', '1-0', '2-0'],
    // Yeni alanlar - Deep Analysis Agent'tan
    refereeAnalysis: deepAnalysisResult.refereeAnalysis || null,
    weatherImpact: deepAnalysisResult.weatherImpact || null,
    pitchConditions: deepAnalysisResult.pitchConditions || null,
    lineupImpact: deepAnalysisResult.lineupImpact || null,
  } : {
    matchAnalysis: `${matchData.homeTeam} vs ${matchData.awayTeam} maçının detaylı analizi. Ev sahibi form: ${matchData.homeForm?.form || 'N/A'}, Deplasman form: ${matchData.awayForm?.form || 'N/A'}`,
    criticalFactors: [
      `Ev sahibi son 5 maç: ${matchData.homeForm?.record || 'N/A'}`,
      `Deplasman son 5 maç: ${matchData.awayForm?.record || 'N/A'}`,
      `H2H: ${matchData.h2h?.totalMatches || 0} maç oynandı`,
      dataQuality.hasOdds ? `Oranlar mevcut` : `Oran verisi eksik`,
      sentimentResult?.psychologicalEdge ? `Psikolojik avantaj: ${sentimentResult.psychologicalEdge.team === 'home' ? matchData.homeTeam : sentimentResult.psychologicalEdge.team === 'away' ? matchData.awayTeam : 'Nötr'}` : '',
    ].filter(Boolean),
    probabilities: {
      homeWin: Math.round(consensus.matchResult.prediction === '1' ? consensus.matchResult.confidence : 
               consensus.matchResult.prediction === '2' ? 100 - consensus.matchResult.confidence - 25 : 33),
      draw: Math.round(consensus.matchResult.prediction === 'X' ? consensus.matchResult.confidence : 25),
      awayWin: Math.round(consensus.matchResult.prediction === '2' ? consensus.matchResult.confidence : 
               consensus.matchResult.prediction === '1' ? 100 - consensus.matchResult.confidence - 25 : 33),
    },
    scorePrediction: {
      score: consensus.matchResult.prediction === '1' ? '2-1' : 
             consensus.matchResult.prediction === '2' ? '1-2' : '1-1',
      reasoning: finalPrediction.recommendation,
    },
    overUnder: {
      prediction: consensus.overUnder.prediction,
      confidence: consensus.overUnder.confidence,
      reasoning: statsResult?.overUnderReasoning || 'İstatistiksel analiz bazlı tahmin',
    },
    btts: {
      prediction: consensus.btts.prediction,
      confidence: consensus.btts.confidence,
      reasoning: statsResult?.bttsReasoning || 'Form analizi bazlı tahmin',
    },
    matchResult: {
      prediction: consensus.matchResult.prediction,
      confidence: consensus.matchResult.confidence,
      reasoning: statsResult?.matchResultReasoning || 'Konsensüs bazlı tahmin',
    },
    bestBet: {
      type: valueBets.length > 0 ? 'Value Bet' : 'Over/Under',
      selection: valueBets.length > 0 ? valueBets[0] : consensus.overUnder.prediction,
      confidence: finalPrediction.overallConfidence,
      reasoning: finalPrediction.recommendation,
    },
    riskLevel: finalPrediction.overallConfidence >= 70 ? 'Low' : 
               finalPrediction.overallConfidence >= 55 ? 'Medium' : 'High',
    expectedScores: ['1-1', '2-1', '1-0', '2-0'],
    refereeAnalysis: null,
    weatherImpact: null,
    pitchConditions: null,
    lineupImpact: null,
  };

  return {
    deepAnalysis,
    stats: statsResult,
    odds: oddsResult,
    sentiment: sentimentResult ? {
      homeTeam: {
        name: matchData.homeTeam,
        morale: sentimentResult.homeTeam.morale,
        motivation: sentimentResult.homeTeam.motivation,
        preparation: sentimentResult.homeTeam.preparation,
        confidence: sentimentResult.homeTeam.confidence,
        teamChemistry: sentimentResult.homeTeam.teamChemistry,
        positives: sentimentResult.homeTeam.positives,
        negatives: sentimentResult.homeTeam.negatives,
        injuries: sentimentResult.homeTeam.injuries,
        outlook: sentimentResult.homeTeam.outlook,
        outlookReasoning: sentimentResult.homeTeam.outlookReasoning,
        matchMotivation: sentimentResult.homeTeam.matchMotivation,
        mediaSentiment: sentimentResult.homeTeam.mediaSentiment,
        managerSituation: sentimentResult.homeTeam.managerSituation,
        fanFactor: sentimentResult.homeTeam.fanFactor,
      },
      awayTeam: {
        name: matchData.awayTeam,
        morale: sentimentResult.awayTeam.morale,
        motivation: sentimentResult.awayTeam.motivation,
        preparation: sentimentResult.awayTeam.preparation,
        confidence: sentimentResult.awayTeam.confidence,
        teamChemistry: sentimentResult.awayTeam.teamChemistry,
        positives: sentimentResult.awayTeam.positives,
        negatives: sentimentResult.awayTeam.negatives,
        injuries: sentimentResult.awayTeam.injuries,
        outlook: sentimentResult.awayTeam.outlook,
        outlookReasoning: sentimentResult.awayTeam.outlookReasoning,
        matchMotivation: sentimentResult.awayTeam.matchMotivation,
        mediaSentiment: sentimentResult.awayTeam.mediaSentiment,
        managerSituation: sentimentResult.awayTeam.managerSituation,
        fanFactor: sentimentResult.awayTeam.fanFactor,
      },
      matchContext: sentimentResult.matchContext,
      headToHeadPsychology: sentimentResult.headToHeadPsychology,
      psychologicalEdge: sentimentResult.psychologicalEdge,
      predictions: sentimentResult.predictions,
      criticalWarnings: sentimentResult.criticalWarnings,
      keyInsights: sentimentResult.keyInsights,
      summary: sentimentResult.agentSummary,
      dataQuality: sentimentResult.dataQuality,
    } : null,
    strategy: {
      riskAssessment: finalPrediction.overallConfidence >= 70 ? 'Düşük' : 
                      finalPrediction.overallConfidence >= 55 ? 'Orta' : 'Yüksek',
      riskReasoning: warnings.length > 0 ? warnings.join('. ') : 'Veriler tutarlı görünüyor.',
      _consensus: {
        overUnderConsensus: {
          prediction: consensus.overUnder.prediction,
          confidence: consensus.overUnder.confidence,
          agree: consensus.overUnder.isConsensus ? 2 : 1,
        },
        matchResultConsensus: {
          prediction: consensus.matchResult.prediction,
          confidence: consensus.matchResult.confidence,
          agree: consensus.matchResult.isConsensus ? 2 : 1,
        },
        bttsConsensus: {
          prediction: consensus.btts.prediction,
          confidence: consensus.btts.confidence,
          agree: consensus.btts.isConsensus ? 2 : 1,
        },
      },
      recommendedBets: [
        {
          type: 'Over/Under',
          selection: consensus.overUnder.prediction,
          confidence: finalPrediction.overUnderConfidence,
          reasoning: statsResult?.overUnderReasoning || 'Konsensüs önerisi',
          agentAgreement: consensus.overUnder.isConsensus ? '2/2 agent' : '1/2 agent',
        },
        {
          type: 'Maç Sonucu',
          selection: consensus.matchResult.prediction,
          confidence: finalPrediction.matchResultConfidence,
          reasoning: statsResult?.matchResultReasoning || 'Konsensüs önerisi',
          agentAgreement: consensus.matchResult.isConsensus ? '2/2 agent' : '1/2 agent',
        },
      ],
      avoidBets: warnings.length > 2 ? ['Riskli maç - dikkatli olun'] : [],
      stakeSuggestion: finalPrediction.overallConfidence >= 70 ? 'Yüksek' : 
                       finalPrediction.overallConfidence >= 55 ? 'Orta' : 'Düşük',
      valueBets,
      recommendation: finalPrediction.recommendation,
      confidence: finalPrediction.overallConfidence,
      sharpMoney: sharpMoneyAlert,
    },
    weightedConsensus: {
      matchResult: {
        prediction: consensus.matchResult.prediction,
        confidence: consensus.matchResult.confidence,
        agreement: consensus.matchResult.isConsensus ? 2 : 1,
      },
      overUnder: {
        prediction: consensus.overUnder.prediction,
        confidence: consensus.overUnder.confidence,
        agreement: consensus.overUnder.isConsensus ? 2 : 1,
      },
      btts: {
        prediction: consensus.btts.prediction,
        confidence: consensus.btts.confidence,
        agreement: consensus.btts.isConsensus ? 2 : 1,
      },
      scorePrediction: {
        score: consensus.matchResult.prediction === '1' ? '2-1' : 
               consensus.matchResult.prediction === '2' ? '1-2' : '1-1',
        reasoning: 'Konsensüs bazlı skor tahmini',
      },
      bestBet: {
        type: 'Over/Under',
        selection: consensus.overUnder.prediction,
        confidence: finalPrediction.overUnderConfidence,
        agreement: `${consensus.overUnder.isConsensus ? 2 : 1}/2`,
      },
      finalPrediction,
      isConsensus: consensus.matchResult.isConsensus && consensus.overUnder.isConsensus,
    },
    // 🆕 Yeni agent'ların sonuçları
    masterStrategist: masterStrategistResult || null,
    geniusAnalyst: geniusAnalystResult || null,
  };
}

// ==================== MAIN ORCHESTRATOR ====================

export async function runOrchestrator(
  input: {
    fixtureId?: number;
    homeTeamId?: number;
    awayTeamId?: number;
    homeTeamName?: string;
    awayTeamName?: string;
    league?: string;
    leagueId?: number;
    matchData?: any;
  },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<OrchestratorResult> {
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 ORCHESTRATOR STARTING');
  console.log('═'.repeat(60));
  
  const startTime = Date.now();
  let dataFetchTime = 0;
  let agentsTime = 0;
  
  try {
    // 1. Veri toplama - matchData varsa TEKRAR FETCH YAPMA!
    const dataFetchStart = Date.now();
    let matchData: CompleteMatchData;
    
    if (input.matchData) {
      // ✅ FIX: matchData zaten sağlanmış - direkt kullan, FETCH YAPMA!
      matchData = input.matchData as CompleteMatchData;
      console.log('📊 Using PROVIDED match data (no fetch needed)');
      
      // Data quality log
      const homeMatches = matchData.homeForm?.matchCount || 0;
      const awayMatches = matchData.awayForm?.matchCount || 0;
      const h2hMatches = matchData.h2h?.totalMatches || 0;
      console.log(`   📊 Home form matches: ${homeMatches}`);
      console.log(`   📊 Away form matches: ${awayMatches}`);
      console.log(`   📊 H2H matches: ${h2hMatches}`);
      console.log(`   📊 Home venue form: ${matchData.homeForm?.venueForm || 'N/A'}`);
      console.log(`   📊 Away venue form: ${matchData.awayForm?.venueForm || 'N/A'}`);
      
      if (homeMatches === 0 && awayMatches === 0) {
        console.warn('   ⚠️ WARNING: No match data in provided matchData!');
      }
      
    } else if (input.fixtureId && input.homeTeamId && input.awayTeamId) {
      console.log('📊 Fetching complete match data...');
      matchData = await fetchCompleteMatchData(
        input.fixtureId,
        input.homeTeamId,
        input.awayTeamId,
        input.homeTeamName || 'Home',
        input.awayTeamName || 'Away',
        input.league || 'Unknown',
        input.leagueId
      );
    } else if (input.fixtureId) {
      console.log('📊 Fetching match data by fixture ID...');
      const data = await fetchMatchDataByFixtureId(input.fixtureId);
      if (!data) {
        throw new Error('Failed to fetch match data');
      }
      matchData = data;
    } else {
      throw new Error('Insufficient input: need fixtureId or matchData');
    }
    dataFetchTime = Date.now() - dataFetchStart;
    
    // 2. Data quality assessment
    const dataQuality = assessDataQuality(matchData);
    console.log(`📊 Data Quality Score: ${dataQuality.score}/100`);
    
    // 2.5. 🆕 CLAUDE DATA COLLECTOR: Tüm agent'lardan önce en üst düzey verileri topla
    console.log('\n🔍 Claude Data Collector: Collecting premium data from Sportmonks...');
    const collectorStart = Date.now();
    let collectedData: CollectedData | null = null;
    
    try {
      collectedData = await runClaudeDataCollector(matchData as unknown as MatchData, language);
      const collectorTime = Date.now() - collectorStart;
      
      if (collectedData) {
        console.log(`✅ Claude Data Collector completed in ${collectorTime}ms`);
        console.log(`   📊 Data Quality: ${collectedData.dataQuality}/100`);
        console.log(`   📝 Summary: ${collectedData.summary?.substring(0, 150)}...`);
        
        // Toplanan verileri matchData'ya merge et
        if (collectedData.homeTeamStats) {
          // Home team stats'ı matchData'ya ekle
          if (!matchData.detailedStats) matchData.detailedStats = { home: undefined, away: undefined };
          if (!matchData.detailedStats.home) matchData.detailedStats.home = {} as any;
          
          // Venue-spesifik verileri ekle
          Object.assign(matchData.detailedStats.home, {
            homeAvgGoalsScored: collectedData.homeTeamStats.homeAvgGoalsScored,
            homeAvgGoalsConceded: collectedData.homeTeamStats.homeAvgGoalsConceded,
            avgGoalsScored: collectedData.homeTeamStats.avgGoalsScored,
            avgGoalsConceded: collectedData.homeTeamStats.avgGoalsConceded,
            recentForm: collectedData.homeTeamStats.recentForm,
            formPoints: collectedData.homeTeamStats.formPoints,
          });
        }
        
        if (collectedData.awayTeamStats) {
          // Away team stats'ı matchData'ya ekle
          if (!matchData.detailedStats) matchData.detailedStats = { home: undefined, away: undefined };
          if (!matchData.detailedStats.away) matchData.detailedStats.away = {} as any;
          
          // Venue-spesifik verileri ekle
          Object.assign(matchData.detailedStats.away, {
            awayAvgGoalsScored: collectedData.awayTeamStats.awayAvgGoalsScored,
            awayAvgGoalsConceded: collectedData.awayTeamStats.awayAvgGoalsConceded,
            avgGoalsScored: collectedData.awayTeamStats.avgGoalsScored,
            avgGoalsConceded: collectedData.awayTeamStats.avgGoalsConceded,
            recentForm: collectedData.awayTeamStats.recentForm,
            formPoints: collectedData.awayTeamStats.formPoints,
          });
        }
        
        if (collectedData.h2hData) {
          // H2H verilerini matchData'ya ekle
          matchData.h2h = {
            ...matchData.h2h,
            ...collectedData.h2hData,
          } as any;
        }
        
        if (collectedData.fixtureData) {
          // Fixture verilerini matchData'ya ekle
          if (collectedData.fixtureData.homeTeam) {
            matchData.homeTeam = collectedData.fixtureData.homeTeam.name || matchData.homeTeam;
          }
          if (collectedData.fixtureData.awayTeam) {
            matchData.awayTeam = collectedData.fixtureData.awayTeam.name || matchData.awayTeam;
          }
        }
        
        console.log(`   ✅ Collected data merged into matchData`);
      } else {
        console.warn(`   ⚠️ Claude Data Collector returned null, continuing with existing data`);
      }
    } catch (error: any) {
      console.error(`   ❌ Claude Data Collector error: ${error.message}`);
      console.warn(`   ⚠️ Continuing with existing data`);
    }
    
    // 3. Agent'ları paralel çalıştır (İlk tur: Stats, Odds, Sentiment, Deep Analysis, Genius Analyst)
    console.log('\n🤖 Running agents in parallel (Round 1)...');
    const agentsStart = Date.now();
    
    // Her agent'ı ayrı ayrı izleyelim
    console.log('   🔵 Starting Stats Agent...');
    console.log('   🟢 Starting Odds Agent...');
    console.log('   🟡 Starting Sentiment Agent...');
    console.log('   🟣 Starting Deep Analysis Agent...');
    console.log('   ⏸️ Genius Analyst: DISABLED (performance optimization)');
    
    // ⚡ PERFORMANCE: Genius Analyst geçici olarak devre dışı (timeout sorunları)
    // TODO: Genius Analyst'ı ayrı bir endpoint'te çalıştır
    const [statsResult, oddsResult, sentimentResult, deepAnalysisResult] = await Promise.all([
      runStatsAgent(matchData as unknown as MatchData, language).catch(err => {
        console.error('❌ Stats agent failed:', err?.message || err);
        return null;
      }),
      runOddsAgent(matchData as unknown as MatchData, language).catch(err => {
        console.error('❌ Odds agent failed:', err?.message || err);
        return null;
      }),
      runSentimentAgent(matchData as unknown as MatchData, language).catch(err => {
        console.error('❌ Sentiment agent failed:', err?.message || err);
        return null;
      }),
      runDeepAnalysisAgent(matchData as unknown as MatchData, language).catch(err => {
        console.error('❌ Deep Analysis agent failed:', err?.message || err);
        return null;
      }),
    ]);
    
    // Genius Analyst şimdilik null (performans optimizasyonu)
    const geniusAnalystResult: GeniusAnalystResult | null = null;
    
    // Hangi agent'lar başarılı/başarısız oldu?
    console.log(`   📊 Stats: ${statsResult ? '✅' : '❌'}`);
    console.log(`   💰 Odds: ${oddsResult ? '✅' : '❌'}`);
    console.log(`   💬 Sentiment: ${sentimentResult ? '✅' : '❌'}`);
    console.log(`   🔬 Deep Analysis: ${deepAnalysisResult ? '✅' : '❌'}`);
    console.log(`   🧠 Genius Analyst: ${geniusAnalystResult ? '✅' : '❌'}`);
    agentsTime = Date.now() - agentsStart;
    
    const agentResults = {
      stats: statsResult,
      odds: oddsResult,
      sentiment: sentimentResult,
      deepAnalysis: deepAnalysisResult,
      geniusAnalyst: geniusAnalystResult,
      masterStrategist: null as MasterStrategistResult | null, // Başlangıçta null, sonra güncellenecek
    };
    
    // 🆕 4. Master Strategist çalıştır (diğer agent'ların çıktılarını analiz eder)
    console.log('\n🧠 Running Master Strategist Agent...');
    const masterStart = Date.now();
    let masterStrategistResult: MasterStrategistResult | null = null;
    
    try {
      masterStrategistResult = await runMasterStrategist(
        matchData as unknown as MatchData,
        {
          stats: statsResult,
          odds: oddsResult,
          sentiment: sentimentResult,
          deepAnalysis: deepAnalysisResult,
          geniusAnalyst: geniusAnalystResult,
        },
        language
      );
      console.log(`   ✅ Master Strategist completed in ${Date.now() - masterStart}ms`);
      console.log(`   🎯 Overall Confidence: ${masterStrategistResult.overallConfidence}%`);
    } catch (err) {
      console.error('Master Strategist failed:', err);
    }
    
    agentResults.masterStrategist = masterStrategistResult;
    
    console.log('\n📊 Agent Results:');
    if (statsResult) console.log(`   Stats: ${statsResult.matchResult} | ${statsResult.overUnder} | BTTS: ${statsResult.btts}`);
    if (oddsResult) console.log(`   Odds:  ${oddsResult.matchWinnerValue || oddsResult.matchResult} | ${oddsResult.recommendation || oddsResult.overUnder} | BTTS: ${oddsResult.bttsValue || oddsResult.btts}`);
    if (sentimentResult) console.log(`   Sentiment: Edge=${sentimentResult.psychologicalEdge?.team} | Conf=${sentimentResult.psychologicalEdge?.confidence}%`);
    if (deepAnalysisResult) console.log(`   DeepAnalysis: ${deepAnalysisResult.matchResult?.prediction || 'N/A'} | Risk: ${deepAnalysisResult.riskLevel || 'N/A'}`);
    // Genius Analyst geçici olarak devre dışı - performans optimizasyonu
    // if (geniusAnalystResult) console.log(`   🧠 Genius Analyst: ${geniusAnalystResult.predictions.matchResult.prediction} | Conf: ${geniusAnalystResult.finalRecommendation.overallConfidence}%`);
    if (masterStrategistResult) {
      const prediction = masterStrategistResult.final?.primary_pick?.selection || 
                         masterStrategistResult.finalConsensus?.matchResult?.prediction || 
                         'N/A';
      const confidence = masterStrategistResult.confidence || 
                         masterStrategistResult.overallConfidence || 
                         0;
      console.log(`   🎯 Master Strategist: ${prediction} | Conf: ${confidence}%`);
    }
    
    // 5. Consensus oluştur - Master Strategist varsa onu kullan, yoksa klasik yöntem
    console.log('\n🗳️ Building consensus...');
    let consensus: ConsensusResult;
    
    if (masterStrategistResult) {
      // Yeni format varsa onu kullan, yoksa eski format (backward compatibility)
      const matchResult = masterStrategistResult.final?.primary_pick?.selection || 
                           masterStrategistResult.finalConsensus?.matchResult?.prediction || 
                           'X';
      const matchConfidence = masterStrategistResult.final?.primary_pick?.confidence || 
                              masterStrategistResult.finalConsensus?.matchResult?.confidence || 
                              masterStrategistResult.confidence || 
                              0;
      const matchReasoning = masterStrategistResult.final?.primary_pick?.rationale?.join(' ') || 
                             masterStrategistResult.finalConsensus?.matchResult?.reasoning || 
                             'Master Strategist consensus';
      
      const overUnder = masterStrategistResult.finalConsensus?.overUnder?.prediction || 'Over';
      const overUnderConfidence = masterStrategistResult.finalConsensus?.overUnder?.confidence || 0;
      const overUnderReasoning = masterStrategistResult.finalConsensus?.overUnder?.reasoning || '';
      
      const btts = masterStrategistResult.finalConsensus?.btts?.prediction || 'No';
      const bttsConfidence = masterStrategistResult.finalConsensus?.btts?.confidence || 0;
      const bttsReasoning = masterStrategistResult.finalConsensus?.btts?.reasoning || '';
      
      consensus = {
        matchResult: {
          prediction: matchResult,
          confidence: matchConfidence,
          votes: {},
          reasoning: matchReasoning,
          isConsensus: true
        },
        overUnder: {
          prediction: overUnder,
          confidence: overUnderConfidence,
          votes: {},
          reasoning: overUnderReasoning,
          isConsensus: true
        },
        btts: {
          prediction: btts,
          confidence: bttsConfidence,
          votes: {},
          reasoning: bttsReasoning,
          isConsensus: true
        }
      };
      console.log('   ✅ Using Master Strategist consensus');
    } else {
      // Fallback: Klasik consensus yöntemi
      consensus = buildConsensus({ stats: statsResult, odds: oddsResult }, language);
      console.log('   ⚠️ Using fallback consensus (no Master Strategist)');
    }
    
    console.log(`   Match Result: ${consensus.matchResult.prediction} (${consensus.matchResult.isConsensus ? '✅ Consensus' : '⚠️ No consensus'})`);
    console.log(`   Over/Under: ${consensus.overUnder.prediction} (${consensus.overUnder.isConsensus ? '✅ Consensus' : '⚠️ No consensus'})`);
    console.log(`   BTTS: ${consensus.btts.prediction} (${consensus.btts.isConsensus ? '✅ Consensus' : '⚠️ No consensus'})`);
    
    // 6. Final prediction
    const finalPrediction = buildFinalPrediction(consensus, agentResults, dataQuality, language);
    
    // 7. Value bets
    const valueBets = collectValueBets(agentResults);
    
    // 8. Warnings
    const warnings = collectWarnings(agentResults, dataQuality, consensus, language);
    
    // 9. Sharp money alert
    let sharpMoneyAlert: OrchestratorResult['sharpMoneyAlert'] = undefined;
    if (oddsResult?.sharpMoneyAnalysis?.confidence === 'high') {
      sharpMoneyAlert = {
        detected: true,
        direction: oddsResult.sharpMoneyAnalysis.direction,
        confidence: oddsResult.sharpMoneyAnalysis.confidence,
        message: oddsResult.sharpMoneyAnalysis.reasoning?.[language] || oddsResult.sharpMoneyAnalysis.reasoning?.en || '',
      };
    }
    
    // 10. Build reports for UI
    const reports = buildReports(
      matchData,
      statsResult,
      oddsResult,
      sentimentResult,
      deepAnalysisResult,
      consensus,
      finalPrediction,
      valueBets,
      warnings,
      dataQuality,
      sharpMoneyAlert,
      masterStrategistResult,
      geniusAnalystResult
    );
    
    const elapsed = Date.now() - startTime;
    console.log('\n' + '═'.repeat(60));
    console.log(`✅ ORCHESTRATOR COMPLETE (${elapsed}ms)`);
    console.log(`   Final: ${finalPrediction.matchResult} | ${finalPrediction.overUnder} | BTTS: ${finalPrediction.btts}`);
    console.log(`   Confidence: ${finalPrediction.overallConfidence}%`);
    console.log(`   ${finalPrediction.recommendation}`);
    console.log('═'.repeat(60) + '\n');
    
    return {
      success: true,
      matchInfo: {
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        fixtureId: matchData.fixtureId,
      },
      dataQuality,
      agentResults,
      consensus,
      finalPrediction,
      sharpMoneyAlert,
      valueBets,
      warnings,
      timestamp: new Date().toISOString(),
      reports,
      timing: {
        total: elapsed,
        dataFetch: dataFetchTime,
        agents: agentsTime,
      },
      errors: [],
    };
    
  } catch (error) {
    console.error('❌ Orchestrator error:', error);
    const elapsed = Date.now() - startTime;
    
    return {
      success: false,
      matchInfo: {
        homeTeam: input.homeTeamName || 'Unknown',
        awayTeam: input.awayTeamName || 'Unknown',
        league: input.league || 'Unknown',
        fixtureId: input.fixtureId || 0,
      },
      dataQuality: {
        homeFormMatches: 0,
        awayFormMatches: 0,
        h2hMatches: 0,
        hasOdds: false,
        hasOddsHistory: false,
        score: 0,
      },
      agentResults: { stats: null, odds: null, sentiment: null, deepAnalysis: null, masterStrategist: null, geniusAnalyst: null },
      consensus: {
        matchResult: { prediction: 'X', confidence: 50, votes: {}, reasoning: 'Error', isConsensus: false },
        overUnder: { prediction: 'Over', confidence: 50, votes: {}, reasoning: 'Error', isConsensus: false },
        btts: { prediction: 'No', confidence: 50, votes: {}, reasoning: 'Error', isConsensus: false },
      },
      finalPrediction: {
        matchResult: 'X',
        matchResultConfidence: 50,
        overUnder: 'Over',
        overUnderConfidence: 50,
        btts: 'No',
        bttsConfidence: 50,
        overallConfidence: 50,
        recommendation: '❌ Error occurred - skip this match',
      },
      valueBets: [],
      warnings: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      timestamp: new Date().toISOString(),
      reports: {
        deepAnalysis: null,
        stats: null,
        odds: null,
        sentiment: null,
        strategy: null,
        weightedConsensus: null,
      },
      timing: {
        total: elapsed,
        dataFetch: dataFetchTime,
        agents: agentsTime,
      },
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ==================== BATCH ORCHESTRATOR ====================

export async function runBatchOrchestrator(
  fixtures: Array<{
    fixtureId: number;
    homeTeamId?: number;
    awayTeamId?: number;
    homeTeamName?: string;
    awayTeamName?: string;
    league?: string;
    leagueId?: number;
  }>,
  language: 'tr' | 'en' | 'de' = 'en',
  options?: {
    maxConcurrent?: number;
    delayBetween?: number;
  }
): Promise<OrchestratorResult[]> {
  console.log(`\n🎯 BATCH ORCHESTRATOR: Processing ${fixtures.length} matches`);
  
  const results: OrchestratorResult[] = [];
  const maxConcurrent = options?.maxConcurrent || 3;
  const delayBetween = options?.delayBetween || 1000;
  
  for (let i = 0; i < fixtures.length; i += maxConcurrent) {
    const batch = fixtures.slice(i, i + maxConcurrent);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(fixtures.length / maxConcurrent)}`);
    
    const batchResults = await Promise.all(
      batch.map(fixture => runOrchestrator(fixture, language))
    );
    
    results.push(...batchResults);
    
    if (i + maxConcurrent < fixtures.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const highConfidence = results.filter(r => r.finalPrediction.overallConfidence >= 70).length;
  
  console.log(`\n📊 BATCH COMPLETE: ${successful}/${fixtures.length} successful, ${highConfidence} high confidence picks`);
  
  return results;
}

// ==================== BACKWARD COMPATIBILITY ====================

export const runFullAnalysis = runOrchestrator;

// ==================== EXPORT ====================

export type { CompleteMatchData };
