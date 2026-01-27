/**
 * TÜRKÇE FUTBOL TAHMİN AJANLAR
 * Basit, etkili, futbol-odaklı promptlar
 */

export const TR_PROMPTS = {
  // 🎯 AGENT 1: İSTATİSTİK AJANSI (Verileri yorumla)
  istatistik: {
    system: `Sen bir futbol istatistikçisisin. Verileri analiz et, net sonuçlar çıkar.
KURALLARI SAKLA: JSON formatında cevap ver. Hiçbir açıklama ekleme.`,
    
    user: (match: any, stats: any) => `
${match.homeTeam} vs ${match.awayTeam}

EV SAHİBİ (${match.homeTeam}):
- Son 5: ${stats.home.form}
- Ortalama gol: ${stats.home.avgGF}/${stats.home.avgGA}
- Ev oranı: %${stats.home.homeWinRate}
- Forma: ${stats.home.trend}

KONUKç (${match.awayTeam}):
- Son 5: ${stats.away.form}
- Ortalama gol: ${stats.away.avgGF}/${stats.away.avgGA}
- Deplasman oranı: %${stats.away.awayWinRate}
- Forma: ${stats.away.trend}

H2H (${stats.h2h.matches} maç):
- ${match.homeTeam}: ${stats.h2h.homeWins}W ${stats.h2h.draws}D ${stats.h2h.awayWins}L
- Ortalama gol: ${stats.h2h.avgGoals}

JSON Çıktı (hiçbir şey ekleme):
{
  "homeWinPercent": <0-100>,
  "drawPercent": <0-100>,
  "awayWinPercent": <0-100>,
  "expectedGoals": <0-6>,
  "bttsProb": <0-100>,
  "over25Prob": <0-100>,
  "confidence": <1-10>,
  "analysis": "Tek satır özet"
}
`
  },

  // 🔥 AGENT 2: FORMA AJANSI (Momentum analizi)
  forma: {
    system: `Sen futbol forması ve momentum uzmanısın. Takımın psikolojik durumunu ve momentumunu analiz et.
KURALLAR: JSON formatında. Duygusal/psikolojik faktörler.`,
    
    user: (match: any, stats: any) => `
${match.homeTeam} vs ${match.awayTeam}

${match.homeTeam} FORMASI:
- Son 5 maç: ${stats.home.last5}
- Sorunlar: ${stats.home.issues || 'Yok'}
- Motivasyon: ${stats.home.motivation || 'Normal'}
- Kazanç zinciri: ${stats.home.streak || 'Yok'}

${match.awayTeam} FORMASI:
- Son 5 maç: ${stats.away.last5}
- Sorunlar: ${stats.away.issues || 'Yok'}
- Motivasyon: ${stats.away.motivation || 'Normal'}
- Kayıp zinciri: ${stats.away.streak || 'Yok'}

JSON (hiçbir açıklama):
{
  "homeMomentum": <1-10>,
  "awayMomentum": <1-10>,
  "homePsychological": "Bir satır",
  "awayPsychological": "Bir satır",
  "favoriteShift": "${match.homeTeam}"|"${match.awayTeam}"|"neutral",
  "forecastShift": <+2 to -2 puan>
}
`
  },

  // ⚔️ AGENT 3: H2H UZMANSI (Geçmiş maçlar)
  h2h: {
    system: `Sen H2H (head-to-head) historisyenisin. Geçmiş maçlardan pattern çıkar.
KURALLAR: JSON. Sadece veriye dayalı analiz.`,
    
    user: (match: any, h2h: any) => `
${match.homeTeam} vs ${match.awayTeam}

SON 10 KARŞILAŞMA:
${h2h.recent.map((m: any) => `- ${m.date}: ${m.home} ${m.homeGoals}-${m.awayGoals} ${m.away}`).join('\n')}

TEZAHÜRAT:
- ${match.homeTeam} ev: ${h2h.homeRecord.wins}W ${h2h.homeRecord.draws}D ${h2h.homeRecord.losses}L
- ${match.awayTeam} deplasman: ${h2h.awayRecord.wins}W ${h2h.awayRecord.draws}D ${h2h.awayRecord.losses}L
- BTTS: ${h2h.bttsPercent}%
- Over 2.5: ${h2h.over25Percent}%

JSON:
{
  "homeH2HEdge": <1-10>,
  "awayH2HEdge": <1-10>,
  "likelyPattern": "Bir satır",
  "bttsHistoric": <0-100>,
  "over25Historic": <0-100>,
  "goalFreq": {
    "under15": <0-100>,
    "15to25": <0-100>,
    "over25": <0-100>
  }
}
`
  },

  // 🧠 AGENT 4: KONSENSÜS (Karar ver)
  konsensus: {
    system: `Sen futbol tahmin danışmanısın. 4 ajanın görüşünü sen topla ve karar ver.
KURALLARA SAKLA: 
- Sadece JSON cevap
- En az 65% confidence gerekir
- Eğer confidence düşükse "inconclusive" de
- Para kazandır`,
    
    user: (match: any, agents: any) => `
SKOR: ${match.homeTeam} vs ${match.awayTeam}

AGENT RAPORLARI:
1. İstatistikçi: ${JSON.stringify(agents.istatistik)}
2. Forma: ${JSON.stringify(agents.forma)}
3. H2H: ${JSON.stringify(agents.h2h)}

SORULAR:
1. Kimin kazanma ihtimali daha yüksek?
2. BTTS (Her iki takım da gol atar) mi?
3. Over 2.5 gol var mı?
4. En iyi bet hangisi?

JSON KARAR (PARANIN İÇİN GEREKLI):
{
  "prediction": "${match.homeTeam} win"|"draw"|"${match.awayTeam} win",
  "confidence": <1-100>,
  "expectedGoals": <0-6>,
  "btts": true|false,
  "over25": true|false,
  "bestBet": "1X2"|"BTTS"|"Over"|"Under"|"Draw No Bet",
  "odds_target": "1.50-2.50 arası",
  "reasoning": "2-3 satır neden?"
}
`
  }
};
