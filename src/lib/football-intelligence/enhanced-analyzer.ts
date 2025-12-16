// ============================================================================
// ENHANCED ANALYZER - GELİŞTİRİLMİŞ MAÇ ANALİZCİSİ
// Tüm zeka modüllerini birleştiren ana analiz motoru
// ============================================================================

import { getLeagueProfile, adjustPredictionByLeague, calculateLeagueAdjustedGoalExpectancy, LeagueProfile } from './league-profiles';
import { getMatchXGPrediction, MatchXGPrediction } from './xg-provider';
import { analyzeMatchSquads, TeamSquadAnalysis } from './lineup-injuries';
import { calibrateConfidence, assessPredictionRisk, calibrateEnsemble, CalibrationAdjustment } from './confidence-calibration';
import { fetchRefereeFromSportMonks, analyzeRefereeImpact, RefereeMatchImpact, RefereeProfile } from './referee-stats';
import { getMatchWeatherAnalysis, applyWeatherAdjustments, WeatherImpactAnalysis } from './weather-impact';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedMatchData {
  fixtureId: number;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  leagueName: string;
  leagueId?: number;
  matchTime: number;  // Unix timestamp
  stadiumName?: string;
  
  // Form verileri
  homeForm: {
    avgGoalsScored: number;
    avgGoalsConceded: number;
    over25Percentage: number;
    bttsPercentage: number;
    form: string;  // WWLDW
    points: number;
  };
  awayForm: {
    avgGoalsScored: number;
    avgGoalsConceded: number;
    over25Percentage: number;
    bttsPercentage: number;
    form: string;
    points: number;
  };
  
  // H2H
  h2h?: {
    totalMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    avgGoals: number;
  };
  
  // Oranlar
  odds?: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
  };
}

export interface EnhancedAnalysisResult {
  // Temel Bilgiler
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  analysisTimestamp: string;
  
  // Zeka Modülleri Sonuçları
  leagueProfile: LeagueProfile | null;
  xgPrediction: MatchXGPrediction | null;
  squadAnalysis: {
    home: TeamSquadAnalysis | null;
    away: TeamSquadAnalysis | null;
  };
  refereeImpact: RefereeMatchImpact | null;
  weatherImpact: WeatherImpactAnalysis | null;
  
  // Tahminler
  predictions: {
    matchResult: {
      prediction: '1' | 'X' | '2';
      confidence: number;
      calibratedConfidence: number;
      probability: number;
    };
    overUnder: {
      prediction: 'Over' | 'Under';
      line: number;  // 2.5
      confidence: number;
      calibratedConfidence: number;
      probability: number;
    };
    btts: {
      prediction: 'Yes' | 'No';
      confidence: number;
      calibratedConfidence: number;
      probability: number;
    };
    correctScore: {
      mostLikely: string;
      alternatives: string[];
    };
    expectedGoals: {
      home: number;
      away: number;
      total: number;
    };
  };
  
  // Kalibrasyon
  calibration: {
    modelReliability: 'high' | 'medium' | 'low' | 'insufficient_data';
    adjustmentReason: string;
  };
  
  // Risk Değerlendirmesi
  risk: {
    level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
    score: number;
    recommendation: 'strong_bet' | 'normal_bet' | 'small_bet' | 'skip';
    stakeSuggestion: number;
    reasoning: string;
  };
  
  // En İyi Bahisler
  bestBets: {
    rank: number;
    type: string;
    selection: string;
    confidence: number;
    reasoning: string;
    valueScore: number;
  }[];
  
  // Uyarılar ve Notlar
  warnings: string[];
  notes: string[];
  
  // Veri Kalitesi
  dataQuality: {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    xgAvailable: boolean;
    lineupConfirmed: boolean;
    weatherChecked: boolean;
    refereeKnown: boolean;
    historicalDataSufficient: boolean;
  };
}

// ============================================================================
// ANA ANALİZ FONKSİYONU
// ============================================================================

/**
 * Geliştirilmiş maç analizi yap
 */
