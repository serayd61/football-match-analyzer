// ============================================================================
// CRON — deneme dönemi e-postaları (2026-09-26)
//   kind=mid     kayıttan 2–3 gün sonra: haftanın karnesi + kalan gün
//   kind=ending  bitime 1–2 gün kala: "yarın kapanıyor" + Pro (+ lansman teklifi)
// Güvenlik: CRON_SECRET; unsubscribe ve abone hariç; email_campaign_log
// (campaign_key,email) UNIQUE ile kişi başı tek gönderim; ?dry=1 kuru çalışma;
// ?canary=1 yalnız admin'e; ?limit=N parti. Karne: vitrin son 7 gün (showcaseRecord).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendTrialMidEmail, sendTrialEndingEmail } from '@/lib/email';
import { unsubscribeUrl, SITE_URL } from '@/lib/campaign';
import { ADMIN_EMAILS } from '@/lib/admin/emails';
import { selectTrialRecipients, TRIAL_CAMPAIGN_KEYS, type TrialKind, type TrialUser } from '@/lib/site/trial-emails';
import { showcaseRecord } from '@/lib/site/showcase';
import { launchOffer } from '@/lib/site/offer';
import { PLAN_PRICES } from '@/lib/site/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials yok');
  // cache: 'no-store' — bkz. world-cup-campaign (2026-07-10 mükerrer gönderim vakası)
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const kind = (sp.get('kind') === 'ending' ? 'ending' : 'mid') as TrialKind;
  const dry = sp.get('dry') === '1';
  const canary = sp.get('canary') === '1';
  const limitParam = parseInt(sp.get('limit') || '', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 200;
  const key = TRIAL_CAMPAIGN_KEYS[kind];
  const sb = db();

  // Okumalar güvenlik kapısı: hata → iptal (unsubscribe/dedup boş sayılmasın)
  const [{ data: users, error: uErr }, { data: profs, error: pErr }, { data: unsub, error: unErr }, { data: sent, error: sErr }] = await Promise.all([
    sb.from('users').select('email, name, created_at'),
    sb.from('profiles').select('email, trial_ends_at, subscription_status'),
    sb.from('email_unsubscribes').select('email'),
    sb.from('email_campaign_log').select('email').eq('campaign_key', key),
  ]);
  const err = uErr || pErr || unErr || sErr;
  if (err) return NextResponse.json({ ok: false, aborted: true, error: err.message }, { status: 500 });

  const prof = new Map<string, { trial_ends_at: string | null; subscription_status: string | null }>();
  for (const p of (profs || []) as any[]) if (p.email) prof.set(String(p.email).toLowerCase().trim(), p);
  const list: TrialUser[] = ((users || []) as any[]).map((u) => {
    const e = String(u.email || '').toLowerCase().trim(); const p = prof.get(e);
    return { email: e, name: u.name || null, createdAt: u.created_at, trialEndsAt: p?.trial_ends_at ?? null, subscriptionStatus: p?.subscription_status ?? null };
  });
  const admins = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));
  let recipients = selectTrialRecipients(list, kind, {
    unsubscribed: new Set(((unsub || []) as any[]).map((r) => String(r.email).toLowerCase())),
    alreadySent: new Set(((sent || []) as any[]).map((r) => String(r.email).toLowerCase())),
    exclude: admins,
  });
  if (canary) recipients = [{ email: ADMIN_EMAILS[0].toLowerCase(), name: null, daysLeft: kind === 'mid' ? 5 : 1, trialEndsAt: new Date(Date.now() + 86_400_000).toISOString() }];
  const total = recipients.length;
  recipients = recipients.slice(0, limit);

  const rec = await showcaseRecord(7).catch(() => null);
  const stats = rec && rec.n >= 10 ? { n: rec.n, won: rec.won } : null;
  const offer = launchOffer();
  const common = { stats, predictionsUrl: `${SITE_URL}/predictions`, pricingUrl: `${SITE_URL}/pricing`, offer: offer ? { price: offer.price, until: offer.until } : null, fullPrice: PLAN_PRICES.monthly.amount };

  if (dry) return NextResponse.json({ ok: true, dry: true, kind, key, total, stats, offer, recipients: recipients.map((r) => ({ email: r.email, daysLeft: r.daysLeft })) });

  let ok = 0, failed = 0;
  for (const r of recipients) {
    const opts = { ...common, name: r.name, daysLeft: r.daysLeft, unsubscribeUrl: unsubscribeUrl(r.email) };
    try {
      if (kind === 'mid') await sendTrialMidEmail(r.email, opts); else await sendTrialEndingEmail(r.email, opts);
      ok++;
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: key, email: r.email, status: 'sent' }, { onConflict: 'campaign_key,email' });
    } catch (e: any) {
      failed++;
      console.error(`[trial-emails] ${kind} ${r.email}:`, e?.message);
      if (!canary) await sb.from('email_campaign_log').upsert({ campaign_key: key, email: r.email, status: 'failed', error: String(e?.message || e).slice(0, 300) }, { onConflict: 'campaign_key,email' });
    }
    await sleep(150); // Resend hız sınırı
  }
  return NextResponse.json({ ok: failed === 0, kind, key, total, sent: ok, failed, canary, stats, offer: !!offer });
}
