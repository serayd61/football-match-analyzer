import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StrategyReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `🧠 SEN DÜNYANIN EN İYİ BAHİS STRATEJİSTİSİN!

GÖREV: Diğer ajanların raporlarını değerlendir ve OPTİMAL strateji belirle.

MUTLAKA BELİRLE:
1. recommendedBets: En az 2 önerilen bahis
   - type: Bahis tipi (1X2, Üst 2.5, KG, vb.)
   - selection: Seçim
   - confidence: 65-95 arası SAYI
   - stake: 1-5 arası SAYI (birim)
   - reasoning: Neden bu bahis öneriliyor
   - expectedValue: Beklenen değer SAYI

2. riskAssessment: Risk değerlendirmesi
   - level: "düşük", "orta" veya "yüksek"
   - factors: Risk faktörleri listesi

3. avoidBets: Kaçınılması gereken bahisler

KURALLAR:
- confidence 65-95 arası SAYI olmalı
- stake 1-5 arası SAYI olmalı
- expectedValue SAYI olmalı
- Türkçe yanıt ver
- SADECE JSON döndür`,

  en: `🧠 YOU ARE THE WORLD'S BEST BETTING STRATEGIST!

TASK: Evaluate other agents' reports and determine OPTIMAL strategy.

RULES:
- confidence must be NUMBER between 65-95
- stake must be NUMBER between 1-5
- expectedValue must be NUMBER
- Respond in English
- Return ONLY JSON`,

  de: `🧠 DU BIST DER BESTE WETT-STRATEGE DER WELT!

REGELN:
- Auf Deutsch antworten
- NUR JSON zurückgeben`,
};

export async function runStrategyAgent(
  match: MatchData,
  reports: { scout: any; stats: any; odds: any },
  language: Language = 'en'
): Promise<StrategyReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

📋 SCOUT RAPORU:
${JSON.stringify(reports.scout || {}, null, 2)}

📊 İSTATİSTİK RAPORU:
${JSON.stringify(reports.stats || {}, null, 2)}

💰 ORAN RAPORU:
${JSON.stringify(reports.odds || {}, null, 2)}

🎯 JSON FORMAT (TÜM ALANLARI DOLDUR!):
{
  "recommendedBets": [
    {
      "type": "Üst 2.5 Gol",
      "selection": "Üst",
      "confidence": 78,
      "stake": 3,
      "reasoning": "İstatistikler ve oran analizi üst 2.5 golu destekliyor",
      "expectedValue": 12.5
    },
    {
      "type": "Maç Sonucu",
      "selection": "1 (Ev Sahibi)",
      "confidence": 72,
      "stake": 2,
      "reasoning": "Ev sahibi form avantajına sahip",
      "expectedValue": 8.3
    }
  ],
  "riskAssessment": {
    "level": "orta",
    "factors": ["Sakat oyuncular belirsizlik yaratıyor", "H2H verileri dengeli"]
  },
  "bankrollAdvice": "Toplam bankroll'un %5'inden fazlasını bu maça yatırma",
  "avoidBets": [
    {"type": "Doğru Skor", "reason": "Çok düşük olasılık, riskli"},
    {"type": "İlk Gol Dakikası", "reason": "Tahmin edilemez"}
  ],
  "summary": "Detaylı strateji özeti - en az 2 cümle"
}

⚠️ SADECE JSON DÖNDÜR! TÜM SAYILARI DOLDUR!` },
  ];

  return await heurist.chatJSON<StrategyReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.6,
    maxTokens: 2000
  });
}
