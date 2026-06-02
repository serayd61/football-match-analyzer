// ============================================================================
// API V2: QUEUE DAILY - Günlük Maçları Queue'a Ekle
// Cron job olarak çalışır, her maç için ayrı job oluşturur
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { queueDailyAnalysis, AnalysisJob, queueAnalysisJob } from '@/lib/queue/qstash';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getMatchesByDate, FFMatch } from '@/lib/data-sources/free-football';

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

async function fetchTodayFixtures(): Promise<FFMatch[]> {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const [d1, d2] = await Promise.all([
      getMatchesByDate(today),
      getMatchesByDate(tomorrow),
    ]);
    // fixture id'ye göre tekille
    const seen = new Set<number>();
    const unique: FFMatch[] = [];
    for (const m of [...d1, ...d2]) {
      if (m.id && !seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
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

async function filterUnanalyzedFixtures(fixtures: FFMatch[]): Promise<FFMatch[]> {
  const fixtureIds = fixtures.map(f => f.id);

  // Supabase'den analiz edilmiş maçları al
  const { data: analyzed } = await supabase
    .from('smart_analysis')
    .select('fixture_id')
    .in('fixture_id', fixtureIds);

  const analyzedIds = new Set((analyzed || []).map(a => a.fixture_id));

  // Henüz analiz edilmemiş ve başlamamış maçları filtrele
  const now = new Date();

  return fixtures.filter(f => {
    if (analyzedIds.has(f.id)) return false;
    if (f.started || f.finished || f.cancelled) return false;

    const kickOff = new Date(f.utcTime);
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
        fixtureId: f.id,
        homeTeam: f.homeName || 'Unknown',
        awayTeam: f.awayName || 'Unknown',
        homeTeamId: f.homeId,
        awayTeamId: f.awayId,
        league: f.leagueName || 'Unknown',
        matchDate: f.utcTime?.split('T')[0] || new Date().toISOString().split('T')[0],
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

