// src/lib/heurist/agents/researchAgent.ts
// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH AGENT - Web Search Based Match Intelligence Gatherer
// ═══════════════════════════════════════════════════════════════════════════════
// PURPOSE: Collect real-time information about matches before analysis
// - Injury news and squad updates
// - Manager press conferences and tactics
// - Team morale and form news
// - Weather conditions and pitch status
// - Historical context and rivalry information
// ═══════════════════════════════════════════════════════════════════════════════

import { MatchData } from '../types';
import { getRedisClient, CACHE_KEYS, CACHE_TTL } from '../../cache/redis';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ==================== TYPES ====================

export interface ResearchData {
  injuries: {
    home: InjuryInfo[];
    away: InjuryInfo[];
    lastUpdated: string;
  };
  squadNews: {
    home: string;
    away: string;
    expectedLineups: {
      home: string[];
      away: string[];
    };
  };
  managerQuotes: {
    home: ManagerQuote[];
    away: ManagerQuote[];
  };
  teamMorale: {
    home: MoraleInfo;
    away: MoraleInfo;
  };
  tacticalInsights: {
    home: TacticalInfo;
    away: TacticalInfo;
    matchupAnalysis: string;
  };
  weatherImpact: WeatherInfo;
  matchContext: {
    importance: 'critical' | 'high' | 'normal' | 'low';
    stakes: string;
    recentHistory: string;
  };
  sources: string[];
  searchTimestamp: string;
  dataQuality: {
    score: number;
    homeDataFound: boolean;
    awayDataFound: boolean;
    freshness: 'fresh' | 'recent' | 'stale';
  };
}

interface InjuryInfo {
  player: string;
  status: 'out' | 'doubtful' | 'returning';
  reason?: string;
  expectedReturn?: string;
}

interface ManagerQuote {
  quote: string;
  topic: 'tactics' | 'squad' | 'opponent' | 'motivation' | 'general';
  sentiment: 'confident' | 'cautious' | 'concerned' | 'neutral';
}

interface MoraleInfo {
  level: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stable' | 'declining';
  factors: string[];
  recentResults: string;
}

interface TacticalInfo {
  expectedFormation: string;
  style: string;
  keyPlayers: string[];
  weaknesses: string[];
  recentChanges: string[];
}

interface WeatherInfo {
  conditions: string;
  temperature: string;
  impact: 'significant' | 'moderate' | 'minimal';
  notes: string;
}

// ==================== LANGUAGE DETECTION ====================

const TURKISH_TEAMS = [
  'fenerbahçe', 'galatasaray', 'beşiktaş', 'trabzonspor', 'başakşehir',
  'konyaspor', 'antalyaspor', 'alanyaspor', 'sivasspor', 'kasımpaşa',
  'kayserispor', 'gaziantep', 'hatayspor', 'adana demirspor', 'pendikspor',
  'samsunspor', 'rizespor', 'ankaragücü', 'göztepe', 'bodrum',
  'fenerbahce', 'besiktas', 'basaksehir', 'kasimpasa', 'ankaragucu'
];

const GERMAN_TEAMS = [
  'bayern', 'dortmund', 'leipzig', 'leverkusen', 'frankfurt', 'wolfsburg',
  'gladbach', 'hoffenheim', 'freiburg', 'köln', 'mainz', 'augsburg',
  'hertha', 'schalke', 'bremen', 'stuttgart', 'union berlin'
];

const SPANISH_TEAMS = [
  'real madrid', 'barcelona', 'atletico', 'sevilla', 'valencia', 'villarreal',
  'real sociedad', 'athletic bilbao', 'betis', 'celta', 'getafe', 'osasuna'
];

const ITALIAN_TEAMS = [
  'juventus', 'inter', 'milan', 'napoli', 'roma', 'lazio', 'atalanta',
  'fiorentina', 'torino', 'bologna', 'sassuolo', 'udinese', 'verona'
];

