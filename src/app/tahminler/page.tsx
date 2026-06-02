'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Clock, ShieldCheck, Activity, Target,
  ChevronDown, ChevronUp, RefreshCw, BarChart3,
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useLanguage } from '@/components/LanguageProvider';

interface Prediction {
  fixtureId: number;
  leagueId: number;
  leagueName: string;
  homeId: number; homeName: string;
  awayId: number; awayName: string;
  kickoff: string;
  pHome: number; pDraw: number; pAway: number;
  pOver25: number | null; pBttsYes: number | null;
  lambdaHome: number | null; lambdaAway: number | null;
  pick: string; confidence: number | null;
  rationale: string | null;
  settled: boolean; homeScore: number | null; awayScore: number | null; result: string | null; correct: boolean | null;
}

const LOGO = (id: number | null) =>
  id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '';

function TeamLogo({ id, name }: { id: number | null; name: string }) {
  const [ok, setOk] = useState(true);
  if (!ok || !id) {
    return (
      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/70">
        {(name || '?').slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO(id)} alt={name} onError={() => setOk(false)}
      className="w-10 h-10 object-contain" loading="lazy" />
  );
}

const T = {
  tr: {
    title: 'Tahminler', sub: 'Gerçek maç verisiyle eğitilmiş istatistiksel model (Dixon-Coles) — kalibre olasılıklar',
    matches: 'maç', avgConf: 'Ort. güven', leagues: 'lig', refresh: 'Yenile',
    home: 'Ev sahibi', draw: 'Beraberlik', away: 'Deplasman',
    pick: 'Tahmin', conf: 'Güven', over: 'Üst 2.5', btts: 'KG Var',
    why: 'Neden?', empty: 'Şu an gösterilecek tahmin yok. Yeni maçlar yaklaştıkça otomatik eklenir.',
    loading: 'Tahminler yükleniyor...', disclaimer: 'Bilgilendirme amaçlıdır, bahis tavsiyesi değildir.',
    sortConf: 'En güvenli', sortTime: 'Saate göre',
  },
  en: {
    title: 'Predictions', sub: 'Statistical model (Dixon-Coles) trained on real match data — calibrated probabilities',
    matches: 'matches', avgConf: 'Avg. confidence', leagues: 'leagues', refresh: 'Refresh',
    home: 'Home', draw: 'Draw', away: 'Away',
    pick: 'Pick', conf: 'Confidence', over: 'Over 2.5', btts: 'BTTS',
    why: 'Why?', empty: 'No predictions to show right now. They appear automatically as matches approach.',
    loading: 'Loading predictions...', disclaimer: 'For information only, not betting advice.',
    sortConf: 'Most confident', sortTime: 'By time',
  },
};

function pct(x: number | null | undefined) {
  return x == null ? '–' : `${Math.round(x * 100)}%`;
}

export default function TahminlerPage() {
  const { lang } = useLanguage();
  const t = (T as any)[lang] || T.en;

  const [preds, setPreds] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'conf' | 'time'>('conf');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/predictions/list', { cache: 'no-store' });
      const data = await res.json();
      setPreds(data.predictions || []);
    } catch {
      setPreds([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    const arr = [...preds];
    if (sortBy === 'conf') arr.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    else arr.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    return arr;
  }, [preds, sortBy]);

  const stats = useMemo(() => {
    const n = preds.length;
    const avg = n ? preds.reduce((s, p) => s + (p.confidence || 0), 0) / n : 0;
    const leagues = new Set(preds.map((p) => p.leagueId)).size;
    return { n, avg, leagues };
  }, [preds]);

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-body)' }}>
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 pt-28 pb-20">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 text-xs mb-4">
            <Activity size={14} /> Dixon-Coles • v1
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}>
            <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto text-sm md:text-base">{t.sub}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: <Target size={18} />, val: stats.n, label: t.matches },
            { icon: <ShieldCheck size={18} />, val: pct(stats.avg), label: t.avgConf },
            { icon: <BarChart3 size={18} />, val: stats.leagues, label: t.leagues },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-cyan-300 mb-1">{s.icon}</div>
              <div className="text-2xl font-bold">{s.val}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-2">
            <button onClick={() => setSortBy('conf')}
              className={`text-xs px-3 py-1.5 rounded-lg border ${sortBy === 'conf' ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/50'}`}>
              {t.sortConf}
            </button>
            <button onClick={() => setSortBy('time')}
              className={`text-xs px-3 py-1.5 rounded-lg border ${sortBy === 'time' ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-white/50'}`}>
              {t.sortTime}
            </button>
          </div>
          <button onClick={load}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t.refresh}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-white/40">
            <RefreshCw className="animate-spin mx-auto mb-3" /> {t.loading}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">
            {t.empty}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {sorted.map((p, i) => (
              <PredictionCard key={p.fixtureId} p={p} t={t} i={i}
                open={open === p.fixtureId}
                onToggle={() => setOpen(open === p.fixtureId ? null : p.fixtureId)} />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-white/30 mt-10">{t.disclaimer}</p>
      </div>
    </div>
  );
}

function PredictionCard({ p, t, i, open, onToggle }: {
  p: Prediction; t: any; i: number; open: boolean; onToggle: () => void;
}) {
  const pickColor = p.pick === '1' ? 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10'
    : p.pick === '2' ? 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10'
    : 'text-amber-300 border-amber-400/40 bg-amber-400/10';
  const pickLabel = p.pick === '1' ? p.homeName : p.pick === '2' ? p.awayName : t.draw;
  const pickTag = p.pick === '1' ? t.home : p.pick === '2' ? t.away : t.draw;
  const conf = Math.round((p.confidence || 0) * 100);
  const ko = p.kickoff ? new Date(p.kickoff) : null;
  const koStr = ko ? ko.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.4) }}
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 hover:border-cyan-400/30 transition-colors">
      {/* league + time */}
      <div className="flex items-center justify-between text-xs text-white/40 mb-3">
        <span className="truncate max-w-[60%]">{p.leagueName || '—'}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {koStr}</span>
      </div>

      {/* teams */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamLogo id={p.homeId} name={p.homeName} />
          <span className="text-xs text-center text-white/80 truncate w-full">{p.homeName}</span>
        </div>
        <div className="text-white/30 text-xs font-bold px-2">VS</div>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamLogo id={p.awayId} name={p.awayName} />
          <span className="text-xs text-center text-white/80 truncate w-full">{p.awayName}</span>
        </div>
      </div>

      {/* pick + confidence */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex-1 rounded-xl border ${pickColor} px-3 py-2`}>
          <div className="text-[10px] uppercase tracking-wide opacity-60">{pickTag}</div>
          <div className="font-bold text-sm truncate flex items-center gap-1">
            <TrendingUp size={14} /> {pickLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{conf}%</div>
          <div className="text-[10px] text-white/40">{t.conf}</div>
        </div>
      </div>

      {/* probability split bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-1">
        <div style={{ width: `${p.pHome * 100}%` }} className="bg-cyan-400/70" />
        <div style={{ width: `${p.pDraw * 100}%` }} className="bg-amber-400/70" />
        <div style={{ width: `${p.pAway * 100}%` }} className="bg-fuchsia-500/70" />
      </div>
      <div className="flex justify-between text-[10px] text-white/40 mb-3">
        <span>1 · {pct(p.pHome)}</span>
        <span>X · {pct(p.pDraw)}</span>
        <span>2 · {pct(p.pAway)}</span>
      </div>

      {/* chips */}
      <div className="flex gap-2 mb-1">
        <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
          {t.over}: <b className="text-white/80">{pct(p.pOver25)}</b>
        </span>
        <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
          {t.btts}: <b className="text-white/80">{pct(p.pBttsYes)}</b>
        </span>
        {p.rationale && (
          <button onClick={onToggle}
            className="ml-auto text-[11px] px-2 py-1 rounded-lg text-cyan-300/80 hover:text-cyan-300 flex items-center gap-1">
            {t.why} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {open && p.rationale && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 text-xs text-white/60 leading-relaxed border-t border-white/10 pt-2">
          {p.rationale}
        </motion.div>
      )}
    </motion.div>
  );
}
