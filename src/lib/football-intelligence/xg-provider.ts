// ============================================================================
// xG PROVIDER - GERÇEK xG VERİSİ SAĞLAYICI
// SportMonks ve diğer kaynaklardan gerçek xG verisi çeker
// ============================================================================

import { LEAGUE_PROFILES, getLeagueProfile } from './league-profiles';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamXGData {
  teamId: number;
  teamName: string;
  
  // Gerçek xG Verileri (son 10 maç ortalaması)
  xGFor: number;           // Üretilen xG (beklenen gol)
  xGAgainst: number;       // Yenilen xG (rakibin beklenen golü)
  
  // Gerçek Gol Verileri
  actualGoalsFor: number;
  actualGoalsAgainst: number;
  
  // Performans Analizi
  xGDifference: number;    // xGFor - xGAgainst
  xGPerformance: 'overperforming' | 'underperforming' | 'normal';
  performanceRating: number;  // -100 to +100
  
  // Regresyon Riski
  regressionRisk: 'high' | 'medium' | 'low' | 'none';
  regressionNote: string;
  
  // Pozisyon Kalitesi
  bigChancesCreated: number;   // Büyük şans sayısı
  bigChancesMissed: number;    // Kaçırılan büyük şans
  conversionRate: number;      // Şut-gol dönüşüm oranı (%)
  
  // Maç Bazlı xG
  matchXGHistory: {
    date: string;
    opponent: string;
    xGFor: number;
    xGAgainst: number;
    actualScore: string;
    venue: 'home' | 'away';
  }[];
}

export interface MatchXGPrediction {
  homeTeam: TeamXGData;
  awayTeam: TeamXGData;
  
  // Kombine xG Tahmini
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedTotalGoals: number;
  
  // xG Bazlı Olasılıklar
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  
  over25Probability: number;
  under25Probability: number;
  bttsYesProbability: number;
  bttsNoProbability: number;
  
  // Güven ve Notlar
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  confidenceMultiplier: number;  // 0.8 - 1.2
  notes: string[];
}

// ============================================================================
// SPORTMONKS xG FETCH (Gerçek API)
// ============================================================================

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

/**
 * SportMonks'tan takım xG verilerini çek
 */
