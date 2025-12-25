// ============================================================================
// AGENT ANALYZER - Heurist Blockchain Agents ile Analiz
// Sportmonks verilerini kullanarak 3 agent'ı çalıştırır
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getFullFixtureData, getTeamStats, getHeadToHead, getTeamInjuries, type FullFixtureData } from '@/lib/sportmonks/index';
import { runStatsAgent } from '../heurist/agents/stats';
import { runOddsAgent } from '../heurist/agents/odds';
import { runDeepAnalysisAgent } from '../heurist/agents/deepAnalysis';
import { MatchData } from '../heurist/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// TYPES
// ============================================================================

export interface AgentAnalysisResult {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  
  // Agent sonuçları
  agents: {
    stats?: any;
    odds?: any;
    deepAnalysis?: any;
  };
  
  // Birleştirilmiş tahminler (Agent analizinde kullanılmıyor - sadece yeni özel tahminler kullanılıyor)
  btts?: {
    prediction: string;
    confidence: number;
    reasoning: string;
  };
  overUnder?: {
    prediction: string;
    confidence: number;
    reasoning: string;
  };
  matchResult?: {
    prediction: string;
    confidence: number;
    reasoning: string;
  };
  
  // Korner (eğer varsa)
  corners?: {
    prediction: string;
    confidence: number;
    reasoning: string;
    line: number;
  };
  
  // YENİ: İlk Yarı Gol Tahmini
  halfTimeGoals?: {
    prediction: string; // "over" | "under"
    confidence: number;
    reasoning: string;
    line: number; // Genellikle 1.5 veya 0.5
    expectedGoals: number;
  };
  
  // YENİ: İlk Yarı / Maç Sonucu Kombinasyonu
  halfTimeFullTime?: {
    prediction: string; // "1/1", "1/X", "X/1", "X/X", "2/1", "2/X", "1/2", "X/2", "2/2"
    confidence: number;
    reasoning: string;
  };
  
  // YENİ: Detaylı Maç Sonucu Oranları
  matchResultOdds?: {
    home: number; // 1 oranı (ör: 65%)
    draw: number; // X oranı (ör: 25%)
    away: number; // 2 oranı (ör: 10%)
    reasoning: string;
  };
  
  bestBet: {
    market: string;
    selection: string;
    confidence: number;
    reason: string;
  };
  
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
  overallConfidence: number;
  dataQuality: string;
  processingTime: number;
  analyzedAt: string;
}

// ============================================================================
// FULL FIXTURE DATA → MATCH DATA CONVERTER
// ============================================================================

