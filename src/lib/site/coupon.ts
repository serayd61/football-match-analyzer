import 'server-only';
import { dbFresh as db } from './db';
import { resolveOfficialVersion, officialFilter } from './official';
import { coverageById } from '@/lib/coverage/registry';
import { latestPhase } from './odds-phases';
import { zonedStartOfDay, addDays, todayYmd } from './time';
import { hasTelegram, sendMessage } from '@/lib/social/telegram';
import { utm } from '@/lib/social/content';
import {
  selectCoupon, settleCoupon, addCoupon, emptyCouponTally, couponText, couponResultText, COUPON_RULE_VERSION,
  type Coupon, type CouponLeg, type CouponStatus, type CouponTally, type CouponLang,
} from './coupon-rule';

// ============================================================================
// GÜNÜN KUPONU — üretim, sonuçlandırma, karne, Telegram (2026-10-14)
// ----------------------------------------------------------------------------
// Adaylar: günün (Zürih) site_reco_picks satırları + prediction_odds son faz
// oranı. Kupon site_coupons'a yazılır (günde bir, üretimde donar). Sonuç:
// engine_predictions resmi sürüm skorları. Telegram: TELEGRAM_CHAT_TR/EN tanımlı
// kanallara, social_posts key'i ile tekrar gönderim korumalı (publish.ts kalıbı).
// ============================================================================

const TABLE = 'site_coupons';

export interface StoredCoupon { date: string; legs: CouponLeg[]; totalOdds: number; pJoint: number; status: CouponStatus; ruleVersion: string; settledAt: string | null; createdAt: string }

const fromRow = (r: any): StoredCoupon => ({
  date: String(r.coupon_date), legs: (r.legs ?? []) as CouponLeg[], totalOdds: Number(r.total_odds), pJoint: Number(r.p_joint),
  status: r.status as CouponStatus, ruleVersion: String(r.rule_version), settledAt: r.settled_at ?? null, createdAt: String(r.created_at),
});

const oddsFor = (market: string, selection: string, o: any): number | null => {
  const v = market === 'ou25' ? (selection === 'over' ? o.over25_odds : o.under25_odds)
    : market === 'btts' ? o.btts_yes_odds
      : selection === '1' ? o.home_odds : selection === '2' ? o.away_odds : o.draw_odds;
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? n : null;
};

/** Günün adayları: önerilen seçim + son oran. */
export async function couponCandidates(ymd: string): Promise<CouponLeg[]> {
  const from = zonedStartOfDay(ymd).toISOString(), to = zonedStartOfDay(addDays(ymd, 1)).toISOString();
  const { data, error } = await db().from('site_reco_picks')
    .select('fixture_id, kickoff, league_id, league_name, home_name, away_name, covered, market, selection, p_display, q')
    .gte('kickoff', from).lt('kickoff', to).not('market', 'is', null).limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];
  const cov = await coverageById();
  const ids = rows.map((r) => Number(r.fixture_id));
  const by = new Map<number, any[]>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data: od } = await db().from('prediction_odds')
      .select('fixture_id, phase, captured_at, home_odds, draw_odds, away_odds, over25_odds, under25_odds, btts_yes_odds')
      .in('fixture_id', ids.slice(i, i + 150)).limit(150 * 6);
    for (const r of (od ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
  }
  const out: CouponLeg[] = [];
  for (const r of rows) {
    const fid = Number(r.fixture_id);
    const lid = r.league_id == null ? null : Number(r.league_id);
    if (lid != null && cov.get(lid)?.status === 'hidden') continue;
    if (r.selection === 'X' || r.selection === 'no') continue;
    const l = latestPhase(by.get(fid) ?? []);
    const odds = l ? oddsFor(String(r.market), String(r.selection), l) : null;
    if (odds == null) continue;
    const c = !r.covered && lid != null ? cov.get(lid) : undefined;
    out.push({
      fixtureId: fid, kickoff: String(r.kickoff), leagueLabel: c?.ccode ? `${c.ccode} · ${c.name || r.league_name}` : String(r.league_name ?? ''),
      homeName: String(r.home_name), awayName: String(r.away_name), market: r.market, selection: r.selection,
      p: Number(r.p_display ?? r.q), odds,
    });
  }
  return out;
}

