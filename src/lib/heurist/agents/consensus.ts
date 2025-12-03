import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ConsensusReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `⚖️ SEN BAŞ KARAR VERME AJANISIN!

GÖREV: TÜM ajan raporlarını değerlendir ve FİNAL kararları ver.

KRİTİK KURALLAR:
1. Tüm ajanların görüşlerini dikkate al
2. Çelişkileri çöz
3. Her güven skoru EN AZ %65 olmalı
4. "Belki", "muhtemelen" YASAK - KESİN tahminler ver!

MUTLAKA DOLDUR:
- matchResult: prediction (1/X/2), confidence (65-95), unanimous (true/false)
- overUnder25: prediction (Over/Under), confidence, unanimous
- btts: prediction (Yes/No), confidence, unanimous
- doubleChance, halfTimeResult, correctScore
- bestBet: EN İYİ TEK BAHİS
- riskLevel: düşük/orta/yüksek
- overallAnalysis: 3-4 cümle kapsamlı analiz
- keyFactors, warnings

Türkçe yanıt ver. SADECE JSON döndür.`,

  en: `⚖️ YOU ARE THE HEAD DECISION-MAKING AGENT!

CRITICAL RULES:
1. Consider all agents' opinions
2. Confidence must be AT LEAST 65%
3. "Maybe", "possibly" FORBIDDEN - give DEFINITE predictions!

Return ONLY JSON in English.`,

  de: `⚖️ DU BIST DER CHEF-ENTSCHEIDUNGSAGENT!

Auf Deutsch antworten. NUR JSON zurückgeben.`,
};

export async function runConsensusAgent(
  match: MatchData,
  allReports: { scout: any; stats: any; odds: any; strategy: any },
  language: Language = 'en'
): Promise<ConsensusReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

📋 TÜM AJAN RAPORLARI:

🔍 SCOUT:
${JSON.stringify(allReports.scout || {}, null, 2)}

📊 STATS:
${JSON.stringify(allReports.stats || {}, null, 2)}

💰 ODDS:
${JSON.stringify(allReports.odds || {}, null, 2)}

🧠 STRATEGY:
${JSON.stringify(allReports.strategy || {}, null, 2)}

🎯 FİNAL RAPORU JSON (TÜM ALANLARI DOLDUR!):
{
  "matchResult": {"prediction": "1", "confidence": 72, "unanimous": true},
  "overUnder25": {"prediction": "Over", "confidence": 78, "unanimous": true},
  "btts": {"prediction": "Yes", "confidence": 70, "unanimous": false},
  "doubleChance": {"prediction": "1X", "confidence": 85},
  "halfTimeResult": {"prediction": "1", "confidence": 68},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "2-0"},
  "bestBet": {
    "type": "Üst 2.5 Gol",
    "selection": "Üst",
    "confidence": 80,
    "stake": 3,
    "reasoning": "Tüm ajanlar üst 2.5 golü destekliyor"
  },
  "riskLevel": "orta",
  "overallAnalysis": "Ev sahibi takım form avantajına sahip. İstatistikler ve oran analizi üst 2.5 golü destekliyor. Sakat oyuncular bazı belirsizlik yaratsa da, ev sahibinin kazanma olasılığı yüksek görünüyor.",
  "keyFactors": [
    "Ev sahibi son 5 maçta 4 galibiyet aldı",
    "H2H maçlarda ortalama 2.7 gol",
    "Value bet: Üst 2.5 @1.85"
  ],
  "warnings": [
    "Sakat oyuncuların durumu maç gününe kadar netleşebilir",
    "Deplasman takımı savunmada sorunlu"
  ]
}

⚠️ SADECE JSON DÖNDÜR! TÜM ALANLARI DOLDUR! KESİN TAHMİNLER!` },
  ];

  return await heurist.chatJSON<ConsensusReport>(messages, { 
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    temperature: 0.5,
    maxTokens: 2500
  });
}