function convertFullFixtureToMatchData(
  fullData: FullFixtureData,
  additionalData?: {
    homeTeamStats?: any;
    awayTeamStats?: any;
    h2hData?: any;
    homeInjuries?: any[];
    awayInjuries?: any[];
  }
): MatchData {
  const homeForm = fullData.homeTeam.form || 'DDDDD';
  const awayForm = fullData.awayTeam.form || 'DDDDD';
  
  // Home form details
  const homeMatches = fullData.homeTeam.recentMatches || [];
  const homePoints = fullData.homeTeam.formPoints || 5;
  
  // Away form details  
  const awayMatches = fullData.awayTeam.recentMatches || [];
  const awayPoints = fullData.awayTeam.formPoints || 5;
  
  // H2H data
  const h2hMatches = fullData.h2h?.recentMatches || [];
  
  return {
    fixtureId: fullData.fixtureId,
    homeTeam: fullData.homeTeam.name,
    awayTeam: fullData.awayTeam.name,
    homeTeamId: fullData.homeTeam.id,
    awayTeamId: fullData.awayTeam.id,
    league: fullData.league.name,
    date: new Date().toISOString(),
    
    homeForm: {
      form: homeForm,
      points: homePoints,
      wins: (homeForm.match(/W/g) || []).length,
      draws: (homeForm.match(/D/g) || []).length,
      losses: (homeForm.match(/L/g) || []).length,
      avgGoals: calculateAvgGoals(homeMatches, true).toFixed(2),
      avgConceded: calculateAvgGoals(homeMatches, false).toFixed(2),
      over25Percentage: calculateOver25(homeMatches).toFixed(0),
      bttsPercentage: calculateBTTS(homeMatches).toFixed(0),
      cleanSheetPercentage: calculateCleanSheets(homeMatches).toFixed(0),
      matches: homeMatches.slice(0, 10).map((m: any) => ({
        opponent: m.opponent || 'Unknown',
        score: m.score || '0-0',
        result: getResult(m.score || '0-0', true)
      }))
    },
    
    awayForm: {
      form: awayForm,
      points: awayPoints,
      wins: (awayForm.match(/W/g) || []).length,
      draws: (awayForm.match(/D/g) || []).length,
      losses: (awayForm.match(/L/g) || []).length,
      avgGoals: calculateAvgGoals(awayMatches, true).toFixed(2),
      avgConceded: calculateAvgGoals(awayMatches, false).toFixed(2),
      over25Percentage: calculateOver25(awayMatches).toFixed(0),
      bttsPercentage: calculateBTTS(awayMatches).toFixed(0),
      cleanSheetPercentage: calculateCleanSheets(awayMatches).toFixed(0),
      matches: awayMatches.slice(0, 10).map((m: any) => ({
        opponent: m.opponent || 'Unknown',
        score: m.score || '0-0',
        result: getResult(m.score || '0-0', false)
      }))
    },
    
    h2h: {
      totalMatches: fullData.h2h?.totalMatches || 0,
      homeWins: fullData.h2h?.team1Wins || 0,
      awayWins: fullData.h2h?.team2Wins || 0,
      draws: fullData.h2h?.draws || 0,
      avgGoals: (fullData.h2h?.avgGoals || 0).toFixed(2),
      over25Percentage: (fullData.h2h?.over25Percentage || 50).toFixed(0),
      bttsPercentage: (fullData.h2h?.bttsPercentage || 50).toFixed(0),
      matches: h2hMatches.slice(0, 10).map((m: any) => ({
        home: fullData.homeTeam.name,
        away: fullData.awayTeam.name,
        score: `${m.homeScore || 0}-${m.awayScore || 0}`
      }))
    },
    
    odds: fullData.odds ? {
      matchWinner: {
        home: fullData.odds.matchResult.home,
        draw: 3.0, // Default
        away: fullData.odds.matchResult.away
      },
      overUnder: {
        '2.5': {
          over: fullData.odds.overUnder25.over,
          under: fullData.odds.overUnder25.under
        }
      },
      btts: {
        yes: fullData.odds.btts.yes,
        no: fullData.odds.btts.no
      }
    } : undefined,
    
    // Add detailedStats for agents
    detailedStats: additionalData ? {
      home: additionalData.homeTeamStats ? {
        form: additionalData.homeTeamStats.recentForm || homeForm,
        avgGoalsScored: additionalData.homeTeamStats.avgGoalsScored || parseFloat(calculateAvgGoals(homeMatches, true).toFixed(2)),
        avgGoalsConceded: additionalData.homeTeamStats.avgGoalsConceded || parseFloat(calculateAvgGoals(homeMatches, false).toFixed(2)),
        bttsPercentage: additionalData.homeTeamStats.bttsPercentage || parseFloat(calculateBTTS(homeMatches).toFixed(0)),
        over25Percentage: additionalData.homeTeamStats.over25Percentage || parseFloat(calculateOver25(homeMatches).toFixed(0)),
        cleanSheetPercentage: additionalData.homeTeamStats.cleanSheets || parseFloat(calculateCleanSheets(homeMatches).toFixed(0)),
        matchCount: homeMatches.length,
        matchDetails: homeMatches.slice(0, 10).map((m: any) => ({
          opponent: m.opponent || 'Unknown',
          score: m.score || '0-0',
          result: getResult(m.score || '0-0', true),
          goalsScored: parseInt((m.score || '0-0').split('-')[0]) || 0,
          goalsConceded: parseInt((m.score || '0-0').split('-')[1]) || 0,
          date: m.date || ''
        })),
        record: `${(homeForm.match(/W/g) || []).length}W-${(homeForm.match(/D/g) || []).length}D-${(homeForm.match(/L/g) || []).length}L`
      } : undefined,
      away: additionalData.awayTeamStats ? {
        form: additionalData.awayTeamStats.recentForm || awayForm,
        avgGoalsScored: additionalData.awayTeamStats.avgGoalsScored || parseFloat(calculateAvgGoals(awayMatches, true).toFixed(2)),
        avgGoalsConceded: additionalData.awayTeamStats.avgGoalsConceded || parseFloat(calculateAvgGoals(awayMatches, false).toFixed(2)),
        bttsPercentage: additionalData.awayTeamStats.bttsPercentage || parseFloat(calculateBTTS(awayMatches).toFixed(0)),
        over25Percentage: additionalData.awayTeamStats.over25Percentage || parseFloat(calculateOver25(awayMatches).toFixed(0)),
        cleanSheetPercentage: additionalData.awayTeamStats.cleanSheets || parseFloat(calculateCleanSheets(awayMatches).toFixed(0)),
        matchCount: awayMatches.length,
        matchDetails: awayMatches.slice(0, 10).map((m: any) => ({
          opponent: m.opponent || 'Unknown',
          score: m.score || '0-0',
          result: getResult(m.score || '0-0', false),
          goalsScored: parseInt((m.score || '0-0').split('-')[0]) || 0,
          goalsConceded: parseInt((m.score || '0-0').split('-')[1]) || 0,
          date: m.date || ''
        })),
        record: `${(awayForm.match(/W/g) || []).length}W-${(awayForm.match(/D/g) || []).length}D-${(awayForm.match(/L/g) || []).length}L`
      } : undefined,
      h2h: additionalData.h2hData ? {
        totalMatches: additionalData.h2hData.totalMatches || fullData.h2h?.totalMatches || 0,
        homeWins: additionalData.h2hData.team1Wins || fullData.h2h?.team1Wins || 0,
        awayWins: additionalData.h2hData.team2Wins || fullData.h2h?.team2Wins || 0,
        draws: additionalData.h2hData.draws || fullData.h2h?.draws || 0,
        avgTotalGoals: additionalData.h2hData.avgGoals || fullData.h2h?.avgGoals || 0,
        over25Percentage: additionalData.h2hData.over25Percentage || fullData.h2h?.over25Percentage || 50,
        bttsPercentage: additionalData.h2hData.bttsPercentage || fullData.h2h?.bttsPercentage || 50,
        matchDetails: h2hMatches.slice(0, 10).map((m: any) => ({
          home: fullData.homeTeam.name,
          away: fullData.awayTeam.name,
          score: `${m.homeScore || 0}-${m.awayScore || 0}`,
          date: m.date || ''
        }))
      } : undefined,
      injuries: [...(additionalData.homeInjuries || []), ...(additionalData.awayInjuries || [])]
    } : undefined
  } as MatchData & { detailedStats?: any };
}

