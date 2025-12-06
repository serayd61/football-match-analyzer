'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

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
      note: '7 gün sonra aylık $19.90 USD otomatik çekilir',
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
      note: '$19.90 USD/month billed automatically after trial',
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
      note: '$19.90 USD/Monat nach der Testphase',
      cancel: 'Jederzeit kündbar',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 py-12 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block mb-6 text-gray-400 hover:text-white">
            {l.backToHome}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">⚽ {l.title}</h1>
          <p className="text-gray-400 text-lg mb-6">{l.subtitle}</p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 font-medium">
            {l.trialBadge}
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-8 ring-2 ring-green-500 shadow-2xl shadow-green-500/20">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-bold rounded-full mb-4">PRO</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-white">$19.90</span>
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

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-green-500/30"
            >
              {loading ? l.loading : session ? l.startNow : l.startTrial}
            </button>

            <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
              <p>{l.note}</p>
              <p>{l.cancel}</p>
            </div>
          </div>
        </div>

        {/* AI Models */}
        <div className="mt-16 text-center">
          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
            {['🟣 Claude', '🟢 GPT-4', '🔵 Gemini', '🟠 Heurist'].map((model) => (
              <div key={model} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-sm text-white">
                {model}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
