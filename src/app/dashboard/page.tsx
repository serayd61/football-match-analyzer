'use client';

// ============================================================================
// DASHBOARD — rebuilt with the modern design system (`.fa-shell`).
// User-facing behaviour preserved: auth guard, Stripe payment tracking,
// Engine Predictions / Match Intelligence / Engine Performance widgets,
// AI chatbot. The legacy hidden multi-model "Analyze" flow was removed
// (recoverable from git history) — Match Intelligence is the live flow.
// ============================================================================

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Target, Brain, TrendingUp, ArrowRight, Sparkles, RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { translations } from '@/lib/translations';
import { track } from '@/lib/analytics';
import { SectionHeader, Button, Badge, Spinner } from '@/components/ui';
import DashboardTopBar from '@/components/dashboard/DashboardTopBar';
import EnginePredictions from '@/components/EnginePredictions';
import MatchIntelligence from '@/components/MatchIntelligence';
import EnginePerformance from '@/components/EnginePerformance';
import AIChatbot from '@/components/AIChatbot';

const GREETING: Record<string, string> = {
  tr: 'Tekrar hoş geldin',
  en: 'Welcome back',
  de: 'Willkommen zurück',
};

const HERO_TAGLINE: Record<string, string> = {
  tr: 'Yapay zekâ motoru bugünün maçlarını analiz etti. İşte öne çıkanlar.',
  en: "The AI engine has analysed today's matches. Here are the highlights.",
  de: 'Die KI-Engine hat die heutigen Spiele analysiert. Hier sind die Highlights.',
};

const ENGINE_ACTIVE: Record<string, string> = {
  tr: 'Motor aktif', en: 'Engine active', de: 'Engine aktiv',
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = (translations[lang as keyof typeof translations] || translations.en) as any;

  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Fire GA4 purchase once after a successful Stripe checkout redirect.
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      if (typeof window !== 'undefined' && !sessionStorage.getItem('purchase_tracked')) {
        sessionStorage.setItem('purchase_tracked', '1');
        track.purchase();
      }
    }
  }, [searchParams]);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  function handleRefresh() {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="fa-shell min-h-screen grid place-items-center">
        <Spinner size={28} className="text-brand-400" />
      </div>
    );
  }

  const greeting = GREETING[lang] || GREETING.en;
  const firstName =
    session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || '';
  const today = new Date().toLocaleDateString(
    lang === 'tr' ? 'tr-TR' : lang === 'de' ? 'de-DE' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long' },
  );

  return (
    <div className="fa-shell min-h-screen">
      <DashboardTopBar
        t={t}
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden fa-card mb-10 p-6 sm:p-8"
        >
          <div className="absolute inset-0 bg-grid-faint [background-size:32px_32px] opacity-40 pointer-events-none" />
          <div
            className="absolute -top-24 -right-16 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18), transparent 65%)' }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-content-subtle capitalize">{today}</p>
                <Badge tone="brand" icon={<span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />}>
                  {ENGINE_ACTIVE[lang] || ENGINE_ACTIVE.en}
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight">
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="text-sm text-content-muted mt-2 max-w-xl">
                {HERO_TAGLINE[lang] || HERO_TAGLINE.en}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/tahminler">
                <Button variant="primary" icon={<Sparkles size={16} />}>
                  {t.viewAll || 'View predictions'}
                </Button>
              </Link>
              <Button
                variant="secondary"
                icon={<Brain size={16} />}
                onClick={() => setChatbotOpen(true)}
              >
                AI
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Engine Predictions */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-12"
        >
          <SectionHeader
            icon={<Target size={18} />}
            title={t.engineTitle || 'Engine Predictions'}
            subtitle={t.engineSubtitle}
            action={
              <Link
                href="/tahminler"
                className="flex items-center gap-1.5 text-[13px] font-medium text-brand-400 hover:text-brand-300 transition-colors"
              >
                {t.viewAll || 'View all'} <ArrowRight size={15} />
              </Link>
            }
          />
          <EnginePredictions key={`pred-${refreshKey}`} lang={lang} showStats showControls={false} limit={6} />
        </motion.section>

        {/* Match Intelligence */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mb-12"
        >
          <SectionHeader
            icon={<Brain size={18} />}
            title={t.matchIntelTitle || 'Match Intelligence'}
            subtitle={t.matchIntelSubtitle}
          />
          <MatchIntelligence key={`mi-${refreshKey}`} lang={lang} limit={30} />
        </motion.section>

        {/* Engine Performance */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mb-8"
        >
          <SectionHeader
            icon={<TrendingUp size={18} />}
            title={t.enginePerfTitle || 'Engine Performance'}
            subtitle={t.enginePerfSubtitle}
          />
          <EnginePerformance key={`perf-${refreshKey}`} lang={lang} recent={30} />
        </motion.section>
      </main>

      <AIChatbot isOpen={chatbotOpen} onToggle={() => setChatbotOpen((v) => !v)} />
    </div>
  );
}
