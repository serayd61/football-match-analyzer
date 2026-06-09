// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - MAIN ENGINE
// Orchestrator for 4 AI Model Consensus Architecture
// ============================================================================

import {
  AIModel,
  AIPrediction,
  BettingMarket,
  QuadBrainResult,
  EnhancedMatchData,
  DataQualityScore,
  DynamicWeight,
  ConsensusResult,
  MarketPrediction
} from './types';

import {
  AI_MODEL_CONFIGS,
  MARKET_SPECIALISTS,
  API_ENDPOINTS,
  MODEL_VERSIONS,
  CONFIDENCE_THRESHOLDS,
  getDefaultWeights
} from './config';

import { detectConflicts, runBatchDebates } from './debate';
import { assessDataQuality, calculateDynamicWeights, applyWeights, formatWeightsSummary } from './weighting';
import { fetchNewsContext } from './news';
import { recordPrediction, getAllModelPerformance } from './tracking';

// =========================
// AI MODEL CALLERS
// =========================

/**
 * Claude Tactical Analysis
 */
async function runClaudeTactical(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildTacticalPrompt(matchData, language);

  try {
    const response = await fetch(API_ENDPOINTS.ANTHROPIC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.claude,
        max_tokens: AI_MODEL_CONFIGS.claude.maxTokens,
        temperature: AI_MODEL_CONFIGS.claude.temperature,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Claude API error ${response.status}:`, errorText);
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }
      console.error(`   Model: ${MODEL_VERSIONS.claude}, Status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    if (!content) {
      console.error('❌ Claude returned empty response');
      return null;
    }

    return parseAIPrediction(content, 'claude', startTime);
  } catch (error: any) {
    console.error('❌ Claude exception:', error);
    console.error(`   Model: ${MODEL_VERSIONS.claude}, Error: ${error.message || error}`);
    return null;
  }
}

/**
 * GPT-4 Statistical Analysis
 */
async function runGPT4Statistical(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildStatisticalPrompt(matchData, language);

  try {
    const response = await fetch(API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.gpt4,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: AI_MODEL_CONFIGS.gpt4.maxTokens,
        temperature: AI_MODEL_CONFIGS.gpt4.temperature
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return parseAIPrediction(content, 'gpt4', startTime);
  } catch (error) {
    console.error('❌ GPT-4 error:', error);
    return null;
  }
}

/**
 * Gemini Pattern Analysis
 */
async function runGeminiPattern(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildPatternPrompt(matchData, language);

  try {
    const response = await fetch(
      `${API_ENDPOINTS.GEMINI}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: AI_MODEL_CONFIGS.gemini.maxTokens,
            temperature: AI_MODEL_CONFIGS.gemini.temperature
          }
        })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return parseAIPrediction(content, 'gemini', startTime);
  } catch (error) {
    console.error('❌ Gemini error:', error);
    return null;
  }
}

/**
 * Perplexity Contextual Analysis
 */
async function runMistralContextual(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildContextualPrompt(matchData, language);

  try {
    const response = await fetch(API_ENDPOINTS.OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://footballanalytics.pro'
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.mistral,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: AI_MODEL_CONFIGS.mistral.maxTokens,
        temperature: AI_MODEL_CONFIGS.mistral.temperature
      })
    });

    if (!response.ok) {
      console.error('❌ Mistral API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return parseAIPrediction(content, 'mistral', startTime);
  } catch (error) {
    console.error('❌ Mistral error:', error);
    return null;
  }
}

// =========================
// PROMPT BUILDERS
// =========================

// Language-specific instructions
const LANG_INSTRUCTIONS = {
  tr: {
    role: 'SEN BİR PROFESYONEL BAHİS ANALİSTİSİN',
    respond: 'TÜM YANITLARINI TÜRKÇE VER!',
    critical: 'KRİTİK',
    banned: 'YASAK',
    match: 'MAÇ',
    league: 'LİG/TURNUVA',
    cupMatch: 'KUPA MAÇI - Rotasyon & motivasyon kritik!',
    leagueMatch: 'LİG MAÇI',
    tierDiff: 'LİG SEVİYE FARKI',
    deepAnalysis: 'DERİN ANALİZ',
    form: 'Son Form',
    goals: 'Gol Ortalaması',
    homePerf: 'EV PERFORMANSI',
    awayPerf: 'DEPLASMAN PERFORMANSI',
    injuries: 'SAKATLAR',
    noInfo: 'Bilgi yok',
    h2h: 'H2H GEÇMİŞ',
    odds: 'ORANLAR (Piyasa ne düşünüyor?)',
    tasks: 'PROFESYONEL ANALİZ GÖREVLERİN',
  },
  en: {
    role: 'YOU ARE A PROFESSIONAL BETTING ANALYST',
    respond: 'RESPOND IN ENGLISH!',
    critical: 'CRITICAL',
    banned: 'BANNED',
    match: 'MATCH',
    league: 'LEAGUE/TOURNAMENT',
    cupMatch: 'CUP MATCH - Rotation & motivation critical!',
    leagueMatch: 'LEAGUE MATCH',
    tierDiff: 'LEAGUE TIER DIFFERENCE',
    deepAnalysis: 'DEEP ANALYSIS',
    form: 'Recent Form',
    goals: 'Goal Average',
    homePerf: 'HOME PERFORMANCE',
    awayPerf: 'AWAY PERFORMANCE',
    injuries: 'INJURIES',
    noInfo: 'No info',
    h2h: 'H2H HISTORY',
    odds: 'ODDS (What does the market think?)',
    tasks: 'YOUR PROFESSIONAL ANALYSIS TASKS',
  },
  de: {
    role: 'SIE SIND EIN PROFESSIONELLER WETTANALYST',
    respond: 'ANTWORTEN SIE AUF DEUTSCH!',
    critical: 'KRITISCH',
    banned: 'VERBOTEN',
    match: 'SPIEL',
    league: 'LIGA/TURNIER',
    cupMatch: 'POKALSPIEL - Rotation & Motivation kritisch!',
    leagueMatch: 'LIGASPIEL',
    tierDiff: 'LIGA-NIVEAU-UNTERSCHIED',
    deepAnalysis: 'TIEFENANALYSE',
    form: 'Aktuelle Form',
    goals: 'Tordurchschnitt',
    homePerf: 'HEIMLEISTUNG',
    awayPerf: 'AUSWÄRTSLEISTUNG',
    injuries: 'VERLETZUNGEN',
    noInfo: 'Keine Info',
    h2h: 'H2H HISTORIE',
    odds: 'QUOTEN (Was denkt der Markt?)',
    tasks: 'IHRE PROFESSIONELLEN ANALYSEAUFGABEN',
  }
};

function buildTacticalPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h, newsContext, odds } = matchData;
  const L = LANG_INSTRUCTIONS[language];
  
  // Detect if cup match
  const isCupMatch = matchData.league?.toLowerCase().includes('cup') || 
                     matchData.league?.toLowerCase().includes('copa') ||
                     matchData.league?.toLowerCase().includes('pokal') ||
                     matchData.league?.toLowerCase().includes('coupe');
  
  // Calculate league tier difference (if detectable)
  const homeLeagueTier = detectLeagueTier(homeTeam, homeForm);
  const awayLeagueTier = detectLeagueTier(awayTeam, awayForm);
  const tierDiff = Math.abs(homeLeagueTier - awayLeagueTier);
  
  return `🎓 ${L.role} - MOTİVASYON & PSİKOLOJİ UZMANI

⚠️ ${L.respond}

⚠️ ${L.critical}: ${language === 'tr' ? 'Genel klişe cümleler YASAK! Her tahmin SOMUT veriye dayanmalı.' : language === 'de' ? 'Allgemeine Klischees VERBOTEN! Jede Vorhersage muss auf KONKRETEN Daten basieren.' : 'General clichés BANNED! Every prediction must be based on CONCRETE data.'}

═══════════════════════════════════════════════════════════════════════════════
${L.match}: ${homeTeam} vs ${awayTeam}
${L.league}: ${matchData.league}
${isCupMatch ? `🏆 ${L.cupMatch}` : `📊 ${L.leagueMatch}`}
${tierDiff > 0 ? `⚡ ${L.tierDiff}: ${tierDiff} ${language === 'tr' ? 'kademe (Bu çok önemli!)' : language === 'de' ? 'Stufen (Sehr wichtig!)' : 'tiers (Very important!)'}` : ''}
═══════════════════════════════════════════════════════════════════════════════

🏠 ${homeTeam.toUpperCase()} - ${L.deepAnalysis}
• ${L.form}: ${homeForm?.form || 'N/A'} | ${language === 'tr' ? 'Puan' : language === 'de' ? 'Punkte' : 'Points'}: ${homeForm?.points || 0}/15
• ${L.goals}: ${homeForm?.avgGoals || 'N/A'} ${language === 'tr' ? 'attı' : language === 'de' ? 'erzielt' : 'scored'}, ${homeForm?.avgConceded || 'N/A'} ${language === 'tr' ? 'yedi' : language === 'de' ? 'kassiert' : 'conceded'}
• ${L.homePerf}: ${homeForm?.venueForm || homeForm?.form || 'N/A'}
• Over 2.5: ${homeForm?.over25Percentage || 'N/A'}% | BTTS: ${homeForm?.bttsPercentage || 'N/A'}%
• Clean Sheet: ${homeForm?.cleanSheetPercentage || 'N/A'}%
${newsContext?.homeTeam?.injuries?.length ? `• 🚑 ${L.injuries}: ${newsContext.homeTeam.injuries.map(i => i.player).join(', ')}` : `• 🚑 ${L.injuries}: ${L.noInfo}`}

🚌 ${awayTeam.toUpperCase()} - ${L.deepAnalysis}
• ${L.form}: ${awayForm?.form || 'N/A'} | ${language === 'tr' ? 'Puan' : language === 'de' ? 'Punkte' : 'Points'}: ${awayForm?.points || 0}/15
• ${L.goals}: ${awayForm?.avgGoals || 'N/A'} ${language === 'tr' ? 'attı' : language === 'de' ? 'erzielt' : 'scored'}, ${awayForm?.avgConceded || 'N/A'} ${language === 'tr' ? 'yedi' : language === 'de' ? 'kassiert' : 'conceded'}
• ${L.awayPerf}: ${awayForm?.venueForm || awayForm?.form || 'N/A'}
• Over 2.5: ${awayForm?.over25Percentage || 'N/A'}% | BTTS: ${awayForm?.bttsPercentage || 'N/A'}%
• Clean Sheet: ${awayForm?.cleanSheetPercentage || 'N/A'}%
${newsContext?.awayTeam?.injuries?.length ? `• 🚑 ${L.injuries}: ${newsContext.awayTeam.injuries.map(i => i.player).join(', ')}` : `• 🚑 ${L.injuries}: ${L.noInfo}`}

🔄 ${L.h2h} (${h2h?.totalMatches || 0} ${language === 'tr' ? 'maç' : language === 'de' ? 'Spiele' : 'matches'})
• ${homeTeam}: ${h2h?.homeWins || 0}${language === 'tr' ? 'G' : 'W'} | ${language === 'tr' ? 'Beraberlik' : language === 'de' ? 'Unentschieden' : 'Draw'}: ${h2h?.draws || 0} | ${awayTeam}: ${h2h?.awayWins || 0}${language === 'tr' ? 'G' : 'W'}
• H2H ${L.goals}: ${h2h?.avgGoals || 'N/A'} | Over 2.5: ${h2h?.over25Percentage || 'N/A'}%

💰 ${L.odds}
• MS: ${odds?.matchWinner?.home || 'N/A'} / ${odds?.matchWinner?.draw || 'N/A'} / ${odds?.matchWinner?.away || 'N/A'}
• Over 2.5: ${odds?.overUnder?.['2.5']?.over || 'N/A'} | Under 2.5: ${odds?.overUnder?.['2.5']?.under || 'N/A'}

🎯 ${L.tasks}:
${isCupMatch ? (language === 'tr' ? `
1. KADRO ROTASYONU: Favori takım yedeklerle mi oynayacak? (Kupa maçı!)
2. MOTİVASYON FARKI: Alt lig takımı için "hayatının maçı" vs üst lig için "zorunluluk"
3. "Giant Killing" riski: Alt lig takımları kupada %15-20 üst lig yener
4. İlk gol kritik: Küçük takım öne geçerse maç tamamen değişir
` : language === 'de' ? `
1. KADERROTATION: Spielt der Favorit mit Ersatzspielern? (Pokalspiel!)
2. MOTIVATIONSUNTERSCHIED: Für unterklassigen Verein "Spiel des Lebens" vs "Pflicht" für höherklassigen
3. "Giant Killing" Risiko: Unterklassige Teams schlagen in 15-20% der Pokalspiele überklassige
4. Erstes Tor kritisch: Wenn kleines Team führt, ändert sich das Spiel komplett
` : `
1. SQUAD ROTATION: Will the favorite play with reserves? (Cup match!)
2. MOTIVATION DIFFERENCE: For lower league team "match of their lives" vs "obligation" for top team
3. "Giant Killing" risk: Lower league teams beat top teams 15-20% in cup
4. First goal critical: If underdog leads, the match changes completely
`) : (language === 'tr' ? `
1. FORM ANALİZİ: Kim yükselişte, kim düşüşte?
2. EV/DEPLASMAN: Ev sahibi avantajı ne kadar güçlü?
3. TAKTİK ÇATIŞMA: Ofansif vs defansif, pressing vs counter
4. PSİKOLOJİK KENAR: Özgüven, baskı durumu
` : language === 'de' ? `
1. FORMANALYSE: Wer steigt auf, wer fällt ab?
2. HEIM/AUSWÄRTS: Wie stark ist der Heimvorteil?
3. TAKTISCHER KONFLIKT: Offensiv vs defensiv, Pressing vs Konter
4. PSYCHOLOGISCHER VORTEIL: Selbstvertrauen, Drucksituation
` : `
1. FORM ANALYSIS: Who's rising, who's falling?
2. HOME/AWAY: How strong is the home advantage?
3. TACTICAL CLASH: Offensive vs defensive, pressing vs counter
4. PSYCHOLOGICAL EDGE: Confidence, pressure situation
`)}
5. ${language === 'tr' ? 'İLK YARI vs İKİNCİ YARI: Goller ne zaman geliyor?' : language === 'de' ? 'ERSTE vs ZWEITE HALBZEIT: Wann fallen die Tore?' : 'FIRST HALF vs SECOND HALF: When do goals come?'}
6. ${language === 'tr' ? 'GOL ZAMANLAMA PATERNİ: Erken gol, geç drama, dağınık?' : language === 'de' ? 'TOR-TIMING-MUSTER: Frühe Tore, spätes Drama, verteilt?' : 'GOAL TIMING PATTERN: Early goals, late drama, spread out?'}

⚠️ ${L.banned}:
${language === 'tr' ? '- "Cup ties often produce..." gibi genel klişeler YASAK\n- Somut veri olmadan tahmin YASAK\n- Her confidence değeri AÇIKLANMALI' : language === 'de' ? '- Allgemeine Klischees wie "Pokalspiele produzieren oft..." VERBOTEN\n- Vorhersagen ohne konkrete Daten VERBOTEN\n- Jeder Confidence-Wert muss ERKLÄRT werden' : '- General clichés like "Cup ties often produce..." BANNED\n- Predictions without concrete data BANNED\n- Every confidence value must be EXPLAINED'}

⚠️⚠️⚠️ ${L.respond} ⚠️⚠️⚠️

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "SOMUT VERİYE DAYALI açıklama", "keyFactors": ["factor1", "factor2"] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "SOMUT VERİYE DAYALI", "keyFactors": [] },
    "overUnder15": { "prediction": "Over 1.5/Under 1.5", "confidence": 50-90, "reasoning": "SOMUT VERİYE DAYALI" },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "SOMUT VERİYE DAYALI", "keyFactors": [] },
    "firstHalfGoals": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "..." },
    "htft": { "prediction": "1/1, X/1, 2/1, 1/X, X/X, 2/X, 1/2, X/2, 2/2", "confidence": 30-70, "reasoning": "..." }
  },
  "specializedInsights": {
    "motivation": { "home": 1-10, "away": 1-10, "analysis": "Kısa motivasyon analizi" },
    "rotationRisk": { "home": "none/low/medium/high", "away": "none/low/medium/high" },
    "giantKillingRisk": "none/low/medium/high",
    "momentum": { "home": 1-10, "away": 1-10, "trend": "rising/stable/falling" },
    "tacticalAdvantage": "home/away/neutral",
    "psychologicalEdge": "Brief description of who has the mental edge",
    "goalTiming": "early_goals/late_drama/spread_out"
  },
  "bestBet": { "market": "Market name", "selection": "Selection", "confidence": 50-90, "reasoning": "Why this is the strongest bet - SOMUT VERİ İLE" },
  "overallAnalysis": "3-4 cümle profesyonel özet - klişe yok, somut analiz"
}`;
}

// Helper function to detect league tier
function detectLeagueTier(teamName: string, form: any): number {
  // Try to detect from form data or team name patterns
  // Returns 1 for top tier, 2 for second, etc.
  const formPoints = form?.points || 0;
  const avgGoals = parseFloat(form?.avgGoals || '0');
  
  // Simple heuristic - can be improved with actual league data
  if (avgGoals > 2 && formPoints > 10) return 1;
  if (avgGoals > 1.5 && formPoints > 7) return 2;
  return 3;
}

function buildStatisticalPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h, odds } = matchData;
  const L = LANG_INSTRUCTIONS[language];
  
  // xG hesaplama
  const homeGoals = parseFloat(homeForm?.avgGoals || '1.2');
  const awayGoals = parseFloat(awayForm?.avgGoals || '1.0');
  const homeConceded = parseFloat(homeForm?.avgConceded || '1.0');
  const awayConceded = parseFloat(awayForm?.avgConceded || '1.2');
  
  // Ev/Deplasman faktörü ile düzeltilmiş xG
  const homeXG = ((homeGoals + awayConceded) / 2 * 1.15).toFixed(2); // +15% ev avantajı
  const awayXG = ((awayGoals + homeConceded) / 2 * 0.85).toFixed(2); // -15% deplasman dezavantajı
  const totalXG = (parseFloat(homeXG) + parseFloat(awayXG)).toFixed(2);
  
  // Value hesaplama için oran dönüşümü
  const homeOdds = Number(odds?.matchWinner?.home) || 2.5;
  const drawOdds = Number(odds?.matchWinner?.draw) || 3.5;
  const awayOdds = Number(odds?.matchWinner?.away) || 3.0;
  const over25Odds = Number(odds?.overUnder?.['2.5']?.over) || 1.9;
  const under25Odds = Number(odds?.overUnder?.['2.5']?.under) || 1.9;
  
  // Implied probability from odds
  const homeImplied = (100 / homeOdds).toFixed(1);
  const drawImplied = (100 / drawOdds).toFixed(1);
  const awayImplied = (100 / awayOdds).toFixed(1);
  const over25Implied = (100 / over25Odds).toFixed(1);

  return `🎓 ${L.role} - ${language === 'tr' ? 'İSTATİSTİK & VALUE UZMANI' : language === 'de' ? 'STATISTIK & VALUE EXPERTE' : 'STATISTICS & VALUE EXPERT'}

