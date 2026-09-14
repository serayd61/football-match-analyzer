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
import { getMatchOdds, getMatchOddsRaw } from '@/lib/data-sources/free-football';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';
import { parseMarkets } from '@/lib/site/markets';
import { phaseForMinutes, type OddsPhase } from '@/lib/site/odds-phases';
import { afOdds, hasApiFootballKey } from '@/lib/data-sources/api-football';
import { afIdsFor, buildAfMap } from '@/lib/site/af-map';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Fazlar: opening (ilk görüş) → h24 → h12 → h6 → h3 → closing (≤90 dk); bkz. odds-phases.ts.
// Tur başına maç başına tek çağrı: o anki faz yazılır, açılış yoksa aynı orandan açılış da yazılır.
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

  // Şema sondası: ?probe=<eventId> tek maçın oranını çeker, HİÇBİR ŞEY YAZMAZ.
  // Kapsanan ligde maç olmadığı dönemlerde parser'ı doğrulamak için (sezon
  // arasında canlıya çıkıp 22 Ağustos'ta parse hatası keşfetmemek adına).
  const probe = new URL(request.url).searchParams.get('probe');
  if (probe) {
    const cc = new URL(request.url).searchParams.get('cc') || 'GB';
    const [odds, raw] = await Promise.all([
      getMatchOdds(Number(probe), cc),
      getMatchOddsRaw(Number(probe), cc),
    ]);
    // "Full Time Result" marketinin ham hali — seçenek yapısını görmek için
    const markets = raw?.odds?.odds?.matchfactMarkets || raw?.odds?.matchfactMarkets || null;
    return NextResponse.json({
      ok: true, probe: Number(probe),
      parsed: odds ? { ...odds, raw: undefined } : null,
      marketHeaders: Array.isArray(markets) ? markets.map((m: any) => m?.header) : null,
      fullTimeResult: Array.isArray(markets)
        ? markets.find((m: any) => /full time result/i.test(String(m?.header || ''))) ?? null
        : null,
    });
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
  type Job = { fixtureId: number; kickoff: string; phase: OddsPhase; ccode: string };
  const candidates: Job[] = [];
  for (const p of (preds || []) as any[]) {
    const cat = catalog.get(Number(p.league_id));
    const name = isUnresolvedLeagueName(p.league_name) && cat ? cat.name : p.league_name;
    if (!isModelCovered(name, p.league_id, cat?.ccode)) continue;
    const mins = (new Date(p.kickoff).getTime() - now.getTime()) / 60000;
    candidates.push({
      fixtureId: p.fixture_id,
      kickoff: p.kickoff,
      phase: phaseForMinutes(mins),
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
    // kapanış önceliklidir: kaçarsa bir daha yakalanamaz; sonra maça en yakın olan
    .sort((a, b) => (a.phase === b.phase ? a.kickoff.localeCompare(b.kickoff) : a.phase === 'closing' ? -1 : b.phase === 'closing' ? 1 : 0))
    .slice(0, MAX_CALLS);

  // Ülke kodu geri dönüşü (2026-09-13): oran akışı İtalya (ITA) ve Türkiye (TUR)
  // için boş dönüyor — Serie A 0/32, Süper Lig 0/39 maçta hiç oran yoktu.
  // Aynı maç GB/ES/DE koduyla geliyor (Paddy Power, 1xBet, Tipico). Bilinen
  // boş kodlar doğrudan GB'ye gider; diğerleri ilk deneme boşsa GB'yi dener.
  const NO_FEED_CC = new Set(['ITA', 'TUR']);
  const ccodesFor = (cc: string) => Array.from(new Set([NO_FEED_CC.has(cc) ? 'GB' : cc, 'GB', 'ES']));

  // API-Football (2026-09-14): Üst/Alt 2,5 (+ akışta yoksa KG) — eşlenmiş maçlar için
  // faz başına tek ek çağrı. Eşleme tablosu her turda tamamlanır (lig+gün başına 1 çağrı).
  const afOn = hasApiFootballKey();
  let afMapped = 0, afCaptured = 0, afMissed = 0;
  if (afOn) { try { afMapped = (await buildAfMap(3, 20)).mapped ?? 0; } catch (e: any) { console.error('[snapshot-odds] af map:', e?.message); } }
  const afIds = afOn ? await afIdsFor(todo.map((j) => j.fixtureId)) : new Map<number, number>();

  let captured = 0, missed = 0;
  for (const job of todo) {
    let odds: Awaited<ReturnType<typeof getMatchOdds>> = null;
    for (const cc of ccodesFor(job.ccode)) {
      odds = await getMatchOdds(job.fixtureId, cc);
      if (odds) break;
      await sleep(SLEEP_MS);
    }
    if (!odds) { missed++; continue; }

    const mins = Math.round((new Date(job.kickoff).getTime() - Date.now()) / 60000);
    // KG oranı sütuna: karne raw'ı taramasın (2026-09-12 build timeout'u).
    const book = parseMarkets(odds.raw);
    const bttsCols = book?.btts ? { btts_yes_odds: book.btts.a, btts_no_odds: book.btts.b } : { btts_yes_odds: 0, btts_no_odds: 0 };
    const upsert = (extra: Record<string, number | string>) => sb().from('prediction_odds').upsert(
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
        ...extra,
      },
      { onConflict: 'fixture_id,phase' },
    );
    let { error: insErr } = await upsert(bttsCols);
    // Migration henüz uygulanmadıysa sütunsuz yaz; yakalama kaçmasın.
    if (insErr && /btts_(yes|no)_odds/.test(insErr.message)) ({ error: insErr } = await upsert({}));
    if (insErr) console.error('[snapshot-odds] insert:', insErr.message);
    // İlk görüş bu turdaysa açılış da bu orandır (aynı çağrı, ikinci satır).
    if (!insErr && job.phase !== 'opening' && !done.has(`${job.fixtureId}:opening`)) {
      const { error: opErr } = await upsert({ ...bttsCols, phase: 'opening' as any });
      if (opErr && /btts_(yes|no)_odds/.test(opErr.message)) await upsert({ phase: 'opening' as any });
    }
    else captured++;
    // Üst/Alt 2,5 sütunları (ve KG akışta yoksa) API-Football'dan; hata yakalamayı bozmaz.
    const afId = afIds.get(job.fixtureId);
    if (!insErr && afId) {
      const r = await afOdds(afId);
      if (r.ok && r.odds && (r.odds.over25 || r.odds.bttsYes)) {
        const cols: Record<string, number | string> = { over25_odds: r.odds.over25 ?? 0, under25_odds: r.odds.under25 ?? 0, ou_provider: r.odds.bookmaker };
        if (!book?.btts && r.odds.bttsYes && r.odds.bttsNo) { cols.btts_yes_odds = r.odds.bttsYes; cols.btts_no_odds = r.odds.bttsNo; }
        const phases = job.phase !== 'opening' && !done.has(`${job.fixtureId}:opening`) ? [job.phase, 'opening'] : [job.phase];
        const { error: afErr } = await sb().from('prediction_odds').update(cols).eq('fixture_id', job.fixtureId).in('phase', phases);
        if (afErr) console.error('[snapshot-odds] af update:', afErr.message); else afCaptured++;
      } else afMissed++;
    }
    await sleep(SLEEP_MS);
  }

  return NextResponse.json({
    ok: true,
    coveredUpcoming: candidates.length,
    pending: todo.length,
    captured,
    missed,
    apiFootball: afOn ? { mapped: afMapped, captured: afCaptured, missed: afMissed } : null,
  });
}
