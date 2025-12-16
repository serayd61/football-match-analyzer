// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - REAL-TIME NEWS INTEGRATION
// Perplexity Web Search for Latest News, Injuries & Context
// ============================================================================

import { NewsContext } from './types';
import { API_ENDPOINTS, MODEL_VERSIONS } from './config';

// =========================
// PERPLEXITY CLIENT
// =========================

interface PerplexitySearchResult {
  content: string;
  citations?: string[];
}

/**
 * Perplexity API ile web araması yapar
 */
async function searchWithPerplexity(query: string): Promise<PerplexitySearchResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ PERPLEXITY_API_KEY not found');
    return null;
  }

  try {
    const response = await fetch(API_ENDPOINTS.PERPLEXITY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'sonar', // Web search enabled model
        messages: [
          {
            role: 'system',
            content: `You are a football news researcher. Search the web for the latest information and provide accurate, up-to-date data. Always cite your sources. Focus on factual information only.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 1500,
        temperature: 0.1, // Düşük = daha güvenilir
        return_citations: true
      })
    });

    if (!response.ok) {
      console.error(`❌ Perplexity API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      citations: data.citations || []
    };
  } catch (error) {
    console.error('❌ Perplexity search error:', error);
    return null;
  }
}

// =========================
// NEWS FETCHING
// =========================

/**
 * Takım sakatlık bilgilerini getirir
 */
async function fetchTeamInjuries(teamName: string): Promise<NewsContext['homeTeam']['injuries']> {
  const query = `${teamName} injuries suspensions latest news today. List all injured and suspended players with their status (out/doubtful/questionable). Be specific about positions.`;
  
  const result = await searchWithPerplexity(query);
  
  if (!result || !result.content) {
    return [];
  }

  // Parse injuries from response
  return parseInjuries(result.content, result.citations || []);
}

/**
 * Takım haberlerini getirir
 */
async function fetchTeamNews(teamName: string): Promise<NewsContext['homeTeam']['news']> {
  const query = `${teamName} football team latest news headlines today. Include team morale, manager comments, transfer news, and any significant updates. Focus on news that could affect their next match performance.`;
  
  const result = await searchWithPerplexity(query);
  
  if (!result || !result.content) {
    return [];
  }

  // Parse news from response
  return parseNews(result.content, result.citations || []);
}

/**
 * Maç ön izlemesini getirir
 */
async function fetchMatchPreview(
  homeTeam: string,
  awayTeam: string
): Promise<NewsContext['matchPreview']> {
  const query = `${homeTeam} vs ${awayTeam} match preview predictions expert analysis. What do experts predict? What are the key battles? Any weather concerns for the match?`;
  
  const result = await searchWithPerplexity(query);
  
  if (!result || !result.content) {
    return {
      expertPredictions: [],
      keyBattles: []
    };
  }

  // Parse preview from response
  return parseMatchPreview(result.content);
}

/**
 * Tüm news context'i getirir
 */
export async function fetchNewsContext(
  homeTeam: string,
  awayTeam: string
): Promise<NewsContext> {
  console.log(`📰 Fetching real-time news for ${homeTeam} vs ${awayTeam}...`);
  const startTime = Date.now();

  // Paralel olarak tüm verileri çek
  const [
    homeInjuries,
    awayInjuries,
    homeNews,
    awayNews,
    matchPreview
  ] = await Promise.all([
    fetchTeamInjuries(homeTeam).catch(() => []),
    fetchTeamInjuries(awayTeam).catch(() => []),
    fetchTeamNews(homeTeam).catch(() => []),
    fetchTeamNews(awayTeam).catch(() => []),
    fetchMatchPreview(homeTeam, awayTeam).catch(() => ({ expertPredictions: [], keyBattles: [] }))
  ]);

  const elapsed = Date.now() - startTime;
  console.log(`✅ News fetched in ${elapsed}ms`);
  console.log(`   Home injuries: ${homeInjuries.length}, Away injuries: ${awayInjuries.length}`);
  console.log(`   Home news: ${homeNews.length}, Away news: ${awayNews.length}`);

  const allSources = new Set<string>();
  
  // Tüm citation'ları topla
  homeNews.forEach(n => n.source && allSources.add(n.source));
  awayNews.forEach(n => n.source && allSources.add(n.source));
  homeInjuries.forEach(i => i.source && allSources.add(i.source));
  awayInjuries.forEach(i => i.source && allSources.add(i.source));

  return {
    homeTeam: {
      injuries: homeInjuries,
      news: homeNews,
      managerQuotes: extractManagerQuotes(homeNews)
    },
    awayTeam: {
      injuries: awayInjuries,
      news: awayNews,
      managerQuotes: extractManagerQuotes(awayNews)
    },
    matchPreview,
    fetchedAt: new Date().toISOString(),
    sources: Array.from(allSources)
  };
}

// =========================
// PARSING FUNCTIONS
// =========================

/**
 * Sakatlık bilgilerini parse eder
 */
function parseInjuries(
  content: string,
  citations: string[]
): NewsContext['homeTeam']['injuries'] {
  const injuries: NewsContext['homeTeam']['injuries'] = [];
  
  // Yaygın sakatlık pattern'lerini ara
  const patterns = [
    /(\w+[\w\s]*)\s+(?:is|are)\s+(?:out|injured|sidelined|ruled out|unavailable)/gi,
    /(\w+[\w\s]*)\s+(?:doubtful|questionable|uncertain)/gi,
    /(\w+[\w\s]*)\s+(?:suspended|serving a ban)/gi,
    /injury:\s*(\w+[\w\s]*)/gi,
    /(\w+[\w\s]*)\s*[-–]\s*(?:out|injured|doubtful|suspended)/gi
  ];

  const foundPlayers = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const playerName = match[1]?.trim();
      
      // Skip generic words
      if (!playerName || 
          playerName.length < 3 ||
          ['the', 'and', 'but', 'for', 'are', 'will', 'has', 'have'].includes(playerName.toLowerCase())) {
        continue;
      }

      if (!foundPlayers.has(playerName.toLowerCase())) {
        foundPlayers.add(playerName.toLowerCase());
        
        // Status belirleme
        const lowerContent = content.toLowerCase();
        const playerLower = playerName.toLowerCase();
        let status: 'out' | 'doubtful' | 'questionable' = 'doubtful';
        
        if (lowerContent.includes(`${playerLower} out`) || 
            lowerContent.includes(`${playerLower} ruled out`) ||
            lowerContent.includes(`${playerLower} sidelined`) ||
            lowerContent.includes(`${playerLower} suspended`)) {
          status = 'out';
        } else if (lowerContent.includes(`${playerLower} questionable`)) {
          status = 'questionable';
        }

        injuries.push({
          player: playerName,
          position: guessPosition(playerName, content),
          status,
          source: citations[0] || 'Perplexity Search'
        });
      }
    }
  }

  return injuries.slice(0, 10); // Max 10 sakatlık
}

