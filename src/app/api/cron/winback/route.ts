// ============================================================================
// CRON — geri kazanım serisi (2026-11-14). Her gün 07:30 UTC (Telegram günlük
// paylaşımından sonra). Denemesi bitmiş, abone olmayan üyeye kişi başına 3 günde
// bir, en çok 5 kez: o günün ücretsiz maçları + Pro + "Android uygulamasında
// Google Play ile abonelik açıldı". Kurallar: lib/site/winback.ts.
//
// Günün ücretsiz maçı yoksa (ya da hepsi başlamışsa):
//   - 1. adım MAÇSIZ gider (2026-11-15, kullanıcı kararı): milli arada liste 6 gün
//     boş kaldı, seri hiç başlayamadı; ilk mailin asıl haberi maça bağlı değil
//     (Google Play ile abonelik). Şablon: email-winback.ts `legs` boş dalı.
//   - 2.–5. adımlar gönderilmez, adım tüketilmez, maç olan ilk gün devam eder
//     (o mailler "bugünün ücretsiz maçları" üzerine kurulu).
//
// Güvenlik (trial-emails ile aynı): CRON_SECRET; okuma hatasında iptal
// (unsubscribe/dedup boş sayılmasın); unsubscribe, abone ve admin hariç;
// email_campaign_log `winback-2026-11:s{n}` ile adım başına tek gönderim.
//   ?dry=1     gönderim yok: kaç kişi, hangi adım (adres listesi yalnız &list=1 ile)
//   ?canary=1  yalnız admin'e, 1. adım (maç yoksa örnek maçlarla; &nomatch=1 → maçsız sürüm)
//   ?limit=N   günlük parti (varsayılan 60: Resend kotası diğer kampanyalarla paylaşılır)
//   ?maxAge=N  serinin başlayabileceği en eski deneme bitişi, gün (varsayılan 120)
// 2026-11-14 (2): maç satırları maçın kendi sayfasına gider (günün ücretsiz maçı
// süresi dolmuş üyeye açık, lib/site/free-today-rule.ts). Gönderilen liste
// social_posts'a `winback|<gün>|email|en` olarak yazılır; kişinin bir sonraki
// maili o kaydın sonucuyla açılır (lib/site/winback-results.ts).
// Bu cron, eski tek seferlik "reengage" mailinin (world-cup-campaign?type=reengage)
// vercel.json'daki yerini aldı; ikisi aynı kitleye gidiyordu.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendWinbackEmail } from '@/lib/email';
import type { WinbackLast, WinbackLeg } from '@/lib/email-winback';
import { encodeSentLegs, parseSentLegs, settleSent, winbackRecordKey, type SentLeg } from '@/lib/site/winback-results';
import { unsubscribeUrl, SITE_URL, PLAY_STORE_URL, TELEGRAM_URL } from '@/lib/campaign';
import { ADMIN_EMAILS } from '@/lib/admin/emails';
import type { TrialUser } from '@/lib/site/trial-emails';
import { selectWinbackRecipients, splitNoMatchDay, winbackHistory, winbackKey, WINBACK_KEY_PREFIX, WINBACK_MAX_STEPS, WINBACK_MAX_AGE_DAYS, type WinbackLogRow } from '@/lib/site/winback';
import { dailyLegs } from '@/lib/social/publish';
import { fmtDate, fmtTime, marketLabel, tzLabel } from '@/lib/social/content';
import { showcaseRecord } from '@/lib/site/showcase';
import { todayYmd, ymdOf } from '@/lib/site/time';
import { PLAN_PRICES, PROMO, promoActive, yearlyEnabled, yearlySavingPct } from '@/lib/site/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials yok');
  // cache: 'no-store' — bkz. world-cup-campaign (2026-07-10 mükerrer gönderim vakası)
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** PostgREST tek yanıtta en çok 1000 satır döner; kesik liste = eksik dedup. Sayfa sayfa hepsini oku. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const SAMPLE_LEGS: WinbackLeg[] = [
  { time: '18:30', home: 'Home United', away: 'Away City', league: 'Sample League', selection: 'Over 2.5', modelPct: 64 },
  { time: '21:00', home: 'North FC', away: 'South FC', league: 'Sample League', selection: 'North FC win', modelPct: 58 },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const dry = sp.get('dry') === '1';
  const canary = sp.get('canary') === '1';
  const num = (k: string, d: number) => { const n = parseInt(sp.get(k) || '', 10); return Number.isFinite(n) && n > 0 ? n : d; };
  const limit = num('limit', 60);
  const maxAgeDays = num('maxAge', WINBACK_MAX_AGE_DAYS);
  const now = Date.now();
  const day = todayYmd();
  const sb = db();

  // Günün ücretsiz maçları: Telegram'da 07:00 UTC'de yayınlananla aynı liste; başlamış olanlar düşer.
  const legsRaw = (await dailyLegs(day).catch(() => [])).filter((l) => Date.parse(l.kickoff) > now);
  let legs: Array<WinbackLeg & { fixtureId?: number }> = legsRaw.map((l) => ({ fixtureId: l.fixtureId, time: fmtTime(l.kickoff, 'en'), home: l.homeName, away: l.awayName, league: l.leagueName, selection: marketLabel(l, 'en'), modelPct: l.modelP * 100 }));
  const sentLegs: SentLeg[] = legsRaw.map((l) => ({ fixtureId: l.fixtureId, home: l.homeName, away: l.awayName, market: l.market, selection: l.selection, label: marketLabel(l, 'en') }));
  const tz = legsRaw.length ? tzLabel('en', legsRaw[0].kickoff) : tzLabel('en', new Date(now).toISOString());
  if (!legs.length && canary && sp.get('nomatch') !== '1') legs = SAMPLE_LEGS; // ?canary=1&nomatch=1 → maçsız sürümün önizlemesi
  /** Bugün maç yok: yalnız 1. adım, maçsız şablonla (bkz. başlık). */
  const noMatchDay = legs.length === 0;

  // Okumalar güvenlik kapısı: hata → iptal (unsubscribe/dedup boş sayılmasın)
  let users: any[], profs: any[], unsub: any[], log: WinbackLogRow[];
  try {
    [users, profs, unsub, log] = await Promise.all([
      readAll<any>((a, b) => sb.from('users').select('email, name, created_at').order('created_at').range(a, b)),
      readAll<any>((a, b) => sb.from('profiles').select('email, trial_ends_at, subscription_status').order('email').range(a, b)),
      readAll<any>((a, b) => sb.from('email_unsubscribes').select('email').order('email').range(a, b)),
      readAll<WinbackLogRow>((a, b) => sb.from('email_campaign_log').select('email, campaign_key, sent_at').like('campaign_key', `${WINBACK_KEY_PREFIX}%`).order('id').range(a, b)),
    ]);
  } catch (e: any) {
    return NextResponse.json({ ok: false, aborted: true, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }

  const prof = new Map<string, { trial_ends_at: string | null; subscription_status: string | null }>();
  for (const p of profs) if (p.email) prof.set(String(p.email).toLowerCase().trim(), p);
  const list: TrialUser[] = users.map((u) => {
    const e = String(u.email || '').toLowerCase().trim(); const p = prof.get(e);
    return { email: e, name: u.name || null, createdAt: u.created_at, trialEndsAt: p?.trial_ends_at ?? null, subscriptionStatus: p?.subscription_status ?? null };
  });
  const history = winbackHistory(log, now);
  let recipients = selectWinbackRecipients(list, history, {
    now, maxAgeDays,
    unsubscribed: new Set(unsub.map((r) => String(r.email).toLowerCase())),
    exclude: new Set(ADMIN_EMAILS.map((e) => e.toLowerCase())),
  });
  let waiting = 0;
  if (noMatchDay) { const split = splitNoMatchDay(recipients); recipients = split.send; waiting = split.waiting; }
  if (canary) recipients = [{ email: ADMIN_EMAILS[0].toLowerCase(), name: null, step: 1, daysSinceEnd: 3 }];
  const total = recipients.length;
  const bySteps = recipients.reduce<Record<string, number>>((m, r) => { m[`s${r.step}`] = (m[`s${r.step}`] || 0) + 1; return m; }, {});
  recipients = recipients.slice(0, limit);

  const rec = await showcaseRecord(7).catch(() => null);
  const stats = rec && rec.n >= 10 ? { n: rec.n, won: rec.won } : null;
  const yearly = yearlyEnabled() ? PLAN_PRICES.yearly.amount : null;

  // Önceki mailin sonucu: kişinin son gönderim günü → o günün kaydı → skorlar.
  // Okuma hatası gönderimi durdurmaz; blok o gün basılmaz.
  const lastDayOf = (email: string): string | null => { const h = history.get(email); return h && h.lastAt > 0 ? ymdOf(new Date(h.lastAt)) : null; };
  const results = new Map<string, WinbackLast>();
  const prevDays = [...new Set(recipients.map((r) => lastDayOf(r.email)).filter((d): d is string => !!d && d < day))];
  if (prevDays.length) {
    try {
      const { data: recs, error: recErr } = await sb.from('social_posts').select('day, body').in('key', prevDays.map(winbackRecordKey)).eq('status', 'posted');
      if (recErr) throw new Error(recErr.message);
      const sent = new Map<string, SentLeg[]>();
      for (const r of (recs ?? []) as any[]) sent.set(String(r.day).slice(0, 10), parseSentLegs(r.body));
      const ids = [...new Set([...sent.values()].flat().map((l) => l.fixtureId))];
      const scores = new Map<number, [number, number]>();
      if (ids.length) {
        const { data: sc, error: scErr } = await sb.from('engine_predictions').select('fixture_id, home_score, away_score').in('fixture_id', ids).not('home_score', 'is', null).not('away_score', 'is', null);
        if (scErr) throw new Error(scErr.message);
        for (const x of (sc ?? []) as any[]) if (!scores.has(Number(x.fixture_id))) scores.set(Number(x.fixture_id), [Number(x.home_score), Number(x.away_score)]);
      }
      for (const [d, l] of sent) { const r = settleSent(l, scores); if (r) results.set(d, { dateLabel: fmtDate(d, 'en'), ...r }); }
    } catch (e: any) {
      console.error('[winback] results:', e?.message);
    }
  }
  const lastFor = (email: string): WinbackLast | null => { const d = lastDayOf(email); return (d && results.get(d)) || null; };

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, day, legs: legs.length, noMatchDay, waiting, total, wouldSend: recipients.length, withResults: recipients.filter((r) => lastFor(r.email)).length, bySteps, stats, ...(sp.get('list') === '1' ? { recipients: recipients.map((r) => ({ email: r.email, step: r.step, daysSinceEnd: r.daysSinceEnd })) } : {}) });
  }

  // Bugün gönderilen listenin kaydı: maçları üyeye açar (free-today) ve 3 gün sonraki
  // mailin sonuç bloğunu besler. Günün ilk kaydı kalır (sonraki elle koşu ezmez).
  if (sentLegs.length && recipients.length) {
    const { error: recErr } = await sb.from('social_posts').upsert(
      { key: winbackRecordKey(day), kind: 'winback', day, platform: 'email', account: 'en', fixture_ids: sentLegs.map((l) => l.fixtureId), post_id: null, parent_id: null, body: encodeSentLegs(sentLegs), status: 'posted', error: null },
      { onConflict: 'key', ignoreDuplicates: true },
    );
    if (recErr) console.error('[winback] record:', recErr.message);
  }

  let ok = 0, failed = 0;
  for (const r of recipients) {
    const utm = `utm_source=email&utm_medium=winback&utm_campaign=winback_s${r.step}`;
    const key = winbackKey(r.step);
    try {
      await sendWinbackEmail(r.email, {
        step: r.step, maxSteps: WINBACK_MAX_STEPS, name: r.name, dateLabel: fmtDate(day, 'en'), tz, stats,
        legs: legs.map(({ fixtureId, ...l }) => ({ ...l, url: fixtureId ? `${SITE_URL}/predictions/${fixtureId}?${utm}` : null })),
        last: canary ? null : lastFor(r.email),
        monthly: PLAN_PRICES.monthly.amount, yearly, savingPct: yearly ? yearlySavingPct() : null, promoCode: promoActive() ? PROMO.code : null,
        pricingUrl: `${SITE_URL}/pricing?${utm}`, matchesUrl: `${SITE_URL}/matches?${utm}`, playUrl: `${PLAY_STORE_URL}&${utm}`, telegramUrl: TELEGRAM_URL,
        unsubscribeUrl: unsubscribeUrl(r.email),
      });
      ok++;
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: key, email: r.email, status: 'sent', sent_at: new Date().toISOString() }, { onConflict: 'campaign_key,email' });
    } catch (e: any) {
      failed++;
      console.error(`[winback] s${r.step}:`, e?.message);
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: key, email: r.email, status: 'failed', error: String(e?.message || e).slice(0, 300), sent_at: new Date().toISOString() }, { onConflict: 'campaign_key,email' });
    }
    await sleep(150); // Resend hız sınırı
  }
  return NextResponse.json({ ok: failed === 0, day, legs: legs.length, noMatchDay, waiting, total, sent: ok, failed, canary, bySteps, stats });
}
