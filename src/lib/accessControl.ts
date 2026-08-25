import { supabaseAdmin } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { isAdminEmail } from './admin/emails';

function getSupabase(): SupabaseClient {
  return supabaseAdmin;
}

// ============================================================================
// ABONELİK CANLI MI? — süre kontrolü
// ----------------------------------------------------------------------------
// Bug (2026-08-25'te bulundu): erişim yalnızca status='active' bakıyordu, bitiş
// tarihine HİÇ bakmıyordu. İki hesap Stripe aboneliği olmadan, dönemleri 28
// Haziran'da bitmişken 2 aydır ücretsiz Pro kullanıyordu.
//
// Kural:
//   • Stripe aboneliği OLAN satır: tarih yoksa canlı sayılır (Stripe kaynaktır),
//     tarih varsa geçmiş olmamalı. → webhook gecikirse ödeyen müşteri kilitlenmez.
//   • Stripe aboneliği OLMAYAN (manuel/legacy) kayıt: GELECEK bitiş tarihi ZORUNLU.
//     Açık uçlu manuel 'active' artık süresiz erişim vermez.
// GRACE: webhook birkaç saat/gün gecikirse gerçek müşteri düşmesin.
// ============================================================================
const GRACE_DAYS = 3;
const LIVE_STATUSES = ['active', 'trialing', 'pro', 'premium'];

export function isGrantLive(
  status?: string | null,
  endsAt?: string | null,
  hasStripeSub = false,
): boolean {
  if (!LIVE_STATUSES.includes(String(status || '').toLowerCase())) return false;
  if (!endsAt) return hasStripeSub; // tarih yok: yalnızca gerçek Stripe aboneliği geçer
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return hasStripeSub;
  return end > Date.now() - GRACE_DAYS * 86_400_000;
}

/**
 * Motor tahminleri (engine_predictions) erişim kontrolü — salt okuma, yan etkisiz.
 * Erişim verilir eğer: admin VEYA Stripe aboneliği aktif/trial VEYA profiles
 * subscription_status aktif/trial. İki kaynağı da kontrol ederek gerçek aboneyi
 * yanlışlıkla engellememeyi garanti ederiz (profiles<->Stripe senkronu eksik olsa bile).
 */
