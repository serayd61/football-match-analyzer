// src/lib/heurist/agents/consensus.ts
import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ConsensusReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `⚖️ SEN BAŞ KARAR VERME AJANISIN!

GÖREV: TÜM ajan raporlarını DEĞERLENDİR ve TUTARLI final kararları ver.

KRİTİK KURALLAR:
1. Ajanlar arasında ÇELİŞKİ varsa, STATS ajanının verilerine öncelik ver
2. Stats ajanı "düşük gol" diyorsa, Üst 2.5 tahmini YAPMA
3. Stats ajanı "yüksek gol" diyorsa, Alt 2.5 tahmini YAPMA
4. goalExpectancy.total < 2.5 ise → "Under" seç
5. goalExpectancy.total >= 2.5 ise → "Over" seç
6. Her güven skoru EN AZ %65 olmalı
7. "Belki", "muhtemelen" YASAK - KESİN tahminler ver!

ÖNCELİK SIRASI:
1. Stats Agent (istatistiksel veriler) - EN ÖNEMLİ
2. Odds Agent (oran analizi) 
3. Scout Agent (haberler, sakatlıklar)
4. Strategy Agent (strateji önerileri)

TUTARLILIK KONTROLÜ:
- Eğer Stats "düşük gol beklentisi" diyorsa → overUnder25 = "Under"
- Eğer Stats "yüksek gol beklentisi" diyorsa → overUnder25 = "Over"
- BU KURALI KESİNLİKLE UYGULA!

Türkçe yanıt ver. SADECE JSON döndür.`,

  en: `⚖️ YOU ARE THE HEAD DECISION-MAKING AGENT!

CRITICAL RULES:
1. If agents CONFLICT, prioritize STATS agent data
2. If Stats says "low goals", do NOT predict Over 2.5
3. If Stats says "high goals", do NOT predict Under 2.5
4. goalExpectancy.total < 2.5 → select "Under"
5. goalExpectancy.total >= 2.5 → select "Over"
6. Confidence must be AT LEAST 65%
7. "Maybe", "possibly" FORBIDDEN!

PRIORITY ORDER:
1. Stats Agent - MOST IMPORTANT
2. Odds Agent
3. Scout Agent
4. Strategy Agent

Return ONLY JSON in English.`,

  de: `⚖️ DU BIST DER CHEF-ENTSCHEIDUNGSAGENT!
Stats Agent hat PRIORITÄT bei Konflikten.
Auf Deutsch antworten. NUR JSON zurückgeben.`,
};

export async function runConsensusAgent(
  match: MatchData,
  allReports: { scout: any; stats: any; odds: any; strategy: any },
  language: Language = 'en'
): Promise<ConsensusReport | null> {
  
  // Stats agent'tan gol beklentisini al
  const goalExpectancy = allReports.stats?.goalExpectancy?.total || 2.5;
  const statsOverUnder = goalExpectancy >= 2.5 ? 'Over' : 'Under';
  
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

⚠️ ÖNEMLİ: Stats Agent gol beklentisi = ${goalExpectancy}
Bu değer ${goalExpectancy >= 2.5 ? '2.5\'ten BÜYÜK → OVER seçilmeli' : '2.5\'ten KÜÇÜK → UNDER seçilmeli'}!

📋 TÜM AJAN RAPORLARI:

🔍 SCOUT:
${JSON.stringify(allReports.scout || {}, null, 2)}

📊 STATS (EN ÖNEMLİ - BU VERİLERE ÖNCELIK VER!):
${JSON.stringify(allReports.stats || {}, null, 2)}

💰 ODDS:
${JSON.stringify(allReports.odds || {}, null, 2)}

🧠 STRATEGY:
${JSON.stringify(allReports.strategy || {}, null, 2)}

🎯 FİNAL RAPORU JSON:
⚠️ overUnder25.prediction MUTLAKA "${statsOverUnder}" OLMALI çünkü goalExpectancy = ${goalExpectancy}

{
  "matchResult": {"prediction": "1/X/2", "confidence": 72, "unanimous": true},
  "overUnder25": {"prediction": "${statsOverUnder}", "confidence": 78, "unanimous": true},
  "btts": {"prediction": "Yes/No", "confidence": 70, "unanimous": false},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 68},
  "correctScore": {"first": "1-0", "second": "1-1", "third": "2-0"},
  "bestBet": {
    "type": "Bahis Türü",
    "selection": "Seçim",
    "confidence": 80,
    "stake": 3,
    "reasoning": "Stats verileriyle tutarlı açıklama"
  },
  "riskLevel": "düşük/orta/yüksek",
  "overallAnalysis": "Stats verilerine dayalı tutarlı analiz",
  "keyFactors": ["Faktör 1", "Faktör 2", "Faktör 3"],
  "warnings": ["Uyarı 1", "Uyarı 2"]
}

⚠️ SADECE JSON DÖNDÜR! STATS VERİLERİYLE TUTARLI OL!` },
  ];

  return await heurist.chatJSON<ConsensusReport>(messages, { 
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    temperature: 0.4, // Daha deterministik
    maxTokens: 2500
  });
}
