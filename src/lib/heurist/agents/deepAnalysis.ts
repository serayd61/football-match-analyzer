// src/lib/heurist/agents/deepAnalysis.ts

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { getLeagueProfile, adjustPredictionByLeague, LeagueProfile } from '../../football-intelligence/league-profiles';
import { fetchRefereeFromSportMonks, analyzeRefereeImpact, RefereeMatchImpact } from '../../football-intelligence/referee-stats';
import { calculateComprehensiveProbabilities, generateProbabilityContext, ProbabilityResult } from '../probability-engine';
import { analyzeTeamMotivation, TeamMotivationAnalysis } from './team-motivation-analyzer';
import { getLearningContext } from '../../ai-brain/learning-context';

// 🎯 DEEP ANALYSIS PROMPT - SADELEŞTİRİLMİŞ: MOTİVASYON VE DUYGU ANALİZİ ODAKLI
// Sportmonks verilerini analiz ederek takımların maça hazırlık durumunu değerlendirir

const DEEP_ANALYSIS_PROMPT = {
  tr: `Sen deneyimli bir FUTBOL PSİKOLOĞU ve TAHMİN UZMANISINSSIN. 20+ yıllık deneyiminle takımların RUHUNU okuyorsun.

═══════════════════════════════════════════════════════════════════════════════
🎯 AGRESİF ANALİZ FELSEFESİ: %40 VERİ + %30 ÖNGÖRÜ + %30 MOTİVASYON
═══════════════════════════════════════════════════════════════════════════════

⚡ CESUR OL! Veri seni sınırlamasın. %60 oranında ÖNGÖRÜ + MOTİVASYON kullan!

📊 %40 VERİ ANALİZİ (Temel - ama baskın değil!):
- Form, gol ortalamaları, H2H - bunlar BAŞLANGIÇ NOKTASI
- xG ve istatistikler temel sağlar
- AMA: Veri geçmişi gösterir, geleceği DEĞİL!
- Piyasa zaten bu verileri görüyor = edge yok

🔮 %30 ÖNGÖRÜ VE CESUR TAHMİN (Piyasayı yenmek için):
- Maç nasıl oynanacak? CESUR TAHMİN YAP!
- Piyasanın görmediği şeyleri bul
- "Herkesin beklediği" vs "Gerçekte olacak" farkını yakala
- Sürpriz tahminlerden KORKMA!
- Taktiksel eşleşme: Hangi oyun stili kazanır?
- Tempo: Yüksek tempo kimin işine gelir?
- İstatistiklerin GÖRMEDİĞİ şeyler neler?

💪 %30 MOTİVASYON VE PSİKOLOJİ (Futbol kalple oynanır!):
- Takımın RUHUNU oku! Bu maç onlar için ne ifade ediyor?
- Motivasyon farkı maçı BELİRLER:
  * Şampiyonluk yarışı = +20 motivasyon
  * Düşme hattı = +15 motivasyon (hayatta kalma içgüdüsü)
  * Derbi/Rival = +25 motivasyon
  * Sıradan maç = 0 ekstra
- "Kaybedecek bir şeyi yok" takımı hangisi? (Tehlikeli!)
- Baskı altında kim daha iyi? Tecrübeli kadro mu, genç ve hevesli mi?
- Taraftar baskısı: Yukarı mı iter, aşağı mı çeker?
- Yorgunluk: Yoğun fikstür varsa dikkat!
- Takım kimyası: İç sorunlar, hoca baskısı, transfer dedikoduları

🔥 ÖNEMLİ: FUTBOL SADECE RAKAMLARDAN İBARET DEĞİL!
Aynı 11 oyuncu farklı motivasyonla %30 farklı oynar.
%60 ÖNGÖRÜ + MOTİVASYON ile fark yaratacaksın!

═══════════════════════════════════════════════════════════════════════════════

📊 ANALİZ KRİTERLERİ:

1. FORM GRAFİĞİ ANALİZİ (Son 10 maç)
   - W (Galibiyet) = 3 puan, D (Beraberlik) = 1 puan, L (Mağlubiyet) = 0 puan
   - Son 3 maç vs Önceki 3 maç karşılaştırması → Trend tespiti
   - Galibiyet serisi veya mağlubiyet serisi var mı?

2. TREND TESPİTİ
   - "improving": Son 3 maç önceki 3 maçtan daha iyi → Takım yükselişte 🔼
   - "declining": Son 3 maç önceki 3 maçtan daha kötü → Takım düşüşte 🔽
   - "stable": Benzer performans → Takım stabil ➡️

3. MOTİVASYON SKORU (0-100)
   - 80-100: Mükemmel form, yüksek motivasyon, takım çok hazır 🔥
   - 60-79: İyi form, normal motivasyon, takım hazır ✅
   - 40-59: Orta form, düşük motivasyon, takım yarı hazır ⚠️
   - 20-39: Kötü form, çok düşük motivasyon, takım hazır değil ❌
   - 0-19: Felaket form, motivasyon yok, ciddi sorun 💀

4. PSİKOLOJİK FAKTÖRLER
   - Ev sahibi avantajı: Taraftar desteği, saha aşinalığı
   - Deplasman dezavantajı: Seyahat yorgunluğu, yabancı ortam
   - Baskı altında performans: Önemli maçlarda overperform/underperform
   - "Nothing to lose" mentalitesi: Alt sıradaki takımın agresifliği

⚡ KISA VE ÖZ YANIT VER - SADECE JSON DÖNDÜR:
{
  "matchAnalysis": "Maçın genel analizi (2-3 cümle, taktiksel ve istatistiksel özet)",
  "criticalFactors": [
    "Kritik faktör 1 (en önemli)",
    "Kritik faktör 2",
    "Kritik faktör 3",
    "Kritik faktör 4",
    "Kritik faktör 5"
  ],
  "probabilities": {
    "homeWin": 35,
    "draw": 30,
    "awayWin": 35
  },
  "expectedScores": ["1-1", "2-1", "1-0"],
  "scorePrediction": {
    "score": "1-1",
    "reasoning": "Bu skorun neden en olası olduğunun açıklaması"
  },
  "overUnder": {
    "prediction": "Over veya Under",
    "confidence": 70,
    "reasoning": "Detaylı açıklama (ev sahibi evde X gol, deplasman dışarıda Y gol...)"
  },
  "btts": {
    "prediction": "Yes veya No",
    "confidence": 65,
    "reasoning": "Detaylı açıklama"
  },
  "matchResult": {
    "prediction": "1 veya X veya 2",
    "confidence": 55,
    "reasoning": "Detaylı açıklama"
  },
  "bestBet": {
    "type": "Over/Under 2.5 veya BTTS veya Match Result",
    "selection": "Seçim (Over/Under/Yes/No/1/X/2)",
    "confidence": 72,
    "reasoning": "Neden bu en iyi bahis seçeneği"
  },
  "refereeAnalysis": {
    "name": "Hakem adı",
    "avgYellowCards": 4.2,
    "avgRedCards": 0.2,
    "avgPenalties": 0.3,
    "homeTeamBias": "neutral/slight_home/slight_away",
    "cardPrediction": "Over 3.5 veya Under 3.5",
    "reasoning": "Hakem analizi özeti"
  },
  "weatherImpact": {
    "condition": "Clear/Rain/Wind/Cold/Hot",
    "temperature": 15,
    "impact": "Düşük/Orta/Yüksek",
    "reasoning": "Hava durumu maçı nasıl etkiler"
  },
  "lineupAnalysis": {
    "homeFormation": "4-3-3",
    "awayFormation": "4-4-2",
    "keyBattles": ["Kanat oyunu kritik", "Orta saha mücadelesi belirleyici"],
    "missingKeyPlayers": ["Oyuncu 1 (ev)", "Oyuncu 2 (dep)"]
  },
  "cornersAndCards": {
    "expectedCorners": 10.5,
    "cornersLine": "Over 9.5",
    "cornersConfidence": 65,
    "expectedCards": 4.2,
    "cardsLine": "Over 3.5",
    "cardsConfidence": 62
  },
  "halfTimeGoals": {
    "prediction": "Over veya Under",
    "line": 1.5,
    "expectedGoals": 1.2,
    "confidence": 65,
    "reasoning": "İlk yarı gol tahmini - takımların ilk yarı performanslarına göre"
  },
  "halfTimeFullTime": {
    "prediction": "1/1 veya 1/X veya X/1 veya X/X veya 2/1 veya 2/X veya 1/2 veya X/2 veya 2/2",
    "confidence": 60,
    "reasoning": "İlk yarı sonucu / Maç sonucu kombinasyonu tahmini. Örnek: 1/1 = İlk yarı ev sahibi önde, maç sonunda ev sahibi kazandı"
  },
  "matchResultOdds": {
    "home": 65,
    "draw": 25,
    "away": 10,
    "reasoning": "Maç sonucu olasılıkları (yüzde olarak)"
  },
  "preparationScore": {
    "home": 65,
    "away": 58,
    "reasoning": {
      "home": "Takımın maça hazırlanma durumu, motivasyonu, temposu ve form eğilimi",
      "away": "Takımın maça hazırlanma durumu, motivasyonu, temposu ve form eğilimi"
    }
  },
  "motivationScores": {
    "home": 75,
    "away": 60,
    "homeTrend": "improving/declining/stable",
    "awayTrend": "improving/declining/stable",
    "homeFormGraph": "WWLWDWWLWW (son 10 maç formu)",
    "awayFormGraph": "LWWDLWLLWW (son 10 maç formu)",
    "reasoning": "Ev sahibi: Son 10 maçta 7 galibiyet, form yükselişte, yüksek motivasyon. Deplasman: Son 10 maçta 5 galibiyet, form düşüşte, orta motivasyon. Puan farkı: 15 puan."
  },
  "riskLevel": "Low veya Medium veya High",
  "agentSummary": "Tek cümlelik maç özeti ve tavsiye"
}`,

  en: `You are a professional football analyst and betting expert. You will produce match predictions through multi-layered deep analysis.

TASK: Use the provided data to perform comprehensive analysis and return in JSON format.

ANALYSIS LAYERS:

1. TEAM FORM AND DYNAMICS
   - Last 10 match performance
   - Home / Away statistics (VERY IMPORTANT!)
   - Goal expectancy trend
   - Team mental state and motivation level
   - PREPARATION SCORE (0-100): Evaluate team's match preparation feeling, tempo, motivation, form trend, injury situation, match importance to give a 0-100 score. High score = well prepared, high motivation, positive tempo. Low score = poor form, low motivation, fatigue signs.

2. TACTICAL STRUCTURE
   - Strengths and weaknesses
   - How opponent can exploit weaknesses
   - Home advantage evaluation
   - LINEUP ANALYSIS: Expected formation and key players

3. HISTORICAL DATA
   - H2H history
   - Psychological advantage
   - Goal averages in past matches

4. STATISTICAL MODELING
   - Expected goals calculation
   - Over/Under 2.5 probability
   - BTTS probability
   - Result probabilities (1/X/2)

5. CRITICAL FACTORS
   - Injuries and suspensions
   - Match importance in league standings
   - Motivation differences
   - WEATHER: Rain, wind, temperature impact
   - PITCH CONDITIONS: Grass quality, stadium atmosphere

6. REFEREE ANALYSIS (NEW!)
   - Referee's card tendency (avg yellow/red)
   - Penalty award rate
   - Home team bias?
   - Teams' history with this referee

7. CORNERS AND CARDS PREDICTIONS
   - Expected corner count
   - Expected card count
   - Both teams' aggression level

8. PREPARATION SCORE (NEW!)
   - Calculate 0-100 preparation score for both teams
   - Consider: Recent form trend, motivation level, injury situation, match importance (league position), fatigue signs, team mood
   - For home team: HOME performance and preparation status
   - For away team: AWAY performance and preparation status
   - Clearly state the reasoning for each score

IMPORTANT RULES:
- Use home team's HOME match statistics
- Use away team's AWAY match statistics
- Lean towards Under for low-scoring teams
- If no H2H data, weight form data more heavily
- If referee is strict, predict Over cards
- Confidence should be between 50-85%

MUST RETURN IN THIS JSON FORMAT with refereeAnalysis, weatherImpact, lineupAnalysis, cornersAndCards:
{
  "matchAnalysis": "Overall match analysis (2-3 sentences, tactical and statistical summary)",
  "criticalFactors": [
    "Critical factor 1 (most important)",
    "Critical factor 2",
    "Critical factor 3",
    "Critical factor 4",
    "Critical factor 5"
  ],
  "probabilities": {
    "homeWin": 35,
    "draw": 30,
    "awayWin": 35
  },
  "expectedScores": ["1-1", "2-1", "1-0"],
  "scorePrediction": {
    "score": "1-1",
    "reasoning": "Explanation of why this score is most likely"
  },
  "overUnder": {
    "prediction": "Over or Under",
    "confidence": 70,
    "reasoning": "Detailed explanation (home team scores X at home, away scores Y away...)"
  },
  "btts": {
    "prediction": "Yes or No",
    "confidence": 65,
    "reasoning": "Detailed explanation"
  },
  "matchResult": {
    "prediction": "1 or X or 2",
    "confidence": 55,
    "reasoning": "Detailed explanation"
  },
  "bestBet": {
    "type": "Over/Under 2.5 or BTTS or Match Result",
    "selection": "Selection (Over/Under/Yes/No/1/X/2)",
    "confidence": 72,
    "reasoning": "Why this is the best betting option"
  },
  "refereeAnalysis": {
    "name": "Referee name",
    "avgYellowCards": 4.2,
    "avgRedCards": 0.2,
    "avgPenalties": 0.3,
    "homeTeamBias": "neutral/slight_home/slight_away",
    "cardPrediction": "Over 3.5 or Under 3.5",
    "reasoning": "Referee analysis summary"
  },
  "weatherImpact": {
    "condition": "Clear/Rain/Wind/Cold/Hot",
    "temperature": 15,
    "impact": "Low/Medium/High",
    "reasoning": "How weather affects the match"
  },
  "lineupAnalysis": {
    "homeFormation": "4-3-3",
    "awayFormation": "4-4-2",
    "keyBattles": ["Wing play critical", "Midfield battle decisive"],
    "missingKeyPlayers": ["Player 1 (home)", "Player 2 (away)"]
  },
  "cornersAndCards": {
    "expectedCorners": 10.5,
    "cornersLine": "Over 9.5",
    "cornersConfidence": 65,
    "expectedCards": 4.2,
    "cardsLine": "Over 3.5",
    "cardsConfidence": 62
  },
  "preparationScore": {
    "home": 65,
    "away": 58,
    "reasoning": {
      "home": "Team's match preparation state, motivation, tempo, and form trend",
      "away": "Team's match preparation state, motivation, tempo, and form trend"
    }
  },
  "riskLevel": "Low or Medium or High",
  "agentSummary": "One sentence match summary and recommendation"
}`,

  de: `Du bist ein professioneller Fußballanalyst und Wettexperte. Du wirst Spielvorhersagen durch mehrschichtige Tiefenanalyse erstellen.

AUFGABE: Verwende die bereitgestellten Daten für eine umfassende Analyse und gib sie im JSON-Format zurück.

ANALYSE-EBENEN:
1. TEAMFORM UND DYNAMIK - Letzte 10 Spiele, Heim/Auswärts-Statistiken, VORBEREITUNGSSKOR (0-100)
2. TAKTISCHE STRUKTUR - Stärken und Schwächen
3. HISTORISCHE DATEN - H2H-Geschichte
4. STATISTISCHE MODELLIERUNG - Erwartete Tore, Over/Under, BTTS
5. KRITISCHE FAKTOREN - Verletzungen, Spielbedeutung
6. SCHIEDSRICHTER-ANALYSE - Kartentendenz, Penaltys
7. ECKEN UND KARTEN - Erwartete Ecken und Karten
8. VORBEREITUNGSSKOR (NEU!) - 0-100 Skor für beide Teams basierend auf Formtrend, Motivation, Verletzungen, Spielbedeutung

WICHTIGE REGELN:
- Verwende Heimstatistiken für Heimteam
- Verwende Auswärtsstatistiken für Auswärtsteam
- Confidence zwischen 50-85%

MUSS IN DIESEM JSON-FORMAT ZURÜCKGEBEN:
{
  "matchAnalysis": "Gesamtanalyse des Spiels (2-3 Sätze)",
  "criticalFactors": ["Faktor 1", "Faktor 2", "Faktor 3", "Faktor 4", "Faktor 5"],
  "probabilities": { "homeWin": 35, "draw": 30, "awayWin": 35 },
  "expectedScores": ["1-1", "2-1", "1-0"],
  "scorePrediction": { "score": "1-1", "reasoning": "Warum dieses Ergebnis" },
  "overUnder": { "prediction": "Over oder Under", "confidence": 70, "reasoning": "Erklärung" },
  "btts": { "prediction": "Yes oder No", "confidence": 65, "reasoning": "Erklärung" },
  "matchResult": { "prediction": "1 oder X oder 2", "confidence": 55, "reasoning": "Erklärung" },
  "bestBet": { "type": "Typ", "selection": "Auswahl", "confidence": 72, "reasoning": "Warum beste Wette" },
  "refereeAnalysis": { "name": "Name", "avgYellowCards": 4.2, "avgRedCards": 0.2, "avgPenalties": 0.3, "homeTeamBias": "neutral", "cardPrediction": "Over 3.5", "reasoning": "Schiedsrichter-Analyse" },
  "weatherImpact": { "condition": "Clear", "temperature": 15, "impact": "Low", "reasoning": "Wetterauswirkung" },
  "lineupAnalysis": { "homeFormation": "4-3-3", "awayFormation": "4-4-2", "keyBattles": ["Flügel", "Mittelfeld"], "missingKeyPlayers": [] },
  "cornersAndCards": { "expectedCorners": 10.5, "cornersLine": "Over 9.5", "cornersConfidence": 65, "expectedCards": 4.2, "cardsLine": "Over 3.5", "cardsConfidence": 62 },
  "preparationScore": { "home": 65, "away": 58, "reasoning": { "home": "Vorbereitungszustand, Motivation, Tempo, Formtrend", "away": "Vorbereitungszustand, Motivation, Tempo, Formtrend" } },
  "riskLevel": "Low oder Medium oder High",
  "agentSummary": "Einzeilige Zusammenfassung"
}`
};

