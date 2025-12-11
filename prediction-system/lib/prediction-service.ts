// ============================================================================
// FOOTBALL ANALYTICS PRO - TAHMİN SERVİSİ
// ============================================================================
// Veritabanı işlemlerini yöneten servis
// ============================================================================

import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ============================================================================
// TİPLER
// ============================================================================

export interface PredictionData {
  fixtureId?: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  league?: string;
  leagueId?: number;
  matchDate: Date;
  
  matchResult: {
    prediction: string;
    confidence: number;
    votes: number;
    reasonings?: string[];
  };
  
  overUnder: {
    prediction: string;
    confidence: number;
    votes: number;
    reasonings?: string[];
  };
  
  btts: {
    prediction: string;
    confidence: number;
    votes: number;
    reasonings?: string[];
  };
  
  bestBet: {
    type: string;
    selection: string;
    confidence: number;
  };
  
  riskLevel: string;
  totalModels: number;
  
  aiStatus: {
    claude: boolean;
    openai: boolean;
    gemini: boolean;
    perplexity: boolean;
  };
  
  individualAnalyses?: {
    claude?: any;
    openai?: any;
    gemini?: any;
    perplexity?: any;
  };
  
  stats?: {
    home?: any;
    away?: any;
    h2h?: any;
  };
  
  language?: string;
  analysisTimeMs?: number;
}

export interface MatchResult {
  fixtureId?: number;
  homeTeamId: number;
  awayTeamId: number;
  matchDate: Date;
  homeGoals: number;
  awayGoals: number;
}

// ============================================================================
// CACHE KONTROLÜ - Maç daha önce analiz edildi mi?
// ============================================================================