// Helper functions
function calculateAvgGoals(matches: any[], forGoals: boolean): number {
  if (!matches || matches.length === 0) return 1.2;
  
  let total = 0;
  matches.forEach((m: any) => {
    const score = m.score || '0-0';
    const [home, away] = score.split('-').map((s: string) => parseInt(s) || 0);
    total += forGoals ? home : away;
  });
  
  return total / matches.length;
}

function calculateOver25(matches: any[]): number {
  if (!matches || matches.length === 0) return 50;
  
  let over25Count = 0;
  matches.forEach((m: any) => {
    const score = m.score || '0-0';
    const [home, away] = score.split('-').map((s: string) => parseInt(s) || 0);
    if (home + away > 2.5) over25Count++;
  });
  
  return (over25Count / matches.length) * 100;
}

function calculateBTTS(matches: any[]): number {
  if (!matches || matches.length === 0) return 50;
  
  let bttsCount = 0;
  matches.forEach((m: any) => {
    const score = m.score || '0-0';
    const [home, away] = score.split('-').map((s: string) => parseInt(s) || 0);
    if (home > 0 && away > 0) bttsCount++;
  });
  
  return (bttsCount / matches.length) * 100;
}

function calculateCleanSheets(matches: any[]): number {
  if (!matches || matches.length === 0) return 20;
  
  let cleanSheetCount = 0;
  matches.forEach((m: any) => {
    const score = m.score || '0-0';
    const [, conceded] = score.split('-').map((s: string) => parseInt(s) || 0);
    if (conceded === 0) cleanSheetCount++;
  });
  
  return (cleanSheetCount / matches.length) * 100;
}

function getResult(score: string, isHome: boolean): 'W' | 'D' | 'L' {
  const [home, away] = score.split('-').map((s: string) => parseInt(s) || 0);
  if (isHome) {
    if (home > away) return 'W';
    if (home < away) return 'L';
    return 'D';
  } else {
    if (away > home) return 'W';
    if (away < home) return 'L';
    return 'D';
  }
}

// ============================================================================
// SMART BEST BET CALCULATOR
// ============================================================================