function detectSearchLanguage(teamName: string): 'tr' | 'de' | 'es' | 'it' | 'en' {
  const lower = teamName.toLowerCase();
  
  if (TURKISH_TEAMS.some(t => lower.includes(t))) return 'tr';
  if (GERMAN_TEAMS.some(t => lower.includes(t))) return 'de';
  if (SPANISH_TEAMS.some(t => lower.includes(t))) return 'es';
  if (ITALIAN_TEAMS.some(t => lower.includes(t))) return 'it';
  return 'en';
}

// ==================== PERPLEXITY SEARCH ====================

interface PerplexityResponse {
  content: string;
  citations: string[];
}

async function searchWithPerplexity(
  query: string,
  systemPrompt: string,
  timeout: number = 15000
): Promise<PerplexityResponse> {
  const apiKey = PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ PERPLEXITY_API_KEY not configured for Research Agent');
    return { content: '', citations: [] };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: 'week',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`❌ Perplexity API error: ${response.status}`);
      return { content: '', citations: [] };
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      citations: data.citations || []
    };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('⚠️ Perplexity search timeout');
    } else {
      console.error('❌ Perplexity exception:', error.message);
    }
    return { content: '', citations: [] };
  }
}

// ==================== SEARCH QUERIES ====================

interface SearchQueries {
  injuries: { query: string; system: string };
  tactics: { query: string; system: string };
  morale: { query: string; system: string };
}

