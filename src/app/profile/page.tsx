'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import Navigation from '@/components/Navigation';
import { FootballBall3D } from '@/components/Football3D';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          setProfile(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Error opening portal');
        setOpeningPortal(false);
      }
    } catch (error) {
      alert('Error opening portal');
      setOpeningPortal(false);
    }
  };

  const labels = {
    tr: {
      title: 'Profil',
      membership: 'Üyelik Durumu',
      pro: 'Pro Üye',
      trial: 'Deneme Süresi',
      expired: 'Süresi Dolmuş',
      daysLeft: 'gün kaldı',
      validUntil: 'Geçerlilik',
      email: 'E-posta',
      analysesToday: 'Bugünkü Analizler',
      aiAgents: 'AI Ajanları',
      available: 'Kullanılabilir',
      notAvailable: 'Pro Gerekli',
      upgrade: "Pro'ya Geç",
      logout: 'Çıkış Yap',
      backToDashboard: 'Dashboard\'a Dön',
      unlimited: 'Sınırsız',
      manageSubscription: 'Aboneliği Yönet',
      openingPortal: 'Açılıyor...',
    },
    en: {
      title: 'Profile',
      membership: 'Membership Status',
      pro: 'Pro Member',
      trial: 'Trial Period',
      expired: 'Expired',
      daysLeft: 'days left',
      validUntil: 'Valid Until',
      email: 'Email',
      analysesToday: 'Analyses Today',
      aiAgents: 'AI Agents',
      available: 'Available',
      notAvailable: 'Pro Required',
      upgrade: 'Upgrade to Pro',
      logout: 'Sign Out',
      backToDashboard: 'Back to Dashboard',
      unlimited: 'Unlimited',
      manageSubscription: 'Manage Subscription',
      openingPortal: 'Opening...',
    },
    de: {
      title: 'Profil',
      membership: 'Mitgliedschaftsstatus',
      pro: 'Pro-Mitglied',
      trial: 'Testversion',
      expired: 'Abgelaufen',
      daysLeft: 'Tage übrig',
      validUntil: 'Gültig bis',
      email: 'E-Mail',
      analysesToday: 'Analysen heute',
      aiAgents: 'KI-Agenten',
      available: 'Verfügbar',
      notAvailable: 'Pro erforderlich',
      upgrade: 'Pro werden',
      logout: 'Abmelden',
      backToDashboard: 'Zurück zum Dashboard',
      unlimited: 'Unbegrenzt',
      manageSubscription: 'Abonnement verwalten',
      openingPortal: 'Wird geöffnet...',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin neon-glow-cyan"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-black relative">
      <Navigation />
      
      {/* 3D Football Decorations */}
      <div className="fixed top-20 right-10 z-0 opacity-10 pointer-events-none">
        <FootballBall3D size={150} />
      </div>
      
      <div className="p-4 relative z-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {l.backToDashboard}
          </Link>
        </div>

        {/* Profile Card */}
        <motion.div 
          className="glass-futuristic border border-[#00f0ff]/30 rounded-3xl overflow-hidden neon-border-cyan"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border-b border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
                {session.user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{session.user?.name}</h1>
                <p className="text-gray-400">{session.user?.email}</p>
                <div className="mt-2">
                  {profile?.isPro ? (
                    <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-sm font-bold rounded-full">
                      ⭐ {l.pro}
                    </span>
                  ) : profile?.isTrial ? (
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-medium rounded-full">
                      ⏳ {l.trial} - {profile.trialDaysLeft} {l.daysLeft}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-medium rounded-full">
                      ❌ {l.expired}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-6 space-y-4">
            {/* Membership */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">👑</span>
                </div>
                <div>
                  <div className="text-sm text-gray-400">{l.membership}</div>
                  <div className="font-medium text-white">
                    {profile?.isPro ? l.pro : profile?.isTrial ? l.trial : l.expired}
                  </div>
                </div>
              </div>
              {profile?.isPro && profile?.subscriptionEnd && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">{l.validUntil}</div>
                  <div className="text-sm text-green-400">
                    {new Date(profile.subscriptionEnd).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

            {/* Analyses Today */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <div className="text-sm text-gray-400">{l.analysesToday}</div>
                  <div className="font-medium text-white">
                    {profile?.isPro ? l.unlimited : `${profile?.analysesUsed || 0}/${profile?.analysesLimit || 3}`}
                  </div>
                </div>
              </div>
              {!profile?.isPro && (
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${((profile?.analysesUsed || 0) / (profile?.analysesLimit || 3)) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>

            {/* AI Agents */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🧠</span>
                </div>
                <div>
                  <div className="text-sm text-gray-400">{l.aiAgents}</div>
                  <div className="font-medium text-white">
                    {profile?.canUseAgents ? (
                      <span className="text-green-400">✓ {l.available}</span>
                    ) : (
                      <span className="text-gray-500">🔒 {l.notAvailable}</span>
                    )}
                  </div>
                </div>
              </div>
              {!profile?.canUseAgents && (
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">PRO</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-gray-700 space-y-3">
            {!profile?.isPro && (
              <Link
                href="/pricing"
                className="block w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl text-center shadow-lg shadow-green-500/30 transition-all"
              >
                ⭐ {l.upgrade}
              </Link>
            )}
            
            {/* Ayarlar Butonu */}
            <Link
              href="/settings"
              className="block w-full py-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-medium rounded-xl text-center transition-colors"
            >
              ⚙️ {lang === 'tr' ? 'Ayarlar' : lang === 'de' ? 'Einstellungen' : 'Settings'}
            </Link>
            
            {/* Stripe Portal Butonu - Sadece Pro üyeler için */}
            {profile?.isPro && profile?.subscriptionId && (
              <button
                onClick={handleManageSubscription}
                disabled={openingPortal}
                className="block w-full py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium rounded-xl text-center transition-colors disabled:opacity-50"
              >
                {openingPortal ? l.openingPortal : `💳 ${l.manageSubscription}`}
              </button>
            )}
            
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="block w-full py-4 bg-gray-700 hover:bg-gray-600 text-red-400 font-medium rounded-xl text-center transition-colors"
            >
              {l.logout}
            </button>
          </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
