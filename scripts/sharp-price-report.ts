// Keskin fiyat kuralı GÖLGE karnesi (2026-11-23). Kaynak: odds_book_prices (snapshot-odds cron'u yazar).
// Kural önceden sabit (reports/backtest-open-value.md): bir bahisçinin fiyatı Pinnacle'ın aynı andaki
// marjsız fiyatının ≥ %2 üstündeyse 1 birim. Maç × seçim başına tek bahis: kuralın tuttuğu İLK faz.
// Canlı veride eşik TARANMAZ; farklı eşik yalnız bilgi satırı olarak basılır.
// Kullanım (repo kökünde, .env.local ile):  node --import tsx scripts/sharp-price-report.ts [eşik=0.02]
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { PHASE_ORDER, isOddsPhase } from '../src/lib/site/odds-phases';
import { sharpEdges, sharpFair, selectionWon, SHARP_BOOK_ID, type BookRow, type SharpSelection } from '../src/lib/site/sharp-price';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const EDGE = Number(process.argv[2] || 0.02);
const BET365 = 8;

async function pageAll<T>(table: string, cols: string, tweak: (q: any) => any = (q) => q): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(sb.from(table).select(cols)).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

interface Bet { fixture: number; selection: SharpSelection; bookmaker: string; odds: number; edge: number; phase: string; clv: number | null; won: boolean | null }

function summarize(label: string, bets: Bet[]) {
  const done = bets.filter((b) => b.won != null);
  const pl = done.reduce((s, b) => s + (b.won ? b.odds - 1 : -1), 0);
  const clv = bets.filter((b) => b.clv != null);
  const f = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(1) + '%';
  console.log(`${label.padEnd(26)} bahis ${String(bets.length).padStart(4)} · sonuçlanan ${String(done.length).padStart(4)}`
    + (done.length ? ` · ROI ${f(100 * pl / done.length)} (${pl >= 0 ? '+' : ''}${pl.toFixed(1)}u) · isabet ${(100 * done.filter((b) => b.won).length / done.length).toFixed(0)}% · ort. oran ${(done.reduce((s, b) => s + b.odds, 0) / done.length).toFixed(2)}` : '')
    + (clv.length ? ` · kapanışa karşı ${f(100 * clv.reduce((s, b) => s + (b.clv as number), 0) / clv.length)} · kapanışı geçen ${(100 * clv.filter((b) => (b.clv as number) > 0).length / clv.length).toFixed(0)}% (n=${clv.length})` : ''));
}

async function main() {
  const rows = await pageAll<BookRow & { fixture_id: number; phase: string }>('odds_book_prices', 'fixture_id, phase, bookmaker_id, bookmaker, home, draw, away, over25, under25, btts_yes, btts_no');
  if (!rows.length) { console.log('odds_book_prices boş: migration uygulanmadı ya da cron henüz yazmadı.'); return; }
  const num = (v: any) => (v == null ? null : Number(v));
  const byFix = new Map<number, Map<string, BookRow[]>>();
  const names = new Map<string, number>();
  for (const r of rows) {
    if (!isOddsPhase(r.phase)) continue;
    const row: BookRow = { bookmaker_id: Number(r.bookmaker_id), bookmaker: r.bookmaker, home: num(r.home), draw: num(r.draw), away: num(r.away), over25: num(r.over25), under25: num(r.under25), btts_yes: num(r.btts_yes), btts_no: num(r.btts_no) };
    const f = byFix.get(Number(r.fixture_id)) ?? new Map<string, BookRow[]>();
    f.set(r.phase, [...(f.get(r.phase) ?? []), row]);
    byFix.set(Number(r.fixture_id), f);
    names.set(row.bookmaker, (names.get(row.bookmaker) ?? 0) + 1);
  }
  const ids = [...byFix.keys()];
  const score = new Map<number, { h: number; a: number }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from('engine_predictions').select('fixture_id, home_score, away_score').in('fixture_id', ids.slice(i, i + 200)).not('home_score', 'is', null);
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as any[]) score.set(Number(p.fixture_id), { h: Number(p.home_score), a: Number(p.away_score) });
  }

  const withSharp = ids.filter((id) => [...byFix.get(id)!.values()].some((b) => b.some((x) => x.bookmaker_id === SHARP_BOOK_ID))).length;
  console.log(`odds_book_prices: ${rows.length} satır · ${ids.length} maç · Pinnacle fiyatı olan ${withSharp} · sonuçlanmış ${ids.filter((id) => score.has(id)).length}`);
  console.log('bahisçiler: ' + [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => `${n} ${c}`).join(' · '));

  const collect = (edge: number, only?: number[]): Bet[] => {
    const bets: Bet[] = [];
    for (const [fid, phases] of byFix) {
      const ordered = [...phases.entries()].sort((a, b) => PHASE_ORDER[a[0] as keyof typeof PHASE_ORDER] - PHASE_ORDER[b[0] as keyof typeof PHASE_ORDER]);
      const closeFair = sharpFair(phases.get('closing')?.find((b) => b.bookmaker_id === SHARP_BOOK_ID));
      const taken = new Set<string>();
      for (const [phase, books] of ordered) {
        if (phase === 'closing') continue; // kapanışta bahis açılmaz; kapanış yalnız ölçüt
        for (const e of sharpEdges(books, { only })) {
          if (e.edge < edge || taken.has(e.selection)) continue;
          taken.add(e.selection);
          const sc = score.get(fid);
          const cf = closeFair[e.selection];
          bets.push({ fixture: fid, selection: e.selection, bookmaker: e.bookmaker, odds: e.odds, edge: e.edge, phase, clv: cf ? cf * e.odds - 1 : null, won: sc ? selectionWon(e.selection, sc.h, sc.a) : null });
        }
      }
    }
    return bets;
  };

  console.log(`\nKural: fiyat Pinnacle marjsız fiyatının ≥ %${(100 * EDGE).toFixed(0)} üstünde`);
  const best = collect(EDGE), b365 = collect(EDGE, [BET365]);
  summarize('en iyi fiyat (tüm bahisçi)', best);
  summarize('yalnız Bet365', b365);
  for (const g of [['1X2', ['home', 'draw', 'away']], ['Alt/Üst 2,5', ['over25', 'under25']], ['KG', ['btts_yes', 'btts_no']]] as const) {
    summarize(`  en iyi fiyat · ${g[0]}`, best.filter((b) => (g[1] as readonly string[]).includes(b.selection)));
  }
  console.log('\nBilgi (seçim için kullanılmaz):');
  for (const e of [0, 0.01, 0.03, 0.05]) if (e !== EDGE) summarize(`  eşik ≥ %${(100 * e).toFixed(0)}`, collect(e));
  if (best.filter((b) => b.won != null).length < 300) console.log('\nUyarı: sonuçlanan bahis 300\'ün altında; ROI yorumlanmaz, kapanışa karşı değere bakın.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
