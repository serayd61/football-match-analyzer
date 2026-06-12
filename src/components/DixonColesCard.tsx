'use client';

import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

// ============================================================================
// DIXON-COLES STATISTICAL FOUNDATION CARD
// Analiz ekranında istatistiksel zemini (gerçek hesaplanmış olasılıklar) gösterir.
// sources.agents.dixonColes objesini alır. tr/en/de.
// ============================================================================

interface DixonColesData {
  expectedGoals?: { home: number; away: number };
  matchResult?: {
    prediction: 'HOME' | 'DRAW' | 'AWAY';
    probabilities: { home: number; draw: number; away: number };
    confidence: number;
  };
  overUnder25?: { prediction: string; probability: number; confidence: number };
  btts?: { prediction: string; probability: number; confidence: number };
  mostLikelyScore?: string;
  correctScore?: { score: string; prob: number }[];
}

const L = {
  tr: {
    title: 'İstatistiksel Zemin (Dixon-Coles)',
    subtitle: 'Geçmiş maçlardan matematiksel hesaplanmış olasılıklar — uydurma değil',
    xg: 'Beklenen Gol',
    mr: 'Maç Sonucu Olasılıkları',
    home: 'Ev', draw: 'Beraberlik', away: 'Dep',
    score: 'En Olası Skor',
    over: 'Üst 2.5', btts: 'KG Var',
    topScores: 'En olası skorlar',
  },
  en: {
    title: 'Statistical Foundation (Dixon-Coles)',
    subtitle: 'Probabilities computed mathematically from historical matches — not fabricated',
    xg: 'Expected Goals',
    mr: 'Match Result Probabilities',
    home: 'Home', draw: 'Draw', away: 'Away',
    score: 'Most Likely Score',
    over: 'Over 2.5', btts: 'BTTS Yes',
    topScores: 'Most likely scores',
  },
  de: {
    title: 'Statistische Grundlage (Dixon-Coles)',
    subtitle: 'Mathematisch aus historischen Spielen berechnete Wahrscheinlichkeiten',
    xg: 'Erwartete Tore',
    mr: 'Spielergebnis-Wahrscheinlichkeiten',
    home: 'Heim', draw: 'Unent.', away: 'Ausw.',
    score: 'Wahrscheinlichstes Ergebnis',
    over: 'Über 2.5', btts: 'BTTS Ja',
    topScores: 'Wahrscheinlichste Ergebnisse',
  },
} as const;

export default function DixonColesCard({
  data,
  lang = 'tr',
}: {
  data: DixonColesData;
  lang?: 'tr' | 'en' | 'de';
}) {
  if (!data) return null;
  const t = L[lang] || L.en;
  const mr = data.matchResult?.probabilities;
  const pct = (x?: number) => `${Math.round((x || 0) * 100)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
      className="fa-card p-6 mt-6"
    >
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-5 h-5 text-brand-400" />
        <h3 className="text-lg font-semibold text-content">{t.title}</h3>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30">
          DIXON-COLES
        </span>
      </div>
      <p className="text-xs text-content-muted mb-4">{t.subtitle}</p>

      {/* Beklenen gol + en olası skor */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {data.expectedGoals && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 text-center">
            <p className="text-[11px] text-content-muted mb-1">{t.xg}</p>
            <p className="text-xl font-bold text-brand-400 tabular-nums">
              {data.expectedGoals.home?.toFixed(2)} - {data.expectedGoals.away?.toFixed(2)}
            </p>
          </div>
        )}
        {data.mostLikelyScore && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 text-center">
            <p className="text-[11px] text-content-muted mb-1">{t.score}</p>
            <p className="text-xl font-bold text-brand-400 tabular-nums">{data.mostLikelyScore}</p>
          </div>
        )}
      </div>

      {/* Maç sonucu olasılık barı */}
      {mr && (
        <div className="bg-surface-3 border border-line rounded-xl p-3 mb-4">
          <p className="text-[11px] text-content-muted mb-2">{t.mr}</p>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
            <div style={{ width: pct(mr.home) }} className="bg-brand-500/70" />
            <div style={{ width: pct(mr.draw) }} className="bg-amber-400/70" />
            <div style={{ width: pct(mr.away) }} className="bg-sky-500/70" />
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-brand-300">{t.home} {pct(mr.home)}</span>
            <span className="text-amber-300">{t.draw} {pct(mr.draw)}</span>
            <span className="text-sky-300">{t.away} {pct(mr.away)}</span>
          </div>
        </div>
      )}

      {/* Üst/Alt + KG */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {data.overUnder25 && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 flex items-center justify-between">
            <span className="text-[11px] text-content-muted">{t.over}</span>
            <span className="text-sm font-bold text-content">{pct(data.overUnder25.probability)}</span>
          </div>
        )}
        {data.btts && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 flex items-center justify-between">
            <span className="text-[11px] text-content-muted">{t.btts}</span>
            <span className="text-sm font-bold text-content">{pct(data.btts.probability)}</span>
          </div>
        )}
      </div>

      {/* En olası skorlar */}
      {data.correctScore && data.correctScore.length > 0 && (
        <div>
          <p className="text-[11px] text-content-muted mb-2">{t.topScores}</p>
          <div className="flex flex-wrap gap-2">
            {data.correctScore.slice(0, 6).map((s, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-lg bg-surface-3 border border-line text-content-muted"
              >
                {s.score} <span className="text-brand-400">{pct(s.prob)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
