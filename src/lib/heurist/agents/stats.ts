import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

const PROMPTS = {
  tr: `Sen bir istatistik analisti ajanısın. SADECE verilen verileri kullan.

GÖREV: Form ve istatistik verilerini analiz et, matematiksel sonuç çıkar.

VERİLERİ ANALİZ ET VE JSON DÖNDÜR:
{
  "formAnalysis": "Form karşılaştırması",
  "goalExpectancy": 2.5,
  "overUnder": "Over veya Under",
  "confidence": 70,
  "matchResult": "1 veya X veya 2",
  "btts": "Yes veya No",
  "keyStats": ["İstatistik 1", "İstatistik 2"]
}`,

  en: `You are a statistics analyst agent. Use ONLY the provided data.

TASK: Analyze form and statistics, provide mathematical conclusions.

ANALYZE AND RETURN JSON:
{
  "formAnalysis": "Form comparison",
  "goalExpectancy": 2.5,
  "overUnder": "Over or Under",
  "confidence": 70,
  "matchResult": "1 or X or 2",
  "btts": "Yes or No",
  "keyStats": ["Stat 1", "Stat 2"]
}`,

  de: `Du bist ein Statistik-Analyst. Analysiere und gib JSON zurück.`,
};

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

H2H: ${matchData.h2h?.totalMatches || 0} matches, Avg goals: ${matchData.h2h?.avgGoals || 'N/A'}

Expected total goals: ${expectedTotal.toFixed(2)}
Average Over 2.5 rate: ${avgOver25}%

Analyze and return JSON:`;

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
        const parsed = JSON.parse(jsonMatch[0]);
        // goalExpectancy'yi number olarak zorla
        if (typeof parsed.goalExpectancy === 'string') {
          parsed.goalExpectancy = parseFloat(parsed.goalExpectancy);
        }
        if (!parsed.goalExpectancy || isNaN(parsed.goalExpectancy)) {
          parsed.goalExpectancy = expectedTotal;
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error('Stats agent error:', error);
  }

  // Fallback - hesaplanmış değerler
  return {
    formAnalysis: `${matchData.homeTeam}: ${matchData.homeForm?.form || 'N/A'} vs ${matchData.awayTeam}: ${matchData.awayForm?.form || 'N/A'}`,
    goalExpectancy: expectedTotal,
    overUnder: expectedTotal >= 2.5 ? 'Over' : 'Under',
    confidence: Math.round(50 + Math.abs(expectedTotal - 2.5) * 10),
    matchResult: homeGoals > awayGoals ? '1' : (awayGoals > homeGoals ? '2' : 'X'),
    btts: (homeGoals > 0.8 && awayGoals > 0.8) ? 'Yes' : 'No',
    keyStats: [
      `Expected goals: ${expectedTotal.toFixed(1)}`,
      `Over 2.5 avg: ${avgOver25}%`
    ],
  };
}
