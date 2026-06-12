// ============================================================================
// CAMPAIGN RUNNER — Dünya Kupası 2026 lansman e-postası
// Kayıtlı tüm üyelere (public.users) tek seferlik duyuru.
//
// Güvenlik kademeleri:
//  1) CRON_SECRET (Bearer) zorunlu.
//  2) CANARY: önce admin'e tek mail — gönderen alan adı doğrulanmamışsa
//     (Resend sandbox) burada patlar → 127 kişiye GÖNDERİLMEZ.
//  3) Mükerrer engeli: email_campaign_log (campaign_key, email) UNIQUE.
//  4) Unsubscribe hariç: email_unsubscribes atlanır.
//  5) ?dry=1 → kuru çalışma (kaç kişi, kime — gönderim yok).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendWorldCupCampaignEmail, SITE_URL } from '@/lib/email';
import { WORLD_CUP_CAMPAIGN_KEY, WORLD_CUP_RELAUNCH_KEY, unsubscribeUrl } from '@/lib/campaign';
import { ADMIN_EMAILS } from '@/lib/admin/emails';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase credentials yok');
    sb = createClient(url, key);
  }
  return sb;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CTA_URL = SITE_URL; // yenilenen anasayfa (trial CTA'lı)

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // 1) Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry') === '1';
  // Warm-up modu: ayrı log anahtarı (taze gönderim) + günlük parti limiti.
  const relaunch = searchParams.get('relaunch') === '1';
  const activeKey = relaunch ? WORLD_CUP_RELAUNCH_KEY : WORLD_CUP_CAMPAIGN_KEY;
  const limitParam = parseInt(searchParams.get('limit') || '', 10);
  const batchLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : Infinity;
  const canaryEmail = process.env.CAMPAIGN_CANARY_EMAIL || ADMIN_EMAILS[0];

  const supabase = getSupabase();

  // 2) CANARY (kuru çalışmada atlanır)
  if (!dryRun) {
    try {
      await sendWorldCupCampaignEmail(canaryEmail, {
        ctaUrl: CTA_URL,
        unsubscribeUrl: unsubscribeUrl(canaryEmail),
        name: null,
      });
      console.log(`✅ Canary gönderildi: ${canaryEmail}`);
    } catch (e: any) {
      console.error('❌ Canary başarısız — toplu gönderim İPTAL:', e?.message);
      return NextResponse.json(
        {
          success: false,
          aborted: true,
          reason: 'canary_failed',
          error: e?.message || String(e),
          hint: 'EMAIL_FROM doğrulanmış bir alan adı mı? Resend sandbox sadece hesap sahibine gönderir.',
        },
        { status: 500 }
      );
    }
  }

  // 3) Alıcıları topla: kayıtlı üyeler − unsubscribe − zaten gönderilmiş
  const { data: usersData, error: usersErr } = await supabase
    .from('users')
    .select('email, name');
  if (usersErr) {
    return NextResponse.json({ success: false, error: usersErr.message }, { status: 500 });
  }

  const { data: unsubData } = await supabase.from('email_unsubscribes').select('email');
  const unsub = new Set((unsubData || []).map((r: any) => r.email.toLowerCase()));

  const { data: sentData } = await supabase
    .from('email_campaign_log')
    .select('email')
    .eq('campaign_key', activeKey);
  const alreadySent = new Set((sentData || []).map((r: any) => r.email.toLowerCase()));
  const canaryLower = (canaryEmail || '').toLowerCase().trim();

  // Benzersiz, geçerli, hariç-tutulmamış alıcılar (canary'yi de hariç tut)
  const seen = new Set<string>();
  let recipients: { email: string; name: string | null }[] = [];
  for (const u of usersData || []) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    if (seen.has(email) || unsub.has(email) || alreadySent.has(email) || email === canaryLower) continue;
    seen.add(email);
    recipients.push({ email, name: u.name || null });
  }

  // Warm-up için: admin adreslerini öne al (izleme kolaylığı), sonra parti limiti uygula.
  const adminSet = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));
  recipients.sort((a, b) => (adminSet.has(b.email) ? 1 : 0) - (adminSet.has(a.email) ? 1 : 0));
  const remaining = recipients.length;
  if (batchLimit !== Infinity) recipients = recipients.slice(0, batchLimit);

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      campaign: activeKey,
      relaunch,
      batchLimit: batchLimit === Infinity ? null : batchLimit,
      remainingEligible: remaining,
      wouldSendThisRun: recipients.length,
      excluded: { unsubscribed: unsub.size, alreadySent: alreadySent.size },
      sample: recipients.slice(0, 5).map((r) => r.email),
    });
  }

  // 4) Toplu gönderim (rate-limit için araya ~0.6s)
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      await sendWorldCupCampaignEmail(r.email, {
        ctaUrl: CTA_URL,
        unsubscribeUrl: unsubscribeUrl(r.email),
        name: r.name,
      });
      await supabase
        .from('email_campaign_log')
        .upsert(
          { campaign_key: activeKey, email: r.email, status: 'sent' },
          { onConflict: 'campaign_key,email' }
        );
      sent++;
    } catch (e: any) {
      failed++;
      await supabase
        .from('email_campaign_log')
        .upsert(
          { campaign_key: activeKey, email: r.email, status: 'failed', error: (e?.message || '').slice(0, 300) },
          { onConflict: 'campaign_key,email' }
        );
      console.warn(`⚠️ Gönderilemedi ${r.email}: ${e?.message}`);
    }
    await sleep(600);
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`🏁 Kampanya bitti: ${sent} gönderildi, ${failed} başarısız (${elapsed}s)`);

  return NextResponse.json({
    success: true,
    campaign: activeKey,
    relaunch,
    canary: canaryEmail,
    sentThisRun: sent,
    failed,
    remainingAfterRun: Math.max(0, remaining - sent),
    batchLimit: batchLimit === Infinity ? null : batchLimit,
    excluded: { unsubscribed: unsub.size, alreadySent: alreadySent.size },
    elapsedSeconds: elapsed,
  });
}
