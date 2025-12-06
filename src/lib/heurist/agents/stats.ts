import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

const PROMPTS = {
  tr: `Sen bir istatistik analisti ajanısın. SADECE verilen verileri kullan.

GÖREV: Form ve istatistik verilerini analiz et, matematiksel sonuç çıkar.

SADECE JSON DÖNDÜR, BAŞKA BİR ŞEY YAZMA:
{
  "formAnalysis": "kısa form karşılaştırması",
  "goalExpectancy": 2.5,
  "overUnder": "Over",
  "confidence": 70,
  "matchResult": "1",
  "btts": "Yes",
  "keyStats": ["istatistik 1", "istatistik 2"]
}`,

  en: `You are a statistics analyst agent. Use ONLY the provided data.

TASK: Analyze form and statistics, provide mathematical conclusions.

RETURN ONLY JSON, NOTHING ELSE:
{
  "formAnalysis": "brief form comparison",
  "goalExpectancy": 2.5,
  "overUnder": "Over",
  "confidence": 70,
  "matchResult": "1",
  "btts": "Yes",
  "keyStats": ["stat 1", "stat 2"]
}`,

  de: `Du bist ein Statistik-Analyst. Analysiere und gib NUR JSON zurück, nichts anderes.

{
  "formAnalysis": "Formvergleich",
  "goalExpectancy": 2.5,
  "overUnder": "Over",
  "confidence": 70,
  "matchResult": "1",
  "btts": "Yes",
  "keyStats": ["Statistik 1", "Statistik 2"]
}`,
};

// Robust JSON extraction
function extractJSON(text: string): any | null {
  if (!text) return null;
  
  // Step 1: Clean common issues
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\*\*/g, '')
    .trim();
  
  // Step 2: Find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  
  let jsonStr = jsonMatch[0];
  
  // Step 3: Fix common JSON errors
  // Fix trailing commas
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
  
  // Fix unquoted keys
  jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Fix single quotes to double quotes
  jsonStr = jsonStr.replace(/'/g, '"');
  
  // Fix newlines in strings
  jsonStr = jsonStr.replace(/\n/g, ' ');
  
  // Fix control characters
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e1) {
    // Step 4: Try to extract individual fields manually
    try {
      const result: any = {};
      
      // Extract formAnalysis
      const formMatch = jsonStr.match(/"formAnalysis"\s*:\s*"([^"]+)"/);
      result.formAnalysis = formMatch ? formMatch[1] : 'Analysis unavailable';
      
      // Extract goalExpectancy
      const goalMatch = jsonStr.match(/"goalExpectancy"\s*:\s*([\d.]+)/);
      result.goalExpectancy = goalMatch ? parseFloat(goalMatch[1]) : 2.5;
      
      // Extract overUnder
      const ouMatch = jsonStr.match(/"overUnder"\s*:\s*"?(Over|Under)"?/i);
      result.overUnder = ouMatch ? ouMatch[1] : 'Over';
      
      // Extract confidence
      const confMatch = jsonStr.match(/"confidence"\s*:\s*([\d.]+)/);
      result.confidence = confMatch ? parseInt(confMatch[1]) : 60;
      
      // Extract matchResult
      const mrMatch = jsonStr.match(/"matchResult"\s*:\s*"?([12X])"?/i);
      result.matchResult = mrMatch ? mrMatch[1].toUpperCase() : 'X';
      
      // Extract btts
      const bttsMatch = jsonStr.match(/"btts"\s*:\s*"?(Yes|No)"?/i);
      result.btts = bttsMatch ? bttsMatch[1] : 'No';
      
      // Extract keyStats
      const statsMatch = jsonStr.match(/"keyStats"\s*:\s*\[(.*?)\]/s);
      if (statsMatch) {
        const statsStr = statsMatch[1];
        const stats = statsStr.match(/"([^"]+)"/g);
        result.keyStats = stats ? stats.map(s => s.replace(/"/g, '')) : [];
      } else {
        result.keyStats = [];
      }
      
      return result;
    } catch (e2) {
      console.error('Manual JSON extraction failed:', e2);
      return null;
    }
  }
}

export async function runStatsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  const homeGoals = parseFloat(matchData.homeForm?.avgGoals || '1.2');
  const awayGoals = parseFloat(matchData.awayForm?.avgGoals || '1.0');
  const expectedTotal = homeGoals + awayGoals;
  
  const homeOver25 = parseInt(matchData.homeForm?.over25Percentage || '50');
  const awayOver25 = parseInt(matchData.awayForm?.over25Percentage || '50');
  const avgOver25 = (homeOver25 + awayOver25) / 2;

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

HOME TEAM (${matchData.homeTeam}):
- Form: ${matchData.homeForm?.form || 'N/A'}
- Points: ${matchData.homeForm?.points || 0}/15
- Goals per game: ${matchData.homeForm?.avgGoals || 'N/A'}
- Conceded per game: ${matchData.homeForm?.avgConceded || 'N/A'}
- Over 2.5 rate: ${matchData.homeForm?.over25Percentage || 'N/A'}%
- BTTS rate: ${matchData.homeForm?.bttsPercentage || 'N/A'}%

AWAY TEAM (${matchData.awayTeam}):
- Form: ${matchData.awayForm?.form || 'N/A'}
- Points: ${matchData.awayForm?.points || 0}/15
- Goals per game: ${matchData.awayForm?.avgGoals || 'N/A'}
- Conceded per game: ${matchData.awayForm?.avgConceded || 'N/A'}
- Over 2.5 rate: ${matchData.awayForm?.over25Percentage || 'N/A'}%
- BTTS rate: ${matchData.awayForm?.bttsPercentage || 'N/A'}%

H2H: ${matchData.h2h?.totalMatches || 0} matches

Expected total: ${expectedTotal.toFixed(2)}
Over 2.5 avg: $
