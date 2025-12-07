import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen bir futbol keşif ajanısın. Takımların durumunu değerlendir.

GÖREV: Sakatlıklar, cezalılar ve takım durumunu özetle.

SADECE JSON DÖNDÜR:
{
  "summary": "maç özeti",
  "homeTeamStatus": "ev sahibi durumu",
  "awayTeamStatus": "deplasman durumu",
  "injuries": ["sakatlık 1", "sakatlık 2"],
  "suspensions": ["cezalı 1"],
  "keyFactors": ["faktör 1", "faktör 2"],
  "weather": null,
  "homeAdvantage": "normal/strong/weak",
  "note": "ek notlar"
}`,

  en: `You are a football scout agent. Evaluate team situations.

TASK: Summarize injuries, suspensions and team status.

RETURN ONLY JSON:
{
  "summary": "match summary",
  "homeTeamStatus": "home team status",
  "awayTeamStatus": "away team status",
  "injuries": ["injury 1", "injury 2"],
  "suspensions": ["suspended 1"],
  "keyFactors": ["factor 1", "factor 2"],
  "weather": null,
  "homeAdvantage": "normal/strong/weak",
  "note": "additional notes"
}`,

  de: `Du bist ein Fußball-Scout. Bewerte die Teamsituation.

NUR JSON ZURÜCKGEBEN:
{
  "summary": "Spielzusammenfassung",
  "homeTeamStatus": "Heimteam Status",
  "awayTeamStatus": "Auswärtsteam Status",
  "injuries": ["Verletzung 1"],
  "suspensions": ["Gesperrt 1"],
  "keyFactors": ["Faktor 1"],
  "weather": null,
  "homeAdvantage": "normal/strong/weak",
  "note": "Notizen"
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
  
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
  jsonStr = jsonStr.replace(/'/g, '"');
  jsonStr = jsonStr.replace(/\n/g, ' ');
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// ==================== SCOUT AGENT ====================

export async function runScoutAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  // Detaylı verileri al
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const injuries = (matchData as any).detailedStats?.injuries;

  // Form bilgileri
  const homeForm = matchData.homeForm?.form || detailedHome?.form || 'N/A';
  const awayForm = matchData.awayForm?.form || detailedAway?.form || 'N/A';
  
  // Form analizi
  const homeWins = (homeForm.match(/W/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  
  // Sakatlık listesi
  const homeInjuries = injuries?.home || [];
  const awayInjuries = injuries?.away || [];

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}
LEAGUE: ${matchData.league || 'Unknown'}

═══════════════════════════════════════════════════════════════
🏠 HOME TEAM: ${matchData.homeTeam}
═══════════════════════════════════════════════════════════════
Form (Last 5): ${homeForm}
Wins in last 5: ${homeWins}

${homeInjuries.length > 0 ? `INJURIES (${homeInjuries.length} players):
${homeInjuries.map((inj: any) => `- ${inj.player} (${inj.type}) - Expected return: ${inj.expectedReturn || 'Unknown'}`).join('\n')}` : 'INJURIES: None reported'}

═══════════════════════════════════════════════════════════════
🚌 AWAY TEAM: ${matchData.awayTeam}
═══════════════════════════════════════════════════════════════
Form (Last 5): ${awayForm}
Wins in last 5: ${awayWins}

${awayInjuries.length > 0 ? `INJURIES (${awayInjuries.length} players):
${awayInjuries.map((inj: any) => `- ${inj.player} (${inj.type}) - Expected return: ${inj.expectedReturn || 'Unknown'}`).join('\n')}` : 'INJURIES: None reported'}

═══════════════════════════════════════════════════════════════
📊 QUICK ANALYSIS
═══════════════════════════════════════════════════════════════
Home Form Rating: ${homeWins >= 3 ? 'Good' : (homeWins >= 2 ? 'Average' : 'Poor')}
Away Form Rating: ${awayWins >= 3 ? 'Good' : (awayWins >= 2 ? 'Average' : 'Poor')}
Total Injuries Impact: ${(homeInjuries.length + awayInjuries.length) > 3 ? 'High' : 'Low'}

Based on this data, provide your scout report. RETURN ONLY VALID JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    console.log('🔍 Scout Agent analyzing...');
    const response = await heurist.chat(messages, { temperature: 0.3, maxTokens: 600 });
    
    if (response) {
      const parsed = extractJSON(response);
      if (parsed) {
        // Sakatlık verilerini ekle (API'dan gelen gerçek veri)
        if (homeInjuries.length > 0 || awayInjuries.length > 0) {
          parsed.injuries = [
            ...homeInjuries.map((inj: any) => `${matchData.homeTeam}: ${inj.player} (${inj.type})`),
            ...awayInjuries.map((inj: any) => `${matchData.awayTeam}: ${inj.player} (${inj.type})`),
          ];
          parsed._realInjuryData = true;
        }
        
        // Detaylı sakatlık bilgisi
        parsed.injuryDetails = {
          home: homeInjuries,
          away: awayInjuries,
          totalCount: homeInjuries.length + awayInjuries.length,
        };
        
        console.log(`✅ Scout Agent: ${parsed.homeTeamStatus} vs ${parsed.awayTeamStatus} | Injuries: ${parsed.injuryDetails.totalCount}`);
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ Scout agent error:', error);
  }

  // Fallback
  const homeStatus = homeWins >= 3 ? 'Good form' : (homeWins >= 2 ? 'Mixed form' : 'Poor form');
  const awayStatus = awayWins >= 3 ? 'Good form' : (awayWins >= 2 ? 'Mixed form' : 'Poor form');
  
  return {
    summary: `${matchData.homeTeam} (${homeForm}) vs ${matchData.awayTeam} (${awayForm})`,
    homeTeamStatus: homeStatus,
    awayTeamStatus: awayStatus,
    injuries: [
      ...homeInjuries.map((inj: any) => `${matchData.homeTeam}: ${inj.player} (${inj.type})`),
      ...awayInjuries.map((inj: any) => `${matchData.awayTeam}: ${inj.player} (${inj.type})`),
    ],
    suspensions: [],
    keyFactors: [
      `${matchData.homeTeam} has ${homeWins} wins in last 5`,
      `${matchData.awayTeam} has ${awayWins} wins in last 5`,
    ],
    weather: null,
    homeAdvantage: 'normal',
    note: homeInjuries.length === 0 && awayInjuries.length === 0 
      ? 'No injury data available from API' 
      : `${homeInjuries.length + awayInjuries.length} injuries reported`,
    injuryDetails: {
      home: homeInjuries,
      away: awayInjuries,
      totalCount: homeInjuries.length + awayInjuries.length,
    },
    _realInjuryData: homeInjuries.length > 0 || awayInjuries.length > 0,
  };
}
