import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron Job - Runs every hour
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
const FOOTBALL_API_HOST = 'api-football-v1.p.rapidapi.com';

// Fetch match result from API-Football
async function fetchMatchResult(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
  htHome: number | null;
  htAway: number | null;
  status: string;
} | null> {
  try {
    const res = await fetch(
      `https://${FOOTBALL_API_HOST}/v3/fixtures?id=${fixtureId}`,
      {
        headers: {
          'X-RapidAPI-Key': FOOTBALL_API_KEY,
          'X-RapidAPI-Host': FOOTBALL_API_HOST,
        },
        next: { revalidate: 0 }
      }
    );

    const data = await res.json();
    const fixture = data.response?.[0];

    if (!fixture) return null;

    const status = fixture.fixture?.status?.short || '';
    
    // Only process finished matches
    if (!['FT', 'AET', 'PEN'].includes(status)) {
      return null;
    }

    return {
      homeScore: fixture.goals?.home ?? 0,
      awayScore: fixture.goals?.away ?? 0,
      htHome: fixture.score?.halftime?.home ?? null,
      htAway: fixture.score?.halftime?.away ?? null,
      status
    };
  } catch (error) {
    console.error(`Error fetching fixture ${fixtureId}:`, error);
    return null;
  }
}

// Settle a single prediction
async function settlePrediction(
  sessionId: string, 
  fixtureId: number, 
  homeScore: number, 
  awayScore: number
) {
  // Ensure scores are numbers
  const home = Number(homeScore);
  const away = Number(awayScore);
  
  const totalGoals = home + away;
  const bttsActual = home > 0 && away > 0;
  const matchResultActual = home > away ? 'home' : home < away ? 'away' : 'draw';
  const overUnderActual = totalGoals > 2.5 ? 'over' : 'under';

  // Update prediction_sessions
  const { error: sessionError } = await supabase
    .from('prediction_sessions')
    .update({
      is_settled: true,
      actual_home_score: home,
      actual_away_score: away,
      settled_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (sessionError) {
    console.error(`Session update error for ${sessionId}:`, sessionError);
    return false;
  }

  // Get session data to calculate correctness
  const { data: session } = await supabase
    .from('prediction_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (session) {
    // Calculate consensus correctness
    const bttsCorrect = session.consensus_btts === (bttsActual ? 'yes' : 'no');
    const overUnderCorrect = session.consensus_over_under === overUnderActual;
    const matchResultCorrect = session.consensus_match_result === matchResultActual;

    await supabase
      .from('prediction_sessions')
      .update({
        btts_correct: bttsCorrect,
        over_under_correct: overUnderCorrect,
        match_result_correct: matchResultCorrect
      })
      .eq('id', sessionId);
  }

  // Update ai_model_predictions
  const { data: modelPreds } = await supabase
    .from('ai_model_predictions')
    .select('*')
    .eq('session_id', sessionId);

  if (modelPreds && modelPreds.length > 0) {
    for (const pred of modelPreds) {
      const updates: Record<string, boolean | null> = {};
      
      if (pred.btts_prediction) {
        updates.btts_correct = pred.btts_prediction === (bttsActual ? 'yes' : 'no');
      }
      if (pred.over_under_prediction) {
        updates.over_under_correct = pred.over_under_prediction === overUnderActual;
      }
      if (pred.match_result_prediction) {
        updates.match_result_correct = pred.match_result_prediction === matchResultActual;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('ai_model_predictions')
          .update(updates)
          .eq('id', pred.id);
      }
    }
  }

  return true;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Skip auth check if no secret configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('⚠️ Cron auth skipped - no secret match');
    }

    console.log('🔄 Sync predictions cron started...');

    // Get unsettled predictions from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: pendingPredictions, error: fetchError } = await supabase
      .from('prediction_sessions')
      .select('id, fixture_id, home_team, away_team, match_date')
      .eq('is_settled', false)
      .gte('match_date', sevenDaysAgo.toISOString())
      .order('match_date', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      console.log('✅ No pending predictions to settle');
      return NextResponse.json({
        success: true,
        message: 'No pending predictions',
        settled: 0,
        duration: Date.now() - startTime
      });
    }

    console.log(`📊 Found ${pendingPredictions.length} pending predictions`);

    let settled = 0;
    let skipped = 0;
    let errors = 0;

    // Process each prediction
    for (const pred of pendingPredictions) {
      try {
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

        const result = await fetchMatchResult(pred.fixture_id);

        if (!result) {
          console.log(`⏳ ${pred.home_team} vs ${pred.away_team} - Not finished yet`);
          skipped++;
          continue;
        }

        const success = await settlePrediction(
          pred.id,
          pred.fixture_id,
          result.homeScore,
          result.awayScore
        );

        if (success) {
          console.log(`✅ Settled: ${pred.home_team} ${result.homeScore}-${result.awayScore} ${pred.away_team}`);
          settled++;
        } else {
          errors++;
        }
      } catch (error) {
        console.error(`Error processing ${pred.fixture_id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🏁 Sync complete: ${settled} settled, ${skipped} skipped, ${errors} errors (${duration}ms)`);

    return NextResponse.json({
      success: true,
      settled,
      skipped,
      errors,
      total: pendingPredictions.length,
      duration
    });

  } catch (error) {
    console.error('Sync predictions error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}

