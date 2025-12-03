// src/lib/heurist/orchestrator.ts

import { runScoutAgent } from './agents/scout';
import { runStatsAgent } from './agents/stats';
import { runOddsAgent } from './agents/odds';
import { runStrategyAgent } from './agents/strategy';
import { runConsensusAgent } from './agents/consensus';
import { Language, MatchData, ConsensusReport } from './types';

export interface OrchestratorResult {
  success: boolean;
  reports: {
    scout: any;
    stats: any;
    odds: any;
    strategy: any;
    consensus: ConsensusReport | null;
  };
  timing: {
    scout: number;
    stats: number;
    odds: number;
    strategy: number;
    consensus: number;
    total: number;
  };
  errors: string[];
}

export async function runFullAnalysis(
  match: MatchData,
  language: Language = 'en'
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const timing: any = {};

  console.log(`🚀 Starting full analysis for ${match.homeTeam} vs ${match.awayTeam} [${language.toUpperCase()}]`);

  // Phase 1: Paralel çalışan ajanlar (Scout, Stats, Odds)
  console.log('📊 Phase 1: Running Scout, Stats, Odds agents in parallel...');
  
  const phase1Start = Date.now();
  const [scoutResult, statsResult, oddsResult] = await Promise.all([
    runScoutAgent(match, language).catch(e => { errors.push(`Scout: ${e.message}`); return null; }),
    runStatsAgent(match, language).catch(e => { errors.push(`Stats: ${e.message}`); return null; }),
    runOddsAgent(match, language).catch(e => { errors.push(`Odds: ${e.message}`); return null; }),
  ]);

  timing.scout = Date.now() - phase1Start;
  timing.stats = timing.scout;
  timing.odds = timing.scout;

  console.log(`✅ Phase 1 complete: Scout=${scoutResult ? 'OK' : 'FAIL'}, Stats=${statsResult ? 'OK' : 'FAIL'}, Odds=${oddsResult ? 'OK' : 'FAIL'}`);

  // Phase 2: Strategy Agent (Phase 1 sonuçlarına ihtiyaç duyar)
  console.log('🧠 Phase 2: Running Strategy agent...');
  
  const phase2Start = Date.now();
  const strategyResult = await runStrategyAgent(
    match,
    { scout: scoutResult, stats: statsResult, odds: oddsResult },
    language
  ).catch(e => { errors.push(`Strategy: ${e.message}`); return null; });

  timing.strategy = Date.now() - phase2Start;
  console.log(`✅ Phase 2 complete: Strategy=${strategyResult ? 'OK' : 'FAIL'}`);

  // Phase 3: Consensus Agent (Tüm sonuçları değerlendirir)
  console.log('⚖️ Phase 3: Running Consensus agent...');
  
  const phase3Start = Date.now();
  const consensusResult = await runConsensusAgent(
    match,
    {
      scout: scoutResult,
      stats: statsResult,
      odds: oddsResult,
      strategy: strategyResult,
    },
    language
  ).catch(e => { errors.push(`Consensus: ${e.message}`); return null; });

  timing.consensus = Date.now() - phase3Start;
  timing.total = Date.now() - startTime;

  console.log(`✅ Phase 3 complete: Consensus=${consensusResult ? 'OK' : 'FAIL'}`);
  console.log(`⏱️ Total time: ${timing.total}ms`);

  return {
    success: consensusResult !== null,
    reports: {
      scout: scoutResult,
      stats: statsResult,
      odds: oddsResult,
      strategy: strategyResult,
      consensus: consensusResult,
    },
    timing,
    errors,
  };
}
