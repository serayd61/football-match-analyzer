// ============================================================================
// DOMINANT AGENT SELECTION & TEAM MEMORY SYSTEM
// En başarılı ajanı seç ve takım hafızasını kullan
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

export interface AgentPerformance {
  agentName: string;
  matchResultAccuracy: number;
  overUnderAccuracy: number;
  bttsAccuracy: number;
  totalMatches: number;
  recent5Accuracy: number;
  calibrationScore: number;
  overallScore: number;
}

export interface DominantAgentResult {
  matchResult: {
    agent: string;
    accuracy: number;
    prediction: string;
    confidence: number;
  };
  overUnder: {
    agent: string;
    accuracy: number;
    prediction: string;
    confidence: number;
  };
  btts: {
    agent: string;
    accuracy: number;
    prediction: string;
    confidence: number;
  };
}

export interface TeamMatchupMemory {
  homeTeamId: number;
  awayTeamId: number;
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  avgTotalGoals: number;
  bttsRate: number;
  over25Rate: number;
  lastMatchResult: string;
  lastMatchScore: string;
  patterns: string[];
  agentAccuracyForMatchup: Record<string, {
    matchResultAccuracy: number;
    overUnderAccuracy: number;
    bttsAccuracy: number;
    totalPredictions: number;
  }>;
}

// ============================================================================
// DOMINANT AGENT SELECTION
// Her market için en başarılı ajanı bul
// ============================================================================

export async function getDominantAgents(
  league?: string
): Promise<Record<string, AgentPerformance>> {
  try {
    // agent_performance tablosundan en başarılı ajanları çek
    // NOT: Minimum 3 maç yeterli (başlangıç için)
    
    // Önce genel performansı al (league IS NULL)
    // Bu, tüm liglerdeki toplam performansı gösterir
    const { data, error } = await supabase
      .from('agent_performance')
      .select('*')
      .is('league', null) // Genel performans (tüm ligler)
      .gte('total_matches', 3); // En az 3 maç oynamış olmalı
    
    if (error) {
      console.warn('⚠️ Agent performance query error:', error.message);
      console.warn('   Tablo mevcut mu? agent_performance tablosunu kontrol edin.');
      return getDefaultAgentPerformance();
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ No agent performance data found (min 3 matches required)');
      console.warn('   Henüz yeterli maç analizi yapılmamış. Default değerler kullanılıyor.');
      return getDefaultAgentPerformance();
    }
    
    console.log(`✅ Agent performance data found: ${data.length} agents with sufficient matches`);
    
    // Her ajan için performans hesapla
    const agentPerformance: Record<string, AgentPerformance> = {};
    
    for (const row of data) {
      const agentName = row.agent_name;
      
      // Overall score hesapla
      // NOT: Tablo kolonları: recent_match_result_accuracy, recent_over_under_accuracy, recent_btts_accuracy
      const matchResultAcc = parseFloat(row.recent_match_result_accuracy) || parseFloat(row.match_result_accuracy) || 0;
      const overUnderAcc = parseFloat(row.recent_over_under_accuracy) || parseFloat(row.over_under_accuracy) || 0;
      const bttsAcc = parseFloat(row.recent_btts_accuracy) || parseFloat(row.btts_accuracy) || 0;
      
      // Calibration ve momentum için varsayılan değerler (tablo yapısında yok)
      const avgAccuracy = (matchResultAcc + overUnderAcc + bttsAcc) / 3;
      const calibration = 50; // Varsayılan
      const momentum = avgAccuracy; // Son accuracy'yi momentum olarak kullan
      
      // Ağırlıklı skor: %60 accuracy + %20 calibration + %20 momentum
      const overallScore = avgAccuracy * 0.6 + calibration * 0.2 + momentum * 0.2;
      
      agentPerformance[agentName] = {
        agentName,
        matchResultAccuracy: matchResultAcc,
        overUnderAccuracy: overUnderAcc,
        bttsAccuracy: bttsAcc,
        totalMatches: row.total_matches || 0,
        recent5Accuracy: momentum,
        calibrationScore: calibration,
        overallScore
      };
      
      console.log(`   📊 ${agentName}: MR=${matchResultAcc.toFixed(1)}%, OU=${overUnderAcc.toFixed(1)}%, BTTS=${bttsAcc.toFixed(1)}% (${row.total_matches} matches)`);
    }
    
    return agentPerformance;
  } catch (error) {
    console.error('Error getting dominant agents:', error);
    return getDefaultAgentPerformance();
  }
}

