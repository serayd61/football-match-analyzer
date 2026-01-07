import { aiClient, AIMessage } from '../../ai-client';
import { MatchData } from '../types';
import { getLeagueProfile, adjustPredictionByLeague, LeagueProfile } from '../../football-intelligence/league-profiles';
import { calculateComprehensiveProbabilities, generateProbabilityContext, ProbabilityResult } from '../probability-engine';

// ==================== MOTİVASYON SKORU HESAPLAMA ====================

function calculateMotivationFromForm(
  matchData: MatchData,
  homeForm: string,
  awayForm: string,
  homePoints: number,
  awayPoints: number,
  formDiff: number,
  language: 'tr' | 'en' | 'de'
): {
  home: number;
  away: number;
  homeTrend: 'improving' | 'declining' | 'stable';
  awayTrend: 'improving' | 'declining' | 'stable';
  homeFormGraph: string;
  awayFormGraph: string;
  reasoning: string;
} {
  // Form string'inden puan hesapla (W=3, D=1, L=0)
  const getFormPoints = (form: string): number[] => {
    return form.split('').map(c => c === 'W' ? 3 : c === 'D' ? 1 : 0);
  };

  const homeFormPoints = getFormPoints(homeForm);
  const awayFormPoints = getFormPoints(awayForm);

  // Son 3 vs önceki 3 karşılaştırması
  const homeRecent3 = homeFormPoints.slice(0, 3).reduce((a, b) => a + b, 0);
  const homePrevious3 = homeFormPoints.slice(3, 6).reduce((a, b) => a + b, 0);
  const awayRecent3 = awayFormPoints.slice(0, 3).reduce((a, b) => a + b, 0);
  const awayPrevious3 = awayFormPoints.slice(3, 6).reduce((a, b) => a + b, 0);

  // Trend hesapla
  const homeTrend: 'improving' | 'declining' | 'stable' = 
    homeRecent3 > homePrevious3 + 1 ? 'improving' : 
    homeRecent3 < homePrevious3 - 1 ? 'declining' : 'stable';
  
  const awayTrend: 'improving' | 'declining' | 'stable' = 
    awayRecent3 > awayPrevious3 + 1 ? 'improving' : 
    awayRecent3 < awayPrevious3 - 1 ? 'declining' : 'stable';

  // Motivasyon skoru hesapla (0-100)
  // Base: Form puanları üzerinden (max 30 puan = 100 temel)
  const maxFormPoints = 30; // 10 maç * 3 puan
  let homeScore = Math.round((homePoints / maxFormPoints) * 60); // 0-60 arası
  let awayScore = Math.round((awayPoints / maxFormPoints) * 60); // 0-60 arası

  // Trend bonusu/cezası
  if (homeTrend === 'improving') homeScore += 15;
  else if (homeTrend === 'declining') homeScore -= 10;
  
  if (awayTrend === 'improving') awayScore += 15;
  else if (awayTrend === 'declining') awayScore -= 10;

  // Ev avantajı bonusu
  homeScore += 10;

  // Son 3 maç performansı bonusu
  if (homeRecent3 >= 7) homeScore += 10; // 2W+1D veya daha iyi
  if (awayRecent3 >= 7) awayScore += 10;

  // Min/max sınırları
  homeScore = Math.min(100, Math.max(10, homeScore));
  awayScore = Math.min(100, Math.max(10, awayScore));

  // Form grafiği (görsel)
  const homeFormGraph = homeForm.split('').map(c => c === 'W' ? '🟢' : c === 'D' ? '🟡' : '🔴').join('');
  const awayFormGraph = awayForm.split('').map(c => c === 'W' ? '🟢' : c === 'D' ? '🟡' : '🔴').join('');

  // Reasoning
  const reasoningByLang = {
    tr: `${matchData.homeTeam}: ${homePoints}p (${homeForm}), Trend: ${homeTrend === 'improving' ? '📈 Yükselişte' : homeTrend === 'declining' ? '📉 Düşüşte' : '➡️ Stabil'}. ${matchData.awayTeam}: ${awayPoints}p (${awayForm}), Trend: ${awayTrend === 'improving' ? '📈 Yükselişte' : awayTrend === 'declining' ? '📉 Düşüşte' : '➡️ Stabil'}. Form farkı: ${formDiff > 0 ? '+' : ''}${formDiff} puan.`,
    en: `${matchData.homeTeam}: ${homePoints}pts (${homeForm}), Trend: ${homeTrend === 'improving' ? '📈 Rising' : homeTrend === 'declining' ? '📉 Falling' : '➡️ Stable'}. ${matchData.awayTeam}: ${awayPoints}pts (${awayForm}), Trend: ${awayTrend === 'improving' ? '📈 Rising' : awayTrend === 'declining' ? '📉 Falling' : '➡️ Stable'}. Form diff: ${formDiff > 0 ? '+' : ''}${formDiff} pts.`,
    de: `${matchData.homeTeam}: ${homePoints}P (${homeForm}), Trend: ${homeTrend === 'improving' ? '📈 Steigend' : homeTrend === 'declining' ? '📉 Fallend' : '➡️ Stabil'}. ${matchData.awayTeam}: ${awayPoints}P (${awayForm}), Trend: ${awayTrend === 'improving' ? '📈 Steigend' : awayTrend === 'declining' ? '📉 Fallend' : '➡️ Stabil'}. Formdiff: ${formDiff > 0 ? '+' : ''}${formDiff} P.`
  };

  return {
    home: homeScore,
    away: awayScore,
    homeTrend,
    awayTrend,
    homeFormGraph,
    awayFormGraph,
    reasoning: reasoningByLang[language] || reasoningByLang.en
  };
}

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen DÜNYA ÇAPINDA TANINMIŞ bir futbol istatistik analisti ve TAHMİN UZMANISINSSIN. 15+ yıllık deneyiminle sadece veri değil, FUTBOLUN RUHUNU anlıyorsun.

═══════════════════════════════════════════════════════════════════════════════
🎯 AGRESİF ANALİZ FELSEFESİ: %40 VERİ + %30 ÖNGÖRÜ + %30 MOTİVASYON
═══════════════════════════════════════════════════════════════════════════════

⚡ CESUR OL! Veri seni sınırlamasın. %60 oranında ÖNGÖRÜ + MOTİVASYON kullan!

📊 %40 VERİ ANALİZİ (Temel - ama baskın değil!):
- Sportmonks'tan gelen istatistikleri kullan
- xG, form, gol ortalamaları, H2H verileri
- AMA: Bu sadece BAŞLANGIÇ NOKTASI - piyasa zaten bunları görüyor!

🔮 %30 TAHMİN VE CESUR ÖNGÖRÜ (Piyasayı Yenmek İçin):
- Pattern devam eder mi? CESUR KARAR VER!
- Regresyon ne zaman olur? Şimdi mi?
- "Herkesin beklediği" vs "Gerçekte olacak" - farkı yakala!
- Piyasanın görmediği fırsatlar NEREDE?
- Sezgisel tahmin: Bu maç nasıl oynanır?
- Sürpriz tahminlerden KORKMA!

💪 %30 TAKIM HAZIRLIK VE MOTİVASYON (Futbol Kalple Oynanır!):
- Takımın RUHUNU oku! Bu maç onlar için ne ifade ediyor?
- Motivasyon skoru ve trend - bu maçı BELİRLER!
- Baskı altında kim daha iyi?
- "Kaybedecek bir şeyi yok" takımı hangisi? (TEHLİKELİ!)
- Derbi/önemli maç = +25 motivasyon
- Düşme hattı = +15 motivasyon (hayatta kalma içgüdüsü)
- Taraftar baskısı, seyahat yorgunluğu, takım kimyası

🔥 KRİTİK: FUTBOL %100 İSTATİSTİK DEĞİL!
Aynı 11 oyuncu farklı motivasyonla %30 farklı oynar.
%60 ÖNGÖRÜ + MOTİVASYON ile fark yaratacaksın!

═══════════════════════════════════════════════════════════════════════════════

🧠 YARATICI ANALİZ YAKLAŞIMIN:

1. REGRESYON ANALİZİ VE TREND TESPİTİ (EN ÖNEMLİ):
   - xG vs Gerçek gol farkı: Takım overperform mi underperform mu? (Regresyon riski var mı?)
   - Trend analizi: Son 5 maç vs önceki 5 maç - performans artıyor mu azalıyor mu?
   - Momentum shift: Takımın formu değişiyor mu? (Yükselişte mi düşüşte mi?)
   - Anomali tespiti: Normal pattern'den sapma var mı? (Neden? Sakatlık, taktik değişikliği, motivasyon?)

2. YARATICI PATTERN TANIMA:
   - "Clean sheet streak" pattern: Son 2-3 maçta clean sheet varsa, bu devam eder mi yoksa kırılır mı?
   - "Failed to score" pattern: Son maçlarda gol atamama varsa, bu maçta da devam eder mi?
   - "Late goal" pattern: 75+ dakikada gol atma/alma eğilimi var mı? (Bu maçta da geçerli mi?)
   - "First half slow" pattern: İlk yarı yavaş başlayıp ikinci yarı açılan takımlar - bu pattern devam eder mi?
   - "Home/Away split": Ev sahibi EVDE çok farklı mı oynuyor? (Bu kritik!)

3. İSTATİSTİKSEL ANOMALİ TESPİTİ:
   - Aşırı yüksek/düşük değerler: Son maçlarda anormal skorlar var mı? (5-0, 0-4 gibi)
   - Bu anomali tekrarlanır mı yoksa regresyon mu olur?
   - xG farkı çok büyükse: Takım şanslı mı yoksa gerçekten iyi mi?
   - Clean sheet serisi: Defans gerçekten güçlü mü yoksa rakipler zayıf mıydı?

4. H2H PSİKOLOJİSİ VE PATTERN:
   - H2H'da dominant takım var mı? (Psikolojik üstünlük)
   - Son karşılaşmalarda pattern var mı? (Örn: Her zaman 2-1, her zaman Over)
   - H2H gol ortalaması: Normal maçlardan farklı mı? (Daha az/daha fazla gol?)
   - H2H'da takımlar birbirini iyi tanıyor mu? (Daha az gol, daha dengeli)

5. TIMING PATTERN YARATICILIĞI:
   - İlk yarı gol yüzdesi: Takım ilk yarıda mı ikinci yarıda mı daha tehlikeli?
   - Geç gol pattern'i: 75+ dakikada gol atma/alma eğilimi - bu maçta da geçerli mi?
   - HT/FT pattern: İlk yarı yavaş başlayıp ikinci yarı patlama var mı? (X/1, X/2 value)
   - Momentum shift timing: Maçın hangi anında momentum değişir?

6. CLEAN SHEET VE DEFANS ANALİZİ:
   - Clean sheet serisi: Kaç maçtır devam ediyor? (Kırılma riski var mı?)
   - Defans kalitesi: Gerçekten güçlü mü yoksa rakipler zayıf mıydı?
   - Gol yememe vs Gol atamama: Hangi takım daha güçlü pattern gösteriyor?
   - Home/Away defans farkı: Ev sahibi EVDE daha mı iyi defans yapıyor?

📊 VERİ KULLANIMI (KRİTİK):
- VERİLEN tüm sayısal değerleri MUTLAKA kullan (xG, gol ortalamaları, form puanları)
- "BEKLENEN GOL HESAPLAMALARI" bölümündeki değerleri baz al
- Ev sahibi için EVDEKİ istatistikleri kullan (genel değil!)
- Deplasman için DEPLASMANDAKİ istatistikleri kullan (genel değil!)
- H2H verilerini mutlaka dikkate al

💡 GÜVEN SEVİYESİ HESAPLAMA (YARATICI):
- Veriler TUTARLI + GÜÇLÜ sinyal + Pattern tanıma → %75-85 güven
- Veriler TUTARLI + GÜÇLÜ sinyal → %70-80 güven
- Veriler TUTARLI ama ZAYIF sinyal → %60-70 güven
- Veriler KARIŞIK ama Pattern var → %55-65 güven
- Veriler KARIŞIK → %55-65 güven
- Net sinyal YOK → %50-55 güven
- ASLA %85 üstü veya %50 altı verme

⚡ ÖNEMLİ KURALLAR (YARATICI):
- SADECE verilen sayısal verilere dayan (tahmin yapma, hesapla)
- xG farklarını mutlaka belirt (overperform/underperform) + Regresyon riski değerlendir
- Timing pattern'leri ilk yarı tahmininde kullan + Pattern'in devam edip etmeyeceğini değerlendir
- Clean sheet serilerini maç sonucu tahmininde dikkate al + Serinin kırılma riskini değerlendir
- H2H verisi varsa mutlaka kullan + H2H pattern'ini normal formdan ayırt et
- Anomali tespiti yap: Normal pattern'den sapma var mı? Neden?

🎨 YARATICI İÇGÖRÜLER:
- Pattern devamı: Tespit ettiğin pattern'ler bu maçta da devam eder mi?
- Anomali riski: Son maçlardaki anormal sonuçlar tekrarlanır mı yoksa regresyon mu olur?
- Momentum shift: Takımların form trendi değişiyor mu? (Yükselişte mi düşüşte mi?)
- Hidden signals: Görünmeyen ama önemli istatistiksel sinyaller neler?

