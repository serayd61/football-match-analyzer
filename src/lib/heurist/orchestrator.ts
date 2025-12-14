// src/lib/heurist/orchestrator.ts
// Multi-Agent Football Analysis Orchestrator

import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
import { runSentimentAgent } from './agents/sentimentAgent';
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

export interface SentimentAgentResult {
  homeTeam: {
    morale: number;
    motivation: number;
    preparation: number;
    injuries_impact: number;
    news_sentiment: 'positive' | 'neutral' | 'negative';
    key_factors: string[];
    recent_news: string[];
  };
  awayTeam: {
    morale: number;
    motivation: number;
    preparation: number;
    injuries_impact: number;
    news_sentiment: 'positive' | 'neutral' | 'negative';
    key_factors: string[];
    recent_news: string[];
  };
  matchImportance: {
    homeTeam: number;
    awayTeam: number;
    reasoning: string;
  };
  psychologicalEdge: {
    team: string;
    confidence: number;
    reasoning: string;
  };
  warnings: string[];
  agentSummary: string;
}

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
  
  const avgConfidence = confidences[winner]
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
  
  let score = 0;
  score += Math.min(25, homeFormMatches * 5);
  score += Math.min(25, awayFormMatches * 5);
  score += Math.min(20, h2hMatches * 4);
  score += hasOdds ? 15 : 0;
  score += hasOddsHistory ? 15 : 0;
  
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
  
  // Sentiment bonus
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
  
  // Sentiment warnings
  if (agentResults.sentiment?.warnings) {
    warnings.push(...agentResults.sentiment.warnings);
  }
  
  return warnings;
}

// ==================== BUILD REPORTS FOR UI ====================

function buildReports(
  matchData: CompleteMatchData,
  statsResult: AgentResult | null,
  oddsResult: AgentResult | null,
  sentimentResult: SentimentAgentResult | null,
  consensus: ConsensusResult,
  finalPrediction: OrchestratorResult['finalPrediction'],
  valueBets: string[],
  warnings: string[],
  dataQuality: { score: number; hasOdds: boolean; hasOddsHistory: boolean; homeFormMatches: number; awayFormMatches: number; h2hMatches: number },
  sharpMoneyAlert: OrchestratorResult['sharpMoneyAlert']
): OrchestratorResult['reports'] {
  return {
    deepAnalysis: {
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
    },
    stats: statsResult,
    odds: oddsResult,
    sentiment: sentimentResult ? {
      homeTeam: {
        name: matchData.homeTeam,
        morale: sentimentResult.homeTeam.morale,
        motivation: sentimentResult.homeTeam.motivation,
        preparation: sentimentResult.homeTeam.preparation,
        injuriesImpact: sentimentResult.homeTeam.injuries_impact,
        newsSentiment: sentimentResult.homeTeam.news_sentiment,
        keyFactors: sentimentResult.homeTeam.key_factors,
        recentNews: sentimentResult.homeTeam.recent_news,
      },
      awayTeam: {
        name: matchData.awayTeam,
        morale: sentimentResult.awayTeam.morale,
        motivation: sentimentResult.awayTeam.motivation,
        preparation: sentimentResult.awayTeam.preparation,
        injuriesImpact: sentimentResult.awayTeam.injuries_impact,
        newsSentiment: sentimentResult.awayTeam.news_sentiment,
        keyFactors: sentimentResult.awayTeam.key_factors,
        recentNews: sentimentResult.awayTeam.recent_news,
      },
      matchImportance: sentimentResult.matchImportance,
      psychologicalEdge: sentimentResult.psychologicalEdge,
      summary: sentimentResult.agentSummary,
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
    matchData?: MatchData;
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
    // 1. Veri toplama
    const dataFetchStart = Date.now();
    let matchData: CompleteMatchData;
    
    if (input.matchData) {
      matchData = input.matchData as unknown as CompleteMatchData;
      console.log('📊 Using provided match data');
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
    
    // 3. Agent'ları paralel çalıştır
    console.log('\n🤖 Running agents in parallel...');
    const agentsStart = Date.now();
    
    const [statsResult, oddsResult, sentimentResult] = await Promise.all([
      runStatsAgent(matchData as unknown as MatchData, language).catch(err => {
        console.error('Stats agent failed:', err);
        return null;
      }),
      runOddsAgent(matchData as unknown as MatchData, language).catch(err => {
        console.error('Odds agent failed:', err);
        return null;
      }),
      runSentimentAgent(matchData as unknown as MatchData).catch(err => {
        console.error('Sentiment agent failed:', err);
        return null;
      }),
    ]);
    agentsTime = Date.now() - agentsStart;
    
    const agentResults = {
      stats: statsResult,
      odds: oddsResult,
      sentiment: sentimentResult,
    };
    
    console.log('\n📊 Agent Results:');
    if (statsResult) console.log(`   Stats: ${statsResult.matchResult} | ${statsResult.overUnder} | BTTS: ${statsResult.btts}`);
    if (oddsResult) console.log(`   Odds:  ${oddsResult.matchWinnerValue || oddsResult.matchResult} | ${oddsResult.recommendation || oddsResult.overUnder} | BTTS: ${oddsResult.bttsValue || oddsResult.btts}`);
    if (sentimentResult) console.log(`   Sentiment: Edge=${sentimentResult.psychologicalEdge?.team} | Conf=${sentimentResult.psychologicalEdge?.confidence}%`);
    
    // 4. Consensus oluştur (sadece stats ve odds için)
    console.log('\n🗳️ Building consensus...');
    const consensus = buildConsensus({ stats: statsResult, odds: oddsResult }, language);
    
    console.log(`   Match Result: ${consensus.matchResult.prediction} (${consensus.matchResult.isConsensus ? '✅ Consensus' : '⚠️ No consensus'})`);
    console.log(`   Over/Under: ${consensus.overUnder.prediction} (${consensus.overUnder.isConsensus ? '✅ Consensus' : '⚠️ No consensus'})`);
    console.log(`   BTTS: ${consensus.btts.prediction} (${consensus.btts.isConsensus ? '✅ Consensus' : '⚠️ No consensus'})`);
    
    // 5. Final prediction
    const finalPrediction = buildFinalPrediction(consensus, agentResults, dataQuality, language);
    
    // 6. Value bets
    const valueBets = collectValueBets(agentResults);
    
    // 7. Warnings
    const warnings = collectWarnings(agentResults, dataQuality, consensus, language);
    
    // 8. Sharp money alert
    let sharpMoneyAlert: OrchestratorResult['sharpMoneyAlert'] = undefined;
    if (oddsResult?.sharpMoneyAnalysis?.confidence === 'high') {
      sharpMoneyAlert = {
        detected: true,
        direction: oddsResult.sharpMoneyAnalysis.direction,
        confidence: oddsResult.sharpMoneyAnalysis.confidence,
        message: oddsResult.sharpMoneyAnalysis.reasoning?.[language] || oddsResult.sharpMoneyAnalysis.reasoning?.en || '',
      };
    }
    
    // 9. Build reports for UI
    const reports = buildReports(
      matchData,
      statsResult,
      oddsResult,
      sentimentResult,
      consensus,
      finalPrediction,
      valueBets,
      warnings,
      dataQuality,
      sharpMoneyAlert
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
      agentResults: { stats: null, odds: null, sentiment: null },
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
