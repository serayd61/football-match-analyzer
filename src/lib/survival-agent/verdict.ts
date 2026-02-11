// ============================================================================
// SURVIVAL AGENT - Verdict Engine (İstişare Motoru)
// Tüm ajanların çıktısını + kendi analizini alıp TEK SONUÇ üretir
// Hangi market en güçlü sinyale sahipse ONU seçer
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
}

export interface SurvivalVerdict {
  market: 'MS' | 'OU' | 'BTTS';
  marketLabel: string;       // "Maç Sonucu" | "Over/Under 2.5" | "BTTS"
  selection: string;         // "1" | "X" | "2" | "Over" | "Under" | "Yes" | "No"
  selectionLabel: string;    // "Ev Sahibi Kazanır" | "Over 2.5" vb.
  confidence: number;
  reasoning: string;         // Agresif, kısa
  agentAgreement: string;    // "6/7 ajan aynı fikirde"
  historicalBacking: string; // "127 benzer maçın %68'i bu yönde"
  riskLevel: 'dusuk' | 'orta' | 'yuksek';
  certaintyScore: number;    // Ham kesinlik skoru (debug)
  totalAgentsConsulted: number;
}

// ============================================================================
// VERDICT ENGINE
// ============================================================================

export function generateVerdict(
  ownPrediction: SurvivalPrediction,
  agentResult: any,
  smartResult: any,
  autoLearnResults: any[],
  consensusPredictions: any
): SurvivalVerdict {
  // 1. Tüm ajanlardan oyları topla
  const votes = collectAllVotes(agentResult, smartResult, autoLearnResults, consensusPredictions);

  // 2. Kendi tahminlerini de ekle
  votes.push(
    { agentName: 'survival', market: 'mr', prediction: normalizePred(ownPrediction.matchResult.prediction), confidence: ownPrediction.matchResult.confidence },
    { agentName: 'survival', market: 'ou', prediction: normalizePred(ownPrediction.overUnder.prediction), confidence: ownPrediction.overUnder.confidence },
    { agentName: 'survival', market: 'btts', prediction: normalizePred(ownPrediction.btts.prediction), confidence: ownPrediction.btts.confidence }
  );

  // 3. Her market için kesinlik skoru hesapla
  const mrScore = calculateCertaintyScore('mr', votes);
  const ouScore = calculateCertaintyScore('ou', votes);
  const bttsScore = calculateCertaintyScore('btts', votes);

  // 4. En yüksek kesinlik skoruna sahip marketi seç
  const scores = [
    { market: 'MS' as const, key: 'mr' as const, label: 'Maç Sonucu', score: mrScore, ownPred: ownPrediction.matchResult },
    { market: 'OU' as const, key: 'ou' as const, label: 'Over/Under 2.5', score: ouScore, ownPred: ownPrediction.overUnder },
    { market: 'BTTS' as const, key: 'btts' as const, label: 'BTTS', score: bttsScore, ownPred: ownPrediction.btts },
  ];

  scores.sort((a, b) => b.score.certainty - a.score.certainty);
  const best = scores[0];

  // 5. Verdict oluştur
  const totalAgents = new Set(votes.map(v => v.agentName)).size;
  const marketVotes = votes.filter(v => v.market === best.key);
  const winningPred = best.score.winningPrediction;
  const agreeCount = marketVotes.filter(v => v.prediction === winningPred).length;
  const totalVoters = marketVotes.length;

  const confidence = Math.min(Math.round(best.score.avgConfidence * (agreeCount / totalVoters)), 95);

  const riskLevel: SurvivalVerdict['riskLevel'] =
    confidence >= 65 && agreeCount >= totalVoters * 0.7 ? 'dusuk' :
    confidence >= 50 ? 'orta' : 'yuksek';

  // Reasoning
  const reasoning = buildReasoning(best.market, winningPred, agreeCount, totalVoters, confidence, best.ownPred, riskLevel);

  return {
    market: best.market,
    marketLabel: best.label,
    selection: winningPred,
    selectionLabel: getSelectionLabel(best.market, winningPred),
    confidence,
    reasoning,
    agentAgreement: `${agreeCount}/${totalVoters} ajan aynı fikirde`,
    historicalBacking: best.ownPred.sampleSize > 0
      ? `${best.ownPred.sampleSize} benzer maçın %${best.ownPred.probability}'${vowelSuffix(best.ownPred.probability)} bu yönde`
      : 'Tarihsel veri yetersiz',
    riskLevel,
    certaintyScore: Math.round(best.score.certainty),
    totalAgentsConsulted: totalAgents,
  };
}