⚠️ ${L.respond}

⚠️ ${L.critical}: ${language === 'tr' ? 'Her tahmin RAKAMLARLA desteklenmeli. "Muhtemelen", "belki" YASAK!' : language === 'de' ? 'Jede Vorhersage muss mit ZAHLEN unterstützt werden. "Wahrscheinlich", "vielleicht" VERBOTEN!' : 'Every prediction must be supported by NUMBERS. "Probably", "maybe" BANNED!'}

═══════════════════════════════════════════════════════════════════════════════
${L.match}: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════════════════════════

📊 EXPECTED GOALS (xG) ${language === 'tr' ? 'HESAPLAMASI' : language === 'de' ? 'BERECHNUNG' : 'CALCULATION'}
┌────────────────────────────────────────────────────────────────┐
│ ${homeTeam} xG: ${homeXG} (${language === 'tr' ? 'attığı' : language === 'de' ? 'erzielt' : 'scored'}: ${homeGoals}, ${language === 'tr' ? 'rakip yediği' : language === 'de' ? 'Gegner kassiert' : 'opp conceded'}: ${awayConceded})     │
│ ${awayTeam} xG: ${awayXG} (${language === 'tr' ? 'attığı' : language === 'de' ? 'erzielt' : 'scored'}: ${awayGoals}, ${language === 'tr' ? 'rakip yediği' : language === 'de' ? 'Gegner kassiert' : 'opp conceded'}: ${homeConceded})     │
│ ${language === 'tr' ? 'TOPLAM' : 'TOTAL'} xG: ${totalXG}                                          │
└────────────────────────────────────────────────────────────────┘

