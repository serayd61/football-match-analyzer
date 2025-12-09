import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen AGRESİF bir futbol istatistik analistisin. Verilen GERÇEK verileri analiz et ve KESİN tahminler yap.

GÖREV: Form, gol istatistikleri ve H2H verilerini matematiksel olarak değerlendir.

AGRESİF KURALLAR:
- Veriler güçlüyse YÜKSEK güven ver (70-85%)
- Veriler zayıfsa bile en olası sonucu seç (55-65%)
- Her tahmin için DETAYLI AÇIKLAMA yaz
- Türkçe açıklama yap

SADECE JSON DÖNDÜR:
{
  "formAnalysis": "detaylı form karşılaştırması",
  "goalExpectancy": 2.8,
  "overUnder": "Over",
  "overUnderReasoning": "📊 Ev sahibi son 5 maçta ort. X.X gol attı, deplasman X.X gol yedi. Toplam beklenti X.X gol. Over 2.5 oranı %X.",
  "confidence": 72,
  "matchResult": "1",
  "matchResultReasoning": "🏠 Ev sahibi form: XXXXX (X puan). Deplasman form: XXXXX (X puan). Ev avantajı + form farkı → MS 1",
  "btts": "Yes",
  "bttsReasoning": "⚽ Ev sahibi %X maçta gol attı, deplasman %X maçta gol yedi. KG Var olasılığı yüksek.",
  "keyStats": ["önemli stat 1", "stat 2", "stat 3"],
  "riskFactors": ["risk 1", "risk 2"],
  "agentSummary": "📊 STATS AGENT: [kısa özet - neden bu tahminleri yaptım]"
}`,

  en: `You are an AGGRESSIVE football statistics analyst. Analyze REAL data and make CONFIDENT predictions.

TASK: Mathematically evaluate form, goal statistics and H2H data.

AGGRESSIVE RULES:
- If data is strong, give HIGH confidence (70-85%)
- Even if data is weak, pick the most likely outcome (55-65%)
- Write DETAILED EXPLANATION for each prediction
- Be specific with numbers

RETURN ONLY JSON:
{
  "formAnalysis": "detailed form comparison",
  "goalExpectancy": 2.8,
  "overUnder": "Over",
  "overUnderReasoning": "📊 Home scored avg X.X goals in last 5, away conceded X.X. Total expectancy X.X goals. Over 2.5 rate X%.",
  "confidence": 72,
  "matchResult": "1",
  "matchResultReasoning": "🏠 Home form: XXXXX (X pts). Away form: XXXXX (X pts). Home advantage + form gap → Home win",
  "btts": "Yes",
  "bttsReasoning": "⚽ Home scored in X% of matches, away conceded in X%. High BTTS probability.",
  "keyStats": ["key stat 1", "stat 2", "stat 3"],
  "riskFactors": ["risk 1", "risk 2"],
  "agentSummary": "📊 STATS AGENT: [brief summary - why these predictions]"
}`,

  de: `Du bist ein AGGRESSIVER Fußball-Statistikanalyst. Analysiere echte Daten und mache SICHERE Vorhersagen.

