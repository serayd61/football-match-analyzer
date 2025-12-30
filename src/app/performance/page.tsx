'use client';

// ============================================================================
// PERFORMANCE TRACKING PAGE
// Analiz edilen maçların sonuçlarını ve doğruluk oranlarını gösterir
// ============================================================================

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FootballBall3D } from '@/components/Football3D';
import {
  BarChart3, TrendingUp, Target, CheckCircle, XCircle,
  Calendar, Filter, Download, RefreshCw, Award, Activity,
  ArrowLeft, Zap, Trophy, TrendingDown
} from 'lucide-react';

interface PerformanceStats {
  overview: {
    total: number;
    settled: number;
    pending: number;
    periodDays: number;
  };
  accuracy: {
    matchResult: { total: number; correct: number; rate: number };
    overUnder: { total: number; correct: number; rate: number };
    btts: { total: number; correct: number; rate: number };
    score: { total: number; correct: number; rate: number };
    overall: { total: number; correct: number; rate: number };
  };
  confidenceDistribution: {
    high: { count: number; correct: number; rate: number };
    medium: { count: number; correct: number; rate: number };
    low: { count: number; correct: number; rate: number };
  };
  recentAnalyses: Array<{
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    league: string;
    matchDate: string;
    predictions: {
      matchResult: { prediction: string; confidence: number };
      overUnder: { prediction: string; confidence: number };
      btts: { prediction: string; confidence: number };
    };
    actualResults?: {
      homeScore: number;
      awayScore: number;
      matchResult: string;
      overUnder: string;
      btts: boolean;
    };
    accuracy?: {
      matchResult: boolean;
      overUnder: boolean;
      btts: boolean;
      score: boolean;
    };
    overallConfidence: number;
    agreement: number;
    isSettled: boolean;
    createdAt: string;
  }>;
}

export default function PerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'analyses' | 'trends'>('overview');

  useEffect(() => {
    fetchStats();
  }, [periodDays]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/unified/performance?days=${periodDays}&_t=${Date.now()}`);
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-white">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p>Veri yüklenemedi</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            Yenile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-[#00f0ff]/30 glass-futuristic sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button
                onClick={() => router.push('/dashboard')}
                whileHover={{ scale: 1.1, x: -5 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg glass-futuristic hover:neon-border-cyan transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-[#00f0ff]" />
              </motion.button>
              <div className="flex items-center gap-3">
                <FootballBall3D size={40} autoRotate={true} />
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2 neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                    <BarChart3 className="w-6 h-6 text-[#00f0ff]" />
                    Performans Takibi
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">Analiz doğruluk oranları ve istatistikler</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
                className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value={7}>Son 7 gün</option>
                <option value={30}>Son 30 gün</option>
                <option value={90}>Son 90 gün</option>
                <option value={365}>Son 1 yıl</option>
              </select>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Yenile
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-futuristic rounded-2xl p-6 border border-[#00f0ff]/20 hover:neon-border-cyan transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm font-medium">Toplam Analiz</h3>
              <Activity className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <p className="text-3xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
              {stats.overview.total}
            </p>
            <p className="text-xs text-gray-400 mt-2">{stats.overview.settled} sonuçlanmış • {stats.overview.pending} beklemede</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-futuristic rounded-2xl p-6 border border-[#00f0ff]/20 hover:neon-border-cyan transition-all relative overflow-hidden"
          >
            <div className="absolute top-2 right-2 opacity-10">
              <FootballBall3D size={50} autoRotate={true} />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-gray-400 text-sm font-medium">Genel Doğruluk</h3>
              <Target className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <p className="text-3xl font-bold text-white neon-glow-cyan relative z-10" style={{ fontFamily: 'var(--font-heading)' }}>
              {stats.accuracy.overall.rate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400 mt-2 relative z-10">{stats.accuracy.overall.correct}/{stats.accuracy.overall.total} doğru tahmin</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-futuristic rounded-2xl p-6 border border-[#00f0ff]/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm">Maç Sonucu</h3>
              <Award className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.accuracy.matchResult.rate.toFixed(1)}%</p>
            <p className="text-xs text-gray-400 mt-2">{stats.accuracy.matchResult.correct}/{stats.accuracy.matchResult.total} doğru</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-futuristic rounded-2xl p-6 border border-[#00f0ff]/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm">Over/Under</h3>
              <TrendingUp className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.accuracy.overUnder.rate.toFixed(1)}%</p>
            <p className="text-xs text-gray-400 mt-2">{stats.accuracy.overUnder.correct}/{stats.accuracy.overUnder.total} doğru</p>
          </motion.div>
        </div>

        {/* Accuracy Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-futuristic rounded-2xl p-6 mb-8 border border-[#00f0ff]/20"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00f0ff]" />
            Doğruluk Oranları
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Maç Sonucu</span>
                <span className="text-white font-bold">{stats.accuracy.matchResult.rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-[#00f0ff] h-2 rounded-full transition-all"
                  style={{ width: `${stats.accuracy.matchResult.rate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Over/Under</span>
                <span className="text-white font-bold">{stats.accuracy.overUnder.rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-[#00f0ff] h-2 rounded-full transition-all"
                  style={{ width: `${stats.accuracy.overUnder.rate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">BTTS</span>
                <span className="text-white font-bold">{stats.accuracy.btts.rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-[#00f0ff] h-2 rounded-full transition-all"
                  style={{ width: `${stats.accuracy.btts.rate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Skor Tahmini</span>
                <span className="text-white font-bold">{stats.accuracy.score.rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-[#00f0ff] h-2 rounded-full transition-all"
                  style={{ width: `${stats.accuracy.score.rate}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Analyses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-futuristic rounded-2xl p-6 border border-[#00f0ff]/20"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#00f0ff]" />
            Son Analizler
          </h2>
          <div className="space-y-4">
            {stats.recentAnalyses.map((analysis, idx) => (
              <div
                key={analysis.fixtureId}
                className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">
                      {analysis.homeTeam} vs {analysis.awayTeam}
                    </h3>
                    <p className="text-gray-400 text-sm">{analysis.league} • {new Date(analysis.matchDate).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis.isSettled ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                        Sonuçlandı
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                        Beklemede
                      </span>
                    )}
                  </div>
                </div>
                
                {analysis.isSettled && analysis.accuracy && (
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700/50">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs mb-1">Maç Sonucu</p>
                      <div className="flex items-center justify-center gap-1">
                        {analysis.accuracy.matchResult ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className="text-white text-sm font-medium">
                          {analysis.predictions.matchResult.prediction}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs mb-1">Over/Under</p>
                      <div className="flex items-center justify-center gap-1">
                        {analysis.accuracy.overUnder ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className="text-white text-sm font-medium">
                          {analysis.predictions.overUnder.prediction}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs mb-1">BTTS</p>
                      <div className="flex items-center justify-center gap-1">
                        {analysis.accuracy.btts ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className="text-white text-sm font-medium">
                          {analysis.predictions.btts.prediction}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs mb-1">Güven</p>
                      <span className="text-white text-sm font-medium">
                        {analysis.overallConfidence}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