📈 ${language === 'tr' ? 'GOL İSTATİSTİKLERİ' : language === 'de' ? 'TOR-STATISTIKEN' : 'GOAL STATISTICS'}
${homeTeam}:
• Over 2.5: ${homeForm?.over25Percentage || '50'}% | BTTS: ${homeForm?.bttsPercentage || '50'}%
• Clean Sheet: ${homeForm?.cleanSheetPercentage || '20'}%

${awayTeam}:
• Over 2.5: ${awayForm?.over25Percentage || '50'}% | BTTS: ${awayForm?.bttsPercentage || '50'}%
• Clean Sheet: ${awayForm?.cleanSheetPercentage || '20'}%

🔄 H2H ${language === 'tr' ? 'İSTATİSTİKLERİ' : language === 'de' ? 'STATISTIKEN' : 'STATISTICS'} (${h2h?.totalMatches || 0} ${language === 'tr' ? 'maç' : language === 'de' ? 'Spiele' : 'matches'})
• ${language === 'tr' ? 'Ortalama Gol' : language === 'de' ? 'Durchschnittliche Tore' : 'Average Goals'}: ${h2h?.avgGoals || 'N/A'}
• Over 2.5: ${h2h?.over25Percentage || 'N/A'}%
• BTTS: ${h2h?.bttsPercentage || 'N/A'}%

💰 ${language === 'tr' ? 'ORAN ANALİZİ & VALUE TESPİTİ' : language === 'de' ? 'QUOTENANALYSE & VALUE-ERKENNUNG' : 'ODDS ANALYSIS & VALUE DETECTION'}
┌────────────────────────────────────────────────────────────────┐
│ ORANLAR          │ IMPLIED PROB    │ SENİN HESABIN │ VALUE?   │
├────────────────────────────────────────────────────────────────┤
│ Ev: ${homeOdds}          │ %${homeImplied}           │ Hesapla!      │ ?        │
│ Beraberlik: ${drawOdds}   │ %${drawImplied}           │ Hesapla!      │ ?        │
│ Deplasman: ${awayOdds}    │ %${awayImplied}           │ Hesapla!      │ ?        │
│ Over 2.5: ${over25Odds}   │ %${over25Implied}           │ Hesapla!      │ ?        │
└────────────────────────────────────────────────────────────────┘

