// ============================================================================
// REFEREE STATISTICS - HAKEM İSTATİSTİKLERİ
// Hakem verilerini çeker ve maç tahminlerine yansıtır
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface RefereeProfile {
  id: number;
  name: string;
  nationality: string;
  age: number;
  
  // Genel İstatistikler (Sezon)
  matchesRefereed: number;
  
  // Kart İstatistikleri
  yellowCardsPerMatch: number;
  redCardsPerMatch: number;
  cardsPerMatch: number;  // Toplam kart/maç
  strictness: 'very_strict' | 'strict' | 'average' | 'lenient' | 'very_lenient';
  
  // Penaltı İstatistikleri
  penaltiesPerMatch: number;
  penaltyTendency: 'high' | 'average' | 'low';
  
  // Ev Sahibi Eğilimi
  homeWinPercentage: number;
  drawPercentage: number;
  awayWinPercentage: number;
  homeBias: 'pro_home' | 'neutral' | 'pro_away';
  homeBiasStrength: number;  // -100 to +100
  
  // Gol ve Oyun Tarzı
  avgGoalsPerMatch: number;
  over25Percentage: number;
  freeKicksPerMatch: number;
  
  // VAR İstatistikleri
  varReviewsPerMatch: number;
  varOverturnedDecisions: number;
  
  // Takım Bazlı Geçmiş
  teamHistory: {
    teamId: number;
    teamName: string;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    yellowCards: number;
    redCards: number;
    penalties: number;
  }[];
}

export interface RefereeMatchImpact {
  referee: RefereeProfile;
  
  // Tahmin Ayarlamaları
  cardsPrediction: {
    over: string;  // "Over 3.5", "Over 4.5", etc.
    confidence: number;
    reasoning: string;
  };
  
