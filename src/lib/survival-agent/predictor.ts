// ============================================================================
// SURVIVAL AGENT - Predictor
// Benzer maçlardan ağırlıklı istatistik çıkarır, MR/OU/BTTS tahmini üretir
// ============================================================================

import type { SimilarMatch } from './similarity';
import type { LeagueProfile, TeamMemory, HistoricalData } from './historical-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketPrediction {
  prediction: string;    // '1' | 'X' | '2' | 'Over' | 'Under' | 'Yes' | 'No'
  confidence: number;    // 0-100
  probability: number;   // 0-100 (ham olasılık)
  sampleSize: number;    // Kaç maçtan hesaplandı
  reasoning: string;     // Agresif, kısa gerekçe
}

export interface SurvivalPrediction {
  matchResult: MarketPrediction;
  overUnder: MarketPrediction;
  btts: MarketPrediction;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  totalSimilarMatches: number;
}

// ============================================================================
// PREDICTION ENGINE
// ============================================================================

export function generatePrediction(
  similarMatches: SimilarMatch[],
  historicalData: HistoricalData,
  homeTeam: string,
  awayTeam: string
): SurvivalPrediction {
  const total = similarMatches.length;

  // Veri kalitesi
  const dataQuality: SurvivalPrediction['dataQuality'] =
    total >= 50 ? 'excellent' : total >= 25 ? 'good' : total >= 10 ? 'fair' : 'poor';

  // -- MATCH RESULT --
  const matchResult = predictMatchResult(similarMatches, historicalData, homeTeam, awayTeam);

  // -- OVER/UNDER --
  const overUnder = predictOverUnder(similarMatches, historicalData);

  // -- BTTS --
  const btts = predictBTTS(similarMatches, historicalData);

  return {
    matchResult,
    overUnder,
    btts,
    dataQuality,
    totalSimilarMatches: total,
  };
}

// ============================================================================
// MATCH RESULT
// ============================================================================

function predictMatchResult(
  similar: SimilarMatch[],
  data: HistoricalData,
  homeTeam: string,
  awayTeam: string
): MarketPrediction {
  if (similar.length === 0) {
    return fallbackMR(data);
  }

  // Ağırlıklı oy hesabı
  let homeWeight = 0, drawWeight = 0, awayWeight = 0, totalWeight = 0;

  for (const sm of similar) {
    const w = sm.similarityScore;
    totalWeight += w;
    if (sm.match.actual_match_result === '1') homeWeight += w;
    else if (sm.match.actual_match_result === 'X') drawWeight += w;
    else if (sm.match.actual_match_result === '2') awayWeight += w;
  }

  const homePct = totalWeight > 0 ? (homeWeight / totalWeight) * 100 : 33;
  const drawPct = totalWeight > 0 ? (drawWeight / totalWeight) * 100 : 33;
  const awayPct = totalWeight > 0 ? (awayWeight / totalWeight) * 100 : 33;

  // H2H bonusu
  let h2hBonus = 0;
  let h2hText = '';
  if (data.h2hMatches.length >= 3) {
    const h2hHome = data.h2hMatches.filter(m =>
      (m.home_team === homeTeam && m.actual_match_result === '1') ||
      (m.away_team === homeTeam && m.actual_match_result === '2')
    ).length;
    const h2hPct = (h2hHome / data.h2hMatches.length) * 100;
    if (h2hPct >= 70) { h2hBonus = 5; h2hText = `H2H: ${data.h2hMatches.length} maçın %${Math.round(h2hPct)}'sini kazanmış.`; }
    else if (h2hPct <= 20) { h2hBonus = -5; }
  }

  // En yüksek olasılığı seç
  let prediction: string;
  let probability: number;
  let reasoning: string;

  if (homePct >= drawPct && homePct >= awayPct) {
    prediction = '1';
    probability = homePct;
    reasoning = `${similar.length} benzer maçın %${Math.round(homePct)}'inde ev sahibi kazandı.`;
  } else if (awayPct >= homePct && awayPct >= drawPct) {
    prediction = '2';
    probability = awayPct;
    reasoning = `${similar.length} benzer maçın %${Math.round(awayPct)}'inde deplasman kazandı.`;
  } else {
    prediction = 'X';
    probability = drawPct;
    reasoning = `${similar.length} benzer maçın %${Math.round(drawPct)}'si berabere bitti.`;
  }

  if (h2hText) reasoning += ' ' + h2hText;

  // Confidence = olasılık * veri kalitesi çarpanı
  const qualityMult = similar.length >= 30 ? 1.0 : similar.length >= 15 ? 0.9 : 0.75;
  const confidence = Math.min(Math.round((probability + h2hBonus) * qualityMult), 95);

  return { prediction, confidence, probability: Math.round(probability), sampleSize: similar.length, reasoning };
}

// ============================================================================
// OVER/UNDER
// ============================================================================