export async function runEnhancedAnalysis(
  matchData: EnhancedMatchData,
  options?: {
    includeWeather?: boolean;
    includeReferee?: boolean;
    includeSquad?: boolean;
    model?: string;  // Kalibrasyon için hangi model kullanılacak
  }
): Promise<EnhancedAnalysisResult> {
  console.log('🧠 Enhanced Analysis starting...');
  const startTime = Date.now();
  
  const {
    includeWeather = true,
    includeReferee = true,
    includeSquad = true,
    model = 'strategy',
  } = options || {};
  
  const warnings: string[] = [];
  const notes: string[] = [];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LİG PROFİLİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('📊 Step 1: Loading league profile...');
  const leagueProfile = getLeagueProfile(matchData.leagueName);
  
  if (leagueProfile) {
    notes.push(`📊 Lig: ${leagueProfile.name} | Ort. Gol: ${leagueProfile.avgGoalsPerMatch} | Over 2.5: %${leagueProfile.over25Percentage}`);
    console.log(`   ✅ League profile loaded: ${leagueProfile.name}`);
  } else {
    warnings.push('⚠️ Lig profili bulunamadı. Genel parametreler kullanılacak.');
    console.log('   ⚠️ League profile not found');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 2. xG TAHMİNİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('📈 Step 2: Fetching xG predictions...');
  let xgPrediction: MatchXGPrediction | null = null;
  
  try {
    xgPrediction = await getMatchXGPrediction(
      matchData.homeTeamId,
      matchData.homeTeamName,
      matchData.awayTeamId,
      matchData.awayTeamName,
      {
        avgGoalsScored: matchData.homeForm.avgGoalsScored,
        avgGoalsConceded: matchData.homeForm.avgGoalsConceded,
        over25Percentage: matchData.homeForm.over25Percentage,
        bttsPercentage: matchData.homeForm.bttsPercentage,
      },
      {
        avgGoalsScored: matchData.awayForm.avgGoalsScored,
        avgGoalsConceded: matchData.awayForm.avgGoalsConceded,
        over25Percentage: matchData.awayForm.over25Percentage,
        bttsPercentage: matchData.awayForm.bttsPercentage,
      },
      matchData.leagueName
    );
    
    if (xgPrediction) {
      notes.push(...xgPrediction.notes);
      console.log(`   ✅ xG prediction: Home ${xgPrediction.expectedHomeGoals} - Away ${xgPrediction.expectedAwayGoals}`);
    }
  } catch (error) {
    console.error('   ❌ xG prediction failed:', error);
    warnings.push('⚠️ xG verisi alınamadı.');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 3. KADRO ANALİZİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  let homeSquad: TeamSquadAnalysis | null = null;
  let awaySquad: TeamSquadAnalysis | null = null;
  
  if (includeSquad) {
    console.log('👥 Step 3: Analyzing squad and injuries...');
    try {
      const squadResult = await analyzeMatchSquads(
        matchData.fixtureId,
        matchData.homeTeamId,
        matchData.homeTeamName,
        matchData.awayTeamId,
        matchData.awayTeamName
      );
      
      homeSquad = squadResult.home;
      awaySquad = squadResult.away;
      notes.push(...squadResult.comparison.notes);
      
      if (homeSquad) notes.push(homeSquad.summary);
      if (awaySquad) notes.push(awaySquad.summary);
      
      console.log(`   ✅ Squad analysis complete`);
    } catch (error) {
      console.error('   ❌ Squad analysis failed:', error);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 4. HAKEM ANALİZİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  let refereeImpact: RefereeMatchImpact | null = null;
  
  if (includeReferee) {
    console.log('🧑‍⚖️ Step 4: Fetching referee data...');
    try {
      const referee = await fetchRefereeFromSportMonks(matchData.fixtureId);
      
      if (referee) {
        refereeImpact = analyzeRefereeImpact(
          referee,
          matchData.homeTeamId,
          matchData.homeTeamName,
          matchData.awayTeamId,
          matchData.awayTeamName,
          leagueProfile?.avgYellowCardsPerMatch
        );
        
        notes.push(refereeImpact.overallNote);
        console.log(`   ✅ Referee: ${referee.name} (${referee.strictness})`);
      } else {
        console.log('   ⚠️ Referee data not available');
      }
    } catch (error) {
      console.error('   ❌ Referee fetch failed:', error);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 5. HAVA DURUMU ANALİZİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  let weatherImpact: WeatherImpactAnalysis | null = null;
  
  if (includeWeather && matchData.stadiumName) {
    console.log('🌤️ Step 5: Checking weather conditions...');
    try {
      weatherImpact = await getMatchWeatherAnalysis(
        matchData.stadiumName,
        matchData.matchTime
      );
      
      if (weatherImpact) {
        warnings.push(...weatherImpact.warnings);
        notes.push(...weatherImpact.notes);
        console.log(`   ✅ Weather: ${weatherImpact.weather.condition} (impact: ${weatherImpact.overallImpact})`);
      }
    } catch (error) {
      console.error('   ❌ Weather fetch failed:', error);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TAHMİN HESAPLAMALARI
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('🔮 Step 6: Calculating predictions...');
  
  // Baz tahminler (xG veya form bazlı)
  let expectedHomeGoals = xgPrediction?.expectedHomeGoals || 
    (matchData.homeForm.avgGoalsScored + matchData.awayForm.avgGoalsConceded) / 2;
  let expectedAwayGoals = xgPrediction?.expectedAwayGoals ||
    (matchData.awayForm.avgGoalsScored + matchData.homeForm.avgGoalsConceded) / 2;
  
  // Lig ayarlaması
  if (leagueProfile) {
    const leagueAdj = calculateLeagueAdjustedGoalExpectancy(
      matchData.homeForm.avgGoalsScored,
      matchData.homeForm.avgGoalsConceded,
      matchData.awayForm.avgGoalsScored,
      matchData.awayForm.avgGoalsConceded,
      leagueProfile
    );
    expectedHomeGoals = (expectedHomeGoals + leagueAdj.homeExpected) / 2;
    expectedAwayGoals = (expectedAwayGoals + leagueAdj.awayExpected) / 2;
  }
  
  // Kadro ayarlaması
  if (homeSquad) {
    expectedHomeGoals += homeSquad.goalScoringAdjustment;
    expectedAwayGoals += homeSquad.goalConcedingAdjustment;
  }
  if (awaySquad) {
    expectedAwayGoals += awaySquad.goalScoringAdjustment;
    expectedHomeGoals += awaySquad.goalConcedingAdjustment;
  }
  
  // Hava durumu ayarlaması
  if (weatherImpact) {
    expectedHomeGoals += weatherImpact.goalImpact.adjustment / 2;
    expectedAwayGoals += weatherImpact.goalImpact.adjustment / 2;
  }
  
  // Sınırla
  expectedHomeGoals = Math.max(0.3, Math.min(4.0, expectedHomeGoals));
  expectedAwayGoals = Math.max(0.2, Math.min(3.5, expectedAwayGoals));
  const totalExpectedGoals = expectedHomeGoals + expectedAwayGoals;
  
  // Olasılıklar
  let homeWinProb = xgPrediction?.homeWinProbability || 40;
  let drawProb = xgPrediction?.drawProbability || 25;
  let awayWinProb = xgPrediction?.awayWinProbability || 35;
  let over25Prob = xgPrediction?.over25Probability || (totalExpectedGoals > 2.5 ? 55 : 45);
  let bttsYesProb = xgPrediction?.bttsYesProbability || 50;
  
  // Form bazlı ayarlama
  const formDiff = matchData.homeForm.points - matchData.awayForm.points;
  if (formDiff > 5) {
    homeWinProb += 5;
    awayWinProb -= 5;
  } else if (formDiff < -5) {
    homeWinProb -= 5;
    awayWinProb += 5;
  }
  
  // Hakem eğilimi
  if (refereeImpact?.matchResultBias.direction === 'home') {
    homeWinProb += refereeImpact.matchResultBias.strength;
  } else if (refereeImpact?.matchResultBias.direction === 'away') {
    awayWinProb += refereeImpact.matchResultBias.strength;
  }
  
  // Lig ev sahibi avantajı
  if (leagueProfile && leagueProfile.homeAwayBias > 3) {
    homeWinProb += 3;
    awayWinProb -= 2;
  }
  
  // Normalize et
  const totalProb = homeWinProb + drawProb + awayWinProb;
  homeWinProb = Math.round((homeWinProb / totalProb) * 100);
  drawProb = Math.round((drawProb / totalProb) * 100);
  awayWinProb = 100 - homeWinProb - drawProb;
  
  // Tahminler
  let matchResultPrediction: '1' | 'X' | '2';
  let matchResultConfidence: number;
  
  if (homeWinProb > awayWinProb && homeWinProb > drawProb) {
    matchResultPrediction = '1';
    matchResultConfidence = 50 + Math.min(25, (homeWinProb - Math.max(awayWinProb, drawProb)) / 2);
  } else if (awayWinProb > homeWinProb && awayWinProb > drawProb) {
    matchResultPrediction = '2';
    matchResultConfidence = 50 + Math.min(25, (awayWinProb - Math.max(homeWinProb, drawProb)) / 2);
  } else {
    matchResultPrediction = 'X';
    matchResultConfidence = 50 + Math.min(20, drawProb - 25);
  }
  
  const overUnderPrediction = totalExpectedGoals > 2.5 ? 'Over' : 'Under';
  let overUnderConfidence = 50 + Math.min(25, Math.abs(totalExpectedGoals - 2.5) * 15);
  
  const bttsPrediction = bttsYesProb > 50 ? 'Yes' : 'No';
  let bttsConfidence = 50 + Math.min(25, Math.abs(bttsYesProb - 50) / 2);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 7. KALİBRASYON
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('⚖️ Step 7: Calibrating confidence...');
  
  let calibratedMatchResultConf = matchResultConfidence;
  let calibratedOverUnderConf = overUnderConfidence;
  let calibratedBttsConf = bttsConfidence;
  let calibrationResult: CalibrationAdjustment | null = null;
  
  try {
    calibrationResult = await calibrateConfidence(
      model,
      'over_under',
      overUnderConfidence
    );
    
    if (calibrationResult) {
      calibratedOverUnderConf = calibrationResult.calibratedConfidence;
      
      // Diğer tahminlere de benzer kalibrasyon uygula
      const calibrationFactor = calibrationResult.calibratedConfidence / overUnderConfidence;
      calibratedMatchResultConf = Math.max(45, Math.min(85, matchResultConfidence * calibrationFactor));
      calibratedBttsConf = Math.max(45, Math.min(80, bttsConfidence * calibrationFactor));
      
      console.log(`   ✅ Calibration applied: ${calibrationResult.adjustmentReason}`);
    }
  } catch (error) {
    console.error('   ❌ Calibration failed:', error);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 8. RİSK DEĞERLENDİRMESİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('⚠️ Step 8: Assessing risk...');
  
  const riskAssessment = assessPredictionRisk(
    calibratedOverUnderConf,
    calibrationResult?.modelReliability || 'insufficient_data',
    'over_under',
    {
      hasInjuryConcerns: (homeSquad?.lineup.keyPlayersOut.length || 0) > 0 || (awaySquad?.lineup.keyPlayersOut.length || 0) > 0,
      isUnpredictableLeague: leagueProfile?.competitiveness === 'very_high',
    }
  );
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 9. EN İYİ BAHİSLER
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('🎯 Step 9: Determining best bets...');
  
  const bestBets: EnhancedAnalysisResult['bestBets'] = [];
  
  // Over/Under
  if (calibratedOverUnderConf >= 60) {
    bestBets.push({
      rank: 1,
      type: 'Over/Under 2.5',
      selection: overUnderPrediction,
      confidence: calibratedOverUnderConf,
      reasoning: `Beklenen gol: ${totalExpectedGoals.toFixed(2)}. ${xgPrediction?.dataQuality === 'excellent' ? 'xG verisi güçlü.' : ''}`,
      valueScore: Math.round(calibratedOverUnderConf / 10),
    });
  }
  
  // Maç Sonucu
  if (calibratedMatchResultConf >= 62) {
    bestBets.push({
      rank: bestBets.length + 1,
      type: 'Maç Sonucu',
      selection: matchResultPrediction,
      confidence: calibratedMatchResultConf,
      reasoning: `${matchResultPrediction === '1' ? matchData.homeTeamName : matchResultPrediction === '2' ? matchData.awayTeamName : 'Beraberlik'} olasılığı: %${matchResultPrediction === '1' ? homeWinProb : matchResultPrediction === '2' ? awayWinProb : drawProb}`,
      valueScore: Math.round(calibratedMatchResultConf / 10),
    });
  }
  
  // BTTS
  if (calibratedBttsConf >= 60) {
    bestBets.push({
      rank: bestBets.length + 1,
      type: 'Karşılıklı Gol',
      selection: bttsPrediction,
      confidence: calibratedBttsConf,
      reasoning: `KG ${bttsPrediction === 'Yes' ? 'Var' : 'Yok'} olasılığı: %${bttsPrediction === 'Yes' ? bttsYesProb : 100 - bttsYesProb}`,
      valueScore: Math.round(calibratedBttsConf / 10),
    });
  }
  
  // Kart bahisi (hakem varsa)
  if (refereeImpact && refereeImpact.cardsPrediction.confidence >= 65) {
    bestBets.push({
      rank: bestBets.length + 1,
      type: 'Toplam Kart',
      selection: refereeImpact.cardsPrediction.over,
      confidence: refereeImpact.cardsPrediction.confidence,
      reasoning: refereeImpact.cardsPrediction.reasoning,
      valueScore: Math.round(refereeImpact.cardsPrediction.confidence / 10),
    });
  }
  
  // Sırala
  bestBets.sort((a, b) => b.valueScore - a.valueScore || b.confidence - a.confidence);
  bestBets.forEach((bet, i) => bet.rank = i + 1);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 10. VERİ KALİTESİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  const dataQuality: EnhancedAnalysisResult['dataQuality'] = {
    overall: 'fair',
    xgAvailable: xgPrediction?.dataQuality === 'excellent' || xgPrediction?.dataQuality === 'good',
    lineupConfirmed: homeSquad?.lineup.confirmed || awaySquad?.lineup.confirmed || false,
    weatherChecked: weatherImpact !== null,
    refereeKnown: refereeImpact !== null,
    historicalDataSufficient: calibrationResult?.modelReliability !== 'insufficient_data',
  };
  
  const qualityScore = [
    dataQuality.xgAvailable,
    dataQuality.lineupConfirmed,
    dataQuality.weatherChecked,
    dataQuality.refereeKnown,
    dataQuality.historicalDataSufficient,
  ].filter(Boolean).length;
  
  if (qualityScore >= 4) dataQuality.overall = 'excellent';
  else if (qualityScore >= 3) dataQuality.overall = 'good';
  else if (qualityScore >= 2) dataQuality.overall = 'fair';
  else dataQuality.overall = 'poor';
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SONUÇ
  // ═══════════════════════════════════════════════════════════════════════════
  
  const duration = Date.now() - startTime;
  console.log(`✅ Enhanced Analysis complete in ${duration}ms`);
  
  return {
    fixtureId: matchData.fixtureId,
    homeTeam: matchData.homeTeamName,
    awayTeam: matchData.awayTeamName,
    league: matchData.leagueName,
    analysisTimestamp: new Date().toISOString(),
    
    leagueProfile,
    xgPrediction,
    squadAnalysis: {
      home: homeSquad,
      away: awaySquad,
    },
    refereeImpact,
    weatherImpact,
    
    predictions: {
      matchResult: {
        prediction: matchResultPrediction,
        confidence: matchResultConfidence,
        calibratedConfidence: calibratedMatchResultConf,
        probability: matchResultPrediction === '1' ? homeWinProb : matchResultPrediction === '2' ? awayWinProb : drawProb,
      },
      overUnder: {
        prediction: overUnderPrediction as 'Over' | 'Under',
        line: 2.5,
        confidence: overUnderConfidence,
        calibratedConfidence: calibratedOverUnderConf,
        probability: overUnderPrediction === 'Over' ? over25Prob : 100 - over25Prob,
      },
      btts: {
        prediction: bttsPrediction as 'Yes' | 'No',
        confidence: bttsConfidence,
        calibratedConfidence: calibratedBttsConf,
        probability: bttsPrediction === 'Yes' ? bttsYesProb : 100 - bttsYesProb,
      },
      correctScore: {
        mostLikely: `${Math.round(expectedHomeGoals)}-${Math.round(expectedAwayGoals)}`,
        alternatives: generateScoreAlternatives(expectedHomeGoals, expectedAwayGoals),
      },
      expectedGoals: {
        home: parseFloat(expectedHomeGoals.toFixed(2)),
        away: parseFloat(expectedAwayGoals.toFixed(2)),
        total: parseFloat(totalExpectedGoals.toFixed(2)),
      },
    },
    
    calibration: {
      modelReliability: calibrationResult?.modelReliability || 'insufficient_data',
      adjustmentReason: calibrationResult?.adjustmentReason || 'Kalibrasyon uygulanamadı',
    },
    
    risk: {
      level: riskAssessment.riskLevel,
      score: riskAssessment.riskScore,
      recommendation: riskAssessment.recommendation,
      stakeSuggestion: riskAssessment.stakeSuggestion,
      reasoning: riskAssessment.reasoning,
    },
    
    bestBets,
    warnings,
    notes,
    dataQuality,
  };
}

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

function generateScoreAlternatives(homeExpected: number, awayExpected: number): string[] {
  const scores: string[] = [];
  const baseHome = Math.round(homeExpected);
  const baseAway = Math.round(awayExpected);
  
  // Alternatif skorlar
  const possibilities = [
    [baseHome, baseAway],
    [baseHome + 1, baseAway],
    [baseHome, baseAway + 1],
    [baseHome - 1, baseAway],
    [baseHome, baseAway - 1],
    [baseHome + 1, baseAway + 1],
  ];
  
  for (const [h, a] of possibilities) {
    if (h >= 0 && a >= 0 && scores.length < 4) {
      const score = `${h}-${a}`;
      if (!scores.includes(score)) {
        scores.push(score);
      }
    }
  }
  
  return scores;
}

// ============================================================================
// TYPES ARE EXPORTED AT THEIR DEFINITION
// ============================================================================