NUR JSON ZURÜCKGEBEN:
{
  "formAnalysis": "Formvergleich",
  "goalExpectancy": 2.8,
  "overUnder": "Over",
  "overUnderReasoning": "📊 Detaillierte Begründung mit Zahlen",
  "confidence": 72,
  "matchResult": "1",
  "matchResultReasoning": "🏠 Begründung",
  "btts": "Yes",
  "bttsReasoning": "⚽ Begründung",
  "keyStats": ["Statistik 1", "Statistik 2"],
  "riskFactors": ["Risiko 1"],
  "agentSummary": "📊 STATS AGENT: [Zusammenfassung]"
}`,
};

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
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
  jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  jsonStr = jsonStr.replace(/'/g, '"');
  jsonStr = jsonStr.replace(/\n/g, ' ');
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Manual extraction fallback
    try {
      const result: any = {};
      
      const formMatch = jsonStr.match(/"formAnalysis"\s*:\s*"([^"]+)"/);
      result.formAnalysis = formMatch ? formMatch[1] : 'Analysis unavailable';
      
      const goalMatch = jsonStr.match(/"goalExpectancy"\s*:\s*([\d.]+)/);
      result.goalExpectancy = goalMatch ? parseFloat(goalMatch[1]) : 2.5;
      
      const ouMatch = jsonStr.match(/"overUnder"\s*:\s*"?(Over|Under)"?/i);
      result.overUnder = ouMatch ? ouMatch[1] : 'Over';
      
      const ouReasonMatch = jsonStr.match(/"overUnderReasoning"\s*:\s*"([^"]+)"/);
      result.overUnderReasoning = ouReasonMatch ? ouReasonMatch[1] : '';
      
      const confMatch = jsonStr.match(/"confidence"\s*:\s*([\d.]+)/);
      result.confidence = confMatch ? parseInt(confMatch[1]) : 60;
      
      const mrMatch = jsonStr.match(/"matchResult"\s*:\s*"?([12X])"?/i);
      result.matchResult = mrMatch ? mrMatch[1].toUpperCase() : 'X';
      
      const mrReasonMatch = jsonStr.match(/"matchResultReasoning"\s*:\s*"([^"]+)"/);
      result.matchResultReasoning = mrReasonMatch ? mrReasonMatch[1] : '';
      
      const bttsMatch = jsonStr.match(/"btts"\s*:\s*"?(Yes|No)"?/i);
      result.btts = bttsMatch ? bttsMatch[1] : 'No';
      
      const bttsReasonMatch = jsonStr.match(/"bttsReasoning"\s*:\s*"([^"]+)"/);
      result.bttsReasoning = bttsReasonMatch ? bttsReasonMatch[1] : '';
      
      const summaryMatch = jsonStr.match(/"agentSummary"\s*:\s*"([^"]+)"/);
      result.agentSummary = summaryMatch ? summaryMatch[1] : '';
      
      return result;
    } catch (e2) {
      console.error('Manual JSON extraction failed:', e2);
      return null;
    }
  }
}

// ==================== AGGRESSIVE CONFIDENCE CALCULATOR ====================

function calculateAggressiveConfidence(
  expectedTotal: number,
  avgOver25: number,
  avgBtts: number,
  formDiff: number,
  dataQuality: number // 0-100 how much data we have
): { overUnderConf: number; matchResultConf: number; bttsConf: number } {
  
  // Over/Under confidence
  let overUnderConf = 55;
  const overUnderStrength = Math.abs(expectedTotal - 2.5);
  if (overUnderStrength > 0.8) overUnderConf = 75 + Math.min(10, overUnderStrength * 5);
  else if (overUnderStrength > 0.5) overUnderConf = 68 + overUnderStrength * 10;
  else if (overUnderStrength > 0.3) overUnderConf = 62 + overUnderStrength * 15;
  else overUnderConf = 55 + overUnderStrength * 20;
  
  // Adjust based on Over 2.5 percentage agreement
  if ((expectedTotal > 2.5 && avgOver25 > 60) || (expectedTotal < 2.5 && avgOver25 < 40)) {
    overUnderConf += 5; // Data agrees
  }
  
  // Match Result confidence
  let matchResultConf = 55;
  if (Math.abs(formDiff) > 8) matchResultConf = 72 + Math.min(13, Math.abs(formDiff) - 8);
  else if (Math.abs(formDiff) > 5) matchResultConf = 65 + (Math.abs(formDiff) - 5) * 2;
  else if (Math.abs(formDiff) > 3) matchResultConf = 58 + (Math.abs(formDiff) - 3) * 3;
  else matchResultConf = 50 + Math.abs(formDiff) * 2;
  
  // BTTS confidence
  let bttsConf = 55;
  const bttsStrength = Math.abs(avgBtts - 50);
  if (bttsStrength > 25) bttsConf = 72 + Math.min(13, (bttsStrength - 25) / 2);
  else if (bttsStrength > 15) bttsConf = 65 + (bttsStrength - 15) / 2;
  else if (bttsStrength > 8) bttsConf = 58 + (bttsStrength - 8);
  else bttsConf = 52 + bttsStrength;
  
  // Data quality multiplier (more data = more confidence)
  const qualityMultiplier = 0.85 + (dataQuality / 100) * 0.15;
  
  return {
    overUnderConf: Math.round(Math.min(85, Math.max(50, overUnderConf * qualityMultiplier))),
    matchResultConf: Math.round(Math.min(82, Math.max(48, matchResultConf * qualityMultiplier))),
    bttsConf: Math.round(Math.min(83, Math.max(50, bttsConf * qualityMultiplier))),
  };
}

// ==================== GENERATE REASONING ====================

function generateStatsReasoning(
  matchData: MatchData,
  homeGoalsScored: number,
  homeGoalsConceded: number,
  awayGoalsScored: number,
  awayGoalsConceded: number,
  homeExpected: number,
  awayExpected: number,
  expectedTotal: number,
  avgOver25: number,
  avgBtts: number,
  homeForm: string,
  awayForm: string,
  homePoints: number,
  awayPoints: number,
  language: 'tr' | 'en' | 'de'
): { overUnderReasoning: string; matchResultReasoning: string; bttsReasoning: string; agentSummary: string } {
  
  const homeWins = (homeForm.match(/W/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  const homeLosses = (homeForm.match(/L/g) || []).length;
  const awayLosses = (awayForm.match(/L/g) || []).length;
  
  if (language === 'tr') {
    const overUnderReasoning = expectedTotal >= 2.5
      ? `📊 Ev sahibi maç başı ${homeGoalsScored.toFixed(1)} gol atıyor, deplasman ${awayGoalsConceded.toFixed(1)} gol yiyor. Toplam beklenti: ${expectedTotal.toFixed(2)} gol. Son maçlarda Over 2.5 oranı %${avgOver25}. Güçlü Over sinyali.`
      : `📊 Ev sahibi ${homeGoalsScored.toFixed(1)} gol/maç, deplasman ${awayGoalsScored.toFixed(1)} gol/maç. Toplam beklenti: ${expectedTotal.toFixed(2)} gol. Under 2.5 oranı %${100 - avgOver25}. Düşük skorlu maç bekleniyor.`;
    
    const matchResultReasoning = homePoints > awayPoints
      ? `🏠 Ev sahibi form: ${homeForm} (${homePoints} puan, ${homeWins}G-${5-homeWins-homeLosses}B-${homeLosses}M). Deplasman: ${awayForm} (${awayPoints} puan). ${homePoints - awayPoints} puan farkı + ev avantajı → MS 1`
      : awayPoints > homePoints
      ? `🚌 Deplasman form: ${awayForm} (${awayPoints} puan, ${awayWins}G). Ev sahibi: ${homeForm} (${homePoints} puan). Deplasman ${awayPoints - homePoints} puan önde → MS 2`
      : `⚖️ Ev: ${homeForm} (${homePoints}p) vs Dep: ${awayForm} (${awayPoints}p). Formlar dengeli, ev avantajı hafif üstünlük → MS 1X`;
    
    const bttsReasoning = avgBtts >= 55
      ? `⚽ Ev sahibi %${Math.round(100 - (homeLosses/5)*100)} maçta gol attı. Deplasman %${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)} maçta gol buldu. Birleşik KG Var oranı %${avgBtts}. Her iki takım da gol atar.`
      : `🛡️ Ev sahibi ${homeGoalsConceded.toFixed(1)} gol/maç yiyor, deplasman ${awayGoalsScored.toFixed(1)} gol/maç atıyor. KG Var oranı %${avgBtts} düşük. Tek taraflı skor olasılığı yüksek.`;
    
    const agentSummary = `📊 STATS: Form analizi ${homePoints > awayPoints ? 'ev sahibi' : awayPoints > homePoints ? 'deplasman' : 'dengeli'}. Gol beklentisi ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Over' : 'Under'}). KG ${avgBtts >= 55 ? 'Var' : 'Yok'} eğilimli.`;
    
    return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
  }
  
  // English (default)
  const overUnderReasoning = expectedTotal >= 2.5
    ? `📊 Home scores ${homeGoalsScored.toFixed(1)} goals/game, away concedes ${awayGoalsConceded.toFixed(1)}. Expected total: ${expectedTotal.toFixed(2)} goals. Over 2.5 rate: ${avgOver25}%. Strong Over signal.`
    : `📊 Home ${homeGoalsScored.toFixed(1)} goals/game, away ${awayGoalsScored.toFixed(1)} goals/game. Expected: ${expectedTotal.toFixed(2)} goals. Under 2.5 rate: ${100 - avgOver25}%. Low-scoring match expected.`;
  
  const matchResultReasoning = homePoints > awayPoints
    ? `🏠 Home form: ${homeForm} (${homePoints} pts, ${homeWins}W-${5-homeWins-homeLosses}D-${homeLosses}L). Away: ${awayForm} (${awayPoints} pts). ${homePoints - awayPoints} pts gap + home advantage → Home win`
    : awayPoints > homePoints
    ? `🚌 Away form: ${awayForm} (${awayPoints} pts, ${awayWins}W). Home: ${homeForm} (${homePoints} pts). Away ${awayPoints - homePoints} pts ahead → Away win`
    : `⚖️ Home: ${homeForm} (${homePoints}p) vs Away: ${awayForm} (${awayPoints}p). Balanced forms, slight home edge → Home or Draw`;
  
  const bttsReasoning = avgBtts >= 55
    ? `⚽ Home scored in ${Math.round(100 - (homeLosses/5)*100)}% of matches. Away scored in ${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)}%. Combined BTTS rate: ${avgBtts}%. Both teams likely to score.`
    : `🛡️ Home concedes ${homeGoalsConceded.toFixed(1)} goals/game, away scores ${awayGoalsScored.toFixed(1)}. BTTS rate ${avgBtts}% is low. One-sided score likely.`;
  
  const agentSummary = `📊 STATS: Form favors ${homePoints > awayPoints ? 'home' : awayPoints > homePoints ? 'away' : 'neither'}. Goal expectancy ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Over' : 'Under'}). BTTS ${avgBtts >= 55 ? 'Yes' : 'No'} trend.`;
  
  return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
}

