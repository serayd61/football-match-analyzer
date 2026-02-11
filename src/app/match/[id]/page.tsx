'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Target, Clock, ShieldAlert, Award, History } from 'lucide-react';
import { FootballBall3D } from '@/components/Football3D';
import HistoricalAccuracyBadge, { HistoricalAccuracySummary } from '@/components/HistoricalAccuracyBadge';
import AutoLearnBadge, { AutoLearnPanel } from '@/components/AutoLearnBadge';
import AgentPerformanceBadge from '@/components/AgentPerformanceBadge';
import DevilsAdvocatePanel from '@/components/DevilsAdvocatePanel';

// ============================================================================
// MATCH ANALYSIS PAGE
// Unified Consensus System ile analiz gösterir
// ============================================================================

export default function MatchAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id as string;

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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="relative mb-8 flex justify-center">
            <div className="absolute inset-0 bg-[#00f0ff]/20 blur-xl rounded-full scale-150 animate-pulse" />
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00f0ff] border-t-transparent relative z-10" />
          </div>
          <h2 className="text-xl font-bold text-[#00f0ff] mb-2 uppercase tracking-widest">
            {progress.length > 0 ? progress[progress.length - 1].message : 'Analiz Hazırlanıyor...'}
          </h2>
          <p className="text-gray-400 text-sm mb-8 italic">AI sistemleri verileri işleyip konsensüs oluşturuyor.</p>

          <div className="bg-[#111] border border-[#00f0ff]/20 rounded-xl p-4 text-left h-48 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              {progress.map((p, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className="flex gap-3 items-start"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] mt-1.5 shrink-0" />
                  <p className="text-xs text-gray-300 font-mono leading-relaxed">
                    <span className="text-[#00f0ff]/60 uppercase text-[10px] mr-2">[{p.stage}]</span>
                    {p.message}
                  </p>
                </motion.div>
              ))}
              {progress.length === 0 && (
                <p className="text-xs text-gray-500 italic animate-pulse">Sistemler uyandırılıyor...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-red-400 mb-4">{error || 'Analiz bulunamadı'}</p>
          <Link href="/dashboard" className="px-4 py-2 bg-[#00f0ff] text-black rounded-lg hover:bg-[#00f0ff]/80">
            Dashboard'a Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-[#00f0ff]/30 glass-futuristic sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-[#00f0ff] hover:text-[#00f0ff]/80">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-4">
            {isCached && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Cached</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FootballBall3D size={30} autoRotate={true} />
              <span className="text-white font-bold">Unified Analysis</span>
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
          className="glass-futuristic rounded-2xl p-8 mb-8 neon-border-cyan"
        >
          {/* Maç Tipi Etiketi */}
          {analysis.matchContext && (
            <div className="flex justify-center mb-4">
              <span className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full ${
                analysis.matchContext.type === 'derby'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : analysis.matchContext.type === 'relegation_battle'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : analysis.matchContext.type === 'title_race'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
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
              <h2 className="text-3xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                {analysis.sources?.agents?.stats?.homeTeam || 'Home Team'}
              </h2>
            </div>
            <div className="px-8 relative">
              <FootballBall3D size={60} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" autoRotate={true} />
              <span className="text-3xl font-black text-[#00f0ff] neon-glow-cyan relative z-10" style={{ fontFamily: 'var(--font-heading)' }}>
                VS
              </span>
            </div>
            <div className="text-center flex-1">
              <h2 className="text-3xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                {analysis.sources?.agents?.stats?.awayTeam || 'Away Team'}
              </h2>
            </div>
          </div>
        </motion.div>

        {/* Predictions */}
        <div className="grid md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-futuristic rounded-2xl p-6 neon-border-cyan"
          >
            <h3 className="text-lg font-bold text-white mb-4">Maç Sonucu</h3>
            <div className="text-4xl font-bold text-[#00f0ff] mb-2">
              {analysis.predictions?.matchResult?.prediction || 'X'}
            </div>
            <div className="text-sm text-gray-400">
              Güven: {analysis.predictions?.matchResult?.confidence || 0}%
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {analysis.predictions?.matchResult?.reasoning || ''}
            </div>
            {/* Tarihsel Doğruluk Badge */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
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
            className="glass-futuristic rounded-2xl p-6 neon-border-cyan"
          >
            <h3 className="text-lg font-bold text-white mb-4">Over/Under 2.5</h3>
            <div className="text-4xl font-bold text-[#00f0ff] mb-2">
              {analysis.predictions?.overUnder?.prediction || 'Over'}
            </div>
            <div className="text-sm text-gray-400">
              Güven: {analysis.predictions?.overUnder?.confidence || 0}%
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Beklenen: {analysis.predictions?.overUnder?.expectedGoals?.toFixed(1) || '2.5'} gol
            </div>
            {/* Tarihsel Doğruluk Badge */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
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
            className="glass-futuristic rounded-2xl p-6 neon-border-cyan"
          >
            <h3 className="text-lg font-bold text-white mb-4">BTTS</h3>
            <div className="text-4xl font-bold text-[#00f0ff] mb-2">
              {analysis.predictions?.btts?.prediction || 'Yes'}
            </div>
            <div className="text-sm text-gray-400">
              Güven: {analysis.predictions?.btts?.confidence || 0}%
            </div>
            {/* Tarihsel Doğruluk Badge */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
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
            className="glass-futuristic rounded-2xl p-6 mt-6 neon-border-cyan bg-gradient-to-r from-[#00f0ff]/10 to-[#ff00f0]/10"
          >
            <div className="text-xs text-gray-500 mt-2">
              {analysis.bestBet.reasoning}
            </div>
          </motion.div>
        )}

        {/* System Insights (Expert Agents & Conflicts) */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Expert Agents */}
          {analysis.systemPerformance?.expertAgents && analysis.systemPerformance.expertAgents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-futuristic rounded-2xl p-6 border border-[#00f0ff]/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white">Lig Uzmanı Agentlar</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.systemPerformance.expertAgents.map((agent: string) => (
                  <span key={agent} className="px-3 py-1 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs rounded-full uppercase tracking-wider font-bold">
                    {agent}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">Bu agentlar bu ligdeki yüksek tarihsel başarıları nedeniyle daha fazla ağırlığa sahiptir.</p>
            </motion.div>
          )}

          {/* Conflict Resolution */}
          {analysis.systemPerformance?.conflicts && analysis.systemPerformance.conflicts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-futuristic rounded-2xl p-6 border border-red-500/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-white">Çelişki Çözümü</h3>
              </div>
              <div className="space-y-3">
                {analysis.systemPerformance.conflicts.map((conflict: any, idx: number) => (
                  <div key={idx} className="bg-red-500/5 rounded-lg p-3 border border-red-500/10">
                    <p className="text-xs font-bold text-red-400 uppercase">{conflict.field}</p>
                    <p className="text-sm text-gray-300 mt-1">{conflict.description}</p>
                    <p className="text-xs text-gray-400 mt-2 border-t border-red-500/10 pt-2">
                      <span className="text-[#00f0ff]">Karar:</span> {conflict.resolution}
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
