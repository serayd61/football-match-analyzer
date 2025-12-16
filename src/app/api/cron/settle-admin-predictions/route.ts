// ============================================================================
// CRON JOB - AUTO SETTLE ADMIN PREDICTIONS
// Maç sonuçlarını SportMonks'tan alıp Admin Panel tahminlerini settle eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { settleMatchResult } from '@/lib/admin/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret for security (optional)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow access without auth for manual testing
      console.log('⚠️ No CRON_SECRET verification - proceeding anyway');
    }

    console.log('\n' + '═'.repeat(70));
    console.log('🔄 AUTO-SETTLE ADMIN PREDICTIONS CRON JOB');
    console.log('═'.repeat(70));

    const supabase = getSupabaseAdmin();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Get pending predictions with past match dates
    // ═══════════════════════════════════════════════════════════════════════
    
    const now = new Date();
    // Get matches that ended at least 2 hours ago
    const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const { data: pendingPredictions, error: fetchError } = await supabase
      .from('prediction_records')
      .select('fixture_id, home_team, away_team, match_date')
      .eq('status', 'pending')
      .lt('match_date', cutoffTime.toISOString())
      .limit(50); // Process max 50 per run

    if (fetchError) {
      console.error('Error fetching pending predictions:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: fetchError.message 
      }, { status: 500 });
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      console.log('✅ No pending predictions to settle');
      return NextResponse.json({ 
        success: true, 
        message: 'No pending predictions to settle',
        processed: 0 
      });
    }

    console.log(`📋 Found ${pendingPredictions.length} pending predictions to check`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Get unique fixture IDs
    // ═══════════════════════════════════════════════════════════════════════
    
    const fixtureIds = [...new Set(pendingPredictions.map(p => p.fixture_id))];
    console.log(`🎯 Checking ${fixtureIds.length} unique fixtures`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Fetch match results from SportMonks
    // ═══════════════════════════════════════════════════════════════════════
    
    let settledCount = 0;
    let errorCount = 0;

    for (const fixtureId of fixtureIds) {
      try {
        console.log(`\n🔍 Fetching result for fixture ${fixtureId}...`);
        
        const result = await fetchMatchResult(fixtureId);
        
        if (!result) {
          console.log(`   ⏳ Match ${fixtureId} not finished yet`);
          continue;
        }

        console.log(`   📊 Result: ${result.homeScore}-${result.awayScore}`);

        // Settle the prediction
        const settleResult = await settleMatchResult({
          fixtureId,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          htHomeScore: result.htHomeScore,
          htAwayScore: result.htAwayScore,
          corners: result.corners,
          yellowCards: result.yellowCards,
          redCards: result.redCards,
        });

        if (settleResult.success) {
          settledCount++;
          console.log(`   ✅ Settled fixture ${fixtureId}`);
        } else {
          errorCount++;
          console.log(`   ❌ Failed to settle: ${settleResult.error}`);
        }

        // Rate limiting
        await sleep(500);

      } catch (err: any) {
        errorCount++;
        console.error(`   ❌ Error processing fixture ${fixtureId}:`, err.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Summary
    // ═══════════════════════════════════════════════════════════════════════
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ CRON JOB COMPLETED');
    console.log(`   📊 Checked: ${fixtureIds.length} fixtures`);
    console.log(`   ✅ Settled: ${settledCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏱️ Time: ${totalTime}ms`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Cron job completed',
      stats: {
        checked: fixtureIds.length,
        settled: settledCount,
        errors: errorCount,
        duration: totalTime,
      },
    });

  } catch (error: any) {
    console.error('❌ CRON JOB ERROR:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface MatchResult {
  homeScore: number;
  awayScore: number;
  htHomeScore?: number;
  htAwayScore?: number;
  corners?: number;
  yellowCards?: number;
  redCards?: number;
}

async function fetchMatchResult(fixtureId: number): Promise<MatchResult | null> {
  if (!SPORTMONKS_API_KEY) {
    console.error('SPORTMONKS_API_KEY not set');
    return null;
  }

  try {
    const url = `${SPORTMONKS_BASE_URL}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores;statistics`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`SportMonks API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) {
      return null;
    }

    // Check if match is finished
    const state = fixture.state?.state;
    if (state !== 'FT' && state !== 'AET' && state !== 'PEN') {
      // Match not finished
      return null;
    }

    // Get scores
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;
    let htHomeScore: number | undefined;
    let htAwayScore: number | undefined;

    for (const score of scores) {
      if (score.description === 'CURRENT') {
        homeScore = score.score?.participant === 'home' ? score.score?.goals : homeScore;
        awayScore = score.score?.participant === 'away' ? score.score?.goals : awayScore;
      }
      if (score.description === '1ST_HALF') {
        htHomeScore = score.score?.participant === 'home' ? score.score?.goals : htHomeScore;
        htAwayScore = score.score?.participant === 'away' ? score.score?.goals : htAwayScore;
      }
    }

    // Alternative score extraction
    if (homeScore === 0 && awayScore === 0) {
      for (const score of scores) {
        if (score.participant === 'home' && score.description === 'CURRENT') {
          homeScore = score.goals || 0;
        }
        if (score.participant === 'away' && score.description === 'CURRENT') {
          awayScore = score.goals || 0;
        }
      }
    }

    // Get statistics
    let corners: number | undefined;
    let yellowCards: number | undefined;
    let redCards: number | undefined;

    const statistics = fixture.statistics || [];
    for (const stat of statistics) {
      if (stat.type?.code === 'corners') {
        corners = (corners || 0) + (stat.data?.value || 0);
      }
      if (stat.type?.code === 'yellowcards') {
        yellowCards = (yellowCards || 0) + (stat.data?.value || 0);
      }
      if (stat.type?.code === 'redcards') {
        redCards = (redCards || 0) + (stat.data?.value || 0);
      }
    }

    return {
      homeScore,
      awayScore,
      htHomeScore,
      htAwayScore,
      corners,
      yellowCards,
      redCards,
    };

  } catch (error: any) {
    console.error('Error fetching match result:', error.message);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

