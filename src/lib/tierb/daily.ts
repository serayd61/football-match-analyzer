// ============================================================================
// KAPSAM DIŞI YÜKSEK GÜVEN LİSTESİ — üretim, oranlama, sonuçlandırma, DM (sunucu)
// ----------------------------------------------------------------------------
// Akış (her sabah 06:30 UTC, cron/tier-b):
//   1. settleTierB: bekleyen ayakları engine_predictions skoruyla kapat (void dahil).
//   2. generateTierB(date): günün kickoff>now motor satırları → beyaz liste dışı,
//      gürültü dışı, eşik üstü ayaklar → tier_b_picks'e DONDUR (idempotent:
//      aynı gün ikinci çağrı yeni satır eklemez).
//   3. priceLegs: API-Football /fixtures?date (UTC gün başına 1 çağrı) ile eşle,
//      ayak başına /odds (bet365 tercihli) → oran, marjsız piyasa, marj.
//   4. Telegram admin DM (yalnız yeni üretimde; ?resend=1 ile tekrar).
// Kurallar saf modülde (rules.ts). Site/sosyal yayına ÇIKMAZ.
// ============================================================================
import 'server-only';
import { dbFresh } from '@/lib/site/db';
import { addDays, zonedStartOfDay, ymdOf } from '@/lib/site/time';
import { loadCoverage } from '@/lib/coverage/registry';
import { hasApiFootballKey, afFixturesByDate, afOdds, matchFixtures, type MapCandidate } from '@/lib/data-sources/api-football';
import { sendMessage, hasTelegram } from '@/lib/social/telegram';
import { adminChat } from '@/lib/social/engage';
import { selectTierB, priceLeg, withMargin, legWon, tierBRecord, formatTierBDm, type TierBInput, type TierBLeg, type DmLeg, type TierBMarket, type LegPrice } from './rules';

/** Oran çağrısı üst sınırı (API-Football bütçesi; 7.500/gün'ün küçük bir dilimi). */
export const MAX_ODDS_CALLS = 60;
const COLS = 'fixture_id, league_id, league_name, home_name, away_name, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, updated_at';

