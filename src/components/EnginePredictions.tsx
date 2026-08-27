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
  ChevronDown, ChevronUp, RefreshCw, Lock, Crown, History, CalendarDays,
} from 'lucide-react';
import { displayLeague } from '@/lib/league-names';
import { countryInfo } from '@/lib/countries';

import { deriveDoubleChance, doubleChanceLabel, isDoubleChanceCorrect } from '@/lib/double-chance';
import {
  goalMarketLabel, isOverUnderCorrect, isBttsCorrect, MARKET_EDGE,
  type OverUnderPick, type BttsPick,
} from '@/lib/goal-markets';

export interface Prediction {
  fixtureId: number;
  leagueId: number; leagueName: string; leagueCcode?: string;
  homeId: number; homeName: string;
  awayId: number; awayName: string;
  kickoff: string;
  pHome: number; pDraw: number; pAway: number;
  pOver25: number | null; pBttsYes: number | null;
  // Gol pazarları — API'de türetilir; `p` KALİBRE güvendir (ham: pRaw).
  overUnder?: { pick: OverUnderPick; p: number | null; pRaw: number } | null;
  btts?: { pick: BttsPick; p: number | null; pRaw: number } | null;
  lambdaHome: number | null; lambdaAway: number | null;
  pick: string; confidence: number | null;
  rationale: string | null;
  settled: boolean; homeScore: number | null; awayScore: number | null; result: string | null; correct: boolean | null;
}

const LOGO = (id: number | null) =>
  id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '';

