// ============================================================================
// SURVIVAL AGENT - Verdict Engine v2 ("Ya Bil Ya Öl")
// 
// BU AJAN %35 TAHMİN VERMEZ. YA BİLİR YA ÖLÜR.
// 
// Felsefe:
//   - Minimum %55 güven eşiği. Altındaysa "ÖLÜM" - tahmin vermez
//   - Tüm ajanları dinler ama AKILLI AĞIRLIK verir
//   - Tarihsel veri güçlüyse güveni artırır, zayıfsa ÖLÜR
//   - Ajanlar bölünmüşse İKİ KEZ DÜŞÜNÜR
//   - Tek bir market, tek bir sonuç, kaya gibi sağlam
// ============================================================================

import type { SurvivalPrediction, MarketPrediction } from './predictor';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentVote {
  agentName: string;
  market: 'mr' | 'ou' | 'btts';
  prediction: string;
  confidence: number;
  weight: number; // Ajan güvenilirlik ağırlığı
}

export interface SurvivalVerdict {
  market: 'MS' | 'OU' | 'BTTS';
  marketLabel: string;
  selection: string;
  selectionLabel: string;
  confidence: number;
  reasoning: string;
  agentAgreement: string;
  historicalBacking: string;
  riskLevel: 'dusuk' | 'orta' | 'yuksek';
  certaintyScore: number;
  totalAgentsConsulted: number;
  isDead?: boolean; // Ajan bu maçta ölü mü (tahmin veremedi)
  deathReason?: string;
}

// ============================================================================
// AJAN AĞIRLIKLARI (güvenilirlik sıralaması)
// Geçmişte daha isabetli olan ajanlar daha ağır basar
// ============================================================================

const AGENT_WEIGHTS: Record<string, number> = {
  stats: 1.4,           // İstatistik ajanı - veri bazlı, güvenilir
  odds: 1.3,            // Oran ajanı - piyasa bilgisi
  deep: 1.2,            // Derin analiz - taktiksel
  master: 1.5,          // Master Strategist - en ağırlıklı
  master_bet: 1.3,      // Master'ın spesifik bahis önerisi
  smart: 1.1,           // Smart analyzer
  autolearn: 1.6,       // AutoLearn - geçmişten öğrenmiş
  consensus: 1.0,       // Mevcut konsensüs - baz ağırlık
  survival: 0.8,        // Kendi tahmini - en düşük (ego yok)
  devils: 0.6,          // Şeytanın avukatı - contrarian, düşük ağırlık
};

// ============================================================================
// MİNİMUM EŞİKLER
// ============================================================================

const MIN_CONFIDENCE = 55;        // Altında → ÖLÜ
const MIN_AGENT_AGREEMENT = 0.50; // En az %50 ajan aynı fikirde olmalı
const MIN_CERTAINTY_SCORE = 40;   // Ham kesinlik minimum

// ============================================================================
// VERDICT ENGINE v2
// ============================================================================

