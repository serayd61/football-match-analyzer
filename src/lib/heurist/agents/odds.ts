import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, OddsReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `💰 SEN DÜNYANIN EN İYİ BAHİS ORAN ANALİSTİSİN!

GÖREV: Oranları analiz et ve VALUE BET'leri tespit et.

MUTLAKA BUL:
1. valuesBets: En az 2 value bet (market, selection, odds, fairOdds, value, confidence)
2. oddsMovement: Oran hareketleri (market, direction, significance)
3. bookmakerConsensus: Bahisçi konsensüsü (market, consensus, confidence)
4. sharpMoney: Akıllı para nereye gidiyor (market, side, indicator)

VALUE HESABI:
- Value = ((Gerçek Olasılık × Oran) - 1) × 100
- %5+ value olan bahisleri bul!

KURALLAR:
- Her value bet için odds ve value SAYI olmalı
- confidence 0-100 arası SAYI olmalı
- Türkçe yanıt ver
- SADECE JSON döndür`,

  en: `💰 YOU ARE THE WORLD'S BEST BETTING ODDS ANALYST!

TASK: Analyze odds and detect VALUE BETS.

MUST FIND:
1. valuesBets: At least 2 value bets (market, selection, odds, fairOdds, value, confidence)
2. oddsMovement: Odds movements (market, direction, significance)
3. bookmakerConsensus: Bookmaker consensus (market, consensus, confidence)
4. sharpMoney: Where smart money is going (market, side, indicator)

VALUE CALCULATION:
- Value = ((True Probability × Odds) - 1) × 100
- Find bets with 5%+ value!

RULES:
- Each value bet must have odds and value as NUMBERS
- confidence must be NUMBER between 0-100
- Respond in English
- Return ONLY JSON`,

  de: `💰 DU BIST DER BESTE WETTQUOTEN-ANALYST DER WELT!

AUFGABE: Analysiere Quoten und erkenne VALUE BETS.

MUSS FINDEN:
1. valuesBets: Mindestens 2 Value Bets
2. oddsMovement: Quotenbewegungen
3. bookmakerConsensus: Buchmacher-Konsens
4. sharpMoney: Wohin das smarte Geld fließt

REGELN:
- Alle Zahlen müssen ZAHLEN sein
- Auf Deutsch antworten
- NUR JSON zurückgeben`,
};

export async function runOddsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<OddsReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

💰 MEVCUT ORANLAR:
┌─────────────────────────────────────────────┐
│ 1X2: EV=${match.odds?.matchWinner?.home || 2.10} | X=${match.odds?.matchWinner?.draw || 3.40} | DEP=${match.odds?.matchWinner?.away || 3.50}
│ Ü/A 2.5: Üst=${match.odds?.overUnder?.['2.5']?.over || 1.85} | Alt=${match.odds?.overUnder?.['2.5']?.under || 1.95}
│ KG: Var=${match.odds?.btts?.yes || 1.80} | Yok=${match.odds?.btts?.no || 2.00}
│ Çifte Şans: 1X=${match.odds?.doubleChance?.homeOrDraw || 1.35} | X2=${match.odds?.doubleChance?.awayOrDraw || 1.75} | 12=${match.odds?.doubleChance?.homeOrAway || 1.45}
└─────────────────────────────────────────────┘

📊 FORM VERİLERİ:
- ${match.homeTeam}: ${match.homeForm?.form || 'WDLWW'} (${match.homeForm?.points || 15}/30 puan)
- ${match.awayTeam}: ${match.awayForm?.form || 'LWDLW'} (${match.awayForm?.points || 12}/30 puan)

⚔️ KAFA KAFAYA:
- ${match.h2h?.totalMatches || 10} maç, Üst 2.5: %${match.h2h?.over25Percentage || 60}, KG: %${match.h2h?.bttsPercentage || 55}

🎯 JSON FORMAT (TÜM ALANLARI DOLDUR!):
{
  "valuesBets": [
    {
      "market": "Üst 2.5 Gol",
      "selection": "Üst",
      "odds": 1.85,
      "fairOdds": 1.65,
      "value": 12.1,
      "confidence": 75
    },
    {
      "market": "Karşılıklı Gol",
      "selection": "Var",
      "odds": 1.80,
      "fairOdds": 1.70,
      "value": 5.9,
      "confidence": 70
    }
  ],
  "oddsMovement": [
    {"market": "1X2", "direction": "down", "significance": "Ev sahibi oranı düşüyor - para ev sahibine akıyor"},
    {"market": "Üst 2.5", "direction": "stable", "significance": "Oran sabit - piyasa dengeli"}
  ],
  "bookmakerConsensus": [
    {"market": "Maç Sonucu", "consensus": "Ev sahibi hafif favori", "confidence": 65},
    {"market": "Toplam Gol", "consensus": "2-3 gol bekleniyor", "confidence": 70}
  ],
  "sharpMoney": [
    {"market": "Üst 2.5 Gol", "side": "Üst", "indicator": "Keskin bahisçiler üst oynuyor"},
    {"market": "1X2", "side": "Ev sahibi", "indicator": "Büyük bahisler ev sahibine"}
  ],
  "summary": "Detaylı Türkçe özet - value bet'ler ve oran analizi hakkında en az 2 cümle"
}

⚠️ SADECE JSON DÖNDÜR! TÜM SAYISAL DEĞERLERİ DOLDUR!` },
  ];

  return await heurist.chatJSON<OddsReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.6,
    maxTokens: 2000
  });
}
