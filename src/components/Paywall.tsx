'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Zap, X, Crown } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { track } from '@/lib/analytics';

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'limit_reached' | 'premium_feature' | 'agent_access';
  currentUsage?: number;
  limit?: number;
}

export function Paywall({ isOpen, onClose, reason = 'limit_reached', currentUsage = 1, limit = 1 }: PaywallProps) {
  const router = useRouter();
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  // Haftalık = düşük eşikli giriş (trial yok), aylık = tasarruf + 7 gün trial.
  // STRIPE_PRICE_ID_WEEKLY yoksa haftalık seçenek gizlenir (checkout 503 verirdi).
  const [billing, setBilling] = useState<'PRO_WEEKLY' | 'PRO'>('PRO');
  const [weeklyAvailable, setWeeklyAvailable] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/stripe/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && d.weekly) {
          setWeeklyAvailable(true);
          setBilling('PRO_WEEKLY');
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const labels = {
    tr: {
      title: '🚀 Premium\'a Geç',
      subtitle: 'Sınırsız analiz ve tüm özellikler',
      limitReached: {
        title: 'Günlük Analiz Limitiniz Doldu',
        message: `Bugün ${currentUsage}/${limit} analiz kullandınız. Premium ile sınırsız analiz yapın!`,
      },
      premiumFeature: {
        title: 'Premium Özellik',
        message: 'Bu özellik sadece Premium üyeler için.',
      },
      agentAccess: {
        title: 'AI Agent\'lara Erişim',
        message: 'Uzman Agent sistemlerini kullanmak için Premium gerekli.',
      },
      features: [
        '✅ Sınırsız günlük analiz',
        '✅ 4 AI Model (Claude, GPT-4, Gemini, Heurist)',
        '✅ 3 Uzman Agent Sistemi',
        '✅ Detaylı istatistikler',
        '✅ Performans takibi',
        '✅ Telegram bildirimleri',
      ],
      price: '$19.99/ay',
      weeklyLabel: 'Haftalık', weeklyPrice: '$6.99', perWeek: '/hafta', weeklyNote: 'Dene — taahhüt yok',
      monthlyLabel: 'Aylık', perMonth: '/ay', monthlyNote: '%30+ tasarruf · 7 gün ücretsiz',
      upgrade: 'Premium\'a Geç',
      cancel: 'İptal',
      loading: 'Yönlendiriliyor...',
    },
    en: {
      title: '🚀 Upgrade to Premium',
      subtitle: 'Unlimited analyses and all features',
      limitReached: {
        title: 'Daily Analysis Limit Reached',
        message: `You've used ${currentUsage}/${limit} analyses today. Get unlimited with Premium!`,
      },
      premiumFeature: {
        title: 'Premium Feature',
        message: 'This feature is only available for Premium members.',
      },
      agentAccess: {
        title: 'AI Agent Access',
        message: 'Premium required to use Expert Agent systems.',
      },
      features: [
        '✅ Unlimited daily analyses',
        '✅ 4 AI Models (Claude, GPT-4, Gemini, Heurist)',
        '✅ 3 Expert Agent Systems',
        '✅ Detailed statistics',
        '✅ Performance tracking',
        '✅ Telegram notifications',
      ],
      price: '$19.99/month',
      weeklyLabel: 'Weekly', weeklyPrice: '$6.99', perWeek: '/week', weeklyNote: 'Try it — no commitment',
      monthlyLabel: 'Monthly', perMonth: '/month', monthlyNote: 'Save 30%+ · 7 days free',
      upgrade: 'Upgrade to Premium',
      cancel: 'Cancel',
      loading: 'Redirecting...',
    },
    de: {
      title: '🚀 Auf Premium upgraden',
      subtitle: 'Unbegrenzte Analysen und alle Funktionen',
      limitReached: {
        title: 'Tägliches Analyse-Limit erreicht',
        message: `Sie haben heute ${currentUsage}/${limit} Analysen verwendet. Unbegrenzt mit Premium!`,
      },
      premiumFeature: {
        title: 'Premium-Funktion',
        message: 'Diese Funktion ist nur für Premium-Mitglieder verfügbar.',
      },
      agentAccess: {
        title: 'KI-Agent-Zugriff',
        message: 'Premium erforderlich für Expert Agent Systeme.',
      },
      features: [
        '✅ Unbegrenzte tägliche Analysen',
        '✅ 4 KI-Modelle (Claude, GPT-4, Gemini, Heurist)',
        '✅ 3 Experten-Agent-Systeme',
        '✅ Detaillierte Statistiken',
        '✅ Leistungsverfolgung',
        '✅ Telegram-Benachrichtigungen',
      ],
      price: '$19.99/Monat',
      weeklyLabel: 'Wöchentlich', weeklyPrice: '$6.99', perWeek: '/Woche', weeklyNote: 'Ausprobieren — ohne Bindung',
      monthlyLabel: 'Monatlich', perMonth: '/Monat', monthlyNote: '30%+ sparen · 7 Tage gratis',
      upgrade: 'Auf Premium upgraden',
      cancel: 'Abbrechen',
      loading: 'Weiterleitung...',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const getReasonMessage = () => {
    switch (reason) {
      case 'limit_reached':
        return l.limitReached;
      case 'premium_feature':
        return l.premiumFeature;
      case 'agent_access':
        return l.agentAccess;
      default:
        return l.limitReached;
    }
  };

  const reasonMsg = getReasonMessage();

  const handleUpgrade = async () => {
    setLoading(true);
    track.beginCheckout();
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
      router.push('/pricing');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-[#00f0ff]/50 rounded-3xl p-8 max-w-md w-full shadow-2xl neon-border-cyan neon-glow-cyan relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00f0ff] to-[#ff00ff] flex items-center justify-center">
                  <Crown className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center text-white mb-2">{l.title}</h2>
              <p className="text-center text-gray-400 mb-6">{l.subtitle}</p>

              {/* Reason message */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                <h3 className="font-bold text-yellow-400 mb-1">{reasonMsg.title}</h3>
                <p className="text-sm text-gray-300">{reasonMsg.message}</p>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {l.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                    {feature}
                  </div>
                ))}
              </div>

              {/* Fiyat seçimi: haftalık (trial yok) / aylık (7 gün trial) */}
              <div className={`grid gap-2 mb-6 ${weeklyAvailable ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {([
                  ...(weeklyAvailable
                    ? [{ key: 'PRO_WEEKLY' as const, price: l.weeklyPrice, per: l.perWeek, label: l.weeklyLabel, note: l.weeklyNote }]
                    : []),
                  { key: 'PRO' as const, price: '$19.99', per: l.perMonth, label: l.monthlyLabel, note: l.monthlyNote },
                ]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBilling(opt.key)}
                    className={`rounded-xl border p-3 text-center transition-colors ${
                      billing === opt.key
                        ? 'border-[#00f0ff]/60 bg-[#00f0ff]/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-gray-400">{opt.label}</div>
                    <div className="text-xl font-bold text-[#00f0ff] mt-0.5">
                      {opt.price}<span className="text-xs text-gray-500">{opt.per}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{opt.note}</div>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
                >
                  {l.cancel}
                </button>
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] rounded-xl text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {l.loading}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      {l.upgrade}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