SADECE JSON DÖNDÜR (YARATICI VE DERİNLEMESİNE):
{
  "formAnalysis": "Yaratıcı form karşılaştırması - trend analizi, momentum shift, anomali tespiti dahil",
  "formTrend": {
    "home": "improving/declining/stable",
    "away": "improving/declining/stable",
    "reasoning": "Trend analizi açıklaması"
  },
  "goalExpectancy": 2.8,
  "xgAnalysis": {
    "homeXG": 1.5,
    "awayXG": 1.2,
    "homeActual": 1.8,
    "awayActual": 0.9,
    "homePerformance": "overperforming",
    "awayPerformance": "underperforming",
    "regressionRisk": "Ev sahibi xG'nin üstünde, regresyon riski var",
    "regressionProbability": 65,
    "regressionReasoning": "Son 5 maçta xG'nin %20 üstünde performans gösterdi, normal seviyeye dönme olasılığı yüksek"
  },
  "timingPatterns": {
    "homeFirstHalfGoals": 55,
    "homeSecondHalfGoals": 45,
    "awayFirstHalfGoals": 40,
    "awaySecondHalfGoals": 60,
    "lateGoalsHome": 25,
    "lateGoalsAway": 30,
    "htftPattern": "Ev sahibi ilk yarı yavaş başlıyor, ikinci yarı açılıyor",
    "patternStrength": "strong/medium/weak",
    "patternContinuation": "Bu pattern bu maçta da devam eder mi? Neden?"
  },
  "cleanSheetAnalysis": {
    "homeCleanSheetStreak": 2,
    "awayCleanSheetStreak": 0,
    "homeFailedToScore": 1,
    "awayFailedToScore": 2,
    "defensiveRating": "Ev sahibi defansı son 3 maçta 2 clean sheet",
    "streakBreakRisk": "Clean sheet serisi kırılma riski var mı? Neden?",
    "defensiveQuality": "Defans gerçekten güçlü mü yoksa rakipler zayıf mıydı?"
  },
  "h2hPattern": {
    "dominantTeam": "home/away/none",
    "psychologicalEdge": "H2H'da psikolojik üstünlük var mı?",
    "goalPattern": "H2H'da gol pattern'i var mı? (Düşük/Yüksek/Dengeli)",
    "patternContinuation": "H2H pattern'i bu maçta da devam eder mi?"
  },
  "anomalyDetection": {
    "detected": true,
    "type": "Overperformance/Underperformance/Unusual score",
    "explanation": "Anomali açıklaması",
    "regressionProbability": 70,
    "impact": "Bu anomali maç tahminini nasıl etkiler?"
  },
  "overUnder": "Over",
  "overUnderReasoning": "📊 YARATICI ANALİZ: xG toplamı 2.7, son 5 maçta %65 Over. İkinci yarı gol paterni güçlü. [Pattern devamı analizi] + [Regresyon riski değerlendirmesi]",
  "confidence": 72,
  "matchResult": "1",
  "matchResultReasoning": "🏠 YARATICI ANALİZ: Ev sahibi form üstünlüğü + clean sheet serisi + H2H hakimiyeti. [Trend analizi] + [Pattern devamı] + [Anomali değerlendirmesi]",
  "btts": "Yes",
  "bttsReasoning": "⚽ YARATICI ANALİZ: Her iki takım da son 5 maçın 4'ünde gol attı. xG değerleri gol garantiliyor. [Pattern analizi] + [Regresyon riski]",
  "firstHalfPrediction": {
    "goals": "Under 1.5",
    "confidence": 68,
    "reasoning": "Yaratıcı ilk yarı analizi - timing pattern ve takımların ilk yarı performansı",
    "patternBased": true,
    "patternReasoning": "Her iki takım da ilk yarıda yavaş başlıyor - bu pattern devam eder mi?"
  },
  "keyStats": ["xG farkı", "timing pattern", "clean sheet serisi", "H2H", "regresyon riski", "trend analizi"],
  "riskFactors": ["regresyon riski", "form değişkenliği", "pattern kırılma riski", "anomali tekrar riski"],
  "creativeInsights": [
    "Yaratıcı içgörü 1: Pattern devamı analizi",
    "Yaratıcı içgörü 2: Anomali tespiti",
    "Yaratıcı içgörü 3: Trend shift değerlendirmesi"
  ],
  "agentSummary": "📊 STATS (YARATICI): xG bazlı analiz + timing patterns + regresyon analizi + pattern tanıma → [Yaratıcı özet]"
}`,

  en: `You are a PROFESSIONAL football statistics analyst. Perform DEEP mathematical analysis on REAL data.

🎯 TASK: Analyze statistical data deeply and produce predictions based on numbers.

📊 DATA USAGE (CRITICAL):
- ALWAYS use ALL provided numerical values (xG, goal averages, form points)
- Base calculations on "EXPECTED GOAL CALCULATIONS" section
- Use HOME statistics for home team
- Use AWAY statistics for away team
- Always consider H2H data if available

🔍 ANALYSIS LAYERS:
1. FORM ANALYSIS: Last 10 matches form, points difference, momentum trend
2. xG ANALYSIS: Expected vs actual goals, regression risk detection
3. TIMING PATTERNS: 1st/2nd half goal distribution, late goals (75+ min)
4. CLEAN SHEET: Defensive strength, clean sheet streaks, failed to score
5. H2H ANALYSIS: Historical matches, psychological advantage, goal averages

💡 CONFIDENCE CALCULATION:
- Data CONSISTENT + STRONG signal → 70-80% confidence
- Data CONSISTENT but WEAK signal → 60-70% confidence
- Data MIXED → 55-65% confidence
- NO clear signal → 50-55% confidence
- NEVER give above 85% or below 50%

