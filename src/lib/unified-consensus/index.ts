// ============================================================================
// UNIFIED CONSENSUS SYSTEM
// Agent'lar ve AI'ları birleştiren, en yüksek kalitede tahmin üreten sistem
// ============================================================================

import { runAgentAnalysis, AgentAnalysisResult } from '../agent-analyzer';
import { runSmartAnalysis, SmartAnalysisResult } from '../smart-analyzer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getLeagueAccuracyStats } from '../performance';
import { validateAgentConsensus, resolveConflicts, AgentPrediction } from './agent-consensus-validator';
import { calculateConsensusAlignment, recordConsensusAlignment, getAgentConsensusAlignment, adjustWeightByConsensusAlignment } from '../agent-learning/consensus-alignment';

// Lazy-loaded Supabase client (initialized at runtime, not build time)
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials missing for unified-consensus!');
      console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING');
      console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'set' : 'MISSING');
      throw new Error('Supabase credentials not configured');
    }

    console.log('🔗 Initializing Supabase client for unified-consensus (service role)...');
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

export interface UnifiedAnalysisInput {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  matchDate: string;
  lang?: 'tr' | 'en' | 'de';
}

export interface UnifiedConsensusResult {
  // Final tahminler (konsensüs)
  predictions: {
    matchResult: {
      prediction: '1' | 'X' | '2';
      confidence: number;
      reasoning: string;
      scorePrediction: string; // "2-1", "1-1", etc.
    };
    overUnder: {
      prediction: 'Over' | 'Under';
      confidence: number;
      reasoning: string;
      expectedGoals: number;
    };
    btts: {
      prediction: 'Yes' | 'No';
      confidence: number;
      reasoning: string;
    };
  };

  // Best bet
  bestBet: {
    market: string;
    selection: string;
    confidence: number;
    value: 'low' | 'medium' | 'high';
    reasoning: string;
    recommendedStake: 'low' | 'medium' | 'high';
  };

  // Sistem performansı
  systemPerformance: {
    overallConfidence: number;
    agreement: number; // 0-100, sistemlerin ne kadar hemfikir olduğu
    riskLevel: 'low' | 'medium' | 'high';
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
    expertAgents?: string[]; // IDs of agents with accuracy > 65% in this league
    conflicts?: Array<{
      field: string;
      description: string;
      resolution: string;
    }>;
  };

  // Kaynak analizleri (detay için)
  sources: {
    agents: {
      stats?: any;
      odds?: any;
      deepAnalysis?: any;
      masterStrategist?: any;
      geniusAnalyst?: any;
      devilsAdvocate?: any;
    };
    ai?: {
      smart?: SmartAnalysisResult;
    };
  };

  // Metadata
  metadata: {
    processingTime: number;
    analyzedAt: string;
    systemsUsed: string[];
    _debug?: any;
  };
}

/**
 * Unified Consensus System - Tüm sistemleri birleştirir
 */
export async function runUnifiedConsensus(
  input: UnifiedAnalysisInput,
  onProgress?: (data: { stage: string; message: string; data?: any }) => void
): Promise<UnifiedConsensusResult> {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(70));
  console.log('🎯 UNIFIED CONSENSUS SYSTEM');
  console.log(`📊 Match: ${input.homeTeam} vs ${input.awayTeam}`);
  console.log('═'.repeat(70));

  const systemsUsed: string[] = [];

  try {
    // 1. Agent Analysis çalıştır (ana sistem)
    let agentResult: AgentAnalysisResult | null = null;
    const lang = input.lang || 'en';
    try {
      if (onProgress) onProgress({ stage: 'agents', message: 'Agentlar analiz için hazırlanıyor...' });
      console.log('\n🤖 Running Agent Analysis...');
      agentResult = await runAgentAnalysis(
        input.fixtureId,
        input.homeTeamId,
        input.awayTeamId,
        lang,
        onProgress
      );
      if (agentResult) {
        systemsUsed.push('agents');
        console.log('✅ Agent Analysis completed');
      }
    } catch (err) {
      console.error('❌ Agent Analysis failed:', err);
    }

    // 2. Smart Analysis çalıştır (yedek/ek sistem) - Timeout ile
    let smartResult: SmartAnalysisResult | null = null;
    try {
      if (onProgress) onProgress({ stage: 'smart', message: 'Smart-Analyzer veri kontrollerini yapıyor...' });
      console.log('\n📊 Running Smart Analysis (20s timeout)...');
      
      // Smart Analysis timeout: 20 saniye (Vercel Pro ile rahat süre var)
      const SMART_ANALYSIS_TIMEOUT_MS = 20000;
      const smartAnalysisPromise = runSmartAnalysis({
        fixtureId: input.fixtureId,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        league: input.league,
        matchDate: input.matchDate
      });
      
      const smartTimeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('⏱️ Smart Analysis timeout after 20s, skipping...');
          resolve(null);
        }, SMART_ANALYSIS_TIMEOUT_MS);
      });
      
      smartResult = await Promise.race([smartAnalysisPromise, smartTimeoutPromise]);
      
      if (smartResult) {
        systemsUsed.push('smart');
        console.log('✅ Smart Analysis completed');
      } else {
        console.warn('⚠️ Smart Analysis timeout or failed, using Agent Analysis only');
      }
    } catch (err) {
      console.error('❌ Smart Analysis failed:', err);
    }

    // 3. Lig bazlı doğruluk verilerini çek
    let leagueStats = null;
    try {
      leagueStats = await getLeagueAccuracyStats(input.league);
    } catch (err) {
      console.warn('⚠️ Could not fetch league stats for weighting (non-critical)');
    }

    // 4. Konsensüs oluştur
    if (onProgress) onProgress({ stage: 'consensus', message: 'Sistemler arası fikir birliği oluşturuluyor...' });
    console.log('\n🎯 Creating unified consensus (dynamic weighting)...');
    const consensus = await createUnifiedConsensus(agentResult, smartResult, leagueStats);

    const processingTime = Date.now() - startTime;
    if (onProgress) onProgress({ stage: 'complete', message: 'Analiz başarıyla tamamlandı.' });
    console.log(`\n✅ Unified Consensus complete in ${processingTime}ms`);
    console.log(`   📊 Systems used: ${systemsUsed.join(', ')}`);
    console.log(`   🎯 Overall confidence: ${consensus.systemPerformance.overallConfidence}%`);
    console.log(`   🤝 Agreement: ${consensus.systemPerformance.agreement}%`);

    return {
      ...consensus,
      sources: {
        agents: agentResult?.agents || {},
        ai: smartResult ? { smart: smartResult } : undefined
      },
      metadata: {
        processingTime,
        analyzedAt: new Date().toISOString(),
        systemsUsed,
        _debug: agentResult?._debug
      }
    };

  } catch (error) {
    console.error('❌ Unified Consensus error:', error);
    throw error;
  }
}