export function generateVerdict(
  ownPrediction: SurvivalPrediction,
  agentResult: any,
  smartResult: any,
  autoLearnResults: any[],
  consensusPredictions: any
): SurvivalVerdict {
  // 1. Tüm ajanlardan AĞIRLIKLI oyları topla
  const votes = collectAllVotes(agentResult, smartResult, autoLearnResults, consensusPredictions);

  // 2. Kendi tahminlerini de ekle (düşük ağırlıkla - ego yok)
  if (ownPrediction.matchResult.prediction) {
    votes.push({ agentName: 'survival', market: 'mr', prediction: normalizePred(ownPrediction.matchResult.prediction), confidence: ownPrediction.matchResult.confidence, weight: AGENT_WEIGHTS.survival });
  }
  if (ownPrediction.overUnder.prediction) {
    votes.push({ agentName: 'survival', market: 'ou', prediction: normalizePred(ownPrediction.overUnder.prediction), confidence: ownPrediction.overUnder.confidence, weight: AGENT_WEIGHTS.survival });
  }
  if (ownPrediction.btts.prediction) {
    votes.push({ agentName: 'survival', market: 'btts', prediction: normalizePred(ownPrediction.btts.prediction), confidence: ownPrediction.btts.confidence, weight: AGENT_WEIGHTS.survival });
  }

  // 3. Her market için AKILLI kesinlik skoru hesapla
  const mrScore = calculateSmartCertainty('mr', votes, ownPrediction.matchResult);
  const ouScore = calculateSmartCertainty('ou', votes, ownPrediction.overUnder);
  const bttsScore = calculateSmartCertainty('btts', votes, ownPrediction.btts);

  // 4. En güçlü marketi seç
  const candidates = [
    { market: 'MS' as const, key: 'mr' as const, label: 'Maç Sonucu', score: mrScore, ownPred: ownPrediction.matchResult },
    { market: 'OU' as const, key: 'ou' as const, label: 'Over/Under 2.5', score: ouScore, ownPred: ownPrediction.overUnder },
    { market: 'BTTS' as const, key: 'btts' as const, label: 'BTTS', score: bttsScore, ownPred: ownPrediction.btts },
  ].sort((a, b) => b.score.finalScore - a.score.finalScore);

  const best = candidates[0];

  // 5. ÖLÜ MÜ KONTROL ET
  const isDead = best.score.finalScore < MIN_CERTAINTY_SCORE || 
                 best.score.confidence < MIN_CONFIDENCE ||
                 best.score.agreementRatio < MIN_AGENT_AGREEMENT;

  if (isDead) {
    const deathReason = buildDeathReason(best.score);
    return {
      market: best.market,
      marketLabel: best.label,
      selection: best.score.winningPrediction || '?',
      selectionLabel: getSelectionLabel(best.market, best.score.winningPrediction || '?'),
      confidence: 0,
      reasoning: deathReason,
      agentAgreement: `${best.score.agreeCount}/${best.score.totalVoters} ajan`,
      historicalBacking: 'Yetersiz veri',
      riskLevel: 'yuksek',
      certaintyScore: Math.round(best.score.finalScore),
      totalAgentsConsulted: new Set(votes.map(v => v.agentName)).size,
      isDead: true,
      deathReason,
    };
  }

  // 6. HAYATTA - Güçlü tahmin üret
  const totalAgents = new Set(votes.map(v => v.agentName)).size;
  const marketVotes = votes.filter(v => v.market === best.key);
  const winningPred = best.score.winningPrediction;
  const agreeCount = best.score.agreeCount;
  const totalVoters = best.score.totalVoters;

  const riskLevel: SurvivalVerdict['riskLevel'] =
    best.score.confidence >= 70 && best.score.agreementRatio >= 0.75 ? 'dusuk' :
    best.score.confidence >= 60 ? 'orta' : 'yuksek';

  const reasoning = buildAggressiveReasoning(best.market, winningPred, best.score, best.ownPred, riskLevel);

  return {
    market: best.market,
    marketLabel: best.label,
    selection: winningPred,
    selectionLabel: getSelectionLabel(best.market, winningPred),
    confidence: best.score.confidence,
    reasoning,
    agentAgreement: `${agreeCount}/${totalVoters} ajan aynı fikirde`,
    historicalBacking: best.ownPred.sampleSize > 0
      ? `${best.ownPred.sampleSize} benzer maçın %${best.ownPred.probability}'${vowelSuffix(best.ownPred.probability)} bu yönde`
      : 'Tarihsel veri yetersiz',
    riskLevel,
    certaintyScore: Math.round(best.score.finalScore),
    totalAgentsConsulted: totalAgents,
    isDead: false,
  };
}

// ============================================================================
// AKILLI KESİNLİK SKORU (v2)
// Eski: basit oy sayısı × ortalama güven
// Yeni: ağırlıklı güven × uyum oranı × tarihsel güç × veri kalitesi
// ============================================================================

interface SmartCertaintyResult {
  winningPrediction: string;
  finalScore: number;       // 0-100 nihai skor
  confidence: number;       // 0-100 final güven
  agreementRatio: number;   // 0-1 uyum oranı
  agreeCount: number;
  totalVoters: number;
  weightedAvgConf: number;  // Ağırlıklı ortalama güven
  historicalBonus: number;  // Tarihsel veri bonusu
  conflictPenalty: number;  // Çelişki cezası
}