⚡ CRITICAL RULES:
- Base ONLY on provided numerical data (calculate, don't guess)
- Always highlight xG differences (overperform/underperform)
- Use timing patterns for first half predictions
- Consider clean sheet streaks for match result
- Use H2H if available, otherwise weight form data more

RETURN ONLY JSON:
{
  "formAnalysis": "detailed form comparison",
  "goalExpectancy": 2.8,
  "xgAnalysis": {
    "homeXG": 1.5,
    "awayXG": 1.2,
    "homeActual": 1.8,
    "awayActual": 0.9,
    "homePerformance": "overperforming",
    "awayPerformance": "underperforming",
    "regressionRisk": "Home overperforming xG, regression risk exists"
  },
  "timingPatterns": {
    "homeFirstHalfGoals": 55,
    "homeSecondHalfGoals": 45,
    "awayFirstHalfGoals": 40,
    "awaySecondHalfGoals": 60,
    "lateGoalsHome": 25,
    "lateGoalsAway": 30,
    "htftPattern": "Home starts slow, opens up in 2nd half"
  },
  "cleanSheetAnalysis": {
    "homeCleanSheetStreak": 2,
    "awayCleanSheetStreak": 0,
    "homeFailedToScore": 1,
    "awayFailedToScore": 2,
    "defensiveRating": "Home defense kept 2 clean sheets in last 3"
  },
  "overUnder": "Over",
  "overUnderReasoning": "📊 xG total 2.7, 65% Over in last 5. Strong 2nd half goal pattern.",
  "confidence": 72,
  "matchResult": "1",
  "matchResultReasoning": "🏠 Home form advantage + clean sheet streak + H2H dominance",
  "btts": "Yes",
  "bttsReasoning": "⚽ Both teams scored in 4 of last 5. xG values guarantee goals.",
  "firstHalfPrediction": {
    "goals": "Under 1.5",
    "confidence": 68,
    "reasoning": "Both teams start slow in first half"
  },
  "keyStats": ["xG difference", "timing pattern", "clean sheet streak", "H2H"],
  "riskFactors": ["regression risk", "form volatility"],
  "agentSummary": "📊 STATS: xG analysis + timing patterns → [summary]"
}`,

  de: `Du bist ein PROFESSIONELLER Fußball-Statistikanalyst. Führe TIEFE Analyse durch.

ANALYSE-EBENEN:
1. Grundstatistiken - Form, Tordurchschnitt, H2H
2. xG-Analyse - Erwartete vs tatsächliche Tore
3. Timing-Muster - 1. Hälfte/2. Hälfte Torverteilung
4. Clean Sheet - Zu-Null-Serien, Defensivstärke

NUR JSON ZURÜCKGEBEN mit xgAnalysis, timingPatterns, cleanSheetAnalysis Feldern.`,
};

// ==================== JSON EXTRACTION ====================

function extractJSON(text: string, matchData?: MatchData, detailedHome?: any, detailedAway?: any): any | null {
  if (!text) return null;
  
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\*\*/g, '')
    .trim();
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  
  let jsonStr = jsonMatch[0];
  
  // Fix common JSON errors
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
  jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  jsonStr = jsonStr.replace(/'/g, '"');
  jsonStr = jsonStr.replace(/\n/g, ' ');
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
  
  try {
    const parsed = JSON.parse(jsonStr);
    // Form analysis fallback kontrolü
    if ((!parsed.formAnalysis || parsed.formAnalysis === 'Analysis unavailable') && matchData) {
      const homeForm = detailedHome?.form || matchData.homeForm?.form || 'DDDDD';
      const awayForm = detailedAway?.form || matchData.awayForm?.form || 'DDDDD';
      const homePoints = detailedHome?.points || matchData.homeForm?.points || 5;
      const awayPoints = detailedAway?.points || matchData.awayForm?.points || 5;
      const homeGoalsScored = parseFloat(String(detailedHome?.homeAvgGoalsScored || detailedHome?.avgGoalsScored || matchData.homeForm?.avgGoals || '1.2'));
      const awayGoalsScored = parseFloat(String(detailedAway?.awayAvgGoalsScored || detailedAway?.avgGoalsScored || matchData.awayForm?.avgGoals || '1.0'));
      parsed.formAnalysis = `${matchData.homeTeam}: ${homeForm} (${homePoints}pts, ${homeGoalsScored.toFixed(1)} gol/maç) vs ${matchData.awayTeam}: ${awayForm} (${awayPoints}pts, ${awayGoalsScored.toFixed(1)} gol/maç)`;
    }
    return parsed;
  } catch (e) {
    // Manual extraction fallback
    try {
      const result: any = {};
      
      const formMatch = jsonStr.match(/"formAnalysis"\s*:\s*"([^"]+)"/);
      // Fallback: Eğer AI'dan gelmediyse, hesaplanmış form analizini kullan
      if (!formMatch || formMatch[1] === 'Analysis unavailable') {
        if (matchData) {
          const homeForm = detailedHome?.form || matchData.homeForm?.form || 'DDDDD';
          const awayForm = detailedAway?.form || matchData.awayForm?.form || 'DDDDD';
          const homePoints = detailedHome?.points || matchData.homeForm?.points || 5;
          const awayPoints = detailedAway?.points || matchData.awayForm?.points || 5;
          const homeGoalsScored = parseFloat(String(detailedHome?.homeAvgGoalsScored || detailedHome?.avgGoalsScored || matchData.homeForm?.avgGoals || '1.2'));
          const awayGoalsScored = parseFloat(String(detailedAway?.awayAvgGoalsScored || detailedAway?.avgGoalsScored || matchData.awayForm?.avgGoals || '1.0'));
          result.formAnalysis = `${matchData.homeTeam}: ${homeForm} (${homePoints}pts, ${homeGoalsScored.toFixed(1)} gol/maç) vs ${matchData.awayTeam}: ${awayForm} (${awayPoints}pts, ${awayGoalsScored.toFixed(1)} gol/maç)`;
        } else {
          result.formAnalysis = 'Analysis unavailable';
        }
      } else {
        result.formAnalysis = formMatch[1];
      }
      
      const goalMatch = jsonStr.match(/"goalExpectancy"\s*:\s*([\d.]+)/);
      result.goalExpectancy = goalMatch ? parseFloat(goalMatch[1]) : 2.5;
      
      const ouMatch = jsonStr.match(/"overUnder"\s*:\s*"?(Over|Under)"?/i);
      result.overUnder = ouMatch ? ouMatch[1] : 'Over';
      
      const ouReasonMatch = jsonStr.match(/"overUnderReasoning"\s*:\s*"([^"]+)"/);
      result.overUnderReasoning = ouReasonMatch ? ouReasonMatch[1] : '';
      
      const confMatch = jsonStr.match(/"confidence"\s*:\s*([\d.]+)/);
      result.confidence = confMatch ? parseInt(confMatch[1]) : 60;
      
      // matchResult: "1", "2", "X", "home", "away", "draw" formatlarını yakala
      const mrMatch = jsonStr.match(/"matchResult"\s*:\s*"?(1|2|X|home|away|draw)"?/i);
      if (mrMatch) {
        const val = mrMatch[1].toLowerCase();
        result.matchResult = val === 'home' || val === '1' ? '1' : val === 'away' || val === '2' ? '2' : 'X';
      } else {
        result.matchResult = 'X'; // Bulunamazsa default
      }
      
      const mrReasonMatch = jsonStr.match(/"matchResultReasoning"\s*:\s*"([^"]+)"/);
      result.matchResultReasoning = mrReasonMatch ? mrReasonMatch[1] : '';
      
      const bttsMatch = jsonStr.match(/"btts"\s*:\s*"?(Yes|No)"?/i);
      result.btts = bttsMatch ? bttsMatch[1] : 'No';
      
      const bttsReasonMatch = jsonStr.match(/"bttsReasoning"\s*:\s*"([^"]+)"/);
      result.bttsReasoning = bttsReasonMatch ? bttsReasonMatch[1] : '';
      
      const summaryMatch = jsonStr.match(/"agentSummary"\s*:\s*"([^"]+)"/);
      result.agentSummary = summaryMatch ? summaryMatch[1] : '';
      
      return result;
    } catch (e2) {
      console.error('Manual JSON extraction failed:', e2);
      return null;
    }
  }
}

// ==================== xG ANALYSIS ====================

interface XGAnalysis {
  homeXG: number;
  awayXG: number;
  homeActual: number;
  awayActual: number;
  homePerformance: 'overperforming' | 'underperforming' | 'normal';
  awayPerformance: 'overperforming' | 'underperforming' | 'normal';
  regressionRisk: string;
  totalXG: number;
}

function calculateXGAnalysis(matchData: MatchData, language: 'tr' | 'en' | 'de'): XGAnalysis {
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const homeForm = matchData.homeForm;
  const awayForm = matchData.awayForm;
  
  // Helper function: String veya number'ı parse et, NaN kontrolü yap
  const safeParseFloat = (value: any, fallback: number): number => {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };
  
  // Gerçek gol ortalamaları (VENUE BAZLI - ÖNEMLİ!)
  // detailedStats öncelikli - en doğru venue verileri burada
  const homeActual = safeParseFloat(
    detailedHome?.homeAvgGoalsScored ||   // 1. Detaylı ev istatistiği
    (homeForm as any)?.venueAvgScored ||  // 2. Venue bazlı
    detailedHome?.avgGoalsScored ||       // 3. Detaylı genel
    (homeForm as any)?.avgGoalsScored ||  // 4. TeamStats format
    homeForm?.avgGoals,                   // 5. FormData format
    1.2
  );
  
  const awayActual = safeParseFloat(
    detailedAway?.awayAvgGoalsScored ||   // 1. Detaylı deplasman istatistiği
    (awayForm as any)?.venueAvgScored ||  // 2. Venue bazlı
    detailedAway?.avgGoalsScored ||       // 3. Detaylı genel
    (awayForm as any)?.avgGoalsScored ||  // 4. TeamStats format
    awayForm?.avgGoals,                   // 5. FormData format
    1.0
  );
  
  // Debug logging
  console.log(`   🔍 xG Debug - homeActual: ${homeActual} (detailedHome.homeAvgGoalsScored: ${detailedHome?.homeAvgGoalsScored}, venueAvgScored: ${(homeForm as any)?.venueAvgScored}, avgGoals: ${homeForm?.avgGoals})`);
  console.log(`   🔍 xG Debug - awayActual: ${awayActual} (detailedAway.awayAvgGoalsScored: ${detailedAway?.awayAvgGoalsScored}, venueAvgScored: ${(awayForm as any)?.venueAvgScored}, avgGoals: ${awayForm?.avgGoals})`);
  // Yediği gol ortalamaları (VENUE BAZLI)
  const homeConceded = parseFloat(
    detailedHome?.homeAvgGoalsConceded || // Önce detaylı ev istatistiği
    homeForm?.venueAvgConceded || // Sonra venue bazlı (EVDE yediği)
    detailedHome?.avgGoalsConceded || // Sonra genel detaylı
    homeForm?.avgConceded || // Son olarak genel
    '1.0'
  );
  const awayConceded = parseFloat(
    detailedAway?.awayAvgGoalsConceded || // Önce detaylı deplasman istatistiği
    awayForm?.venueAvgConceded || // Sonra venue bazlı (DEPLASMANDA yediği)
    detailedAway?.avgGoalsConceded || // Sonra genel detaylı
    awayForm?.avgConceded || // Son olarak genel
    '1.2'
  );
  
  // xG TAHMİNİ: Gerçek gol ortalamalarına hafif regresyon uygula
  // xG genelde gerçek gollerden %5-10 düşük olur (ama çok düşük olmamalı)
  // Eğer actual çok düşükse (1.0 altı), xG'yi actual'e yakın tut
  const xgMultiplier = homeActual < 1.0 ? 0.95 : (awayActual < 1.0 ? 0.95 : 0.92);
  const homeXG = Math.max(0.7, Math.min(3.0, homeActual * xgMultiplier)); // Minimum 0.7
  const awayXG = Math.max(0.7, Math.min(2.5, awayActual * xgMultiplier)); // Minimum 0.7
  
  // Performance analizi - gerçek vs xG karşılaştırması
  const homeDiff = homeActual - homeXG;
  const awayDiff = awayActual - awayXG;
  
  // Eğer actual > xG ise overperforming (şanslı goller), actual < xG ise underperforming
  const homePerformance: XGAnalysis['homePerformance'] = 
    homeDiff > 0.15 ? 'overperforming' : homeDiff < -0.15 ? 'underperforming' : 'normal';
  const awayPerformance: XGAnalysis['awayPerformance'] = 
    awayDiff > 0.15 ? 'overperforming' : awayDiff < -0.15 ? 'underperforming' : 'normal';
  
  // Regression risk mesajı
  const regressionTexts = {
    tr: {
      homeOver: 'Ev sahibi xG üstünde performans gösteriyor, regresyon riski var',
      awayOver: 'Deplasman xG üstünde performans gösteriyor, regresyon riski var',
      homeUnder: 'Ev sahibi xG altında, pozitif regresyon bekleniyor',
      awayUnder: 'Deplasman xG altında, pozitif regresyon bekleniyor',
      normal: 'xG performansları normal seviyelerde'
    },
    en: {
      homeOver: 'Home overperforming xG, regression risk exists',
      awayOver: 'Away overperforming xG, regression risk exists',
      homeUnder: 'Home underperforming xG, positive regression expected',
      awayUnder: 'Away underperforming xG, positive regression expected',
      normal: 'xG performances at normal levels'
    },
    de: {
      homeOver: 'Heim übertrifft xG, Regressionsrisiko vorhanden',
      awayOver: 'Auswärts übertrifft xG, Regressionsrisiko vorhanden',
      homeUnder: 'Heim unter xG, positive Regression erwartet',
      awayUnder: 'Auswärts unter xG, positive Regression erwartet',
      normal: 'xG-Leistungen auf normalem Niveau'
    }
  };
  
  let regressionRisk = regressionTexts[language].normal;
  if (homePerformance === 'overperforming') regressionRisk = regressionTexts[language].homeOver;
  else if (awayPerformance === 'overperforming') regressionRisk = regressionTexts[language].awayOver;
  else if (homePerformance === 'underperforming') regressionRisk = regressionTexts[language].homeUnder;
  else if (awayPerformance === 'underperforming') regressionRisk = regressionTexts[language].awayUnder;
  
  return {
    homeXG: parseFloat(homeXG.toFixed(2)),
    awayXG: parseFloat(awayXG.toFixed(2)),
    homeActual: parseFloat(homeActual.toFixed(2)),
    awayActual: parseFloat(awayActual.toFixed(2)),
    homePerformance,
    awayPerformance,
    regressionRisk,
    totalXG: parseFloat((homeXG + awayXG).toFixed(2))
  };
}

// ==================== TIMING PATTERNS ====================

interface TimingPatterns {
  homeFirstHalfGoals: number;
  homeSecondHalfGoals: number;
  awayFirstHalfGoals: number;
  awaySecondHalfGoals: number;
  lateGoalsHome: number;
  lateGoalsAway: number;
  htftPattern: string;
  firstHalfOver: number;
  secondHalfOver: number;
}

function analyzeTimingPatterns(matchData: MatchData, language: 'tr' | 'en' | 'de'): TimingPatterns {
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const homeForm = matchData.homeForm;
  const awayForm = matchData.awayForm;
  
  // Son maçlardan timing pattern hesapla
  const homeMatches = homeForm?.matches || [];
  const awayMatches = awayForm?.matches || [];
  
  // Varsayılan olarak %45 ilk yarı - futbol istatistiklerine göre ortalama
  let homeFirstHalfGoals = 45;
  let awayFirstHalfGoals = 43;
  
  // Eğer veri varsa kullan
  if (detailedHome?.firstHalfGoalsPct) {
    homeFirstHalfGoals = parseFloat(detailedHome.firstHalfGoalsPct);
  }
  if (detailedAway?.firstHalfGoalsPct) {
    awayFirstHalfGoals = parseFloat(detailedAway.firstHalfGoalsPct);
  }
  
  // %30-70 arasında sınırla (mantıklı değerler)
  homeFirstHalfGoals = Math.max(30, Math.min(70, homeFirstHalfGoals));
  awayFirstHalfGoals = Math.max(30, Math.min(70, awayFirstHalfGoals));
  
  const homeSecondHalfGoals = 100 - homeFirstHalfGoals;
  const awaySecondHalfGoals = 100 - awayFirstHalfGoals;
  
  // Son 15 dakika golleri
  const lateGoalsHome = parseFloat(detailedHome?.lateGoalsPct || '20');
  const lateGoalsAway = parseFloat(detailedAway?.lateGoalsPct || '25');
  
  // HT/FT pattern analizi
  const patternTexts = {
    tr: {
      homeSlowStart: 'Ev sahibi ilk yarı yavaş başlıyor, ikinci yarı açılıyor',
      awaySlowStart: 'Deplasman ilk yarı yavaş, ikinci yarıda tehlikeli',
      bothSlow: 'Her iki takım da ilk yarıda yavaş, ikinci yarı hareketli',
      fastStart: 'Erken goller bekleniyor, ilk yarı hareketli olacak',
      lateAction: 'Geç goller ihtimali yüksek, son dakikalar kritik'
    },
    en: {
      homeSlowStart: 'Home starts slow, opens up in 2nd half',
      awaySlowStart: 'Away slow in 1st half, dangerous in 2nd',
      bothSlow: 'Both teams slow in 1st half, action in 2nd',
      fastStart: 'Early goals expected, lively 1st half',
      lateAction: 'Late goals likely, final minutes critical'
    },
    de: {
      homeSlowStart: 'Heim startet langsam, öffnet sich in 2. Hälfte',
      awaySlowStart: 'Auswärts langsam in 1. Hälfte, gefährlich in 2.',
      bothSlow: 'Beide Teams langsam in 1. Hälfte, Action in 2.',
      fastStart: 'Frühe Tore erwartet, lebhafte 1. Hälfte',
      lateAction: 'Späte Tore wahrscheinlich, letzte Minuten kritisch'
    }
  };
  
  let htftPattern = patternTexts[language].bothSlow;
  if (homeFirstHalfGoals < 40 && homeSecondHalfGoals > 55) {
    htftPattern = patternTexts[language].homeSlowStart;
  } else if (awayFirstHalfGoals < 40 && awaySecondHalfGoals > 55) {
    htftPattern = patternTexts[language].awaySlowStart;
  } else if (homeFirstHalfGoals > 55 || awayFirstHalfGoals > 55) {
    htftPattern = patternTexts[language].fastStart;
  } else if (lateGoalsHome > 30 || lateGoalsAway > 30) {
    htftPattern = patternTexts[language].lateAction;
  }
  
  // İlk yarı ve ikinci yarı Over yüzdeleri
  const firstHalfOver = Math.round((homeFirstHalfGoals + awayFirstHalfGoals) / 2);
  const secondHalfOver = Math.round((homeSecondHalfGoals + awaySecondHalfGoals) / 2);
  
  return {
    homeFirstHalfGoals: Math.round(homeFirstHalfGoals),
    homeSecondHalfGoals: Math.round(homeSecondHalfGoals),
    awayFirstHalfGoals: Math.round(awayFirstHalfGoals),
    awaySecondHalfGoals: Math.round(awaySecondHalfGoals),
    lateGoalsHome: Math.round(lateGoalsHome),
    lateGoalsAway: Math.round(lateGoalsAway),
    htftPattern,
    firstHalfOver,
    secondHalfOver
  };
}

// ==================== CLEAN SHEET ANALYSIS ====================

interface CleanSheetAnalysis {
  homeCleanSheetStreak: number;
  awayCleanSheetStreak: number;
  homeCleanSheetPct: number;
  awayCleanSheetPct: number;
  homeFailedToScore: number;
  awayFailedToScore: number;
  defensiveRating: string;
}

function analyzeCleanSheets(matchData: MatchData, language: 'tr' | 'en' | 'de'): CleanSheetAnalysis {
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const homeForm = matchData.homeForm;
  const awayForm = matchData.awayForm;
  
  // Clean sheet serileri ve yüzdeleri
  const homeCleanSheetPct = parseFloat(detailedHome?.cleanSheetPercentage || homeForm?.cleanSheetPercentage || '20');
  const awayCleanSheetPct = parseFloat(detailedAway?.cleanSheetPercentage || awayForm?.cleanSheetPercentage || '15');
  
  // Clean sheet streak hesapla (form string'inden)
  const homeFormStr = homeForm?.form || 'DDDDD';
  const awayFormStr = awayForm?.form || 'DDDDD';
  
  let homeCleanSheetStreak = 0;
  let awayCleanSheetStreak = 0;
  
  // Matches array'inden clean sheet streak hesapla
  const homeMatches = homeForm?.matches || [];
  const awayMatches = awayForm?.matches || [];
  
  // Ev sahibi için: son maçlardan geriye doğru, gol yemediği maçları say
  for (const match of homeMatches) {
    let goalsConceded = 0;
    const matchAny = match as any;
    
    if (matchAny.scores) {
      // Sportmonks format
      const teamScore = matchAny.scores.find((s: any) => 
        s.score?.participant === 'home' || s.score?.participant_id === matchAny.participants?.find((p: any) => p.meta?.location === 'home')?.id
      );
      const opponentScore = matchAny.scores.find((s: any) => 
        s.score?.participant === 'away' || s.score?.participant_id === matchAny.participants?.find((p: any) => p.meta?.location === 'away')?.id
      );
      goalsConceded = opponentScore?.score?.goals || 0;
    } else if (match.score) {
      // String format
      const [home, away] = (match.score || '0-0').split('-').map((s: string) => parseInt(s) || 0);
      goalsConceded = away; // Ev sahibi için deplasman takımının golleri = yediği goller
    }
    
    if (goalsConceded === 0) {
      homeCleanSheetStreak++;
    } else {
      break;
  }
  }
  
  // Deplasman için: son maçlardan geriye doğru, gol yemediği maçları say
  for (const match of awayMatches) {
    let goalsConceded = 0;
    const matchAny = match as any;
    
    if (matchAny.scores) {
      // Sportmonks format
      const teamScore = matchAny.scores.find((s: any) => 
        s.score?.participant === 'away' || s.score?.participant_id === matchAny.participants?.find((p: any) => p.meta?.location === 'away')?.id
      );
      const opponentScore = matchAny.scores.find((s: any) => 
        s.score?.participant === 'home' || s.score?.participant_id === matchAny.participants?.find((p: any) => p.meta?.location === 'home')?.id
      );
      goalsConceded = opponentScore?.score?.goals || 0;
    } else if (match.score) {
      // String format
      const [home, away] = (match.score || '0-0').split('-').map((s: string) => parseInt(s) || 0);
      goalsConceded = home; // Deplasman için ev sahibi takımının golleri = yediği goller
    }
    
    if (goalsConceded === 0) {
      awayCleanSheetStreak++;
    } else {
      break;
    }
  }
  
  // Failed to score
  let homeFailedToScore = 0;
  let awayFailedToScore = 0;
  
  for (const match of homeMatches.slice(0, 5)) {
    const score = match.score || '0-0';
    const goalsScored = parseInt(score.split('-')[0]) || 0;
    if (goalsScored === 0) homeFailedToScore++;
  }
  
  for (const match of awayMatches.slice(0, 5)) {
    const score = match.score || '0-0';
    const goalsScored = parseInt(score.split('-')[0]) || 0;
    if (goalsScored === 0) awayFailedToScore++;
  }
  
  // Defensive rating mesajı
  const ratingTexts = {
    tr: {
      strong: (team: string, streak: number) => `${team} defansı güçlü, son ${streak} maçta gol yemedi`,
      weak: (team: string) => `${team} defansı zayıf, her maç gol yiyor`,
      balanced: 'Her iki takım da gol yeme konusunda dengeli'
    },
    en: {
      strong: (team: string, streak: number) => `${team} defense strong, ${streak} clean sheets in a row`,
      weak: (team: string) => `${team} defense weak, conceding every game`,
      balanced: 'Both teams balanced in conceding'
    },
    de: {
      strong: (team: string, streak: number) => `${team} Abwehr stark, ${streak} Spiele ohne Gegentor`,
      weak: (team: string) => `${team} Abwehr schwach, kassiert jedes Spiel`,
      balanced: 'Beide Teams ausgeglichen beim Kassieren'
    }
  };
  
  let defensiveRating = ratingTexts[language].balanced;
  if (homeCleanSheetStreak >= 2) {
    defensiveRating = ratingTexts[language].strong(matchData.homeTeam, homeCleanSheetStreak);
  } else if (awayCleanSheetStreak >= 2) {
    defensiveRating = ratingTexts[language].strong(matchData.awayTeam, awayCleanSheetStreak);
  } else if (homeCleanSheetPct < 10) {
    defensiveRating = ratingTexts[language].weak(matchData.homeTeam);
  } else if (awayCleanSheetPct < 10) {
    defensiveRating = ratingTexts[language].weak(matchData.awayTeam);
  }
  
  return {
    homeCleanSheetStreak,
    awayCleanSheetStreak,
    homeCleanSheetPct: Math.round(homeCleanSheetPct),
    awayCleanSheetPct: Math.round(awayCleanSheetPct),
    homeFailedToScore,
    awayFailedToScore,
    defensiveRating
  };
}

// ==================== AGGRESSIVE CONFIDENCE CALCULATOR ====================

function calculateAggressiveConfidence(
  expectedTotal: number,
  avgOver25: number,
  avgBtts: number,
  formDiff: number,
  dataQuality: number, // 0-100 how much data we have
  xgAnalysis?: XGAnalysis,
  timingPatterns?: TimingPatterns
): { overUnderConf: number; matchResultConf: number; bttsConf: number; firstHalfConf: number } {
  
  // ═══════════════════════════════════════════════════════════════
  // OVER/UNDER CONFIDENCE
  // ═══════════════════════════════════════════════════════════════
  let overUnderConf = 55; // Base confidence
  const overUnderStrength = Math.abs(expectedTotal - 2.5);
  
  // Beklenen gol farkına göre güven hesapla
  if (overUnderStrength > 1.0) {
    overUnderConf = 68 + Math.min(7, overUnderStrength * 3); // Max 75
  } else if (overUnderStrength > 0.5) {
    overUnderConf = 60 + overUnderStrength * 8; // 64-68
  } else if (overUnderStrength > 0.2) {
    overUnderConf = 55 + overUnderStrength * 10; // 57-60
  } else {
    overUnderConf = 52; // Çok yakın, düşük güven
  }
  
  // Over 2.5 yüzdesi ile uyum kontrolü
  if ((expectedTotal > 2.5 && avgOver25 >= 65) || (expectedTotal < 2.5 && avgOver25 <= 35)) {
    overUnderConf += 4; // Veriler uyumlu
  } else if ((expectedTotal > 2.5 && avgOver25 < 45) || (expectedTotal < 2.5 && avgOver25 > 55)) {
    overUnderConf -= 5; // Veriler çelişkili
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MATCH RESULT CONFIDENCE
  // ═══════════════════════════════════════════════════════════════
  let matchResultConf = 52; // Base - maç sonucu tahmin etmek zor
  
  // Form farkına göre güven
  const absFormDiff = Math.abs(formDiff);
  if (absFormDiff >= 9) {
    matchResultConf = 68 + Math.min(5, absFormDiff - 9); // Max 73
  } else if (absFormDiff >= 6) {
    matchResultConf = 62 + (absFormDiff - 6); // 62-65
  } else if (absFormDiff >= 3) {
    matchResultConf = 55 + (absFormDiff - 3) * 2; // 55-61
  } else {
    matchResultConf = 50 + absFormDiff; // 50-53, dengeli maç
  }
  
  // ═══════════════════════════════════════════════════════════════
  // BTTS CONFIDENCE
  // ═══════════════════════════════════════════════════════════════
  let bttsConf = 55;
  const bttsDeviation = Math.abs(avgBtts - 50);
  
  if (bttsDeviation >= 25) {
    bttsConf = 68 + Math.min(5, (bttsDeviation - 25) / 3); // Max 73
  } else if (bttsDeviation >= 15) {
    bttsConf = 62 + (bttsDeviation - 15) / 2; // 62-67
  } else if (bttsDeviation >= 8) {
    bttsConf = 56 + (bttsDeviation - 8); // 56-62
  } else {
    bttsConf = 52; // Belirsiz
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FIRST HALF CONFIDENCE
  // ═══════════════════════════════════════════════════════════════
  let firstHalfConf = 55;
  if (timingPatterns) {
    const avgFirstHalf = (timingPatterns.homeFirstHalfGoals + timingPatterns.awayFirstHalfGoals) / 2;
    if (avgFirstHalf < 38) firstHalfConf = 62; // İlk yarı düşük skorlu
    else if (avgFirstHalf > 52) firstHalfConf = 60; // İlk yarı yüksek skorlu
    else firstHalfConf = 52; // Normal
  }
  
  // Data quality multiplier (veri kalitesi düşükse güveni azalt)
  const qualityMultiplier = 0.90 + (dataQuality / 100) * 0.10;
  
  // MAX CAPS: Gerçekçi üst sınırlar
  return {
    overUnderConf: Math.round(Math.min(75, Math.max(50, overUnderConf * qualityMultiplier))),
    matchResultConf: Math.round(Math.min(73, Math.max(50, matchResultConf * qualityMultiplier))),
    bttsConf: Math.round(Math.min(73, Math.max(50, bttsConf * qualityMultiplier))),
    firstHalfConf: Math.round(Math.min(65, Math.max(50, firstHalfConf * qualityMultiplier))),
  };
}

// ==================== GENERATE REASONING ====================

function generateStatsReasoning(
  matchData: MatchData,
  homeGoalsScored: number,
  homeGoalsConceded: number,
  awayGoalsScored: number,
  awayGoalsConceded: number,
  homeExpected: number,
  awayExpected: number,
  expectedTotal: number,
  avgOver25: number,
  avgBtts: number,
  homeForm: string,
  awayForm: string,
  homePoints: number,
  awayPoints: number,
  language: 'tr' | 'en' | 'de',
  formDiff?: number // Form farkı (matchResultReasoning için)
): { overUnderReasoning: string; matchResultReasoning: string; bttsReasoning: string; agentSummary: string } {
  
  const homeWins = (homeForm.match(/W/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  const homeLosses = (homeForm.match(/L/g) || []).length;
  const awayLosses = (awayForm.match(/L/g) || []).length;
  
  if (language === 'tr') {
    const overUnderReasoning = expectedTotal >= 2.5
      ? `📊 Ev sahibi EVDE maç başı ${homeGoalsScored.toFixed(1)} gol atıyor, deplasman DEPLASMANDA ${awayGoalsConceded.toFixed(1)} gol yiyor. Toplam beklenti: ${expectedTotal.toFixed(2)} gol. Son maçlarda Over 2.5 oranı %${avgOver25}. Güçlü Over sinyali.`
      : `📊 Ev sahibi EVDE ${homeGoalsScored.toFixed(1)} gol/maç, deplasman DEPLASMANDA ${awayGoalsScored.toFixed(1)} gol/maç. Toplam beklenti: ${expectedTotal.toFixed(2)} gol. Under 2.5 oranı %${100 - avgOver25}. Düşük skorlu maç bekleniyor.`;
    
    // matchResultReasoning - formDiff ve dataDrivenMR mantığını kullan
    let matchResultReasoning: string;
    if (formDiff !== undefined) {
      const absFormDiff = Math.abs(formDiff);
      let predictedMR: string;
      
      if (formDiff > 6) {
        predictedMR = '1';
      } else if (formDiff < -6) {
        predictedMR = '2';
      } else if (absFormDiff >= 3) {
        if (formDiff > 0 && homeExpected >= awayExpected) {
          predictedMR = '1';
        } else if (formDiff < 0 && awayExpected >= homeExpected) {
          predictedMR = '2';
        } else {
          predictedMR = absFormDiff >= 4 ? (formDiff > 0 ? '1' : '2') : 'X';
        }
      } else {
        if (homeExpected > awayExpected + 0.5) {
          predictedMR = '1';
        } else if (awayExpected > homeExpected + 0.5) {
          predictedMR = '2';
        } else {
          predictedMR = 'X';
        }
      }
      
      if (predictedMR === '1') {
        matchResultReasoning = `🏠 Ev sahibi form: ${homeForm} (${homePoints} puan, ${homeWins}G-${5-homeWins-homeLosses}B-${homeLosses}M). Deplasman: ${awayForm} (${awayPoints} puan). ${formDiff > 0 ? formDiff : Math.abs(formDiff)} puan farkı + ev avantajı → MS 1`;
      } else if (predictedMR === '2') {
        matchResultReasoning = `🚌 Deplasman form: ${awayForm} (${awayPoints} puan, ${awayWins}G). Ev sahibi: ${homeForm} (${homePoints} puan). Deplasman ${formDiff < 0 ? Math.abs(formDiff) : formDiff} puan önde → MS 2`;
      } else {
        matchResultReasoning = `⚖️ Ev: ${homeForm} (${homePoints}p) vs Dep: ${awayForm} (${awayPoints}p). Formlar dengeli, ev avantajı hafif üstünlük → MS 1X`;
      }
    } else {
      // Fallback - eski mantık
      matchResultReasoning = homePoints > awayPoints
      ? `🏠 Ev sahibi form: ${homeForm} (${homePoints} puan, ${homeWins}G-${5-homeWins-homeLosses}B-${homeLosses}M). Deplasman: ${awayForm} (${awayPoints} puan). ${homePoints - awayPoints} puan farkı + ev avantajı → MS 1`
      : awayPoints > homePoints
      ? `🚌 Deplasman form: ${awayForm} (${awayPoints} puan, ${awayWins}G). Ev sahibi: ${homeForm} (${homePoints} puan). Deplasman ${awayPoints - homePoints} puan önde → MS 2`
      : `⚖️ Ev: ${homeForm} (${homePoints}p) vs Dep: ${awayForm} (${awayPoints}p). Formlar dengeli, ev avantajı hafif üstünlük → MS 1X`;
    }
    
    const bttsReasoning = avgBtts >= 55
      ? `⚽ Ev sahibi %${Math.round(100 - (homeLosses/5)*100)} maçta gol attı. Deplasman %${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)} maçta gol buldu. Birleşik KG Var oranı %${avgBtts}. Her iki takım da gol atar.`
      : `🛡️ Ev sahibi EVDE ${homeGoalsConceded.toFixed(1)} gol/maç yiyor, deplasman DEPLASMANDA ${awayGoalsScored.toFixed(1)} gol/maç atıyor. KG Var oranı %${avgBtts} düşük. Tek taraflı skor olasılığı yüksek.`;
    
    const agentSummary = `📊 STATS: Form analizi ${homePoints > awayPoints ? 'ev sahibi' : awayPoints > homePoints ? 'deplasman' : 'dengeli'}. Gol beklentisi ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Over' : 'Under'}). KG ${avgBtts >= 55 ? 'Var' : 'Yok'} eğilimli.`;
    
    return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
  }
  
  // German
  if (language === 'de') {
    const overUnderReasoning = expectedTotal >= 2.5
      ? `📊 Heimteam ZU HAUSE erzielt ${homeGoalsScored.toFixed(1)} Tore/Spiel, Auswärts AUSWÄRTS kassiert ${awayGoalsConceded.toFixed(1)}. Erwartete Summe: ${expectedTotal.toFixed(2)} Tore. Über 2.5 Rate: ${avgOver25}%. Starkes Over-Signal.`
      : `📊 Heimteam ZU HAUSE ${homeGoalsScored.toFixed(1)} Tore/Spiel, Auswärts AUSWÄRTS ${awayGoalsScored.toFixed(1)} Tore/Spiel. Erwartung: ${expectedTotal.toFixed(2)} Tore. Unter 2.5 Rate: ${100 - avgOver25}%. Torarmes Spiel erwartet.`;
    
    // matchResultReasoning - formDiff ve dataDrivenMR mantığını kullan (Almanca)
    let matchResultReasoning: string;
    if (formDiff !== undefined) {
      const absFormDiff = Math.abs(formDiff);
      let predictedMR: string;
      
      if (formDiff > 6) {
        predictedMR = '1';
      } else if (formDiff < -6) {
        predictedMR = '2';
      } else if (absFormDiff >= 3) {
        if (formDiff > 0 && homeExpected >= awayExpected) {
          predictedMR = '1';
        } else if (formDiff < 0 && awayExpected >= homeExpected) {
          predictedMR = '2';
        } else {
          predictedMR = absFormDiff >= 4 ? (formDiff > 0 ? '1' : '2') : 'X';
        }
      } else {
        if (homeExpected > awayExpected + 0.5) {
          predictedMR = '1';
        } else if (awayExpected > homeExpected + 0.5) {
          predictedMR = '2';
        } else {
          predictedMR = 'X';
        }
      }
      
      if (predictedMR === '1') {
        matchResultReasoning = `🏠 Heimform: ${homeForm} (${homePoints} Pkt, ${homeWins}S-${5-homeWins-homeLosses}U-${homeLosses}N). Auswärts: ${awayForm} (${awayPoints} Pkt). ${formDiff > 0 ? formDiff : Math.abs(formDiff)} Pkt Vorsprung + Heimvorteil → Heimsieg`;
      } else if (predictedMR === '2') {
        matchResultReasoning = `🚌 Auswärtsform: ${awayForm} (${awayPoints} Pkt, ${awayWins}S). Heim: ${homeForm} (${homePoints} Pkt). Auswärts ${formDiff < 0 ? Math.abs(formDiff) : formDiff} Pkt vorne → Auswärtssieg`;
      } else {
        matchResultReasoning = `⚖️ Heim: ${homeForm} (${homePoints}P) vs Ausw: ${awayForm} (${awayPoints}P). Ausgeglichene Form, leichter Heimvorteil → Heim oder Unentschieden`;
      }
    } else {
      matchResultReasoning = homePoints > awayPoints
      ? `🏠 Heimform: ${homeForm} (${homePoints} Pkt, ${homeWins}S-${5-homeWins-homeLosses}U-${homeLosses}N). Auswärts: ${awayForm} (${awayPoints} Pkt). ${homePoints - awayPoints} Pkt Vorsprung + Heimvorteil → Heimsieg`
      : awayPoints > homePoints
      ? `🚌 Auswärtsform: ${awayForm} (${awayPoints} Pkt, ${awayWins}S). Heim: ${homeForm} (${homePoints} Pkt). Auswärts ${awayPoints - homePoints} Pkt vorne → Auswärtssieg`
      : `⚖️ Heim: ${homeForm} (${homePoints}P) vs Ausw: ${awayForm} (${awayPoints}P). Ausgeglichene Form, leichter Heimvorteil → Heim oder Unentschieden`;
    }
    
    const bttsReasoning = avgBtts >= 55
      ? `⚽ Heimteam traf in ${Math.round(100 - (homeLosses/5)*100)}% der Spiele. Auswärts traf in ${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)}%. Kombinierte BTTS-Rate: ${avgBtts}%. Beide Teams treffen wahrscheinlich.`
      : `🛡️ Heimteam ZU HAUSE kassiert ${homeGoalsConceded.toFixed(1)} Tore/Spiel, Auswärts AUSWÄRTS erzielt ${awayGoalsScored.toFixed(1)}. BTTS-Rate ${avgBtts}% ist niedrig. Einseitiges Ergebnis wahrscheinlich.`;
    
    const agentSummary = `📊 STATS: Form favorisiert ${homePoints > awayPoints ? 'Heim' : awayPoints > homePoints ? 'Auswärts' : 'keinen'}. Torerwartung ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Über' : 'Unter'}). BTTS ${avgBtts >= 55 ? 'Ja' : 'Nein'} Trend.`;
    
    return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
  }
  
  // English (default)
  const overUnderReasoning = expectedTotal >= 2.5
    ? `📊 Home AT HOME scores ${homeGoalsScored.toFixed(1)} goals/game, away AWAY concedes ${awayGoalsConceded.toFixed(1)}. Expected total: ${expectedTotal.toFixed(2)} goals. Over 2.5 rate: ${avgOver25}%. Strong Over signal.`
    : `📊 Home AT HOME ${homeGoalsScored.toFixed(1)} goals/game, away AWAY ${awayGoalsScored.toFixed(1)} goals/game. Expected: ${expectedTotal.toFixed(2)} goals. Under 2.5 rate: ${100 - avgOver25}%. Low-scoring match expected.`;
  
  // matchResultReasoning - formDiff ve dataDrivenMR mantığını kullan (İngilizce)
  let matchResultReasoning: string;
  if (formDiff !== undefined) {
    const absFormDiff = Math.abs(formDiff);
    let predictedMR: string;
    
    if (formDiff > 6) {
      predictedMR = '1';
    } else if (formDiff < -6) {
      predictedMR = '2';
    } else if (absFormDiff >= 3) {
      if (formDiff > 0 && homeExpected >= awayExpected) {
        predictedMR = '1';
      } else if (formDiff < 0 && awayExpected >= homeExpected) {
        predictedMR = '2';
      } else {
        predictedMR = absFormDiff >= 4 ? (formDiff > 0 ? '1' : '2') : 'X';
      }
    } else {
      if (homeExpected > awayExpected + 0.5) {
        predictedMR = '1';
      } else if (awayExpected > homeExpected + 0.5) {
        predictedMR = '2';
      } else {
        predictedMR = 'X';
      }
    }
    
    if (predictedMR === '1') {
      matchResultReasoning = `🏠 Home form: ${homeForm} (${homePoints} pts, ${homeWins}W-${5-homeWins-homeLosses}D-${homeLosses}L). Away: ${awayForm} (${awayPoints} pts). ${formDiff > 0 ? formDiff : Math.abs(formDiff)} pts gap + home advantage → Home win`;
    } else if (predictedMR === '2') {
      matchResultReasoning = `🚌 Away form: ${awayForm} (${awayPoints} pts, ${awayWins}W). Home: ${homeForm} (${homePoints} pts). Away ${formDiff < 0 ? Math.abs(formDiff) : formDiff} pts ahead → Away win`;
    } else {
      matchResultReasoning = `⚖️ Home: ${homeForm} (${homePoints}p) vs Away: ${awayForm} (${awayPoints}p). Balanced forms, slight home edge → Home or Draw`;
    }
  } else {
    matchResultReasoning = homePoints > awayPoints
    ? `🏠 Home form: ${homeForm} (${homePoints} pts, ${homeWins}W-${5-homeWins-homeLosses}D-${homeLosses}L). Away: ${awayForm} (${awayPoints} pts). ${homePoints - awayPoints} pts gap + home advantage → Home win`
    : awayPoints > homePoints
    ? `🚌 Away form: ${awayForm} (${awayPoints} pts, ${awayWins}W). Home: ${homeForm} (${homePoints} pts). Away ${awayPoints - homePoints} pts ahead → Away win`
    : `⚖️ Home: ${homeForm} (${homePoints}p) vs Away: ${awayForm} (${awayPoints}p). Balanced forms, slight home edge → Home or Draw`;
  }
  
  const bttsReasoning = avgBtts >= 55
    ? `⚽ Home scored in ${Math.round(100 - (homeLosses/5)*100)}% of matches. Away scored in ${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)}%. Combined BTTS rate: ${avgBtts}%. Both teams likely to score.`
    : `🛡️ Home AT HOME concedes ${homeGoalsConceded.toFixed(1)} goals/game, away AWAY scores ${awayGoalsScored.toFixed(1)}. BTTS rate ${avgBtts}% is low. One-sided score likely.`;
  
  const agentSummary = `📊 STATS: Form favors ${homePoints > awayPoints ? 'home' : awayPoints > homePoints ? 'away' : 'neither'}. Goal expectancy ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Over' : 'Under'}). BTTS ${avgBtts >= 55 ? 'Yes' : 'No'} trend.`;
  
  return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
}

