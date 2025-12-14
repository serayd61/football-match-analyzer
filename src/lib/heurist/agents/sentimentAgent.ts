// src/lib/heurist/agents/sentimentAgent.ts
// Advanced Sentiment Analysis Agent with Perplexity Pro

import { MatchData } from '../types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ==================== ENHANCED TYPES (EXPORTED) ====================

export interface TeamSentiment {
  // Temel skorlar
  morale: number;           // 1-10
  motivation: number;       // 1-10
  preparation: number;      // 1-10
  confidence: number;       // 1-10 (takımın kendine güveni)
  teamChemistry: number;    // 1-10 (takım uyumu)
  
  // Olumlu ve olumsuz faktörler (AYRI AYRI)
  positives: string[];      // Olumlu haberler/faktörler
  negatives: string[];      // Olumsuz haberler/faktörler
  
  // Sakatlık detayları
  injuries: {
    out: string[];          // Kesin oynamayacaklar
    doubtful: string[];     // Şüpheli
    returning: string[];    // Sakatlıktan dönenler
    impact: number;         // -5 to 0
  };
  
  // Genel bakış açısı
  outlook: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  outlookReasoning: string;
  
  // Maça özel motivasyon
  matchMotivation: {
    level: 'critical' | 'high' | 'normal' | 'low';
    reasons: string[];
  };
  
  // Basın/Medya sentiment
  mediaSentiment: {
    tone: 'optimistic' | 'neutral' | 'pessimistic' | 'critical';
    headlines: string[];
  };
  
  // Teknik direktör durumu
  managerSituation: {
    pressure: 'high' | 'medium' | 'low';
    recentComments: string[];
    tacticalChanges: string[];
  };
  
  // Taraftar etkisi
  fanFactor: {
    support: 'strong' | 'normal' | 'weak' | 'hostile';
    recentEvents: string[];
  };
}

export interface MatchContext {
  type: 'derby' | 'title_race' | 'relegation_battle' | 'european_qualification' | 'cup_final' | 'regular';
  importance: number;  // 1-10
  stakes: string;
  historicalRivalry: string;
}

export interface SentimentResult {
  homeTeam: TeamSentiment;
  awayTeam: TeamSentiment;
  
  matchContext: MatchContext;
  
  headToHeadPsychology: {
    dominantTeam: 'home' | 'away' | 'neutral';
    reasoning: string;
    mentalEdgeScore: number; // -10 to +10 (positive = home advantage)
  };
  
  psychologicalEdge: {
    team: 'home' | 'away' | 'neutral';
    confidence: number;
    reasoning: string;
    keyFactors: string[];
  };
  
  predictions: {
    expectedGoals: 'high' | 'medium' | 'low';
    expectedTempo: 'fast' | 'normal' | 'slow';
    likelyScenario: string;
  };
  
  criticalWarnings: string[];
  keyInsights: string[];
  agentSummary: string;
  
  dataQuality: {
    homeNewsFound: boolean;
    awayNewsFound: boolean;
    freshness: 'last_24h' | 'last_48h' | 'older' | 'none';
    confidence: number;
  };
}

// ==================== PERPLEXITY QUERIES ====================

async function searchWithPerplexity(query: string, systemPrompt: string): Promise<{ content: string; citations: string[] }> {
  if (!PERPLEXITY_API_KEY) {
    return { content: '', citations: [] };
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro', // Pro model for better results
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 1500,
        temperature: 0.2,
        return_citations: true,
        search_recency_filter: 'week', // Son 1 hafta
      }),
    });

    if (!response.ok) {
      console.log(`❌ Perplexity error: ${response.status}`);
      return { content: '', citations: [] };
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      citations: data.citations || []
    };
  } catch (error) {
    console.error('❌ Perplexity exception:', error);
    return { content: '', citations: [] };
  }
}

