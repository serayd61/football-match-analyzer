// ============================================================================
// SMART ANALYZER V2 - Data-Driven AI Analysis
// Sportmonks verileri + AI analizi + İstatistiksel model
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getCompleteMatchContext, type MatchContext } from '../sportmonks/index';
import { 
  buildDataDrivenPrompt, 
  calculateStatisticalPrediction,
  combineAIandStats,
  MatchDetails,
  CombinedPrediction
} from '../smart-prompt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

export interface SmartAnalysisResult {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  btts: { prediction: string; confidence: number; reasoning: string };
  overUnder: { prediction: string; confidence: number; reasoning: string };
  matchResult: { prediction: string; confidence: number; reasoning: string };
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
  overallConfidence: number;
  processingTime: number;
  modelsUsed: string[];
  dataQuality: string;
  analyzedAt: string;
}

// ============================================================================
// AI CALLS
// ============================================================================

async function callClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is missing!');
    return '';
  }
  
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Claude API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    return data.content?.[0]?.text || '';
  } catch (error: any) {
    console.error('❌ Claude exception:', error.message || error);
    return '';
  }
}

async function callDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY is missing!');
    return '';
  }
  
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Sen bir futbol istatistik analistisin. Sadece verilen verilere dayanarak analiz yaparsın. Tahmin etmezsin, verileri yorumlarsın.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ DeepSeek API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('❌ DeepSeek exception:', error);
    return '';
  }
}

// ============================================================================
// PARSE AI RESPONSE
// ============================================================================

