import { aiClient, AIMessage } from '../../ai-client';
import { MatchData } from '../types';
import { fetchHistoricalOdds, analyzeSharpMoney, analyzeBettingVolume, isRealValue, MatchOddsHistory, SharpMoneyResult, BettingVolumeResult, RealValueResult } from '../sportmonks-odds';
import { getLearningContext } from '../../ai-brain/learning-context';

// ==================== JSON EXTRACTION ====================

function extractJSON(text: string): any | null {
  if (!text) return null;
  
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\*\*/g, '')
    .trim();
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  
  let jsonStr = jsonMatch[0];
  
  // Fix common JSON errors
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1'); // trailing commas
  jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // unquoted keys
  jsonStr = jsonStr.replace(/'/g, '"'); // single quotes to double
  jsonStr = jsonStr.replace(/\n/g, ' '); // newlines to spaces
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // control characters
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Manual extraction fallback for odds agent
    try {
      const result: any = {};
      
      const oddsMatch = jsonStr.match(/"oddsAnalysis"\s*:\s*"([^"]+)"/);
      result.oddsAnalysis = oddsMatch ? oddsMatch[1] : 'Analysis unavailable';
      
      const recMatch = jsonStr.match(/"recommendation"\s*:\s*"?(Over|Under)"?/i);
      result.recommendation = recMatch ? recMatch[1] : 'Under';
      
      const confMatch = jsonStr.match(/"confidence"\s*:\s*([\d.]+)/);
      result.confidence = confMatch ? parseInt(confMatch[1]) : 65;
      
      const mwMatch = jsonStr.match(/"matchWinnerValue"\s*:\s*"?(home|away|draw)"?/i);
      result.matchWinnerValue = mwMatch ? mwMatch[1].toLowerCase() : 'home';
      
      const bttsMatch = jsonStr.match(/"bttsValue"\s*:\s*"?(yes|no)"?/i);
      result.bttsValue = bttsMatch ? bttsMatch[1].toLowerCase() : 'no';
      
      const recReasonMatch = jsonStr.match(/"recommendationReasoning"\s*:\s*"([^"]+)"/);
      result.recommendationReasoning = recReasonMatch ? recReasonMatch[1] : '';
      
      const mwReasonMatch = jsonStr.match(/"matchWinnerReasoning"\s*:\s*"([^"]+)"/);
      result.matchWinnerReasoning = mwReasonMatch ? mwReasonMatch[1] : '';
      
      const bttsReasonMatch = jsonStr.match(/"bttsReasoning"\s*:\s*"([^"]+)"/);
      result.bttsReasoning = bttsReasonMatch ? bttsReasonMatch[1] : '';
      
      console.log('⚠️ Odds Agent: JSON parse failed, using manual extraction');
      return result;
    } catch (e2) {
      console.error('❌ Odds Agent: Manual extraction also failed');
      return null;
    }
  }
}

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen DÜNYA ÇAPINDA TANINMIŞ bir bahis oranları analisti ve market inefficiency uzmanısın. 15+ yıllık deneyiminle piyasaları derinlemesine analiz ediyorsun.

🎯 GÖREV: Tüm marketlerde (1X2, Over/Under, BTTS, Asian Handicap, Correct Score, HT/FT, Corners, Cards) yaratıcı ve derinlemesine value bet tespit et.

🧠 YARATICI ANALİZ YAKLAŞIMIN:

1. MARKET INEFFICIENCY TESPİTİ (EN ÖNEMLİ):
   - Piyasa duygusal faktörlerle (taraftar baskısı, medya etkisi) yanlış fiyatlamış olabilir
   - "Contrarian" yaklaşım: Herkes bir tarafa gidiyorsa, sen tersini düşün
   - Public money vs Sharp money ayrımı yap
   - Overreaction tespiti: Son maç sonuçlarına aşırı tepki var mı?
   - Underreaction tespiti: Yavaş değişen trendler piyasada yansınmamış olabilir

2. PSİKOLOJİK VE DUYGUSAL FAKTÖRLER:
   - Ev sahibi takım taraftar baskısı altında mı? (Overperform/Underperform)
   - Deplasman takımı "nothing to lose" mentalitesinde mi? (Daha agresif oynar)
   - Maçın önemi (derbi, şampiyonluk, küme düşme) oranları nasıl etkilemiş?
   - Son maçlardaki dramatik sonuçlar piyasayı etkilemiş mi?

3. TAKTİKSEL VE STRATEJİK DEĞERLENDİRME:
   - Takımların beklenen taktik yaklaşımı oranları nasıl etkilemeli?
   - Defansif takım + Yüksek gol beklentisi = Contrarian value (Under düşün)
   - Ofansif takım + Düşük gol beklentisi = Contrarian value (Over düşün)
   - H2H'da takımlar birbirini iyi tanıyor mu? (Daha az gol, daha dengeli)

4. ZAMANLAMA VE MOMENTUM ANALİZİ:
   - Oranlar ne zaman açıldı? (Erken açılan oranlar daha güvenilir)
   - Son 24 saatte ne kadar hareket var? (Aşırı hareket = duygusal tepki)
   - Sharp money ne zaman geldi? (Son dakika sharp money = güçlü sinyal)
   - Oran düşüşü hızlandı mı yavaşladı mı? (Hızlanan düşüş = güçlü sharp money)

5. YARATICI VALUE BET TESPİTİ:
   - Implied probability = (1 / oran) * 100
   - Form olasılığı = İstatistiksel analiz + Taktiksel değerlendirme + Psikolojik faktörler
   - Value = Form olasılığı - Implied olasılığı
   - %5+ fark = Value VAR
   - %10+ fark = GÜÇLÜ value
   - %15+ fark = ÇOK GÜÇLÜ value
   - %20+ fark = EXTREME value (ama dikkat - piyasa neden bu kadar yanlış?)

6. CONTRARIAN DÜŞÜNCE:
   - Herkes Over diyorsa, Under'ı düşün (piyasa overreaction olabilir)
   - Favori çok düşük oranda mı? (Value yok, ama contrarian draw/away düşün)
   - Public %80+ bir tarafa mı gidiyor? (Sharp money tersine gidebilir)
   - Son maçta 5-0 kazanan takım favori mi? (Overreaction riski)

7. SHARP MONEY VE MARKET SİNYALLERİ:
   - Sharp money = Büyük bahisçilerin hareketleri (en önemli sinyal)
   - Oran düşüşü + Form desteği + Contrarian yaklaşım = GERÇEK VALUE
   - Oran yükseliyor ama form value gösteriyor = Public money karşıtı, sharp money bekle
   - Oran stabil ama form value gösteriyor = Value VAR ama sharp money henüz gelmedi

8. YARATICI MARKET ANALİZİ:
   - Asian Handicap: Piyasa hangi takımı kaç gol farkla favori görüyor? Sen farklı mı düşünüyorsun?
   - Correct Score: En olası skorlar piyasada doğru fiyatlanmış mı? Alternatif skorlar value var mı?
   - HT/FT: İlk yarı yavaş başlayıp ikinci yarı patlama pattern'i var mı? (X/1, X/2 value)
   - Corners: Ofansif takımlar ama düşük korner beklentisi = Contrarian value
   - Cards: Derbi ama düşük kart beklentisi = Contrarian value (hakem analizi önemli)

💡 GÜVEN SEVİYESİ (YARATICI YAKLAŞIM):
- Sharp money onaylı + Contrarian yaklaşım + Güçlü form desteği → %80-88 güven
- Sharp money onaylı value → %75-85 güven
- Contrarian value (public karşıtı) + Form desteği → %70-80 güven
- Net value var (10%+) → %65-75 güven
- Orta value (5-10%) → %60-70 güven
- Belirsiz ama yaratıcı yaklaşım → %55-65 güven
- Value yok → %50-55 güven

