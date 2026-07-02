'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Target, Clock, ShieldAlert, Award, History, Hourglass, Crown } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { Spinner } from '@/components/ui';
import HistoricalAccuracyBadge, { HistoricalAccuracySummary } from '@/components/HistoricalAccuracyBadge';
import AutoLearnBadge, { AutoLearnPanel } from '@/components/AutoLearnBadge';
import AgentPerformanceBadge from '@/components/AgentPerformanceBadge';
import DevilsAdvocatePanel from '@/components/DevilsAdvocatePanel';
import SurvivalVerdictCard from '@/components/SurvivalVerdictCard';
import DixonColesCard from '@/components/DixonColesCard';
import { useLanguage } from '@/components/LanguageProvider';

// ============================================================================
// MATCH ANALYSIS PAGE
// Unified Consensus System ile analiz gösterir
// ============================================================================

// Sayfa metinleri — TAMAMEN üç dilli (eski sürüm TR hardcode'du; dil
// değiştirilse de içerik Türkçe kalıyordu).
const GATE_STR: Record<string, any> = {
  tr: {
    pageTitle: 'Maç Analizi', cached: 'Önbellek', preparing: 'Analiz Hazırlanıyor...',
    preparingDesc: 'AI sistemleri verileri işleyip konsensüs oluşturuyor.', waking: 'Sistemler uyandırılıyor...',
    matchResult: 'Maç Sonucu', confidence: 'Güven', overUnder: 'Alt/Üst 2.5', btts: 'KG (Karşılıklı Gol)',
    expected: 'Beklenen', goals: 'gol', expertAgents: 'Lig Uzmanı Agentlar',
    expertAgentsDesc: 'Bu agentlar bu ligdeki yüksek tarihsel başarıları nedeniyle daha fazla ağırlığa sahiptir.',
    conflicts: 'Çelişki Çözümü', decision: 'Karar', notFoundGeneric: 'Analiz bulunamadı',
    limitTitle: 'Bugünkü 3 ücretsiz analizin doldu',
    limitDesc: 'Hakların yarın otomatik yenilenir. Beklemek istemiyorsan Pro ile sınırsız analiz yapabilirsin.',
    proCta: "Pro'ya geç — 7 gün ücretsiz",
    back: "Dashboard'a dön",
    authTitle: 'Analiz için giriş yap',
    authCta: 'Giriş yap / Üye ol',
    notFound: 'Maç bilgisi bulunamadı. Maç başlamış veya kaldırılmış olabilir.',
    leftStrip: (n: number) => `Bugün ${n} ücretsiz analiz hakkın kaldı`,
    leftStripEmpty: 'Bugünkü ücretsiz analiz hakların doldu — yarın yenilenir',
    nextCta: 'Başka maç analiz et',
  },
  en: {
    pageTitle: 'Match Analysis', cached: 'Cached', preparing: 'Preparing analysis...',
    preparingDesc: 'AI systems are processing the data and building a consensus.', waking: 'Waking up the systems...',
    matchResult: 'Match Result', confidence: 'Confidence', overUnder: 'Over/Under 2.5', btts: 'BTTS',
    expected: 'Expected', goals: 'goals', expertAgents: 'League Expert Agents',
    expertAgentsDesc: 'These agents carry extra weight due to their strong historical record in this league.',
    conflicts: 'Conflict Resolution', decision: 'Decision', notFoundGeneric: 'Analysis not found',
    limitTitle: "You've used today's 3 free analyses",
    limitDesc: 'Your quota resets tomorrow. Don\'t want to wait? Go unlimited with Pro.',
    proCta: 'Go Pro — 7 days free',
    back: 'Back to dashboard',
    authTitle: 'Sign in to analyze',
    authCta: 'Sign in / Sign up',
    notFound: 'Match details not found. It may have started or been removed.',
    leftStrip: (n: number) => `${n} free analyses left today`,
    leftStripEmpty: 'Daily free analyses used — resets tomorrow',
    nextCta: 'Analyze another match',
  },
  de: {
    pageTitle: 'Spielanalyse', cached: 'Zwischengespeichert', preparing: 'Analyse wird vorbereitet...',
    preparingDesc: 'Die KI-Systeme verarbeiten die Daten und bilden einen Konsens.', waking: 'Systeme werden gestartet...',
    matchResult: 'Spielausgang', confidence: 'Konfidenz', overUnder: 'Über/Unter 2.5', btts: 'BTTS',
    expected: 'Erwartet', goals: 'Tore', expertAgents: 'Liga-Experten-Agents',
    expertAgentsDesc: 'Diese Agents haben aufgrund ihrer starken historischen Bilanz in dieser Liga mehr Gewicht.',
    conflicts: 'Konfliktauflösung', decision: 'Entscheidung', notFoundGeneric: 'Analyse nicht gefunden',
    limitTitle: 'Deine 3 kostenlosen Analysen für heute sind aufgebraucht',
    limitDesc: 'Dein Kontingent wird morgen zurückgesetzt. Mit Pro analysierst du unbegrenzt.',
    proCta: 'Pro holen — 7 Tage gratis',
    back: 'Zurück zum Dashboard',
    authTitle: 'Zum Analysieren anmelden',
    authCta: 'Anmelden / Registrieren',
    notFound: 'Spieldaten nicht gefunden. Das Spiel hat evtl. begonnen oder wurde entfernt.',
    leftStrip: (n: number) => `Heute noch ${n} kostenlose Analysen übrig`,
    leftStripEmpty: 'Tageskontingent aufgebraucht — morgen wieder verfügbar',
    nextCta: 'Weiteres Spiel analysieren',
  },
};

