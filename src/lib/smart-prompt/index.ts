// ============================================================================
// SMART PROMPT BUILDER
// Sportmonks verilerini AI için optimize edilmiş prompt'a çevirir
// ============================================================================

import { type MatchContext, type TeamStats, type HeadToHead, type Injury } from '../sportmonks/index';

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
• Son 5 Maç: ${homeTeam.recentForm || 'N/A'} (${homeTeam.formPoints}/15 puan)
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

🏥 SAKATLIKLAR (${context.homeInjuries.length} oyuncu)
${context.homeInjuries.length > 0 
  ? context.homeInjuries.map(i => `• ${i.playerName} - ${i.reason}${i.isOut ? ' (DIŞARI)' : ' (Şüpheli)'}`).join('\n')
  : '• Sakatlık yok'}

═══════════════════════════════════════════════════════════════════════════════
✈️ DEPLASMAN: ${awayTeam.teamName}
═══════════════════════════════════════════════════════════════════════════════

📊 FORM
• Son 5 Maç: ${awayTeam.recentForm || 'N/A'} (${awayTeam.formPoints}/15 puan)
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

${h2h.recentMatches.length > 0 ? `
📅 SON MAÇLAR
${h2h.recentMatches.slice(0, 3).map(m => 
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

📌 GÜVEN SEVİYESİ KURALLARI:
- Veriler güçlü bir yöne işaret ediyorsa: %65-75
- Veriler karışık sinyaller veriyorsa: %55-65
- Veriler yetersizse veya çelişkiliyse: %50-55
- Maç sonucu için her zaman daha temkinli ol (max %70)

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
  "bestBet": {
    "market": "BTTS", "Over/Under" veya "Match Result",
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

export function calculateStatisticalPrediction(context: MatchContext): StatisticalPrediction {
  const { homeTeam, awayTeam, h2h } = context;

  // ========== BTTS CALCULATION ==========
  // Factors: Team BTTS rates, goals scored/conceded, H2H BTTS
  const homeBttsRate = homeTeam.bttsPercentage || 50;
  const awayBttsRate = awayTeam.bttsPercentage || 50;
  const h2hBttsRate = h2h.bttsPercentage || 50;
  
  // Weight: Team rates 30% each, H2H 40%
  const bttsScore = (homeBttsRate * 0.3) + (awayBttsRate * 0.3) + (h2hBttsRate * 0.4);
  const bttsPrediction = bttsScore >= 50 ? 'yes' : 'no';
  const bttsConfidence = Math.min(75, Math.max(50, Math.round(
    50 + (Math.abs(bttsScore - 50) * 0.5)
  )));

  // ========== OVER/UNDER CALCULATION ==========
  // Factors: Avg goals scored, avg goals conceded, H2H avg goals
  const homeGoalAvg = homeTeam.avgGoalsScored + awayTeam.avgGoalsConceded;
  const awayGoalAvg = awayTeam.avgGoalsScored + homeTeam.avgGoalsConceded;
  const expectedGoals = (homeGoalAvg + awayGoalAvg) / 2;
  const h2hAvgGoals = h2h.avgGoals || 2.5;
  
  // Weighted average
  const totalExpectedGoals = (expectedGoals * 0.6) + (h2hAvgGoals * 0.4);
  const overPrediction = totalExpectedGoals >= 2.5 ? 'over' : 'under';
  const overConfidence = Math.min(75, Math.max(50, Math.round(
    50 + (Math.abs(totalExpectedGoals - 2.5) * 15)
  )));

  // ========== MATCH RESULT CALCULATION ==========
  // Factors: Form, home/away performance, H2H, goal difference
  let homeScore = 0;
  let awayScore = 0;

  // Form points (max 15)
  homeScore += homeTeam.formPoints * 2;
  awayScore += awayTeam.formPoints * 2;

  // Home advantage
  homeScore += 10;

  // Home/Away specific performance
  const homeWinRate = homeTeam.homeWins / Math.max(1, homeTeam.homeWins + homeTeam.homeDraws + homeTeam.homeLosses);
  const awayWinRate = awayTeam.awayWins / Math.max(1, awayTeam.awayWins + awayTeam.awayDraws + awayTeam.awayLosses);
  homeScore += homeWinRate * 30;
  awayScore += awayWinRate * 30;

  // H2H
  if (h2h.totalMatches > 0) {
    homeScore += (h2h.team1Wins / h2h.totalMatches) * 20;
    awayScore += (h2h.team2Wins / h2h.totalMatches) * 20;
  }

  // Goal difference
  const homeGD = homeTeam.avgGoalsScored - homeTeam.avgGoalsConceded;
  const awayGD = awayTeam.avgGoalsScored - awayTeam.avgGoalsConceded;
  homeScore += homeGD * 5;
  awayScore += awayGD * 5;

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

  return {
    btts: {
      prediction: bttsPrediction,
      confidence: bttsConfidence,
      reason: `BTTS oranları: Ev %${homeBttsRate}, Dep %${awayBttsRate}, H2H %${h2hBttsRate}`
    },
    overUnder: {
      prediction: overPrediction,
      confidence: overConfidence,
      reason: `Beklenen gol: ${totalExpectedGoals.toFixed(1)} (Takımlar: ${expectedGoals.toFixed(1)}, H2H: ${h2hAvgGoals})`
    },
    matchResult: {
      prediction: matchResult,
      confidence: matchConfidence,
      reason: `Skor: Ev ${homeScore.toFixed(0)} - Dep ${awayScore.toFixed(0)} (Form, performans, H2H dahil)`
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
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export function combineAIandStats(
  aiPrediction: any,
  statsPrediction: StatisticalPrediction
): CombinedPrediction {
  // Calculate agreement
  let agreementCount = 0;
  if (aiPrediction.btts?.prediction === statsPrediction.btts.prediction) agreementCount++;
  if (aiPrediction.overUnder?.prediction === statsPrediction.overUnder.prediction) agreementCount++;
  if (aiPrediction.matchResult?.prediction === statsPrediction.matchResult.prediction) agreementCount++;
  
  const agreement = Math.round((agreementCount / 3) * 100);

  // Combine predictions (AI gets 60% weight if agrees with stats, 40% if not)
  const combinePrediction = (
    aiPred: { prediction: string; confidence: number; reasoning?: string },
    statPred: { prediction: string; confidence: number; reason: string }
  ) => {
    const agrees = aiPred.prediction === statPred.prediction;
    
    if (agrees) {
      // Both agree - boost confidence
      return {
        prediction: aiPred.prediction,
        confidence: Math.min(80, Math.round((aiPred.confidence * 0.5) + (statPred.confidence * 0.5) + 5)),
        reasoning: `${aiPred.reasoning || ''} | Stats: ${statPred.reason}`
      };
    } else {
      // Disagree - use stats with lower confidence
      return {
        prediction: statPred.prediction,
        confidence: Math.max(50, Math.round(statPred.confidence * 0.9)),
        reasoning: `İstatistikler farklı gösteriyor: ${statPred.reason}`
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

  // Determine best bet (highest confidence where AI and stats agree)
  let bestBet = { market: 'BTTS', selection: btts.prediction, confidence: btts.confidence, reason: 'En yüksek güven' };
  
  if (overUnder.confidence > bestBet.confidence) {
    bestBet = { market: 'Over/Under', selection: overUnder.prediction, confidence: overUnder.confidence, reason: 'En yüksek güven' };
  }
  
  // Match result only if very high confidence
  if (matchResult.confidence > 65 && matchResult.confidence > bestBet.confidence) {
    bestBet = { market: 'Match Result', selection: matchResult.prediction, confidence: matchResult.confidence, reason: 'Güçlü veri desteği' };
  }

  // Risk level based on agreement and confidence
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (agreement >= 80 && bestBet.confidence >= 65) riskLevel = 'low';
  else if (agreement < 50 || bestBet.confidence < 55) riskLevel = 'high';

  return {
    btts,
    overUnder,
    matchResult,
    bestBet,
    agreement,
    riskLevel
  };
}

