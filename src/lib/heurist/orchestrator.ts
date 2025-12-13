// src/lib/heurist/orchestrator.ts
import { runDeepAnalysisAgent } from './agents/deepAnalysis';
import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
import { runStrategyAgent } from './agents/strategy';
import { runSentimentAgent, applySentimentToPrediction } from './sentimentAgent';

import { MatchData } from './types';

// Agent ağırlıkları - Deep Analysis eklendi
const AGENT_WEIGHTS = {
  deepAnalysis: 0.30,  // Yeni! En kapsamlı analiz
  stats: 0.30,
  odds: 0.25,
  strategy: 0.15,
};

// Çok dilli metinler
const LABELS = {
  tr: {
    strongConsensus: '🎯 GÜÇLÜ KONSENSÜS',
    weakConsensus: '⚠️ ZAYIF KONSENSÜS',
    agentsAgree: 'agent hemfikir',
  },
  en: {
    strongConsensus: '🎯 STRONG CONSENSUS',
    weakConsensus: '⚠️ WEAK CONSENSUS',
    agentsAgree: 'agents agree',
  },
  de: {
    strongConsensus: '🎯 STARKER KONSENS',
    weakConsensus: '⚠️ SCHWACHER KONSENS',
    agentsAgree: 'Agenten einig',
  },
};