// ==================== STATS AGENT ====================

export async function runStatsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  console.log('📊 Stats Agent starting AGGRESSIVE analysis...');
  
  // Detaylı verileri al (varsa)
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const detailedH2H = (matchData as any).detailedStats?.h2h;
  const injuries = (matchData as any).detailedStats?.injuries;

  // Gol ortalamaları
  const homeGoalsScored = parseFloat(detailedHome?.avgGoalsScored || matchData.homeForm?.avgGoals || '1.2');
  const homeGoalsConceded = parseFloat(detailedHome?.avgGoalsConceded || matchData.homeForm?.avgConceded || '1.0');
  const awayGoalsScored = parseFloat(detailedAway?.avgGoalsScored || matchData.awayForm?.avgGoals || '1.0');
  const awayGoalsConceded = parseFloat(detailedAway?.avgGoalsConceded || matchData.awayForm?.avgConceded || '1.2');
  
  // Beklenen goller
  const homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  const expectedTotal = homeExpected + awayExpected;
  
  // Form verileri
  const homeForm = detailedHome?.form || matchData.homeForm?.form || 'DDDDD';
  const awayForm = detailedAway?.form || matchData.awayForm?.form || 'DDDDD';
  const homePoints = detailedHome?.points || matchData.homeForm?.points || 5;
  const awayPoints = detailedAway?.points || matchData.awayForm?.points || 5;
  
  // Over 2.5 yüzdeleri
  const homeOver25 = parseFloat(detailedHome?.over25Percentage || matchData.homeForm?.over25Percentage || '50');
  const awayOver25 = parseFloat(detailedAway?.over25Percentage || matchData.awayForm?.over25Percentage || '50');
  const h2hOver25 = parseFloat(detailedH2H?.over25Percentage || matchData.h2h?.over25Percentage || '50');
  const avgOver25 = Math.round((homeOver25 + awayOver25 + h2hOver25) / 3);
  
  // BTTS yüzdeleri
  const homeBtts = parseFloat(detailedHome?.bttsPercentage || matchData.homeForm?.bttsPercentage || '50');
  const awayBtts = parseFloat(detailedAway?.bttsPercentage || matchData.awayForm?.bttsPercentage || '50');
  const h2hBtts = parseFloat(detailedH2H?.bttsPercentage || matchData.h2h?.bttsPercentage || '50');
  const avgBtts = Math.round((homeBtts + awayBtts + h2hBtts) / 3);

  // Data quality (how much real data we have)
  const dataQuality = Math.min(100, 
    ((detailedHome?.matchCount || 0) + (detailedAway?.matchCount || 0) + (detailedH2H?.totalMatches || 0)) * 5
  );

  // Calculate aggressive confidence
  const formDiff = homePoints - awayPoints;
  const confidences = calculateAggressiveConfidence(expectedTotal, avgOver25, avgBtts, formDiff, dataQuality);

  // Generate detailed reasoning
  const reasoning = generateStatsReasoning(
    matchData,
    homeGoalsScored, homeGoalsConceded,
    awayGoalsScored, awayGoalsConceded,
    homeExpected, awayExpected, expectedTotal,
    avgOver25, avgBtts,
    homeForm, awayForm,
    homePoints, awayPoints,
    language
  );

  // Son maç detayları
  const homeMatchDetails = detailedHome?.matchDetails || [];
  const awayMatchDetails = detailedAway?.matchDetails || [];
  const h2hMatchDetails = detailedH2H?.matchDetails || [];

  // Prompt oluştur
  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}
