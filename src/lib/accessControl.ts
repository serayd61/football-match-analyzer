import { supabaseAdmin } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';

function getSupabase(): SupabaseClient {
  return supabaseAdmin;
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

  // Profil yoksa oluştur (7 gün trial)
  if (!profile) {
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);

    const { data: newProfile } = await db
      .from('profiles')
      .insert({
        email,
        subscription_status: 'trial',
        trial_start_date: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
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

  // Free tier kontrolü - ARTIK ANALİZ YAPAMAZ (SADECE PRO)
  const isFree = profile.subscription_status === 'free' || !profile.subscription_status;
  
  if (isFree) {
    return {
      hasAccess: false,
      isPro: false,
      isTrial: false,
      trialDaysLeft: 0,
      trialExpired: false,
      analysesUsed: 0,
      analysesLimit: 0,
      canAnalyze: false, // FREE TIER: Analiz yapamaz, sadece PRO
      canUseAgents: false,
      message: 'Maç analizi için Pro abonelik gereklidir',
      redirectTo: '/pricing',
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

  // Trial aktif (eski kullanıcılar için) - ARTIK ANALİZ YAPAMAZ (SADECE PRO)
  if (isTrial) {
    return {
      hasAccess: false,
      isPro: false,
      isTrial: true,
      trialDaysLeft,
      trialExpired: false,
      analysesUsed: 0,
      analysesLimit: 0,
      canAnalyze: false, // TRIAL: Analiz yapamaz, sadece PRO
      canUseAgents: false,
      message: 'Maç analizi için Pro abonelik gereklidir',
      redirectTo: '/pricing',
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
