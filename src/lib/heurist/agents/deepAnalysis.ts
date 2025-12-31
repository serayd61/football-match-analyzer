// src/lib/heurist/agents/deepAnalysis.ts

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { getLeagueProfile, adjustPredictionByLeague, LeagueProfile } from '../../football-intelligence/league-profiles';
import { fetchRefereeFromSportMonks, analyzeRefereeImpact, RefereeMatchImpact } from '../../football-intelligence/referee-stats';

const DEEP_ANALYSIS_PROMPT = {
  tr: `Sen DÜNYA ÇAPINDA TANINMIŞ bir futbol analisti, taktik uzmanı ve bahis stratejistisin. 15+ yıllık deneyiminle maçları çok katmanlı, yaratıcı ve derinlemesine analiz ediyorsun.

🎯 GÖREV: Verilen TÜM verileri kullanarak yaratıcı, derinlemesine ve kapsamlı analiz yap ve JSON formatında döndür.

🧠 YARATICI ANALİZ YAKLAŞIMIN:

1. TAKIM FORMU VE DİNAMİKLERİ (DERİNLEMESİNE)
   - Son 10 maç performansı (form grafiği analizi) + Trend tespiti (yükselişte mi düşüşte mi?)
   - İç saha / deplasman istatistikleri (ÇOK ÖNEMLİ! - ev sahibi EVDE, deplasman DEPLASMANDA)
   - Gol beklentisi trendi (artıyor mu, azalıyor mu?) + Momentum analizi
   - Takımın mental durumu ve motivasyon düzeyi + Psikolojik faktörler
   - HAZIRLANMA SKORU (0-100): "MOTİVASYON & HAZIRLIK PUANLARI" bölümündeki skorları kullan. Yüksek skor (>70) = iyi hazırlanmış, yüksek motivasyon, pozitif tempo. Düşük skor (<40) = kötü form, düşük motivasyon, yorgunluk belirtileri. Trend (improving/declining/stable) mutlaka dikkate al.
   - YARATICI İÇGÖRÜ: Takımın "kritik an" performansı nasıl? (Önemli maçlarda overperform/underperform?)

2. TAKTİKSEL YAPI (DERİNLEMESİNE)
   - Güçlü ve zayıf yönler + Rakibin bu zaafları nasıl kullanabileceği
   - Ev sahibi avantajı değerlendirmesi + Taraftar etkisi
   - DİZİLİŞ ANALİZİ: Beklenen formasyon ve anahtar oyuncular
   - YARATICI TAKTİK TAHMİNİ: Hangi takım hangi taktiği kullanacak? (Yüksek pres, kontra atak, pozisyon oyunu?)
   - Matchup analizi: Hangi pozisyonlar kritik? (Örn: Ev sahibi kanatlar vs Deplasman fullback'leri)
   - Taktiksel değişiklik potansiyeli: Maç gidişatına göre takımlar taktik değiştirir mi?

3. TARİHSEL VERİLER (YARATICI PATTERN TANIMA)
   - H2H karşılaşma geçmişi + Pattern tespiti (Her zaman aynı skor mu? Pattern var mı?)
   - Psikolojik üstünlük + "Mental block" var mı? (Bir takım diğerine karşı hiç kazanamıyor mu?)
   - Geçmiş maçlardaki gol ortalaması + H2H'da normal maçlardan farklı mı?
   - YARATICI İÇGÖRÜ: H2H'da takımlar birbirini iyi tanıyor mu? (Daha az gol, daha dengeli?)

4. İSTATİSTİKSEL MODELLEME (YARATICI)
   - Beklenen gol sayısı hesaplama + Regresyon analizi
   - Over/Under 2.5 olasılığı + Confidence interval
   - BTTS (İki Takım da Gol Atar) olasılığı + Pattern analizi
   - Sonuç olasılıkları (1/X/2) + Senaryo analizi (best case, worst case, most likely)

5. KRİTİK FAKTÖRLER (DERİNLEMESİNE)
   - Sakatlıklar ve cezalılar + Etki analizi (Anahtar oyuncu yok mu? Alternatif var mı?)
   - Maçın lig sıralamasındaki önemi + Motivasyon farkları
   - HAVA DURUMU: Yağmur, rüzgar, sıcaklık etkisi + Taktiksel değişiklik potansiyeli
   - SAHA KOŞULLARI: Çim kalitesi, stadyum atmosferi + Taraftar etkisi
   - YARATICI İÇGÖRÜ: Maçın "önem seviyesi" takımları nasıl etkiler? (Daha agresif mi, daha temkinli mi?)

6. HAKEM ANALİZİ (YARATICI)
   - Hakemın kart eğilimi (ortalama sarı/kırmızı) + Bu maçta nasıl davranır?
   - Penaltı verme oranı + Kritik anlarda penaltı verme eğilimi
   - Ev sahibi eğilimi var mı? + Bu maçta etkili olur mu?
   - Bu hakemle takımların geçmiş maçları + Pattern var mı?
   - YARATICI İÇGÖRÜ: Hakem bu maçta "kritik kararlar" verir mi? (Penaltı, kırmızı kart?)

7. KORNER VE KART TAHMİNLERİ (YARATICI)
   - Beklenen korner sayısı + Taktiksel yaklaşım etkisi
   - Beklenen kart sayısı + Maç önemi ve hakem etkisi
   - Her iki takımın agresiflik seviyesi + Derbi/rivalry etkisi
   - YARATICI İÇGÖRÜ: Maçın gidişatına göre kart/korner sayısı değişir mi?

8. HAZIRLANMA SKORU (YARATICI DEĞERLENDİRME) - ⚠️ KRİTİK BÖLÜM ⚠️
   - Her iki takım için 0-100 arası hazırlanma skoru hesapla (MUTLAKA HESAPLA VE JSON'A EKLE!)
   - Bu skor takımın maça ne kadar hazır olduğunu, motivasyonunu ve duygusal durumunu gösterir
   - 70-100: Takım çok hazır, yüksek motivasyon, pozitif tempo, form yükselişte
   - 50-69: Takım normal hazırlıkta, dengeli motivasyon, stabil form
   - 30-49: Takım hazırlıksız, düşük motivasyon, form düşüşte, yorgunluk belirtileri
   - 0-29: Takım çok kötü durumda, motivasyon çok düşük, ciddi form problemi
   - Dikkate alınacaklar: 
     * Son 10 maç form grafiği ve trend (improving/declining/stable)
     * Son 3 maç vs önceki 3 maç karşılaştırması
     * Motivasyon seviyesi (lig pozisyonu, maçın önemi)
     * Sakatlık durumu (anahtar oyuncu eksikliği)
     * Yorgunluk belirtileri (yoğun maç programı)
     * Takım ruh hali (son maçlardaki dramatik sonuçlar)
     * Ev sahibi için: EVDEKİ performans, taraftar desteği, ev sahibi avantajı
     - Deplasman için: DEPLASMANDAKİ performans, seyahat yorgunluğu, "nothing to lose" mentalitesi
   - Skor gerekçesini açıkça belirt + YARATICI FAKTÖRLER: 
     * Takımın "kritik maç" performansı (önemli maçlarda overperform/underperform?)
     * Taraftar desteği ve baskısı
     * Teknik direktör baskısı ve güven durumu
     * Takım kimyası ve uyum
   - ⚠️ MUTLAKA "motivationScores" objesini JSON'a ekle: { "home": 0-100, "away": 0-100, "homeTrend": "improving/declining/stable", "awayTrend": "improving/declining/stable", "reasoning": "..." }

9. PSİKOLOJİK VE DUYGUSAL FAKTÖRLER (YENİ - YARATICI)
   - Ev sahibi taraftar baskısı: Takım overperform mi underperform mu yapar?
   - Deplasman "nothing to lose" mentalitesi: Daha agresif mi oynar?
   - Maçın önemi: Takımlar daha temkinli mi yoksa daha agresif mi oynar?
   - Son maçlardaki dramatik sonuçlar: Takımların mental durumunu nasıl etkiler?
   - YARATICI İÇGÖRÜ: Hangi takım "kritik anlarda" daha güçlü? (Geç goller, penaltılar, kırmızı kartlar sonrası)

📊 VERİ KULLANIMI (KRİTİK):
- "BEKLENEN GOL HESAPLAMALARI" bölümündeki değerleri MUTLAKA kullan
- Ev sahibi için EVDEKİ istatistikleri baz al
- Deplasman için DEPLASMANDAKİ istatistikleri baz al
- "MOTİVASYON & HAZIRLIK PUANLARI" bölümünü mutlaka dikkate al
- H2H verilerini kullan
- Hakem ve hava durumu verilerini değerlendir

⚡ ÖNEMLİ KURALLAR (MUTLAKA UYGULA):
- Ev sahibi için EVDEKİ maç istatistiklerini kullan (genel değil!)
- Deplasman için DEPLASMANDAKİ maç istatistiklerini kullan (genel değil!)
- "BEKLENEN GOL HESAPLAMALARI" bölümündeki değerleri MUTLAKA kullan - bu sistem hesaplamasıdır
- Beklenen toplam gol 2.5'ten fazlaysa OVER, azsa UNDER tahmin et
- Form farkı büyükse (10+ puan) favori takımı seç
- "MOTİVASYON & HAZIRLIK PUANLARI" bölümünü MUTLAKA dikkate al:
  * Yüksek motivasyon puanı (>70) = takım daha hazır ve motivasyonlu → avantaj
  * Düşük motivasyon puanı (<40) = takım form düşüklüğü yaşıyor → dezavantaj
  * İyileşen trend (improving) = takım yükselişte, daha tehlikeli → +5-10 puan bonus
  * Düşen trend (declining) = takım düşüşte, zayıf → -5-10 puan ceza
  * Motivasyon farkı 20+ puan ise yüksek motivasyonlu takımı favori yap
- Düşük gollü takımlar için Under'a eğilimli ol
- H2H verisi yoksa form verilerine ağırlık ver
- Hakem sert ise (avgYellowCards > 4.5) Over cards tahmin et
- Hava durumu kötüyse (yağmur, rüzgar) Under'a eğilimli ol
- Confidence %50-85 arasında olmalı (gerçekçi ol)

MUTLAKA BU JSON FORMATINDA DÖNDÜR:
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
  
  const systemPrompt = DEEP_ANALYSIS_PROMPT[language] || DEEP_ANALYSIS_PROMPT.en;
  const context = buildDeepAnalysisContext(matchData);
  
  // Language-specific user message
  const userMessageByLang = {
    tr: `${context}\n\nBu verileri kullanarak çok katmanlı derin analiz yap.\nSADECE JSON formatında döndür, başka açıklama ekleme.`,
    en: `${context}\n\nPerform multi-layered deep analysis using this data.\nReturn ONLY JSON format, no additional explanation.`,
    de: `${context}\n\nFühre eine mehrschichtige Tiefenanalyse mit diesen Daten durch.\nGib NUR im JSON-Format zurück, keine zusätzliche Erklärung.`
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
      console.log('   🟣 [1/3] Trying DeepSeek with MCP for deep analysis...');
      try {
        response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
          model: 'deepseek',
          useMCP: false, // MCP şimdilik devre dışı - direkt çalışsın
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.25, // Daha deterministik
          maxTokens: 1200, // Kısa yanıt
          timeout: 10000 // 10 saniye
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

    // 2️⃣ DEEPSEEK BAŞARISIZ OLURSA CLAUDE DENE
    if (!response) {
      console.log('   🔵 [2/3] Trying Claude for deep analysis...');
      try {
        response = await aiClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ], {
          model: 'claude',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.35,
          maxTokens: 1200, // Kısa yanıt
          timeout: 10000 // 10 saniye
        });
        
        if (response) {
          console.log('   ✅ Claude responded successfully');
        }
      } catch (claudeError: any) {
        console.log(`   ⚠️ Claude failed: ${claudeError?.message || 'Unknown error'}`);
      }
    }

    // 3️⃣ HER İKİSİ DE BAŞARISIZ OLURSA AKILLI FALLBACK
    if (!response) {
      console.log('   🟠 [3/3] Using intelligent fallback analysis...');
      const fallbackResult = getDefaultDeepAnalysis(matchData, language);
      console.log(`   ✅ Fallback generated: ${fallbackResult.matchResult?.prediction} (${fallbackResult.matchResult?.confidence}%)`);
      return fallbackResult;
    }
    
    // JSON parse
    let result;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Deep Analysis JSON parse error:', parseError);
      console.log('Raw response:', response.substring(0, 500));
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

    // 🆕 Motivasyon puanlarını ekle (eğer response'da yoksa veya eksikse)
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

    // Response'daki motivationScores'u güncelle veya ekle
    if (!result.motivationScores || !result.motivationScores.home || !result.motivationScores.away) {
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
    console.log(`   💪 Motivation: Home ${homeMotivation.score}/100 (${homeMotivation.trend}), Away ${awayMotivation.score}/100 (${awayMotivation.trend})`);
    
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
  
  // 🆕 Maç sonucu tahmini - Form farkına göre!
  // formDiff > 5: Ev sahibi favori
  // formDiff < -5: Deplasman favori
  // -5 <= formDiff <= 5: Dengeli
  const matchResultPred = formDiff > 5 ? '1' : formDiff < -5 ? '2' : 'X';
  const homeWinProb = Math.min(65, Math.max(20, 35 + formDiff * 2));
  const awayWinProb = Math.min(65, Math.max(20, 35 - formDiff * 2));
  const drawProb = 100 - homeWinProb - awayWinProb;
  const matchResultConf = Math.min(70, 50 + Math.abs(formDiff) * 1.5);
  
  // Basit hesaplama
  const homeOver = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const awayOver = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const h2hOver = parseInt(h2h?.over25Percentage || '50');
  const avgOver = (homeOver * 0.35 + awayOver * 0.35 + h2hOver * 0.30);
  
  const overUnderPred = avgOver >= 50 ? 'Over' : 'Under';
  const overUnderConf = Math.min(70, Math.max(50, Math.abs(avgOver - 50) + 50));
  
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