// ==================== MOTIVATION & PREPARATION SCORE ====================

/**
 * Takımın son 10 maç form grafiğini analiz ederek motivasyon/hazırlık puanı hesapla (0-100)
 */
function calculateTeamMotivationScore(
  formString: string,
  matches: any[],
  points: number,
  recentWeeks: number = 3
): {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  reasoning: string;
  formGraph: string;
} {
  if (!formString || formString.length === 0) {
    return {
      score: 50,
      trend: 'stable',
      reasoning: 'Form verisi yetersiz',
      formGraph: 'N/A'
    };
  }

  // Son 10 maç form grafiği (en yeni en sağda)
  const last10Form = formString.slice(-10).split('').reverse(); // En yeni maç ilk sırada
  const formGraph = last10Form.join(' → ');

  // Form puanları (W=3, D=1, L=0)
  const formPoints = last10Form.map((r: string) => {
    if (r === 'W') return 3;
    if (r === 'D') return 1;
    return 0;
  });

  // Son 3 hafta (son 3 maç) vs önceki 3 hafta (4-6. maçlar)
  const recent3Matches = formPoints.slice(0, 3);
  const previous3Matches = formPoints.slice(3, 6);
  
  const recentAvg = recent3Matches.reduce((a: number, b: number) => a + b, 0) / recent3Matches.length;
  const previousAvg = previous3Matches.length > 0 
    ? previous3Matches.reduce((a: number, b: number) => a + b, 0) / previous3Matches.length 
    : recentAvg;

  // Trend analizi
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg > previousAvg + 0.3) trend = 'improving';
  else if (recentAvg < previousAvg - 0.3) trend = 'declining';

  // Temel puan (form puanlarına göre)
  const totalFormPoints = formPoints.reduce((a: number, b: number) => a + b, 0);
  const maxPossible = 10 * 3; // 10 maç, her biri 3 puan
  const baseScore = (totalFormPoints / maxPossible) * 60; // 0-60 arası

  // Trend bonusu/cezası
  let trendBonus = 0;
  if (trend === 'improving') {
    trendBonus = Math.min(20, (recentAvg - previousAvg) * 10); // +0-20
  } else if (trend === 'declining') {
    trendBonus = Math.max(-20, (recentAvg - previousAvg) * 10); // -0-20
  }

  // Son maçlar momentum (son 2-3 maçın ağırlığı)
  const last3Avg = formPoints.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
  const momentumBonus = (last3Avg / 3) * 20; // +0-20

  // Final puan
  const finalScore = Math.round(Math.max(0, Math.min(100, baseScore + trendBonus + momentumBonus)));

  // Reasoning
  const wins = last10Form.filter((r: string) => r === 'W').length;
  const draws = last10Form.filter((r: string) => r === 'D').length;
  const losses = last10Form.filter((r: string) => r === 'L').length;
  
  let reasoning = `Son 10 maç: ${wins}G-${draws}B-${losses}M (${totalFormPoints}/${maxPossible} puan)`;
  if (trend === 'improving') {
    reasoning += `. Son haftalarda performans artıyor (${recentAvg.toFixed(1)} vs ${previousAvg.toFixed(1)} puan/maç)`;
  } else if (trend === 'declining') {
    reasoning += `. Son haftalarda performans düşüyor (${recentAvg.toFixed(1)} vs ${previousAvg.toFixed(1)} puan/maç)`;
  } else {
    reasoning += `. Performans stabil (${recentAvg.toFixed(1)} puan/maç)`;
  }

  return {
    score: finalScore,
    trend,
    reasoning,
    formGraph
  };
}