function getDefaultAgentPerformance(): Record<string, AgentPerformance> {
  return {
    stats: {
      agentName: 'stats',
      matchResultAccuracy: 40,
      overUnderAccuracy: 50,
      bttsAccuracy: 50,
      totalMatches: 0,
      recent5Accuracy: 50,
      calibrationScore: 50,
      overallScore: 50
    },
    odds: {
      agentName: 'odds',
      matchResultAccuracy: 40,
      overUnderAccuracy: 50,
      bttsAccuracy: 50,
      totalMatches: 0,
      recent5Accuracy: 50,
      calibrationScore: 50,
      overallScore: 50
    },
    deepAnalysis: {
      agentName: 'deepAnalysis',
      matchResultAccuracy: 40,
      overUnderAccuracy: 50,
      bttsAccuracy: 50,
      totalMatches: 0,
      recent5Accuracy: 50,
      calibrationScore: 50,
      overallScore: 50
    },
    masterStrategist: {
      agentName: 'masterStrategist',
      matchResultAccuracy: 45,
      overUnderAccuracy: 55,
      bttsAccuracy: 50,
      totalMatches: 0,
      recent5Accuracy: 50,
      calibrationScore: 50,
      overallScore: 55
    }
  };
}

/**
 * Her market için en başarılı ajanı seç
 */
export function selectDominantAgentForMarket(
  agentPerformance: Record<string, AgentPerformance>,
  market: 'matchResult' | 'overUnder' | 'btts'
): { agent: string; accuracy: number } {
  let bestAgent = 'masterStrategist';
  let bestAccuracy = 0;
  
  for (const [agentName, perf] of Object.entries(agentPerformance)) {
    let accuracy = 0;
    
    switch (market) {
      case 'matchResult':
        accuracy = perf.matchResultAccuracy;
        break;
      case 'overUnder':
        accuracy = perf.overUnderAccuracy;
        break;
      case 'btts':
        accuracy = perf.bttsAccuracy;
        break;
    }
    
    // Momentum bonus: Son 5 maçta iyi performans gösterenlere bonus
    const momentumBonus = perf.recent5Accuracy > 60 ? 5 : 0;
    const adjustedAccuracy = accuracy + momentumBonus;
    
    if (adjustedAccuracy > bestAccuracy && perf.totalMatches >= 5) {
      bestAccuracy = adjustedAccuracy;
      bestAgent = agentName;
    }
  }
  
  return { agent: bestAgent, accuracy: bestAccuracy };
}

// ============================================================================
// TEAM MATCHUP MEMORY
// Takım eşleşme hafızası
// ============================================================================

/**
 * İki takım arasındaki geçmiş maçları ve pattern'leri getir
 */
export async function getTeamMatchupMemory(
  homeTeamId: number,
  awayTeamId: number
): Promise<TeamMatchupMemory | null> {
  try {
    console.log(`   🔍 Looking for team matchup: ${homeTeamId} vs ${awayTeamId}`);
    
    // team_matchup_memory tablosundan veri çek
    const { data, error } = await supabase
      .from('team_matchup_memory')
      .select('*')
      .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.log(`   ⚠️ Team matchup query error: ${error.message}`);
      return null;
    }
    
    if (!data) {
      console.log(`   ℹ️ No previous matchup found for these teams`);
      return null;
    }
    
    console.log(`   ✅ Found matchup history: ${data.total_matches} matches, avg ${data.avg_total_goals?.toFixed(1)} goals`);
    
    return {
      homeTeamId: data.home_team_id,
      awayTeamId: data.away_team_id,
      totalMatches: data.total_matches,
      homeWins: data.home_wins,
      draws: data.draws,
      awayWins: data.away_wins,
      avgTotalGoals: data.avg_total_goals,
      bttsRate: data.btts_rate,
      over25Rate: data.over_25_rate,
      lastMatchResult: data.last_match_result,
      lastMatchScore: data.last_match_score,
      patterns: data.patterns || [],
      agentAccuracyForMatchup: data.agent_accuracy || {}
    };
  } catch (error) {
    console.error('Error getting team matchup memory:', error);
    return null;
  }
}

