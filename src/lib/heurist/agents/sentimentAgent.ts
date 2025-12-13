// src/lib/heurist/agents/sentimentAgent.ts

import { MatchData } from '../types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface SentimentResult {
  homeTeam: {
    morale: number; // 1-10
    motivation: number; // 1-10
    preparation: number; // 1-10
    injuries_impact: number; // -5 to 0 (negative impact)
    news_sentiment: 'positive' | 'neutral' | 'negative';
    key_factors: string[];
    recent_news: string[];
  };
  awayTeam: {
    morale: number;
    motivation: number;
    preparation: number;
    injuries_impact: number;
    news_sentiment: 'positive' | 'neutral' | 'negative';
    key_factors: string[];
    recent_news: string[];
  };
  matchImportance: {
    homeTeam: number; // 1-10
    awayTeam: number; // 1-10
    reasoning: string;
  };
  psychologicalEdge: {
    team: string; // "home" | "away" | "neutral"
    confidence: number;
    reasoning: string;
  };
  warnings: string[];
  agentSummary: string;
}

const SENTIMENT_PROMPT = `Sen bir futbol psikoloji ve haber analisti uzmansın. Verilen takımlar hakkında SON 48 SAATTEKİ haberleri analiz ederek psikolojik durum raporu çıkaracaksın.

ARAŞTIRMA KONULARI:

1. TEKNİK DİREKTÖR AÇIKLAMALARI
   - Basın toplantısı yorumları
   - Maç öncesi açıklamalar
   - Kadro tercihleri hakkında ipuçları
   - Motivasyon mesajları

2. OYUNCU DURUMU
   - Son dakika sakatlık haberleri
   - Cezalı oyuncular
   - Yıldız oyuncuların form durumu
   - Transfer söylentilerinin etkisi

3. TAKIM İÇİ DİNAMİKLER
   - Soyunma odası haberleri
   - Oyuncular arası ilişkiler
   - Teknik direktör-oyuncu ilişkisi
   - Kulüp yönetimi haberleri

4. DIŞ FAKTÖRLER
   - Taraftar baskısı/desteği
   - Derbi/kritik maç motivasyonu
   - Lig sıralaması önemi
   - Ekonomik sorunlar (maaş, prim)

5. SON MAÇ ETKİSİ
   - Son maçın moral etkisi
   - Hakem kararlarına tepkiler
   - Galibiyet/mağlubiyet serisi

SKORLAMA:
- Morale (Moral): 1-10 (1=çok düşük, 10=çok yüksek)
- Motivation (Motivasyon): 1-10 (bu maça özel istek)
- Preparation (Hazırlık): 1-10 (antrenman, kadro durumu)
- Injuries Impact: -5 to 0 (sakatlıkların olumsuz etkisi)

JSON FORMATINDA DÖNDÜR:
{
  "homeTeam": {
    "morale": 7,
    "motivation": 8,
    "preparation": 7,
    "injuries_impact": -1,
    "news_sentiment": "positive",
    "key_factors": ["Teknik direktör motivasyon konuşması yaptı", "Yıldız oyuncu fit durumda"],
    "recent_news": ["Haber 1 özeti", "Haber 2 özeti"]
  },
  "awayTeam": {
    "morale": 5,
    "motivation": 6,
    "preparation": 6,
    "injuries_impact": -2,
    "news_sentiment": "negative",
    "key_factors": ["Son 3 maç mağlubiyet morali bozdu", "2 önemli oyuncu sakat"],
    "recent_news": ["Haber 1 özeti", "Haber 2 özeti"]
  },
  "matchImportance": {
    "homeTeam": 8,
    "awayTeam": 7,
    "reasoning": "Her iki takım da ligde kalma mücadelesi veriyor"
  },
  "psychologicalEdge": {
    "team": "home",
    "confidence": 65,
    "reasoning": "Ev sahibi moral olarak daha iyi durumda ve taraftar desteği var"
  },
  "warnings": ["Ev sahibi kalecisi son anda sakatlandı", "Deplasman takımında maaş krizi haberleri var"],
  "agentSummary": "Ev sahibi psikolojik olarak avantajlı. Deplasman takımı moral olarak düşük."
}`;