function buildDeepAnalysisContext(matchData: MatchData): string {
  const { homeTeam, awayTeam, league, homeForm, awayForm, h2h, odds, detailedStats, professionalCalc } = matchData as any;
  
  // 🆕 Motivasyon puanları hesapla
  const homeMotivation = calculateTeamMotivationScore(
    homeForm?.form || '',
    homeForm?.matches || [],
    homeForm?.points || 0
  );
  
  const awayMotivation = calculateTeamMotivationScore(
    awayForm?.form || '',
    awayForm?.matches || [],
    awayForm?.points || 0
  );
  
  let context = `
═══════════════════════════════════════════════════════════════════════════════
                    MAÇ ANALİZİ: ${homeTeam} vs ${awayTeam}
                    LİG: ${league || 'Unknown League'}
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 EV SAHİBİ: ${homeTeam}
├─────────────────────────────────────────────────────────────────────────────┤
│ GENEL FORM (Son 5-10 maç):
│   • Form: ${homeForm?.form || 'N/A'}
│   • Puan: ${homeForm?.points || 0} / ${homeForm?.wins ? (homeForm.wins + homeForm.draws + homeForm.losses) * 3 : 15}
│   • Galibiyet/Beraberlik/Mağlubiyet: ${homeForm?.wins || 0}W-${homeForm?.draws || 0}D-${homeForm?.losses || 0}L
│   • Ortalama Gol (Genel): ${homeForm?.avgGoals || 'N/A'} attı, ${homeForm?.avgConceded || 'N/A'} yedi
│   • Over 2.5 (Genel): %${homeForm?.over25Percentage || 'N/A'}
│   • BTTS (Genel): %${homeForm?.bttsPercentage || 'N/A'}
│
│ 🏟️ EVDEKİ MAÇLAR (ÖNEMLİ!):
│   • Ev Formu: ${homeForm?.venueForm || homeForm?.form || 'N/A'}
│   • Ev Gol Ortalaması: ${detailedStats?.home?.homeAvgGoalsScored || detailedStats?.home?.avgGoalsScored || homeForm?.venueAvgScored || homeForm?.avgGoals || 'N/A'} attı, ${detailedStats?.home?.homeAvgGoalsConceded || detailedStats?.home?.avgGoalsConceded || homeForm?.venueAvgConceded || homeForm?.avgConceded || 'N/A'} yedi
│   • Ev Over 2.5: %${homeForm?.venueOver25Pct || detailedStats?.home?.homeOver25Percentage || homeForm?.over25Percentage || 'N/A'}
│   • Ev BTTS: %${homeForm?.venueBttsPct || detailedStats?.home?.homeBttsPercentage || homeForm?.bttsPercentage || 'N/A'}
│   • Ev Clean Sheet: %${detailedStats?.home?.homeCleanSheets || homeForm?.cleanSheetPercentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚌 DEPLASMAN: ${awayTeam}
├─────────────────────────────────────────────────────────────────────────────┤
│ GENEL FORM (Son 5-10 maç):
│   • Form: ${awayForm?.form || 'N/A'}
│   • Puan: ${awayForm?.points || 0} / ${awayForm?.wins ? (awayForm.wins + awayForm.draws + awayForm.losses) * 3 : 15}
│   • Galibiyet/Beraberlik/Mağlubiyet: ${awayForm?.wins || 0}W-${awayForm?.draws || 0}D-${awayForm?.losses || 0}L
│   • Ortalama Gol (Genel): ${awayForm?.avgGoals || 'N/A'} attı, ${awayForm?.avgConceded || 'N/A'} yedi
│   • Over 2.5 (Genel): %${awayForm?.over25Percentage || 'N/A'}
│   • BTTS (Genel): %${awayForm?.bttsPercentage || 'N/A'}
│
│ ✈️ DEPLASMANDAKİ MAÇLAR (ÖNEMLİ!):
│   • Deplasman Formu: ${awayForm?.venueForm || awayForm?.form || 'N/A'}
│   • Deplasman Gol Ortalaması: ${detailedStats?.away?.awayAvgGoalsScored || detailedStats?.away?.avgGoalsScored || awayForm?.venueAvgScored || awayForm?.avgGoals || 'N/A'} attı, ${detailedStats?.away?.awayAvgGoalsConceded || detailedStats?.away?.avgGoalsConceded || awayForm?.venueAvgConceded || awayForm?.avgConceded || 'N/A'} yedi
│   • Deplasman Over 2.5: %${awayForm?.venueOver25Pct || detailedStats?.away?.awayOver25Percentage || awayForm?.over25Percentage || 'N/A'}
│   • Deplasman BTTS: %${awayForm?.venueBttsPct || detailedStats?.away?.awayBttsPercentage || awayForm?.bttsPercentage || 'N/A'}
│   • Deplasman Clean Sheet: %${detailedStats?.away?.awayCleanSheets || awayForm?.cleanSheetPercentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 BEKLENEN GOL HESAPLAMALARI (Sistem Hesaplaması)
├─────────────────────────────────────────────────────────────────────────────┤
${(() => {
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  
  // Stats Agent'ın hesapladığı beklenen goller
  const homeGoalsScored = parseFloat(detailedHome?.avgGoalsScored || homeForm?.avgGoals || '1.2');
  const homeGoalsConceded = parseFloat(detailedHome?.avgGoalsConceded || homeForm?.avgConceded || '1.0');
  const awayGoalsScored = parseFloat(detailedAway?.avgGoalsScored || awayForm?.avgGoals || '1.0');
  const awayGoalsConceded = parseFloat(detailedAway?.avgGoalsConceded || awayForm?.avgConceded || '1.2');
  
  // Beklenen goller (gol atma beklentisi)
  const homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  const expectedTotal = homeExpected + awayExpected;
  
  // Gol yeme beklentisi
  const homeConcededExpected = (homeGoalsConceded + awayGoalsScored) / 2;
  const awayConcededExpected = (awayGoalsConceded + homeGoalsScored) / 2;
  
  return `│   • ${homeTeam} Beklenen Gol Atma: ${homeExpected.toFixed(2)} (Ev ${detailedStats?.home?.homeAvgGoalsScored || homeGoalsScored.toFixed(2)} + Dep Yediği ${awayGoalsConceded.toFixed(2)}) / 2
│   • ${awayTeam} Beklenen Gol Atma: ${awayExpected.toFixed(2)} (Dep ${detailedStats?.away?.awayAvgGoalsScored || awayGoalsScored.toFixed(2)} + Ev Yediği ${homeGoalsConceded.toFixed(2)}) / 2
│   • ${homeTeam} Beklenen Gol Yeme: ${homeConcededExpected.toFixed(2)} (Ev Yediği ${homeGoalsConceded.toFixed(2)} + Dep Attığı ${awayGoalsScored.toFixed(2)}) / 2
│   • ${awayTeam} Beklenen Gol Yeme: ${awayConcededExpected.toFixed(2)} (Dep Yediği ${awayGoalsConceded.toFixed(2)} + Ev Attığı ${homeGoalsScored.toFixed(2)}) / 2
│   • TOPLAM BEKLENEN GOL: ${expectedTotal.toFixed(2)} (${expectedTotal >= 2.5 ? 'OVER 2.5' : 'UNDER 2.5'})`;
})()}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 MOTİVASYON & HAZIRLIK PUANLARI (0-100)
├─────────────────────────────────────────────────────────────────────────────┤
│ ${homeTeam}:
│   • Motivasyon Puanı: ${homeMotivation.score}/100
│   • Trend: ${homeMotivation.trend === 'improving' ? '📈 İyileşiyor' : homeMotivation.trend === 'declining' ? '📉 Düşüyor' : '➡️ Stabil'}
│   • Form Grafiği (Son 10): ${homeMotivation.formGraph}
│   • Analiz: ${homeMotivation.reasoning}
│
│ ${awayTeam}:
│   • Motivasyon Puanı: ${awayMotivation.score}/100
│   • Trend: ${awayMotivation.trend === 'improving' ? '📈 İyileşiyor' : awayMotivation.trend === 'declining' ? '📉 Düşüyor' : '➡️ Stabil'}
│   • Form Grafiği (Son 10): ${awayMotivation.formGraph}
│   • Analiz: ${awayMotivation.reasoning}
│
│ PUAN FARKI: ${Math.abs(homeMotivation.score - awayMotivation.score)} puan
│ ${homeMotivation.score > awayMotivation.score ? homeTeam : awayMotivation.score > homeMotivation.score ? awayTeam : 'Eşit'} daha motivasyonlu görünüyor
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔄 KAFA KAFAYA (H2H) - Son Karşılaşmalar
├─────────────────────────────────────────────────────────────────────────────┤
│   • Toplam Maç: ${h2h?.totalMatches || 0}
│   • ${homeTeam} Kazandı: ${h2h?.homeWins || 0}
│   • Berabere: ${h2h?.draws || 0}
│   • ${awayTeam} Kazandı: ${h2h?.awayWins || 0}
│   • H2H Ortalama Toplam Gol: ${h2h?.avgGoals || 'N/A'}
│   • H2H Over 2.5 Oranı: %${h2h?.over25Percentage || 'N/A'}
│   • H2H BTTS Oranı: %${h2h?.bttsPercentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;

  // Odds bilgisi
  if (odds?.matchWinner?.home) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 BAHİS ORANLARI (ODDS)
├─────────────────────────────────────────────────────────────────────────────┤
│   • Maç Sonucu (1X2): ${homeTeam} ${odds.matchWinner.home} | Beraberlik ${odds.matchWinner.draw} | ${awayTeam} ${odds.matchWinner.away}
│   • Over 2.5 Gol: ${odds.overUnder?.['2.5']?.over || 'N/A'}
│   • Under 2.5 Gol: ${odds.overUnder?.['2.5']?.under || 'N/A'}
│   • BTTS Evet: ${odds.btts?.yes || 'N/A'}
│   • BTTS Hayır: ${odds.btts?.no || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // Profesyonel hesaplama
  if (professionalCalc?.overUnder) {
    const calc = professionalCalc.overUnder;
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 SİSTEM HESAPLAMASI (Ağırlıklı Analiz)
├─────────────────────────────────────────────────────────────────────────────┤
│   • ${homeTeam} EVDEKİ Over 2.5: %${calc.breakdown?.homeVenueOver || 'N/A'} (ağırlık: %30)
│   • ${awayTeam} DEPLASMANDAKİ Over 2.5: %${calc.breakdown?.awayVenueOver || 'N/A'} (ağırlık: %30)
│   • H2H Over 2.5: %${calc.breakdown?.h2hOver || 'N/A'} (ağırlık: %25)
│   • Genel Form Over 2.5: %${calc.breakdown?.generalOver || 'N/A'} (ağırlık: %15)
│   ─────────────────────────────────────────────────────────────────────────
│   • AĞIRLIKLI OVER 2.5: %${calc.breakdown?.weightedOver || 'N/A'}
│   • BEKLENEN TOPLAM GOL: ${calc.breakdown?.expectedTotal || 'N/A'}
│   • SİSTEM TAHMİNİ: ${calc.prediction} (%${calc.confidence} güven)
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // Sakatlıklar
  if (detailedStats?.injuries) {
    const homeInjuries = detailedStats.injuries.home || [];
    const awayInjuries = detailedStats.injuries.away || [];
    
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏥 SAKATLIKLAR VE CEZALILAR
├─────────────────────────────────────────────────────────────────────────────┤
│   • ${homeTeam}: ${homeInjuries.length > 0 ? homeInjuries.map((i: any) => `${i.player} (${i.type})`).join(', ') : 'Bilinen sakat yok'}
│   • ${awayTeam}: ${awayInjuries.length > 0 ? awayInjuries.map((i: any) => `${i.player} (${i.type})`).join(', ') : 'Bilinen sakat yok'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // Son maçlar
  if (homeForm?.matches && homeForm.matches.length > 0) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 ${homeTeam} SON MAÇLARI
├─────────────────────────────────────────────────────────────────────────────┤
`;
    homeForm.matches.slice(0, 5).forEach((m: any, i: number) => {
      const venue = m.isHome ? '🏠 Ev' : '🚌 Dep';
      const totalGoals = m.totalGoals || 0;
      context += `│   ${i + 1}. ${venue} vs ${m.opponent}: ${m.score} (${m.result}) - ${totalGoals} gol\n`;
    });
    context += `└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  if (awayForm?.matches && awayForm.matches.length > 0) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 ${awayTeam} SON MAÇLARI
├─────────────────────────────────────────────────────────────────────────────┤
`;
    awayForm.matches.slice(0, 5).forEach((m: any, i: number) => {
      const venue = m.isHome ? '🏠 Ev' : '🚌 Dep';
      const totalGoals = m.totalGoals || 0;
      context += `│   ${i + 1}. ${venue} vs ${m.opponent}: ${m.score} (${m.result}) - ${totalGoals} gol\n`;
    });
    context += `└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // 🆕 Hakem bilgisi ekle (varsa)
  const referee = (matchData as any).referee;
  if (referee) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧑‍⚖️ HAKEM BİLGİSİ
├─────────────────────────────────────────────────────────────────────────────┤
│   • Hakem: ${referee.name || 'Bilinmiyor'}
│   • Ortalama Sarı Kart: ${referee.avgYellowCards || 'N/A'} / maç
│   • Ortalama Kırmızı Kart: ${referee.avgRedCards || 'N/A'} / maç
│   • Penaltı Oranı: ${referee.penaltyRate || 'N/A'}%
│   • Ev Sahibi Eğilimi: ${referee.homeBias || 'Nötr'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  } else {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧑‍⚖️ HAKEM BİLGİSİ
├─────────────────────────────────────────────────────────────────────────────┤
│   • Hakem: Henüz açıklanmadı
│   • NOT: Hakem verisi yoksa ortalama değerleri kullan (4.2 sarı/maç)
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // 🆕 Hava durumu bilgisi ekle (varsa)
  const weather = (matchData as any).weather;
  if (weather) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🌤️ HAVA DURUMU
├─────────────────────────────────────────────────────────────────────────────┤
│   • Durum: ${weather.condition || 'Açık'}
│   • Sıcaklık: ${weather.temperature || '15'}°C
│   • Rüzgar: ${weather.wind || 'Hafif'} km/s
│   • Yağış: ${weather.precipitation || 'Yok'}
│   • Etki: ${weather.impact || 'Düşük'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // 🆕 Formasyon bilgisi ekle (varsa)
  const formations = (matchData as any).formations;
  if (formations) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 FORMASYON TAHMİNİ
├─────────────────────────────────────────────────────────────────────────────┤
│   • ${homeTeam}: ${formations.home || '4-3-3'} (Tipik diziliş)
│   • ${awayTeam}: ${formations.away || '4-4-2'} (Tipik diziliş)
│   • Not: Son 5 maçtaki en sık kullanılan dizilişler
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  context += `
═══════════════════════════════════════════════════════════════════════════════
                         ANALİZ TALİMATLARI
═══════════════════════════════════════════════════════════════════════════════

1. EV/DEPLASMAN VERİLERİNİ KULLAN:
   - ${homeTeam} için EVDEKİ istatistikleri baz al
   - ${awayTeam} için DEPLASMANDAKİ istatistikleri baz al

2. OVER/UNDER HESAPLAMA:
   - Ev sahibi evde kaç gol atıyor/yiyor?
   - Deplasman dışarıda kaç gol atıyor/yiyor?
   - H2H'da kaç gol atılıyor?

3. HAKEM ANALİZİ:
   - Hakemın kart eğilimini değerlendir
   - Sert hakem ise Over cards tahmini yap
   - Ev sahibi eğilimi varsa sonuç tahmininde dikkate al

4. HAVA DURUMU ETKİSİ:
   - Yağmurlu/rüzgarlı = düşük skor potansiyeli
   - Çok sıcak/soğuk = yorgunluk faktörü

5. RİSK DEĞERLENDİRMESİ:
   - Veriler tutarlı mı?
   - Güçlü sinyal var mı?

Yukarıdaki TÜM verileri (hakem, hava, formasyon dahil) analiz ederek JSON formatında tahmin üret.
`;

  return context;
}

export async function runDeepAnalysisAgent(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('🔬 Deep Analysis Agent starting...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`   🌍 Language: ${language}`);
  
  // 🧠 ÖĞRENME CONTEXT'İ - Geçmiş performansı kullan
  let learningContext = '';
  try {
    learningContext = await getLearningContext(matchData.league, matchData.homeTeam, matchData.awayTeam, language);
    if (learningContext) {
      console.log('   🧠 Learning Context loaded - using past performance data');
    }
  } catch (e) {
    console.warn('   ⚠️ Learning Context failed, continuing without it');
  }
  
  // 🆕 PROBABILITY ENGINE - Matematiksel modelleri çalıştır
  let probabilityResult: ProbabilityResult | null = null;
  let probabilityContext: string = '';
  try {
    probabilityResult = calculateComprehensiveProbabilities(matchData);
    probabilityContext = generateProbabilityContext(matchData);
    console.log('   🎯 Probability Engine integrated');
    console.log(`      Model Agreement: ${probabilityResult.modelAgreement}% | Data Quality: ${probabilityResult.dataQuality}`);
  } catch (e) {
    console.log('   ⚠️ Probability Engine failed, continuing without it');
  }
  
  // 🆕 LİG PROFİLİ
  const leagueProfile = getLeagueProfile(matchData.league || '');
  if (leagueProfile) {
    console.log(`   🏆 League Profile: ${leagueProfile.name} | Avg Goals: ${leagueProfile.avgGoalsPerMatch} | Home Win: ${leagueProfile.homeWinPercentage}%`);
  }
  
  // 🆕 HAKEM VERİSİ (varsa)
  let refereeData: RefereeMatchImpact | null = null;
  if (matchData.fixtureId) {
    try {
      const referee = await fetchRefereeFromSportMonks(matchData.fixtureId);
      if (referee) {
        refereeData = analyzeRefereeImpact(
          referee,
          matchData.homeTeamId || 0,
          matchData.homeTeam,
          matchData.awayTeamId || 0,
          matchData.awayTeam,
          leagueProfile?.avgYellowCardsPerMatch
        );
        console.log(`   🧑‍⚖️ Referee: ${referee.name} | Strictness: ${referee.strictness} | Cards/Match: ${referee.cardsPerMatch}`);
      }
    } catch (e) {
      console.log('   ⚠️ Referee data not available');
    }
  }

  // 🆕 GELİŞMİŞ MOTİVASYON ANALİZİ - Gemini API ile
  let homeMotivationAnalysis: TeamMotivationAnalysis | null = null;
  let awayMotivationAnalysis: TeamMotivationAnalysis | null = null;
  
  try {
    console.log('   🧠 Analyzing team motivation with Gemini API...');
    const { homeTeam, awayTeam, league, homeForm, awayForm } = matchData as any;
    
    [homeMotivationAnalysis, awayMotivationAnalysis] = await Promise.all([
      analyzeTeamMotivation(
        homeTeam || '',
        homeForm?.form || '',
        homeForm?.points || 0,
        league || '',
        language
      ),
      analyzeTeamMotivation(
        awayTeam || '',
        awayForm?.form || '',
        awayForm?.points || 0,
        league || '',
        language
      )
    ]);
    
    console.log(`   ✅ Home Motivation: ${homeMotivationAnalysis.finalScore}/100 (Performance: ${homeMotivationAnalysis.performanceScore}, Team: ${homeMotivationAnalysis.teamMotivationScore})`);
    console.log(`   ✅ Away Motivation: ${awayMotivationAnalysis.finalScore}/100 (Performance: ${awayMotivationAnalysis.performanceScore}, Team: ${awayMotivationAnalysis.teamMotivationScore})`);
  } catch (e) {
    console.log('   ⚠️ Motivation analysis failed, using fallback');
    // Fallback: Eski yöntem
    const { homeForm, awayForm } = matchData as any;
    homeMotivationAnalysis = {
      performanceScore: calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0).score,
      teamMotivationScore: 50,
      finalScore: calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0).score,
      trend: calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0).trend,
      reasoning: calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0).reasoning,
      formGraph: calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0).formGraph,
      injuries: [],
      squadIssues: [],
      newsImpact: '',
      motivationFactors: []
    };
    awayMotivationAnalysis = {
      performanceScore: calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0).score,
      teamMotivationScore: 50,
      finalScore: calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0).score,
      trend: calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0).trend,
      reasoning: calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0).reasoning,
      formGraph: calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0).formGraph,
      injuries: [],
      squadIssues: [],
      newsImpact: '',
      motivationFactors: []
    };
  }
  
  const systemPrompt = DEEP_ANALYSIS_PROMPT[language] || DEEP_ANALYSIS_PROMPT.en;
  const context = buildDeepAnalysisContext(matchData);
  
  // Motivasyon analizi context'ine ekle
  const motivationContext = homeMotivationAnalysis && awayMotivationAnalysis ? `

═══════════════════════════════════════════════════════════════════════════════
💪 GELİŞMİŞ MOTİVASYON ANALİZİ (Gemini API ile)
═══════════════════════════════════════════════════════════════════════════════

🏠 ${matchData.homeTeam}:
   • Final Skor: ${homeMotivationAnalysis.finalScore}/100 (%50 Performans: ${homeMotivationAnalysis.performanceScore} + %50 Takım İçi: ${homeMotivationAnalysis.teamMotivationScore})
   • Trend: ${homeMotivationAnalysis.trend === 'improving' ? 'Yükselişte 📈' : homeMotivationAnalysis.trend === 'declining' ? 'Düşüşte 📉' : 'Stabil ➡️'}
   • Form: ${homeMotivationAnalysis.formGraph}
   ${homeMotivationAnalysis.injuries.length > 0 ? `   • Sakatlıklar: ${homeMotivationAnalysis.injuries.join(', ')}` : ''}
   ${homeMotivationAnalysis.squadIssues.length > 0 ? `   • Kadro Sorunları: ${homeMotivationAnalysis.squadIssues.join(', ')}` : ''}
   ${homeMotivationAnalysis.newsImpact ? `   • Haberler: ${homeMotivationAnalysis.newsImpact}` : ''}
   ${homeMotivationAnalysis.motivationFactors.length > 0 ? `   • Motivasyon Faktörleri: ${homeMotivationAnalysis.motivationFactors.join(', ')}` : ''}
   • Detay: ${homeMotivationAnalysis.reasoning}

🚌 ${matchData.awayTeam}:
   • Final Skor: ${awayMotivationAnalysis.finalScore}/100 (%50 Performans: ${awayMotivationAnalysis.performanceScore} + %50 Takım İçi: ${awayMotivationAnalysis.teamMotivationScore})
   • Trend: ${awayMotivationAnalysis.trend === 'improving' ? 'Yükselişte 📈' : awayMotivationAnalysis.trend === 'declining' ? 'Düşüşte 📉' : 'Stabil ➡️'}
   • Form: ${awayMotivationAnalysis.formGraph}
   ${awayMotivationAnalysis.injuries.length > 0 ? `   • Sakatlıklar: ${awayMotivationAnalysis.injuries.join(', ')}` : ''}
   ${awayMotivationAnalysis.squadIssues.length > 0 ? `   • Kadro Sorunları: ${awayMotivationAnalysis.squadIssues.join(', ')}` : ''}
   ${awayMotivationAnalysis.newsImpact ? `   • Haberler: ${awayMotivationAnalysis.newsImpact}` : ''}
   ${awayMotivationAnalysis.motivationFactors.length > 0 ? `   • Motivasyon Faktörleri: ${awayMotivationAnalysis.motivationFactors.join(', ')}` : ''}
   • Detay: ${awayMotivationAnalysis.reasoning}

═══════════════════════════════════════════════════════════════════════════════
` : '';
  
  // Probability Engine context ekleme
  const probabilitySection = probabilityContext ? `

═══════════════════════════════════════════════════════════════════════════════
🎯 PROBABILITY ENGINE - MATEMATİKSEL MODEL SONUÇLARI
═══════════════════════════════════════════════════════════════════════════════
${probabilityContext}
═══════════════════════════════════════════════════════════════════════════════
` : '';
  
  // Learning context section
  const learningSection = learningContext ? `
═══════════════════════════════════════════════════════════════════════════════
🧠 ÖĞRENME CONTEXT (Geçmiş Performans)
═══════════════════════════════════════════════════════════════════════════════
${learningContext}
═══════════════════════════════════════════════════════════════════════════════
` : '';
  
  // Language-specific user message
  const userMessageByLang = {
    tr: `${context}${learningSection}${probabilitySection}${motivationContext}\n\nBu verileri kullanarak çok katmanlı derin analiz yap.\nPROBABILITY ENGINE sonuçlarını REFERANS al ama KENDİ ANALİZİNİ yap.\nGELİŞMİŞ MOTİVASYON ANALİZİ sonuçlarını MUTLAKA kullan - bu %50 performans + %50 takım içi motivasyon (sakatlıklar, haberler, kadro) bazlı.\nÖĞRENME CONTEXT'i kullanarak geçmiş performansı dikkate al.\nANALİZ AĞIRLIĞI: %60 veri analizi, %20 matematiksel tahmin, %20 psikolojik faktörler.\nSADECE JSON formatında döndür, başka açıklama ekleme.`,
    en: `${context}${learningSection}${probabilitySection}${motivationContext}\n\nPerform multi-layered deep analysis using this data.\nUse PROBABILITY ENGINE results as REFERENCE but form your OWN analysis.\nALWAYS use ADVANCED MOTIVATION ANALYSIS results - this is based on 50% performance + 50% team motivation (injuries, news, squad).\nUse LEARNING CONTEXT to consider past performance.\nANALYSIS WEIGHT: 60% data analysis, 20% mathematical prediction, 20% psychological factors.\nReturn ONLY JSON format, no additional explanation.`,
    de: `${context}${probabilitySection}${motivationContext}\n\nFühre eine mehrschichtige Tiefenanalyse mit diesen Daten durch.\nVerwende PROBABILITY ENGINE Ergebnisse als REFERENZ, aber bilde deine EIGENE Analyse.\nVerwende IMMER ADVANCED MOTIVATION ANALYSIS Ergebnisse - basierend auf 50% Leistung + 50% Team-Motivation (Verletzungen, Nachrichten, Kader).\nANALYSE-GEWICHTUNG: 60% Datenanalyse, 20% mathematische Vorhersage, 20% psychologische Faktoren.\nGib NUR im JSON-Format zurück, keine zusätzliche Erklärung.`
  };
  const userMessage = userMessageByLang[language] || userMessageByLang.en;

  try {
    let response = null;
    
    // ============================================================
    // STRATEJİ: DeepSeek (MCP) → Claude → Intelligent Fallback
    // DeepSeek daha detaylı analiz yapıyor, MCP ile zenginleştirilmiş veri
    // ============================================================
    
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    
    // 1️⃣ ÖNCE DEEPSEEK DENE (MCP ile daha zengin veri)
    if (hasDeepSeek) {
      console.log('   🟣 [1/4] Trying DeepSeek for deep analysis...');
      try {
        response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
          model: 'deepseek',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.3,
          maxTokens: 800, // JSON tamamlanması için yeterli
          timeout: 12000 // 12 saniye (performans için düşürüldü)
        });
        
        if (response) {
          console.log('   ✅ DeepSeek + MCP responded successfully');
        }
      } catch (deepseekError: any) {
        console.log(`   ⚠️ DeepSeek failed: ${deepseekError?.message || 'Unknown error'}`);
      }
    } else {
      console.log('   ⚠️ DeepSeek API key not available, trying Claude...');
    }

    // 2️⃣ DEEPSEEK BAŞARISIZ OLURSA OPENAI DENE (GPT-4 Turbo)
    if (!response) {
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      if (hasOpenAI) {
        console.log('   🟢 [2/4] Trying OpenAI GPT-4 Turbo for deep analysis...');
        try {
          response = await aiClient.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ], {
            model: 'gpt-4-turbo',
            useMCP: false,
            mcpFallback: false,
            fixtureId: matchData.fixtureId,
            temperature: 0.3,
            maxTokens: 600,
            timeout: 12000 // 12 saniye (performans için düşürüldü)
          });
          
          if (response) {
            console.log('   ✅ OpenAI GPT-4 responded successfully');
          }
        } catch (openaiError: any) {
          console.log(`   ⚠️ OpenAI failed: ${openaiError?.message || 'Unknown error'}`);
        }
      }
    }

    // 3️⃣ OPENAI BAŞARISIZ OLURSA CLAUDE DENE
    if (!response) {
      console.log('   🔵 [3/4] Trying Claude for deep analysis...');
      try {
        response = await aiClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ], {
          model: 'claude',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.3,
          maxTokens: 600,
          timeout: 12000 // 12 saniye (performans için düşürüldü)
        });
        
        if (response) {
          console.log('   ✅ Claude responded successfully');
        }
      } catch (claudeError: any) {
        console.log(`   ⚠️ Claude failed: ${claudeError?.message || 'Unknown error'}`);
      }
    }

    // 5️⃣ HER ÜÇÜ DE BAŞARISIZ OLURSA AKILLI FALLBACK
    if (!response) {
      console.log('   🟠 [4/4] Using intelligent fallback analysis...');
      const fallbackResult = getDefaultDeepAnalysis(matchData, language);
      console.log(`   ✅ Fallback generated: ${fallbackResult.matchResult?.prediction} (${fallbackResult.matchResult?.confidence}%)`);
      return fallbackResult;
    }
    
    // JSON parse - Daha güçlü extraction
    let result;
    try {
      // Önce markdown code block'ları temizle
      let cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/\*\*/g, '')
        .trim();
      
      // JSON objesini bul
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      let jsonStr = jsonMatch[0];
      
      // JSON hatalarını düzelt
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1'); // Trailing commas
      jsonStr = jsonStr.replace(/\n/g, ' '); // Newlines
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // Control characters
      
      // Eksik kapanış parantezlerini düzelt (kısaltılmış JSON için)
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }
      
      result = JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error('❌ Deep Analysis JSON parse error:', parseError);
      console.log('Raw response (first 1000 chars):', response.substring(0, 1000));
      console.log('Parse error at position:', parseError.message?.match(/position (\d+)/)?.[1] || 'unknown');
      result = getDefaultDeepAnalysis(matchData, language);
    }

    // Validate and fix confidence values
    if (result.overUnder?.confidence) {
      result.overUnder.confidence = Math.min(85, Math.max(50, result.overUnder.confidence));
    }
    if (result.btts?.confidence) {
      result.btts.confidence = Math.min(85, Math.max(50, result.btts.confidence));
    }
    if (result.matchResult?.confidence) {
      result.matchResult.confidence = Math.min(85, Math.max(50, result.matchResult.confidence));
    }
    if (result.bestBet?.confidence) {
      result.bestBet.confidence = Math.min(85, Math.max(50, result.bestBet.confidence));
    }

    // 🆕 Gelişmiş Motivasyon puanlarını ekle (Gemini API ile)
    if (homeMotivationAnalysis && awayMotivationAnalysis) {
      result.motivationScores = {
        home: homeMotivationAnalysis.finalScore, // %50 performans + %50 takım içi
        away: awayMotivationAnalysis.finalScore,
        homeTrend: homeMotivationAnalysis.trend,
        awayTrend: awayMotivationAnalysis.trend,
        homeFormGraph: homeMotivationAnalysis.formGraph,
        awayFormGraph: awayMotivationAnalysis.formGraph,
        reasoning: `${matchData.homeTeam}: ${homeMotivationAnalysis.reasoning}. ${matchData.awayTeam}: ${awayMotivationAnalysis.reasoning}. Puan farkı: ${Math.abs(homeMotivationAnalysis.finalScore - awayMotivationAnalysis.finalScore)} puan.`,
        // Yeni alanlar
        homePerformanceScore: homeMotivationAnalysis.performanceScore,
        homeTeamMotivationScore: homeMotivationAnalysis.teamMotivationScore,
        awayPerformanceScore: awayMotivationAnalysis.performanceScore,
        awayTeamMotivationScore: awayMotivationAnalysis.teamMotivationScore,
        homeInjuries: homeMotivationAnalysis.injuries,
        awayInjuries: awayMotivationAnalysis.injuries,
        homeSquadIssues: homeMotivationAnalysis.squadIssues,
        awaySquadIssues: awayMotivationAnalysis.squadIssues,
        homeNewsImpact: homeMotivationAnalysis.newsImpact,
        awayNewsImpact: awayMotivationAnalysis.newsImpact,
        homeMotivationFactors: homeMotivationAnalysis.motivationFactors,
        awayMotivationFactors: awayMotivationAnalysis.motivationFactors
      };
    } else {
      // Fallback: Eski yöntem
      const { homeForm, awayForm } = matchData as any;
      const homeMotivation = calculateTeamMotivationScore(
        homeForm?.form || '',
        homeForm?.matches || [],
        homeForm?.points || 0
      );
      
      const awayMotivation = calculateTeamMotivationScore(
        awayForm?.form || '',
        awayForm?.matches || [],
        awayForm?.points || 0
      );

      result.motivationScores = {
        home: homeMotivation.score,
        away: awayMotivation.score,
        homeTrend: homeMotivation.trend,
        awayTrend: awayMotivation.trend,
        homeFormGraph: homeMotivation.formGraph,
        awayFormGraph: awayMotivation.formGraph,
        reasoning: `${matchData.homeTeam}: ${homeMotivation.reasoning}. ${matchData.awayTeam}: ${awayMotivation.reasoning}. Puan farkı: ${Math.abs(homeMotivation.score - awayMotivation.score)} puan.`
      };
    }

    console.log(`✅ Deep Analysis complete:`);
    console.log(`   🎯 Best Bet: ${result.bestBet?.type} → ${result.bestBet?.selection} (${result.bestBet?.confidence}%)`);
    console.log(`   ⚽ Score: ${result.scorePrediction?.score}`);
    console.log(`   📊 Over/Under: ${result.overUnder?.prediction} (${result.overUnder?.confidence}%)`);
    console.log(`   🎲 BTTS: ${result.btts?.prediction} (${result.btts?.confidence}%)`);
    console.log(`   🏆 Match: ${result.matchResult?.prediction} (${result.matchResult?.confidence}%)`);
    if (homeMotivationAnalysis && awayMotivationAnalysis) {
      console.log(`   💪 Motivation: Home ${homeMotivationAnalysis.finalScore}/100 (Perf: ${homeMotivationAnalysis.performanceScore}, Team: ${homeMotivationAnalysis.teamMotivationScore}), Away ${awayMotivationAnalysis.finalScore}/100 (Perf: ${awayMotivationAnalysis.performanceScore}, Team: ${awayMotivationAnalysis.teamMotivationScore})`);
    } else {
      const { homeForm, awayForm } = matchData as any;
      const homeMotivation = calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0);
      const awayMotivation = calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0);
      console.log(`   💪 Motivation: Home ${homeMotivation.score}/100 (${homeMotivation.trend}), Away ${awayMotivation.score}/100 (${awayMotivation.trend})`);
    }
    
    return result;
  } catch (error: any) {
    console.error('❌ Deep Analysis Agent error:', error);
    return getDefaultDeepAnalysis(matchData, language);
  }
}

