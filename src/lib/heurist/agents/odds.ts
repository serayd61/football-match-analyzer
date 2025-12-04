import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, OddsReport } from '../types';

const SYSTEM_PROMPT = `You are a JSON API. Return ONLY valid JSON.
NEVER use markdown. NEVER use ** or backticks.
NEVER write explanations. Return ONLY a JSON object.`;

export async function runOddsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<OddsReport | null> {
  
  const hasOdds = match.odds?.matchWinner?.home !== undefined;
  const homeGoals = parseFloat(match.homeForm?.avgGoals || '0') || 1.2;
  const awayGoals = parseFloat(match.awayForm?.avgGoals || '0') || 1.0;
  const totalExpected = homeGoals + awayGoals;

  // Fallback template
  const template: OddsReport = {
    valuesBets: hasOdds ? [
      { market: "Ust/Alt 2.5", selection: totalExpected >= 2.5 ? "Ust" : "Alt", odds: 1.85, fairOdds: 1.80, value: 2.8, confidence: 70 }
    ] : [],
    oddsMovement: [],
    bookmakerConsensus: [
      { market: "Toplam Gol", consensus: totalExpected >= 2.5 ? "Ust 2.5 bekleniyor" : "Alt 2.5 bekleniyor", confidence: Math.round(50 + Math.abs(totalExpected - 2.5) * 10) }
    ],
    sharpMoney: [],
    summary: hasOdds 
      ? `Oran verisi mevcut. Beklenen toplam gol: ${totalExpected.toFixed(1)}.`
      : `Oran verisi mevcut degil. Form verilerine gore beklenen toplam gol: ${totalExpected.toFixed(1)}.`
  };

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Match: ${match.homeTeam} vs ${match.awayTeam}

Odds available: ${hasOdds ? 'YES' : 'NO'}
${hasOdds ? `1X2: ${match.odds?.matchWinner?.home} / ${match.odds?.matchWinner?.draw} / ${match.odds?.matchWinner?.away}` : ''}

Expected total goals: ${totalExpected.toFixed(1)}

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
        return JSON.parse(jsonMatch[0]) as OddsReport;
      }
    } catch {}

    return template;
  } catch (error) {
    console.error('Odds agent error:', error);
    return template;
  }
}