🎯 ${L.tasks}:
${language === 'tr' ? `1. POİSSON DAĞILIMI: xG'den skor olasılıkları hesapla
2. VALUE TESPİTİ: Piyasa oranı vs senin hesabın → %5+ fark = VALUE
3. İLK YARI GOL: Toplam golün %40-45'i ilk yarıda → İY xG hesapla
4. TAKIM BAZLI: Her takımın gol atma olasılığı (1 - e^(-xG))
5. ORAN HAREKETİ: Oran düştüyse → sharp money, yükeldiyse → public money` : language === 'de' ? `1. POISSON-VERTEILUNG: Berechne Ergebnis-Wahrscheinlichkeiten aus xG
2. VALUE-ERKENNUNG: Marktquote vs deine Berechnung → >5% Differenz = VALUE
3. ERSTE HALBZEIT TORE: 40-45% der Tore in H1 → Berechne H1 xG
4. TEAM-BASIERT: Torwahrscheinlichkeit jedes Teams (1 - e^(-xG))
5. QUOTENBEWEGUNG: Quote fällt → Sharp Money, steigt → Public Money` : `1. POISSON DISTRIBUTION: Calculate score probabilities from xG
2. VALUE DETECTION: Market odds vs your calculation → >5% difference = VALUE
3. FIRST HALF GOALS: 40-45% of goals in H1 → Calculate H1 xG
4. TEAM-BASED: Goal probability of each team (1 - e^(-xG))
5. ODDS MOVEMENT: Odds dropping → sharp money, rising → public money`}

⚠️ VALUE BET ${language === 'tr' ? 'KURALLARI' : language === 'de' ? 'REGELN' : 'RULES'}:
- Edge > 5% → VALUE ${language === 'tr' ? 'VAR' : language === 'de' ? 'VORHANDEN' : 'EXISTS'}
- Edge > 10% → ${language === 'tr' ? 'GÜÇLÜ' : language === 'de' ? 'STARKER' : 'STRONG'} VALUE
- Edge < 5% → ${language === 'tr' ? 'VALUE YOK, oynama' : language === 'de' ? 'KEIN VALUE, nicht spielen' : 'NO VALUE, do not play'}

⚠️⚠️⚠️ ${L.respond} ⚠️⚠️⚠️

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "Poisson: %X Ev, %X Beraberlik, %X Deplasman", "keyFactors": [] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "xG ${totalXG} → Poisson Over 2.5: %X", "keyFactors": [] },
    "overUnder15": { "prediction": "Over 1.5/Under 1.5", "confidence": 50-90, "reasoning": "Poisson: 0 gol %X, 1 gol %X → Under 1.5: %X" },
    "overUnder35": { "prediction": "Over 3.5/Under 3.5", "confidence": 50-90, "reasoning": "Poisson kümülatif hesap" },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "Ev gol %X, Dep gol %X → BTTS: %X", "keyFactors": [] },
    "firstHalfOver05": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "İY xG: ${(parseFloat(totalXG) * 0.43).toFixed(2)}" },
    "homeTeamOver05": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "Ev xG ${homeXG} → Gol atma: %X" },
    "awayTeamOver05": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "Dep xG ${awayXG} → Gol atma: %X" }
  },
  "specializedInsights": {
    "xgPrediction": { "homeXG": ${homeXG}, "awayXG": ${awayXG}, "totalXG": ${totalXG} },
    "poissonScores": [{ "score": "1-1", "probability": 12.5 }, { "score": "2-1", "probability": 10.2 }, { "score": "1-0", "probability": 8.5 }],
    "valueBets": [{ "market": "Hangi market", "selection": "Seçim", "impliedProb": 0, "calculatedProb": 0, "edge": 0 }],
    "goalProbabilities": { "0goals": 0, "1goal": 0, "2goals": 0, "3goals": 0, "4plus": 0 }
  },
  "bestBet": { "market": "VALUE en yüksek market", "selection": "Seçim", "confidence": 50-90, "reasoning": "Implied %X, Hesaplanan %X → Edge %X" },
  "overallAnalysis": "xG ${totalXG}. Poisson: En olası skor X-X (%X). VALUE: [market] (%X edge)"
}`;
}

function buildPatternPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h, odds } = matchData;
  const L = LANG_INSTRUCTIONS[language];
  
  // Form string analysis
  const homeFormStr = homeForm?.form || 'NNNNN';
  const awayFormStr = awayForm?.form || 'NNNNN';
  const homeWinStreak = (homeFormStr.match(/^W+/) || [''])[0].length;
  const homeLossStreak = (homeFormStr.match(/^L+/) || [''])[0].length;
  const awayWinStreak = (awayFormStr.match(/^W+/) || [''])[0].length;
  const awayLossStreak = (awayFormStr.match(/^L+/) || [''])[0].length;
  
  // H2H summary
  const h2hTotal = h2h?.totalMatches || 0;
  const h2hHomeWins = h2h?.homeWins || 0;
  const h2hDraws = h2h?.draws || 0;
  const h2hAwayWins = h2h?.awayWins || 0;

  return `🎓 ${L.role} - ${language === 'tr' ? 'TARİHSEL PATTERN & RİSK UZMANI' : language === 'de' ? 'HISTORISCHE MUSTER & RISIKO EXPERTE' : 'HISTORICAL PATTERN & RISK EXPERT'}

⚠️ ${L.respond}

⚠️ ${L.critical}: ${language === 'tr' ? 'H2H verisi yoksa veya yetersizse, form verilerine odaklan. Uydurma yapma!' : language === 'de' ? 'Wenn H2H-Daten fehlen oder unzureichend sind, konzentriere dich auf Formdaten. Keine Erfindungen!' : 'If H2H data is missing or insufficient, focus on form data. Do not fabricate!'}

═══════════════════════════════════════════════════════════════════════════════
${L.match}: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🔄 H2H ${language === 'tr' ? 'TARİHSEL ANALİZ' : language === 'de' ? 'HISTORISCHE ANALYSE' : 'HISTORICAL ANALYSIS'} (${h2hTotal} ${language === 'tr' ? 'maç' : language === 'de' ? 'Spiele' : 'matches'})
${h2hTotal >= 3 ? `
┌────────────────────────────────────────────────────────────────┐
│ ${homeTeam}: ${h2hHomeWins} ${language === 'tr' ? 'GALİBİYET' : language === 'de' ? 'SIEGE' : 'WINS'} (${h2hTotal > 0 ? Math.round(h2hHomeWins/h2hTotal*100) : 0}%)                    │
│ ${language === 'tr' ? 'Beraberlik' : language === 'de' ? 'Unentschieden' : 'Draw'}: ${h2hDraws} (${h2hTotal > 0 ? Math.round(h2hDraws/h2hTotal*100) : 0}%)                                    │
│ ${awayTeam}: ${h2hAwayWins} ${language === 'tr' ? 'GALİBİYET' : language === 'de' ? 'SIEGE' : 'WINS'} (${h2hTotal > 0 ? Math.round(h2hAwayWins/h2hTotal*100) : 0}%)                    │
├────────────────────────────────────────────────────────────────┤
│ ${language === 'tr' ? 'Ortalama Gol' : language === 'de' ? 'Durchschn. Tore' : 'Avg Goals'}: ${h2h?.avgGoals || 'N/A'} | Over 2.5: ${h2h?.over25Percentage || 'N/A'}% | BTTS: ${h2h?.bttsPercentage || 'N/A'}% │
└────────────────────────────────────────────────────────────────┘
` : `
⚠️ ${language === 'tr' ? 'YETERSİZ H2H VERİSİ' : language === 'de' ? 'UNZUREICHENDE H2H-DATEN' : 'INSUFFICIENT H2H DATA'} (${h2hTotal} ${language === 'tr' ? 'maç' : language === 'de' ? 'Spiele' : 'matches'}) - ${language === 'tr' ? 'Form analizine odaklan!' : language === 'de' ? 'Auf Formanalyse konzentrieren!' : 'Focus on form analysis!'}
`}

