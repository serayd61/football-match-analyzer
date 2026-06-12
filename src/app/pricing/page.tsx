'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ArrowLeft } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useLanguage } from '@/components/LanguageProvider';

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();

  useEffect(() => {
    track.viewPricing();
  }, []);

  const handleSubscribe = async () => {
    if (!session) {
      track.ctaClick('pricing_page', 'subscribe_logged_out');
      router.push('/login');
      return;
    }
    track.beginCheckout();
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'PRO' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const labels = {
    tr: {
      backToHome: 'Ana Sayfa', title: 'Fiyatlandırma', subtitle: 'Profesyonel AI futbol analizi',
      freePlan: 'Ücretsiz Deneme', freePrice: '0₺', freeBadge: '🎁 1 Gün Ücretsiz',
      freeFeatures: ['3 maç analizi (24 saat)', 'Temel AI tahminleri', 'Maç sonucu, Ü/A, KG', 'AI Chatbot erişimi'],
      freeButton: 'Ücretsiz Kayıt Ol', freeValid: '24 saat geçerli',
      proPlan: 'Pro Üyelik', proPrice: '$19.99', proBadge: '⭐ En Popüler', perMonth: '/ay',
      proFeatures: ['Sınırsız maç analizi', '4 AI Model (Claude, GPT-4, Gemini, DeepSeek)', '5 Uzman Agent Sistemi', 'Self-Learning AI (öğrenen sistem)', 'Gerçek zamanlı bahis oranları', 'Value bet tespiti', 'AI Chatbot sınırsız', 'Öncelikli destek'],
      startTrial: "Pro'ya Yükselt", startNow: 'Hemen Başla', loading: 'Yükleniyor...', cancel: 'İstediğin zaman iptal edebilirsin', poweredBy: 'Destekleyen modeller',
    },
    en: {
      backToHome: 'Home', title: 'Pricing', subtitle: 'Professional AI football analysis',
      freePlan: 'Free Trial', freePrice: '$0', freeBadge: '🎁 1 Day Free',
      freeFeatures: ['3 match analyses (24 hours)', 'Basic AI predictions', 'Match result, O/U, BTTS', 'AI Chatbot access'],
      freeButton: 'Sign Up Free', freeValid: 'Valid for 24 hours',
      proPlan: 'Pro Membership', proPrice: '$19.99', proBadge: '⭐ Most Popular', perMonth: '/month',
      proFeatures: ['Unlimited match analysis', '4 AI Models (Claude, GPT-4, Gemini, DeepSeek)', '5 Expert Agent System', 'Self-Learning AI', 'Real-time betting odds', 'Value bet detection', 'Unlimited AI Chatbot', 'Priority support'],
      startTrial: 'Upgrade to Pro', startNow: 'Start Now', loading: 'Loading...', cancel: 'Cancel anytime', poweredBy: 'Powered by',
    },
    de: {
      backToHome: 'Start', title: 'Preise', subtitle: 'Professionelle KI-Fußballanalyse',
      freePlan: 'Kostenlose Testversion', freePrice: '0€', freeBadge: '🎁 1 Tag kostenlos',
      freeFeatures: ['3 Spielanalysen (24 Stunden)', 'Basis-KI-Vorhersagen', 'Spielergebnis, Ü/U, BTTS', 'KI-Chatbot-Zugang'],
      freeButton: 'Kostenlos registrieren', freeValid: '24 Stunden gültig',
      proPlan: 'Pro-Mitgliedschaft', proPrice: '$19.99', proBadge: '⭐ Am beliebtesten', perMonth: '/Monat',
      proFeatures: ['Unbegrenzte Spielanalysen', '4 KI-Modelle (Claude, GPT-4, Gemini, DeepSeek)', '5 Experten-Agent-System', 'Selbstlernendes KI-System', 'Echtzeit-Wettquoten', 'Value-Bet-Erkennung', 'Unbegrenzter KI-Chatbot', 'Prioritäts-Support'],
      startTrial: 'Auf Pro upgraden', startNow: 'Jetzt starten', loading: 'Laden...', cancel: 'Jederzeit kündbar', poweredBy: 'Powered by',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <div className="max-w-5xl mx-auto px-4 py-12">
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-content transition-colors mb-6">
            <ArrowLeft size={15} /> {l.backToHome}
          </Link>
          <h1 className="text-3xl md:text-5xl font-bold text-content tracking-tight">⚽ {l.title}</h1>
          <p className="text-content-muted text-lg mt-3">{l.subtitle}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* FREE */}
          <motion.div className="fa-card p-8 relative" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-500/15 text-brand-300 text-xs font-bold border border-brand-500/30">{l.freeBadge}</span>
            <div className="text-center mb-8 pt-3">
              <h3 className="text-lg font-semibold text-content mb-2">{l.freePlan}</h3>
              <div className="text-4xl font-bold text-brand-400">{l.freePrice}</div>
              <p className="text-content-subtle text-sm mt-2">{l.freeValid}</p>
            </div>
            <ul className="space-y-3 mb-8">
              {l.freeFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-content-muted"><Check size={16} className="text-brand-400 shrink-0" /> {f}</li>
              ))}
            </ul>
            <Link href="/register" className="fa-btn fa-btn-secondary w-full">{l.freeButton}</Link>
          </motion.div>

          {/* PRO */}
          <motion.div className="fa-card p-8 relative border-brand-500/40 shadow-glow-brand" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold border border-amber-500/30">{l.proBadge}</span>
            <div className="text-center mb-8 pt-3">
              <h3 className="text-lg font-semibold text-content mb-2">{l.proPlan}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-content">{l.proPrice}</span>
                <span className="text-lg text-content-subtle">{l.perMonth}</span>
              </div>
              <p className="text-content-subtle text-sm mt-2">USD</p>
            </div>
            <ul className="space-y-3 mb-8">
              {l.proFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-content-muted"><Check size={16} className="text-brand-400 shrink-0" /> {f}</li>
              ))}
            </ul>
            <button onClick={handleSubscribe} disabled={loading} className="fa-btn fa-btn-primary w-full">
              {loading ? l.loading : session ? l.startNow : l.startTrial}
            </button>
            <p className="mt-4 text-center text-sm text-content-subtle">{l.cancel}</p>
          </motion.div>
        </div>

        {/* AI Models */}
        <motion.div className="mt-16 text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <p className="text-content-subtle mb-4 text-sm">{l.poweredBy}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
            {['🟣 Claude', '🟢 GPT-4', '🔵 Gemini', '🟠 DeepSeek'].map((model) => (
              <div key={model} className="fa-card fa-card-hover p-3 text-sm text-content">{model}</div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
