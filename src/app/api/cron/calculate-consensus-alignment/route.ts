// ============================================================================
// CRON JOB - CALCULATE CONSENSUS ALIGNMENT
// Geçmiş maçlar için consensus alignment hesaplar (eğer eksikse)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { calculateConsensusAlignment, recordConsensusAlignment } from '@/lib/agent-learning/consensus-alignment';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

/**
 * Bir fixture için consensus alignment hesapla ve kaydet
 */
async function calculateAlignmentForFixture(fixtureId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();

    // Bu fixture için unified_analysis'ı bul
    const { data: unifiedAnalysis, error: unifiedError } = await supabase
      .from('unified_analysis')
      .select('analysis, fixture_id')
      .eq('fixture_id', fixtureId)
      .single();

    if (unifiedError || !unifiedAnalysis?.analysis) {
      console.log(`   ⚠️ No unified analysis found for fixture ${fixtureId}`);
      return false;
    }

    // Final consensus'ı çıkar
    const finalConsensus = {
      matchResult: unifiedAnalysis.analysis.predictions?.matchResult?.prediction || '',
      overUnder: unifiedAnalysis.analysis.predictions?.overUnder?.prediction || '',
      btts: unifiedAnalysis.analysis.predictions?.btts?.prediction || ''
    };

    if (!finalConsensus.matchResult && !finalConsensus.overUnder && !finalConsensus.btts) {
      console.log(`   ⚠️ No consensus found for fixture ${fixtureId}`);
      return false;
    }

    // Bu fixture için tüm agent tahminlerini bul
    const { data: agentPredictions, error: predictionsError } = await supabase
      .from('agent_predictions')
      .select('agent_name, match_result_prediction, over_under_prediction, btts_prediction')
      .eq('fixture_id', fixtureId);

    if (predictionsError || !agentPredictions || agentPredictions.length === 0) {
      console.log(`   ⚠️ No agent predictions found for fixture ${fixtureId}`);
      return false;
    }

    // Her agent için consensus alignment hesapla ve kaydet
    let successCount = 0;
    for (const agentPred of agentPredictions) {
      // Eğer zaten alignment kaydedilmişse atla
      const { data: existing } = await supabase
        .from('agent_predictions')
        .select('consensus_alignment')
        .eq('fixture_id', fixtureId)
        .eq('agent_name', agentPred.agent_name)
        .single();

      if (existing?.consensus_alignment !== null) {
        continue; // Zaten hesaplanmış
      }

      const alignment = calculateConsensusAlignment(
        {
          matchResult: agentPred.match_result_prediction || undefined,
          overUnder: agentPred.over_under_prediction || undefined,
          btts: agentPred.btts_prediction || undefined
        },
        finalConsensus
      );

      const saved = await recordConsensusAlignment(
        fixtureId,
        agentPred.agent_name,
        { ...alignment, agentName: agentPred.agent_name, fixtureId }
      );

      if (saved) {
        successCount++;
      }
    }

    if (successCount > 0) {
      console.log(`   ✅ Calculated alignment for ${successCount} agents (fixture ${fixtureId})`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error(`   ❌ Error calculating alignment for fixture ${fixtureId}:`, error.message);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('\n' + '═'.repeat(70));
    console.log('🔄 CALCULATE CONSENSUS ALIGNMENT CRON JOB');
    console.log('═'.repeat(70));

    const supabase = getSupabase();

    // Son 7 gün içinde settled olan ama consensus_alignment'ı null olan tahminleri bul
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: fixturesNeedingAlignment, error: fetchError } = await supabase
      .from('agent_predictions')
      .select('fixture_id')
      .not('settled_at', 'is', null)
      .is('consensus_alignment', null)
      .gte('settled_at', sevenDaysAgo.toISOString())
      .limit(100); // Her seferinde 100 fixture işle

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    if (!fixturesNeedingAlignment || fixturesNeedingAlignment.length === 0) {
      console.log('✅ No fixtures need alignment calculation');
      return NextResponse.json({
        success: true,
        message: 'No fixtures need alignment',
        calculated: 0
      });
    }

    // Unique fixture ID'leri al
    const uniqueFixtureIds = Array.from(
      new Set(fixturesNeedingAlignment.map(f => f.fixture_id))
    ).slice(0, 50); // Her seferinde max 50 fixture işle

    console.log(`📋 Found ${uniqueFixtureIds.length} fixtures needing alignment calculation\n`);

    let calculated = 0;
    let errors = 0;

    for (const fixtureId of uniqueFixtureIds) {
      const success = await calculateAlignmentForFixture(fixtureId);
      if (success) {
        calculated++;
      } else {
        errors++;
      }

      // Rate limiting: Her fixture arasında 100ms bekle
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const processingTime = Date.now() - startTime;

    console.log('\n' + '═'.repeat(70));
    console.log(`✅ COMPLETED in ${processingTime}ms`);
    console.log(`   Calculated: ${calculated}`);
    console.log(`   Errors: ${errors}`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      calculated,
      errors,
      processingTime
    });

  } catch (error: any) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