async function searchTeamNews(teamName: string, league: string): Promise<string> {
  if (!PERPLEXITY_API_KEY) {
    console.log('⚠️ Perplexity API key missing for sentiment search');
    return '';
  }

  const query = `${teamName} son haberler maç öncesi teknik direktör açıklama sakatlık kadro ${new Date().toLocaleDateString('tr-TR')}`;
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar', // Web search model
        messages: [
          { 
            role: 'system', 
            content: 'Sen bir spor haberi araştırmacısısın. Verilen takım hakkında son 48 saatteki önemli haberleri, teknik direktör açıklamalarını, sakatlık haberlerini ve takım moralini etkileyen gelişmeleri bul ve özetle.' 
          },
          { 
            role: 'user', 
            content: query 
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.log(`❌ Perplexity search error: ${response.status}`);
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('❌ Perplexity search exception:', error);
    return '';
  }
}

async function analyzeSentiment(
  homeTeam: string,
  awayTeam: string,
  homeNews: string,
  awayNews: string,
  matchContext: string
): Promise<SentimentResult> {
  if (!PERPLEXITY_API_KEY) {
    return getDefaultSentiment(homeTeam, awayTeam);
  }

  const analysisPrompt = `
${SENTIMENT_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
MAÇ: ${homeTeam} vs ${awayTeam}
${matchContext}
═══════════════════════════════════════════════════════════════════════════════

${homeTeam} HABERLERİ:
${homeNews || 'Güncel haber bulunamadı'}

═══════════════════════════════════════════════════════════════════════════════

${awayTeam} HABERLERİ:
${awayNews || 'Güncel haber bulunamadı'}

═══════════════════════════════════════════════════════════════════════════════

Bu haberleri analiz ederek her iki takımın psikolojik durumunu değerlendir.
SADECE JSON formatında döndür.`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 1500,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      return getDefaultSentiment(homeTeam, awayTeam);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return getDefaultSentiment(homeTeam, awayTeam);
  } catch (error) {
    console.error('❌ Sentiment analysis error:', error);
    return getDefaultSentiment(homeTeam, awayTeam);
  }
}

function getDefaultSentiment(homeTeam: string, awayTeam: string): SentimentResult {
  return {
    homeTeam: {
      morale: 6,
      motivation: 6,
      preparation: 6,
      injuries_impact: 0,
      news_sentiment: 'neutral',
      key_factors: ['Güncel haber analizi yapılamadı'],
      recent_news: []
    },
    awayTeam: {
      morale: 6,
      motivation: 6,
      preparation: 6,
      injuries_impact: 0,
      news_sentiment: 'neutral',
      key_factors: ['Güncel haber analizi yapılamadı'],
      recent_news: []
    },
    matchImportance: {
      homeTeam: 5,
      awayTeam: 5,
      reasoning: 'Maç önemi değerlendirilemedi'
    },
    psychologicalEdge: {
      team: 'neutral',
      confidence: 50,
      reasoning: 'Yeterli veri bulunamadı'
    },
    warnings: [],
    agentSummary: `${homeTeam} vs ${awayTeam}: Psikolojik analiz için yeterli güncel haber bulunamadı.`
  };
}