function buildSearchQueries(
  homeTeam: string,
  awayTeam: string,
  league: string,
  matchDate: string,
  language: 'tr' | 'de' | 'es' | 'it' | 'en'
): SearchQueries {
  const queries = {
    tr: {
      injuries: {
        query: `${homeTeam} ${awayTeam} sakatlık kadro son haberler ${matchDate}`,
        system: `Sen bir futbol muhabirisin. ${homeTeam} vs ${awayTeam} maçı için sakatlık ve kadro haberlerini bul.

Şu bilgileri JSON formatında döndür:
{
  "homeInjuries": [{"player": "isim", "status": "out|doubtful|returning", "reason": "sebep"}],
  "awayInjuries": [{"player": "isim", "status": "out|doubtful|returning", "reason": "sebep"}],
  "homeSquadNews": "kadro haberleri",
  "awaySquadNews": "kadro haberleri"
}

Sadece son 48 saatteki haberleri kullan. Türkçe yanıt ver.`
      },
      tactics: {
        query: `${homeTeam} ${awayTeam} teknik direktör basın toplantısı taktik diziliş`,
        system: `Sen bir futbol taktik analistisin. ${homeTeam} vs ${awayTeam} maçı için taktik bilgileri bul.

JSON formatında döndür:
{
  "homeFormation": "beklenen diziliş",
  "awayFormation": "beklenen diziliş",
  "homeStyle": "oyun tarzı",
  "awayStyle": "oyun tarzı",
  "homeManagerQuotes": ["alıntı1", "alıntı2"],
  "awayManagerQuotes": ["alıntı1", "alıntı2"],
  "matchupAnalysis": "maç analizi"
}

Türkçe yanıt ver.`
      },
      morale: {
        query: `${homeTeam} ${awayTeam} takım morali form son maçlar`,
        system: `Sen bir spor psikoloğusun. ${homeTeam} vs ${awayTeam} takımlarının moral durumunu analiz et.

JSON formatında döndür:
{
  "homeMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["faktör1"], "recentResults": "son sonuçlar"},
  "awayMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["faktör1"], "recentResults": "son sonuçlar"},
  "matchImportance": "critical|high|normal|low",
  "stakes": "maçın önemi"
}

Türkçe yanıt ver.`
      }
    },
    en: {
      injuries: {
        query: `${homeTeam} vs ${awayTeam} injury news squad lineup ${matchDate}`,
        system: `You are a football journalist. Find injury and squad news for ${homeTeam} vs ${awayTeam}.

Return in JSON format:
{
  "homeInjuries": [{"player": "name", "status": "out|doubtful|returning", "reason": "reason"}],
  "awayInjuries": [{"player": "name", "status": "out|doubtful|returning", "reason": "reason"}],
  "homeSquadNews": "squad news",
  "awaySquadNews": "squad news"
}

Use only news from the last 48 hours.`
      },
      tactics: {
        query: `${homeTeam} ${awayTeam} manager press conference tactics formation`,
        system: `You are a football tactics analyst. Find tactical information for ${homeTeam} vs ${awayTeam}.

Return in JSON format:
{
  "homeFormation": "expected formation",
  "awayFormation": "expected formation",
  "homeStyle": "playing style",
  "awayStyle": "playing style",
  "homeManagerQuotes": ["quote1", "quote2"],
  "awayManagerQuotes": ["quote1", "quote2"],
  "matchupAnalysis": "tactical matchup analysis"
}`
      },
      morale: {
        query: `${homeTeam} ${awayTeam} team morale form recent matches`,
        system: `You are a sports psychologist. Analyze the morale of ${homeTeam} and ${awayTeam}.

Return in JSON format:
{
  "homeMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["factor1"], "recentResults": "recent results"},
  "awayMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["factor1"], "recentResults": "recent results"},
  "matchImportance": "critical|high|normal|low",
  "stakes": "match importance"
}`
      }
    },
    de: {
      injuries: {
        query: `${homeTeam} ${awayTeam} Verletzungen Kader Aufstellung Nachrichten`,
        system: `Du bist ein Fußballjournalist. Finde Verletzungs- und Kadernachrichten für ${homeTeam} vs ${awayTeam}.

Antworte im JSON-Format:
{
  "homeInjuries": [{"player": "Name", "status": "out|doubtful|returning", "reason": "Grund"}],
  "awayInjuries": [{"player": "Name", "status": "out|doubtful|returning", "reason": "Grund"}],
  "homeSquadNews": "Kadernachrichten",
  "awaySquadNews": "Kadernachrichten"
}

Nur Nachrichten der letzten 48 Stunden. Antworte auf Deutsch.`
      },
      tactics: {
        query: `${homeTeam} ${awayTeam} Trainer Pressekonferenz Taktik Formation`,
        system: `Du bist ein Taktikanalyst. Finde taktische Informationen für ${homeTeam} vs ${awayTeam}.

JSON-Format:
{
  "homeFormation": "erwartete Formation",
  "awayFormation": "erwartete Formation",
  "homeStyle": "Spielstil",
  "awayStyle": "Spielstil",
  "homeManagerQuotes": ["Zitat1", "Zitat2"],
  "awayManagerQuotes": ["Zitat1", "Zitat2"],
  "matchupAnalysis": "taktische Analyse"
}

Antworte auf Deutsch.`
      },
      morale: {
        query: `${homeTeam} ${awayTeam} Mannschaft Moral Form letzte Spiele`,
        system: `Du bist ein Sportpsychologe. Analysiere die Moral von ${homeTeam} und ${awayTeam}.

JSON-Format:
{
  "homeMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["Faktor1"], "recentResults": "letzte Ergebnisse"},
  "awayMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["Faktor1"], "recentResults": "letzte Ergebnisse"},
  "matchImportance": "critical|high|normal|low",
  "stakes": "Spielbedeutung"
}

Antworte auf Deutsch.`
      }
    },
    es: {
      injuries: {
        query: `${homeTeam} ${awayTeam} lesiones plantilla alineación noticias`,
        system: `Eres un periodista deportivo. Encuentra noticias de lesiones y plantilla para ${homeTeam} vs ${awayTeam}.

Responde en formato JSON:
{
  "homeInjuries": [{"player": "nombre", "status": "out|doubtful|returning", "reason": "razón"}],
  "awayInjuries": [{"player": "nombre", "status": "out|doubtful|returning", "reason": "razón"}],
  "homeSquadNews": "noticias de plantilla",
  "awaySquadNews": "noticias de plantilla"
}

Solo noticias de las últimas 48 horas. Responde en español.`
      },
      tactics: {
        query: `${homeTeam} ${awayTeam} entrenador rueda prensa táctica formación`,
        system: `Eres un analista táctico. Encuentra información táctica para ${homeTeam} vs ${awayTeam}.

Formato JSON:
{
  "homeFormation": "formación esperada",
  "awayFormation": "formación esperada",
  "homeStyle": "estilo de juego",
  "awayStyle": "estilo de juego",
  "homeManagerQuotes": ["cita1", "cita2"],
  "awayManagerQuotes": ["cita1", "cita2"],
  "matchupAnalysis": "análisis táctico"
}

Responde en español.`
      },
      morale: {
        query: `${homeTeam} ${awayTeam} moral equipo forma últimos partidos`,
        system: `Eres un psicólogo deportivo. Analiza la moral de ${homeTeam} y ${awayTeam}.

Formato JSON:
{
  "homeMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["factor1"], "recentResults": "últimos resultados"},
  "awayMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["factor1"], "recentResults": "últimos resultados"},
  "matchImportance": "critical|high|normal|low",
  "stakes": "importancia del partido"
}

Responde en español.`
      }
    },
    it: {
      injuries: {
        query: `${homeTeam} ${awayTeam} infortuni rosa formazione notizie`,
        system: `Sei un giornalista sportivo. Trova notizie su infortuni e rosa per ${homeTeam} vs ${awayTeam}.

Rispondi in formato JSON:
{
  "homeInjuries": [{"player": "nome", "status": "out|doubtful|returning", "reason": "motivo"}],
  "awayInjuries": [{"player": "nome", "status": "out|doubtful|returning", "reason": "motivo"}],
  "homeSquadNews": "notizie sulla rosa",
  "awaySquadNews": "notizie sulla rosa"
}

Solo notizie delle ultime 48 ore. Rispondi in italiano.`
      },
      tactics: {
        query: `${homeTeam} ${awayTeam} allenatore conferenza stampa tattica formazione`,
        system: `Sei un analista tattico. Trova informazioni tattiche per ${homeTeam} vs ${awayTeam}.

Formato JSON:
{
  "homeFormation": "formazione prevista",
  "awayFormation": "formazione prevista",
  "homeStyle": "stile di gioco",
  "awayStyle": "stile di gioco",
  "homeManagerQuotes": ["citazione1", "citazione2"],
  "awayManagerQuotes": ["citazione1", "citazione2"],
  "matchupAnalysis": "analisi tattica"
}

Rispondi in italiano.`
      },
      morale: {
        query: `${homeTeam} ${awayTeam} morale squadra forma ultime partite`,
        system: `Sei uno psicologo sportivo. Analizza il morale di ${homeTeam} e ${awayTeam}.

Formato JSON:
{
  "homeMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["fattore1"], "recentResults": "ultimi risultati"},
  "awayMorale": {"level": "high|medium|low", "trend": "improving|stable|declining", "factors": ["fattore1"], "recentResults": "ultimi risultati"},
  "matchImportance": "critical|high|normal|low",
  "stakes": "importanza della partita"
}

Rispondi in italiano.`
      }
    }
  };

  return queries[language] || queries.en;
}