function calculateSmartCertainty(
  market: 'mr' | 'ou' | 'btts',
  allVotes: AgentVote[],
  ownPrediction: MarketPrediction
): SmartCertaintyResult {
  const votes = allVotes.filter(v => v.market === market && v.prediction);
  
  if (votes.length === 0) {
    return {
      winningPrediction: '', finalScore: 0, confidence: 0, agreementRatio: 0,
      agreeCount: 0, totalVoters: 0, weightedAvgConf: 0, historicalBonus: 0, conflictPenalty: 0
    };
  }

  // 1. AĞIRLIKLI OY TOPLAMA
  const tally: Record<string, { weightedConf: number; totalWeight: number; count: number; maxConf: number }> = {};
  
  for (const v of votes) {
    if (!tally[v.prediction]) tally[v.prediction] = { weightedConf: 0, totalWeight: 0, count: 0, maxConf: 0 };
    const t = tally[v.prediction];
    t.weightedConf += v.confidence * v.weight;
    t.totalWeight += v.weight;
    t.count++;
    t.maxConf = Math.max(t.maxConf, v.confidence);
  }

  // 2. KAZANAN SEÇENEĞİ BUL (ağırlıklı skor bazlı)
  let winner = '';
  let maxWeightedScore = 0;
  
  for (const [pred, data] of Object.entries(tally)) {
    // Ağırlıklı skor = (ağırlıklı ort güven) × (oy sayısı kök)
    const avgWeightedConf = data.weightedConf / data.totalWeight;
    const score = avgWeightedConf * Math.sqrt(data.count);
    if (score > maxWeightedScore) {
      maxWeightedScore = score;
      winner = pred;
    }
  }

  const winnerData = tally[winner];
  if (!winnerData) {
    return {
      winningPrediction: '', finalScore: 0, confidence: 0, agreementRatio: 0,
      agreeCount: 0, totalVoters: 0, weightedAvgConf: 0, historicalBonus: 0, conflictPenalty: 0
    };
  }

  const totalVoters = votes.length;
  const agreeCount = winnerData.count;
  const agreementRatio = agreeCount / totalVoters;
  const weightedAvgConf = winnerData.weightedConf / winnerData.totalWeight;

  // 3. TARİHSEL BONUS
  let historicalBonus = 0;
  if (ownPrediction.sampleSize >= 30 && ownPrediction.probability >= 60) {
    historicalBonus = 15; // Güçlü tarihsel destek
  } else if (ownPrediction.sampleSize >= 15 && ownPrediction.probability >= 55) {
    historicalBonus = 8;
  } else if (ownPrediction.sampleSize >= 5) {
    historicalBonus = 3;
  }
  // Tarihsel tahmin aynı yöndeyse bonus ikiye katla
  if (normalizePred(ownPrediction.prediction) === winner && historicalBonus > 0) {
    historicalBonus = Math.round(historicalBonus * 1.5);
  }

  // 4. ÇELİŞKİ CEZASI
  let conflictPenalty = 0;
  const uniquePredictions = Object.keys(tally).length;
  if (uniquePredictions >= 3 && market === 'mr') {
    conflictPenalty = 15; // 3 farklı MS tahmini = ciddi çelişki
  } else if (agreementRatio < 0.5) {
    conflictPenalty = 10; // Yarıdan az ajan aynı fikirde
  } else if (agreementRatio < 0.6) {
    conflictPenalty = 5;
  }

  // 5. YÜKSEK GÜVEN BONUSU
  // Ajanların max güveni 70+ ise ve uyum yüksekse ekstra bonus
  let highConfBonus = 0;
  if (winnerData.maxConf >= 75 && agreementRatio >= 0.7) {
    highConfBonus = 8;
  } else if (winnerData.maxConf >= 65 && agreementRatio >= 0.6) {
    highConfBonus = 4;
  }

  // 6. FİNAL GÜVEN HESABI
  // Ana formül: Ağırlıklı ort güven + tarihsel bonus - çelişki cezası + yüksek güven bonusu
  let rawConfidence = weightedAvgConf + historicalBonus - conflictPenalty + highConfBonus;

  // Uyum çarpanı (agreement multiplier)
  // %100 uyum = 1.15x, %70 uyum = 1.0x, %50 uyum = 0.85x
  const agreementMultiplier = 0.7 + (agreementRatio * 0.45);
  rawConfidence *= agreementMultiplier;

  // Sınırla
  const confidence = Math.min(Math.max(Math.round(rawConfidence), 0), 95);

  // 7. FİNAL SKORU (farklı bir metrik - seçim kalitesi)
  const finalScore = Math.round(
    (confidence * 0.5) + 
    (agreementRatio * 100 * 0.25) + 
    (Math.min(historicalBonus * 3, 30) * 0.15) +
    (Math.min(winnerData.maxConf, 90) * 0.1)
  );

  return {
    winningPrediction: winner,
    finalScore,
    confidence,
    agreementRatio,
    agreeCount,
    totalVoters,
    weightedAvgConf: Math.round(weightedAvgConf),
    historicalBonus,
    conflictPenalty,
  };
}