📈 ${language === 'tr' ? 'SERİ ANALİZİ (REGRESSION RİSKİ)' : language === 'de' ? 'SERIEN-ANALYSE (REGRESSIONSRISIKO)' : 'STREAK ANALYSIS (REGRESSION RISK)'}
┌────────────────────────────────────────────────────────────────┐
│ ${homeTeam}:                                                   │
│   • Form: ${homeFormStr} | Puan: ${homeForm?.points || 0}/15             │
│   • Galibiyet Serisi: ${homeWinStreak} ${homeWinStreak >= 3 ? '🔥 SICAK!' : homeWinStreak >= 2 ? '👍' : ''}           │
│   • Mağlubiyet Serisi: ${homeLossStreak} ${homeLossStreak >= 3 ? '❄️ SOĞUK!' : homeLossStreak >= 2 ? '👎' : ''}        │
├────────────────────────────────────────────────────────────────┤
│ ${awayTeam}:                                                   │
│   • Form: ${awayFormStr} | Puan: ${awayForm?.points || 0}/15             │
│   • Galibiyet Serisi: ${awayWinStreak} ${awayWinStreak >= 3 ? '🔥 SICAK!' : awayWinStreak >= 2 ? '👍' : ''}           │
│   • Mağlubiyet Serisi: ${awayLossStreak} ${awayLossStreak >= 3 ? '❄️ SOĞUK!' : awayLossStreak >= 2 ? '👎' : ''}        │
└────────────────────────────────────────────────────────────────┘

📊 GOL PATTERN'LERİ
${homeTeam}: Over 2.5 ${homeForm?.over25Percentage || 'N/A'}% | BTTS ${homeForm?.bttsPercentage || 'N/A'}%
${awayTeam}: Over 2.5 ${awayForm?.over25Percentage || 'N/A'}% | BTTS ${awayForm?.bttsPercentage || 'N/A'}%

💰 ORAN HAREKETİ (Sharp Money?)
• Ev: ${odds?.matchWinner?.home || 'N/A'} | Beraberlik: ${odds?.matchWinner?.draw || 'N/A'} | Deplasman: ${odds?.matchWinner?.away || 'N/A'}

🎯 ${L.tasks}:
${language === 'tr' ? `1. H2H PATTERN: Bu takımlar karşılaştığında ne oluyor? (gollü/golsüz, favori kazanıyor mu?)
2. SERİ ANALİZİ: 3+ seri → REGRESSION RİSKİ (ortalamaya dönüş)
3. EV/DEPLASMAN PATTERN: Ev sahibi evde nasıl, deplasman dışarıda nasıl?
4. GOL ZAMANLAMA: İlk yarı mı ikinci yarı mı golcü?
5. ANOMALİ TESPİTİ: Normal dışı bir durum var mı?` : language === 'de' ? `1. H2H MUSTER: Was passiert, wenn diese Teams aufeinandertreffen? (torreich/torlos, gewinnt der Favorit?)
2. SERIEN-ANALYSE: 3+ Serie → REGRESSIONSRISIKO (Rückkehr zum Mittelwert)
3. HEIM/AUSWÄRTS MUSTER: Wie spielt der Heimverein zuhause, der Auswärtsverein auswärts?
4. TOR-TIMING: Erste oder zweite Halbzeit torreich?
5. ANOMALIE-ERKENNUNG: Gibt es eine ungewöhnliche Situation?` : `1. H2H PATTERN: What happens when these teams meet? (high-scoring/low-scoring, does favorite win?)
2. STREAK ANALYSIS: 3+ streak → REGRESSION RISK (reversion to mean)
3. HOME/AWAY PATTERN: How does home team play at home, away team away?
4. GOAL TIMING: First half or second half goalscoring?
5. ANOMALY DETECTION: Is there anything unusual?`}

⚠️ ${language === 'tr' ? 'REGRESSION KURALLARI' : language === 'de' ? 'REGRESSIONSREGELN' : 'REGRESSION RULES'}:
${language === 'tr' ? `- 3+ galibiyet serisi → Düşüş riski %30+
- 3+ mağlubiyet serisi → Yükseliş beklentisi %30+
- "Hot streak" sonsuza kadar sürmez!` : language === 'de' ? `- 3+ Siegesserie → Rückgangsrisiko 30%+
- 3+ Niederlagenserie → Aufstiegserwartung 30%+
- "Hot Streak" dauert nicht ewig!` : `- 3+ win streak → Decline risk 30%+
- 3+ loss streak → Recovery expected 30%+
- "Hot streak" doesn't last forever!`}

🛡️ ${language === 'tr' ? 'RİSK DEĞERLENDİRMESİ' : language === 'de' ? 'RISIKOBEWERTUNG' : 'RISK ASSESSMENT'}:
${language === 'tr' ? `- Yüksek seri + zayıf rakip = Dikkat!
- Düşük seri + güçlü rakip = Fırsat olabilir` : language === 'de' ? `- Hohe Serie + schwacher Gegner = Vorsicht!
- Niedrige Serie + starker Gegner = Könnte eine Chance sein` : `- High streak + weak opponent = Caution!
- Low streak + strong opponent = Could be opportunity`}

⚠️⚠️⚠️ ${L.respond} ⚠️⚠️⚠️

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "H2H: %X ev, %X beraberlik. Form: ...", "keyFactors": [] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "H2H Over 2.5: %X. Son 5: Ev %X, Dep %X", "keyFactors": [] },
    "overUnder15": { "prediction": "Over 1.5/Under 1.5", "confidence": 50-90, "reasoning": "H2H'de 0-0 veya 1-0: X/Y maç" },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "H2H BTTS: %X. Form BTTS: Ev %X, Dep %X", "keyFactors": [] },
    "correctScore": { "prediction": "1-1 veya 2-1 vs", "confidence": 20-50, "reasoning": "H2H'de en sık skor: ..." },
    "doubleChance": { "prediction": "1X/X2/12", "confidence": 60-85, "reasoning": "Güvenli opsiyon çünkü..." }
  },
  "specializedInsights": {
    "h2hPattern": "Bu karşılaşmada X pattern'i var: ...",
    "streakAnalysis": { "home": "${homeWinStreak > 0 ? 'Galibiyet' : homeLossStreak > 0 ? 'Mağlubiyet' : 'Karışık'} serisi", "away": "${awayWinStreak > 0 ? 'Galibiyet' : awayLossStreak > 0 ? 'Mağlubiyet' : 'Karışık'} serisi" },
    "regressionRisk": { "home": "${homeWinStreak >= 3 || homeLossStreak >= 3 ? 'HIGH' : 'LOW'}", "away": "${awayWinStreak >= 3 || awayLossStreak >= 3 ? 'HIGH' : 'LOW'}" },
    "anomalyDetected": false,
    "commonScorelines": ["X-X", "X-X", "X-X"]
  },
  "bestBet": { "market": "Pattern'e dayalı en güçlü market", "selection": "Seçim", "confidence": 50-90, "reasoning": "Tarihsel veri + form analizi" },
  "overallAnalysis": "H2H: X maçta Y pattern. Seri analizi: ... Regression riski: ..."
}`;
}

function buildContextualPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, newsContext } = matchData;
  const L = LANG_INSTRUCTIONS[language];

  const noInjuries = language === 'tr' ? 'Onaylanmış sakatlık yok' : language === 'de' ? 'Keine bestätigten Verletzungen' : 'No confirmed injuries';
  const noNews = language === 'tr' ? 'Güncel haber yok' : language === 'de' ? 'Keine aktuellen Nachrichten' : 'No recent news';
  
  const homeInjuries = newsContext?.homeTeam?.injuries?.map(i => `${i.player} (${i.status})`).join(', ') || noInjuries;
  const awayInjuries = newsContext?.awayTeam?.injuries?.map(i => `${i.player} (${i.status})`).join(', ') || noInjuries;
  const homeNews = newsContext?.homeTeam?.news?.map(n => `- ${n.headline}`).join('\n') || noNews;
  const awayNews = newsContext?.awayTeam?.news?.map(n => `- ${n.headline}`).join('\n') || noNews;

  return `${L.role} - ${language === 'tr' ? 'BAĞLAM & HABER ANALİSTİ' : language === 'de' ? 'KONTEXT & NACHRICHTEN ANALYST' : 'CONTEXT & NEWS ANALYST'}

⚠️ ${L.respond}