function getDefaultDeepAnalysis(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): any {
  const { homeForm, awayForm, h2h } = matchData as any;
  
  // 🆕 Motivasyon puanları hesapla
  const homeMotivation = calculateTeamMotivationScore(
    homeForm?.form || '',
    homeForm?.matches || [],
    homeForm?.points || 0
  );
  
  const awayMotivation = calculateTeamMotivationScore(
    awayForm?.form || '',
    awayForm?.matches || [],
    awayForm?.points || 0
  );
  
  // 🆕 FORM PUANLARI HESAPLA - Beraberlik yerine gerçek tahmin yap!
  const homeFormStr = homeForm?.form || '';
  const awayFormStr = awayForm?.form || '';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homePoints = homeWins * 3 + (homeFormStr.match(/D/g) || []).length;
  const awayPoints = awayWins * 3 + (awayFormStr.match(/D/g) || []).length;
  const formDiff = homePoints - awayPoints;
  
  // 🆕 Maç sonucu tahmini - Form farkına göre! (DÜZELTME: Eşikler artırıldı)
  // formDiff > 6: Ev sahibi favori (eskiden 5)
  // formDiff < -6: Deplasman favori (eskiden -5)
  // -6 <= formDiff <= 6: Dengeli (beraberlik bölgesi genişletildi)
  const matchResultPred = formDiff > 6 ? '1' : formDiff < -6 ? '2' : 'X';
  // Olasılık hesaplaması - daha konservatif (2 → 1.5 çarpan)
  const homeWinProb = Math.min(60, Math.max(25, 35 + formDiff * 1.5));
  const awayWinProb = Math.min(60, Math.max(25, 35 - formDiff * 1.5));
  // Beraberlik olasılığı en az %20 (gerçek dünyada ~%25-28)
  const drawProb = Math.max(20, 100 - homeWinProb - awayWinProb);
  // Güven skoru - daha konservatif (max %68)
  const matchResultConf = Math.min(68, 50 + Math.abs(formDiff) * 1.2);
  
  // Basit hesaplama
  const homeOver = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const awayOver = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const h2hOver = parseInt(h2h?.over25Percentage || '50');
  const avgOver = (homeOver * 0.35 + awayOver * 0.35 + h2hOver * 0.30);
  
  // DÜZELTME: Over eşiği 50 → 55 (regresyon düzeltmesi)
  const overUnderPred = avgOver >= 55 ? 'Over' : 'Under';
  // Güven skoru - daha konservatif (max %68)
  const overUnderConf = Math.min(68, Math.max(50, Math.abs(avgOver - 52.5) * 0.8 + 50));
  
  // 🆕 Hakem varsayılan değerleri
  const referee = (matchData as any).referee;
  const avgYellowCards = referee?.avgYellowCards || 4.2;
  const avgRedCards = referee?.avgRedCards || 0.15;
  
  // 🆕 Korner ve kart tahminleri
  const expectedCorners = avgOver >= 55 ? 11 : avgOver >= 45 ? 9.5 : 8.5;
  const expectedCards = avgYellowCards + (avgRedCards * 2);
  
  // Language-specific messages
  const messages = {
    tr: {
      matchAnalysis: `${matchData.homeTeam} vs ${matchData.awayTeam} maçı için derin analiz yapıldı.`,
      criticalFactors: [
        `${matchData.homeTeam} ev sahibi avantajı`,
        `Son form durumları: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
        `H2H geçmiş: ${h2h?.totalMatches || 0} maç`,
        `Gol ortalamaları değerlendirildi`,
        `Hakem eğilimleri analiz edildi`
      ],
      scorePredictionReasoning: 'Dengeli güç dengesi beraberliğe işaret ediyor.',
      overUnderReasoning: `Ev sahibi Over %${homeOver}, Deplasman Over %${awayOver}, H2H Over %${h2hOver}`,
      bttsReasoning: 'Dikkatli yaklaşım.',
      matchResultReasoning: 'Dengeli güçler.',
      bestBetReasoning: `İstatistiksel hesaplama ${overUnderPred} yönünde.`,
      refereeUnknown: 'Bilinmiyor',
      refereeReasoning: 'Ortalama hakem verileri kullanıldı',
      weatherReasoning: 'Hava durumu verisi mevcut değil, standart koşullar varsayıldı',
      keyBattles: ['Kanat mücadelesi', 'Orta saha kontrolü'],
      agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5, Korner ${expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5'} tavsiye edilir.`
    },
    en: {
      matchAnalysis: `Deep analysis performed for ${matchData.homeTeam} vs ${matchData.awayTeam}.`,
      criticalFactors: [
        `${matchData.homeTeam} home advantage`,
        `Recent form: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
        `H2H history: ${h2h?.totalMatches || 0} matches`,
        `Goal averages evaluated`,
        `Referee tendencies analyzed`
      ],
      scorePredictionReasoning: 'Balanced power suggests a draw.',
      overUnderReasoning: `Home Over ${homeOver}%, Away Over ${awayOver}%, H2H Over ${h2hOver}%`,
      bttsReasoning: 'Cautious approach.',
      matchResultReasoning: 'Balanced teams.',
      bestBetReasoning: `Statistical calculation points to ${overUnderPred}.`,
      refereeUnknown: 'Unknown',
      refereeReasoning: 'Average referee data used',
      weatherReasoning: 'Weather data unavailable, standard conditions assumed',
      keyBattles: ['Wing battles', 'Midfield control'],
      agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5, Corners ${expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5'} recommended.`
    },
    de: {
      matchAnalysis: `Tiefenanalyse für ${matchData.homeTeam} vs ${matchData.awayTeam} durchgeführt.`,
      criticalFactors: [
        `${matchData.homeTeam} Heimvorteil`,
        `Aktuelle Form: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
        `H2H Geschichte: ${h2h?.totalMatches || 0} Spiele`,
        `Tordurchschnitte bewertet`,
        `Schiedsrichtertendenzen analysiert`
      ],
      scorePredictionReasoning: 'Ausgeglichene Kräfte deuten auf Unentschieden.',
      overUnderReasoning: `Heim Over ${homeOver}%, Auswärts Over ${awayOver}%, H2H Over ${h2hOver}%`,
      bttsReasoning: 'Vorsichtiger Ansatz.',
      matchResultReasoning: 'Ausgeglichene Teams.',
      bestBetReasoning: `Statistische Berechnung zeigt ${overUnderPred}.`,
      refereeUnknown: 'Unbekannt',
      refereeReasoning: 'Durchschnittliche Schiedsrichterdaten verwendet',
      weatherReasoning: 'Wetterdaten nicht verfügbar, Standardbedingungen angenommen',
      keyBattles: ['Flügelkämpfe', 'Mittelfeld-Kontrolle'],
      agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5, Ecken ${expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5'} empfohlen.`
    }
  };

  const msg = messages[language] || messages.en;
  
  // 🆕 Skor tahminleri - form farkına göre
  const scoreByResult = {
    '1': ['2-1', '2-0', '1-0'],
    '2': ['0-1', '1-2', '0-2'],
    'X': ['1-1', '0-0', '2-2']
  };
  
  // 🆕 Maç sonucu reasoning - form farkına göre
  const matchResultReasoningByLang = {
    tr: matchResultPred === '1' 
      ? `Ev sahibi form avantajı: ${homePoints}p vs ${awayPoints}p (+${formDiff} puan farkı)`
      : matchResultPred === '2'
      ? `Deplasman form avantajı: ${awayPoints}p vs ${homePoints}p (${formDiff} puan farkı)`
      : `Dengeli form: ${homePoints}p vs ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff} puan farkı)`,
    en: matchResultPred === '1' 
      ? `Home team form advantage: ${homePoints}p vs ${awayPoints}p (+${formDiff} points difference)`
      : matchResultPred === '2'
      ? `Away team form advantage: ${awayPoints}p vs ${homePoints}p (${formDiff} points difference)`
      : `Balanced form: ${homePoints}p vs ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff} points difference)`,
    de: matchResultPred === '1' 
      ? `Heimmannschaft Formvorteil: ${homePoints}p vs ${awayPoints}p (+${formDiff} Punktedifferenz)`
      : matchResultPred === '2'
      ? `Auswärtsmannschaft Formvorteil: ${awayPoints}p vs ${homePoints}p (${formDiff} Punktedifferenz)`
      : `Ausgeglichene Form: ${homePoints}p vs ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff} Punktedifferenz)`
  };

  return {
    matchAnalysis: msg.matchAnalysis,
    criticalFactors: msg.criticalFactors,
    probabilities: { 
      homeWin: Math.round(homeWinProb), 
      draw: Math.round(drawProb), 
      awayWin: Math.round(awayWinProb) 
    },
    expectedScores: scoreByResult[matchResultPred as keyof typeof scoreByResult] || ['1-1', '1-0', '2-1'],
    scorePrediction: { 
      score: scoreByResult[matchResultPred as keyof typeof scoreByResult]?.[0] || '1-1', 
      reasoning: matchResultReasoningByLang[language] || matchResultReasoningByLang.en
    },
    overUnder: { 
      prediction: overUnderPred, 
      confidence: Math.round(overUnderConf), 
      reasoning: msg.overUnderReasoning
    },
    btts: { 
      prediction: avgOver > 55 ? 'Yes' : 'No', // Over yüksekse BTTS Yes
      confidence: Math.round(50 + Math.abs(avgOver - 55) * 0.5), 
      reasoning: avgOver > 55 
        ? `Yüksek gol beklentisi (%${Math.round(avgOver)}) → Her iki takım da gol atabilir`
        : msg.bttsReasoning
    },
    matchResult: { 
      prediction: matchResultPred, // 🆕 Form bazlı tahmin!
      confidence: Math.round(matchResultConf), 
      reasoning: matchResultReasoningByLang[language] || matchResultReasoningByLang.en
    },
    bestBet: { 
      type: Math.abs(formDiff) > 5 ? 'Match Result' : 'Over/Under 2.5',
      selection: Math.abs(formDiff) > 5 
        ? (matchResultPred === '1' ? 'Home' : matchResultPred === '2' ? 'Away' : 'Draw')
        : overUnderPred, 
      confidence: Math.abs(formDiff) > 5 ? Math.round(matchResultConf) : Math.round(overUnderConf), 
      reasoning: Math.abs(formDiff) > 5 
        ? matchResultReasoningByLang[language] || matchResultReasoningByLang.en
        : msg.bestBetReasoning
    },
    // 🆕 New fields
    refereeAnalysis: {
      name: referee?.name || msg.refereeUnknown,
      avgYellowCards,
      avgRedCards,
      avgPenalties: referee?.penaltyRate || 0.3,
      homeTeamBias: 'neutral',
      cardPrediction: expectedCards > 4 ? 'Over 3.5' : 'Under 4.5',
      reasoning: msg.refereeReasoning
    },
    weatherImpact: {
      condition: 'Clear',
      temperature: 15,
      impact: 'Low',
      reasoning: msg.weatherReasoning
    },
    lineupAnalysis: {
      homeFormation: '4-3-3',
      awayFormation: '4-4-2',
      keyBattles: msg.keyBattles,
      missingKeyPlayers: []
    },
    cornersAndCards: {
      expectedCorners,
      cornersLine: expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5',
      cornersConfidence: 60,
      expectedCards,
      cardsLine: expectedCards > 4 ? 'Over 3.5' : 'Under 4.5',
      cardsConfidence: 58
    },
    preparationScore: {
      home: Math.min(100, Math.max(0, Math.round(
        (homeOver >= 55 ? 20 : 10) + // Form pozitif ise +20, negatif ise +10
        (homeForm?.wins && homeForm.wins > homeForm.losses ? 15 : 5) + // Kazanma oranı
        35 + // Base score
        (homeForm?.venueAvgScored && parseFloat(homeForm.venueAvgScored) > 1.5 ? 10 : 5) // Gol atma gücü
      ))),
      away: Math.min(100, Math.max(0, Math.round(
        (awayOver >= 55 ? 20 : 10) + // Form pozitif ise +20, negatif ise +10
        (awayForm?.wins && awayForm.wins > awayForm.losses ? 15 : 5) + // Kazanma oranı
        30 + // Base score (deplasman için biraz düşük)
        (awayForm?.venueAvgScored && parseFloat(awayForm.venueAvgScored) > 1.5 ? 10 : 5) // Gol atma gücü
      ))),
      reasoning: {
        home: language === 'tr' 
          ? `Form analizi: ${homeOver}% Over, ${homeForm?.wins || 0} galibiyet. Evde ${homeForm?.venueAvgScored || 'N/A'} gol atma ortalaması.`
          : language === 'de'
          ? `Formanalyse: ${homeOver}% Over, ${homeForm?.wins || 0} Siege. Heimdurchschnitt: ${homeForm?.venueAvgScored || 'N/A'} Tore.`
          : `Form analysis: ${homeOver}% Over, ${homeForm?.wins || 0} wins. Home average: ${homeForm?.venueAvgScored || 'N/A'} goals.`,
        away: language === 'tr'
          ? `Form analizi: ${awayOver}% Over, ${awayForm?.wins || 0} galibiyet. Deplasman ${awayForm?.venueAvgScored || 'N/A'} gol atma ortalaması.`
          : language === 'de'
          ? `Formanalyse: ${awayOver}% Over, ${awayForm?.wins || 0} Siege. Auswärtsdurchschnitt: ${awayForm?.venueAvgScored || 'N/A'} Tore.`
          : `Form analysis: ${awayOver}% Over, ${awayForm?.wins || 0} wins. Away average: ${awayForm?.venueAvgScored || 'N/A'} goals.`
      }
    },
    // 🆕 Motivasyon puanları
    motivationScores: {
      home: homeMotivation.score,
      away: awayMotivation.score,
      homeTrend: homeMotivation.trend,
      awayTrend: awayMotivation.trend,
      homeFormGraph: homeMotivation.formGraph,
      awayFormGraph: awayMotivation.formGraph,
      reasoning: `${matchData.homeTeam}: ${homeMotivation.reasoning}. ${matchData.awayTeam}: ${awayMotivation.reasoning}. Puan farkı: ${Math.abs(homeMotivation.score - awayMotivation.score)} puan.`
    },
    riskLevel: 'Medium',
    agentSummary: msg.agentSummary
  };
}
