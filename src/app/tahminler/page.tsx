'use client';

import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useLanguage } from '@/components/LanguageProvider';
import EnginePredictions from '@/components/EnginePredictions';

const T = {
  tr: {
    title: 'Tahminler',
    sub: 'Gerçek maç verisiyle eğitilmiş istatistiksel model (Dixon-Coles) — kalibre olasılıklar',
    disclaimer: 'Bilgilendirme amaçlıdır, bahis tavsiyesi değildir.',
  },
  en: {
    title: 'Predictions',
    sub: 'Statistical model (Dixon-Coles) trained on real match data — calibrated probabilities',
    disclaimer: 'For information only, not betting advice.',
  },
};

export default function TahminlerPage() {
  const { lang } = useLanguage();
  const t = (T as any)[lang] || T.en;

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-body)' }}>
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 text-xs mb-4">
            <Activity size={14} /> Dixon-Coles • v1
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
            <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto text-sm md:text-base">{t.sub}</p>
        </motion.div>

        <EnginePredictions lang={lang} />

        <p className="text-center text-xs text-white/30 mt-10">{t.disclaimer}</p>
      </div>
    </div>
  );
}