export async function getCachedPrediction(
  homeTeamId: number,
  awayTeamId: number,
  matchDate: Date
): Promise<any | null> {
  try {
    // Aynı gün içindeki maçı bul
    const startOfDay = new Date(matchDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(matchDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const prediction = await prisma.prediction.findFirst({
      where: {
        homeTeamId,
        awayTeamId,
        matchDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    if (prediction) {
      console.log(`✅ Cache hit: ${prediction.homeTeam} vs ${prediction.awayTeam}`);
      return formatPredictionResponse(prediction);
    }
    
    return null;
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

// ============================================================================
// TAHMİN KAYDETME
// ============================================================================

export async function savePrediction(data: PredictionData): Promise<any> {
  try {
    const prediction = await prisma.prediction.create({
      data: {
        fixtureId: data.fixtureId,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        league: data.league,
        leagueId: data.leagueId,
        matchDate: data.matchDate,
        
        matchResultPrediction: data.matchResult.prediction,
        matchResultConfidence: data.matchResult.confidence,
        matchResultVotes: data.matchResult.votes,
        matchResultReasonings: JSON.stringify(data.matchResult.reasonings || []),
        
        overUnderPrediction: data.overUnder.prediction,
        overUnderConfidence: data.overUnder.confidence,
        overUnderVotes: data.overUnder.votes,
        overUnderReasonings: JSON.stringify(data.overUnder.reasonings || []),
        
        bttsPrediction: data.btts.prediction,
        bttsConfidence: data.btts.confidence,
        bttsVotes: data.btts.votes,
        bttsReasonings: JSON.stringify(data.btts.reasonings || []),
        
        bestBetType: data.bestBet.type,
        bestBetSelection: data.bestBet.selection,
        bestBetConfidence: data.bestBet.confidence,
        riskLevel: data.riskLevel,
        
        claudeUsed: data.aiStatus.claude,
        openaiUsed: data.aiStatus.openai,
        geminiUsed: data.aiStatus.gemini,
        perplexityUsed: data.aiStatus.perplexity,
        totalModels: data.totalModels,
        
        claudePrediction: data.individualAnalyses?.claude ? JSON.stringify(data.individualAnalyses.claude) : null,
        openaiPrediction: data.individualAnalyses?.openai ? JSON.stringify(data.individualAnalyses.openai) : null,
        geminiPrediction: data.individualAnalyses?.gemini ? JSON.stringify(data.individualAnalyses.gemini) : null,
        perplexityPrediction: data.individualAnalyses?.perplexity ? JSON.stringify(data.individualAnalyses.perplexity) : null,
        
        homeTeamStats: data.stats?.home ? JSON.stringify(data.stats.home) : null,
        awayTeamStats: data.stats?.away ? JSON.stringify(data.stats.away) : null,
        h2hStats: data.stats?.h2h ? JSON.stringify(data.stats.h2h) : null,
        
        language: data.language || 'tr',
        analysisTimeMs: data.analysisTimeMs,
        status: 'pending',
      },
    });
    
    console.log(`💾 Prediction saved: ${prediction.id}`);
    return prediction;
  } catch (error: any) {
    // Unique constraint hatası - zaten var
    if (error.code === 'P2002') {
      console.log('⚠️ Prediction already exists, fetching...');
      return getCachedPrediction(data.homeTeamId!, data.awayTeamId!, data.matchDate);
    }
    console.error('Save prediction error:', error);
    throw error;
  }
}

// ============================================================================
// SONUÇ GÜNCELLEME - Maç bittikten sonra
// ============================================================================

export async function updateMatchResult(result: MatchResult): Promise<any> {
  try {
    // Önce tahmini bul
    const startOfDay = new Date(result.matchDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(result.matchDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const prediction = await prisma.prediction.findFirst({
      where: {
        OR: [
          { fixtureId: result.fixtureId },
          {
            homeTeamId: result.homeTeamId,
            awayTeamId: result.awayTeamId,
            matchDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
    });
    
    if (!prediction) {
      console.log('⚠️ No prediction found for this match');
      return null;
    }
    
    // Gerçek sonuçları hesapla
    const actualResult = result.homeGoals > result.awayGoals 
      ? 'Home Win' 
      : result.homeGoals < result.awayGoals 
        ? 'Away Win' 
        : 'Draw';
    
    const actualTotalGoals = result.homeGoals + result.awayGoals;
    const actualBtts = result.homeGoals > 0 && result.awayGoals > 0;
    
    // Doğruluk kontrolü
    const matchResultCorrect = prediction.matchResultPrediction === actualResult;
    const overUnderCorrect = prediction.overUnderPrediction === 'Over 2.5' 
      ? actualTotalGoals > 2.5 
      : actualTotalGoals < 2.5;
    const bttsCorrect = prediction.bttsPrediction === 'Yes' ? actualBtts : !actualBtts;
    
    // Best bet doğruluğu
    let bestBetCorrect = false;
    if (prediction.bestBetType === 'MATCH_RESULT') {
      bestBetCorrect = matchResultCorrect;
    } else if (prediction.bestBetType === 'OVER_UNDER_25') {
      bestBetCorrect = overUnderCorrect;
    } else if (prediction.bestBetType === 'BTTS') {
      bestBetCorrect = bttsCorrect;
    }
    
    // Bireysel AI doğruluklarını hesapla
    const aiCorrectness = calculateAICorrectness(prediction, actualResult, actualTotalGoals, actualBtts);
    
    // Güncelle
    const updated = await prisma.prediction.update({
      where: { id: prediction.id },
      data: {
        actualHomeGoals: result.homeGoals,
        actualAwayGoals: result.awayGoals,
        actualResult,
        actualTotalGoals,
        actualBtts,
        matchResultCorrect,
        overUnderCorrect,
        bttsCorrect,
        bestBetCorrect,
        ...aiCorrectness,
        status: 'completed',
        resultUpdatedAt: new Date(),
      },
    });
    
    console.log(`✅ Result updated: ${prediction.homeTeam} ${result.homeGoals}-${result.awayGoals} ${prediction.awayTeam}`);
    console.log(`   Match: ${matchResultCorrect ? '✓' : '✗'} | Goals: ${overUnderCorrect ? '✓' : '✗'} | BTTS: ${bttsCorrect ? '✓' : '✗'}`);
    
    // Günlük ve lig istatistiklerini güncelle
    await updateDailyStats(updated);
    await updateLeagueStats(updated);
    
    return updated;
  } catch (error) {
    console.error('Update result error:', error);
    throw error;
  }
}

// ============================================================================
// AI DOĞRULUK HESAPLAMA
// ============================================================================

function calculateAICorrectness(
  prediction: any,
  actualResult: string,
  actualTotalGoals: number,
  actualBtts: boolean
) {
  const result: any = {};
  
  const aiModels = ['claude', 'openai', 'gemini', 'perplexity'] as const;
  
  for (const ai of aiModels) {
    const predField = `${ai}Prediction` as keyof typeof prediction;
    if (prediction[predField]) {
      try {
        const aiPred = JSON.parse(prediction[predField] as string);
        
        // Match result
        result[`${ai}MatchCorrect`] = aiPred.matchResult?.prediction === actualResult;
        
        // Goals
        const goalsPred = aiPred.overUnder25?.prediction || aiPred.overUnder?.prediction;
        result[`${ai}GoalsCorrect`] = goalsPred === 'Over 2.5' 
          ? actualTotalGoals > 2.5 
          : actualTotalGoals < 2.5;
        
        // BTTS
        const bttsPred = aiPred.btts?.prediction;
        result[`${ai}BttsCorrect`] = bttsPred === 'Yes' ? actualBtts : !actualBtts;
        
      } catch (e) {
        // JSON parse hatası
      }
    }
  }
  
  return result;
}

// ============================================================================
// GÜNLÜK İSTATİSTİK GÜNCELLEME
// ============================================================================

async function updateDailyStats(prediction: any) {
  const date = new Date(prediction.matchDate);
  date.setHours(0, 0, 0, 0);
  
  try {
    await prisma.dailyStats.upsert({
      where: { date },
      create: {
        date,
        totalPredictions: 1,
        completedMatches: 1,
        matchResultCorrect: prediction.matchResultCorrect ? 1 : 0,
        matchResultTotal: 1,
        overUnderCorrect: prediction.overUnderCorrect ? 1 : 0,
        overUnderTotal: 1,
        bttsCorrect: prediction.bttsCorrect ? 1 : 0,
        bttsTotal: 1,
        // AI stats...
        claudeMatchCorrect: prediction.claudeMatchCorrect ? 1 : 0,
        claudeMatchTotal: prediction.claudeUsed ? 1 : 0,
        openaiMatchCorrect: prediction.openaiMatchCorrect ? 1 : 0,
        openaiMatchTotal: prediction.openaiUsed ? 1 : 0,
        geminiMatchCorrect: prediction.geminiMatchCorrect ? 1 : 0,
        geminiMatchTotal: prediction.geminiUsed ? 1 : 0,
        perplexityMatchCorrect: prediction.perplexityMatchCorrect ? 1 : 0,
        perplexityMatchTotal: prediction.perplexityUsed ? 1 : 0,
      },
      update: {
        completedMatches: { increment: 1 },
        matchResultCorrect: { increment: prediction.matchResultCorrect ? 1 : 0 },
        matchResultTotal: { increment: 1 },
        overUnderCorrect: { increment: prediction.overUnderCorrect ? 1 : 0 },
        overUnderTotal: { increment: 1 },
        bttsCorrect: { increment: prediction.bttsCorrect ? 1 : 0 },
        bttsTotal: { increment: 1 },
        // AI stats...
        claudeMatchCorrect: { increment: prediction.claudeMatchCorrect ? 1 : 0 },
        claudeMatchTotal: { increment: prediction.claudeUsed ? 1 : 0 },
        openaiMatchCorrect: { increment: prediction.openaiMatchCorrect ? 1 : 0 },
        openaiMatchTotal: { increment: prediction.openaiUsed ? 1 : 0 },
        geminiMatchCorrect: { increment: prediction.geminiMatchCorrect ? 1 : 0 },
        geminiMatchTotal: { increment: prediction.geminiUsed ? 1 : 0 },
        perplexityMatchCorrect: { increment: prediction.perplexityMatchCorrect ? 1 : 0 },
        perplexityMatchTotal: { increment: prediction.perplexityUsed ? 1 : 0 },
      },
    });
  } catch (error) {
    console.error('Update daily stats error:', error);
  }
}

// ============================================================================
// LİG İSTATİSTİK GÜNCELLEME
// ============================================================================

async function updateLeagueStats(prediction: any) {
  if (!prediction.league) return;
  
  try {
    const existing = await prisma.leagueStats.findUnique({
      where: { leagueName: prediction.league },
    });
    
    const newTotal = (existing?.completedMatches || 0) + 1;
    const newMatchCorrect = (existing?.matchResultCorrect || 0) + (prediction.matchResultCorrect ? 1 : 0);
    const newOverUnderCorrect = (existing?.overUnderCorrect || 0) + (prediction.overUnderCorrect ? 1 : 0);
    const newBttsCorrect = (existing?.bttsCorrect || 0) + (prediction.bttsCorrect ? 1 : 0);
    
    await prisma.leagueStats.upsert({
      where: { leagueName: prediction.league },
      create: {
        leagueName: prediction.league,
        leagueId: prediction.leagueId,
        totalPredictions: 1,
        completedMatches: 1,
        matchResultCorrect: prediction.matchResultCorrect ? 1 : 0,
        matchResultAccuracy: prediction.matchResultCorrect ? 100 : 0,
        overUnderCorrect: prediction.overUnderCorrect ? 1 : 0,
        overUnderAccuracy: prediction.overUnderCorrect ? 100 : 0,
        bttsCorrect: prediction.bttsCorrect ? 1 : 0,
        bttsAccuracy: prediction.bttsCorrect ? 100 : 0,
        avgConfidence: prediction.matchResultConfidence,
        avgActualGoals: prediction.actualTotalGoals || 0,
      },
      update: {
        completedMatches: newTotal,
        matchResultCorrect: newMatchCorrect,
        matchResultAccuracy: (newMatchCorrect / newTotal) * 100,
        overUnderCorrect: newOverUnderCorrect,
        overUnderAccuracy: (newOverUnderCorrect / newTotal) * 100,
        bttsCorrect: newBttsCorrect,
        bttsAccuracy: (newBttsCorrect / newTotal) * 100,
      },
    });
  } catch (error) {
    console.error('Update league stats error:', error);
  }
}

// ============================================================================
// İSTATİSTİK SORGULARI
// ============================================================================

export async function getOverallStats() {
  const predictions = await prisma.prediction.findMany({
    where: { status: 'completed' },
  });
  
  const total = predictions.length;
  if (total === 0) return null;
  
  const matchCorrect = predictions.filter(p => p.matchResultCorrect).length;
  const goalsCorrect = predictions.filter(p => p.overUnderCorrect).length;
  const bttsCorrect = predictions.filter(p => p.bttsCorrect).length;
  const bestBetCorrect = predictions.filter(p => p.bestBetCorrect).length;
  
  // AI bazlı
  const aiStats = {
    claude: { match: 0, goals: 0, btts: 0, total: 0 },
    openai: { match: 0, goals: 0, btts: 0, total: 0 },
    gemini: { match: 0, goals: 0, btts: 0, total: 0 },
    perplexity: { match: 0, goals: 0, btts: 0, total: 0 },
  };
  
  for (const p of predictions) {
    if (p.claudeUsed) {
      aiStats.claude.total++;
      if (p.claudeMatchCorrect) aiStats.claude.match++;
      if (p.claudeGoalsCorrect) aiStats.claude.goals++;
      if (p.claudeBttsCorrect) aiStats.claude.btts++;
    }
    if (p.openaiUsed) {
      aiStats.openai.total++;
      if (p.openaiMatchCorrect) aiStats.openai.match++;
      if (p.openaiGoalsCorrect) aiStats.openai.goals++;
      if (p.openaiBttsCorrect) aiStats.openai.btts++;
    }
    if (p.geminiUsed) {
      aiStats.gemini.total++;
      if (p.geminiMatchCorrect) aiStats.gemini.match++;
      if (p.geminiGoalsCorrect) aiStats.gemini.goals++;
      if (p.geminiBttsCorrect) aiStats.gemini.btts++;
    }
    if (p.perplexityUsed) {
      aiStats.perplexity.total++;
      if (p.perplexityMatchCorrect) aiStats.perplexity.match++;
      if (p.perplexityGoalsCorrect) aiStats.perplexity.goals++;
      if (p.perplexityBttsCorrect) aiStats.perplexity.btts++;
    }
  }
  
  return {
    overall: {
      total,
      matchResult: {
        correct: matchCorrect,
        accuracy: ((matchCorrect / total) * 100).toFixed(1),
      },
      overUnder: {
        correct: goalsCorrect,
        accuracy: ((goalsCorrect / total) * 100).toFixed(1),
      },
      btts: {
        correct: bttsCorrect,
        accuracy: ((bttsCorrect / total) * 100).toFixed(1),
      },
      bestBet: {
        correct: bestBetCorrect,
        accuracy: ((bestBetCorrect / total) * 100).toFixed(1),
      },
    },
    aiPerformance: {
      claude: {
        total: aiStats.claude.total,
        matchAccuracy: aiStats.claude.total > 0 ? ((aiStats.claude.match / aiStats.claude.total) * 100).toFixed(1) : '0',
        goalsAccuracy: aiStats.claude.total > 0 ? ((aiStats.claude.goals / aiStats.claude.total) * 100).toFixed(1) : '0',
        bttsAccuracy: aiStats.claude.total > 0 ? ((aiStats.claude.btts / aiStats.claude.total) * 100).toFixed(1) : '0',
      },
      openai: {
        total: aiStats.openai.total,
        matchAccuracy: aiStats.openai.total > 0 ? ((aiStats.openai.match / aiStats.openai.total) * 100).toFixed(1) : '0',
        goalsAccuracy: aiStats.openai.total > 0 ? ((aiStats.openai.goals / aiStats.openai.total) * 100).toFixed(1) : '0',
        bttsAccuracy: aiStats.openai.total > 0 ? ((aiStats.openai.btts / aiStats.openai.total) * 100).toFixed(1) : '0',
      },
      gemini: {
        total: aiStats.gemini.total,
        matchAccuracy: aiStats.gemini.total > 0 ? ((aiStats.gemini.match / aiStats.gemini.total) * 100).toFixed(1) : '0',
        goalsAccuracy: aiStats.gemini.total > 0 ? ((aiStats.gemini.goals / aiStats.gemini.total) * 100).toFixed(1) : '0',
        bttsAccuracy: aiStats.gemini.total > 0 ? ((aiStats.gemini.btts / aiStats.gemini.total) * 100).toFixed(1) : '0',
      },
      perplexity: {
        total: aiStats.perplexity.total,
        matchAccuracy: aiStats.perplexity.total > 0 ? ((aiStats.perplexity.match / aiStats.perplexity.total) * 100).toFixed(1) : '0',
        goalsAccuracy: aiStats.perplexity.total > 0 ? ((aiStats.perplexity.goals / aiStats.perplexity.total) * 100).toFixed(1) : '0',
        bttsAccuracy: aiStats.perplexity.total > 0 ? ((aiStats.perplexity.btts / aiStats.perplexity.total) * 100).toFixed(1) : '0',
      },
    },
  };
}

export async function getLeagueStats() {
  return prisma.leagueStats.findMany({
    orderBy: { completedMatches: 'desc' },
  });
}

export async function getPendingPredictions() {
  return prisma.prediction.findMany({
    where: { status: 'pending' },
    orderBy: { matchDate: 'asc' },
  });
}

export async function getRecentPredictions(limit = 20) {
  return prisma.prediction.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

function formatPredictionResponse(prediction: any) {
  return {
    success: true,
    cached: true,
    analysis: {
      matchResult: {
        prediction: prediction.matchResultPrediction,
        confidence: prediction.matchResultConfidence,
        votes: prediction.matchResultVotes,
        totalVotes: prediction.totalModels,
        reasonings: prediction.matchResultReasonings ? JSON.parse(prediction.matchResultReasonings) : [],
      },
      overUnder25: {
        prediction: prediction.overUnderPrediction,
        confidence: prediction.overUnderConfidence,
        votes: prediction.overUnderVotes,
        totalVotes: prediction.totalModels,
        reasonings: prediction.overUnderReasonings ? JSON.parse(prediction.overUnderReasonings) : [],
      },
      btts: {
        prediction: prediction.bttsPrediction,
        confidence: prediction.bttsConfidence,
        votes: prediction.bttsVotes,
        totalVotes: prediction.totalModels,
        reasonings: prediction.bttsReasonings ? JSON.parse(prediction.bttsReasonings) : [],
      },
      riskLevel: prediction.riskLevel,
      bestBets: [{
        type: prediction.bestBetType,
        selection: prediction.bestBetSelection,
        confidence: prediction.bestBetConfidence,
      }],
    },
    aiStatus: {
      claude: prediction.claudeUsed,
      openai: prediction.openaiUsed,
      gemini: prediction.geminiUsed,
      perplexity: prediction.perplexityUsed,
    },
    individualAnalyses: {
      claude: prediction.claudePrediction ? JSON.parse(prediction.claudePrediction) : null,
      openai: prediction.openaiPrediction ? JSON.parse(prediction.openaiPrediction) : null,
      gemini: prediction.geminiPrediction ? JSON.parse(prediction.geminiPrediction) : null,
      perplexity: prediction.perplexityPrediction ? JSON.parse(prediction.perplexityPrediction) : null,
    },
    modelsUsed: [
      prediction.claudeUsed && 'claude',
      prediction.openaiUsed && 'openai',
      prediction.geminiUsed && 'gemini',
      prediction.perplexityUsed && 'perplexity',
    ].filter(Boolean),
    totalModels: prediction.totalModels,
    stats: {
      home: prediction.homeTeamStats ? JSON.parse(prediction.homeTeamStats) : null,
      away: prediction.awayTeamStats ? JSON.parse(prediction.awayTeamStats) : null,
      h2h: prediction.h2hStats ? JSON.parse(prediction.h2hStats) : null,
    },
    // Eğer sonuç güncellendiyse
    ...(prediction.status === 'completed' && {
      actualResult: {
        homeGoals: prediction.actualHomeGoals,
        awayGoals: prediction.actualAwayGoals,
        result: prediction.actualResult,
        totalGoals: prediction.actualTotalGoals,
        btts: prediction.actualBtts,
      },
      accuracy: {
        matchResult: prediction.matchResultCorrect,
        overUnder: prediction.overUnderCorrect,
        btts: prediction.bttsCorrect,
        bestBet: prediction.bestBetCorrect,
      },
    }),
    predictionId: prediction.id,
    createdAt: prediction.createdAt,
  };
}
