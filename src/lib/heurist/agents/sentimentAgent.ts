// src/lib/heurist/agents/sentimentAgent.ts
// Advanced Sentiment Analysis Agent with Perplexity Pro - v2.0
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG v2.0:
// - Multi-language support (TR/EN/DE)
// - Smarter Perplexity queries with language detection
// - Turkish teams get Turkish news search
// - Better JSON parsing with fallbacks
// - Detailed news display for UI
// ═══════════════════════════════════════════════════════════════════════════════

import { MatchData } from '../types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ==================== LANGUAGE & TEAM DETECTION ====================

// Türk takımları listesi
const TURKISH_TEAMS = [
  'fenerbahçe', 'galatasaray', 'beşiktaş', 'trabzonspor', 'başakşehir',
  'konyaspor', 'antalyaspor', 'alanyaspor', 'sivasspor', 'kasımpaşa',
  'kayserispor', 'gaziantep', 'hatayspor', 'adana demirspor', 'pendikspor',
  'samsunspor', 'rizespor', 'ankaragücü', 'göztepe', 'bodrum',
  'fenerbahce', 'besiktas', 'basaksehir', 'kasimpasa', 'ankaragucu'
];

// Alman takımları listesi  
const GERMAN_TEAMS = [
  'bayern', 'dortmund', 'leipzig', 'leverkusen', 'frankfurt', 'wolfsburg',
  'gladbach', 'hoffenheim', 'freiburg', 'köln', 'mainz', 'augsburg',
  'hertha', 'schalke', 'bremen', 'stuttgart', 'union berlin'
];

function detectTeamLanguage(teamName: string): 'tr' | 'de' | 'en' {
  const lower = teamName.toLowerCase();
  
  if (TURKISH_TEAMS.some(t => lower.includes(t))) return 'tr';
  if (GERMAN_TEAMS.some(t => lower.includes(t))) return 'de';
  return 'en';
}

function getSearchLanguage(teamName: string, userLanguage: 'tr' | 'en' | 'de'): 'tr' | 'de' | 'en' {
  const teamLang = detectTeamLanguage(teamName);
  // Türk takımı için Türkçe arama daha iyi sonuç verir
  if (teamLang === 'tr') return 'tr';
  if (teamLang === 'de') return 'de';
  return userLanguage;
}

// ==================== ENHANCED TYPES (EXPORTED) ====================

export interface TeamSentiment {
  morale: number;
  motivation: number;
  preparation: number;
  confidence: number;
  teamChemistry: number;
  positives: string[];
  negatives: string[];
  injuries: {
    out: string[];
    doubtful: string[];
    returning: string[];
    impact: number;
  };
  outlook: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  outlookReasoning: string;
  matchMotivation: {
    level: 'critical' | 'high' | 'normal' | 'low';
    reasons: string[];
  };
  mediaSentiment: {
    tone: 'optimistic' | 'neutral' | 'pessimistic' | 'critical';
    headlines: string[];
  };
  managerSituation: {
    pressure: 'high' | 'medium' | 'low';
    recentComments: string[];
    tacticalChanges: string[];
  };
  fanFactor: {
    support: 'strong' | 'normal' | 'weak' | 'hostile';
    recentEvents: string[];
  };
  // 🆕 New fields
  squadRotation: {
    risk: 'high' | 'medium' | 'low';
    reasoning: string;
    expectedChanges: number;
    keyPlayersRested: string[];
  };
  transferWindow: {
    impact: 'positive' | 'neutral' | 'negative' | 'disruptive';
    recentArrivals: string[];
    recentDepartures: string[];
    rumorsImpact: string;
  };
  fatigueLevel: {
    level: 'high' | 'medium' | 'low';
    daysSinceLastMatch: number;
    upcomingFixtures: string[];
    congestionRisk: boolean;
  };
}