// ==================== STATS AGENT ====================

export async function runStatsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  console.log('📊 Stats Agent starting DEEP analysis with xG, timing patterns, clean sheets...');
  
  // 🆕 PROBABILITY ENGINE - Matematiksel modelleri çalıştır
  let probabilityResult: ProbabilityResult | null = null;
  let probabilityContext: string = '';
  try {
    probabilityResult = calculateComprehensiveProbabilities(matchData);
    probabilityContext = generateProbabilityContext(matchData);
    console.log('   🎯 Probability Engine Results:');
    console.log(`      Poisson: Home ${probabilityResult.poissonModel.homeWin}% | Draw ${probabilityResult.poissonModel.draw}% | Away ${probabilityResult.poissonModel.awayWin}%`);
    console.log(`      Monte Carlo: Home ${probabilityResult.monteCarloModel.homeWinPct}% | Draw ${probabilityResult.monteCarloModel.drawPct}% | Away ${probabilityResult.monteCarloModel.awayWinPct}%`);
    console.log(`      Final: ${probabilityResult.matchResult.prediction} (${probabilityResult.matchResult.confidence}%) | ${probabilityResult.overUnder.prediction} (${probabilityResult.overUnder.confidence}%)`);
    console.log(`      Motivation: Home ${probabilityResult.motivationAnalysis.home.score}/100 vs Away ${probabilityResult.motivationAnalysis.away.score}/100`);
  } catch (e) {
    console.log('   ⚠️ Probability Engine failed, using fallback calculations');
  }
  
  // 🆕 LİG PROFİLİ - Lig karakteristiklerini al
  const leagueProfile = getLeagueProfile(matchData.league || '');
  if (leagueProfile) {
    console.log(`   🏆 League Profile Loaded: ${leagueProfile.name}`);
    console.log(`   📊 League Avg Goals: ${leagueProfile.avgGoalsPerMatch} | Over 2.5: ${leagueProfile.over25Percentage}% | Home Win: ${leagueProfile.homeWinPercentage}%`);
    console.log(`   📊 League Bias: Over/Under: ${leagueProfile.overUnderBias > 0 ? '+' : ''}${leagueProfile.overUnderBias} | Home: ${leagueProfile.homeAwayBias > 0 ? '+' : ''}${leagueProfile.homeAwayBias}`);
  }
  
  // Detaylı verileri al (varsa)
  const detailedHome = (matchData as any).detailedStats?.home;
  const detailedAway = (matchData as any).detailedStats?.away;
  const detailedH2H = (matchData as any).detailedStats?.h2h;
  const injuries = (matchData as any).detailedStats?.injuries;

  // Gol ortalamaları (VENUE BAZLI - ÖNEMLİ!)
  // Ev sahibi için EVDEKİ gol ortalaması, deplasman için DEPLASMANDAKİ gol ortalaması
  // Gol atma ortalamaları (VENUE BAZLI - ÖNEMLİ!)
  // Helper function: String veya number'ı parse et, NaN kontrolü yap
  const safeParseFloat = (value: any, fallback: number): number => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number' && !isNaN(value) && value > 0) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };
  
  // YENİ Öncelik sırası: detailedStats VENUE > matchData VENUE > detailedStats GENERAL > matchData GENERAL > fallback
  // detailedStats venue-spesifik verileri içerir (en doğru)
  // matchData.homeForm/awayForm genel ortalamaları içerir
  const homeFormAny = matchData.homeForm as any;
  const awayFormAny = matchData.awayForm as any;
  
  // EV SAHİBİ - Ev'deki gol ortalaması (VENUE BAZLI)
  const homeGoalsScoredRaw = 
    detailedHome?.homeAvgGoalsScored ||   // 1. Detaylı ev istatistiği (en doğru)
    homeFormAny?.venueAvgScored ||        // 2. Venue bazlı (varsa)
    detailedHome?.avgGoalsScored ||       // 3. Detaylı genel ortalama
    homeFormAny?.avgGoalsScored ||        // 4. TeamStats format
    homeFormAny?.avgGoals;                // 5. FormData format
  const homeGoalsScored = safeParseFloat(homeGoalsScoredRaw, 1.2);
  
  const homeGoalsConcededRaw = 
    detailedHome?.homeAvgGoalsConceded || // 1. Detaylı ev istatistiği (en doğru)
    homeFormAny?.venueAvgConceded ||      // 2. Venue bazlı (varsa)
    detailedHome?.avgGoalsConceded ||     // 3. Detaylı genel ortalama
    homeFormAny?.avgGoalsConceded ||      // 4. TeamStats format
    homeFormAny?.avgConceded;             // 5. FormData format
  const homeGoalsConceded = safeParseFloat(homeGoalsConcededRaw, 1.0);
  
  // DEPLASMAN - Deplasman'daki gol ortalaması (VENUE BAZLI)
  const awayGoalsScoredRaw = 
    detailedAway?.awayAvgGoalsScored ||   // 1. Detaylı deplasman istatistiği (en doğru)
    awayFormAny?.venueAvgScored ||        // 2. Venue bazlı (varsa)
    detailedAway?.avgGoalsScored ||       // 3. Detaylı genel ortalama
    awayFormAny?.avgGoalsScored ||        // 4. TeamStats format
    awayFormAny?.avgGoals;                // 5. FormData format
  const awayGoalsScored = safeParseFloat(awayGoalsScoredRaw, 1.0);
  
  const awayGoalsConcededRaw = 
    detailedAway?.awayAvgGoalsConceded || // 1. Detaylı deplasman istatistiği (en doğru)
    awayFormAny?.venueAvgConceded ||      // 2. Venue bazlı (varsa)
    detailedAway?.avgGoalsConceded ||     // 3. Detaylı genel ortalama
    awayFormAny?.avgGoalsConceded ||      // 4. TeamStats format
    awayFormAny?.avgConceded;             // 5. FormData format
  const awayGoalsConceded = safeParseFloat(awayGoalsConcededRaw, 1.2);
  
  // Debug logging - detailedStats ve matchData formatları için
  console.log(`   🔍 Expected Goals Debug (detailedStats öncelikli):`);
  console.log(`      homeGoalsScored: ${homeGoalsScored} (detailedHome.homeAvgGoalsScored: ${detailedHome?.homeAvgGoalsScored}, venueAvgScored: ${homeFormAny?.venueAvgScored}, avgGoals: ${homeFormAny?.avgGoals})`);
  console.log(`      awayGoalsConceded: ${awayGoalsConceded} (detailedAway.awayAvgGoalsConceded: ${detailedAway?.awayAvgGoalsConceded}, venueAvgConceded: ${awayFormAny?.venueAvgConceded}, avgConceded: ${awayFormAny?.avgConceded})`);
  console.log(`      awayGoalsScored: ${awayGoalsScored} (detailedAway.awayAvgGoalsScored: ${detailedAway?.awayAvgGoalsScored}, venueAvgScored: ${awayFormAny?.venueAvgScored}, avgGoals: ${awayFormAny?.avgGoals})`);
  console.log(`      homeGoalsConceded: ${homeGoalsConceded} (detailedHome.homeAvgGoalsConceded: ${detailedHome?.homeAvgGoalsConceded}, venueAvgConceded: ${homeFormAny?.venueAvgConceded}, avgConceded: ${homeFormAny?.avgConceded})`);
  
  // 🆕 xG Analysis - önce bunu hesapla ki gerçek değerleri kullanabilelim
  const xgAnalysis = calculateXGAnalysis(matchData, language);
  console.log(`   📈 xG Analysis: Home ${xgAnalysis.homeXG} vs Away ${xgAnalysis.awayXG} (Total: ${xgAnalysis.totalXG})`);
  console.log(`   📈 Performance: Home ${xgAnalysis.homePerformance}, Away ${xgAnalysis.awayPerformance}`);
  console.log(`   📈 Actual Goals: Home ${xgAnalysis.homeActual} vs Away ${xgAnalysis.awayActual}`);
  
  // 🆕 xG Analysis'ten gelen gerçek değerleri kullan (daha doğru!)
  const homeGoalsScoredFinal = xgAnalysis.homeActual > 0 ? xgAnalysis.homeActual : homeGoalsScored;
  const awayGoalsScoredFinal = xgAnalysis.awayActual > 0 ? xgAnalysis.awayActual : awayGoalsScored;
  
  // Beklenen goller (gol atma beklentisi)
  const homeExpected = (homeGoalsScoredFinal + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScoredFinal + homeGoalsConceded) / 2;
  const expectedTotal = homeExpected + awayExpected;
  
  console.log(`      homeExpected: ${homeExpected.toFixed(2)} = (${homeGoalsScoredFinal} [from xG: ${xgAnalysis.homeActual}] + ${awayGoalsConceded}) / 2`);
  console.log(`      awayExpected: ${awayExpected.toFixed(2)} = (${awayGoalsScoredFinal} [from xG: ${xgAnalysis.awayActual}] + ${homeGoalsConceded}) / 2`);
  
  // 🆕 Gol yeme beklentisi
  const homeConcededExpected = (homeGoalsConceded + awayGoalsScored) / 2;
  const awayConcededExpected = (awayGoalsConceded + homeGoalsScored) / 2;
  
  // Form verileri
  const homeForm = detailedHome?.form || matchData.homeForm?.form || 'DDDDD';
  const awayForm = detailedAway?.form || matchData.awayForm?.form || 'DDDDD';
  const homePoints = detailedHome?.points || matchData.homeForm?.points || 5;
  const awayPoints = detailedAway?.points || matchData.awayForm?.points || 5;
  
  // Over 2.5 yüzdeleri
  const homeOver25 = parseFloat(detailedHome?.over25Percentage || matchData.homeForm?.over25Percentage || '50');
  const awayOver25 = parseFloat(detailedAway?.over25Percentage || matchData.awayForm?.over25Percentage || '50');
  const h2hOver25 = parseFloat(detailedH2H?.over25Percentage || matchData.h2h?.over25Percentage || '50');
  const avgOver25 = Math.round((homeOver25 + awayOver25 + h2hOver25) / 3);
  
  // BTTS yüzdeleri
  const homeBtts = parseFloat(detailedHome?.bttsPercentage || matchData.homeForm?.bttsPercentage || '50');
  const awayBtts = parseFloat(detailedAway?.bttsPercentage || matchData.awayForm?.bttsPercentage || '50');
  const h2hBtts = parseFloat(detailedH2H?.bttsPercentage || matchData.h2h?.bttsPercentage || '50');
  const avgBtts = Math.round((homeBtts + awayBtts + h2hBtts) / 3);

  // 🆕 xG Analysis - zaten yukarıda hesaplandı, tekrar hesaplamaya gerek yok
  // const xgAnalysis = calculateXGAnalysis(matchData, language); // YUKARIDA HESAPLANDI
  // homeGoalsScoredFinal ve awayGoalsScoredFinal de yukarıda tanımlandı, tekrar tanımlamaya gerek yok
  
  // 🆕 Timing Patterns
  const timingPatterns = analyzeTimingPatterns(matchData, language);
  console.log(`   ⏱️ Timing: 1H Home ${timingPatterns.homeFirstHalfGoals}% | 2H Home ${timingPatterns.homeSecondHalfGoals}%`);
  console.log(`   ⏱️ Late Goals: Home ${timingPatterns.lateGoalsHome}% | Away ${timingPatterns.lateGoalsAway}%`);
  
  // 🆕 Clean Sheet Analysis
  const cleanSheetAnalysis = analyzeCleanSheets(matchData, language);
  console.log(`   🛡️ Clean Sheets: Home streak ${cleanSheetAnalysis.homeCleanSheetStreak} | Away streak ${cleanSheetAnalysis.awayCleanSheetStreak}`);

  // Data quality (how much real data we have)
  const dataQuality = Math.min(100, 
    ((detailedHome?.matchCount || 0) + (detailedAway?.matchCount || 0) + (detailedH2H?.totalMatches || 0)) * 5
  );

  // Calculate aggressive confidence with new data
  const formDiff = homePoints - awayPoints;
  const confidences = calculateAggressiveConfidence(
    expectedTotal, avgOver25, avgBtts, formDiff, dataQuality,
    xgAnalysis, timingPatterns
  );

  // Generate detailed reasoning
  const reasoning = generateStatsReasoning(
    matchData,
    homeGoalsScored, homeGoalsConceded,
    awayGoalsScored, awayGoalsConceded,
    homeExpected, awayExpected, expectedTotal,
    avgOver25, avgBtts,
    homeForm, awayForm,
    homePoints, awayPoints,
    language,
    formDiff // Form farkı eklendi (matchResultReasoning için)
  );

  // Son maç detayları
  const homeMatchDetails = detailedHome?.matchDetails || [];
  const awayMatchDetails = detailedAway?.matchDetails || [];
  const h2hMatchDetails = detailedH2H?.matchDetails || [];

  // 🆕 İlk yarı tahmini hesapla
  const avgFirstHalfGoals = (timingPatterns.homeFirstHalfGoals + timingPatterns.awayFirstHalfGoals) / 2;
  const firstHalfPrediction = avgFirstHalfGoals < 42 ? 'Under 1.5' : avgFirstHalfGoals > 55 ? 'Over 1.5' : 'Under 1.5';

  // Prompt oluştur
  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}