export interface AgentReport {
  deepAnalysis?: any;
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

// Confidence'ı normalize et
function normalizeConfidence(rawConfidence: number, agreementCount: number): number {
  let normalized = rawConfidence;
  
  if (agreementCount >= 4) normalized += 12;
  else if (agreementCount >= 3) normalized += 8;
  else if (agreementCount >= 2) normalized += 4;
  else normalized -= 5;
  
  return Math.round(Math.min(88, Math.max(45, normalized)));
}

// Generate detailed consensus reasoning
function generateConsensusReasoning(
  deepAnalysis: any,
  stats: any,
  odds: any,
  strategy: any,
  betType: 'overUnder' | 'matchResult' | 'btts',
  finalPrediction: string,
  language: 'tr' | 'en' | 'de'
): { reasoning: string; detailedBreakdown: string; agreementCount: number } {
  const labels = LABELS[language] || LABELS.en;
  
  let deepPred = '', deepConf = 0, deepReason = '';
  let statsPred = '', statsConf = 0, statsReason = '';
  let oddsPred = '', oddsConf = 0, oddsReason = '';
  let stratPred = '', stratConf = 0;
  
  if (betType === 'overUnder') {
    deepPred = deepAnalysis?.overUnder?.prediction || '';
    deepConf = deepAnalysis?.overUnder?.confidence || 60;
    deepReason = deepAnalysis?.overUnder?.reasoning || '';
    statsPred = stats?.overUnder || '';
    statsConf = stats?.overUnderConfidence || stats?.confidence || 60;
    statsReason = stats?.overUnderReasoning || '';
    oddsPred = odds?.recommendation || '';
    oddsConf = odds?.confidence || 60;
    oddsReason = odds?.recommendationReasoning || '';
    stratPred = strategy?._consensus?.overUnderConsensus?.prediction || '';
    stratConf = strategy?._consensus?.overUnderConsensus?.confidence || 60;
  } else if (betType === 'matchResult') {
    deepPred = deepAnalysis?.matchResult?.prediction || '';
    deepConf = deepAnalysis?.matchResult?.confidence || 60;
    deepReason = deepAnalysis?.matchResult?.reasoning || '';
    statsPred = stats?.matchResult || '';
    statsConf = stats?.matchResultConfidence || stats?.confidence || 60;
    statsReason = stats?.matchResultReasoning || '';
    oddsPred = odds?.matchWinnerValue || '';
    oddsConf = odds?.confidence || 60;
    oddsReason = odds?.matchWinnerReasoning || '';
    stratPred = strategy?._consensus?.matchResultConsensus?.prediction || '';
    stratConf = strategy?._consensus?.matchResultConsensus?.confidence || 60;
  } else if (betType === 'btts') {
    deepPred = deepAnalysis?.btts?.prediction || '';
    deepConf = deepAnalysis?.btts?.confidence || 60;
    deepReason = deepAnalysis?.btts?.reasoning || '';
    statsPred = stats?.btts || '';
    statsConf = stats?.bttsConfidence || stats?.confidence || 60;
    statsReason = stats?.bttsReasoning || '';
    oddsPred = odds?.bttsValue || '';
    oddsConf = odds?.confidence || 60;
    oddsReason = odds?.bttsReasoning || '';
    stratPred = strategy?._consensus?.bttsConsensus?.prediction || '';
    stratConf = strategy?._consensus?.bttsConsensus?.confidence || 60;
  }
  
  // Check agreement
  const finalLower = finalPrediction.toLowerCase();
  const checkMatch = (pred: string) => {
    const p = pred.toLowerCase();
    if (finalLower === 'over') return p.includes('over') || p.includes('üst');
    if (finalLower === 'under') return p.includes('under') || p.includes('alt');
    if (finalLower === 'yes') return p.includes('yes') || p.includes('var') || p.includes('evet');
    if (finalLower === 'no') return p.includes('no') || p.includes('yok') || p.includes('hayır');
    if (finalLower === '1') return p.includes('1') || p.includes('home') || p.includes('ev');
    if (finalLower === '2') return p.includes('2') || p.includes('away') || p.includes('dep');
    if (finalLower === 'x') return p.includes('x') || p.includes('draw') || p.includes('berabere');
    return p.includes(finalLower);
  };
  
  const deepAgree = checkMatch(deepPred);
  const statsAgree = checkMatch(statsPred);
  const oddsAgree = checkMatch(oddsPred);
  const stratAgree = checkMatch(stratPred);
  const agreementCount = (deepAgree ? 1 : 0) + (statsAgree ? 1 : 0) + (oddsAgree ? 1 : 0) + (stratAgree ? 1 : 0);
  
  // Build detailed breakdown
  const isTr = language === 'tr';
  
  const deepLine = `🔬 Deep (%30): ${deepPred || 'N/A'} (${deepConf}%) ${deepAgree ? '✅' : '❌'}`;
  const statsLine = `📊 Stats (%30): ${statsPred || 'N/A'} (${statsConf}%) ${statsAgree ? '✅' : '❌'}`;
  const oddsLine = `💰 Odds (%25): ${oddsPred || 'N/A'} (${oddsConf}%) ${oddsAgree ? '✅' : '❌'}`;
  const stratLine = `🧠 Strategy (%15): ${stratPred || 'N/A'} (${stratConf}%) ${stratAgree ? '✅' : '❌'}`;
  
  const detailedBreakdown = `${deepLine}\n${statsLine}\n${oddsLine}\n${stratLine}`;
  
  // Build reasoning - Deep Analysis'in reasoning'ini öncelikli kullan
  let reasoning = '';
  if (agreementCount >= 4) {
    reasoning = isTr 
      ? `${labels.strongConsensus}! 4/4 ${labels.agentsAgree}. ${deepReason || statsReason}`
      : `${labels.strongConsensus}! 4/4 ${labels.agentsAgree}. ${deepReason || statsReason}`;
  } else if (agreementCount >= 3) {
    reasoning = isTr
      ? `${labels.strongConsensus}! ${agreementCount}/4 ${labels.agentsAgree}. ${deepAgree ? deepReason : statsReason}`
      : `${labels.strongConsensus}! ${agreementCount}/4 ${labels.agentsAgree}. ${deepAgree ? deepReason : statsReason}`;
  } else if (agreementCount >= 2) {
    reasoning = isTr
      ? `${agreementCount}/4 agent hemfikir. ${deepAgree ? deepReason : (statsAgree ? statsReason : oddsReason)}`
      : `${agreementCount}/4 agents agree. ${deepAgree ? deepReason : (statsAgree ? statsReason : oddsReason)}`;
  } else {
    reasoning = isTr
      ? `${labels.weakConsensus}. Ağırlıklı hesaplama: ${deepReason || statsReason}`
      : `${labels.weakConsensus}. Weighted calculation: ${deepReason || statsReason}`;
  }
  
  return { reasoning, detailedBreakdown, agreementCount };
}

// Ağırlıklı konsensüs hesaplama - 4 agent ile
function calculateWeightedConsensus(
  deepAnalysis: any,
  stats: any, 
  odds: any, 
  strategy: any, 
  language: 'tr' | 'en' | 'de' = 'en'
): any {
  const weights = AGENT_WEIGHTS;
  const labels = LABELS[language] || LABELS.en;
  
  // ==================== OVER/UNDER ====================
  const overUnderVotes = { over: 0, under: 0 };
  let overUnderVoteCount = 0;
  
  // Deep Analysis agent
  if (deepAnalysis?.overUnder?.prediction) {
    const isOver = deepAnalysis.overUnder.prediction.toLowerCase().includes('over');
    const conf = deepAnalysis.overUnder.confidence || 65;
    if (isOver) overUnderVotes.over += weights.deepAnalysis * conf;
    else overUnderVotes.under += weights.deepAnalysis * conf;
    overUnderVoteCount++;
  }
  
  // Stats agent
  if (stats?.overUnder) {
    const isOver = stats.overUnder.toLowerCase().includes('over') || stats.overUnder.toLowerCase().includes('üst');
    const conf = stats.overUnderConfidence || stats.confidence || 65;
    if (isOver) overUnderVotes.over += weights.stats * conf;
    else overUnderVotes.under += weights.stats * conf;
    overUnderVoteCount++;
  }
  
  // Odds agent
  if (odds?.recommendation) {
    const isOver = odds.recommendation.toLowerCase().includes('over') || odds.recommendation.toLowerCase().includes('üst');
    const conf = odds.confidence || 65;
    if (isOver) overUnderVotes.over += weights.odds * conf;
    else overUnderVotes.under += weights.odds * conf;
    overUnderVoteCount++;
  }
  
  // Strategy agent
  if (strategy?._consensus?.overUnderConsensus) {
    const isOver = strategy._consensus.overUnderConsensus.prediction.toLowerCase().includes('over');
    const conf = strategy._consensus.overUnderConsensus.confidence || 65;
    if (isOver) overUnderVotes.over += weights.strategy * conf;
    else overUnderVotes.under += weights.strategy * conf;
    overUnderVoteCount++;
  }
  
  const overUnderTotal = overUnderVotes.over + overUnderVotes.under;
  const overUnderPrediction = overUnderVotes.over >= overUnderVotes.under ? 'Over' : 'Under';
  const overUnderRawConf = overUnderTotal > 0 
    ? (Math.max(overUnderVotes.over, overUnderVotes.under) / overUnderTotal) * 100
    : 50;
  
  const overUnderConsensus = generateConsensusReasoning(deepAnalysis, stats, odds, strategy, 'overUnder', overUnderPrediction, language);
  const overUnderConfidence = normalizeConfidence(overUnderRawConf, overUnderConsensus.agreementCount);

  // ==================== MATCH RESULT ====================
  const matchVotes = { '1': 0, 'X': 0, '2': 0 };
  let matchVoteCount = 0;
  
  // Deep Analysis agent
  if (deepAnalysis?.matchResult?.prediction) {
    const result = deepAnalysis.matchResult.prediction.toString().toUpperCase();
    const conf = deepAnalysis.matchResult.confidence || 60;
    if (result.includes('1') || result.toLowerCase().includes('home')) {
      matchVotes['1'] += weights.deepAnalysis * conf;
    } else if (result.includes('2') || result.toLowerCase().includes('away')) {
      matchVotes['2'] += weights.deepAnalysis * conf;
    } else {
      matchVotes['X'] += weights.deepAnalysis * conf;
    }
    matchVoteCount++;
  }
  
  // Stats agent
  if (stats?.matchResult) {
    const result = stats.matchResult.toString().toUpperCase();
    const conf = stats.matchResultConfidence || stats.confidence || 60;
    if (result.includes('1') || result.toLowerCase().includes('home')) {
      matchVotes['1'] += weights.stats * conf;
    } else if (result.includes('2') || result.toLowerCase().includes('away')) {
      matchVotes['2'] += weights.stats * conf;
    } else {
      matchVotes['X'] += weights.stats * conf;
    }
    matchVoteCount++;
  }
  
  // Odds agent
  if (odds?.matchWinnerValue) {
    const bestValue = odds.matchWinnerValue.toLowerCase();
    const conf = odds.confidence || 60;
    if (bestValue.includes('home') || bestValue.includes('1')) {
      matchVotes['1'] += weights.odds * conf;
    } else if (bestValue.includes('away') || bestValue.includes('2')) {
      matchVotes['2'] += weights.odds * conf;
    } else {
      matchVotes['X'] += weights.odds * conf;
    }
    matchVoteCount++;
  }
  
  // Strategy agent
  if (strategy?._consensus?.matchResultConsensus) {
    const pred = strategy._consensus.matchResultConsensus.prediction;
    const conf = strategy._consensus.matchResultConsensus.confidence || 60;
    if (pred === '1') matchVotes['1'] += weights.strategy * conf;
    else if (pred === '2') matchVotes['2'] += weights.strategy * conf;
    else matchVotes['X'] += weights.strategy * conf;
    matchVoteCount++;
  }
  
  const matchTotal = matchVotes['1'] + matchVotes['X'] + matchVotes['2'];
  const sortedMatches = Object.entries(matchVotes).sort((a, b) => b[1] - a[1]);
  const matchResultPrediction = sortedMatches[0][0];
  const matchRawConf = matchTotal > 0 
    ? (sortedMatches[0][1] / matchTotal) * 100
    : 33;
  
  const matchConsensus = generateConsensusReasoning(deepAnalysis, stats, odds, strategy, 'matchResult', matchResultPrediction, language);
  const matchResultConfidence = normalizeConfidence(matchRawConf, matchConsensus.agreementCount);

  // ==================== BTTS ====================
  const bttsVotes = { yes: 0, no: 0 };
  let bttsVoteCount = 0;
  
  // Deep Analysis agent
  if (deepAnalysis?.btts?.prediction) {
    const isBttsYes = deepAnalysis.btts.prediction.toLowerCase().includes('yes');
    const conf = deepAnalysis.btts.confidence || 65;
    if (isBttsYes) bttsVotes.yes += weights.deepAnalysis * conf;
    else bttsVotes.no += weights.deepAnalysis * conf;
    bttsVoteCount++;
  }
  
  // Stats agent
  if (stats?.btts) {
    const isBttsYes = stats.btts.toLowerCase().includes('yes') || 
                      stats.btts.toLowerCase().includes('var') ||
                      stats.btts.toLowerCase().includes('evet');
    const conf = stats.bttsConfidence || stats.confidence || 65;
    if (isBttsYes) bttsVotes.yes += weights.stats * conf;
    else bttsVotes.no += weights.stats * conf;
    bttsVoteCount++;
  }
  
  // Odds agent
  if (odds?.bttsValue) {
    const isBttsYes = odds.bttsValue.toLowerCase().includes('yes') || odds.bttsValue.toLowerCase().includes('var');
    const conf = odds.confidence || 65;
    if (isBttsYes) bttsVotes.yes += weights.odds * conf;
    else bttsVotes.no += weights.odds * conf;
    bttsVoteCount++;
  }
  
  // Strategy agent
  if (strategy?._consensus?.bttsConsensus) {
    const isBttsYes = strategy._consensus.bttsConsensus.prediction.toLowerCase().includes('yes');
    const conf = strategy._consensus.bttsConsensus.confidence || 65;
    if (isBttsYes) bttsVotes.yes += weights.strategy * conf;
    else bttsVotes.no += weights.strategy * conf;
    bttsVoteCount++;
  }
  
  const bttsTotal = bttsVotes.yes + bttsVotes.no;
  const bttsPrediction = bttsVotes.yes >= bttsVotes.no ? 'Yes' : 'No';
  const bttsRawConf = bttsTotal > 0 
    ? (Math.max(bttsVotes.yes, bttsVotes.no) / bttsTotal) * 100
    : 50;
  
  const bttsConsensus = generateConsensusReasoning(deepAnalysis, stats, odds, strategy, 'btts', bttsPrediction, language);
  const bttsConfidence = normalizeConfidence(bttsRawConf, bttsConsensus.agreementCount);

  // ==================== BEST BET ====================
  const allBets = [
    { 
      type: 'Over/Under 2.5', 
      selection: overUnderPrediction, 
      confidence: overUnderConfidence, 
      votes: overUnderVoteCount,
      agreement: overUnderConsensus.agreementCount,
      reasoning: overUnderConsensus.reasoning,
      detailedBreakdown: overUnderConsensus.detailedBreakdown,
      score: overUnderConfidence + (overUnderConsensus.agreementCount * 12),
    },
    { 
      type: 'Match Result', 
      selection: matchResultPrediction, 
      confidence: matchResultConfidence, 
      votes: matchVoteCount,
      agreement: matchConsensus.agreementCount,
      reasoning: matchConsensus.reasoning,
      detailedBreakdown: matchConsensus.detailedBreakdown,
      score: matchResultConfidence + (matchConsensus.agreementCount * 12),
    },
    { 
      type: 'BTTS', 
      selection: bttsPrediction, 
      confidence: bttsConfidence, 
      votes: bttsVoteCount,
      agreement: bttsConsensus.agreementCount,
      reasoning: bttsConsensus.reasoning,
      detailedBreakdown: bttsConsensus.detailedBreakdown,
      score: bttsConfidence + (bttsConsensus.agreementCount * 12),
    },
  ];
  
  const bestBet = allBets.sort((a, b) => b.score - a.score)[0];
  
  // Deep Analysis'ten skor tahmini ekle
  const scorePrediction = deepAnalysis?.scorePrediction || { score: 'N/A', reasoning: '' };
  const expectedScores = deepAnalysis?.expectedScores || [];
  const probabilities = deepAnalysis?.probabilities || { homeWin: 33, draw: 34, awayWin: 33 };
  const criticalFactors = deepAnalysis?.criticalFactors || [];

  const [deepAnalysis, stats, odds, strategy, sentiment] = await Promise.all([
  runDeepAnalysisAgent(matchData),
  runStatsAgent(matchData),
  runOddsAgent(matchData),
  runStrategyAgent(matchData),
  runSentimentAgent(matchData)  // YENİ!
]);

// Final tahmine sentiment'i uygula
const adjustedPrediction = applySentimentToPrediction(finalPrediction, sentiment);
  
  // Generate final summary
  const totalAgreement = overUnderConsensus.agreementCount + matchConsensus.agreementCount + bttsConsensus.agreementCount;
  const isTr = language === 'tr';
  
  const finalSummary = isTr
    ? `🎯 FİNAL: ${bestBet.type} → ${bestBet.selection} (%${bestBet.confidence})\n` +
      `📊 Toplam Uyum: ${totalAgreement}/12 agent oyu\n` +
      `⚽ Tahmini Skor: ${scorePrediction.score}\n\n` +
      `${bestBet.detailedBreakdown}\n\n` +
      `${bestBet.agreement >= 3 ? '✅ GÜÇLÜ SİNYAL - ' + bestBet.agreement + '/4 agent hemfikir!' : (bestBet.agreement >= 2 ? '🟡 ORTA SİNYAL - ' + bestBet.agreement + '/4 agent hemfikir' : '⚠️ ZAYIF SİNYAL - Dikkatli olun')}`
    : `🎯 FINAL: ${bestBet.type} → ${bestBet.selection} (${bestBet.confidence}%)\n` +
      `📊 Total Agreement: ${totalAgreement}/12 agent votes\n` +
      `⚽ Predicted Score: ${scorePrediction.score}\n\n` +
      `${bestBet.detailedBreakdown}\n\n` +
      `${bestBet.agreement >= 3 ? '✅ STRONG SIGNAL - ' + bestBet.agreement + '/4 agents agree!' : (bestBet.agreement >= 2 ? '🟡 MEDIUM SIGNAL - ' + bestBet.agreement + '/4 agents agree' : '⚠️ WEAK SIGNAL - Use caution')}`;

  return {
    overUnder: {
      prediction: overUnderPrediction,
      confidence: overUnderConfidence,
      reasoning: overUnderConsensus.reasoning,
      detailedBreakdown: overUnderConsensus.detailedBreakdown,
      votes: overUnderVoteCount,
      agreement: overUnderConsensus.agreementCount,
    },
    matchResult: {
      prediction: matchResultPrediction,
      confidence: matchResultConfidence,
      reasoning: matchConsensus.reasoning,
      detailedBreakdown: matchConsensus.detailedBreakdown,
      votes: matchVoteCount,
      agreement: matchConsensus.agreementCount,
    },
    btts: {
      prediction: bttsPrediction,
      confidence: bttsConfidence,
      reasoning: bttsConsensus.reasoning,
      detailedBreakdown: bttsConsensus.detailedBreakdown,
      votes: bttsVoteCount,
      agreement: bttsConsensus.agreementCount,
    },
    bestBet: {
      type: bestBet.type,
      selection: bestBet.selection,
      confidence: bestBet.confidence,
      reasoning: bestBet.reasoning,
      detailedBreakdown: bestBet.detailedBreakdown,
      votes: bestBet.votes,
      agreement: bestBet.agreement,
    },
    // Deep Analysis'ten gelen ekstra veriler
    scorePrediction,
    expectedScores,
    probabilities,
    criticalFactors,
    matchAnalysis: deepAnalysis?.matchAnalysis || '',
    riskLevel: deepAnalysis?.riskLevel || 'Medium',
    
    finalSummary,
    totalAgreement,
    agentContributions: {
      deepAnalysis: `${Math.round(weights.deepAnalysis * 100)}%`,
      stats: `${Math.round(weights.stats * 100)}%`,
      odds: `${Math.round(weights.odds * 100)}%`,
      strategy: `${Math.round(weights.strategy * 100)}%`,
    },
    agentSummaries: {
      deepAnalysis: deepAnalysis?.agentSummary || '',
      stats: stats?.agentSummary || '',
      odds: odds?.agentSummary || '',
      strategy: strategy?.agentSummary || '',
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

  console.log(`\n🚀 ═══════════════════════════════════════════════════`);
  console.log(`🚀 4-AGENT DEEP ANALYSIS - ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`🚀 ═══════════════════════════════════════════════════\n`);

  try {
    // Phase 1: Deep Analysis, Stats, Odds parallel
    console.log('📊 Phase 1: Running Deep Analysis, Stats, Odds agents in parallel...');
    const [deepAnalysisResult, statsResult, oddsResult] = await Promise.all([
      runDeepAnalysisAgent(matchData, language).catch(e => { errors.push(`DeepAnalysis: ${e.message}`); return null; }),
      runStatsAgent(matchData, language).catch(e => { errors.push(`Stats: ${e.message}`); return null; }),
      runOddsAgent(matchData, language).catch(e => { errors.push(`Odds: ${e.message}`); return null; }),
    ]);

    reports.deepAnalysis = deepAnalysisResult;
    reports.stats = statsResult;
    reports.odds = oddsResult;

    console.log(`\n✅ Phase 1 complete:`);
    console.log(`   🔬 Deep: ${deepAnalysisResult?.matchResult?.prediction || 'N/A'} | ${deepAnalysisResult?.overUnder?.prediction || 'N/A'} | Score: ${deepAnalysisResult?.scorePrediction?.score || 'N/A'}`);
    console.log(`   📊 Stats: ${statsResult?.matchResult || 'N/A'} | ${statsResult?.overUnder || 'N/A'} | BTTS: ${statsResult?.btts || 'N/A'}`);
    console.log(`   💰 Odds: ${oddsResult?.matchWinnerValue || 'N/A'} | ${oddsResult?.recommendation || 'N/A'} | BTTS: ${oddsResult?.bttsValue || 'N/A'}`);

    // Phase 2: Strategy (diğer agent sonuçlarını kullanır)
    console.log('\n🧠 Phase 2: Running Strategy agent...');
    const strategyResult = await runStrategyAgent(
      matchData,
      { deepAnalysis: deepAnalysisResult, stats: statsResult, odds: oddsResult },
      language
    ).catch(e => { errors.push(`Strategy: ${e.message}`); return null; });

    reports.strategy = strategyResult;
    console.log(`   🧠 Strategy: Best=${strategyResult?._bestBet?.type || 'N/A'} | Risk=${strategyResult?.riskAssessment || 'N/A'}`);

    // Phase 3: Weighted Consensus (4 agent)
    console.log('\n⚖️ Phase 3: Calculating 4-agent weighted consensus...');
    const weightedConsensus = calculateWeightedConsensus(deepAnalysisResult, statsResult, oddsResult, strategyResult, language);
    reports.weightedConsensus = weightedConsensus;
    
    console.log(`\n🎯 ═══════════════════════════════════════════════════`);
    console.log(`🎯 FINAL CONSENSUS RESULTS (4 AGENTS)`);
    console.log(`🎯 ═══════════════════════════════════════════════════`);
    console.log(`   Over/Under: ${weightedConsensus.overUnder.prediction} (${weightedConsensus.overUnder.confidence}%) [${weightedConsensus.overUnder.agreement}/4 agree]`);
    console.log(`   Match Result: ${weightedConsensus.matchResult.prediction} (${weightedConsensus.matchResult.confidence}%) [${weightedConsensus.matchResult.agreement}/4 agree]`);
    console.log(`   BTTS: ${weightedConsensus.btts.prediction} (${weightedConsensus.btts.confidence}%) [${weightedConsensus.btts.agreement}/4 agree]`);
    console.log(`\n   ⚽ PREDICTED SCORE: ${weightedConsensus.scorePrediction?.score || 'N/A'}`);
    console.log(`   📊 Probabilities: 1=${weightedConsensus.probabilities?.homeWin}% X=${weightedConsensus.probabilities?.draw}% 2=${weightedConsensus.probabilities?.awayWin}%`);
    console.log(`\n   🏆 BEST BET: ${weightedConsensus.bestBet.type} - ${weightedConsensus.bestBet.selection} (${weightedConsensus.bestBet.confidence}%)`);
    console.log(`   📊 Total Agreement: ${weightedConsensus.totalAgreement}/12`);
    console.log(`   ⚠️ Risk Level: ${weightedConsensus.riskLevel}`);

    if (weightedConsensus.criticalFactors && weightedConsensus.criticalFactors.length > 0) {
      console.log(`\n   📋 Critical Factors:`);
      weightedConsensus.criticalFactors.slice(0, 5).forEach((f: string, i: number) => {
        console.log(`      ${i + 1}. ${f}`);
      });
    }

    const timing = Date.now() - startTime;
    console.log(`\n⏱️ Total time: ${timing}ms`);
    console.log(`═══════════════════════════════════════════════════════\n`);

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
