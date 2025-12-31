'use client';

// ============================================================================
// PERFORMANCE TRACKING PAGE - FUTURISTIC DESIGN
// Agent performanslarını ve tahmin doğruluğunu gösterir
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, Target, CheckCircle, XCircle,
  RefreshCw, Award, Activity, Zap, Trophy, Clock,
  ChevronDown, ChevronUp, Loader2, AlertCircle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AccuracyStats {
  agent: string;
  totalMatches: number;
  matchResultCorrect: number;
  matchResultAccuracy: number;
  overUnderCorrect: number;
  overUnderAccuracy: number;
  bttsCorrect: number;
  bttsAccuracy: number;
  overallAccuracy: number;
}

interface AnalysisRecord {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  match_settled: boolean;
  consensus_match_result: string;
  consensus_over_under: string;
  consensus_btts: string;
  consensus_confidence: number;
  actual_home_score: number | null;
  actual_away_score: number | null;
  actual_match_result: string | null;
  actual_over_under: string | null;
  actual_btts: string | null;
  consensus_mr_correct: boolean | null;
  consensus_ou_correct: boolean | null;
  consensus_btts_correct: boolean | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PerformancePage() {
  const [stats, setStats] = useState<AccuracyStats[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [showSettled, setShowSettled] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch stats
      const statsRes = await fetch('/api/performance/stats');
      const statsData = await statsRes.json();
      
      if (statsData.success) {
        setStats(statsData.stats || []);
        setSummary(statsData.summary);
      }
      
      // Fetch analyses
      const analysesRes = await fetch('/api/performance/get-analyses?limit=50');
      const analysesData = await analysesRes.json();
      
      if (analysesData.success) {
        setAnalyses(analysesData.data || []);
      }
      
    } catch (err: any) {
      setError(err.message || 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Settle matches
  const handleSettleMatches = async () => {
    setSettling(true);
    
    try {
      const res = await fetch('/api/performance/settle-matches', {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        // Refresh data
        await fetchData();
        alert(`${data.settled} maç sonuçlandırıldı, ${data.pending} maç bekliyor`);
      } else {
        alert('Hata: ' + data.error);
      }
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setSettling(false);
    }
  };

  // Filter analyses
  const pendingAnalyses = analyses.filter(a => !a.match_settled);
  const settledAnalyses = analyses.filter(a => a.match_settled);

  // Get best agent
  const bestAgent = stats.reduce((best, curr) => 
    curr.overallAccuracy > (best?.overallAccuracy || 0) ? curr : best
  , stats[0]);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0a0a] to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00f0ff]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#ff00ff]/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-[#00f0ff]/20 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff] to-[#ff00ff] flex items-center justify-center">
              <span className="text-xl">⚽</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] bg-clip-text text-transparent">
              Performance
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <motion.button
              onClick={fetchData}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#00f0ff]/50 flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </motion.button>
            
            <motion.button
              onClick={handleSettleMatches}
              disabled={settling || loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00f0ff]/80 text-black font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-[#00f0ff]/30 transition-all disabled:opacity-50"
            >
              {settling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Sonuçları Görüntüle
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-[#00f0ff] animate-spin mb-4" />
            <p className="text-white/60">Veriler yükleniyor...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-center gap-4"
          >
            <AlertCircle className="w-8 h-8 text-red-400" />
            <div>
              <h3 className="text-red-400 font-semibold">Hata</h3>
              <p className="text-white/60">{error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="ml-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              Tekrar Dene
            </button>
          </motion.div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Summary Cards */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
            >
              {/* Total Analyses */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <BarChart3 className="w-8 h-8 text-[#00f0ff]" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">Toplam</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">
                  {summary?.totalMatches || 0}
                </div>
                <div className="text-sm text-white/40">Analiz</div>
              </div>

              {/* Settled */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">Sonuçlanan</span>
                </div>
                <div className="text-4xl font-bold text-emerald-400 mb-1">
                  {summary?.settledMatches || 0}
                </div>
                <div className="text-sm text-white/40">Maç</div>
              </div>

              {/* Pending */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="w-8 h-8 text-amber-400" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">Bekleyen</span>
                </div>
                <div className="text-4xl font-bold text-amber-400 mb-1">
                  {summary?.pendingMatches || 0}
                </div>
                <div className="text-sm text-white/40">Maç</div>
              </div>

              {/* Consensus Accuracy */}
              <div className="bg-gradient-to-br from-[#00f0ff]/10 to-[#ff00ff]/5 border border-[#00f0ff]/30 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <Trophy className="w-8 h-8 text-[#00f0ff]" />
                  <span className="text-xs text-[#00f0ff]/60 uppercase tracking-wider">Konsensüs</span>
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] bg-clip-text text-transparent mb-1">
                  {summary?.consensusAccuracy || 0}%
                </div>
                <div className="text-sm text-white/40">Başarı Oranı</div>
              </div>
            </motion.div>

            {/* Agent Performance Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-xl mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Activity className="w-6 h-6 text-[#00f0ff]" />
                  Agent Performansı
                </h2>
                {bestAgent && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400">
                      En İyi: {bestAgent.agent} ({bestAgent.overallAccuracy}%)
                    </span>
                  </div>
                )}
              </div>

              {stats.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Henüz sonuçlanan maç yok</p>
                  <p className="text-sm mt-2">Maçlar sonuçlandığında agent performansları burada görünecek</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-4 px-4 text-white/60 font-medium">Agent</th>
                        <th className="text-center py-4 px-4 text-white/60 font-medium">Maç Sayısı</th>
                        <th className="text-center py-4 px-4 text-white/60 font-medium">MS Doğruluk</th>
                        <th className="text-center py-4 px-4 text-white/60 font-medium">O/U Doğruluk</th>
                        <th className="text-center py-4 px-4 text-white/60 font-medium">BTTS Doğruluk</th>
                        <th className="text-center py-4 px-4 text-white/60 font-medium">Genel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((stat, idx) => (
                        <motion.tr 
                          key={stat.agent}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                            stat.agent === 'KONSENSÜS' ? 'bg-[#00f0ff]/5' : ''
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                stat.agent === 'KONSENSÜS' ? 'bg-[#00f0ff]' :
                                stat.agent === bestAgent?.agent ? 'bg-emerald-400' : 'bg-white/20'
                              }`} />
                              <span className={`font-medium ${
                                stat.agent === 'KONSENSÜS' ? 'text-[#00f0ff]' : 'text-white'
                              }`}>
                                {stat.agent}
                              </span>
                              {stat.agent === bestAgent?.agent && stat.agent !== 'KONSENSÜS' && (
                                <Trophy className="w-4 h-4 text-amber-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center text-white/60">
                            {stat.totalMatches}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <AccuracyBadge value={stat.matchResultAccuracy} />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <AccuracyBadge value={stat.overUnderAccuracy} />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <AccuracyBadge value={stat.bttsAccuracy} />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <AccuracyBadge value={stat.overallAccuracy} large />
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Recent Analyses */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Pending Matches */}
              <CollapsibleSection
                title="Bekleyen Maçlar"
                count={pendingAnalyses.length}
                icon={<Clock className="w-5 h-5 text-amber-400" />}
                color="amber"
                isOpen={showPending}
                onToggle={() => setShowPending(!showPending)}
              >
                {pendingAnalyses.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    Bekleyen maç yok
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingAnalyses.map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Settled Matches */}
              <CollapsibleSection
                title="Sonuçlanan Maçlar"
                count={settledAnalyses.length}
                icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
                color="emerald"
                isOpen={showSettled}
                onToggle={() => setShowSettled(!showSettled)}
              >
                {settledAnalyses.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    Henüz sonuçlanan maç yok
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settledAnalyses.map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function AccuracyBadge({ value, large = false }: { value: number; large?: boolean }) {
  const color = value >= 70 ? 'emerald' : value >= 50 ? 'amber' : 'red';
  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30'
  };
  
  return (
    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full border font-mono ${colorClasses[color]} ${large ? 'text-base font-bold' : 'text-sm'}`}>
      {value.toFixed(1)}%
    </span>
  );
}

function CollapsibleSection({
  title,
  count,
  icon,
  color,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: 'amber' | 'emerald';
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const borderColor = color === 'amber' ? 'border-amber-500/30' : 'border-emerald-500/30';
  
  return (
    <div className={`bg-gradient-to-br from-white/5 to-white/0 border ${borderColor} rounded-2xl overflow-hidden backdrop-blur-xl`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-lg font-semibold">{title}</span>
          <span className={`px-3 py-1 rounded-full text-sm ${
            color === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {count}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white/40" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/40" />
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnalysisCard({ analysis, index }: { analysis: AnalysisRecord; index: number }) {
  const isSettled = analysis.match_settled;
  
  // Format date
  const matchDate = analysis.match_date 
    ? new Date(analysis.match_date).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`p-4 rounded-xl border ${
        isSettled ? 'bg-white/5 border-white/10' : 'bg-amber-500/5 border-amber-500/20'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Match Info */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{analysis.home_team}</span>
            <span className="text-white/40">vs</span>
            <span className="font-semibold">{analysis.away_team}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/40">
            <span>{analysis.league}</span>
            <span>•</span>
            <span>{matchDate}</span>
          </div>
        </div>

        {/* Predictions */}
        <div className="flex items-center gap-4">
          {/* MS */}
          <div className="text-center">
            <div className="text-xs text-white/40 mb-1">MS</div>
            <PredictionBadge
              prediction={analysis.consensus_match_result}
              actual={analysis.actual_match_result}
              correct={analysis.consensus_mr_correct}
              isSettled={isSettled}
            />
          </div>

          {/* O/U */}
          <div className="text-center">
            <div className="text-xs text-white/40 mb-1">O/U</div>
            <PredictionBadge
              prediction={analysis.consensus_over_under}
              actual={analysis.actual_over_under}
              correct={analysis.consensus_ou_correct}
              isSettled={isSettled}
            />
          </div>

          {/* BTTS */}
          <div className="text-center">
            <div className="text-xs text-white/40 mb-1">BTTS</div>
            <PredictionBadge
              prediction={analysis.consensus_btts}
              actual={analysis.actual_btts}
              correct={analysis.consensus_btts_correct}
              isSettled={isSettled}
            />
          </div>

          {/* Score */}
          {isSettled && analysis.actual_home_score !== null && (
            <div className="text-center pl-4 border-l border-white/10">
              <div className="text-xs text-white/40 mb-1">Skor</div>
              <div className="font-mono font-bold text-[#00f0ff]">
                {analysis.actual_home_score}-{analysis.actual_away_score}
              </div>
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="text-center min-w-[80px]">
          <div className="text-xs text-white/40 mb-1">Güven</div>
          <div className={`font-mono font-bold ${
            analysis.consensus_confidence >= 70 ? 'text-emerald-400' :
            analysis.consensus_confidence >= 50 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {analysis.consensus_confidence}%
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PredictionBadge({
  prediction,
  actual,
  correct,
  isSettled
}: {
  prediction: string;
  actual: string | null;
  correct: boolean | null;
  isSettled: boolean;
}) {
  const displayValue = prediction || '-';
  
  if (!isSettled) {
    return (
      <span className="inline-flex items-center justify-center w-12 h-7 rounded-md bg-white/10 text-sm font-mono">
        {displayValue}
      </span>
    );
  }
  
  const isCorrect = correct === true;
  
  return (
    <span className={`inline-flex items-center justify-center w-12 h-7 rounded-md text-sm font-mono gap-1 ${
      isCorrect 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
    }`}>
      {displayValue}
      {isCorrect ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
    </span>
  );
}
