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
  
  // 🆕 EN İYİ 3 İDDA TAHMİNİ (Agent'ların verilere göre özel tahminleri)
  top3Predictions: Array<{
    rank: number;
    market: string;
    selection: string;
    confidence: number;
    reasoning: string;
    agentSupport: string[]; // Hangi agent'lar bu tahmini destekliyor
  }>;
  
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
        // 🆕 Ev sahibi için evdeki maçları filtrele ve hesapla
        homeAvgGoalsScored: parseFloat(calculateAvgGoals(homeMatches.filter((m: any) => m.isHome === true || m.isHome === undefined), true).toFixed(2)),
        homeAvgGoalsConceded: parseFloat(calculateAvgGoals(homeMatches.filter((m: any) => m.isHome === true || m.isHome === undefined), false).toFixed(2)),
        bttsPercentage: additionalData.homeTeamStats.bttsPercentage || parseFloat(calculateBTTS(homeMatches).toFixed(0)),
        over25Percentage: additionalData.homeTeamStats.over25Percentage || parseFloat(calculateOver25(homeMatches).toFixed(0)),
        homeOver25Percentage: parseFloat(calculateOver25(homeMatches.filter((m: any) => m.isHome === true || m.isHome === undefined)).toFixed(0)),
        homeBttsPercentage: parseFloat(calculateBTTS(homeMatches.filter((m: any) => m.isHome === true || m.isHome === undefined)).toFixed(0)),
        cleanSheetPercentage: additionalData.homeTeamStats.cleanSheets || parseFloat(calculateCleanSheets(homeMatches).toFixed(0)),
        homeCleanSheets: parseFloat(calculateCleanSheets(homeMatches.filter((m: any) => m.isHome === true || m.isHome === undefined)).toFixed(0)),
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
        // 🆕 Deplasman takımı için deplasmandaki maçları filtrele ve hesapla
        awayAvgGoalsScored: parseFloat(calculateAvgGoals(awayMatches.filter((m: any) => m.isHome === false), true).toFixed(2)),
        awayAvgGoalsConceded: parseFloat(calculateAvgGoals(awayMatches.filter((m: any) => m.isHome === false), false).toFixed(2)),
        bttsPercentage: additionalData.awayTeamStats.bttsPercentage || parseFloat(calculateBTTS(awayMatches).toFixed(0)),
        over25Percentage: additionalData.awayTeamStats.over25Percentage || parseFloat(calculateOver25(awayMatches).toFixed(0)),
        awayOver25Percentage: parseFloat(calculateOver25(awayMatches.filter((m: any) => m.isHome === false)).toFixed(0)),
        awayBttsPercentage: parseFloat(calculateBTTS(awayMatches.filter((m: any) => m.isHome === false)).toFixed(0)),
        cleanSheetPercentage: additionalData.awayTeamStats.cleanSheets || parseFloat(calculateCleanSheets(awayMatches).toFixed(0)),
        awayCleanSheets: parseFloat(calculateCleanSheets(awayMatches.filter((m: any) => m.isHome === false)).toFixed(0)),
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
// SPORTMONKS DATA-BASED MATCH RESULT PREDICTION
// ============================================================================

/**
 * Sportmonks verilerine göre puan bazlı maç sonucu tahmini
 * Agent'ların kendi tahmin seçenekleri yok, sadece veri bazlı puan sistemi
 */
