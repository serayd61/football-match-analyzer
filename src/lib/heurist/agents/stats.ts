import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StatsReport } from '../types';

const SYSTEM_PROMPT = `You are a JSON API. Return ONLY valid JSON.
NEVER use markdown. NEVER use ** or backticks.
NEVER write explanations. Return ONLY a JSON object.`;

export async function runStatsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<StatsReport | null> {
  
  // Gerçek verileri çıkar
  const homeGoals = parseFloat(match.homeForm?.avgGoals || '0') || 1.2;
  const awayGoals = parseFloat(match.awayForm?.avgGoals || '0') || 1.0;
  const expectedTotal = homeGoals + awayGoals;
  const homeOver25 = parseInt(match.homeForm?.over25Percentage || '50') || 50;
  const awayOver25 = parseInt(match.awayForm?.over25Percentage || '50') || 50;
  const avgOver25 = (homeOver25 + awayOver25) / 2;

  // Fallback template with real calculations
  const template: StatsReport = {
    homeStrength: Math.min(85, Math.round(homeGoals * 25 + 40)),
    awayStrength: Math.min(80, Math.round(awayGoals * 25 + 35)),
    formComparison: `${match.homeTeam} (${match.homeForm?.form || 'N/A'}) vs ${match.awayTeam} (${match.awayForm?.form || 'N/A'})`,
    goalExpectancy: {
      home: homeGoals,
      away: awayGoals,
      total: expectedTotal
    },
    keyStats: [
      { stat: "Gol ortalamasi", home: homeGoals.toFixed(1), away: awayGoals.toFixed(1), advantage: homeGoals > awayGoals ? "home" : "away" },
      { stat: "Ust 2.5 orani", home: `${homeOver25}%`, away: `${awayOver25}%`, advantage: homeOver25 > awayOver25 ? "home" : "away" }
    ],
    patterns: [
      `Beklenen toplam gol: ${expectedTotal.toFixed(1)}`,
      `Ust 2.5 olasiligi: %${avgOver25.toFixed(0)}`
    ],
    summary: `Istatistiklere gore bu macta ${expectedTotal.toFixed(1)} civari gol bekleniyor. ${expectedTotal >= 2.5 ? 'Ust' : 'Alt'} 2.5 daha olasi.`
  };

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Match: ${match.homeTeam} vs ${match.awayTeam}

STATISTICS (use these exact numbers):
- ${match.homeTeam} avg goals: ${homeGoals}
- ${match.awayTeam} avg goals: ${awayGoals}
- Expected total: ${expectedTotal.toFixed(1)}
- Over 2.5 probability: ${avgOver25}%

Return ONLY this JSON:
${JSON.stringify(template, null, 2)}` },
  ];

  try {
    const response = await heurist.chat(messages, { 
      model: 'meta-llama/llama-3.3-70b-instruct',
      temperature: 0.1,
      maxTokens: 1200
    });

    if (!response) return template;

    try {
      let cleaned = response.replace(/\*\*/g, '').replace(/`/g, '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as StatsReport;
        // goalExpectancy kontrolü
        if (!parsed.goalExpectancy?.total) {
          parsed.goalExpectancy = template.goalExpectancy;
        }
        return parsed;
      }
    } catch {}

    return template;
  } catch (error) {
    console.error('Stats agent error:', error);
    return template;
  }
}