// Takım haberleri - kapsamlı arama
async function fetchTeamNews(teamName: string, league: string): Promise<{
  general: string;
  injuries: string;
  manager: string;
  transfers: string;
}> {
  const today = new Date().toISOString().split('T')[0];
  
  // Paralel sorgular - farklı konular için
  const [generalNews, injuryNews, managerNews, transferNews] = await Promise.all([
    // 1. Genel haberler ve moral
    searchWithPerplexity(
      `${teamName} football news last 48 hours match preview team news ${today}`,
      `You are a football news researcher. Find the latest news about ${teamName} from the last 48 hours. Focus on:
      - Team morale and confidence
      - Recent match results and reactions
      - Fan sentiment and support
      - Any internal team issues or positive developments
      Return a concise summary of findings. If no recent news found, say "No recent news available".`
    ),
    
    // 2. Sakatlık haberleri
    searchWithPerplexity(
      `${teamName} injury news squad update team news ${today}`,
      `You are a football injury analyst. Find injury updates for ${teamName}:
      - Players confirmed OUT
      - Players marked as DOUBTFUL
      - Players RETURNING from injury
      - Any fitness concerns
      Be specific with player names. If no injury news, say "No injury updates available".`
    ),
    
    // 3. Teknik direktör ve taktik
    searchWithPerplexity(
      `${teamName} manager coach press conference tactics ${today}`,
      `You are a football tactics analyst. Find information about ${teamName}'s manager:
      - Recent press conference quotes
      - Tactical plans or changes mentioned
      - Pressure level (job security)
      - Team selection hints
      If no manager news, say "No manager updates available".`
    ),
    
    // 4. Transfer ve sözleşme haberleri
    searchWithPerplexity(
      `${teamName} transfer news contract rumors ${today}`,
      `You are a football transfer specialist. Find transfer-related news for ${teamName}:
      - Active transfer rumors (incoming/outgoing)
      - Contract disputes or negotiations
      - Player unhappiness or transfer requests
      - Any distractions from transfers
      If no transfer news, say "No transfer updates available".`
    )
  ]);

  return {
    general: generalNews.content,
    injuries: injuryNews.content,
    manager: managerNews.content,
    transfers: transferNews.content
  };
}

// Maç bağlamı araştırması
async function fetchMatchContext(homeTeam: string, awayTeam: string, league: string): Promise<string> {
  const result = await searchWithPerplexity(
    `${homeTeam} vs ${awayTeam} ${league} match preview importance rivalry history`,
    `You are a football match analyst. Analyze the upcoming match between ${homeTeam} and ${awayTeam}:
    - Is this a derby or rivalry match?
    - What's at stake? (title race, relegation, European spots)
    - Historical significance between these teams
    - Recent head-to-head psychological factors
    - Any special circumstances (revenge match, manager return, etc.)
    Provide context that affects team motivation and psychology.`
  );
  
  return result.content;
}

// ==================== ANALYSIS FUNCTIONS ====================

async function analyzeTeamSentiment(
  teamName: string,
  news: { general: string; injuries: string; manager: string; transfers: string },
  isHome: boolean
): Promise<TeamSentiment> {
  
  const analysisPrompt = `Analyze the psychological state of ${teamName} based on these news reports:

GENERAL NEWS:
${news.general || 'No data'}

INJURY NEWS:
${news.injuries || 'No data'}

MANAGER NEWS:
${news.manager || 'No data'}

TRANSFER NEWS:
${news.transfers || 'No data'}

Respond ONLY in this exact JSON format:
{
  "morale": <1-10>,
  "motivation": <1-10>,
  "preparation": <1-10>,
  "confidence": <1-10>,
  "teamChemistry": <1-10>,
  "positives": ["positive factor 1", "positive factor 2"],
  "negatives": ["negative factor 1", "negative factor 2"],
  "injuries": {
    "out": ["player names definitely out"],
    "doubtful": ["player names doubtful"],
    "returning": ["player names returning"],
    "impact": <-5 to 0>
  },
  "outlook": "<very_positive|positive|neutral|negative|very_negative>",
  "outlookReasoning": "explanation",
  "matchMotivation": {
    "level": "<critical|high|normal|low>",
    "reasons": ["reason 1", "reason 2"]
  },
  "mediaSentiment": {
    "tone": "<optimistic|neutral|pessimistic|critical>",
    "headlines": ["headline 1", "headline 2"]
  },
  "managerSituation": {
    "pressure": "<high|medium|low>",
    "recentComments": ["quote or comment"],
    "tacticalChanges": ["any tactical news"]
  },
  "fanFactor": {
    "support": "<strong|normal|weak|hostile>",
    "recentEvents": ["fan-related news"]
  }
}`;

  const result = await searchWithPerplexity(analysisPrompt, 
    'You are a football psychology expert. Analyze team sentiment objectively. Return ONLY valid JSON.');
  
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...getDefaultTeamSentiment(),
        ...parsed
      };
    }
  } catch (e) {
    console.log(`⚠️ Could not parse sentiment for ${teamName}`);
  }
  
  return getDefaultTeamSentiment();
}

