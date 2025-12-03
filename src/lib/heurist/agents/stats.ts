import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StatsReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `📊 SEN DÜNYANIN EN İYİ FUTBOL İSTATİSTİK UZMANISISN!

GÖREV: Detaylı istatistik analizi yap ve KESİN rakamlar ver.

MUTLAKA HESAPLA:
1. homeStrength: Ev sahibi takım gücü (0-100 arası SAYI)
2. awayStrength: Deplasman takımı gücü (0-100 arası SAYI)
3. goalExpectancy: Gol beklentisi (home, away, total - ONDALIKLI SAYILAR)
4. keyStats: En az 5 önemli istatistik
5. patterns: En az 3 pattern/trend

KURALLAR:
- TÜM SAYILARI DOLDUR, "N/A" YASAK!
- homeStrength ve awayStrength 0-100 arası SAYI olmalı
- goalExpectancy.home, goalExpectancy.away, goalExpectancy.total SAYI olmalı
- Türkçe yanıt ver
- SADECE JSON döndür`,

  en: `📊 YOU ARE THE WORLD'S BEST FOOTBALL STATISTICS EXPERT!

TASK: Perform detailed statistical analysis and give DEFINITE numbers.

MUST CALCULATE:
1. homeStrength: Home team strength (NUMBER between 0-100)
2. awayStrength: Away team strength (NUMBER between 0-100)
3. goalExpectancy: Goal expectancy (home, away, total - DECIMAL NUMBERS)
4. keyStats: At least 5 key statistics
5. patterns: At least 3 patterns/trends

RULES:
- FILL ALL NUMBERS, "N/A" is FORBIDDEN!
- homeStrength and awayStrength must be NUMBERS between 0-100
- goalExpectancy.home, goalExpectancy.away, goalExpectancy.total must be NUMBERS
- Respond in English
- Return ONLY JSON`,

  de: `📊 DU BIST DER BESTE FUßBALL-STATISTIK-EXPERTE DER WELT!

AUFGABE: Führe detaillierte statistische Analyse durch und gib DEFINITIVE Zahlen.

MUSS BERECHNEN:
1. homeStrength: Heimstärke (ZAHL zwischen 0-100)
2. awayStrength: Auswärtsstärke (ZAHL zwischen 0-100)
3. goalExpectancy: Torerwartung (home, away, total - DEZIMALZAHLEN)
4. keyStats: Mindestens 5 wichtige Statistiken
5. patterns: Mindestens 3 Muster/Trends

REGELN:
- ALLE ZAHLEN AUSFÜLLEN, "N/A" ist VERBOTEN!
- homeStrength und awayStrength müssen ZAHLEN zwischen 0-100 sein
- Auf Deutsch antworten
- NUR JSON zurückgeben`,
};

export async function runStatsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<StatsReport | null> {
  const labels = {
    tr: { home: 'Ev Sahibi', away: 'Deplasman', form: 'Form', pts: 'Puan', goals: 'Gol Ort', conceded: 'Yenilen', h2h: 'Kafa Kafaya' },
    en: { home: 'Home', away: 'Away', form: 'Form', pts: 'Points', goals: 'Goals Avg', conceded: 'Conceded', h2h: 'Head to Head' },
    de: { home: 'Heim', away: 'Auswärts', form: 'Form', pts: 'Punkte', goals: 'Tore Ø', conceded: 'Gegentore', h2h: 'Direktvergleich' },
  };
  const l = labels[language];

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}
🏆 LİG: ${match.league || 'Premier League'}

📊 ${match.homeTeam} (${l.home}):
- ${l.form}: ${match.homeForm?.form || 'WDLWW'}
- ${l.pts}: ${match.homeForm?.points || 15}/30
- ${l.goals}: ${match.homeForm?.avgGoals || '1.5'}
- ${l.conceded}: ${match.homeForm?.avgConceded || '1.2'}
- Üst 2.5: %${match.homeForm?.over25Percentage || '60'}
- KG: %${match.homeForm?.bttsPercentage || '55'}

📊 ${match.awayTeam} (${l.away}):
- ${l.form}: ${match.awayForm?.form || 'LWDLW'}
- ${l.pts}: ${match.awayForm?.points || 12}/30
- ${l.goals}: ${match.awayForm?.avgGoals || '1.3'}
- ${l.conceded}: ${match.awayForm?.avgConceded || '1.4'}
- Üst 2.5: %${match.awayForm?.over25Percentage || '55'}
- KG: %${match.awayForm?.bttsPercentage || '50'}

⚔️ ${l.h2h}:
- Toplam: ${match.h2h?.totalMatches || 10} maç
- ${match.homeTeam}: ${match.h2h?.homeWins || 4} galibiyet
- ${match.awayTeam}: ${match.h2h?.awayWins || 3} galibiyet
- Beraberlik: ${match.h2h?.draws || 3}
- Gol Ort: ${match.h2h?.avgGoals || '2.5'}

🎯 JSON FORMAT (TÜM ALANLARI DOLDUR!):
{
  "homeStrength": 72,
  "awayStrength": 65,
  "formComparison": "Ev sahibi son 5 maçta daha iyi performans gösterdi",
  "goalExpectancy": {
    "home": 1.6,
    "away": 1.1,
    "total": 2.7
  },
  "keyStats": [
    {"stat": "Ev sahibi gol ortalaması", "home": "1.8", "away": "1.2", "advantage": "home"},
    {"stat": "Deplasman defansı", "home": "1.0", "away": "1.5", "advantage": "home"},
    {"stat": "Son 5 maç puanı", "home": "12", "away": "9", "advantage": "home"},
    {"stat": "Üst 2.5 oranı", "home": "65%", "away": "55%", "advantage": "home"},
    {"stat": "KG oranı", "home": "60%", "away": "50%", "advantage": "home"}
  ],
  "patterns": [
    "Ev sahibi son 4 ev maçında gol attı",
    "Deplasman takımı son 3 deplasmanda gol yedi",
    "Kafa kafaya maçlarda ortalama 2.5+ gol"
  ],
  "summary": "Detaylı Türkçe özet - en az 2 cümle"
}

⚠️ SADECE JSON DÖNDÜR! TÜM SAYISAL DEĞERLERİ DOLDUR!` },
  ];

  return await heurist.chatJSON<StatsReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.6,
    maxTokens: 2000
  });
}
