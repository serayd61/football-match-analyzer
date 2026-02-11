// ============================================================================
// SURVIVAL AGENT - "Hayatta Kal"
// Otonom tahmin ajanı. İki görevi var:
// 1. predict(): Tarihsel verilerden kendi istatistiksel tahminini üretir
// 2. verdict(): Tüm ajanların çıktısını + kendi analizini alıp TEK SONUÇ verir
// ============================================================================

import { getHistoricalData, type HistoricalData } from './historical-engine';
import { findSimilarMatches, type MatchFingerprint } from './similarity';
import { generatePrediction, type SurvivalPrediction } from './predictor';
import { generateVerdict, type SurvivalVerdict } from './verdict';

export type { SurvivalPrediction } from './predictor';
export type { SurvivalVerdict } from './verdict';

// ============================================================================
// PREDICT - Kendi tarihsel analizi
// ============================================================================

export interface SurvivalInput {
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  homeFormPoints?: number;
  awayFormPoints?: number;
}

export async function predict(input: SurvivalInput): Promise<SurvivalPrediction> {
  const startTime = Date.now();

  console.log(`\n🔫 SURVIVAL AGENT: ${input.homeTeam} vs ${input.awayTeam} (${input.league})`);

  // 1. Tarihsel veri çek
  const historicalData = await getHistoricalData(input.league, input.homeTeam, input.awayTeam);

  console.log(`   📊 Data: ${historicalData.allMatches.length} total settled, ${historicalData.leagueProfile?.totalMatches || 0} league, ${historicalData.h2hMatches.length} H2H`);

  // 2. Parmak izi oluştur
  const fingerprint: MatchFingerprint = {
    league: input.league,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
    homeFormPoints: input.homeFormPoints,
    awayFormPoints: input.awayFormPoints,
  };

  // 3. Benzer maçları bul
  const similarMatches = findSimilarMatches(fingerprint, historicalData.allMatches, 50);

  console.log(`   🔍 Similar matches: ${similarMatches.length} found`);

  // 4. Tahmin üret
  const prediction = generatePrediction(similarMatches, historicalData, input.homeTeam, input.awayTeam);

  const elapsed = Date.now() - startTime;
  console.log(`   🎯 MR: ${prediction.matchResult.prediction} (%${prediction.matchResult.confidence}) | OU: ${prediction.overUnder.prediction} (%${prediction.overUnder.confidence}) | BTTS: ${prediction.btts.prediction} (%${prediction.btts.confidence})`);
  console.log(`   ⏱️ Completed in ${elapsed}ms`);

  return prediction;
}

// ============================================================================
// VERDICT - Tüm ajanları istişare edip TEK SONUÇ
// ============================================================================

export interface VerdictInput {
  ownPrediction: SurvivalPrediction;
  agentResult: any;           // AgentAnalysisResult
  smartResult: any;           // SmartAnalysisResult
  autoLearnResults: any[];    // AutoLearnPredictResult[]
  consensusPredictions: any;  // Consensus predictions
}

export function verdict(input: VerdictInput): SurvivalVerdict | null {
  console.log(`\n🔫 SURVIVAL VERDICT: İstişare başlıyor...`);

  const result = generateVerdict(
    input.ownPrediction,
    input.agentResult,
    input.smartResult,
    input.autoLearnResults,
    input.consensusPredictions
  );

  // Ajan karar veremedi → sessiz kal, tutarsız sonuç verme
  if (!result) {
    console.log(`   💀 AJAN ÖLÜ: Yeterli sinyal yok. Tahmin verilmedi. PAS.`);
    return null;
  }

  console.log(`   ⚡ TEK SONUÇ: ${result.market} → ${result.selection} (${result.selectionLabel})`);
  console.log(`   📊 Güven: %${result.confidence} | ${result.agentAgreement} | Risk: ${result.riskLevel}`);
  console.log(`   💬 ${result.reasoning}`);

  return result;
}