/**
 * Haberleri parse eder
 */
function parseNews(
  content: string,
  citations: string[]
): NewsContext['homeTeam']['news'] {
  const news: NewsContext['homeTeam']['news'] = [];
  
  // Paragrafları ayır
  const paragraphs = content.split(/\n\n|\.\s+(?=[A-Z])/);
  
  for (const paragraph of paragraphs) {
    if (paragraph.length < 50) continue;
    
    // Sentiment analizi
    const sentiment = analyzeSentiment(paragraph);
    
    // Impact değerlendirmesi
    const impact = assessImpact(paragraph);
    
    // Headline çıkar (ilk cümle)
    const headline = paragraph.split('.')[0]?.trim();
    
    if (headline && headline.length > 10) {
      news.push({
        headline: headline.slice(0, 100),
        summary: paragraph.slice(0, 300),
        sentiment,
        impact,
        source: citations[0] || 'Perplexity Search',
        publishedAt: new Date().toISOString()
      });
    }
  }

  return news.slice(0, 5); // Max 5 haber
}

/**
 * Maç ön izlemesini parse eder
 */
function parseMatchPreview(content: string): NewsContext['matchPreview'] {
  const expertPredictions: string[] = [];
  const keyBattles: string[] = [];
  
  // Expert predictions
  const predictionPatterns = [
    /(?:predicts?|expects?|tips?)\s+(\d-\d|\w+\s+to\s+win)/gi,
    /(?:likely|expected)\s+(?:to|outcome)\s+([^.]+)/gi
  ];
  
  for (const pattern of predictionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && match[1].length > 5) {
        expertPredictions.push(match[1].trim());
      }
    }
  }

  // Key battles
  const battlePatterns = [
    /key battle[s]?:?\s*([^.]+)/gi,
    /(\w+)\s+vs?\s+(\w+)\s+will be (?:crucial|key|important)/gi,
    /matchup to watch:?\s*([^.]+)/gi
  ];

  for (const pattern of battlePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        keyBattles.push(match[1].trim());
      }
    }
  }

  // Weather
  let weatherConditions: NewsContext['matchPreview']['weatherConditions'];
  
  const weatherMatch = content.match(/weather[:\s]+([^.]+)/i);
  const tempMatch = content.match(/(\d+)\s*(?:°|degrees?|celsius)/i);
  
  if (weatherMatch || tempMatch) {
    weatherConditions = {
      temperature: tempMatch ? parseInt(tempMatch[1]) : 15,
      condition: weatherMatch?.[1]?.trim() || 'Unknown',
      impact: 'Low'
    };
    
    const weatherLower = (weatherMatch?.[1] || '').toLowerCase();
    if (weatherLower.includes('rain') || weatherLower.includes('wind') || weatherLower.includes('snow')) {
      weatherConditions.impact = 'Medium';
    }
    if (weatherLower.includes('heavy') || weatherLower.includes('storm')) {
      weatherConditions.impact = 'High';
    }
  }

  return {
    expertPredictions: expertPredictions.slice(0, 5),
    keyBattles: keyBattles.slice(0, 5),
    weatherConditions
  };
}

