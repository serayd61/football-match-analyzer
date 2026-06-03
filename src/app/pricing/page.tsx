'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import Navigation from '@/components/Navigation';
import { FootballBall3D } from '@/components/Football3D';
import { motion } from 'framer-motion';

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
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
    console.error(error);
    alert('Checkout failed. Please try again.');
  }
    setLoading(false);
  };

  const labels = {
    tr: {
      backToHome: '← Ana Sayfa',
      title: 'Fiyatlandırma',
      subtitle: 'Profesyonel AI futbol analizi',
      // Free Plan
      freePlan: 'Ücretsiz Deneme',
      freePrice: '0₺',
      freeBadge: '🎁 1 Gün Ücretsiz',
      freeFeatures: [
        '3 maç analizi (24 saat)',
        'Temel AI tahminleri',
        'Maç sonucu, Ü/A, KG',
        'AI Chatbot erişimi',
      ],
      freeButton: 'Ücretsiz Kayıt Ol',
      // Pro Plan
      proPlan: 'Pro Üyelik',
      proPrice: '$19.99',
      proBadge: '⭐ En Popüler',
      perMonth: '/ay',
      proFeatures: [
        'Sınırsız maç analizi',
        '4 AI Model (Claude, GPT-4, Gemini, DeepSeek)',
        '5 Uzman Agent Sistemi',
        'Self-Learning AI (öğrenen sistem)',
        'Gerçek zamanlı bahis oranları',
        'Value bet tespiti',
        'AI Chatbot sınırsız',
        'Öncelikli destek',
      ],
      startTrial: 'Pro\'ya Yükselt',
      startNow: 'Hemen Başla',
      loading: 'Yükleniyor...',
      note: 'Aylık $19.99 USD',
      cancel: 'İstediğin zaman iptal edebilirsin',
    },
    en: {
      backToHome: '← Back to Home',
      title: 'Pricing',
      subtitle: 'Professional AI football analysis',
      // Free Plan
      freePlan: 'Free Trial',
      freePrice: '$0',
      freeBadge: '🎁 1 Day Free',
      freeFeatures: [
        '3 match analyses (24 hours)',
        'Basic AI predictions',
        'Match result, O/U, BTTS',
        'AI Chatbot access',
      ],
      freeButton: 'Sign Up Free',
      // Pro Plan
      proPlan: 'Pro Membership',
      proPrice: '$19.99',
      proBadge: '⭐ Most Popular',
      perMonth: '/month',
      proFeatures: [
        'Unlimited match analysis',
        '4 AI Models (Claude, GPT-4, Gemini, DeepSeek)',
        '5 Expert Agent System',
        'Self-Learning AI',
        'Real-time betting odds',
        'Value bet detection',
        'Unlimited AI Chatbot',
        'Priority support',
      ],
      startTrial: 'Upgrade to Pro',
      startNow: 'Start Now',
      loading: 'Loading...',
      note: '$19.99 USD/month',
      cancel: 'Cancel anytime',
    },
    de: {
      backToHome: '← Zurück',
      title: 'Preise',
      subtitle: 'Professionelle KI-Fußballanalyse',
      // Free Plan
      freePlan: 'Kostenlose Testversion',
      freePrice: '0€',
      freeBadge: '🎁 1 Tag kostenlos',
      freeFeatures: [
        '3 Spielanalysen (24 Stunden)',
        'Basis-KI-Vorhersagen',
        'Spielergebnis, Ü/U, BTTS',
        'KI-Chatbot-Zugang',
      ],
      freeButton: 'Kostenlos registrieren',
      // Pro Plan
      proPlan: 'Pro-Mitgliedschaft',
      proPrice: '$19.99',
      proBadge: '⭐ Am beliebtesten',
      perMonth: '/Monat',
      proFeatures: [
        'Unbegrenzte Spielanalysen',
        '4 KI-Modelle (Claude, GPT-4, Gemini, DeepSeek)',
        '5 Experten-Agent-System',
        'Selbstlernendes KI-System',
        'Echtzeit-Wettquoten',
        'Value-Bet-Erkennung',
        'Unbegrenzter KI-Chatbot',
        'Prioritäts-Support',
      ],
      startTrial: 'Auf Pro upgraden',
      startNow: 'Jetzt starten',
      loading: 'Laden...',
      note: '$19.99 USD/Monat',
      cancel: 'Jederzeit kündbar',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  return (
    <div className="min-h-screen bg-black relative">
      <Navigation />
      
      {/* 3D Football Decorations */}
      <div className="fixed top-20 right-10 z-0 opacity-10 pointer-events-none">
        <FootballBall3D size={200} />
      </div>
      
      <div className="py-12 px-4 relative z-10">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSelector />
        </div>
      
      <div className="max-w-5xl mx-auto">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link href="/" className="inline-block mb-6 text-gray-400 hover:text-[#00f0ff] transition-colors">
            {l.backToHome}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
            ⚽ {l.title}
          </h1>
          <p className="text-gray-400 text-lg">{l.subtitle}</p>
        </motion.div>

        {/* Pricing Cards - 2 Plans */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* FREE PLAN */}
          <motion.div 
            className="glass-futuristic border border-gray-700/50 rounded-3xl p-8 relative"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-bold rounded-full border border-emerald-500/30">
                {l.freeBadge}
              </span>
            </div>
            
            <div className="text-center mb-8 pt-4">
              <h3 className="text-xl font-bold text-white mb-2">{l.freePlan}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-emerald-400">{l.freePrice}</span>
              </div>
              <p className="text-gray-500 text-sm mt-2">24 saat geçerli</p>
            </div>

            <ul className="space-y-3 mb-8">
              {l.freeFeatures.map((feature: string, idx: number) => (
                <li key={idx} className="flex items-center gap-3 text-gray-300">
                  <span className="text-emerald-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/register">
              <motion.button
                className="w-full py-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold text-lg rounded-xl hover:bg-emerald-500/30 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {l.freeButton}
              </motion.button>
            </Link>
          </motion.div>

          {/* PRO PLAN */}
          <motion.div 
            className="glass-futuristic border-2 border-[#00f0ff]/50 rounded-3xl p-8 relative neon-border-cyan neon-glow-cyan shadow-2xl shadow-[#00f0ff]/20"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-bold rounded-full border border-yellow-500/30">
                {l.proBadge}
              </span>
            </div>
            
            <div className="text-center mb-8 pt-4">
              <h3 className="text-xl font-bold text-white mb-2">{l.proPlan}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">{l.proPrice}</span>
                <span className="text-xl text-gray-400">{l.perMonth}</span>
              </div>
              <p className="text-gray-500 text-sm mt-2">USD</p>
            </div>

            <ul className="space-y-3 mb-8">
              {l.proFeatures.map((feature: string, idx: number) => (
                <li key={idx} className="flex items-center gap-3 text-gray-300">
                  <span className="text-[#00f0ff]">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <motion.button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#00f0ff] to-cyan-400 text-black font-bold text-lg rounded-xl hover:from-cyan-400 hover:to-[#00f0ff] transition-all disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? l.loading : session ? l.startNow : l.startTrial}
            </motion.button>

            <div className="mt-4 text-center text-sm text-gray-500">
              <p>{l.cancel}</p>
            </div>
          </motion.div>
        </div>

        {/* AI Models */}
        <motion.div 
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-gray-400 mb-4">Powered by</p>
          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
            {['🟣 Claude', '🟢 GPT-4', '🔵 Gemini', '🟠 DeepSeek'].map((model, idx) => (
              <motion.div 
                key={model} 
                className="glass-futuristic border border-[#00f0ff]/20 rounded-xl p-3 text-sm text-white neon-border-cyan"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                whileHover={{ scale: 1.05, borderColor: 'rgba(0, 240, 255, 0.5)' }}
              >
                {model}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
