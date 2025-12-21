// ============================================================================
// SMART ANALYZER - Basitleştirilmiş Analiz Motoru
// Sadece 2 model: Claude (Primary) + DeepSeek (Secondary)
// Hedef: 10-15 saniyede analiz
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface MatchData {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  league: string;
  matchDate: string;
}

export interface Prediction {
  prediction: string;
  confidence: number;
  reasoning: string;
}

export interface SmartAnalysis {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  
  // Tahminler
  btts: Prediction;
  overUnder: Prediction;
  matchResult: Prediction;
  
  // Meta
  bestBet: {
    market: string;
    selection: string;
    confidence: number;
    reason: string;
  };
  
  // Scoring
  agreement: number; // 0-100 arası, iki modelin uyumu
  riskLevel: 'low' | 'medium' | 'high';
  overallConfidence: number;
  
  // Performance
  processingTime: number;
  modelsUsed: string[];
  
  // Timestamps
  analyzedAt: string;
}

interface AIResponse {
  btts: { prediction: 'yes' | 'no'; confidence: number; reasoning: string };
  overUnder: { prediction: 'over' | 'under'; confidence: number; reasoning: string };
  matchResult: { prediction: 'home' | 'draw' | 'away'; confidence: number; reasoning: string };
}

// ============================================================================
// AI API CALLS
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

async function callClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '';
  
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!res.ok) return '';
    const data = await res.json();
    return data.content?.[0]?.text || '';
  } catch {
    return '';
  }
}

async function callDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) return '';
  
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      })
    });
    
    if (!res.ok) return '';
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildAnalysisPrompt(match: MatchData): string {
  return `Futbol maç analizi yap. SADECE JSON formatında yanıt ver.

MAÇ: ${match.homeTeam} vs ${match.awayTeam}
LİG: ${match.league}
TARİH: ${match.matchDate}

{
  "btts": {
    "prediction": "yes" veya "no",
    "confidence": 50-75 arası sayı,
    "reasoning": "1 cümle gerekçe"
  },
  "overUnder": {
    "prediction": "over" veya "under",
    "confidence": 50-75 arası sayı,
    "reasoning": "1 cümle gerekçe"
  },
  "matchResult": {
    "prediction": "home", "draw" veya "away",
    "confidence": 45-65 arası sayı,
    "reasoning": "1 cümle gerekçe"
  }
}

ÖNEMLİ:
- SADECE JSON döndür, başka bir şey yazma
- Confidence değerleri gerçekçi olsun
- Match Result için max %65 confidence`;
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function parseAIResponse(text: string): AIResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      btts: {
        prediction: parsed.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
        confidence: Math.min(75, Math.max(50, parseInt(parsed.btts?.confidence) || 60)),
        reasoning: parsed.btts?.reasoning || ''
      },
      overUnder: {
        prediction: parsed.overUnder?.prediction?.toLowerCase() === 'over' ? 'over' : 'under',
        confidence: Math.min(75, Math.max(50, parseInt(parsed.overUnder?.confidence) || 60)),
        reasoning: parsed.overUnder?.reasoning || ''
      },
      matchResult: {
        prediction: normalizeMatchResult(parsed.matchResult?.prediction),
        confidence: Math.min(65, Math.max(45, parseInt(parsed.matchResult?.confidence) || 55)),
        reasoning: parsed.matchResult?.reasoning || ''
      }
    };
  } catch {
    return null;
  }
}

function normalizeMatchResult(pred: string): 'home' | 'draw' | 'away' {
  if (!pred) return 'draw';
  const lower = String(pred).toLowerCase().trim();
  if (lower === 'home' || lower === '1' || lower.includes('home')) return 'home';
  if (lower === 'away' || lower === '2' || lower.includes('away')) return 'away';
  return 'draw';
}

// ============================================================================
// CONSENSUS CALCULATOR
// ============================================================================

function calculateConsensus(claude: AIResponse | null, deepseek: AIResponse | null): {
  btts: Prediction;
  overUnder: Prediction;
  matchResult: Prediction;
  agreement: number;
} {
  // Her iki model başarısızsa default değerler
  if (!claude && !deepseek) {
    return {
      btts: { prediction: 'no', confidence: 50, reasoning: 'Analiz başarısız' },
      overUnder: { prediction: 'under', confidence: 50, reasoning: 'Analiz başarısız' },
      matchResult: { prediction: 'draw', confidence: 50, reasoning: 'Analiz başarısız' },
      agreement: 0
    };
  }
  
  // Sadece bir model varsa onu kullan
  if (!claude) {
    return {
      btts: deepseek!.btts,
      overUnder: deepseek!.overUnder,
      matchResult: deepseek!.matchResult,
      agreement: 50
    };
  }
  
  if (!deepseek) {
    return {
      btts: claude.btts,
      overUnder: claude.overUnder,
      matchResult: claude.matchResult,
      agreement: 50
    };
  }
  
  // Her iki model de varsa konsensüs hesapla
  let agreementScore = 0;
  
  // BTTS uyumu
  const bttsAgree = claude.btts.prediction === deepseek.btts.prediction;
  if (bttsAgree) agreementScore += 33;
  
  // Over/Under uyumu
  const ouAgree = claude.overUnder.prediction === deepseek.overUnder.prediction;
  if (ouAgree) agreementScore += 33;
  
  // Match Result uyumu
  const mrAgree = claude.matchResult.prediction === deepseek.matchResult.prediction;
  if (mrAgree) agreementScore += 34;
  
  // Konsensüs tahminleri
  const btts: Prediction = bttsAgree 
    ? {
        prediction: claude.btts.prediction,
        confidence: Math.round((claude.btts.confidence + deepseek.btts.confidence) / 2),
        reasoning: claude.btts.reasoning
      }
    : claude.btts.confidence >= deepseek.btts.confidence 
      ? { ...claude.btts, confidence: Math.max(50, claude.btts.confidence - 10) }
      : { ...deepseek.btts, confidence: Math.max(50, deepseek.btts.confidence - 10) };
  
  const overUnder: Prediction = ouAgree
    ? {
        prediction: claude.overUnder.prediction,
        confidence: Math.round((claude.overUnder.confidence + deepseek.overUnder.confidence) / 2),
        reasoning: claude.overUnder.reasoning
      }
    : claude.overUnder.confidence >= deepseek.overUnder.confidence
      ? { ...claude.overUnder, confidence: Math.max(50, claude.overUnder.confidence - 10) }
      : { ...deepseek.overUnder, confidence: Math.max(50, deepseek.overUnder.confidence - 10) };
  
  const matchResult: Prediction = mrAgree
    ? {
        prediction: claude.matchResult.prediction,
        confidence: Math.round((claude.matchResult.confidence + deepseek.matchResult.confidence) / 2),
        reasoning: claude.matchResult.reasoning
      }
    : claude.matchResult.confidence >= deepseek.matchResult.confidence
      ? { ...claude.matchResult, confidence: Math.max(45, claude.matchResult.confidence - 10) }
      : { ...deepseek.matchResult, confidence: Math.max(45, deepseek.matchResult.confidence - 10) };
  
  return { btts, overUnder, matchResult, agreement: agreementScore };
}

