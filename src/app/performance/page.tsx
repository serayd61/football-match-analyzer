'use client';

// ============================================================================
// PERFORMANCE TRACKING PAGE - FUTURISTIC DESIGN
// Agent performanslarını ve tahmin doğruluğunu gösterir
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import {
  BarChart3, TrendingUp, Target, CheckCircle, XCircle,
  RefreshCw, Award, Activity, Zap, Trophy, Clock,
  ChevronDown, ChevronUp, Loader2, AlertCircle
} from 'lucide-react';

// ============================================================================
// TRANSLATIONS
// ============================================================================

const labels = {
  tr: {
    title: 'Performans Takibi',
    subtitle: 'Agent ve AI performansını izle',
    refresh: 'Yenile',
    settleMatches: 'Sonuçları Görüntüle',
    settling: 'Sonuçlar Alınıyor...',
    loading: 'Yükleniyor...',
    errorLoading: 'Veri yüklenemedi',
    tryAgain: 'Tekrar Dene',
    noData: 'Henüz analiz verisi yok',
    noDataDesc: 'Dashboard\'dan maç analizi yaparak başlayın',
    goToDashboard: 'Dashboard\'a Git',
    summary: {
      totalMatches: 'Toplam Analiz',
      settledMatches: 'Sonuçlanan',
      pendingMatches: 'Bekleyen',
      overallAccuracy: 'Genel Doğruluk',
    },
    agentPerformance: 'Agent Performansları',
    pendingAnalyses: 'Bekleyen Analizler',
    settledAnalyses: 'Sonuçlanan Analizler',
    matchResult: 'Maç Sonucu',
    overUnder: 'Alt/Üst',
    btts: 'KG Var',
    prediction: 'Tahmin',
    result: 'Sonuç',
    correct: 'Doğru',
    incorrect: 'Yanlış',
    pending: 'Bekliyor',
    confidence: 'Güven',
    accuracy: 'Doğruluk',
    home: 'Ana Sayfa',
    contact: 'İletişim',
  },
  en: {
    title: 'Performance Tracking',
    subtitle: 'Monitor agent and AI performance',
    refresh: 'Refresh',
    settleMatches: 'View Results',
    settling: 'Fetching Results...',
    loading: 'Loading...',
    errorLoading: 'Failed to load data',
    tryAgain: 'Try Again',
    noData: 'No analysis data yet',
    noDataDesc: 'Start by analyzing matches from the Dashboard',
    goToDashboard: 'Go to Dashboard',
    summary: {
      totalMatches: 'Total Analyses',
      settledMatches: 'Settled',
      pendingMatches: 'Pending',
      overallAccuracy: 'Overall Accuracy',
    },
    agentPerformance: 'Agent Performance',
    pendingAnalyses: 'Pending Analyses',
    settledAnalyses: 'Settled Analyses',
    matchResult: 'Match Result',
    overUnder: 'Over/Under',
    btts: 'BTTS',
    prediction: 'Prediction',
    result: 'Result',
    correct: 'Correct',
    incorrect: 'Incorrect',
    pending: 'Pending',
    confidence: 'Confidence',
    accuracy: 'Accuracy',
    home: 'Home',
    contact: 'Contact',
  },
  de: {
    title: 'Leistungsverfolgung',
    subtitle: 'Agent- und KI-Leistung überwachen',
    refresh: 'Aktualisieren',
    settleMatches: 'Ergebnisse anzeigen',
    settling: 'Ergebnisse werden abgerufen...',
    loading: 'Laden...',
    errorLoading: 'Daten konnten nicht geladen werden',
    tryAgain: 'Erneut versuchen',
    noData: 'Noch keine Analysedaten',
    noDataDesc: 'Beginnen Sie mit der Analyse von Spielen im Dashboard',
    goToDashboard: 'Zum Dashboard',
    summary: {
      totalMatches: 'Gesamtanalysen',
      settledMatches: 'Abgeschlossen',
      pendingMatches: 'Ausstehend',
      overallAccuracy: 'Gesamtgenauigkeit',
    },
    agentPerformance: 'Agent-Leistung',
    pendingAnalyses: 'Ausstehende Analysen',
    settledAnalyses: 'Abgeschlossene Analysen',
    matchResult: 'Spielergebnis',
    overUnder: 'Über/Unter',
    btts: 'Beide treffen',
    prediction: 'Vorhersage',
    result: 'Ergebnis',
    correct: 'Richtig',
    incorrect: 'Falsch',
    pending: 'Ausstehend',
    confidence: 'Vertrauen',
    accuracy: 'Genauigkeit',
    home: 'Startseite',
    contact: 'Kontakt',
  },
};

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
  // Best Bet (En İyi Bahis)
  best_bet_market: string | null;
  best_bet_selection: string | null;
  best_bet_confidence: number | null;
  // Actual results
  actual_home_score: number | null;
  actual_away_score: number | null;
  actual_match_result: string | null;
  actual_over_under: string | null;
  actual_btts: string | null;
  consensus_mr_correct: boolean | null;
  consensus_ou_correct: boolean | null;
  consensus_btts_correct: boolean | null;
  // Agent sources (hangi agent'tan geldiği)
  mr_source?: string;
  ou_source?: string;
  btts_source?: string;
}

