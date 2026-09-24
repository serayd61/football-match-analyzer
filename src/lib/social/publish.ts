// ============================================================================
// Sosyal yayın orkestrasyonu — günlük seçim, sonuç yanıtı, haftalık karne
// ----------------------------------------------------------------------------
// Hesaplar: TWITTER_TR_* / TWITTER_EN_* (OAuth 1.0a), TELEGRAM_BOT_TOKEN +
// TELEGRAM_CHAT_TR / TELEGRAM_CHAT_EN. Tanımlı olmayan hesap atlanır. Her
// gönderi social_posts'a yazılır; `key` tekil olduğu için cron iki kez çalışsa
// da ikinci gönderi atılmaz. dry=1 → hiçbir yere göndermez, metni döner.
// ============================================================================
import 'server-only';
import { dbFresh as db } from '@/lib/site/db';
import { todayYmd, addDays } from '@/lib/site/time';
import { getDailyPicks, dailyPicksRecord } from '@/lib/site/daily-picks';
import { showcaseRecord } from '@/lib/site/showcase';
import { settleShowcase, type ShowcaseMarket, type ShowcaseSelection } from '@/lib/site/showcase-rule';
import { leagueBySlug } from '@/lib/site/leagues';
import { latestPhase } from '@/lib/site/odds-phases';
import { dailyText, hashtags, inviteText, pickLegs, resultText, telegramLink, weeklyText, type Lang, type Leg, type WeeklyStats, strongText, strongBoardText, type StrongLeg } from './content';
import { dailyImage, weeklyImage } from './image';
import { postTweet, twitterCreds, uploadMedia } from './twitter';
import { loadCoverage } from '@/lib/coverage/registry';
import { strongBoard, strongToday } from '@/lib/site/strong-markets';
import { listDayRows } from '@/lib/site/fixtures';
import { hasTelegram, sendMessage, sendPhoto } from './telegram';
import { fetchTrends } from './twitter';

const TABLE = 'social_posts';
const LANGS: Lang[] = ['tr', 'en'];

interface Target { platform: 'twitter' | 'telegram'; account: Lang; chat?: string }
function targets(): Target[] {
  const out: Target[] = [];
  for (const l of LANGS) {
    if (twitterCreds(`TWITTER_${l.toUpperCase()}`)) out.push({ platform: 'twitter', account: l });
    const chat = (process.env[`TELEGRAM_CHAT_${l.toUpperCase()}`] || '').trim();
    if (hasTelegram() && chat) out.push({ platform: 'telegram', account: l, chat });
  }
  return out;
}

async function record(row: { key: string; kind: string; day: string; platform: string; account: string; fixtureIds: number[]; postId?: string | null; parentId?: string | null; body: string; status: string; error?: string | null }) {
  await db().from(TABLE).upsert({ key: row.key, kind: row.kind, day: row.day, platform: row.platform, account: row.account, fixture_ids: row.fixtureIds, post_id: row.postId ?? null, parent_id: row.parentId ?? null, body: row.body, status: row.status, error: row.error ?? null }, { onConflict: 'key' });
}

async function posted(keys: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  if (!keys.length) return out;
  const { data } = await db().from(TABLE).select('*').in('key', keys).eq('status', 'posted');
  for (const r of (data ?? []) as any[]) out.set(String(r.key), r);
  return out;
}

async function send(t: Target, text: string, png: Buffer | null, replyTo?: string | null): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (t.platform === 'twitter') {
    const creds = twitterCreds(`TWITTER_${t.account.toUpperCase()}`)!;
    let mediaId: string | undefined;
    if (png) { const up = await uploadMedia(creds, png); if (!up.ok) return up; mediaId = up.mediaId; }
    return postTweet(creds, text, { mediaId, replyTo: replyTo ?? undefined });
  }
  return png ? sendPhoto(t.chat!, png, text, replyTo ?? undefined) : sendMessage(t.chat!, text, replyTo ?? undefined);
}

