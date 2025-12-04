import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StrategyReport } from '../types';

const SYSTEM_PROMPT = `You are a JSON API. Return ONLY valid JSON.
NEVER use markdown. NEVER use ** or backticks.
NEVER write explanations. Return ONLY a JSON object.`;

export async function runStrategyAgent(
  match: MatchData,
  previousReports: { scout: any; stats: any; odds: any },
  language: Language = 'en'
): Promise<StrategyReport | null> {
  
  const goalExpectancy = parseFloat(previousReports.stats?.goalExpectancy?.total) || 2.5;
  const overUnder = goalExpectancy >= 2.5 ? 'Over' : 'Under';

  // Fallback template
  const template: StrategyReport = {
    recommendedBets: [
      {
        type: `${overUnder} 2.5 Gol`,
        selection: overUnder,
        confidence: Math.min(85, Math.round(50 + Math.abs(goalExpectancy - 2.5) * 15)),
        stake: 3,
        reasoning: `Beklenen gol ${goalExpectancy.toFixed(1)} - ${overUnder} 2.5 oneriliyor`
      }
    ],
    avoidBets: [
      { type: "Kesin Skor", reason: "Yuksek belirsizlik" }
    ],
    bankrollStrategy: {
      recommendedStake: "3 birim",
      maxExposure: "5%",
      reasoning: "Orta guvenilirlik seviyesi"
    },
    timing: {
      bestTime: "Mac oncesi",
      liveOpportunities: ["Erken gol durumunda Ust bahis"]
    },
    riskAssessment: {
      overall: "orta",
      factors: ["Form verileri analiz edildi", "H2H verisi mevcut"]
    },
    summary: `${match.homeTeam} vs ${match.awayTeam} maci icin ${overUnder} 2.5 gol bahsi onerilmektedir. Beklenen toplam gol: ${goalExpectancy.toFixed(1)}.`
  };

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Match: ${match.homeTeam} vs ${match.awayTeam}

Stats analysis:
- Expected goals: ${goalExpectancy.toFixed(1)}
- Recommendation: ${overUnder} 2.5

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
        return JSON.parse(jsonMatch[0]) as StrategyReport;
      }
    } catch {}

    return template;
  } catch (error) {
    console.error('Strategy agent error:', error);
    return template;
  }
}