export async function runSentimentAgent(matchData: MatchData): Promise<SentimentResult> {
  console.log('🧠 Sentiment Agent starting...');
  console.log(`   📰 Searching news for: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  
  const startTime = Date.now();
  
  // Paralel haber araması
  const [homeNews, awayNews] = await Promise.all([
    searchTeamNews(matchData.homeTeam, matchData.league || ''),
    searchTeamNews(matchData.awayTeam, matchData.league || '')
  ]);
  
  console.log(`   📊 News search completed in ${Date.now() - startTime}ms`);
  console.log(`   📰 Home news length: ${homeNews.length} chars`);
  console.log(`   📰 Away news length: ${awayNews.length} chars`);
  
  // Maç bağlamı
  const matchContext = `
Lig: ${matchData.league || 'Unknown'}
Ev Sahibi Form: ${(matchData as any).homeForm?.form || 'N/A'}
Deplasman Form: ${(matchData as any).awayForm?.form || 'N/A'}
H2H: ${(matchData as any).h2h?.totalMatches || 0} maç
`;
  
  // Sentiment analizi
  const result = await analyzeSentiment(
    matchData.homeTeam,
    matchData.awayTeam,
    homeNews,
    awayNews,
    matchContext
  );
  
  console.log(`✅ Sentiment Agent complete:`);
  console.log(`   🏠 ${matchData.homeTeam} Morale: ${result.homeTeam.morale}/10`);
  console.log(`   🚌 ${matchData.awayTeam} Morale: ${result.awayTeam.morale}/10`);
  console.log(`   🎯 Psychological Edge: ${result.psychologicalEdge.team} (${result.psychologicalEdge.confidence}%)`);
  console.log(`   ⚠️ Warnings: ${result.warnings.length}`);
  
  return result;
}

// Sentiment skorunu tahminlere entegre etme
export function applySentimentToPredicti(
  basePrediction: any,
  sentiment: SentimentResult
): any {
  const homeScore = sentiment.homeTeam.morale + sentiment.homeTeam.motivation + sentiment.homeTeam.preparation + sentiment.homeTeam.injuries_impact;
  const awayScore = sentiment.awayTeam.morale + sentiment.awayTeam.motivation + sentiment.awayTeam.preparation + sentiment.awayTeam.injuries_impact;
  
  const sentimentDiff = homeScore - awayScore; // Pozitif = ev sahibi avantajlı
  
  // Match result adjustment
  let adjustedProbabilities = { ...basePrediction.probabilities };
  
  if (sentimentDiff > 5) {
    // Ev sahibi çok avantajlı
    adjustedProbabilities.homeWin = Math.min(60, adjustedProbabilities.homeWin + 10);
    adjustedProbabilities.awayWin = Math.max(15, adjustedProbabilities.awayWin - 10);
  } else if (sentimentDiff > 2) {
    // Ev sahibi biraz avantajlı
    adjustedProbabilities.homeWin = Math.min(55, adjustedProbabilities.homeWin + 5);
    adjustedProbabilities.awayWin = Math.max(20, adjustedProbabilities.awayWin - 5);
  } else if (sentimentDiff < -5) {
    // Deplasman çok avantajlı
    adjustedProbabilities.awayWin = Math.min(50, adjustedProbabilities.awayWin + 10);
    adjustedProbabilities.homeWin = Math.max(20, adjustedProbabilities.homeWin - 10);
  } else if (sentimentDiff < -2) {
    // Deplasman biraz avantajlı
    adjustedProbabilities.awayWin = Math.min(45, adjustedProbabilities.awayWin + 5);
    adjustedProbabilities.homeWin = Math.max(25, adjustedProbabilities.homeWin - 5);
  }
  
  // Normalize to 100%
  const total = adjustedProbabilities.homeWin + adjustedProbabilities.draw + adjustedProbabilities.awayWin;
  adjustedProbabilities.homeWin = Math.round((adjustedProbabilities.homeWin / total) * 100);
  adjustedProbabilities.draw = Math.round((adjustedProbabilities.draw / total) * 100);
  adjustedProbabilities.awayWin = 100 - adjustedProbabilities.homeWin - adjustedProbabilities.draw;
  
  return {
    ...basePrediction,
    probabilities: adjustedProbabilities,
    sentimentAdjustment: {
      applied: true,
      homePsychScore: homeScore,
      awayPsychScore: awayScore,
      diff: sentimentDiff,
      edge: sentiment.psychologicalEdge
    }
  };
}
