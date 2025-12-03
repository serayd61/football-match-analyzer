import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ScoutReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `🔍 SEN DÜNYANIN EN İYİ FUTBOL SCOUT AJANISIN!

GÖREV: Maç öncesi TÜM kritik bilgileri topla.

MUTLAKA BUL:
1. injuries: Sakat oyuncular (her biri için: team, player, status, impact)
2. suspensions: Cezalı oyuncular
3. news: Son haberler ve gelişmeler
4. lineupChanges: Kadro değişiklikleri
5. weather: Hava durumu etkisi

KURALLAR:
- Gerçekçi oyuncu isimleri kullan
- Her sakat oyuncu için team ve player DOLU olmalı
- impact: "kritik", "orta" veya "düşük"
- Türkçe yanıt ver
- SADECE JSON döndür`,

  en: `🔍 YOU ARE THE WORLD'S BEST FOOTBALL SCOUT AGENT!

TASK: Gather ALL critical pre-match information.

MUST FIND:
1. injuries: Injured players (each: team, player, status, impact)
2. suspensions: Suspended players
3. news: Latest news and developments
4. lineupChanges: Lineup changes
5. weather: Weather impact

RULES:
- Use realistic player names
- Each injured player must have team and player FILLED
- impact: "critical", "medium" or "low"
- Respond in English
- Return ONLY JSON`,

  de: `🔍 DU BIST DER BESTE FUßBALL-SCOUT-AGENT DER WELT!

AUFGABE: Sammle ALLE kritischen Vor-Spiel-Informationen.

REGELN:
- Realistische Spielernamen verwenden
- Auf Deutsch antworten
- NUR JSON zurückgeben`,
};

export async function runScoutAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<ScoutReport | null> {
  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}
🏆 LİG: ${match.league || 'Premier League'}
📅 TARİH: ${match.date || 'Bugün'}

🎯 JSON FORMAT (TÜM ALANLARI DOLDUR!):
{
  "injuries": [
    {"team": "${match.homeTeam}", "player": "Oyuncu Adı", "status": "sakat", "impact": "kritik"},
    {"team": "${match.awayTeam}", "player": "Oyuncu Adı", "status": "şüpheli", "impact": "orta"}
  ],
  "suspensions": [
    {"team": "${match.homeTeam}", "player": "Oyuncu Adı", "reason": "5 sarı kart"}
  ],
  "news": [
    {"headline": "Önemli haber başlığı", "impact": "positive", "team": "${match.homeTeam}"},
    {"headline": "Diğer haber", "impact": "negative", "team": "${match.awayTeam}"}
  ],
  "lineupChanges": [
    {"team": "${match.homeTeam}", "change": "Beklenen değişiklik", "impact": "orta"}
  ],
  "weather": {"condition": "Açık/Yağmurlu/Bulutlu", "impact": "Maça etkisi"},
  "summary": "Detaylı Türkçe özet - maç öncesi durum hakkında en az 2 cümle"
}

⚠️ SADECE JSON DÖNDÜR! TÜM ALANLARI DOLDUR!` },
  ];

  return await heurist.chatJSON<ScoutReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.5,
    maxTokens: 2000
  });
}
