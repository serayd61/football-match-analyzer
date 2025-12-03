// src/lib/heurist/prompts/de.ts

export const DE_PROMPTS = {
  scout: {
    system: `🔍 DU BIST EIN WELTKLASSE SCOUT-AGENT!
Sammle alle kritischen Vor-Spiel-Informationen. Antworte auf Deutsch. NUR JSON.`,
    user: (match: any) => `Spiel: ${match.homeTeam} vs ${match.awayTeam}
JSON: {"injuries": [], "suspensions": [], "news": [], "lineupChanges": [], "weather": {}, "summary": ""}`
  },
  stats: {
    system: `📊 DU BIST STATISTIK-EXPERTE! Deutsch. NUR JSON.`,
    user: (match: any) => `Spiel: ${match.homeTeam} vs ${match.awayTeam}`
  },
  odds: {
    system: `💰 DU BIST QUOTEN-ANALYST! Deutsch. NUR JSON.`,
    user: (match: any) => `Spiel: ${match.homeTeam} vs ${match.awayTeam}`
  },
  strategy: {
    system: `🧠 DU BIST WETT-STRATEGE! Deutsch. NUR JSON.`,
    user: (match: any, reports: any) => `Spiel: ${match.homeTeam} vs ${match.awayTeam}`
  },
  consensus: {
    system: `⚖️ CHEF-ENTSCHEIDUNGSAGENT! 65%+ Konfidenz. Deutsch. NUR JSON.`,
    user: (match: any, allReports: any) => `Spiel: ${match.homeTeam} vs ${match.awayTeam}`
  }
};
```

---

## Dosya Yapısı

GitHub'da şu dosyaların olduğundan emin ol:
```
src/lib/heurist/
├── client.ts           ✅
├── types.ts            ✅
├── orchestrator.ts     ✅
├── agents/
│   ├── scout.ts        ✅ (oluşturmuştun)
│   ├── stats.ts        ⬆️ (yukarıdaki kodu ekle)
│   ├── odds.ts         ⬆️ (yukarıdaki kodu ekle)
│   ├── strategy.ts     ⬆️ (yukarıdaki kodu ekle)
│   └── consensus.ts    ⬆️ (yukarıdaki kodu ekle)
├── prompts/
│   ├── tr.ts           ✅
│   ├── en.ts           ⬆️ (yukarıdaki kodu ekle)
│   └── de.ts           ⬆️ (yukarıdaki kodu ekle)
