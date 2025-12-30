'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Target } from 'lucide-react';
import { FootballBall3D } from '@/components/Football3D';

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

  useEffect(() => {
    if (matchId) {
      fetchAnalysis();
    }
  }, [matchId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      // Unified analysis endpoint'inden veri çek
      const res = await fetch(`/api/unified/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: parseInt(matchId),
          skipCache: false
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Analiz bulunamadı');
      }
    } catch (err: any) {
      setError(err.message || 'Analiz yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00f0ff] border-t-transparent mx-auto" />
          <p className="mt-4 text-white">Analiz yükleniyor...</p>
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
          <div className="flex items-center gap-2">
            <FootballBall3D size={30} autoRotate={true} />
            <span className="text-white font-bold">Unified Analysis</span>
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
          </motion.div>
        </div>

        {/* Best Bet */}
        {analysis.bestBet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-futuristic rounded-2xl p-6 mt-6 neon-border-cyan bg-gradient-to-r from-[#00f0ff]/10 to-[#ff00f0]/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-[#00f0ff]" />
              <h3 className="text-xl font-bold text-white">En İyi Bahis</h3>
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {analysis.bestBet.market} - {analysis.bestBet.selection}
            </div>
            <div className="text-sm text-gray-400">
              Güven: {analysis.bestBet.confidence}% • Value: {analysis.bestBet.value}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {analysis.bestBet.reasoning}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