// Çoklu Filtreleme için interface (her market için ayrı confidence range)
interface MultiFilter {
  ms: { enabled: boolean; selection: 'all' | 'home' | 'away' | 'draw'; minConf: number; maxConf: number };
  ou: { enabled: boolean; selection: 'all' | 'over' | 'under'; minConf: number; maxConf: number };
  btts: { enabled: boolean; selection: 'all' | 'yes' | 'no'; minConf: number; maxConf: number };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PerformancePage() {
  const { lang } = useLanguage();
  const t = labels[lang as keyof typeof labels] || labels.en;
  
  const [stats, setStats] = useState<AccuracyStats[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [showSettled, setShowSettled] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  
  // Çoklu Filtreleme state'leri (MS, O/U, BTTS aynı anda seçilebilir, her biri için ayrı % dilim)
  const [multiFilter, setMultiFilter] = useState<MultiFilter>({
    ms: { enabled: false, selection: 'all', minConf: 50, maxConf: 100 },
    ou: { enabled: false, selection: 'all', minConf: 50, maxConf: 100 },
    btts: { enabled: false, selection: 'all', minConf: 50, maxConf: 100 }
  });
  const [filterLeague, setFilterLeague] = useState<string>('all'); // Lig filtresi
  const [filterAgent, setFilterAgent] = useState<string>('all'); // Agent filtresi: 'all', 'stats', 'odds', 'deepAnalysis', 'masterStrategist', 'smart'

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
      
      // Fetch analyses - Tüm sonuçlanmış maçları getir (limit yok)
      // Çoklu filtreleme parametrelerini API'ye gönder
      const filterParams = new URLSearchParams({
        limit: '1000',
        settled: 'true', // Sadece sonuçlanmış maçlar
        ...(filterLeague !== 'all' && { league: filterLeague }),
        ...(filterAgent !== 'all' && { agent: filterAgent }),
        // Çoklu kriter filtreleri (her biri için ayrı selection ve confidence range)
        ...(multiFilter.ms.enabled && { msSelection: multiFilter.ms.selection }),
        ...(multiFilter.ms.enabled && (multiFilter.ms.minConf !== 50 || multiFilter.ms.maxConf !== 100) && { 
          msMinConf: multiFilter.ms.minConf.toString(),
          msMaxConf: multiFilter.ms.maxConf.toString()
        }),
        ...(multiFilter.ou.enabled && { ouSelection: multiFilter.ou.selection }),
        ...(multiFilter.ou.enabled && (multiFilter.ou.minConf !== 50 || multiFilter.ou.maxConf !== 100) && { 
          ouMinConf: multiFilter.ou.minConf.toString(),
          ouMaxConf: multiFilter.ou.maxConf.toString()
        }),
        ...(multiFilter.btts.enabled && { bttsSelection: multiFilter.btts.selection }),
        ...(multiFilter.btts.enabled && (multiFilter.btts.minConf !== 50 || multiFilter.btts.maxConf !== 100) && { 
          bttsMinConf: multiFilter.btts.minConf.toString(),
          bttsMaxConf: multiFilter.btts.maxConf.toString()
        }),
      });
      
      const analysesRes = await fetch(`/api/performance/get-analyses?${filterParams}`);
      const analysesData = await analysesRes.json();
      
      console.log('📋 Analyses API response:', analysesData);
      console.log('   Data count:', analysesData.data?.length || 0);
      
      if (analysesData.success) {
        setAnalyses(analysesData.data || []);
        console.log('   Set analyses:', analysesData.data?.length || 0, 'records');
      } else {
        console.error('   Analyses fetch failed:', analysesData.error);
      }
      
      // Fetch insights (statistical correlations)
      const insightsRes = await fetch('/api/performance/insights');
      const insightsData = await insightsRes.json();
      
      if (insightsData.success && insightsData.insights) {
        setInsights(insightsData.insights);
        console.log('📊 Insights loaded');
      }
      
    } catch (err: any) {
      setError(err.message || t.errorLoading);
    } finally {
      setLoading(false);
    }
  }, [filterLeague, filterAgent, multiFilter, t]);

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
  
  // Lig listesini çıkar (filtreleme için) - Tüm analizlerden (filtrelenmemiş)
  const allAnalysesForLeagues = analyses.filter(a => a.match_settled);
  const allLeagues = Array.from(new Set(allAnalysesForLeagues.map(a => a.league).filter(Boolean))).sort();
  
  // Not: Filtreleme artık API'de yapılıyor, burada sadece gösterim için kullanıyoruz
  
  console.log('🔍 Analyses state:', analyses.length, 'total');
  console.log('   Pending:', pendingAnalyses.length);
  console.log('   Settled:', settledAnalyses.length);

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
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff] to-[#ff00ff] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-xl">⚽</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] bg-clip-text text-transparent">
              FootballAnalytics
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] text-black">
              PRO
            </span>
          </Link>
          
          <div className="flex items-center gap-6">
            {/* Home */}
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors"
            >
              <span>🏠</span>
              <span>{t.home}</span>
            </Link>
            
            {/* Contact */}
            <Link 
              href="/contact" 
              className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors"
            >
              <span>💬</span>
              <span>{t.contact}</span>
            </Link>

            {/* Refresh */}
            <motion.button
              onClick={fetchData}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#00f0ff]/50 flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </motion.button>
            
            {/* Settle Matches */}
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
              {settling ? t.settling : t.settleMatches}
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#00f0ff] via-white to-[#ff00ff] bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </motion.div>
        
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-[#00f0ff] animate-spin mb-4" />
            <p className="text-white/60">{t.loading}</p>
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
              <h3 className="text-red-400 font-semibold">{t.errorLoading}</h3>
              <p className="text-white/60">{error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="ml-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              {t.tryAgain}
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
                  <span className="text-xs text-white/40 uppercase tracking-wider">{t.summary.totalMatches}</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">
                  {summary?.totalMatches || 0}
                </div>
              </div>

              {/* Settled */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">{t.summary.settledMatches}</span>
                </div>
                <div className="text-4xl font-bold text-emerald-400 mb-1">
                  {summary?.settledMatches || 0}
                </div>
              </div>

              {/* Pending */}
              <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="w-8 h-8 text-amber-400" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">{t.summary.pendingMatches}</span>
                </div>
                <div className="text-4xl font-bold text-amber-400 mb-1">
                  {summary?.pendingMatches || 0}
                </div>
              </div>

              {/* Consensus Accuracy */}
              <div className="bg-gradient-to-br from-[#00f0ff]/10 to-[#ff00ff]/5 border border-[#00f0ff]/30 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <Trophy className="w-8 h-8 text-[#00f0ff]" />
                  <span className="text-xs text-[#00f0ff]/60 uppercase tracking-wider">{t.summary.overallAccuracy}</span>
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] bg-clip-text text-transparent mb-1">
                  {summary?.consensusAccuracy || 0}%
                </div>
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
                  {t.agentPerformance}
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
                  <p>{t.noData}</p>
                  <p className="text-sm mt-2">{t.noDataDesc}</p>
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

            {/* Statistical Insights */}
            {insights && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-[#ff00ff]/5 to-[#00f0ff]/5 border border-[#ff00ff]/20 rounded-2xl overflow-hidden backdrop-blur-xl mb-8"
              >
                <button
                  onClick={() => setShowInsights(!showInsights)}
                  className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 text-[#ff00ff]" />
                    <span className="text-xl font-bold">📊 İstatistiksel Analizler</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-[#ff00ff]/20 text-[#ff00ff]">
                      {insights.keyFindings?.length || 0} bulgu
                    </span>
                  </div>
                  {showInsights ? (
                    <ChevronUp className="w-5 h-5 text-white/40" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/40" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showInsights && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 space-y-6">
                        {/* Key Findings */}
                        {insights.keyFindings && insights.keyFindings.length > 0 && (
                          <div className="bg-black/30 rounded-xl p-4">
                            <h4 className="text-lg font-bold text-[#00f0ff] mb-3">🎯 Önemli Bulgular</h4>
                            <div className="space-y-2">
                              {insights.keyFindings.map((finding: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                  <span className="text-white/80">{finding}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Market Analysis Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Match Result */}
                          <MarketInsightCard 
                            title="Maç Sonucu" 
                            icon="⚽" 
                            data={insights.matchResult} 
                          />
                          
                          {/* Over/Under */}
                          <MarketInsightCard 
                            title="Alt/Üst 2.5" 
                            icon="📊" 
                            data={insights.overUnder} 
                          />
                          
                          {/* BTTS */}
                          <MarketInsightCard 
                            title="KG Var" 
                            icon="🎯" 
                            data={insights.btts} 
                          />
                        </div>
                        
                        {/* Confidence Calibration */}
                        {insights.confidenceCalibration && (
                          <div className="bg-black/30 rounded-xl p-4">
                            <h4 className="text-lg font-bold text-amber-400 mb-3">📈 Güven Kalibrasyonu</h4>
                            <p className="text-xs text-white/50 mb-3">AI güven seviyeleri gerçek sonuçlarla ne kadar uyumlu?</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {insights.confidenceCalibration.map((cal: any) => (
                                <div key={cal.level} className="bg-white/5 rounded-lg p-3 text-center">
                                  <div className="text-sm font-bold text-white mb-1">{cal.level}</div>
                                  <div className="text-xs text-white/50 mb-2">Beklenen: %{cal.expected}</div>
                                  <div className={`text-lg font-bold ${
                                    cal.actual >= cal.expected ? 'text-emerald-400' : 'text-amber-400'
                                  }`}>
                                    %{cal.actual}
                                  </div>
                                  <div className="text-xs mt-1">{cal.calibration}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Best Bet Performance */}
                        {insights.bestBets && insights.bestBets.length > 0 && (
                          <div className="bg-black/30 rounded-xl p-4">
                            <h4 className="text-lg font-bold text-[#00f0ff] mb-3">🔥 En İyi Bahis Performansı</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-white/10">
                                    <th className="text-left py-2 text-white/60">Market</th>
                                    <th className="text-left py-2 text-white/60">Seçim</th>
                                    <th className="text-center py-2 text-white/60">Güven</th>
                                    <th className="text-center py-2 text-white/60">Maç</th>
                                    <th className="text-center py-2 text-white/60">Başarı</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {insights.bestBets.slice(0, 10).map((bet: any, idx: number) => (
                                    <tr key={idx} className="border-b border-white/5">
                                      <td className="py-2 text-white">{bet.market}</td>
                                      <td className="py-2 text-[#ff00ff] font-medium">{bet.selection}</td>
                                      <td className="py-2 text-center text-white/60">{bet.confidenceRange}</td>
                                      <td className="py-2 text-center text-white/60">{bet.total}</td>
                                      <td className="py-2 text-center">
                                        <span className={`font-bold ${
                                          bet.accuracy >= 70 ? 'text-emerald-400' :
                                          bet.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                          %{bet.accuracy}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Recent Analyses */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Pending Matches */}
              <CollapsibleSection
                title={t.pendingAnalyses}
                count={pendingAnalyses.length}
                icon={<Clock className="w-5 h-5 text-amber-400" />}
                color="amber"
                isOpen={showPending}
                onToggle={() => setShowPending(!showPending)}
              >
                {pendingAnalyses.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    {t.noData}
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
                title={t.settledAnalyses}
                count={settledAnalyses.length}
                icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
                color="emerald"
                isOpen={showSettled}
                onToggle={() => setShowSettled(!showSettled)}
              >
                {/* Çoklu Filtreleme UI */}
                <div className="mb-4 pb-4 border-b border-white/10 space-y-4">
                  {/* Üst Satır: Lig, Agent, Güven */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-white/60">🔍 Filtrele:</span>
                    
                    {/* Lig Filtresi */}
                    <select
                      value={filterLeague}
                      onChange={(e) => setFilterLeague(e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00f0ff]/50 min-w-[180px]"
                    >
                      <option value="all">Tüm Ligler</option>
                      {allLeagues.map((league) => (
                        <option key={league} value={league}>
                          {league}
                        </option>
                      ))}
                    </select>
                    
                    {/* Agent Filtresi */}
                    <select
                      value={filterAgent}
                      onChange={(e) => setFilterAgent(e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00f0ff]/50"
                    >
                      <option value="all">Tüm Agent'lar</option>
                      <option value="stats">📊 Stats Agent</option>
                      <option value="odds">💰 Odds Agent</option>
                      <option value="deepAnalysis">🔬 Deep Analysis</option>
                      <option value="masterStrategist">🧠 Master Strategist</option>
                      <option value="smart">🤖 AI Smart (Claude+DeepSeek)</option>
                    </select>
                    
                    {/* Sonuç Sayısı */}
                    <span className="text-xs text-white/40 ml-auto">
                      {settledAnalyses.length} sonuç
                    </span>
                  </div>
                  
                  {/* Alt Satır: Çoklu Market Filtreleri (MS, O/U, BTTS) */}
                  <div className="flex flex-wrap items-start gap-4">
                    {/* MS Filtresi */}
                    <div className={`flex flex-col gap-2 px-3 py-2 rounded-lg border transition-all ${
                      multiFilter.ms.enabled 
                        ? 'bg-cyan-500/20 border-cyan-500/50' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={multiFilter.ms.enabled}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ms: { ...prev.ms, enabled: e.target.checked }
                            }))}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500/50"
                          />
                          <span className="text-sm text-white font-medium">MS</span>
                        </label>
                        {multiFilter.ms.enabled && (
                          <select
                            value={multiFilter.ms.selection}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ms: { ...prev.ms, selection: e.target.value as 'all' | 'home' | 'away' | 'draw' }
                            }))}
                            className="px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-xs focus:outline-none focus:border-cyan-500/50"
                          >
                            <option value="all">Tümü</option>
                            <option value="home">1 (Ev)</option>
                            <option value="away">2 (Dep)</option>
                            <option value="draw">X (Ber)</option>
                          </select>
                        )}
                      </div>
                      {multiFilter.ms.enabled && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/50">%</span>
                          <select
                            value={multiFilter.ms.minConf}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ms: { ...prev.ms, minConf: parseInt(e.target.value) }
                            }))}
                            className="px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] w-12 focus:outline-none focus:border-cyan-500/50"
                          >
                            {Array.from({ length: 51 }, (_, i) => 50 + i).map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                          <span className="text-white/30">-</span>
                          <select
                            value={multiFilter.ms.maxConf}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ms: { ...prev.ms, maxConf: parseInt(e.target.value) }
                            }))}
                            className="px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] w-12 focus:outline-none focus:border-cyan-500/50"
                          >
                            {Array.from({ length: 51 }, (_, i) => 50 + i).map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    
                    {/* O/U Filtresi */}
                    <div className={`flex flex-col gap-2 px-3 py-2 rounded-lg border transition-all ${
                      multiFilter.ou.enabled 
                        ? 'bg-amber-500/20 border-amber-500/50' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={multiFilter.ou.enabled}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ou: { ...prev.ou, enabled: e.target.checked }
                            }))}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500/50"
                          />
                          <span className="text-sm text-white font-medium">O/U</span>
                        </label>
                        {multiFilter.ou.enabled && (
                          <select
                            value={multiFilter.ou.selection}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ou: { ...prev.ou, selection: e.target.value as 'all' | 'over' | 'under' }
                            }))}
                            className="px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-xs focus:outline-none focus:border-amber-500/50"
                          >
                            <option value="all">Tümü</option>
                            <option value="over">Over (Üst)</option>
                            <option value="under">Under (Alt)</option>
                          </select>
                        )}
                      </div>
                      {multiFilter.ou.enabled && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/50">%</span>
                          <select
                            value={multiFilter.ou.minConf}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ou: { ...prev.ou, minConf: parseInt(e.target.value) }
                            }))}
                            className="px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] w-12 focus:outline-none focus:border-amber-500/50"
                          >
                            {Array.from({ length: 51 }, (_, i) => 50 + i).map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                          <span className="text-white/30">-</span>
                          <select
                            value={multiFilter.ou.maxConf}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              ou: { ...prev.ou, maxConf: parseInt(e.target.value) }
                            }))}
                            className="px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] w-12 focus:outline-none focus:border-amber-500/50"
                          >
                            {Array.from({ length: 51 }, (_, i) => 50 + i).map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    
                    {/* BTTS Filtresi */}
                    <div className={`flex flex-col gap-2 px-3 py-2 rounded-lg border transition-all ${
                      multiFilter.btts.enabled 
                        ? 'bg-emerald-500/20 border-emerald-500/50' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={multiFilter.btts.enabled}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              btts: { ...prev.btts, enabled: e.target.checked }
                            }))}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-500/50"
                          />
                          <span className="text-sm text-white font-medium">BTTS</span>
                        </label>
                        {multiFilter.btts.enabled && (
                          <select
                            value={multiFilter.btts.selection}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              btts: { ...prev.btts, selection: e.target.value as 'all' | 'yes' | 'no' }
                            }))}
                            className="px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-xs focus:outline-none focus:border-emerald-500/50"
                          >
                            <option value="all">Tümü</option>
                            <option value="yes">Yes (Var)</option>
                            <option value="no">No (Yok)</option>
                          </select>
                        )}
                      </div>
                      {multiFilter.btts.enabled && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/50">%</span>
                          <select
                            value={multiFilter.btts.minConf}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              btts: { ...prev.btts, minConf: parseInt(e.target.value) }
                            }))}
                            className="px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] w-12 focus:outline-none focus:border-emerald-500/50"
                          >
                            {Array.from({ length: 51 }, (_, i) => 50 + i).map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                          <span className="text-white/30">-</span>
                          <select
                            value={multiFilter.btts.maxConf}
                            onChange={(e) => setMultiFilter(prev => ({
                              ...prev,
                              btts: { ...prev.btts, maxConf: parseInt(e.target.value) }
                            }))}
                            className="px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] w-12 focus:outline-none focus:border-emerald-500/50"
                          >
                            {Array.from({ length: 51 }, (_, i) => 50 + i).map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    
                    {/* Filtreleri Temizle */}
                    {(filterLeague !== 'all' || filterAgent !== 'all' || multiFilter.ms.enabled || multiFilter.ou.enabled || multiFilter.btts.enabled) && (
                      <button
                        onClick={() => {
                          setFilterLeague('all');
                          setFilterAgent('all');
                          setMultiFilter({
                            ms: { enabled: false, selection: 'all', minConf: 50, maxConf: 100 },
                            ou: { enabled: false, selection: 'all', minConf: 50, maxConf: 100 },
                            btts: { enabled: false, selection: 'all', minConf: 50, maxConf: 100 }
                          });
                        }}
                        className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm hover:bg-red-500/30 transition-colors self-start"
                      >
                        ✕ Temizle
                      </button>
                    )}
                  </div>
                  
                  {/* Aktif Filtreler Badge'leri */}
                  {(multiFilter.ms.enabled || multiFilter.ou.enabled || multiFilter.btts.enabled || filterAgent !== 'all') && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="text-xs text-white/40">Aktif:</span>
                      {filterAgent !== 'all' && (
                        <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">
                          🤖 {filterAgent === 'stats' ? 'Stats' : filterAgent === 'odds' ? 'Odds' : filterAgent === 'deepAnalysis' ? 'Deep' : filterAgent === 'masterStrategist' ? 'Master' : 'Smart'}
                        </span>
                      )}
                      {multiFilter.ms.enabled && (
                        <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-300 text-xs">
                          MS{multiFilter.ms.selection !== 'all' ? `=${multiFilter.ms.selection === 'home' ? '1' : multiFilter.ms.selection === 'away' ? '2' : 'X'}` : ''} ({multiFilter.ms.minConf}-{multiFilter.ms.maxConf}%)
                        </span>
                      )}
                      {multiFilter.ou.enabled && (
                        <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 text-xs">
                          O/U{multiFilter.ou.selection !== 'all' ? `=${multiFilter.ou.selection === 'over' ? 'Üst' : 'Alt'}` : ''} ({multiFilter.ou.minConf}-{multiFilter.ou.maxConf}%)
                        </span>
                      )}
                      {multiFilter.btts.enabled && (
                        <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-300 text-xs">
                          BTTS{multiFilter.btts.selection !== 'all' ? `=${multiFilter.btts.selection === 'yes' ? 'Var' : 'Yok'}` : ''} ({multiFilter.btts.minConf}-{multiFilter.btts.maxConf}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {settledAnalyses.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    {multiFilter.ms.enabled || multiFilter.ou.enabled || multiFilter.btts.enabled || filterAgent !== 'all'
                      ? 'Filtreye uygun sonuç bulunamadı' 
                      : t.noData}
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#ff00ff] flex items-center justify-center">
                <span className="text-sm">⚽</span>
              </div>
              <span className="text-white/60">
                © 2025 FootballAnalytics Pro. Tüm hakları saklıdır.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <Link href="/contact" className="hover:text-[#00f0ff] transition-colors">
                {t.contact}
              </Link>
              <span>•</span>
              <span>Made with 💜 for Football</span>
            </div>
          </div>
        </div>
      </footer>
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

function MarketInsightCard({ title, icon, data }: { title: string; icon: string; data: any }) {
  if (!data) return null;
  
  return (
    <div className="bg-black/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-white flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </h4>
        <span className={`text-lg font-bold ${
          data.overallAccuracy >= 60 ? 'text-emerald-400' :
          data.overallAccuracy >= 45 ? 'text-amber-400' : 'text-red-400'
        }`}>
          %{data.overallAccuracy}
        </span>
      </div>
      
      {/* By Confidence */}
      {data.byConfidence && data.byConfidence.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-white/50 mb-2">Güven seviyesine göre:</p>
          <div className="space-y-1">
            {data.byConfidence.map((bucket: any) => (
              <div key={bucket.range} className="flex items-center justify-between text-xs">
                <span className="text-white/60">{bucket.range}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white/40">{bucket.correct}/{bucket.total}</span>
                  <span className={`font-bold ${
                    bucket.accuracy >= 60 ? 'text-emerald-400' :
                    bucket.accuracy >= 45 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    %{bucket.accuracy}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Correlations */}
      {data.correlations && data.correlations.length > 0 && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-xs text-white/50 mb-2">Tahmin → Gerçek:</p>
          <div className="space-y-2">
            {data.correlations.map((corr: any) => (
              <div key={corr.prediction} className="bg-white/5 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#00f0ff] uppercase">{corr.prediction}</span>
                  <span className="text-xs text-white/40">{corr.total} maç</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {corr.actualOutcomes.map((outcome: any) => (
                    <span 
                      key={outcome.outcome}
                      className={`text-xs px-2 py-0.5 rounded ${
                        outcome.outcome === corr.prediction 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {outcome.outcome.toUpperCase()}: %{outcome.percentage}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Paradoxes */}
      {data.paradoxes && data.paradoxes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-red-500/20">
          {data.paradoxes.map((paradox: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-red-400">
              <span>⚠️</span>
              <span>{paradox}</span>
            </div>
          ))}
        </div>
      )}
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
              source={analysis.mr_source}
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
              source={analysis.ou_source}
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
              source={analysis.btts_source}
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

        {/* Best Bet - En İyi Bahis */}
        {analysis.best_bet_market && analysis.best_bet_selection && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00f0ff]/10 to-[#ff00ff]/10 border border-[#00f0ff]/30">
            <div className="text-xs text-[#00f0ff] font-medium">🔥 En İyi</div>
            <div className="text-sm font-bold text-white">
              {analysis.best_bet_market === 'Over/Under 2.5' ? 'O/U' : 
               analysis.best_bet_market === 'Match Result' ? 'MS' :
               analysis.best_bet_market === 'BTTS' ? 'BTTS' :
               analysis.best_bet_market}
            </div>
            <div className="text-sm font-mono text-[#ff00ff]">
              {analysis.best_bet_selection}
            </div>
            {analysis.best_bet_confidence && (
              <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                analysis.best_bet_confidence >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                analysis.best_bet_confidence >= 50 ? 'bg-amber-500/20 text-amber-400' : 
                'bg-red-500/20 text-red-400'
              }`}>
                %{analysis.best_bet_confidence}
              </div>
            )}
          </div>
        )}

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
  isSettled,
  source
}: {
  prediction: string;
  actual: string | null;
  correct: boolean | null;
  isSettled: boolean;
  source?: string;
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
  
  // Agent source kısaltmaları
  const getSourceShort = (src?: string) => {
    if (!src) return '';
    if (src.includes('Stats')) return 'Stats';
    if (src.includes('Odds')) return 'Odds';
    if (src.includes('Deep')) return 'Deep';
    if (src.includes('Genius')) return 'Genius';
    if (src.includes('Master')) return 'Master';
    if (src.includes('Konsensüs')) return 'Kons';
    return src;
  };
  
  return (
    <div className="flex flex-col items-center gap-0.5">
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
      {source && (
        <span className="text-[10px] text-white/30 font-mono" title={source}>
          {getSourceShort(source)}
        </span>
      )}
    </div>
  );
}