LEAGUE: ${matchData.league || 'Unknown'}

═══════════════════════════════════════════════════════════════
🏠 HOME: ${matchData.homeTeam}
═══════════════════════════════════════════════════════════════
FORM: ${homeForm} | Record: ${detailedHome?.record || 'N/A'} | Points: ${homePoints}/15
Goals: ${homeGoalsScored.toFixed(2)} scored, ${homeGoalsConceded.toFixed(2)} conceded per game
Over 2.5: ${homeOver25}% | BTTS: ${homeBtts}% | Clean Sheets: ${cleanSheetAnalysis.homeCleanSheetPct}%
Clean Sheet Streak: ${cleanSheetAnalysis.homeCleanSheetStreak} | Failed to Score: ${cleanSheetAnalysis.homeFailedToScore}/5

${homeMatchDetails.length > 0 ? `Last 5: ${homeMatchDetails.map((m: any) => `${m.score}(${m.result})`).join(', ')}` : ''}

═══════════════════════════════════════════════════════════════
🚌 AWAY: ${matchData.awayTeam}
═══════════════════════════════════════════════════════════════
FORM: ${awayForm} | Record: ${detailedAway?.record || 'N/A'} | Points: ${awayPoints}/15
Goals: ${awayGoalsScored.toFixed(2)} scored, ${awayGoalsConceded.toFixed(2)} conceded per game
Over 2.5: ${awayOver25}% | BTTS: ${awayBtts}% | Clean Sheets: ${cleanSheetAnalysis.awayCleanSheetPct}%
Clean Sheet Streak: ${cleanSheetAnalysis.awayCleanSheetStreak} | Failed to Score: ${cleanSheetAnalysis.awayFailedToScore}/5

