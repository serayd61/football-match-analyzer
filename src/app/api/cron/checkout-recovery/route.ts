// ============================================================================
// TEK SEFERLİK — Checkout kurtarma maili (2026-11-04). vercel.json'da YOK;
// CRON_SECRET ile elle çalıştırılır:
//   GET /api/cron/checkout-recovery?dry=1          kim alacak (gönderim yok)
//   GET /api/cron/checkout-recovery?canary=1       yalnız admin'e örnek
//   GET /api/cron/checkout-recovery?limit=20       gönder (parti)
//   ?since=2026-10-13T00:00:00Z                    pencere başlangıcı (varsayılan: $9.90 günü)
// Alıcılar: Stripe Checkout'u açıp ödemeden kapananlar (lib/site/checkout-recovery).
// Mükerrer engeli: email_campaign_log (campaign_key, email) UNIQUE.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { sendCheckoutRecoveryEmail, SITE_URL } from '@/lib/email';
import { unsubscribeUrl } from '@/lib/campaign';
import { ADMIN_EMAILS } from '@/lib/admin/emails';
import { CHECKOUT_RECOVERY_KEY, CHECKOUT_RECOVERY_SINCE, selectRecoveryRecipients, type RecoverySession } from '@/lib/site/checkout-recovery';
import { PLAN_PRICES, PROMO, promoActive, promoMonthly, yearlyEnabled } from '@/lib/site/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials yok');
  // cache: 'no-store' — bkz. world-cup-campaign (2026-07-10 mükerrer gönderim vakası)
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadSessions(sinceIso: string): Promise<RecoverySession[]> {
  const since = Math.floor(Date.parse(sinceIso) / 1000);
  const out: RecoverySession[] = [];
  let starting_after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await stripe.checkout.sessions.list({ limit: 100, created: { gte: since }, ...(starting_after ? { starting_after } : {}) });
    for (const s of res.data) {
      // Canary oturumları (metadata.canary) ve abonelik dışı modlar hariç.
      if (s.metadata?.canary || s.mode !== 'subscription') continue;
      out.push({ email: s.customer_details?.email || s.customer_email || null, status: s.status || 'open', paymentStatus: s.payment_status, created: s.created });
    }
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1]?.id;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const dry = sp.get('dry') === '1';
  const canary = sp.get('canary') === '1';
  const limitParam = parseInt(sp.get('limit') || '', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
  const since = sp.get('since') || CHECKOUT_RECOVERY_SINCE;
  if (!Number.isFinite(Date.parse(since))) return NextResponse.json({ ok: false, error: 'since geçersiz' }, { status: 400 });
  const sb = db();

  const [sessions, { data: unsub, error: unErr }, { data: sent, error: sErr }, { data: subs, error: pErr }] = await Promise.all([
    loadSessions(since),
    sb.from('email_unsubscribes').select('email'),
    sb.from('email_campaign_log').select('email').eq('campaign_key', CHECKOUT_RECOVERY_KEY),
    sb.from('profiles').select('email').in('subscription_status', ['active', 'trialing', 'past_due']),
  ]);
  const err = unErr || sErr || pErr;
  if (err) return NextResponse.json({ ok: false, aborted: true, error: err.message }, { status: 500 });

  const lower = (rows: any[] | null) => new Set((rows || []).map((r) => String(r.email || '').toLowerCase()).filter(Boolean));
  let recipients = selectRecoveryRecipients(sessions, {
    unsubscribed: lower(unsub as any[]),
    alreadySent: lower(sent as any[]),
    subscribed: lower(subs as any[]),
    exclude: new Set(ADMIN_EMAILS.map((e) => e.toLowerCase())),
  });
  if (canary) recipients = [{ email: ADMIN_EMAILS[0].toLowerCase(), attempts: 2, lastAttempt: new Date().toISOString() }];
  const total = recipients.length;
  recipients = recipients.slice(0, limit);

  const common = {
    pricingUrl: `${SITE_URL}/pricing`,
    monthly: PLAN_PRICES.monthly.amount,
    yearly: yearlyEnabled() ? PLAN_PRICES.yearly.amount : null,
    promoCode: promoActive() ? PROMO.code : null,
    promoMonthly: promoMonthly(),
    promoMonths: PROMO.months,
  };

  if (dry) return NextResponse.json({ ok: true, dry: true, key: CHECKOUT_RECOVERY_KEY, since, sessions: sessions.length, total, recipients, offer: common });

  let ok = 0, failed = 0;
  for (const r of recipients) {
    try {
      await sendCheckoutRecoveryEmail(r.email, { ...common, unsubscribeUrl: unsubscribeUrl(r.email) });
      ok++;
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: CHECKOUT_RECOVERY_KEY, email: r.email, status: 'sent' }, { onConflict: 'campaign_key,email' });
    } catch (e: any) {
      failed++;
      console.error(`[checkout-recovery] ${r.email}:`, e?.message);
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: CHECKOUT_RECOVERY_KEY, email: r.email, status: 'failed', error: String(e?.message || e).slice(0, 300) }, { onConflict: 'campaign_key,email' });
    }
    await sleep(150); // Resend hız sınırı
  }
  return NextResponse.json({ ok: failed === 0, key: CHECKOUT_RECOVERY_KEY, since, total, sent: ok, failed, canary });
}
