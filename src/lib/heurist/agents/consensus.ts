// src/lib/heurist/agents/consensus.ts

import { heurist, HeuristMessage } from '../client';
import { TR_PROMPTS } from '../prompts/tr';
import { EN_PROMPTS } from '../prompts/en';
import { DE_PROMPTS } from '../prompts/de';
import { Language, MatchData, ConsensusReport } from '../types';

const PROMPTS = {
  tr: TR_PROMPTS,
  en: EN_PROMPTS,
  de: DE_PROMPTS,
};

export async function runConsensusAgent(
  match: MatchData,
  allReports: {
    scout: any;
    stats: any;
    odds: any;
    strategy: any;
  },
  language: Language = 'en'
): Promise<ConsensusReport | null> {
  const prompts = PROMPTS[language]?.consensus || PROMPTS.en.consensus;

  const messages: HeuristMessage[] = [
    { role: 'system', content: prompts.system },
    { role: 'user', content: prompts.user(match, allReports) },
  ];

  // Consensus için daha güçlü model kullan
  const result = await heurist.chatJSON<ConsensusReport>(messages, {
    model: 'meta-llama/llama-3.1-70b-instruct',
    temperature: 0.6,
  });

  return result;
}
