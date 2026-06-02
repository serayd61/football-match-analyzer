// ============================================================================
// API V2: QUEUE DAILY - Günlük Maçları Queue'a Ekle
// Cron job olarak çalışır, her maç için ayrı job oluşturur
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { queueDailyAnalysis, AnalysisJob, queueAnalysisJob } from '@/lib/queue/qstash';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApiFootballProvider, getEnabledLeagueIds } from '@/lib/data-providers/api-football-provider';
import { FixtureData } from '@/lib/data-providers/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let _sb: SupabaseClient | null = null;
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _sb;
}
const supabase = new Proxy({} as SupabaseClient, { get(_, p) { return (getSupabase() as any)[p]; } });

// ============================================================================
// FETCH TODAY'S FIXTURES
// ============================================================================

async function fetchTodayFixtures(): Promise<FixtureData[]> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const provider = new ApiFootballProvider();
  const leagueIds = getEnabledLeagueIds();

  try {
    // İzinli liglerde, bugün + yarın fikstürlerini çek (lig bazında ID tutarlı kalsın)
    const results = await Promise.all(
      [today, tomorrow].flatMap(date =>
        leagueIds.map(leagueId => provider.getFixturesByDate(date, leagueId))
      )
    );
    const all = results.flat();

    // fixtureId'ye göre tekille
    const seen = new Set<number>();
    const unique: FixtureData[] = [];
    for (const f of all) {
      if (f.fixtureId && !seen.has(f.fixtureId)) {
        seen.add(f.fixtureId);
        unique.push(f);
      }
    }
    return unique;
  } catch (error) {
    console.error('Fetch fixtures error:', error);
    return [];
  }
}

// ============================================================================
// FILTER UNANALYZED FIXTURES
// ============================================================================

async function filterUnanalyzedFixtures(fixtures: FixtureData[]): Promise<FixtureData[]> {
  const fixtureIds = fixtures.map(f => f.fixtureId);

  // Supabase'den analiz edilmiş maçları al
  const { data: analyzed } = await supabase
    .from('smart_analysis')
    .select('fixture_id')
    .in('fixture_id', fixtureIds);

  const analyzedIds = new Set((analyzed || []).map(a => a.fixture_id));

  // Henüz analiz edilmemiş ve başlamamış maçları filtrele
  const now = new Date();

  return fixtures.filter(f => {
    if (analyzedIds.has(f.fixtureId)) return false;
    if (f.status !== 'scheduled') return false;

    const kickOff = new Date(f.date);
    if (isNaN(kickOff.getTime())) return false;
    if (kickOff <= now) return false;

    // En az 15 dakika var mı?
    const minTime = new Date(now.getTime() + 15 * 60 * 1000);
    if (kickOff < minTime) return false;

    return true;
  });
}

// ============================================================================
// GET HANDLER - Cron Job
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('📅 QUEUE DAILY ANALYSIS');
    console.log('═'.repeat(60));
    
    // 1. Bugünün maçlarını al
    const fixtures = await fetchTodayFixtures();
    console.log(`📊 Total fixtures: ${fixtures.length}`);
    
    if (fixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No fixtures found',
        queued: 0
      });
    }
    
    // 2. Henüz analiz edilmemiş maçları filtrele
    const unanalyzed = await filterUnanalyzedFixtures(fixtures);
    console.log(`🔍 Unanalyzed: ${unanalyzed.length}`);
    
    if (unanalyzed.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All fixtures already analyzed',
        queued: 0
      });
    }
    
    // 3. Transform fixtures to jobs
    const jobs: AnalysisJob[] = unanalyzed.slice(0, 50).map((f, index) => {
      return {
        fixtureId: f.fixtureId,
        homeTeam: f.homeTeam?.name || 'Unknown',
        awayTeam: f.awayTeam?.name || 'Unknown',
        homeTeamId: f.homeTeam?.id,
        awayTeamId: f.awayTeam?.id,
        league: f.league?.name || 'Unknown',
        matchDate: f.date?.split('T')[0] || new Date().toISOString().split('T')[0],
        priority: index < 10 ? 'high' : index < 30 ? 'normal' : 'low',
        createdAt: new Date().toISOString()
      };
    });
    
    // 4. Queue'a ekle
    let queued = 0;
    let failed = 0;
    
    for (const job of jobs) {
      const result = await queueAnalysisJob(job);
      if (result.success) {
        queued++;
      } else {
        failed++;
        // QStash yoksa fallback: doğrudan analiz yap
        if (result.error === 'QStash not configured') {
          console.log(`📍 Direct analysis: ${job.homeTeam} vs ${job.awayTeam}`);
          // Burada doğrudan analiz yapabilirsiniz ama timeout riski var
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Queue complete: ${queued} queued, ${failed} failed (${duration}ms)`);
    
    return NextResponse.json({
      success: true,
      total: fixtures.length,
      unanalyzed: unanalyzed.length,
      queued,
      failed,
      duration
    });
    
  } catch (error) {
    console.error('Queue daily error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// POST da aynı işi yapsın
export async function POST(request: NextRequest) {
  return GET(request);
}