async function fetchTeamXGFromSportMonks(teamId: number): Promise<Partial<TeamXGData> | null> {
  if (!SPORTMONKS_API_KEY) {
    console.warn('SPORTMONKS_API_KEY not set for xG fetch');
    return null;
  }
  
  try {
    // Son 10 maçı çek (xG dahil)
    const response = await fetch(
      `${SPORTMONKS_BASE_URL}/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=participantIds:${teamId}&include=statistics;scores&per_page=10`,
      { next: { revalidate: 3600 } }  // 1 saat cache
    );
    
    if (!response.ok) {
      console.error(`SportMonks xG API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const fixtures = data.data || [];
    
    if (fixtures.length === 0) {
      return null;
    }
    
    // xG verilerini hesapla
    let totalXGFor = 0;
    let totalXGAgainst = 0;
    let totalGoalsFor = 0;
    let totalGoalsAgainst = 0;
    let matchCount = 0;
    const matchHistory: TeamXGData['matchXGHistory'] = [];
    
    for (const fixture of fixtures) {
      const stats = fixture.statistics || [];
      const scores = fixture.scores || [];
      
      // Takımın ev sahibi mi deplasman mı olduğunu bul
      const isHome = fixture.participants?.[0]?.id === teamId;
      const opponent = isHome 
        ? fixture.participants?.[1]?.name 
        : fixture.participants?.[0]?.name;
      
      // xG verilerini bul
      let homeXG = 0;
      let awayXG = 0;
      
      for (const stat of stats) {
        if (stat.type?.code === 'expected-goals') {
          if (stat.location === 'home') homeXG = parseFloat(stat.data?.value || 0);
          if (stat.location === 'away') awayXG = parseFloat(stat.data?.value || 0);
        }
      }
      
      // Skor bilgilerini al
      let homeGoals = 0;
      let awayGoals = 0;
      for (const score of scores) {
        if (score.description === 'CURRENT') {
          homeGoals = score.score?.participant === 'home' ? score.score?.goals : homeGoals;
          awayGoals = score.score?.participant === 'away' ? score.score?.goals : awayGoals;
        }
      }
      
      // Verileri topla
      if (homeXG > 0 || awayXG > 0) {
        matchCount++;
        
        if (isHome) {
          totalXGFor += homeXG;
          totalXGAgainst += awayXG;
          totalGoalsFor += homeGoals;
          totalGoalsAgainst += awayGoals;
        } else {
          totalXGFor += awayXG;
          totalXGAgainst += homeXG;
          totalGoalsFor += awayGoals;
          totalGoalsAgainst += homeGoals;
        }
        
        matchHistory.push({
          date: fixture.starting_at || '',
          opponent: opponent || 'Unknown',
          xGFor: isHome ? homeXG : awayXG,
          xGAgainst: isHome ? awayXG : homeXG,
          actualScore: isHome ? `${homeGoals}-${awayGoals}` : `${awayGoals}-${homeGoals}`,
          venue: isHome ? 'home' : 'away',
        });
      }
    }
    
    if (matchCount === 0) {
      return null;
    }
    
    // Ortalamaları hesapla
    const avgXGFor = totalXGFor / matchCount;
    const avgXGAgainst = totalXGAgainst / matchCount;
    const avgGoalsFor = totalGoalsFor / matchCount;
    const avgGoalsAgainst = totalGoalsAgainst / matchCount;
    
    return {
      teamId,
      xGFor: parseFloat(avgXGFor.toFixed(2)),
      xGAgainst: parseFloat(avgXGAgainst.toFixed(2)),
      actualGoalsFor: parseFloat(avgGoalsFor.toFixed(2)),
      actualGoalsAgainst: parseFloat(avgGoalsAgainst.toFixed(2)),
      matchXGHistory: matchHistory.slice(0, 5),  // Son 5 maç
    };
  } catch (error) {
    console.error('Error fetching xG from SportMonks:', error);
    return null;
  }
}

// ============================================================================
// xG HESAPLAMA (Veri yoksa tahmin)
// ============================================================================

/**
 * Form verilerinden xG tahmin et (gerçek veri yoksa)
 */
function estimateXGFromForm(
  avgGoalsScored: number,
  avgGoalsConceded: number,
  over25Percentage: number,
  bttsPercentage: number,
  leagueProfile: typeof LEAGUE_PROFILES[keyof typeof LEAGUE_PROFILES] | null
): {
  estimatedXGFor: number;
  estimatedXGAgainst: number;
  confidence: number;
  method: 'api' | 'estimated';
} {
  // Lig xG çarpanını al
  const xgMultiplier = leagueProfile?.xgMultiplier || 0.95;
  
  // xG tahmini: Gerçek gollerden biraz daha düşük olmalı (şans faktörü)
  // Ama üst liglerde xG ve gerçek gol yakın
  let estimatedXGFor = avgGoalsScored * xgMultiplier;
  let estimatedXGAgainst = avgGoalsConceded * xgMultiplier;
  
  // Over 2.5 yüzdesine göre ayarla
  if (over25Percentage > 60) {
    // Gol beklentisi yüksek, xG'yi hafif artır
    estimatedXGFor *= 1.05;
    estimatedXGAgainst *= 1.02;
  } else if (over25Percentage < 40) {
    // Düşük gol, xG düşür
    estimatedXGFor *= 0.95;
    estimatedXGAgainst *= 0.95;
  }
  
  // BTTS yüzdesine göre ayarla
  if (bttsPercentage > 60) {
    // Her iki taraf da gol atıyor, xG dengeli olmalı
    const avgXG = (estimatedXGFor + estimatedXGAgainst) / 2;
    estimatedXGFor = estimatedXGFor * 0.9 + avgXG * 0.1;
    estimatedXGAgainst = estimatedXGAgainst * 0.9 + avgXG * 0.1;
  }
  
  // Sınırla
  estimatedXGFor = Math.max(0.4, Math.min(3.0, estimatedXGFor));
  estimatedXGAgainst = Math.max(0.3, Math.min(2.5, estimatedXGAgainst));
  
  // Güven hesapla (tahmin olduğu için düşük)
  const confidence = leagueProfile?.xgReliability || 60;
  
  return {
    estimatedXGFor: parseFloat(estimatedXGFor.toFixed(2)),
    estimatedXGAgainst: parseFloat(estimatedXGAgainst.toFixed(2)),
    confidence: confidence * 0.7,  // Tahmin olduğu için %70'e indir
    method: 'estimated',
  };
}

// ============================================================================
// PERFORMANS ANALİZİ
// ============================================================================

/**
 * xG vs Gerçek Gol performans analizi
 */
function analyzeXGPerformance(
  xGFor: number,
  actualGoalsFor: number,
  xGAgainst: number,
  actualGoalsAgainst: number
): {
  performance: 'overperforming' | 'underperforming' | 'normal';
  rating: number;
  regressionRisk: 'high' | 'medium' | 'low' | 'none';
  note: string;
} {
  // Ofansif performans (gol atma)
  const offensiveDiff = actualGoalsFor - xGFor;
  const offensivePerformance = offensiveDiff / xGFor;  // Yüzde olarak
  
  // Defansif performans (gol yeme)
  const defensiveDiff = xGAgainst - actualGoalsAgainst;  // Pozitif = iyi savunma
  const defensivePerformance = defensiveDiff / xGAgainst;
  
  // Toplam performans rating (-100 to +100)
  const rating = Math.round((offensivePerformance + defensivePerformance) * 50);
  
  // Performans kategorisi
  let performance: 'overperforming' | 'underperforming' | 'normal';
  if (rating > 15) {
    performance = 'overperforming';
  } else if (rating < -15) {
    performance = 'underperforming';
  } else {
    performance = 'normal';
  }
  
  // Regresyon riski
  let regressionRisk: 'high' | 'medium' | 'low' | 'none';
  let note: string;
  
  if (performance === 'overperforming') {
    if (rating > 30) {
      regressionRisk = 'high';
      note = 'Takım xG\'nin çok üstünde performans gösteriyor. Yüksek regresyon riski! Gol ortalaması düşebilir.';
    } else {
      regressionRisk = 'medium';
      note = 'Takım xG\'nin üstünde performans gösteriyor. Orta seviye regresyon riski.';
    }
  } else if (performance === 'underperforming') {
    if (rating < -30) {
      regressionRisk = 'high';
      note = 'Takım xG\'nin çok altında performans gösteriyor. Pozitif regresyon bekleniyor! Gol ortalaması artabilir.';
    } else {
      regressionRisk = 'medium';
      note = 'Takım xG\'nin altında performans gösteriyor. Pozitif regresyon olasılığı var.';
    }
  } else {
    regressionRisk = 'none';
    note = 'xG performansı normal seviyelerde. Regresyon riski düşük.';
  }
  
  return { performance, rating, regressionRisk, note };
}

// ============================================================================
// POISSON DAĞILIMI İLE OLASILIK HESAPLAMA
// ============================================================================

/**
 * Poisson olasılık fonksiyonu
 */
function poissonProbability(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * xG'ye dayalı maç olasılıkları hesapla
 */
function calculateMatchProbabilities(
  homeXG: number,
  awayXG: number
): {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  scoreMatrix: number[][];
} {
  // Skor olasılık matrisi (0-5 gol)
  const scoreMatrix: number[][] = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let under25 = 0;
  let bttsYes = 0;
  let bttsNo = 0;
  
  for (let homeGoals = 0; homeGoals <= 6; homeGoals++) {
    scoreMatrix[homeGoals] = [];
    for (let awayGoals = 0; awayGoals <= 6; awayGoals++) {
      const prob = poissonProbability(homeXG, homeGoals) * poissonProbability(awayXG, awayGoals);
      scoreMatrix[homeGoals][awayGoals] = prob;
      
      // Maç sonucu
      if (homeGoals > awayGoals) homeWin += prob;
      else if (homeGoals < awayGoals) awayWin += prob;
      else draw += prob;
      
      // Over/Under
      if (homeGoals + awayGoals > 2) over25 += prob;
      else under25 += prob;
      
      // BTTS
      if (homeGoals > 0 && awayGoals > 0) bttsYes += prob;
      else bttsNo += prob;
    }
  }
  
  // Normalize et
  const total = homeWin + draw + awayWin;
  
  return {
    homeWin: Math.round((homeWin / total) * 100),
    draw: Math.round((draw / total) * 100),
    awayWin: Math.round((awayWin / total) * 100),
    over25: Math.round(over25 * 100),
    under25: Math.round(under25 * 100),
    bttsYes: Math.round(bttsYes * 100),
    bttsNo: Math.round(bttsNo * 100),
    scoreMatrix,
  };
}

// ============================================================================
// ANA FONKSİYON: TAKIM xG VERİSİ AL
// ============================================================================

/**
 * Takım için tam xG verisi al (API veya tahmin)
 */
export async function getTeamXGData(
  teamId: number,
  teamName: string,
  formData: {
    avgGoalsScored: number;
    avgGoalsConceded: number;
    over25Percentage: number;
    bttsPercentage: number;
  },
  leagueName: string
): Promise<TeamXGData> {
  const leagueProfile = getLeagueProfile(leagueName);
  
  // Önce API'den gerçek veri dene
  const apiData = await fetchTeamXGFromSportMonks(teamId);
  
  if (apiData && apiData.xGFor !== undefined) {
    // API verisi var - performans analizi yap
    const performance = analyzeXGPerformance(
      apiData.xGFor,
      apiData.actualGoalsFor || formData.avgGoalsScored,
      apiData.xGAgainst || 1.0,
      apiData.actualGoalsAgainst || formData.avgGoalsConceded
    );
    
    return {
      teamId,
      teamName,
      xGFor: apiData.xGFor,
      xGAgainst: apiData.xGAgainst || 1.0,
      actualGoalsFor: apiData.actualGoalsFor || formData.avgGoalsScored,
      actualGoalsAgainst: apiData.actualGoalsAgainst || formData.avgGoalsConceded,
      xGDifference: parseFloat((apiData.xGFor - (apiData.xGAgainst || 1.0)).toFixed(2)),
      xGPerformance: performance.performance,
      performanceRating: performance.rating,
      regressionRisk: performance.regressionRisk,
      regressionNote: performance.note,
      bigChancesCreated: 0,  // API'den gelmezse
      bigChancesMissed: 0,
      conversionRate: 0,
      matchXGHistory: apiData.matchXGHistory || [],
    };
  }
  
  // API verisi yok - tahmin et
  const estimated = estimateXGFromForm(
    formData.avgGoalsScored,
    formData.avgGoalsConceded,
    formData.over25Percentage,
    formData.bttsPercentage,
    leagueProfile
  );
  
  const performance = analyzeXGPerformance(
    estimated.estimatedXGFor,
    formData.avgGoalsScored,
    estimated.estimatedXGAgainst,
    formData.avgGoalsConceded
  );
  
  return {
    teamId,
    teamName,
    xGFor: estimated.estimatedXGFor,
    xGAgainst: estimated.estimatedXGAgainst,
    actualGoalsFor: formData.avgGoalsScored,
    actualGoalsAgainst: formData.avgGoalsConceded,
    xGDifference: parseFloat((estimated.estimatedXGFor - estimated.estimatedXGAgainst).toFixed(2)),
    xGPerformance: performance.performance,
    performanceRating: performance.rating,
    regressionRisk: performance.regressionRisk,
    regressionNote: `[TAHMİN] ${performance.note}`,
    bigChancesCreated: 0,
    bigChancesMissed: 0,
    conversionRate: 0,
    matchXGHistory: [],
  };
}

// ============================================================================
// ANA FONKSİYON: MAÇ xG TAHMİNİ
// ============================================================================

/**
 * İki takım için maç xG tahmini al
 */
export async function getMatchXGPrediction(
  homeTeamId: number,
  homeTeamName: string,
  awayTeamId: number,
  awayTeamName: string,
  homeFormData: {
    avgGoalsScored: number;
    avgGoalsConceded: number;
    over25Percentage: number;
    bttsPercentage: number;
  },
  awayFormData: {
    avgGoalsScored: number;
    avgGoalsConceded: number;
    over25Percentage: number;
    bttsPercentage: number;
  },
  leagueName: string
): Promise<MatchXGPrediction> {
  const leagueProfile = getLeagueProfile(leagueName);
  
  // Her iki takım için xG verisi al
  const [homeTeamXG, awayTeamXG] = await Promise.all([
    getTeamXGData(homeTeamId, homeTeamName, homeFormData, leagueName),
    getTeamXGData(awayTeamId, awayTeamName, awayFormData, leagueName),
  ]);
  
  // Beklenen goller hesapla
  // Ev sahibi: (Ev sahibi xGFor + Deplasman xGAgainst) / 2 + Ev avantajı
  // Deplasman: (Deplasman xGFor + Ev sahibi xGAgainst) / 2
  const homeAdvantage = leagueProfile?.homeGoalAdvantage || 0.35;
  
  let expectedHomeGoals = (homeTeamXG.xGFor + awayTeamXG.xGAgainst) / 2 + homeAdvantage;
  let expectedAwayGoals = (awayTeamXG.xGFor + homeTeamXG.xGAgainst) / 2 - (homeAdvantage * 0.3);
  
  // Lig ortalamasına regresyon
  if (leagueProfile) {
    const leagueAvgPerTeam = leagueProfile.avgGoalsPerMatch / 2;
    const regressionFactor = 0.15;
    
    expectedHomeGoals = expectedHomeGoals * (1 - regressionFactor) + leagueAvgPerTeam * regressionFactor;
    expectedAwayGoals = expectedAwayGoals * (1 - regressionFactor) + leagueAvgPerTeam * regressionFactor;
  }
  
  // Sınırla
  expectedHomeGoals = Math.max(0.5, Math.min(3.5, expectedHomeGoals));
  expectedAwayGoals = Math.max(0.3, Math.min(3.0, expectedAwayGoals));
  
  // Poisson ile olasılıklar hesapla
  const probabilities = calculateMatchProbabilities(expectedHomeGoals, expectedAwayGoals);
  
  // Veri kalitesi değerlendir
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  let confidenceMultiplier: number;
  const notes: string[] = [];
  
  const hasRealData = homeTeamXG.matchXGHistory.length > 0 || awayTeamXG.matchXGHistory.length > 0;
  
  if (hasRealData && leagueProfile && leagueProfile.xgReliability >= 80) {
    dataQuality = 'excellent';
    confidenceMultiplier = 1.1;
    notes.push('Gerçek xG verisi kullanıldı');
  } else if (hasRealData) {
    dataQuality = 'good';
    confidenceMultiplier = 1.0;
    notes.push('Gerçek xG verisi mevcut');
  } else if (leagueProfile) {
    dataQuality = 'fair';
    confidenceMultiplier = 0.9;
    notes.push('xG tahmin edildi (lig profili kullanıldı)');
  } else {
    dataQuality = 'poor';
    confidenceMultiplier = 0.8;
    notes.push('xG tahmin edildi (genel parametreler)');
  }
  
  // Regresyon uyarıları
  if (homeTeamXG.regressionRisk === 'high') {
    notes.push(`⚠️ ${homeTeamName}: ${homeTeamXG.regressionNote}`);
  }
  if (awayTeamXG.regressionRisk === 'high') {
    notes.push(`⚠️ ${awayTeamName}: ${awayTeamXG.regressionNote}`);
  }
  
  return {
    homeTeam: homeTeamXG,
    awayTeam: awayTeamXG,
    expectedHomeGoals: parseFloat(expectedHomeGoals.toFixed(2)),
    expectedAwayGoals: parseFloat(expectedAwayGoals.toFixed(2)),
    expectedTotalGoals: parseFloat((expectedHomeGoals + expectedAwayGoals).toFixed(2)),
    homeWinProbability: probabilities.homeWin,
    drawProbability: probabilities.draw,
    awayWinProbability: probabilities.awayWin,
    over25Probability: probabilities.over25,
    under25Probability: probabilities.under25,
    bttsYesProbability: probabilities.bttsYes,
    bttsNoProbability: probabilities.bttsNo,
    dataQuality,
    confidenceMultiplier,
    notes,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export { calculateMatchProbabilities, analyzeXGPerformance };