  penaltyRisk: {
    level: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  
  matchResultBias: {
    direction: 'home' | 'away' | 'neutral';
    strength: number;  // 0-20 points
    reasoning: string;
  };
  
  // Takımlara Özel
  homeTeamHistory: {
    teamId: number;
    favorability: 'positive' | 'neutral' | 'negative';
    note: string;
  } | null;
  
  awayTeamHistory: {
    teamId: number;
    favorability: 'positive' | 'neutral' | 'negative';
    note: string;
  } | null;
  
  // Genel Özet
  overallNote: string;
}

// ============================================================================
// SPORTMONKS API
// ============================================================================

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

/**
 * Maç hakemini ve istatistiklerini çek
 */
export async function fetchRefereeFromSportMonks(fixtureId: number): Promise<RefereeProfile | null> {
  if (!SPORTMONKS_API_KEY) {
    console.warn('SPORTMONKS_API_KEY not set for referee fetch');
    return null;
  }
  
  try {
    // Maç bilgisinden hakemi al
    const fixtureResponse = await fetch(
      `${SPORTMONKS_BASE_URL}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=referees`,
      { next: { revalidate: 3600 } }
    );
    
    if (!fixtureResponse.ok) {
      console.error(`SportMonks Fixture API error: ${fixtureResponse.status}`);
      return null;
    }
    
    const fixtureData = await fixtureResponse.json();
    const referees = fixtureData.data?.referees || [];
    
    // Ana hakemi bul (type_id = 1)
    const mainReferee = referees.find((r: any) => r.type_id === 1);
    if (!mainReferee) {
      console.log('No main referee found for fixture', fixtureId);
      return null;
    }
    
    const refereeId = mainReferee.referee_id;
    
    // Hakem detaylarını çek
    const refereeResponse = await fetch(
      `${SPORTMONKS_BASE_URL}/referees/${refereeId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`,
      { next: { revalidate: 86400 } }  // 1 gün cache
    );
    
    if (!refereeResponse.ok) {
      return createBasicRefereeProfile(mainReferee);
    }
    
    const refereeData = await refereeResponse.json();
    const referee = refereeData.data;
    const stats = referee.statistics || [];
    
    // İstatistikleri hesapla
    let totalMatches = 0;
    let totalYellowCards = 0;
    let totalRedCards = 0;
    let totalPenalties = 0;
    let totalGoals = 0;
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    
    for (const stat of stats) {
      if (stat.season_id) {  // Sezon bazlı istatistikler
        totalMatches += stat.data?.matches || 0;
        totalYellowCards += stat.data?.yellowcards || 0;
        totalRedCards += stat.data?.redcards || 0;
        totalPenalties += stat.data?.penalties || 0;
        totalGoals += stat.data?.goals || 0;
        homeWins += stat.data?.home_wins || 0;
        draws += stat.data?.draws || 0;
        awayWins += stat.data?.away_wins || 0;
      }
    }
    
    // Ortalamalar
    const matchCount = totalMatches || 1;
    const yellowPerMatch = totalYellowCards / matchCount;
    const redPerMatch = totalRedCards / matchCount;
    const cardsPerMatch = yellowPerMatch + redPerMatch;
    const penaltiesPerMatch = totalPenalties / matchCount;
    const goalsPerMatch = totalGoals / matchCount;
    
    // Sertlik kategorisi
    let strictness: RefereeProfile['strictness'];
    if (cardsPerMatch >= 6) strictness = 'very_strict';
    else if (cardsPerMatch >= 4.5) strictness = 'strict';
    else if (cardsPerMatch >= 3.5) strictness = 'average';
    else if (cardsPerMatch >= 2.5) strictness = 'lenient';
    else strictness = 'very_lenient';
    
    // Ev sahibi eğilimi
    const totalResults = homeWins + draws + awayWins || 1;
    const homeWinPct = (homeWins / totalResults) * 100;
    const awayWinPct = (awayWins / totalResults) * 100;
    
    let homeBias: RefereeProfile['homeBias'];
    let homeBiasStrength: number;
    
    if (homeWinPct > awayWinPct + 15) {
      homeBias = 'pro_home';
      homeBiasStrength = Math.min(50, (homeWinPct - awayWinPct) * 2);
    } else if (awayWinPct > homeWinPct + 15) {
      homeBias = 'pro_away';
      homeBiasStrength = -Math.min(50, (awayWinPct - homeWinPct) * 2);
    } else {
      homeBias = 'neutral';
      homeBiasStrength = 0;
    }
    
    return {
      id: referee.id,
      name: referee.display_name || referee.name || 'Unknown',
      nationality: referee.nationality?.name || 'Unknown',
      age: referee.age || 0,
      matchesRefereed: matchCount,
      yellowCardsPerMatch: parseFloat(yellowPerMatch.toFixed(2)),
      redCardsPerMatch: parseFloat(redPerMatch.toFixed(2)),
      cardsPerMatch: parseFloat(cardsPerMatch.toFixed(2)),
      strictness,
      penaltiesPerMatch: parseFloat(penaltiesPerMatch.toFixed(2)),
      penaltyTendency: penaltiesPerMatch >= 0.4 ? 'high' : penaltiesPerMatch >= 0.25 ? 'average' : 'low',
      homeWinPercentage: parseFloat(homeWinPct.toFixed(1)),
      drawPercentage: parseFloat(((draws / totalResults) * 100).toFixed(1)),
      awayWinPercentage: parseFloat(awayWinPct.toFixed(1)),
      homeBias,
      homeBiasStrength,
      avgGoalsPerMatch: parseFloat(goalsPerMatch.toFixed(2)),
      over25Percentage: goalsPerMatch > 2.5 ? Math.min(70, 50 + (goalsPerMatch - 2.5) * 20) : Math.max(30, 50 - (2.5 - goalsPerMatch) * 20),
      freeKicksPerMatch: 25,  // Varsayılan
      varReviewsPerMatch: 0.8,  // Varsayılan
      varOverturnedDecisions: 0.2,
      teamHistory: [],  // Ayrı sorgu gerekir
    };
  } catch (error) {
    console.error('Error fetching referee from SportMonks:', error);
    return null;
  }
}

/**
 * Basit hakem profili oluştur (detaylı veri yoksa)
 */
function createBasicRefereeProfile(refereeInfo: any): RefereeProfile {
  return {
    id: refereeInfo.referee_id || 0,
    name: refereeInfo.name || 'Unknown Referee',
    nationality: 'Unknown',
    age: 0,
    matchesRefereed: 0,
    yellowCardsPerMatch: 4.0,  // Ortalama
    redCardsPerMatch: 0.15,
    cardsPerMatch: 4.15,
    strictness: 'average',
    penaltiesPerMatch: 0.30,
    penaltyTendency: 'average',
    homeWinPercentage: 45,
    drawPercentage: 25,
    awayWinPercentage: 30,
    homeBias: 'neutral',
    homeBiasStrength: 0,
    avgGoalsPerMatch: 2.7,
    over25Percentage: 52,
    freeKicksPerMatch: 25,
    varReviewsPerMatch: 0.8,
    varOverturnedDecisions: 0.2,
    teamHistory: [],
  };
}

// ============================================================================
// ETKİ ANALİZİ
// ============================================================================

/**
 * Hakemin maça etkisini analiz et
 */
export function analyzeRefereeImpact(
  referee: RefereeProfile,
  homeTeamId: number,
  homeTeamName: string,
  awayTeamId: number,
  awayTeamName: string,
  leagueAvgCards: number = 4.0
): RefereeMatchImpact {
  // Kart tahmini
  let cardsLine: string;
  let cardsConfidence: number;
  let cardsReasoning: string;
  
  const cardsDiff = referee.cardsPerMatch - leagueAvgCards;
  
  if (referee.strictness === 'very_strict') {
    cardsLine = 'Over 5.5';
    cardsConfidence = 70;
    cardsReasoning = `${referee.name} çok sert bir hakem (${referee.cardsPerMatch} kart/maç). Yüksek kart beklentisi.`;
  } else if (referee.strictness === 'strict') {
    cardsLine = 'Over 4.5';
    cardsConfidence = 68;
    cardsReasoning = `${referee.name} sert bir hakem. Lig ortalamasının üstünde kart (${referee.cardsPerMatch}/maç).`;
  } else if (referee.strictness === 'lenient') {
    cardsLine = 'Under 3.5';
    cardsConfidence = 65;
    cardsReasoning = `${referee.name} hoşgörülü bir hakem (${referee.cardsPerMatch} kart/maç). Düşük kart beklentisi.`;
  } else if (referee.strictness === 'very_lenient') {
    cardsLine = 'Under 2.5';
    cardsConfidence = 62;
    cardsReasoning = `${referee.name} çok hoşgörülü. Kart görmeden oynamaya izin veriyor.`;
  } else {
    cardsLine = cardsDiff > 0 ? 'Over 3.5' : 'Under 4.5';
    cardsConfidence = 55;
    cardsReasoning = `${referee.name} ortalama sertlikte (${referee.cardsPerMatch} kart/maç).`;
  }
  
  // Penaltı riski
  let penaltyRisk: RefereeMatchImpact['penaltyRisk'];
  
  if (referee.penaltyTendency === 'high') {
    penaltyRisk = {
      level: 'high',
      reasoning: `${referee.name} penaltı verme eğilimi yüksek (${referee.penaltiesPerMatch}/maç). Ceza sahası pozisyonları kritik.`,
    };
  } else if (referee.penaltyTendency === 'low') {
    penaltyRisk = {
      level: 'low',
      reasoning: `${referee.name} penaltı vermekten kaçınıyor (${referee.penaltiesPerMatch}/maç). Ceza sahası temaslarda hoşgörülü.`,
    };
  } else {
    penaltyRisk = {
      level: 'medium',
      reasoning: `${referee.name} penaltı kararlarında ortalama (${referee.penaltiesPerMatch}/maç).`,
    };
  }
  
  // Maç sonucu eğilimi
  let matchResultBias: RefereeMatchImpact['matchResultBias'];
  
  if (referee.homeBias === 'pro_home' && referee.homeBiasStrength > 20) {
    matchResultBias = {
      direction: 'home',
      strength: Math.min(15, Math.abs(referee.homeBiasStrength) / 3),
      reasoning: `${referee.name} istatistiklerde ev sahibi eğilimli (${referee.homeWinPercentage.toFixed(0)}% ev galibiyeti).`,
    };
  } else if (referee.homeBias === 'pro_away' && Math.abs(referee.homeBiasStrength) > 20) {
    matchResultBias = {
      direction: 'away',
      strength: Math.min(15, Math.abs(referee.homeBiasStrength) / 3),
      reasoning: `${referee.name} deplasman takımlarına avantaj sağlıyor (${referee.awayWinPercentage.toFixed(0)}% deplasman galibiyeti).`,
    };
  } else {
    matchResultBias = {
      direction: 'neutral',
      strength: 0,
      reasoning: `${referee.name} tarafsız bir hakem. Belirgin ev/deplasman eğilimi yok.`,
    };
  }
  
  // Takım geçmişi (varsa)
  const homeHistory = referee.teamHistory.find(t => t.teamId === homeTeamId);
  const awayHistory = referee.teamHistory.find(t => t.teamId === awayTeamId);
  
  let homeTeamHistory: RefereeMatchImpact['homeTeamHistory'] = null;
  let awayTeamHistory: RefereeMatchImpact['awayTeamHistory'] = null;
  
  if (homeHistory && homeHistory.matches >= 3) {
    const winRate = homeHistory.wins / homeHistory.matches;
    homeTeamHistory = {
      teamId: homeTeamId,
      favorability: winRate > 0.5 ? 'positive' : winRate < 0.3 ? 'negative' : 'neutral',
      note: `${homeTeamName} bu hakemle ${homeHistory.matches} maçta ${homeHistory.wins}G-${homeHistory.draws}B-${homeHistory.losses}M.`,
    };
  }
  
  if (awayHistory && awayHistory.matches >= 3) {
    const winRate = awayHistory.wins / awayHistory.matches;
    awayTeamHistory = {
      teamId: awayTeamId,
      favorability: winRate > 0.5 ? 'positive' : winRate < 0.3 ? 'negative' : 'neutral',
      note: `${awayTeamName} bu hakemle ${awayHistory.matches} maçta ${awayHistory.wins}G-${awayHistory.draws}B-${awayHistory.losses}M.`,
    };
  }
  
  // Genel özet
  let overallNote = `🧑‍⚖️ HAKEM: ${referee.name} | `;
  overallNote += `Sertlik: ${referee.strictness} (${referee.cardsPerMatch} kart/maç) | `;
  overallNote += `Penaltı: ${referee.penaltyTendency} | `;
  overallNote += matchResultBias.direction !== 'neutral' 
    ? `Eğilim: ${matchResultBias.direction === 'home' ? 'Ev sahibi' : 'Deplasman'}`
    : 'Tarafsız';
  
  return {
    referee,
    cardsPrediction: {
      over: cardsLine,
      confidence: cardsConfidence,
      reasoning: cardsReasoning,
    },
    penaltyRisk,
    matchResultBias,
    homeTeamHistory,
    awayTeamHistory,
    overallNote,
  };
}

/**
 * Hakem verilerini maç tahminlerine uygula
 */
export function applyRefereeAdjustments(
  prediction: {
    matchResult: string;
    matchResultConfidence: number;
    overUnder: string;
    overUnderConfidence: number;
    btts: string;
    bttsConfidence: number;
  },
  refereeImpact: RefereeMatchImpact
): typeof prediction & {
  cardsLine: string;
  cardsConfidence: number;
  refereeNote: string;
} {
  const adjusted = { ...prediction };
  
  // Maç sonucu ayarlaması
  if (refereeImpact.matchResultBias.direction === 'home' && adjusted.matchResult === '1') {
    adjusted.matchResultConfidence += refereeImpact.matchResultBias.strength;
  } else if (refereeImpact.matchResultBias.direction === 'away' && adjusted.matchResult === '2') {
    adjusted.matchResultConfidence += refereeImpact.matchResultBias.strength;
  } else if (refereeImpact.matchResultBias.direction !== 'neutral') {
    // Eğilim tahminin tersine
    adjusted.matchResultConfidence -= refereeImpact.matchResultBias.strength / 2;
  }
  
  // Sınırla
  adjusted.matchResultConfidence = Math.max(45, Math.min(85, adjusted.matchResultConfidence));
  adjusted.overUnderConfidence = Math.max(45, Math.min(85, adjusted.overUnderConfidence));
  adjusted.bttsConfidence = Math.max(45, Math.min(85, adjusted.bttsConfidence));
  
  return {
    ...adjusted,
    cardsLine: refereeImpact.cardsPrediction.over,
    cardsConfidence: refereeImpact.cardsPrediction.confidence,
    refereeNote: refereeImpact.overallNote,
  };
}

// ============================================================================
// EXPORT (already exported above)
// ============================================================================