// ============================================================================
// VOTE COLLECTION
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
    if (stats.matchResult) votes.push({ agentName: 'stats', market: 'mr', prediction: normalizePred(stats.matchResult), confidence: stats.matchResultConfidence || stats.confidence || 50 });
    if (stats.overUnder) votes.push({ agentName: 'stats', market: 'ou', prediction: normalizePred(stats.overUnder), confidence: stats.overUnderConfidence || stats.confidence || 50 });
    if (stats.btts) votes.push({ agentName: 'stats', market: 'btts', prediction: normalizePred(stats.btts), confidence: stats.bttsConfidence || stats.confidence || 50 });
  }

  // Odds Agent
  const odds = agentResult?.agents?.odds;
  if (odds) {
    if (odds.matchWinnerValue) votes.push({ agentName: 'odds', market: 'mr', prediction: normalizePred(odds.matchWinnerValue), confidence: odds.confidence || 50 });
    if (odds.recommendation) votes.push({ agentName: 'odds', market: 'ou', prediction: normalizePred(odds.recommendation), confidence: odds.confidence || 50 });
    if (odds.bttsValue) votes.push({ agentName: 'odds', market: 'btts', prediction: normalizePred(odds.bttsValue), confidence: odds.confidence || 50 });
  }

  // Deep Analysis
  const deep = agentResult?.agents?.deepAnalysis;
  if (deep) {
    if (deep.matchResult?.prediction) votes.push({ agentName: 'deep', market: 'mr', prediction: normalizePred(deep.matchResult.prediction), confidence: deep.matchResult.confidence || 50 });
    if (deep.overUnder?.prediction) votes.push({ agentName: 'deep', market: 'ou', prediction: normalizePred(deep.overUnder.prediction), confidence: deep.overUnder.confidence || 50 });
    if (deep.btts?.prediction) votes.push({ agentName: 'deep', market: 'btts', prediction: normalizePred(deep.btts.prediction), confidence: deep.btts.confidence || 50 });
  }

  // Master Strategist
  const ms = agentResult?.agents?.masterStrategist;
  if (ms) {
    const msFinal = ms.finalConsensus || ms.final;
    if (msFinal?.matchResult?.prediction) votes.push({ agentName: 'master', market: 'mr', prediction: normalizePred(msFinal.matchResult.prediction), confidence: msFinal.matchResult.confidence || ms.confidence || 60 });
    if (msFinal?.overUnder?.prediction) votes.push({ agentName: 'master', market: 'ou', prediction: normalizePred(msFinal.overUnder.prediction), confidence: msFinal.overUnder.confidence || 60 });
    if (msFinal?.btts?.prediction) votes.push({ agentName: 'master', market: 'btts', prediction: normalizePred(msFinal.btts.prediction), confidence: msFinal.btts.confidence || 60 });

    // recommended_bets üzerinden de kontrol
    const bets = ms.recommended_bets || ms.final?.recommended_bets || [];
    for (const bet of bets) {
      if (bet.market === '1X2' || bet.market === 'Maç Sonucu') {
        votes.push({ agentName: 'master_bet', market: 'mr', prediction: normalizePred(bet.selection), confidence: bet.confidence || 60 });
      }
      if (bet.market === 'Over/Under 2.5') {
        votes.push({ agentName: 'master_bet', market: 'ou', prediction: normalizePred(bet.selection), confidence: bet.confidence || 60 });
      }
      if (bet.market === 'BTTS') {
        votes.push({ agentName: 'master_bet', market: 'btts', prediction: normalizePred(bet.selection), confidence: bet.confidence || 60 });
      }
    }
  }

  // Devil's Advocate
  const da = agentResult?.agents?.devilsAdvocate;
  if (da?.matchResult) {
    votes.push({ agentName: 'devils', market: 'mr', prediction: normalizePred(da.matchResult), confidence: da.confidence || 50 });
  }

  // Smart Analysis
  if (smartResult) {
    if (smartResult.matchResult?.prediction) votes.push({ agentName: 'smart', market: 'mr', prediction: normalizePred(smartResult.matchResult.prediction), confidence: smartResult.matchResult.confidence || 55 });
    if (smartResult.overUnder?.prediction) votes.push({ agentName: 'smart', market: 'ou', prediction: normalizePred(smartResult.overUnder.prediction), confidence: smartResult.overUnder.confidence || 55 });
    if (smartResult.btts?.prediction) votes.push({ agentName: 'smart', market: 'btts', prediction: normalizePred(smartResult.btts.prediction), confidence: smartResult.btts.confidence || 55 });
  }

  // AutoLearn
  if (autoLearnResults && autoLearnResults.length > 0) {
    for (const alr of autoLearnResults) {
      if (alr.market && alr.prediction && alr.reliability !== 'insufficient') {
        votes.push({ agentName: 'autolearn', market: alr.market, prediction: normalizePred(alr.prediction), confidence: alr.autoLearnScore || alr.adjustedConfidence || 50 });
      }
    }
  }

  // Consensus (mevcut sistem tahmini)
  if (consensusPredictions) {
    if (consensusPredictions.matchResult?.prediction) votes.push({ agentName: 'consensus', market: 'mr', prediction: normalizePred(consensusPredictions.matchResult.prediction), confidence: consensusPredictions.matchResult.confidence || 55 });
    if (consensusPredictions.overUnder?.prediction) votes.push({ agentName: 'consensus', market: 'ou', prediction: normalizePred(consensusPredictions.overUnder.prediction), confidence: consensusPredictions.overUnder.confidence || 55 });
    if (consensusPredictions.btts?.prediction) votes.push({ agentName: 'consensus', market: 'btts', prediction: normalizePred(consensusPredictions.btts.prediction), confidence: consensusPredictions.btts.confidence || 55 });
  }

  return votes;
}

