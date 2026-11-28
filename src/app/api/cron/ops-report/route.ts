// ============================================================================
// CRON — ops raporu (2026-10-31): günde iki kez (07:00 / 19:00 UTC ≈ 08/20 Zürih kışın)
// site sahibine e-posta: son 12 saatte kayıt olanlar, denemesi bitenler, yaklaşanlar.
// Güvenlik: CRON_SECRET. ?dry=1 → JSON döner, mail atmaz. ?hours=N pencere.
// Alıcı: OPS_REPORT_EMAIL env, yoksa ADMIN_EMAILS[0].
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendOpsReportEmail } from '@/lib/email';
import { ADMIN_EMAILS } from '@/lib/admin/emails';
import { readFeedQuota, feedQuotaNotice } from '@/lib/data-sources/feed-quota';
import { buildOpsReport, opsReportHtml, opsReportSubject, opsReportText } from '@/lib/site/ops-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials yok');
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const dry = sp.get('dry') === '1';
  const hoursParam = parseFloat(sp.get('hours') || '');
  const windowMs = (Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 12) * 3600_000;
  const to = (process.env.OPS_REPORT_EMAIL || ADMIN_EMAILS[0] || '').toLowerCase().trim();
  if (!to) return NextResponse.json({ ok: false, error: 'alıcı yok' }, { status: 500 });

  const sb = db();
  const [{ data: users, error: uErr }, { data: profs, error: pErr }, { data: subs, error: sErr }] = await Promise.all([
    sb.from('users').select('id, email, name, created_at, password_hash'),
    sb.from('profiles').select('email, trial_ends_at, subscription_status, subscription_end, last_seen_at, first_match_view_at'),
    sb.from('subscriptions').select('user_id, status, current_period_end, stripe_subscription_id').in('status', ['active', 'trialing']),
  ]);
  const err = uErr || pErr || sErr;
  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

  const report = buildOpsReport({
    users: (users ?? []).map((u: any) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.created_at, passwordHash: u.password_hash })),
    profiles: (profs ?? []).map((p: any) => ({ email: p.email, trialEndsAt: p.trial_ends_at, subscriptionStatus: p.subscription_status, subscriptionEnd: p.subscription_end, lastSeenAt: p.last_seen_at, firstMatchViewAt: p.first_match_view_at })),
    subs: (subs ?? []).map((s: any) => ({ userId: s.user_id, status: s.status, currentPeriodEnd: s.current_period_end, stripeSubscriptionId: s.stripe_subscription_id })),
  }, { windowMs });

  // Maç akışı kotası %70'i geçtiyse rapor başına uyarı (2026-11-28: kota sessizce bitmişti).
  const quota = feedQuotaNotice(await readFeedQuota(), Date.now());
  const subject = (quota ? (quota.level === 'warn' ? '[Kota] ' : '[KOTA ALARMI] ') : '') + opsReportSubject(report);
  const text = (quota ? `${quota.text}\n\n` : '') + opsReportText(report);
  const html = (quota ? `<p style="margin:0 0 16px;padding:12px;border:2px solid #b91c1c;font:600 14px sans-serif;color:#b91c1c">${quota.text}</p>` : '') + opsReportHtml(report);
  if (dry) return NextResponse.json({ ok: true, dry: true, to, subject, quota, report, text });
  try {
    await sendOpsReportEmail(to, { subject, html, text });
  } catch (e: any) {
    console.error('[ops-report] send failed', e?.message);
    return NextResponse.json({ ok: false, error: e?.message || 'send failed', subject }, { status: 500 });
  }
  return NextResponse.json({ ok: true, to, subject, counts: { newSignups: report.newSignups.length, trialEnded: report.trialEnded.length, trialEndingSoon: report.trialEndingSoon.length }, totals: report.totals });
}