/** Günün bacakları (günün seçimleri + vitrin), oranlarıyla. */
export async function dailyLegs(ymd: string): Promise<Leg[]> {
  const { picks } = await getDailyPicks(ymd);
  const daily: Leg[] = picks.map((p) => ({ fixtureId: p.fixtureId, leagueSlug: p.leagueSlug, leagueName: leagueBySlug(p.leagueSlug)?.name ?? p.leagueSlug, homeName: p.homeName, awayName: p.awayName, kickoff: p.kickoff, market: p.market, selection: p.selection, modelP: p.modelP, odds: p.odds, source: 'daily' }));
  const { data } = await db().from('site_showcase_picks').select('*').gte('kickoff', `${ymd}T00:00:00Z`).lt('kickoff', `${addDays(ymd, 1)}T00:00:00Z`).not('market', 'is', null);
  const rows = (data ?? []) as any[];
  const ids = rows.map((r) => Number(r.fixture_id));
  const odds = new Map<number, any>();
  if (ids.length) {
    const { data: od } = await db().from('prediction_odds').select('fixture_id, phase, captured_at, home_odds, draw_odds, away_odds, over25_odds, btts_yes_odds').in('fixture_id', ids);
    const by = new Map<number, any[]>();
    for (const r of (od ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
    for (const [k, rs] of by) { const l = latestPhase(rs); if (l) odds.set(k, l); }
  }
  const showcase: Leg[] = rows.map((r) => {
    const o = odds.get(Number(r.fixture_id));
    const m = String(r.market) as ShowcaseMarket, s = String(r.selection);
    const odd = !o ? null : m === 'ou25' ? (o.over25_odds > 1 ? Number(o.over25_odds) : null) : m === 'btts' ? (o.btts_yes_odds > 1 ? Number(o.btts_yes_odds) : null) : s === '1' ? Number(o.home_odds) : s === '2' ? Number(o.away_odds) : Number(o.draw_odds);
    return { fixtureId: Number(r.fixture_id), leagueSlug: String(r.league_slug), leagueName: leagueBySlug(String(r.league_slug))?.name ?? String(r.league_slug), homeName: String(r.home_name), awayName: String(r.away_name), kickoff: String(r.kickoff), market: m, selection: s, modelP: Number(r.model_p), odds: odd && odd > 1 ? odd : null, source: 'showcase' as const };
  });
  return pickLegs(daily, showcase, 3);
}

async function last7(): Promise<{ n: number; won: number } | null> {
  try { const r = await showcaseRecord(7); return r.n ? { n: r.n, won: r.won } : null; } catch { return null; }
}

/** Sabah gönderisi. */
export async function publishDaily(opts: { day?: string; dry?: boolean } = {}) {
  const day = opts.day ?? todayYmd();
  const legs = await dailyLegs(day);
  const rec = await last7();
  const out: any[] = [];
  const tg = targets();
  if (!legs.length) {
    for (const t of tg) await record({ key: `daily|${day}|${t.platform}|${t.account}`, kind: 'daily', day, platform: t.platform, account: t.account, fixtureIds: [], body: '', status: 'skipped', error: 'bacak yok' });
    return { ok: true, day, legs: 0, note: 'kurala uyan bacak yok, gönderi atılmadı', targets: tg.length, dry: !!opts.dry };
  }
  const have = await posted(tg.map((t) => `daily|${day}|${t.platform}|${t.account}`));
  const trends = await dayTrends(tg);
  const tags = hashtags(legs, trends);
  const images: Partial<Record<Lang, Buffer>> = {};
  for (const t of tg) {
    const key = `daily|${day}|${t.platform}|${t.account}`;
    const text = dailyText([...legs], day, t.account, rec, t.platform, tags);
    if (have.has(key)) { out.push({ key, status: 'already', id: have.get(key).post_id }); continue; }
    if (opts.dry) {
      out.push({ key, status: 'dry', text });
      const l = t.platform === 'twitter' ? telegramLink(process.env[`TELEGRAM_CHAT_${t.account.toUpperCase()}`]) : null;
      if (l) out.push({ key: `invite|${day}|twitter|${t.account}`, status: 'dry', text: inviteText(l, t.account) });
      continue;
    }
    images[t.account] ??= await dailyImage(legs, day, t.account, rec);
    const r = await send(t, text, images[t.account]!);
    await record({ key, kind: 'daily', day, platform: t.platform, account: t.account, fixtureIds: legs.map((l) => l.fixtureId), postId: r.ok ? r.id : null, body: text, status: r.ok ? 'posted' : 'failed', error: r.ok ? null : r.error });
    out.push({ key, status: r.ok ? 'posted' : 'failed', id: r.ok ? r.id : undefined, error: r.ok ? undefined : r.error });
    // X'te günlük gönderinin altına Telegram daveti (aynı dilin grubu tanımlıysa)
    const tgLink = t.platform === 'twitter' && r.ok ? telegramLink(process.env[`TELEGRAM_CHAT_${t.account.toUpperCase()}`]) : null;
    if (tgLink && r.ok) {
      const ikey = `invite|${day}|twitter|${t.account}`, itext = inviteText(tgLink, t.account);
      const ir = await send(t, itext, null, r.id);
      await record({ key: ikey, kind: 'invite', day, platform: 'twitter', account: t.account, fixtureIds: [], postId: ir.ok ? ir.id : null, parentId: r.id, body: itext, status: ir.ok ? 'posted' : 'failed', error: ir.ok ? null : ir.error });
      out.push({ key: ikey, status: ir.ok ? 'posted' : 'failed', id: ir.ok ? ir.id : undefined, error: ir.ok ? undefined : ir.error });
    }
  }
  return { ok: out.every((o) => o.status !== 'failed'), day, legs: legs.map((l) => `${l.homeName} – ${l.awayName} ${l.market} ${l.selection}`), tags, trends: trends.length, targets: tg.length, dry: !!opts.dry, posts: out };
}

/** Günün güçlü pazar bacakları (plan adım 4): sicil stats.strong bölgesine düşen maçlar. */
export async function strongLegs(ymd: string, limit = 6): Promise<StrongLeg[]> {
  const [rows, coverage] = await Promise.all([listDayRows(ymd), loadCoverage()]);
  const cov = new Map(coverage.map((c) => [Number(c.league_id), c]));
  return strongToday(
    rows.filter((r) => r.hasModel && !r.settled && Date.parse(r.kickoff) > Date.now()).map((r) => ({
      row: r, leagueId: r.leagueId, leagueName: r.leagueName, kickoff: r.kickoff,
      input: { pick: r.pick, pHome: r.pHome, pDraw: r.pDraw, pAway: r.pAway, over: r.overUnder ? { pick: r.overUnder.pick, pRaw: r.overUnder.pRaw } : null, btts: r.btts ? { pick: r.btts.pick, pRaw: r.btts.pRaw } : null },
    })),
    (id) => { const c = cov.get(id); return c ? { strong: c.stats?.strong, status: c.status, name: c.name } : undefined; },
    limit,
  ).map(({ row: r, pick: sp, leagueName }) => ({ fixtureId: r.fixtureId, homeName: r.homeName, awayName: r.awayName, kickoff: r.kickoff, leagueName, market: sp.market, selection: sp.selection, modelP: sp.p, won: sp.sm.won, n: sp.sm.n }));
}

/** Sabah "güçlü pazarlar" gönderisi (07:10 UTC; bacak yoksa atlanır). */
export async function publishStrong(opts: { day?: string; dry?: boolean } = {}) {
  const day = opts.day ?? todayYmd();
  const legs = await strongLegs(day);
  const tg = targets();
  const out: any[] = [];
  if (!legs.length) return { ok: true, day, legs: 0, note: 'güçlü bölgeye düşen maç yok, gönderi atılmadı', targets: tg.length, dry: !!opts.dry };
  const have = await posted(tg.map((t) => `strong|${day}|${t.platform}|${t.account}`));
  const trends = await dayTrends(tg);
  const tags = hashtags(legs.map((l) => ({ fixtureId: l.fixtureId, leagueSlug: '', leagueName: l.leagueName, homeName: l.homeName, awayName: l.awayName, kickoff: l.kickoff, market: l.market === 'x12' ? '1x2' : l.market === 'under25' ? 'ou25' : l.market, selection: l.selection, modelP: l.modelP, odds: null, source: 'showcase' as const })), trends);
  for (const t of tg) {
    const key = `strong|${day}|${t.platform}|${t.account}`;
    const text = strongText(legs, day, t.account, t.platform, tags);
    if (have.has(key)) { out.push({ key, status: 'already', id: have.get(key).post_id }); continue; }
    if (opts.dry) { out.push({ key, status: 'dry', text }); continue; }
    const r = await send(t, text, null);
    await record({ key, kind: 'strong', day, platform: t.platform, account: t.account, fixtureIds: legs.map((l) => l.fixtureId), postId: r.ok ? r.id : null, body: text, status: r.ok ? 'posted' : 'failed', error: r.ok ? null : r.error });
    out.push({ key, status: r.ok ? 'posted' : 'failed', id: r.ok ? r.id : undefined, error: r.ok ? undefined : r.error });
  }
  return { ok: out.every((o) => o.status !== 'failed'), day, legs: legs.map((l) => `${l.homeName} – ${l.awayName} ${l.market} ${l.selection} (${l.won}/${l.n})`), targets: tg.length, dry: !!opts.dry, posts: out };
}

/** X hedefi varsa günün trendleri (ilk X hesabının anahtarıyla, tek çağrı). */
export async function dayTrends(tg: Target[] = targets()): Promise<string[]> {
  const tw = tg.find((t) => t.platform === 'twitter');
  const creds = tw ? twitterCreds(`TWITTER_${tw.account.toUpperCase()}`) : null;
  const bearer = (process.env.TWITTER_BEARER_TOKEN || '').trim() || null;
  return creds || bearer ? fetchTrends(creds, bearer) : [];
}

/** Sonuç yanıtı penceresi (gün): geç başlayan maçlar ertesi gün sonuçlanır; settlement gecikirse
 *  (kaynak tarih kayması, 19 Eyl) 2 günlük pencere yanıtı kaçırıyordu → 3 gün. */
export const RESULTS_WINDOW_DAYS = 3;

/** Sonuç yanıtları: son 3 günün günlük gönderilerinin bacakları sonuçlandıysa aynı diziye yanıt. */
export async function publishResults(opts: { dry?: boolean } = {}) {
  const days = Array.from({ length: RESULTS_WINDOW_DAYS }, (_, i) => addDays(todayYmd(), -i));
  const { data } = await db().from(TABLE).select('*').eq('kind', 'daily').eq('status', 'posted').in('day', days);
  const parents = (data ?? []) as any[];
  if (!parents.length) return { ok: true, note: 'yanıtlanacak günlük gönderi yok', posts: [] };
  const ids = [...new Set(parents.flatMap((p) => (p.fixture_ids ?? []).map(Number)))];
  const { data: sc } = await db().from('engine_predictions').select('fixture_id, home_score, away_score').in('fixture_id', ids).not('home_score', 'is', null).not('away_score', 'is', null);
  const score = new Map<number, [number, number]>();
  for (const s of (sc ?? []) as any[]) score.set(Number(s.fixture_id), [Number(s.home_score), Number(s.away_score)]);
  if (!score.size) return { ok: true, note: 'sonuçlanan bacak yok', posts: [] };
  const out: any[] = [];
  for (const p of parents) {
    const legs = await dailyLegs(String(p.day));
    for (const fid of (p.fixture_ids ?? []).map(Number)) {
      const s = score.get(fid); const leg = legs.find((l) => l.fixtureId === fid);
      if (!s || !leg) continue;
      const key = `result|${fid}|${p.platform}|${p.account}`;
      if ((await posted([key])).has(key)) continue;
      const won = settleShowcase(leg.market as ShowcaseMarket, leg.selection as ShowcaseSelection, s[0], s[1]);
      const text = resultText(leg, s[0], s[1], won, p.account as Lang);
      if (opts.dry) { out.push({ key, status: 'dry', text }); continue; }
      const t: Target = { platform: p.platform, account: p.account, chat: (process.env[`TELEGRAM_CHAT_${String(p.account).toUpperCase()}`] || '').trim() };
      const r = await send(t, text, null, String(p.post_id));
      await record({ key, kind: 'result', day: String(p.day), platform: p.platform, account: p.account, fixtureIds: [fid], postId: r.ok ? r.id : null, parentId: String(p.post_id), body: text, status: r.ok ? 'posted' : 'failed', error: r.ok ? null : r.error });
      out.push({ key, status: r.ok ? 'posted' : 'failed', error: r.ok ? undefined : r.error });
    }
  }
  return { ok: out.every((o) => o.status !== 'failed'), posts: out };
}

/** Pazartesi: geçen haftanın (Pzt–Paz) karnesi, iki gönderilik dizi + görsel. */
export async function publishWeekly(opts: { dry?: boolean; day?: string } = {}) {
  const day = opts.day ?? todayYmd();
  const to = addDays(day, -1), from = addDays(day, -7);
  const rec = await showcaseRecord(7, Date.parse(`${day}T00:00:00Z`));
  const stats: WeeklyStats = { from, to, n: rec.n, won: rec.won, byMarket: rec.byMarket, noPick: rec.noPick };
  const tg = targets();
  const boardLines = strongBoard(await loadCoverage().catch(() => []), 3).map((b) => ({ market: b.market, leagues: b.rows.map((r) => ({ name: r.name, won: r.won, n: r.n })) }));
  const have = await posted(tg.map((t) => `weekly|${day}|${t.platform}|${t.account}`));
  const out: any[] = [];
  const images: Partial<Record<Lang, Buffer>> = {};
  for (const t of tg) {
    const key = `weekly|${day}|${t.platform}|${t.account}`;
    const wl = t.platform === 'twitter' ? telegramLink(process.env[`TELEGRAM_CHAT_${t.account.toUpperCase()}`]) : null;
    const [first, second0] = weeklyText(stats, t.account, t.platform, ['#football']);
    const second = wl ? `${second0}\n\n${t.account === 'tr' ? 'Telegram' : 'Telegram'}: ${wl}` : second0;
    if (have.has(key)) { out.push({ key, status: 'already' }); continue; }
    if (opts.dry) { out.push({ key, status: 'dry', text: [first, second, boardLines.length ? strongBoardText(boardLines, t.account, t.platform) : null] }); continue; }
    if (!stats.n) { await record({ key, kind: 'weekly', day, platform: t.platform, account: t.account, fixtureIds: [], body: '', status: 'skipped', error: 'sonuçlanmış seçim yok' }); out.push({ key, status: 'skipped' }); continue; }
    images[t.account] ??= await weeklyImage(stats, t.account);
    const r1 = await send(t, first, images[t.account]!);
    if (!r1.ok) { await record({ key, kind: 'weekly', day, platform: t.platform, account: t.account, fixtureIds: [], body: first, status: 'failed', error: r1.error }); out.push({ key, status: 'failed', error: r1.error }); continue; }
    const r2 = await send(t, second, null, r1.id);
    await record({ key, kind: 'weekly', day, platform: t.platform, account: t.account, fixtureIds: [], postId: r1.id, body: `${first}\n---\n${second}`, status: 'posted', error: r2.ok ? null : `2. gönderi: ${r2.error}` });
    // Üçüncü gönderi: pazar karnesi (plan adım 4); yoksa atlanır.
    const r3 = boardLines.length && r2.ok ? await send(t, strongBoardText(boardLines, t.account, t.platform), null, r2.id) : null;
    out.push({ key, status: 'posted', id: r1.id, second: r2.ok ? r2.id : r2.error, third: r3 ? (r3.ok ? r3.id : r3.error) : undefined });
  }
  return { ok: out.every((o) => o.status !== 'failed'), day, stats, targets: tg.length, dry: !!opts.dry, posts: out };
}

export function socialStatus() {
  const tg = targets();
  return { targets: tg.map((t) => `${t.platform}:${t.account}`), telegramBot: hasTelegram(), twitterTr: !!twitterCreds('TWITTER_TR'), twitterEn: !!twitterCreds('TWITTER_EN'), twitterBearer: !!(process.env.TWITTER_BEARER_TOKEN || '').trim(), telegramAdmin: !!(process.env.TELEGRAM_ADMIN_CHAT || '').trim(), telegramChatEn: (process.env.TELEGRAM_CHAT_EN || '').trim() || null };
}