LEAGUE: ${matchData.league || 'Unknown'}

═══════════════════════════════════════════════════════════════
🏠 HOME: ${matchData.homeTeam}
═══════════════════════════════════════════════════════════════
FORM: ${homeForm} | Record: ${detailedHome?.record || 'N/A'} | Points: ${homePoints}/15
Goals: ${homeGoalsScored.toFixed(2)} scored, ${homeGoalsConceded.toFixed(2)} conceded per game
Over 2.5: ${homeOver25}% | BTTS: ${homeBtts}% | Clean Sheets: ${detailedHome?.cleanSheetPercentage || '?'}%

${homeMatchDetails.length > 0 ? `Last 5: ${homeMatchDetails.map((m: any) => `${m.score}(${m.result})`).join(', ')}` : ''}

═══════════════════════════════════════════════════════════════
🚌 AWAY: ${matchData.awayTeam}
═══════════════════════════════════════════════════════════════
FORM: ${awayForm} | Record: ${detailedAway?.record || 'N/A'} | Points: ${awayPoints}/15
Goals: ${awayGoalsScored.toFixed(2)} scored, ${awayGoalsConceded.toFixed(2)} conceded per game
Over 2.5: ${awayOver25}% | BTTS: ${awayBtts}% | Clean Sheets: ${detailedAway?.cleanSheetPercentage || '?'}%

