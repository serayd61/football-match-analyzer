import { supabaseAdmin } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { isAdminEmail } from './admin/emails';

function getSupabase(): SupabaseClient {
  return supabaseAdmin;
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
      .select('subscription_status')
      .ilike('email', email)
      .maybeSingle();
    const ps = String(profile?.subscription_status || '').toLowerCase();
    // NOT: 'trial'/'trialing' profiles değeri ARTIK erişim VERMEZ — kart-zorunlu
    // kuralı gereği gerçek trial'lar Stripe webhook'uyla profiles='active' olur.
    // Stale/kartsız 'trial' kayıtları (eski sızıntı) erişemesin.
    if (['active', 'pro', 'premium'].includes(ps)) return true;
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
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      if (sub) return true;
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

  // Pro kontrolü
  const isPro = profile.subscription_status === 'active';

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
  const isFree = profile.subscription_status === 'free' || !profile.subscription_status;

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

  // Eski trial sistemi (backward compatibility)
  const trialEnds = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrial = trialEnds && trialEnds > now;
  const trialExpired = trialEnds && trialEnds <= now;
  const trialDaysLeft = isTrial ? Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Trial bitti - ERİŞİM YOK
  if (trialExpired) {
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
      message: 'Trial expired',
      redirectTo: '/pricing',
    };
  }

  // Trial aktif - 3 analiz limiti
  if (isTrial) {
    const today = now.toISOString().split('T')[0];
    const analysesToday = profile.last_analysis_date === today ? (profile.analyses_today || 0) : 0;
    const TRIAL_DAILY_LIMIT = 3;
    const canAnalyze = analysesToday < TRIAL_DAILY_LIMIT;
    
    return {
      hasAccess: true,
      isPro: false,
      isTrial: true,
      trialDaysLeft,
      trialExpired: false,
      analysesUsed: analysesToday,
      analysesLimit: TRIAL_DAILY_LIMIT,
      canAnalyze, // Trial: Günlük 3 analiz limiti
      canUseAgents: canAnalyze, // Agent'lar da aynı limite tabi
      message: canAnalyze 
        ? `Trial: ${TRIAL_DAILY_LIMIT - analysesToday} analiz hakkınız kaldı` 
        : 'Günlük analiz limitinize ulaştınız. Pro\'ya yükseltin!',
      redirectTo: canAnalyze ? undefined : '/pricing',
    };
  }

  // Varsayılan - erişim yok
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
