// ============================================================================
// CRON — ORAN ANLIK GÖRÜNTÜSÜ (açılış + kapanış)
// ----------------------------------------------------------------------------
// Neden: "kazanma oranı"nın tek anlamlı tanımı ham isabet değil, PİYASAYI
// yenmek. Kapanış oranı o an saklanmazsa geriye dönük üretilemez.
//
// Maliyet disiplini: maç başına EN ÇOK 2 API çağrısı.
//   opening — tahmin ilk görüldüğünde (kickoff'a > CLOSING_WINDOW_MIN dk var)
//   closing — kickoff'a CLOSING_WINDOW_MIN dakikadan az kalınca
// Yalnızca modeli fit edilmiş ligler (bkz. model-coverage) — ölçmek istediğimiz
// ürün orası; İngiltere 7. ligine oran çekmenin bir anlamı yok.
// Saatlik çalışır; her turda iş yoksa hiç API çağrısı yapmaz.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getMatchOdds } from '@/lib/data-sources/free-football';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CLOSING_WINDOW_MIN = 90;   // bu dakikanın altında kalan maç "kapanış"
const MAX_CALLS = 40;            // tur başına üst sınır (maliyet freni)
const SLEEP_MS = 400;

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
      },
    );
  }
  return _sb;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: preds, error } = await sb()
    .from('engine_predictions')
    .select('fixture_id, league_id, league_name, kickoff')
    .eq('settled', false)
    .gte('kickoff', now.toISOString())
    .lte('kickoff', horizon.toISOString())
    .order('kickoff', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[snapshot-odds] read error:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const catalog = await getCatalogMap().catch(() => new Map());

  // Kapsanan ligler + hangi faz gerekiyor
  type Job = { fixtureId: number; kickoff: string; phase: 'opening' | 'closing'; ccode: string };
  const candidates: Job[] = [];
  for (const p of (preds || []) as any[]) {
    const cat = catalog.get(Number(p.league_id));
    const name = isUnresolvedLeagueName(p.league_name) && cat ? cat.name : p.league_name;
    if (!isModelCovered(name, p.league_id, cat?.ccode)) continue;
    const mins = (new Date(p.kickoff).getTime() - now.getTime()) / 60000;
    candidates.push({
      fixtureId: p.fixture_id,
      kickoff: p.kickoff,
      phase: mins <= CLOSING_WINDOW_MIN ? 'closing' : 'opening',
      ccode: cat?.ccode || 'GB',
    });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, covered: 0, captured: 0, note: 'kapsanan ligde yaklaşan maç yok' });
  }

  // Zaten yakalanmışları ele (aynı faz bir kez) — tek sorgu
  const ids = Array.from(new Set(candidates.map((c) => c.fixtureId)));
  const { data: existing } = await sb()
    .from('prediction_odds')
    .select('fixture_id, phase')
    .in('fixture_id', ids);
  const done = new Set((existing || []).map((r: any) => `${r.fixture_id}:${r.phase}`));

  const todo = candidates
    .filter((c) => !done.has(`${c.fixtureId}:${c.phase}`))
    // kapanış önceliklidir: kaçarsa bir daha yakalanamaz
    .sort((a, b) => (a.phase === b.phase ? 0 : a.phase === 'closing' ? -1 : 1))
    .slice(0, MAX_CALLS);

  let captured = 0, missed = 0;
  for (const job of todo) {
    const odds = await getMatchOdds(job.fixtureId, job.ccode);
    if (!odds) { missed++; await sleep(SLEEP_MS); continue; }

    const mins = Math.round((new Date(job.kickoff).getTime() - Date.now()) / 60000);
    const { error: insErr } = await sb().from('prediction_odds').upsert(
      {
        fixture_id: job.fixtureId,
        kickoff: job.kickoff,
        minutes_to_kickoff: mins,
        phase: job.phase,
        home_odds: odds.home,
        draw_odds: odds.draw,
        away_odds: odds.away,
        overround: odds.overround,
        p_home_market: odds.pHome,
        p_draw_market: odds.pDraw,
        p_away_market: odds.pAway,
        provider: odds.provider,
        // Şemayı öğrenene kadar ham yanıt saklanır; sonra kapatılabilir.
        raw: odds.raw,
      },
      { onConflict: 'fixture_id,phase' },
    );
    if (insErr) console.error('[snapshot-odds] insert:', insErr.message);
    else captured++;
    await sleep(SLEEP_MS);
  }

  return NextResponse.json({
    ok: true,
    coveredUpcoming: candidates.length,
    pending: todo.length,
    captured,
    missed,
  });
}