// ==================== JSON PARSING ====================

function safeJsonParse<T>(content: string, fallback: T): T {
  try {
    // Try to extract JSON from the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ==================== RESULT PROCESSING ====================

interface InjuriesSearchResult {
  homeInjuries: Array<{ player: string; status: string; reason?: string }>;
  awayInjuries: Array<{ player: string; status: string; reason?: string }>;
  homeSquadNews: string;
  awaySquadNews: string;
}

interface TacticsSearchResult {
  homeFormation: string;
  awayFormation: string;
  homeStyle: string;
  awayStyle: string;
  homeManagerQuotes: string[];
  awayManagerQuotes: string[];
  matchupAnalysis: string;
}

interface MoraleSearchResult {
  homeMorale: { level: string; trend: string; factors: string[]; recentResults: string };
  awayMorale: { level: string; trend: string; factors: string[]; recentResults: string };
  matchImportance: string;
  stakes: string;
}

function processInjuriesResult(result: PerplexityResponse): InjuriesSearchResult {
  const defaultResult: InjuriesSearchResult = {
    homeInjuries: [],
    awayInjuries: [],
    homeSquadNews: '',
    awaySquadNews: ''
  };
  
  if (!result.content) return defaultResult;
  
  return safeJsonParse(result.content, defaultResult);
}

function processTacticsResult(result: PerplexityResponse): TacticsSearchResult {
  const defaultResult: TacticsSearchResult = {
    homeFormation: '',
    awayFormation: '',
    homeStyle: '',
    awayStyle: '',
    homeManagerQuotes: [],
    awayManagerQuotes: [],
    matchupAnalysis: ''
  };
  
  if (!result.content) return defaultResult;
  
  return safeJsonParse(result.content, defaultResult);
}

function processMoraleResult(result: PerplexityResponse): MoraleSearchResult {
  const defaultResult: MoraleSearchResult = {
    homeMorale: { level: 'medium', trend: 'stable', factors: [], recentResults: '' },
    awayMorale: { level: 'medium', trend: 'stable', factors: [], recentResults: '' },
    matchImportance: 'normal',
    stakes: ''
  };
  
  if (!result.content) return defaultResult;
  
  return safeJsonParse(result.content, defaultResult);
}

// ==================== BUILD RESEARCH DATA ====================

function buildResearchData(
  injuriesData: InjuriesSearchResult,
  tacticsData: TacticsSearchResult,
  moraleData: MoraleSearchResult,
  allCitations: string[]
): ResearchData {
  
  // Convert injuries to proper format
  const homeInjuries: InjuryInfo[] = (injuriesData.homeInjuries || []).map(inj => ({
    player: inj.player || 'Unknown',
    status: (inj.status as 'out' | 'doubtful' | 'returning') || 'doubtful',
    reason: inj.reason
  }));
  
  const awayInjuries: InjuryInfo[] = (injuriesData.awayInjuries || []).map(inj => ({
    player: inj.player || 'Unknown',
    status: (inj.status as 'out' | 'doubtful' | 'returning') || 'doubtful',
    reason: inj.reason
  }));
  
  // Convert manager quotes
  const homeManagerQuotes: ManagerQuote[] = (tacticsData.homeManagerQuotes || []).map(quote => ({
    quote,
    topic: 'general' as const,
    sentiment: 'neutral' as const
  }));
  
  const awayManagerQuotes: ManagerQuote[] = (tacticsData.awayManagerQuotes || []).map(quote => ({
    quote,
    topic: 'general' as const,
    sentiment: 'neutral' as const
  }));
  
  // Build morale info
  const homeMorale: MoraleInfo = {
    level: (moraleData.homeMorale?.level as 'high' | 'medium' | 'low') || 'medium',
    trend: (moraleData.homeMorale?.trend as 'improving' | 'stable' | 'declining') || 'stable',
    factors: moraleData.homeMorale?.factors || [],
    recentResults: moraleData.homeMorale?.recentResults || ''
  };
  
  const awayMorale: MoraleInfo = {
    level: (moraleData.awayMorale?.level as 'high' | 'medium' | 'low') || 'medium',
    trend: (moraleData.awayMorale?.trend as 'improving' | 'stable' | 'declining') || 'stable',
    factors: moraleData.awayMorale?.factors || [],
    recentResults: moraleData.awayMorale?.recentResults || ''
  };
  
  // Build tactical info
  const homeTactical: TacticalInfo = {
    expectedFormation: tacticsData.homeFormation || 'Unknown',
    style: tacticsData.homeStyle || 'Unknown',
    keyPlayers: [],
    weaknesses: [],
    recentChanges: []
  };
  
  const awayTactical: TacticalInfo = {
    expectedFormation: tacticsData.awayFormation || 'Unknown',
    style: tacticsData.awayStyle || 'Unknown',
    keyPlayers: [],
    weaknesses: [],
    recentChanges: []
  };
  
  // Calculate data quality
  const hasHomeData = homeInjuries.length > 0 || injuriesData.homeSquadNews.length > 0 || homeMorale.factors.length > 0;
  const hasAwayData = awayInjuries.length > 0 || injuriesData.awaySquadNews.length > 0 || awayMorale.factors.length > 0;
  
  let qualityScore = 0;
  if (hasHomeData) qualityScore += 25;
  if (hasAwayData) qualityScore += 25;
  if (tacticsData.matchupAnalysis) qualityScore += 25;
  if (allCitations.length > 0) qualityScore += 25;
  
  return {
    injuries: {
      home: homeInjuries,
      away: awayInjuries,
      lastUpdated: new Date().toISOString()
    },
    squadNews: {
      home: injuriesData.homeSquadNews || '',
      away: injuriesData.awaySquadNews || '',
      expectedLineups: {
        home: [],
        away: []
      }
    },
    managerQuotes: {
      home: homeManagerQuotes,
      away: awayManagerQuotes
    },
    teamMorale: {
      home: homeMorale,
      away: awayMorale
    },
    tacticalInsights: {
      home: homeTactical,
      away: awayTactical,
      matchupAnalysis: tacticsData.matchupAnalysis || ''
    },
    weatherImpact: {
      conditions: '',
      temperature: '',
      impact: 'minimal',
      notes: ''
    },
    matchContext: {
      importance: (moraleData.matchImportance as 'critical' | 'high' | 'normal' | 'low') || 'normal',
      stakes: moraleData.stakes || '',
      recentHistory: ''
    },
    sources: [...new Set(allCitations)].slice(0, 10),
    searchTimestamp: new Date().toISOString(),
    dataQuality: {
      score: qualityScore,
      homeDataFound: hasHomeData,
      awayDataFound: hasAwayData,
      freshness: qualityScore >= 50 ? 'fresh' : qualityScore >= 25 ? 'recent' : 'stale'
    }
  };
}

// ==================== DEFAULT RESEARCH DATA ====================

function createDefaultResearchData(): ResearchData {
  return {
    injuries: {
      home: [],
      away: [],
      lastUpdated: new Date().toISOString()
    },
    squadNews: {
      home: '',
      away: '',
      expectedLineups: { home: [], away: [] }
    },
    managerQuotes: {
      home: [],
      away: []
    },
    teamMorale: {
      home: { level: 'medium', trend: 'stable', factors: [], recentResults: '' },
      away: { level: 'medium', trend: 'stable', factors: [], recentResults: '' }
    },
    tacticalInsights: {
      home: { expectedFormation: '', style: '', keyPlayers: [], weaknesses: [], recentChanges: [] },
      away: { expectedFormation: '', style: '', keyPlayers: [], weaknesses: [], recentChanges: [] },
      matchupAnalysis: ''
    },
    weatherImpact: {
      conditions: '',
      temperature: '',
      impact: 'minimal',
      notes: ''
    },
    matchContext: {
      importance: 'normal',
      stakes: '',
      recentHistory: ''
    },
    sources: [],
    searchTimestamp: new Date().toISOString(),
    dataQuality: {
      score: 0,
      homeDataFound: false,
      awayDataFound: false,
      freshness: 'stale'
    }
  };
}

// ==================== MAIN FUNCTION ====================

export async function runResearchAgent(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<ResearchData> {
  console.log('\n🔬 RESEARCH AGENT STARTING');
  console.log('═'.repeat(50));
  console.log(`   🔍 Researching: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`   🌐 Language: ${language.toUpperCase()}`);
  
  const startTime = Date.now();
  const fixtureId = matchData.fixtureId;
  
  // 🆕 CACHE CHECK - Research sonuçları 2 saat cache'lenir
  if (fixtureId) {
    try {
      const redis = getRedisClient();
      const cacheKey = CACHE_KEYS.RESEARCH(fixtureId);
      const cached = await redis.get<ResearchData>(cacheKey);
      
      if (cached) {
        console.log(`   📦 CACHE HIT - Returning cached research data`);
        console.log('═'.repeat(50));
        return cached;
      }
      console.log(`   📦 CACHE MISS - Running fresh research`);
    } catch (cacheError) {
      console.log(`   ⚠️ Cache check failed, continuing with fresh research`);
    }
  }
  
  // Check if Perplexity is configured
  if (!PERPLEXITY_API_KEY) {
    console.log('   ⚠️ PERPLEXITY_API_KEY not configured - returning empty research data');
    console.log('═'.repeat(50));
    return createDefaultResearchData();
  }
  
  // Detect search language based on teams
  const homeSearchLang = detectSearchLanguage(matchData.homeTeam);
  const awaySearchLang = detectSearchLanguage(matchData.awayTeam);
  const searchLang = homeSearchLang !== 'en' ? homeSearchLang : awaySearchLang !== 'en' ? awaySearchLang : language;
  
  console.log(`   🗣️ Search language: ${searchLang.toUpperCase()}`);
  
  // Build search queries
  const matchDate = matchData.date || new Date().toISOString().split('T')[0];
  const queries = buildSearchQueries(
    matchData.homeTeam,
    matchData.awayTeam,
    matchData.league || '',
    matchDate,
    searchLang as 'tr' | 'de' | 'es' | 'it' | 'en'
  );
  
  // Execute all searches in parallel
  console.log('   📡 Executing parallel searches...');
  
  const [injuriesResult, tacticsResult, moraleResult] = await Promise.all([
    searchWithPerplexity(queries.injuries.query, queries.injuries.system),
    searchWithPerplexity(queries.tactics.query, queries.tactics.system),
    searchWithPerplexity(queries.morale.query, queries.morale.system)
  ]);
  
  // Process results
  const injuriesData = processInjuriesResult(injuriesResult);
  const tacticsData = processTacticsResult(tacticsResult);
  const moraleData = processMoraleResult(moraleResult);
  
  // Collect all citations
  const allCitations = [
    ...injuriesResult.citations,
    ...tacticsResult.citations,
    ...moraleResult.citations
  ];
  
  // Build final research data
  const researchData = buildResearchData(injuriesData, tacticsData, moraleData, allCitations);
  
  const elapsed = Date.now() - startTime;
  
  // Log results
  console.log('\n📊 RESEARCH RESULTS:');
  console.log(`   🏠 ${matchData.homeTeam}:`);
  console.log(`      Injuries: ${researchData.injuries.home.length} found`);
  console.log(`      Morale: ${researchData.teamMorale.home.level} (${researchData.teamMorale.home.trend})`);
  console.log(`      Formation: ${researchData.tacticalInsights.home.expectedFormation || 'Unknown'}`);
  console.log(`   🚌 ${matchData.awayTeam}:`);
  console.log(`      Injuries: ${researchData.injuries.away.length} found`);
  console.log(`      Morale: ${researchData.teamMorale.away.level} (${researchData.teamMorale.away.trend})`);
  console.log(`      Formation: ${researchData.tacticalInsights.away.expectedFormation || 'Unknown'}`);
  console.log(`   📰 Sources: ${researchData.sources.length} citations`);
  console.log(`   📈 Data Quality: ${researchData.dataQuality.score}%`);
  console.log(`   ⏱️ Completed in ${elapsed}ms`);
  
  // 🆕 CACHE SAVE - Research sonuçlarını 2 saat cache'le
  if (fixtureId && researchData.dataQuality.score > 0) {
    try {
      const redis = getRedisClient();
      const cacheKey = CACHE_KEYS.RESEARCH(fixtureId);
      await redis.set(cacheKey, researchData, { ex: CACHE_TTL.RESEARCH });
      console.log(`   📦 Research data cached for 2 hours`);
    } catch (cacheError) {
      console.log(`   ⚠️ Failed to cache research data`);
    }
  }
  
  console.log('═'.repeat(50));
  
  return researchData;
}

// ==================== EXPORT DEFAULT ====================

export default runResearchAgent;
