'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Target, Clock, ShieldAlert, Award, History } from 'lucide-react';
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

export default function MatchAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id as string;
  const { lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [progress, setProgress] = useState<Array<{ stage: string; message: string }>>([]);

  useEffect(() => {
    if (matchId) {
      fetchAnalysis();
    }
  }, [matchId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setProgress([]);

      const res = await fetch(`/api/unified/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: parseInt(matchId),
          skipCache: false,
          stream: true
        })
      });

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
              {progress.length > 0 ? progress[progress.length - 1].message : 'Analiz Hazırlanıyor...'}
            </h2>
            <p className="text-content-muted text-sm mb-8">AI sistemleri verileri işleyip konsensüs oluşturuyor.</p>

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
                  <p className="text-xs text-content-subtle animate-pulse">Sistemler uyandırılıyor...</p>
                )}
              </div>
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
            <p className="text-negative mb-4">{error || 'Analiz bulunamadı'}</p>
            <Link href="/dashboard" className="fa-btn fa-btn-primary">
              Dashboard'a Dön
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
          <div className="flex items-center gap-4">
            {isCached && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-positive/10 border border-positive/30 text-positive text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Cached</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-content font-semibold">Unified Analysis</span>
            </div>
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

          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <h2 className="text-3xl font-semibold text-content tracking-tight">
                {analysis.sources?.agents?.stats?.homeTeam || 'Home Team'}
              </h2>
            </div>
            <div className="px-8">
              <span className="text-3xl font-black text-brand-400">
                VS
              </span>
            </div>
            <div className="text-center flex-1">
              <h2 className="text-3xl font-semibold text-content tracking-tight">
                {analysis.sources?.agents?.stats?.awayTeam || 'Away Team'}
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
            <h3 className="text-lg font-semibold text-content tracking-tight mb-4">Maç Sonucu</h3>
            <div className="text-4xl font-bold text-brand-400 mb-2">
              {analysis.predictions?.matchResult?.prediction || 'X'}
            </div>
            <div className="text-sm text-content-muted">
              Güven: {analysis.predictions?.matchResult?.confidence || 0}%
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
            <h3 className="text-lg font-semibold text-content tracking-tight mb-4">Over/Under 2.5</h3>
            <div className="text-4xl font-bold text-brand-400 mb-2">
              {analysis.predictions?.overUnder?.prediction || 'Over'}
            </div>
            <div className="text-sm text-content-muted">
              Güven: {analysis.predictions?.overUnder?.confidence || 0}%
            </div>
            <div className="text-xs text-content-subtle mt-2">
              Beklenen: {analysis.predictions?.overUnder?.expectedGoals?.toFixed(1) || '2.5'} gol
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
            <h3 className="text-lg font-semibold text-content tracking-tight mb-4">BTTS</h3>
            <div className="text-4xl font-bold text-brand-400 mb-2">
              {analysis.predictions?.btts?.prediction || 'Yes'}
            </div>
            <div className="text-sm text-content-muted">
              Güven: {analysis.predictions?.btts?.confidence || 0}%
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
                <h3 className="font-semibold text-content tracking-tight">Lig Uzmanı Agentlar</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.systemPerformance.expertAgents.map((agent: string) => (
                  <span key={agent} className="px-3 py-1 bg-caution/10 border border-caution/30 text-caution text-xs rounded-full uppercase tracking-wider font-bold">
                    {agent}
                  </span>
                ))}
              </div>
              <p className="text-xs text-content-muted mt-3">Bu agentlar bu ligdeki yüksek tarihsel başarıları nedeniyle daha fazla ağırlığa sahiptir.</p>
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
                <h3 className="font-semibold text-content tracking-tight">Çelişki Çözümü</h3>
              </div>
              <div className="space-y-3">
                {analysis.systemPerformance.conflicts.map((conflict: any, idx: number) => (
                  <div key={idx} className="bg-negative/5 rounded-lg p-3 border border-negative/10">
                    <p className="text-xs font-bold text-negative uppercase">{conflict.field}</p>
                    <p className="text-sm text-content-muted mt-1">{conflict.description}</p>
                    <p className="text-xs text-content-muted mt-2 border-t border-negative/10 pt-2">
                      <span className="text-brand-400">Karar:</span> {conflict.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
