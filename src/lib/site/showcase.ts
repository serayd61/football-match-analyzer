import 'server-only';
import { dbFresh as db } from './db';
import { listDayFresh } from './fixtures';
import { latestPhase } from './odds-phases';
import { SITE_LEAGUES } from './leagues';
import type { SitePrediction } from './predictions';
import { todayYmd, addDays } from './time';
import { showcaseFor, settleShowcase, SHOWCASE_RULE_VERSION, FREEZE_MINUTES, type ShowcaseMarket, type ShowcasePick, type ShowcaseInput } from './showcase-rule';

// Vitrin seçimi — hesap + dondurma + karne. Kural showcase-rule.ts'te (saf).
// Saatlik cron D..D+2 penceresindeki kapsanan maçlar için son piyasa görüşüyle
// kuralı çalıştırır ve site_showcase_picks'e yazar; başlamaya ≤3 saat kala
// satır dondurulur ve bir daha değişmez. Karne yalnız dondurulmuş satırlarla
// ölçülür ("vitrinde ne dedik"). Motor çıktısı değişmez.

const TABLE = 'site_showcase_picks';

export interface ShowcaseRow extends ShowcasePick {
  kickoff: string; leagueSlug: string; homeName: string; awayName: string; frozen: boolean; computedAt: string;
}

interface Mkt { pHome: number; pDraw: number; pAway: number; phase: string }