export async function hasEnginePredictionAccess(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;

  const db = getSupabase();

  // 1) profiles tabanlı (eski/manuel)
  try {
    const { data: profile } = await db
      .from('profiles')
      .select('subscription_status, subscription_end')
      .ilike('email', email)
      .maybeSingle();
    // NOT: 'trial'/'trialing' profiles değeri ARTIK erişim VERMEZ — kart-zorunlu
    // kuralı gereği gerçek trial'lar Stripe webhook'uyla profiles='active' olur.
    // Ayrıca artık BİTİŞ TARİHİ zorunlu: açık uçlu manuel 'active' kayıtlar
    // (subscription_end NULL) tek başına erişim vermez — gerçek abone aşağıdaki
    // Stripe dalından zaten geçer.
    if (isGrantLive(profile?.subscription_status, profile?.subscription_end, false)) return true;
  } catch (e) {
    console.error('[access] profiles check failed', e);
  }

  // 2) Stripe subscriptions tablosu (gerçek ödeme kaynağı)
  try {
    const { data: user } = await db
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (user?.id) {
      const { data: sub } = await db
        .from('subscriptions')
        .select('status, current_period_end, stripe_subscription_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      if (isGrantLive(sub?.status, sub?.current_period_end, !!sub?.stripe_subscription_id)) {
        return true;
      }
    }
  } catch (e) {
    console.error('[access] subscriptions check failed', e);
  }

  return false;
}
export interface AccessStatus {
  hasAccess: boolean;
  isPro: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  trialExpired: boolean;
  analysesUsed: number;
  analysesLimit: number;
  canAnalyze: boolean;
  canUseAgents: boolean;
  message?: string;
  redirectTo?: string;
}
export async function checkUserAccess(email: string, ip?: string): Promise<AccessStatus> {
  const db = getSupabase();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  console.log('🔍 checkUserAccess called for:', email);

  // Kullanıcı profilini çek
  let { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  console.log('📊 Profile query result:', JSON.stringify({ profile, error }));
  console.log('📊 subscription_status:', profile?.subscription_status);

  // Profil yoksa oluştur — KART-ZORUNLU: kartsız trial VERME, 'free' başlat.
  // 7 gün ücretsiz deneme yalnızca Stripe Checkout'tan (kart girilerek) başlar.
  if (!profile) {
    const { data: newProfile } = await db
      .from('profiles')
      .insert({
        email,
        subscription_status: 'free',
        analyses_today: 0,
      })
      .select()
      .single();

    profile = newProfile;
  }

  if (!profile) {
    return {
      hasAccess: false,
      isPro: false,
      isTrial: false,
      trialDaysLeft: 0,
      trialExpired: false,
      analysesUsed: 0,
      analysesLimit: 0,
      canAnalyze: false,
      canUseAgents: false,
      message: 'Profile error',
      redirectTo: '/login',
    };
  }

  // IP takibi
  if (ip && ip !== 'unknown') {
    await db
      .from('profiles')
      .update({ ip_address: ip, last_ip_update: now.toISOString() })
      .eq('email', email);

    // IP tracking
    const { data: existingIp } = await db
      .from('ip_tracking')
      .select('*')
      .eq('ip_address', ip)
      .single();

    if (existingIp) {
      await db
        .from('ip_tracking')
        .update({
          last_seen: now.toISOString(),
          visit_count: existingIp.visit_count + 1,
          email: email,
        })
        .eq('ip_address', ip);

      // Blocked IP kontrolü
      if (existingIp.is_blocked) {
        return {
          hasAccess: false,
          isPro: false,
          isTrial: false,
          trialDaysLeft: 0,
          trialExpired: true,
          analysesUsed: 0,
          analysesLimit: 0,
          canAnalyze: false,
          canUseAgents: false,
          message: 'Access blocked',
          redirectTo: '/pricing',
        };
      }
    } else {
      await db
        .from('ip_tracking')
        .insert({ ip_address: ip, email });
    }
  }

  // Pro kontrolü — SÜRE DAHİL. profiles tek başına yetmez: açık uçlu manuel
  // 'active' kayıtlar (subscription_end NULL, Stripe aboneliği yok) 2 aydır
  // bedava Pro veriyordu. Gerçek abone hasEnginePredictionAccess'in Stripe
  // dalından geçer, dolayısıyla ödeyen müşteri etkilenmez.
  const isPro =
    isGrantLive(profile.subscription_status, profile.subscription_end, false) ||
    (await hasEnginePredictionAccess(email));

  if (isPro) {
    return {
      hasAccess: true,
      isPro: true,
      isTrial: false,
      trialDaysLeft: 0,
      trialExpired: false,
      analysesUsed: profile.analyses_today || 0,
      analysesLimit: 1000, // Premium: sınırsız
      canAnalyze: true,
      canUseAgents: true,
    };
  }

  // Free tier — kartsız kullanıcıya GÜNLÜK 3 AI maç analizi (dönüşüm kaldıracı:
  // kartsız tat → limit dolunca Pro'ya yönlendir). Sayaç /api/unified/analyze'da
  // incrementAnalysisCount ile artar (metreli). Motor tahminleri (engine_predictions)
  // ve AI Agent'lar yine Pro'ya özel: hasEnginePredictionAccess / canUseAgents=false
  // (agents route sayaç artırmadığı için free'ye AÇILMAZ — maliyet sızıntısı olmasın).
  // NOT: legacy kartsız 'trial'/'trialing' profiller de free sayılır — gerçek
  // (kartlı) trial'lar Stripe webhook'uyla profiles='active' olduğundan çakışmaz.
  // Eski davranış bu kullanıcıları 7 gün sonra TAMAMEN kilitliyordu; artık kalıcı
  // 3/gün hakları var (welcome e-postasındaki söz ile tutarlı).
  const status = String(profile.subscription_status || '').toLowerCase();
  const isFree = status === 'free' || status === 'trial' || status === 'trialing' || !status;

  if (isFree) {
    const analysesToday = profile.last_analysis_date === today ? (profile.analyses_today || 0) : 0;
    const FREE_DAILY_LIMIT = 3;
    const canAnalyze = analysesToday < FREE_DAILY_LIMIT;

    return {
      hasAccess: true,
      isPro: false,
      isTrial: false,
      trialDaysLeft: 0,
      trialExpired: false,
      analysesUsed: analysesToday,
      analysesLimit: FREE_DAILY_LIMIT,
      canAnalyze,
      canUseAgents: false, // AI Agent'lar Pro'ya özel (metrelenmemiş = maliyet)
      message: canAnalyze
        ? `Ücretsiz: bugün ${FREE_DAILY_LIMIT - analysesToday} analiz hakkınız kaldı`
        : 'Günlük 3 ücretsiz analiz hakkınız doldu. Sınırsız analiz için Pro\'ya geçin!',
      redirectTo: canAnalyze ? undefined : '/pricing',
    };
  }

  // Varsayılan - erişim yok (tanınmayan statü: cancelled/past_due vb.)
  return {
    hasAccess: false,
    isPro: false,
    isTrial: false,
    trialDaysLeft: 0,
    trialExpired: true,
    analysesUsed: 0,
    analysesLimit: 0,
    canAnalyze: false,
    canUseAgents: false,
    message: 'No subscription',
    redirectTo: '/pricing',
  };
}

export async function incrementAnalysisCount(email: string): Promise<void> {
  const db = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  const { data: profile } = await db
    .from('profiles')
    .select('analyses_today, last_analysis_date')
    .eq('email', email)
    .single();

  let newCount = 1;
  if (profile?.last_analysis_date === today) {
    newCount = (profile.analyses_today || 0) + 1;
  }

  await db
    .from('profiles')
    .update({ analyses_today: newCount, last_analysis_date: today })
    .eq('email', email);
}