${awayMatchDetails.length > 0 ? `Last 5: ${awayMatchDetails.map((m: any) => `${m.score}(${m.result})`).join(', ')}` : ''}

═══════════════════════════════════════════════════════════════
🔄 H2H (${detailedH2H?.totalMatches || 0} matches)
═══════════════════════════════════════════════════════════════
${matchData.homeTeam}: ${detailedH2H?.homeWins || 0}W | Draws: ${detailedH2H?.draws || 0} | ${matchData.awayTeam}: ${detailedH2H?.awayWins || 0}W
Avg Goals: ${detailedH2H?.avgTotalGoals || '?'} | Over 2.5: ${h2hOver25}% | BTTS: ${h2hBtts}%

═══════════════════════════════════════════════════════════════
📊 CALCULATED (BE AGGRESSIVE!)
═══════════════════════════════════════════════════════════════
Expected Goals: ${matchData.homeTeam} ${homeExpected.toFixed(2)} - ${awayExpected.toFixed(2)} ${matchData.awayTeam}
TOTAL EXPECTED: ${expectedTotal.toFixed(2)} goals
Combined Over 2.5: ${avgOver25}% | Combined BTTS: ${avgBtts}%
Form Difference: ${formDiff > 0 ? '+' : ''}${formDiff} points (${formDiff > 3 ? 'HOME favored' : formDiff < -3 ? 'AWAY favored' : 'BALANCED'})

MINIMUM CONFIDENCE: ${Math.min(confidences.overUnderConf, confidences.matchResultConf, confidences.bttsConf)}%
TARGET CONFIDENCE: ${Math.max(confidences.overUnderConf, confidences.matchResultConf, confidences.bttsConf)}%