function calculateMatchResultFromSportmonksData(
  fullData: FullFixtureData,
  homeTeamStats?: any,
  awayTeamStats?: any,
  h2hData?: any
): {
  prediction: '1' | 'X' | '2';
  confidence: number;
  reasoning: string;
  homeScore: number;
  awayScore: number;
  probabilities: { home: number; draw: number; away: number };
} {
  
  // Helper: Güvenli sayı dönüştürme
  const safeNum = (val: any, defaultVal: number): number => {
    if (val === undefined || val === null || isNaN(val)) return defaultVal;
    return parseFloat(val) || defaultVal;
  };
  
  // ========== PUAN HESAPLAMA ==========
  let homeScore = 0;
  let awayScore = 0;
  
  // 1. Form Puanları (max 30 puan)
  const homeFormPoints = safeNum(fullData.homeTeam.formPoints, 5);
  const awayFormPoints = safeNum(fullData.awayTeam.formPoints, 5);
  homeScore += homeFormPoints * 2; // Max 30 (15 * 2)
  awayScore += awayFormPoints * 2; // Max 30 (15 * 2)
  
  // 2. Ev Sahibi Avantajı (10 puan)
  homeScore += 10;
  
  // 3. Gol İstatistikleri (max 20 puan)
  // Sadece homeTeamStats ve awayTeamStats'tan al (fullData'da bu property'ler yok)
  const homeAvgScored = safeNum(homeTeamStats?.avgGoalsScored, 1.2);
  const homeAvgConceded = safeNum(homeTeamStats?.avgGoalsConceded, 1.0);
  const awayAvgScored = safeNum(awayTeamStats?.avgGoalsScored, 1.1);
  const awayAvgConceded = safeNum(awayTeamStats?.avgGoalsConceded, 1.1);
  
  // Gol farkı
  const homeGD = homeAvgScored - homeAvgConceded;
  const awayGD = awayAvgScored - awayAvgConceded;
  homeScore += Math.max(0, Math.min(20, homeGD * 5));
  awayScore += Math.max(0, Math.min(20, awayGD * 5));
  
  // 4. H2H Verileri (max 20 puan)
  if (h2hData && h2hData.totalMatches > 0) {
    const totalMatches = h2hData.totalMatches;
    const homeWins = safeNum(h2hData.team1Wins || h2hData.homeWins, 0);
    const awayWins = safeNum(h2hData.team2Wins || h2hData.awayWins, 0);
    
    homeScore += (homeWins / totalMatches) * 20;
    awayScore += (awayWins / totalMatches) * 20;
  } else if (fullData.h2h && fullData.h2h.totalMatches > 0) {
    const totalMatches = fullData.h2h.totalMatches;
    const homeWins = safeNum(fullData.h2h.team1Wins, 0);
    const awayWins = safeNum(fullData.h2h.team2Wins, 0);
    
    homeScore += (homeWins / totalMatches) * 20;
    awayScore += (awayWins / totalMatches) * 20;
  } else {
    // H2H yoksa ev sahibi avantajı
    homeScore += 10;
    awayScore += 5;
  }
  
  // 5. Ev Sahibi/Deplasman Performansı (max 20 puan)
  // Ev sahibi evdeki performansı
  const homeHomeWinRate = safeNum(homeTeamStats?.homeWinRate, 0.4);
  const awayAwayWinRate = safeNum(awayTeamStats?.awayWinRate, 0.3);
  
  homeScore += homeHomeWinRate * 20;
  awayScore += awayAwayWinRate * 20;
  
  // 6. Lig Pozisyonu (eğer varsa, max 10 puan)
  // Bu veri genelde Sportmonks'ta yok, atlayabiliriz
  
  // ========== TAHMİN BELİRLEME ==========
  const scoreDiff = homeScore - awayScore;
  let prediction: '1' | 'X' | '2';
  let confidence: number;
  
  // Puan farkına göre tahmin
  if (scoreDiff > 20) {
    prediction = '1';
    confidence = Math.min(75, 55 + Math.floor(scoreDiff / 5));
  } else if (scoreDiff < -20) {
    prediction = '2';
    confidence = Math.min(75, 55 + Math.floor(Math.abs(scoreDiff) / 5));
  } else if (scoreDiff > 10) {
    prediction = '1';
    confidence = Math.min(70, 52 + Math.floor(scoreDiff / 3));
  } else if (scoreDiff < -10) {
    prediction = '2';
    confidence = Math.min(70, 52 + Math.floor(Math.abs(scoreDiff) / 3));
  } else if (scoreDiff > 5) {
    prediction = '1';
    confidence = 55;
  } else if (scoreDiff < -5) {
    prediction = '2';
    confidence = 55;
  } else {
    prediction = 'X';
    confidence = 50 + Math.min(10, Math.abs(scoreDiff));
  }
  
  // ========== OLASILIKLAR ==========
  // Puanlara göre olasılık hesapla
  const totalScore = homeScore + awayScore;
  const homeProb = Math.round((homeScore / totalScore) * 100);
  const awayProb = Math.round((awayScore / totalScore) * 100);
  const drawProb = 100 - homeProb - awayProb;
  
  // Normalize et (draw için minimum %20)
  const normalizedHome = Math.max(20, Math.min(70, homeProb));
  const normalizedAway = Math.max(20, Math.min(70, awayProb));
  const normalizedDraw = 100 - normalizedHome - normalizedAway;
  
  // ========== REASONING ==========
  const reasoning = `Sportmonks verilerine göre puan bazlı analiz:
- Form: Ev ${homeFormPoints}p vs Dep ${awayFormPoints}p (Fark: ${homeFormPoints - awayFormPoints})
- Gol Farkı: Ev ${homeGD.toFixed(1)} vs Dep ${awayGD.toFixed(1)}
- H2H: ${fullData.h2h?.totalMatches || 0} maç (Ev ${fullData.h2h?.team1Wins || 0}G, Dep ${fullData.h2h?.team2Wins || 0}G)
- Toplam Puan: Ev ${homeScore.toFixed(0)}p vs Dep ${awayScore.toFixed(0)}p (Fark: ${scoreDiff.toFixed(0)})
→ ${prediction === '1' ? 'Ev Sahibi' : prediction === '2' ? 'Deplasman' : 'Beraberlik'} favori (${confidence}% güven)`;
  
  return {
    prediction,
    confidence: Math.max(50, Math.min(75, confidence)),
    reasoning,
    homeScore: Math.round(homeScore),
    awayScore: Math.round(awayScore),
    probabilities: {
      home: normalizedHome,
      draw: normalizedDraw,
      away: normalizedAway
    }
  };
}