🎨 YARATICI İÇGÖRÜLER:
- Market psychology: Piyasa hangi duygusal faktörlerle hareket ediyor?
- Hidden value: Görünmeyen ama değerli marketler neler? (Örn: Draw no bet, double chance)
- Timing edge: Oranlar ne zaman en değerli? (Erken mi geç mi bahis yapılmalı?)
- Risk/reward: Yüksek risk ama yüksek reward bahisler var mı? (Correct score, HT/FT)
- Portfolio approach: Birden fazla markette küçük value'lar mı, tek markette büyük value mu?

JSON DÖNDÜR (YARATICI VE DERİNLEMESİNE):
{
  "oddsAnalysis": "Yaratıcı ve derinlemesine oran analizi - market inefficiency, contrarian yaklaşım, psikolojik faktörler dahil",
  "marketPsychology": "Piyasanın duygusal durumu ve overreaction/underreaction tespiti",
  "contrarianInsights": ["Contrarian yaklaşım 1", "Contrarian yaklaşım 2"],
  "recommendation": "Over veya Under",
  "recommendationReasoning": "💰 YARATICI ANALİZ: Over 2.5 oranı X.XX = %XX implied. Form analizi %XX veriyor ama piyasa [psikolojik faktör] nedeniyle yanlış fiyatlamış. VALUE: +X%. [Contrarian yaklaşım açıklaması]",
  "confidence": 72,
  "matchWinnerValue": "home veya draw veya away",
  "matchWinnerReasoning": "💰 YARATICI ANALİZ: Ev oranı X.XX = %XX implied. Form %XX gösteriyor. Piyasa [neden] nedeniyle [overreaction/underreaction]. VALUE: +X%. [Sharp money/Contrarian açıklama]",
  "bttsValue": "yes veya no",
  "bttsReasoning": "💰 YARATICI ANALİZ: KG Var oranı 1.8 = %56 implied. İstatistik %40 ama [taktiksel/psikolojik faktör] nedeniyle gerçek olasılık farklı. [Açıklama]",
  "asianHandicap": {
    "recommendation": "-0.5 Home veya +0.5 Away",
    "confidence": 68,
    "reasoning": "Yaratıcı handikap analizi - piyasa beklentisi vs gerçek fark",
    "marketExpectation": "Piyasa X gol fark bekliyor",
    "actualExpectation": "Gerçekte Y gol fark olmalı",
    "value": "Handikap value açıklaması"
  },
  "correctScore": {
    "mostLikely": "1-1",
    "second": "2-1",
    "third": "1-0",
    "confidence": 55,
    "valueScores": [
      {"score": "2-1", "value": 12, "reasoning": "Piyasa %8 veriyor ama gerçek olasılık %12"},
      {"score": "1-1", "value": 8, "reasoning": "Dengeli maç, draw value var"}
    ]
  },
  "htftPrediction": {
    "prediction": "X/1",
    "confidence": 60,
    "reasoning": "Yaratıcı HT/FT analizi - timing pattern ve taktiksel yaklaşım",
    "value": "HT/FT value açıklaması"
  },
  "cornersAnalysis": {
    "totalCorners": "Over 9.5",
    "confidence": 65,
    "reasoning": "Yaratıcı korner analizi - ofansif yaklaşım vs defansif organizasyon",
    "contrarianView": "Piyasa düşük bekliyor ama [neden] nedeniyle yüksek olmalı"
  },
  "cardsAnalysis": {
    "totalCards": "Over 3.5",
    "confidence": 62,
    "reasoning": "Yaratıcı kart analizi - hakem, maç önemi, takımların agresiflik seviyesi",
    "refereeImpact": "Hakem [özellik] nedeniyle [etki]"
  },
  "valueRating": "Düşük/Orta/Yüksek/Extreme",
  "valueBets": [
    {
      "market": "Over/Under 2.5",
      "selection": "Over",
      "value": 12,
      "reasoning": "Yaratıcı value bet açıklaması",
      "contrarian": true,
      "sharpMoney": true
    }
  ],
  "hiddenValue": [
    {"market": "Draw No Bet", "selection": "Home", "value": 8, "reasoning": "Gizli value açıklaması"},
    {"market": "Double Chance", "selection": "1X", "value": 6, "reasoning": "Güvenli value açıklaması"}
  ],
  "marketInefficiency": {
    "detected": true,
    "type": "Overreaction/Underreaction/Emotional pricing",
    "explanation": "Piyasa neden yanlış fiyatlamış?",
    "exploitation": "Bu inefficiency nasıl kullanılabilir?"
  },
  "portfolioApproach": {
    "recommended": true,
    "bets": [
      {"market": "Over 2.5", "stake": "3%", "value": 12},
      {"market": "BTTS Yes", "stake": "2%", "value": 8},
      {"market": "Correct Score 2-1", "stake": "1%", "value": 15}
    ],
    "totalStake": "6%",
    "reasoning": "Portfolio yaklaşımı açıklaması"
  },
  "agentSummary": "💰 ODDS (YARATICI): [Market inefficiency tespiti] + [Contrarian yaklaşım] + [Sharp money] → [En değerli marketler ve nedenleri]"
}`,

  en: `You are a PROFESSIONAL betting odds and value bet analyst. Compare odds with form data to detect VALUE.

🎯 TASK: Detect value bets across ALL markets (1X2, Over/Under, BTTS, Asian Handicap, Correct Score, HT/FT, Corners, Cards).

💰 VALUE BET CALCULATION:
- Implied probability = (1 / odds) * 100
- Value = Form probability - Implied probability
- 5%+ difference = VALUE EXISTS
- 10%+ difference = STRONG VALUE
- 15%+ difference = VERY STRONG VALUE

📊 ODDS MOVEMENT (CRITICAL):
- Odds DROPPING + Form shows value → REAL VALUE (sharp money detected)
- Odds RISING + Form shows value → CAUTION (market against)
- Odds STABLE + Form shows value → Value exists but be careful

🔍 SHARP MONEY DETECTION:
- Sharp money = Big bettors' movements
- Odds drop + Form support = Sharp money confirmation
- If sharp money confirmed, boost confidence by +8-12 points

💡 CONFIDENCE LEVELS:
- Sharp money confirmed value → 75-85% confidence
- Strong value (10%+) → 65-75% confidence
- Medium value (5-10%) → 60-70% confidence
- Unclear → 55-65% confidence
- No value → 50-55% confidence

RETURN JSON with all market analyses including asianHandicap, correctScore, htftPrediction, cornersAnalysis, cardsAnalysis.`,

  de: `Du bist ein PROFESSIONELLER Quoten-Analyst. Analysiere ALLE Märkte für VALUE.

ANALYSE-MÄRKTE:
1. 1X2 (Spielergebnis)
2. Over/Under 2.5
3. BTTS
4. ASIAN HANDICAP
5. CORRECT SCORE
6. HT/FT
7. CORNERS/CARDS

