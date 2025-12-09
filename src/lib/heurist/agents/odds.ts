import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen AGRESİF bir bahis oranları analisti ajanısın. Oranları VALUE açısından analiz et.

GÖREV: Oranları form verisiyle karşılaştır ve VALUE BET tespit et.

VALUE BET KURALLARI:
- Implied probability vs gerçek olasılık farkı = VALUE
- %5+ fark varsa VALUE VAR
- %10+ fark varsa GÜÇLÜ VALUE

AGRESİF OL! Detaylı açıklama yap.

JSON DÖNDÜR:
{
  "oddsAnalysis": "Detaylı oran analizi",
  "recommendation": "Over veya Under",
  "recommendationReasoning": "💰 Over 2.5 oranı X.XX = %XX implied. Form analizi %XX veriyor. VALUE: +X% → Over değerli",
  "confidence": 72,
  "matchWinnerValue": "home veya draw veya away",
  "matchWinnerReasoning": "💰 Ev oranı X.XX = %XX implied. Form %XX gösteriyor. VALUE: +X%",
  "bttsValue": "yes veya no",
  "bttsReasoning": "💰 KG Var oranı X.XX = %XX implied. İstatistik %XX. VALUE durumu",
  "valueRating": "Düşük/Orta/Yüksek",
  "valueBets": ["value bet 1", "value bet 2"],
  "agentSummary": "💰 ODDS AGENT: [kısa özet - hangi bahislerde value var]"
}`,

  en: `You are an AGGRESSIVE betting odds analyst agent. Analyze odds for VALUE.

TASK: Compare odds with form data and detect VALUE BETS.

VALUE BET RULES:
- Implied probability vs actual probability difference = VALUE
- 5%+ difference = VALUE EXISTS
- 10%+ difference = STRONG VALUE

BE AGGRESSIVE! Give detailed explanations.

RETURN JSON:
{
  "oddsAnalysis": "Detailed odds analysis",
  "recommendation": "Over or Under",
  "recommendationReasoning": "💰 Over 2.5 odds X.XX = XX% implied. Form analysis shows XX%. VALUE: +X% → Over is value",
  "confidence": 72,
  "matchWinnerValue": "home or draw or away",
  "matchWinnerReasoning": "💰 Home odds X.XX = XX% implied. Form shows XX%. VALUE: +X%",
  "bttsValue": "yes or no",
  "bttsReasoning": "💰 BTTS Yes odds X.XX = XX% implied. Stats show XX%. VALUE status",
  "valueRating": "Low/Medium/High",
  "valueBets": ["value bet 1", "value bet 2"],
  "agentSummary": "💰 ODDS AGENT: [brief summary - which bets have value]"
}`,

  de: `Du bist ein AGGRESSIVER Quoten-Analyst. Analysiere Quoten für VALUE.