/**
 * Konsensüs oluşturma fonksiyonu
 */
async function createUnifiedConsensus(
  agentResult: AgentAnalysisResult | null,
  smartResult: SmartAnalysisResult | null,
  leagueStats: any[] | null = null
): Promise<Omit<UnifiedConsensusResult, 'sources' | 'metadata'>> {
  // 🧠 ÖĞRENEN SİSTEM: Agent performansına göre dinamik ağırlıklar
  // Supabase'den gerçek zamanlı performans verilerini çek
  let multipliers: Record<string, number> = {
    stats: 1.0,
    odds: 1.0,
    deepAnalysis: 1.0,
    masterStrategist: 1.0,
    devilsAdvocate: 1.0
  };

  try {
    const { getAgentWeights } = await import('../agent-learning/performance-tracker');
    const learnedWeights = await getAgentWeights(agentResult?.agents?.stats?.league || agentResult?.league);
    const league = agentResult?.agents?.stats?.league || agentResult?.league;
    
    // Öğrenilen ağırlıkları kullan
    let baseMultipliers = {
      stats: learnedWeights.stats || 1.0,
      odds: learnedWeights.odds || 1.0,
      deepAnalysis: learnedWeights.deepAnalysis || 1.0,
      masterStrategist: learnedWeights.masterStrategist || 1.0,
      devilsAdvocate: learnedWeights.devilsAdvocate || 1.0,
    };
    
    // 🆕 Consensus alignment'a göre ağırlıkları ayarla
    // Consensus'a yakın agent'lar daha yüksek ağırlık alır
    try {
      const statsAlignment = await getAgentConsensusAlignment('stats', league);
      const oddsAlignment = await getAgentConsensusAlignment('odds', league);
      const deepAlignment = await getAgentConsensusAlignment('deepAnalysis', league);
      const masterAlignment = await getAgentConsensusAlignment('masterStrategist', league);
      
      multipliers = {
        stats: adjustWeightByConsensusAlignment(baseMultipliers.stats, statsAlignment),
        odds: adjustWeightByConsensusAlignment(baseMultipliers.odds, oddsAlignment),
        deepAnalysis: adjustWeightByConsensusAlignment(baseMultipliers.deepAnalysis, deepAlignment),
        masterStrategist: adjustWeightByConsensusAlignment(baseMultipliers.masterStrategist, masterAlignment),
        devilsAdvocate: baseMultipliers.devilsAdvocate,
      };
      
      console.log(`   🎯 Consensus Alignment Adjusted Weights:`, {
        stats: `${baseMultipliers.stats.toFixed(2)} → ${multipliers.stats.toFixed(2)} (alignment: ${statsAlignment}%)`,
        odds: `${baseMultipliers.odds.toFixed(2)} → ${multipliers.odds.toFixed(2)} (alignment: ${oddsAlignment}%)`,
        deepAnalysis: `${baseMultipliers.deepAnalysis.toFixed(2)} → ${multipliers.deepAnalysis.toFixed(2)} (alignment: ${deepAlignment}%)`,
        masterStrategist: `${baseMultipliers.masterStrategist.toFixed(2)} → ${multipliers.masterStrategist.toFixed(2)} (alignment: ${masterAlignment}%)`,
      });
    } catch (alignmentError) {
      console.warn('   ⚠️ Could not adjust weights by consensus alignment, using base weights:', alignmentError);
      multipliers = baseMultipliers;
    }
    
    console.log(`   🧠 Learned Agent Weights:`, JSON.stringify(multipliers));
  } catch (error) {
    console.warn('   ⚠️ Could not load learned weights, using defaults:', error);
    
    // Fallback: Eski sistem (leagueStats)
  if (leagueStats && leagueStats.length > 0) {
    leagueStats.forEach(stat => {
      if (stat.matchResultAccuracy > 65) multipliers[stat.agent] = 1.25;
      else if (stat.matchResultAccuracy > 55) multipliers[stat.agent] = 1.1;
      else if (stat.matchResultAccuracy < 40) multipliers[stat.agent] = 0.75;
      else if (stat.matchResultAccuracy < 50) multipliers[stat.agent] = 0.9;
    });
    }
  }
  
  console.log(`   ⚖️ Final Multipliers for ${agentResult?.agents?.stats?.league || agentResult?.league || 'league'}:`, JSON.stringify(multipliers));

  // Helper to normalize predictions
  const normalize = (val: any) => {
    if (!val) return val;
    const s = String(val).toLowerCase().trim();
    if (s === 'home' || s === '1') return '1';
    if (s === 'away' || s === '2') return '2';
    if (s === 'draw' || s === 'x') return 'X';
    if (s === 'over') return 'Over';
    if (s === 'under') return 'Under';
    if (s === 'yes') return 'Yes';
    if (s === 'no') return 'No';
    return val;
  };

  // Agent sonuçlarından tahminler
  const agentMR = normalize(agentResult?.matchResult?.prediction || agentResult?.agents?.stats?.matchResult || agentResult?.agents?.deepAnalysis?.matchResult?.prediction);
  const agentMRConf = agentResult?.matchResult?.confidence || agentResult?.agents?.stats?.matchResultConfidence || agentResult?.agents?.deepAnalysis?.matchResult?.confidence || 50;
  const agentOU = normalize(agentResult?.overUnder?.prediction || agentResult?.agents?.stats?.overUnder || agentResult?.agents?.deepAnalysis?.overUnder?.prediction);
  const agentOUConf = agentResult?.overUnder?.confidence || agentResult?.agents?.stats?.overUnderConfidence || agentResult?.agents?.deepAnalysis?.overUnder?.confidence || 50;
  const agentBTTS = normalize(agentResult?.btts?.prediction || agentResult?.agents?.stats?.btts || agentResult?.agents?.deepAnalysis?.btts?.prediction);
  const agentBTTSConf = agentResult?.btts?.confidence || agentResult?.agents?.stats?.bttsConfidence || agentResult?.agents?.deepAnalysis?.btts?.confidence || 50;

  // Smart Analysis sonuçlarından tahminler
  const smartMR = normalize(smartResult?.matchResult?.prediction);
  const smartMRConf = smartResult?.matchResult?.confidence || 50;
  const smartOU = normalize(smartResult?.overUnder?.prediction);
  const smartOUConf = smartResult?.overUnder?.confidence || 50;
  const smartBTTS = normalize(smartResult?.btts?.prediction);
  const smartBTTSConf = smartResult?.btts?.confidence || 50;

  // Master Strategist sonucu (varsa) - en yüksek ağırlık
  const msData = agentResult?.agents?.masterStrategist;
  const msFinal = msData?.final;

  // Helper to find market in recommended bets
  const findMSBet = (marketName: string) => {
    return msData?.recommended_bets?.find((b: any) => b.market === marketName) ||
      msFinal?.recommended_bets?.find((b: any) => b.market === marketName);
  };

  // 1X2 market search
  const ms1X2 = msFinal?.primary_pick?.market === '1X2' ? msFinal.primary_pick : findMSBet('1X2');
  const masterMR = normalize(ms1X2?.selection || msData?.finalConsensus?.matchResult?.prediction);
  const masterMRConf = ms1X2?.confidence || ms1X2?.model_prob * 100 || msData?.finalConsensus?.matchResult?.confidence || 0;

  // O/U market search
  const msOU = msFinal?.primary_pick?.market === 'Over/Under 2.5' ? msFinal.primary_pick : findMSBet('Over/Under 2.5');
  const masterOU = normalize(msOU?.selection || msData?.finalConsensus?.overUnder?.prediction);
  const masterOUConf = msOU?.confidence || msOU?.model_prob * 100 || msData?.finalConsensus?.overUnder?.confidence || 0;

  // BTTS market search
  const msBTTS = msFinal?.primary_pick?.market === 'BTTS' ? msFinal.primary_pick : findMSBet('BTTS');
  const masterBTTS = normalize(msBTTS?.selection || msData?.finalConsensus?.btts?.prediction);
  const masterBTTSConf = msBTTS?.confidence || msBTTS?.model_prob * 100 || msData?.finalConsensus?.btts?.confidence || 0;

  // Genius Analyst sonucu (varsa)
  const geniusMR = normalize(agentResult?.agents?.geniusAnalyst?.predictions?.matchResult?.prediction);
  const geniusMRConf = agentResult?.agents?.geniusAnalyst?.predictions?.matchResult?.confidence || 0;
  const geniusOU = normalize(agentResult?.agents?.geniusAnalyst?.predictions?.overUnder?.prediction);
  const geniusOUConf = agentResult?.agents?.geniusAnalyst?.predictions?.overUnder?.confidence || 0;

  // Devil's Advocate sonucu (varsa) - NEW
  const devilsMR = normalize(agentResult?.agents?.devilsAdvocate?.matchResult);
  const devilsMRConf = agentResult?.agents?.devilsAdvocate?.confidence || 0;
  // Master Strategist: %40, Genius Analyst: %25, Stats Agent: %15, Deep Analysis: %10, Smart Analysis: %10
  const matchResultConsensus = calculateWeightedConsensus(
    [
      { value: masterMR, confidence: masterMRConf, weight: 35 * multipliers.masterStrategist },
      { value: geniusMR, confidence: geniusMRConf, weight: 20 },
      { value: agentMR, confidence: agentMRConf, weight: 15 * multipliers.stats },
      { value: agentResult?.agents?.deepAnalysis?.matchResult?.prediction, confidence: agentResult?.agents?.deepAnalysis?.matchResult?.confidence || 0, weight: 10 * multipliers.deepAnalysis },
      { value: smartMR, confidence: smartMRConf, weight: 10 },
      { value: devilsMR, confidence: devilsMRConf, weight: 10 * multipliers.devilsAdvocate }
    ]
  );

  const overUnderConsensus = calculateWeightedConsensus(
    [
      { value: masterOU, confidence: masterOUConf, weight: 45 * multipliers.masterStrategist },
      { value: geniusOU, confidence: geniusOUConf, weight: 20 },
      { value: agentOU, confidence: agentOUConf, weight: 15 * multipliers.stats },
      { value: agentResult?.agents?.deepAnalysis?.overUnder?.prediction, confidence: agentResult?.agents?.deepAnalysis?.overUnder?.confidence || 0, weight: 10 * multipliers.deepAnalysis },
      { value: smartOU, confidence: smartOUConf, weight: 10 }
    ]
  );

  const bttsConsensus = calculateWeightedConsensus(
    [
      { value: masterBTTS, confidence: masterBTTSConf, weight: 40 * multipliers.masterStrategist },
      { value: agentBTTS, confidence: agentBTTSConf, weight: 30 * multipliers.stats },
      { value: smartBTTS, confidence: smartBTTSConf, weight: 20 },
      { value: agentResult?.agents?.deepAnalysis?.btts?.prediction, confidence: agentResult?.agents?.deepAnalysis?.btts?.confidence || 0, weight: 10 * multipliers.deepAnalysis }
    ]
  );

  // Agreement hesapla
  const agreement = calculateAgreement([
    { matchResult: masterMR || agentMR || smartMR },
    { matchResult: geniusMR || agentMR },
    { matchResult: agentMR },
    { matchResult: smartMR }
  ]);

  // 🆕 GELİŞMİŞ CONFLICT DETECTION - Tüm agent'lar için tutarlılık kontrolü
  const agentPredictions: AgentPrediction[] = [];
  
  // Stats Agent
  if (agentResult?.agents?.stats) {
    const stats = agentResult.agents.stats;
    agentPredictions.push({
      agentName: 'stats',
      matchResult: normalize(stats.matchResult) as '1' | 'X' | '2',
      overUnder: normalize(stats.overUnder) as 'Over' | 'Under',
      btts: normalize(stats.btts) as 'Yes' | 'No',
      confidence: stats.confidence || stats.matchResultConfidence || 50,
      weight: 15 * multipliers.stats,
      reasoning: stats.agentSummary
    });
  }
  
  // Odds Agent
  if (agentResult?.agents?.odds) {
    const odds = agentResult.agents.odds;
    const oddsMR = odds.matchWinnerValue === 'home' ? '1' : odds.matchWinnerValue === 'away' ? '2' : odds.matchWinnerValue === 'draw' ? 'X' : undefined;
    agentPredictions.push({
      agentName: 'odds',
      matchResult: oddsMR,
      overUnder: normalize(odds.recommendation) as 'Over' | 'Under',
      btts: normalize(odds.bttsValue) as 'Yes' | 'No',
      confidence: odds.confidence || 50,
      weight: 20 * multipliers.odds,
      reasoning: odds.agentSummary
    });
  }
  
  // Deep Analysis Agent
  if (agentResult?.agents?.deepAnalysis) {
    const deep = agentResult.agents.deepAnalysis;
    agentPredictions.push({
      agentName: 'deepAnalysis',
      matchResult: normalize(deep.matchResult?.prediction) as '1' | 'X' | '2',
      overUnder: normalize(deep.overUnder?.prediction) as 'Over' | 'Under',
      btts: normalize(deep.btts?.prediction) as 'Yes' | 'No',
      confidence: deep.matchResult?.confidence || deep.overallConfidence || 50,
      weight: 10 * multipliers.deepAnalysis,
      reasoning: deep.agentSummary
    });
  }
  
  // Master Strategist
  if (masterMR || masterOU || masterBTTS) {
    agentPredictions.push({
      agentName: 'masterStrategist',
      matchResult: masterMR as '1' | 'X' | '2',
      overUnder: masterOU as 'Over' | 'Under',
      btts: masterBTTS as 'Yes' | 'No',
      confidence: Math.max(masterMRConf, masterOUConf, masterBTTSConf),
      weight: 35 * multipliers.masterStrategist,
      reasoning: msData?.finalConsensus?.reasoning
    });
  }
  
  // Smart Analysis
  if (smartResult) {
    agentPredictions.push({
      agentName: 'smart',
      matchResult: smartMR as '1' | 'X' | '2',
      overUnder: smartOU as 'Over' | 'Under',
      btts: smartBTTS as 'Yes' | 'No',
      confidence: Math.max(smartMRConf, smartOUConf, smartBTTSConf),
      weight: 10,
      reasoning: smartResult.bestBet?.reason
    });
  }
  
  // Agent tutarlılık validasyonu
  const consensusValidation = validateAgentConsensus(agentPredictions);
  console.log(`   🔍 Agent Consensus Validation: Agreement ${consensusValidation.agreement}%, Conflicts: ${consensusValidation.conflicts.length}`);
  
  if (consensusValidation.conflicts.length > 0) {
    console.log(`   ⚠️ Detected ${consensusValidation.conflicts.length} conflicts:`);
    consensusValidation.conflicts.forEach(conflict => {
      console.log(`      - ${conflict.field}: ${conflict.agents.join(', ')} (${conflict.severity} severity)`);
    });
  }
  
  // Conflict resolution - Confidence düşürme
  const { adjustedPredictions, confidenceReduction } = resolveConflicts(agentPredictions, consensusValidation);
  
  if (confidenceReduction > 0) {
    console.log(`   📉 Confidence reduction due to conflicts: ${confidenceReduction.toFixed(1)}%`);
    // Consensus confidence'lerini düşür
    matchResultConsensus.confidence = Math.max(30, matchResultConsensus.confidence - confidenceReduction);
    overUnderConsensus.confidence = Math.max(30, overUnderConsensus.confidence - confidenceReduction);
    bttsConsensus.confidence = Math.max(30, bttsConsensus.confidence - confidenceReduction);
  }
  
  // Conflict detection (eski format - backward compatibility)
  const systemConflicts: Array<{ field: string; description: string; resolution: string }> = [];
  consensusValidation.conflicts.forEach(conflict => {
    systemConflicts.push({
      field: conflict.field,
      description: `${conflict.agents.join(', ')} agent'ları farklı sonuçlar öneriyor: ${conflict.predictions.join(' vs ')}`,
      resolution: consensusValidation.recommendations.find(r => r.field === conflict.field)?.reasoning || 
                  `Ağırlıklı konsensüs ile çözüldü. Güven seviyesi ${confidenceReduction > 0 ? Math.round(confidenceReduction) + '% düşürüldü' : 'korundu'}.`
    });
  });

  // Best bet belirle
  const bestBet = determineBestBet(agentResult, smartResult, matchResultConsensus, overUnderConsensus, bttsConsensus);

  // Score prediction (en olası skor)
  const expectedGoals = agentResult?.agents?.stats?._calculatedStats?.expectedTotal
    ? parseFloat(agentResult.agents.stats._calculatedStats.expectedTotal)
    : undefined;

  const scorePrediction = predictScore(
    matchResultConsensus.prediction,
    overUnderConsensus.prediction,
    agentResult?.agents?.geniusAnalyst?.predictions?.correctScore?.mostLikely,
    agentResult?.agents?.deepAnalysis?.scorePrediction?.score,
    expectedGoals
  );

  // Overall confidence
  const overallConfidence = Math.round(
    (matchResultConsensus.confidence + overUnderConsensus.confidence + bttsConsensus.confidence) / 3
  );

  // Risk level
  const riskLevel = determineRiskLevel(agreement, overallConfidence, agentResult?.riskLevel);

  // Data quality
  const dataQuality = agentResult?.dataQuality || smartResult?.dataQuality || 'fair';

  // 🆕 Consensus alignment'ı kaydet (gelecekteki ağırlık hesaplamaları için)
  // Agent'ların consensus'a ne kadar yakın olduğunu takip et
  try {
    const finalConsensus = {
      matchResult: matchResultConsensus.prediction,
      overUnder: overUnderConsensus.prediction,
      btts: bttsConsensus.prediction
    };

    // Her agent için consensus alignment'ı hesapla ve kaydet
    for (const agentPred of agentPredictions) {
      const alignment = calculateConsensusAlignment(
        {
          matchResult: agentPred.matchResult,
          overUnder: agentPred.overUnder,
          btts: agentPred.btts
        },
        finalConsensus
      );
      
      // Background'da kaydet (await etme, hata olursa devam et)
      recordConsensusAlignment(
        agentResult?.fixtureId || 0,
        agentPred.agentName,
        { ...alignment, agentName: agentPred.agentName, fixtureId: agentResult?.fixtureId || 0 }
      ).catch(err => {
        console.warn(`⚠️ Could not record consensus alignment for ${agentPred.agentName}:`, err);
      });
    }
  } catch (alignmentError) {
    console.warn('⚠️ Could not calculate consensus alignment:', alignmentError);
  }

  return {
    predictions: {
      matchResult: {
        prediction: matchResultConsensus.prediction as '1' | 'X' | '2',
        confidence: matchResultConsensus.confidence,
        reasoning: matchResultConsensus.reasoning,
        scorePrediction
      },
      overUnder: {
        prediction: overUnderConsensus.prediction as 'Over' | 'Under',
        confidence: overUnderConsensus.confidence,
        reasoning: overUnderConsensus.reasoning,
        expectedGoals: agentResult?.agents?.stats?._calculatedStats?.expectedTotal
          ? parseFloat(agentResult.agents.stats._calculatedStats.expectedTotal)
          : 2.5
      },
      btts: {
        prediction: bttsConsensus.prediction as 'Yes' | 'No',
        confidence: bttsConsensus.confidence,
        reasoning: bttsConsensus.reasoning
      }
    },
    bestBet,
    systemPerformance: {
      overallConfidence,
      agreement,
      riskLevel,
      dataQuality: dataQuality as 'excellent' | 'good' | 'fair' | 'poor',
      expertAgents: Object.entries(multipliers)
        .filter(([_, mult]) => mult > 1.1)
        .map(([name, _]) => name),
      conflicts: systemConflicts
    }
  };
}

