// ============================================================================
// PROBABILITY ENGINE - Sportmonks Verisinden Olasılık Hesaplama Sistemi
// ============================================================================
// 
// FUTBOL ANALİZ MODELİ:
// - %60 VERİYE DAYALI ANALİZ (Sportmonks istatistikleri)
// - %20 MATEMATİKSEL TAHMİN (Poisson, Monte Carlo, Bayesian)
// - %20 PSİKOLOJİK FAKTÖRLER (Motivasyon, Baskı, Momentum)
//
// Bu engine agent'lara "hazır olasılıklar" değil, "hesaplama araçları" sağlar
// Agent'lar bu araçları kullanarak KENDİ ANALİZLERİNİ yapar
// ============================================================================

import { MatchData } from './types';

// ==================== POISSON DAĞILIMİ ====================
// Futbolda gol olasılıklarını hesaplamak için en yaygın kullanılan model

export function poissonProbability(lambda: number, k: number): number {
  // P(X = k) = (λ^k * e^-λ) / k!
  const factorial = (n: number): number => {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  };
  
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function calculateScoreProbabilities(homeXG: number, awayXG: number): {
  exactScores: { [score: string]: number };
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  over35: number;
  btts: number;
} {
  const exactScores: { [score: string]: number } = {};
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let btts = 0;
  let over35 = 0;
  
  // 0-0 ile 6-6 arası tüm skorları hesapla
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const prob = poissonProbability(homeXG, h) * poissonProbability(awayXG, a);
      const score = `${h}-${a}`;
      exactScores[score] = Math.round(prob * 1000) / 10; // Yüzde olarak
      
      if (h > a) homeWin += prob;
      else if (h < a) awayWin += prob;
      else draw += prob;
      
      if (h + a > 2) over25 += prob;
      if (h + a > 3) over35 += prob;
      if (h > 0 && a > 0) btts += prob;
    }
  }
  
  return {
    exactScores,
    homeWin: Math.round(homeWin * 100),
    draw: Math.round(draw * 100),
    awayWin: Math.round(awayWin * 100),
    over25: Math.round(over25 * 100),
    under25: 100 - Math.round(over25 * 100),
    over35: Math.round(over35 * 100),
    btts: Math.round(btts * 100)
  };
}

// ==================== MONTE CARLO SİMÜLASYONU ====================
// 1000+ simülasyon ile senaryo analizi

