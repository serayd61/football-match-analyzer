'use client';

// ============================================================================
// EnginePerformance — sonuçlanan motor tahminlerinin doğruluk takibi.
// Salt okuma: /api/v2/predictions/performance. Geçmiş maçlar burada
// "doğru/yanlış" olarak işlenir (settlement cron'u settled=true yapar).
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, CheckCircle2, XCircle, TrendingUp, RefreshCw } from 'lucide-react';

interface RecentItem {
  fixtureId: number;
  leagueName: string | null;
  homeName: string | null;
  awayName: string | null;
  kickoff: string | null;
  pick: string | null;
  confidence: number | null;
  homeScore: number | null;
  awayScore: number | null;
  result: string | null;
  correct: boolean | null;
}
interface PerfData {
  total: number;
  correct: number;
  accuracy: number;
  byPick: { home: { total: number; correct: number }; draw: { total: number; correct: number }; away: { total: number; correct: number } };
  recent: RecentItem[];
}

const STR = {
  tr: { title: 'Motor Performansı', subtitle: 'Sonuçlanan tahminlerin doğruluğu', accuracy: 'Doğruluk', settled: 'Sonuçlanan', hits: 'İsabet', home: 'Ev (1)', draw: 'Beraberlik (X)', away: 'Dep. (2)', pickLabel: 'Tahmin', empty: 'Henüz sonuçlanmış tahmin yok. Maçlar bittikçe otomatik işlenir.', loading: 'Yükleniyor...', locale: 'tr-TR' },
  en: { title: 'Engine Performance', subtitle: 'Accuracy of settled predictions', accuracy: 'Accuracy', settled: 'Settled', hits: 'Hits', home: 'Home (1)', draw: 'Draw (X)', away: 'Away (2)', pickLabel: 'Pick', empty: 'No settled predictions yet. They are processed automatically as matches finish.', loading: 'Loading...', locale: 'en-US' },
  de: { title: 'Engine-Leistung', subtitle: 'Genauigkeit abgeschlossener Vorhersagen', accuracy: 'Genauigkeit', settled: 'Abgeschlossen', hits: 'Treffer', home: 'Heim (1)', draw: 'Unent. (X)', away: 'Ausw. (2)', pickLabel: 'Tipp', empty: 'Noch keine abgeschlossenen Vorhersagen. Sie werden automatisch verarbeitet, sobald Spiele enden.', loading: 'Wird geladen...', locale: 'de-DE' },
};

function pickLabel(pick: string | null, t: any) {
  return pick === '1' ? t.home.split(' ')[0] : pick === '2' ? t.away.split(' ')[0] : pick === 'X' ? t.draw.split(' ')[0] : '—';
}

export default function EnginePerformance({ lang = 'tr', recent = 30 }: { lang?: string; recent?: number }) {
  const t = (STR as any)[lang] || STR.en;
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/predictions/performance?recent=${recent}`, { cache: 'no-store' });
      const j = await res.json();
      setData(j.ok ? j : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [recent]);

  const pickRate = (p?: { total: number; correct: number }) =>
    p && p.total ? `${Math.round((p.correct / p.total) * 100)}%` : '–';

  if (loading) {
    return <div className="text-center py-12 text-white/40"><RefreshCw className="animate-spin mx-auto mb-3" /> {t.loading}</div>;
  }
  if (!data || data.total === 0) {
    return <div className="text-center py-12 text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">{t.empty}</div>;
  }

  return (
    <div>
      {/* Üst istatistikler */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-300 mb-1"><TrendingUp size={18} /></div>
          <div className="text-3xl font-bold text-white">{data.accuracy}%</div>
          <div className="text-xs text-white/40">{t.accuracy}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-brand-300 mb-1"><Target size={18} /></div>
          <div className="text-3xl font-bold text-white">{data.total}</div>
          <div className="text-xs text-white/40">{t.settled}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-300 mb-1"><CheckCircle2 size={18} /></div>
          <div className="text-3xl font-bold text-white">{data.correct}</div>
          <div className="text-xs text-white/40">{t.hits}</div>
        </div>
      </div>

      {/* Pick kırılımı */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[{ k: t.home, v: data.byPick.home }, { k: t.draw, v: data.byPick.draw }, { k: t.away, v: data.byPick.away }].map((x, i) => (
          <span key={i} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60">
            {x.k}: <b className="text-white/85">{pickRate(x.v)}</b> <span className="text-white/30">({x.v.correct}/{x.v.total})</span>
          </span>
        ))}
      </div>

      {/* Sonuçlanan maçlar listesi */}
      <div className="space-y-2">
        {data.recent.map((r, i) => (
          <motion.div key={r.fixtureId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${r.correct ? 'border-emerald-400/25 bg-emerald-400/[0.04]' : 'border-rose-400/20 bg-rose-400/[0.03]'}`}>
            {r.correct ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <XCircle size={18} className="text-rose-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/85 truncate">{r.homeName} <span className="text-white/40">vs</span> {r.awayName}</div>
              <div className="text-[11px] text-white/35 truncate">{r.leagueName || '—'}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-white">{r.homeScore}–{r.awayScore}</div>
              <div className="text-[10px] text-white/40">{t.pickLabel}: {pickLabel(r.pick, t)}{r.confidence != null ? ` · ${Math.round(r.confidence * 100)}%` : ''}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