export async function getCoupon(ymd: string): Promise<StoredCoupon | null> {
  const { data } = await db().from(TABLE).select('*').eq('coupon_date', ymd).maybeSingle();
  return data ? fromRow(data) : null;
}

/** Günün kuponunu üret (varsa dokunma); write=false önizleme. */
export async function buildCoupon(ymd: string, write = true, now = Date.now()): Promise<{ coupon: Coupon | null; stored: StoredCoupon | null; candidates: number; existed: boolean }> {
  const existing = await getCoupon(ymd);
  if (existing) return { coupon: { legs: existing.legs, totalOdds: existing.totalOdds, pJoint: existing.pJoint }, stored: existing, candidates: 0, existed: true };
  const cands = await couponCandidates(ymd);
  const coupon = selectCoupon(cands, now);
  if (!coupon || !write) return { coupon, stored: null, candidates: cands.length, existed: false };
  const row = { coupon_date: ymd, legs: coupon.legs, total_odds: coupon.totalOdds, p_joint: Math.round(coupon.pJoint * 10000) / 10000, rule_version: COUPON_RULE_VERSION, status: 'pending' };
  const { data, error } = await db().from(TABLE).upsert(row, { onConflict: 'coupon_date', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return { coupon, stored: data ? fromRow(data) : await getCoupon(ymd), candidates: cands.length, existed: false };
}

/** Bekleyen kuponları skorla sonuçlandır. */
export async function settleCoupons(): Promise<{ checked: number; settled: StoredCoupon[] }> {
  const { data } = await db().from(TABLE).select('*').eq('status', 'pending').order('coupon_date', { ascending: true }).limit(60);
  const rows = ((data ?? []) as any[]).map(fromRow);
  if (!rows.length) return { checked: 0, settled: [] };
  const official = await resolveOfficialVersion();
  const ids = [...new Set(rows.flatMap((c) => c.legs.map((l) => l.fixtureId)))];
  const scores = new Map<number, [number, number] | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: s } = await officialFilter(db().from('engine_predictions').select('fixture_id, settled, home_score, away_score'), official).in('fixture_id', ids.slice(i, i + 200));
    for (const x of (s ?? []) as any[]) {
      if (x.home_score != null && x.away_score != null) scores.set(Number(x.fixture_id), [Number(x.home_score), Number(x.away_score)]);
      else if (x.settled) scores.set(Number(x.fixture_id), null); // sonuçlandı ama skor yok: ertelendi/iptal
    }
  }
  const settled: StoredCoupon[] = [];
  for (const c of rows) {
    const r = settleCoupon(c.legs, scores);
    const changed = r.status !== 'pending' || JSON.stringify(r.legs) !== JSON.stringify(c.legs);
    if (!changed) continue;
    const patch: any = { legs: r.legs, status: r.status, updated_at: new Date().toISOString() };
    if (r.status !== 'pending') patch.settled_at = new Date().toISOString();
    const { error } = await db().from(TABLE).update(patch).eq('coupon_date', c.date);
    if (error) throw new Error(error.message);
    if (r.status !== 'pending') settled.push({ ...c, legs: r.legs, status: r.status, settledAt: patch.settled_at });
  }
  return { checked: rows.length, settled };
}

export async function listCoupons(days: number, today = todayYmd()): Promise<StoredCoupon[]> {
  const { data } = await db().from(TABLE).select('*').gte('coupon_date', addDays(today, -days)).lte('coupon_date', today).order('coupon_date', { ascending: false }).limit(days + 1);
  return ((data ?? []) as any[]).map(fromRow);
}

export function tallyCoupons(rows: StoredCoupon[]): CouponTally {
  const t = emptyCouponTally();
  for (const c of rows) addCoupon(t, c.status, c.totalOdds, c.legs);
  return t;
}

export async function couponRecord(days = 30, today = todayYmd()): Promise<CouponTally> {
  return tallyCoupons(await listCoupons(days, today));
}