${language === 'tr' ? 'GÖREV: İstatistiklerin yakalayamadığı haberleri, sakatlıkları ve dış faktörleri analiz et.' : language === 'de' ? 'AUFGABE: Analysiere Nachrichten, Verletzungen und externe Faktoren, die Statistiken nicht erfassen können.' : 'TASK: Analyze news, injuries, and external factors that statistics cannot capture.'}

═══════════════════════════════════════════════════════════════════════════════
${L.match}: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🏥 ${language === 'tr' ? 'SAKATLIK & CEZA RAPORU' : language === 'de' ? 'VERLETZUNGS- & SPERRBERICHT' : 'INJURY & SUSPENSION REPORT'}

${homeTeam}:
${homeInjuries}

${awayTeam}:
${awayInjuries}

📰 ${language === 'tr' ? 'GÜNCEL HABERLER' : language === 'de' ? 'AKTUELLE NACHRICHTEN' : 'RECENT NEWS'}

${homeTeam}:
${homeNews}

${awayTeam}:
${awayNews}

${newsContext?.matchPreview?.expertPredictions?.length ? `
🎯 ${language === 'tr' ? 'UZMAN TAHMİNLERİ' : language === 'de' ? 'EXPERTEN-VORHERSAGEN' : 'EXPERT PREDICTIONS'}
${newsContext.matchPreview.expertPredictions.join('\n')}
` : ''}

${newsContext?.matchPreview?.weatherConditions ? `
🌤️ ${language === 'tr' ? 'HAVA DURUMU' : language === 'de' ? 'WETTERBEDINGUNGEN' : 'WEATHER CONDITIONS'}
${language === 'tr' ? 'Sıcaklık' : language === 'de' ? 'Temperatur' : 'Temperature'}: ${newsContext.matchPreview.weatherConditions.temperature}°C
${language === 'tr' ? 'Durum' : language === 'de' ? 'Bedingung' : 'Condition'}: ${newsContext.matchPreview.weatherConditions.condition}
${language === 'tr' ? 'Etki' : language === 'de' ? 'Auswirkung' : 'Impact'}: ${newsContext.matchPreview.weatherConditions.impact}
` : ''}

${L.tasks}:
${language === 'tr' ? `1. Sakatlıkların takım gücüne etkisi (özellikle kilit oyuncular)
2. Güncel haberlerden takım morali
3. Dış faktörler (hava, saha, seyahat)
4. Oyunu değiştirebilecek bağlam
5. Uzman tahminleri ve konsensüs
6. Motivasyon seviyesi (şampiyonluk yarışı, düşme hattı, kupa önemi)` : language === 'de' ? `1. Auswirkung von Verletzungen auf Teamstärke (besonders Schlüsselspieler)
2. Teammoral aus aktuellen Nachrichten
3. Externe Faktoren (Wetter, Spielort, Reise)
4. Spielverändernder Kontext
5. Expertenvorhersagen und Konsens
6. Motivationsniveau (Titelrennen, Abstiegskampf, Pokalwichtigkeit)` : `1. Impact of injuries on team strength (especially key players)
2. Team morale from recent news
3. External factors (weather, venue, travel)
4. Any game-changing context
5. Expert predictions and consensus
6. Motivation levels (title race, relegation, cup importance)`}

