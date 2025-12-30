import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';
import { getLeagueProfile, adjustPredictionByLeague, LeagueProfile } from '../../football-intelligence/league-profiles';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen PROFESYONEL bir futbol istatistik analistisin. Verilen verileri analiz et.

GÖREV: Form, gol istatistikleri ve H2H verilerini değerlendir.

DEĞERLENDİRME KRİTERLERİ:
1. Form: Son 5 maç sonuçlarına bak (W=Galibiyet, D=Beraberlik, L=Mağlubiyet)
2. Gol Ortalamaları: Maç başına atılan ve yenilen goller
3. Over 2.5 / Under 2.5: Toplam gol beklentisi 2.5'tan fazla mı az mı?
4. BTTS (Karşılıklı Gol): Her iki takım da gol atar mı?
5. H2H: Geçmiş karşılaşmalar ne söylüyor?

GÜVEN SEVİYESİ KURALLARI:
- Veriler uyumluysa: %65-75 güven
- Veriler karışıksa: %55-65 güven
- Net sinyal yoksa: %50-55 güven
- ASLA %85 üstü verme, %50 altı verme

ÖNEMLİ:
- Sadece VERİLEN verilere dayanarak karar ver
- Tahmin değil, istatistik bazlı analiz yap
- Türkçe açıklama yaz

SADECE JSON DÖNDÜR:
{
  "formAnalysis": "detaylı form karşılaştırması",
  "goalExpectancy": 2.8,
  "xgAnalysis": {
    "homeXG": 1.5,
    "awayXG": 1.2,
    "homeActual": 1.8,
    "awayActual": 0.9,
    "homePerformance": "overperforming",
    "awayPerformance": "underperforming",
    "regressionRisk": "Ev sahibi xG'nin üstünde, regresyon riski var"
  },
  "timingPatterns": {
    "homeFirstHalfGoals": 55,
    "homeSecondHalfGoals": 45,
    "awayFirstHalfGoals": 40,
    "awaySecondHalfGoals": 60,
    "lateGoalsHome": 25,
    "lateGoalsAway": 30,
    "htftPattern": "Ev sahibi ilk yarı yavaş başlıyor, ikinci yarı açılıyor"
  },
  "cleanSheetAnalysis": {
    "homeCleanSheetStreak": 2,
    "awayCleanSheetStreak": 0,
    "homeFailedToScore": 1,
    "awayFailedToScore": 2,
    "defensiveRating": "Ev sahibi defansı son 3 maçta 2 clean sheet"
  },
  "overUnder": "Over",
  "overUnderReasoning": "📊 xG toplamı 2.7, son 5 maçta %65 Over. İkinci yarı gol paterni güçlü.",
  "confidence": 72,
  "matchResult": "1",
  "matchResultReasoning": "🏠 Ev sahibi form üstünlüğü + clean sheet serisi + H2H hakimiyeti",
  "btts": "Yes",
  "bttsReasoning": "⚽ Her iki takım da son 5 maçın 4'ünde gol attı. xG değerleri gol garantiliyor.",
  "firstHalfPrediction": {
    "goals": "Under 1.5",
    "confidence": 68,
    "reasoning": "Her iki takım da ilk yarıda yavaş başlıyor"
  },
  "keyStats": ["xG farkı", "timing pattern", "clean sheet serisi", "H2H"],
  "riskFactors": ["regresyon riski", "form değişkenliği"],
  "agentSummary": "📊 STATS: xG bazlı analiz + timing patterns → [özet]"
}`,

  en: `You are a PROFESSIONAL football statistics analyst. Perform DEEP analysis on REAL data.

TASK: Mathematically evaluate form, goals, H2H, xG, timing patterns and clean sheet data.

ANALYSIS LAYERS:
1. BASIC STATS - Form, goal averages, H2H
2. xG ANALYSIS - Expected vs actual goals (overperform/underperform)
3. TIMING PATTERNS - 1st half/2nd half goal distribution, last 15 min goals
4. CLEAN SHEET - Clean sheet streaks, defensive strength
5. SCORING PATTERNS - Result when leading, first goal winner rate

AGGRESSIVE RULES:
- If data is strong, give HIGH confidence (70-85%)
- Even if data is weak, pick most likely outcome (55-65%)
- Highlight xG differences (underperform = regression coming)

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

