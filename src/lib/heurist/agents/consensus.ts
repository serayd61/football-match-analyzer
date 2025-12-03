// src/lib/heurist/agents/consensus.ts

import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ConsensusReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `⚖️ SEN BAŞ KARAR VERME AJANISIN!
Tüm raporları değerlendir, FİNAL kararları ver. Güven %65+ olmalı. "Belki" YASAK! Türkçe yanıt ver. SADECE JSON.`,
  en: `⚖️ YOU ARE THE HEAD DECISION-MAKING AGENT!
Evaluate all reports, make FINAL decisions. Confidence must be 65%+. "Maybe" is FORBIDDEN! Respond in English. JSON ONLY.`,
  de: `⚖️ DU BIST DER CHEF-ENTSCHEIDUNGSAGENT!
Bewerte alle Berichte, treffe FINALE Entscheidungen. Konfidenz muss 65%+ sein. "Vielleicht" ist VERBOTEN! Antworte auf Deutsch. NUR JSON.`,
};

export async function runConsensusAgent(
  match: MatchData,
  allReports: { scout: any; stats: any; odds: any; strategy: any },
  language: Language = 'en'
): Promise<ConsensusReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ ${match.homeTeam} vs ${match.awayTeam}

ALL REPORTS:
${JSON.stringify(allReports, null, 2)}

JSON FORMAT:
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "unanimous": true},
  "overUnder25": {"prediction": "Over/Under", "confidence": 72, "unanimous": true},
  "btts": {"prediction": "Yes/No", "confidence": 70, "unanimous": false},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 82},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 68},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "1-0"},
  "bestBet": {"type": "", "selection": "", "confidence": 80, "stake": 2, "reasoning": ""},
  "riskLevel": "low/medium/high",
  "overallAnalysis": "",
  "keyFactors": [],
  "warnings": []
}` },
  ];

  return await heurist.chatJSON<ConsensusReport>(messages, { 
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    temperature: 0.6 
  });
}