// =========================
// HELPER FUNCTIONS
// =========================

/**
 * Pozisyon tahmini
 */
function guessPosition(playerName: string, context: string): string {
  const contextLower = context.toLowerCase();
  const nameLower = playerName.toLowerCase();
  
  // Context'te pozisyon arayışı
  const positionPatterns = [
    { pattern: new RegExp(`${nameLower}[\\s,]*(goalkeeper|keeper|gk)`, 'i'), position: 'Goalkeeper' },
    { pattern: new RegExp(`${nameLower}[\\s,]*(defender|cb|rb|lb|full-?back)`, 'i'), position: 'Defender' },
    { pattern: new RegExp(`${nameLower}[\\s,]*(midfielder|midfield|cm|dm|am)`, 'i'), position: 'Midfielder' },
    { pattern: new RegExp(`${nameLower}[\\s,]*(forward|striker|winger|attacker)`, 'i'), position: 'Forward' }
  ];
  
  for (const { pattern, position } of positionPatterns) {
    if (pattern.test(contextLower)) {
      return position;
    }
  }
  
  return 'Unknown';
}

/**
 * Sentiment analizi
 */
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  
  const positiveWords = [
    'win', 'victory', 'triumph', 'excellent', 'great', 'boost', 'confident',
    'strong', 'impressive', 'return', 'back', 'fit', 'available', 'ready'
  ];
  
  const negativeWords = [
    'loss', 'defeat', 'injury', 'injured', 'out', 'miss', 'doubt', 'concern',
    'struggle', 'poor', 'weak', 'suspended', 'ban', 'crisis', 'problem'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positiveWords) {
    if (lower.includes(word)) positiveCount++;
  }
  
  for (const word of negativeWords) {
    if (lower.includes(word)) negativeCount++;
  }
  
  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}

/**
 * Impact değerlendirmesi
 */
function assessImpact(text: string): 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  
  const highImpactWords = [
    'star', 'captain', 'key player', 'crucial', 'vital', 'main', 'first choice',
    'top scorer', 'best player', 'manager', 'sacked', 'fired', 'appointed'
  ];
  
  const mediumImpactWords = [
    'regular', 'starter', 'important', 'significant', 'notable', 'injury',
    'suspended', 'doubt', 'fitness'
  ];
  
  for (const word of highImpactWords) {
    if (lower.includes(word)) return 'high';
  }
  
  for (const word of mediumImpactWords) {
    if (lower.includes(word)) return 'medium';
  }
  
  return 'low';
}

/**
 * Manager quote'larını çıkarır
 */
function extractManagerQuotes(news: NewsContext['homeTeam']['news']): string[] {
  const quotes: string[] = [];
  
  for (const item of news) {
    const quotePatterns = [
      /"([^"]+)"/g,
      /'([^']+)'/g,
      /said[:\s]+["']?([^"']+)["']?/gi
    ];
    
    for (const pattern of quotePatterns) {
      let match;
      while ((match = pattern.exec(item.summary)) !== null) {
        if (match[1] && match[1].length > 20 && match[1].length < 200) {
          quotes.push(match[1].trim());
        }
      }
    }
  }
  
  return quotes.slice(0, 3);
}

// =========================
// QUICK CONTEXT CHECK
// =========================

/**
 * Hızlı sakatlık kontrolü (sadece önemli sakatlıklar)
 */
export async function quickInjuryCheck(teamName: string): Promise<{
  hasSignificantInjuries: boolean;
  keyPlayers: string[];
  summary: string;
}> {
  const query = `${teamName} injuries news. Are any key players or star players injured or suspended for the next match? Just list the most important missing players.`;
  
  const result = await searchWithPerplexity(query);
  
  if (!result || !result.content) {
    return {
      hasSignificantInjuries: false,
      keyPlayers: [],
      summary: 'Unable to fetch injury information'
    };
  }

  const content = result.content.toLowerCase();
  
  // Key player indicators
  const hasSignificant = content.includes('star') || 
                         content.includes('key player') ||
                         content.includes('captain') ||
                         content.includes('top scorer') ||
                         content.includes('will miss');

  // Extract player names
  const namePattern = /(\b[A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:is|will|has)/g;
  const keyPlayers: string[] = [];
  let match;
  
  while ((match = namePattern.exec(result.content)) !== null) {
    if (match[1] && !keyPlayers.includes(match[1])) {
      keyPlayers.push(match[1]);
    }
  }

  return {
    hasSignificantInjuries: hasSignificant || keyPlayers.length > 0,
    keyPlayers: keyPlayers.slice(0, 5),
    summary: result.content.slice(0, 300)
  };
}

// =========================
// EXPORTS
// =========================

export {
  searchWithPerplexity,
  fetchTeamInjuries,
  fetchTeamNews,
  fetchMatchPreview,
  parseInjuries,
  parseNews,
  analyzeSentiment,
  assessImpact
};