// ============================================================================
// VOTE COLLECTION (ağırlıklı)
// ============================================================================

function collectAllVotes(
  agentResult: any,
  smartResult: any,
  autoLearnResults: any[],
  consensusPredictions: any
): AgentVote[] {
  const votes: AgentVote[] = [];

  // Stats Agent
  const stats = agentResult?.agents?.stats;
  if (stats) {
    if (stats.matchResult) votes.push({ agentName: 'stats', market: 'mr', prediction: normalizePred(stats.matchResult), confidence: stats.matchResultConfidence || stats.confidence || 50, weight: AGENT_WEIGHTS.stats });
    if (stats.overUnder) votes.push({ agentName: 'stats', market: 'ou', prediction: normalizePred(stats.overUnder), confidence: stats.overUnderConfidence || stats.confidence || 50, weight: AGENT_WEIGHTS.stats });
    if (stats.btts) votes.push({ agentName: 'stats', market: 'btts', prediction: normalizePred(stats.btts), confidence: stats.bttsConfidence || stats.confidence || 50, weight: AGENT_WEIGHTS.stats });

    // Probability Engine final (çok değerli sinyal)
    const pe = stats.probabilityEngine?.final;
    if (pe) {
      if (pe.matchResult) votes.push({ agentName: 'stats_pe', market: 'mr', prediction: normalizePred(pe.matchResult), confidence: pe.matchResultConfidence || 55, weight: 1.3 });
      if (pe.overUnder) votes.push({ agentName: 'stats_pe', market: 'ou', prediction: normalizePred(pe.overUnder), confidence: pe.overUnderConfidence || 55, weight: 1.3 });
      if (pe.btts) votes.push({ agentName: 'stats_pe', market: 'btts', prediction: normalizePred(pe.btts), confidence: pe.bttsConfidence || 55, weight: 1.3 });
    }
  }

  // Odds Agent
  const odds = agentResult?.agents?.odds;
  if (odds) {
    if (odds.matchWinnerValue) votes.push({ agentName: 'odds', market: 'mr', prediction: normalizePred(odds.matchWinnerValue), confidence: odds.confidence || 50, weight: AGENT_WEIGHTS.odds });
    if (odds.recommendation) votes.push({ agentName: 'odds', market: 'ou', prediction: normalizePred(odds.recommendation), confidence: odds.confidence || 50, weight: AGENT_WEIGHTS.odds });
    if (odds.bttsValue) votes.push({ agentName: 'odds', market: 'btts', prediction: normalizePred(odds.bttsValue), confidence: odds.confidence || 50, weight: AGENT_WEIGHTS.odds });

    // Value Analysis - piyasa aklı
    const va = odds._valueAnalysis;
    if (va) {
      if (va.bestValue === 'home' && va.bestValueAmount >= 10) {
        votes.push({ agentName: 'odds_value', market: 'mr', prediction: '1', confidence: 55 + Math.min(va.bestValueAmount, 30), weight: 1.5 });
      } else if (va.bestValue === 'away' && va.bestValueAmount >= 10) {
        votes.push({ agentName: 'odds_value', market: 'mr', prediction: '2', confidence: 55 + Math.min(va.bestValueAmount, 30), weight: 1.5 });
      }
      if (va.bestValue === 'over' && va.bestValueAmount >= 8) {
        votes.push({ agentName: 'odds_value', market: 'ou', prediction: 'Over', confidence: 55 + Math.min(va.bestValueAmount, 25), weight: 1.4 });
      }
    }

    // Real Value Checks
    const rvc = odds.realValueChecks;
    if (rvc) {
      if (rvc.home?.isValue) votes.push({ agentName: 'odds_rvc', market: 'mr', prediction: '1', confidence: 65, weight: 1.4 });
      if (rvc.over25?.isValue) votes.push({ agentName: 'odds_rvc', market: 'ou', prediction: 'Over', confidence: 62, weight: 1.3 });
    }
  }

  // Deep Analysis
  const deep = agentResult?.agents?.deepAnalysis;
  if (deep) {
    // Motivasyon puanı yüksek olan takıma bonus
    const motHome = deep.motivationScores?.home || deep.motivationScores?.homePerformanceScore || 0;
    const motAway = deep.motivationScores?.away || deep.motivationScores?.awayPerformanceScore || 0;
    const motDiff = motHome - motAway;

    if (Math.abs(motDiff) >= 20) {
      const mrPred = motDiff > 0 ? '1' : '2';
      const motConf = Math.min(55 + Math.abs(motDiff) * 0.3, 75);
      votes.push({ agentName: 'deep_motivation', market: 'mr', prediction: mrPred, confidence: motConf, weight: 1.2 });
    }

    if (deep.matchResult?.prediction) votes.push({ agentName: 'deep', market: 'mr', prediction: normalizePred(deep.matchResult.prediction), confidence: deep.matchResult.confidence || 50, weight: AGENT_WEIGHTS.deep });
    if (deep.overUnder?.prediction) votes.push({ agentName: 'deep', market: 'ou', prediction: normalizePred(deep.overUnder.prediction), confidence: deep.overUnder.confidence || 50, weight: AGENT_WEIGHTS.deep });
    if (deep.btts?.prediction) votes.push({ agentName: 'deep', market: 'btts', prediction: normalizePred(deep.btts.prediction), confidence: deep.btts.confidence || 50, weight: AGENT_WEIGHTS.deep });
  }

  // Master Strategist (en ağır ajan)
  const ms = agentResult?.agents?.masterStrategist;
  if (ms) {
    // Model probabilities - EN DEĞERLI VERİ
    const probs = ms.model_probs;
    if (probs) {
      // MR
      const homeProb = probs.home_win || 0;
      const drawProb = probs.draw || 0;
      const awayProb = probs.away_win || 0;
      const maxProb = Math.max(homeProb, drawProb, awayProb);
      const mrPred = maxProb === homeProb ? '1' : maxProb === awayProb ? '2' : 'X';
      if (maxProb >= 35) {
        votes.push({ agentName: 'master_probs', market: 'mr', prediction: mrPred, confidence: Math.min(maxProb + 15, 85), weight: 1.6 });
      }

      // OU
      const overProb = probs['over_2.5'] || probs.over25 || 0;
      if (overProb >= 55) {
        votes.push({ agentName: 'master_probs', market: 'ou', prediction: 'Over', confidence: Math.min(overProb + 5, 85), weight: 1.5 });
      } else if (overProb <= 42) {
        votes.push({ agentName: 'master_probs', market: 'ou', prediction: 'Under', confidence: Math.min(100 - overProb + 5, 85), weight: 1.5 });
      }

      // BTTS
      const bttsProb = probs.btts || 0;
      if (bttsProb >= 55) {
        votes.push({ agentName: 'master_probs', market: 'btts', prediction: 'Yes', confidence: Math.min(bttsProb + 5, 85), weight: 1.4 });
      } else if (bttsProb <= 40) {
        votes.push({ agentName: 'master_probs', market: 'btts', prediction: 'No', confidence: Math.min(100 - bttsProb + 5, 85), weight: 1.4 });
      }
    }

    // Primary pick
    const pick = ms.final?.primary_pick;
    if (pick) {
      let pickMarket: 'mr' | 'ou' | 'btts' = 'mr';
      if (pick.market === 'Over/Under 2.5' || pick.market === 'OU') pickMarket = 'ou';
      else if (pick.market === 'BTTS') pickMarket = 'btts';
      votes.push({ agentName: 'master_pick', market: pickMarket, prediction: normalizePred(pick.selection), confidence: pick.confidence || 65, weight: 1.7 });
    }

    // Recommended bets
    const bets = ms.recommended_bets || [];
    for (const bet of bets) {
      let betMarket: 'mr' | 'ou' | 'btts' = 'mr';
      if (bet.market === 'Over/Under 2.5') betMarket = 'ou';
      else if (bet.market === 'BTTS') betMarket = 'btts';
      else if (bet.market === 'Match Result' || bet.market === '1X2') betMarket = 'mr';
      else continue;
      
      const betConf = bet.model_prob ? Math.round(bet.model_prob * 100) : bet.confidence || 60;
      votes.push({ agentName: 'master_bet', market: betMarket, prediction: normalizePred(bet.selection), confidence: betConf, weight: AGENT_WEIGHTS.master_bet });
    }
  }

  // Devil's Advocate (düşük ağırlık - ama uyarı sinyali olarak önemli)
  const da = agentResult?.agents?.devilsAdvocate;
  if (da?.matchResult) {
    votes.push({ agentName: 'devils', market: 'mr', prediction: normalizePred(da.matchResult), confidence: da.confidence || 50, weight: AGENT_WEIGHTS.devils });
  }

  // Smart Analysis
  if (smartResult) {
    if (smartResult.matchResult?.prediction) votes.push({ agentName: 'smart', market: 'mr', prediction: normalizePred(smartResult.matchResult.prediction), confidence: smartResult.matchResult.confidence || 55, weight: AGENT_WEIGHTS.smart });
    if (smartResult.overUnder?.prediction) votes.push({ agentName: 'smart', market: 'ou', prediction: normalizePred(smartResult.overUnder.prediction), confidence: smartResult.overUnder.confidence || 55, weight: AGENT_WEIGHTS.smart });
    if (smartResult.btts?.prediction) votes.push({ agentName: 'smart', market: 'btts', prediction: normalizePred(smartResult.btts.prediction), confidence: smartResult.btts.confidence || 55, weight: AGENT_WEIGHTS.smart });
  }

  // AutoLearn (öğrenmiş ajan - yüksek ağırlık)
  if (autoLearnResults && autoLearnResults.length > 0) {
    for (const alr of autoLearnResults) {
      if (alr.market && alr.prediction && alr.reliability !== 'insufficient') {
        const alConf = alr.autoLearnScore || alr.adjustedConfidence || 50;
        // AutoLearn'ün reliability'si yüksekse ağırlığı artır
        const alWeight = alr.reliability === 'high' ? AGENT_WEIGHTS.autolearn : 
                         alr.reliability === 'medium' ? AGENT_WEIGHTS.autolearn * 0.8 : 
                         AGENT_WEIGHTS.autolearn * 0.5;
        votes.push({ agentName: 'autolearn', market: alr.market, prediction: normalizePred(alr.prediction), confidence: alConf, weight: alWeight });
      }
    }
  }

  // Consensus
  if (consensusPredictions) {
    if (consensusPredictions.matchResult?.prediction) votes.push({ agentName: 'consensus', market: 'mr', prediction: normalizePred(consensusPredictions.matchResult.prediction), confidence: consensusPredictions.matchResult.confidence || 55, weight: AGENT_WEIGHTS.consensus });
    if (consensusPredictions.overUnder?.prediction) votes.push({ agentName: 'consensus', market: 'ou', prediction: normalizePred(consensusPredictions.overUnder.prediction), confidence: consensusPredictions.overUnder.confidence || 55, weight: AGENT_WEIGHTS.consensus });
    if (consensusPredictions.btts?.prediction) votes.push({ agentName: 'consensus', market: 'btts', prediction: normalizePred(consensusPredictions.btts.prediction), confidence: consensusPredictions.btts.confidence || 55, weight: AGENT_WEIGHTS.consensus });
  }

  return votes;
}

