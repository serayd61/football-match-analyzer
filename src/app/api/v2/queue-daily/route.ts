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

// Maliyet kontrolü (2026-08-04): batch analiz TÜM dünya maçlarını tarıyordu
// (ayda ~3.300 AI analizi; kullanıcıların baktığı ~250). Sadece vitrin değeri
// olan ligler analiz edilir — kullanıcı analizi (match/[id]) etkilenmez, o
// her lig için anlık çalışır. 77/894789=Dünya Kupası, 42=UCL, 73=UEL,
// 47=PL, 87=LaLiga, 55=SerieA, 54=Bundesliga, 53=Ligue1; INT=milli takımlar.
const BATCH_LEAGUE_IDS = new Set([77, 894789, 42, 73, 47, 87, 55, 54, 53]);
// Yedek eşleşme (2026-08-09): feed BAZI turnuvalarda sezonluk id taşır
// (EFL Cup=938221 gibi). Ölçüm: top-5 ligler kanonik id'yle geliyor
// (PL=47, LaLiga=87, SerieA=55, Ligue1=53 — 22 Ağu fikstürlerinde doğrulandı),
// yani id seti bugün çalışıyor. Ad+ülke çifti, ileride bir lig sezonluk id'ye
// kayarsa batch'in sessizce boşalmaması için ikinci bir kanca.
const BATCH_LEAGUE_NAMES = new Set([
  'Premier League|ENG', 'LaLiga|ESP', 'Serie A|ITA', 'Bundesliga|GER',
  'Ligue 1|FRA', 'Champions League|INT', 'Europa League|INT', 'World Cup|INT',
]);
function isBatchWorthy(f: FFMatch): boolean {
  const ccode = (f.leagueCountry || '').toUpperCase();
  return (
    BATCH_LEAGUE_IDS.has(f.leagueId) ||
    ccode === 'INT' ||
    BATCH_LEAGUE_NAMES.has(`${f.leagueName}|${ccode}`)
  );
}

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
    
    // 1. Bugünün maçlarını al (yalnızca batch'e değer ligler)
    const allFixtures = await fetchTodayFixtures();
    const fixtures = allFixtures.filter(isBatchWorthy);
    console.log(`📊 Total fixtures: ${allFixtures.length}, batch-worthy: ${fixtures.length}`);
    
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