/**
 * Takım eşleşme hafızasını güncelle (maç sonrası)
 */
export async function updateTeamMatchupMemory(
  homeTeamId: number,
  awayTeamId: number,
  matchResult: '1' | 'X' | '2',
  homeGoals: number,
  awayGoals: number,
  agentPredictions: Record<string, {
    matchResult: string;
    overUnder: string;
    btts: string;
  }>
): Promise<void> {
  try {
    // Mevcut veriyi al
    const existing = await getTeamMatchupMemory(homeTeamId, awayTeamId);
    
    const totalGoals = homeGoals + awayGoals;
    const btts = homeGoals > 0 && awayGoals > 0;
    const over25 = totalGoals > 2.5;
    
    // Yeni pattern'leri tespit et
    const patterns: string[] = existing?.patterns || [];
    
    // Pattern analizi
    if (totalGoals <= 1) {
      if (!patterns.includes('LOW_SCORING_MATCHUP')) {
        patterns.push('LOW_SCORING_MATCHUP');
      }
    } else if (totalGoals >= 4) {
      if (!patterns.includes('HIGH_SCORING_MATCHUP')) {
        patterns.push('HIGH_SCORING_MATCHUP');
      }
    }
    
    if (matchResult === 'X' && existing && existing.draws >= 2) {
      if (!patterns.includes('DRAW_PRONE')) {
        patterns.push('DRAW_PRONE');
      }
    }
    
    // Agent accuracy güncelle
    const agentAccuracy = existing?.agentAccuracyForMatchup || {};
    const actualOverUnder = over25 ? 'Over' : 'Under';
    const actualBtts = btts ? 'Yes' : 'No';
    
    for (const [agentName, prediction] of Object.entries(agentPredictions)) {
      if (!agentAccuracy[agentName]) {
        agentAccuracy[agentName] = {
          matchResultAccuracy: 0,
          overUnderAccuracy: 0,
          bttsAccuracy: 0,
          totalPredictions: 0
        };
      }
      
      const current = agentAccuracy[agentName];
      const total = current.totalPredictions;
      
      // Rolling average güncelle
      const mrCorrect = prediction.matchResult === matchResult ? 1 : 0;
      const ouCorrect = prediction.overUnder === actualOverUnder ? 1 : 0;
      const bttsCorrect = prediction.btts === actualBtts ? 1 : 0;
      
      agentAccuracy[agentName] = {
        matchResultAccuracy: ((current.matchResultAccuracy * total) + (mrCorrect * 100)) / (total + 1),
        overUnderAccuracy: ((current.overUnderAccuracy * total) + (ouCorrect * 100)) / (total + 1),
        bttsAccuracy: ((current.bttsAccuracy * total) + (bttsCorrect * 100)) / (total + 1),
        totalPredictions: total + 1
      };
    }
    
    // Upsert
    const newData = {
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      total_matches: (existing?.totalMatches || 0) + 1,
      home_wins: (existing?.homeWins || 0) + (matchResult === '1' ? 1 : 0),
      draws: (existing?.draws || 0) + (matchResult === 'X' ? 1 : 0),
      away_wins: (existing?.awayWins || 0) + (matchResult === '2' ? 1 : 0),
      avg_total_goals: existing 
        ? ((existing.avgTotalGoals * existing.totalMatches) + totalGoals) / (existing.totalMatches + 1)
        : totalGoals,
      btts_rate: existing
        ? ((existing.bttsRate * existing.totalMatches) + (btts ? 100 : 0)) / (existing.totalMatches + 1)
        : (btts ? 100 : 0),
      over_25_rate: existing
        ? ((existing.over25Rate * existing.totalMatches) + (over25 ? 100 : 0)) / (existing.totalMatches + 1)
        : (over25 ? 100 : 0),
      last_match_result: matchResult,
      last_match_score: `${homeGoals}-${awayGoals}`,
      patterns,
      agent_accuracy: agentAccuracy,
      updated_at: new Date().toISOString()
    };
    
    await supabase
      .from('team_matchup_memory')
      .upsert(newData, { onConflict: 'home_team_id,away_team_id' });
    
    console.log(`✅ Team matchup memory updated: ${homeTeamId} vs ${awayTeamId}`);
  } catch (error) {
    console.error('Error updating team matchup memory:', error);
  }
}