// ============================================================================
// TOP 3 PREDICTIONS FROM AGENTS
// ============================================================================

/**
 * Agent'ların tüm tahminlerini toplayıp en iyi 3'ünü seçer
 * Her maç için verilere göre özel tahminler üretir
 */
function extractTop3PredictionsFromAgents(
  stats: any,
  odds: any,
  deepAnalysis: any
): Array<{
  rank: number;
  market: string;
  selection: string;
  confidence: number;
  reasoning: string;
  agentSupport: string[];
}> {
  
  const allPredictions: Array<{
    market: string;
    selection: string;
    confidence: number;
    reasoning: string;
    agent: string;
  }> = [];
  
  // ========== STATS AGENT TAHMİNLERİ ==========
  if (stats) {
    // Over/Under
    if (stats.overUnder && stats.overUnderConfidence) {
      allPredictions.push({
        market: 'Over/Under 2.5',
        selection: stats.overUnder === 'Over' ? 'Üst' : 'Alt',
        confidence: stats.overUnderConfidence,
        reasoning: stats.overUnderReasoning || 'İstatistiksel analiz',
        agent: 'Stats Agent'
      });
    }
    
    // BTTS
    if (stats.btts && stats.bttsConfidence) {
      allPredictions.push({
        market: 'Karşılıklı Gol',
        selection: stats.btts === 'Yes' ? 'Evet' : 'Hayır',
        confidence: stats.bttsConfidence,
        reasoning: stats.bttsReasoning || 'İstatistiksel analiz',
        agent: 'Stats Agent'
      });
    }
    
    // İlk Yarı Goller
    if (stats.firstHalfPrediction && stats.firstHalfConfidence) {
      allPredictions.push({
        market: 'İlk Yarı Goller',
        selection: stats.firstHalfPrediction.goals || 'Under 1.5',
        confidence: stats.firstHalfConfidence,
        reasoning: stats.firstHalfPrediction.reasoning || 'İlk yarı analizi',
        agent: 'Stats Agent'
      });
    }
  }
  
  // ========== ODDS AGENT TAHMİNLERİ ==========
  if (odds) {
    // Over/Under - recommendation field'ı Over/Under için kullanılıyor
    // Ama bazen maç sonucu değeri ("Away", "Home", "Draw") dönebiliyor
    // Bu yüzden sadece "Over" veya "Under" değerlerini kabul et
    if (odds.recommendation && (odds.recommendation === 'Over' || odds.recommendation === 'Under') && odds.confidence) {
      allPredictions.push({
        market: 'Over/Under 2.5',
        selection: odds.recommendation === 'Over' ? 'Üst' : 'Alt',
        confidence: odds.confidence,
        reasoning: odds.recommendationReasoning || 'Oran analizi',
        agent: 'Odds Agent'
      });
    }
    
    // BTTS
    if (odds.bttsValue && odds.bttsConfidence) {
      allPredictions.push({
        market: 'Karşılıklı Gol',
        selection: odds.bttsValue === 'yes' ? 'Evet' : 'Hayır',
        confidence: odds.bttsConfidence || 60,
        reasoning: odds.bttsReasoning || 'Oran analizi',
        agent: 'Odds Agent'
      });
    }
    
    // Maç Sonucu (Value bet)
    if (odds.matchWinnerValue && odds.matchWinnerConfidence) {
      const selection = odds.matchWinnerValue === 'home' ? 'Ev Sahibi' : 
                       odds.matchWinnerValue === 'away' ? 'Deplasman' : 'Beraberlik';
      allPredictions.push({
        market: 'Maç Sonucu',
        selection,
        confidence: odds.matchWinnerConfidence || 60,
        reasoning: odds.matchWinnerReasoning || 'Value bet analizi',
        agent: 'Odds Agent'
      });
    }
    
    // Asian Handicap
    if (odds.asianHandicap && odds.asianHandicap.confidence) {
      allPredictions.push({
        market: 'Asian Handicap',
        selection: odds.asianHandicap.recommendation,
        confidence: odds.asianHandicap.confidence,
        reasoning: odds.asianHandicap.reasoning || 'Handikap analizi',
        agent: 'Odds Agent'
      });
    }
    
    // HT/FT
    if (odds.htftPrediction && odds.htftPrediction.confidence) {
      allPredictions.push({
        market: 'İlk Yarı/Maç Sonucu',
        selection: odds.htftPrediction.prediction,
        confidence: odds.htftPrediction.confidence,
        reasoning: odds.htftPrediction.reasoning || 'HT/FT analizi',
        agent: 'Odds Agent'
      });
    }
    
    // Correct Score
    if (odds.correctScore && odds.correctScore.confidence) {
      allPredictions.push({
        market: 'Kesin Skor',
        selection: odds.correctScore.mostLikely,
        confidence: odds.correctScore.confidence,
        reasoning: `En olası skor: ${odds.correctScore.mostLikely}`,
        agent: 'Odds Agent'
      });
    }
    
    // Corners
    if (odds.cornersAnalysis && odds.cornersAnalysis.confidence) {
      allPredictions.push({
        market: 'Korner',
        selection: odds.cornersAnalysis.totalCorners,
        confidence: odds.cornersAnalysis.confidence,
        reasoning: odds.cornersAnalysis.reasoning || 'Korner analizi',
        agent: 'Odds Agent'
      });
    }
    
    // Cards
    if (odds.cardsAnalysis && odds.cardsAnalysis.confidence) {
      allPredictions.push({
        market: 'Kart',
        selection: odds.cardsAnalysis.totalCards,
        confidence: odds.cardsAnalysis.confidence,
        reasoning: odds.cardsAnalysis.reasoning || 'Kart analizi',
        agent: 'Odds Agent'
      });
    }
  }
  
  // ========== DEEP ANALYSIS AGENT TAHMİNLERİ ==========
  if (deepAnalysis) {
    // Over/Under
    if (deepAnalysis.overUnder?.prediction && deepAnalysis.overUnder?.confidence) {
      allPredictions.push({
        market: 'Over/Under 2.5',
        selection: deepAnalysis.overUnder.prediction === 'Over' ? 'Üst' : 'Alt',
        confidence: deepAnalysis.overUnder.confidence,
        reasoning: deepAnalysis.overUnder.reasoning || 'Derin analiz',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // BTTS
    if (deepAnalysis.btts?.prediction && deepAnalysis.btts?.confidence) {
      allPredictions.push({
        market: 'Karşılıklı Gol',
        selection: deepAnalysis.btts.prediction === 'Yes' ? 'Evet' : 'Hayır',
        confidence: deepAnalysis.btts.confidence,
        reasoning: deepAnalysis.btts.reasoning || 'Derin analiz',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // Maç Sonucu
    if (deepAnalysis.matchResult?.prediction && deepAnalysis.matchResult?.confidence) {
      const mr = deepAnalysis.matchResult.prediction;
      const selection = mr === '1' ? 'Ev Sahibi' : mr === '2' ? 'Deplasman' : 'Beraberlik';
      allPredictions.push({
        market: 'Maç Sonucu',
        selection,
        confidence: deepAnalysis.matchResult.confidence,
        reasoning: deepAnalysis.matchResult.reasoning || 'Derin analiz',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // İlk Yarı Goller
    if (deepAnalysis.halfTimeGoals?.prediction && deepAnalysis.halfTimeGoals?.confidence) {
      const htSelection = deepAnalysis.halfTimeGoals.prediction === 'Over' 
        ? `Over ${deepAnalysis.halfTimeGoals.line || 1.5}` 
        : `Under ${deepAnalysis.halfTimeGoals.line || 1.5}`;
      allPredictions.push({
        market: 'İlk Yarı Goller',
        selection: htSelection,
        confidence: deepAnalysis.halfTimeGoals.confidence,
        reasoning: deepAnalysis.halfTimeGoals.reasoning || 'İlk yarı analizi',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // HT/FT
    if (deepAnalysis.halfTimeFullTime?.prediction && deepAnalysis.halfTimeFullTime?.confidence) {
      allPredictions.push({
        market: 'İlk Yarı/Maç Sonucu',
        selection: deepAnalysis.halfTimeFullTime.prediction,
        confidence: deepAnalysis.halfTimeFullTime.confidence,
        reasoning: deepAnalysis.halfTimeFullTime.reasoning || 'HT/FT analizi',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // Corners
    if (deepAnalysis.cornersAndCards?.cornersLine && deepAnalysis.cornersAndCards?.cornersConfidence) {
      allPredictions.push({
        market: 'Korner',
        selection: deepAnalysis.cornersAndCards.cornersLine,
        confidence: deepAnalysis.cornersAndCards.cornersConfidence,
        reasoning: deepAnalysis.cornersAndCards.cornersAnalysis || 'Korner analizi',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // Cards
    if (deepAnalysis.cornersAndCards?.cardsLine && deepAnalysis.cornersAndCards?.cardsConfidence) {
      allPredictions.push({
        market: 'Kart',
        selection: deepAnalysis.cornersAndCards.cardsLine,
        confidence: deepAnalysis.cornersAndCards.cardsConfidence,
        reasoning: deepAnalysis.cornersAndCards.cardsAnalysis || 'Kart analizi',
        agent: 'Deep Analysis Agent'
      });
    }
    
    // Best Bet
    if (deepAnalysis.bestBet?.type && deepAnalysis.bestBet?.confidence) {
      allPredictions.push({
        market: deepAnalysis.bestBet.type,
        selection: deepAnalysis.bestBet.selection,
        confidence: deepAnalysis.bestBet.confidence,
        reasoning: deepAnalysis.bestBet.reasoning || 'En iyi bahis',
        agent: 'Deep Analysis Agent'
      });
    }
  }
  
  // ========== TAHMİNLERİ BİRLEŞTİR VE SIRALA ==========
  // Aynı market+selection kombinasyonlarını birleştir
  const predictionMap = new Map<string, {
    market: string;
    selection: string;
    confidences: number[];
    reasonings: string[];
    agents: string[];
  }>();
  
  allPredictions.forEach(pred => {
    const key = `${pred.market}|${pred.selection}`;
    if (predictionMap.has(key)) {
      const existing = predictionMap.get(key)!;
      existing.confidences.push(pred.confidence);
      existing.reasonings.push(pred.reasoning);
      existing.agents.push(pred.agent);
    } else {
      predictionMap.set(key, {
        market: pred.market,
        selection: pred.selection,
        confidences: [pred.confidence],
        reasonings: [pred.reasoning],
        agents: [pred.agent]
      });
    }
  });
  
  // Ortalama confidence hesapla ve sırala
  const combinedPredictions = Array.from(predictionMap.values()).map(pred => {
    const avgConfidence = Math.round(
      pred.confidences.reduce((a, b) => a + b, 0) / pred.confidences.length
    );
    const uniqueAgents = [...new Set(pred.agents)];
    const combinedReasoning = pred.reasonings
      .filter((r, i, arr) => arr.indexOf(r) === i) // Unique
      .slice(0, 2) // İlk 2 reasoning
      .join(' | ');
    
    return {
      market: pred.market,
      selection: pred.selection,
      confidence: avgConfidence,
      reasoning: combinedReasoning || 'Agent analizleri',
      agentSupport: uniqueAgents,
      agentCount: uniqueAgents.length
    };
  });
  
  // Confidence'a göre sırala (yüksekten düşüğe)
  combinedPredictions.sort((a, b) => {
    // Önce agent sayısına göre (daha fazla agent destekliyorsa öncelik)
    if (a.agentCount !== b.agentCount) {
      return b.agentCount - a.agentCount;
    }
    // Sonra confidence'a göre
    return b.confidence - a.confidence;
  });
  
  // 🆕 EN İYİ 3'Ü SEÇ - FARKLI MARKET'LERDEN
  // Aynı market'ten birden fazla tahmin seçmemek için
  const top3: Array<{
    rank: number;
    market: string;
    selection: string;
    confidence: number;
    reasoning: string;
    agentSupport: string[];
  }> = [];
  const usedMarkets = new Set<string>();
  
  for (const pred of combinedPredictions) {
    // Eğer bu market'ten henüz tahmin seçilmediyse ekle
    if (!usedMarkets.has(pred.market) && top3.length < 3) {
      top3.push({
        rank: top3.length + 1,
        market: pred.market,
        selection: pred.selection,
        confidence: pred.confidence,
        reasoning: pred.reasoning,
        agentSupport: pred.agentSupport
      });
      usedMarkets.add(pred.market);
    }
  }
  
  // Eğer 3 farklı market bulunamadıysa, en yüksek confidence'lı olanları ekle
  if (top3.length < 3) {
    for (const pred of combinedPredictions) {
      if (top3.length >= 3) break;
      // Zaten eklenmiş mi kontrol et
      const alreadyAdded = top3.some(t => t.market === pred.market && t.selection === pred.selection);
      if (!alreadyAdded) {
        top3.push({
          rank: top3.length + 1,
          market: pred.market,
          selection: pred.selection,
          confidence: pred.confidence,
          reasoning: pred.reasoning,
          agentSupport: pred.agentSupport
        });
      }
    }
  }
  
  return top3;
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
    
    // Step 7: 🆕 SPORTMONKS VERİLERİNE GÖRE PUAN BAZLI MAÇ SONUCU TAHMİNİ
    console.log('📊 Step 7: Calculating match result from Sportmonks data (point-based)...');
    const sportmonksMatchResult = calculateMatchResultFromSportmonksData(
      fullData,
      homeTeamStats,
      awayTeamStats,
      h2hData
    );
    
    console.log(`   ✅ Sportmonks Prediction: ${sportmonksMatchResult.prediction} (${sportmonksMatchResult.confidence}%)`);
    console.log(`   📊 Scores: Home ${sportmonksMatchResult.homeScore}p vs Away ${sportmonksMatchResult.awayScore}p`);
    
    // Maç Sonucu Tahmini (Sportmonks verilerine göre)
    const matchResult = {
      prediction: sportmonksMatchResult.prediction === '1' ? 'home' : sportmonksMatchResult.prediction === '2' ? 'away' : 'draw',
      confidence: sportmonksMatchResult.confidence,
      reasoning: sportmonksMatchResult.reasoning
    };
    
    // Step 8: 🆕 AGENT'LARDAN EN İYİ 3 İDDA TAHMİNİ
    console.log('🎯 Step 8: Extracting top 3 predictions from agents...');
    const top3Predictions = extractTop3PredictionsFromAgents(
      statsResult,
      oddsResult,
      deepAnalysisResult
    );
    
    console.log(`   ✅ Top 3 Predictions:`);
    top3Predictions.forEach((pred, idx) => {
      console.log(`      ${idx + 1}. ${pred.market} → ${pred.selection} (${pred.confidence}%) - ${pred.agentSupport.join(', ')}`);
    });
    
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
      
      // Agent analizinde standart tahminler - Sportmonks verilerine göre puan bazlı
      btts: undefined,
      overUnder: undefined,
      matchResult: matchResult, // 🆕 Sportmonks verilerine göre puan bazlı tahmin
      
      // 🆕 EN İYİ 3 İDDA TAHMİNİ (Agent'ların verilere göre özel tahminleri)
      top3Predictions: top3Predictions,
      
      // 🆕 BEST BET (En yüksek güvenli tahmin)
      bestBet: top3Predictions.length > 0 ? {
        market: top3Predictions[0].market,
        selection: top3Predictions[0].selection,
        confidence: top3Predictions[0].confidence,
        reason: top3Predictions[0].reasoning
      } : {
        market: 'Maç Sonucu',
        selection: matchResult.prediction === 'home' ? 'Ev Sahibi' : matchResult.prediction === 'away' ? 'Deplasman' : 'Beraberlik',
        confidence: matchResult.confidence,
        reason: matchResult.reasoning
      },
      agreement: 0, // Agent analizinde consensus yok
      riskLevel: top3Predictions.length > 0 && top3Predictions[0].confidence >= 70 ? 'low' : 
                 top3Predictions.length > 0 && top3Predictions[0].confidence >= 60 ? 'medium' : 'high',
      overallConfidence: top3Predictions.length > 0 
        ? Math.round(top3Predictions.reduce((sum, p) => sum + p.confidence, 0) / top3Predictions.length)
        : matchResult.confidence,
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
        
        // Agent results (JSON) - Tüm analiz sonucunu kaydet (agents, matchResult, top3Predictions, vb.)
        agent_results: {
          agents: result.agents,
          matchResult: result.matchResult,
          top3Predictions: result.top3Predictions,
          bestBet: result.bestBet,
          agreement: result.agreement,
          riskLevel: result.riskLevel,
          overallConfidence: result.overallConfidence,
          dataQuality: result.dataQuality,
          processingTime: result.processingTime,
          analyzedAt: result.analyzedAt
        },
        
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
        
        // 🆕 EN İYİ 3 İDDA TAHMİNİ (JSON olarak kaydet)
        // top3Predictions array'i agent_results içinde zaten var, ayrıca kaydetmeye gerek yok
        
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