export interface MatchContext {
  type: 'derby' | 'title_race' | 'relegation_battle' | 'european_qualification' | 'cup_final' | 'regular';
  importance: number;
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
    mentalEdgeScore: number;
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

// ==================== LANGUAGE-SPECIFIC PROMPTS ====================

const PROMPTS = {
  tr: {
    teamNews: (team: string) => `${team} futbol takımı güncel haberler sakatlıklar kadro son maç`,
    systemNews: (team: string) => `${team} futbol takımı hakkında güncel bilgi bul:

1. SAKATLLIKLAR: Hangi oyuncular sakat veya şüpheli?
2. FORM: Son maç sonucu nasıldı? Takım formda mı?
3. MORAL: Takım atmosferi nasıl? Olumlu mu olumsuz mu?
4. TEKNİK DİREKTÖR: Son açıklamalar, maç öncesi yorumlar

Kısa ve net bilgiler ver. Türkçe yanıt ver.`,
    
    matchContext: (home: string, away: string) => `${home} vs ${away} futbol maçı önizleme`,
    systemContext: (home: string, away: string) => `${home} - ${away} maçı hakkında:
- Bu bir derbi mi?
- Hangi takım puan için daha fazla motive?
- Maçın önemi nedir?

Kısa ve net bilgi ver. Türkçe yanıt ver.`,

    analysis: (team: string) => `${team} takımının moral durumunu değerlendir. JSON formatında:`,
  },
  
  en: {
    teamNews: (team: string) => `${team} football team latest news injuries squad recent form`,
    systemNews: (team: string) => `Find current information about ${team} football team:

1. INJURIES: Which players are injured or doubtful?
2. FORM: How was their last match? Are they in good form?
3. MORALE: What is the team atmosphere? Positive or negative?
4. MANAGER: Recent statements, pre-match comments

Provide brief and clear information.`,
    
    matchContext: (home: string, away: string) => `${home} vs ${away} football match preview`,
    systemContext: (home: string, away: string) => `About the ${home} vs ${away} match:
- Is this a derby?
- Which team is more motivated for points?
- What is the importance of this match?

Provide brief and clear information.`,

    analysis: (team: string) => `Evaluate ${team}'s morale. In JSON format:`,
  },
  
  de: {
    teamNews: (team: string) => `${team} Fußball aktuelle Nachrichten Verletzungen Kader Form`,
    systemNews: (team: string) => `Finde aktuelle Informationen über ${team}:

1. VERLETZUNGEN: Welche Spieler sind verletzt oder fraglich?
2. FORM: Wie war das letzte Spiel? Sind sie in guter Form?
3. MORAL: Wie ist die Teamatmosphäre?
4. TRAINER: Aktuelle Aussagen

Kurze und klare Informationen. Antworte auf Deutsch.`,
    
    matchContext: (home: string, away: string) => `${home} vs ${away} Spielvorschau`,
    systemContext: (home: string, away: string) => `Über das Spiel ${home} gegen ${away}:
- Ist das ein Derby?
- Welches Team ist motivierter?
- Was ist die Bedeutung des Spiels?

Kurze und klare Information. Auf Deutsch.`,

    analysis: (team: string) => `Bewerte die Moral von ${team}. Im JSON-Format:`,
  }
};

// ==================== PERPLEXITY SEARCH ====================

async function searchWithPerplexity(
  query: string, 
  systemPrompt: string,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<{ content: string; citations: string[] }> {
  
  // API Key kontrolü
  const apiKey = PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ PERPLEXITY_API_KEY not configured - using fallback analysis');
    console.log('   ℹ️ Set PERPLEXITY_API_KEY in Vercel environment variables');
    return { content: '', citations: [] };
  }

  try {
    console.log(`   🔍 Calling Perplexity API for: ${query.substring(0, 50)}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 saniye timeout
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar', // sonar-pro yerine sonar (daha hızlı ve ucuz)
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 1500,
        temperature: 0.2,
        return_citations: true,
        search_recency_filter: 'week',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.log(`❌ Perplexity API error: ${response.status}`);
      console.log(`   Error details: ${errText.substring(0, 200)}`);
      
      // Rate limit veya auth hatası için özel mesaj
      if (response.status === 401) {
        console.log('   ⚠️ Invalid API key - check PERPLEXITY_API_KEY');
      } else if (response.status === 429) {
        console.log('   ⚠️ Rate limit exceeded - using fallback');
      }
      
      return { content: '', citations: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    console.log(`   ✅ Perplexity returned ${content.length} chars, ${citations.length} citations`);
    
    return { content, citations };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('⚠️ Perplexity API timeout (15s) - using fallback');
    } else {
      console.error('❌ Perplexity exception:', error.message || error);
    }
    return { content: '', citations: [] };
  }
}

// ==================== COMPREHENSIVE NEWS FETCH ====================

interface TeamNewsData {
  raw: string;
  headlines: string[];
  injuries: {
    out: string[];
    doubtful: string[];
    returning: string[];
  };
  positives: string[];
  negatives: string[];
  managerQuotes: string[];
  fanNews: string[];
  // 🆕 New fields
  rotationNews: string[];
  transferNews: string[];
  fatigueIndicators: string[];
}

async function fetchComprehensiveTeamNews(
  teamName: string, 
  league: string,
  language: 'tr' | 'en' | 'de'
): Promise<TeamNewsData> {
  
  const searchLang = getSearchLanguage(teamName, language);
  const prompts = PROMPTS[searchLang];
  
  console.log(`   🔍 Searching news for ${teamName} in ${searchLang.toUpperCase()}...`);
  
  // Ana haber araması
  const result = await searchWithPerplexity(
    prompts.teamNews(teamName),
    prompts.systemNews(teamName),
    searchLang
  );
  
  if (!result.content || result.content.length < 50) {
    console.log(`   ⚠️ No news found for ${teamName}`);
    return {
      raw: '',
      headlines: [],
      injuries: { out: [], doubtful: [], returning: [] },
      positives: [],
      negatives: [],
      managerQuotes: [],
      fanNews: [],
      rotationNews: [],
      transferNews: [],
      fatigueIndicators: []
    };
  }
  
  // Parse the content to extract structured data
  const parsed = parseNewsContent(result.content, teamName, searchLang);
  
  return parsed;
}

function parseNewsContent(content: string, teamName: string, lang: 'tr' | 'en' | 'de'): TeamNewsData {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  
  const headlines: string[] = [];
  const injuries = { out: [] as string[], doubtful: [] as string[], returning: [] as string[] };
  const positives: string[] = [];
  const negatives: string[] = [];
  const managerQuotes: string[] = [];
  const fanNews: string[] = [];
  // 🆕 New arrays
  const rotationNews: string[] = [];
  const transferNews: string[] = [];
  const fatigueIndicators: string[] = [];
  
  // Keywords for detection
  const injuryKeywords = {
    out: ['out', 'injured', 'sidelined', 'miss', 'sakatlık', 'oynamayacak', 'sakat', 'fällt aus', 'verletzt'],
    doubtful: ['doubtful', 'doubt', 'uncertain', 'şüpheli', 'belirsiz', 'fraglich', 'unsicher'],
    returning: ['return', 'back', 'recovered', 'dönüyor', 'iyileşti', 'zurück', 'erholt']
  };
  
  const positiveKeywords = ['win', 'victory', 'confident', 'strong', 'great', 'excellent', 'kazandı', 'galibiyet', 'güçlü', 'mükemmel', 'sieg', 'stark'];
  const negativeKeywords = ['loss', 'defeat', 'concern', 'worry', 'problem', 'crisis', 'kaybetti', 'mağlubiyet', 'sorun', 'kriz', 'niederlage', 'problem'];
  const managerKeywords = ['manager', 'coach', 'said', 'told', 'hoca', 'teknik direktör', 'açıkladı', 'trainer', 'sagte'];
  const fanKeywords = ['fan', 'supporter', 'crowd', 'taraftar', 'tribün', 'fans', 'anhänger'];
  
  // 🆕 New keywords
  const rotationKeywords = ['rotation', 'rest', 'rested', 'bench', 'squad', 'lineup', 'rotasyon', 'dinlen', 'yedek', 'kadro', 'rotation', 'ruhen', 'bank', 'aufstellung'];
  const transferKeywords = ['transfer', 'sign', 'signing', 'loan', 'buy', 'sell', 'arrival', 'departure', 'rumor', 'imza', 'kiralık', 'satın', 'transfer', 'verpflichtung', 'ausleihe', 'gerücht'];
  const fatigueKeywords = ['tired', 'fatigue', 'exhausted', 'rest', 'recovery', 'fixture', 'congestion', 'yorgun', 'dinlenme', 'maç sıklığı', 'müde', 'erschöpft', 'spielplan'];
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Skip very short lines
    if (line.length < 20) continue;
    
    // Detect injury news
    if (injuryKeywords.out.some(k => lower.includes(k))) {
      // Extract player names (capitalized words)
      const playerMatch = line.match(/([A-Z][a-zığüşöç]+(?:\s+[A-Z][a-zığüşöç]+)*)/g);
      if (playerMatch) {
        injuries.out.push(...playerMatch.filter(p => p !== teamName && p.length > 3));
      }
    }
    if (injuryKeywords.doubtful.some(k => lower.includes(k))) {
      const playerMatch = line.match(/([A-Z][a-zığüşöç]+(?:\s+[A-Z][a-zığüşöç]+)*)/g);
      if (playerMatch) {
        injuries.doubtful.push(...playerMatch.filter(p => p !== teamName && p.length > 3));
      }
    }
    if (injuryKeywords.returning.some(k => lower.includes(k))) {
      const playerMatch = line.match(/([A-Z][a-zığüşöç]+(?:\s+[A-Z][a-zığüşöç]+)*)/g);
      if (playerMatch) {
        injuries.returning.push(...playerMatch.filter(p => p !== teamName && p.length > 3));
      }
    }
    
    // Detect sentiment
    if (positiveKeywords.some(k => lower.includes(k))) {
      positives.push(line.substring(0, 150));
    }
    if (negativeKeywords.some(k => lower.includes(k))) {
      negatives.push(line.substring(0, 150));
    }
    
    // Manager quotes
    if (managerKeywords.some(k => lower.includes(k))) {
      managerQuotes.push(line.substring(0, 200));
    }
    
    // Fan news
    if (fanKeywords.some(k => lower.includes(k))) {
      fanNews.push(line.substring(0, 150));
    }
    
    // 🆕 Rotation news
    if (rotationKeywords.some(k => lower.includes(k))) {
      rotationNews.push(line.substring(0, 200));
    }
    
    // 🆕 Transfer news
    if (transferKeywords.some(k => lower.includes(k))) {
      transferNews.push(line.substring(0, 200));
    }
    
    // 🆕 Fatigue indicators
    if (fatigueKeywords.some(k => lower.includes(k))) {
      fatigueIndicators.push(line.substring(0, 150));
    }
    
    // Add to headlines if it's informative
    if (line.length > 30 && line.length < 200 && headlines.length < 5) {
      headlines.push(line);
    }
  }
  
  return {
    raw: content,
    headlines: [...new Set(headlines)].slice(0, 5),
    injuries: {
      out: [...new Set(injuries.out)].slice(0, 5),
      doubtful: [...new Set(injuries.doubtful)].slice(0, 3),
      returning: [...new Set(injuries.returning)].slice(0, 3)
    },
    positives: [...new Set(positives)].slice(0, 4),
    negatives: [...new Set(negatives)].slice(0, 4),
    managerQuotes: [...new Set(managerQuotes)].slice(0, 3),
    fanNews: [...new Set(fanNews)].slice(0, 2),
    // 🆕 New fields
    rotationNews: [...new Set(rotationNews)].slice(0, 3),
    transferNews: [...new Set(transferNews)].slice(0, 3),
    fatigueIndicators: [...new Set(fatigueIndicators)].slice(0, 2)
  };
}

// ==================== SENTIMENT ANALYSIS ====================

async function analyzeTeamSentimentWithAI(
  teamName: string,
  newsData: TeamNewsData,
  language: 'tr' | 'en' | 'de'
): Promise<TeamSentiment> {
  
  if (!newsData.raw || newsData.raw.length < 100) {
    console.log(`   ⚠️ Insufficient news for AI analysis of ${teamName}`);
    return createSentimentFromNews(teamName, newsData, language);
  }
  
  const prompts = PROMPTS[language];
  
  const analysisQuery = `${prompts.analysis(teamName)}
{
  "morale": <1-10>,
  "motivation": <1-10>,
  "preparation": <1-10>,
  "confidence": <1-10>,
  "teamChemistry": <1-10>,
  "outlook": "<very_positive|positive|neutral|negative|very_negative>",
  "outlookReasoning": "<${language === 'tr' ? 'Türkçe açıklama' : language === 'de' ? 'Deutsche Erklärung' : 'English explanation'}>"
}

NEWS DATA:
${newsData.raw.substring(0, 2000)}`;
  
  const result = await searchWithPerplexity(
    analysisQuery,
    `You are a sports psychologist. Analyze team mental state. Return ONLY valid JSON. ${language === 'tr' ? 'Use Turkish for text fields.' : language === 'de' ? 'Use German for text fields.' : ''}`,
    language
  );
  
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...createSentimentFromNews(teamName, newsData, language),
        morale: parsed.morale || 6,
        motivation: parsed.motivation || 6,
        preparation: parsed.preparation || 6,
        confidence: parsed.confidence || 6,
        teamChemistry: parsed.teamChemistry || 6,
        outlook: parsed.outlook || 'neutral',
        outlookReasoning: parsed.outlookReasoning || getDefaultOutlookReasoning(language)
      };
    }
  } catch (e) {
    console.log(`   ⚠️ JSON parse failed for ${teamName}, using news-based analysis`);
  }
  
  return createSentimentFromNews(teamName, newsData, language);
}

function createSentimentFromNews(
  teamName: string,
  newsData: TeamNewsData,
  language: 'tr' | 'en' | 'de'
): TeamSentiment {
  
  // Calculate scores based on news
  const positiveCount = newsData.positives.length;
  const negativeCount = newsData.negatives.length;
  const injuryCount = newsData.injuries.out.length + newsData.injuries.doubtful.length;
  
  // Base scores
  let morale = 6;
  let motivation = 6;
  let confidence = 6;
  
  // Adjust based on news
  morale += (positiveCount - negativeCount) * 0.5;
  confidence += (positiveCount - negativeCount) * 0.5;
  confidence -= injuryCount * 0.3;
  
  // Clamp values
  morale = Math.max(3, Math.min(9, morale));
  motivation = Math.max(4, Math.min(9, motivation));
  confidence = Math.max(3, Math.min(9, confidence));
  
  // Determine outlook
  let outlook: TeamSentiment['outlook'] = 'neutral';
  if (positiveCount > negativeCount + 2) outlook = 'positive';
  if (positiveCount > negativeCount + 4) outlook = 'very_positive';
  if (negativeCount > positiveCount + 2) outlook = 'negative';
  if (negativeCount > positiveCount + 4) outlook = 'very_negative';
  
  // Manager pressure
  let managerPressure: 'high' | 'medium' | 'low' = 'medium';
  const managerNegative = newsData.managerQuotes.some(q => 
    q.toLowerCase().includes('pressure') || 
    q.toLowerCase().includes('sacked') ||
    q.toLowerCase().includes('baskı') ||
    q.toLowerCase().includes('gönderilecek')
  );
  if (managerNegative) managerPressure = 'high';
  
  // Fan support
  let fanSupport: 'strong' | 'normal' | 'weak' | 'hostile' = 'normal';
  if (newsData.fanNews.some(f => f.toLowerCase().includes('protest') || f.toLowerCase().includes('protesto'))) {
    fanSupport = 'hostile';
  } else if (newsData.fanNews.some(f => f.toLowerCase().includes('support') || f.toLowerCase().includes('destek'))) {
    fanSupport = 'strong';
  }
  
  // 🆕 Squad Rotation Analysis
  const hasRotationNews = newsData.rotationNews.length > 0;
  const rotationKeywordsInNews = newsData.raw.toLowerCase();
  let rotationRisk: 'high' | 'medium' | 'low' = 'low';
  let expectedChanges = 0;
  const keyPlayersRested: string[] = [];
  
  if (hasRotationNews || rotationKeywordsInNews.includes('rest') || rotationKeywordsInNews.includes('dinlen')) {
    rotationRisk = 'medium';
    expectedChanges = 2;
    if (rotationKeywordsInNews.includes('major') || rotationKeywordsInNews.includes('büyük') || 
        rotationKeywordsInNews.includes('several') || rotationKeywordsInNews.includes('birkaç')) {
      rotationRisk = 'high';
      expectedChanges = 4;
    }
  }
  
  const rotationReasonings = {
    tr: {
      high: 'Yüksek rotasyon riski - birçok oyuncu dinlendirilecek',
      medium: 'Orta rotasyon riski - bazı değişiklikler bekleniyor',
      low: 'Düşük rotasyon riski - en güçlü kadro bekleniyor'
    },
    en: {
      high: 'High rotation risk - several players likely rested',
      medium: 'Medium rotation risk - some changes expected',
      low: 'Low rotation risk - strongest lineup expected'
    },
    de: {
      high: 'Hohes Rotationsrisiko - mehrere Spieler ruhen',
      medium: 'Mittleres Rotationsrisiko - einige Änderungen erwartet',
      low: 'Niedriges Rotationsrisiko - stärkste Aufstellung erwartet'
    }
  };
  
  // 🆕 Transfer Window Analysis
  const hasTransferNews = newsData.transferNews.length > 0;
  let transferImpact: 'positive' | 'neutral' | 'negative' | 'disruptive' = 'neutral';
  const recentArrivals: string[] = [];
  const recentDepartures: string[] = [];
  
  if (hasTransferNews) {
    const transferText = newsData.transferNews.join(' ').toLowerCase();
    if (transferText.includes('sign') || transferText.includes('arrival') || transferText.includes('imza') || transferText.includes('geldi')) {
      transferImpact = 'positive';
    }
    if (transferText.includes('leave') || transferText.includes('departure') || transferText.includes('ayrıl') || transferText.includes('gitti')) {
      if (transferImpact === 'positive') transferImpact = 'neutral';
      else transferImpact = 'negative';
    }
    if (transferText.includes('distract') || transferText.includes('saga') || transferText.includes('dikkat dağıt')) {
      transferImpact = 'disruptive';
    }
  }
  
  const transferReasonings = {
    tr: {
      positive: 'Yeni transferler takıma enerji katıyor',
      neutral: 'Transfer aktivitesi takımı etkilemiyor',
      negative: 'Önemli ayrılıklar takımı zayıflattı',
      disruptive: 'Transfer söylentileri dikkat dağıtıyor'
    },
    en: {
      positive: 'New signings bringing energy to the team',
      neutral: 'Transfer activity not affecting the team',
      negative: 'Key departures have weakened the squad',
      disruptive: 'Transfer rumors causing distractions'
    },
    de: {
      positive: 'Neuverpflichtungen bringen Energie',
      neutral: 'Transferaktivität beeinflusst Team nicht',
      negative: 'Wichtige Abgänge schwächen Kader',
      disruptive: 'Transfergerüchte lenken ab'
    }
  };
  
  // 🆕 Fatigue Analysis
  const hasFatigueNews = newsData.fatigueIndicators.length > 0;
  let fatigueLevel: 'high' | 'medium' | 'low' = 'low';
  const daysSinceLastMatch = 4; // Default, would need real data
  const congestionRisk = hasFatigueNews;
  
  if (hasFatigueNews) {
    fatigueLevel = 'medium';
    const fatigueText = newsData.fatigueIndicators.join(' ').toLowerCase();
    if (fatigueText.includes('exhausted') || fatigueText.includes('tired') || fatigueText.includes('yorgun')) {
      fatigueLevel = 'high';
    }
  }

  return {
    morale: Math.round(morale),
    motivation: Math.round(motivation),
    preparation: 6,
    confidence: Math.round(confidence),
    teamChemistry: 7,
    positives: newsData.positives,
    negatives: newsData.negatives,
    injuries: {
      out: newsData.injuries.out,
      doubtful: newsData.injuries.doubtful,
      returning: newsData.injuries.returning,
      impact: -newsData.injuries.out.length - (newsData.injuries.doubtful.length * 0.5)
    },
    outlook,
    outlookReasoning: generateOutlookReasoning(newsData, outlook, language),
    matchMotivation: {
      level: motivation >= 7 ? 'high' : 'normal',
      reasons: newsData.positives.slice(0, 2)
    },
    mediaSentiment: {
      tone: outlook === 'positive' || outlook === 'very_positive' ? 'optimistic' : 
            outlook === 'negative' || outlook === 'very_negative' ? 'pessimistic' : 'neutral',
      headlines: newsData.headlines
    },
    managerSituation: {
      pressure: managerPressure,
      recentComments: newsData.managerQuotes,
      tacticalChanges: []
    },
    fanFactor: {
      support: fanSupport,
      recentEvents: newsData.fanNews
    },
    // 🆕 New fields
    squadRotation: {
      risk: rotationRisk,
      reasoning: rotationReasonings[language][rotationRisk],
      expectedChanges,
      keyPlayersRested
    },
    transferWindow: {
      impact: transferImpact,
      recentArrivals,
      recentDepartures,
      rumorsImpact: transferReasonings[language][transferImpact]
    },
    fatigueLevel: {
      level: fatigueLevel,
      daysSinceLastMatch,
      upcomingFixtures: [],
      congestionRisk
    }
  };
}

function generateOutlookReasoning(
  newsData: TeamNewsData, 
  outlook: TeamSentiment['outlook'],
  language: 'tr' | 'en' | 'de'
): string {
  const messages = {
    tr: {
      positive: `Takım olumlu haberlerle moral buldu. ${newsData.positives.length} olumlu, ${newsData.negatives.length} olumsuz haber.`,
      negative: `Takım olumsuz haberlerle mücadele ediyor. ${newsData.injuries.out.length} oyuncu sakat.`,
      neutral: 'Takım dengeli bir psikolojide görünüyor.',
      noData: 'Yeterli haber bulunamadı.'
    },
    en: {
      positive: `Team boosted by positive news. ${newsData.positives.length} positive, ${newsData.negatives.length} negative stories.`,
      negative: `Team dealing with negative headlines. ${newsData.injuries.out.length} players injured.`,
      neutral: 'Team appears psychologically balanced.',
      noData: 'Insufficient news data for analysis.'
    },
    de: {
      positive: `Team durch positive Nachrichten gestärkt. ${newsData.positives.length} positive, ${newsData.negatives.length} negative Meldungen.`,
      negative: `Team kämpft mit negativen Schlagzeilen. ${newsData.injuries.out.length} Spieler verletzt.`,
      neutral: 'Team erscheint psychologisch ausgeglichen.',
      noData: 'Unzureichende Nachrichtendaten.'
    }
  };
  
  const msg = messages[language];
  
  if (!newsData.raw || newsData.raw.length < 50) return msg.noData;
  if (outlook === 'positive' || outlook === 'very_positive') return msg.positive;
  if (outlook === 'negative' || outlook === 'very_negative') return msg.negative;
  return msg.neutral;
}

function getDefaultOutlookReasoning(language: 'tr' | 'en' | 'de'): string {
  const defaults = {
    tr: 'Analiz için yeterli veri yok',
    en: 'Insufficient data for analysis',
    de: 'Unzureichende Daten für die Analyse'
  };
  return defaults[language];
}

// ==================== MATCH CONTEXT ====================

async function fetchAndAnalyzeMatchContext(
  homeTeam: string,
  awayTeam: string,
  league: string,
  language: 'tr' | 'en' | 'de'
): Promise<MatchContext> {
  
  const searchLang = getSearchLanguage(homeTeam, language);
  const prompts = PROMPTS[searchLang];
  
  const result = await searchWithPerplexity(
    prompts.matchContext(homeTeam, awayTeam),
    prompts.systemContext(homeTeam, awayTeam),
    searchLang
  );
  
  return analyzeMatchContextFromText(result.content, homeTeam, awayTeam, language);
}

function analyzeMatchContextFromText(
  content: string, 
  homeTeam: string, 
  awayTeam: string,
  language: 'tr' | 'en' | 'de'
): MatchContext {
  const lower = content.toLowerCase();
  
  // Derby detection
  const derbyKeywords = ['derby', 'derbi', 'rivalry', 'rekabet', 'klasik', 'classic', 'rival'];
  const titleKeywords = ['title', 'championship', 'şampiyonluk', 'first place', 'lider', 'meisterschaft'];
  const relegationKeywords = ['relegation', 'küme düşme', 'survival', 'abstieg', 'bottom'];
  const europeKeywords = ['europe', 'avrupa', 'champions league', 'europa league', 'conference'];
  
  let type: MatchContext['type'] = 'regular';
  let importance = 5;
  
  const stakes = {
    tr: {
      derby: 'Derbi maçı - yüksek gerilim ve heyecan bekleniyor',
      title: 'Şampiyonluk yarışı açısından kritik maç',
      relegation: 'Küme düşme hattı mücadelesi - çaresizlik faktörü',
      europe: 'Avrupa kupası yarışı için önemli puan mücadelesi',
      regular: 'Normal lig maçı'
    },
    en: {
      derby: 'Derby match - high tension and emotions expected',
      title: 'Critical match for title race',
      relegation: 'Relegation battle - desperation factor',
      europe: 'European qualification implications',
      regular: 'Regular league fixture'
    },
    de: {
      derby: 'Derby-Spiel - hohe Spannung erwartet',
      title: 'Kritisches Spiel für den Titelkampf',
      relegation: 'Abstiegskampf - Verzweiflung',
      europe: 'Europacup-Qualifikation auf dem Spiel',
      regular: 'Reguläres Ligaspiel'
    }
  };
  
  const msg = stakes[language];
  let stakeText = msg.regular;
  
  if (derbyKeywords.some(k => lower.includes(k))) {
    type = 'derby';
    importance = 9;
    stakeText = msg.derby;
  } else if (titleKeywords.some(k => lower.includes(k))) {
    type = 'title_race';
    importance = 9;
    stakeText = msg.title;
  } else if (relegationKeywords.some(k => lower.includes(k))) {
    type = 'relegation_battle';
    importance = 10;
    stakeText = msg.relegation;
  } else if (europeKeywords.some(k => lower.includes(k))) {
    type = 'european_qualification';
    importance = 8;
    stakeText = msg.europe;
  }
  
  // Historical rivalry check
  const rivalryTexts = {
    tr: content.length > 100 ? 'Önemli tarihsel rekabet' : 'Belirgin bir rekabet yok',
    en: content.length > 100 ? 'Significant historical rivalry' : 'No major rivalry',
    de: content.length > 100 ? 'Bedeutende historische Rivalität' : 'Keine große Rivalität'
  };
  
  return {
    type,
    importance,
    stakes: stakeText,
    historicalRivalry: rivalryTexts[language]
  };
}

// ==================== PSYCHOLOGICAL EDGE ====================

function calculatePsychologicalEdge(
  home: TeamSentiment,
  away: TeamSentiment,
  matchContext: MatchContext,
  language: 'tr' | 'en' | 'de'
): SentimentResult['psychologicalEdge'] {
  
  const homeScore = 
    home.morale * 1.2 +
    home.motivation * 1.3 +
    home.confidence * 1.1 +
    home.teamChemistry * 0.8 +
    (home.injuries.impact * 2) +
    (home.positives.length * 2) -
    (home.negatives.length * 2) +
    (home.fanFactor.support === 'strong' ? 4 : home.fanFactor.support === 'hostile' ? -4 : 0) +
    6; // Home advantage
  
  const awayScore = 
    away.morale * 1.2 +
    away.motivation * 1.3 +
    away.confidence * 1.1 +
    away.teamChemistry * 0.8 +
    (away.injuries.impact * 2) +
    (away.positives.length * 2) -
    (away.negatives.length * 2);
  
  const diff = homeScore - awayScore;
  const keyFactors: string[] = [];
  
  // Generate key factors in selected language
  const factorTexts = {
    tr: {
      homeMorale: 'Ev sahibi moral üstünlüğüne sahip',
      awayMorale: 'Deplasman takımı daha iyi moralde',
      homeInjury: `Ev sahibinde ${home.injuries.out.length} önemli eksik`,
      awayInjury: `Deplasmanda ${away.injuries.out.length} önemli eksik`,
      homeManagerPressure: 'Ev sahibi teknik direktörü baskı altında',
      awayManagerPressure: 'Deplasman teknik direktörü baskı altında',
      derby: 'Derbi atmosferi ek baskı yaratacak'
    },
    en: {
      homeMorale: 'Home team has better morale',
      awayMorale: 'Away team arrives in better spirits',
      homeInjury: `Home team missing ${home.injuries.out.length} key players`,
      awayInjury: `Away team missing ${away.injuries.out.length} key players`,
      homeManagerPressure: 'Home manager under pressure',
      awayManagerPressure: 'Away manager under pressure',
      derby: 'Derby atmosphere adds extra pressure'
    },
    de: {
      homeMorale: 'Heimteam hat bessere Moral',
      awayMorale: 'Auswärtsteam in besserer Stimmung',
      homeInjury: `Heimteam fehlen ${home.injuries.out.length} wichtige Spieler`,
      awayInjury: `Auswärtsteam fehlen ${away.injuries.out.length} wichtige Spieler`,
      homeManagerPressure: 'Heimtrainer unter Druck',
      awayManagerPressure: 'Auswärtstrainer unter Druck',
      derby: 'Derby-Atmosphäre erhöht den Druck'
    }
  };
  
  const ft = factorTexts[language];
  
  if (home.morale > away.morale + 1) keyFactors.push(ft.homeMorale);
  if (away.morale > home.morale + 1) keyFactors.push(ft.awayMorale);
  if (home.injuries.out.length >= 2) keyFactors.push(ft.homeInjury);
  if (away.injuries.out.length >= 2) keyFactors.push(ft.awayInjury);
  if (home.managerSituation.pressure === 'high') keyFactors.push(ft.homeManagerPressure);
  if (away.managerSituation.pressure === 'high') keyFactors.push(ft.awayManagerPressure);
  if (matchContext.type === 'derby') keyFactors.push(ft.derby);
  
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
  
  const reasoningTexts = {
    tr: {
      home: `Ev sahibi psikolojik avantaja sahip: ${keyFactors.slice(0, 2).join(', ') || 'genel üstünlük'}.`,
      away: `Deplasman takımı psikolojik avantaja sahip: ${keyFactors.slice(0, 2).join(', ') || 'daha iyi form'}.`,
      neutral: 'Her iki takım da psikolojik olarak dengede. Belirgin bir avantaj yok.'
    },
    en: {
      home: `Home team has psychological edge: ${keyFactors.slice(0, 2).join(', ') || 'overall advantage'}.`,
      away: `Away team has psychological edge: ${keyFactors.slice(0, 2).join(', ') || 'better form'}.`,
      neutral: 'Both teams psychologically balanced. No clear mental edge.'
    },
    de: {
      home: `Heimteam hat psychologischen Vorteil: ${keyFactors.slice(0, 2).join(', ') || 'allgemeiner Vorteil'}.`,
      away: `Auswärtsteam hat psychologischen Vorteil: ${keyFactors.slice(0, 2).join(', ') || 'bessere Form'}.`,
      neutral: 'Beide Teams psychologisch ausgeglichen. Kein klarer Vorteil.'
    }
  };
  
  return {
    team,
    confidence: Math.round(confidence),
    reasoning: team === 'home' ? reasoningTexts[language].home : 
               team === 'away' ? reasoningTexts[language].away : 
               reasoningTexts[language].neutral,
    keyFactors
  };
}

// ==================== SUMMARY GENERATION ====================

function generateLocalizedSummary(
  homeTeam: string,
  awayTeam: string,
  home: TeamSentiment,
  away: TeamSentiment,
  edge: SentimentResult['psychologicalEdge'],
  language: 'tr' | 'en' | 'de'
): string {
  const templates = {
    tr: {
      positive: (team: string) => `${team} pozitif modda`,
      negative: (team: string) => `${team} olumsuz haberlerle boğuşuyor`,
      edge: (team: string, conf: number) => `psikolojik avantaj ${team}'de (%${conf})`,
      neutral: 'belirgin psikolojik avantaj yok'
    },
    en: {
      positive: (team: string) => `${team} in positive mood`,
      negative: (team: string) => `${team} dealing with negativity`,
      edge: (team: string, conf: number) => `psychological edge to ${team} (${conf}%)`,
      neutral: 'no clear psychological advantage'
    },
    de: {
      positive: (team: string) => `${team} in positiver Stimmung`,
      negative: (team: string) => `${team} kämpft mit Negativität`,
      edge: (team: string, conf: number) => `psychologischer Vorteil bei ${team} (${conf}%)`,
      neutral: 'kein klarer psychologischer Vorteil'
    }
  };
  
  const t = templates[language];
  const parts: string[] = [];
  
  if (home.outlook === 'positive' || home.outlook === 'very_positive') {
    parts.push(t.positive(homeTeam));
  } else if (home.outlook === 'negative' || home.outlook === 'very_negative') {
    parts.push(t.negative(homeTeam));
  }
  
  if (away.outlook === 'positive' || away.outlook === 'very_positive') {
    parts.push(t.positive(awayTeam));
  } else if (away.outlook === 'negative' || away.outlook === 'very_negative') {
    parts.push(t.negative(awayTeam));
  }
  
  if (edge.team !== 'neutral') {
    parts.push(t.edge(edge.team === 'home' ? homeTeam : awayTeam, edge.confidence));
  } else {
    parts.push(t.neutral);
  }
  
  return parts.join('. ') + '.';
}

function generateLocalizedScenario(
  home: TeamSentiment,
  away: TeamSentiment,
  context: MatchContext,
  language: 'tr' | 'en' | 'de'
): string {
  const scenarios = {
    tr: {
      derby: 'Yoğun derbi atmosferi bekleniyor. Duygular tavan yapacak, taktiksel disiplin zayıflayabilir.',
      homeDominant: 'Ev sahibinin baskın olması bekleniyor. Moral üstünlüğü fark yaratabilir.',
      awayDominant: 'Deplasman takımı daha avantajlı geliyor. Sürpriz sonuç ihtimali var.',
      bothWeak: 'Her iki takım da sakatlıklardan muzdarip. Kaliteli bir maç beklenmemeli.',
      balanced: 'Dengeli bir mücadele bekleniyor. Her iki yöne de gidebilir.'
    },
    en: {
      derby: 'Intense derby atmosphere expected. Emotions will run high, tactical discipline may suffer.',
      homeDominant: 'Home team likely to dominate. Morale advantage could be decisive.',
      awayDominant: 'Away team arrives in better shape. Upset potential on the cards.',
      bothWeak: 'Both teams depleted. Quality may suffer, expect a scrappy game.',
      balanced: 'Evenly matched encounter expected. Could go either way.'
    },
    de: {
      derby: 'Intensive Derby-Atmosphäre erwartet. Emotionen werden hochkochen.',
      homeDominant: 'Heimteam sollte dominieren. Moralvorteil könnte entscheidend sein.',
      awayDominant: 'Auswärtsteam in besserer Verfassung. Überraschung möglich.',
      bothWeak: 'Beide Teams geschwächt. Kampfspiel erwartet.',
      balanced: 'Ausgeglichene Partie erwartet. Kann in beide Richtungen gehen.'
    }
  };
  
  const s = scenarios[language];
  
  if (context.type === 'derby') return s.derby;
  if (home.morale > 7 && away.morale < 5) return s.homeDominant;
  if (away.morale > 7 && home.morale < 5) return s.awayDominant;
  if (home.injuries.impact < -3 && away.injuries.impact < -3) return s.bothWeak;
  return s.balanced;
}

// ==================== MAIN FUNCTION ====================

export async function runSentimentAgent(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<SentimentResult> {
  console.log('\n🧠 SENTIMENT AGENT v2.0 STARTING');
  console.log('═'.repeat(50));
  console.log(`   📰 Analyzing: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`   🌐 Language: ${language.toUpperCase()}`);
  
  const startTime = Date.now();
  
  // 1. Fetch comprehensive news for both teams
  console.log('   📡 Fetching news from Perplexity...');
  const [homeNews, awayNews, matchContext] = await Promise.all([
    fetchComprehensiveTeamNews(matchData.homeTeam, matchData.league || '', language),
    fetchComprehensiveTeamNews(matchData.awayTeam, matchData.league || '', language),
    fetchAndAnalyzeMatchContext(matchData.homeTeam, matchData.awayTeam, matchData.league || '', language)
  ]);
  
  console.log(`   ✅ Home news: ${homeNews.headlines.length} headlines, ${homeNews.injuries.out.length} injuries, ${homeNews.rotationNews.length} rotation, ${homeNews.transferNews.length} transfer`);
  console.log(`   ✅ Away news: ${awayNews.headlines.length} headlines, ${awayNews.injuries.out.length} injuries, ${awayNews.rotationNews.length} rotation, ${awayNews.transferNews.length} transfer`);
  
  // 2. Analyze sentiment
  console.log('   🔍 Analyzing team sentiments...');
  const [homeSentiment, awaySentiment] = await Promise.all([
    analyzeTeamSentimentWithAI(matchData.homeTeam, homeNews, language),
    analyzeTeamSentimentWithAI(matchData.awayTeam, awayNews, language)
  ]);
  
  // 3. Calculate psychological edge
  const psychologicalEdge = calculatePsychologicalEdge(homeSentiment, awaySentiment, matchContext, language);
  
  // 4. Generate warnings
  const criticalWarnings: string[] = [];
  const warningTemplates = {
    tr: {
      injury: (team: string, count: number) => `⚠️ ${team}: ${count} önemli oyuncu yok`,
      managerPressure: (team: string) => `⚠️ ${team} teknik direktörü ciddi baskı altında`,
      negative: (team: string) => `⚠️ ${team} olumsuz haberlerle çevrili`
    },
    en: {
      injury: (team: string, count: number) => `⚠️ ${team}: ${count} key players OUT`,
      managerPressure: (team: string) => `⚠️ ${team} manager under serious pressure`,
      negative: (team: string) => `⚠️ ${team} surrounded by negative news`
    },
    de: {
      injury: (team: string, count: number) => `⚠️ ${team}: ${count} wichtige Spieler fehlen`,
      managerPressure: (team: string) => `⚠️ ${team} Trainer unter ernstem Druck`,
      negative: (team: string) => `⚠️ ${team} von negativen Nachrichten umgeben`
    }
  };
  
  const wt = warningTemplates[language];
  
  if (homeSentiment.injuries.out.length >= 2) {
    criticalWarnings.push(wt.injury(matchData.homeTeam, homeSentiment.injuries.out.length));
  }
  if (awaySentiment.injuries.out.length >= 2) {
    criticalWarnings.push(wt.injury(matchData.awayTeam, awaySentiment.injuries.out.length));
  }
  if (homeSentiment.managerSituation.pressure === 'high') {
    criticalWarnings.push(wt.managerPressure(matchData.homeTeam));
  }
  if (awaySentiment.managerSituation.pressure === 'high') {
    criticalWarnings.push(wt.managerPressure(matchData.awayTeam));
  }
  
  // 5. Key insights
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
  
  // 6. Data quality assessment
  const dataQuality = {
    homeNewsFound: homeNews.raw.length > 100,
    awayNewsFound: awayNews.raw.length > 100,
    freshness: (homeNews.raw.length > 200 || awayNews.raw.length > 200) ? 'last_48h' as const : 'older' as const,
    confidence: Math.round(
      ((homeNews.headlines.length > 0 ? 25 : 0) +
       (awayNews.headlines.length > 0 ? 25 : 0) +
       (homeNews.injuries.out.length > 0 || homeNews.injuries.doubtful.length > 0 ? 25 : 10) +
       (awayNews.injuries.out.length > 0 || awayNews.injuries.doubtful.length > 0 ? 25 : 10))
    )
  };
  
  const elapsed = Date.now() - startTime;
  
  console.log('\n📊 SENTIMENT ANALYSIS RESULTS:');
  console.log(`   🏠 ${matchData.homeTeam}:`);
  console.log(`      Morale: ${homeSentiment.morale}/10 | Confidence: ${homeSentiment.confidence}/10`);
  console.log(`      Outlook: ${homeSentiment.outlook} | Rotation Risk: ${homeSentiment.squadRotation.risk}`);
  console.log(`      Transfer: ${homeSentiment.transferWindow.impact} | Fatigue: ${homeSentiment.fatigueLevel.level}`);
  console.log(`   🚌 ${matchData.awayTeam}:`);
  console.log(`      Morale: ${awaySentiment.morale}/10 | Confidence: ${awaySentiment.confidence}/10`);
  console.log(`      Outlook: ${awaySentiment.outlook} | Rotation Risk: ${awaySentiment.squadRotation.risk}`);
  console.log(`      Transfer: ${awaySentiment.transferWindow.impact} | Fatigue: ${awaySentiment.fatigueLevel.level}`);
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
      expectedGoals: (homeSentiment.morale + awaySentiment.morale) / 2 > 7 ? 'high' : 
                     (homeSentiment.morale + awaySentiment.morale) / 2 < 5 ? 'low' : 'medium',
      expectedTempo: matchContext.type === 'derby' ? 'fast' : 'normal',
      likelyScenario: generateLocalizedScenario(homeSentiment, awaySentiment, matchContext, language)
    },
    criticalWarnings,
    keyInsights,
    agentSummary: generateLocalizedSummary(
      matchData.homeTeam, 
      matchData.awayTeam, 
      homeSentiment, 
      awaySentiment, 
      psychologicalEdge,
      language
    ),
    dataQuality
  };
}