// ============================================================================
// AGRESİF REASONING (Kısa, kararlı, net)
// ============================================================================

function buildAggressiveReasoning(
  market: string,
  selection: string,
  score: SmartCertaintyResult,
  ownPred: MarketPrediction,
  risk: string
): string {
  const parts: string[] = [];

  // 1. Ajan konsensüsü - NET İFADE
  if (score.agreementRatio >= 0.85) {
    parts.push(`${score.agreeCount}/${score.totalVoters} ajan aynı yönde. Tartışma yok.`);
  } else if (score.agreementRatio >= 0.7) {
    parts.push(`${score.agreeCount}/${score.totalVoters} ajan destekliyor. Güçlü sinyal.`);
  } else if (score.agreementRatio >= 0.55) {
    parts.push(`${score.agreeCount}/${score.totalVoters} ajan bu yönde. Muhalefet var ama çoğunluk baskın.`);
  }

  // 2. Tarihsel destek
  if (ownPred.sampleSize >= 20 && ownPred.probability >= 60) {
    parts.push(`Tarih konuşuyor: ${ownPred.sampleSize} benzer maçın %${ownPred.probability}'${vowelSuffix(ownPred.probability)} bu sonucu verdi.`);
  } else if (ownPred.sampleSize >= 10) {
    parts.push(`${ownPred.sampleSize} benzer maç incelendi.`);
  }

  // 3. Güven seviyesi
  if (score.confidence >= 75) {
    parts.push('Bu sonuç GÜVENLİ. Karar verildi.');
  } else if (score.confidence >= 65) {
    parts.push('İyi sinyal. Güvenle oyna.');
  } else if (score.confidence >= 55) {
    parts.push('Yeterli güven. Dikkatli devam.');
  }

  // 4. Bonus bilgi
  if (score.historicalBonus >= 10) {
    parts.push('Tarihsel veri bu tahmini güçlendiriyor.');
  }
  if (score.conflictPenalty > 0) {
    parts.push('Bazı ajanlar farklı düşünüyor, risk hesaba katıldı.');
  }

  return parts.join(' ');
}