function calculateSmartBestBet(
  stats: any,
  odds: any,
  deepAnalysis: any,
  halfTimeGoals?: any,
  halfTimeFullTime?: any,
  matchResultOdds?: any
): { market: string; selection: string; confidence: number; reason: string } {
  
  // Agent'ların BTTS tahminlerini topla
  const bttsPredictions: { prediction: string; confidence: number; source: string }[] = [];
  if (stats?.btts && stats?.bttsConfidence) {
    bttsPredictions.push({
      prediction: stats.btts === 'Yes' ? 'Evet' : 'Hayır',
      confidence: stats.bttsConfidence,
      source: 'Stats Agent'
    });
  }
  if (odds?.bttsValue && odds?.bttsConfidence) {
    bttsPredictions.push({
      prediction: odds.bttsValue === 'yes' ? 'Evet' : 'Hayır',
      confidence: odds.bttsConfidence || 60,
      source: 'Odds Agent'
    });
  }
  if (deepAnalysis?.btts?.prediction && deepAnalysis?.btts?.confidence) {
    bttsPredictions.push({
      prediction: deepAnalysis.btts.prediction === 'Yes' ? 'Evet' : 'Hayır',
      confidence: deepAnalysis.btts.confidence,
      source: 'Deep Analysis Agent'
    });
  }
  
  // Agent'ların Over/Under tahminlerini topla
  const overUnderPredictions: { prediction: string; confidence: number; source: string }[] = [];
  if (stats?.overUnder && stats?.overUnderConfidence) {
    overUnderPredictions.push({
      prediction: stats.overUnder === 'Over' ? 'Üst' : 'Alt',
      confidence: stats.overUnderConfidence,
      source: 'Stats Agent'
    });
  }
  if (odds?.recommendation && odds?.confidence) {
    overUnderPredictions.push({
      prediction: odds.recommendation === 'Over' ? 'Üst' : 'Alt',
      confidence: odds.confidence,
      source: 'Odds Agent'
    });
  }
  if (deepAnalysis?.overUnder?.prediction && deepAnalysis?.overUnder?.confidence) {
    overUnderPredictions.push({
      prediction: deepAnalysis.overUnder.prediction === 'Over' ? 'Üst' : 'Alt',
      confidence: deepAnalysis.overUnder.confidence,
      source: 'Deep Analysis Agent'
    });
  }
  
  // Ortalama güven seviyelerini hesapla
  const avgBttsConf = bttsPredictions.length > 0
    ? Math.round(bttsPredictions.reduce((sum, p) => sum + p.confidence, 0) / bttsPredictions.length)
    : 0;
  const avgOverUnderConf = overUnderPredictions.length > 0
    ? Math.round(overUnderPredictions.reduce((sum, p) => sum + p.confidence, 0) / overUnderPredictions.length)
    : 0;
  
  // En yaygın tahminleri bul
  const bttsVotes = bttsPredictions.map(p => p.prediction);
  const bttsYesCount = bttsVotes.filter(v => v === 'Evet').length;
  const bttsNoCount = bttsVotes.filter(v => v === 'Hayır').length;
  const bttsConsensus = bttsYesCount > bttsNoCount ? 'Evet' : 'Hayır';
  
  const overUnderVotes = overUnderPredictions.map(p => p.prediction);
  const overCount = overUnderVotes.filter(v => v === 'Üst').length;
  const underCount = overUnderVotes.filter(v => v === 'Alt').length;
  const overUnderConsensus = overCount > underCount ? 'Üst' : 'Alt';
  
  // 🎯 BİRLEŞİK ÖNERİ: Eğer hem BTTS hem Over/Under yüksek güvenliyse
  const highConfidenceThreshold = 60; // %60 ve üzeri yüksek güven
  const veryHighConfidenceThreshold = 65; // %65 ve üzeri çok yüksek güven
  
  if (avgBttsConf >= highConfidenceThreshold && avgOverUnderConf >= highConfidenceThreshold) {
    // İkisi de yüksek güvenli → Birleşik öneri
    const combinedConfidence = Math.round((avgBttsConf + avgOverUnderConf) / 2);
    
    // Eğer Over 2.5 ve BTTS Evet ise → "En sağlam bahis: Karşılıklı Gol VEYA Over 2.5"
    if (overUnderConsensus === 'Üst' && bttsConsensus === 'Evet') {
      return {
        market: 'En Sağlam Bahis',
        selection: 'Karşılıklı Gol VEYA Over 2.5',
        confidence: Math.min(85, combinedConfidence + 5), // Birleşik öneri bonusu
        reason: `Agent'lar hem Karşılıklı Gol (${avgBttsConf}%) hem Over 2.5 (${avgOverUnderConf}%) için yüksek güven gösteriyor. İkisi de gerçekleşme olasılığı yüksek.`
      };
    }
    
    // Eğer Under 2.5 ve BTTS Hayır ise → "En sağlam bahis: Karşılıklı Gol Yok VEYA Under 2.5"
    if (overUnderConsensus === 'Alt' && bttsConsensus === 'Hayır') {
      return {
        market: 'En Sağlam Bahis',
        selection: 'Karşılıklı Gol Yok VEYA Under 2.5',
        confidence: Math.min(85, combinedConfidence + 5),
        reason: `Agent'lar hem Karşılıklı Gol Yok (${avgBttsConf}%) hem Under 2.5 (${avgOverUnderConf}%) için yüksek güven gösteriyor. Düşük skorlu maç beklentisi güçlü.`
      };
    }
    
    // Diğer kombinasyonlar için genel birleşik öneri
    return {
      market: 'En Sağlam Bahis',
      selection: `Karşılıklı Gol ${bttsConsensus === 'Evet' ? 'Var' : 'Yok'} VEYA Over/Under ${overUnderConsensus === 'Üst' ? 'Üst' : 'Alt'}`,
      confidence: combinedConfidence,
      reason: `Agent'lar hem Karşılıklı Gol (${avgBttsConf}%) hem Over/Under (${avgOverUnderConf}%) için yüksek güven gösteriyor.`
    };
  }
  
  // Tek bir yüksek güvenli tahmin varsa onu seç
  if (avgBttsConf >= veryHighConfidenceThreshold) {
    return {
      market: 'Karşılıklı Gol',
      selection: bttsConsensus,
      confidence: avgBttsConf,
      reason: `Agent'lar Karşılıklı Gol ${bttsConsensus === 'Evet' ? 'Var' : 'Yok'} için çok yüksek güven gösteriyor (${avgBttsConf}%). ${bttsPredictions.map(p => `${p.source}: ${p.confidence}%`).join(', ')}`
    };
  }
  
  if (avgOverUnderConf >= veryHighConfidenceThreshold) {
    return {
      market: 'Over/Under 2.5',
      selection: overUnderConsensus,
      confidence: avgOverUnderConf,
      reason: `Agent'lar Over/Under ${overUnderConsensus === 'Üst' ? 'Üst' : 'Alt'} için çok yüksek güven gösteriyor (${avgOverUnderConf}%). ${overUnderPredictions.map(p => `${p.source}: ${p.confidence}%`).join(', ')}`
    };
  }
  
  // Özel tahminler varsa onları kontrol et
  if (halfTimeGoals && halfTimeGoals.confidence >= 60) {
    return {
      market: 'Agent Özel Tahminler',
      selection: 'İlk Yarı Goller',
      confidence: halfTimeGoals.confidence,
      reason: `İlk yarı gol tahmini en yüksek güven seviyesine sahip (${halfTimeGoals.confidence}%). ${halfTimeGoals.reasoning}`
    };
  }
  
  if (halfTimeFullTime && halfTimeFullTime.confidence >= 60) {
    return {
      market: 'Agent Özel Tahminler',
      selection: 'İlk Yarı/Maç Sonucu',
      confidence: halfTimeFullTime.confidence,
      reason: `İlk yarı/maç sonucu kombinasyonu yüksek güven seviyesine sahip (${halfTimeFullTime.confidence}%).`
    };
  }
  
  // En yüksek güvenli genel tahmin
  const allOptions = [
    ...(avgBttsConf > 0 ? [{ market: 'Karşılıklı Gol', selection: bttsConsensus || 'Evet', confidence: avgBttsConf }] : []),
    ...(avgOverUnderConf > 0 ? [{ market: 'Over/Under 2.5', selection: overUnderConsensus || 'Üst', confidence: avgOverUnderConf }] : []),
    ...(halfTimeGoals?.confidence ? [{ market: 'Agent Özel Tahminler', selection: 'İlk Yarı Goller', confidence: halfTimeGoals.confidence }] : []),
    ...(halfTimeFullTime?.confidence ? [{ market: 'Agent Özel Tahminler', selection: 'İlk Yarı/Maç Sonucu', confidence: halfTimeFullTime.confidence }] : [])
  ].filter(opt => opt.confidence > 0);
  
  if (allOptions.length > 0) {
    const best = allOptions.sort((a, b) => b.confidence - a.confidence)[0];
    return {
      ...best,
      reason: `${best.market} için agent analizleri ${best.confidence}% güven gösteriyor.`
    };
  }
  
  // Fallback
  return {
    market: 'Agent Özel Tahminler',
    selection: 'Maç Sonucu Oranları',
    confidence: matchResultOdds ? Math.max(matchResultOdds.home, matchResultOdds.draw, matchResultOdds.away) : 50,
    reason: 'Agent özel tahminleri'
  };
}