NUR JSON ZURÜCKGEBEN mit allen Marktanalysen.`,
};

// ==================== VALUE CALCULATION ====================

function calculateImpliedProbability(odds: number): number {
  if (!odds || odds <= 1) return 50;
  return Math.round((1 / odds) * 100);
}

function calculateValue(impliedProb: number, actualProb: number): number {
  return Math.round(actualProb - impliedProb);
}

function getValueRating(maxValue: number, hasSharpConfirmation: boolean = false): string {
  // Sharp money onayı varsa rating'i yükselt
  const boost = hasSharpConfirmation ? 5 : 0;
  const adjustedValue = maxValue + boost;
  
  if (adjustedValue >= 15) return 'High';
  if (adjustedValue >= 8) return 'Medium';
  if (adjustedValue >= 3) return 'Low';
  return 'None';
}

// ==================== ASIAN HANDICAP ANALYSIS ====================

interface AsianHandicapAnalysis {
  recommendation: string;
  confidence: number;
  reasoning: string;
  homeHandicap: number;
  awayHandicap: number;
}

function analyzeAsianHandicap(
  homeFormProb: number,
  awayFormProb: number,
  expectedTotal: number,
  homeOdds: number,
  awayOdds: number,
  language: 'tr' | 'en' | 'de'
): AsianHandicapAnalysis {
  // Form farkına göre handikap hesapla
  const probDiff = homeFormProb - awayFormProb;
  
  let homeHandicap = 0;
  let awayHandicap = 0;
  let recommendation = '';
  let confidence = 55;
  
  // Handikap belirleme
  if (probDiff > 25) {
    homeHandicap = -1.5;
    awayHandicap = 1.5;
    recommendation = language === 'tr' ? `${homeHandicap} Ev Sahibi` : `${homeHandicap} Home`;
    confidence = 65;
  } else if (probDiff > 15) {
    homeHandicap = -1;
    awayHandicap = 1;
    recommendation = language === 'tr' ? `${homeHandicap} Ev Sahibi` : `${homeHandicap} Home`;
    confidence = 68;
  } else if (probDiff > 8) {
    homeHandicap = -0.5;
    awayHandicap = 0.5;
    recommendation = language === 'tr' ? `${homeHandicap} Ev Sahibi` : `${homeHandicap} Home`;
    confidence = 70;
  } else if (probDiff > -8) {
    homeHandicap = 0;
    awayHandicap = 0;
    recommendation = language === 'tr' ? '0 Ev Sahibi (DNB)' : '0 Home (DNB)';
    confidence = 60;
  } else if (probDiff > -15) {
    homeHandicap = 0.5;
    awayHandicap = -0.5;
    recommendation = language === 'tr' ? `+${homeHandicap} Ev Sahibi` : `+${homeHandicap} Home`;
    confidence = 65;
  } else {
    homeHandicap = 1;
    awayHandicap = -1;
    recommendation = language === 'tr' ? `+${homeHandicap} Ev Sahibi` : `+${homeHandicap} Home`;
    confidence = 60;
  }
  
  const reasoningTexts = {
    tr: `Form farkı %${probDiff.toFixed(0)}. ${homeHandicap < 0 ? 'Ev sahibi favori' : homeHandicap > 0 ? 'Deplasman favori' : 'Dengeli maç'}. AH ${recommendation} önerisi.`,
    en: `Form difference ${probDiff.toFixed(0)}%. ${homeHandicap < 0 ? 'Home favored' : homeHandicap > 0 ? 'Away favored' : 'Balanced match'}. AH ${recommendation} recommended.`,
    de: `Formunterschied ${probDiff.toFixed(0)}%. AH ${recommendation} empfohlen.`
  };
  
  return {
    recommendation,
    confidence,
    reasoning: reasoningTexts[language],
    homeHandicap,
    awayHandicap
  };
}

// ==================== CORRECT SCORE PREDICTION ====================

interface CorrectScorePrediction {
  mostLikely: string;
  second: string;
  third: string;
  confidence: number;
  scores: { score: string; probability: number }[];
}

function predictCorrectScore(
  homeExpected: number,
  awayExpected: number,
  matchResultPrediction: string,
  language: 'tr' | 'en' | 'de'
): CorrectScorePrediction {
  // Poisson dağılımı basit yaklaşımı
  const scores: { score: string; probability: number }[] = [];
  
  // En olası skorları hesapla
  for (let home = 0; home <= 4; home++) {
    for (let away = 0; away <= 4; away++) {
      // Basit olasılık hesabı
      let prob = 10;
      
      // Beklenen goller yakınsa olasılık artır
      if (Math.abs(home - homeExpected) < 0.5) prob += 15;
      if (Math.abs(away - awayExpected) < 0.5) prob += 15;
      if (Math.abs(home - homeExpected) < 1) prob += 8;
      if (Math.abs(away - awayExpected) < 1) prob += 8;
      
      // Maç sonucu tahminiyle uyumlu skorlara bonus
      if (matchResultPrediction === '1' && home > away) prob += 10;
      if (matchResultPrediction === '2' && away > home) prob += 10;
      if (matchResultPrediction === 'X' && home === away) prob += 15;
      
      // Aşırı skorları cezalandır
      if (home > 3) prob -= 15;
      if (away > 3) prob -= 15;
      if (home + away > 5) prob -= 10;
      
      scores.push({ score: `${home}-${away}`, probability: Math.max(1, prob) });
    }
  }
  
  // Olasılığa göre sırala
  scores.sort((a, b) => b.probability - a.probability);
  
  // Normalize et
  const total = scores.slice(0, 10).reduce((sum, s) => sum + s.probability, 0);
  scores.forEach(s => s.probability = Math.round((s.probability / total) * 100));
  
  return {
    mostLikely: scores[0].score,
    second: scores[1].score,
    third: scores[2].score,
    confidence: Math.min(60, scores[0].probability + 10),
    scores: scores.slice(0, 6)
  };
}

// ==================== HT/FT PREDICTION ====================

interface HTFTPrediction {
  prediction: string;
  confidence: number;
  reasoning: string;
}

function predictHTFT(
  homeFormProb: number,
  awayFormProb: number,
  homeFirstHalfPct: number,
  awayFirstHalfPct: number,
  matchResultPrediction: string,
  language: 'tr' | 'en' | 'de'
): HTFTPrediction {
  // İlk yarı tahmini
  let htResult = 'X';
  let ftResult = matchResultPrediction;
  let confidence = 50;
  
  // İlk yarı analizi
  if (homeFirstHalfPct > 55 && homeFormProb > awayFormProb + 10) {
    htResult = '1';
    confidence += 5;
  } else if (awayFirstHalfPct > 55 && awayFormProb > homeFormProb + 10) {
    htResult = '2';
    confidence += 5;
  } else {
    htResult = 'X'; // İlk yarı genellikle berabere
    confidence += 8; // X/X veya X/1 veya X/2 daha olası
  }
  
  const prediction = `${htResult}/${ftResult}`;
  
  // Confidence ayarlama
  if (htResult === 'X' && ftResult !== 'X') {
    confidence = 55; // Yavaş başlayıp sonra kazanmak yaygın
  } else if (htResult === ftResult) {
    confidence = 45; // Aynı sonuç devam etmek daha zor
  }
  
  const reasoningTexts = {
    tr: {
      'X/1': 'İlk yarı yavaş başlangıç, ikinci yarı ev sahibi baskısı bekleniyor',
      'X/2': 'İlk yarı dengeli, ikinci yarı deplasman kontra atakları etkili',
      'X/X': 'Düşük gollü, dengeli bir maç bekleniyor',
      '1/1': 'Ev sahibi erken gol bulup kontrol edecek',
      '2/2': 'Deplasman erken gol avantajını koruyacak',
      default: 'Form analizine göre HT/FT tahmini'
    },
    en: {
      'X/1': 'Slow start expected, home team pressure in 2nd half',
      'X/2': 'Balanced 1st half, away counter-attacks effective later',
      'X/X': 'Low-scoring, balanced match expected',
      '1/1': 'Home to score early and control',
      '2/2': 'Away to hold early goal advantage',
      default: 'HT/FT prediction based on form analysis'
    },
    de: {
      'X/1': 'Langsamer Start, Heimdruck in 2. Hälfte erwartet',
      'X/2': 'Ausgewogene 1. Hälfte, Auswärts-Konter später effektiv',
      'X/X': 'Torarmes, ausgeglichenes Spiel erwartet',
      '1/1': 'Heim trifft früh und kontrolliert',
      '2/2': 'Auswärts hält frühen Torvorsprung',
      default: 'HT/FT Vorhersage basierend auf Formanalyse'
    }
  };
  
  const texts = reasoningTexts[language];
  const reasoning = (texts as any)[prediction] || texts.default;
  
  return { prediction, confidence, reasoning };
}

// ==================== CORNERS/CARDS ANALYSIS ====================

interface CornersCardsAnalysis {
  totalCorners: string;
  cornersConfidence: number;
  cornersReasoning: string;
  totalCards: string;
  cardsConfidence: number;
  cardsReasoning: string;
}

function analyzeCornersAndCards(
  homeFormProb: number,
  awayFormProb: number,
  expectedTotal: number,
  isHighStakes: boolean,
  language: 'tr' | 'en' | 'de'
): CornersCardsAnalysis {
  // Korner analizi - ofansif takımlar daha fazla korner üretir
  const avgCorners = 9.5; // Ortalama maç korner sayısı
  let expectedCorners = avgCorners;
  
  // Gol beklentisi yüksekse korner de yüksek
  if (expectedTotal > 2.8) expectedCorners += 1.5;
  else if (expectedTotal < 2.2) expectedCorners -= 1;
  
  // Favori varsa daha fazla korner
  if (Math.abs(homeFormProb - awayFormProb) > 20) expectedCorners += 1;
  
  const cornersLine = expectedCorners > 10.5 ? 'Over 10.5' : expectedCorners > 9 ? 'Over 9.5' : 'Under 9.5';
  const cornersConfidence = Math.abs(expectedCorners - 9.5) > 1.5 ? 68 : 58;
  
  // Kart analizi
  let expectedCards = 3.5; // Ortalama
  
  // Yüksek riskli maçlarda (derbi, şampiyonluk, küme düşme) daha fazla kart
  if (isHighStakes) expectedCards += 1;
  
  // Dengeli maçlarda daha fazla mücadele = daha fazla kart
  if (Math.abs(homeFormProb - awayFormProb) < 10) expectedCards += 0.5;
  
  const cardsLine = expectedCards > 4 ? 'Over 4.5' : expectedCards > 3.5 ? 'Over 3.5' : 'Under 3.5';
  const cardsConfidence = isHighStakes ? 65 : 55;
  
  const reasoningTexts = {
    tr: {
      corners: expectedCorners > 10 ? 'Ofansif takımlar, yüksek korner potansiyeli' : 'Dengeli maç, ortalama korner beklentisi',
      cards: isHighStakes ? 'Yüksek riskli maç, sert müdahaleler bekleniyor' : 'Normal lig maçı, standart kart beklentisi'
    },
    en: {
      corners: expectedCorners > 10 ? 'Offensive teams, high corner potential' : 'Balanced match, average corner expectation',
      cards: isHighStakes ? 'High stakes match, hard tackles expected' : 'Regular league match, standard card expectation'
    },
    de: {
      corners: expectedCorners > 10 ? 'Offensive Teams, hohes Eckenpotenzial' : 'Ausgeglichenes Spiel, durchschnittliche Eckenerwartung',
      cards: isHighStakes ? 'Hochrisikospiel, harte Tacklings erwartet' : 'Reguläres Ligaspiel, Standard-Kartenerwartung'
    }
  };
  
  return {
    totalCorners: cornersLine,
    cornersConfidence,
    cornersReasoning: reasoningTexts[language].corners,
    totalCards: cardsLine,
    cardsConfidence,
    cardsReasoning: reasoningTexts[language].cards
  };
}

// ==================== TUTARLILIK KONTROLÜ ====================

function checkConsistency(
  matchData: MatchData,
  homeFormProb: number,
  awayFormProb: number,
  overProb: number,
  bttsProb: number,
  recommendation: string,
  matchWinnerValue: string,
  bttsValue: string,
  language: 'tr' | 'en' | 'de'
): {
  recommendation: string;
  matchWinnerValue: string;
  bttsValue: string;
  consistencyWarnings: string[];
} {
  const consistencyWarnings: string[] = [];
  let adjustedRecommendation = recommendation;
  let adjustedMatchWinnerValue = matchWinnerValue;
  let adjustedBttsValue = bttsValue;
  
  // Gol istatistiklerini al
  const homeGoals = parseFloat(matchData.homeForm?.avgGoals || '1.2');
  const awayGoals = parseFloat(matchData.awayForm?.avgGoals || '1.0');
  const totalExpectedGoals = homeGoals + awayGoals;
  
  const homeScoredRecent = (matchData.homeForm?.form || '').split('').filter(c => c === 'W' || c === 'D').length;
  const awayScoredRecent = (matchData.awayForm?.form || '').split('').filter(c => c === 'W' || c === 'D').length;
  
  // 1. "KG Yok" ama her iki takım da gol atma potansiyeline sahipse
  if (adjustedBttsValue === 'no' || adjustedBttsValue === 'No') {
    if (homeGoals > 0.8 && awayGoals > 0.8) {
      // Her iki takım da gol atma potansiyeline sahip
      adjustedBttsValue = language === 'tr' ? 'yes' : 'Yes';
      consistencyWarnings.push(language === 'tr' 
        ? `⚠️ TUTARLILIK: Ev beklenen gol ${homeGoals.toFixed(1)}, Dep beklenen gol ${awayGoals.toFixed(1)} ama "KG Yok" önerildi. "KG Var" olarak düzeltildi.`
        : `⚠️ CONSISTENCY: Home expected goals ${homeGoals.toFixed(1)}, Away expected goals ${awayGoals.toFixed(1)} but "BTTS No" recommended. Changed to "BTTS Yes".`);
    }
    
    // Son maçlarda her iki takım da gol atmışsa
    if (homeScoredRecent >= 3 && awayScoredRecent >= 3) {
      adjustedBttsValue = language === 'tr' ? 'yes' : 'Yes';
      consistencyWarnings.push(language === 'tr'
        ? `⚠️ TUTARLILIK: Son maçlarda her iki takım da gol atmış (Ev ${homeScoredRecent}/5, Dep ${awayScoredRecent}/5) ama "KG Yok" önerildi. "KG Var" olarak düzeltildi.`
        : `⚠️ CONSISTENCY: Both teams scored recently (Home ${homeScoredRecent}/5, Away ${awayScoredRecent}/5) but "BTTS No" recommended. Changed to "BTTS Yes".`);
    }
  }
  
  // 2. "KG Var" ama düşük gol beklentisi varsa
  if (adjustedBttsValue === 'yes' || adjustedBttsValue === 'Yes') {
    if (homeGoals < 0.5 && awayGoals < 0.5) {
      adjustedBttsValue = language === 'tr' ? 'no' : 'No';
      consistencyWarnings.push(language === 'tr'
        ? `⚠️ TUTARLILIK: Düşük gol beklentisi (Ev ${homeGoals.toFixed(1)}, Dep ${awayGoals.toFixed(1)}) ama "KG Var" önerildi. "KG Yok" olarak düzeltildi.`
        : `⚠️ CONSISTENCY: Low expected goals (Home ${homeGoals.toFixed(1)}, Away ${awayGoals.toFixed(1)}) but "BTTS Yes" recommended. Changed to "BTTS No".`);
    }
  }
  
  // 3. "2.5 Under" ama yüksek gol beklentisi varsa
  if (adjustedRecommendation === 'Under' || adjustedRecommendation === 'under') {
    if (totalExpectedGoals > 2.8) {
      adjustedRecommendation = 'Over';
      consistencyWarnings.push(language === 'tr'
        ? `⚠️ TUTARLILIK: Yüksek gol beklentisi (${totalExpectedGoals.toFixed(1)}) ama "2.5 Under" önerildi. "2.5 Over" olarak düzeltildi.`
        : `⚠️ CONSISTENCY: High expected goals (${totalExpectedGoals.toFixed(1)}) but "Under 2.5" recommended. Changed to "Over 2.5".`);
    }
  }
  
  // 4. "2.5 Over" ama düşük gol beklentisi varsa
  if (adjustedRecommendation === 'Over' || adjustedRecommendation === 'over') {
    if (totalExpectedGoals < 2.2) {
      adjustedRecommendation = 'Under';
      consistencyWarnings.push(language === 'tr'
        ? `⚠️ TUTARLILIK: Düşük gol beklentisi (${totalExpectedGoals.toFixed(1)}) ama "2.5 Over" önerildi. "2.5 Under" olarak düzeltildi.`
        : `⚠️ CONSISTENCY: Low expected goals (${totalExpectedGoals.toFixed(1)}) but "Over 2.5" recommended. Changed to "Under 2.5".`);
    }
  }
  
  // 5. Maç sonucu tahmini ile gol beklentisi tutarlı mı?
  if (adjustedMatchWinnerValue === 'home' || adjustedMatchWinnerValue === 'Home') {
    if (homeGoals < 0.7 && awayGoals > 1.2) {
      // Ev favori ama düşük gol atma, deplasman yüksek gol atma potansiyeli
      consistencyWarnings.push(language === 'tr'
        ? `⚠️ DİKKAT: Ev favori ama düşük gol atma potansiyeli (${homeGoals.toFixed(1)}), deplasman yüksek (${awayGoals.toFixed(1)}). Beraberlik veya deplasman düşünülmeli.`
        : `⚠️ WARNING: Home favorite but low scoring potential (${homeGoals.toFixed(1)}), away high (${awayGoals.toFixed(1)}). Consider draw or away.`);
    }
  }
  
  return {
    recommendation: adjustedRecommendation,
    matchWinnerValue: adjustedMatchWinnerValue,
    bttsValue: adjustedBttsValue,
    consistencyWarnings
  };
}

// ==================== REASONING GENERATOR ====================

interface OddsReasoning {
  bestValue: string;
  bestValueAmount: number;
  valueBets: string[];
  overUnderReasoning: string;
  matchWinnerReasoning: string;
  bttsReasoning: string;
  agentSummary: string;
  fullAnalysis: string;
}

function generateOddsReasoning(
  matchData: MatchData,
  homeOdds: number, drawOdds: number, awayOdds: number,
  overOdds: number, underOdds: number,
  bttsYesOdds: number, bttsNoOdds: number,
  homeFormProb: number, awayFormProb: number,
  overProb: number, bttsProb: number,
  language: 'tr' | 'en' | 'de',
  oddsHistory: MatchOddsHistory | null,
  sharpMoney: SharpMoneyResult | null,
  bettingVolume: BettingVolumeResult | null
): OddsReasoning {
  const homeName = matchData.homeTeam || 'Home';
  const awayName = matchData.awayTeam || 'Away';
  
  // Calculate implied probabilities
  const homeImplied = calculateImpliedProbability(homeOdds);
  const drawImplied = calculateImpliedProbability(drawOdds);
  const awayImplied = calculateImpliedProbability(awayOdds);
  const overImplied = calculateImpliedProbability(overOdds);
  const underImplied = calculateImpliedProbability(underOdds);
  const bttsYesImplied = calculateImpliedProbability(bttsYesOdds);
  const bttsNoImplied = calculateImpliedProbability(bttsNoOdds);
  
  // Calculate value edges
  const homeValue = homeFormProb - homeImplied;
  const awayValue = awayFormProb - awayImplied;
  const overValue = overProb - overImplied;
  const underValue = (100 - overProb) - underImplied;
  const bttsValue = bttsProb - bttsYesImplied;
  const bttsNoValue = (100 - bttsProb) - bttsNoImplied;
  
  // Find best value
  const values = [
    { name: 'Home Win', value: homeValue, key: 'home' },
    { name: 'Away Win', value: awayValue, key: 'away' },
    { name: 'Over 2.5', value: overValue, key: 'over' },
    { name: 'Under 2.5', value: underValue, key: 'under' },
    { name: 'BTTS Yes', value: bttsValue, key: 'btts' },
    { name: 'BTTS No', value: bttsNoValue, key: 'btts_no' }
  ];
  
  const best = values.reduce((prev, current) => (prev.value > current.value) ? prev : current);
  
  // Value bets
  const valueBets = values
    .filter(v => v.value > 5)
    .map(v => `${v.name} (+${v.value.toFixed(0)}%)`);
  
  // Reasons
  let overUnderReasoning = '';
  let matchWinnerReasoning = '';
  let bttsReasoning = '';
  let agentSummary = '';
  
  if (language === 'tr') {
    matchWinnerReasoning = `${homeName} (%${homeFormProb.toFixed(0)}) vs ${awayName} (%${awayFormProb.toFixed(0)}). `;
    matchWinnerReasoning += homeValue > 5 ? `Ev sahibi oranında %${homeValue.toFixed(0)} değer var.` : 
                            awayValue > 5 ? `Deplasman oranında %${awayValue.toFixed(0)} değer var.` : 
                            'Oranlar form durumuyla uyumlu.';
                            
    overUnderReasoning = `Toplam beklenen gol: ${(homeFormProb / 40 + awayFormProb / 45).toFixed(1)}. `;
    overUnderReasoning += overValue > 5 ? `Üst oranında %${overValue.toFixed(0)} değer var.` : 
                           underValue > 5 ? `Alt oranında %${underValue.toFixed(0)} değer var.` : 
                           'Gol oranları dengeli.';
                           
    bttsReasoning = `KG Var olasılığı %${bttsProb.toFixed(0)}. `;
    bttsReasoning += bttsValue > 5 ? `KG Var oranında %${bttsValue.toFixed(0)} değer var.` : 
                     bttsNoValue > 5 ? `KG Yok oranında %${bttsNoValue.toFixed(0)} değer var.` : 
                     'KG oranları makul.';
                     
    agentSummary = `En iyi fırsat: ${best.name} (+%${best.value.toFixed(0)}). `;
    if (sharpMoney && sharpMoney.confidence === 'high') {
      agentSummary += `Sharp money ${sharpMoney.direction} yönünde onaylıyor. `;
    }
    if (bettingVolume && bettingVolume.volumeIncrease > 7 && bettingVolume.confidence !== 'low') {
      const marketLabel = bettingVolume.market === 'home' ? 'Ev Galibiyeti' : 
                         bettingVolume.market === 'away' ? 'Deplasman' :
                         bettingVolume.market === 'over' ? 'Üst 2.5' :
                         bettingVolume.market === 'under' ? 'Alt 2.5' :
                         bettingVolume.market === 'btts_yes' ? 'BTTS Evet' :
                         bettingVolume.market === 'btts_no' ? 'BTTS Hayır' : bettingVolume.market;
      agentSummary += `${marketLabel} market'ine normalden %${bettingVolume.volumeIncrease} fazla bahis yapılmış.`;
    }
  } else {
    matchWinnerReasoning = `${homeName} (${homeFormProb.toFixed(0)}%) vs ${awayName} (${awayFormProb.toFixed(0)}%). `;
    matchWinnerReasoning += homeValue > 5 ? `Value found in Home win (+${homeValue.toFixed(0)}%).` : 
                            awayValue > 5 ? `Value found in Away win (+${awayValue.toFixed(0)}%).` : 
                            'Odds are consistent with form.';
                            
    overUnderReasoning = `Total expected goals: ${(homeFormProb / 40 + awayFormProb / 45).toFixed(1)}. `;
    overUnderReasoning += overValue > 5 ? `Value in Over (+${overValue.toFixed(0)}%).` : 
                           underValue > 5 ? `Value in Under (+${underValue.toFixed(0)}%).` : 
                           'Goal odds are balanced.';
                           
    bttsReasoning = `BTTS probability ${bttsProb.toFixed(0)}%. `;
    bttsReasoning += bttsValue > 5 ? `Value in BTTS Yes (+${bttsValue.toFixed(0)}%).` : 
                     bttsNoValue > 5 ? `Value in BTTS No (+${bttsNoValue.toFixed(0)}%).` : 
                     'BTTS odds are fair.';
                     
    agentSummary = `Best opportunity: ${best.name} (+${best.value.toFixed(0)}%). `;
    if (sharpMoney && sharpMoney.confidence === 'high') {
      agentSummary += `Sharp money confirms ${sharpMoney.direction} direction. `;
    }
    if (bettingVolume && bettingVolume.volumeIncrease > 7 && bettingVolume.confidence !== 'low') {
      const marketLabel = bettingVolume.market === 'home' ? 'Home Win' : 
                         bettingVolume.market === 'away' ? 'Away Win' :
                         bettingVolume.market === 'over' ? 'Over 2.5' :
                         bettingVolume.market === 'under' ? 'Under 2.5' :
                         bettingVolume.market === 'btts_yes' ? 'BTTS Yes' :
                         bettingVolume.market === 'btts_no' ? 'BTTS No' : bettingVolume.market;
      agentSummary += `${marketLabel} market has ${bettingVolume.volumeIncrease > 0 ? '+' : ''}${bettingVolume.volumeIncrease}% unusual betting volume.`;
    }
  }
  
  let fullAnalysis = '';
  if (language === 'tr') {
    fullAnalysis = `📊 ORAN ANALİZİ:\n`;
    fullAnalysis += `• ${homeName} Kazanır: ${homeOdds.toFixed(2)} (Value: ${homeValue >= 0 ? '+' : ''}${homeValue.toFixed(0)}%)\n`;
    fullAnalysis += `• 2.5 Üst: ${overOdds.toFixed(2)} (Value: ${overValue >= 0 ? '+' : ''}${overValue.toFixed(0)}%)\n`;
    fullAnalysis += `• KG Var: ${bttsYesOdds.toFixed(2)} (Value: ${bttsValue >= 0 ? '+' : ''}${bttsValue.toFixed(0)}%)\n`;
  } else {
    fullAnalysis = `📊 ODDS ANALYSIS:\n`;
    fullAnalysis += `• ${homeName} Win: ${homeOdds.toFixed(2)} (Value: ${homeValue >= 0 ? '+' : ''}${homeValue.toFixed(0)}%)\n`;
    fullAnalysis += `• Over 2.5: ${overOdds.toFixed(2)} (Value: ${overValue >= 0 ? '+' : ''}${overValue.toFixed(0)}%)\n`;
    fullAnalysis += `• BTTS Yes: ${bttsYesOdds.toFixed(2)} (Value: ${bttsValue >= 0 ? '+' : ''}${bttsValue.toFixed(0)}%)\n`;
  }
  
  if (sharpMoney) {
    fullAnalysis += `\n💹 SHARP MONEY: ${sharpMoney.direction.toUpperCase()} (${sharpMoney.confidence})\n`;
    fullAnalysis += `   ${sharpMoney.reasoning[language] || sharpMoney.reasoning.en}\n`;
  }
  
  if (bettingVolume && bettingVolume.volumeIncrease !== 0) {
    fullAnalysis += `\n🔥 BETTING VOLUME: ${bettingVolume.market.toUpperCase()} market\n`;
    fullAnalysis += `   ${bettingVolume.reasoning[language] || bettingVolume.reasoning.en}\n`;
    if (bettingVolume.indicators.isUnusual) {
      fullAnalysis += `   ⚠️ Unusual activity detected! Movement strength: ${bettingVolume.indicators.movementStrength}/100\n`;
    }
  }
  
  return {
    bestValue: best.key,
    bestValueAmount: Math.round(best.value),
    valueBets,
    overUnderReasoning,
    matchWinnerReasoning,
    bttsReasoning,
    agentSummary,
    fullAnalysis
  };
}

