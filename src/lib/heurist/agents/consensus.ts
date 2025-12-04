import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ConsensusReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `⚖️ SEN FİNAL KARAR AJANISIN.

⚠️ KRİTİK KURALLAR:
1. Stats agent'ın goalExpectancy değerini MUTLAKA kullan
2. goalExpectancy < 2.5 → Under seç
3. goalExpectancy >= 2.5 → Over seç
4. Diğer ajanlarla TUTARLI ol
5. UYDURMA, sadece verilen raporları değerlendir

Türkçe yanıt ver. SADECE JSON döndür.`,

  en: `⚖️ YOU ARE THE FINAL DECISION AGENT.

⚠️ CRITICAL RULES:
1. MUST use Stats agent's goalExpectancy value
2. goalExpectancy < 2.5 → select Under
3. goalExpectancy >= 2.5 → select Over
4. Be CONSISTENT with other agents
5. DO NOT make up data, only evaluate given reports

Respond in English. Return ONLY JSON.`,

  de: `⚖️ DU BIST DER FINAL-ENTSCHEIDUNGSAGENT.
Stats goalExpectancy verwenden.
NUR JSON zurückgeben.`,
};

export async function runConsensusAgent(
  match: MatchData,
  allReports: { scout: any; stats: any; odds: any; strategy: any },
  language: Language = 'en'
): Promise<ConsensusReport | null> {
  
  // Stats'tan gol beklentisini al
  const goalExpectancy = allReports.stats?.goalExpectancy?.total || 2.5;
  const overUnderPrediction = goalExpectancy >= 2.5 ? 'Over' : 'Under';
  const overUnderConfidence = Math.round(50 + Math.abs(goalExpectancy - 2.5) * 15);

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

📊 STATS RAPORU (EN ÖNEMLİ!):
- goalExpectancy.total = ${goalExpectancy}
- Bu değer ${goalExpectancy >= 2.5 ? '>= 2.5 → OVER seçilmeli' : '< 2.5 → UNDER seçilmeli'}!

📋 DİĞER RAPORLAR:
Scout: ${allReports.scout?.summary || 'Rapor yok'}
Odds: ${allReports.odds?.summary || 'Rapor yok'}
Strategy: ${allReports.strategy?.summary || 'Rapor yok'}

🎯 JSON FORMAT (STATS İLE TUTARLI OL!):
{
  "matchResult": {"prediction": "1", "confidence": 70, "unanimous": false},
  "overUnder25": {"prediction": "${overUnderPrediction}", "confidence": ${overUnderConfidence}, "unanimous": true},
  "btts": {"prediction": "Yes", "confidence": 70, "unanimous": false},
  "doubleChance": {"prediction": "1X", "confidence": 75},
  "halfTimeResult": {"prediction": "X", "confidence": 65},
  "correctScore": {"first": "1-1", "second": "2-1", "third": "1-0"},
  "bestBet": {
    "type": "${overUnderPrediction} 2.5 Gol",
    "selection": "${overUnderPrediction}",
    "confidence": ${overUnderConfidence},
    "stake": 3,
    "reasoning": "Stats göre beklenen toplam gol: ${goalExpectancy}. Bu nedenle ${overUnderPrediction} 2.5 öneriliyor."
  },
  "riskLevel": "orta",
  "overallAnalysis": "İstatistiklere göre bu maçta ${goalExpectancy} civarı gol bekleniyor. ${overUnderPrediction} 2.5 tahmini yapılıyor.",
  "keyFactors": ["Beklenen gol: ${goalExpectancy}", "Form verileri analiz edildi"],
  "warnings": ["Sakatlık verisi mevcut değildi"]
}

⚠️ overUnder25.prediction MUTLAKA "${overUnderPrediction}" OLMALI!` },
  ];

  return await heurist.chatJSON<ConsensusReport>(messages, { 
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    temperature: 0.3,
    maxTokens: 2000
  });
}