${awayMatchDetails.length > 0 ? `Last 5: ${awayMatchDetails.map((m: any) => `${m.score}(${m.result})`).join(', ')}` : ''}

═══════════════════════════════════════════════════════════════
🔄 H2H (${detailedH2H?.totalMatches || 0} matches)
═══════════════════════════════════════════════════════════════
${matchData.homeTeam}: ${detailedH2H?.homeWins || 0}W | Draws: ${detailedH2H?.draws || 0} | ${matchData.awayTeam}: ${detailedH2H?.awayWins || 0}W
Avg Goals: ${detailedH2H?.avgTotalGoals || '?'} | Over 2.5: ${h2hOver25}% | BTTS: ${h2hBtts}%

═══════════════════════════════════════════════════════════════
📈 xG ANALYSIS (Expected Goals)
═══════════════════════════════════════════════════════════════
Home xG: ${xgAnalysis.homeXG} | Actual: ${xgAnalysis.homeActual} | Performance: ${xgAnalysis.homePerformance.toUpperCase()}
Away xG: ${xgAnalysis.awayXG} | Actual: ${xgAnalysis.awayActual} | Performance: ${xgAnalysis.awayPerformance.toUpperCase()}
Total xG: ${xgAnalysis.totalXG} | ${xgAnalysis.regressionRisk}

═══════════════════════════════════════════════════════════════
⏱️ TIMING PATTERNS (Goal Distribution)
═══════════════════════════════════════════════════════════════
${matchData.homeTeam}: 1st Half ${timingPatterns.homeFirstHalfGoals}% | 2nd Half ${timingPatterns.homeSecondHalfGoals}% | Late Goals ${timingPatterns.lateGoalsHome}%
${matchData.awayTeam}: 1st Half ${timingPatterns.awayFirstHalfGoals}% | 2nd Half ${timingPatterns.awaySecondHalfGoals}% | Late Goals ${timingPatterns.lateGoalsAway}%
Pattern: ${timingPatterns.htftPattern}

