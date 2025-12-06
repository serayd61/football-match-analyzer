import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

const PROMPTS = {
  tr: `Sen bir bahis strateji uzmanı ajanısın. Diğer analizleri değerlendir ve strateji öner.

JSON DÖNDÜR:
{
  "riskAssessment": "Düşük/Orta/Yüksek",
  "recommendedBets": [
    {"type": "Bahis türü", "selection": "Seçim", "confidence": 75, "reasoning": "Gerekçe"}
  ],
  "avoidBets": ["Kaçınılacak bahis"],
  "stakeSuggestion": "Düşük/Orta/Yüksek",
  "overallStrategy": "Strateji özeti"
}`,

  en: `You are a betting strategy expert agent. Evaluate analyses and suggest strategy.

RETURN JSON:
{
  "riskAssessment": "Low/Medium/High",
  "recommendedBets": [
    {"type": "Bet type", "selection": "Selection", "confidence": 75, "reasoning": "Reason"}
  ],
  "avoidBets": ["Bets to avoid"],
  "stakeSuggestion": "Low/Medium/High",
  "overallStrategy": "Strategy summary"
}`,

  de: `Du bist ein Strategie-Experte. Analysiere und gib JSON zurück.`,
};

export async function runStrategyAgent(
  matchData: MatchData,
  previousReports: { scout?: any; stats?: any; odds?: any },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  const { stats, odds } = previousReports;

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

STATS AGENT ANALYSIS:
- Goal expectancy: ${stats?.goalExpectancy || 'N/A'}
- Over/Under recommendation: ${stats?.overUnder || 'N/A'}
- Match result: ${stats?.matchResult || 'N/A'}
- BTTS: ${stats?.btts || 'N/A'}
- Confidence: ${stats?.confidence || 'N/A'}%

ODDS AGENT ANALYSIS:
- Recommendation: ${odds?.recommendation || 'N/A'}
- Match winner value: ${odds?.matchWinnerValue || 'N/A'}
- BTTS value: ${odds?.bttsValue || 'N/A'}
- Value rating: ${odds?.valueRating || 'N/A'}

Based on these analyses, provide betting strategy:`;

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
    console.error('Strategy agent error:', error);
  }

  // Fallback
  return {
    riskAssessment: 'Medium',
    recommendedBets: [
      {
        type: 'Over/Under 2.5',
        selection: stats?.overUnder || 'Over',
        confidence: stats?.confidence || 65,
        reasoning: 'Based on statistical analysis',
      }
    ],
    avoidBets: ['Exact score bets'],
    stakeSuggestion: 'Medium',
    overallStrategy: 'Follow the statistical consensus',
  };
}