// ============================================================================
// CERTAINTY SCORE
// ============================================================================

interface CertaintyResult {
  winningPrediction: string;
  certainty: number;
  avgConfidence: number;
  agreeCount: number;
  totalVoters: number;
}

function calculateCertaintyScore(market: 'mr' | 'ou' | 'btts', allVotes: AgentVote[]): CertaintyResult {
  const votes = allVotes.filter(v => v.market === market);
  if (votes.length === 0) {
    return { winningPrediction: '', certainty: 0, avgConfidence: 0, agreeCount: 0, totalVoters: 0 };
  }

  // Her seçenek için oy topla
  const tally: Record<string, { count: number; totalConf: number }> = {};
  for (const v of votes) {
    if (!v.prediction) continue;
    if (!tally[v.prediction]) tally[v.prediction] = { count: 0, totalConf: 0 };
    tally[v.prediction].count++;
    tally[v.prediction].totalConf += v.confidence;
  }

  // En çok oy alan seçeneği bul
  let winner = '';
  let maxScore = 0;
  for (const [pred, data] of Object.entries(tally)) {
    // Kesinlik = oy sayısı × ortalama confidence
    const score = data.count * (data.totalConf / data.count);
    if (score > maxScore) {
      maxScore = score;
      winner = pred;
    }
  }

  const winnerData = tally[winner] || { count: 0, totalConf: 0 };
  const avgConf = winnerData.count > 0 ? winnerData.totalConf / winnerData.count : 0;

  return {
    winningPrediction: winner,
    certainty: maxScore,
    avgConfidence: avgConf,
    agreeCount: winnerData.count,
    totalVoters: votes.length,
  };
}

// ============================================================================
// REASONING BUILDER
// ============================================================================

function buildReasoning(
  market: string,
  selection: string,
  agreeCount: number,
  totalVoters: number,
  confidence: number,
  ownPred: MarketPrediction,
  risk: string
): string {
  const parts: string[] = [];

  // Ajan konsensüsü
  const ratio = totalVoters > 0 ? agreeCount / totalVoters : 0;
  if (ratio >= 0.85) {
    parts.push(`${agreeCount}/${totalVoters} ajan aynı yöne işaret ediyor. Tartışmaya yer yok.`);
  } else if (ratio >= 0.65) {
    parts.push(`${agreeCount}/${totalVoters} ajan bu yönde. Çoğunluk net.`);
  } else {
    parts.push(`${agreeCount}/${totalVoters} ajan bu yönde. Görüş ayrılığı var, dikkatli ol.`);
  }

  // Tarihsel destek
  if (ownPred.sampleSize >= 20) {
    parts.push(`${ownPred.sampleSize} benzer maçın %${ownPred.probability}'${vowelSuffix(ownPred.probability)} bu sonucu veriyor.`);
  } else if (ownPred.sampleSize >= 5) {
    parts.push(`${ownPred.sampleSize} benzer maç bulundu ama veri az.`);
  }

  // Risk uyarısı
  if (risk === 'yuksek') {
    parts.push('Veri az veya ajanlar bölünmüş. RİSK YÜKSEK.');
  }

  // Son söz
  if (confidence >= 70) {
    parts.push('Güven yüksek. Karar verildi.');
  } else if (confidence >= 55) {
    parts.push('Makul güven. Dikkatli oyna.');
  }

  return parts.join(' ');
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
  // Basit Türkçe ünlü uyumu: %68'i vs %71'i
  const lastDigit = num % 10;
  if ([1, 2, 7, 8].includes(lastDigit)) return 'i';
  if ([3, 4, 5].includes(lastDigit)) return 'ü';
  if ([6, 9, 0].includes(lastDigit)) return 'u';
  return 'i';
}
