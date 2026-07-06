'use client';

// ============================================================================
// EnginePickCard — analiz sonucu ekranındaki kişisel dönüşüm anı.
// Kullanıcının O AN baktığı maç için motorun da bir seçimi varsa gösterilir:
// free'ye kilitli ("Motor bu maç için de seçim üretti · bu ligde son 30 gün
// %NN isabet — Pro'da gör"), Pro'ya açık seçim + olasılık şeridi + gerekçe.
// Kaynak: /api/v2/predictions/for-match (varlık + lig isabeti public, seçim
// Pro). Seçim yoksa hiç render edilmez.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Target, Lock, TrendingUp } from 'lucide-react';
import { displayLeague } from '@/lib/league-names';

interface ForMatch {
  ok: boolean;
  exists: boolean;
  locked?: boolean;
  leagueId?: number;
  leagueName?: string;
  league30d?: { total: number; correct: number; accuracy: number | null };
  pick?: {
    pick: string; confidence: number | null;
    pHome: number | null; pDraw: number | null; pAway: number | null;
    rationale: string | null; homeName: string; awayName: string;
  } | null;
}

const STR = {
  tr: {
    title: 'Motorun bu maç için seçimi',
    lockedLine: 'Motor bu maç için de bir seçim üretti.',
    leagueProof: (league: string, acc: number, n: number) =>
      `${league} · son 30 gün: ${n} seçimde %${acc} isabet`,
    cta: "Pro'da gör",
    conf: 'Güven',
    draw: 'Beraberlik',
    why: 'Gerekçe',
  },
  en: {
    title: "The engine's pick for this match",
    lockedLine: 'The engine also produced a pick for this match.',
    leagueProof: (league: string, acc: number, n: number) =>
      `${league} · last 30 days: ${acc}% accuracy over ${n} picks`,
    cta: 'See it with Pro',
    conf: 'Confidence',
    draw: 'Draw',
    why: 'Rationale',
  },
  de: {
    title: 'Der Engine-Tipp für dieses Spiel',
    lockedLine: 'Die Engine hat auch für dieses Spiel einen Tipp erstellt.',
    leagueProof: (league: string, acc: number, n: number) =>
      `${league} · letzte 30 Tage: ${acc}% Trefferquote bei ${n} Tipps`,
    cta: 'Mit Pro ansehen',
    conf: 'Konfidenz',
    draw: 'Unentschieden',
    why: 'Begründung',
  },
};

export default function EnginePickCard({ fixtureId, lang = 'tr' }: { fixtureId: number | string; lang?: string }) {
  const t = (STR as any)[lang] || STR.en;
  const [data, setData] = useState<ForMatch | null>(null);

  useEffect(() => {
    const id = Number(fixtureId);
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    fetch(`/api/v2/predictions/for-match?fixtureId=${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fixtureId]);

  if (!data?.exists) return null;

  const league = displayLeague(data.leagueName || '', data.leagueId || 0);
  const proof =
    data.league30d && data.league30d.accuracy != null && data.league30d.total >= 5
      ? t.leagueProof(league, data.league30d.accuracy, data.league30d.total)
      : league;

  if (data.locked || !data.pick) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fa-card p-5 mt-8 relative overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-brand-400/10 border border-brand-400/30 flex items-center justify-center text-brand-300 shrink-0">
              <Lock size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content">{t.lockedLine}</p>
              <p className="text-xs text-content-muted mt-0.5 truncate">{proof}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Blur'lu seçim silueti — gerçek içerik hissi, veri sızmaz */}
            <div aria-hidden className="hidden sm:flex items-center gap-2 blur-[5px] opacity-50 select-none">
              <div className="h-7 w-20 rounded-lg bg-brand-400/40" />
              <div className="h-7 w-10 rounded-lg bg-white/20" />
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:opacity-90 transition-opacity shrink-0"
            >
              {t.cta}
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  const p = data.pick;
  const pickLabel = p.pick === '1' ? p.homeName : p.pick === '2' ? p.awayName : t.draw;
  const conf = p.confidence != null ? Math.round(p.confidence * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fa-card p-5 mt-8"
    >
      <div className="flex items-center gap-2 mb-3">
        <Target size={16} className="text-brand-400" />
        <h3 className="font-semibold text-content tracking-tight text-sm">{t.title}</h3>
        <span className="text-xs text-content-muted ml-auto truncate">{proof}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-400/40 bg-brand-400/10 text-brand-300 font-bold text-sm">
          <TrendingUp size={14} /> {pickLabel}
        </span>
        {conf != null && (
          <span className="text-sm text-content-muted">
            {t.conf}: <b className="text-content">{conf}%</b>
          </span>
        )}
        {p.pHome != null && p.pDraw != null && p.pAway != null && (
          <div className="flex-1 min-w-[140px]">
            <div className="flex h-2 rounded-full overflow-hidden">
              <div style={{ width: `${p.pHome * 100}%` }} className="bg-brand-400/70" />
              <div style={{ width: `${p.pDraw * 100}%` }} className="bg-amber-400/70" />
              <div style={{ width: `${p.pAway * 100}%` }} className="bg-sky-500/70" />
            </div>
            <div className="flex justify-between text-[10px] text-content-muted mt-1">
              <span>1 · {Math.round(p.pHome * 100)}%</span>
              <span>X · {Math.round(p.pDraw * 100)}%</span>
              <span>2 · {Math.round(p.pAway * 100)}%</span>
            </div>
          </div>
        )}
      </div>
      {p.rationale && (
        <p className="text-xs text-content-muted leading-relaxed border-t border-white/10 mt-3 pt-3">
          <span className="text-brand-400 font-semibold">{t.why}:</span> {p.rationale}
        </p>
      )}
    </motion.div>
  );
}
