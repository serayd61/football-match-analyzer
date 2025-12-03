// src/lib/heurist/prompts/en.ts

export const EN_PROMPTS = {
  scout: {
    system: `🔍 YOU ARE A WORLD-CLASS FOOTBALL SCOUT AGENT!
Gather all critical pre-match information. Respond in English. JSON ONLY.`,
    user: (match: any) => `Match: ${match.homeTeam} vs ${match.awayTeam}
JSON: {"injuries": [], "suspensions": [], "news": [], "lineupChanges": [], "weather": {}, "summary": ""}`
  },
  stats: {
    system: `📊 YOU ARE A STATISTICS EXPERT! English. JSON ONLY.`,
    user: (match: any) => `Match: ${match.homeTeam} vs ${match.awayTeam}`
  },
  odds: {
    system: `💰 YOU ARE AN ODDS ANALYST! English. JSON ONLY.`,
    user: (match: any) => `Match: ${match.homeTeam} vs ${match.awayTeam}`
  },
  strategy: {
    system: `🧠 YOU ARE A BETTING STRATEGIST! English. JSON ONLY.`,
    user: (match: any, reports: any) => `Match: ${match.homeTeam} vs ${match.awayTeam}`
  },
  consensus: {
    system: `⚖️ HEAD DECISION AGENT! 65%+ confidence. English. JSON ONLY.`,
    user: (match: any, allReports: any) => `Match: ${match.homeTeam} vs ${match.awayTeam}`
  }
};
