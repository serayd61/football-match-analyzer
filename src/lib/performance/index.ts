// ============================================================================
// PERFORMANCE TRACKING LIBRARY
// Handles saving, retrieving, and settling match analyses
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-loaded Supabase client (initialized at runtime, not build time)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// ============================================================================
// TYPES
// ============================================================================

export interface AgentPrediction {
  matchResult: string; // '1', 'X', '2'
  overUnder: string;   // 'Over', 'Under'
  btts: string;        // 'Yes', 'No'
  confidence: number;
  reasoning?: string;
}

export interface AnalysisRecord {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  
  // Agent predictions
  statsAgent?: AgentPrediction;
  oddsAgent?: AgentPrediction;
  deepAnalysisAgent?: AgentPrediction;
  geniusAnalyst?: AgentPrediction;
  masterStrategist?: AgentPrediction;
  aiSmart?: AgentPrediction;
  
  // Consensus
  consensusMatchResult: string;
  consensusOverUnder: string;
  consensusBtts: string;
  consensusConfidence: number;
  consensusScorePrediction?: string;
}

export interface SettledMatch {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  matchResult: string;
  overUnder: string;
  btts: string;
  totalGoals: number;
}

export interface AccuracyStats {
  agent: string;
  totalMatches: number;
  matchResultCorrect: number;
  matchResultAccuracy: number;
  overUnderCorrect: number;
  overUnderAccuracy: number;
  bttsCorrect: number;
  bttsAccuracy: number;
  overallAccuracy: number;
}

// ============================================================================
// SAVE ANALYSIS
// ============================================================================