function parseAIResponse(text: string): any | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    return null;
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function runSmartAnalysis(match: MatchDetails): Promise<SmartAnalysisResult | null> {
  const startTime = Date.now();
  console.log(`\n🔬 ========================================`);
  console.log(`🔬 DATA-DRIVEN ANALYSIS: ${match.homeTeam} vs ${match.awayTeam}`);
  console.log(`🔬 ========================================\n`);

  // Step 1: Fetch complete match context from Sportmonks
  console.log('📊 Step 1: Fetching match data from Sportmonks...');
  const context = await getCompleteMatchContext(match.homeTeamId, match.awayTeamId);
  
  let dataQuality = 'good';
  
  if (!context) {
    console.error('❌ Failed to get match context - using basic analysis');
    dataQuality = 'no_data';
    
    // Fallback to basic analysis without data
    return runBasicAnalysis(match, startTime);
  }

  console.log(`✅ Data loaded: ${context.homeTeam.teamName} (Form: ${context.homeTeam.recentForm}) vs ${context.awayTeam.teamName} (Form: ${context.awayTeam.recentForm})`);

  // Step 2: Calculate statistical prediction (AI-independent)
  console.log('📈 Step 2: Calculating statistical prediction...');
  const statsPrediction = calculateStatisticalPrediction(context);
  console.log(`   BTTS: ${statsPrediction.btts.prediction} (%${statsPrediction.btts.confidence})`);
  console.log(`   O/U: ${statsPrediction.overUnder.prediction} (%${statsPrediction.overUnder.confidence})`);
  console.log(`   MS: ${statsPrediction.matchResult.prediction} (%${statsPrediction.matchResult.confidence})`);

  // Step 3: Build data-driven prompt
  console.log('🤖 Step 3: Building AI prompt with real data...');
  const prompt = buildDataDrivenPrompt(match, context);

  // Step 4: Call AI models in parallel
  console.log('🧠 Step 4: Calling Claude & DeepSeek with data...');
  const [claudeRes, deepseekRes] = await Promise.all([
    callClaude(prompt),
    callDeepSeek(prompt)
  ]);

  const claudeParsed = parseAIResponse(claudeRes);
  const deepseekParsed = parseAIResponse(deepseekRes);

  // Step 5: Combine AI predictions
  let aiPrediction: any = null;
  let modelsUsed: string[] = [];

  if (claudeParsed && deepseekParsed) {
    // Average both AI predictions
    aiPrediction = {
      btts: {
        prediction: claudeParsed.btts?.prediction === deepseekParsed.btts?.prediction 
          ? claudeParsed.btts.prediction 
          : (claudeParsed.btts?.confidence > deepseekParsed.btts?.confidence ? claudeParsed.btts.prediction : deepseekParsed.btts.prediction),
        confidence: Math.round((claudeParsed.btts?.confidence + deepseekParsed.btts?.confidence) / 2),
        reasoning: `Claude: ${claudeParsed.btts?.reasoning} | DeepSeek: ${deepseekParsed.btts?.reasoning}`
      },
      overUnder: {
        prediction: claudeParsed.overUnder?.prediction === deepseekParsed.overUnder?.prediction 
          ? claudeParsed.overUnder.prediction 
          : (claudeParsed.overUnder?.confidence > deepseekParsed.overUnder?.confidence ? claudeParsed.overUnder.prediction : deepseekParsed.overUnder.prediction),
        confidence: Math.round((claudeParsed.overUnder?.confidence + deepseekParsed.overUnder?.confidence) / 2),
        reasoning: `Claude: ${claudeParsed.overUnder?.reasoning} | DeepSeek: ${deepseekParsed.overUnder?.reasoning}`
      },
      matchResult: {
        prediction: claudeParsed.matchResult?.prediction === deepseekParsed.matchResult?.prediction 
          ? claudeParsed.matchResult.prediction 
          : (claudeParsed.matchResult?.confidence > deepseekParsed.matchResult?.confidence ? claudeParsed.matchResult.prediction : deepseekParsed.matchResult.prediction),
        confidence: Math.round((claudeParsed.matchResult?.confidence + deepseekParsed.matchResult?.confidence) / 2),
        reasoning: `Claude: ${claudeParsed.matchResult?.reasoning} | DeepSeek: ${deepseekParsed.matchResult?.reasoning}`
      },
      bestBet: claudeParsed.bestBet?.confidence > deepseekParsed.bestBet?.confidence ? claudeParsed.bestBet : deepseekParsed.bestBet
    };
    modelsUsed = ['claude', 'deepseek'];
    console.log('✅ Both AI models responded');
  } else if (claudeParsed) {
    aiPrediction = claudeParsed;
    modelsUsed = ['claude'];
    console.log('⚠️ Only Claude responded');
  } else if (deepseekParsed) {
    aiPrediction = deepseekParsed;
    modelsUsed = ['deepseek'];
    console.log('⚠️ Only DeepSeek responded');
  } else {
    // Use only statistical prediction
    console.log('⚠️ No AI response - using statistical model only');
    dataQuality = 'ai_failed';
    modelsUsed = ['stats_only'];
    
    return {
      fixtureId: match.fixtureId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      matchDate: match.matchDate,
      btts: { ...statsPrediction.btts, reasoning: statsPrediction.btts.reason },
      overUnder: { ...statsPrediction.overUnder, reasoning: statsPrediction.overUnder.reason },
      matchResult: { ...statsPrediction.matchResult, reasoning: statsPrediction.matchResult.reason },
      bestBet: {
        market: 'BTTS',
        selection: statsPrediction.btts.prediction,
        confidence: statsPrediction.btts.confidence,
        reason: 'İstatistiksel model'
      },
      agreement: 100,
      riskLevel: 'medium',
      overallConfidence: Math.round(
        (statsPrediction.btts.confidence + 
         statsPrediction.overUnder.confidence + 
         statsPrediction.matchResult.confidence) / 3
      ),
      processingTime: Date.now() - startTime,
      modelsUsed,
      dataQuality,
      analyzedAt: new Date().toISOString()
    };
  }

  // Step 6: Combine AI + Statistical predictions
  console.log('🔄 Step 6: Combining AI + Statistical predictions...');
  const combined = combineAIandStats(aiPrediction, statsPrediction);

  // Calculate overall confidence
  const overallConfidence = Math.round(
    (combined.btts.confidence + combined.overUnder.confidence + combined.matchResult.confidence) / 3
  );

  const result: SmartAnalysisResult = {
    fixtureId: match.fixtureId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    matchDate: match.matchDate,
    btts: combined.btts,
    overUnder: combined.overUnder,
    matchResult: combined.matchResult,
    bestBet: combined.bestBet,
    agreement: combined.agreement,
    riskLevel: combined.riskLevel,
    overallConfidence,
    processingTime: Date.now() - startTime,
    modelsUsed,
    dataQuality,
    analyzedAt: new Date().toISOString()
  };

  console.log(`\n✅ ANALYSIS COMPLETE in ${result.processingTime}ms`);
  console.log(`   Agreement: ${result.agreement}%`);
  console.log(`   Risk: ${result.riskLevel}`);
  console.log(`   Best Bet: ${result.bestBet.market} → ${result.bestBet.selection} (%${result.bestBet.confidence})`);

  return result;
}

