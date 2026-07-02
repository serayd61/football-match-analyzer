'use client';

// ============================================================================
// EnginePredictions — yeni Dixon-Coles motorunun tahminlerini gösteren
// tekrar kullanılır bileşen. /tahminler, /dashboard ve /league-stats kullanır.
// Salt okuma: /api/v2/predictions/list. Auth/abonelik mantığına dokunmaz.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp, Clock, ShieldCheck, Target, BarChart3,
  ChevronDown, ChevronUp, RefreshCw, Lock, Crown,
} from 'lucide-react';

export interface Prediction {
  fixtureId: number;
  leagueId: number; leagueName: string;
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

function pct(x: number | null | undefined) {
  return x == null ? '–' : `${Math.round(x * 100)}%`;
}

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

const STR = {
  tr: { home: 'Ev sahibi', draw: 'Beraberlik', away: 'Deplasman', conf: 'Güven',
    over: 'Üst 2.5', btts: 'KG Var', why: 'Neden?', matches: 'maç', avgConf: 'Ort. güven',
    leagues: 'lig', refresh: 'Yenile', sortConf: 'En güvenli', sortTime: 'Saate göre',
    empty: 'Şu an gösterilecek tahmin yok. Yeni maçlar yaklaştıkça otomatik eklenir.',
    loading: 'Tahminler yükleniyor...', locale: 'tr-TR',
    gateAuthTitle: 'Tahminleri görmek için giriş yapın',
    gateAuthDesc: 'Motor tahminleri yalnızca üyelere açıktır.',
    gateAuthCta: 'Giriş yap / Üye ol',
    gateSubTitle: 'Motorun günlük tahminleri Pro üyelere açık',
    gateSubDesc: '7 gün ücretsiz deneyin, dilediğiniz zaman iptal edin.',
    gateSubCta: '7 gün ücretsiz dene',
    teaserLeagues: 'lig test edildi', teaserMatches: 'gerçek maçta doğrulandı',
    teaserAcc: '1X2 isabet', teaserLink: 'Şeffaf sonuç kaydını gör →' },
  en: { home: 'Home', draw: 'Draw', away: 'Away', conf: 'Confidence',
    over: 'Over 2.5', btts: 'BTTS', why: 'Why?', matches: 'matches', avgConf: 'Avg. conf.',
    leagues: 'leagues', refresh: 'Refresh', sortConf: 'Most confident', sortTime: 'By time',
    empty: 'No predictions to show right now. They appear automatically as matches approach.',
    loading: 'Loading predictions...', locale: 'en-US',
    gateAuthTitle: 'Sign in to see predictions',
    gateAuthDesc: 'Engine predictions are available to members only.',
    gateAuthCta: 'Sign in / Sign up',
    gateSubTitle: 'Daily engine picks are for Pro members',
    gateSubDesc: 'Try free for 7 days, cancel anytime.',
    gateSubCta: 'Start 7-day free trial',
    teaserLeagues: 'leagues tested', teaserMatches: 'real matches backtested',
    teaserAcc: '1X2 accuracy', teaserLink: 'See the transparent track record →' },
  de: { home: 'Heim', draw: 'Unent.', away: 'Auswärts', conf: 'Konfidenz',
    over: 'Über 2.5', btts: 'BTTS', why: 'Warum?', matches: 'Spiele', avgConf: 'Ø Konfidenz',
    leagues: 'Ligen', refresh: 'Aktualisieren', sortConf: 'Sicherste', sortTime: 'Nach Zeit',
    empty: 'Derzeit keine Vorhersagen. Sie erscheinen automatisch, sobald Spiele näher rücken.',
    loading: 'Vorhersagen werden geladen...', locale: 'de-DE',
    gateAuthTitle: 'Zum Ansehen anmelden',
    gateAuthDesc: 'Engine-Vorhersagen sind nur für Mitglieder verfügbar.',
    gateAuthCta: 'Anmelden / Registrieren',
    gateSubTitle: 'Tägliche Engine-Tipps sind Pro-Mitgliedern vorbehalten',
    gateSubDesc: '7 Tage kostenlos testen, jederzeit kündbar.',
    gateSubCta: '7 Tage kostenlos testen',
    teaserLeagues: 'Ligen getestet', teaserMatches: 'echte Spiele im Backtest',
    teaserAcc: '1X2-Trefferquote', teaserLink: 'Transparente Erfolgsbilanz ansehen →' },
};

export default function EnginePredictions({
  lang = 'tr',
  groupByLeague = false,
  showStats = true,
  showControls = true,
  limit,
}: {
  lang?: string;
  groupByLeague?: boolean;
  showStats?: boolean;
  showControls?: boolean;
  limit?: number;
}) {
  const t = (STR as any)[lang] || STR.en;
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'conf' | 'time'>('conf');
  const [gate, setGate] = useState<null | 'auth' | 'subscription'>(null);
  // Kilitli durumda gösterilen GERÇEK kanıt (public backtest özeti)
  const [proof, setProof] = useState<{ leagues: number; totalTested: number; mrAccuracy: number } | null>(null);

  useEffect(() => {
    if (gate !== 'subscription' || proof) return;
    fetch('/api/v2/dc-backtest')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.ok && d.summary?.totalTested > 0) setProof(d.summary); })
      .catch(() => {});
  }, [gate, proof]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/predictions/list', { cache: 'no-store' });
      if (res.status === 401) { setGate('auth'); setPreds([]); return; }
      if (res.status === 403) { setGate('subscription'); setPreds([]); return; }
      const data = await res.json();
      setGate(null);
      setPreds(data.predictions || []);
    } catch {
      setPreds([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    let arr = [...preds];
    if (sortBy === 'conf') arr.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    else arr.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    if (limit) arr = arr.slice(0, limit);
    return arr;
  }, [preds, sortBy, limit]);

  const stats = useMemo(() => {
    const n = preds.length;
    const avg = n ? preds.reduce((s, p) => s + (p.confidence || 0), 0) / n : 0;
    const leagues = new Set(preds.map((p) => p.leagueId)).size;
    return { n, avg, leagues };
  }, [preds]);

  const groups = useMemo(() => {
    if (!groupByLeague) return null;
    const m = new Map<string, Prediction[]>();
    for (const p of sorted) {
      const k = p.leagueName || `Lig ${p.leagueId}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [sorted, groupByLeague]);

  // Erişim engeli: giriş yok (auth) ya da abonelik yok (subscription).
  // Subscription durumu boş bir "kilit kutusu" değil, GERÇEK kanıtlı bir
  // value-teaser gösterir: public backtest özeti + blurlu içerik silueti.
  if (!loading && gate) {
    const isAuth = gate === 'auth';
    const accPct = proof
      ? Math.round((proof.mrAccuracy > 1 ? proof.mrAccuracy : proof.mrAccuracy * 100) * 10) / 10
      : null;
    return (
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 overflow-hidden">
        {/* Blurlu içerik silueti — arkada gerçek bir ürün olduğunu hissettirir */}
        {!isAuth && (
          <div aria-hidden className="absolute inset-0 p-6 blur-[7px] opacity-30 pointer-events-none select-none">
            <div className="grid md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="h-3 w-1/2 bg-white/20 rounded mb-3" />
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-white/15" />
                    <div className="h-3 w-6 bg-white/10 rounded" />
                    <div className="w-10 h-10 rounded-full bg-white/15" />
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div className="bg-brand-400/70" style={{ width: '48%' }} />
                    <div className="bg-amber-400/70" style={{ width: '27%' }} />
                    <div className="bg-sky-500/70" style={{ width: '25%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-400/10 border border-brand-400/30 flex items-center justify-center text-brand-300">
            {isAuth ? <Lock size={24} /> : <Crown size={24} />}
          </div>
          <h3 className="text-lg font-bold text-white mb-1">{isAuth ? t.gateAuthTitle : t.gateSubTitle}</h3>
          <p className="text-sm text-white/50 mb-5 max-w-md mx-auto">{isAuth ? t.gateAuthDesc : t.gateSubDesc}</p>

          {/* Gerçek kanıt şeridi (dc_backtest_results, public) */}
          {!isAuth && proof && (
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
              {[
                { val: proof.leagues, label: t.teaserLeagues },
                { val: proof.totalTested.toLocaleString(t.locale), label: t.teaserMatches },
                { val: `%${accPct}`, label: t.teaserAcc },
              ].map((s, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="text-xl font-bold text-white">{s.val}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <Link
            href={isAuth ? '/login' : '/pricing'}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:opacity-90 transition-opacity"
          >
            {isAuth ? t.gateAuthCta : t.gateSubCta}
          </Link>

          {!isAuth && (
            <div className="mt-4">
              <Link href="/track-record" className="text-xs text-brand-300/80 hover:text-brand-300 transition-colors">
                {t.teaserLink}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {showStats && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: <Target size={18} />, val: stats.n, label: t.matches },
            { icon: <ShieldCheck size={18} />, val: pct(stats.avg), label: t.avgConf },
            { icon: <BarChart3 size={18} />, val: stats.leagues, label: t.leagues },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-brand-300 mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.val}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {showControls && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button onClick={() => setSortBy('conf')}
              className={`text-xs px-3 py-1.5 rounded-lg border ${sortBy === 'conf' ? 'border-brand-400/50 bg-brand-400/10 text-brand-300' : 'border-white/10 text-white/50'}`}>
              {t.sortConf}
            </button>
            <button onClick={() => setSortBy('time')}
              className={`text-xs px-3 py-1.5 rounded-lg border ${sortBy === 'time' ? 'border-brand-400/50 bg-brand-400/10 text-brand-300' : 'border-white/10 text-white/50'}`}>
              {t.sortTime}
            </button>
          </div>
          <button onClick={load}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t.refresh}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-white/40">
          <RefreshCw className="animate-spin mx-auto mb-3" /> {t.loading}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">
          {t.empty}
        </div>
      ) : groupByLeague && groups ? (
        <div className="space-y-8">
          {groups.map(([league, items]) => (
            <div key={league}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-brand-300">{league}</h3>
                <span className="text-xs text-white/30">{items.length} {t.matches}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {items.map((p, i) => (
                  <PredictionCard key={p.fixtureId} p={p} t={t} i={i}
                    open={open === p.fixtureId}
                    onToggle={() => setOpen(open === p.fixtureId ? null : p.fixtureId)} />
                ))}
              </div>
            </div>
          ))}
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
    </div>
  );
}

function PredictionCard({ p, t, i, open, onToggle }: {
  p: Prediction; t: any; i: number; open: boolean; onToggle: () => void;
}) {
  const pickColor = p.pick === '1' ? 'text-brand-300 border-brand-400/40 bg-brand-400/10'
    : p.pick === '2' ? 'text-sky-300 border-sky-400/40 bg-sky-400/10'
    : 'text-amber-300 border-amber-400/40 bg-amber-400/10';
  const pickLabel = p.pick === '1' ? p.homeName : p.pick === '2' ? p.awayName : t.draw;
  const pickTag = p.pick === '1' ? t.home : p.pick === '2' ? t.away : t.draw;
  const conf = Math.round((p.confidence || 0) * 100);
  const ko = p.kickoff ? new Date(p.kickoff) : null;
  const koStr = ko ? ko.toLocaleString(t.locale || undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.4) }}
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 hover:border-brand-400/30 transition-colors">
      <div className="flex items-center justify-between text-xs text-white/40 mb-3">
        <span className="truncate max-w-[60%]">{p.leagueName || '—'}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {koStr}</span>
      </div>

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

      <div className="flex items-center gap-3 mb-3">
        <div className={`flex-1 rounded-xl border ${pickColor} px-3 py-2`}>
          <div className="text-[10px] uppercase tracking-wide opacity-60">{pickTag}</div>
          <div className="font-bold text-sm truncate flex items-center gap-1">
            <TrendingUp size={14} /> {pickLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{conf}%</div>
          <div className="text-[10px] text-white/40">{t.conf}</div>
        </div>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden mb-1">
        <div style={{ width: `${p.pHome * 100}%` }} className="bg-brand-400/70" />
        <div style={{ width: `${p.pDraw * 100}%` }} className="bg-amber-400/70" />
        <div style={{ width: `${p.pAway * 100}%` }} className="bg-sky-500/70" />
      </div>
      <div className="flex justify-between text-[10px] text-white/40 mb-3">
        <span>1 · {pct(p.pHome)}</span>
        <span>X · {pct(p.pDraw)}</span>
        <span>2 · {pct(p.pAway)}</span>
      </div>

      <div className="flex gap-2 mb-1">
        <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
          {t.over}: <b className="text-white/80">{pct(p.pOver25)}</b>
        </span>
        <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
          {t.btts}: <b className="text-white/80">{pct(p.pBttsYes)}</b>
        </span>
        {p.rationale && (
          <button onClick={onToggle}
            className="ml-auto text-[11px] px-2 py-1 rounded-lg text-brand-300/80 hover:text-brand-300 flex items-center gap-1">
            {t.why} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {open && p.rationale && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-2 text-xs text-white/60 leading-relaxed border-t border-white/10 pt-2">
          {p.rationale}
        </motion.div>
      )}
    </motion.div>
  );
}