⚠️⚠️⚠️ ${L.respond} ⚠️⚠️⚠️

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "cleanSheet": { "prediction": "Home/Away/Neither", "confidence": 50-90, "reasoning": "Based on injuries and form" },
    "cornersBet": { "prediction": "Over 9.5/Under 9.5", "confidence": 50-80, "reasoning": "Based on playing styles" }
  },
  "specializedInsights": {
    "recentNews": ["Key news item 1", "Key news item 2"],
    "confirmedInjuries": ["Player 1", "Player 2"],
    "expertConsensus": "What do experts generally predict?",
    "lastMinuteFactors": ["Any last minute factors"],
    "motivationLevel": { "home": "high/normal/low", "away": "high/normal/low" }
  },
  "bestBet": { "market": "Market name", "selection": "Selection", "confidence": 50-90, "reasoning": "Context-based recommendation" },
  "overallAnalysis": "3-4 sentence contextual summary"
}`;
}

// =========================
// RESPONSE PARSER
// =========================

function parseAIPrediction(
  content: string | null,
  model: AIModel,
  startTime: number
): AIPrediction | null {
  if (!content) return null;

  try {
    // JSON çıkar
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Confidence sınırları
    const clampConfidence = (c: number) => Math.min(90, Math.max(50, c || 60));

    // Normalize match result prediction
    const normalizeMatchResult = (pred: string): 'Home Win' | 'Draw' | 'Away Win' => {
      if (!pred) return 'Draw';
      const lower = String(pred).toLowerCase().trim();
      if (lower.includes('home') || lower === '1' || lower === 'home win') return 'Home Win';
      if (lower.includes('away') || lower === '2' || lower === 'away win') return 'Away Win';
      if (lower.includes('draw') || lower === 'x' || lower === '0') return 'Draw';
      return 'Draw'; // Default fallback
    };

    const rawMatchResult = parsed.predictions?.matchResult?.prediction || 'Draw';
    const normalizedMatchResult = normalizeMatchResult(rawMatchResult);

    const predictions = {
      matchResult: {
        prediction: normalizedMatchResult,
        confidence: clampConfidence(parsed.predictions?.matchResult?.confidence),
        reasoning: parsed.predictions?.matchResult?.reasoning || '',
        keyFactors: parsed.predictions?.matchResult?.keyFactors || [],
        riskFactors: []
      },
      overUnder25: {
        prediction: parsed.predictions?.overUnder25?.prediction || 'Under 2.5',
        confidence: clampConfidence(parsed.predictions?.overUnder25?.confidence),
        reasoning: parsed.predictions?.overUnder25?.reasoning || '',
        keyFactors: parsed.predictions?.overUnder25?.keyFactors || [],
        riskFactors: []
      },
      btts: {
        prediction: parsed.predictions?.btts?.prediction || 'No',
        confidence: clampConfidence(parsed.predictions?.btts?.confidence),
        reasoning: parsed.predictions?.btts?.reasoning || '',
        keyFactors: parsed.predictions?.btts?.keyFactors || [],
        riskFactors: []
      }
    };

    const avgConfidence = (
      predictions.matchResult.confidence +
      predictions.overUnder25.confidence +
      predictions.btts.confidence
    ) / 3;

    return {
      model,
      role: AI_MODEL_CONFIGS[model].role,
      timestamp: new Date().toISOString(),
      predictions,
      specializedInsights: parsed.specializedInsights || {},
      overallAnalysis: parsed.overallAnalysis || '',
      confidenceLevel: avgConfidence >= 75 ? 'high' : avgConfidence >= 65 ? 'medium' : 'low',
      responseTime: Date.now() - startTime,
      rawResponse: content
    };
  } catch (error) {
    console.error(`❌ Parse error for ${model}:`, error);
    return null;
  }
}

// =========================
// CONSENSUS CALCULATION
// =========================

function buildConsensus(
  market: BettingMarket,
  predictions: { claude?: AIPrediction; gpt4?: AIPrediction; gemini?: AIPrediction; mistral?: AIPrediction },
  weights: DynamicWeight[]
): ConsensusResult {
  const votes: ConsensusResult['votes'] = [];
  
  const models: AIModel[] = ['claude', 'gpt4', 'gemini', 'mistral'];
  
  for (const model of models) {
    const pred = predictions[model];
    if (!pred) continue;
    
    let marketPred: MarketPrediction | undefined;
    
    switch (market) {
      case 'MATCH_RESULT':
        marketPred = pred.predictions.matchResult;
        break;
      case 'OVER_UNDER_25':
        marketPred = pred.predictions.overUnder25;
        break;
      case 'BTTS':
        marketPred = pred.predictions.btts;
        break;
    }
    
    if (marketPred) {
      const weight = weights.find(w => w.model === model)?.finalWeight || 0.25;
      votes.push({
        model,
        prediction: marketPred.prediction,
        confidence: marketPred.confidence,
        weight
      });
    }
  }

  // Apply weighted voting
  const result = applyWeights(
    votes.map(v => ({ model: v.model, prediction: v.prediction, data: { confidence: v.confidence } })),
    weights
  );

  // Collect reasonings
  const reasonings: string[] = [];
  for (const vote of votes) {
    if (vote.prediction === result.prediction) {
      const pred = predictions[vote.model];
      const marketPred = market === 'MATCH_RESULT' ? pred?.predictions.matchResult :
                         market === 'OVER_UNDER_25' ? pred?.predictions.overUnder25 :
                         pred?.predictions.btts;
      if (marketPred?.reasoning) {
        reasonings.push(`[${AI_MODEL_CONFIGS[vote.model].displayName}] ${marketPred.reasoning}`);
      }
    }
  }

  return {
    market,
    prediction: result.prediction,
    confidence: result.confidence,
    votes,
    agreement: {
      unanimous: new Set(votes.map(v => v.prediction)).size === 1,
      majoritySize: votes.filter(v => v.prediction === result.prediction).length,
      totalModels: votes.length,
      weightedAgreement: result.weightedAgreement
    },
    reasoning: reasonings
  };
}

// =========================
// MAIN ENGINE
// =========================

/**
 * Ana Quad-Brain analiz fonksiyonu
 */
export async function runQuadBrainAnalysis(
  matchData: EnhancedMatchData,
  options: {
    language?: 'tr' | 'en' | 'de';
    fetchNews?: boolean;
    trackPerformance?: boolean;
  } = {}
): Promise<QuadBrainResult> {
  const language = options.language || 'en';
  const startTime = Date.now();
  
  console.log('\n' + '═'.repeat(60));
  console.log(`🧠 QUAD-BRAIN ANALYSIS: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log('═'.repeat(60));

  const timing: QuadBrainResult['timing'] = {
    dataFetch: 0,
    aiCalls: 0,
    conflictDetection: 0,
    consensus: 0,
    total: 0
  };

  // 1. NEWS CONTEXT (opsiyonel)
  const newsFetchStart = Date.now();
  if (options.fetchNews !== false && !matchData.newsContext) {
    try {
      matchData.newsContext = await fetchNewsContext(matchData.homeTeam, matchData.awayTeam);
    } catch (error) {
      console.warn('⚠️ News fetch failed, continuing without news context');
    }
  }
  timing.dataFetch = Date.now() - newsFetchStart;

  // 2. DATA QUALITY ASSESSMENT
  const dataQuality = assessDataQuality(matchData);
  console.log(`\n📊 Data Quality: ${dataQuality.overall}/100`);

  // 3. HISTORICAL PERFORMANCE (for weight adjustment)
  let modelPerformance: Record<AIModel, any> | null = null;
  if (options.trackPerformance !== false) {
    try {
      modelPerformance = await getAllModelPerformance('30d');
    } catch (error) {
      console.warn('⚠️ Could not fetch model performance');
    }
  }

  // 4. PARALLEL AI CALLS
  console.log('\n🤖 Running 4 AI models in parallel...');
  const aiStart = Date.now();

  const [claudeResult, gpt4Result, geminiResult, mistralResult] = await Promise.all([
    runClaudeTactical(matchData, language),
    runGPT4Statistical(matchData, language),
    runGeminiPattern(matchData, language),
    runMistralContextual(matchData, language)
  ]);

  timing.aiCalls = Date.now() - aiStart;

  const predictions = {
    claude: claudeResult || undefined,
    gpt4: gpt4Result || undefined,
    gemini: geminiResult || undefined,
    mistral: mistralResult || undefined
  };

  const modelsUsed: AIModel[] = [];
  if (claudeResult) modelsUsed.push('claude');
  if (gpt4Result) modelsUsed.push('gpt4');
  if (geminiResult) modelsUsed.push('gemini');
  if (mistralResult) modelsUsed.push('mistral');

  console.log(`✅ ${modelsUsed.length}/4 AI models responded`);
  modelsUsed.forEach(m => {
    const pred = predictions[m];
    if (pred) {
      console.log(`   ${m}: ${pred.predictions.overUnder25.prediction} (${pred.predictions.overUnder25.confidence}%) - ${pred.responseTime}ms`);
    }
  });

  if (modelsUsed.length === 0) {
    return {
      success: false,
      matchInfo: {
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        fixtureId: matchData.fixtureId
      },
      dataQuality,
      individualPredictions: {},
      conflictAnalysis: { hasConflict: false, conflictLevel: 'none', conflicts: [], triggerDebate: false },
      debates: [],
      dynamicWeights: [],
      consensus: {} as any,
      bestBets: [],
      riskAssessment: { overall: 'extreme', factors: ['No AI responses'], warnings: ['All AI models failed'] },
      modelsUsed: [],
      totalModels: 0,
      timing,
      analyzedAt: new Date().toISOString(),
      version: '2.0'
    };
  }

  // 5. CONFLICT DETECTION
  const conflictStart = Date.now();
  const conflictAnalysis = detectConflicts(predictions);
  timing.conflictDetection = Date.now() - conflictStart;

  console.log(`\n🔍 Conflict Analysis: ${conflictAnalysis.conflictLevel}`);
  if (conflictAnalysis.triggerDebate) {
    console.log(`   ⚠️ Debate triggered: ${conflictAnalysis.debateReason}`);
  }

  // 6. DEBATES (if needed)
  let debates: QuadBrainResult['debates'] = [];
  if (conflictAnalysis.triggerDebate) {
    const debateStart = Date.now();
    debates = await runBatchDebates(
      conflictAnalysis.conflicts,
      predictions,
      {
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        fixtureId: matchData.fixtureId
      },
      dataQuality
    );
    timing.debate = Date.now() - debateStart;
    console.log(`   ✅ ${debates.length} debates resolved`);
  }

  // 7. DYNAMIC WEIGHTS
  const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];
  const allWeights: DynamicWeight[] = [];

  // Use OVER_UNDER_25 weights as representative (or average across markets)
  const representativeWeights = calculateDynamicWeights('OVER_UNDER_25', dataQuality, modelPerformance || undefined);
  allWeights.push(...representativeWeights);

  console.log('\n' + formatWeightsSummary(representativeWeights));

  // 8. CONSENSUS CALCULATION
  const consensusStart = Date.now();
  const consensus: QuadBrainResult['consensus'] = {
    matchResult: buildConsensus('MATCH_RESULT', predictions, calculateDynamicWeights('MATCH_RESULT', dataQuality)),
    overUnder25: buildConsensus('OVER_UNDER_25', predictions, calculateDynamicWeights('OVER_UNDER_25', dataQuality)),
    btts: buildConsensus('BTTS', predictions, calculateDynamicWeights('BTTS', dataQuality))
  };

  // Apply debate results if any
  for (const debate of debates) {
    if (debate.market === 'MATCH_RESULT') {
      consensus.matchResult.prediction = debate.resolution.finalPrediction;
      consensus.matchResult.confidence = debate.resolution.finalConfidence;
      consensus.matchResult.debateResult = debate;
    } else if (debate.market === 'OVER_UNDER_25') {
      consensus.overUnder25.prediction = debate.resolution.finalPrediction;
      consensus.overUnder25.confidence = debate.resolution.finalConfidence;
      consensus.overUnder25.debateResult = debate;
    } else if (debate.market === 'BTTS') {
      consensus.btts.prediction = debate.resolution.finalPrediction;
      consensus.btts.confidence = debate.resolution.finalConfidence;
      consensus.btts.debateResult = debate;
    }
  }

  timing.consensus = Date.now() - consensusStart;

  // 9. BEST BETS RANKING
  const bestBets: QuadBrainResult['bestBets'] = [
    {
      rank: 1,
      market: 'OVER_UNDER_25' as BettingMarket,
      selection: consensus.overUnder25.prediction,
      confidence: consensus.overUnder25.confidence,
      weightedAgreement: consensus.overUnder25.agreement.weightedAgreement,
      consensusStrength: (consensus.overUnder25.agreement.weightedAgreement >= 70 ? 'strong' : 
                         consensus.overUnder25.agreement.weightedAgreement >= 50 ? 'moderate' : 'weak') as 'strong' | 'moderate' | 'weak',
      reasoning: consensus.overUnder25.reasoning[0] || '',
      valueBet: false
    },
    {
      rank: 2,
      market: 'MATCH_RESULT' as BettingMarket,
      selection: consensus.matchResult.prediction,
      confidence: consensus.matchResult.confidence,
      weightedAgreement: consensus.matchResult.agreement.weightedAgreement,
      consensusStrength: (consensus.matchResult.agreement.weightedAgreement >= 70 ? 'strong' : 
                         consensus.matchResult.agreement.weightedAgreement >= 50 ? 'moderate' : 'weak') as 'strong' | 'moderate' | 'weak',
      reasoning: consensus.matchResult.reasoning[0] || '',
      valueBet: false
    },
    {
      rank: 3,
      market: 'BTTS' as BettingMarket,
      selection: consensus.btts.prediction,
      confidence: consensus.btts.confidence,
      weightedAgreement: consensus.btts.agreement.weightedAgreement,
      consensusStrength: (consensus.btts.agreement.weightedAgreement >= 70 ? 'strong' : 
                         consensus.btts.agreement.weightedAgreement >= 50 ? 'moderate' : 'weak') as 'strong' | 'moderate' | 'weak',
      reasoning: consensus.btts.reasoning[0] || '',
      valueBet: false
    }
  ].sort((a, b) => (b.weightedAgreement + b.confidence) - (a.weightedAgreement + a.confidence));

  // Update ranks
  bestBets.forEach((bet, i) => bet.rank = i + 1);

  // 10. RISK ASSESSMENT
  const avgConfidence = (
    consensus.matchResult.confidence +
    consensus.overUnder25.confidence +
    consensus.btts.confidence
  ) / 3;

  const avgAgreement = (
    consensus.matchResult.agreement.weightedAgreement +
    consensus.overUnder25.agreement.weightedAgreement +
    consensus.btts.agreement.weightedAgreement
  ) / 3;

  let overallRisk: QuadBrainResult['riskAssessment']['overall'] = 'medium';
  if (avgConfidence >= 70 && avgAgreement >= 60) overallRisk = 'low';
  else if (avgConfidence < 55 || avgAgreement < 40) overallRisk = 'high';

  const riskFactors: string[] = [];
  const warnings: string[] = [];

  if (dataQuality.overall < 50) {
    riskFactors.push('Low data quality');
    warnings.push('Predictions may be less reliable due to limited data');
  }
  if (conflictAnalysis.conflictLevel === 'major') {
    riskFactors.push('Major AI disagreement');
    warnings.push('AI models significantly disagree on predictions');
  }
  if (modelsUsed.length < 3) {
    riskFactors.push('Limited AI coverage');
    warnings.push(`Only ${modelsUsed.length}/4 AI models responded`);
  }

  timing.total = Date.now() - startTime;

  // 11. RECORD PREDICTION (if tracking enabled)
  if (options.trackPerformance !== false) {
    try {
      await recordPrediction({
        fixtureId: matchData.fixtureId,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        matchDate: matchData.matchDate || new Date().toISOString(),
        predictions: modelsUsed.flatMap(model => {
          const pred = predictions[model];
          if (!pred) return [];
          return [
            { model, market: 'MATCH_RESULT' as BettingMarket, prediction: pred.predictions.matchResult.prediction, confidence: pred.predictions.matchResult.confidence, weight: representativeWeights.find(w => w.model === model)?.finalWeight || 0.25 },
            { model, market: 'OVER_UNDER_25' as BettingMarket, prediction: pred.predictions.overUnder25.prediction, confidence: pred.predictions.overUnder25.confidence, weight: representativeWeights.find(w => w.model === model)?.finalWeight || 0.25 },
            { model, market: 'BTTS' as BettingMarket, prediction: pred.predictions.btts.prediction, confidence: pred.predictions.btts.confidence, weight: representativeWeights.find(w => w.model === model)?.finalWeight || 0.25 }
          ];
        }),
        consensus: [
          { market: 'MATCH_RESULT' as BettingMarket, prediction: consensus.matchResult.prediction, confidence: consensus.matchResult.confidence, hadDebate: !!consensus.matchResult.debateResult },
          { market: 'OVER_UNDER_25' as BettingMarket, prediction: consensus.overUnder25.prediction, confidence: consensus.overUnder25.confidence, hadDebate: !!consensus.overUnder25.debateResult },
          { market: 'BTTS' as BettingMarket, prediction: consensus.btts.prediction, confidence: consensus.btts.confidence, hadDebate: !!consensus.btts.debateResult }
        ]
      });
    } catch (error) {
      console.warn('⚠️ Could not record prediction');
    }
  }

  // 11.5 📊 DIXON-COLES SKOR MATRİSİ (KOŞULLU)
  // DC modeli varsa, LLM'in UYDURDUĞU poissonScores'u gerçek matematiksel
  // skor matrisiyle değiştir. DC yoksa (kapsam dışı lig / takım eşleşmedi)
  // mevcut LLM davranışı korunur — yanıt asla boşalmaz.
  try {
    const { getModelForLeague } = await import('../statistical/model-store');
    const { runStatisticalAgent, resolveTeam } = await import('../statistical/statistical-agent');
    const dcModel = await getModelForLeague(matchData.league);
    if (dcModel) {
      const h = resolveTeam(dcModel, matchData.homeTeam);
      const a = resolveTeam(dcModel, matchData.awayTeam);
      if (h && a) {
        const stat = runStatisticalAgent(dcModel, h, a);
        const realScores = stat.groundTruth.correctScore.map(s => ({
          score: s.score,
          probability: +(s.prob * 100).toFixed(1),
        }));
        for (const model of modelsUsed) {
          const pred = (predictions as any)[model];
          if (pred?.specializedInsights) {
            pred.specializedInsights.poissonScores = realScores;
            pred.specializedInsights.scoreSource = 'dixon-coles';
          }
        }
        console.log(`📊 Quad-Brain: poissonScores Dixon-Coles ile değiştirildi (${h} vs ${a}, en olası ${stat.mostLikelyScore}).`);
      }
    }
  } catch (e) {
    console.warn('⚠️ Quad-Brain Dixon-Coles skor override atlandı:', e);
  }

  // 12. FINAL RESULT
  console.log('\n' + '═'.repeat(60));
  console.log(`✅ QUAD-BRAIN ANALYSIS COMPLETE (${timing.total}ms)`);
  console.log(`   Match Result: ${consensus.matchResult.prediction} (${consensus.matchResult.confidence}%)`);
  console.log(`   Over/Under: ${consensus.overUnder25.prediction} (${consensus.overUnder25.confidence}%)`);
  console.log(`   BTTS: ${consensus.btts.prediction} (${consensus.btts.confidence}%)`);
  console.log(`   Risk Level: ${overallRisk.toUpperCase()}`);
  console.log('═'.repeat(60) + '\n');

  return {
    success: true,
    matchInfo: {
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      league: matchData.league,
      fixtureId: matchData.fixtureId,
      matchDate: matchData.matchDate
    },
    dataQuality,
    individualPredictions: predictions,
    conflictAnalysis,
    debates,
    dynamicWeights: allWeights,
    consensus,
    bestBets,
    riskAssessment: {
      overall: overallRisk,
      factors: riskFactors,
      warnings
    },
    modelsUsed,
    totalModels: modelsUsed.length,
    timing,
    analyzedAt: new Date().toISOString(),
    version: '2.0'
  };
}

// =========================
// EXPORTS
// =========================

export {
  runClaudeTactical,
  runGPT4Statistical,
  runGeminiPattern,
  runMistralContextual,
  buildTacticalPrompt,
  buildStatisticalPrompt,
  buildPatternPrompt,
  buildContextualPrompt,
  parseAIPrediction,
  buildConsensus
};