/** Son görüş (en geç faz) marjsız 1X2 — doğrudan DB, önbelleksiz. */
async function freshMarkets(ids: number[]): Promise<Map<number, Mkt>> {
  const out = new Map<number, Mkt>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db().from('prediction_odds')
      .select('fixture_id, phase, captured_at, p_home_market, p_draw_market, p_away_market')
      .in('fixture_id', ids.slice(i, i + 100));
    const by = new Map<number, any[]>();
    for (const r of (data ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
    for (const [k, rows] of by) {
      const l = latestPhase(rows);
      if (l && l.p_home_market != null) out.set(k, { pHome: Number(l.p_home_market), pDraw: Number(l.p_draw_market), pAway: Number(l.p_away_market), phase: String(l.phase) });
    }
  }
  return out;
}

function toInput(r: SitePrediction, market: Mkt | null): ShowcaseInput {
  const pBtts = r.btts ? (r.btts.pick === 'yes' ? r.btts.pRaw : 1 - r.btts.pRaw) : null;
  const pOver = r.overUnder ? (r.overUnder.pick === 'over' ? r.overUnder.pRaw : 1 - r.overUnder.pRaw) : null;
  return { fixtureId: r.fixtureId, leagueSlug: r.league?.slug ?? null, kickoff: r.kickoff, pick: (r.pick as any) ?? null, pHome: r.pHome, pDraw: r.pDraw, pAway: r.pAway, pBttsYes: pBtts, pOver25: pOver, market };
}

/** D..D+days-1 penceresini hesaplar; write=false ise yazmaz (önizleme). */
export async function computeShowcase(days = 3, write = true, now = Date.now()) {
  const today = todayYmd();
  const rows: SitePrediction[] = [];
  for (let d = 0; d < days; d++) rows.push(...(await listDayFresh(addDays(today, d))).rows.filter((r) => r.covered && r.hasModel && !r.settled && r.league));
  const ids = rows.map((r) => r.fixtureId);
  const [markets, frozenRes] = await Promise.all([freshMarkets(ids), db().from(TABLE).select('fixture_id').in('fixture_id', ids).eq('frozen', true)]);
  const frozen = new Set(((frozenRes.data ?? []) as any[]).map((r) => Number(r.fixture_id)));
  const picks: ShowcaseRow[] = []; let skipped = 0, froze = 0;
  const upserts: any[] = [];
  for (const r of rows) {
    if (frozen.has(r.fixtureId)) { skipped++; continue; }
    const p = showcaseFor(toInput(r, markets.get(r.fixtureId) ?? null));
    const mins = (Date.parse(r.kickoff) - now) / 60000;
    const freeze = mins <= FREEZE_MINUTES;
    if (freeze) froze++;
    const row: ShowcaseRow = { ...p, kickoff: r.kickoff, leagueSlug: r.league!.slug, homeName: r.homeName, awayName: r.awayName, frozen: freeze, computedAt: new Date(now).toISOString() };
    picks.push(row);
    upserts.push({ fixture_id: r.fixtureId, kickoff: r.kickoff, league_slug: row.leagueSlug, home_name: r.homeName, away_name: r.awayName, market: p.market, selection: p.selection, model_p: p.modelP, edge_1x2: p.edge1x2, market_phase: p.marketPhase, reason: p.reason, rule_version: SHOWCASE_RULE_VERSION, frozen: freeze, frozen_at: freeze ? row.computedAt : null, computed_at: row.computedAt });
  }
  let error: string | null = null;
  if (write && upserts.length) {
    const { error: e } = await db().from(TABLE).upsert(upserts, { onConflict: 'fixture_id' });
    if (e) { error = e.message; console.error('[showcase] upsert failed', e.message); }
  }
  const byReason: Record<string, number> = {};
  for (const p of picks) byReason[p.reason] = (byReason[p.reason] ?? 0) + 1;
  return { window: days, candidates: rows.length, computed: picks.length, skippedFrozen: skipped, frozenNow: froze, byReason, error, picks };
}

export interface ShowcaseRecord {
  days: number;
  /** dondurulmuş + sonuçlanmış, seçimli */
  n: number; won: number;
  /** dondurulmuş + sonuçlanmış, seçimsiz ("riskli, seçim yok") */
  noPick: number;
  byMarket: Record<ShowcaseMarket, { n: number; won: number }>;
  byLeague: { slug: string; name: string; n: number; won: number; noPick: number }[];
  byReason: Record<string, number>;
}

/** Son N günün dondurulmuş vitrin seçimlerini skorla sonuçlandırır. */
export async function showcaseRecord(days = 30, now = Date.now()): Promise<ShowcaseRecord> {
  const empty: ShowcaseRecord = { days, n: 0, won: 0, noPick: 0, byMarket: { '1x2': { n: 0, won: 0 }, ou25: { n: 0, won: 0 }, btts: { n: 0, won: 0 } }, byLeague: [], byReason: {} };
  const cutoff = new Date(now - 3 * 3600_000).toISOString();
  const from = new Date(now - days * 86400_000).toISOString();
  const { data, error } = await db().from(TABLE).select('*').eq('frozen', true).gte('kickoff', from).lt('kickoff', cutoff);
  if (error || !data?.length) return empty;
  const ids = [...new Set((data as any[]).map((r) => Number(r.fixture_id)))];
  const score = new Map<number, [number, number]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: sc } = await db().from('engine_predictions').select('fixture_id, home_score, away_score').in('fixture_id', ids.slice(i, i + 200)).not('home_score', 'is', null).not('away_score', 'is', null);
    for (const s of (sc ?? []) as any[]) if (!score.has(Number(s.fixture_id))) score.set(Number(s.fixture_id), [Number(s.home_score), Number(s.away_score)]);
  }
  const rec = { ...empty, byMarket: { '1x2': { n: 0, won: 0 }, ou25: { n: 0, won: 0 }, btts: { n: 0, won: 0 } }, byReason: {} as Record<string, number> };
  const lg = new Map<string, { n: number; won: number; noPick: number }>();
  for (const r of data as any[]) {
    const sc = score.get(Number(r.fixture_id));
    if (!sc) continue;
    const slug = String(r.league_slug);
    if (!lg.has(slug)) lg.set(slug, { n: 0, won: 0, noPick: 0 });
    const L = lg.get(slug)!;
    rec.byReason[r.reason] = (rec.byReason[r.reason] ?? 0) + 1;
    if (!r.market) { rec.noPick++; L.noPick++; continue; }
    const won = settleShowcase(r.market, r.selection, sc[0], sc[1]);
    rec.n++; L.n++; rec.byMarket[r.market as ShowcaseMarket].n++;
    if (won) { rec.won++; L.won++; rec.byMarket[r.market as ShowcaseMarket].won++; }
  }
  rec.byLeague = [...lg.entries()].map(([slug, v]) => ({ slug, name: SITE_LEAGUES.find((l) => l.slug === slug)?.name ?? slug, ...v })).sort((a, b) => b.n - a.n);
  return rec;
}

/** Tek maçın vitrin satırı (varsa). */
export async function getShowcasePick(fixtureId: number): Promise<ShowcaseRow | null> {
  const { data } = await db().from(TABLE).select('*').eq('fixture_id', fixtureId).maybeSingle();
  if (!data) return null;
  const r: any = data;
  return { fixtureId: Number(r.fixture_id), market: r.market, selection: r.selection, modelP: r.model_p == null ? null : Number(r.model_p), edge1x2: r.edge_1x2 == null ? null : Number(r.edge_1x2), marketPhase: r.market_phase, reason: r.reason, kickoff: r.kickoff, leagueSlug: r.league_slug, homeName: r.home_name, awayName: r.away_name, frozen: !!r.frozen, computedAt: r.computed_at };
}
