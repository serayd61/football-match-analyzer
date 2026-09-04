'use client';

// ============================================================================
// LEAGUE STATS / LIG TAHMİNLERİ
// Yeni motor tahminlerini lige göre gruplu gösterir (Tahminler sayfasıyla uyumlu).
// Auth gating KORUNDU: giriş yoksa /login'e yönlenir.
// ============================================================================

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useLanguage } from '@/components/LanguageProvider';
import EnginePredictions from '@/components/EnginePredictions';
import { Spinner } from '@/components/ui';

const T = {
  tr: { title: 'Lig Tahminleri', sub: 'Yaklaşan maçlar lige göre — Dixon-Coles motoru', back: 'Dashboard',
    disclaimer: 'Bilgilendirme amaçlıdır, bahis tavsiyesi değildir.' },
  en: { title: 'League Predictions', sub: 'Upcoming matches by league — Dixon-Coles engine', back: 'Dashboard',
    disclaimer: 'For information only, not betting advice.' },
  de: { title: 'Liga-Vorhersagen', sub: 'Kommende Spiele nach Liga — Dixon-Coles-Engine', back: 'Dashboard',
    disclaimer: 'Nur zur Information, keine Wettberatung.' },
};

export default function LeagueStatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (T as any)[lang] || T.en;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="fa-shell min-h-screen flex items-center justify-center">
        <Spinner size={48} className="text-brand-400" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-20">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-content font-semibold tracking-tight">
            <BarChart3 size={20} className="text-brand-400" /> {t.title}
          </div>
          <Link href="/dashboard"
            className="text-xs px-3 py-1.5 rounded-lg border border-line text-content-muted hover:text-content flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={13} /> {t.back}
          </Link>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-content-muted text-sm mb-6">{t.sub}</motion.p>

        <EnginePredictions lang={lang} groupByLeague showStats showControls={false} />

        <p className="text-center text-xs text-content-subtle mt-10">{t.disclaimer}</p>
      </div>
    </div>
  );
}
