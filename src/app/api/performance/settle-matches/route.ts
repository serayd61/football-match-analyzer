// ============================================================================
// API: Settle Matches - Fetch results from Sportmonks and update unified_analysis
// POST /api/performance/settle-matches
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Lazy-loaded Supabase client
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

// Sportmonks API'den maç sonucu çek
async function fetchMatchResultFromSportmonks(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
  status: string;
} | null> {
  const apiKey = process.env.SPORTMONKS_API_KEY;
  
  if (!apiKey) {
    console.log('❌ SPORTMONKS_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores`;
    
    console.log(`   📡 Fetching fixture ${fixtureId}...`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`   ❌ API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) {
      console.log(`   ❌ No fixture data`);
      return null;
    }

    // State kontrolü
    const stateInfo = fixture.state;
    const stateName = stateInfo?.state || stateInfo?.developer_name || stateInfo?.short_name || '';
    const stateId = fixture.state_id;
    
    // Finished state IDs: 5 = FT, 11 = AET, 12 = PEN
    const finishedStateIds = [5, 11, 12];
    const finishedStates = ['FT', 'AET', 'PEN', 'FINISHED', 'ended'];
    
    const isFinished = 
      finishedStates.includes(stateName) || 
      finishedStateIds.includes(stateId) ||
      stateInfo?.short_name === 'FT';

    if (!isFinished) {
      console.log(`   ⏳ Not finished yet. State: ${stateName}, ID: ${stateId}`);
      return null;
    }

    // Skorları çek - Sportmonks v3 format: score.score.goals, score.score.participant
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    // CURRENT skorlarını bul (nihai skor)
    for (const scoreEntry of scores) {
      // Sportmonks v3 format: nested score object
      const participant = scoreEntry.score?.participant || scoreEntry.participant;
      const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
      
      if (scoreEntry.description === 'CURRENT') {
        if (participant === 'home') homeScore = goals;
        if (participant === 'away') awayScore = goals;
      }
    }

    // Eğer CURRENT bulunamadıysa, 2ND_HALF veya FULLTIME dene
    if (homeScore === 0 && awayScore === 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
        
        if (scoreEntry.description === '2ND_HALF' || scoreEntry.description === 'FULLTIME') {
          if (participant === 'home' && goals > homeScore) homeScore = goals;
          if (participant === 'away' && goals > awayScore) awayScore = goals;
        }
      }
    }

    console.log(`   ✅ Score: ${homeScore}-${awayScore}`);

    return {
      homeScore,
      awayScore,
      status: 'FT'
    };
  } catch (error: any) {
    console.error(`   ❌ Sportmonks error:`, error.message);
    return null;
  }
}

// Normalizasyon fonksiyonları - tutarlı karşılaştırma için (DÜZELTME: Daha kapsamlı)
function normalizeMR(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  // Daha kapsamlı kontrol - 'away', 'home', 'away_win', 'home_win' gibi formatları da yakala
  if (v === '1' || v === 'home' || v === 'ev sahibi' || v === 'home_win' || v === 'homewin' || (v.includes('home') && v.includes('win'))) return '1';
  if (v === '2' || v === 'away' || v === 'deplasman' || v === 'away_win' || v === 'awaywin' || (v.includes('away') && v.includes('win'))) return '2';
  if (v === 'x' || v === 'draw' || v === 'beraberlik' || v === 'tie' || v === 'd') return 'X';
  return v;
}

function normalizeOU(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst') || v === 'o') return 'over';
  if (v.includes('under') || v.includes('alt') || v === 'u') return 'under';
  return v;
}

function normalizeBTTS(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var' || v === 'y' || v === 'true') return 'yes';
  if (v === 'no' || v === 'hayır' || v === 'yok' || v === 'n' || v === 'false') return 'no';
  return v;
}

// Tek bir analizi settle et
async function settleAnalysis(
  supabase: SupabaseClient,
  analysis: any,
  homeScore: number,
  awayScore: number
): Promise<boolean> {
  try {
    // Gerçek sonuçları hesapla
    const totalGoals = homeScore + awayScore;
    const actualMatchResult = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
    const actualOverUnder = totalGoals > 2.5 ? 'over' : 'under';
    const actualBtts = homeScore > 0 && awayScore > 0;

    // Tahmin doğruluğunu kontrol et - NORMALİZE EDİLMİŞ KARŞILAŞTIRMA
    const predMR = normalizeMR(analysis.match_result_prediction);
    const predOU = normalizeOU(analysis.over_under_prediction);
    const predBTTS = normalizeBTTS(analysis.btts_prediction);
    
    const matchResultCorrect = predMR === actualMatchResult;
    const overUnderCorrect = predOU === actualOverUnder;
    const bttsCorrect = (predBTTS === 'yes' && actualBtts) || (predBTTS === 'no' && !actualBtts);

    // Skor tahmini kontrolü
    const predictedScore = analysis.analysis?.predictions?.matchResult?.scorePrediction ||
                          analysis.analysis?.matchResult?.scorePrediction;
    const scorePredictionCorrect = predictedScore ? 
      predictedScore === `${homeScore}-${awayScore}` : false;

    // Güncelle
    const { error: updateError } = await supabase
      .from('unified_analysis')
      .update({
        is_settled: true,
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        actual_total_goals: totalGoals,
        actual_btts: actualBtts,
        actual_match_result: actualMatchResult,
        match_result_correct: matchResultCorrect,
        over_under_correct: overUnderCorrect,
        btts_correct: bttsCorrect,
        score_prediction_correct: scorePredictionCorrect,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fixture_id', analysis.fixture_id);

    if (updateError) {
      console.error(`   ❌ Update error:`, updateError.message);
      return false;
    }

    console.log(`   ✅ Settled: ${analysis.home_team} ${homeScore}-${awayScore} ${analysis.away_team}`);
    console.log(`      MR: ${analysis.match_result_prediction} → ${actualMatchResult} (${matchResultCorrect ? '✓' : '✗'})`);
    console.log(`      O/U: ${analysis.over_under_prediction} → ${actualOverUnder} (${overUnderCorrect ? '✓' : '✗'})`);
    console.log(`      BTTS: ${analysis.btts_prediction} → ${actualBtts ? 'Yes' : 'No'} (${bttsCorrect ? '✓' : '✗'})`);

    return true;
  } catch (error: any) {
    console.error(`   ❌ Settle error:`, error.message);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting match settlement process...');
    
    const supabase = getSupabase();
    
    // Maç saatinden en az 2 saat geçmiş bekleyen analizleri al
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    // Get all unsettled analyses
    const { data: unsettledAnalyses, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('is_settled', false)
      .lte('match_date', cutoffTime.toISOString().split('T')[0])
      .order('match_date', { ascending: true })
      .limit(30);
    
    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }
    
    if (!unsettledAnalyses || unsettledAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unsettled matches to process',
        settled: 0,
        pending: 0
      });
    }
    
    console.log(`📋 Found ${unsettledAnalyses.length} unsettled analyses\n`);
    
    let settledCount = 0;
    let pendingCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    
    // Process each analysis
    for (const analysis of unsettledAnalyses) {
      console.log(`\n📊 ${analysis.home_team} vs ${analysis.away_team}`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fetch result from Sportmonks
      const result = await fetchMatchResultFromSportmonks(analysis.fixture_id);
      
      if (!result) {
        pendingCount++;
        results.push({
          fixtureId: analysis.fixture_id,
          homeTeam: analysis.home_team,
          awayTeam: analysis.away_team,
          status: 'pending',
          reason: 'Match not finished or result unavailable'
        });
        continue;
      }
      
      // Settle the match
      const success = await settleAnalysis(supabase, analysis, result.homeScore, result.awayScore);
      
      if (success) {
        settledCount++;
        results.push({
          fixtureId: analysis.fixture_id,
          homeTeam: analysis.home_team,
          awayTeam: analysis.away_team,
          status: 'settled',
          score: `${result.homeScore}-${result.awayScore}`
        });
      } else {
        errorCount++;
        results.push({
          fixtureId: analysis.fixture_id,
          homeTeam: analysis.home_team,
          awayTeam: analysis.away_team,
          status: 'error'
        });
      }
    }
    
    console.log(`\n✅ Settlement complete: ${settledCount} settled, ${pendingCount} pending, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${unsettledAnalyses.length} matches`,
      settled: settledCount,
      pending: pendingCount,
      errors: errorCount,
      results
    });
    
  } catch (error: any) {
    console.error('❌ Settle matches API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to settle matches',
    endpoint: '/api/performance/settle-matches'
  });
}
