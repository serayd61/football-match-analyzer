'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import CustomCursor from '@/components/CustomCursor';
import Navigation from '@/components/Navigation';
import { FootballBall3D } from '@/components/Football3D';
import { motion } from 'framer-motion';

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();

  const handleSubscribe = async () => {
    if (!session) {
      router.push('/login');
      return;
    }
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
    }
    setLoading(false);
  };

  const labels = {
    tr: {
      backToHome: '← Ana Sayfa',
      title: 'Pro Üyelik',
      subtitle: 'Profesyonel futbol analizi',
      trialBadge: '🎁 7 Gün Ücretsiz Deneme',
      perMonth: '/ay',
      features: [
        'Tüm ligler ve maçlar',
        '4 AI Model Analizi (Claude, GPT-4, Gemini, Heurist)',
        '3 Uzman Agent Sistemi',
        'Ağırlıklı Konsensüs Tahminleri',
        'Gerçek zamanlı bahis oranları',
        'Günlük tahminler',
        'Telegram bildirimleri',
      ],
      startTrial: '7 Gün Ücretsiz Başla',
      startNow: 'Hemen Başla',
      loading: 'Yükleniyor...',
      note: '7 gün sonra aylık $19.99 USD otomatik çekilir',
      cancel: 'İstediğin zaman iptal edebilirsin',
    },
    en: {
      backToHome: '← Back to Home',
      title: 'Pro Membership',
      subtitle: 'Professional football analysis',
      trialBadge: '🎁 7-Day Free Trial',
      perMonth: '/month',
      features: [
        'All leagues and matches',
        '4 AI Model Analysis (Claude, GPT-4, Gemini, Heurist)',
        '3 Expert Agent System',
        'Weighted Consensus Predictions',
        'Real-time betting odds',
        'Daily predictions',
        'Telegram notifications',
      ],
      startTrial: 'Start 7-Day Free Trial',
      startNow: 'Start Now',
      loading: 'Loading...',
      note: '$19.99 USD/month billed automatically after trial',
      cancel: 'Cancel anytime',
    },
    de: {
      backToHome: '← Zurück',
      title: 'Pro-Mitgliedschaft',
      subtitle: 'Professionelle Fußballanalyse',
      trialBadge: '🎁 7 Tage kostenlos',
      perMonth: '/Monat',
      features: [
        'Alle Ligen und Spiele',
        '4 KI-Modell-Analyse (Claude, GPT-4, Gemini, Heurist)',
        '3 Experten-Agent-System',
        'Gewichtete Konsens-Vorhersagen',
        'Echtzeit-Wettquoten',
        'Tägliche Vorhersagen',
        'Telegram-Benachrichtigungen',
      ],
      startTrial: '7 Tage kostenlos starten',
      startNow: 'Jetzt starten',
      loading: 'Laden...',
      note: '$19.99 USD/Monat nach der Testphase',
      cancel: 'Jederzeit kündbar',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  return (
    <div className="min-h-screen bg-black relative">
      <CustomCursor />
      <Navigation />
      
      {/* 3D Football Decorations */}
      <div className="fixed top-20 right-10 z-0 opacity-10 pointer-events-none">
        <FootballBall3D size={200} />
      </div>
      
      <div className="py-12 px-4 relative z-10">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSelector />
        </div>
      
      <div className="max-w-4xl mx-auto">
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
          <p className="text-gray-400 text-lg mb-6">{l.subtitle}</p>
          <div className="inline-flex items-center gap-2 px-6 py-3 glass-futuristic border border-[#00f0ff]/30 rounded-full text-[#00f0ff] font-medium neon-glow-cyan">
            {l.trialBadge}
          </div>
        </motion.div>

        <motion.div 
          className="max-w-md mx-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="glass-futuristic border-2 border-[#00f0ff]/50 rounded-3xl p-8 neon-border-cyan neon-glow-cyan shadow-2xl shadow-[#00f0ff]/20">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-bold rounded-full mb-4">PRO</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-white">$19.99</span>
                <span className="text-xl text-gray-400">{l.perMonth}</span>
              </div>
              <p className="text-gray-500 text-sm mt-2">USD</p>
            </div>

            <ul className="space-y-3 mb-8">
              {l.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-gray-300">
                  <span className="text-green-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <motion.button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 glass-futuristic border border-[#00f0ff]/50 text-white font-bold text-lg rounded-xl neon-border-cyan neon-glow-cyan transition-all disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? l.loading : session ? l.startNow : l.startTrial}
            </motion.button>

            <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
              <p>{l.note}</p>
              <p>{l.cancel}</p>
            </div>
          </div>
        </motion.div>

        {/* AI Models */}
        <motion.div 
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
            {['🟣 Claude', '🟢 GPT-4', '🔵 Gemini', '🟠 Heurist'].map((model, idx) => (
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
