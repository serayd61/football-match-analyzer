import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen bir profesyonel futbol istatistik analistisin. Verilen GERÇEK maç verilerini analiz et.

GÖREV: Form, gol istatistikleri ve H2H verilerini matematiksel olarak değerlendir.

KRİTİK KURALLAR:
- Sadece verilen verileri kullan, tahmin yapma
- Gol ortalamaları GERÇEK skorlardan hesaplanmış
- Over 2.5 yüzdeleri GERÇEK maç sonuçlarından
- Güven oranını verilerin tutarlılığına göre belirle

SADECE JSON DÖNDÜR:
{
  "formAnalysis": "detaylı form karşılaştırması",
  "goalExpectancy": 2.5,
  "overUnder": "Over",
  "overUnderReasoning": "neden bu tahmini yaptın",
  "confidence": 65,
  "matchResult": "1",
  "matchResultReasoning": "neden bu sonucu bekliyorsun",
  "btts": "Yes",
  "bttsReasoning": "BTTS için gerekçe",
  "keyStats": ["önemli istatistik 1", "istatistik 2", "istatistik 3"],
  "riskFactors": ["risk 1", "risk 2"]
}`,

  en: `You are a professional football statistics analyst. Analyze the provided REAL match data.

TASK: Evaluate form, goal statistics and H2H data mathematically.

CRITICAL RULES:
- Use ONLY the provided data, don't guess
- Goal averages are calculated from REAL scores
- Over 2.5 percentages are from REAL match results
- Set confidence based on data consistency

RETURN ONLY JSON:
{
  "formAnalysis": "detailed form comparison",
  "goalExpectancy": 2.5,
  "overUnder": "Over",
  "overUnderReasoning": "why this prediction",
  "confidence": 65,
  "matchResult": "1",
  "matchResultReasoning": "why this result expected",
  "btts": "Yes",
  "bttsReasoning": "BTTS reasoning",
  "keyStats": ["key stat 1", "stat 2", "stat 3"],
  "riskFactors": ["risk 1", "risk 2"]
}`,

  de: `Du bist ein professioneller Fußball-Statistikanalyst. Analysiere die echten Matchdaten.

AUFGABE: Form, Torstatistiken und H2H mathematisch bewerten.

NUR JSON ZURÜCKGEBEN:
{
  "formAnalysis": "Formvergleich",
  "goalExpectancy": 2.5,
  "overUnder": "Over",
  "overUnderReasoning": "Begründung",
  "confidence": 65,
  "matchResult": "1",
  "matchResultReasoning": "Begründung",
  "btts": "Yes",
  "bttsReasoning": "Begründung",
  "keyStats": ["Statistik 1", "Statistik 2"],
  "riskFactors": ["Risiko 1"]
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
      
      const confMatch = jsonStr.match(/"confidence"\s*:\s*([\d.]+)/);
      result.confidence = confMatch ? parseInt(confMatch[1]) : 60;
      
      const mrMatch = jsonStr.match(/"matchResult"\s*:\s*"?([12X])"?/i);
      result.matchResult = mrMatch ? mrMatch[1].toUpperCase() : 'X';
      
      const bttsMatch = jsonStr.match(/"btts"\s*:\s*"?(Yes|No)"?/i);
      result.btts = bttsMatch ? bttsMatch[1] : 'No';
      
      return result;
    } catch (e2) {
      console.error('Manual JSON extraction failed:', e2);
      return null;
    }
  }
}

// ==================== STATS AGENT ====================

export async function runStatsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
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
  
  // Over 2.5 yüzdeleri
  const homeOver25 = detailedHome?.over25Percentage || parseInt(matchData.homeForm?.over25Percentage || '50');
  const awayOver25 = detailedAway?.over25Percentage || parseInt(matchData.awayForm?.over25Percentage || '50');
  const h2hOver25 = detailedH2H?.over25Percentage || parseInt(matchData.h2h?.over25Percentage || '50');
  
  // BTTS yüzdeleri
  const homeBtts = detailedHome?.bttsPercentage || parseInt(matchData.homeForm?.bttsPercentage || '50');
  const awayBtts = detailedAway?.bttsPercentage || parseInt(matchData.awayForm?.bttsPercentage || '50');
  const h2hBtts = detailedH2H?.bttsPercentage || parseInt(matchData.h2h?.bttsPercentage || '50');

  // Son maç detayları
  const homeMatchDetails = detailedHome?.matchDetails || [];
  const awayMatchDetails = detailedAway?.matchDetails || [];
  const h2hMatchDetails = detailedH2H?.matchDetails || [];

  // Prompt oluştur - ÇOK DETAYLI
  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}
LEAGUE: ${matchData.league || 'Unknown'}

═══════════════════════════════════════════════════════════════
🏠 HOME TEAM: ${matchData.homeTeam}
═══════════════════════════════════════════════════════════════
FORM (Last 5): ${matchData.homeForm?.form || detailedHome?.form || 'N/A'}
Record: ${detailedHome?.record || 'N/A'}
Points: ${matchData.homeForm?.points || detailedHome?.points || 0}/15

