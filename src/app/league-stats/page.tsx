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
import { useLanguage } from '@/components/LanguageProvider';
import EnginePredictions from '@/components/EnginePredictions';

const T = {
  tr: { title: 'Lig Tahminleri', sub: 'Yaklaşan maçlar lige göre — Dixon-Coles motoru', back: 'Dashboard',
    disclaimer: 'Bilgilendirme amaçlıdır, bahis tavsiyesi değildir.' },
  en: { title: 'League Predictions', sub: 'Upcoming matches by league — Dixon-Coles engine', back: 'Dashboard',
    disclaimer: 'For information only, not betting advice.' },
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-body)' }}>
      <header className="border-b border-cyan-400/20 bg-black/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-300 font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            <BarChart3 size={20} /> {t.title}
          </div>
          <Link href="/dashboard"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white flex items-center gap-1.5">
            <ArrowLeft size={13} /> {t.back}
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-white/50 text-sm mb-6">{t.sub}</motion.p>

        <EnginePredictions lang={lang} groupByLeague showStats showControls={false} />

        <p className="text-center text-xs text-white/30 mt-10">{t.disclaimer}</p>
      </div>
    </div>
  );
}
