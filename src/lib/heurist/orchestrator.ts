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

// Confidence'ı normalize et
function normalizeConfidence(rawConfidence: number, agreementCount: number): number {
  let normalized = rawConfidence;
  
  // Agreement bonus
  if (agreementCount >= 3) normalized += 8;
  else if (agreementCount >= 2) normalized += 4;
  else normalized -= 5;
  
  return Math.round(Math.min(85, Math.max(45, normalized)));
}

// Generate detailed consensus reasoning
function generateConsensusReasoning(
  stats: any,
  odds: any,
  strategy: any,
  betType: 'overUnder' | 'matchResult' | 'btts',
  finalPrediction: string,
  language: 'tr' | 'en' | 'de'
): { reasoning: string; detailedBreakdown: string; agreementCount: number } {
  const labels = LABELS[language] || LABELS.en;
  
  let statsPred = '', statsConf = 0, statsReason = '';
  let oddsPred = '', oddsConf = 0, oddsReason = '';
  let stratPred = '', stratConf = 0;
  
  if (betType === 'overUnder') {
    statsPred = stats?.overUnder || '';
    statsConf = stats?.overUnderConfidence || stats?.confidence || 60;
    statsReason = stats?.overUnderReasoning || '';
    oddsPred = odds?.recommendation || '';
    oddsConf = odds?.confidence || 60;
    oddsReason = odds?.recommendationReasoning || '';
    stratPred = strategy?._consensus?.overUnderConsensus?.prediction || '';
    stratConf = strategy?._consensus?.overUnderConsensus?.confidence || 60;
  } else if (betType === 'matchResult') {
    statsPred = stats?.matchResult || '';
    statsConf = stats?.matchResultConfidence || stats?.confidence || 60;
    statsReason = stats?.matchResultReasoning || '';
    oddsPred = odds?.matchWinnerValue || '';
    oddsConf = odds?.confidence || 60;
    oddsReason = odds?.matchWinnerReasoning || '';
    stratPred = strategy?._consensus?.matchResultConsensus?.prediction || '';
    stratConf = strategy?._consensus?.matchResultConsensus?.confidence || 60;
  } else if (betType === 'btts') {
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
  
  const statsAgree = checkMatch(statsPred);
  const oddsAgree = checkMatch(oddsPred);
  const stratAgree = checkMatch(stratPred);
  const agreementCount = (statsAgree ? 1 : 0) + (oddsAgree ? 1 : 0) + (stratAgree ? 1 : 0);
  
  // Build detailed breakdown
  const isTr = language === 'tr';
  
  const statsLine = `📊 Stats (%40): ${statsPred || 'N/A'} (${statsConf}%) ${statsAgree ? '✅' : '❌'}`;
  const oddsLine = `💰 Odds (%35): ${oddsPred || 'N/A'} (${oddsConf}%) ${oddsAgree ? '✅' : '❌'}`;
  const stratLine = `🧠 Strategy (%25): ${stratPred || 'N/A'} (${stratConf}%) ${stratAgree ? '✅' : '❌'}`;
  
  const detailedBreakdown = `${statsLine}\n${oddsLine}\n${stratLine}`;
  
  // Build reasoning
  let reasoning = '';
  if (agreementCount >= 3) {
    reasoning = isTr 
      ? `${labels.strongConsensus}! 3/3 ${labels.agentsAgree}. ${statsReason || oddsReason}`
      : `${labels.strongConsensus}! 3/3 ${labels.agentsAgree}. ${statsReason || oddsReason}`;
  } else if (agreementCount >= 2) {
    reasoning = isTr
      ? `${agreementCount}/3 agent hemfikir. ${statsAgree ? statsReason : oddsReason}`
      : `${agreementCount}/3 agents agree. ${statsAgree ? statsReason : oddsReason}`;
  } else {
    reasoning = isTr
      ? `${labels.weakConsensus}. Ağırlıklı hesaplama: ${statsReason || oddsReason}`
      : `${labels.weakConsensus}. Weighted calculation: ${statsReason || oddsReason}`;
  }
  
  return { reasoning, detailedBreakdown, agreementCount };
}

// Ağırlıklı konsensüs hesaplama
function calculateWeightedConsensus(
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
  
  const overUnderConsensus = generateConsensusReasoning(stats, odds, strategy, 'overUnder', overUnderPrediction, language);
  const overUnderConfidence = normalizeConfidence(overUnderRawConf, overUnderConsensus.agreementCount);

  // ==================== MATCH RESULT ====================
  const matchVotes = { '1': 0, 'X': 0, '2': 0 };
  let matchVoteCount = 0;
  
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
  
  const matchConsensus = generateConsensusReasoning(stats, odds, strategy, 'matchResult', matchResultPrediction, language);
  const matchResultConfidence = normalizeConfidence(matchRawConf, matchConsensus.agreementCount);

  // ==================== BTTS ====================
  const bttsVotes = { yes: 0, no: 0 };
  let bttsVoteCount = 0;
  
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
  
  const bttsConsensus = generateConsensusReasoning(stats, odds, strategy, 'btts', bttsPrediction, language);
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
      score: overUnderConfidence + (overUnderConsensus.agreementCount * 10),
    },
    { 
      type: 'Match Result', 
      selection: matchResultPrediction, 
      confidence: matchResultConfidence, 
      votes: matchVoteCount,
      agreement: matchConsensus.agreementCount,
      reasoning: matchConsensus.reasoning,
      detailedBreakdown: matchConsensus.detailedBreakdown,
      score: matchResultConfidence + (matchConsensus.agreementCount * 10),
    },
    { 
      type: 'BTTS', 
      selection: bttsPrediction, 
      confidence: bttsConfidence, 
      votes: bttsVoteCount,
      agreement: bttsConsensus.agreementCount,
      reasoning: bttsConsensus.reasoning,
      detailedBreakdown: bttsConsensus.detailedBreakdown,
      score: bttsConfidence + (bttsConsensus.agreementCount * 10),
    },
  ];
  
  const bestBet = allBets.sort((a, b) => b.score - a.score)[0];
  
  // Generate final summary
  const totalAgreement = overUnderConsensus.agreementCount + matchConsensus.agreementCount + bttsConsensus.agreementCount;
  const isTr = language === 'tr';
  
  const finalSummary = isTr
    ? `🎯 FİNAL: ${bestBet.type} → ${bestBet.selection} (%${bestBet.confidence})\n` +
      `📊 Toplam Uyum: ${totalAgreement}/9 agent oyu\n\n` +
      `${bestBet.detailedBreakdown}\n\n` +
      `${bestBet.agreement >= 2 ? '✅ GÜÇLÜ SİNYAL - ' + bestBet.agreement + '/3 agent hemfikir!' : '⚠️ ZAYIF SİNYAL - Dikkatli olun'}`
    : `🎯 FINAL: ${bestBet.type} → ${bestBet.selection} (${bestBet.confidence}%)\n` +
      `📊 Total Agreement: ${totalAgreement}/9 agent votes\n\n` +
      `${bestBet.detailedBreakdown}\n\n` +
      `${bestBet.agreement >= 2 ? '✅ STRONG SIGNAL - ' + bestBet.agreement + '/3 agents agree!' : '⚠️ WEAK SIGNAL - Use caution'}`;

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
    finalSummary,
    totalAgreement,
    agentContributions: {
      stats: `${Math.round(weights.stats * 100)}%`,
      odds: `${Math.round(weights.odds * 100)}%`,
      strategy: `${Math.round(weights.strategy * 100)}%`,
    },
    agentSummaries: {
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
  console.log(`🚀 AGGRESSIVE AGENT ANALYSIS - ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`🚀 ═══════════════════════════════════════════════════\n`);

  try {
    // Phase 1: Scout, Stats, Odds parallel
    console.log('📊 Phase 1: Running Stats, Odds agents in parallel...');
    const [scoutResult, statsResult, oddsResult] = await Promise.all([
      runScoutAgent(matchData, language).catch(e => { errors.push(`Scout: ${e.message}`); return null; }),
      runStatsAgent(matchData, language).catch(e => { errors.push(`Stats: ${e.message}`); return null; }),
      runOddsAgent(matchData, language).catch(e => { errors.push(`Odds: ${e.message}`); return null; }),
    ]);

    reports.scout = scoutResult;
    reports.stats = statsResult;
    reports.odds = oddsResult;

    console.log(`\n✅ Phase 1 complete:`);
    console.log(`   📊 Stats: ${statsResult?.matchResult || 'N/A'} | ${statsResult?.overUnder || 'N/A'} | BTTS: ${statsResult?.btts || 'N/A'}`);
    console.log(`   💰 Odds: ${oddsResult?.matchWinnerValue || 'N/A'} | ${oddsResult?.recommendation || 'N/A'} | BTTS: ${oddsResult?.bttsValue || 'N/A'}`);

    // Phase 2: Strategy
    console.log('\n🧠 Phase 2: Running Strategy agent...');
    const strategyResult = await runStrategyAgent(
      matchData,
      { scout: scoutResult, stats: statsResult, odds: oddsResult },
      language
    ).catch(e => { errors.push(`Strategy: ${e.message}`); return null; });

    reports.strategy = strategyResult;
    console.log(`   🧠 Strategy: Best=${strategyResult?._bestBet?.type || 'N/A'} | Risk=${strategyResult?.riskAssessment || 'N/A'}`);

    // Phase 3: Weighted Consensus
    console.log('\n⚖️ Phase 3: Calculating weighted consensus...');
    const weightedConsensus = calculateWeightedConsensus(statsResult, oddsResult, strategyResult, language);
    reports.weightedConsensus = weightedConsensus;
    
    console.log(`\n🎯 ═══════════════════════════════════════════════════`);
    console.log(`🎯 FINAL CONSENSUS RESULTS`);
    console.log(`🎯 ═══════════════════════════════════════════════════`);
    console.log(`   Over/Under: ${weightedConsensus.overUnder.prediction} (${weightedConsensus.overUnder.confidence}%) [${weightedConsensus.overUnder.agreement}/3 agree]`);
    console.log(`   Match Result: ${weightedConsensus.matchResult.prediction} (${weightedConsensus.matchResult.confidence}%) [${weightedConsensus.matchResult.agreement}/3 agree]`);
    console.log(`   BTTS: ${weightedConsensus.btts.prediction} (${weightedConsensus.btts.confidence}%) [${weightedConsensus.btts.agreement}/3 agree]`);
    console.log(`\n   🏆 BEST BET: ${weightedConsensus.bestBet.type} - ${weightedConsensus.bestBet.selection} (${weightedConsensus.bestBet.confidence}%)`);
    console.log(`   📊 Total Agreement: ${weightedConsensus.totalAgreement}/9`);

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