// Karne (sonuçlar) API cevabındaki pazar özeti — bkz. predictions/list ?results=
interface MarketSum { n: number; ok: number; hiN: number; hiOk: number }
interface ResultsSummary { x12: MarketSum; dc: MarketSum; ou25: MarketSum; btts: MarketSum }

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
    dcTitle: 'Güvenli seçim', dcHint: 'iki sonucu birden kapsar', lang: 'tr' as const,
    mkTitle: 'Pazarlar', mkDc: 'Çifte şans', mkOu: 'Toplam gol', mkBtts: 'Karşılıklı gol',
    mkCalibNote: 'Yüzdeler geçmiş sonuçlarla kalibre edilmiştir',
    recentTitle: 'Sonuçlanan tahminler', recentSub: 'son 3 gün — sonra listeden düşer',
    tabUpcoming: 'Tahminler', tabResults: 'Sonuçlar & Karne',
    resTitle: 'Pazar karnesi',
    resSub: (d: number) => `son ${d} gün · yalnızca model kapsamındaki ligler`,
    resDays: (d: number) => `${d} gün`,
    mk1x2: 'Maç sonucu',
    resHi1x2: 'güven ≥ %60', resHiDc: 'güven ≥ %75', resHiGoal: 'gösterilenler (≥ %55)',
    resEmpty: 'Bu aralıkta sonuçlanmış tahmin yok.',
    resShowing: (a: number, b: number) => `son ${a} maç listeleniyor · özet ${b} maçın tamamından`,
    resAllLink: 'Tüm sonuçlar →',
    resHit: 'isabet',
    gateAuthTitle: 'Tahminleri görmek için giriş yapın',
    gateAuthDesc: 'Motor tahminleri yalnızca üyelere açıktır.',
    gateAuthCta: 'Giriş yap / Üye ol',
    gateSubTitle: 'Motorun günlük tahminleri Pro üyelere açık',
    gateSubDesc: '7 gün ücretsiz deneyin, dilediğiniz zaman iptal edin.',
    gateSubCta: '7 gün ücretsiz dene',
    teaserLeagues: 'lig test edildi', teaserMatches: 'gerçek maçta doğrulandı',
    teaserAcc: '1X2 isabet', teaserLink: 'Şeffaf sonuç kaydını gör →',
    uncTitle: 'Model kapsamı dışında',
    uncDesc: 'Bu liglerin takım gücü parametreleri eğitilmedi — sayılar genel istatistiksel yedekten gelir, güvenilirliği düşüktür. Yukarıdaki istatistiklere ve karneye dahil DEĞİLDİR.',
    uncShow: (n: number) => `${n} tahmini göster`, uncHide: 'Gizle' },
  en: { home: 'Home', draw: 'Draw', away: 'Away', conf: 'Confidence',
    over: 'Over 2.5', btts: 'BTTS', why: 'Why?', matches: 'matches', avgConf: 'Avg. conf.',
    leagues: 'leagues', refresh: 'Refresh', sortConf: 'Most confident', sortTime: 'By time',
    empty: 'No predictions to show right now. They appear automatically as matches approach.',
    loading: 'Loading predictions...', locale: 'en-US',
    dcTitle: 'Safer call', dcHint: 'covers two outcomes', lang: 'en' as const,
    mkTitle: 'Markets', mkDc: 'Double chance', mkOu: 'Total goals', mkBtts: 'Both teams to score',
    mkCalibNote: 'Percentages are calibrated against past results',
    recentTitle: 'Settled predictions', recentSub: 'last 3 days — then they roll off',
    tabUpcoming: 'Predictions', tabResults: 'Results & record',
    resTitle: 'Market scorecard',
    resSub: (d: number) => `last ${d} days · model-covered leagues only`,
    resDays: (d: number) => `${d} days`,
    mk1x2: 'Match result',
    resHi1x2: 'confidence ≥ 60%', resHiDc: 'confidence ≥ 75%', resHiGoal: 'displayed picks (≥ 55%)',
    resEmpty: 'No settled predictions in this window.',
    resShowing: (a: number, b: number) => `showing last ${a} matches · summary covers all ${b}`,
    resAllLink: 'All results →',
    resHit: 'hit rate',
    gateAuthTitle: 'Sign in to see predictions',
    gateAuthDesc: 'Engine predictions are available to members only.',
    gateAuthCta: 'Sign in / Sign up',
    gateSubTitle: 'Daily engine picks are for Pro members',
    gateSubDesc: 'Try free for 7 days, cancel anytime.',
    gateSubCta: 'Start 7-day free trial',
    teaserLeagues: 'leagues tested', teaserMatches: 'real matches backtested',
    teaserAcc: '1X2 accuracy', teaserLink: 'See the transparent track record →',
    uncTitle: 'Outside model coverage',
    uncDesc: 'Team-strength parameters were not fitted for these leagues — the numbers come from a generic statistical fallback and are less reliable. NOT included in the stats or track record above.',
    uncShow: (n: number) => `Show ${n} predictions`, uncHide: 'Hide' },
  de: { home: 'Heim', draw: 'Unent.', away: 'Auswärts', conf: 'Konfidenz',
    over: 'Über 2.5', btts: 'BTTS', why: 'Warum?', matches: 'Spiele', avgConf: 'Ø Konfidenz',
    leagues: 'Ligen', refresh: 'Aktualisieren', sortConf: 'Sicherste', sortTime: 'Nach Zeit',
    empty: 'Derzeit keine Vorhersagen. Sie erscheinen automatisch, sobald Spiele näher rücken.',
    loading: 'Vorhersagen werden geladen...', locale: 'de-DE',
    dcTitle: 'Sichere Wahl', dcHint: 'deckt zwei Ergebnisse ab', lang: 'de' as const,
    mkTitle: 'Märkte', mkDc: 'Doppelte Chance', mkOu: 'Tore gesamt', mkBtts: 'Beide Teams treffen',
    mkCalibNote: 'Prozentwerte sind mit vergangenen Ergebnissen kalibriert',
    recentTitle: 'Abgeschlossene Tipps', recentSub: 'letzte 3 Tage — danach ausgeblendet',
    tabUpcoming: 'Vorhersagen', tabResults: 'Ergebnisse & Bilanz',
    resTitle: 'Markt-Bilanz',
    resSub: (d: number) => `letzte ${d} Tage · nur Ligen mit Modellabdeckung`,
    resDays: (d: number) => `${d} Tage`,
    mk1x2: 'Spielausgang',
    resHi1x2: 'Konfidenz ≥ 60 %', resHiDc: 'Konfidenz ≥ 75 %', resHiGoal: 'angezeigte Picks (≥ 55 %)',
    resEmpty: 'Keine abgeschlossenen Tipps in diesem Zeitraum.',
    resShowing: (a: number, b: number) => `letzte ${a} Spiele gelistet · Bilanz über alle ${b}`,
    resAllLink: 'Alle Ergebnisse →',
    resHit: 'Trefferquote',
    gateAuthTitle: 'Zum Ansehen anmelden',
    gateAuthDesc: 'Engine-Vorhersagen sind nur für Mitglieder verfügbar.',
    gateAuthCta: 'Anmelden / Registrieren',
    gateSubTitle: 'Tägliche Engine-Tipps sind Pro-Mitgliedern vorbehalten',
    gateSubDesc: '7 Tage kostenlos testen, jederzeit kündbar.',
    gateSubCta: '7 Tage kostenlos testen',
    teaserLeagues: 'Ligen getestet', teaserMatches: 'echte Spiele im Backtest',
    teaserAcc: '1X2-Trefferquote', teaserLink: 'Transparente Erfolgsbilanz ansehen →',
    uncTitle: 'Ausserhalb der Modellabdeckung',
    uncDesc: 'Für diese Ligen wurden keine Teamstärke-Parameter trainiert — die Zahlen stammen aus einem generischen statistischen Fallback und sind weniger verlässlich. NICHT in den Statistiken oben enthalten.',
    uncShow: (n: number) => `${n} Vorhersagen anzeigen`, uncHide: 'Ausblenden' },
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
  // Modeli fit EDİLMEMİŞ liglerin tahminleri — ayrı tutulur, ayrı etiketlenir.
  // İstatistik şeridi ve karne bunları ASLA içermez (bkz. lib/model-coverage).
  const [uncovered, setUncovered] = useState<Prediction[]>([]);
  // Son 3 günün SONUÇLANMIŞ tahminleri — maç başlayınca kart yok olmasın
  // diye (istek 2026-08-25); skor + tuttu/tutmadı ile gösterilir.
  const [recent, setRecent] = useState<Prediction[]>([]);
  const [showUncovered, setShowUncovered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'conf' | 'time'>('conf');
  const [gate, setGate] = useState<null | 'auth' | 'subscription'>(null);
  // Kilitli durumda gösterilen GERÇEK kanıt (public backtest özeti)
  const [proof, setProof] = useState<{ leagues: number; totalTested: number; mrAccuracy: number } | null>(null);
  // --- Sonuçlar & Karne sekmesi (istek 2026-08-27): bitmiş maçların pazar
  // bazında isabet yüzdeleri + tarihe gruplu sonuç listesi. Özet SUNUCUDA
  // hesaplanır (?results=N) — pencere binlerce satır olabilir. Sekmeler
  // yalnızca tam sayfada (showControls) görünür; dashboard gömme etkilenmez.
  const [view, setView] = useState<'upcoming' | 'results'>('upcoming');
  const [results, setResults] = useState<Prediction[]>([]);
  const [resSummary, setResSummary] = useState<ResultsSummary | null>(null);
  const [resTotal, setResTotal] = useState(0);
  const [resDays, setResDays] = useState<number>(30);
  const [resLoading, setResLoading] = useState(false);
  const [resFetchedDays, setResFetchedDays] = useState<number | null>(null);

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
      if (res.status === 401) { setGate('auth'); setPreds([]); setUncovered([]); setRecent([]); return; }
      if (res.status === 403) { setGate('subscription'); setPreds([]); setUncovered([]); setRecent([]); return; }
      const data = await res.json();
      setGate(null);
      setPreds(data.predictions || []);
      setUncovered(data.uncovered || []);
      setRecent(data.recentResults || []);
    } catch {
      setPreds([]);
      setUncovered([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function loadResults(days: number) {
    setResLoading(true);
    try {
      const res = await fetch(`/api/v2/predictions/list?results=${days}`, { cache: 'no-store' });
      if (res.status === 401) { setGate('auth'); return; }
      if (res.status === 403) { setGate('subscription'); return; }
      const data = await res.json();
      setGate(null);
      setResults(data.results || []);
      setResSummary(data.summary || null);
      setResTotal(data.totalRows || 0);
      setResFetchedDays(days);
    } catch {
      setResults([]); setResSummary(null); setResTotal(0);
    } finally {
      setResLoading(false);
    }
  }
  useEffect(() => {
    if (view === 'results' && resFetchedDays !== resDays) loadResults(resDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, resDays]);

  // Sonuçlar güne gruplanır (API'den kickoff azalan gelir → grup sırası korunur)
  const resGroups = useMemo(() => {
    const m = new Map<string, Prediction[]>();
    for (const p of results) {
      const k = p.kickoff
        ? new Date(p.kickoff).toLocaleDateString(t.locale || undefined, { weekday: 'long', day: '2-digit', month: 'long' })
        : '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries());
  }, [results, t.locale]);

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
      // Bayrak + lig adı ("🏴 EFL Cup"); ad çözülmemişse #id yerine ülke+#id
      const base = displayLeague(p.leagueName, p.leagueId) || `#${p.leagueId}`;
      const ci = countryInfo(p.leagueCcode);
      const k = ci ? `${ci.flag} ${base}` : base;
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

  const isResults = showControls && view === 'results';

  return (
    <div>
      {/* Sekmeler: Tahminler | Sonuçlar & Karne — yalnızca tam sayfada */}
      {showControls && (
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl border border-white/10 bg-white/[0.03] w-fit">
          {([
            ['upcoming', <TrendingUp key="i" size={14} />, t.tabUpcoming],
            ['results', <History key="i" size={14} />, t.tabResults],
          ] as const).map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors ${
                view === v
                  ? 'bg-brand-400/15 text-brand-200 border border-brand-400/30'
                  : 'text-white/50 hover:text-white/80 border border-transparent'
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {isResults ? (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white/85 flex items-center gap-2">
                <CalendarDays size={15} className="text-brand-300" /> {t.resTitle}
              </h3>
              <p className="text-xs text-white/35 mt-0.5">{t.resSub(resDays)}</p>
            </div>
            <div className="flex gap-2">
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => setResDays(d)}
                  className={`text-xs px-3 py-1.5 rounded-lg border tabular-nums ${
                    resDays === d
                      ? 'border-brand-400/50 bg-brand-400/10 text-brand-300'
                      : 'border-white/10 text-white/50 hover:text-white/80'
                  }`}>
                  {t.resDays(d)}
                </button>
              ))}
            </div>
          </div>

          {resLoading ? (
            <div className="text-center py-16 text-white/40">
              <RefreshCw className="animate-spin mx-auto mb-3" /> {t.loading}
            </div>
          ) : !resSummary || resTotal === 0 ? (
            <div className="text-center text-white/40 border border-white/10 rounded-2xl bg-white/[0.02] py-16">
              {t.resEmpty}
            </div>
          ) : (
            <>
              {/* Pazar karnesi: genel isabet + yüksek-güven dilimi. Bu yüzdeler
                  kullanıcının "neye ne kadar güveneyim" sorusunun cevabıdır. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <ScoreCard title={`1X2 · ${t.mk1x2}`} sum={resSummary.x12} hiLabel={t.resHi1x2}
                  icon={<TrendingUp size={13} className="text-brand-300/90" />}
                  accentText="text-brand-300" accentBar="bg-brand-400/80" />
                <ScoreCard title={t.mkDc} sum={resSummary.dc} hiLabel={t.resHiDc}
                  icon={<ShieldCheck size={13} className="text-emerald-300/90" />}
                  accentText="text-emerald-300" accentBar="bg-emerald-400/80" />
                <ScoreCard title={t.mkOu} sum={resSummary.ou25} hiLabel={t.resHiGoal}
                  icon={<Target size={13} className="text-violet-300/90" />}
                  accentText="text-violet-300" accentBar="bg-violet-400/80" />
                <ScoreCard title={t.mkBtts} sum={resSummary.btts} hiLabel={t.resHiGoal}
                  icon={<BarChart3 size={13} className="text-sky-300/90" />}
                  accentText="text-sky-300" accentBar="bg-sky-400/80" />
              </div>
              <p className="text-[10px] text-white/25 mb-6">{t.mkCalibNote}</p>

              <div className="space-y-5">
                {resGroups.map(([day, items]) => {
                  const dayN = items.filter((r) => r.correct != null).length;
                  const dayOk = items.filter((r) => r.correct === true).length;
                  return (
                    <div key={day}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-xs font-bold text-white/60">{day}</h4>
                        <span className="text-[10px] text-white/30">{items.length} {t.matches}</span>
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-[10px] text-white/40 tabular-nums">
                          1X2 · {dayOk}/{dayN}
                        </span>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
                        {items.map((p) => <SettledRow key={p.fixtureId} p={p} t={t} />)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {resTotal > results.length && (
                <p className="text-center text-[11px] text-white/30 mt-5">
                  {t.resShowing(results.length, resTotal)}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
      <>
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
        // Kapsam dışı tahminler varsa boş kutu daha kısa: asıl mesaj alttaki
        // sarı bölümde ("modelli ligde şu an maç yok, elimizdekiler bunlar").
        <div className={`text-center text-white/40 border border-white/10 rounded-2xl bg-white/[0.02] ${uncovered.length ? 'py-8 text-sm' : 'py-16'}`}>
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

      {/* --- Sonuçlanan tahminler (son 3 gün): maç başlayınca "yok olmak"
          yerine skor + tuttu/tutmadı ile burada kalır, 72 saat sonra düşer.
          Yalnızca kapsanan ligler (API tarafında filtreli) — karneyle tutarlı. --- */}
      {!loading && recent.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-bold text-white/80">{t.recentTitle}</h3>
            <span className="text-xs text-white/30">{t.recentSub}</span>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/50 tabular-nums">
              {recent.filter((r) => r.correct === true).length}/{recent.length} · {t.teaserAcc}
            </span>
            {showControls && (
              <button onClick={() => setView('results')}
                className="text-xs text-brand-300/80 hover:text-brand-300 transition-colors">
                {t.resAllLink}
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
            {recent.map((p) => <SettledRow key={p.fixtureId} p={p} t={t} />)}
          </div>
        </div>
      )}

      {/* --- Model kapsamı dışı: ayrı bölüm, varsayılan KAPALI, açıkça uyarılı.
          Gizlemek yerine etiketlemek: sayfa boş kalmaz ama kullanıcı hangisinin
          gerçek motor çıktısı olduğunu karıştırmaz. --- */}
      {!loading && uncovered.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-amber-200/90">{t.uncTitle}</h3>
              <p className="text-xs text-white/45 mt-1 max-w-2xl">{t.uncDesc}</p>
            </div>
            <button
              onClick={() => setShowUncovered((v) => !v)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-amber-400/30 text-amber-200/80 hover:bg-amber-400/10 transition-colors"
            >
              {showUncovered ? t.uncHide : t.uncShow(uncovered.length)}
            </button>
          </div>

          {showUncovered && (
            <div className="grid md:grid-cols-2 gap-4 mt-4 opacity-70">
              {uncovered
                .slice()
                .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                .map((p, i) => (
                  <PredictionCard key={p.fixtureId} p={p} t={t} i={i}
                    open={open === p.fixtureId}
                    onToggle={() => setOpen(open === p.fixtureId ? null : p.fixtureId)} />
                ))}
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// Karne kartı: pazar adı + büyük genel isabet yüzdesi + n/ok sayacı + ince
// çubuk + yüksek-güven dilimi. Yüzdeler API özetinden gelir (sunucuda, tüm
// pencere üzerinden hesaplı) — listedeki 150 satırdan DEĞİL.
function ScoreCard({ title, sum, hiLabel, icon, accentText, accentBar }: {
  title: string; sum: MarketSum; hiLabel: string;
  icon: React.ReactNode; accentText: string; accentBar: string;
}) {
  const p = sum.n ? Math.round((sum.ok / sum.n) * 100) : null;
  const hp = sum.hiN ? Math.round((sum.hiOk / sum.hiN) * 100) : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
        {icon} <span className="truncate">{title}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className={`text-2xl font-bold tabular-nums ${accentText}`}>{p == null ? '–' : `${p}%`}</span>
        <span className="text-[11px] text-white/40 tabular-nums">{sum.ok}/{sum.n}</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-2">
        <div className={`h-full rounded-full ${accentBar}`} style={{ width: `${p ?? 0}%` }} />
      </div>
      <div className="mt-2.5 pt-2 border-t border-white/[0.07] text-[10px] text-white/40 flex items-center justify-between gap-2">
        <span className="truncate">{hiLabel}</span>
        <span className="font-bold tabular-nums text-white/70">
          {hp == null ? '–' : `${hp}%`}
          <span className="font-normal text-white/35"> · {sum.hiN}</span>
        </span>
      </div>
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
  // Çifte şans: aynı olasılıklardan türetilir. 1X2 argmax yapısal olarak
  // tavanlı (maçların ~%24'ü beraberlik ve beraberlik nadiren en yüksek
  // olasılık); ölçülen çifte şans isabeti %76.5 (bkz. lib/double-chance.ts).
  const dc = deriveDoubleChance(p.pHome, p.pDraw, p.pAway);
  const ko = p.kickoff ? new Date(p.kickoff) : null;
  const koStr = ko ? ko.toLocaleString(t.locale || undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.4) }}
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 hover:border-brand-400/30 transition-colors">
      <div className="flex items-center justify-between text-xs text-white/40 mb-3">
        <span className="truncate max-w-[60%]">{displayLeague(p.leagueName, p.leagueId)}</span>
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

      {/* Pazarlar — çifte şans + gol pazarları tek tip satırlar halinde.
          Gol pazarlarının yüzdesi KALİBREDİR (API'de eğriden geçer); ham
          motor çıktısı 10-30 puan şişik olduğundan asla doğrudan basılmaz.
          Kenar eşiği: kalibre güven < %55 ise satır GÖSTERİLMEZ — ham ~0.5
          bandında gerçek isabet yazı-tura (%46-49), söylenecek söz yok
          (ayrıca eğrinin 0.5'teki mikro-blok artefaktı %0 basabiliyor). */}
      {(dc || (p.overUnder?.p ?? 0) >= MARKET_EDGE || (p.btts?.p ?? 0) >= MARKET_EDGE) && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1 mb-3 divide-y divide-white/[0.06]">
          {dc && (
            <MarketRow
              icon={<ShieldCheck size={13} className="text-emerald-300/90" />}
              label={`${t.mkDc} · ${dc.pick}`}
              value={doubleChanceLabel(dc.pick, p.homeName, p.awayName, t.lang)}
              percent={Math.round(dc.p * 100)}
              barClass="bg-emerald-400/80" textClass="text-emerald-300"
            />
          )}
          {p.overUnder && p.overUnder.p != null && p.overUnder.p >= MARKET_EDGE && (
            <MarketRow
              icon={<Target size={13} className="text-violet-300/90" />}
              label={t.mkOu}
              value={goalMarketLabel(p.overUnder.pick, t.lang)}
              percent={Math.round(p.overUnder.p * 100)}
              barClass="bg-violet-400/80" textClass="text-violet-300"
            />
          )}
          {p.btts && p.btts.p != null && p.btts.p >= MARKET_EDGE && (
            <MarketRow
              icon={<BarChart3 size={13} className="text-sky-300/90" />}
              label={t.mkBtts}
              value={goalMarketLabel(p.btts.pick, t.lang)}
              percent={Math.round(p.btts.p * 100)}
              barClass="bg-sky-400/80" textClass="text-sky-300"
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-white/25 truncate">{t.mkCalibNote}</span>
        {p.rationale && (
          <button onClick={onToggle}
            className="ml-auto shrink-0 text-[11px] px-2 py-1 rounded-lg text-brand-300/80 hover:text-brand-300 flex items-center gap-1">
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

// Sonuçlanmış tahmin satırı: tarih · takımlar + skor · pazar rozetleri
// (1X2 / çifte şans / Ü-A / KG her biri ✓ yeşil veya ✗ kırmızı). Rozet
// doğruluğu skor + result'tan YERELDE hesaplanır — ekstra API alanı gerekmez.
function SettledRow({ p, t }: { p: Prediction; t: any }) {
  const ko = p.kickoff ? new Date(p.kickoff) : null;
  const koStr = ko ? ko.toLocaleDateString(t.locale || undefined, { day: '2-digit', month: 'short' }) : '';
  const hs = p.homeScore, as = p.awayScore;
  const res = (p.result || '') as 'H' | 'D' | 'A' | '';
  const dc = deriveDoubleChance(p.pHome, p.pDraw, p.pAway);

  const chips: Array<{ label: string; ok: boolean }> = [];
  if (p.correct != null) chips.push({ label: `1X2 · ${p.pick}`, ok: p.correct === true });
  if (dc && res) chips.push({ label: dc.pick, ok: isDoubleChanceCorrect(dc.pick, res) });
  if (p.overUnder && hs != null && as != null) {
    chips.push({
      label: goalMarketLabel(p.overUnder.pick, t.lang),
      ok: isOverUnderCorrect(p.overUnder.pick, hs, as),
    });
  }
  if (p.btts && hs != null && as != null) {
    chips.push({
      label: goalMarketLabel(p.btts.pick, t.lang),
      ok: isBttsCorrect(p.btts.pick, hs, as),
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-xs">
      <span className="w-12 shrink-0 text-white/35 tabular-nums">{koStr}</span>
      <div className="min-w-0 flex-1">
        <div className="text-white/80 truncate">
          <span className={res === 'H' ? 'font-semibold text-white' : ''}>{p.homeName}</span>
          <span className="mx-1.5 font-bold tabular-nums text-white/90">{hs}-{as}</span>
          <span className={res === 'A' ? 'font-semibold text-white' : ''}>{p.awayName}</span>
        </div>
        <div className="text-[10px] text-white/30 truncate">{displayLeague(p.leagueName, p.leagueId)}</div>
      </div>
      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
        {chips.map((c) => (
          <span key={c.label}
            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-medium tabular-nums ${
              c.ok
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300/80'
            }`}>
            {c.ok ? '✓' : '✗'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Tek tip pazar satırı: ikon + pazar adı + seçim + ince güven çubuğu + yüzde.
// Kartın "profesyonel" hiyerarşisi buradan gelir — her pazar aynı düzende,
// yüzdeler tabular hizada, renk yalnızca vurgu.
function MarketRow({ icon, label, value, percent, barClass, textClass }: {
  icon: React.ReactNode; label: string; value: string;
  percent: number; barClass: string; textClass: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-white/35">{label}</div>
        <div className="text-xs font-semibold text-white/85 truncate">{value}</div>
      </div>
      <div className="w-16 shrink-0 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className={`w-10 shrink-0 text-right text-sm font-bold tabular-nums ${textClass}`}>
        {percent}%
      </div>
    </div>
  );
}
