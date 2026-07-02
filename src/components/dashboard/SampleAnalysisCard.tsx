'use client';

// ============================================================================
// SampleAnalysisCard — motorun bugünkü GERÇEK analizlerinden birinin kompakt,
// salt-okunur vitrini ("bir analiz böyle görünür"). Kaynak: /api/showcase-
// analysis (cron üretimi, sıfır ek AI maliyeti). Free kullanıcıyı kendi
// analizini yapmaya iter — CTA #featured-matches'a kaydırır.
// ============================================================================

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, ArrowUp } from 'lucide-react';
import { displayLeague } from '@/lib/league-names';

interface Showcase {
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  matchResult: { prediction: string; confidence: number; reasoning: string | null };
  overUnder: { prediction: string; confidence: number };
  btts: { prediction: string; confidence: number };
  bestBet: { market: string; selection: string; confidence: number; reason: string } | null;
  overallConfidence: number;
  riskLevel: string;
}

const STR = {
  tr: {
    tag: 'Gerçek örnek — motorun güncel analizi',
    mr: 'Maç sonucu', ou: 'Alt/Üst 2.5', btts: 'KG',
    conf: 'güven', best: 'Öne çıkan seçim', risk: 'Risk',
    riskMap: { low: 'düşük', medium: 'orta', high: 'yüksek' } as Record<string, string>,
    cta: 'Kendi analizini yap — ücretsiz',
    locale: 'tr-TR',
    predMap: { home: 'Ev sahibi', away: 'Deplasman', draw: 'Beraberlik', over: 'Üst', under: 'Alt', yes: 'Var', no: 'Yok' } as Record<string, string>,
  },
  en: {
    tag: 'Real example — a recent engine analysis',
    mr: 'Match result', ou: 'Over/Under 2.5', btts: 'BTTS',
    conf: 'confidence', best: 'Top pick', risk: 'Risk',
    riskMap: { low: 'low', medium: 'medium', high: 'high' } as Record<string, string>,
    cta: 'Run your own analysis — free',
    locale: 'en-US',
    predMap: { home: 'Home', away: 'Away', draw: 'Draw', over: 'Over', under: 'Under', yes: 'Yes', no: 'No' } as Record<string, string>,
  },
  de: {
    tag: 'Echtes Beispiel — aktuelle Engine-Analyse',
    mr: 'Spielausgang', ou: 'Über/Unter 2.5', btts: 'BTTS',
    conf: 'Konfidenz', best: 'Top-Auswahl', risk: 'Risiko',
    riskMap: { low: 'niedrig', medium: 'mittel', high: 'hoch' } as Record<string, string>,
    cta: 'Eigene Analyse starten — kostenlos',
    locale: 'de-DE',
    predMap: { home: 'Heim', away: 'Auswärts', draw: 'Unentschieden', over: 'Über', under: 'Unter', yes: 'Ja', no: 'Nein' } as Record<string, string>,
  },
};

export default function SampleAnalysisCard({ lang = 'tr' }: { lang?: string }) {
  const t = (STR as any)[lang] || STR.en;
  const [sc, setSc] = useState<Showcase | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/showcase-analysis')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setSc(d.showcase); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!sc) return null; // vitrinlik analiz yoksa sessizce gizle

  const pred = (p: string) => t.predMap[String(p || '').toLowerCase()] || p;
  const md = sc.matchDate
    ? new Date(sc.matchDate).toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
    : '';

  const scrollToMatches = () => {
    document.getElementById('featured-matches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-brand-400/20 bg-gradient-to-b from-brand-400/[0.06] to-white/[0.01] p-5"
    >
      <div className="flex items-center gap-2 text-xs text-brand-300 mb-3">
        <Sparkles size={14} /> {t.tag}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="text-lg font-bold text-white">
          {sc.homeTeam} <span className="text-white/30 font-normal">vs</span> {sc.awayTeam}
        </h3>
        <span className="text-xs text-white/40">{[displayLeague(sc.league), md].filter(Boolean).join(' · ')}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: t.mr, value: pred(sc.matchResult?.prediction), conf: sc.matchResult?.confidence },
          { label: t.ou, value: pred(sc.overUnder?.prediction), conf: sc.overUnder?.confidence },
          { label: t.btts, value: pred(sc.btts?.prediction), conf: sc.btts?.confidence },
        ].map((x, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">{x.label}</div>
            <div className="text-sm font-bold text-white truncate">{x.value || '–'}</div>
            <div className="text-[11px] text-brand-300 mt-0.5">{x.conf != null ? `%${Math.round(x.conf)} ${t.conf}` : ''}</div>
          </div>
        ))}
      </div>

      {sc.matchResult?.reasoning && (
        <p className="text-xs text-white/50 leading-relaxed mb-4 line-clamp-3">
          {sc.matchResult.reasoning}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-white/40">
          <ShieldCheck size={13} className="text-brand-300" />
          {t.risk}: {t.riskMap[String(sc.riskLevel || '').toLowerCase()] || sc.riskLevel} · %{Math.round(sc.overallConfidence || 0)} {t.conf}
        </span>
        <button
          onClick={scrollToMatches}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-brand-300 border border-brand-400/40 bg-brand-400/10 hover:bg-brand-400/20 transition-colors"
        >
          <ArrowUp size={14} /> {t.cta}
        </button>
      </div>
    </motion.div>
  );
}