/**
 * Ağırlıklı konsensüs hesaplama
 */
function calculateWeightedConsensus(
  sources: Array<{ value: any; confidence: number; weight: number }>
): { prediction: string; confidence: number; reasoning: string } {
  const validSources = sources.filter(s => s.value && s.confidence > 0);

  if (validSources.length === 0) {
    return { prediction: 'X', confidence: 50, reasoning: 'Yetersiz veri' };
  }

  // Oylama sistemi - orijinal değerleri saklayarak karşılaştırma yap
  const votes: Record<string, { count: number; totalConfidence: number; totalWeight: number; originalValue: string }> = {};

  validSources.forEach(source => {
    const originalValue = String(source.value);
    const key = originalValue.toUpperCase(); // Sadece karşılaştırma için
    if (!votes[key]) {
      votes[key] = { count: 0, totalConfidence: 0, totalWeight: 0, originalValue };
    }
    votes[key].count += 1;
    votes[key].totalConfidence += source.confidence * (source.weight / 100);
    votes[key].totalWeight += source.weight;
  });

  // En yüksek ağırlıklı oy
  let bestPrediction = '';
  let bestOriginal = '';
  let bestScore = 0;

  Object.entries(votes).forEach(([prediction, stats]) => {
    const score = stats.totalConfidence * (stats.totalWeight / 100);
    if (score > bestScore) {
      bestScore = score;
      bestPrediction = prediction;
      bestOriginal = stats.originalValue; // Orijinal case'i sakla
    }
  });

  // Ortalama confidence
  const avgConfidence = Math.round(
    validSources.reduce((sum, s) => sum + s.confidence * (s.weight / 100), 0) /
    validSources.reduce((sum, s) => sum + s.weight / 100, 0)
  );

  const reasoning = `${validSources.length} sistem analizi. ${bestOriginal} yönünde ${Math.round(bestScore)}% ağırlıklı oy.`;

  // Normalize prediction values for database constraints
  let normalizedPrediction = bestOriginal;

  // Match Result: 1, X, 2
  if (['1', 'X', '2'].includes(bestOriginal.toUpperCase())) {
    normalizedPrediction = bestOriginal.toUpperCase();
  }
  // Over/Under
  else if (bestOriginal.toUpperCase() === 'OVER') {
    normalizedPrediction = 'Over';
  } else if (bestOriginal.toUpperCase() === 'UNDER') {
    normalizedPrediction = 'Under';
  }
  // BTTS
  else if (bestOriginal.toUpperCase() === 'YES') {
    normalizedPrediction = 'Yes';
  } else if (bestOriginal.toUpperCase() === 'NO') {
    normalizedPrediction = 'No';
  }

  // DÜZELTME: Güven skorları kalibre edildi
  // Max %85 → %75 (gerçek dünya doğruluk oranlarıyla uyumlu)
  // Çok yüksek güven vermek yanıltıcı - gerçek doğruluk %29-65 arası
  return {
    prediction: normalizedPrediction,
    confidence: Math.min(75, Math.max(50, avgConfidence * 0.9)), // %10 düşürüldü
    reasoning
  };
}