// ============================================================================
// BASIC ANALYSIS (Fallback when no Sportmonks data)
// ============================================================================

async function runBasicAnalysis(match: MatchDetails, startTime: number): Promise<SmartAnalysisResult | null> {
  const basicPrompt = `
Futbol maçı analizi yap:
${match.homeTeam} vs ${match.awayTeam}
Lig: ${match.league}
Tarih: ${match.matchDate}

Sadece JSON formatında yanıt ver:
{
  "btts": { "prediction": "yes/no", "confidence": 50-65, "reasoning": "kısa gerekçe" },
  "overUnder": { "prediction": "over/under", "confidence": 50-65, "reasoning": "kısa gerekçe" },
  "matchResult": { "prediction": "home/draw/away", "confidence": 50-60, "reasoning": "kısa gerekçe" },
  "bestBet": { "market": "...", "selection": "...", "confidence": 50-60, "reason": "..." }
}

NOT: Veri olmadan analiz yapıyorsun, güven değerleri düşük olmalı!
`;

  const [claudeRes, deepseekRes] = await Promise.all([
    callClaude(basicPrompt),
    callDeepSeek(basicPrompt)
  ]);

  const parsed = parseAIResponse(claudeRes) || parseAIResponse(deepseekRes);
  
  if (!parsed) {
    return null;
  }

  return {
    fixtureId: match.fixtureId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    matchDate: match.matchDate,
    btts: {
      prediction: parsed.btts?.prediction || 'no',
      confidence: Math.min(60, parsed.btts?.confidence || 50),
      reasoning: parsed.btts?.reasoning || 'Veri eksik'
    },
    overUnder: {
      prediction: parsed.overUnder?.prediction || 'under',
      confidence: Math.min(60, parsed.overUnder?.confidence || 50),
      reasoning: parsed.overUnder?.reasoning || 'Veri eksik'
    },
    matchResult: {
      prediction: parsed.matchResult?.prediction || 'draw',
      confidence: Math.min(55, parsed.matchResult?.confidence || 50),
      reasoning: parsed.matchResult?.reasoning || 'Veri eksik'
    },
    bestBet: parsed.bestBet || {
      market: 'BTTS',
      selection: 'no',
      confidence: 50,
      reason: 'Veri eksik - düşük güven'
    },
    agreement: 50,
    riskLevel: 'high',
    overallConfidence: 52,
    processingTime: Date.now() - startTime,
    modelsUsed: ['basic'],
    dataQuality: 'no_data',
    analyzedAt: new Date().toISOString()
  };
}

// ============================================================================
// SAVE TO DATABASE
// ============================================================================

export async function saveSmartAnalysis(match: MatchDetails, analysis: SmartAnalysisResult): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('smart_analysis')
      .upsert({
        fixture_id: match.fixtureId,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        league: match.league,
        match_date: match.matchDate,
        analysis: analysis,
        btts_prediction: analysis.btts.prediction,
        btts_confidence: analysis.btts.confidence,
        over_under_prediction: analysis.overUnder.prediction,
        over_under_confidence: analysis.overUnder.confidence,
        match_result_prediction: analysis.matchResult.prediction,
        match_result_confidence: analysis.matchResult.confidence,
        agreement: analysis.agreement,
        risk_level: analysis.riskLevel,
        overall_confidence: analysis.overallConfidence,
        processing_time: analysis.processingTime,
        models_used: analysis.modelsUsed,
        data_quality: analysis.dataQuality,
        is_settled: false,
        created_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (error) {
      console.error('❌ Error saving analysis:', error);
      return false;
    }
    
    console.log(`💾 Analysis saved to database`);
    return true;
  } catch (error) {
    console.error('❌ Exception saving analysis:', error);
    return false;
  }
}
