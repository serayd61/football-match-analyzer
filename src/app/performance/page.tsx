'use client';

// ============================================================================
// PERFORMANCE TRACKING PAGE v2 - OPTIMIZED
// React Query + Virtual Scroll + Parallel Fetch
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import {
  RefreshCw, Loader2, AlertCircle, BarChart3, Award, TrendingUp, Trophy, ArrowLeft, Home
} from 'lucide-react';

import {
  PerformanceSummaryCards,
  PerformanceFilters,
  AgentPerformanceTable,
  LeagueBreakdown,
  AnalysisTable,
  PerformanceTrends
} from '@/components/performance';

// ============================================================================
// TYPES
// ============================================================================

interface MultiFilter {
  ms: { enabled: boolean; selection: 'all' | 'home' | 'away' | 'draw'; minConf: number };
  ou: { enabled: boolean; selection: 'all' | 'over' | 'under'; minConf: number };
  btts: { enabled: boolean; selection: 'all' | 'yes' | 'no'; minConf: number };
}

type TabType = 'overview' | 'agents' | 'leagues' | 'trends';

// ============================================================================
// API FETCH FUNCTIONS
// ============================================================================

async function fetchStats() {
  const res = await fetch('/api/performance/stats-v2');
  if (!res.ok) throw new Error('Stats fetch failed');
  return res.json();
}

async function fetchAnalyses(params: {
  page: number;
  settled: string;
  league: string;
  multiFilter: MultiFilter;
}) {
  const filterParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: '50',
    settled: params.settled,
    ...(params.league !== 'all' && { league: params.league }),
    ...(params.multiFilter.ms.enabled && { msSelection: params.multiFilter.ms.selection }),
    ...(params.multiFilter.ms.enabled && params.multiFilter.ms.minConf > 0 && { msMinConf: params.multiFilter.ms.minConf.toString() }),
    ...(params.multiFilter.ou.enabled && { ouSelection: params.multiFilter.ou.selection }),
    ...(params.multiFilter.ou.enabled && params.multiFilter.ou.minConf > 0 && { ouMinConf: params.multiFilter.ou.minConf.toString() }),
    ...(params.multiFilter.btts.enabled && { bttsSelection: params.multiFilter.btts.selection }),
    ...(params.multiFilter.btts.enabled && params.multiFilter.btts.minConf > 0 && { bttsMinConf: params.multiFilter.btts.minConf.toString() }),
  });
  
  const res = await fetch(`/api/performance/analyses-v2?${filterParams}`);
  if (!res.ok) throw new Error('Analyses fetch failed');
  return res.json();
}