async function dayRows(date: string): Promise<TierBInput[]> {
  const from = zonedStartOfDay(date).toISOString(), to = zonedStartOfDay(addDays(date, 1)).toISOString();
  const sb = dbFresh();
  const out = new Map<number, TierBInput & { updatedAt: string }>();
  for (let off = 0; off < 5000; off += 1000) {
    const { data, error } = await sb.from('engine_predictions').select(COLS).gte('kickoff', from).lt('kickoff', to).order('updated_at', { ascending: false }).range(off, off + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) {
      const id = Number(r.fixture_id);
      if (out.has(id)) continue; // en güncel model satırı
      out.set(id, {
        fixtureId: id, leagueId: r.league_id != null ? Number(r.league_id) : null, leagueName: r.league_name ?? null,
        home: r.home_name ?? '', away: r.away_name ?? '', kickoff: r.kickoff,
        pHome: r.p_home, pDraw: r.p_draw, pAway: r.p_away, pOver25: r.p_over25, pBtts: r.p_btts_yes,
        lambdaHome: r.lambda_home, lambdaAway: r.lambda_away, updatedAt: r.updated_at,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return [...out.values()];
}

export interface PricedLeg extends TierBLeg { price: LegPrice | null; afFixtureId: number | null }

/** API-Football ile eşle ve oranla. Anahtar yoksa / hata varsa ayaklar oransız kalır. */
export async function priceLegs(legs: TierBLeg[]): Promise<{ legs: PricedLeg[]; calls: number; matched: number; errors: string[] }> {
  const out: PricedLeg[] = legs.map((l) => ({ ...l, price: null, afFixtureId: null }));
  const errors: string[] = [];
  if (!legs.length || !hasApiFootballKey()) return { legs: out, calls: 0, matched: 0, errors: hasApiFootballKey() ? [] : ['API_FOOTBALL_KEY yok'] };
  const days = [...new Set(legs.map((l) => l.kickoff.slice(0, 10)))];
  let calls = 0;
  const theirs: Awaited<ReturnType<typeof afFixturesByDate>> extends infer T ? (T extends { ok: true; rows: infer R } ? R : never) : never = [] as any;
  for (const d of days) {
    const r = await afFixturesByDate(d); calls++;
    if (!r.ok) { errors.push(`fixtures ${d}: ${r.error}`); continue; }
    (theirs as any[]).push(...r.rows);
  }
  const ours: MapCandidate[] = legs.map((l) => ({ fixtureId: l.fixtureId, kickoff: l.kickoff, home: l.home, away: l.away }));
  const pairs = matchFixtures(ours, theirs as any, 0.6);
  const afId = new Map(pairs.map((p) => [p.fixtureId, p.afId]));
  let matched = 0;
  const oddsCache = new Map<number, Awaited<ReturnType<typeof afOdds>>>(); // aynı maçın birden çok ayağı → tek çağrı
  for (const l of out) {
    const id = afId.get(l.fixtureId);
    if (!id) continue;
    l.afFixtureId = id; matched++;
    let r = oddsCache.get(id);
    if (!r) {
      if (calls >= MAX_ODDS_CALLS + days.length) continue;
      r = await afOdds(id); calls++; oddsCache.set(id, r);
    }
    if (!r.ok) { if (!errors.includes(`odds ${id}: ${r.error}`)) errors.push(`odds ${id}: ${r.error}`); continue; }
    if (!r.odds) continue;
    const p = priceLeg(l.market, l.selection, r.odds);
    if (p) l.price = withMargin(p, l.modelP);
  }
  return { legs: out, calls, matched, errors };
}

export interface GenerateResult { date: string; candidates: number; legs: PricedLeg[]; inserted: number; existing: number; pricing: { calls: number; matched: number; errors: string[] }; dm: { sent: boolean; error?: string } }

export async function generateTierB(date: string, opts: { now?: Date; dry?: boolean; resend?: boolean; skipOdds?: boolean } = {}): Promise<GenerateResult> {
  const now = opts.now ?? new Date();
  const sb = dbFresh();
  const coverage = await loadCoverage();
  // Beyaz liste kuponun alanı, gizli ligler sinyalsiz: ikisi de Tier-B'ye girmez.
  const whitelist = new Set(coverage.filter((c) => c.status === 'whitelist' || c.status === 'hidden').map((c) => c.league_id));
  const rows = await dayRows(date);
  const { data: existingRows } = await sb.from('tier_b_picks').select('fixture_id').eq('pick_date', date);
  const existing = new Set(((existingRows ?? []) as any[]).map((r) => Number(r.fixture_id)));
  const fresh = selectTierB(rows, { whitelist, now });
  const newLegs = fresh.filter((l) => !existing.has(l.fixtureId));
  const pricing = opts.skipOdds ? { legs: newLegs.map((l) => ({ ...l, price: null, afFixtureId: null })), calls: 0, matched: 0, errors: [] as string[] } : await priceLegs(newLegs);

  let inserted = 0;
  if (!opts.dry && pricing.legs.length) {
    const { error } = await sb.from('tier_b_picks').upsert(pricing.legs.map((l) => ({
      pick_date: date, fixture_id: l.fixtureId, league_id: l.leagueId, league_name: l.leagueName, home_name: l.home, away_name: l.away, kickoff: l.kickoff,
      market: l.market, selection: l.selection, model_p: l.modelP, threshold: l.threshold,
      odds: l.price?.odds ?? null, odds_source: l.price ? 'api-football' : null, market_p: l.price?.marketP ?? null, margin: l.price?.margin ?? null, af_fixture_id: l.afFixtureId,
    })), { onConflict: 'pick_date,fixture_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    inserted = pricing.legs.length;
  }

  // DM: günün TÜM ayakları (dondurulmuş + yeni), dünün sonucu, 30 günlük karne.
  const dm: GenerateResult['dm'] = { sent: false };
  if (!opts.dry && (inserted > 0 || opts.resend)) {
    const text = await buildDm(date);
    const chat = adminChat();
    if (!hasTelegram() || !chat) dm.error = 'telegram/admin chat yok';
    else { const r = await sendMessage(chat, text); if (r.ok) dm.sent = true; else dm.error = r.error; }
  }
  return { date, candidates: rows.length, legs: pricing.legs, inserted, existing: existing.size, pricing: { calls: pricing.calls, matched: pricing.matched, errors: pricing.errors }, dm };
}

export async function buildDm(date: string): Promise<string> {
  const sb = dbFresh();
  const { data: today } = await sb.from('tier_b_picks').select('*').eq('pick_date', date).order('kickoff');
  const cov = new Map((await loadCoverage()).map((c) => [Number(c.league_id), c]));
  const strongOf = (r: any): string | null => {
    const sm = (cov.get(Number(r.league_id))?.stats?.strong ?? []).find((m) => (r.market === 'ou25' ? (r.selection === 'over' ? m.market === 'ou25' : m.market === 'under25') : r.market === 'btts' ? m.market === 'btts' : m.market === 'x12') && Number(r.model_p) >= m.from);
    return sm ? `${sm.won}/${sm.n}` : null;
  };
  const legs: DmLeg[] = ((today ?? []) as any[]).map((r) => ({
    strong: strongOf(r),
    fixtureId: Number(r.fixture_id), leagueId: r.league_id, leagueName: r.league_name, home: r.home_name, away: r.away_name, kickoff: r.kickoff,
    market: r.market, selection: r.selection, modelP: Number(r.model_p), threshold: Number(r.threshold), edge: Number(r.model_p) - Number(r.threshold),
    price: r.odds != null ? { odds: Number(r.odds), marketP: Number(r.market_p), margin: Number(r.margin) } : null,
  }));
  const yd = addDays(date, -1);
  const { data: yRows } = await sb.from('tier_b_picks').select('home_name, away_name, market, selection, won, home_score, away_score').eq('pick_date', yd).order('kickoff');
  const yesterday = { date: yd, rows: ((yRows ?? []) as any[]).map((r) => ({ home: r.home_name, away: r.away_name, market: r.market as TierBMarket, selection: r.selection, won: r.won, hs: r.home_score, as: r.away_score })) };
  return formatTierBDm(date, legs, await recordSince(addDays(date, -30)), yesterday);
}

export async function recordSince(fromDate: string) {
  const { data } = await dbFresh().from('tier_b_picks').select('market, won, odds, settled_at').gte('pick_date', fromDate);
  return tierBRecord(((data ?? []) as any[]));
}

export interface SettleResult { checked: number; settled: number; voided: number; pending: number }

/** Bekleyen ayakları motor skoruyla kapat. Motor satırı settled + skorsuz (void) ise ayak da void. */
export async function settleTierB(now = new Date()): Promise<SettleResult> {
  const sb = dbFresh();
  const cutoff = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const { data: open, error } = await sb.from('tier_b_picks').select('id, fixture_id, market, selection').is('settled_at', null).lt('kickoff', cutoff).limit(500);
  if (error) throw new Error(error.message);
  const res: SettleResult = { checked: open?.length ?? 0, settled: 0, voided: 0, pending: 0 };
  if (!open?.length) return res;
  const ids = [...new Set((open as any[]).map((r) => Number(r.fixture_id)))];
  const score = new Map<number, { hs: number; as: number } | 'void'>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('engine_predictions').select('fixture_id, settled, result, home_score, away_score').in('fixture_id', ids.slice(i, i + 200)).eq('settled', true);
    for (const r of (data ?? []) as any[]) {
      const id = Number(r.fixture_id);
      if (r.home_score != null && r.away_score != null) score.set(id, { hs: Number(r.home_score), as: Number(r.away_score) });
      else if (!score.has(id) && r.result == null) score.set(id, 'void');
    }
  }
  const at = now.toISOString();
  for (const r of open as any[]) {
    const s = score.get(Number(r.fixture_id));
    if (!s) { res.pending++; continue; }
    const patch = s === 'void' ? { settled_at: at, won: null } : { settled_at: at, won: legWon(r.market, r.selection, s.hs, s.as), home_score: s.hs, away_score: s.as };
    const { error: e } = await sb.from('tier_b_picks').update(patch).eq('id', r.id);
    if (e) { console.error('[tier-b] settle failed', r.id, e.message); res.pending++; continue; }
    if (s === 'void') res.voided++; else res.settled++;
  }
  return res;
}

export const tierBDateOf = (d: Date) => ymdOf(d);

/**
 * Fiyatlama modu (25 Eyl, kullanıcı: "maçlar bet365'te olmalı"): günün kapsam dışı ve gizli
 * olmayan maçlarında olasılığı ≥minP olan HER ayağı API-Football/bet365 ile fiyatlar; kaydetmez.
 * Kupon kurarken bahisçide gerçekten açık olan maçları görmek için. Bütçe: maç başına 1 çağrı.
 */
export async function priceDay(date: string, minP = 0.62, opts: { now?: Date; includeWhitelist?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const coverage = await loadCoverage();
  const status = new Map(coverage.map((c) => [Number(c.league_id), c.status]));
  const rows = (await dayRows(date)).filter((r) => Date.parse(r.kickoff) > now.getTime() && (r.leagueId == null || (status.get(r.leagueId) !== 'hidden' && (opts.includeWhitelist || status.get(r.leagueId) !== 'whitelist'))));
  const legs: TierBLeg[] = [];
  const push = (r: TierBInput, market: TierBLeg['market'], selection: TierBLeg['selection'], p: number | null | undefined, threshold: number) => {
    if (p == null || p < minP) return;
    legs.push({ fixtureId: r.fixtureId, leagueId: r.leagueId, leagueName: r.leagueName, home: r.home, away: r.away, kickoff: r.kickoff, market, selection, modelP: Math.round(p * 1000) / 1000, threshold, edge: Math.round((p - threshold) * 1000) / 1000 });
  };
  for (const r of rows) {
    if (r.pHome != null && r.pDraw != null && r.pAway != null) {
      const ps: Array<[TierBLeg['selection'], number]> = [['1', r.pHome], ['X', r.pDraw], ['2', r.pAway]];
      const [sel, p] = ps.reduce((a, b) => (b[1] > a[1] ? b : a)); push(r, '1x2', sel, p, 0.8);
    }
    if (r.pOver25 != null) { push(r, 'ou25', 'over', r.pOver25, 0.85); push(r, 'ou25', 'under', 1 - r.pOver25, 0.75); }
    if (r.pBtts != null) push(r, 'btts', 'yes', r.pBtts, 0.8);
  }
  const priced = await priceLegs(legs);
  return { date, minP, matches: rows.length, legs: priced.legs.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.fixtureId - b.fixtureId), calls: priced.calls, matched: priced.matched, errors: priced.errors };
}
