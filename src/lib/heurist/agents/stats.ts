// src/lib/heurist/agents/stats.ts

import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StatsReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `📊 SEN DÜNYA ÇAPINDA TANINMIŞ BİR FUTBOL İSTATİSTİK UZMANSIN!
Detaylı istatistik analizi yap. Türkçe yanıt ver. SADECE JSON formatında yanıt ver.`,
  en: `📊 YOU ARE A WORLD-CLASS FOOTBALL STATISTICS EXPERT!
Perform detailed statistical analysis. Respond in English. Respond ONLY in JSON format.`,
  de: `📊 DU BIST EIN WELTKLASSE FUßBALL-STATISTIK-EXPERTE!
Führe detaillierte statistische Analysen durch. Antworte auf Deutsch. Antworte NUR im JSON-Format.`,
};

export async function runStatsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<StatsReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ ${match.homeTeam} vs ${match.awayTeam}

📈 ${match.homeTeam} FORM: ${JSON.stringify(match.homeForm)}
📉 ${match.awayTeam} FORM: ${JSON.stringify(match.awayForm)}
⚔️ H2H: ${JSON.stringify(match.h2h)}

JSON: {"homeStrength": 75, "awayStrength": 68, "formComparison": "", "goalExpectancy": {"home": 1.5, "away": 1.1, "total": 2.6}, "keyStats": [], "patterns": [], "summary": ""}` },
  ];

  return await heurist.chatJSON<StatsReport>(messages, { model: 'deepseek-ai/deepseek-v3' });
}