// ---- Telegram -----------------------------------------------------------------
const LANGS: CouponLang[] = ['tr', 'en'];
const chatFor = (l: CouponLang) => (process.env[`TELEGRAM_CHAT_${l.toUpperCase()}`] || '').trim() || null;

async function alreadyPosted(key: string): Promise<string | null> {
  const { data } = await db().from('social_posts').select('post_id').eq('key', key).eq('status', 'posted').maybeSingle();
  return data?.post_id ? String(data.post_id) : null;
}
async function recordPost(row: { key: string; kind: string; day: string; account: string; fixtureIds: number[]; postId: string | null; body: string; status: string; error?: string | null }) {
  await db().from('social_posts').upsert({ key: row.key, kind: row.kind, day: row.day, platform: 'telegram', account: row.account, fixture_ids: row.fixtureIds, post_id: row.postId, parent_id: null, body: row.body, status: row.status, error: row.error ?? null }, { onConflict: 'key' });
}

/** Günün kuponunu tanımlı Telegram kanallarına gönder (bir kez). */
export async function publishCoupon(ymd: string, dry = false) {
  const stored = await getCoupon(ymd);
  if (!stored) return { ok: true, day: ymd, note: 'kupon yok', posts: [] as any[] };
  const record = await couponRecord(30, ymd).catch(() => null);
  const out: any[] = [];
  for (const lang of LANGS) {
    const chat = chatFor(lang);
    if (!chat || !hasTelegram()) continue;
    const key = `coupon|${ymd}|telegram|${lang}`;
    const text = couponText({ legs: stored.legs, totalOdds: stored.totalOdds, pJoint: stored.pJoint }, ymd, lang, record, utm('/coupon', lang, 'coupon', 'telegram'));
    const have = await alreadyPosted(key);
    if (have) { out.push({ key, status: 'already', id: have }); continue; }
    if (dry) { out.push({ key, status: 'dry', text }); continue; }
    const r = await sendMessage(chat, text);
    await recordPost({ key, kind: 'coupon', day: ymd, account: lang, fixtureIds: stored.legs.map((l) => l.fixtureId), postId: r.ok ? r.id : null, body: text, status: r.ok ? 'posted' : 'failed', error: r.ok ? null : r.error });
    out.push({ key, status: r.ok ? 'posted' : 'failed', id: r.ok ? r.id : undefined, error: r.ok ? undefined : r.error });
  }
  return { ok: out.every((o) => o.status !== 'failed'), day: ymd, posts: out };
}

/** Sonuçlanan kuponların sonucunu kanala yaz (kupon gönderisine yanıt olarak). */
export async function publishCouponResults(settled: StoredCoupon[], dry = false) {
  const out: any[] = [];
  for (const c of settled) {
    const record = await couponRecord(30, c.date).catch(() => null);
    for (const lang of LANGS) {
      const chat = chatFor(lang);
      if (!chat || !hasTelegram()) continue;
      const key = `coupon-result|${c.date}|telegram|${lang}`;
      if (await alreadyPosted(key)) { out.push({ key, status: 'already' }); continue; }
      const text = couponResultText(c, c.date, lang, record);
      if (dry) { out.push({ key, status: 'dry', text }); continue; }
      const parent = await alreadyPosted(`coupon|${c.date}|telegram|${lang}`);
      const r = await sendMessage(chat, text, parent ?? undefined);
      await recordPost({ key, kind: 'coupon-result', day: c.date, account: lang, fixtureIds: c.legs.map((l) => l.fixtureId), postId: r.ok ? r.id : null, body: text, status: r.ok ? 'posted' : 'failed', error: r.ok ? null : r.error });
      out.push({ key, status: r.ok ? 'posted' : 'failed', id: r.ok ? r.id : undefined, error: r.ok ? undefined : r.error });
    }
  }
  return out;
}

/** Sayfa için: bugünün kuponu + son 30 gün (ISR'siz; sayfa force-dynamic). */
export async function couponPageData(today = todayYmd()) {
  const [todayCoupon, history] = await Promise.all([getCoupon(today), listCoupons(30, today)]);
  return { today: todayCoupon, history: history.filter((c) => c.date !== today), record: tallyCoupons(history) };
}