// ============================================================================
// ÖLÜM SEBEBİ
// ============================================================================

function buildDeathReason(score: SmartCertaintyResult): string {
  const reasons: string[] = [];
  
  if (score.confidence < MIN_CONFIDENCE) {
    reasons.push(`Güven çok düşük (%${score.confidence}). Minimum %${MIN_CONFIDENCE} gerekli.`);
  }
  if (score.agreementRatio < MIN_AGENT_AGREEMENT) {
    reasons.push(`Ajanlar bölünmüş (${score.agreeCount}/${score.totalVoters}). Minimum %${Math.round(MIN_AGENT_AGREEMENT * 100)} uyum gerekli.`);
  }
  if (score.finalScore < MIN_CERTAINTY_SCORE) {
    reasons.push(`Kesinlik skoru yetersiz (${Math.round(score.finalScore)}/${MIN_CERTAINTY_SCORE}).`);
  }
  if (score.conflictPenalty >= 10) {
    reasons.push('Ciddi çelişkiler tespit edildi.');
  }
  
  return `BU MAÇI BİLEMİYORUM. ${reasons.join(' ')} Tahmin vermek intihar olur. PAS GEÇ.`;
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizePred(val: any): string {
  if (!val) return '';
  const s = String(val).toLowerCase().trim();
  if (s === 'home' || s === '1' || s === 'ev sahibi') return '1';
  if (s === 'away' || s === '2' || s === 'deplasman') return '2';
  if (s === 'draw' || s === 'x' || s === 'beraberlik') return 'X';
  if (s === 'over' || s === 'üst') return 'Over';
  if (s === 'under' || s === 'alt') return 'Under';
  if (s === 'yes' || s === 'evet') return 'Yes';
  if (s === 'no' || s === 'hayır' || s === 'hayir') return 'No';
  return val;
}

function getSelectionLabel(market: string, selection: string): string {
  if (market === 'MS') {
    if (selection === '1') return 'Ev Sahibi Kazanır';
    if (selection === '2') return 'Deplasman Kazanır';
    if (selection === 'X') return 'Beraberlik';
  }
  if (market === 'OU') {
    if (selection === 'Over') return 'Üst 2.5 Gol';
    if (selection === 'Under') return 'Alt 2.5 Gol';
  }
  if (market === 'BTTS') {
    if (selection === 'Yes') return 'İki Takım da Gol Atar';
    if (selection === 'No') return 'En Az Bir Takım Gol Atamaz';
  }
  return selection;
}

function vowelSuffix(num: number): string {
  const lastDigit = num % 10;
  if ([1, 2, 7, 8].includes(lastDigit)) return 'i';
  if ([3, 4, 5].includes(lastDigit)) return 'ü';
  if ([6, 9, 0].includes(lastDigit)) return 'u';
  return 'i';
}
