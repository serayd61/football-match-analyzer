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
    "reasoning": "VERİLERE dayanan kısa gerekçe (örn: 'H2H ort. 10.2 korner, %70 üst 9.5')"
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

export function calculateStatisticalPrediction(context: MatchContext): StatisticalPrediction {
  const { homeTeam, awayTeam, h2h } = context;

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
  
  // Weight: Team rates 30% each, H2H 40%
  const bttsScore = (homeBttsRate * 0.3) + (awayBttsRate * 0.3) + (h2hBttsRate * 0.4);
  const bttsPrediction = bttsScore >= 50 ? 'yes' : 'no';
  const bttsConfidence = Math.min(75, Math.max(50, Math.round(
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
  
  // Weighted average
  const totalExpectedGoals = safeNum((expectedGoals * 0.6) + (h2hAvgGoals * 0.4), 2.5);
  const overPrediction = totalExpectedGoals >= 2.5 ? 'over' : 'under';
  const overConfidence = Math.min(75, Math.max(50, Math.round(
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
  corners: { prediction: string; confidence: number; reasoning: string; line: number };
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

  // Helper to ensure valid number
  const safeConf = (val: number | undefined | null): number => {
    if (val === undefined || val === null || isNaN(val)) return 50;
    return Math.max(50, Math.min(80, val));
  };

  // Combine predictions (AI gets 60% weight if agrees with stats, 40% if not)
  const combinePrediction = (
    aiPred: { prediction: string; confidence: number; reasoning?: string },
    statPred: { prediction: string; confidence: number; reason: string }
  ) => {
    const aiConf = safeConf(aiPred?.confidence);
    const statConf = safeConf(statPred?.confidence);
    const agrees = aiPred?.prediction === statPred?.prediction;
    
    if (agrees) {
      // Both agree - boost confidence
      return {
        prediction: aiPred?.prediction || statPred?.prediction || 'no',
        confidence: safeConf(Math.round((aiConf * 0.5) + (statConf * 0.5) + 5)),
        reasoning: `${aiPred?.reasoning || ''} | Stats: ${statPred?.reason || ''}`
      };
    } else {
      // Disagree - use stats with lower confidence
      return {
        prediction: statPred?.prediction || 'no',
        confidence: safeConf(Math.round(statConf * 0.9)),
        reasoning: `İstatistikler farklı gösteriyor: ${statPred?.reason || ''}`
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
  
  console.log('🚩 Corner check:', {
    hasAICorners: !!aiCorners,
    prediction: aiCorners?.prediction,
    confidence: aiCorners?.confidence,
    mentionsCorners,
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

  // Determine best bet (highest confidence where AI and stats agree)
  let bestBet = { market: 'BTTS', selection: btts.prediction, confidence: btts.confidence, reason: 'En yüksek güven' };
  
  if (overUnder.confidence > bestBet.confidence) {
    bestBet = { market: 'Over/Under', selection: overUnder.prediction, confidence: overUnder.confidence, reason: 'En yüksek güven' };
  }
  
  // Match result only if very high confidence
  if (matchResult.confidence > 65 && matchResult.confidence > bestBet.confidence) {
    bestBet = { market: 'Match Result', selection: matchResult.prediction, confidence: matchResult.confidence, reason: 'Güçlü veri desteği' };
  }
  
  // Corners if very high confidence
  if (corners.confidence > 65 && corners.confidence > bestBet.confidence) {
    bestBet = { market: 'Corners', selection: `${corners.prediction} ${corners.line}`, confidence: corners.confidence, reason: 'Korner verisi güçlü' };
  }

  // Risk level based on agreement and confidence
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (agreement >= 80 && bestBet.confidence >= 65) riskLevel = 'low';
  else if (agreement < 50 || bestBet.confidence < 55) riskLevel = 'high';

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