Be AGGRESSIVE! Make confident predictions with detailed reasoning. Return JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await heurist.chat(messages, { temperature: 0.2, maxTokens: 1000 });
    
    if (response) {
      const parsed = extractJSON(response);
      if (parsed) {
        // Validate and enhance with calculated values
        if (typeof parsed.goalExpectancy === 'string') {
          parsed.goalExpectancy = parseFloat(parsed.goalExpectancy);
        }
        if (!parsed.goalExpectancy || isNaN(parsed.goalExpectancy)) {
          parsed.goalExpectancy = expectedTotal;
        }
        
        // Use aggressive confidence if AI gave lower
        if (!parsed.confidence || parsed.confidence < confidences.overUnderConf - 10) {
          parsed.confidence = confidences.overUnderConf;
        }
        parsed.confidence = Math.min(85, Math.max(50, parsed.confidence));
        
        // Add reasoning if missing
        if (!parsed.overUnderReasoning || parsed.overUnderReasoning.length < 20) {
          parsed.overUnderReasoning = reasoning.overUnderReasoning;
        }
        if (!parsed.matchResultReasoning || parsed.matchResultReasoning.length < 20) {
          parsed.matchResultReasoning = reasoning.matchResultReasoning;
        }
        if (!parsed.bttsReasoning || parsed.bttsReasoning.length < 20) {
          parsed.bttsReasoning = reasoning.bttsReasoning;
        }
        if (!parsed.agentSummary) {
          parsed.agentSummary = reasoning.agentSummary;
        }
        
        // Match result validation
        if (!['1', '2', 'X'].includes(parsed.matchResult?.toUpperCase())) {
          if (formDiff > 3) parsed.matchResult = '1';
          else if (formDiff < -3) parsed.matchResult = '2';
          else if (homeExpected > awayExpected + 0.3) parsed.matchResult = '1';
          else if (awayExpected > homeExpected + 0.3) parsed.matchResult = '2';
          else parsed.matchResult = 'X';
        } else {
          parsed.matchResult = parsed.matchResult.toUpperCase();
        }
        
        // Over/Under validation
        if (!['Over', 'Under'].includes(parsed.overUnder)) {
          parsed.overUnder = (expectedTotal >= 2.5 || avgOver25 >= 55) ? 'Over' : 'Under';
        }
        
        // BTTS validation
        if (!['Yes', 'No'].includes(parsed.btts)) {
          parsed.btts = avgBtts >= 55 ? 'Yes' : 'No';
        }
        
        // Add all calculated stats
        parsed._calculatedStats = {
          expectedTotal: expectedTotal.toFixed(2),
          homeExpected: homeExpected.toFixed(2),
          awayExpected: awayExpected.toFixed(2),
          avgOver25,
          avgBtts,
          formDiff,
          dataQuality,
          confidences,
        };
        
        // Add individual confidences
        parsed.overUnderConfidence = confidences.overUnderConf;
        parsed.matchResultConfidence = confidences.matchResultConf;
        parsed.bttsConfidence = confidences.bttsConf;
        
        console.log(`✅ Stats Agent: ${parsed.matchResult} (${parsed.matchResultConfidence}%) | ${parsed.overUnder} (${parsed.overUnderConfidence}%) | BTTS: ${parsed.btts} (${parsed.bttsConfidence}%)`);
        console.log(`   📝 Summary: ${parsed.agentSummary}`);
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ Stats agent error:', error);
  }

  // Fallback with aggressive values
  const fallbackOverUnder = (expectedTotal >= 2.5 || avgOver25 >= 55) ? 'Over' : 'Under';
  const fallbackMatchResult = formDiff > 3 ? '1' : formDiff < -3 ? '2' : (homeExpected > awayExpected ? '1' : 'X');
  const fallbackBtts = avgBtts >= 55 ? 'Yes' : 'No';
  
  const fallbackResult = {
    formAnalysis: `${matchData.homeTeam}: ${homeForm} (${homePoints}pts, ${homeGoalsScored.toFixed(1)} gol/maç) vs ${matchData.awayTeam}: ${awayForm} (${awayPoints}pts, ${awayGoalsScored.toFixed(1)} gol/maç)`,
    goalExpectancy: parseFloat(expectedTotal.toFixed(2)),
    overUnder: fallbackOverUnder,
    overUnderReasoning: reasoning.overUnderReasoning,
    overUnderConfidence: confidences.overUnderConf,
    confidence: confidences.overUnderConf,
    matchResult: fallbackMatchResult,
    matchResultReasoning: reasoning.matchResultReasoning,
    matchResultConfidence: confidences.matchResultConf,
    btts: fallbackBtts,
    bttsReasoning: reasoning.bttsReasoning,
    bttsConfidence: confidences.bttsConf,
    keyStats: [
      `Expected goals: ${expectedTotal.toFixed(2)}`,
      `Over 2.5 rate: ${avgOver25}%`,
      `BTTS rate: ${avgBtts}%`,
      `Form diff: ${formDiff > 0 ? '+' : ''}${formDiff} pts`,
    ],
    riskFactors: dataQuality < 50 ? ['Limited historical data'] : [],
    agentSummary: reasoning.agentSummary,
    _calculatedStats: {
      expectedTotal: expectedTotal.toFixed(2),
      homeExpected: homeExpected.toFixed(2),
      awayExpected: awayExpected.toFixed(2),
      avgOver25,
      avgBtts,
      formDiff,
      dataQuality,
      confidences,
    },
  };
  
  console.log(`⚠️ Stats Agent Fallback: ${fallbackResult.matchResult} | ${fallbackResult.overUnder} | BTTS: ${fallbackResult.btts}`);
  console.log(`   📝 Summary: ${fallbackResult.agentSummary}`);
  return fallbackResult;
}
