// ============================================================================
// CRON — sabah raporu (2026-11-02): 07:05 UTC, deneme + ödeyen üyelere kişiye özel
// günlük e-posta (lib/site/morning-brief.ts). Kişisel parça yoksa (dün açılan
// maç yok, takımı oynamıyor) o kişiye o gün mail GİTMEZ.
//   dün bakılan maç   → site_match_views (son 36 saat, maça başlamadan önce açılmış, sonuçlanmış)
//   takımın bugün     → site_watchlist + nextMatchForTeam (24 saat içinde)
//   dün kuponun       → site_slip_legs (başlangıç son 36 saat, maçtan önce çıkarılmamış, sonuçlanmış) [slip-2.0]
//   günün seçimi      → site_daily_picks (cron 06:15 UTC dondurur)
// Güvenlik: CRON_SECRET; unsubscribe hariç; email_campaign_log (morning-brief-YYYY-MM-DD,email)
// ile kişi başı günde tek gönderim; ?dry=1 kuru çalışma; ?canary=1 yalnız admin'e
// (içerik yoksa örnek şablon); ?limit=N parti.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendMorningBriefEmail } from '@/lib/email';
import { unsubscribeUrl, SITE_URL, PLAY_STORE_URL, TELEGRAM_URL } from '@/lib/campaign';
import { ADMIN_EMAILS } from '@/lib/admin/emails';
import { classifyUsers } from '@/lib/site/ops-report';
import { getPrediction, type SitePrediction } from '@/lib/site/predictions';
import { nextMatchForTeam } from '@/lib/site/dashboard';
import { readDailyPicks } from '@/lib/site/daily-picks';
import { todayYmd } from '@/lib/site/time';
import {
  buildMorningBrief, briefCampaignKey, slipLegLabel, SAMPLE_BRIEF_INPUT, VIEW_WINDOW_MS, CLUB_WINDOW_MS,
  type BriefInput, type BriefViewed, type BriefClubMatch, type BriefPick, type BriefSlipLeg,
} from '@/lib/site/morning-brief';
import { legOutcome } from '@/lib/site/slip-rule';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials yok');
  // cache: 'no-store' — bkz. world-cup-campaign (2026-07-10 mükerrer gönderim vakası)
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tableMissing = (msg: string | undefined) => !!msg && /relation .* does not exist|does not exist/.test(msg);

