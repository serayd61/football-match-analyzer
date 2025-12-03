// src/lib/heurist/agents/scout.ts

import { heurist, HeuristMessage } from '../client';
import { TR_PROMPTS } from '../prompts/tr';
import { EN_PROMPTS } from '../prompts/en';
import { DE_PROMPTS } from '../prompts/de';
import { Language, MatchData, ScoutReport } from '../types';

const PROMPTS = {
  tr: TR_PROMPTS,
  en: EN_PROMPTS,
  de: DE_PROMPTS,
};

export async function runScoutAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<ScoutReport | null> {
  const prompts = PROMPTS[language]?.scout || PROMPTS.en.scout;

  const messages: HeuristMessage[] = [
    { role: 'system', content: prompts.system },
    { role: 'user', content: prompts.user(match) },
  ];

  const result = await heurist.chatJSON<ScoutReport>(messages, {
    model: 'deepseek-ai/deepseek-v3',
    temperature: 0.5,
  });

  return result;
}
