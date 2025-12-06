import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

const PROMPTS = {
  tr: `Sen bir bahis oranları analisti ajanısın. Oranları değer açısından analiz et.

JSON DÖNDÜR:
{
  "oddsAnalysis": "Oran değerlendirmesi",
  "recommendation": "Over veya Under",
  "confidence": 70,
  "matchWinnerValue": "home veya draw veya away",
  "bttsValue": "yes veya no",
  "valueRating": "Düşük/Orta/Yüksek"
}`,

  en: `You are a betting odds analyst agent. Analyze odds for value.

RETURN JSON:
{
  "oddsAnalysis": "Odds assessment",
  "recommendation": "Over or Under",
  "confidence": 70,
  "matchWinnerValue": "home or draw or away",
  "bttsValue": "yes or no",
  "valueRating": "Low/Medium/High"
}`,

  de: `Du bist ein Quoten-Analyst. Analysiere und gib JSON zurück.`,
};

export async function runOddsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  const homeOdds = matchData.odds?.matchWinner?.home || 2.0;
  const drawOdds = matchData.odds?.matchWinner?.draw || 3.5;
  const awayOdds = matchData.odds?.matchWinner?.away || 3.5;
  const overOdds = matchData.odds?.overUnder?.['2.5']?.over || 1.9;
  const underOdds = matchData.odds?.overUnder?.['2.5']?.under || 1.9;

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

ODDS:
- Home win (1): ${homeOdds}
- Draw (X): ${drawOdds}
- Away win (2): ${awayOdds}
- Over 2.5: ${overOdds}
- Under 2.5: ${underOdds}
- BTTS Yes: ${matchData.odds?.btts?.yes || 'N/A'}
- BTTS No: ${matchData.odds?.btts?.no || 'N/A'}

FORM CONTEXT:
- Home form: ${matchData.homeForm?.form || 'N/A'}, Goals: ${matchData.homeForm?.avgGoals || 'N/A'}
- Away form: ${matchData.awayForm?.form || 'N/A'}, Goals: ${matchData.awayForm?.avgGoals || 'N/A'}

Analyze odds value and return JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await heurist.chat(messages, { temperature: 0.3, maxTokens: 800 });
    
    if (response) {
      const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').replace(/\*\*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Odds agent error:', error);
  }

  // Fallback
  const lowestOdds = Math.min(homeOdds, drawOdds, awayOdds);
  let matchWinnerValue = 'home';
  if (lowestOdds === drawOdds) matchWinnerValue = 'draw';
  if (lowestOdds === awayOdds) matchWinnerValue = 'away';

  return {
    oddsAnalysis: `Home: ${homeOdds}, Draw: ${drawOdds}, Away: ${awayOdds}`,
    recommendation: overOdds < underOdds ? 'Over' : 'Under',
    confidence: 65,
    matchWinnerValue,
    bttsValue: 'yes',
    valueRating: 'Medium',
  };
}