const toViewed = (p: SitePrediction): BriefViewed | null => {
  if (!p.settled || p.homeScore == null || p.awayScore == null) return null;
  return { fixtureId: p.fixtureId, homeName: p.homeName, awayName: p.awayName, homeScore: p.homeScore, awayScore: p.awayScore, leagueName: p.leagueName, pick: p.noFavourite ? null : p.pick, confidence: p.confidence ?? p.confidenceRaw, outcome: p.outcome };
};
const toClub = (teamId: number, teamName: string, p: SitePrediction): BriefClubMatch => ({
  teamId, teamName, fixtureId: p.fixtureId, homeName: p.homeName, awayName: p.awayName, kickoff: p.kickoff, leagueName: p.leagueName, hasModel: p.hasModel, pick: p.noFavourite ? null : p.pick, confidence: p.confidence ?? p.confidenceRaw,
});

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const dry = sp.get('dry') === '1';
  const canary = sp.get('canary') === '1';
  const limitParam = parseInt(sp.get('limit') || '', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 300;
  const now = Date.now();
  const today = todayYmd();
  const key = briefCampaignKey(today);
  const sb = db();

  // Okumalar güvenlik kapısı: üye/unsubscribe/dedup hatası → iptal. Görüntü ve takım
  // tabloları eksikse (migration bekliyor) o parça boş sayılır, rapor yine çalışır.
  const [u, pr, su, un, lg, vw, wl, sl] = await Promise.all([
    sb.from('users').select('id, email, name, created_at, password_hash'),
    sb.from('profiles').select('email, trial_ends_at, subscription_status, subscription_end, last_seen_at, first_match_view_at'),
    sb.from('subscriptions').select('user_id, status, current_period_end, stripe_subscription_id').in('status', ['active', 'trialing']),
    sb.from('email_unsubscribes').select('email'),
    sb.from('email_campaign_log').select('email').eq('campaign_key', key),
    sb.from('site_match_views').select('user_email, fixture_id, viewed_at').gte('viewed_at', new Date(now - VIEW_WINDOW_MS).toISOString()).order('viewed_at', { ascending: false }).range(0, 999),
    sb.from('site_watchlist').select('user_email, team_id, team_name').range(0, 999),
    sb.from('site_slip_legs').select('user_email, fixture_id, market, selection, line, odds, home_name, away_name, kickoff, removed_at')
      .gte('kickoff', new Date(now - VIEW_WINDOW_MS).toISOString()).lt('kickoff', new Date(now).toISOString()).order('kickoff', { ascending: true }).range(0, 999),
  ]);
  const err = u.error || pr.error || su.error || un.error || lg.error;
  if (err) return NextResponse.json({ ok: false, aborted: true, error: err.message }, { status: 500 });
  const warnings: string[] = [];
  if (vw.error) { warnings.push(`site_match_views: ${vw.error.message}`); if (!tableMissing(vw.error.message)) console.error('[morning-brief] views read failed', vw.error.message); }
  if (wl.error) { warnings.push(`site_watchlist: ${wl.error.message}`); if (!tableMissing(wl.error.message)) console.error('[morning-brief] watchlist read failed', wl.error.message); }
  if (sl.error) { warnings.push(`site_slip_legs: ${sl.error.message}`); if (!tableMissing(sl.error.message)) console.error('[morning-brief] slip read failed', sl.error.message); }

  const users = classifyUsers({
    users: (u.data ?? []).map((x: any) => ({ id: x.id, email: x.email, name: x.name, createdAt: x.created_at, passwordHash: x.password_hash })),
    profiles: (pr.data ?? []).map((p: any) => ({ email: p.email, trialEndsAt: p.trial_ends_at, subscriptionStatus: p.subscription_status, subscriptionEnd: p.subscription_end, lastSeenAt: p.last_seen_at, firstMatchViewAt: p.first_match_view_at })),
    subs: (su.data ?? []).map((s: any) => ({ userId: s.user_id, status: s.status, currentPeriodEnd: s.current_period_end, stripeSubscriptionId: s.stripe_subscription_id })),
  }, now);
  const unsubscribed = new Set(((un.data || []) as any[]).map((r) => String(r.email).toLowerCase()));
  const alreadySent = new Set(((lg.data || []) as any[]).map((r) => String(r.email).toLowerCase()));
  const admins = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));

  // Kişi → dün baktığı maçlar (maça başlamadan önce açılmış olmalı) · kişi → takımları
  const viewsBy = new Map<string, Array<{ fixtureId: number; viewedMs: number }>>();
  for (const r of (vw.data || []) as any[]) {
    const e = String(r.user_email || '').toLowerCase(); const id = Number(r.fixture_id); const t = Date.parse(r.viewed_at);
    if (!e || !Number.isFinite(id) || !Number.isFinite(t)) continue;
    const arr = viewsBy.get(e) ?? []; arr.push({ fixtureId: id, viewedMs: t }); viewsBy.set(e, arr);
  }
  const clubsBy = new Map<string, Array<{ teamId: number; teamName: string }>>();
  for (const r of (wl.data || []) as any[]) {
    const e = String(r.user_email || '').toLowerCase(); const id = Number(r.team_id);
    if (!e || !Number.isFinite(id)) continue;
    const arr = clubsBy.get(e) ?? []; arr.push({ teamId: id, teamName: String(r.team_name || '') }); clubsBy.set(e, arr);
  }

  // Kişi → dün başlayan kupon bacakları (maçtan önce çıkarılmış bacak sayılmaz)
  type SlipRowLite = { fixtureId: number; market: string; selection: string; line: number | null; odds: number | null; homeName: string; awayName: string };
  const slipBy = new Map<string, SlipRowLite[]>();
  for (const r of (sl.data || []) as any[]) {
    const e = String(r.user_email || '').toLowerCase(); const id = Number(r.fixture_id); const ko = Date.parse(r.kickoff);
    if (!e || !Number.isFinite(id) || !Number.isFinite(ko)) continue;
    if (r.removed_at && Date.parse(r.removed_at) <= ko) continue;
    const arr = slipBy.get(e) ?? [];
    arr.push({ fixtureId: id, market: String(r.market), selection: String(r.selection), line: r.line == null ? null : Number(r.line), odds: r.odds == null ? null : Number(r.odds), homeName: String(r.home_name), awayName: String(r.away_name) });
    slipBy.set(e, arr);
  }

  let candidates = users.filter((x) => x.access !== 'expired' && !unsubscribed.has(x.email) && !alreadySent.has(x.email) && !admins.has(x.email));
  if (canary) {
    const admin = ADMIN_EMAILS[0].toLowerCase();
    const row = users.find((x) => x.email === admin);
    candidates = [row ?? { ...users[0], email: admin, name: null, access: 'trial', endMs: now + 4 * 86_400_000 }];
  }
  const total = candidates.length;
  candidates = candidates.slice(0, limit);

  // Maç/takım sorguları tekilleştirilir (unstable_cache + burada da harita).
  const predCache = new Map<number, Promise<SitePrediction | null>>();
  const pred = (id: number) => { let p = predCache.get(id); if (!p) { p = getPrediction(id).catch(() => null); predCache.set(id, p); } return p; };
  const clubCache = new Map<number, Promise<SitePrediction | null>>();
  const clubNext = (id: number) => { let p = clubCache.get(id); if (!p) { p = nextMatchForTeam(id).catch(() => null); clubCache.set(id, p); } return p; };

  const picks = await readDailyPicks(today).catch(() => []);
  const dp = picks.find((p) => Date.parse(p.kickoff) > now) ?? null;
  const pick: BriefPick | null = dp ? { fixtureId: dp.fixtureId, homeName: dp.homeName, awayName: dp.awayName, market: dp.market, selection: dp.selection, modelP: dp.modelP, odds: dp.odds, kickoff: dp.kickoff } : null;
  const urlsFor = (email: string) => ({ site: SITE_URL, dashboard: `${SITE_URL}/dashboard`, telegram: TELEGRAM_URL, unsubscribe: unsubscribeUrl(email), play: PLAY_STORE_URL });

  const prepared: Array<{ email: string; input: BriefInput }> = [];
  for (const c of candidates) {
    const slip: BriefSlipLeg[] = [];
    for (const l of slipBy.get(c.email) ?? []) {
      const p = await pred(l.fixtureId);
      if (!p || !p.settled || p.homeScore == null || p.awayScore == null) continue;
      const out = legOutcome({ market: l.market as any, selection: l.selection as any, line: l.line ?? undefined }, { homeScore: p.homeScore, awayScore: p.awayScore, settled: true, status: 'finished' });
      if (!out) continue;
      slip.push({ fixtureId: l.fixtureId, homeName: p.homeName, awayName: p.awayName, label: slipLegLabel({ ...l, homeName: p.homeName, awayName: p.awayName }), odds: l.odds, homeScore: p.homeScore, awayScore: p.awayScore, outcome: out });
      if (slip.length >= 15) break;
    }
    const inSlip = new Set(slip.map((l) => l.fixtureId));
    const viewed: BriefViewed[] = [];
    const seenFx = new Set<number>(inSlip); // kupondaki maç "dün baktığın" olarak tekrar gösterilmez
    for (const v of viewsBy.get(c.email) ?? []) {
      if (seenFx.has(v.fixtureId)) continue; seenFx.add(v.fixtureId);
      const p = await pred(v.fixtureId);
      if (!p || Date.parse(p.kickoff) <= v.viewedMs) continue; // maç bittikten sonra açıldıysa "dün nasıl bitti" değil
      const row = toViewed(p); if (row) viewed.push(row);
      if (viewed.length >= 3) break;
    }
    const clubs: BriefClubMatch[] = [];
    const seenClubFx = new Set<number>();
    for (const w of clubsBy.get(c.email) ?? []) {
      const p = await clubNext(w.teamId);
      if (!p || seenClubFx.has(p.fixtureId)) continue;
      const k = Date.parse(p.kickoff);
      if (!Number.isFinite(k) || k < now - 2 * 3600_000 || k > now + CLUB_WINDOW_MS) continue;
      seenClubFx.add(p.fixtureId);
      clubs.push(toClub(w.teamId, w.teamName, p));
      if (clubs.length >= 3) break;
    }
    const trialDaysLeft = c.access === 'trial' ? Math.max(0, Math.floor((c.endMs - now) / 86_400_000)) : null;
    let input: BriefInput = { name: c.name ? c.name.split(' ')[0] : null, viewed, clubs, slip, pick, trialDaysLeft, urls: urlsFor(c.email) };
    if (canary && !viewed.length && !clubs.length && !slip.length) input = { ...SAMPLE_BRIEF_INPUT, pick: pick ?? SAMPLE_BRIEF_INPUT.pick, urls: urlsFor(c.email) };
    prepared.push({ email: c.email, input });
  }
  const withContent = prepared.filter((p) => p.input.viewed.length || p.input.clubs.length || p.input.slip?.length);

  if (dry) {
    return NextResponse.json({
      ok: true, dry: true, key, total, candidates: candidates.length, withContent: withContent.length, pick, warnings,
      recipients: withContent.map((p) => ({ email: p.email, slip: (p.input.slip ?? []).map((l) => `${l.label} ${l.homeScore}-${l.awayScore} (${l.outcome})`), viewed: p.input.viewed.map((v) => `${v.homeName} ${v.homeScore}-${v.awayScore} ${v.awayName} (${v.outcome})`), clubs: p.input.clubs.map((c) => `${c.teamName}: ${c.homeName}-${c.awayName}`), subject: buildMorningBrief(p.input)?.subject })),
    });
  }

  let ok = 0, failed = 0;
  for (const p of withContent) {
    const brief = buildMorningBrief(p.input);
    if (!brief) continue;
    try {
      await sendMorningBriefEmail(p.email, brief, p.input.urls.unsubscribe);
      ok++;
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: key, email: p.email, status: 'sent' }, { onConflict: 'campaign_key,email' });
    } catch (e: any) {
      failed++;
      console.error(`[morning-brief] ${p.email}:`, e?.message);
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: key, email: p.email, status: 'failed', error: String(e?.message || e).slice(0, 300) }, { onConflict: 'campaign_key,email' });
    }
    await sleep(150); // Resend hız sınırı
  }
  return NextResponse.json({ ok: failed === 0, key, total, candidates: candidates.length, withContent: withContent.length, sent: ok, failed, canary, warnings });
}