// ============================================================================
// TEAM PERFORMANCE MEMORY
// Takım bazlı performans hafızası (son N maç)
// ============================================================================

export interface TeamPerformanceMemory {
  teamId: number;
  teamName: string;
  last5Goals: number[];
  last5Conceded: number[];
  avgGoalsScored: number;
  avgGoalsConceded: number;
  cleanSheetRate: number;
  failedToScoreRate: number;
  over25Rate: number;
  bttsRate: number;
  homeForm: string;
  awayForm: string;
  patterns: string[];
}

/**
 * Takımın son maçlarına göre pattern'leri tespit et
 */
export function detectTeamPatterns(
  last5Goals: number[],
  last5Conceded: number[]
): string[] {
  const patterns: string[] = [];
  
  const avgScored = last5Goals.reduce((a, b) => a + b, 0) / last5Goals.length;
  const avgConceded = last5Conceded.reduce((a, b) => a + b, 0) / last5Conceded.length;
  
  // Gol atma pattern'leri
  if (avgScored < 0.8) {
    patterns.push('STRUGGLING_TO_SCORE');
  } else if (avgScored > 2.0) {
    patterns.push('HIGH_SCORING_TEAM');
  }
  
  // Gol yeme pattern'leri
  if (avgConceded < 0.8) {
    patterns.push('SOLID_DEFENSE');
  } else if (avgConceded > 2.0) {
    patterns.push('LEAKY_DEFENSE');
  }
  
  // Son 3 maçta gol yememe
  if (last5Conceded.slice(0, 3).every(g => g === 0)) {
    patterns.push('CLEAN_SHEET_STREAK');
  }
  
  // Son 3 maçta gol atamama
  if (last5Goals.slice(0, 3).every(g => g === 0)) {
    patterns.push('GOAL_DROUGHT');
  }
  
  // BTTS pattern
  const bttsCount = last5Goals.filter((g, i) => g > 0 && last5Conceded[i] > 0).length;
  if (bttsCount >= 4) {
    patterns.push('BTTS_PRONE');
  } else if (bttsCount <= 1) {
    patterns.push('BTTS_UNLIKELY');
  }
  
  // Over/Under pattern
  const overCount = last5Goals.filter((g, i) => g + last5Conceded[i] > 2.5).length;
  if (overCount >= 4) {
    patterns.push('OVER_PRONE');
  } else if (overCount <= 1) {
    patterns.push('UNDER_PRONE');
  }
  
  return patterns;
}

// ============================================================================
// GENERATE LEARNING CONTEXT FOR AGENTS
// Ajanlar için öğrenme bağlamı oluştur
// ============================================================================

export interface AgentLearningContext {
  dominantAgents: {
    matchResult: { agent: string; accuracy: number };
    overUnder: { agent: string; accuracy: number };
    btts: { agent: string; accuracy: number };
  };
  teamMatchup: TeamMatchupMemory | null;
  homeTeamPatterns: string[];
  awayTeamPatterns: string[];
  recommendations: string[];
}