function getDefaultTeamSentiment(): TeamSentiment {
  return {
    morale: 6,
    motivation: 6,
    preparation: 6,
    confidence: 6,
    teamChemistry: 6,
    positives: [],
    negatives: [],
    injuries: { out: [], doubtful: [], returning: [], impact: 0 },
    outlook: 'neutral',
    outlookReasoning: 'Insufficient data for analysis',
    matchMotivation: { level: 'normal', reasons: [] },
    mediaSentiment: { tone: 'neutral', headlines: [] },
    managerSituation: { pressure: 'medium', recentComments: [], tacticalChanges: [] },
    fanFactor: { support: 'normal', recentEvents: [] }
  };
}

function calculatePsychologicalEdge(
  home: TeamSentiment,
  away: TeamSentiment,
  matchContext: MatchContext
): SentimentResult['psychologicalEdge'] {
  
  // Hesaplama faktörleri
  const homeScore = 
    home.morale * 1.2 +
    home.motivation * 1.3 +
    home.preparation * 1.0 +
    home.confidence * 1.1 +
    home.teamChemistry * 0.8 +
    home.injuries.impact * 2 +
    (home.positives.length * 2) -
    (home.negatives.length * 2) +
    (home.fanFactor.support === 'strong' ? 3 : home.fanFactor.support === 'hostile' ? -3 : 0) +
    5; // Ev sahibi avantajı
  
  const awayScore = 
    away.morale * 1.2 +
    away.motivation * 1.3 +
    away.preparation * 1.0 +
    away.confidence * 1.1 +
    away.teamChemistry * 0.8 +
    away.injuries.impact * 2 +
    (away.positives.length * 2) -
    (away.negatives.length * 2);
  
  const diff = homeScore - awayScore;
  const keyFactors: string[] = [];
  
  // Key faktörleri belirle
  if (home.morale > away.morale + 2) keyFactors.push('Home team has significantly better morale');
  if (away.morale > home.morale + 2) keyFactors.push('Away team has significantly better morale');
  if (home.injuries.impact < -2) keyFactors.push('Home team hit by injuries');
  if (away.injuries.impact < -2) keyFactors.push('Away team hit by injuries');
  if (home.managerSituation.pressure === 'high') keyFactors.push('Home manager under pressure');
  if (away.managerSituation.pressure === 'high') keyFactors.push('Away manager under pressure');
  if (home.negatives.length > 3) keyFactors.push('Multiple concerns for home team');
  if (away.negatives.length > 3) keyFactors.push('Multiple concerns for away team');
  if (matchContext.type === 'derby') keyFactors.push('Derby atmosphere adds pressure');
  
  let team: 'home' | 'away' | 'neutral';
  let confidence: number;
  
  if (diff > 8) {
    team = 'home';
    confidence = Math.min(85, 60 + diff);
  } else if (diff > 4) {
    team = 'home';
    confidence = 55 + diff;
  } else if (diff < -8) {
    team = 'away';
    confidence = Math.min(85, 60 + Math.abs(diff));
  } else if (diff < -4) {
    team = 'away';
    confidence = 55 + Math.abs(diff);
  } else {
    team = 'neutral';
    confidence = 50;
  }
  
  return {
    team,
    confidence: Math.round(confidence),
    reasoning: generateEdgeReasoning(home, away, team, diff),
    keyFactors
  };
}

