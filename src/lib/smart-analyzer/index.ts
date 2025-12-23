// ============================================================================
// SMART ANALYZER V2 - Data-Driven AI Analysis
// Sportmonks verileri + AI analizi + İstatistiksel model
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { 
  getCompleteMatchContext, 
  getFullFixtureData,
  type MatchContext,
  type FullFixtureData
} from '../sportmonks/index';
import { 
  buildDataDrivenPrompt, 
  buildFullDataPrompt,
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
  corners: { prediction: string; confidence: number; reasoning: string; line: number; dataAvailable?: boolean }; // Korner tahmini
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

  let context: MatchContext | null = null;
  let fullData: FullFixtureData | null = null;
  let dataQuality = 'good';
  let prompt = '';

  // Step 1: Try to fetch FULL fixture data (single API call with everything)
  console.log('📊 Step 1: Fetching FULL match data from Sportmonks (single API call)...');
  fullData = await getFullFixtureData(match.fixtureId);
  
  if (fullData) {
    console.log(`✅ FULL DATA loaded! Quality: ${fullData.dataQuality.score}/100`);
    console.log(`   📊 Stats: ${fullData.dataQuality.hasStatistics}, H2H: ${fullData.dataQuality.hasH2H}, Odds: ${fullData.dataQuality.hasOdds}`);
    console.log(`   👥 Lineups: ${fullData.dataQuality.hasLineups}, 🏥 Injuries: ${fullData.dataQuality.hasInjuries}`);
    
    dataQuality = fullData.dataQuality.score >= 70 ? 'excellent' : 
                  fullData.dataQuality.score >= 50 ? 'good' : 
                  fullData.dataQuality.score >= 30 ? 'partial' : 'minimal';
    
    // Calculate corners from fullData statistics
    const calculateCornersFromStats = (teamStats: any, recentMatches: any[]): { value: number; hasData: boolean } => {
      // Try to get from statistics first
      const stats = teamStats?.statistics || [];
      const seasonStats = stats[0]?.details || [];
      const cornerStat = seasonStats.find((s: any) => s.type_id === 45);
      const avgCornersFor = cornerStat?.value?.all || cornerStat?.value?.home || 0;
      
      if (avgCornersFor > 0) {
        return { value: avgCornersFor, hasData: true };
      }
      
      // If not in stats, calculate from recent matches
      if (recentMatches?.length) {
        let totalCorners = 0;
        let cornersCount = 0;
        recentMatches.slice(0, 10).forEach((m: any) => {
          if (m.statistics) {
            const corners = m.statistics.find((s: any) => s.type_id === 45);
            if (corners?.data?.value && corners.data.value > 0) {
              totalCorners += corners.data.value;
              cornersCount++;
            }
          }
        });
        if (cornersCount > 0) {
          return { value: Math.round((totalCorners / cornersCount) * 10) / 10, hasData: true };
        }
      }
      
      return { value: 5, hasData: false }; // Default value but mark as no data
    };
    
    const homeCornersResult = calculateCornersFromStats(fullData.homeTeam.statistics, fullData.homeTeam.recentMatches);
    const awayCornersResult = calculateCornersFromStats(fullData.awayTeam.statistics, fullData.awayTeam.recentMatches);
    
    console.log('🚩 Corner data check:', {
      home: { value: homeCornersResult.value, hasData: homeCornersResult.hasData },
      away: { value: awayCornersResult.value, hasData: awayCornersResult.hasData },
      h2h: fullData.h2h?.avgCorners || 9
    });
    
    // Convert fullData to context format for statistical prediction
    context = {
      homeTeam: {
        teamId: fullData.homeTeam.id,
        teamName: fullData.homeTeam.name,
        recentForm: fullData.homeTeam.form,
        formPoints: fullData.homeTeam.formPoints,
        goalsScored: 0,
        goalsConceded: 0,
        avgGoalsScored: 1.5,
        avgGoalsConceded: 1.2,
        homeWins: 0,
        homeDraws: 0,
        homeLosses: 0,
        awayWins: 0,
        awayDraws: 0,
        awayLosses: 0,
        bttsPercentage: 50,
        over25Percentage: 50,
        under25Percentage: 50,
        cleanSheets: 0,
        failedToScore: 0,
        avgCornersFor: homeCornersResult.value,
        avgCornersAgainst: awayCornersResult.value, // Opponent's corners = this team's corners against
        totalCorners: 0
      },
      awayTeam: {
        teamId: fullData.awayTeam.id,
        teamName: fullData.awayTeam.name,
        recentForm: fullData.awayTeam.form,
        formPoints: fullData.awayTeam.formPoints,
        goalsScored: 0,
        goalsConceded: 0,
        avgGoalsScored: 1.3,
        avgGoalsConceded: 1.4,
        homeWins: 0,
        homeDraws: 0,
        homeLosses: 0,
        awayWins: 0,
        awayDraws: 0,
        awayLosses: 0,
        bttsPercentage: 50,
        over25Percentage: 50,
        under25Percentage: 50,
        cleanSheets: 0,
        failedToScore: 0,
        avgCornersFor: awayCornersResult.value,
        avgCornersAgainst: homeCornersResult.value, // Opponent's corners = this team's corners against
        totalCorners: 0
      },
      h2h: fullData.h2h,
      homeInjuries: fullData.injuries.home,
      awayInjuries: fullData.injuries.away
    };
    
    // Build FULL data prompt
    prompt = buildFullDataPrompt(match, fullData);
    
  } else {
    // Fallback: Try legacy method (multiple API calls)
    console.log('⚠️ Full data fetch failed, trying legacy method...');
    context = await getCompleteMatchContext(match.homeTeamId, match.awayTeamId);
    
    if (!context) {
      console.error('❌ Failed to get match context - using basic analysis');
      dataQuality = 'no_data';
      return runBasicAnalysis(match, startTime);
    }
    
    console.log(`✅ Legacy data loaded: ${context.homeTeam.teamName} vs ${context.awayTeam.teamName}`);
    prompt = buildDataDrivenPrompt(match, context);
  }

  // Step 2: Calculate statistical prediction (AI-independent)
  console.log('📈 Step 2: Calculating statistical prediction...');
  const statsPrediction = calculateStatisticalPrediction(context);
  console.log(`   BTTS: ${statsPrediction.btts.prediction} (%${statsPrediction.btts.confidence})`);
  console.log(`   O/U: ${statsPrediction.overUnder.prediction} (%${statsPrediction.overUnder.confidence})`);
  console.log(`   MS: ${statsPrediction.matchResult.prediction} (%${statsPrediction.matchResult.confidence})`);

  // Step 3: Prompt already built above
  console.log('🤖 Step 3: AI prompt ready with real data...');

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
      // Try to get corners from AI response or extract from reasoning
      corners: (() => {
        // If either AI has corners field, use it
        if (claudeParsed.corners || deepseekParsed.corners) {
          return {
            prediction: claudeParsed.corners?.prediction || deepseekParsed.corners?.prediction || 'over',
            confidence: Math.round(((claudeParsed.corners?.confidence || 50) + (deepseekParsed.corners?.confidence || 50)) / 2),
            reasoning: `Claude: ${claudeParsed.corners?.reasoning || 'N/A'} | DeepSeek: ${deepseekParsed.corners?.reasoning || 'N/A'}`,
            line: claudeParsed.corners?.line || deepseekParsed.corners?.line || 9.5
          };
        }
        
        // Check if reasoning mentions corners (AI might have data but forgot corners field)
        const allReasoning = [
          claudeParsed.overUnder?.reasoning || '',
          deepseekParsed.overUnder?.reasoning || '',
          claudeParsed.btts?.reasoning || '',
          deepseekParsed.btts?.reasoning || ''
        ].join(' ').toLowerCase();
        
        if (allReasoning.includes('korner') || allReasoning.includes('corner')) {
          // Try to extract prediction from reasoning
          const hasOver = allReasoning.includes('over') || allReasoning.includes('üst') || allReasoning.includes('yüksek');
          const hasUnder = allReasoning.includes('under') || allReasoning.includes('alt') || allReasoning.includes('düşük');
          
          return {
            prediction: hasOver ? 'over' : hasUnder ? 'under' : 'over',
            confidence: 55, // Default medium confidence
            reasoning: `Corners mentioned in analysis but not explicitly predicted`,
            line: 9.5
          };
        }
        
        return null;
      })(),
      bestBet: claudeParsed.bestBet?.confidence > deepseekParsed.bestBet?.confidence ? claudeParsed.bestBet : deepseekParsed.bestBet
    };
    modelsUsed = ['claude', 'deepseek'];
    console.log('✅ Both AI models responded');
    console.log('🚩 Corners from AI:', { claude: claudeParsed.corners, deepseek: deepseekParsed.corners });
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
      corners: {
        prediction: 'unknown',
        confidence: 0,
        reasoning: 'Korner verisi mevcut değil',
        line: 9.5,
        dataAvailable: false
      },
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
  const combined = combineAIandStats(aiPrediction, statsPrediction, context);

  // Calculate overall confidence (with NaN protection)
  const bttsConf = combined.btts.confidence || 50;
  const ouConf = combined.overUnder.confidence || 50;
  const mrConf = combined.matchResult.confidence || 50;
  const overallConfidence = Math.round((bttsConf + ouConf + mrConf) / 3) || 55;

  const result: SmartAnalysisResult = {
    fixtureId: match.fixtureId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    matchDate: match.matchDate,
    btts: combined.btts,
    overUnder: combined.overUnder,
    matchResult: combined.matchResult,
    corners: combined.corners || {
      prediction: 'unknown',
      confidence: 0,
      reasoning: 'Korner verisi mevcut değil',
      line: 9.5,
      dataAvailable: false
    },
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
    corners: {
      prediction: 'unknown',
      confidence: 0,
      reasoning: 'Korner verisi mevcut değil',
      line: 9.5,
      dataAvailable: false
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