GOAL STATS (from ${detailedHome?.matchCount || 10} real matches):
- Goals Scored: ${homeGoalsScored.toFixed(2)} per game (Total: ${detailedHome?.totalGoalsScored || '?'})
- Goals Conceded: ${homeGoalsConceded.toFixed(2)} per game (Total: ${detailedHome?.totalGoalsConceded || '?'})

BETTING STATS:
- Over 2.5 Rate: ${homeOver25}% (${detailedHome?.over25Count || '?'}/${detailedHome?.matchCount || '?'} matches)
- BTTS Rate: ${homeBtts}% (${detailedHome?.bttsCount || '?'}/${detailedHome?.matchCount || '?'} matches)
- Clean Sheets: ${detailedHome?.cleanSheets || '?'} (${detailedHome?.cleanSheetPercentage || '?'}%)
- Failed to Score: ${detailedHome?.failedToScore || '?'} (${detailedHome?.failedToScorePercentage || '?'}%)

${homeMatchDetails.length > 0 ? `LAST 5 MATCHES:
${homeMatchDetails.map((m: any, i: number) => `  ${i+1}. ${m.isHome ? 'H' : 'A'} vs ${m.opponent}: ${m.score} (${m.result})`).join('\n')}` : ''}

${injuries?.home?.length > 0 ? `INJURIES:
${injuries.home.map((inj: any) => `  - ${inj.player} (${inj.type})`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════════
🚌 AWAY TEAM: ${matchData.awayTeam}
═══════════════════════════════════════════════════════════════
FORM (Last 5): ${matchData.awayForm?.form || detailedAway?.form || 'N/A'}
Record: ${detailedAway?.record || 'N/A'}
Points: ${matchData.awayForm?.points || detailedAway?.points || 0}/15

GOAL STATS (from ${detailedAway?.matchCount || 10} real matches):
- Goals Scored: ${awayGoalsScored.toFixed(2)} per game (Total: ${detailedAway?.totalGoalsScored || '?'})
- Goals Conceded: ${awayGoalsConceded.toFixed(2)} per game (Total: ${detailedAway?.totalGoalsConceded || '?'})

BETTING STATS:
- Over 2.5 Rate: ${awayOver25}% (${detailedAway?.over25Count || '?'}/${detailedAway?.matchCount || '?'} matches)
- BTTS Rate: ${awayBtts}% (${detailedAway?.bttsCount || '?'}/${detailedAway?.matchCount || '?'} matches)
- Clean Sheets: ${detailedAway?.cleanSheets || '?'} (${detailedAway?.cleanSheetPercentage || '?'}%)
- Failed to Score: ${detailedAway?.failedToScore || '?'} (${detailedAway?.failedToScorePercentage || '?'}%)

${awayMatchDetails.length > 0 ? `LAST 5 MATCHES:
${awayMatchDetails.map((m: any, i: number) => `  ${i+1}. ${m.isHome ? 'H' : 'A'} vs ${m.opponent}: ${m.score} (${m.result})`).join('\n')}` : ''}

${injuries?.away?.length > 0 ? `INJURIES:
${injuries.away.map((inj: any) => `  - ${inj.player} (${inj.type})`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════════
🔄 HEAD TO HEAD (Last ${detailedH2H?.totalMatches || matchData.h2h?.totalMatches || 0} matches)
═══════════════════════════════════════════════════════════════
${matchData.homeTeam} Wins: ${detailedH2H?.homeWins || matchData.h2h?.homeWins || 0}
Draws: ${detailedH2H?.draws || matchData.h2h?.draws || 0}
${matchData.awayTeam} Wins: ${detailedH2H?.awayWins || matchData.h2h?.awayWins || 0}

H2H Goal Stats:
- Average Total Goals: ${detailedH2H?.avgTotalGoals || matchData.h2h?.avgGoals || '?'}
- ${matchData.homeTeam} Avg: ${detailedH2H?.avgHomeGoals || '?'} goals
- ${matchData.awayTeam} Avg: ${detailedH2H?.avgAwayGoals || '?'} goals

H2H Betting Stats:
- Over 2.5 Rate: ${h2hOver25}% (${detailedH2H?.over25Count || '?'}/${detailedH2H?.totalMatches || '?'} matches)
- BTTS Rate: ${h2hBtts}% (${detailedH2H?.bttsCount || '?'}/${detailedH2H?.totalMatches || '?'} matches)

${h2hMatchDetails.length > 0 ? `RECENT H2H MATCHES:
${h2hMatchDetails.map((m: any, i: number) => `  ${i+1}. ${m.homeTeam} ${m.score} ${m.awayTeam} → ${m.winner}`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════════
📊 CALCULATED PREDICTIONS
═══════════════════════════════════════════════════════════════
Expected ${matchData.homeTeam} Goals: ${homeExpected.toFixed(2)}
Expected ${matchData.awayTeam} Goals: ${awayExpected.toFixed(2)}
Expected Total Goals: ${expectedTotal.toFixed(2)}

Combined Over 2.5 Probability: ${Math.round((homeOver25 + awayOver25 + h2hOver25) / 3)}%
Combined BTTS Probability: ${Math.round((homeBtts + awayBtts + h2hBtts) / 3)}%

Based on this REAL data, provide your analysis. RETURN ONLY VALID JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    console.log('📊 Stats Agent analyzing with detailed data...');
    const response = await heurist.chat(messages, { temperature: 0.2, maxTokens: 800 });
    
    if (response) {
      const parsed = extractJSON(response);
      if (parsed) {
        // Validate and fix values
        if (typeof parsed.goalExpectancy === 'string') {
          parsed.goalExpectancy = parseFloat(parsed.goalExpectancy);
        }
        if (!parsed.goalExpectancy || isNaN(parsed.goalExpectancy)) {
          parsed.goalExpectancy = expectedTotal;
        }
        
        // Confidence validation (45-80 range)
        if (!parsed.confidence || isNaN(parsed.confidence)) {
          parsed.confidence = 60;
        }
        parsed.confidence = Math.min(80, Math.max(45, parsed.confidence));
        
        // Match result validation
        if (!['1', '2', 'X'].includes(parsed.matchResult?.toUpperCase())) {
          if (homeExpected > awayExpected + 0.3) parsed.matchResult = '1';
          else if (awayExpected > homeExpected + 0.3) parsed.matchResult = '2';
          else parsed.matchResult = 'X';
        } else {
          parsed.matchResult = parsed.matchResult.toUpperCase();
        }
        
        // Over/Under validation
        if (!['Over', 'Under'].includes(parsed.overUnder)) {
          const avgOver25 = (homeOver25 + awayOver25 + h2hOver25) / 3;
          parsed.overUnder = (expectedTotal >= 2.5 || avgOver25 >= 55) ? 'Over' : 'Under';
        }
        
        // BTTS validation
        if (!['Yes', 'No'].includes(parsed.btts)) {
          const avgBtts = (homeBtts + awayBtts + h2hBtts) / 3;
          parsed.btts = avgBtts >= 55 ? 'Yes' : 'No';
        }
        
        // Add calculated stats for reference
        parsed._calculatedStats = {
          expectedTotal: expectedTotal.toFixed(2),
          homeExpected: homeExpected.toFixed(2),
          awayExpected: awayExpected.toFixed(2),
          avgOver25: Math.round((homeOver25 + awayOver25 + h2hOver25) / 3),
          avgBtts: Math.round((homeBtts + awayBtts + h2hBtts) / 3),
        };
        
        console.log(`✅ Stats Agent: ${parsed.matchResult} | ${parsed.overUnder} | BTTS: ${parsed.btts} | Conf: ${parsed.confidence}%`);
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ Stats agent error:', error);
  }

  // Fallback - calculated values
  const avgOver25 = (homeOver25 + awayOver25 + h2hOver25) / 3;
  const avgBtts = (homeBtts + awayBtts + h2hBtts) / 3;
  
  const fallbackResult = {
    formAnalysis: `${matchData.homeTeam}: ${matchData.homeForm?.form || 'N/A'} (${homeGoalsScored.toFixed(1)} gol/maç) vs ${matchData.awayTeam}: ${matchData.awayForm?.form || 'N/A'} (${awayGoalsScored.toFixed(1)} gol/maç)`,
    goalExpectancy: parseFloat(expectedTotal.toFixed(2)),
    overUnder: (expectedTotal >= 2.5 || avgOver25 >= 55) ? 'Over' : 'Under',
    overUnderReasoning: `Expected total: ${expectedTotal.toFixed(2)}, Avg Over 2.5 rate: ${avgOver25.toFixed(0)}%`,
    confidence: Math.round(50 + Math.min(20, Math.abs(expectedTotal - 2.5) * 10)),
    matchResult: homeExpected > awayExpected + 0.3 ? '1' : (awayExpected > homeExpected + 0.3 ? '2' : 'X'),
    matchResultReasoning: `Home expected: ${homeExpected.toFixed(2)}, Away expected: ${awayExpected.toFixed(2)}`,
    btts: avgBtts >= 55 ? 'Yes' : 'No',
    bttsReasoning: `Combined BTTS rate: ${avgBtts.toFixed(0)}%`,
    keyStats: [
      `Expected goals: ${expectedTotal.toFixed(2)}`,
      `Over 2.5 avg: ${avgOver25.toFixed(0)}%`,
      `BTTS avg: ${avgBtts.toFixed(0)}%`,
    ],
    riskFactors: [],
    _calculatedStats: {
      expectedTotal: expectedTotal.toFixed(2),
      homeExpected: homeExpected.toFixed(2),
      awayExpected: awayExpected.toFixed(2),
      avgOver25: Math.round(avgOver25),
      avgBtts: Math.round(avgBtts),
    },
  };
  
  console.log(`⚠️ Stats Agent Fallback: ${fallbackResult.matchResult} | ${fallbackResult.overUnder} | BTTS: ${fallbackResult.btts}`);
  return fallbackResult;
}
