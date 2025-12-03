// src/lib/heurist/agents/odds.ts

import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, OddsReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `💰 SEN PROFESYONEL BİR ODDS ANALİSTİSİN!
Value bet'leri tespit et. Türkçe yanıt ver. SADECE JSON formatında yanıt ver.`,
  en: `💰 YOU ARE A PROFESSIONAL ODDS ANALYST!
Detect value bets. Respond in English. Respond ONLY in JSON format.`,
  de: `💰 DU BIST EIN PROFESSIONELLER QUOTEN-ANALYST!
Erkenne Value-Wetten. Antworte auf Deutsch. Antworte NUR im JSON-Format.`,
};

export async function runOddsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<OddsReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ ${match.homeTeam} vs ${match.awayTeam}
📊 ODDS: ${JSON.stringify(match.odds)}

JSON: {"valuesBets": [], "oddsMovement": [], "bookmakerConsensus": [], "sharpMoney": [], "summary": ""}` },
  ];

  return await heurist.chatJSON<OddsReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct' 
  });
}
