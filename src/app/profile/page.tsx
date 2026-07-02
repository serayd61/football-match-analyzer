'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Spinner } from '@/components/ui';

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
      free: 'Ücretsiz Üye',
      freeDetail: 'Her gün 3 ücretsiz analiz',
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
      free: 'Free Member',
      freeDetail: '3 free analyses every day',
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
      free: 'Kostenloses Mitglied',
      freeDetail: 'Jeden Tag 3 kostenlose Analysen',
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
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="grid place-items-center py-32"><Spinner size={28} className="text-brand-400" /></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <div className="p-4">
      <div className="max-w-2xl mx-auto pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="text-content-subtle hover:text-content transition-colors flex items-center gap-2 text-sm">
            <ArrowLeft size={16} />
            {l.backToDashboard}
          </Link>
        </div>

        {/* Profile Card */}
        <motion.div
          className="fa-card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="p-6 bg-surface-1/60 border-b border-line">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-sky-500 text-white text-3xl font-bold">
                {session.user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-content tracking-tight">{session.user?.name}</h1>
                <p className="text-content-muted">{session.user?.email}</p>
                <div className="mt-2">
                  {profile?.isPro ? (
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">⭐ {l.pro}</span>
                  ) : profile?.isTrial ? (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">⏳ {l.trial} - {profile.trialDaysLeft} {l.daysLeft}</span>
                  ) : (
                    /* Free = geçerli, kalıcı plan — eski "Süresi Dolmuş" kırmızısı
                       yanlış mesajdı (free artık her gün 3 analiz hakkı demek). */
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-brand-500/15 text-brand-300 border border-brand-500/30">{l.free} · {l.freeDetail}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-6 space-y-3">
            {/* Membership */}
            <div className="flex items-center justify-between p-4 bg-surface-2 border border-line rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg grid place-items-center bg-amber-500/10 border border-amber-500/20"><span className="text-xl">👑</span></div>
                <div>
                  <div className="text-sm text-content-muted">{l.membership}</div>
                  <div className="font-medium text-content">{profile?.isPro ? l.pro : profile?.isTrial ? l.trial : l.free}</div>
                </div>
              </div>
              {profile?.isPro && profile?.subscriptionEnd && (
                <div className="text-right">
                  <div className="text-xs text-content-subtle">{l.validUntil}</div>
                  <div className="text-sm text-positive">{new Date(profile.subscriptionEnd).toLocaleDateString()}</div>
                </div>
              )}
            </div>

            {/* Analyses Today */}
            <div className="flex items-center justify-between p-4 bg-surface-2 border border-line rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg grid place-items-center bg-brand-500/10 border border-brand-500/20"><span className="text-xl">📊</span></div>
                <div>
                  <div className="text-sm text-content-muted">{l.analysesToday}</div>
                  <div className="font-medium text-content">{profile?.isPro ? l.unlimited : `${profile?.analysesUsed || 0}/${profile?.analysesLimit || 3}`}</div>
                </div>
              </div>
              {!profile?.isPro && (
                <div className="w-24 h-2 bg-surface-4 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${((profile?.analysesUsed || 0) / (profile?.analysesLimit || 3)) * 100}%` }} />
                </div>
              )}
            </div>

            {/* AI Agents */}
            <div className="flex items-center justify-between p-4 bg-surface-2 border border-line rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg grid place-items-center bg-sky-500/10 border border-sky-500/20"><span className="text-xl">🧠</span></div>
                <div>
                  <div className="text-sm text-content-muted">{l.aiAgents}</div>
                  <div className="font-medium text-content">
                    {profile?.canUseAgents ? <span className="text-positive">✓ {l.available}</span> : <span className="text-content-subtle">🔒 {l.notAvailable}</span>}
                  </div>
                </div>
              </div>
              {!profile?.canUseAgents && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">PRO</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-line space-y-3">
            {!profile?.isPro && (
              <Link href="/pricing" className="fa-btn fa-btn-primary fa-btn-lg w-full">⭐ {l.upgrade}</Link>
            )}

            <Link href="/settings" className="fa-btn fa-btn-secondary fa-btn-lg w-full">
              ⚙️ {lang === 'tr' ? 'Ayarlar' : lang === 'de' ? 'Einstellungen' : 'Settings'}
            </Link>

            {profile?.isPro && profile?.subscriptionId && (
              <button onClick={handleManageSubscription} disabled={openingPortal} className="fa-btn fa-btn-secondary fa-btn-lg w-full">
                {openingPortal ? l.openingPortal : `💳 ${l.manageSubscription}`}
              </button>
            )}

            <button onClick={() => signOut({ callbackUrl: '/login' })} className="fa-btn fa-btn-ghost fa-btn-lg w-full text-negative">
              {l.logout}
            </button>
          </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