NUR JSON ZURÜCKGEBEN mit detaillierten Begründungen.`,
};

// ==================== VALUE CALCULATION ====================

function calculateImpliedProbability(odds: number): number {
  if (!odds || odds <= 1) return 50;
  return Math.round((1 / odds) * 100);
}

function calculateValue(impliedProb: number, actualProb: number): number {
  return Math.round(actualProb - impliedProb);
}

function getValueRating(maxValue: number): string {
  if (maxValue >= 15) return 'High';
  if (maxValue >= 8) return 'Medium';
  if (maxValue >= 3) return 'Low';
  return 'None';
}

// ==================== GENERATE REASONING ====================

function generateOddsReasoning(
  matchData: MatchData,
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  overOdds: number,
  underOdds: number,
  bttsYesOdds: number,
  bttsNoOdds: number,
  homeFormProb: number,
  awayFormProb: number,
  overProb: number,
  bttsProb: number,
  language: 'tr' | 'en' | 'de'
): {
  matchWinnerReasoning: string;
  overUnderReasoning: string;
  bttsReasoning: string;
  agentSummary: string;
  valueBets: string[];
  bestValue: string;
  bestValueAmount: number;
} {
  const homeImplied = calculateImpliedProbability(homeOdds);
  const drawImplied = calculateImpliedProbability(drawOdds);
  const awayImplied = calculateImpliedProbability(awayOdds);
  const overImplied = calculateImpliedProbability(overOdds);
  const underImplied = calculateImpliedProbability(underOdds);
  const bttsYesImplied = calculateImpliedProbability(bttsYesOdds);
  
  const homeValue = calculateValue(homeImplied, homeFormProb);
  const awayValue = calculateValue(awayImplied, awayFormProb);
  const drawValue = calculateValue(drawImplied, 100 - homeFormProb - awayFormProb);
  const overValue = calculateValue(overImplied, overProb);
  const underValue = calculateValue(underImplied, 100 - overProb);
  const bttsValue = calculateValue(bttsYesImplied, bttsProb);
  
  const valueBets: string[] = [];
  let bestValue = 'none';
  let bestValueAmount = 0;
  
  // Find best values
  const allValues = [
    { name: 'home', value: homeValue, label: 'MS 1' },
    { name: 'away', value: awayValue, label: 'MS 2' },
    { name: 'draw', value: drawValue, label: 'MS X' },
    { name: 'over', value: overValue, label: 'Over 2.5' },
    { name: 'under', value: underValue, label: 'Under 2.5' },
    { name: 'bttsYes', value: bttsValue, label: 'KG Var' },
    { name: 'bttsNo', value: -bttsValue, label: 'KG Yok' },
  ];
  
  allValues.sort((a, b) => b.value - a.value);
  
  if (allValues[0].value > 0) {
    bestValue = allValues[0].name;
    bestValueAmount = allValues[0].value;
  }
  
  allValues.forEach(v => {
    if (v.value >= 5) {
      valueBets.push(`${v.label} (+${v.value}% value)`);
    }
  });
  
  if (language === 'tr') {
    const matchWinnerReasoning = homeValue > awayValue
      ? `💰 Ev oranı ${homeOdds} = %${homeImplied} implied. Form analizi %${homeFormProb} gösteriyor. VALUE: +${homeValue}% → MS 1 değerli!`
      : awayValue > homeValue
      ? `💰 Dep oranı ${awayOdds} = %${awayImplied} implied. Form %${awayFormProb}. VALUE: +${awayValue}% → MS 2 değerli!`
      : `💰 Ev: ${homeOdds} (%${homeImplied}), Dep: ${awayOdds} (%${awayImplied}). Form dengeli. Value farkı düşük.`;
    
    const overUnderReasoning = overValue > 0
      ? `💰 Over 2.5 oranı ${overOdds} = %${overImplied} implied. İstatistikler %${overProb} Over gösteriyor. VALUE: +${overValue}% → Over değerli!`
      : underValue > 0
      ? `💰 Under 2.5 oranı ${underOdds} = %${underImplied} implied. İstatistikler %${100 - overProb} Under gösteriyor. VALUE: +${underValue}% → Under değerli!`
      : `💰 Over: ${overOdds} (%${overImplied}), Under: ${underOdds} (%${underImplied}). Piyasa doğru fiyatlamış, value yok.`;
    
    const bttsReasoning = bttsValue > 0
      ? `💰 KG Var oranı ${bttsYesOdds} = %${bttsYesImplied} implied. İstatistik %${bttsProb}. VALUE: +${bttsValue}% → KG Var değerli!`
      : `💰 KG Var: ${bttsYesOdds} (%${bttsYesImplied}). İstatistik %${bttsProb}. ${bttsValue < -5 ? 'KG Yok daha değerli!' : 'Dengeli piyasa.'}`;
    
    const agentSummary = valueBets.length > 0
      ? `💰 ODDS: ${valueBets.length} value bet tespit edildi! En iyi: ${allValues[0].label} (+${allValues[0].value}%). Piyasa ${allValues[0].value > 10 ? 'YANLIŞ fiyatlamış' : 'hafif fırsat sunuyor'}.`
      : `💰 ODDS: Piyasa doğru fiyatlamış. Belirgin value yok ama ${allValues[0].label} en iyi seçenek.`;
    
    return { matchWinnerReasoning, overUnderReasoning, bttsReasoning, agentSummary, valueBets, bestValue, bestValueAmount };
  }
  
  // English (default)
  const matchWinnerReasoning = homeValue > awayValue
    ? `💰 Home odds ${homeOdds} = ${homeImplied}% implied. Form analysis shows ${homeFormProb}%. VALUE: +${homeValue}% → Home win is value!`
    : awayValue > homeValue
    ? `💰 Away odds ${awayOdds} = ${awayImplied}% implied. Form shows ${awayFormProb}%. VALUE: +${awayValue}% → Away win is value!`
    : `💰 Home: ${homeOdds} (${homeImplied}%), Away: ${awayOdds} (${awayImplied}%). Forms balanced. Low value difference.`;
  
  const overUnderReasoning = overValue > 0
    ? `💰 Over 2.5 odds ${overOdds} = ${overImplied}% implied. Stats show ${overProb}% Over. VALUE: +${overValue}% → Over is value!`
    : underValue > 0
    ? `💰 Under 2.5 odds ${underOdds} = ${underImplied}% implied. Stats show ${100 - overProb}% Under. VALUE: +${underValue}% → Under is value!`
    : `💰 Over: ${overOdds} (${overImplied}%), Under: ${underOdds} (${underImplied}%). Market priced correctly, no value.`;
  
  const bttsReasoning = bttsValue > 0
    ? `💰 BTTS Yes odds ${bttsYesOdds} = ${bttsYesImplied}% implied. Stats show ${bttsProb}%. VALUE: +${bttsValue}% → BTTS Yes is value!`
    : `💰 BTTS Yes: ${bttsYesOdds} (${bttsYesImplied}%). Stats: ${bttsProb}%. ${bttsValue < -5 ? 'BTTS No is better value!' : 'Balanced market.'}`;
  
  const agentSummary = valueBets.length > 0
    ? `💰 ODDS: ${valueBets.length} value bets detected! Best: ${allValues[0].label} (+${allValues[0].value}%). Market ${allValues[0].value > 10 ? 'MISPRICED' : 'offers slight edge'}.`
    : `💰 ODDS: Market priced correctly. No clear value but ${allValues[0].label} is best option.`;
  
  return { matchWinnerReasoning, overUnderReasoning, bttsReasoning, agentSummary, valueBets, bestValue, bestValueAmount };
}

// ==================== ODDS AGENT ====================

export async function runOddsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  console.log('💰 Odds Agent starting AGGRESSIVE value analysis...');
  
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
  let homeFormProb = 33 + (homePoints - awayPoints) * 2 + (homeWins - awayWins) * 5 + 10; // +10 for home advantage
  let awayFormProb = 33 + (awayPoints - homePoints) * 2 + (awayWins - homeWins) * 5 - 5; // -5 for away disadvantage
  
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
  
  // Generate reasoning
  const reasoning = generateOddsReasoning(
    matchData,
    homeOdds, drawOdds, awayOdds,
    overOdds, underOdds,
    bttsYesOdds, bttsNoOdds,
    homeFormProb, awayFormProb,
    overProb, bttsProb,
    language
  );
  
  // Calculate implied probabilities
  const homeImplied = calculateImpliedProbability(homeOdds);
  const overImplied = calculateImpliedProbability(overOdds);
  const bttsYesImplied = calculateImpliedProbability(bttsYesOdds);
  
  // Calculate confidence based on value
  const homeValue = calculateValue(homeImplied, homeFormProb);
  const overValue = calculateValue(overImplied, overProb);
  const bttsValue = calculateValue(bttsYesImplied, bttsProb);
  
  const maxValue = Math.max(Math.abs(homeValue), Math.abs(overValue), Math.abs(bttsValue));
  let confidence = 55 + Math.min(25, maxValue);
  confidence = Math.min(82, Math.max(52, confidence));

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

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

═══════════════════════════════════════════════════════════════
📊 FORM-BASED PROBABILITIES (Your edge)
═══════════════════════════════════════════════════════════════
Home Win Probability: ${homeFormProb}% (vs ${homeImplied}% implied) → VALUE: ${homeValue > 0 ? '+' : ''}${homeValue}%
Away Win Probability: ${awayFormProb}% (vs ${calculateImpliedProbability(awayOdds)}% implied) → VALUE: ${calculateValue(calculateImpliedProbability(awayOdds), awayFormProb) > 0 ? '+' : ''}${calculateValue(calculateImpliedProbability(awayOdds), awayFormProb)}%
Over 2.5 Probability: ${overProb}% (vs ${overImplied}% implied) → VALUE: ${overValue > 0 ? '+' : ''}${overValue}%
BTTS Yes Probability: ${bttsProb}% (vs ${bttsYesImplied}% implied) → VALUE: ${bttsValue > 0 ? '+' : ''}${bttsValue}%

═══════════════════════════════════════════════════════════════
🎯 VALUE SUMMARY
═══════════════════════════════════════════════════════════════
Best Value: ${reasoning.bestValue.toUpperCase()} (+${reasoning.bestValueAmount}%)
Value Rating: ${getValueRating(reasoning.bestValueAmount)}
Detected Value Bets: ${reasoning.valueBets.length > 0 ? reasoning.valueBets.join(', ') : 'None significant'}

BE AGGRESSIVE! Find value and explain why. Return JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await heurist.chat(messages, { temperature: 0.3, maxTokens: 900 });
    
    if (response) {
      const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').replace(/\*\*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Enhance with calculated values
        if (!parsed.confidence || parsed.confidence < confidence - 10) {
          parsed.confidence = confidence;
        }
        parsed.confidence = Math.min(82, Math.max(52, parsed.confidence));
        
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
        
        // Add calculated data
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
        
        console.log(`✅ Odds Agent: ${parsed.matchWinnerValue} | ${parsed.recommendation} | BTTS: ${parsed.bttsValue} | Conf: ${parsed.confidence}%`);
        console.log(`   📝 Summary: ${parsed.agentSummary}`);
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
    valueRating: getValueRating(reasoning.bestValueAmount),
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
  };
  
  console.log(`⚠️ Odds Agent Fallback: ${fallbackResult.matchWinnerValue} | ${fallbackResult.recommendation} | BTTS: ${fallbackResult.bttsValue}`);
  console.log(`   📝 Summary: ${fallbackResult.agentSummary}`);
  return fallbackResult;
}