function generateEdgeReasoning(
  home: TeamSentiment,
  away: TeamSentiment,
  edge: 'home' | 'away' | 'neutral',
  diff: number
): string {
  if (edge === 'home') {
    const reasons: string[] = [];
    if (home.morale > away.morale) reasons.push('better morale');
    if (home.confidence > away.confidence) reasons.push('higher confidence');
    if (home.positives.length > away.positives.length) reasons.push('more positive news');
    if (away.negatives.length > home.negatives.length) reasons.push('opposition has more concerns');
    if (home.fanFactor.support === 'strong') reasons.push('strong fan support');
    return `Home team has psychological advantage: ${reasons.join(', ')}.`;
  } else if (edge === 'away') {
    const reasons: string[] = [];
    if (away.morale > home.morale) reasons.push('better morale');
    if (away.confidence > home.confidence) reasons.push('higher confidence');
    if (away.positives.length > home.positives.length) reasons.push('more positive momentum');
    if (home.negatives.length > away.negatives.length) reasons.push('hosts have more concerns');
    return `Away team has psychological advantage: ${reasons.join(', ')}.`;
  } else {
    return 'Both teams are psychologically balanced. No clear mental edge.';
  }
}

function analyzeMatchContext(contextNews: string, homeTeam: string, awayTeam: string): MatchContext {
  const lower = contextNews.toLowerCase();
  
  let type: MatchContext['type'] = 'regular';
  let importance = 5;
  let stakes = 'Regular league fixture';
  
  if (lower.includes('derby') || lower.includes('rival') || lower.includes('clasico')) {
    type = 'derby';
    importance = 9;
    stakes = 'Derby match - high emotions and intensity expected';
  } else if (lower.includes('title') || lower.includes('championship') || lower.includes('first place')) {
    type = 'title_race';
    importance = 9;
    stakes = 'Title race implications - both teams highly motivated';
  } else if (lower.includes('relegation') || lower.includes('survival') || lower.includes('drop zone')) {
    type = 'relegation_battle';
    importance = 10;
    stakes = 'Relegation battle - desperation factor';
  } else if (lower.includes('europe') || lower.includes('champions league') || lower.includes('europa')) {
    type = 'european_qualification';
    importance = 8;
    stakes = 'European qualification at stake';
  } else if (lower.includes('cup final') || lower.includes('final')) {
    type = 'cup_final';
    importance = 10;
    stakes = 'Cup final - winner takes all';
  }
  
  return {
    type,
    importance,
    stakes,
    historicalRivalry: contextNews.includes('history') ? 'Significant historical rivalry' : 'No major historical rivalry'
  };
}

// ==================== MAIN FUNCTION ====================