/**
 * Agreement hesaplama (sistemlerin ne kadar hemfikir olduğu)
 */
function calculateAgreement(
  sources: Array<{ matchResult?: string }>
): number {
  const validSources = sources.filter(s => s.matchResult);
  if (validSources.length < 2) return 50;

  const predictions = validSources.map(s => String(s.matchResult).toUpperCase());
  const unique = new Set(predictions);

  // Aynı tahmin sayısı / toplam kaynak sayısı
  const agreement = (predictions.length - unique.size + 1) / predictions.length * 100;
  return Math.round(agreement);
}

/**
 * Best bet belirleme
 */
function determineBestBet(
  agentResult: AgentAnalysisResult | null,
  smartResult: SmartAnalysisResult | null,
  matchResult: { prediction: string; confidence: number },
  overUnder: { prediction: string; confidence: number },
  btts: { prediction: string; confidence: number }
): UnifiedConsensusResult['bestBet'] {

  // Master Strategist'in best bet'i varsa öncelik ver
  if (agentResult?.agents?.masterStrategist?.bestBets?.[0]) {
    const msBet = agentResult.agents.masterStrategist.bestBets[0];
    return {
      market: msBet.market,
      selection: msBet.selection,
      confidence: msBet.confidence,
      value: msBet.value,
      reasoning: msBet.reasoning,
      recommendedStake: msBet.recommendedStake
    };
  }

  // Genius Analyst'in best bet'i varsa kullan
  if (agentResult?.agents?.geniusAnalyst?.finalRecommendation?.bestBet) {
    const gaBet = agentResult.agents.geniusAnalyst.finalRecommendation.bestBet;
    return {
      market: gaBet.market,
      selection: gaBet.selection,
      confidence: gaBet.confidence,
      value: gaBet.value,
      reasoning: gaBet.reasoning || '',
      recommendedStake: gaBet.stake
    };
  }

  // En yüksek confidence'lı tahmini seç
  const bets = [
    { market: 'Match Result', selection: matchResult.prediction, confidence: matchResult.confidence },
    { market: 'Over/Under 2.5', selection: overUnder.prediction, confidence: overUnder.confidence },
    { market: 'BTTS', selection: btts.prediction, confidence: btts.confidence }
  ];

  bets.sort((a, b) => b.confidence - a.confidence);
  const best = bets[0];

  return {
    market: best.market,
    selection: best.selection,
    confidence: best.confidence,
    value: best.confidence >= 70 ? 'high' : best.confidence >= 60 ? 'medium' : 'low',
    reasoning: `${best.market} için en yüksek güven seviyesi (${best.confidence}%)`,
    recommendedStake: best.confidence >= 75 ? 'high' : best.confidence >= 65 ? 'medium' : 'low'
  };
}

