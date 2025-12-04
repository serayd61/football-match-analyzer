import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, StatsReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `📊 SEN İSTATİSTİK ANALİZ AJANISIN.

⚠️ KRİTİK KURALLAR:
1. SADECE verilen istatistikleri analiz et
2. Verilen sayıları kullanarak hesaplama yap
3. goalExpectancy hesabı: (homeAvgGoals + awayAvgGoals) / 2 civarı olmalı
4. UYDURMA, SADECE VERİLEN VERİYİ KULLAN

Türkçe yanıt ver. SADECE JSON döndür.`,

  en: `📊 YOU ARE A STATISTICS ANALYSIS AGENT.

⚠️ CRITICAL RULES:
1. ONLY analyze the statistics PROVIDED
2. Calculate using the given numbers
3. goalExpectancy calculation: should be around (homeAvgGoals + awayAvgGoals)
4. DO NOT MAKE UP DATA, USE ONLY PROVIDED DATA

Respond in English. Return ONLY JSON.`,

  de: `📊 DU BIST EIN STATISTIK-ANALYSE-AGENT.
NUR die gegebenen Daten verwenden.
Auf Deutsch antworten. NUR JSON zurückgeben.`,
};

export async function runStatsAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<StatsReport | null> {
  
  // Gerçek verileri çıkar
  const homeGoals = parseFloat(match.homeForm?.avgGoals || '0') || 0;
  const awayGoals = parseFloat(match.awayForm?.avgGoals || '0') || 0;
  const homeOver25 = parseInt(match.homeForm?.over25Percentage || '0') || 0;
  const awayOver25 = parseInt(match.awayForm?.over25Percentage || '0') || 0;
  const h2hAvgGoals = parseFloat(match.h2h?.avgGoals || '0') || 0;
  const h2hOver25 = parseInt(match.h2h?.over25Percentage || '0') || 0;
  
  // Hesaplamalar
  const expectedTotalGoals = homeGoals + awayGoals;
  const avgOver25Pct = (homeOver25 + awayOver25 + h2hOver25) / 3;
  const predictedOverUnder = avgOver25Pct > 50 || expectedTotalGoals > 2.5 ? 'Over' : 'Under';

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}

📊 VERİLEN İSTATİSTİKLER (SADECE BUNLARI KULLAN!):

${match.homeTeam}:
- Form: ${match.homeForm?.form || 'N/A'}
- Puan: ${match.homeForm?.points || 0}/15
- Gol Ortalaması: ${homeGoals}
- Yenilen Gol: ${match.homeForm?.avgConceded || 'N/A'}
- Üst 2.5 Oranı: %${homeOver25}
- KG Oranı: %${match.homeForm?.bttsPercentage || 0}

${match.awayTeam}:
- Form: ${match.awayForm?.form || 'N/A'}
- Puan: ${match.awayForm?.points || 0}/15
- Gol Ortalaması: ${awayGoals}
- Yenilen Gol: ${match.awayForm?.avgConceded || 'N/A'}
- Üst 2.5 Oranı: %${awayOver25}
- KG Oranı: %${match.awayForm?.bttsPercentage || 0}

H2H:
- Toplam Maç: ${match.h2h?.totalMatches || 0}
- Gol Ortalaması: ${h2hAvgGoals}
- Üst 2.5: %${h2hOver25}

📐 HESAPLAMALAR (BU DEĞERLERİ KULLAN!):
- Beklenen Toplam Gol: ${expectedTotalGoals.toFixed(1)} (${homeGoals} + ${awayGoals})
- Ortalama Üst 2.5 Yüzdesi: %${avgOver25Pct.toFixed(0)}
- Önerilen Tahmin: ${predictedOverUnder} 2.5

🎯 JSON FORMAT (HESAPLANAN DEĞERLERİ KULLAN!):
{
  "homeStrength": ${Math.min(Math.round(homeGoals * 30 + (match.homeForm?.points || 0) * 3), 100)},
  "awayStrength": ${Math.min(Math.round(awayGoals * 30 + (match.awayForm?.points || 0) * 3), 100)},
  "formComparison": "Form karşılaştırması",
  "goalExpectancy": {
    "home": ${homeGoals.toFixed(1)},
    "away": ${awayGoals.toFixed(1)},
    "total": ${expectedTotalGoals.toFixed(1)}
  },
  "keyStats": [
    {"stat": "Ev sahibi gol ort.", "home": "${homeGoals}", "away": "${awayGoals}", "advantage": "${homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'equal'}"},
    {"stat": "Üst 2.5 oranı", "home": "${homeOver25}%", "away": "${awayOver25}%", "advantage": "${homeOver25 > awayOver25 ? 'home' : 'away'}"}
  ],
  "patterns": [
    "Beklenen toplam gol: ${expectedTotalGoals.toFixed(1)}",
    "H2H maçlarda ortalama ${h2hAvgGoals} gol",
    "Üst 2.5 olasılığı: %${avgOver25Pct.toFixed(0)}"
  ],
  "summary": "İstatistiklere göre bu maçta ${expectedTotalGoals.toFixed(1)} civarı gol bekleniyor. ${predictedOverUnder} 2.5 daha olası görünüyor."
}

⚠️ goalExpectancy.total MUTLAKA ${expectedTotalGoals.toFixed(1)} OLMALI!` },
  ];

  return await heurist.chatJSON<StatsReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.3,
    maxTokens: 1500
  });
}