// ==================== ODDS AGENT ====================

export async function runOddsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  console.log('💰 Odds Agent starting COMPREHENSIVE market analysis...');
  console.log('   📊 Markets: 1X2, Over/Under, BTTS, Asian Handicap, Correct Score, HT/FT, Corners, Cards');
  
  // 🧠 ÖĞRENME CONTEXT'İ - Geçmiş performansı kullan
  let learningContext = '';
  try {
    learningContext = await getLearningContext(matchData.league, matchData.homeTeam, matchData.awayTeam, language);
    if (learningContext) {
      console.log('   🧠 Learning Context loaded - using past performance data');
    }
  } catch (e) {
    console.warn('   ⚠️ Learning Context failed, continuing without it');
  }
  
  // 🆕 Historical odds çek
  let oddsHistory: MatchOddsHistory | null = null;
  let sharpMoney: SharpMoneyResult | null = null;
  let bettingVolume: BettingVolumeResult | null = null;
  
  if (matchData.fixtureId) {
    oddsHistory = await fetchHistoricalOdds(matchData.fixtureId);
    
    if (oddsHistory) {
      sharpMoney = analyzeSharpMoney(oddsHistory);
      bettingVolume = analyzeBettingVolume(oddsHistory);
      console.log(`📊 Sharp Money: ${sharpMoney.direction} (${sharpMoney.confidence})`);
      console.log(`   ${sharpMoney.reasoning[language]}`);
      console.log(`📊 Betting Volume: ${bettingVolume.market} market has ${bettingVolume.volumeIncrease > 0 ? '+' : ''}${bettingVolume.volumeIncrease}% volume (${bettingVolume.confidence} confidence)`);
      console.log(`   ${bettingVolume.reasoning[language]}`);
    }
  }
  
  // Odds değerleri
  const homeOdds = matchData.odds?.matchWinner?.home || 2.0;
  const drawOdds = matchData.odds?.matchWinner?.draw || 3.5;
  const awayOdds = matchData.odds?.matchWinner?.away || 3.5;
  const overOdds = matchData.odds?.overUnder?.['2.5']?.over || 1.9;
  const underOdds = matchData.odds?.overUnder?.['2.5']?.under || 1.9;
  const bttsYesOdds = matchData.odds?.btts?.yes || 1.8;
  const bttsNoOdds = matchData.odds?.btts?.no || 1.9;
  
  // Form verilerinden olasılık hesapla
  const homeForm = matchData.homeForm?.form || 'DDDDD';
  const awayForm = matchData.awayForm?.form || 'DDDDD';
  const homePoints = matchData.homeForm?.points || 5;
  const awayPoints = matchData.awayForm?.points || 5;
  
  // Home win probability based on form
  const homeWins = (homeForm.match(/W/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  const homeLosses = (homeForm.match(/L/g) || []).length;
  const awayLosses = (awayForm.match(/L/g) || []).length;
  
  // Form-based probability calculation
  let homeFormProb = 33 + (homePoints - awayPoints) * 2 + (homeWins - awayWins) * 5 + 10;
  let awayFormProb = 33 + (awayPoints - homePoints) * 2 + (awayWins - homeWins) * 5 - 5;
  
  // Normalize
  homeFormProb = Math.min(75, Math.max(20, homeFormProb));
  awayFormProb = Math.min(65, Math.max(15, awayFormProb));
  
  // Over 2.5 probability from stats
  const homeOver25 = parseFloat(matchData.homeForm?.over25Percentage || '50');
  const awayOver25 = parseFloat(matchData.awayForm?.over25Percentage || '50');
  const h2hOver25 = parseFloat(matchData.h2h?.over25Percentage || '50');
  const overProb = Math.round((homeOver25 + awayOver25 + h2hOver25) / 3);
  
  // BTTS probability from stats
  const homeBtts = parseFloat(matchData.homeForm?.bttsPercentage || '50');
  const awayBtts = parseFloat(matchData.awayForm?.bttsPercentage || '50');
  const h2hBtts = parseFloat(matchData.h2h?.bttsPercentage || '50');
  const bttsProb = Math.round((homeBtts + awayBtts + h2hBtts) / 3);
  
  // Expected goals
  const homeGoals = parseFloat(matchData.homeForm?.avgGoals || '1.2');
  const awayGoals = parseFloat(matchData.awayForm?.avgGoals || '1.0');
  const expectedTotal = homeGoals + awayGoals;
  
  // 🆕 Timing patterns (from detailed stats if available)
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const homeFirstHalfPct = parseFloat(detailedHome?.firstHalfGoalsPct || '45');
  const awayFirstHalfPct = parseFloat(detailedAway?.firstHalfGoalsPct || '40');
  
  // 🆕 Match context (high stakes?)
  const matchContext = (matchData as any).matchContext;
  const isHighStakes = matchContext?.type === 'derby' || 
                       matchContext?.type === 'title_race' || 
                       matchContext?.type === 'relegation_battle' ||
                       matchContext?.importance >= 8;
  
  // 🆕 New market analyses
  const matchResultPrediction = homeFormProb > awayFormProb + 10 ? '1' : 
                                awayFormProb > homeFormProb + 10 ? '2' : 'X';
  
  // Asian Handicap Analysis
  const asianHandicap = analyzeAsianHandicap(
    homeFormProb, awayFormProb, expectedTotal, homeOdds, awayOdds, language
  );
  console.log(`   🎯 Asian Handicap: ${asianHandicap.recommendation} (${asianHandicap.confidence}%)`);
  
  // Correct Score Prediction
  const correctScore = predictCorrectScore(homeGoals, awayGoals, matchResultPrediction, language);
  console.log(`   🎯 Correct Score: ${correctScore.mostLikely}, ${correctScore.second}, ${correctScore.third}`);
  
  // HT/FT Prediction
  const htftPrediction = predictHTFT(
    homeFormProb, awayFormProb, homeFirstHalfPct, awayFirstHalfPct, matchResultPrediction, language
  );
  console.log(`   🎯 HT/FT: ${htftPrediction.prediction} (${htftPrediction.confidence}%)`);
  
  // Corners and Cards Analysis
  const cornersCards = analyzeCornersAndCards(
    homeFormProb, awayFormProb, expectedTotal, isHighStakes, language
  );
  console.log(`   🎯 Corners: ${cornersCards.totalCorners} | Cards: ${cornersCards.totalCards}`);
  
  // Generate reasoning with odds history
  const reasoning = generateOddsReasoning(
    matchData,
    homeOdds, drawOdds, awayOdds,
    overOdds, underOdds,
    bttsYesOdds, bttsNoOdds,
    homeFormProb, awayFormProb,
    overProb, bttsProb,
    language,
    oddsHistory,
    sharpMoney,
    bettingVolume
  );
  
  // Calculate implied probabilities
  const homeImplied = calculateImpliedProbability(homeOdds);
  const overImplied = calculateImpliedProbability(overOdds);
  const bttsYesImplied = calculateImpliedProbability(bttsYesOdds);
  
  // Calculate values
  const homeValue = calculateValue(homeImplied, homeFormProb);
  const overValue = calculateValue(overImplied, overProb);
  const bttsValue = calculateValue(bttsYesImplied, bttsProb);
  
  // 🆕 Real value checks
  const realValueChecks = {
    home: isRealValue(homeValue, oddsHistory?.homeWin.movement || 'stable'),
    away: isRealValue(calculateValue(calculateImpliedProbability(awayOdds), awayFormProb), oddsHistory?.awayWin.movement || 'stable'),
    over25: isRealValue(overValue, oddsHistory?.over25.movement || 'stable'),
    under25: isRealValue(calculateValue(calculateImpliedProbability(underOdds), 100 - overProb), oddsHistory?.under25.movement || 'stable'),
    btts: isRealValue(bttsValue, oddsHistory?.bttsYes.movement || 'stable'),
  };
  
  // Sharp money onayı varsa confidence'ı artır
  const hasSharpConfirmation = sharpMoney?.confidence === 'high' && 
    ((sharpMoney.direction === 'home' && homeValue > 5) ||
     (sharpMoney.direction === 'away' && calculateValue(calculateImpliedProbability(awayOdds), awayFormProb) > 5) ||
     (sharpMoney.direction === 'over' && overValue > 5));
  
  const maxValue = Math.max(Math.abs(homeValue), Math.abs(overValue), Math.abs(bttsValue));
  let confidence = 55 + Math.min(25, maxValue);
  
  // 🆕 Sharp money bonus
  if (hasSharpConfirmation) {
    confidence += 8;
    console.log('🔥 Sharp money confirms form analysis! Confidence boosted.');
  }
  
  // Oran yükseliyorsa ve form value gösteriyorsa, confidence düşür
  const hasRisingWarning = Object.values(realValueChecks).some(
    check => check.confidence === 'low' && check.reason.en.includes('rising')
  );
  if (hasRisingWarning) {
    confidence -= 10;
    console.log('⚠️ Odds rising against form! Confidence reduced.');
  }
  
  confidence = Math.min(88, Math.max(48, confidence));

  // 🆕 Odds movement bilgisini prompt'a ekle
  const oddsMovementInfo = oddsHistory ? `
═══════════════════════════════════════════════════════════════
📈 ODDS MOVEMENT (Sharp Money Detection)
═══════════════════════════════════════════════════════════════
Home: ${oddsHistory.homeWin.opening} → ${oddsHistory.homeWin.current} (${oddsHistory.homeWin.movement.toUpperCase()} ${oddsHistory.homeWin.changePercent}%)
Draw: ${oddsHistory.draw.opening} → ${oddsHistory.draw.current} (${oddsHistory.draw.movement.toUpperCase()} ${oddsHistory.draw.changePercent}%)
Away: ${oddsHistory.awayWin.opening} → ${oddsHistory.awayWin.current} (${oddsHistory.awayWin.movement.toUpperCase()} ${oddsHistory.awayWin.changePercent}%)
Over 2.5: ${oddsHistory.over25.opening} → ${oddsHistory.over25.current} (${oddsHistory.over25.movement.toUpperCase()} ${oddsHistory.over25.changePercent}%)
BTTS Yes: ${oddsHistory.bttsYes.opening} → ${oddsHistory.bttsYes.current} (${oddsHistory.bttsYes.movement.toUpperCase()} ${oddsHistory.bttsYes.changePercent}%)

SHARP MONEY: ${sharpMoney?.direction.toUpperCase() || 'NONE'} (${sharpMoney?.confidence || 'low'})
${sharpMoney?.reasoning[language] || ''}

${bettingVolume && bettingVolume.volumeIncrease !== 0 ? `🔥 BETTING VOLUME: ${bettingVolume.market.toUpperCase()} market has ${bettingVolume.volumeIncrease > 0 ? '+' : ''}${bettingVolume.volumeIncrease}% volume increase (${bettingVolume.confidence} confidence)
${bettingVolume.reasoning[language]}
Movement Strength: ${bettingVolume.indicators.movementStrength}/100 | Unusual: ${bettingVolume.indicators.isUnusual ? 'YES' : 'NO'}
` : ''}
` : '';

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

${learningContext ? `\n🧠 ÖĞRENME CONTEXT (Geçmiş Performans):\n${learningContext}\n` : ''}

═══════════════════════════════════════════════════════════════
💰 ODDS DATA
═══════════════════════════════════════════════════════════════
MATCH WINNER:
- Home (1): ${homeOdds} → Implied: ${homeImplied}%
- Draw (X): ${drawOdds} → Implied: ${calculateImpliedProbability(drawOdds)}%
- Away (2): ${awayOdds} → Implied: ${calculateImpliedProbability(awayOdds)}%

OVER/UNDER 2.5:
- Over: ${overOdds} → Implied: ${overImplied}%
- Under: ${underOdds} → Implied: ${calculateImpliedProbability(underOdds)}%

BTTS:
- Yes: ${bttsYesOdds} → Implied: ${bttsYesImplied}%
- No: ${bttsNoOdds} → Implied: ${calculateImpliedProbability(bttsNoOdds)}%
${oddsMovementInfo}
═══════════════════════════════════════════════════════════════
📊 FORM-BASED PROBABILITIES (Your edge)
═══════════════════════════════════════════════════════════════
Home Win Probability: ${homeFormProb}% (vs ${homeImplied}% implied) → VALUE: ${homeValue > 0 ? '+' : ''}${homeValue}% ${realValueChecks.home.emoji}
Away Win Probability: ${awayFormProb}% (vs ${calculateImpliedProbability(awayOdds)}% implied) → VALUE: ${calculateValue(calculateImpliedProbability(awayOdds), awayFormProb) > 0 ? '+' : ''}${calculateValue(calculateImpliedProbability(awayOdds), awayFormProb)}% ${realValueChecks.away.emoji}
Over 2.5 Probability: ${overProb}% (vs ${overImplied}% implied) → VALUE: ${overValue > 0 ? '+' : ''}${overValue}% ${realValueChecks.over25.emoji}
BTTS Yes Probability: ${bttsProb}% (vs ${bttsYesImplied}% implied) → VALUE: ${bttsValue > 0 ? '+' : ''}${bttsValue}% ${realValueChecks.btts.emoji}

═══════════════════════════════════════════════════════════════
🎯 VALUE SUMMARY
═══════════════════════════════════════════════════════════════
Best Value: ${reasoning.bestValue.toUpperCase()} (+${reasoning.bestValueAmount}%)
Value Rating: ${getValueRating(reasoning.bestValueAmount, hasSharpConfirmation)}
Sharp Money Confirmation: ${hasSharpConfirmation ? '✅ YES' : '❌ NO'}
Detected Value Bets: ${reasoning.valueBets.length > 0 ? reasoning.valueBets.join(', ') : 'None significant'}

REAL VALUE = Form Value + Sharp Money Confirmation
BE AGGRESSIVE but RESPECT the odds movement! Return JSON:`;

  const messages: AIMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await aiClient.chat(messages, {
      model: 'claude',
      useMCP: false, // MCP devre dışı - daha hızlı
      mcpFallback: true,
      fixtureId: matchData.fixtureId,
      temperature: 0.4, 
      maxTokens: 1200, // JSON tamamlanması için artırıldı
      timeout: 12000 // 12 saniye - artırıldı
    });
    
    if (response) {
      // Robust JSON extraction kullan
      const parsed = extractJSON(response);
      if (parsed) {
        
        // Enhance with calculated values
        if (!parsed.confidence || parsed.confidence < confidence - 10) {
          parsed.confidence = confidence;
        }
        parsed.confidence = Math.min(88, Math.max(48, parsed.confidence));
        
        // Add reasoning if missing
        if (!parsed.recommendationReasoning || parsed.recommendationReasoning.length < 20) {
          parsed.recommendationReasoning = reasoning.overUnderReasoning;
        }
        if (!parsed.matchWinnerReasoning || parsed.matchWinnerReasoning.length < 20) {
          parsed.matchWinnerReasoning = reasoning.matchWinnerReasoning;
        }
        if (!parsed.bttsReasoning || parsed.bttsReasoning.length < 20) {
          parsed.bttsReasoning = reasoning.bttsReasoning;
        }
        if (!parsed.agentSummary) {
          parsed.agentSummary = reasoning.agentSummary;
        }
        if (!parsed.valueBets || parsed.valueBets.length === 0) {
          parsed.valueBets = reasoning.valueBets;
        }
        
        // 🆕 Add odds movement and real value data
        parsed._valueAnalysis = {
          homeImplied,
          awayImplied: calculateImpliedProbability(awayOdds),
          overImplied,
          bttsYesImplied,
          homeFormProb,
          awayFormProb,
          overProb,
          bttsProb,
          homeValue,
          overValue,
          bttsValue,
          bestValue: reasoning.bestValue,
          bestValueAmount: reasoning.bestValueAmount,
        };
        
        // 🆕 Add new fields
        parsed.oddsMovement = oddsHistory;
        parsed.sharpMoneyAnalysis = sharpMoney;
        parsed.realValueChecks = realValueChecks;
        parsed.hasSharpConfirmation = hasSharpConfirmation;
        
        // 🆕 Add new market analyses
        parsed.asianHandicap = asianHandicap;
        parsed.correctScore = correctScore;
        parsed.htftPrediction = htftPrediction;
        parsed.cornersAnalysis = {
          totalCorners: cornersCards.totalCorners,
          confidence: cornersCards.cornersConfidence,
          reasoning: cornersCards.cornersReasoning
        };
        parsed.cardsAnalysis = {
          totalCards: cornersCards.totalCards,
          confidence: cornersCards.cardsConfidence,
          reasoning: cornersCards.cardsReasoning
        };
        
        console.log(`✅ Odds Agent: ${parsed.matchWinnerValue} | ${parsed.recommendation} | BTTS: ${parsed.bttsValue} | Conf: ${parsed.confidence}%`);
        console.log(`   🎯 AH: ${asianHandicap.recommendation} | CS: ${correctScore.mostLikely} | HT/FT: ${htftPrediction.prediction}`);
        console.log(`   📝 Summary: ${parsed.agentSummary}`);
        if (hasSharpConfirmation) {
          console.log(`   🔥 SHARP MONEY CONFIRMED!`);
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ Odds agent error:', error);
  }

  // Fallback with calculated values
  const bestMatchWinner = homeFormProb > awayFormProb ? 'home' : awayFormProb > homeFormProb ? 'away' : 'draw';
  const bestOverUnder = overProb >= 50 ? 'Over' : 'Under';
  const bestBtts = bttsProb >= 50 ? 'yes' : 'no';
  
  const fallbackResult = {
    oddsAnalysis: `Home: ${homeOdds} (${homeImplied}%), Draw: ${drawOdds}, Away: ${awayOdds} (${calculateImpliedProbability(awayOdds)}%). Value analysis: ${reasoning.bestValue} +${reasoning.bestValueAmount}%`,
    recommendation: bestOverUnder,
    recommendationReasoning: reasoning.overUnderReasoning,
    confidence,
    matchWinnerValue: bestMatchWinner,
    matchWinnerReasoning: reasoning.matchWinnerReasoning,
    bttsValue: bestBtts,
    bttsReasoning: reasoning.bttsReasoning,
    valueRating: getValueRating(reasoning.bestValueAmount, hasSharpConfirmation),
    valueBets: reasoning.valueBets,
    agentSummary: reasoning.agentSummary,
    _valueAnalysis: {
      homeImplied,
      awayImplied: calculateImpliedProbability(awayOdds),
      overImplied,
      bttsYesImplied,
      homeFormProb,
      awayFormProb,
      overProb,
      bttsProb,
      homeValue,
      overValue,
      bttsValue,
      bestValue: reasoning.bestValue,
      bestValueAmount: reasoning.bestValueAmount,
    },
    // 🆕 New fields
    oddsMovement: oddsHistory,
    sharpMoneyAnalysis: sharpMoney,
    realValueChecks,
    hasSharpConfirmation,
    // 🆕 New market analyses
    asianHandicap,
    correctScore,
    htftPrediction,
    cornersAnalysis: {
      totalCorners: cornersCards.totalCorners,
      confidence: cornersCards.cornersConfidence,
      reasoning: cornersCards.cornersReasoning
    },
    cardsAnalysis: {
      totalCards: cornersCards.totalCards,
      confidence: cornersCards.cardsConfidence,
      reasoning: cornersCards.cardsReasoning
    },
  };
  
  console.log(`⚠️ Odds Agent Fallback: ${fallbackResult.matchWinnerValue} | ${fallbackResult.recommendation} | BTTS: ${fallbackResult.bttsValue}`);
  console.log(`   🎯 AH: ${asianHandicap.recommendation} | CS: ${correctScore.mostLikely} | HT/FT: ${htftPrediction.prediction}`);
  console.log(`   📝 Summary: ${fallbackResult.agentSummary}`);
  return fallbackResult;
}
