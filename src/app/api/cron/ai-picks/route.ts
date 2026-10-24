// ============================================================================
// CRON — AI ANALİZİ: KAPSAMLI LİGDEKİ HER MAÇ (18 Eki → 24 Eki genişletildi)
// ----------------------------------------------------------------------------
// Kullanıcı kararı: AI analizi müşteriye bırakılmaz (kredi tükenir); her gün
// kapsamlı ligdeki (site_reco_picks.covered) maçlar için TAM unified consensus
// otomatik koşar ve unified_analysis'e yazılır. 24 Eki'ye kadar yalnız öneri
// kuralını geçen (seçimli) maçlar analiz ediliyordu (~%40 kapsama); kullanıcı
// kararıyla pazar filtresi kaldırıldı, günlük tavan 40 → 77 (36 sa pencerede
// kapsamlı maç sayısı). Maç sayfası bunu salt-okunur gösterir. Saatlik koşar
// (reco-picks :35'te tazelenir), her maç bir kez analiz edilir.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { dbFresh } from '@/lib/site/db';
import { runUnifiedConsensus, saveUnifiedAnalysis } from '@/lib/unified-consensus';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PER_RUN = 12;        // tur başına (≈6-10 sn/maç)
const DAILY_CAP = 77;          // günde en çok bu kadar yeni tam analiz (maliyet freni; 24 Eki: 40 → 77)
const TIME_BUDGET_MS = 240_000;
const HORIZON_H = 36;          // bugün + yarın sabah
const MIN_LEAD_MS = 60 * 60_000; // başlamaya ≥1 saat (oran/kadro otursun)

// Önbelleksiz istemci ŞART: ilk yerel koşuda normal istemcinin GET'i 5 dk Next fetch
// önbelleğinde kaldı, ikinci tur aynı 12 maçı yeniden analiz etti (24 LLM çağrısı boşa).
const sb = dbFresh;

/** Tam analiz = survival/dixonColes/marketModel içeren satır; salt 'smart' satırı sayılmaz. */
const isFull = (r: any) => Array.isArray(r.systems_used) && r.systems_used.some((s: string) => s !== 'smart');

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const t0 = Date.now();
  const dry = request.nextUrl.searchParams.get('dry') === '1';
  const now = new Date();
  const from = new Date(now.getTime() + MIN_LEAD_MS).toISOString();
  const to = new Date(now.getTime() + HORIZON_H * 3600_000).toISOString();
  const db = sb();

  // 1) Kapsamlı ligdeki tüm maçlar (24 Eki: seçim şartı kaldırıldı; market null olabilir)
  const { data: picks, error } = await db
    .from('site_reco_picks')
    .select('fixture_id, kickoff, league_name, home_name, away_name, market, selection, p_display')
    .eq('covered', true)
    .gte('kickoff', from).lte('kickoff', to)
    .order('kickoff', { ascending: true }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!picks?.length) return NextResponse.json({ ok: true, candidates: 0, analyzed: [], reason: 'kapsamlı ligde maç yok' });

  const ids = picks.map((p) => Number(p.fixture_id));
  // 2) Zaten tam analizi olanlar + günlük tavan
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const [{ data: existing }, { data: todays }, { data: teams }] = await Promise.all([
    db.from('unified_analysis').select('fixture_id, systems_used').in('fixture_id', ids),
    db.from('unified_analysis').select('fixture_id, systems_used').gte('created_at', dayStart.toISOString()),
    db.from('engine_predictions').select('fixture_id, home_id, away_id').in('fixture_id', ids).eq('model_version', 'dc-1.0'),
  ]);
  const done = new Set((existing || []).filter(isFull).map((r: any) => Number(r.fixture_id)));
  const todayFull = (todays || []).filter(isFull).length;
  const teamOf = new Map((teams || []).map((r: any) => [Number(r.fixture_id), r]));

  const todo = picks.filter((p) => !done.has(Number(p.fixture_id)) && teamOf.has(Number(p.fixture_id)));
  const budget = Math.max(0, Math.min(MAX_PER_RUN, DAILY_CAP - todayFull));
  if (dry) return NextResponse.json({ ok: true, dry: true, candidates: picks.length, alreadyDone: done.size, todayFull, budget, todo: todo.slice(0, budget).map((p) => `${p.home_name} – ${p.away_name} (${p.league_name})`) });

  const analyzed: any[] = []; const skipped: any[] = [];
  for (const p of todo) {
    if (analyzed.length >= budget) { skipped.push({ fixtureId: p.fixture_id, reason: budget === 0 ? 'günlük tavan' : 'tur sınırı' }); continue; }
    if (Date.now() - t0 > TIME_BUDGET_MS) { skipped.push({ fixtureId: p.fixture_id, reason: 'süre bütçesi' }); break; }
    const tm = teamOf.get(Number(p.fixture_id))!;
    const input = {
      fixtureId: Number(p.fixture_id), homeTeam: p.home_name, awayTeam: p.away_name,
      homeTeamId: Number(tm.home_id), awayTeamId: Number(tm.away_id),
      league: p.league_name || 'Unknown', matchDate: p.kickoff, lang: 'tr' as const,
    };
    try {
      const result = await runUnifiedConsensus(input);
      await saveUnifiedAnalysis(input, result);
      analyzed.push({ fixtureId: p.fixture_id, match: `${p.home_name} – ${p.away_name}`, league: p.league_name, pick: p.market ? `${p.market}:${p.selection}` : null, consensus: result.predictions?.matchResult?.prediction, conf: result.systemPerformance?.overallConfidence, systems: result.metadata?.systemsUsed });
    } catch (e: any) {
      console.error(`[ai-picks] ${p.home_name} – ${p.away_name} failed:`, e?.message);
      skipped.push({ fixtureId: p.fixture_id, reason: e?.message || 'error' });
    }
  }
  return NextResponse.json({ ok: true, tookMs: Date.now() - t0, candidates: picks.length, alreadyDone: done.size, todayFull, analyzed, skipped: skipped.slice(0, 20) });
}
