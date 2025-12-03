// src/lib/heurist/agents/scout.ts

import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ScoutReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `🔍 SEN DÜNYA ÇAPINDA TANINMIŞ BİR FUTBOL SCOUT AJANISIN!
Detaylı scout raporu hazırla. Türkçe yanıt ver. SADECE JSON formatında yanıt ver.`,
  en: `🔍 YOU ARE A WORLD-CLASS FOOTBALL SCOUT AGENT!
Prepare detailed scout report. Respond in English. Respond ONLY in JSON format.`,
  de: `🔍 DU BIST EIN WELTKLASSE FUßBALL-SCOUT-AGENT!
Erstelle detaillierten Scout-Bericht. Antworte auf Deutsch. Antworte NUR im JSON-Format.`,
};

export async function runScoutAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<ScoutReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ ${match.homeTeam} vs ${match.awayTeam}
🏆 ${match.league} | 📅 ${match.date}

JSON: {"injuries": [], "suspensions": [], "news": [], "lineupChanges": [], "weather": {}, "summary": ""}` },
  ];

  return await heurist.chatJSON<ScoutReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.5 
  });
}
