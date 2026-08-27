'use client';

import { motion } from 'framer-motion';
import { LineChart } from 'lucide-react';

// ============================================================================
// PİYASA MODELİ KARTI — Dixon-Coles kapsamı DIŞINDAKİ maçlarda, oran
// feed'inden türetilmiş algoritmik zemini gösterir (sources.agents.marketModel).
// DixonColesCard ile aynı görsel dil; fark dürüstçe etiketlenir: olasılıklar
// bahis piyasasının marj arındırılmış kolektif tahminidir.
// Ü/A yalnızca trusted=true iken (ölçüm: Üst tarafı %84, Alt tarafı %39 —
// bkz. lib/market-model.ts), KG hiç gösterilmez.
// ============================================================================

interface MarketModelData {
  provider?: string;
  overround?: number;
  expectedGoals?: { home: number; away: number };
  matchResult?: {
    prediction: 'HOME' | 'DRAW' | 'AWAY';
    probabilities: { home: number; draw: number; away: number };
    confidence: number;
  };
  doubleChance?: { pick: string; p: number } | null;
  overUnder25?: { prediction: string; probability: number; trusted?: boolean };
  mostLikelyScore?: string;
  correctScore?: { score: string; prob: number }[];
}

const L = {
  tr: {
    title: 'Piyasa Modeli',
    subtitle: 'Bahis piyasası oranlarından marj arındırılarak hesaplandı — bu ligde istatistiksel model kapsamı yok, zemin piyasanın kolektif tahmini',
    xg: 'Beklenen Gol (oran türevi)',
    mr: 'Maç Sonucu Olasılıkları',
    home: 'Ev', draw: 'Beraberlik', away: 'Dep',
    score: 'En Olası Skor',
    dc: 'Çifte şans',
    over: 'Üst 2.5 eğilimi',
    topScores: 'En olası skorlar',
  },
  en: {
    title: 'Market Model',
    subtitle: 'Computed from bookmaker odds with margin removed — no statistical model coverage in this league, so the baseline is the market consensus',
    xg: 'Expected Goals (odds-derived)',
    mr: 'Match Result Probabilities',
    home: 'Home', draw: 'Draw', away: 'Away',
    score: 'Most Likely Score',
    dc: 'Double chance',
    over: 'Over 2.5 lean',
    topScores: 'Most likely scores',
  },
  de: {
    title: 'Markt-Modell',
    subtitle: 'Aus Buchmacherquoten berechnet (Marge entfernt) — keine Modellabdeckung in dieser Liga, Basis ist der Marktkonsens',
    xg: 'Erwartete Tore (aus Quoten)',
    mr: 'Spielergebnis-Wahrscheinlichkeiten',
    home: 'Heim', draw: 'Unent.', away: 'Ausw.',
    score: 'Wahrscheinlichstes Ergebnis',
    dc: 'Doppelte Chance',
    over: 'Über 2,5 Tendenz',
    topScores: 'Wahrscheinlichste Ergebnisse',
  },
} as const;

export default function MarketModelCard({
  data,
  lang = 'tr',
}: {
  data: MarketModelData;
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
        <LineChart className="w-5 h-5 text-violet-400" />
        <h3 className="text-lg font-semibold text-content">{t.title}</h3>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
          {data.provider ? String(data.provider).split('_')[0].toUpperCase() : 'MARKET'}
        </span>
      </div>
      <p className="text-xs text-content-muted mb-4">{t.subtitle}</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {data.expectedGoals && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 text-center">
            <p className="text-[11px] text-content-muted mb-1">{t.xg}</p>
            <p className="text-xl font-bold text-violet-400 tabular-nums">
              {data.expectedGoals.home?.toFixed(2)} - {data.expectedGoals.away?.toFixed(2)}
            </p>
          </div>
        )}
        {data.mostLikelyScore && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 text-center">
            <p className="text-[11px] text-content-muted mb-1">{t.score}</p>
            <p className="text-xl font-bold text-violet-400 tabular-nums">{data.mostLikelyScore}</p>
          </div>
        )}
      </div>

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

      {/* Çifte şans + (yalnızca güvenilir tarafta) Üst 2.5 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {data.doubleChance && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 flex items-center justify-between">
            <span className="text-[11px] text-content-muted">{t.dc} · {data.doubleChance.pick}</span>
            <span className="text-sm font-bold text-content">{pct(data.doubleChance.p)}</span>
          </div>
        )}
        {data.overUnder25?.trusted && (
          <div className="bg-surface-3 border border-line rounded-xl p-3 flex items-center justify-between">
            <span className="text-[11px] text-content-muted">{t.over}</span>
            <span className="text-sm font-bold text-content">{pct(data.overUnder25.probability)}</span>
          </div>
        )}
      </div>

      {data.correctScore && data.correctScore.length > 0 && (
        <div>
          <p className="text-[11px] text-content-muted mb-2">{t.topScores}</p>
          <div className="flex flex-wrap gap-2">
            {data.correctScore.slice(0, 6).map((s, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-lg bg-surface-3 border border-line text-content-muted"
              >
                {s.score} <span className="text-violet-400">{pct(s.prob)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
