// ============================================================================
// ÖNERİLEN SEÇİM BACKTEST — kural best-1.0, walk-forward, sızıntısız.
// Her gün: önce o günün maçlarına yalnız ÖNCEKİ günlerin sonuçlarıyla seçim
// yapılır, sonra o günün sonuçları sayaçlara eklenir. İlk BURN_IN gün yalnız
// öğrenme. Kaynak: engine_predictions (resmi sürüm), gizli ligler hariç.
//
// Kullanım:  npx tsx scripts/backtest-recommend.ts [günSayısı=180]
// Gerekli:   .env.local → NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { marketYes } from '../src/lib/site/goal-blend';
import { latestPhase } from '../src/lib/site/odds-phases';
import { RecoStats, RecoMeta, K_GLOBAL, K_LEAGUE, K_META, recommend, candidatesFor, settleReco, RECO_GATE, type RecoInput, type RecoGate } from '../src/lib/site/recommend-rule';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DAYS = Number(process.argv[2]) || 180;
const BURN_IN = 30;

interface Row extends RecoInput { kickoff: string; h: number; a: number; covered: boolean; fixtureId: number }

async function load(): Promise<Row[]> {
  const { data: ver } = await sb.from('engine_model_versions').select('version').eq('status', 'active').limit(1);
  const official = ver?.[0]?.version ?? 'dc-1.0';
  const { data: cov } = await sb.from('league_coverage').select('league_id, status');
  const status = new Map<number, string>((cov ?? []).map((c: any) => [Number(c.league_id), c.status]));
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('engine_predictions')
      .select('fixture_id, league_id, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, home_score, away_score')
      .eq('model_version', official).eq('settled', true).not('home_score', 'is', null).gte('kickoff', since)
      .order('kickoff').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data as any[]) {
      const st = r.league_id != null ? status.get(Number(r.league_id)) : undefined;
      if (st === 'hidden') continue;
      out.push({ fixtureId: Number(r.fixture_id), leagueId: r.league_id, pHome: r.p_home, pDraw: r.p_draw, pAway: r.p_away, pOver25: r.p_over25, pBttsYes: r.p_btts_yes, kickoff: r.kickoff, h: r.home_score, a: r.away_score, covered: st === 'whitelist' });
    }
    if (data.length < 1000) break;
  }
  // Oranlar (prediction_odds, yalnız kapsanan ligler): son faz, marjsız.
  const { data: od } = await sb.from('prediction_odds').select('fixture_id, phase, captured_at, p_home_market, p_draw_market, p_away_market, over25_odds, under25_odds, btts_yes_odds, btts_no_odds').limit(10000);
  const by = new Map<number, any[]>();
  for (const r of (od ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
  let withMkt = 0;
  for (const r of out) {
    const rows = by.get(r.fixtureId); if (!rows) continue;
    const l = latestPhase(rows); if (!l) continue;
    const num = (v: any) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
    r.market = { pHome: num(l.p_home_market), pDraw: num(l.p_draw_market), pAway: num(l.p_away_market), pOver25: marketYes(num(l.over25_odds), num(l.under25_odds)), pBttsYes: marketYes(num(l.btts_yes_odds), num(l.btts_no_odds)) };
    withMkt++;
  }
  console.log(`resmi sürüm ${official} · ${out.length} maç (gizli ligler hariç) · ${DAYS} gün · oranlı ${withMkt}`);
  return out;
}

interface T { n: number; won: number; q: number }
const t = (): T => ({ n: 0, won: 0, q: 0 });
const add = (x: T, won: boolean, q: number) => { x.n++; if (won) x.won++; x.q += q; };
const pct = (v: number) => `%${(v * 100).toFixed(1)}`;
const line = (label: string, x: T, of?: number) => x.n
  ? `${label.padEnd(30)} n=${String(x.n).padStart(5)}  tuttu ${pct(x.won / x.n).padStart(6)}  iddia ${pct(x.q / x.n).padStart(6)}  fark ${((x.won - x.q) / x.n * 100).toFixed(1).padStart(5)}${of ? `  kapsam ${pct(x.n / of)}` : ''}`
  : `${label.padEnd(30)} -`;

function run(rowsIn: Row[], gate: RecoGate, verbose: boolean, opts = { kGlobal: K_GLOBAL, kLeague: K_LEAGUE }, kMeta = K_META, useMarket = true) {
  const rows = useMarket ? rowsIn : rowsIn.map((r) => ({ ...r, market: null }));
  const stats = new RecoStats(opts);
  const meta = new RecoMeta(kMeta);
  const shown = t(); const shownBy: Record<string, T> = {}; const pending: Array<{ p: { market: any; selection: any; q: number }; won: boolean }> = [];
  const shownMonth: Record<string, T> = {}, shownCal: Record<string, T> = {};
  const byDay = new Map<string, Row[]>();
  for (const r of rows) { const d = r.kickoff.slice(0, 10); (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(r); }
  const days = [...byDay.keys()].sort();
  const start = days.length ? new Date(Date.parse(days[0]) + BURN_IN * 86_400_000).toISOString().slice(0, 10) : '';
  const all = t(), byMarket: Record<string, T> = {}, bySeg: Record<string, T> = {}, byMonth: Record<string, T> = {}, calib: Record<string, T> = {};
  const x12 = t(), rawMax = t(); let evaluated = 0; const segN: Record<string, number> = {};
  for (const d of days) {
    const today = byDay.get(d)!;
    if (d >= start) {
      for (const r of today) {
        evaluated++;
        const seg = r.covered ? 'kapsanan' : 'kapsam dışı';
        segN[seg] = (segN[seg] ?? 0) + 1;
        if (r.market) segN['oranlı (kapsanan)'] = (segN['oranlı (kapsanan)'] ?? 0) + 1;
        const cands = candidatesFor(r);
        const x = cands.find((c) => c.market === '1x2');
        if (x) add(x12, settleReco(x.market, x.selection, r.h, r.a), x.pRaw);
        const rm = cands.reduce<typeof cands[number] | null>((b, c) => (!b || c.pRaw > b.pRaw ? c : b), null);
        if (rm) add(rawMax, settleReco(rm.market, rm.selection, r.h, r.a), rm.pRaw);
        const { pick } = recommend(r, stats, gate, meta);
        if (!pick) continue;
        const won = settleReco(pick.market, pick.selection, r.h, r.a);
        add(all, won, pick.q);
        if (r.market) add(bySeg['oranlı (kapsanan)'] ??= t(), won, pick.pDisplay);
        const disp = pick.pDisplay;
        add(shown, won, disp); add(shownBy[`${pick.market} ${pick.selection}`] ??= t(), won, disp);
        add(shownMonth[d.slice(0, 7)] ??= t(), won, disp);
        const db = disp < 0.60 ? '<60' : disp < 0.65 ? '60–65' : disp < 0.70 ? '65–70' : disp < 0.75 ? '70–75' : '≥75';
        add(shownCal[db] ??= t(), won, disp);
        pending.push({ p: pick, won });
        add(byMarket[`${pick.market} ${pick.selection}`] ??= t(), won, pick.q);
        add(bySeg[seg] ??= t(), won, pick.q);
        add(byMonth[d.slice(0, 7)] ??= t(), won, pick.q);
        const b = pick.q < 0.65 ? '60–65' : pick.q < 0.70 ? '65–70' : pick.q < 0.75 ? '70–75' : pick.q < 0.80 ? '75–80' : '≥80';
        add(calib[b] ??= t(), won, pick.q);
      }
    }
    for (const r of today) stats.add(r, r.h, r.a);
    for (const x of pending.splice(0)) meta.add(x.p, x.won);
  }
  if (!verbose) return { all, evaluated, shown, bySeg, segN };
  console.log(`\nDeğerlendirme: ${start} → ${days[days.length - 1]} · ${evaluated} maç (ilk ${BURN_IN} gün yalnız öğrenme)`);
  console.log(`Kapı: q ≥ ${pct(gate.minQ)}, gol pazarında taban üstü ≥ ${(gate.minLift * 100).toFixed(0)} puan\n`);
  console.log('— KARŞILAŞTIRMA (aynı maçlar) —');
  console.log(line('Bugünkü: 1X2 favorisi (ham)', x12, evaluated));
  console.log(line('Ham p ile en emin pazar', rawMax, evaluated));
  console.log(line('ÖNERİLEN SEÇİM (best-1.0)', all, evaluated));
  console.log(line('  …gösterim kalibreli iddia', shown, evaluated));
  console.log('\n— PAZAR / TARAF —'); for (const k of Object.keys(byMarket).sort()) console.log(line(k, byMarket[k], evaluated));
  console.log('\n— PAZAR / TARAF, GÖSTERİM KALİBRELİ —'); for (const k of Object.keys(shownBy).sort()) console.log(line(k, shownBy[k], evaluated));
  console.log('\n— KESİM —'); for (const k of Object.keys(bySeg)) console.log(line(k, bySeg[k], segN[k]));
  console.log('\n— AY —'); for (const k of Object.keys(byMonth).sort()) console.log(line(k, byMonth[k]));
  console.log('\n— AY, GÖSTERİM KALİBRELİ —'); for (const k of Object.keys(shownMonth).sort()) console.log(line(k, shownMonth[k]));
  console.log('\n— KALİBRASYON, GÖSTERİLEN OLASILIK DİLİMİ —'); for (const k of ['<60', '60–65', '65–70', '70–75', '≥75']) if (shownCal[k]) console.log(line(k, shownCal[k]));
  console.log('\n— KALİBRASYON (ham q dilimi) —'); for (const k of ['60–65', '65–70', '70–75', '75–80', '≥80']) if (calib[k]) console.log(line(k, calib[k]));
  return { all, evaluated, shown, bySeg, segN };
}

(async () => {
  const rows = await load();
  const kg = Number(process.env.KG) || K_GLOBAL, kl = Number(process.env.KL) || K_LEAGUE;
  run(rows, RECO_GATE, true, { kGlobal: kg, kLeague: kl });
  console.log('\n— SENARYOLAR (toplam | oranlı kapsanan alt küme: tuttu / gösterilen) —');
  const S: Array<[string, RecoGate, boolean]> = [
    ['A eski: oransız, kapı ham q', { ...RECO_GATE, onDisplay: false }, false],
    ['B oransız, kapı gösterilen', { ...RECO_GATE, onDisplay: true }, false],
    ['C oranlı, kapı gösterilen', { ...RECO_GATE, onDisplay: true }, true],
  ];
  for (const [name, g, um] of S) {
    const r = run(rows, g, false, { kGlobal: kg, kLeague: kl }, K_META, um) as any;
    const o = r.bySeg['oranlı (kapsanan)'];
    console.log(line(name, r.all, r.evaluated) + `  | gösterim fark ${((r.shown.won - r.shown.q) / r.shown.n * 100).toFixed(1)}` + (o ? `  | oranlı: ${o.won}/${o.n} ${pct(o.won / o.n)} göst ${pct(o.q / o.n)} kapsam ${pct(o.n / r.segN['oranlı (kapsanan)'])}` : ''));
  }
  console.log('\n— BÜZÜLME TARAMASI (kapı varsayılan) —');
  for (const kGlobal of [5, 15, 30]) for (const kLeague of [20, 50, 100, 1e9]) {
    const { all, evaluated, shown } = run(rows, RECO_GATE, false, { kGlobal, kLeague });
    console.log(line(`kG=${kGlobal} kL=${kLeague === 1e9 ? 'lig yok' : kLeague}`, all, evaluated) + `  | gösterim fark ${((shown.won - shown.q) / shown.n * 100).toFixed(1)}`);
  }
  console.log('\n— KAPI TARAMASI —');
  for (const minQ of [0.58, 0.60, 0.62, 0.65, 0.70]) for (const minLift of [0.03, 0.05, 0.08]) {
    const { all, evaluated } = run(rows, { minQ, minLift }, false);
    console.log(line(`q≥${minQ} lift≥${minLift}`, all, evaluated));
  }
})();