export default function MatchAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = params?.id as string;
  const { lang } = useLanguage();
  const gs = GATE_STR[lang] || GATE_STR.en;

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Erişim engeli: 'limit' (3/gün doldu) | 'auth' (giriş yok) | null
  const [gate, setGate] = useState<null | 'limit' | 'auth'>(null);
  const [analysesLeft, setAnalysesLeft] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [progress, setProgress] = useState<Array<{ stage: string; message: string }>>([]);

  // StrictMode/dev çift-mount koruması: aynı maç için analizi BİR kez tetikle
  // (aksi halde kullanıcının günlük hakkı yanlışlıkla 2 kez düşer).
  const startedFor = React.useRef<string | null>(null);
  useEffect(() => {
    if (matchId && startedFor.current !== matchId) {
      startedFor.current = matchId;
      fetchAnalysis();
    }
  }, [matchId]);

  // Analiz bitince kalan günlük hakkı göster (aktivasyon döngüsü şeridi)
  useEffect(() => {
    if (!analysis) return;
    fetch('/api/me/access')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && !d.isPro) setAnalysesLeft(d.analysesLeft);
      })
      .catch(() => {});
  }, [analysis]);

  // Fixture bağlamını çöz: önce URL query'sinden (FeaturedMatches böyle
  // gönderir), yoksa bugün+yarının fikstür listesinden id ile bul.
  // (analyze API'si takım adları + id'leri zorunlu ister.)
  const resolveFixture = async (): Promise<null | {
    homeTeam: string; awayTeam: string; homeTeamId: number; awayTeamId: number;
    league?: string; matchDate?: string;
  }> => {
    const q = (k: string) => searchParams?.get(k) || '';
    if (q('home') && q('away') && q('homeId') && q('awayId')) {
      return {
        homeTeam: q('home'), awayTeam: q('away'),
        homeTeamId: parseInt(q('homeId')), awayTeamId: parseInt(q('awayId')),
        league: q('league') || undefined, matchDate: q('date') || undefined,
      };
    }
    try {
      const iso = (d: Date) => d.toISOString().split('T')[0];
      const [r1, r2] = await Promise.all([
        fetch(`/api/v2/fixtures?date=${iso(new Date())}`),
        fetch(`/api/v2/fixtures?date=${iso(new Date(Date.now() + 86_400_000))}`),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      const all = [
        ...(d1?.data?.fixtures || d1?.fixtures || []),
        ...(d2?.data?.fixtures || d2?.fixtures || []),
      ];
      const f = all.find((x: any) => x.id === parseInt(matchId));
      if (!f) return null;
      return {
        homeTeam: f.homeTeam, awayTeam: f.awayTeam,
        homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId,
        league: f.league, matchDate: f.date,
      };
    } catch {
      return null;
    }
  };

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setProgress([]);
      setGate(null);

      const fixture = await resolveFixture();
      if (!fixture) {
        setError(gs.notFound);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/unified/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: parseInt(matchId),
          ...fixture,
          lang,
          skipCache: false,
          stream: true
        })
      });

      // Erişim/limit hataları SSE değil düz JSON döner — burada yakala.
      if (res.status === 401) { setGate('auth'); setLoading(false); return; }
      if (res.status === 403) {
        setGate('limit');
        setLoading(false);
        return;
      }
      if (!res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        const data = await res.json().catch(() => null);
        setError(data?.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      if (!res.body) throw new Error('Streaming not supported');

      const reader = res.body.getReader();
      const decoder = new TextEncoder(); // Aslında TextDecoder olacak ama API encoder kullanıyor, browser'da decoder lazım
      const browserDecoder = new TextDecoder();

      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = browserDecoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.stage && data.message) {
                  setProgress(prev => [...prev, { stage: data.stage, message: data.message }]);
                }

                if (data.success && data.analysis) {
                  setAnalysis(data.analysis);
                  setIsCached(!!data.cached);
                  setLoading(false);
                }

                if (data.success === false) {
                  setError(data.error || 'Analiz başarısız');
                  setLoading(false);
                }
              } catch (e) {
                console.error('Error parsing stream chunk:', e);
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Analiz yüklenemedi');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="flex flex-col items-center justify-center p-4 py-24">
          <div className="max-w-md w-full text-center">
            <div className="mb-8 flex justify-center">
              <Spinner size={56} className="text-brand-400" />
            </div>
            <h2 className="text-xl font-semibold text-content tracking-tight mb-2">
              {progress.length > 0 ? progress[progress.length - 1].message : gs.preparing}
            </h2>
            <p className="text-content-muted text-sm mb-8">{gs.preparingDesc}</p>

            <div className="bg-surface-2 border border-line rounded-xl p-4 text-left h-48 overflow-y-auto">
              <div className="space-y-3">
                {progress.map((p, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i}
                    className="flex gap-3 items-start"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-content-muted font-mono leading-relaxed">
                      <span className="text-brand-400/60 uppercase text-[10px] mr-2">[{p.stage}]</span>
                      {p.message}
                    </p>
                  </motion.div>
                ))}
                {progress.length === 0 && (
                  <p className="text-xs text-content-subtle animate-pulse">{gs.waking}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Günlük limit doldu / giriş yok — anlamlı, dönüşüm odaklı ekran
  if (gate) {
    const isAuth = gate === 'auth';
    return (
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="flex items-center justify-center py-28 px-4">
          <div className="max-w-md w-full text-center fa-card p-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-400/10 border border-brand-400/30 flex items-center justify-center text-brand-300">
              {isAuth ? <ShieldAlert size={24} /> : <Hourglass size={24} />}
            </div>
            <h2 className="text-xl font-bold text-content mb-2">
              {isAuth ? gs.authTitle : gs.limitTitle}
            </h2>
            {!isAuth && <p className="text-sm text-content-muted mb-6">{gs.limitDesc}</p>}
            <div className="flex flex-col gap-2">
              <Link
                href={isAuth ? '/login' : '/pricing'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:opacity-90 transition-opacity"
              >
                {isAuth ? gs.authCta : (<><Crown size={16} /> {gs.proCta}</>)}
              </Link>
              <Link href="/dashboard" className="text-sm text-content-muted hover:text-content py-2">
                {gs.back}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="flex items-center justify-center py-32">
          <div className="text-center text-content">
            <p className="text-negative mb-4">{error || gs.notFoundGeneric}</p>
            <Link href="/dashboard" className="fa-btn fa-btn-primary">
              {gs.back}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <header className="border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-400 hover:text-brand-300">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            {isCached && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-positive/10 border border-positive/30 text-positive text-xs font-medium shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{gs.cached}</span>
              </div>
            )}
            <span className="text-content font-semibold truncate">{gs.pageTitle}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Match Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fa-card p-8 mb-8"
        >
          {/* Maç Tipi Etiketi */}
          {analysis.matchContext && (
            <div className="flex justify-center mb-4">
              <span className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full ${
                analysis.matchContext.type === 'derby'
                  ? 'bg-negative/20 text-negative border border-negative/30'
                  : analysis.matchContext.type === 'relegation_battle'
                  ? 'bg-caution/20 text-caution border border-caution/30'
                  : analysis.matchContext.type === 'title_race'
                  ? 'bg-caution/20 text-caution border border-caution/30'
                  : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
              }`}>
                {analysis.matchContext.label}
                {analysis.matchContext.psychologyMultiplier > 1.0 && (
                  <span className="ml-1.5 opacity-60">
                    (Psikoloji {analysis.matchContext.psychologyMultiplier}x)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* min-w-0 + responsive boyut + break-words: uzun takım adları
              mobilde karttan taşmasın (eski text-3xl sabit boyut taşıyordu) */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-center flex-1 min-w-0">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-semibold text-content tracking-tight break-words">
                {searchParams?.get('home') || analysis.sources?.agents?.stats?.homeTeam || 'Home Team'}
              </h2>
            </div>
            <div className="px-2 sm:px-8 shrink-0">
              <span className="text-xl sm:text-3xl font-black text-brand-400">
                VS
              </span>
            </div>
            <div className="text-center flex-1 min-w-0">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-semibold text-content tracking-tight break-words">
                {searchParams?.get('away') || analysis.sources?.agents?.stats?.awayTeam || 'Away Team'}
              </h2>
            </div>
          </div>
        </motion.div>

        {/* Survival Verdict - TEK SONUÇ */}
        {analysis.survivalVerdict && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <SurvivalVerdictCard verdict={analysis.survivalVerdict} />
          </motion.div>
        )}

        {/* Predictions */}
        <div className="grid md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="fa-card p-6"
          >
            <h3 className="text-lg font-semibold text-content tracking-tight mb-4">{gs.matchResult}</h3>
            <div className="text-4xl font-bold text-brand-400 mb-2">
              {analysis.predictions?.matchResult?.prediction || 'X'}
            </div>
            <div className="text-sm text-content-muted">
              {gs.confidence}: {analysis.predictions?.matchResult?.confidence || 0}%
            </div>
            <div className="text-xs text-content-subtle mt-2">
              {analysis.predictions?.matchResult?.reasoning || ''}
            </div>
            {/* Tarihsel Doğruluk Badge */}
            <div className="mt-3 pt-3 border-t border-line space-y-2">
              <HistoricalAccuracyBadge
                market="mr"
                prediction={analysis.predictions?.matchResult?.prediction || ''}
                confidence={analysis.predictions?.matchResult?.confidence || 0}
                compact={true}
              />
              <AutoLearnBadge
                market="mr"
                autoLearnData={analysis.sources?.agents?.autoLearn}
                compact={true}
              />
              <AgentPerformanceBadge
                market="mr"
                agentProfiles={analysis.agentProfiles}
                compact={true}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="fa-card p-6"
          >
            <h3 className="text-lg font-semibold text-content tracking-tight mb-4">{gs.overUnder}</h3>
            <div className="text-4xl font-bold text-brand-400 mb-2">
              {analysis.predictions?.overUnder?.prediction || 'Over'}
            </div>
            <div className="text-sm text-content-muted">
              {gs.confidence}: {analysis.predictions?.overUnder?.confidence || 0}%
            </div>
            <div className="text-xs text-content-subtle mt-2">
              {gs.expected}: {analysis.predictions?.overUnder?.expectedGoals?.toFixed(1) || '2.5'} {gs.goals}
            </div>
            {/* Tarihsel Doğruluk Badge */}
            <div className="mt-3 pt-3 border-t border-line space-y-2">
              <HistoricalAccuracyBadge
                market="ou"
                prediction={analysis.predictions?.overUnder?.prediction || ''}
                confidence={analysis.predictions?.overUnder?.confidence || 0}
                compact={true}
              />
              <AutoLearnBadge
                market="ou"
                autoLearnData={analysis.sources?.agents?.autoLearn}
                compact={true}
              />
              <AgentPerformanceBadge
                market="ou"
                agentProfiles={analysis.agentProfiles}
                compact={true}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="fa-card p-6"
          >
            <h3 className="text-lg font-semibold text-content tracking-tight mb-4">{gs.btts}</h3>
            <div className="text-4xl font-bold text-brand-400 mb-2">
              {analysis.predictions?.btts?.prediction || 'Yes'}
            </div>
            <div className="text-sm text-content-muted">
              {gs.confidence}: {analysis.predictions?.btts?.confidence || 0}%
            </div>
            {/* Tarihsel Doğruluk Badge */}
            <div className="mt-3 pt-3 border-t border-line space-y-2">
              <HistoricalAccuracyBadge
                market="btts"
                prediction={analysis.predictions?.btts?.prediction || ''}
                confidence={analysis.predictions?.btts?.confidence || 0}
                compact={true}
              />
              <AutoLearnBadge
                market="btts"
                autoLearnData={analysis.sources?.agents?.autoLearn}
                compact={true}
              />
              <AgentPerformanceBadge
                market="btts"
                agentProfiles={analysis.agentProfiles}
                compact={true}
              />
            </div>
          </motion.div>
        </div>

        {/* Devil's Advocate Uyarı Paneli */}
        {(analysis.sources?.agents?.devilsAdvocate || (analysis.systemPerformance?.conflicts && analysis.systemPerformance.conflicts.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.33 }}
            className="mt-6"
          >
            <DevilsAdvocatePanel
              data={analysis.sources?.agents?.devilsAdvocate}
              conflicts={analysis.systemPerformance?.conflicts}
              isActivated={analysis.metadata?._debug?.devilsAdvocateActivated}
            />
          </motion.div>
        )}

        {/* Tarihsel Doğruluk Özeti */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
        >
          <HistoricalAccuracySummary
            mrPrediction={analysis.predictions?.matchResult?.prediction}
            mrConfidence={analysis.predictions?.matchResult?.confidence}
            ouPrediction={analysis.predictions?.overUnder?.prediction}
            ouConfidence={analysis.predictions?.overUnder?.confidence}
            bttsPrediction={analysis.predictions?.btts?.prediction}
            bttsConfidence={analysis.predictions?.btts?.confidence}
          />
        </motion.div>

        {/* AutoLearn Agent Panel */}
        {analysis.sources?.agents?.autoLearn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="mt-6"
          >
            <AutoLearnPanel autoLearnData={analysis.sources.agents.autoLearn} />
          </motion.div>
        )}

        {/* Best Bet */}
        {analysis.bestBet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="fa-card p-6 mt-6"
          >
            <div className="text-xs text-content-subtle mt-2">
              {analysis.bestBet.reasoning}
            </div>
          </motion.div>
        )}

        {/* 📊 Dixon-Coles İstatistiksel Zemin (varsa) */}
        {analysis.sources?.agents?.dixonColes && (
          <DixonColesCard
            data={analysis.sources.agents.dixonColes}
            lang={(lang as 'tr' | 'en' | 'de') || 'tr'}
          />
        )}

        {/* System Insights (Expert Agents & Conflicts) */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Expert Agents */}
          {analysis.systemPerformance?.expertAgents && analysis.systemPerformance.expertAgents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="fa-card p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-caution" />
                <h3 className="font-semibold text-content tracking-tight">{gs.expertAgents}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.systemPerformance.expertAgents.map((agent: string) => (
                  <span key={agent} className="px-3 py-1 bg-caution/10 border border-caution/30 text-caution text-xs rounded-full uppercase tracking-wider font-bold">
                    {agent}
                  </span>
                ))}
              </div>
              <p className="text-xs text-content-muted mt-3">{gs.expertAgentsDesc}</p>
            </motion.div>
          )}

          {/* Conflict Resolution */}
          {analysis.systemPerformance?.conflicts && analysis.systemPerformance.conflicts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="fa-card p-6 border-negative/30"
            >
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-negative" />
                <h3 className="font-semibold text-content tracking-tight">{gs.conflicts}</h3>
              </div>
              <div className="space-y-3">
                {analysis.systemPerformance.conflicts.map((conflict: any, idx: number) => (
                  <div key={idx} className="bg-negative/5 rounded-lg p-3 border border-negative/10">
                    <p className="text-xs font-bold text-negative uppercase">{conflict.field}</p>
                    <p className="text-sm text-content-muted mt-1">{conflict.description}</p>
                    <p className="text-xs text-content-muted mt-2 border-t border-negative/10 pt-2">
                      <span className="text-brand-400">{gs.decision}:</span> {conflict.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Kalan günlük hak şeridi — aktivasyon döngüsünü besler (free) */}
        {analysesLeft != null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="fa-card p-4 mt-8 flex flex-wrap items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-sm text-content-muted">
              <Zap size={15} className="text-brand-400" />
              {analysesLeft > 0 ? gs.leftStrip(analysesLeft) : gs.leftStripEmpty}
            </span>
            {analysesLeft > 0 ? (
              <Link
                href="/dashboard#featured-matches"
                className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                {gs.nextCta} →
              </Link>
            ) : (
              <Link
                href="/pricing"
                className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                {gs.proCta} →
              </Link>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