/**
 * Skor tahmini - En olası skorları hesapla
 */
function predictScore(
  matchResult: string,
  overUnder: string,
  geniusScore?: string,
  deepScore?: string,
  expectedGoals?: number
): string {
  // Öncelik: Genius Analyst veya Deep Analysis'in skor tahmini
  if (geniusScore) return geniusScore;
  if (deepScore) return deepScore;

  // Beklenen gollere göre tahmin
  if (expectedGoals) {
    const homeExpected = expectedGoals * 0.55; // Ev sahibi genelde biraz daha fazla gol atar
    const awayExpected = expectedGoals * 0.45;

    // En yakın skorları hesapla
    const homeGoals = Math.round(homeExpected);
    const awayGoals = Math.round(awayExpected);

    // Maç sonucu ile uyumlu olmalı
    if (matchResult === '1' && homeGoals > awayGoals) {
      return `${homeGoals}-${awayGoals}`;
    }
    if (matchResult === '2' && awayGoals > homeGoals) {
      return `${homeGoals}-${awayGoals}`;
    }
    if (matchResult === 'X') {
      return `${homeGoals}-${awayGoals}`;
    }
  }

  // Basit tahmin (fallback)
  if (matchResult === '1' && overUnder === 'Over') return '2-1';
  if (matchResult === '1' && overUnder === 'Under') return '1-0';
  if (matchResult === '2' && overUnder === 'Over') return '1-2';
  if (matchResult === '2' && overUnder === 'Under') return '0-1';
  if (matchResult === 'X' && overUnder === 'Over') return '2-2';
  return '1-1';
}

