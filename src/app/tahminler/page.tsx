'use client';

import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
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
  de: {
    title: 'Vorhersagen',
    sub: 'Statistisches Modell (Dixon-Coles) mit echten Spieldaten — kalibrierte Wahrscheinlichkeiten',
    disclaimer: 'Nur zur Information, keine Wettberatung.',
  },
};

export default function TahminlerPage() {
  const { lang } = useLanguage();
  const t = (T as any)[lang] || T.en;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-medium mb-4">
            <Activity size={14} /> Dixon-Coles · v1
          </span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-brand-400 to-sky-400 bg-clip-text text-transparent">{t.title}</span>
          </h1>
          <p className="text-content-muted max-w-2xl mx-auto text-sm md:text-base mt-3">{t.sub}</p>
        </motion.div>

        <EnginePredictions lang={lang} />

        <p className="text-center text-xs text-content-subtle mt-10">{t.disclaimer}</p>
      </div>
    </div>
  );
}