// ============================================================================
// CONSENSUS BUILDER
// ============================================================================

function buildConsensus(
  stats: any,
  odds: any,
  deepAnalysis: any
): {
  btts: { prediction: string; confidence: number; reasoning: string };
  overUnder: { prediction: string; confidence: number; reasoning: string };
  matchResult: { prediction: string; confidence: number; reasoning: string };
  agreement: number;
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  riskLevel: 'low' | 'medium' | 'high';
} {
  // BTTS
  const bttsVotes: string[] = [];
  if (stats?.btts) bttsVotes.push(stats.btts === 'Yes' ? 'yes' : 'no');
  if (odds?.bttsValue) bttsVotes.push(odds.bttsValue === 'yes' ? 'yes' : 'no');
  if (deepAnalysis?.btts?.prediction) {
    bttsVotes.push(deepAnalysis.btts.prediction === 'Yes' ? 'yes' : 'no');
  }
  
  const bttsYes = bttsVotes.filter(v => v === 'yes').length;
  const bttsNo = bttsVotes.filter(v => v === 'no').length;
  const bttsPrediction = bttsYes > bttsNo ? 'yes' : 'no';
  
  const bttsConfidences: number[] = [];
  if (stats?.bttsConfidence) bttsConfidences.push(stats.bttsConfidence);
  if (odds?.bttsConfidence) bttsConfidences.push(odds.bttsConfidence);
  if (deepAnalysis?.btts?.confidence) bttsConfidences.push(deepAnalysis.btts.confidence);
  const bttsConfidence = Math.round(
    bttsConfidences.reduce((a, b) => a + b, 0) / Math.max(bttsConfidences.length, 1)
  );
  
  const bttsReasoning = [
    stats?.bttsReasoning,
    odds?.bttsReasoning,
    deepAnalysis?.btts?.reasoning
  ].filter(Boolean).join(' | ');
  
  // Over/Under
  const overUnderVotes: string[] = [];
  if (stats?.overUnder) overUnderVotes.push(stats.overUnder);
  if (odds?.recommendation) overUnderVotes.push(odds.recommendation);
  if (deepAnalysis?.overUnder?.prediction) overUnderVotes.push(deepAnalysis.overUnder.prediction);
  
  const overCount = overUnderVotes.filter(v => v.toLowerCase().includes('over')).length;
  const underCount = overUnderVotes.filter(v => v.toLowerCase().includes('under')).length;
  const overUnderPrediction = overCount > underCount ? 'over' : 'under';
  
  const overUnderConfidences: number[] = [];
  if (stats?.overUnderConfidence) overUnderConfidences.push(stats.overUnderConfidence);
  if (odds?.confidence) overUnderConfidences.push(odds.confidence);
  if (deepAnalysis?.overUnder?.confidence) overUnderConfidences.push(deepAnalysis.overUnder.confidence);
  const overUnderConfidence = Math.round(
    overUnderConfidences.reduce((a, b) => a + b, 0) / Math.max(overUnderConfidences.length, 1)
  );
  
  const overUnderReasoning = [
    stats?.overUnderReasoning,
    odds?.recommendationReasoning,
    deepAnalysis?.overUnder?.reasoning
  ].filter(Boolean).join(' | ');
  
  // Match Result
  const matchResultVotes: string[] = [];
  if (stats?.matchResult) {
    const mr = stats.matchResult;
    matchResultVotes.push(mr === '1' ? 'home' : mr === '2' ? 'away' : 'draw');
  }
  if (odds?.matchWinnerValue) matchResultVotes.push(odds.matchWinnerValue);
  if (deepAnalysis?.matchResult?.prediction) {
    const mr = deepAnalysis.matchResult.prediction;
    matchResultVotes.push(mr === '1' ? 'home' : mr === '2' ? 'away' : 'draw');
  }
  
  const homeCount = matchResultVotes.filter(v => v === 'home').length;
  const awayCount = matchResultVotes.filter(v => v === 'away').length;
  const drawCount = matchResultVotes.filter(v => v === 'draw').length;
  
  let matchResultPrediction = 'draw';
  if (homeCount > awayCount && homeCount > drawCount) matchResultPrediction = 'home';
  else if (awayCount > homeCount && awayCount > drawCount) matchResultPrediction = 'away';
  
  const matchResultConfidences: number[] = [];
  if (stats?.matchResultConfidence) matchResultConfidences.push(stats.matchResultConfidence);
  if (odds?.matchWinnerConfidence) matchResultConfidences.push(odds.matchWinnerConfidence);
  if (deepAnalysis?.matchResult?.confidence) matchResultConfidences.push(deepAnalysis.matchResult.confidence);
  const matchResultConfidence = Math.round(
    matchResultConfidences.reduce((a, b) => a + b, 0) / Math.max(matchResultConfidences.length, 1)
  );
  
  const matchResultReasoning = [
    stats?.matchResultReasoning,
    odds?.matchWinnerReasoning,
    deepAnalysis?.matchResult?.reasoning
  ].filter(Boolean).join(' | ');
  
  // Agreement calculation
  const totalVotes = bttsVotes.length + overUnderVotes.length + matchResultVotes.length;
  const agreedVotes = 
    (bttsYes === bttsVotes.length || bttsNo === bttsVotes.length ? 1 : 0) +
    (overCount === overUnderVotes.length || underCount === overUnderVotes.length ? 1 : 0) +
    (homeCount === matchResultVotes.length || awayCount === matchResultVotes.length || drawCount === matchResultVotes.length ? 1 : 0);
  const agreement = Math.round((agreedVotes / 3) * 100);
  
  // Best bet
  const confidences = [
    { market: 'BTTS', selection: bttsPrediction === 'yes' ? 'Evet' : 'Hayır', confidence: bttsConfidence },
    { market: 'Over/Under', selection: overUnderPrediction === 'over' ? 'Üst' : 'Alt', confidence: overUnderConfidence },
    { market: 'Match Result', selection: matchResultPrediction === 'home' ? 'Ev Sahibi' : matchResultPrediction === 'away' ? 'Deplasman' : 'Beraberlik', confidence: matchResultConfidence }
  ];
  const bestBet = confidences.sort((a, b) => b.confidence - a.confidence)[0];
  
  // Risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (agreement >= 80 && bestBet.confidence >= 70) riskLevel = 'low';
  else if (agreement < 50 || bestBet.confidence < 55) riskLevel = 'high';
  
  return {
    btts: {
      prediction: bttsPrediction,
      confidence: Math.max(50, Math.min(85, bttsConfidence)),
      reasoning: bttsReasoning || 'Agent analizleri birleştirildi'
    },
    overUnder: {
      prediction: overUnderPrediction,
      confidence: Math.max(50, Math.min(85, overUnderConfidence)),
      reasoning: overUnderReasoning || 'Agent analizleri birleştirildi'
    },
    matchResult: {
      prediction: matchResultPrediction,
      confidence: Math.max(50, Math.min(85, matchResultConfidence)),
      reasoning: matchResultReasoning || 'Agent analizleri birleştirildi'
    },
    agreement,
    bestBet: {
      market: bestBet.market,
      selection: bestBet.selection,
      confidence: bestBet.confidence,
      reason: `${bestBet.market} için en yüksek güven seviyesi`
    },
    riskLevel
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function runAgentAnalysis(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number
): Promise<AgentAnalysisResult | null> {
  
  console.log(`\n🤖 ========================================`);
  console.log(`🤖 AGENT ANALYSIS: Fixture ${fixtureId}`);
  console.log(`🤖 ========================================\n`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Fetch full fixture data from Sportmonks
    console.log('📊 Step 1: Fetching full match data from Sportmonks...');
    const fullData = await getFullFixtureData(fixtureId);
    
    if (!fullData) {
      console.error('❌ Failed to fetch fixture data');
      return null;
    }
    
    console.log(`✅ Data loaded! Quality: ${fullData.dataQuality.score}/100`);
    
    // Step 2: Fetch detailed stats for agents (getTeamStats ve getHeadToHead)
    console.log('🔄 Step 2: Fetching detailed team stats and H2H data...');
    const [homeTeamStats, awayTeamStats, h2hData, homeInjuries, awayInjuries] = await Promise.all([
      getTeamStats(homeTeamId),
      getTeamStats(awayTeamId),
      getHeadToHead(homeTeamId, awayTeamId),
      getTeamInjuries(homeTeamId),
      getTeamInjuries(awayTeamId)
    ]);
    
    // Step 3: Convert to MatchData format with detailedStats
    console.log('🔄 Step 3: Converting to MatchData format with detailed stats...');
    const matchData = convertFullFixtureToMatchData(fullData, {
      homeTeamStats,
      awayTeamStats,
      h2hData,
      homeInjuries,
      awayInjuries
    });
    
    // Step 4: Run agents in parallel
    console.log('🤖 Step 4: Running agents (Stats, Odds, DeepAnalysis)...');
    const language: 'tr' | 'en' | 'de' = 'tr'; // Türkçe varsayılan
    
    const [statsResult, oddsResult, deepAnalysisResult] = await Promise.all([
      runStatsAgent(matchData, language).catch(err => {
        console.error('❌ Stats agent failed:', err);
        return null;
      }),
      runOddsAgent(matchData, language).catch(err => {
        console.error('❌ Odds agent failed:', err);
        return null;
      }),
      runDeepAnalysisAgent(matchData, language).catch(err => {
        console.error('❌ DeepAnalysis agent failed:', err);
        return null;
      }),
    ]);
    
    if (!statsResult && !oddsResult && !deepAnalysisResult) {
      console.error('❌ All agents failed');
      return null;
    }
    
    console.log('✅ Agents completed');
    if (statsResult) console.log(`   Stats: ${statsResult.matchResult} | ${statsResult.overUnder} | BTTS: ${statsResult.btts}`);
    if (oddsResult) console.log(`   Odds: ${oddsResult.matchWinnerValue || 'N/A'}`);
    if (deepAnalysisResult) console.log(`   DeepAnalysis: ${deepAnalysisResult.matchResult?.prediction || 'N/A'}`);
    
    // Step 5: Build consensus
    console.log('🔄 Step 5: Building consensus...');
    const consensus = buildConsensus(statsResult, oddsResult, deepAnalysisResult);
    
    // Step 5: Calculate overall confidence
    const overallConfidence = Math.round(
      (consensus.btts.confidence + consensus.overUnder.confidence + consensus.matchResult.confidence) / 3
    );
    
    // Step 6: Data quality assessment
    const dataQuality = fullData.dataQuality.score >= 70 ? 'good' : 
                       fullData.dataQuality.score >= 40 ? 'minimal' : 'no_data';
    
    // Step 7: Corners (if available in deepAnalysis)
    const corners = deepAnalysisResult?.cornersAndCards ? {
      prediction: deepAnalysisResult.cornersAndCards.cornersLine?.toLowerCase().includes('over') ? 'over' : 'under',
      confidence: deepAnalysisResult.cornersAndCards.cornersConfidence || 60,
      reasoning: deepAnalysisResult.cornersAndCards.cornersAnalysis || 'Korner analizi mevcut',
      line: 9.5
    } : undefined;
    
    // Step 8: YENİ - İlk Yarı Gol Tahmini (Agent özel)
    const halfTimeGoals = deepAnalysisResult?.halfTimeGoals ? {
      prediction: deepAnalysisResult.halfTimeGoals.prediction?.toLowerCase().includes('over') ? 'over' : 'under',
      confidence: deepAnalysisResult.halfTimeGoals.confidence || 60,
      reasoning: deepAnalysisResult.halfTimeGoals.reasoning || 'İlk yarı gol tahmini',
      line: deepAnalysisResult.halfTimeGoals.line || 1.5,
      expectedGoals: deepAnalysisResult.halfTimeGoals.expectedGoals || 1.2
    } : undefined;
    
    // Step 9: YENİ - İlk Yarı / Maç Sonucu Kombinasyonu (Agent özel)
    const halfTimeFullTime = deepAnalysisResult?.halfTimeFullTime ? {
      prediction: deepAnalysisResult.halfTimeFullTime.prediction || '1/1',
      confidence: deepAnalysisResult.halfTimeFullTime.confidence || 55,
      reasoning: deepAnalysisResult.halfTimeFullTime.reasoning || 'İlk yarı / Maç sonucu kombinasyonu tahmini'
    } : undefined;
    
    // Step 10: YENİ - Detaylı Maç Sonucu Oranları (Agent özel)
    const matchResultOdds = deepAnalysisResult?.matchResultOdds ? {
      home: deepAnalysisResult.matchResultOdds.home || 33,
      draw: deepAnalysisResult.matchResultOdds.draw || 33,
      away: deepAnalysisResult.matchResultOdds.away || 34,
      reasoning: deepAnalysisResult.matchResultOdds.reasoning || 'Maç sonucu olasılıkları'
    } : (deepAnalysisResult?.probabilities ? {
      home: deepAnalysisResult.probabilities.homeWin || 33,
      draw: deepAnalysisResult.probabilities.draw || 33,
      away: deepAnalysisResult.probabilities.awayWin || 34,
      reasoning: 'Maç sonucu olasılıkları (probabilities\'ten)'
    } : undefined);
    
    const result: AgentAnalysisResult = {
      fixtureId,
      homeTeam: fullData.homeTeam.name,
      awayTeam: fullData.awayTeam.name,
      league: fullData.league.name,
      matchDate: new Date().toISOString(),
      
      agents: {
        stats: statsResult,
        odds: oddsResult,
        deepAnalysis: deepAnalysisResult
      },
      
      // Agent analizinde standart tahminler YOK - sadece özel tahminler kullanılıyor
      btts: undefined,
      overUnder: undefined,
      matchResult: undefined,
      
      corners,
      halfTimeGoals,
      halfTimeFullTime,
      matchResultOdds,
      
      // 🆕 GELİŞTİRİLMİŞ BEST BET HESAPLAMA
      // Agent'ların BTTS ve Over/Under tahminlerini analiz et
      bestBet: calculateSmartBestBet(
        statsResult,
        oddsResult,
        deepAnalysisResult,
        halfTimeGoals,
        halfTimeFullTime,
        matchResultOdds
      ),
      agreement: 0, // Agent analizinde consensus yok
      riskLevel: 'medium' as const,
      overallConfidence: Math.max(
        halfTimeGoals?.confidence || 0,
        halfTimeFullTime?.confidence || 0,
        matchResultOdds ? Math.max(matchResultOdds.home, matchResultOdds.draw, matchResultOdds.away) : 0
      ),
      dataQuality,
      processingTime: Date.now() - startTime,
      analyzedAt: new Date().toISOString()
    };
    
    console.log(`\n✅ AGENT ANALYSIS COMPLETE in ${result.processingTime}ms`);
    console.log(`   Agreement: ${result.agreement}%`);
    console.log(`   Best Bet: ${result.bestBet.market} → ${result.bestBet.selection} (%${result.bestBet.confidence})`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Agent analysis error:', error);
    return null;
  }
}

// ============================================================================
// SAVE TO DATABASE
// ============================================================================

export async function saveAgentAnalysis(result: AgentAnalysisResult): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('agent_analysis')
      .upsert({
        fixture_id: result.fixtureId,
        home_team: result.homeTeam,
        away_team: result.awayTeam,
        league: result.league,
        match_date: result.matchDate,
        
        // Agent results (JSON)
        agent_results: result.agents,
        
        // Predictions (Agent analizinde undefined - sadece özel tahminler var)
        btts_prediction: result.btts?.prediction || null,
        btts_confidence: result.btts?.confidence || null,
        btts_reasoning: result.btts?.reasoning || null,
        
        over_under_prediction: result.overUnder?.prediction || null,
        over_under_confidence: result.overUnder?.confidence || null,
        over_under_reasoning: result.overUnder?.reasoning || null,
        
        match_result_prediction: result.matchResult?.prediction || null,
        match_result_confidence: result.matchResult?.confidence || null,
        match_result_reasoning: result.matchResult?.reasoning || null,
        
        // Corners (if available)
        corners_prediction: result.corners?.prediction,
        corners_confidence: result.corners?.confidence,
        corners_reasoning: result.corners?.reasoning,
        corners_line: result.corners?.line,
        
        // YENİ: İlk Yarı Gol Tahmini
        half_time_goals_prediction: result.halfTimeGoals?.prediction,
        half_time_goals_confidence: result.halfTimeGoals?.confidence,
        half_time_goals_reasoning: result.halfTimeGoals?.reasoning,
        half_time_goals_line: result.halfTimeGoals?.line,
        half_time_goals_expected: result.halfTimeGoals?.expectedGoals,
        
        // YENİ: İlk Yarı / Maç Sonucu Kombinasyonu
        half_time_full_time_prediction: result.halfTimeFullTime?.prediction,
        half_time_full_time_confidence: result.halfTimeFullTime?.confidence,
        half_time_full_time_reasoning: result.halfTimeFullTime?.reasoning,
        
        // YENİ: Detaylı Maç Sonucu Oranları
        match_result_odds_home: result.matchResultOdds?.home,
        match_result_odds_draw: result.matchResultOdds?.draw,
        match_result_odds_away: result.matchResultOdds?.away,
        match_result_odds_reasoning: result.matchResultOdds?.reasoning,
        
        // Summary
        best_bet_market: result.bestBet.market,
        best_bet_selection: result.bestBet.selection,
        best_bet_confidence: result.bestBet.confidence,
        best_bet_reason: result.bestBet.reason,
        
        agreement: result.agreement,
        risk_level: result.riskLevel,
        overall_confidence: result.overallConfidence,
        data_quality: result.dataQuality,
        processing_time: result.processingTime,
        analyzed_at: result.analyzedAt,
        
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'fixture_id'
      });
    
    if (error) {
      console.error('❌ Error saving agent analysis:', error);
      return false;
    }
    
    console.log('✅ Agent analysis saved to database');
    return true;
  } catch (error) {
    console.error('❌ Exception saving agent analysis:', error);
    return false;
  }
}

