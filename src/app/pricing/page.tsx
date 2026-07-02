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

  // DÜRÜSTLÜK: özellik listesi gerçek ürünle birebir. Eski metin "4 AI model
  // (GPT-4, Gemini...)", "value bet", "1 gün ücretsiz" iddiaları taşıyordu —
  // hiçbiri canlı üründe yok(tu). AI = Claude + DeepSeek; motor = Dixon-Coles
  // + xG + Club ELO; free = HER GÜN 3 analiz (24 saatlik deneme değil).
  const labels = {
    tr: {
      backToHome: 'Ana Sayfa', title: 'Fiyatlandırma', subtitle: 'Gerçek istatistik + yapay zekâ. Abartı yok, şeffaf kayıt var.',
      freePlan: 'Ücretsiz', freePrice: '$0', freeBadge: 'Her gün yenilenir',
      freeFeatures: ['Her gün 3 AI maç analizi (Claude + DeepSeek)', 'Maç sonucu, Alt/Üst 2.5, KG tahmini', 'Motor performansı ve şeffaf sonuç kaydı', 'AI Chatbot erişimi', 'Kredi kartı gerekmez'],
      freeButton: 'Ücretsiz Kayıt Ol', freeValid: 'Süresiz — günlük hak her gece sıfırlanır',
      proPlan: 'Pro', proPrice: '$19.99', proBadge: '7 gün ücretsiz dene', perMonth: '/ay',
      proFeatures: ['Sınırsız AI maç analizi', 'Günlük motor tahminleri: Dixon-Coles + xG + Club ELO', 'Olasılıklar: 1X2, Alt/Üst, KG — güven skoruyla', 'Match Intelligence: istatistik + haber özeti', '10+ ligde binlerce maçla doğrulanmış model', 'AI Agent analizleri', 'Öncelikli destek'],
      startTrial: '7 gün ücretsiz dene', startNow: 'Hemen Başla', loading: 'Yükleniyor...', cancel: 'Deneme için kart gerekir · istediğin zaman iptal', poweredBy: 'Altyapı — pazarlama değil, gerçekte çalışanlar',
      trackLink: 'Modelin şeffaf sonuç kaydını incele →',
    },
    en: {
      backToHome: 'Home', title: 'Pricing', subtitle: 'Real statistics + AI. No hype — a transparent track record.',
      freePlan: 'Free', freePrice: '$0', freeBadge: 'Renews daily',
      freeFeatures: ['3 AI match analyses every day (Claude + DeepSeek)', 'Match result, Over/Under 2.5, BTTS', 'Engine performance & transparent track record', 'AI Chatbot access', 'No credit card required'],
      freeButton: 'Sign Up Free', freeValid: 'Forever — daily quota resets every night',
      proPlan: 'Pro', proPrice: '$19.99', proBadge: 'Try 7 days free', perMonth: '/month',
      proFeatures: ['Unlimited AI match analyses', 'Daily engine picks: Dixon-Coles + xG + Club ELO', 'Probabilities: 1X2, O/U, BTTS — with confidence', 'Match Intelligence: stats + news digest', 'Validated on thousands of matches across 10+ leagues', 'AI Agent analyses', 'Priority support'],
      startTrial: 'Try 7 days free', startNow: 'Start Now', loading: 'Loading...', cancel: 'Card required for trial · cancel anytime', poweredBy: 'The stack — what actually runs, not marketing',
      trackLink: 'See the transparent track record →',
    },
    de: {
      backToHome: 'Start', title: 'Preise', subtitle: 'Echte Statistik + KI. Kein Hype — eine transparente Bilanz.',
      freePlan: 'Kostenlos', freePrice: '$0', freeBadge: 'Täglich erneuert',
      freeFeatures: ['Jeden Tag 3 KI-Spielanalysen (Claude + DeepSeek)', 'Spielergebnis, Über/Unter 2.5, BTTS', 'Engine-Performance & transparente Bilanz', 'KI-Chatbot-Zugang', 'Keine Kreditkarte nötig'],
      freeButton: 'Kostenlos registrieren', freeValid: 'Unbefristet — Tageskontingent wird nachts zurückgesetzt',
      proPlan: 'Pro', proPrice: '$19.99', proBadge: '7 Tage gratis testen', perMonth: '/Monat',
      proFeatures: ['Unbegrenzte KI-Spielanalysen', 'Tägliche Engine-Tipps: Dixon-Coles + xG + Club ELO', 'Wahrscheinlichkeiten: 1X2, Ü/U, BTTS — mit Konfidenz', 'Match Intelligence: Statistik + News-Digest', 'Validiert an Tausenden Spielen in 10+ Ligen', 'KI-Agent-Analysen', 'Prioritäts-Support'],
      startTrial: '7 Tage gratis testen', startNow: 'Jetzt starten', loading: 'Laden...', cancel: 'Karte für Test erforderlich · jederzeit kündbar', poweredBy: 'Der Stack — was wirklich läuft, kein Marketing',
      trackLink: 'Transparente Erfolgsbilanz ansehen →',
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
          <h1 className="text-3xl md:text-5xl font-bold text-content tracking-tight">{l.title}</h1>
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

        {/* Altyapı — yalnız gerçekte koşan bileşenler (dürüstlük kapısı) */}
        <motion.div className="mt-16 text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <p className="text-content-subtle mb-4 text-sm">{l.poweredBy}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {['Claude', 'DeepSeek', 'Dixon-Coles + xG', 'Club ELO'].map((model) => (
              <div key={model} className="fa-card p-3 text-sm text-content">{model}</div>
            ))}
          </div>
          <Link href="/track-record" className="inline-block mt-6 text-sm text-brand-400 hover:text-brand-300 transition-colors">
            {l.trackLink}
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