═══════════════════════════════════════════════════════════════
🛡️ DEFENSIVE ANALYSIS (Clean Sheets)
═══════════════════════════════════════════════════════════════
${cleanSheetAnalysis.defensiveRating}
Home CS Streak: ${cleanSheetAnalysis.homeCleanSheetStreak} | Away CS Streak: ${cleanSheetAnalysis.awayCleanSheetStreak}

═══════════════════════════════════════════════════════════════
📊 CALCULATED PREDICTIONS
═══════════════════════════════════════════════════════════════
Expected Goals Scored: ${matchData.homeTeam} ${homeExpected.toFixed(2)} - ${awayExpected.toFixed(2)} ${matchData.awayTeam}
Expected Goals Conceded: ${matchData.homeTeam} ${homeConcededExpected.toFixed(2)} - ${awayConcededExpected.toFixed(2)} ${matchData.awayTeam}
TOTAL EXPECTED: ${expectedTotal.toFixed(2)} goals | xG TOTAL: ${xgAnalysis.totalXG}
Combined Over 2.5: ${avgOver25}% | Combined BTTS: ${avgBtts}%
Form Difference: ${formDiff > 0 ? '+' : ''}${formDiff} points (${formDiff > 3 ? 'HOME favored' : formDiff < -3 ? 'AWAY favored' : 'BALANCED'})
First Half Suggestion: ${firstHalfPrediction} (avg 1H goal % = ${avgFirstHalfGoals.toFixed(0)}%)

CONFIDENCE TARGETS:
- Over/Under: ${confidences.overUnderConf}%
- Match Result: ${confidences.matchResultConf}%
- BTTS: ${confidences.bttsConf}%
- First Half: ${confidences.firstHalfConf}%

${probabilityContext ? `
═══════════════════════════════════════════════════════════════
🎯 PROBABILITY ENGINE (MATEMATİKSEL MODELLER)
═══════════════════════════════════════════════════════════════
${probabilityContext}
` : ''}

