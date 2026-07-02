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
  Target, Brain, TrendingUp, ArrowRight, Sparkles, RefreshCw, Zap,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { translations } from '@/lib/translations';
import { track } from '@/lib/analytics';
import { SectionHeader, Button, Badge, Spinner } from '@/components/ui';
import DashboardTopBar from '@/components/dashboard/DashboardTopBar';
import FeaturedMatches from '@/components/dashboard/FeaturedMatches';
import SampleAnalysisCard from '@/components/dashboard/SampleAnalysisCard';
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

// --- Free aktivasyon metinleri (kayıt → ilk analiz köprüsü) ---
const FREE_STR: Record<string, {
  badge: (left: number, limit: number) => string;
  badgeEmpty: string;
  cta: string;
  proof: (n: number, acc: number) => string;
  featuredTitle: string;
  featuredSubtitle: string;
  sampleTitle: string;
  sampleSubtitle: string;
}> = {
  tr: {
    badge: (left, limit) => `Bugün ${left}/${limit} ücretsiz analizin hazır`,
    badgeEmpty: 'Bugünkü ücretsiz analizlerin doldu — yarın yenilenir',
    cta: 'İlk analizini yap',
    proof: (n, acc) => `Motor ${n.toLocaleString('tr-TR')} sonuçlanmış maçta %${acc} isabet kaydetti — kayıtlar şeffaf.`,
    featuredTitle: 'Öne çıkan maçlar',
    featuredSubtitle: 'Tek tıkla yapay zekâ analizi — günlük 3 hakkın dahilinde',
    sampleTitle: 'Örnek analiz',
    sampleSubtitle: 'Motorun ürettiği gerçek bir analiz — böyle görünür',
  },
  en: {
    badge: (left, limit) => `${left}/${limit} free analyses ready today`,
    badgeEmpty: 'Daily free analyses used — resets tomorrow',
    cta: 'Run your first analysis',
    proof: (n, acc) => `The engine scored ${acc}% on ${n.toLocaleString('en-US')} settled matches — record is public.`,
    featuredTitle: 'Featured matches',
    featuredSubtitle: 'One-click AI analysis — uses your 3 daily free runs',
    sampleTitle: 'Sample analysis',
    sampleSubtitle: 'A real analysis produced by the engine — this is what you get',
  },
  de: {
    badge: (left, limit) => `Heute ${left}/${limit} kostenlose Analysen bereit`,
    badgeEmpty: 'Tageskontingent aufgebraucht — morgen wieder verfügbar',
    cta: 'Erste Analyse starten',
    proof: (n, acc) => `Die Engine erzielte ${acc}% Trefferquote über ${n.toLocaleString('de-DE')} abgerechnete Spiele — transparent belegt.`,
    featuredTitle: 'Ausgewählte Spiele',
    featuredSubtitle: 'KI-Analyse mit einem Klick — im Rahmen deiner 3 täglichen Analysen',
    sampleTitle: 'Beispielanalyse',
    sampleSubtitle: 'Eine echte Analyse der Engine — so sieht das Ergebnis aus',
  },
};

interface AccessInfo {
  plan: 'free' | 'pro';
  isPro: boolean;
  engineAccess: boolean;
  analysesUsed: number;
  analysesLimit: number;
  analysesLeft: number;
  canAnalyze: boolean;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = (translations[lang as keyof typeof translations] || translations.en) as any;

  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [perf, setPerf] = useState<{ total: number; accuracy: number } | null>(null);

  // Erişim durumu (free sayaç + widget sırası) ve gerçek performans kanıtı
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/me/access')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.ok) setAccess(d); })
      .catch(() => {});
    fetch('/api/v2/predictions/performance?recent=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.ok && d.total > 0) setPerf({ total: d.total, accuracy: d.accuracy }); })
      .catch(() => {});
  }, [status, refreshKey]);

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

  const fs = FREE_STR[lang] || FREE_STR.en;
  // access yüklenene kadar Pro düzeni varsayılır (mevcut kullanıcılar için
  // görsel zıplama olmasın); free tespit edilince aktivasyon düzenine geçilir.
  const isFreeUser = access ? !access.isPro && !access.engineAccess : false;

  const scrollToMatches = () =>
    document.getElementById('featured-matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="fa-shell min-h-screen">
      <DashboardTopBar
        t={t}
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        analysesLeft={isFreeUser && access ? access.analysesLeft : null}
        analysesLimit={isFreeUser && access ? access.analysesLimit : null}
        onAnalysesClick={scrollToMatches}
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
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="text-xs text-content-subtle capitalize">{today}</p>
                <Badge tone="brand" icon={<span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />}>
                  {ENGINE_ACTIVE[lang] || ENGINE_ACTIVE.en}
                </Badge>
                {isFreeUser && access && (
                  <Badge tone={access.canAnalyze ? 'brand' : 'neutral'} icon={<Zap size={12} />}>
                    {access.canAnalyze
                      ? fs.badge(access.analysesLeft, access.analysesLimit)
                      : fs.badgeEmpty}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight">
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="text-sm text-content-muted mt-2 max-w-xl">
                {perf
                  ? fs.proof(perf.total, perf.accuracy)
                  : HERO_TAGLINE[lang] || HERO_TAGLINE.en}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isFreeUser ? (
                <Button variant="primary" icon={<Zap size={16} />} onClick={scrollToMatches}>
                  {fs.cta}
                </Button>
              ) : (
                <Link href="/tahminler">
                  <Button variant="primary" icon={<Sparkles size={16} />}>
                    {t.viewAll || 'View predictions'}
                  </Button>
                </Link>
              )}
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

        {/* Öne çıkan maçlar — free kullanıcının 3 hakkını harcayacağı yer */}
        {isFreeUser && (
          <motion.section
            id="featured-matches"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-12 scroll-mt-24"
          >
            <SectionHeader
              icon={<Zap size={18} />}
              title={fs.featuredTitle}
              subtitle={fs.featuredSubtitle}
            />
            <FeaturedMatches lang={lang} limit={6} />
          </motion.section>
        )}

        {/* Örnek analiz — gerçek cron çıktısı, "ürün bunu verir" kanıtı */}
        {isFreeUser && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mb-12"
          >
            <SectionHeader
              icon={<Sparkles size={18} />}
              title={fs.sampleTitle}
              subtitle={fs.sampleSubtitle}
            />
            <SampleAnalysisCard lang={lang} />
          </motion.section>
        )}

        {/* Engine Performance — free için öne alınır (gerçek, açık veri) */}
        {isFreeUser && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mb-12"
          >
            <SectionHeader
              icon={<TrendingUp size={18} />}
              title={t.enginePerfTitle || 'Engine Performance'}
              subtitle={t.enginePerfSubtitle}
            />
            <EnginePerformance key={`perf-free-${refreshKey}`} lang={lang} recent={30} />
          </motion.section>
        )}

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

        {/* Engine Performance (free'de yukarıda gösterildi) */}
        {!isFreeUser && (
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
        )}
      </main>

      <AIChatbot isOpen={chatbotOpen} onToggle={() => setChatbotOpen((v) => !v)} />
    </div>
  );
}
