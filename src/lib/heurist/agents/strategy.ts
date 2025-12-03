// src/lib/heurist/agents/strategy.ts

import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StrategyReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `🧠 SEN DÜNYA ÇAPINDA TANINMIŞ BİR BAHİS STRATEJİSTİSİN!
Optimal strateji belirle. Türkçe yanıt ver. SADECE JSON formatında yanıt ver.`,
  en: `🧠 YOU ARE A WORLD-RENOWNED BETTING STRATEGIST!
Determine optimal strategy. Respond in English. Respond ONLY in JSON format.`,
  de: `🧠 DU BIST EIN WELTBEKANNTER WETT-STRATEGE!
Bestimme die optimale Strategie. Antworte auf Deutsch. Antworte NUR im JSON-Format.`,
};

export async function runStrategyAgent(
  match: MatchData,
  reports: { scout: any; stats: any; odds: any },
  language: Language = 'en'
): Promise<StrategyReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ ${match.homeTeam} vs ${match.awayTeam}

REPORTS:
Scout: ${JSON.stringify(reports.scout)}
Stats: ${JSON.stringify(reports.stats)}
Odds: ${JSON.stringify(reports.odds)}

JSON: {"recommendedBets": [], "riskAssessment": {"level": "medium", "factors": []}, "bankrollAdvice": "", "avoidBets": [], "summary": ""}` },
  ];

  return await heurist.chatJSON<StrategyReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct' 
  });
}