Analyze ALL data including xG, timing patterns, clean sheets, and PROBABILITY ENGINE results.
USE the Poisson/Monte Carlo models as REFERENCE but form your OWN analysis.
Consider: %60 data analysis, %20 mathematical prediction, %20 psychological factors.
Return detailed JSON:`;

  const messages: AIMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await aiClient.chat(messages, {
      model: 'claude',
      useMCP: false, // MCP devre dışı - daha hızlı
      mcpFallback: true,
      fixtureId: matchData.fixtureId,
      temperature: 0.4, 
      maxTokens: 1000,
      timeout: 8000 // 8 saniye
    });
    
    if (response) {
      const parsed = extractJSON(response, matchData, detailedHome, detailedAway);
      if (parsed) {
        // Validate and enhance with calculated values
        if (typeof parsed.goalExpectancy === 'string') {
          parsed.goalExpectancy = parseFloat(parsed.goalExpectancy);
        }
        if (!parsed.goalExpectancy || isNaN(parsed.goalExpectancy)) {
          parsed.goalExpectancy = expectedTotal;
        }
        
        // Use aggressive confidence if AI gave lower
        if (!parsed.confidence || parsed.confidence < confidences.overUnderConf - 10) {
          parsed.confidence = confidences.overUnderConf;
        }
        parsed.confidence = Math.min(85, Math.max(50, parsed.confidence));
        
        // Add reasoning if missing - VE TUTARLILIK KONTROLÜ
        if (!parsed.overUnderReasoning || parsed.overUnderReasoning.length < 20) {
          parsed.overUnderReasoning = reasoning.overUnderReasoning;
        } else {
          // Reasoning ile tahmin tutarlı mı kontrol et
          const reasoningLower = parsed.overUnderReasoning.toLowerCase();
          const isOverInReasoning = reasoningLower.includes('over') || reasoningLower.includes('üst') || reasoningLower.includes('yüksek') || reasoningLower.includes('fazla');
          const isUnderInReasoning = reasoningLower.includes('under') || reasoningLower.includes('alt') || reasoningLower.includes('düşük') || reasoningLower.includes('az');
          
          // Eğer reasoning "Over" diyor ama tahmin "Under" ise (veya tersi), reasoning'i güncelle
          if ((parsed.overUnder === 'Over' && isUnderInReasoning && !isOverInReasoning) ||
              (parsed.overUnder === 'Under' && isOverInReasoning && !isUnderInReasoning)) {
            // Tutarsızlık var - reasoning'i veri bazlı güncelle
            parsed.overUnderReasoning = reasoning.overUnderReasoning;
            console.log(`   ⚠️ Over/Under reasoning tutarsızlığı düzeltildi: "${parsed.overUnderReasoning.substring(0, 50)}..."`);
          }
        }
        if (!parsed.matchResultReasoning || parsed.matchResultReasoning.length < 20) {
          parsed.matchResultReasoning = reasoning.matchResultReasoning;
        }
        if (!parsed.bttsReasoning || parsed.bttsReasoning.length < 20) {
          parsed.bttsReasoning = reasoning.bttsReasoning;
        }
        if (!parsed.agentSummary) {
          parsed.agentSummary = reasoning.agentSummary;
        }
        
        // Match result validation - DÜZELTME: VERİYE DAYALI ZORUNLU OVERRIDE
        // AI bazen yanlış matchResult dönüyor - veri analizi her zaman öncelikli!
        
        // 1. Önce AI'dan gelen değeri normalize et
        const aiMR = parsed.matchResult?.toUpperCase?.() || '';
        
        // 2. VERİ BAZLI KARAR - Bu HER ZAMAN geçerli (AI değerini override eder!)
        let dataDrivenMR: string;
        const absFormDiff = Math.abs(formDiff);
        
        if (formDiff > 6) {
          // Ev sahibi net favori
          dataDrivenMR = '1';
        } else if (formDiff < -6) {
          // Deplasman net favori
          dataDrivenMR = '2';
        } else if (absFormDiff >= 3) {
          // Orta düzey fark - gol beklentisine de bak, ama ev avantajını da dikkate al
          if (formDiff > 0 && homeExpected >= awayExpected) {
            // Ev sahibi formda + ev avantajı → MS 1 (gol beklentisi eşit olsa bile)
            dataDrivenMR = '1';
          } else if (formDiff < 0 && awayExpected >= homeExpected) {
            // Deplasman formda + gol beklentisi eşit veya daha iyi → MS 2
            dataDrivenMR = '2';
          } else if (formDiff > 0 && homeExpected < awayExpected) {
            // Ev sahibi formda ama gol beklentisi düşük → X (çelişki)
            dataDrivenMR = absFormDiff >= 5 ? '1' : 'X';
          } else if (formDiff < 0 && awayExpected < homeExpected) {
            // Deplasman formda ama gol beklentisi düşük → X (çelişki)
            dataDrivenMR = absFormDiff >= 5 ? '2' : 'X';
        } else {
            // Fallback
            dataDrivenMR = absFormDiff >= 4 ? (formDiff > 0 ? '1' : '2') : 'X';
          }
        } else {
          // Form dengeli - beklenen gol farkına bak
          if (homeExpected > awayExpected + 0.5) dataDrivenMR = '1';
          else if (awayExpected > homeExpected + 0.5) dataDrivenMR = '2';
          else dataDrivenMR = 'X';
        }
        
        // 3. VERİ BAZLI KARAR HER ZAMAN ÖNCE! (AI tutarsız olabilir)
        // Form farkı >= 3 ise ve dataDrivenMR ile AI farklıysa, dataDrivenMR'ı kullan
        if (absFormDiff > 6) {
          // Net favori durumu - kesinlikle override
          parsed.matchResult = dataDrivenMR;
          console.log(`   ⚠️ Form farkı ${formDiff} - VERİ OVERRIDE: ${aiMR} → ${dataDrivenMR}`);
        } else if (absFormDiff >= 3 && aiMR !== dataDrivenMR) {
          // Orta düzey fark (3-6) ve AI ile veri çelişiyor - veri bazlı kararı kullan
          parsed.matchResult = dataDrivenMR;
          console.log(`   ⚠️ Form farkı ${formDiff} - VERİ OVERRIDE: ${aiMR} → ${dataDrivenMR} (ev avantajı + form farkı)`);
        } else if (!['1', '2', 'X'].includes(aiMR)) {
          // AI değeri geçersiz - veri bazlı kararı kullan
          parsed.matchResult = dataDrivenMR;
        } else {
          // AI değeri geçerli ve form farkı düşük (< 3) veya AI ile veri aynı - AI'ya güven
          parsed.matchResult = aiMR;
          if (aiMR !== dataDrivenMR) {
            console.log(`   📊 AI: ${aiMR}, Veri: ${dataDrivenMR} (form: ${formDiff}) - AI değeri kullanıldı (form farkı düşük)`);
          }
        }
        
        // Over/Under validation - PROBABILITY ENGINE ile uyumlu
        // Önce probabilityEngine'in final sonucunu kontrol et
        if (probabilityResult && probabilityResult.overUnder.prediction) {
          const probEngineOU = probabilityResult.overUnder.prediction;
          const probEngineConf = probabilityResult.overUnder.confidence;
          const aiOU = parsed.overUnder;
          
          // Eğer probabilityEngine güçlü bir sinyal veriyorsa (>= 55%), onu kullan
          if (probEngineConf >= 55) {
            parsed.overUnder = probEngineOU;
            console.log(`   🎯 Probability Engine Override: ${aiOU} → ${probEngineOU} (${probEngineConf}% confidence)`);
          } else if (!['Over', 'Under'].includes(aiOU)) {
            // AI değeri geçersizse, probabilityEngine'i kullan
            parsed.overUnder = probEngineOU;
          } else if (aiOU !== probEngineOU) {
            // AI ile Probability Engine çelişiyor
            // Veri bazlı kontrol: expectedTotal < 2.5 ise "Under" olmalı
            if (expectedTotal < 2.5 && probEngineOU === 'Under') {
              // Veri bazlı doğrulama: expectedTotal < 2.5 ve Probability Engine "Under" diyor
              parsed.overUnder = probEngineOU;
              console.log(`   ⚠️ Over/Under Override: AI ${aiOU}, Veri ${expectedTotal.toFixed(2)} < 2.5, ProbEngine ${probEngineOU} (${probEngineConf}%) → ${probEngineOU} kullanıldı`);
            } else if (expectedTotal >= 2.65 && probEngineOU === 'Over') {
              // Veri bazlı doğrulama: expectedTotal >= 2.65 ve Probability Engine "Over" diyor
              parsed.overUnder = probEngineOU;
              console.log(`   ⚠️ Over/Under Override: AI ${aiOU}, Veri ${expectedTotal.toFixed(2)} >= 2.65, ProbEngine ${probEngineOU} (${probEngineConf}%) → ${probEngineOU} kullanıldı`);
            } else if (Math.abs(probEngineConf - 50) > 5 && probEngineConf > confidences.overUnderConf) {
              // ProbabilityEngine'in güveni %50'den 5+ puan farklıysa ve Stats Agent'ın güveninden yüksekse, onu kullan
              parsed.overUnder = probEngineOU;
              console.log(`   ⚠️ Probability Engine çelişkisi: AI ${aiOU}, ProbEngine ${probEngineOU} - ProbEngine kullanıldı (${probEngineConf}% vs ${confidences.overUnderConf}%)`);
            }
          }
        } else if (!['Over', 'Under'].includes(parsed.overUnder)) {
          // ProbabilityEngine yoksa, veri bazlı karar
          // Over için daha yüksek eşik: 2.5 → 2.65
          // avgOver25 eşiği: 55 → 60
          parsed.overUnder = (expectedTotal >= 2.65 || avgOver25 >= 60) ? 'Over' : 'Under';
        } else if (expectedTotal < 2.5 && parsed.overUnder === 'Over') {
          // Veri bazlı override: expectedTotal < 2.5 ise "Under" olmalı
          parsed.overUnder = 'Under';
          console.log(`   ⚠️ Over/Under Veri Override: AI "Over", ama expectedTotal ${expectedTotal.toFixed(2)} < 2.5 → "Under"`);
        } else if (expectedTotal >= 2.65 && parsed.overUnder === 'Under') {
          // Veri bazlı override: expectedTotal >= 2.65 ise "Over" olmalı
          parsed.overUnder = 'Over';
          console.log(`   ⚠️ Over/Under Veri Override: AI "Under", ama expectedTotal ${expectedTotal.toFixed(2)} >= 2.65 → "Over"`);
        }
        
        // BTTS validation - %50-55 arası belirsiz, daha dikkatli
        if (!['Yes', 'No'].includes(parsed.btts)) {
          // %55+ = Yes, %45- = No, %45-55 arası = beklenen gollere bak
          if (avgBtts >= 55) {
            parsed.btts = 'Yes';
          } else if (avgBtts <= 45) {
            parsed.btts = 'No';
          } else {
            // Belirsiz bölge: beklenen gollere bak
            // Eğer her iki takım da 1.0+ gol bekleniyorsa Yes, değilse No
            parsed.btts = (homeExpected >= 1.0 && awayExpected >= 1.0) ? 'Yes' : 'No';
            console.log(`   ⚠️ BTTS belirsiz (%${avgBtts}) - beklenen gollere göre: ${parsed.btts}`);
          }
        } else {
          // AI'dan geldi ama %50-55 arası belirsiz bölgede - kontrol et
          if (avgBtts >= 50 && avgBtts <= 55) {
            // Belirsiz bölge: beklenen gollere bak
            const shouldBeYes = (homeExpected >= 1.0 && awayExpected >= 1.0);
            if ((parsed.btts === 'Yes' && !shouldBeYes) || (parsed.btts === 'No' && shouldBeYes)) {
              // AI ile veri çelişiyor - veri bazlı kararı kullan
              parsed.btts = shouldBeYes ? 'Yes' : 'No';
              console.log(`   ⚠️ BTTS belirsiz bölge (%${avgBtts}) - veri override: ${shouldBeYes ? 'Yes' : 'No'}`);
            }
          }
        }
        
        // Add all calculated stats
        parsed._calculatedStats = {
          expectedTotal: expectedTotal.toFixed(2),
          homeExpected: homeExpected.toFixed(2),
          awayExpected: awayExpected.toFixed(2),
          homeConcededExpected: homeConcededExpected.toFixed(2),
          awayConcededExpected: awayConcededExpected.toFixed(2),
          avgOver25,
          avgBtts,
          formDiff,
          dataQuality,
          confidences,
        };
        
        // 🆕 Add Probability Engine results
        if (probabilityResult) {
          parsed.probabilityEngine = {
            poisson: {
              homeWin: probabilityResult.poissonModel.homeWin,
              draw: probabilityResult.poissonModel.draw,
              awayWin: probabilityResult.poissonModel.awayWin,
              over25: probabilityResult.poissonModel.over25,
              btts: probabilityResult.poissonModel.btts,
            },
            monteCarlo: {
              homeWin: probabilityResult.monteCarloModel.homeWinPct,
              draw: probabilityResult.monteCarloModel.drawPct,
              awayWin: probabilityResult.monteCarloModel.awayWinPct,
              over25: probabilityResult.monteCarloModel.over25Pct,
              btts: probabilityResult.monteCarloModel.bttsPct,
              commonScores: probabilityResult.monteCarloModel.mostCommonScores,
            },
            motivation: {
              home: probabilityResult.motivationAnalysis.home.score,
              away: probabilityResult.motivationAnalysis.away.score,
              edge: probabilityResult.motivationAnalysis.psychologicalEdge,
            },
            final: {
              matchResult: probabilityResult.matchResult.prediction,
              matchResultConfidence: probabilityResult.matchResult.confidence,
              overUnder: probabilityResult.overUnder.prediction,
              overUnderConfidence: probabilityResult.overUnder.confidence,
              btts: probabilityResult.btts.prediction,
              bttsConfidence: probabilityResult.btts.confidence,
            },
            modelAgreement: probabilityResult.modelAgreement,
            dataQuality: probabilityResult.dataQuality,
          };
        }
        
        // 🆕 Add xG Analysis
        parsed.xgAnalysis = xgAnalysis;
        
        // 🆕 Add Timing Patterns
        parsed.timingPatterns = timingPatterns;
        
        // 🆕 Add Motivation Scores
        parsed.motivationScores = calculateMotivationFromForm(matchData, homeForm, awayForm, homePoints, awayPoints, formDiff, language);
        
        // 🆕 Add Clean Sheet Analysis
        parsed.cleanSheetAnalysis = cleanSheetAnalysis;
        
        // 🆕 Add First Half Prediction
        parsed.firstHalfPrediction = {
          goals: firstHalfPrediction,
          confidence: confidences.firstHalfConf,
          reasoning: timingPatterns.htftPattern
        };
        
        // Add individual confidences
        parsed.overUnderConfidence = confidences.overUnderConf;
        parsed.matchResultConfidence = confidences.matchResultConf;
        parsed.bttsConfidence = confidences.bttsConf;
        parsed.firstHalfConfidence = confidences.firstHalfConf;
        
        // 🆕 LİG PROFİLİ İLE AYARLAMA
        if (leagueProfile) {
          const adjustedPrediction = adjustPredictionByLeague(
            {
              overUnder: parsed.overUnder,
              overUnderConfidence: parsed.overUnderConfidence,
              matchResult: parsed.matchResult,
              matchResultConfidence: parsed.matchResultConfidence,
              btts: parsed.btts,
              bttsConfidence: parsed.bttsConfidence,
            },
            leagueProfile
          );
          
          parsed.overUnder = adjustedPrediction.overUnder;
          parsed.overUnderConfidence = adjustedPrediction.overUnderConfidence;
          parsed.matchResult = adjustedPrediction.matchResult;
          parsed.matchResultConfidence = adjustedPrediction.matchResultConfidence;
          parsed.btts = adjustedPrediction.btts;
          parsed.bttsConfidence = adjustedPrediction.bttsConfidence;
          
          // Lig bilgisini ekle
          parsed.leagueProfile = {
            name: leagueProfile.name,
            avgGoals: leagueProfile.avgGoalsPerMatch,
            over25Pct: leagueProfile.over25Percentage,
            homeWinPct: leagueProfile.homeWinPercentage,
            overUnderBias: leagueProfile.overUnderBias,
            homeAwayBias: leagueProfile.homeAwayBias,
            xgMultiplier: leagueProfile.xgMultiplier,
          };
          
          console.log(`   🏆 League Adjustment Applied: ${leagueProfile.name}`);
        }
        
        console.log(`✅ Stats Agent: ${parsed.matchResult} (${parsed.matchResultConfidence}%) | ${parsed.overUnder} (${parsed.overUnderConfidence}%) | BTTS: ${parsed.btts} (${parsed.bttsConfidence}%)`);
        console.log(`   📈 xG: ${xgAnalysis.totalXG} | 1H: ${parsed.firstHalfPrediction.goals} (${parsed.firstHalfConfidence}%)`);
        console.log(`   📝 Summary: ${parsed.agentSummary}`);
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ Stats agent error:', error);
  }

  // Fallback with DATA-DRIVEN values
  let fallbackOverUnder = (expectedTotal >= 2.65 || avgOver25 >= 60 || xgAnalysis.totalXG >= 2.65) ? 'Over' : 'Under';
  
  // Maç sonucu - VERİ BAZLI KARAR (reasoning ile tutarlı!)
  let fallbackMatchResult: string;
  const absFormDiffFB = Math.abs(formDiff);
  if (formDiff > 6) {
    fallbackMatchResult = '1'; // Ev sahibi net favori
  } else if (formDiff < -6) {
    fallbackMatchResult = '2'; // Deplasman net favori
  } else if (absFormDiffFB >= 3) {
    if (formDiff > 0 && homeExpected > awayExpected) fallbackMatchResult = '1';
    else if (formDiff < 0 && awayExpected > homeExpected) fallbackMatchResult = '2';
    else fallbackMatchResult = absFormDiffFB > 4 ? (formDiff > 0 ? '1' : '2') : 'X';
  } else {
    if (homeExpected > awayExpected + 0.5) fallbackMatchResult = '1';
    else if (awayExpected > homeExpected + 0.5) fallbackMatchResult = '2';
    else fallbackMatchResult = 'X';
  }
  let fallbackBtts = avgBtts >= 55 ? 'Yes' : 'No';
  let fallbackOverUnderConf = confidences.overUnderConf;
  let fallbackMatchResultConf = confidences.matchResultConf;
  let fallbackBttsConf = confidences.bttsConf;
  
  // 🆕 LİG PROFİLİ İLE AYARLAMA (Fallback için de)
  if (leagueProfile) {
    const adjustedFallback = adjustPredictionByLeague(
      {
        overUnder: fallbackOverUnder,
        overUnderConfidence: fallbackOverUnderConf,
        matchResult: fallbackMatchResult,
        matchResultConfidence: fallbackMatchResultConf,
        btts: fallbackBtts,
        bttsConfidence: fallbackBttsConf,
      },
      leagueProfile
    );
    
    fallbackOverUnder = adjustedFallback.overUnder;
    fallbackOverUnderConf = adjustedFallback.overUnderConfidence;
    fallbackMatchResult = adjustedFallback.matchResult;
    fallbackMatchResultConf = adjustedFallback.matchResultConfidence;
    fallbackBtts = adjustedFallback.btts;
    fallbackBttsConf = adjustedFallback.bttsConfidence;
  }
  
  const fallbackResult = {
    formAnalysis: `${matchData.homeTeam}: ${homeForm} (${homePoints}pts, ${homeGoalsScored.toFixed(1)} gol/maç) vs ${matchData.awayTeam}: ${awayForm} (${awayPoints}pts, ${awayGoalsScored.toFixed(1)} gol/maç)`,
    goalExpectancy: parseFloat(expectedTotal.toFixed(2)),
    overUnder: fallbackOverUnder,
    overUnderReasoning: reasoning.overUnderReasoning,
    overUnderConfidence: fallbackOverUnderConf,
    confidence: fallbackOverUnderConf,
    matchResult: fallbackMatchResult,
    matchResultReasoning: reasoning.matchResultReasoning,
    matchResultConfidence: fallbackMatchResultConf,
    btts: fallbackBtts,
    bttsReasoning: reasoning.bttsReasoning,
    bttsConfidence: fallbackBttsConf,
    // 🆕 Lig Profili
    leagueProfile: leagueProfile ? {
      name: leagueProfile.name,
      avgGoals: leagueProfile.avgGoalsPerMatch,
      over25Pct: leagueProfile.over25Percentage,
      homeWinPct: leagueProfile.homeWinPercentage,
      overUnderBias: leagueProfile.overUnderBias,
      homeAwayBias: leagueProfile.homeAwayBias,
      xgMultiplier: leagueProfile.xgMultiplier,
    } : null,
    // 🆕 xG Analysis
    xgAnalysis,
    // 🆕 Timing Patterns
    timingPatterns,
    // 🆕 Clean Sheet Analysis
    cleanSheetAnalysis,
    // 🆕 First Half Prediction
    firstHalfPrediction: {
      goals: firstHalfPrediction,
      confidence: confidences.firstHalfConf,
      reasoning: timingPatterns.htftPattern
    },
    firstHalfConfidence: confidences.firstHalfConf,
    keyStats: [
      `xG Total: ${xgAnalysis.totalXG}`,
      `Expected goals: ${expectedTotal.toFixed(2)}`,
      `Over 2.5 rate: ${avgOver25}%`,
      `BTTS rate: ${avgBtts}%`,
      `Form diff: ${formDiff > 0 ? '+' : ''}${formDiff} pts`,
      `1H Goals: ${avgFirstHalfGoals.toFixed(0)}%`,
    ],
    riskFactors: [
      ...(dataQuality < 50 ? ['Limited historical data'] : []),
      ...(xgAnalysis.homePerformance === 'overperforming' ? ['Home regression risk'] : []),
      ...(xgAnalysis.awayPerformance === 'overperforming' ? ['Away regression risk'] : []),
    ],
    agentSummary: reasoning.agentSummary,
    // 🆕 MOTİVASYON SKORLARI (Deep Analysis null olsa bile Stats'tan gelsin)
    motivationScores: calculateMotivationFromForm(matchData, homeForm, awayForm, homePoints, awayPoints, formDiff, language),
    _calculatedStats: {
      expectedTotal: expectedTotal.toFixed(2),
      homeExpected: homeExpected.toFixed(2),
      awayExpected: awayExpected.toFixed(2),
      homeConcededExpected: homeConcededExpected.toFixed(2),
      awayConcededExpected: awayConcededExpected.toFixed(2),
      avgOver25,
      avgBtts,
      formDiff,
      dataQuality,
      confidences,
    },
    // 🆕 PROBABILITY ENGINE sonuçları (varsa)
    probabilityEngine: probabilityResult ? {
      poisson: {
        homeWin: probabilityResult.poissonModel.homeWin,
        draw: probabilityResult.poissonModel.draw,
        awayWin: probabilityResult.poissonModel.awayWin,
        over25: probabilityResult.poissonModel.over25,
        btts: probabilityResult.poissonModel.btts,
      },
      monteCarlo: {
        homeWin: probabilityResult.monteCarloModel.homeWinPct,
        draw: probabilityResult.monteCarloModel.drawPct,
        awayWin: probabilityResult.monteCarloModel.awayWinPct,
        over25: probabilityResult.monteCarloModel.over25Pct,
        btts: probabilityResult.monteCarloModel.bttsPct,
        commonScores: probabilityResult.monteCarloModel.mostCommonScores,
      },
      motivation: {
        home: probabilityResult.motivationAnalysis.home.score,
        away: probabilityResult.motivationAnalysis.away.score,
        edge: probabilityResult.motivationAnalysis.psychologicalEdge,
      },
      final: {
        matchResult: probabilityResult.matchResult.prediction,
        matchResultConfidence: probabilityResult.matchResult.confidence,
        overUnder: probabilityResult.overUnder.prediction,
        overUnderConfidence: probabilityResult.overUnder.confidence,
        btts: probabilityResult.btts.prediction,
        bttsConfidence: probabilityResult.btts.confidence,
      },
      modelAgreement: probabilityResult.modelAgreement,
      dataQuality: probabilityResult.dataQuality,
    } : null,
  };
  
  console.log(`⚠️ Stats Agent Fallback: ${fallbackResult.matchResult} | ${fallbackResult.overUnder} | BTTS: ${fallbackResult.btts}`);
  console.log(`   📈 xG: ${xgAnalysis.totalXG} | 1H: ${fallbackResult.firstHalfPrediction.goals} (${fallbackResult.firstHalfConfidence}%)`);
  console.log(`   📝 Summary: ${fallbackResult.agentSummary}`);
  return fallbackResult;
}
