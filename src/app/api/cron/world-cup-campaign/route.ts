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
import { sendWorldCupCampaignEmail, sendReengagementEmail, sendWelcomeEmail, sendOfferEmail, SITE_URL } from '@/lib/email';
import { WORLD_CUP_CAMPAIGN_KEY, WORLD_CUP_RELAUNCH_KEY, REENGAGE_CAMPAIGN_KEY, WELCOME_CAMPAIGN_KEY, OFFER_CAMPAIGN_KEY, unsubscribeUrl } from '@/lib/campaign';
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
  // Kampanya tipi: type=reengage → İngilizce geri-kazanım (abone olmayanlara).
  // Aksi halde Dünya Kupası kampanyası. Warm-up: relaunch=1 (taze key) + limit.
  const isReengage = searchParams.get('type') === 'reengage';
  // Hoşgeldin: yeni ücretsiz kayıtlılara "3 free analiz hazır". Varsayılan
  // pencere son 1 gün (bugünküler); ?days=N ile genişletilir.
  const isWelcome = searchParams.get('type') === 'welcome';
  // Teklif: haftalık $6.99 lansmanı — kayıtlı ama abone olmayanlara, son 7
  // günün gerçek motor karnesiyle (gönderim anında hesaplanır).
  const isOffer = searchParams.get('type') === 'offer';
  const relaunch = searchParams.get('relaunch') === '1';
  const activeKey = isOffer
    ? OFFER_CAMPAIGN_KEY
    : isWelcome
      ? WELCOME_CAMPAIGN_KEY
      : isReengage
        ? REENGAGE_CAMPAIGN_KEY
        : relaunch
          ? WORLD_CUP_RELAUNCH_KEY
          : WORLD_CUP_CAMPAIGN_KEY;
  const campaignType = isOffer ? 'offer' : isWelcome ? 'welcome' : isReengage ? 'reengage' : 'worldcup';
  const limitParam = parseInt(searchParams.get('limit') || '', 10);
  const batchLimit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : Infinity;
  const daysParam = parseInt(searchParams.get('days') || '', 10);
  const welcomeDays = isWelcome ? (Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 1) : null;
  const welcomeCutoffMs = welcomeDays ? Date.now() - welcomeDays * 86_400_000 : 0;
  const canaryEmail = process.env.CAMPAIGN_CANARY_EMAIL || ADMIN_EMAILS[0];

  // Doğru şablonu seçen tek gönderim fonksiyonu (canary + toplu aynı maili kullanır).
  const trackUrl = `${SITE_URL}/track-record`;
  const dashboardUrl = `${SITE_URL}/dashboard`;
  const pricingUrl = `${SITE_URL}/pricing`;

  const supabase = getSupabase();

  // Teklif maili için kanıt: son 7 günün settle edilmiş yüksek-güven motor
  // karnesi. <10 örnek varsa rakam bloğu gösterilmez (bayat/zayıf kanıt yok).
  let offerStats: { total: number; correct: number; accuracy: number } | null = null;
  if (isOffer) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: predRows } = await supabase
      .from('engine_predictions')
      .select('correct')
      .eq('settled', true)
      .not('result', 'is', null)
      .gte('confidence', 0.58)
      .gte('kickoff', since);
    const preds = (predRows || []) as any[];
    const total = preds.length;
    const correct = preds.filter((p) => p.correct === true).length;
    if (total >= 10) {
      offerStats = { total, correct, accuracy: Math.round((1000 * correct) / total) / 10 };
    }
  }

  const sendEmail = (email: string, name: string | null) =>
    isOffer
      ? sendOfferEmail(email, { pricingUrl, dashboardUrl, unsubscribeUrl: unsubscribeUrl(email), name, stats: offerStats })
      : isWelcome
        ? sendWelcomeEmail(email, { ctaUrl: dashboardUrl, pricingUrl, unsubscribeUrl: unsubscribeUrl(email), name })
        : isReengage
          ? sendReengagementEmail(email, { ctaUrl: CTA_URL, unsubscribeUrl: unsubscribeUrl(email), trackUrl, name })
          : sendWorldCupCampaignEmail(email, { ctaUrl: CTA_URL, unsubscribeUrl: unsubscribeUrl(email), name });

  // 1.5) PROBE: seçili tipteki maili yalnızca canary/admin adresine gönder (test).
  //      Toplu gönderim YOK, log YOK. "nereye düşüyor" testi için.
  if (searchParams.get('probe') === '1') {
    const probeTo = (searchParams.get('to') || canaryEmail || '').toLowerCase().trim();
    if (!EMAIL_RE.test(probeTo)) {
      return NextResponse.json({ success: false, probe: true, error: 'invalid probe address' }, { status: 400 });
    }
    try {
      await sendEmail(probeTo, null);
      return NextResponse.json({ success: true, probe: true, type: campaignType, sentTo: probeTo });
    } catch (e: any) {
      return NextResponse.json({ success: false, probe: true, error: e?.message || String(e) }, { status: 500 });
    }
  }

  // 2) CANARY (kuru çalışmada atlanır). Reengage günlük cron olduğu için
  //    canary atlanır (her gün admin'e tekrar mail gitmesin); domain doğrulandı.
  //    İlk doğrulama elle canary ile yapılır. nocanary=1 ile de atlanabilir.
  const skipCanary = isReengage || isWelcome || searchParams.get('nocanary') === '1';
  if (!dryRun && !skipCanary) {
    try {
      await sendEmail(canaryEmail, null);
      console.log(`✅ Canary gönderildi (${activeKey}): ${canaryEmail}`);
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
    .select('email, name, created_at');
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

  // Re-engagement & Welcome & Offer: yalnızca ABONE OLMAYANLARA. Aktif/trial/past_due hariç.
  const subscriberSet = new Set<string>();
  if (isReengage || isWelcome || isOffer) {
    const { data: profs } = await supabase.from('profiles').select('email, subscription_status');
    for (const p of profs || []) {
      const st = (p.subscription_status || '').toLowerCase();
      if (['active', 'trialing', 'trial', 'past_due'].includes(st) && p.email) {
        subscriberSet.add(p.email.toLowerCase().trim());
      }
    }
  }

  // Benzersiz, geçerli, hariç-tutulmamış alıcılar (canary + aboneler hariç)
  const seen = new Set<string>();
  let recipients: { email: string; name: string | null }[] = [];
  for (const u of usersData || []) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    if (seen.has(email) || unsub.has(email) || alreadySent.has(email) || email === canaryLower) continue;
    if (subscriberSet.has(email)) continue;
    // Welcome: yalnızca son N gün içinde kayıt olanlar (varsayılan bugün)
    if (isWelcome && (!u.created_at || new Date(u.created_at).getTime() < welcomeCutoffMs)) continue;
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
      type: campaignType,
      relaunch,
      welcomeDays,
      batchLimit: batchLimit === Infinity ? null : batchLimit,
      offerStats: isOffer ? offerStats : undefined,
      remainingEligible: remaining,
      wouldSendThisRun: recipients.length,
      excluded: { unsubscribed: unsub.size, alreadySent: alreadySent.size, subscribers: subscriberSet.size },
      sample: recipients.slice(0, 5).map((r) => r.email),
    });
  }

  // 4) Toplu gönderim (rate-limit için araya ~0.6s)
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      await sendEmail(r.email, r.name);
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
    type: campaignType,
    relaunch,
    canary: canaryEmail,
    sentThisRun: sent,
    failed,
    remainingAfterRun: Math.max(0, remaining - sent),
    batchLimit: batchLimit === Infinity ? null : batchLimit,
    excluded: { unsubscribed: unsub.size, alreadySent: alreadySent.size, subscribers: subscriberSet.size },
    elapsedSeconds: elapsed,
  });
}