// ============================================================================
// BEST BET CALCULATOR
// ============================================================================

function calculateBestBet(
  btts: Prediction,
  overUnder: Prediction,
  matchResult: Prediction,
  agreement: number
): { market: string; selection: string; confidence: number; reason: string } {
  // En yüksek confidence'a sahip marketi bul
  const markets = [
    { market: 'BTTS', selection: btts.prediction === 'yes' ? 'Evet' : 'Hayır', confidence: btts.confidence },
    { market: 'Over/Under 2.5', selection: overUnder.prediction === 'over' ? 'Üst' : 'Alt', confidence: overUnder.confidence },
    { market: 'Maç Sonucu', selection: matchResult.prediction === 'home' ? 'Ev Sahibi' : matchResult.prediction === 'away' ? 'Deplasman' : 'Beraberlik', confidence: matchResult.confidence }
  ];
  
  // Uyum yüksekse Match Result'ı tercih etme (zor tahmin)
  if (agreement >= 66) {
    // BTTS veya O/U tercih et
    const safeMarkets = markets.filter(m => m.market !== 'Maç Sonucu');
    const best = safeMarkets.reduce((a, b) => a.confidence > b.confidence ? a : b);
    return { ...best, reason: 'Yüksek sistem uyumu ile güvenilir tahmin' };
  }
  
  // Genel durumda en yüksek confidence
  const best = markets.reduce((a, b) => a.confidence > b.confidence ? a : b);
  return { ...best, reason: 'En yüksek güven seviyesine sahip market' };
}

// ============================================================================
// MAIN ANALYZER FUNCTION
// ============================================================================

export async function analyzeMatch(match: MatchData): Promise<SmartAnalysis> {
  const startTime = Date.now();
  const prompt = buildAnalysisPrompt(match);
  
  console.log(`🎯 Smart Analysis: ${match.homeTeam} vs ${match.awayTeam}`);
  
  // Her iki modeli paralel çağır
  const [claudeRes, deepseekRes] = await Promise.all([
    callClaude(prompt),
    callDeepSeek(prompt)
  ]);
  
  // Parse responses
  const claudeParsed = parseAIResponse(claudeRes);
  const deepseekParsed = parseAIResponse(deepseekRes);
  
  // Kullanılan modelleri belirle
  const modelsUsed: string[] = [];
  if (claudeParsed) modelsUsed.push('claude');
  if (deepseekParsed) modelsUsed.push('deepseek');
  
  // Konsensüs hesapla
  const { btts, overUnder, matchResult, agreement } = calculateConsensus(claudeParsed, deepseekParsed);
  
  // Risk seviyesi
  const riskLevel: 'low' | 'medium' | 'high' = 
    agreement >= 66 ? 'low' : agreement >= 33 ? 'medium' : 'high';
  
  // Best bet
  const bestBet = calculateBestBet(btts, overUnder, matchResult, agreement);
  
  // Overall confidence
  const overallConfidence = Math.round((btts.confidence + overUnder.confidence + matchResult.confidence) / 3);
  
  const processingTime = Date.now() - startTime;
  
  console.log(`✅ Analysis complete in ${processingTime}ms (Agreement: ${agreement}%, Models: ${modelsUsed.join(', ')})`);
  
  return {
    fixtureId: match.fixtureId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    matchDate: match.matchDate,
    
    btts,
    overUnder,
    matchResult,
    
    bestBet,
    
    agreement,
    riskLevel,
    overallConfidence,
    
    processingTime,
    modelsUsed,
    
    analyzedAt: new Date().toISOString()
  };
}

// ============================================================================
// BATCH ANALYZER
// ============================================================================

export async function analyzeBatch(matches: MatchData[], concurrency: number = 3): Promise<SmartAnalysis[]> {
  const results: SmartAnalysis[] = [];
  
  // Batch olarak işle
  for (let i = 0; i < matches.length; i += concurrency) {
    const batch = matches.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(analyzeMatch));
    results.push(...batchResults);
    
    // Rate limiting için küçük gecikme
    if (i + concurrency < matches.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

