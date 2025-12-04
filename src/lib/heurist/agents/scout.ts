import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ScoutReport } from '../types';

const SYSTEM_PROMPT = `You are a JSON API. Return ONLY valid JSON.
NEVER use markdown. NEVER use ** or backticks.
NEVER write explanations. Return ONLY a JSON object.`;

export async function runScoutAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<ScoutReport | null> {
  
  // Fallback template
  const template: ScoutReport = {
    injuries: [],
    suspensions: [],
    news: [],
    lineupChanges: [],
    weather: { condition: "Bilinmiyor", impact: "Veri yok" },
    summary: `${match.homeTeam} vs ${match.awayTeam} maci icin guncel sakatlik/haber verisi mevcut degil. Form verileri: ${match.homeTeam} ${match.homeForm?.form || 'N/A'}, ${match.awayTeam} ${match.awayForm?.form || 'N/A'}.`
  };

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Match: ${match.homeTeam} vs ${match.awayTeam}
League: ${match.league || 'Unknown'}

Home form: ${match.homeForm?.form || 'N/A'}
Away form: ${match.awayForm?.form || 'N/A'}

IMPORTANT: No injury/news data available. Return empty arrays.

Return ONLY this JSON:
${JSON.stringify(template, null, 2)}` },
  ];

  try {
    const response = await heurist.chat(messages, { 
      model: 'meta-llama/llama-3.3-70b-instruct',
      temperature: 0.1,
      maxTokens: 1000
    });

    if (!response) return template;

    try {
      let cleaned = response.replace(/\*\*/g, '').replace(/`/g, '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ScoutReport;
      }
    } catch {}

    return template;
  } catch (error) {
    console.error('Scout agent error:', error);
    return template;
  }
}