export async function generateAgentLearningContext(
  homeTeamId: number,
  awayTeamId: number,
  homeTeamName: string,
  awayTeamName: string,
  league?: string,
  homeStats?: { last5Goals?: number[]; last5Conceded?: number[] },
  awayStats?: { last5Goals?: number[]; last5Conceded?: number[] }
): Promise<AgentLearningContext> {
  // Dominant agent'ları al
  const agentPerformance = await getDominantAgents(league);
  
  const dominantAgents = {
    matchResult: selectDominantAgentForMarket(agentPerformance, 'matchResult'),
    overUnder: selectDominantAgentForMarket(agentPerformance, 'overUnder'),
    btts: selectDominantAgentForMarket(agentPerformance, 'btts')
  };
  
  // Takım eşleşme hafızasını al
  const teamMatchup = await getTeamMatchupMemory(homeTeamId, awayTeamId);
  
  // Takım pattern'lerini tespit et
  const homeTeamPatterns = homeStats?.last5Goals && homeStats?.last5Conceded
    ? detectTeamPatterns(homeStats.last5Goals, homeStats.last5Conceded)
    : [];
  
  const awayTeamPatterns = awayStats?.last5Goals && awayStats?.last5Conceded
    ? detectTeamPatterns(awayStats.last5Goals, awayStats.last5Conceded)
    : [];
  
  // Öneriler oluştur
  const recommendations: string[] = [];
  
  // Takım eşleşme bazlı öneriler
  if (teamMatchup) {
    if (teamMatchup.avgTotalGoals < 2.0) {
      recommendations.push(`⚠️ Bu eşleşmede ortalama ${teamMatchup.avgTotalGoals.toFixed(1)} gol - UNDER eğilimli`);
    } else if (teamMatchup.avgTotalGoals > 3.0) {
      recommendations.push(`🔥 Bu eşleşmede ortalama ${teamMatchup.avgTotalGoals.toFixed(1)} gol - OVER eğilimli`);
    }
    
    if (teamMatchup.bttsRate < 30) {
      recommendations.push(`🛡️ Bu eşleşmede BTTS oranı %${teamMatchup.bttsRate.toFixed(0)} - BTTS NO eğilimli`);
    } else if (teamMatchup.bttsRate > 70) {
      recommendations.push(`⚽ Bu eşleşmede BTTS oranı %${teamMatchup.bttsRate.toFixed(0)} - BTTS YES eğilimli`);
    }
    
    // En başarılı ajan önerisi
    const bestAgentForMatchup = Object.entries(teamMatchup.agentAccuracyForMatchup || {})
      .sort((a, b) => {
        const aScore = (a[1].matchResultAccuracy + a[1].overUnderAccuracy + a[1].bttsAccuracy) / 3;
        const bScore = (b[1].matchResultAccuracy + b[1].overUnderAccuracy + b[1].bttsAccuracy) / 3;
        return bScore - aScore;
      })[0];
    
    if (bestAgentForMatchup && bestAgentForMatchup[1].totalPredictions >= 2) {
      recommendations.push(`🎯 Bu eşleşmede en başarılı ajan: ${bestAgentForMatchup[0]} (%${((bestAgentForMatchup[1].matchResultAccuracy + bestAgentForMatchup[1].overUnderAccuracy + bestAgentForMatchup[1].bttsAccuracy) / 3).toFixed(0)} doğruluk)`);
    }
  }
  
  // Takım pattern bazlı öneriler
  if (homeTeamPatterns.includes('GOAL_DROUGHT') || awayTeamPatterns.includes('GOAL_DROUGHT')) {
    recommendations.push(`⚠️ Gol kuraklığı yaşayan takım var - UNDER ve BTTS NO düşün`);
  }
  
  if (homeTeamPatterns.includes('LEAKY_DEFENSE') && awayTeamPatterns.includes('HIGH_SCORING_TEAM')) {
    recommendations.push(`🔥 Ev sahibi savunması zayıf + Deplasman golcü - Deplasman galibiyeti ve OVER düşün`);
  }
  
  if (homeTeamPatterns.includes('CLEAN_SHEET_STREAK')) {
    recommendations.push(`🛡️ ${homeTeamName} son 3 maçta gol yemedi - BTTS NO ve düşük gol düşün`);
  }
  
  return {
    dominantAgents,
    teamMatchup,
    homeTeamPatterns,
    awayTeamPatterns,
    recommendations
  };
}