function predictOverUnder(
  similar: SimilarMatch[],
  data: HistoricalData
): MarketPrediction {
  if (similar.length === 0) {
    return fallbackOU(data);
  }

  let overWeight = 0, totalWeight = 0;
  let totalGoals = 0;

  for (const sm of similar) {
    const w = sm.similarityScore;
    totalWeight += w;
    if (sm.match.actual_total_goals > 2.5) overWeight += w;
    totalGoals += (sm.match.actual_total_goals || 0) * w;
  }

  const overPct = totalWeight > 0 ? (overWeight / totalWeight) * 100 : 50;
  const avgGoals = totalWeight > 0 ? totalGoals / totalWeight : 2.5;

  const prediction = overPct >= 50 ? 'Over' : 'Under';
  const probability = prediction === 'Over' ? overPct : 100 - overPct;

  const qualityMult = similar.length >= 30 ? 1.0 : similar.length >= 15 ? 0.9 : 0.75;
  const confidence = Math.min(Math.round(probability * qualityMult), 95);

  const reasoning = prediction === 'Over'
    ? `${similar.length} benzer maçın %${Math.round(overPct)}'i Over 2.5. Ort gol: ${avgGoals.toFixed(1)}.`
    : `${similar.length} benzer maçın %${Math.round(100 - overPct)}'i Under 2.5. Ort gol: ${avgGoals.toFixed(1)}.`;

  return { prediction, confidence, probability: Math.round(probability), sampleSize: similar.length, reasoning };
}

// ============================================================================
// BTTS
// ============================================================================

function predictBTTS(
  similar: SimilarMatch[],
  data: HistoricalData
): MarketPrediction {
  if (similar.length === 0) {
    return fallbackBTTS(data);
  }

  let bttsWeight = 0, totalWeight = 0;

  for (const sm of similar) {
    const w = sm.similarityScore;
    totalWeight += w;
    if (sm.match.actual_btts === true) bttsWeight += w;
  }

  const bttsPct = totalWeight > 0 ? (bttsWeight / totalWeight) * 100 : 50;

  const prediction = bttsPct >= 50 ? 'Yes' : 'No';
  const probability = prediction === 'Yes' ? bttsPct : 100 - bttsPct;

  const qualityMult = similar.length >= 30 ? 1.0 : similar.length >= 15 ? 0.9 : 0.75;
  const confidence = Math.min(Math.round(probability * qualityMult), 95);

  const reasoning = prediction === 'Yes'
    ? `${similar.length} benzer maçın %${Math.round(bttsPct)}'inde iki takım da gol attı.`
    : `${similar.length} benzer maçın %${Math.round(100 - bttsPct)}'inde en az bir takım gol atamadı.`;

  return { prediction, confidence, probability: Math.round(probability), sampleSize: similar.length, reasoning };
}

// ============================================================================
// FALLBACKS (Veri yoksa lig profilinden)
// ============================================================================

function fallbackMR(data: HistoricalData): MarketPrediction {
  const lp = data.leagueProfile;
  if (!lp) return { prediction: '1', confidence: 35, probability: 33, sampleSize: 0, reasoning: 'Veri yok. Varsayılan ev sahibi.' };

  if (lp.homeWinPct >= lp.drawPct && lp.homeWinPct >= lp.awayWinPct) {
    return { prediction: '1', confidence: Math.round(lp.homeWinPct * 0.6), probability: Math.round(lp.homeWinPct), sampleSize: lp.totalMatches, reasoning: `Lig geneli: ev sahibi %${Math.round(lp.homeWinPct)} kazanır.` };
  }
  return { prediction: '1', confidence: 35, probability: 33, sampleSize: lp.totalMatches, reasoning: 'Lig verisinden varsayılan tahmin.' };
}

function fallbackOU(data: HistoricalData): MarketPrediction {
  const lp = data.leagueProfile;
  if (!lp) return { prediction: 'Over', confidence: 35, probability: 50, sampleSize: 0, reasoning: 'Veri yok.' };
  const pred = lp.overPct >= 50 ? 'Over' : 'Under';
  const prob = pred === 'Over' ? lp.overPct : lp.underPct;
  return { prediction: pred, confidence: Math.round(prob * 0.6), probability: Math.round(prob), sampleSize: lp.totalMatches, reasoning: `Lig geneli: %${Math.round(prob)} ${pred}.` };
}

function fallbackBTTS(data: HistoricalData): MarketPrediction {
  const lp = data.leagueProfile;
  if (!lp) return { prediction: 'No', confidence: 35, probability: 50, sampleSize: 0, reasoning: 'Veri yok.' };
  const pred = lp.bttsYesPct >= 50 ? 'Yes' : 'No';
  const prob = pred === 'Yes' ? lp.bttsYesPct : lp.bttsNoPct;
  return { prediction: pred, confidence: Math.round(prob * 0.6), probability: Math.round(prob), sampleSize: lp.totalMatches, reasoning: `Lig geneli: BTTS %${Math.round(prob)} ${pred}.` };
}
