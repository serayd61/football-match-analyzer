// ============================================================================
// CRON JOB - AUTO SETTLE ADMIN PREDICTIONS
// Birden fazla kaynaktan maç sonuçlarını alıp Admin Panel tahminlerini settle eder
// Kaynaklar: API-Football, Football-Data.org, LiveScore, SportMonks, The Odds API
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { settleMatchResult } from '@/lib/admin/service';
import { settleProfessionalMarketPrediction } from '@/lib/admin/enhanced-service';
import { matchResultManager } from '@/lib/match-results';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    // Aktif provider'ları göster
    const availableProviders = matchResultManager.getAvailableProviders();
    console.log(`📡 Active Providers: ${availableProviders.length > 0 ? availableProviders.join(', ') : 'SportMonks only'}`);

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
    // STEP 2: Group predictions by fixture for team info
    // ═══════════════════════════════════════════════════════════════════════
    
    // Create a map of fixture info
    const fixtureMap = new Map<number, { homeTeam: string; awayTeam: string; matchDate: string }>();
    pendingPredictions.forEach(p => {
      if (!fixtureMap.has(p.fixture_id)) {
        fixtureMap.set(p.fixture_id, {
          homeTeam: p.home_team,
          awayTeam: p.away_team,
          matchDate: p.match_date,
        });
      }
    });
    
    console.log(`🎯 Checking ${fixtureMap.size} unique fixtures`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Fetch match results from multiple providers
    // ═══════════════════════════════════════════════════════════════════════
    
    let settledCount = 0;
    let errorCount = 0;
    const providerStats: { [provider: string]: number } = {};

    for (const [fixtureId, fixtureInfo] of fixtureMap) {
      try {
        // Multi-provider'dan sonuç al
        const result = await matchResultManager.fetchResult(
          fixtureId,
          fixtureInfo.homeTeam,
          fixtureInfo.awayTeam,
          fixtureInfo.matchDate
        );
        
        if (!result) {
          console.log(`   ⏳ Match ${fixtureId} not finished yet`);
          continue;
        }

        console.log(`   📊 Result: ${result.homeScore}-${result.awayScore} (via ${result.source})`);

        // Provider istatistiği
        providerStats[result.source] = (providerStats[result.source] || 0) + 1;

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

        // Also settle professional market predictions
        try {
          // Handle corners - could be number or object
          const cornersData = result.corners as any;
          const cornersHome = typeof cornersData === 'object' ? cornersData?.home : undefined;
          const cornersAway = typeof cornersData === 'object' ? cornersData?.away : undefined;
          
          // Handle cards - could be number or object  
          const yellowData = result.yellowCards as any;
          const redData = result.redCards as any;
          const yellowHome = typeof yellowData === 'object' ? (yellowData?.home || 0) : 0;
          const yellowAway = typeof yellowData === 'object' ? (yellowData?.away || 0) : 0;
          const redHome = typeof redData === 'object' ? (redData?.home || 0) : 0;
          const redAway = typeof redData === 'object' ? (redData?.away || 0) : 0;

          await settleProfessionalMarketPrediction(fixtureId, {
            fixture_id: fixtureId,
            home_score: result.homeScore,
            away_score: result.awayScore,
            ht_home: result.htHomeScore,
            ht_away: result.htAwayScore,
            corners_home: cornersHome,
            corners_away: cornersAway,
            cards_home: yellowHome + redHome,
            cards_away: yellowAway + redAway,
            result_source: result.source,
          });
          console.log(`   🎰 Pro markets settled for fixture ${fixtureId}`);
        } catch (proSettleErr: any) {
          console.log(`   ⚠️ Pro markets settle skipped: ${proSettleErr.message?.substring(0, 50)}`);
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
    console.log(`   📊 Checked: ${fixtureMap.size} fixtures`);
    console.log(`   ✅ Settled: ${settledCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📡 Sources used:`);
    Object.entries(providerStats).forEach(([provider, count]) => {
      console.log(`      - ${provider}: ${count} results`);
    });
    console.log(`   ⏱️ Time: ${totalTime}ms`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Cron job completed',
      stats: {
        checked: fixtureMap.size,
        settled: settledCount,
        errors: errorCount,
        duration: totalTime,
        providers: providerStats,
        availableProviders,
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