export async function runSentimentAgent(matchData: MatchData): Promise<SentimentResult> {
  console.log('\n🧠 SENTIMENT AGENT STARTING');
  console.log('═'.repeat(50));
  console.log(`   📰 Analyzing: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  
  const startTime = Date.now();
  
  // 1. Paralel haber toplama
  console.log('   📡 Fetching news from multiple sources...');
  const [homeNews, awayNews, contextNews] = await Promise.all([
    fetchTeamNews(matchData.homeTeam, matchData.league || ''),
    fetchTeamNews(matchData.awayTeam, matchData.league || ''),
    fetchMatchContext(matchData.homeTeam, matchData.awayTeam, matchData.league || '')
  ]);
  
  const newsTime = Date.now() - startTime;
  console.log(`   ✅ News fetched in ${newsTime}ms`);
  
  // 2. Her takım için sentiment analizi
  console.log('   🔍 Analyzing team sentiments...');
  const [homeSentiment, awaySentiment] = await Promise.all([
    analyzeTeamSentiment(matchData.homeTeam, homeNews, true),
    analyzeTeamSentiment(matchData.awayTeam, awayNews, false)
  ]);
  
  // 3. Maç bağlamı analizi
  const matchContext = analyzeMatchContext(contextNews, matchData.homeTeam, matchData.awayTeam);
  
  // 4. Psikolojik avantaj hesaplama
  const psychologicalEdge = calculatePsychologicalEdge(homeSentiment, awaySentiment, matchContext);
  
  // 5. Kritik uyarılar
  const criticalWarnings: string[] = [];
  
  // Ev sahibi uyarıları
  if (homeSentiment.injuries.out.length >= 2) {
    criticalWarnings.push(`⚠️ ${matchData.homeTeam}: ${homeSentiment.injuries.out.length} key players OUT`);
  }
  if (homeSentiment.managerSituation.pressure === 'high') {
    criticalWarnings.push(`⚠️ ${matchData.homeTeam} manager under serious pressure`);
  }
  if (homeSentiment.negatives.length > homeSentiment.positives.length + 2) {
    criticalWarnings.push(`⚠️ ${matchData.homeTeam} surrounded by negative news`);
  }
  
  // Deplasman uyarıları
  if (awaySentiment.injuries.out.length >= 2) {
    criticalWarnings.push(`⚠️ ${matchData.awayTeam}: ${awaySentiment.injuries.out.length} key players OUT`);
  }
  if (awaySentiment.managerSituation.pressure === 'high') {
    criticalWarnings.push(`⚠️ ${matchData.awayTeam} manager under serious pressure`);
  }
  if (awaySentiment.negatives.length > awaySentiment.positives.length + 2) {
    criticalWarnings.push(`⚠️ ${matchData.awayTeam} surrounded by negative news`);
  }
  
  // 6. Key insights
  const keyInsights: string[] = [];
  
  if (homeSentiment.positives.length > 0) {
    keyInsights.push(`🟢 ${matchData.homeTeam}: ${homeSentiment.positives[0]}`);
  }
  if (awaySentiment.positives.length > 0) {
    keyInsights.push(`🟢 ${matchData.awayTeam}: ${awaySentiment.positives[0]}`);
  }
  if (homeSentiment.negatives.length > 0) {
    keyInsights.push(`🔴 ${matchData.homeTeam}: ${homeSentiment.negatives[0]}`);
  }
  if (awaySentiment.negatives.length > 0) {
    keyInsights.push(`🔴 ${matchData.awayTeam}: ${awaySentiment.negatives[0]}`);
  }
  
  // 7. Gol beklentisi
  const avgMorale = (homeSentiment.morale + awaySentiment.morale) / 2;
  const avgConfidence = (homeSentiment.confidence + awaySentiment.confidence) / 2;
  let expectedGoals: 'high' | 'medium' | 'low' = 'medium';
  
  if (avgMorale > 7 && avgConfidence > 7) expectedGoals = 'high';
  if (avgMorale < 5 || matchContext.type === 'relegation_battle') expectedGoals = 'low';
  
  // 8. Data quality
  const dataQuality = {
    homeNewsFound: homeNews.general.length > 50,
    awayNewsFound: awayNews.general.length > 50,
    freshness: (homeNews.general.length > 100 || awayNews.general.length > 100) ? 'last_48h' as const : 'older' as const,
    confidence: Math.round(
      ((homeNews.general.length > 50 ? 25 : 0) +
       (awayNews.general.length > 50 ? 25 : 0) +
       (homeNews.injuries.length > 30 ? 25 : 0) +
       (awayNews.injuries.length > 30 ? 25 : 0))
    )
  };
  
  const elapsed = Date.now() - startTime;
  
  console.log('\n📊 SENTIMENT ANALYSIS RESULTS:');
  console.log(`   🏠 ${matchData.homeTeam}:`);
  console.log(`      Morale: ${homeSentiment.morale}/10 | Confidence: ${homeSentiment.confidence}/10`);
  console.log(`      Positives: ${homeSentiment.positives.length} | Negatives: ${homeSentiment.negatives.length}`);
  console.log(`      Outlook: ${homeSentiment.outlook}`);
  console.log(`   🚌 ${matchData.awayTeam}:`);
  console.log(`      Morale: ${awaySentiment.morale}/10 | Confidence: ${awaySentiment.confidence}/10`);
  console.log(`      Positives: ${awaySentiment.positives.length} | Negatives: ${awaySentiment.negatives.length}`);
  console.log(`      Outlook: ${awaySentiment.outlook}`);
  console.log(`   🎯 Psychological Edge: ${psychologicalEdge.team.toUpperCase()} (${psychologicalEdge.confidence}%)`);
  console.log(`   ⏱️ Completed in ${elapsed}ms`);
  console.log('═'.repeat(50));
  
  return {
    homeTeam: homeSentiment,
    awayTeam: awaySentiment,
    matchContext,
    headToHeadPsychology: {
      dominantTeam: psychologicalEdge.team,
      reasoning: psychologicalEdge.reasoning,
      mentalEdgeScore: psychologicalEdge.team === 'home' ? 
        Math.round((psychologicalEdge.confidence - 50) / 5) :
        psychologicalEdge.team === 'away' ? 
        -Math.round((psychologicalEdge.confidence - 50) / 5) : 0
    },
    psychologicalEdge,
    predictions: {
      expectedGoals,
      expectedTempo: matchContext.type === 'derby' ? 'fast' : 'normal',
      likelyScenario: generateScenario(homeSentiment, awaySentiment, matchContext)
    },
    criticalWarnings,
    keyInsights,
    agentSummary: generateSummary(matchData.homeTeam, matchData.awayTeam, homeSentiment, awaySentiment, psychologicalEdge),
    dataQuality
  };
}

function generateScenario(home: TeamSentiment, away: TeamSentiment, context: MatchContext): string {
  if (context.type === 'derby') {
    return 'Intense derby atmosphere expected. Emotions will run high, tactical discipline may suffer.';
  }
  if (home.morale > 7 && away.morale < 5) {
    return 'Home team likely to dominate. Visitors may struggle with low morale.';
  }
  if (away.morale > 7 && home.morale < 5) {
    return 'Away team arrives in better shape. Could be an upset on the cards.';
  }
  if (home.injuries.impact < -3 && away.injuries.impact < -3) {
    return 'Both teams depleted by injuries. Quality may suffer, expect a scrappy game.';
  }
  return 'Evenly matched encounter expected. Could go either way.';
}

function generateSummary(
  homeTeam: string,
  awayTeam: string,
  home: TeamSentiment,
  away: TeamSentiment,
  edge: SentimentResult['psychologicalEdge']
): string {
  const parts: string[] = [];
  
  // Ev sahibi özet
  if (home.outlook === 'very_positive' || home.outlook === 'positive') {
    parts.push(`${homeTeam} in positive mood`);
  } else if (home.outlook === 'negative' || home.outlook === 'very_negative') {
    parts.push(`${homeTeam} struggling with negativity`);
  }
  
  // Deplasman özet
  if (away.outlook === 'very_positive' || away.outlook === 'positive') {
    parts.push(`${awayTeam} arrives confident`);
  } else if (away.outlook === 'negative' || away.outlook === 'very_negative') {
    parts.push(`${awayTeam} dealing with issues`);
  }
  
  // Edge
  if (edge.team !== 'neutral') {
    parts.push(`psychological edge to ${edge.team === 'home' ? homeTeam : awayTeam} (${edge.confidence}%)`);
  } else {
    parts.push('no clear psychological advantage');
  }
  
  return parts.join('. ') + '.';
}