async function fetchTrends(days: number = 30) {
  const res = await fetch(`/api/performance/trends?days=${days}&period=all`);
  if (!res.ok) throw new Error('Trends fetch failed');
  return res.json();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PerformancePage() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [page, setPage] = useState(1);
  const [settled, setSettled] = useState<'all' | 'true' | 'false'>('true');
  const [filterLeague, setFilterLeague] = useState<string>('all');
  const [multiFilter, setMultiFilter] = useState<MultiFilter>({
    ms: { enabled: false, selection: 'all', minConf: 0 },
    ou: { enabled: false, selection: 'all', minConf: 0 },
    btts: { enabled: false, selection: 'all', minConf: 0 }
  });
  const [settling, setSettling] = useState(false);

  // Queries - Parallel fetch
  const statsQuery = useQuery({
    queryKey: ['performance-stats'],
    queryFn: fetchStats,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const analysesQuery = useQuery({
    queryKey: ['performance-analyses', page, settled, filterLeague, multiFilter],
    queryFn: () => fetchAnalyses({ page, settled, league: filterLeague, multiFilter }),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000,
  });

  const trendsQuery = useQuery({
    queryKey: ['performance-trends'],
    queryFn: () => fetchTrends(30),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  // Derived data
  const summary = statsQuery.data?.summary || {
    totalMatches: 0,
    settledMatches: 0,
    pendingMatches: 0,
    consensusAccuracy: 0,
    matchResultAccuracy: 0,
    overUnderAccuracy: 0,
    bttsAccuracy: 0
  };

  const agentStats = statsQuery.data?.agentStats || [];
  const leagueStats = statsQuery.data?.leagueStats || [];
  const analyses = analysesQuery.data?.data || [];
  const pagination = analysesQuery.data?.pagination;
  const dailyTrends = trendsQuery.data?.dailyTrends || [];
  const weeklyTrends = trendsQuery.data?.weeklyTrends || [];
  const cumulativeStats = trendsQuery.data?.cumulativeStats || {};

  // Extract unique leagues
  const leagues = useMemo(() => {
    return leagueStats.map((l: any) => l.league).filter(Boolean);
  }, [leagueStats]);

  // Handlers
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['performance-stats'] });
    queryClient.invalidateQueries({ queryKey: ['performance-analyses'] });
    queryClient.invalidateQueries({ queryKey: ['performance-trends'] });
  }, [queryClient]);

  const handleSettleMatches = async () => {
    setSettling(true);
    try {
      const res = await fetch('/api/performance/settle-matches', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        handleRefresh();
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

  const handleClearFilters = useCallback(() => {
    setFilterLeague('all');
    setSettled('true');
    setMultiFilter({
      ms: { enabled: false, selection: 'all', minConf: 0 },
      ou: { enabled: false, selection: 'all', minConf: 0 },
      btts: { enabled: false, selection: 'all', minConf: 0 }
    });
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const isLoading = statsQuery.isLoading || analysesQuery.isLoading;
  const hasError = statsQuery.isError || analysesQuery.isError;

  // Tab content
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Genel Bakış', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'agents', label: 'Agent Detay', icon: <Award className="w-4 h-4" /> },
    { id: 'leagues', label: 'Lig Analizi', icon: <Trophy className="w-4 h-4" /> },
    { id: 'trends', label: 'Trendler', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="fa-shell min-h-screen">
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Back Navigation */}
          <div className="mb-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-content-subtle hover:text-content transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <Home className="w-4 h-4" />
              <span className="text-sm">Ana Sayfa</span>
            </Link>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl grid place-items-center bg-brand-500/10 border border-brand-500/25 text-brand-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-content tracking-tight">Performans Takibi</h1>
                <p className="text-content-subtle text-sm mt-0.5">Agent ve AI performansını detaylı izle</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} disabled={isLoading} className="fa-btn fa-btn-secondary">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Yenile
              </button>
              <button onClick={handleSettleMatches} disabled={settling} className="fa-btn fa-btn-primary">
                {settling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {settling ? 'İşleniyor...' : 'Sonuçları Güncelle'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error State */}
        {hasError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-negative/10 border border-negative/30 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-negative" />
            <span className="text-negative">Veri yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</span>
            <button onClick={handleRefresh} className="ml-auto text-negative hover:opacity-80 text-sm underline">
              Tekrar Dene
            </button>
          </motion.div>
        )}

        {/* Summary Cards */}
        <PerformanceSummaryCards
          totalMatches={summary.totalMatches}
          settledMatches={summary.settledMatches}
          pendingMatches={summary.pendingMatches}
          consensusAccuracy={summary.consensusAccuracy}
          matchResultAccuracy={summary.matchResultAccuracy}
          overUnderAccuracy={summary.overUnderAccuracy}
          bttsAccuracy={summary.bttsAccuracy}
          isLoading={statsQuery.isLoading}
        />

        {/* Filters */}
        <PerformanceFilters
          leagues={leagues}
          selectedLeague={filterLeague}
          onLeagueChange={(league) => { setFilterLeague(league); setPage(1); }}
          multiFilter={multiFilter}
          onMultiFilterChange={(filter) => { setMultiFilter(filter); setPage(1); }}
          settled={settled}
          onSettledChange={(s) => { setSettled(s); setPage(1); }}
          onClearFilters={handleClearFilters}
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-surface-1 border border-line rounded-xl p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-surface-4 text-content border border-line shadow-elev-1'
                  : 'text-content-subtle hover:text-content hover:bg-surface-2'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Agent Performance Summary */}
              <AgentPerformanceTable
                agentStats={agentStats}
                isLoading={statsQuery.isLoading}
              />
              
              {/* Analysis List */}
              <AnalysisTable
                analyses={analyses}
                isLoading={analysesQuery.isLoading}
                pagination={pagination}
                onPageChange={handlePageChange}
              />
            </div>
          )}

          {activeTab === 'agents' && (
            <AgentPerformanceTable
              agentStats={agentStats}
              isLoading={statsQuery.isLoading}
            />
          )}

          {activeTab === 'leagues' && (
            <LeagueBreakdown
              leagueStats={leagueStats}
              isLoading={statsQuery.isLoading}
            />
          )}

          {activeTab === 'trends' && (
            <PerformanceTrends
              dailyTrends={dailyTrends}
              weeklyTrends={weeklyTrends}
              cumulativeStats={cumulativeStats}
              isLoading={trendsQuery.isLoading}
            />
          )}
        </motion.div>

        {/* Processing Time Info */}
        {(statsQuery.data?.processingTime || analysesQuery.data?.processingTime) && (
          <div className="mt-6 text-center text-xs text-content-subtle">
            Stats: {statsQuery.data?.processingTime || '-'}ms | 
            Analyses: {analysesQuery.data?.processingTime || '-'}ms |
            Trends: {trendsQuery.data?.processingTime || '-'}ms
          </div>
        )}
      </div>
    </div>
  );
}