/**
 * Risk seviyesi belirleme
 */
function determineRiskLevel(
  agreement: number,
  confidence: number,
  agentRisk?: string
): 'low' | 'medium' | 'high' {
  if (agentRisk) return agentRisk as 'low' | 'medium' | 'high';

  if (agreement >= 75 && confidence >= 70) return 'low';
  if (agreement >= 60 && confidence >= 60) return 'medium';
  return 'high';
}

/**
 * Unified Analysis'i veritabanına kaydet
 */
export async function saveUnifiedAnalysis(
  input: UnifiedAnalysisInput,
  result: UnifiedConsensusResult
): Promise<boolean> {
  try {
    console.log('💾 Saving unified analysis for fixture', input.fixtureId);

    // Use full match_date timestamp if available
    const matchDate = input.matchDate || new Date().toISOString();

    // Ensure predictions are valid enum values
    const mrPrediction = result.predictions.matchResult.prediction;
    const ouPrediction = result.predictions.overUnder.prediction;
    const bttsPrediction = result.predictions.btts.prediction;

    console.log(`   📊 Predictions: MR=${mrPrediction}, OU=${ouPrediction}, BTTS=${bttsPrediction}`);

    const supabase = getSupabase();
    const { error } = await supabase
      .from('unified_analysis')
      .upsert({
        fixture_id: input.fixtureId,
        home_team: input.homeTeam,
        away_team: input.awayTeam,
        league: input.league,
        match_date: matchDate,
        analysis: result,
        match_result_prediction: mrPrediction,
        match_result_confidence: Math.round(result.predictions.matchResult.confidence),
        over_under_prediction: ouPrediction,
        over_under_confidence: Math.round(result.predictions.overUnder.confidence),
        btts_prediction: bttsPrediction,
        btts_confidence: Math.round(result.predictions.btts.confidence),
        best_bet_market: result.bestBet.market,
        best_bet_selection: result.bestBet.selection,
        best_bet_confidence: Math.round(result.bestBet.confidence),
        overall_confidence: result.systemPerformance.overallConfidence,
        agreement: result.systemPerformance.agreement,
        risk_level: result.systemPerformance.riskLevel,
        data_quality: result.systemPerformance.dataQuality,
        processing_time: result.metadata.processingTime,
        systems_used: result.metadata.systemsUsed,
        is_settled: false,
        created_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (error) {
      console.error('❌ Error saving unified analysis:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return false;
    }

    console.log('✅ Unified analysis saved to database');

    // 🧠 ÖĞRENEN SİSTEM: Agent tahminlerini agent_predictions tablosuna kaydet
    // Bu sayede settlement sırasında agent performansları güncellenebilir
    try {
      const { recordAgentPrediction } = await import('../agent-learning/performance-tracker');
      
      // Match date'i normalize et (sadece tarih kısmı)
      const normalizedMatchDate = matchDate.includes('T') 
        ? matchDate.split('T')[0] 
        : matchDate;

      // Kaynak agent verilerini al
      const agents = result.sources?.agents || {};
      
      // DEBUG: Agent verilerini logla
      console.log('🧠 Agent Learning - Recording predictions for fixture:', input.fixtureId);
      console.log('   Available agents:', Object.keys(agents));
      console.log('   Stats agent data:', agents.stats ? 'present' : 'missing');
      console.log('   Odds agent data:', agents.odds ? 'present' : 'missing');
      console.log('   DeepAnalysis data:', agents.deepAnalysis ? 'present' : 'missing');
      console.log('   MasterStrategist data:', agents.masterStrategist ? 'present' : 'missing');

      // Stats Agent tahmini
      if (agents.stats) {
        console.log('   📊 Recording stats prediction:', agents.stats.matchResult);
        await recordAgentPrediction(
          input.fixtureId,
          'stats',
          {
            matchResult: agents.stats.matchResult ? {
              prediction: agents.stats.matchResult,
              confidence: agents.stats.matchResultConfidence || 50
            } : undefined,
            overUnder: agents.stats.overUnder ? {
              prediction: agents.stats.overUnder,
              confidence: agents.stats.overUnderConfidence || 50
            } : undefined,
            btts: agents.stats.btts ? {
              prediction: agents.stats.btts,
              confidence: agents.stats.bttsConfidence || 50
            } : undefined,
          },
          input.league,
          normalizedMatchDate
        ).catch(err => console.warn('⚠️ Failed to record stats prediction:', err));
        console.log('   ✅ Stats prediction recorded');
      } else {
        console.log('   ⚠️ No stats agent data to record');
      }

      // Odds Agent tahmini
      if (agents.odds) {
        console.log('   📊 Recording odds prediction:', agents.odds.matchWinnerValue);
        await recordAgentPrediction(
          input.fixtureId,
          'odds',
          {
            matchResult: agents.odds.matchWinnerValue ? {
              prediction: agents.odds.matchWinnerValue,
              confidence: agents.odds.confidence || 50
            } : undefined,
            overUnder: agents.odds.recommendation ? {
              prediction: agents.odds.recommendation,
              confidence: agents.odds.confidence || 50
            } : undefined,
            btts: agents.odds.bttsValue ? {
              prediction: agents.odds.bttsValue,
              confidence: agents.odds.confidence || 50
            } : undefined,
          },
          input.league,
          normalizedMatchDate
        ).catch(err => console.warn('⚠️ Failed to record odds prediction:', err));
        console.log('   ✅ Odds prediction recorded');
      } else {
        console.log('   ⚠️ No odds agent data to record');
      }

      // Deep Analysis Agent tahmini
      if (agents.deepAnalysis) {
        console.log('   📊 Recording deepAnalysis prediction');
        await recordAgentPrediction(
          input.fixtureId,
          'deepAnalysis',
          {
            matchResult: agents.deepAnalysis.matchResult ? {
              prediction: agents.deepAnalysis.matchResult.prediction || agents.deepAnalysis.matchResult,
              confidence: agents.deepAnalysis.matchResult.confidence || 50
            } : undefined,
            overUnder: agents.deepAnalysis.overUnder ? {
              prediction: agents.deepAnalysis.overUnder.prediction || agents.deepAnalysis.overUnder,
              confidence: agents.deepAnalysis.overUnder.confidence || 50
            } : undefined,
            btts: agents.deepAnalysis.btts ? {
              prediction: agents.deepAnalysis.btts.prediction || agents.deepAnalysis.btts,
              confidence: agents.deepAnalysis.btts.confidence || 50
            } : undefined,
          },
          input.league,
          normalizedMatchDate
        ).catch(err => console.warn('⚠️ Failed to record deepAnalysis prediction:', err));
        console.log('   ✅ DeepAnalysis prediction recorded');
      } else {
        console.log('   ⚠️ No deepAnalysis agent data to record');
      }

      // Master Strategist tahmini
      if (agents.masterStrategist?.finalConsensus) {
        console.log('   📊 Recording masterStrategist prediction');
        const ms = agents.masterStrategist.finalConsensus;
        await recordAgentPrediction(
          input.fixtureId,
          'masterStrategist',
          {
            matchResult: ms.matchResult ? {
              prediction: ms.matchResult.prediction || ms.matchResult,
              confidence: ms.matchResult.confidence || 50
            } : undefined,
            overUnder: ms.overUnder ? {
              prediction: ms.overUnder.prediction || ms.overUnder,
              confidence: ms.overUnder.confidence || 50
            } : undefined,
            btts: ms.btts ? {
              prediction: ms.btts.prediction || ms.btts,
              confidence: ms.btts.confidence || 50
            } : undefined,
          },
          input.league,
          normalizedMatchDate
        ).catch(err => console.warn('⚠️ Failed to record masterStrategist prediction:', err));
        console.log('   ✅ MasterStrategist prediction recorded');
      } else {
        console.log('   ⚠️ No masterStrategist finalConsensus data to record');
      }

      console.log('✅ Agent predictions recording completed for learning system');
    } catch (agentError) {
      console.warn('⚠️ Failed to record agent predictions (non-blocking):', agentError);
      // Non-blocking - ana kayıt başarılı olduğu için true döndür
    }

    return true;
  } catch (error: any) {
    console.error('❌ Exception saving unified analysis:', error?.message || error);
    return false;
  }
}

