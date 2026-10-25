// ============================================================================
// SMART PROMPT BUILDER
// Sportmonks verilerini AI için optimize edilmiş prompt'a çevirir
// ============================================================================

import { type MatchContext, type TeamStats, type HeadToHead, type Injury, type FullFixtureData } from '../sportmonks/index';

export interface MatchDetails {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  matchDate: string;
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

export function buildDataDrivenPrompt(match: MatchDetails, context: MatchContext): string {
  const { homeTeam, awayTeam } = context;
  const h2h = context.h2h;
  
  return `
═══════════════════════════════════════════════════════════════════════════════
🎯 VERİ ODAKLI MAÇ ANALİZİ
═══════════════════════════════════════════════════════════════════════════════

📋 MAÇ BİLGİSİ
• Maç: ${match.homeTeam} vs ${match.awayTeam}
• Lig: ${match.league}
• Tarih: ${match.matchDate}

═══════════════════════════════════════════════════════════════════════════════
🏠 EV SAHİBİ: ${homeTeam.teamName}
═══════════════════════════════════════════════════════════════════════════════

📊 FORM
• Son 10 Maç: ${homeTeam.recentForm || 'N/A'} (${homeTeam.formPoints}/30 puan)
• Ev Performansı: ${homeTeam.homeWins}G - ${homeTeam.homeDraws}B - ${homeTeam.homeLosses}M

⚽ GOL İSTATİSTİKLERİ
• Attığı: ${homeTeam.goalsScored} gol (Ort: ${homeTeam.avgGoalsScored}/maç)
• Yediği: ${homeTeam.goalsConceded} gol (Ort: ${homeTeam.avgGoalsConceded}/maç)
• Clean Sheet: ${homeTeam.cleanSheets} maç
• Gol Atamadığı: ${homeTeam.failedToScore} maç

📈 ÖZEL İSTATİSTİKLER
• BTTS (KG Var): %${homeTeam.bttsPercentage}
• Üst 2.5: %${homeTeam.over25Percentage}
• Alt 2.5: %${homeTeam.under25Percentage}

🚩 KORNER İSTATİSTİKLERİ
• Aldığı Korner: ${homeTeam.avgCornersFor || 'Veri yok'}/maç
• Verdiği Korner: ${homeTeam.avgCornersAgainst || 'Veri yok'}/maç

🏥 SAKATLIKLAR (${context.homeInjuries.length} oyuncu)
${context.homeInjuries.length > 0 
  ? context.homeInjuries.map(i => `• ${i.playerName} - ${i.reason}${i.isOut ? ' (DIŞARI)' : ' (Şüpheli)'}`).join('\n')
  : '• Sakatlık yok'}

═══════════════════════════════════════════════════════════════════════════════
✈️ DEPLASMAN: ${awayTeam.teamName}
═══════════════════════════════════════════════════════════════════════════════

📊 FORM
• Son 10 Maç: ${awayTeam.recentForm || 'N/A'} (${awayTeam.formPoints}/30 puan)
• Deplasman Performansı: ${awayTeam.awayWins}G - ${awayTeam.awayDraws}B - ${awayTeam.awayLosses}M

⚽ GOL İSTATİSTİKLERİ
• Attığı: ${awayTeam.goalsScored} gol (Ort: ${awayTeam.avgGoalsScored}/maç)
• Yediği: ${awayTeam.goalsConceded} gol (Ort: ${awayTeam.avgGoalsConceded}/maç)
• Clean Sheet: ${awayTeam.cleanSheets} maç
• Gol Atamadığı: ${awayTeam.failedToScore} maç

📈 ÖZEL İSTATİSTİKLER
• BTTS (KG Var): %${awayTeam.bttsPercentage}
• Üst 2.5: %${awayTeam.over25Percentage}
• Alt 2.5: %${awayTeam.under25Percentage}

🚩 KORNER İSTATİSTİKLERİ
• Aldığı Korner: ${awayTeam.avgCornersFor || 'Veri yok'}/maç
• Verdiği Korner: ${awayTeam.avgCornersAgainst || 'Veri yok'}/maç

🏥 SAKATLIKLAR (${context.awayInjuries.length} oyuncu)
${context.awayInjuries.length > 0 
  ? context.awayInjuries.map(i => `• ${i.playerName} - ${i.reason}${i.isOut ? ' (DIŞARI)' : ' (Şüpheli)'}`).join('\n')
  : '• Sakatlık yok'}

═══════════════════════════════════════════════════════════════════════════════
🔄 KARŞILAŞMA GEÇMİŞİ (H2H)
═══════════════════════════════════════════════════════════════════════════════

📊 SON ${h2h.totalMatches} MAÇ
• ${homeTeam.teamName}: ${h2h.team1Wins} galibiyet
• Beraberlik: ${h2h.draws}
• ${awayTeam.teamName}: ${h2h.team2Wins} galibiyet

⚽ H2H İSTATİSTİKLERİ
• Ortalama Gol: ${h2h.avgGoals}/maç
• BTTS Oranı: %${h2h.bttsPercentage}
• Üst 2.5 Oranı: %${h2h.over25Percentage}

🚩 KORNER İSTATİSTİKLERİ
• Ortalama Korner: ${h2h.avgCorners || 9}/maç
• Üst 8.5 Korner: %${h2h.over85CornersPercentage || 50}
• Üst 9.5 Korner: %${h2h.over95CornersPercentage || 40}

${h2h.recentMatches.length > 0 ? `
📅 SON 5 H2H MAÇI
${h2h.recentMatches.slice(0, 5).map(m => 
  `• ${m.date.split('T')[0]}: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`
).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
🎯 ANALİZ GÖREVİ
═══════════════════════════════════════════════════════════════════════════════

YUKARIDAKİ VERİLERE DAYANARAK aşağıdaki tahminleri yap.
⚠️ ÖNEMLİ: Sadece istatistikleri kullan, tahmin etme veya hayal etme!

📌 TAHMİN KRİTERLERİ:
- BTTS: Her iki takımın gol atma oranlarına, H2H BTTS'e ve form'a bak
- Üst/Alt 2.5: Gol ortalamalarına, H2H gol ortalamasına bak
- Maç Sonucu: Form, ev/deplasman performansı ve H2H'a bak
- Korner: Takımların korner ortalamalarına ve H2H korner verilerine bak

📌 GÜVEN SEVİYESİ KURALLARI:
- Veriler güçlü bir yöne işaret ediyorsa: %65-75
- Veriler karışık sinyaller veriyorsa: %55-65
- Veriler yetersizse veya çelişkiliyse: %50-55
- Maç sonucu için her zaman daha temkinli ol (max %70)

⚠️ ZORUNLU: Aşağıdaki JSON formatında TÜM 4 tahmini (BTTS, Over/Under, Match Result, CORNERS) mutlaka döndürmelisin!

YANITINI SADECE AŞAĞIDAKİ JSON FORMATINDA VER:

{
  "btts": {
    "prediction": "yes" veya "no",
    "confidence": 50-75 arası sayı,
    "reasoning": "VERİLERE dayanan kısa gerekçe (örn: 'Ev sahibi %60 BTTS, H2H %70 BTTS')"
  },
  "overUnder": {
    "prediction": "over" veya "under",
    "confidence": 50-75 arası sayı,
    "reasoning": "VERİLERE dayanan kısa gerekçe (örn: 'Gol ort. 2.8, H2H 2.4')"
  },
  "matchResult": {
    "prediction": "home", "draw" veya "away",
    "confidence": 50-70 arası sayı,
    "reasoning": "VERİLERE dayanan kısa gerekçe (örn: 'Ev sahibi 7/8 ev galibiyeti')"
  },
  "corners": {
    "prediction": "over" veya "under",
    "line": 9.5,
    "confidence": 50-70 arası sayı,
    "reasoning": "VERİLERE dayanan kısa gerekçe (örn: 'H2H ort. 10.2 korner, %70 üst 9.5'). Eğer korner verisi yoksa 'Korner verisi mevcut değil' yaz"
  },
  "bestBet": {
    "market": "BTTS", "Over/Under", "Match Result" veya "Corners",
    "selection": "Seçim",
    "confidence": 55-75 arası,
    "reason": "En güçlü veri desteği olan bahis"
  },
  "riskLevel": "low", "medium" veya "high",
  "dataQuality": "İstatistik kalitesi hakkında kısa not"
}
`;
}

// ============================================================================
// CALCULATE STATISTICAL PREDICTION (AI'dan bağımsız)
// ============================================================================

export interface StatisticalPrediction {
  btts: { prediction: 'yes' | 'no'; confidence: number; reason: string };
  overUnder: { prediction: 'over' | 'under'; confidence: number; reason: string };
  matchResult: { prediction: 'home' | 'draw' | 'away'; confidence: number; reason: string };
}

export interface StatPredictionOpts {
  /** Takım gol/KG istatistikleri gerçek mi? false = sabit varsayılan (Sportmonks tam veri yolu 1.5/1.2 gibi sabitler basıyordu). */
  teamStatsReal?: boolean;
}

/** Veri yokken basılan tavan: "istatistik" değil varsayılan olduğu için iddia %52'yi geçmez. */
export const NO_DATA_CAP = 52;

export function calculateStatisticalPrediction(context: MatchContext, opts: StatPredictionOpts = {}): StatisticalPrediction {
  const { homeTeam, awayTeam, h2h } = context;
  // 2026-10-25: H2H maçı yokken Sportmonks avgGoals=0 / btts%=0 döndürüyor; 0 "gerçek değer" sayılınca
  // her H2H'sız maç "Alt %64 + KG Yok %54" şablonuna düşüyordu (24 Eki: 9 analiz birebir aynı, 7'si yanlış).
  const h2hOk = Number(h2h?.totalMatches) > 0;
  const teamOk = opts.teamStatsReal !== false;
  const noData = !h2hOk && !teamOk;

  // Helper to ensure valid number
  const safeNum = (val: number | undefined | null, defaultVal: number): number => {
    if (val === undefined || val === null || isNaN(val)) return defaultVal;
    return val;
  };

  // ========== BTTS CALCULATION ==========
  // Factors: Team BTTS rates, goals scored/conceded, H2H BTTS
  const homeBttsRate = safeNum(homeTeam.bttsPercentage, 50);
  const awayBttsRate = safeNum(awayTeam.bttsPercentage, 50);
  const h2hBttsRate = safeNum(h2h.bttsPercentage, 50);
  
  // Weight: Team rates 30% each, H2H 40% — eksik kaynak ağırlıktan düşer, kalan yeniden ölçeklenir.
  const wTeam = teamOk ? 0.3 : 0, wH2h = h2hOk ? 0.4 : 0;
  const wSum = 2 * wTeam + wH2h;
  const bttsScore = wSum > 0 ? ((homeBttsRate + awayBttsRate) * wTeam + h2hBttsRate * wH2h) / wSum : 50;
  const bttsPrediction = bttsScore >= 50 ? 'yes' : 'no';
  const bttsConfidence = noData ? NO_DATA_CAP : Math.min(75, Math.max(50, Math.round(
    50 + (Math.abs(bttsScore - 50) * 0.5)
  )));

  // ========== OVER/UNDER CALCULATION ==========
  // Factors: Avg goals scored, avg goals conceded, H2H avg goals
  const homeAvgScored = safeNum(homeTeam.avgGoalsScored, 1.2);
  const homeAvgConceded = safeNum(homeTeam.avgGoalsConceded, 1.0);
  const awayAvgScored = safeNum(awayTeam.avgGoalsScored, 1.1);
  const awayAvgConceded = safeNum(awayTeam.avgGoalsConceded, 1.1);
  
  const homeGoalAvg = homeAvgScored + awayAvgConceded;
  const awayGoalAvg = awayAvgScored + homeAvgConceded;
  const expectedGoals = (homeGoalAvg + awayGoalAvg) / 2;
  const h2hAvgGoals = safeNum(h2h.avgGoals, 2.5);
  
  // Weighted average (kaynak yoksa ağırlığı sıfır)
  const gTeam = teamOk ? 0.6 : 0, gH2h = h2hOk ? 0.4 : 0;
  const totalExpectedGoals = gTeam + gH2h > 0 ? safeNum((expectedGoals * gTeam + h2hAvgGoals * gH2h) / (gTeam + gH2h), 2.5) : 2.5;
  const overPrediction = totalExpectedGoals >= 2.5 ? 'over' : 'under';
  const overConfidence = noData ? NO_DATA_CAP : Math.min(75, Math.max(50, Math.round(
    50 + (Math.abs(totalExpectedGoals - 2.5) * 15)
  )));

  // ========== MATCH RESULT CALCULATION ==========
  // Factors: Form, home/away performance, H2H, goal difference
  let homeScore = 0;
  let awayScore = 0;

  // Form points (max 15)
  homeScore += safeNum(homeTeam.formPoints, 5) * 2;
  awayScore += safeNum(awayTeam.formPoints, 5) * 2;

  // Home advantage
  homeScore += 10;

  // Home/Away specific performance
  const homeTotal = safeNum(homeTeam.homeWins, 2) + safeNum(homeTeam.homeDraws, 1) + safeNum(homeTeam.homeLosses, 1);
  const awayTotal = safeNum(awayTeam.awayWins, 1) + safeNum(awayTeam.awayDraws, 1) + safeNum(awayTeam.awayLosses, 2);
  const homeWinRate = safeNum(homeTeam.homeWins, 2) / Math.max(1, homeTotal);
  const awayWinRate = safeNum(awayTeam.awayWins, 1) / Math.max(1, awayTotal);
  homeScore += safeNum(homeWinRate * 30, 15);
  awayScore += safeNum(awayWinRate * 30, 10);

  // H2H
  if (h2h.totalMatches > 0) {
    homeScore += (safeNum(h2h.team1Wins, 1) / h2h.totalMatches) * 20;
    awayScore += (safeNum(h2h.team2Wins, 1) / h2h.totalMatches) * 20;
  } else {
    homeScore += 10; // Default home advantage
    awayScore += 5;
  }

  // Goal difference
  const homeGD = homeAvgScored - homeAvgConceded;
  const awayGD = awayAvgScored - awayAvgConceded;
  homeScore += safeNum(homeGD * 5, 0);
  awayScore += safeNum(awayGD * 5, 0);

  // Determine result
  const scoreDiff = homeScore - awayScore;
  let matchResult: 'home' | 'draw' | 'away';
  let matchConfidence: number;

  if (scoreDiff > 15) {
    matchResult = 'home';
    matchConfidence = Math.min(70, 55 + Math.floor(scoreDiff / 5));
  } else if (scoreDiff < -15) {
    matchResult = 'away';
    matchConfidence = Math.min(70, 55 + Math.floor(Math.abs(scoreDiff) / 5));
  } else {
    // Close game - lean towards draw or slight favorite
    if (scoreDiff > 5) {
      matchResult = 'home';
      matchConfidence = 52;
    } else if (scoreDiff < -5) {
      matchResult = 'away';
      matchConfidence = 52;
    } else {
      matchResult = 'draw';
      matchConfidence = 50;
    }
  }

  // Takım istatistiği yokken ev/deplasman skorlaması yalnız ev avantajıdır → güven tavanı.
  if (!teamOk) matchConfidence = Math.min(matchConfidence, NO_DATA_CAP);

  // Build detailed statistical reasoning
  const h2hTxt = h2hOk ? `H2H %${h2hBttsRate.toFixed(0)} BTTS` : 'H2H yok';
  const bttsReason = noData
    ? 'Veri yetersiz: takım istatistiği ve H2H yok; varsayılan düşük güven.'
    : `İstatistiksel analiz: ${teamOk ? `Ev sahibi %${homeBttsRate.toFixed(0)} BTTS, Deplasman %${awayBttsRate.toFixed(0)} BTTS, ` : ''}${h2hTxt}. Ağırlıklı ortalama: %${bttsScore.toFixed(1)} → ${bttsPrediction === 'yes' ? 'Her iki takım gol atabilir' : 'Her iki takım gol atmayabilir'}`;
  
  const overUnderReason = noData
    ? 'Veri yetersiz: takım istatistiği ve H2H yok; varsayılan düşük güven.'
    : `İstatistiksel analiz: Beklenen toplam gol ${totalExpectedGoals.toFixed(1)} (${teamOk ? `Takımlar ortalaması: ${expectedGoals.toFixed(1)}` : 'takım istatistiği yok'}, ${h2hOk ? `H2H ortalaması: ${h2hAvgGoals.toFixed(1)}` : 'H2H yok'}). ${overPrediction === 'over' ? '2.5 üstü' : '2.5 altı'} bekleniyor.`;
  
  const matchResultReason = noData
    ? 'Veri yetersiz: maç sonucu için yalnız ev avantajı; düşük güven.'
    : `İstatistiksel skorlama: Ev ${Math.round(homeScore)} - Dep ${Math.round(awayScore)} (Form: Ev ${homeTeam.formPoints}/30, Dep ${awayTeam.formPoints}/30 | Ev performansı: ${Math.round(homeWinRate * 100)}%, Dep performansı: ${Math.round(awayWinRate * 100)}% | H2H: ${h2hOk ? `${h2h.team1Wins}-${h2h.draws}-${h2h.team2Wins}` : 'yok'}). Fark: ${Math.round(scoreDiff)} → ${matchResult === 'home' ? 'Ev sahibi avantajlı' : matchResult === 'away' ? 'Deplasman avantajlı' : 'Beraberlik olası'}`;

  return {
    btts: {
      prediction: bttsPrediction,
      confidence: bttsConfidence,
      reason: bttsReason
    },
    overUnder: {
      prediction: overPrediction,
      confidence: overConfidence,
      reason: overUnderReason
    },
    matchResult: {
      prediction: matchResult,
      confidence: matchConfidence,
      reason: matchResultReason
    }
  };
}

// ============================================================================
// COMBINE AI + STATISTICAL PREDICTIONS
// ============================================================================

export interface CombinedPrediction {
  btts: { prediction: string; confidence: number; reasoning: string };
  overUnder: { prediction: string; confidence: number; reasoning: string };
  matchResult: { prediction: string; confidence: number; reasoning: string };
  corners: { prediction: string; confidence: number; reasoning: string; line: number };
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export function combineAIandStats(
  aiPrediction: any,
  statsPrediction: StatisticalPrediction,
  context?: MatchContext | null
): CombinedPrediction {
  // Calculate agreement
  let agreementCount = 0;
  if (aiPrediction.btts?.prediction === statsPrediction.btts.prediction) agreementCount++;
  if (aiPrediction.overUnder?.prediction === statsPrediction.overUnder.prediction) agreementCount++;
  if (aiPrediction.matchResult?.prediction === statsPrediction.matchResult.prediction) agreementCount++;
  
  const agreement = Math.round((agreementCount / 3) * 100);

  // Helper to ensure valid number
  const safeConf = (val: number | undefined | null): number => {
    if (val === undefined || val === null || isNaN(val)) return 50;
    return Math.max(50, Math.min(80, val));
  };

  // STATISTICS-FIRST APPROACH: Use statistical model for prediction and primary reasoning
  // AI reasoning is only used as supporting evidence if it agrees
  const combinePrediction = (
    aiPred: { prediction: string; confidence: number; reasoning?: string },
    statPred: { prediction: string; confidence: number; reason: string }
  ) => {
    const statConf = safeConf(statPred?.confidence);
    const agrees = aiPred?.prediction === statPred?.prediction;
    
    // Always use statistical prediction and primary reasoning
    // If AI agrees, boost confidence slightly (max +5) and add AI reasoning as support
    // If AI disagrees, use stats only with note
    if (agrees && aiPred?.reasoning && !aiPred.reasoning.includes('İstatistikler farklı')) {
      // AI agrees with stats - use stats prediction, boost confidence slightly, add AI as support
      const boostedConf = Math.min(75, statConf + 5);
      return {
        prediction: statPred.prediction,
        confidence: boostedConf,
        reasoning: `${statPred.reason} | AI desteği: ${aiPred.reasoning.substring(0, 150)}`
      };
    } else {
      // Use stats prediction, confidence, and reasoning only
      // Only mention AI disagreement if it's significant
      const aiNote = aiPred?.prediction && !agrees && aiPred.confidence > 60
        ? ` (Not: AI ${aiPred.prediction} %${aiPred.confidence} tahmin etti, ancak istatistikler ${statPred.prediction} gösteriyor)` 
        : '';
      return {
        prediction: statPred.prediction,
        confidence: statConf,
        reasoning: `${statPred.reason}${aiNote}`
      };
    }
  };

  const btts = combinePrediction(
    aiPrediction.btts || { prediction: 'no', confidence: 50 },
    statsPrediction.btts
  );
  
  const overUnder = combinePrediction(
    aiPrediction.overUnder || { prediction: 'under', confidence: 50 },
    statsPrediction.overUnder
  );
  
  const matchResult = combinePrediction(
    aiPrediction.matchResult || { prediction: 'draw', confidence: 50 },
    statsPrediction.matchResult
  );

  // Corners prediction from AI - check if AI provided valid corners data
  const aiCorners = aiPrediction.corners;
  
  // Check if context has corner data
  // Accept any reasonable value (0-25 range) - 5.0 is a valid average!
  // If value is 0, it means no data was found
  const homeHasData = context && context.homeTeam.avgCornersFor > 0 && context.homeTeam.avgCornersFor <= 25;
  const awayHasData = context && context.awayTeam.avgCornersFor > 0 && context.awayTeam.avgCornersFor <= 25;
  const h2hHasData = context && context.h2h.avgCorners > 0 && context.h2h.avgCorners <= 25;
  
  // At least one source must have valid data
  const hasContextCornerData = homeHasData || awayHasData || h2hHasData;
  
  // Check if reasoning mentions corners (AI might have corner data but forgot to add corners field)
  const allReasoning = [
    aiPrediction.btts?.reasoning || '',
    aiPrediction.overUnder?.reasoning || '',
    aiPrediction.matchResult?.reasoning || '',
    aiCorners?.reasoning || ''
  ].join(' ').toLowerCase();
  
  const mentionsCorners = allReasoning.includes('korner') || 
                          allReasoning.includes('corner') ||
                          allReasoning.includes('köşe');
  
  const hasCornerData = aiCorners && 
    aiCorners.prediction && 
    (aiCorners.prediction === 'over' || aiCorners.prediction === 'under') &&
    aiCorners.reasoning &&
    !aiCorners.reasoning.includes('hesaplanıyor') &&
    !aiCorners.reasoning.includes('Veri yok') &&
    !aiCorners.reasoning.includes('mevcut değil');
  
  console.log('🚩 Context corner data check:', {
    home: context?.homeTeam?.avgCornersFor,
    away: context?.awayTeam?.avgCornersFor,
    h2h: context?.h2h?.avgCorners,
    homeHasData,
    awayHasData,
    h2hHasData,
    hasContextCornerData,
    aiCorners: !!aiCorners,
    hasCornerData
  });
  
  console.log('🚩 Corner check:', {
    hasAICorners: !!aiCorners,
    prediction: aiCorners?.prediction,
    confidence: aiCorners?.confidence,
    mentionsCorners,
    hasContextCornerData,
    hasCornerData
  });
  
  // Determine corners prediction
  let corners: { prediction: string; confidence: number; reasoning: string; line: number; dataAvailable: boolean };
  
  // If AI has corners field, use it
  if (hasCornerData) {
    corners = {
      prediction: aiCorners.prediction,
      confidence: safeConf(aiCorners.confidence || 55),
      reasoning: aiCorners.reasoning,
      line: aiCorners.line || 9.5,
      dataAvailable: true
    };
  } 
  // If context has corner data but AI didn't provide corners field, calculate from context
  else if (hasContextCornerData && context) {
    // Use actual values (not defaults)
    let homeAvg = context.homeTeam.avgCornersFor;
    let awayAvg = context.awayTeam.avgCornersFor;
    let h2hAvg = context.h2h.avgCorners;
    
    // Validate values: Normal range is 0-20 corners per match
    // If H2H is abnormal (>20), ignore it and use teams only
    const hasValidH2H = h2hAvg > 0 && h2hAvg <= 20;
    const hasValidHome = homeAvg > 0 && homeAvg <= 20;
    const hasValidAway = awayAvg > 0 && awayAvg <= 20;
    
    if (!hasValidH2H) {
      console.warn(`⚠️ Invalid H2H corners value: ${h2hAvg} - ignoring from calculation`);
      h2hAvg = 0; // Will be excluded from calculation
    }
    if (!hasValidHome) {
      console.warn(`⚠️ Invalid home corners value: ${homeAvg} - using default`);
      homeAvg = 5;
    }
    if (!hasValidAway) {
      console.warn(`⚠️ Invalid away corners value: ${awayAvg} - using default`);
      awayAvg = 5;
    }
    
    // Weighted average: If H2H is valid, use it (40%), teams 30% each
    // If H2H invalid, use teams only (50% each)
    let expectedCorners: number;
    if (hasValidH2H) {
      expectedCorners = (homeAvg * 0.3) + (awayAvg * 0.3) + (h2hAvg * 0.4);
    } else {
      expectedCorners = (homeAvg * 0.5) + (awayAvg * 0.5);
    }
    
    const prediction = expectedCorners > 9.5 ? 'over' : 'under';
    
    // More nuanced confidence based on how far from 9.5
    const distanceFromLine = Math.abs(expectedCorners - 9.5);
    let confidence = 50;
    if (distanceFromLine > 2) {
      confidence = 65; // Very clear (e.g., 12 or 7)
    } else if (distanceFromLine > 1) {
      confidence = 60; // Clear (e.g., 10.5 or 8.5)
    } else if (distanceFromLine > 0.5) {
      confidence = 55; // Slight edge (e.g., 10 or 9)
    } else {
      confidence = 50; // Too close to call
    }
    
    console.log('🚩 Corner calculation from context:', {
      homeAvg,
      awayAvg,
      h2hAvg,
      expectedCorners: expectedCorners.toFixed(2),
      prediction,
      confidence
    });
    
    const h2hDisplay = hasValidH2H ? h2hAvg.toFixed(1) : 'Veri yok';
    corners = {
      prediction,
      confidence,
      reasoning: `Hesaplanan korner: Ev ${homeAvg.toFixed(1)}, Dep ${awayAvg.toFixed(1)}, H2H ${h2hDisplay}. Beklenen: ${expectedCorners.toFixed(1)}`,
      line: 9.5,
      dataAvailable: true
    };
  }
  // If reasoning mentions corners but no field, extract from reasoning
  else if (mentionsCorners) {
    // Try to extract prediction from all reasoning
    const hasOver = allReasoning.includes('over') || allReasoning.includes('üst') || allReasoning.includes('yüksek');
    const hasUnder = allReasoning.includes('under') || allReasoning.includes('alt') || allReasoning.includes('düşük');
    
    // Extract corner stats from reasoning (e.g., "99.9/maç", "10.2 korner")
    const cornerMatch = allReasoning.match(/(\d+\.?\d*)\s*(korner|corner|\/maç)/);
    const cornerValue = cornerMatch?.[1] ? parseFloat(cornerMatch[1]) : null;
    
    const prediction = hasOver ? 'over' : hasUnder ? 'under' : (cornerValue !== null && cornerValue > 9.5 ? 'over' : 'under');
    const confidence = cornerValue !== null && cornerValue > 9.5 ? 60 : cornerValue !== null && cornerValue < 9.5 ? 55 : 50;
    
    corners = {
      prediction,
      confidence,
      reasoning: aiCorners?.reasoning || `Korner verisi mevcut (reasoning'den çıkarıldı)`,
      line: 9.5,
      dataAvailable: true
    };
  }
  // No corner data at all
  else {
    corners = {
      prediction: 'unknown',
      confidence: 0,
      reasoning: 'Korner verisi mevcut değil',
      line: 9.5,
      dataAvailable: false
    };
  }

  // 🆕 AKILLI BEST BET HESAPLAMA - Birleşik öneri mantığı
  const highConfidenceThreshold = 60; // %60 ve üzeri yüksek güven
  const veryHighConfidenceThreshold = 65; // %65 ve üzeri çok yüksek güven
  
  // BTTS ve Over/Under tahminlerini Türkçe'ye çevir
  const bttsSelection = btts.prediction === 'yes' ? 'Evet' : 'Hayır';
  const overUnderSelection = overUnder.prediction === 'over' ? 'Üst' : 'Alt';
  
  // Best bet değişkenini tanımla
  let bestBet: { market: string; selection: string; confidence: number; reason: string };
  
  // 🎯 BİRLEŞİK ÖNERİ: Eğer hem BTTS hem Over/Under yüksek güvenliyse
  if (btts.confidence >= highConfidenceThreshold && overUnder.confidence >= highConfidenceThreshold) {
    const combinedConfidence = Math.round((btts.confidence + overUnder.confidence) / 2);
    
    // Eğer Over 2.5 ve BTTS Evet ise → "En sağlam bahis: Karşılıklı Gol VEYA Over 2.5"
    if (overUnderSelection === 'Üst' && bttsSelection === 'Evet') {
      bestBet = {
        market: 'En Sağlam Bahis',
        selection: 'Karşılıklı Gol VEYA Over 2.5',
        confidence: Math.min(85, combinedConfidence + 5), // Birleşik öneri bonusu
        reason: `AI analizleri hem Karşılıklı Gol (${btts.confidence}%) hem Over 2.5 (${overUnder.confidence}%) için yüksek güven gösteriyor. İkisi de gerçekleşme olasılığı yüksek.`
      };
    }
    // Eğer Under 2.5 ve BTTS Hayır ise → "En sağlam bahis: Karşılıklı Gol Yok VEYA Under 2.5"
    else if (overUnderSelection === 'Alt' && bttsSelection === 'Hayır') {
      bestBet = {
        market: 'En Sağlam Bahis',
        selection: 'Karşılıklı Gol Yok VEYA Under 2.5',
        confidence: Math.min(85, combinedConfidence + 5),
        reason: `AI analizleri hem Karşılıklı Gol Yok (${btts.confidence}%) hem Under 2.5 (${overUnder.confidence}%) için yüksek güven gösteriyor. Düşük skorlu maç beklentisi güçlü.`
      };
    }
    // Diğer kombinasyonlar için genel birleşik öneri
    else {
      bestBet = {
        market: 'En Sağlam Bahis',
        selection: `Karşılıklı Gol ${bttsSelection === 'Evet' ? 'Var' : 'Yok'} VEYA Over/Under ${overUnderSelection}`,
        confidence: combinedConfidence,
        reason: `AI analizleri hem Karşılıklı Gol (${btts.confidence}%) hem Over/Under (${overUnder.confidence}%) için yüksek güven gösteriyor.`
      };
    }
  }
  // Tek bir yüksek güvenli tahmin varsa onu seç
  else if (btts.confidence >= veryHighConfidenceThreshold) {
    bestBet = {
      market: 'Karşılıklı Gol',
      selection: bttsSelection,
      confidence: btts.confidence,
      reason: `AI analizleri Karşılıklı Gol ${bttsSelection === 'Evet' ? 'Var' : 'Yok'} için çok yüksek güven gösteriyor (${btts.confidence}%).`
    };
  }
  else if (overUnder.confidence >= veryHighConfidenceThreshold) {
    bestBet = {
      market: 'Over/Under 2.5',
      selection: overUnderSelection,
      confidence: overUnder.confidence,
      reason: `AI analizleri Over/Under ${overUnderSelection} için çok yüksek güven gösteriyor (${overUnder.confidence}%).`
    };
  }
  // Match result only if very high confidence
  else if (matchResult.confidence > 65 && matchResult.confidence > Math.max(btts.confidence, overUnder.confidence)) {
    const mrSelection = matchResult.prediction === 'home' ? 'Ev Sahibi' : 
                       matchResult.prediction === 'away' ? 'Deplasman' : 'Beraberlik';
    bestBet = {
      market: 'Maç Sonucu',
      selection: mrSelection,
      confidence: matchResult.confidence,
      reason: 'Güçlü veri desteği'
    };
  }
  // Corners if very high confidence
  else if (corners.confidence > 65 && corners.confidence > Math.max(btts.confidence, overUnder.confidence)) {
    bestBet = {
      market: 'Korner',
      selection: `${corners.prediction} ${corners.line}`,
      confidence: corners.confidence,
      reason: 'Korner verisi güçlü'
    };
  }
  // Fallback: En yüksek güvenli olanı seç
  else {
    bestBet = { market: 'BTTS', selection: bttsSelection, confidence: btts.confidence, reason: 'En yüksek güven' };
    
    if (overUnder.confidence > bestBet.confidence) {
      bestBet = { market: 'Over/Under', selection: overUnderSelection, confidence: overUnder.confidence, reason: 'En yüksek güven' };
    }
  }

  // Risk level based on statistical confidence (AI agreement is less important now)
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (bestBet.confidence >= 70) riskLevel = 'low';  // High statistical confidence
  else if (bestBet.confidence >= 60) riskLevel = 'medium';  // Medium confidence
  else riskLevel = 'high';  // Low confidence

  return {
    btts,
    overUnder,
    matchResult,
    corners,
    bestBet,
    agreement,
    riskLevel
  };
}

// ============================================================================
// 🚀 FULL DATA PROMPT - TEK API'DEN GELEN TÜM VERİYLE PROMPT
// ============================================================================

export function buildFullDataPrompt(match: MatchDetails, data: FullFixtureData): string {
  const home = data.homeTeam;
  const away = data.awayTeam;
  const h2h = data.h2h;
  const odds = data.odds;
  const injuries = data.injuries;
  const venue = data.venue;
  const referee = data.referee;
  const weather = data.weather;
  const lineups = data.lineups;
  const predictions = data.predictions;
  
  // Format recent form with results
  const formatRecentForm = (recentMatches: any[], teamId: number) => {
    if (!recentMatches?.length) return 'Veri yok';
    
    return recentMatches.slice(0, 5).map((m: any) => {
      const isHome = m.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
      const homeScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      const teamScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;
      const opponent = m.participants?.find((p: any) => p.id !== teamId)?.name || 'Unknown';
      const result = teamScore > oppScore ? 'G' : teamScore < oppScore ? 'M' : 'B';
      return `${result} vs ${opponent} (${teamScore}-${oppScore})`;
    }).join('\n• ');
  };

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║  🎯 PROFESYONEL MAÇ ANALİZİ - TÜM VERİLER                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 MAÇ BİLGİSİ
─────────────────────────────────────────────────────────
• Maç: ${match.homeTeam} vs ${match.awayTeam}
• Lig: ${data.league.name} (${data.league.country})
• Hafta: ${data.round || 'N/A'} | Aşama: ${data.stage || 'N/A'}
• Tarih: ${match.matchDate}
• Veri Kalitesi: ${data.dataQuality.score}/100 ⭐

═══════════════════════════════════════════════════════════════════════════════
🏟️ STADYUM & KOŞULLAR
═══════════════════════════════════════════════════════════════════════════════
• Stadyum: ${venue.name} (${venue.city})
• Kapasite: ${venue.capacity > 0 ? venue.capacity.toLocaleString() : 'N/A'} | Zemin: ${venue.surface}
• Hakem: ${referee.name}${referee.avgCardsPerMatch > 0 ? ` (Ort. ${referee.avgCardsPerMatch} kart/maç)` : ''}
${weather.temperature > 0 ? `• Hava: ${weather.description} | ${weather.temperature}°C | Nem: %${weather.humidity} | Rüzgar: ${weather.wind} km/s` : ''}

═══════════════════════════════════════════════════════════════════════════════
🏠 EV SAHİBİ: ${home.name}
═══════════════════════════════════════════════════════════════════════════════
• Sıralama: ${home.position > 0 ? `#${home.position}` : 'N/A'}
• Teknik Direktör: ${home.coach}

📊 FORM (Son 10 Maç): ${home.form} (${home.formPoints}/30 puan)
• ${formatRecentForm(home.recentMatches, home.id)}

${lineups.home.length > 0 ? `
🔢 KADRO (${lineups.homeFormation || 'N/A'})
${lineups.home.slice(0, 11).map(p => `• ${p.number}. ${p.name} (${p.position})${p.isCaptain ? ' ©' : ''}`).join('\n')}
` : ''}

🏥 SAKATLIKLAR (${injuries.home.length} oyuncu)
${injuries.home.length > 0 
  ? injuries.home.slice(0, 5).map(i => `• ❌ ${i.playerName} - ${i.reason}`).join('\n')
  : '• ✅ Sakatlık yok'}

═══════════════════════════════════════════════════════════════════════════════
✈️ DEPLASMAN: ${away.name}
═══════════════════════════════════════════════════════════════════════════════
• Sıralama: ${away.position > 0 ? `#${away.position}` : 'N/A'}
• Teknik Direktör: ${away.coach}

📊 FORM (Son 10 Maç): ${away.form} (${away.formPoints}/30 puan)
• ${formatRecentForm(away.recentMatches, away.id)}

${lineups.away.length > 0 ? `
🔢 KADRO (${lineups.awayFormation || 'N/A'})
${lineups.away.slice(0, 11).map(p => `• ${p.number}. ${p.name} (${p.position})${p.isCaptain ? ' ©' : ''}`).join('\n')}
` : ''}

🏥 SAKATLIKLAR (${injuries.away.length} oyuncu)
${injuries.away.length > 0 
  ? injuries.away.slice(0, 5).map(i => `• ❌ ${i.playerName} - ${i.reason}`).join('\n')
  : '• ✅ Sakatlık yok'}

═══════════════════════════════════════════════════════════════════════════════
🔄 KARŞILAŞMA GEÇMİŞİ (H2H) - SON ${h2h.totalMatches} MAÇ
═══════════════════════════════════════════════════════════════════════════════
• ${home.name}: ${h2h.team1Wins} galibiyet
• Beraberlik: ${h2h.draws}
• ${away.name}: ${h2h.team2Wins} galibiyet

⚽ H2H İSTATİSTİKLERİ
• Ortalama Gol: ${h2h.avgGoals}/maç
• BTTS Oranı: %${h2h.bttsPercentage}
• Üst 2.5 Oranı: %${h2h.over25Percentage}

🚩 KORNER İSTATİSTİKLERİ
• Ortalama Korner: ${h2h.avgCorners || 9}/maç
• Üst 8.5 Korner: %${h2h.over85CornersPercentage || 50}
• Üst 9.5 Korner: %${h2h.over95CornersPercentage || 40}

${h2h.recentMatches.length > 0 ? `
📅 SON H2H MAÇLARI
${h2h.recentMatches.slice(0, 5).map(m => 
  `• ${m.date.split('T')[0]}: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`
).join('\n')}
` : ''}

${odds.matchResult.home > 0 ? `
═══════════════════════════════════════════════════════════════════════════════
💰 BAHİS ORANLARI (Piyasa Beklentisi)
═══════════════════════════════════════════════════════════════════════════════
🎯 MAÇ SONUCU
• Ev Galibiyeti: ${odds.matchResult.home.toFixed(2)}
• Beraberlik: ${odds.matchResult.draw.toFixed(2)}
• Deplasman Galibiyeti: ${odds.matchResult.away.toFixed(2)}

⚽ DİĞER PAZARLAR
• BTTS - Evet: ${odds.btts.yes.toFixed(2)} | Hayır: ${odds.btts.no.toFixed(2)}
• Üst 2.5: ${odds.overUnder25.over.toFixed(2)} | Alt 2.5: ${odds.overUnder25.under.toFixed(2)}
` : ''}

${predictions.sportmonks ? `
═══════════════════════════════════════════════════════════════════════════════
🔮 SPORTMONKS TAHMİNLERİ (Referans)
═══════════════════════════════════════════════════════════════════════════════
• Ev Kazanma: %${predictions.probability.home}
• Beraberlik: %${predictions.probability.draw}
• Deplasman Kazanma: %${predictions.probability.away}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
🎯 ANALİZ GÖREVİ
═══════════════════════════════════════════════════════════════════════════════

TÜM YUKARIDAKİ VERİLERE DAYANARAK analiz yap.

📌 KULLANACAĞIN VERİLER:
1. FORM: Son 10 maç sonuçları ve kalitesi
2. H2H: Tarihsel karşılaşma verileri
3. KADROLAR: Sakatlıklar ve 11'ler (varsa)
4. ORANLAR: Piyasa beklentisi (varsa)
5. KOŞULLAR: Stadyum, hakem, hava durumu

📌 TAHMİN KRİTERLERİ:
- BTTS: H2H BTTS oranı, gol ortalamaları
- Üst/Alt: Gol ortalamaları, H2H gol ortalaması
- Maç Sonucu: Form, lig sıralaması, ev/deplasman performansı, H2H

📌 GÜVEN SEVİYESİ:
- Veri kalitesi ${data.dataQuality.score}/100
- %65-75: Güçlü veri desteği varsa
- %55-65: Karışık sinyaller
- %50-55: Belirsiz

YANITINI SADECE JSON OLARAK VER:

{
  "btts": {
    "prediction": "yes" veya "no",
    "confidence": 50-75,
    "reasoning": "H2H ve form verilerine dayanan gerekçe"
  },
  "overUnder": {
    "prediction": "over" veya "under",
    "confidence": 50-75,
    "reasoning": "Gol verilerine dayanan gerekçe"
  },
  "matchResult": {
    "prediction": "home", "draw" veya "away",
    "confidence": 50-70,
    "reasoning": "Form ve performans verilerine dayanan gerekçe"
  },
  "bestBet": {
    "market": "BTTS", "Over/Under" veya "Match Result",
    "selection": "Seçim",
    "confidence": 55-75,
    "reason": "En güçlü veri desteği"
  },
  "riskLevel": "low", "medium" veya "high"
}
`;
}

