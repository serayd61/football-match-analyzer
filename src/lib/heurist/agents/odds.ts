import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, OddsReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `💰 SEN ORAN ANALİZ AJANISIN.

⚠️ KRİTİK KURALLAR:
1. SADECE verilen oranları analiz et
2. Oran verisi YOKSA, value bet hesaplama
3. UYDURMA oran yazma
4. Verilen form/H2H verilerine göre analiz yap

Türkçe yanıt ver. SADECE JSON döndür.`,

  en: `💰 YOU ARE AN ODDS ANALYSIS AGENT.

⚠️ CRITICAL RULES:
1. ONLY analyze the odds PROVIDED
2. If odds data is NOT available, do not calculate value bets
3. DO NOT make up odds
4. Analyze based on given form/H2H data

Respond in English. Return ONLY JSON.`,

  de: `💰 DU BIST EIN QUOTEN-ANALYSE-AGENT.
NUR gegebene Daten verwenden.
NUR JSON zurückgeben.`,
};

export async function runOddsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<OddsReport | null> {
  
  const hasOdds = match.odds?.matchWinner?.home !== undefined;
  
  // Form verilerinden tahmini olasılık hesapla
  const homeGoals = parseFloat(match.homeForm?.avgGoals || '0') || 0;
  const awayGoals = parseFloat(match.awayForm?.avgGoals || '0') || 0;
  const totalExpected = homeGoals + awayGoals;
  const over25Likely = totalExpected > 2.5;

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

💰 ORAN VERİLERİ:
${hasOdds ? `
1X2: EV=${match.odds?.matchWinner?.home} | X=${match.odds?.matchWinner?.draw} | DEP=${match.odds?.matchWinner?.away}
Ü/A 2.5: Üst=${match.odds?.overUnder?.['2.5']?.over || 'N/A'} | Alt=${match.odds?.overUnder?.['2.5']?.under || 'N/A'}
KG: Var=${match.odds?.btts?.yes || 'N/A'} | Yok=${match.odds?.btts?.no || 'N/A'}
` : '⚠️ ORAN VERİSİ MEVCUT DEĞİL - Value bet hesaplama!'}

📊 FORM VERİLERİ:
- ${match.homeTeam} gol ort: ${homeGoals}
- ${match.awayTeam} gol ort: ${awayGoals}
- Beklenen toplam: ${totalExpected.toFixed(1)}
- Üst 2.5 olası mı: ${over25Likely ? 'EVET' : 'HAYIR'}

🎯 JSON FORMAT:
{
  "valuesBets": ${hasOdds ? `[
    {"market": "Bahis Pazarı", "selection": "Seçim", "odds": ORAN, "fairOdds": HESAPLANAN, "value": DEĞER, "confidence": 70}
  ]` : '[]'},
  "oddsMovement": ${hasOdds ? '[{"market": "1X2", "direction": "stable", "significance": "Oran sabit"}]' : '[]'},
  "bookmakerConsensus": [
    {"market": "Toplam Gol", "consensus": "${over25Likely ? 'Üst 2.5 bekleniyor' : 'Alt 2.5 bekleniyor'}", "confidence": ${Math.round(50 + Math.abs(totalExpected - 2.5) * 10)}}
  ],
  "sharpMoney": [],
  "summary": "${hasOdds ? 'Oran analizi yapıldı.' : 'Oran verisi mevcut değil. Form verilerine göre beklenen toplam gol: ' + totalExpected.toFixed(1)}"
}

⚠️ ORAN VERİSİ YOKSA valuesBets BOŞ OLMALI!` },
  ];

  return await heurist.chatJSON<OddsReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.3,
    maxTokens: 1500
  });
}