function extractJSON(text: string): any | null {
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
    return JSON.parse(jsonStr);
  } catch (e) {
    // Manual extraction fallback
    try {
      const result: any = {};
      
      const formMatch = jsonStr.match(/"formAnalysis"\s*:\s*"([^"]+)"/);
      result.formAnalysis = formMatch ? formMatch[1] : 'Analysis unavailable';
      
      const goalMatch = jsonStr.match(/"goalExpectancy"\s*:\s*([\d.]+)/);
      result.goalExpectancy = goalMatch ? parseFloat(goalMatch[1]) : 2.5;
      
      const ouMatch = jsonStr.match(/"overUnder"\s*:\s*"?(Over|Under)"?/i);
      result.overUnder = ouMatch ? ouMatch[1] : 'Over';
      
      const ouReasonMatch = jsonStr.match(/"overUnderReasoning"\s*:\s*"([^"]+)"/);
      result.overUnderReasoning = ouReasonMatch ? ouReasonMatch[1] : '';
      
      const confMatch = jsonStr.match(/"confidence"\s*:\s*([\d.]+)/);
      result.confidence = confMatch ? parseInt(confMatch[1]) : 60;
      
      const mrMatch = jsonStr.match(/"matchResult"\s*:\s*"?([12X])"?/i);
      result.matchResult = mrMatch ? mrMatch[1].toUpperCase() : 'X';
      
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
  
  // Gerçek gol ortalamaları (son 5-10 maç)
  const homeActual = parseFloat(detailedHome?.avgGoalsScored || homeForm?.avgGoals || '1.2');
  const awayActual = parseFloat(detailedAway?.avgGoalsScored || awayForm?.avgGoals || '1.0');
  const homeConceded = parseFloat(detailedHome?.avgGoalsConceded || homeForm?.avgConceded || '1.0');
  const awayConceded = parseFloat(detailedAway?.avgGoalsConceded || awayForm?.avgConceded || '1.2');
  
  // xG TAHMİNİ: Gerçek gol ortalamalarına 0.9 çarpanı uygula (regresyon beklentisi)
  // xG genelde gerçek gollerden %5-15 düşük olur
  const xgMultiplier = 0.92; // Slight regression towards mean
  const homeXG = Math.max(0.5, Math.min(3.0, homeActual * xgMultiplier));
  const awayXG = Math.max(0.4, Math.min(2.5, awayActual * xgMultiplier));
  
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
  language: 'tr' | 'en' | 'de'
): { overUnderReasoning: string; matchResultReasoning: string; bttsReasoning: string; agentSummary: string } {
  
  const homeWins = (homeForm.match(/W/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  const homeLosses = (homeForm.match(/L/g) || []).length;
  const awayLosses = (awayForm.match(/L/g) || []).length;
  
  if (language === 'tr') {
    const overUnderReasoning = expectedTotal >= 2.5
      ? `📊 Ev sahibi maç başı ${homeGoalsScored.toFixed(1)} gol atıyor, deplasman ${awayGoalsConceded.toFixed(1)} gol yiyor. Toplam beklenti: ${expectedTotal.toFixed(2)} gol. Son maçlarda Over 2.5 oranı %${avgOver25}. Güçlü Over sinyali.`
      : `📊 Ev sahibi ${homeGoalsScored.toFixed(1)} gol/maç, deplasman ${awayGoalsScored.toFixed(1)} gol/maç. Toplam beklenti: ${expectedTotal.toFixed(2)} gol. Under 2.5 oranı %${100 - avgOver25}. Düşük skorlu maç bekleniyor.`;
    
    const matchResultReasoning = homePoints > awayPoints
      ? `🏠 Ev sahibi form: ${homeForm} (${homePoints} puan, ${homeWins}G-${5-homeWins-homeLosses}B-${homeLosses}M). Deplasman: ${awayForm} (${awayPoints} puan). ${homePoints - awayPoints} puan farkı + ev avantajı → MS 1`
      : awayPoints > homePoints
      ? `🚌 Deplasman form: ${awayForm} (${awayPoints} puan, ${awayWins}G). Ev sahibi: ${homeForm} (${homePoints} puan). Deplasman ${awayPoints - homePoints} puan önde → MS 2`
      : `⚖️ Ev: ${homeForm} (${homePoints}p) vs Dep: ${awayForm} (${awayPoints}p). Formlar dengeli, ev avantajı hafif üstünlük → MS 1X`;
    
    const bttsReasoning = avgBtts >= 55
      ? `⚽ Ev sahibi %${Math.round(100 - (homeLosses/5)*100)} maçta gol attı. Deplasman %${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)} maçta gol buldu. Birleşik KG Var oranı %${avgBtts}. Her iki takım da gol atar.`
      : `🛡️ Ev sahibi ${homeGoalsConceded.toFixed(1)} gol/maç yiyor, deplasman ${awayGoalsScored.toFixed(1)} gol/maç atıyor. KG Var oranı %${avgBtts} düşük. Tek taraflı skor olasılığı yüksek.`;
    
    const agentSummary = `📊 STATS: Form analizi ${homePoints > awayPoints ? 'ev sahibi' : awayPoints > homePoints ? 'deplasman' : 'dengeli'}. Gol beklentisi ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Over' : 'Under'}). KG ${avgBtts >= 55 ? 'Var' : 'Yok'} eğilimli.`;
    
    return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
  }
  
  // German
  if (language === 'de') {
    const overUnderReasoning = expectedTotal >= 2.5
      ? `📊 Heimteam erzielt ${homeGoalsScored.toFixed(1)} Tore/Spiel, Auswärts kassiert ${awayGoalsConceded.toFixed(1)}. Erwartete Summe: ${expectedTotal.toFixed(2)} Tore. Über 2.5 Rate: ${avgOver25}%. Starkes Over-Signal.`
      : `📊 Heimteam ${homeGoalsScored.toFixed(1)} Tore/Spiel, Auswärts ${awayGoalsScored.toFixed(1)} Tore/Spiel. Erwartung: ${expectedTotal.toFixed(2)} Tore. Unter 2.5 Rate: ${100 - avgOver25}%. Torarmes Spiel erwartet.`;
    
    const matchResultReasoning = homePoints > awayPoints
      ? `🏠 Heimform: ${homeForm} (${homePoints} Pkt, ${homeWins}S-${5-homeWins-homeLosses}U-${homeLosses}N). Auswärts: ${awayForm} (${awayPoints} Pkt). ${homePoints - awayPoints} Pkt Vorsprung + Heimvorteil → Heimsieg`
      : awayPoints > homePoints
      ? `🚌 Auswärtsform: ${awayForm} (${awayPoints} Pkt, ${awayWins}S). Heim: ${homeForm} (${homePoints} Pkt). Auswärts ${awayPoints - homePoints} Pkt vorne → Auswärtssieg`
      : `⚖️ Heim: ${homeForm} (${homePoints}P) vs Ausw: ${awayForm} (${awayPoints}P). Ausgeglichene Form, leichter Heimvorteil → Heim oder Unentschieden`;
    
    const bttsReasoning = avgBtts >= 55
      ? `⚽ Heimteam traf in ${Math.round(100 - (homeLosses/5)*100)}% der Spiele. Auswärts traf in ${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)}%. Kombinierte BTTS-Rate: ${avgBtts}%. Beide Teams treffen wahrscheinlich.`
      : `🛡️ Heimteam kassiert ${homeGoalsConceded.toFixed(1)} Tore/Spiel, Auswärts erzielt ${awayGoalsScored.toFixed(1)}. BTTS-Rate ${avgBtts}% ist niedrig. Einseitiges Ergebnis wahrscheinlich.`;
    
    const agentSummary = `📊 STATS: Form favorisiert ${homePoints > awayPoints ? 'Heim' : awayPoints > homePoints ? 'Auswärts' : 'keinen'}. Torerwartung ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Über' : 'Unter'}). BTTS ${avgBtts >= 55 ? 'Ja' : 'Nein'} Trend.`;
    
    return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
  }
  
  // English (default)
  const overUnderReasoning = expectedTotal >= 2.5
    ? `📊 Home scores ${homeGoalsScored.toFixed(1)} goals/game, away concedes ${awayGoalsConceded.toFixed(1)}. Expected total: ${expectedTotal.toFixed(2)} goals. Over 2.5 rate: ${avgOver25}%. Strong Over signal.`
    : `📊 Home ${homeGoalsScored.toFixed(1)} goals/game, away ${awayGoalsScored.toFixed(1)} goals/game. Expected: ${expectedTotal.toFixed(2)} goals. Under 2.5 rate: ${100 - avgOver25}%. Low-scoring match expected.`;
  
  const matchResultReasoning = homePoints > awayPoints
    ? `🏠 Home form: ${homeForm} (${homePoints} pts, ${homeWins}W-${5-homeWins-homeLosses}D-${homeLosses}L). Away: ${awayForm} (${awayPoints} pts). ${homePoints - awayPoints} pts gap + home advantage → Home win`
    : awayPoints > homePoints
    ? `🚌 Away form: ${awayForm} (${awayPoints} pts, ${awayWins}W). Home: ${homeForm} (${homePoints} pts). Away ${awayPoints - homePoints} pts ahead → Away win`
    : `⚖️ Home: ${homeForm} (${homePoints}p) vs Away: ${awayForm} (${awayPoints}p). Balanced forms, slight home edge → Home or Draw`;
  
  const bttsReasoning = avgBtts >= 55
    ? `⚽ Home scored in ${Math.round(100 - (homeLosses/5)*100)}% of matches. Away scored in ${Math.round((awayWins + (5-awayWins-awayLosses))/5*100)}%. Combined BTTS rate: ${avgBtts}%. Both teams likely to score.`
    : `🛡️ Home concedes ${homeGoalsConceded.toFixed(1)} goals/game, away scores ${awayGoalsScored.toFixed(1)}. BTTS rate ${avgBtts}% is low. One-sided score likely.`;
  
  const agentSummary = `📊 STATS: Form favors ${homePoints > awayPoints ? 'home' : awayPoints > homePoints ? 'away' : 'neither'}. Goal expectancy ${expectedTotal.toFixed(1)} (${expectedTotal >= 2.5 ? 'Over' : 'Under'}). BTTS ${avgBtts >= 55 ? 'Yes' : 'No'} trend.`;
  
  return { overUnderReasoning, matchResultReasoning, bttsReasoning, agentSummary };
}

// ==================== STATS AGENT ====================

export async function runStatsAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  console.log('📊 Stats Agent starting DEEP analysis with xG, timing patterns, clean sheets...');
  
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

  // Gol ortalamaları
  const homeGoalsScored = parseFloat(detailedHome?.avgGoalsScored || matchData.homeForm?.avgGoals || '1.2');
  const homeGoalsConceded = parseFloat(detailedHome?.avgGoalsConceded || matchData.homeForm?.avgConceded || '1.0');
  const awayGoalsScored = parseFloat(detailedAway?.avgGoalsScored || matchData.awayForm?.avgGoals || '1.0');
  const awayGoalsConceded = parseFloat(detailedAway?.avgGoalsConceded || matchData.awayForm?.avgConceded || '1.2');
  
  // Beklenen goller (gol atma beklentisi)
  const homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  const expectedTotal = homeExpected + awayExpected;
  
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

  // 🆕 xG Analysis
  const xgAnalysis = calculateXGAnalysis(matchData, language);
  console.log(`   📈 xG Analysis: Home ${xgAnalysis.homeXG} vs Away ${xgAnalysis.awayXG} (Total: ${xgAnalysis.totalXG})`);
  console.log(`   📈 Performance: Home ${xgAnalysis.homePerformance}, Away ${xgAnalysis.awayPerformance}`);
  
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
    language
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

Analyze ALL data including xG, timing patterns, and clean sheets. Return detailed JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await heurist.chat(messages, { temperature: 0.4, maxTokens: 1500 }); // Agresif analiz için artırıldı
    
    if (response) {
      const parsed = extractJSON(response);
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
        
        // Add reasoning if missing
        if (!parsed.overUnderReasoning || parsed.overUnderReasoning.length < 20) {
          parsed.overUnderReasoning = reasoning.overUnderReasoning;
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
        
        // Match result validation
        if (!['1', '2', 'X'].includes(parsed.matchResult?.toUpperCase())) {
          if (formDiff > 3) parsed.matchResult = '1';
          else if (formDiff < -3) parsed.matchResult = '2';
          else if (homeExpected > awayExpected + 0.3) parsed.matchResult = '1';
          else if (awayExpected > homeExpected + 0.3) parsed.matchResult = '2';
          else parsed.matchResult = 'X';
        } else {
          parsed.matchResult = parsed.matchResult.toUpperCase();
        }
        
        // Over/Under validation
        if (!['Over', 'Under'].includes(parsed.overUnder)) {
          parsed.overUnder = (expectedTotal >= 2.5 || avgOver25 >= 55) ? 'Over' : 'Under';
        }
        
        // BTTS validation
        if (!['Yes', 'No'].includes(parsed.btts)) {
          parsed.btts = avgBtts >= 55 ? 'Yes' : 'No';
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
        
        // 🆕 Add xG Analysis
        parsed.xgAnalysis = xgAnalysis;
        
        // 🆕 Add Timing Patterns
        parsed.timingPatterns = timingPatterns;
        
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

  // Fallback with aggressive values
  let fallbackOverUnder = (expectedTotal >= 2.5 || avgOver25 >= 55 || xgAnalysis.totalXG >= 2.5) ? 'Over' : 'Under';
  let fallbackMatchResult = formDiff > 3 ? '1' : formDiff < -3 ? '2' : (homeExpected > awayExpected ? '1' : 'X');
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
  };
  
  console.log(`⚠️ Stats Agent Fallback: ${fallbackResult.matchResult} | ${fallbackResult.overUnder} | BTTS: ${fallbackResult.btts}`);
  console.log(`   📈 xG: ${xgAnalysis.totalXG} | 1H: ${fallbackResult.firstHalfPrediction.goals} (${fallbackResult.firstHalfConfidence}%)`);
  console.log(`   📝 Summary: ${fallbackResult.agentSummary}`);
  return fallbackResult;
}