export async function saveAnalysisToPerformance(analysis: AnalysisRecord): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`💾 Saving analysis for fixture ${analysis.fixtureId}...`);
    
    // Extract agent predictions
    const extractPrediction = (agent: any): AgentPrediction | null => {
      if (!agent) return null;
      
      return {
        matchResult: agent.matchResult || agent.prediction?.matchResult?.prediction || agent.finalConsensus?.matchResult?.prediction || '',
        overUnder: agent.overUnder || agent.prediction?.overUnder?.prediction || agent.finalConsensus?.overUnder?.prediction || '',
        btts: agent.btts || agent.prediction?.btts?.prediction || agent.finalConsensus?.btts?.prediction || '',
        confidence: agent.confidence || agent.overallConfidence || 50,
        reasoning: agent.agentSummary || agent.recommendation || ''
      };
    };
    
    const record = {
      fixture_id: analysis.fixtureId,
      home_team: analysis.homeTeam,
      away_team: analysis.awayTeam,
      league: analysis.league,
      match_date: analysis.matchDate,
      
      // Agent predictions as JSONB
      stats_agent: analysis.statsAgent ? JSON.stringify(analysis.statsAgent) : null,
      odds_agent: analysis.oddsAgent ? JSON.stringify(analysis.oddsAgent) : null,
      deep_analysis_agent: analysis.deepAnalysisAgent ? JSON.stringify(analysis.deepAnalysisAgent) : null,
      genius_analyst: analysis.geniusAnalyst ? JSON.stringify(analysis.geniusAnalyst) : null,
      master_strategist: analysis.masterStrategist ? JSON.stringify(analysis.masterStrategist) : null,
      ai_smart: analysis.aiSmart ? JSON.stringify(analysis.aiSmart) : null,
      
      // Consensus
      consensus_match_result: analysis.consensusMatchResult,
      consensus_over_under: analysis.consensusOverUnder,
      consensus_btts: analysis.consensusBtts,
      consensus_confidence: analysis.consensusConfidence,
      consensus_score_prediction: analysis.consensusScorePrediction,
      
      // Not settled yet
      match_settled: false
    };
    
    // Upsert - update if exists, insert if not
    const { data, error } = await getSupabase()
      .from('analysis_performance')
      .upsert(record, { 
        onConflict: 'fixture_id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error('❌ Error saving analysis:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ Analysis saved for ${analysis.homeTeam} vs ${analysis.awayTeam}`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Save analysis error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// GET ANALYSES
// ============================================================================

export async function getAnalyses(options: {
  settled?: boolean;
  limit?: number;
  offset?: number;
  league?: string;
} = {}): Promise<{ data: any[]; count: number; error?: string }> {
  try {
    let query = getSupabase()
      .from('analysis_performance')
      .select('*', { count: 'exact' })
      .order('match_date', { ascending: false });
    
    if (options.settled !== undefined) {
      query = query.eq('match_settled', options.settled);
    }
    
    if (options.league) {
      query = query.eq('league', options.league);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }
    
    const { data, count, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching analyses:', error);
      return { data: [], count: 0, error: error.message };
    }
    
    return { data: data || [], count: count || 0 };
    
  } catch (error: any) {
    console.error('❌ Get analyses error:', error);
    return { data: [], count: 0, error: error.message };
  }
}

// ============================================================================
// CALCULATE ACCURACY
// ============================================================================

function normalizePrediction(pred: string | undefined): string {
  if (!pred) return '';
  const p = pred.toLowerCase().trim();
  
  // Match Result
  if (p === '1' || p === 'home' || p === 'ev sahibi') return '1';
  if (p === '2' || p === 'away' || p === 'deplasman') return '2';
  if (p === 'x' || p === 'draw' || p === 'beraberlik') return 'X';
  
  // Over/Under
  if (p === 'over' || p === 'üst' || p === 'alt') return p.includes('alt') ? 'under' : 'over';
  if (p === 'under' || p === 'alt') return 'under';
  
  // BTTS
  if (p === 'yes' || p === 'evet' || p === 'var') return 'yes';
  if (p === 'no' || p === 'hayır' || p === 'yok') return 'no';
  
  return p;
}

export function calculateMatchAccuracy(prediction: AgentPrediction | null, actual: SettledMatch): {
  matchResult: boolean;
  overUnder: boolean;
  btts: boolean;
} {
  if (!prediction) {
    return { matchResult: false, overUnder: false, btts: false };
  }
  
  const predMR = normalizePrediction(prediction.matchResult);
  const predOU = normalizePrediction(prediction.overUnder);
  const predBTTS = normalizePrediction(prediction.btts);
  
  const actMR = actual.matchResult.toLowerCase();
  const actOU = actual.overUnder.toLowerCase();
  const actBTTS = actual.btts.toLowerCase();
  
  return {
    matchResult: predMR === actMR,
    overUnder: predOU === actOU,
    btts: predBTTS === actBTTS
  };
}

// ============================================================================
// SETTLE MATCHES
// ============================================================================

export async function settleMatch(fixtureId: number, result: SettledMatch): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`⚖️ Settling match ${fixtureId}: ${result.homeScore}-${result.awayScore}`);
    
    // First get the analysis record
    const { data: record, error: fetchError } = await getSupabase()
      .from('analysis_performance')
      .select('*')
      .eq('fixture_id', fixtureId)
      .single();
    
    if (fetchError || !record) {
      console.log(`⚠️ No analysis found for fixture ${fixtureId}`);
      return { success: false, error: 'Analysis not found' };
    }
    
    if (record.match_settled) {
      console.log(`⚠️ Match ${fixtureId} already settled`);
      return { success: true }; // Already done
    }
    
    // Parse agent predictions
    const parseAgent = (json: any): AgentPrediction | null => {
      if (!json) return null;
      try {
        return typeof json === 'string' ? JSON.parse(json) : json;
      } catch {
        return null;
      }
    };
    
    const statsAgent = parseAgent(record.stats_agent);
    const oddsAgent = parseAgent(record.odds_agent);
    const deepAnalysis = parseAgent(record.deep_analysis_agent);
    const geniusAnalyst = parseAgent(record.genius_analyst);
    const masterStrategist = parseAgent(record.master_strategist);
    const aiSmart = parseAgent(record.ai_smart);
    
    // Calculate accuracy for each agent
    const statsAcc = calculateMatchAccuracy(statsAgent, result);
    const oddsAcc = calculateMatchAccuracy(oddsAgent, result);
    const deepAcc = calculateMatchAccuracy(deepAnalysis, result);
    const geniusAcc = calculateMatchAccuracy(geniusAnalyst, result);
    const masterAcc = calculateMatchAccuracy(masterStrategist, result);
    const aiSmartAcc = calculateMatchAccuracy(aiSmart, result);
    
    // Consensus accuracy
    const consensusPred: AgentPrediction = {
      matchResult: record.consensus_match_result || '',
      overUnder: record.consensus_over_under || '',
      btts: record.consensus_btts || '',
      confidence: record.consensus_confidence || 50
    };
    const consensusAcc = calculateMatchAccuracy(consensusPred, result);
    
    // Update the record
    const updateData = {
      actual_home_score: result.homeScore,
      actual_away_score: result.awayScore,
      actual_match_result: result.matchResult,
      actual_over_under: result.overUnder,
      actual_btts: result.btts,
      actual_total_goals: result.totalGoals,
      match_settled: true,
      settled_at: new Date().toISOString(),
      
      // Stats Agent
      stats_agent_mr_correct: statsAcc.matchResult,
      stats_agent_ou_correct: statsAcc.overUnder,
      stats_agent_btts_correct: statsAcc.btts,
      
      // Odds Agent
      odds_agent_mr_correct: oddsAcc.matchResult,
      odds_agent_ou_correct: oddsAcc.overUnder,
      odds_agent_btts_correct: oddsAcc.btts,
      
      // Deep Analysis
      deep_analysis_mr_correct: deepAcc.matchResult,
      deep_analysis_ou_correct: deepAcc.overUnder,
      deep_analysis_btts_correct: deepAcc.btts,
      
      // Genius Analyst
      genius_analyst_mr_correct: geniusAcc.matchResult,
      genius_analyst_ou_correct: geniusAcc.overUnder,
      genius_analyst_btts_correct: geniusAcc.btts,
      
      // Master Strategist
      master_strategist_mr_correct: masterAcc.matchResult,
      master_strategist_ou_correct: masterAcc.overUnder,
      master_strategist_btts_correct: masterAcc.btts,
      
      // AI Smart
      ai_smart_mr_correct: aiSmartAcc.matchResult,
      ai_smart_ou_correct: aiSmartAcc.overUnder,
      ai_smart_btts_correct: aiSmartAcc.btts,
      
      // Consensus
      consensus_mr_correct: consensusAcc.matchResult,
      consensus_ou_correct: consensusAcc.overUnder,
      consensus_btts_correct: consensusAcc.btts
    };
    
    const { error: updateError } = await getSupabase()
      .from('analysis_performance')
      .update(updateData)
      .eq('fixture_id', fixtureId);
    
    if (updateError) {
      console.error('❌ Error settling match:', updateError);
      return { success: false, error: updateError.message };
    }
    
    console.log(`✅ Match ${fixtureId} settled: Consensus ${consensusAcc.matchResult ? '✅' : '❌'} MR, ${consensusAcc.overUnder ? '✅' : '❌'} O/U, ${consensusAcc.btts ? '✅' : '❌'} BTTS`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Settle match error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// GET ACCURACY STATS
// ============================================================================

export async function getAccuracyStats(): Promise<{ stats: AccuracyStats[]; summary: any; error?: string }> {
  try {
    // Get all settled matches
    const { data, error } = await getSupabase()
      .from('analysis_performance')
      .select('*')
      .eq('match_settled', true);
    
    if (error) {
      return { stats: [], summary: null, error: error.message };
    }
    
    if (!data || data.length === 0) {
      return { stats: [], summary: { totalMatches: 0, settledMatches: 0 } };
    }
    
    const total = data.length;
    
    // Calculate stats for each agent
    const calcAgentStats = (mrField: string, ouField: string, bttsField: string, name: string): AccuracyStats => {
      const mrCorrect = data.filter(r => r[mrField] === true).length;
      const ouCorrect = data.filter(r => r[ouField] === true).length;
      const bttsCorrect = data.filter(r => r[bttsField] === true).length;
      
      return {
        agent: name,
        totalMatches: total,
        matchResultCorrect: mrCorrect,
        matchResultAccuracy: total > 0 ? Math.round((mrCorrect / total) * 100 * 10) / 10 : 0,
        overUnderCorrect: ouCorrect,
        overUnderAccuracy: total > 0 ? Math.round((ouCorrect / total) * 100 * 10) / 10 : 0,
        bttsCorrect: bttsCorrect,
        bttsAccuracy: total > 0 ? Math.round((bttsCorrect / total) * 100 * 10) / 10 : 0,
        overallAccuracy: total > 0 ? Math.round(((mrCorrect + ouCorrect + bttsCorrect) / (total * 3)) * 100 * 10) / 10 : 0
      };
    };
    
    const stats: AccuracyStats[] = [
      calcAgentStats('stats_agent_mr_correct', 'stats_agent_ou_correct', 'stats_agent_btts_correct', 'Stats Agent'),
      calcAgentStats('odds_agent_mr_correct', 'odds_agent_ou_correct', 'odds_agent_btts_correct', 'Odds Agent'),
      calcAgentStats('deep_analysis_mr_correct', 'deep_analysis_ou_correct', 'deep_analysis_btts_correct', 'Deep Analysis'),
      calcAgentStats('genius_analyst_mr_correct', 'genius_analyst_ou_correct', 'genius_analyst_btts_correct', 'Genius Analyst'),
      calcAgentStats('master_strategist_mr_correct', 'master_strategist_ou_correct', 'master_strategist_btts_correct', 'Master Strategist'),
      calcAgentStats('ai_smart_mr_correct', 'ai_smart_ou_correct', 'ai_smart_btts_correct', 'AI Smart'),
      calcAgentStats('consensus_mr_correct', 'consensus_ou_correct', 'consensus_btts_correct', 'KONSENSÜS')
    ];
    
    // Get pending count
    const { count: pendingCount } = await getSupabase()
      .from('analysis_performance')
      .select('*', { count: 'exact', head: true })
      .eq('match_settled', false);
    
    const summary = {
      totalMatches: total + (pendingCount || 0),
      settledMatches: total,
      pendingMatches: pendingCount || 0,
      bestAgent: stats.reduce((best, curr) => curr.overallAccuracy > best.overallAccuracy ? curr : best, stats[0]),
      consensusAccuracy: stats.find(s => s.agent === 'KONSENSÜS')?.overallAccuracy || 0
    };
    
    return { stats, summary };
    
  } catch (error: any) {
    console.error('❌ Get accuracy stats error:', error);
    return { stats: [], summary: null, error: error.message };
  }
}