export function monteCarloSimulation(homeXG: number, awayXG: number, simCount: number = 1000): {
  avgHomeGoals: number;
  avgAwayGoals: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  over25Pct: number;
  bttsPct: number;
  mostCommonScores: string[];
  goalRange: { min: number; max: number; avg: number };
} {
  const results = {
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    over25: 0,
    btts: 0,
    totalHomeGoals: 0,
    totalAwayGoals: 0,
    scores: {} as { [score: string]: number }
  };
  
  // Poisson dağılımından rastgele gol sayısı çek
  function poissonRandom(lambda: number): number {
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
  
  for (let i = 0; i < simCount; i++) {
    const homeGoals = poissonRandom(homeXG);
    const awayGoals = poissonRandom(awayXG);
    
    results.totalHomeGoals += homeGoals;
    results.totalAwayGoals += awayGoals;
    
    const score = `${homeGoals}-${awayGoals}`;
    results.scores[score] = (results.scores[score] || 0) + 1;
    
    if (homeGoals > awayGoals) results.homeWins++;
    else if (homeGoals < awayGoals) results.awayWins++;
    else results.draws++;
    
    if (homeGoals + awayGoals > 2) results.over25++;
    if (homeGoals > 0 && awayGoals > 0) results.btts++;
  }
  
  // En yaygın skorları sırala
  const sortedScores = Object.entries(results.scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(s => s[0]);
  
  const allGoals = Object.entries(results.scores)
    .flatMap(([score, count]) => {
      const [h, a] = score.split('-').map(Number);
      return Array(count).fill(h + a);
    });
  
  return {
    avgHomeGoals: Math.round((results.totalHomeGoals / simCount) * 100) / 100,
    avgAwayGoals: Math.round((results.totalAwayGoals / simCount) * 100) / 100,
    homeWinPct: Math.round((results.homeWins / simCount) * 100),
    drawPct: Math.round((results.draws / simCount) * 100),
    awayWinPct: Math.round((results.awayWins / simCount) * 100),
    over25Pct: Math.round((results.over25 / simCount) * 100),
    bttsPct: Math.round((results.btts / simCount) * 100),
    mostCommonScores: sortedScores,
    goalRange: {
      min: Math.min(...allGoals),
      max: Math.max(...allGoals),
      avg: Math.round((allGoals.reduce((a, b) => a + b, 0) / allGoals.length) * 100) / 100
    }
  };
}

// ==================== MOTİVASYON VE PSİKOLOJİ HESAPLAMA ====================
// Takımların maça hazırlık durumunu ve psikolojik avantajını hesaplar

export interface MotivationAnalysis {
  home: {
    score: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
    factors: string[];
    momentum: number; // -10 to +10
  };
  away: {
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    factors: string[];
    momentum: number;
  };
  psychologicalEdge: 'home' | 'away' | 'neutral';
  edgeStrength: number; // 0-20
  impactOnProbabilities: {
    homeBonus: number; // -10 to +10
    awayBonus: number;
  };
}

export function analyzeMotivation(matchData: MatchData): MotivationAnalysis {
  const { homeForm, awayForm, h2h } = matchData as any;
  
  // Form string'inden puan ve trend hesapla
  function analyzeForm(form: string): { points: number; trend: 'improving' | 'stable' | 'declining'; momentum: number } {
    if (!form || form.length < 3) return { points: 0, trend: 'stable', momentum: 0 };
    
    const getPoints = (char: string) => char === 'W' ? 3 : char === 'D' ? 1 : 0;
    
    // Son 3 vs önceki 3
    const recent3 = form.slice(0, 3).split('').reduce((sum, c) => sum + getPoints(c), 0);
    const previous3 = form.slice(3, 6).split('').reduce((sum, c) => sum + getPoints(c), 0);
    
    const totalPoints = form.split('').reduce((sum, c) => sum + getPoints(c), 0);
    const maxPoints = form.length * 3;
    
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recent3 > previous3 + 1) trend = 'improving';
    else if (recent3 < previous3 - 1) trend = 'declining';
    
    // Momentum: Son 3 maçın etkisi (-10 to +10)
    const momentum = ((recent3 / 9) * 20) - 10; // 0 puan = -10, 9 puan = +10
    
    return { points: totalPoints, trend, momentum };
  }
  
  const homeAnalysis = analyzeForm(homeForm?.form || '');
  const awayAnalysis = analyzeForm(awayForm?.form || '');
  
  // Motivasyon skoru hesapla (0-100)
  function calculateMotivationScore(
    formPoints: number,
    maxFormPoints: number,
    trend: 'improving' | 'stable' | 'declining',
    isHome: boolean
  ): number {
    let score = (formPoints / Math.max(maxFormPoints, 15)) * 60; // Base: 0-60
    
    // Trend bonusu
    if (trend === 'improving') score += 15;
    else if (trend === 'declining') score -= 10;
    
    // Ev/deplasman bonusu
    if (isHome) score += 10; // Ev avantajı
    else score -= 5; // Deplasman dezavantajı
    
    // Son 3 maç performansı
    const recentForm = homeAnalysis.points >= 7 ? 10 : 0; // 2W+1D veya daha iyi
    score += recentForm;
    
    return Math.min(100, Math.max(10, Math.round(score)));
  }
  
  const homeMotivation = calculateMotivationScore(
    homeAnalysis.points,
    (homeForm?.form?.length || 5) * 3,
    homeAnalysis.trend,
    true
  );
  
  const awayMotivation = calculateMotivationScore(
    awayAnalysis.points,
    (awayForm?.form?.length || 5) * 3,
    awayAnalysis.trend,
    false
  );
  
  // Psikolojik avantaj
  const motivationDiff = homeMotivation - awayMotivation;
  const psychologicalEdge: 'home' | 'away' | 'neutral' = 
    motivationDiff > 15 ? 'home' : motivationDiff < -15 ? 'away' : 'neutral';
  
  const edgeStrength = Math.min(20, Math.abs(motivationDiff) / 2);
  
  // Olasılıklara etki
  const homeBonus = Math.round(motivationDiff / 5);
  const awayBonus = -homeBonus;
  
  // Faktörler
  const homeFactors: string[] = [];
  const awayFactors: string[] = [];
  
  if (homeAnalysis.trend === 'improving') homeFactors.push('Form yükselişte');
  if (homeAnalysis.trend === 'declining') homeFactors.push('Form düşüşte');
  if (homeMotivation > 70) homeFactors.push('Yüksek motivasyon');
  if (homeMotivation < 40) homeFactors.push('Düşük motivasyon');
  homeFactors.push('Ev avantajı');
  
  if (awayAnalysis.trend === 'improving') awayFactors.push('Form yükselişte');
  if (awayAnalysis.trend === 'declining') awayFactors.push('Form düşüşte');
  if (awayMotivation > 70) awayFactors.push('Yüksek motivasyon');
  if (awayMotivation < 40) awayFactors.push('Düşük motivasyon');
  awayFactors.push('Deplasman zorluğu');
  
  return {
    home: {
      score: homeMotivation,
      trend: homeAnalysis.trend,
      factors: homeFactors,
      momentum: Math.round(homeAnalysis.momentum)
    },
    away: {
      score: awayMotivation,
      trend: awayAnalysis.trend,
      factors: awayFactors,
      momentum: Math.round(awayAnalysis.momentum)
    },
    psychologicalEdge,
    edgeStrength: Math.round(edgeStrength),
    impactOnProbabilities: {
      homeBonus: Math.max(-10, Math.min(10, homeBonus)),
      awayBonus: Math.max(-10, Math.min(10, awayBonus))
    }
  };
}

// ==================== BAYESIAN INFERENCE ====================
// Önceki bilgiyi (prior) yeni verilerle güncelleyerek olasılık hesapla

export function bayesianUpdate(
  priorProbability: number, // Önceki olasılık (0-100)
  newEvidence: {
    formStrength: number; // 0-100
    h2hAdvantage: number; // -20 to +20
    motivationBonus: number; // -10 to +10
    xgDifference: number; // xG farkı
  }
): number {
  // Prior'u 0.20-0.80 arasına sınırla (aşırı uçlardan kaçın)
  let prior = Math.max(0.20, Math.min(0.80, priorProbability / 100));
  
  // Evidence strength hesapla
  let evidenceMultiplier = 1.0;
  
  // Form gücü etkisi
  if (newEvidence.formStrength > 70) evidenceMultiplier *= 1.1;
  else if (newEvidence.formStrength < 40) evidenceMultiplier *= 0.9;
  
  // H2H avantajı
  evidenceMultiplier *= (1 + newEvidence.h2hAdvantage / 100);
  
  // Motivasyon bonusu
  evidenceMultiplier *= (1 + newEvidence.motivationBonus / 100);
  
  // xG farkı (en önemli faktör)
  if (Math.abs(newEvidence.xgDifference) > 0.5) {
    evidenceMultiplier *= (1 + newEvidence.xgDifference * 0.15);
  }
  
  // Posterior hesapla
  const posterior = prior * evidenceMultiplier;
  
  // Normalize et (0-100 arası)
  return Math.max(15, Math.min(75, Math.round(posterior * 100)));
}

// ==================== ANA OLASILIK HESAPLAMA FONKSİYONU ====================
// Tüm modelleri birleştirerek final olasılıkları hesaplar

export interface ProbabilityResult {
  // Ana tahminler
  matchResult: {
    homeWin: number;
    draw: number;
    awayWin: number;
    prediction: '1' | 'X' | '2';
    confidence: number;
  };
  overUnder: {
    over25: number;
    under25: number;
    prediction: 'Over' | 'Under';
    confidence: number;
  };
  btts: {
    yes: number;
    no: number;
    prediction: 'Yes' | 'No';
    confidence: number;
  };
  
  // Detaylı analiz
  poissonModel: ReturnType<typeof calculateScoreProbabilities>;
  monteCarloModel: ReturnType<typeof monteCarloSimulation>;
  motivationAnalysis: MotivationAnalysis;
  
  // Meta bilgiler
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  modelAgreement: number; // Modellerin ne kadar hemfikir olduğu (0-100)
  recommendedBet: {
    market: string;
    selection: string;
    confidence: number;
    reasoning: string;
  };
}

export function calculateComprehensiveProbabilities(matchData: MatchData): ProbabilityResult {
  const { homeForm, awayForm, h2h } = matchData as any;
  
  // 1. xG hesapla (venue-specific)
  const homeXG = parseFloat(homeForm?.venueAvgScored || homeForm?.avgGoals || '1.3');
  const awayXG = parseFloat(awayForm?.venueAvgScored || awayForm?.avgGoals || '1.0');
  const homeConceded = parseFloat(homeForm?.venueAvgConceded || homeForm?.avgConceded || '1.0');
  const awayConceded = parseFloat(awayForm?.venueAvgConceded || awayForm?.avgConceded || '1.2');
  
  // Beklenen gol (karşılıklı etki)
  const homeExpected = (homeXG + awayConceded) / 2;
  const awayExpected = (awayXG + homeConceded) / 2;
  
  // 2. Poisson modeli
  const poissonModel = calculateScoreProbabilities(homeExpected, awayExpected);
  
  // 3. Monte Carlo simülasyonu
  const monteCarloModel = monteCarloSimulation(homeExpected, awayExpected, 1000);
  
  // 4. Motivasyon analizi
  const motivationAnalysis = analyzeMotivation(matchData);
  
  // 5. H2H etkisi
  const h2hHomeWins = h2h?.homeWins || 0;
  const h2hAwayWins = h2h?.awayWins || 0;
  const h2hAdvantage = (h2hHomeWins - h2hAwayWins) * 3; // Her galibiyet 3 puan
  
  // 6. Final olasılıklar (ağırlıklı ortalama)
  // Poisson: %40, Monte Carlo: %30, Motivasyon: %20, H2H: %10
  const homeWinRaw = 
    poissonModel.homeWin * 0.40 +
    monteCarloModel.homeWinPct * 0.30 +
    (35 + motivationAnalysis.impactOnProbabilities.homeBonus * 2) * 0.20 +
    (35 + h2hAdvantage) * 0.10;
  
  const awayWinRaw = 
    poissonModel.awayWin * 0.40 +
    monteCarloModel.awayWinPct * 0.30 +
    (35 + motivationAnalysis.impactOnProbabilities.awayBonus * 2) * 0.20 +
    (35 - h2hAdvantage) * 0.10;
  
  const drawRaw = 100 - homeWinRaw - awayWinRaw;
  
  // Normalize et
  const total = homeWinRaw + awayWinRaw + drawRaw;
  const homeWin = Math.round((homeWinRaw / total) * 100);
  const awayWin = Math.round((awayWinRaw / total) * 100);
  const draw = Math.max(20, 100 - homeWin - awayWin); // Beraberlik en az %20
  
  // Over/Under - DÜZELTME: Daha net eşik değerleri
  const over25Raw = 
    poissonModel.over25 * 0.50 +
    monteCarloModel.over25Pct * 0.50;
  const over25 = Math.round(over25Raw);
  
  // BTTS
  const bttsRaw = 
    poissonModel.btts * 0.50 +
    monteCarloModel.bttsPct * 0.50;
  const bttsYes = Math.round(bttsRaw);
  
  // 7. Tahmin ve güven - DÜZELTME: Daha net kurallar
  const prediction: '1' | 'X' | '2' = 
    homeWin > awayWin && homeWin > draw ? '1' :
    awayWin > homeWin && awayWin > draw ? '2' : 'X';
  
  const maxProb = Math.max(homeWin, awayWin, draw);
  const matchResultConfidence = Math.min(75, 50 + (maxProb - 33) * 0.5);
  
  // DÜZELTME: 2.5 alt/üst kararında net eşik değerleri
  let overUnderPrediction: 'Over' | 'Under';
  let overUnderConfidence: number;
  
  if (over25 >= 60) {
    overUnderPrediction = 'Over';
    overUnderConfidence = Math.min(80, 50 + (over25 - 50) * 1.5); // Daha güçlü confidence
  } else if (over25 <= 40) {
    overUnderPrediction = 'Under';
    overUnderConfidence = Math.min(80, 50 + ((100 - over25) - 50) * 1.5);
  } else {
    // 40-60 arası gri bölge
    overUnderPrediction = over25 >= 50 ? 'Over' : 'Under';
    overUnderConfidence = Math.min(65, 50 + Math.abs(over25 - 50) * 0.8);
  }
  
  const bttsPrediction: 'Yes' | 'No' = bttsYes >= 55 ? 'Yes' : 'No';
  const bttsConfidence = Math.min(75, 50 + Math.abs(bttsYes - 50) * 0.5);
  
  // 8. Model uyumu (Poisson ve Monte Carlo ne kadar hemfikir)
  const modelAgreement = 100 - Math.abs(poissonModel.homeWin - monteCarloModel.homeWinPct) -
    Math.abs(poissonModel.over25 - monteCarloModel.over25Pct);
  
  // 9. Veri kalitesi
  const dataPoints = (homeForm?.matches?.length || 0) + (awayForm?.matches?.length || 0) + (h2h?.totalMatches || 0);
  const dataQuality: 'excellent' | 'good' | 'fair' | 'poor' = 
    dataPoints >= 25 ? 'excellent' :
    dataPoints >= 15 ? 'good' :
    dataPoints >= 8 ? 'fair' : 'poor';
  
  // 10. En iyi bahis önerisi - DÜZELTME: Tutarlılık kontrolü
  const bets = [
    { market: 'Match Result', selection: prediction, confidence: matchResultConfidence, prob: maxProb },
    { market: 'Over/Under 2.5', selection: overUnderPrediction, confidence: overUnderConfidence, prob: overUnderPrediction === 'Over' ? over25 : 100 - over25 },
    { market: 'BTTS', selection: bttsPrediction, confidence: bttsConfidence, prob: bttsPrediction === 'Yes' ? bttsYes : 100 - bttsYes }
  ];
  
  // TUTARLILIK KONTROLÜ: Gol beklentisi ile 2.5 alt/üst önerisi uyumlu mu?
  const totalExpectedGoals = homeExpected + awayExpected;
  const overUnderBet = bets.find(b => b.market === 'Over/Under 2.5');
  if (overUnderBet) {
    if (totalExpectedGoals > 2.8 && overUnderBet.selection === 'Under') {
      // Çelişki: Yüksek gol beklentisi ama Under önerisi
      overUnderBet.selection = 'Over';
      overUnderBet.confidence = Math.max(overUnderBet.confidence, 65);
      overUnderBet.prob = over25;
      console.log(`⚠️  TUTARLILIK DÜZELTME: Beklenen gol ${totalExpectedGoals.toFixed(1)} > 2.8 ama Under önerildi. Over olarak düzeltildi.`);
    } else if (totalExpectedGoals < 2.2 && overUnderBet.selection === 'Over') {
      // Çelişki: Düşük gol beklentisi ama Over önerisi
      overUnderBet.selection = 'Under';
      overUnderBet.confidence = Math.max(overUnderBet.confidence, 65);
      overUnderBet.prob = 100 - over25;
      console.log(`⚠️  TUTARLILIK DÜZELTME: Beklenen gol ${totalExpectedGoals.toFixed(1)} < 2.2 ama Over önerildi. Under olarak düzeltildi.`);
    }
  }
  
  // TUTARLILIK KONTROLÜ: BTTS ve gol beklentisi
  const bttsBet = bets.find(b => b.market === 'BTTS');
  if (bttsBet) {
    // Eğer her iki takım da gol atma potansiyeline sahipse ama "No" öneriliyorsa
    if (homeExpected > 0.8 && awayExpected > 0.8 && bttsBet.selection === 'No') {
      // Çelişki: Her iki takım da gol atabilir ama "KG Yok" önerisi
      bttsBet.selection = 'Yes';
      bttsBet.confidence = Math.max(bttsBet.confidence, 60);
      bttsBet.prob = bttsYes;
      console.log(`⚠️  TUTARLILIK DÜZELTME: Ev beklenen gol ${homeExpected.toFixed(1)}, Dep beklenen gol ${awayExpected.toFixed(1)} ama KG Yok önerildi. KG Var olarak düzeltildi.`);
    } else if (homeExpected < 0.5 && awayExpected < 0.5 && bttsBet.selection === 'Yes') {
      // Çelişki: Düşük gol beklentisi ama "KG Var" önerisi
      bttsBet.selection = 'No';
      bttsBet.confidence = Math.max(bttsBet.confidence, 60);
      bttsBet.prob = 100 - bttsYes;
      console.log(`⚠️  TUTARLILIK DÜZELTME: Düşük gol beklentisi (Ev ${homeExpected.toFixed(1)}, Dep ${awayExpected.toFixed(1)}) ama KG Var önerildi. KG Yok olarak düzeltildi.`);
    }
  }
  
  bets.sort((a, b) => (b.confidence * b.prob) - (a.confidence * a.prob));
  const best = bets[0];
  
  return {
    matchResult: {
      homeWin,
      draw,
      awayWin,
      prediction,
      confidence: Math.round(matchResultConfidence)
    },
    overUnder: {
      over25,
      under25: 100 - over25,
      prediction: overUnderPrediction,
      confidence: Math.round(overUnderConfidence)
    },
    btts: {
      yes: bttsYes,
      no: 100 - bttsYes,
      prediction: bttsPrediction,
      confidence: Math.round(bttsConfidence)
    },
    poissonModel,
    monteCarloModel,
    motivationAnalysis,
    dataQuality,
    modelAgreement: Math.max(0, Math.round(modelAgreement)),
    recommendedBet: {
      market: best.market,
      selection: best.selection,
      confidence: Math.round(best.confidence),
      reasoning: `${best.market} ${best.selection}: %${best.prob} olasılık, %${Math.round(best.confidence)} güven`
    }
  };
}

// ==================== AGENT İÇİN PROMPT CONTEXT OLUŞTURMA ====================
// Agent'lara sunulacak zengin veri paketi

export function generateProbabilityContext(matchData: MatchData): string {
  const result = calculateComprehensiveProbabilities(matchData);
  const motivation = result.motivationAnalysis;
  
  return `
═══════════════════════════════════════════════════════════════════════════════
                    🎯 PROBABILITY ENGINE ANALİZİ
                    ${matchData.homeTeam} vs ${matchData.awayTeam}
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 POİSSON DAĞILIMİ MODELİ (Matematiksel Kesinlik)
├─────────────────────────────────────────────────────────────────────────────┤
│ Ev Kazanır: %${result.poissonModel.homeWin}
│ Beraberlik: %${result.poissonModel.draw}
│ Deplasman Kazanır: %${result.poissonModel.awayWin}
│ Over 2.5: %${result.poissonModel.over25} | Under 2.5: %${result.poissonModel.under25}
│ Over 3.5: %${result.poissonModel.over35}
│ BTTS: %${result.poissonModel.btts}
│ 
│ En Olası Skorlar:
│ ${Object.entries(result.poissonModel.exactScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([score, prob]) => `   ${score}: %${prob}`)
    .join('\n')}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎲 MONTE CARLO SİMÜLASYONU (1000 Senaryo)
├─────────────────────────────────────────────────────────────────────────────┤
│ Ev Kazanır: %${result.monteCarloModel.homeWinPct}
│ Beraberlik: %${result.monteCarloModel.drawPct}
│ Deplasman Kazanır: %${result.monteCarloModel.awayWinPct}
│ Over 2.5: %${result.monteCarloModel.over25Pct}
│ BTTS: %${result.monteCarloModel.bttsPct}
│ 
│ Beklenen Gol: Ev ${result.monteCarloModel.avgHomeGoals} - Dep ${result.monteCarloModel.avgAwayGoals}
│ Gol Aralığı: ${result.monteCarloModel.goalRange.min} - ${result.monteCarloModel.goalRange.max} (Ort: ${result.monteCarloModel.goalRange.avg})
│ En Yaygın Skorlar: ${result.monteCarloModel.mostCommonScores.join(', ')}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧠 MOTİVASYON VE PSİKOLOJİ ANALİZİ
├─────────────────────────────────────────────────────────────────────────────┤
│ ${matchData.homeTeam}:
│   Motivasyon Skoru: ${motivation.home.score}/100
│   Trend: ${motivation.home.trend === 'improving' ? '📈 Yükselişte' : motivation.home.trend === 'declining' ? '📉 Düşüşte' : '➡️ Stabil'}
│   Momentum: ${motivation.home.momentum > 0 ? '+' : ''}${motivation.home.momentum}
│   Faktörler: ${motivation.home.factors.join(', ')}
│ 
│ ${matchData.awayTeam}:
│   Motivasyon Skoru: ${motivation.away.score}/100
│   Trend: ${motivation.away.trend === 'improving' ? '📈 Yükselişte' : motivation.away.trend === 'declining' ? '📉 Düşüşte' : '➡️ Stabil'}
│   Momentum: ${motivation.away.momentum > 0 ? '+' : ''}${motivation.away.momentum}
│   Faktörler: ${motivation.away.factors.join(', ')}
│ 
│ Psikolojik Avantaj: ${motivation.psychologicalEdge === 'home' ? matchData.homeTeam : motivation.psychologicalEdge === 'away' ? matchData.awayTeam : 'Nötr'} (Güç: ${motivation.edgeStrength}/20)
│ Olasılık Etkisi: Ev ${motivation.impactOnProbabilities.homeBonus > 0 ? '+' : ''}${motivation.impactOnProbabilities.homeBonus}%, Dep ${motivation.impactOnProbabilities.awayBonus > 0 ? '+' : ''}${motivation.impactOnProbabilities.awayBonus}%
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 FİNAL OLASILIKLAR (Tüm Modellerin Birleşimi)
├─────────────────────────────────────────────────────────────────────────────┤
│ MAÇI SONUCU:
│   1 (Ev): %${result.matchResult.homeWin}
│   X (Beraberlik): %${result.matchResult.draw}
│   2 (Deplasman): %${result.matchResult.awayWin}
│   TAHMİN: ${result.matchResult.prediction} (Güven: %${result.matchResult.confidence})
│ 
│ OVER/UNDER 2.5:
│   Over: %${result.overUnder.over25}
│   Under: %${result.overUnder.under25}
│   TAHMİN: ${result.overUnder.prediction} (Güven: %${result.overUnder.confidence})
│ 
│ KARŞILIKLI GOL:
│   Var: %${result.btts.yes}
│   Yok: %${result.btts.no}
│   TAHMİN: ${result.btts.prediction} (Güven: %${result.btts.confidence})
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📈 MODEL UYUMU VE VERİ KALİTESİ
├─────────────────────────────────────────────────────────────────────────────┤
│ Model Uyumu: %${result.modelAgreement} (Poisson & Monte Carlo hemfikirliği)
│ Veri Kalitesi: ${result.dataQuality.toUpperCase()}
│ 
│ 🏆 ÖNERİLEN BAHİS:
│ ${result.recommendedBet.market}: ${result.recommendedBet.selection}
│ Güven: %${result.recommendedBet.confidence}
│ Gerekçe: ${result.recommendedBet.reasoning}
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                    AGENT TALİMATI
═══════════════════════════════════════════════════════════════════════════════

Yukarıdaki matematiksel modelleri ve psikolojik analizi BAĞIMSIZ OLARAK değerlendir.
Modeller sadece ARAÇ - sen bu verileri yorumlayarak KENDİ ANALİZİNİ yap.

SORMALISIN:
1. Modeller tutarlı mı? Poisson ve Monte Carlo aynı yönü mü gösteriyor?
2. Motivasyon farkı gerçekten sonucu etkiler mi? Ne kadar?
3. Veriler güvenilir mi? Yeterli maç var mı?
4. Gizli faktörler var mı? (Sakatlık, hakem, hava durumu)
5. Piyasa (oranlar) bu analizle uyumlu mu? Value var mı?

SONUÇ: Matematiksel modellere %60, psikolojik analize %20, kendi yorumuna %20 ağırlık ver.
`;
}

