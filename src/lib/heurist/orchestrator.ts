// src/lib/heurist/orchestrator.ts
// Multi-Agent Football Analysis Orchestrator

import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
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
    score: number; // 0-100
  };
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
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
      // Normalize: home -> 1, away -> 2, draw -> X
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
  
  // En çok oy alan seçeneği bul
  let winner = '';
  let maxVotes = 0;
  
  for (const [option, voteCount] of Object.entries(count)) {
    if (voteCount > maxVotes) {
      maxVotes = voteCount;
      winner = option;
    }
  }
  
  // Ortalama confidence
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
  
  // Score calculation (0-100)
  let score = 0;
  score += Math.min(25, homeFormMatches * 5); // Max 25 for 5 matches
  score += Math.min(25, awayFormMatches * 5); // Max 25 for 5 matches
  score += Math.min(20, h2hMatches * 4);      // Max 20 for 5 H2H matches
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
  agentResults: { stats: AgentResult | null; odds: AgentResult | null },
  dataQuality: { score: number },
  language: 'tr' | 'en' | 'de'
): OrchestratorResult['finalPrediction'] {
  
  // Consensus varsa confidence'ı artır
  let matchResultConf = consensus.matchResult.confidence;
  let overUnderConf = consensus.overUnder.confidence;
  let bttsConf = consensus.btts.confidence;
  
  if (consensus.matchResult.isConsensus) matchResultConf += 5;
  if (consensus.overUnder.isConsensus) overUnderConf += 5;
  if (consensus.btts.isConsensus) bttsConf += 5;
  
  // Sharp money onayı varsa confidence'ı artır
  if (agentResults.odds?.hasSharpConfirmation) {
    const sharpDir = agentResults.odds.sharpMoneyAnalysis?.direction;
    if (sharpDir === 'home' && consensus.matchResult.prediction === '1') matchResultConf += 8;
    if (sharpDir === 'away' && consensus.matchResult.prediction === '2') matchResultConf += 8;
    if (sharpDir === 'over' && consensus.overUnder.prediction === 'Over') overUnderConf += 8;
    if (sharpDir === 'under' && consensus.overUnder.prediction === 'Under') overUnderConf += 8;
  }
  
  // Data quality'ye göre ayarla
  const qualityMultiplier = 0.85 + (dataQuality.score / 100) * 0.15;
  matchResultConf = Math.round(matchResultConf * qualityMultiplier);
  overUnderConf = Math.round(overUnderConf * qualityMultiplier);
  bttsConf = Math.round(bttsConf * qualityMultiplier);
  
  // Clamp values
  matchResultConf = Math.min(90, Math.max(45, matchResultConf));
  overUnderConf = Math.min(90, Math.max(45, overUnderConf));
  bttsConf = Math.min(90, Math.max(45, bttsConf));
  
  const overallConfidence = Math.round((matchResultConf + overUnderConf + bttsConf) / 3);
  
  // Recommendation
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
  
  // Real value checks'ten de ekle
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
  agentResults: { stats: AgentResult | null; odds: AgentResult | null },
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
      noOdds: '📊 Oran verisi eksik',
    },
    en: {
      lowData: '📊 Low data quality - predictions less reliable',
      noConsensusMatch: '⚠️ Agents disagree on match result',
      noConsensusOU: '⚠️ Agents disagree on Over/Under',
      noConsensusBtts: '⚠️ Agents disagree on BTTS',
      oddsRising: '⚠️ Odds rising - bookies may know something',
      noH2H: '📊 No or insufficient H2H data',
      noOdds: '📊 Odds data missing',
    },
    de: {
      lowData: '📊 Geringe Datenqualität - Vorhersagen weniger zuverlässig',
      noConsensusMatch: '⚠️ Agenten uneinig beim Spielergebnis',
      noConsensusOU: '⚠️ Agenten uneinig bei Over/Under',
      noConsensusBtts: '⚠️ Agenten uneinig bei BTTS',
      oddsRising: '⚠️ Quoten steigen - Buchmacher wissen vielleicht etwas',
      noH2H: '📊 Keine oder unzureichende H2H-Daten',
      noOdds: '📊 Quotendaten fehlen',
    },
  };
  
  const msg = messages[language] || messages.en;
  
  // Data quality warnings
  if (dataQuality.score < 50) warnings.push(msg.lowData);
  if (dataQuality.h2hMatches === 0) warnings.push(msg.noH2H);
  
  // Consensus warnings
  if (!consensus.matchResult.isConsensus) warnings.push(msg.noConsensusMatch);
  if (!consensus.overUnder.isConsensus) warnings.push(msg.noConsensusOU);
  if (!consensus.btts.isConsensus) warnings.push(msg.noConsensusBtts);
  
  // Odds rising warning
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
  
  return warnings;
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
    matchData?: MatchData; // Eğer veri zaten varsa
  },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<OrchestratorResult> {
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 ORCHESTRATOR STARTING');
  console.log('═'.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 1. Veri toplama
    let matchData: CompleteMatchData;
    
    if (input.matchData) {
      // Veri zaten sağlanmış
      matchData = input.matchData as CompleteMatchData;
      console.log('📊 Using provided match data');
    } else if (input.fixtureId && input.homeTeamId && input.awayTeamId) {
      // Fixture ID ve team ID'ler var
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
      // Sadece fixture ID var
      console.log('📊 Fetching match data by fixture ID...');
      const data = await fetchMatchDataByFixtureId(input.fixtureId);
      if (!data) {
        throw new Error('Failed to fetch match data');
      }
      matchData = data;
    } else {
      throw new Error('Insufficient input: need fixtureId or matchData');
    }
    
    // 2. Data quality assessment
    const dataQuality = assessDataQuality(matchData);
    console.log(`📊 Data Quality Score: ${dataQuality.score}/100`);
    
    // 3. Agent'ları paralel çalıştır
    console.log('\n🤖 Running agents in parallel...');
    
    const [statsResult, oddsResult] = await Promise.all([
      runStatsAgent(matchData as MatchData, language).catch(err => {
        console.error('Stats agent failed:', err);
        return null;
      }),
      runOddsAgent(matchData as MatchData, language).catch(err => {
        console.error('Odds agent failed:', err);
        return null;
      }),
    ]);
    
    const agentResults = {
      stats: statsResult,
      odds: oddsResult,
    };
    
    console.log('\n📊 Agent Results:');
    if (statsResult) console.log(`   Stats: ${statsResult.matchResult} | ${statsResult.overUnder} | BTTS: ${statsResult.btts}`);
    if (oddsResult) console.log(`   Odds:  ${oddsResult.matchWinnerValue || oddsResult.matchResult} | ${oddsResult.recommendation || oddsResult.overUnder} | BTTS: ${oddsResult.bttsValue || oddsResult.btts}`);
    
    // 4. Consensus oluştur
    console.log('\n🗳️ Building consensus...');
    const consensus = buildConsensus(agentResults, language);
    
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
    };
    
  } catch (error) {
    console.error('❌ Orchestrator error:', error);
    
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
      agentResults: { stats: null, odds: null },
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
  
  // Process in batches
  for (let i = 0; i < fixtures.length; i += maxConcurrent) {
    const batch = fixtures.slice(i, i + maxConcurrent);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(fixtures.length / maxConcurrent)}`);
    
    const batchResults = await Promise.all(
      batch.map(fixture => runOrchestrator(fixture, language))
    );
    
    results.push(...batchResults);
    
    // Delay between batches (rate limiting)
    if (i + maxConcurrent < fixtures.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const highConfidence = results.filter(r => r.finalPrediction.overallConfidence >= 70).length;
  
  console.log(`\n📊 BATCH COMPLETE: ${successful}/${fixtures.length} successful, ${highConfidence} high confidence picks`);
  
  return results;
}

// ==================== EXPORT FOR API ====================
export const runFullAnalysis = runOrchestrator;


export type { CompleteMatchData };
