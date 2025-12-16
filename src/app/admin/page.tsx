'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  FiBarChart2, FiTrendingUp, FiCheckCircle, FiClock, 
  FiActivity, FiAward, FiTarget, FiFilter,
  FiChevronDown, FiChevronUp, FiCalendar, FiRefreshCw
} from 'react-icons/fi';
import { 
  SiGooglegemini, SiOpenai 
} from 'react-icons/si';
import { BsRobot, BsCpu } from 'react-icons/bs';
import { GiBrain } from 'react-icons/gi';

interface DashboardStats {
  overview: {
    totalPredictions: number;
    pendingPredictions: number;
    settledPredictions: number;
    overallAccuracy: number;
    todayPredictions: number;
    todayAccuracy: number | null;
  };
  byAnalysisType: {
    type: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  byMarket: {
    market: string;
    total: number;
    correct: number;
    accuracy: number;
    byModel: {
      model: string;
      total: number;
      correct: number;
      accuracy: number;
    }[];
  }[];
  byModel: {
    model: string;
    total: number;
    correct: number;
    accuracy: number;
    avgConfidence: number;
    calibrationScore: number;
  }[];
  recentPredictions: any[];
  dailyTrend: {
    date: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
}

interface DetailedModelStats {
  model: string;
  markets: {
    market: string;
    periods: {
      period: 'daily' | 'weekly' | 'monthly' | 'all';
      total: number;
      correct: number;
      accuracy: number;
      avgConfidence: number;
      confidenceThresholds: {
        threshold: number;
        total: number;
        correct: number;
        accuracy: number;
      }[];
    }[];
  }[];
}

interface ConfidenceThresholdAnalysis {
  model: string;
  market: string;
  thresholds: {
    minConfidence: number;
    maxConfidence: number;
    total: number;
    correct: number;
    accuracy: number;
    recommendedBet: boolean;
  }[];
}

interface WeeklyBreakdown {
  weekStart: string;
  weekEnd: string;
  models: {
    model: string;
    markets: {
      market: string;
      total: number;
      correct: number;
      accuracy: number;
    }[];
    overallAccuracy: number;
  }[];
}

interface PredictionRecord {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  analysis_type: string;
  predictions: any;
  consensus: any;
  best_bets: any[];
  risk_level: string;
  status: string;
  created_at: string;
}

const MODEL_ICONS: { [key: string]: any } = {
  claude: GiBrain,
  gpt4: SiOpenai,
  gemini: SiGooglegemini,
  perplexity: BsRobot,
  consensus: FiTarget,
};

const MODEL_COLORS: { [key: string]: string } = {
  claude: 'from-orange-500 to-amber-600',
  gpt4: 'from-emerald-500 to-green-600',
  gemini: 'from-blue-500 to-indigo-600',
  perplexity: 'from-purple-500 to-violet-600',
  consensus: 'from-cyan-500 to-teal-600',
};

const MODEL_NAMES: { [key: string]: string } = {
  claude: 'Claude',
  gpt4: 'GPT-4',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  consensus: 'Consensus',
};

const MARKET_NAMES: { [key: string]: string } = {
  matchResult: 'Maç Sonucu',
  over25: 'Üst/Alt 2.5',
  btts: 'KG Var/Yok',
  firstHalfGoals: 'İlk Yarı Gol',
};

const ANALYSIS_TYPE_NAMES: { [key: string]: string } = {
  'quad-brain': 'Quad-Brain',
  'agents': 'AI Agents',
  'ai-consensus': 'AI Consensus',
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'settled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'predictions'>('overview');
  const [detailedStats, setDetailedStats] = useState<{
    modelStats: DetailedModelStats[];
    confidenceAnalysis: ConfidenceThresholdAnalysis[];
    weeklyBreakdown: WeeklyBreakdown[];
  } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('claude');
  const [selectedMarket, setSelectedMarket] = useState<string>('matchResult');

  // Admin erişim kontrolü - sadece belirli email'ler girebilir
  const ADMIN_EMAILS = [
    'serayd61@hotmail.com',
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.email) {
      if (!ADMIN_EMAILS.includes(session.user.email)) {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, period, filterStatus, currentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch(`/api/admin/stats?period=${period}`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Fetch predictions
      const predRes = await fetch(
        `/api/admin/predictions?page=${currentPage}&limit=10&status=${filterStatus}`
      );
      const predData = await predRes.json();
      if (predData.success) {
        setPredictions(predData.data);
        setTotalPages(predData.totalPages);
      }

      // Fetch detailed stats
      const detailedRes = await fetch('/api/admin/detailed-stats');
      const detailedData = await detailedRes.json();
      if (detailedData.success) {
        setDetailedStats(detailedData.data);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
    setLoading(false);
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 70) return 'text-emerald-400';
    if (accuracy >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 70) return 'bg-emerald-500/20 border-emerald-500/30';
    if (accuracy >= 55) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Admin Panel yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated' && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Erişim Engellendi</h1>
          <p className="text-gray-400">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900 p-4 md:p-6 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <FiBarChart2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Admin Panel
              </h1>
              <p className="text-gray-400 text-sm">AI Prediction Performance Tracker</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-t-lg text-sm font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-500'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            📊 Genel Bakış
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={`px-6 py-3 rounded-t-lg text-sm font-semibold transition-all ${
              activeTab === 'detailed'
                ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            🎯 Detaylı İstatistikler
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`px-6 py-3 rounded-t-lg text-sm font-semibold transition-all ${
              activeTab === 'predictions'
                ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-500'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            📋 Tahmin Kayıtları
          </button>
          <div className="flex-1"></div>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-400 hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" />
            Yenile
          </button>
        </div>

        {/* Period Filter - Only show on overview */}
        {activeTab === 'overview' && (
          <div className="flex flex-wrap gap-2 mb-6">
            {(['7d', '30d', '90d', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {p === '7d' ? '7 Gün' : p === '30d' ? '30 Gün' : p === '90d' ? '90 Gün' : 'Tümü'}
              </button>
            ))}
          </div>
        )}

        {/* ==================== OVERVIEW TAB ==================== */}
        {activeTab === 'overview' && (
          <>
            {/* Overview Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <FiActivity className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400 text-sm">Toplam Tahmin</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.overview.totalPredictions}</p>
              <p className="text-xs text-gray-500 mt-1">
                Bugün: {stats.overview.todayPredictions}
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <FiCheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-gray-400 text-sm">Sonuçlanan</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.overview.settledPredictions}</p>
              <p className="text-xs text-gray-500 mt-1">
                Bekleyen: {stats.overview.pendingPredictions}
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <FiTarget className="w-5 h-5 text-cyan-400" />
                <span className="text-gray-400 text-sm">Genel Başarı</span>
              </div>
              <p className={`text-3xl font-bold ${getAccuracyColor(stats.overview.overallAccuracy)}`}>
                %{stats.overview.overallAccuracy.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.overview.todayAccuracy !== null 
                  ? `Bugün: %${stats.overview.todayAccuracy.toFixed(1)}`
                  : 'Bugün: -'
                }
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <FiClock className="w-5 h-5 text-amber-400" />
                <span className="text-gray-400 text-sm">Bekleyen</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.overview.pendingPredictions}</p>
              <p className="text-xs text-gray-500 mt-1">
                Maç bekleniyor
              </p>
            </div>
          </div>
        )}

        {/* Model Performance */}
        {stats && stats.byModel.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FiAward className="w-5 h-5 text-amber-400" />
              Model Performansları
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {stats.byModel.map((model) => {
                const Icon = MODEL_ICONS[model.model] || FiTarget;
                const colorClass = MODEL_COLORS[model.model] || 'from-gray-500 to-gray-600';
                
                return (
                  <div
                    key={model.model}
                    className={`rounded-xl p-4 border ${getAccuracyBg(model.accuracy)}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-semibold text-white">
                        {MODEL_NAMES[model.model] || model.model}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Başarı</span>
                        <span className={`font-bold ${getAccuracyColor(model.accuracy)}`}>
                          %{model.accuracy.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Toplam</span>
                        <span className="text-white">{model.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Doğru</span>
                        <span className="text-emerald-400">{model.correct}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Güven</span>
                        <span className="text-cyan-400">%{model.avgConfidence.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${
                            model.accuracy >= 70 ? 'bg-emerald-500' : 
                            model.accuracy >= 55 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(model.accuracy, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Market Performance */}
        {stats && stats.byMarket.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FiTrendingUp className="w-5 h-5 text-emerald-400" />
              Bahis Türü Performansları
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Bahis Türü</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Toplam</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Doğru</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Başarı %</th>
                    {['claude', 'gpt4', 'gemini', 'perplexity'].map((model) => (
                      <th key={model} className="text-center py-3 px-4 text-gray-400 font-medium">
                        {MODEL_NAMES[model]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.byMarket.map((market) => (
                    <tr key={market.market} className="border-b border-white/5">
                      <td className="py-3 px-4 text-white font-medium">
                        {MARKET_NAMES[market.market] || market.market}
                      </td>
                      <td className="text-center py-3 px-4 text-gray-300">{market.total}</td>
                      <td className="text-center py-3 px-4 text-emerald-400">{market.correct}</td>
                      <td className={`text-center py-3 px-4 font-bold ${getAccuracyColor(market.accuracy)}`}>
                        %{market.accuracy.toFixed(1)}
                      </td>
                      {['claude', 'gpt4', 'gemini', 'perplexity'].map((model) => {
                        const modelData = market.byModel.find((m) => m.model === model);
                        return (
                          <td key={model} className={`text-center py-3 px-4 ${
                            modelData ? getAccuracyColor(modelData.accuracy) : 'text-gray-500'
                          }`}>
                            {modelData ? `%${modelData.accuracy.toFixed(1)}` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analysis Type Performance */}
        {stats && stats.byAnalysisType.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <GiBrain className="w-5 h-5 text-purple-400" />
              Analiz Türü Performansları
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.byAnalysisType.map((type) => (
                <div
                  key={type.type}
                  className={`rounded-xl p-4 border ${getAccuracyBg(type.accuracy)}`}
                >
                  <h3 className="font-semibold text-white mb-3">
                    {ANALYSIS_TYPE_NAMES[type.type] || type.type}
                  </h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className={`text-3xl font-bold ${getAccuracyColor(type.accuracy)}`}>
                        %{type.accuracy.toFixed(1)}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {type.correct}/{type.total} doğru
                      </p>
                    </div>
                    <div className="w-24 h-16">
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            type.accuracy >= 70 ? 'bg-emerald-500' : 
                            type.accuracy >= 55 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(type.accuracy, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Trend Chart */}
            {stats && stats.dailyTrend.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FiCalendar className="w-5 h-5 text-blue-400" />
                  Günlük Trend (Son 14 Gün)
                </h2>
                <div className="h-48 flex items-end justify-between gap-1">
                  {stats.dailyTrend.map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t-lg ${
                          day.accuracy >= 70 ? 'bg-emerald-500' : 
                          day.accuracy >= 55 ? 'bg-yellow-500' : 
                          day.total === 0 ? 'bg-gray-700' : 'bg-red-500'
                        }`}
                        style={{ height: `${day.total > 0 ? Math.max(day.accuracy, 10) : 10}%` }}
                        title={`${day.date}: %${day.accuracy.toFixed(1)} (${day.correct}/${day.total})`}
                      />
                      <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                        {new Date(day.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== DETAILED STATISTICS TAB ==================== */}
        {activeTab === 'detailed' && detailedStats && (
          <>
            {/* Model Selector */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Model Seç</label>
                <div className="flex gap-2">
                  {['claude', 'gpt4', 'gemini', 'perplexity', 'consensus'].map((model) => {
                    const Icon = MODEL_ICONS[model] || FiTarget;
                    return (
                      <button
                        key={model}
                        onClick={() => setSelectedModel(model)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                          selectedModel === model
                            ? `bg-gradient-to-r ${MODEL_COLORS[model] || 'from-gray-500 to-gray-600'} text-white`
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {MODEL_NAMES[model]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MODEL x MARKET x PERIOD MATRIX TABLE */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <FiBarChart2 className="w-5 h-5 text-purple-400" />
                {MODEL_NAMES[selectedModel]} - Detaylı Performans Matrisi
              </h2>
              <p className="text-gray-400 text-sm mb-6">Günlük, Haftalık, Aylık ve Tüm Zamanlar için bahis türü bazında başarı oranları</p>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Bahis Türü</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-semibold">
                        <span className="text-orange-400">📅 Bugün</span>
                      </th>
                      <th className="text-center py-3 px-4 text-gray-400 font-semibold">
                        <span className="text-blue-400">📆 Haftalık</span>
                      </th>
                      <th className="text-center py-3 px-4 text-gray-400 font-semibold">
                        <span className="text-purple-400">🗓️ Aylık</span>
                      </th>
                      <th className="text-center py-3 px-4 text-gray-400 font-semibold">
                        <span className="text-cyan-400">🏆 Tümü</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedStats.modelStats
                      .find(m => m.model === selectedModel)
                      ?.markets.map((market) => (
                        <tr key={market.market} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-4 px-4">
                            <span className="text-white font-semibold text-lg">
                              {MARKET_NAMES[market.market] || market.market}
                            </span>
                          </td>
                          {market.periods.map((period) => (
                            <td key={period.period} className="text-center py-4 px-4">
                              <div className={`text-2xl font-bold ${getAccuracyColor(period.accuracy)}`}>
                                %{period.accuracy.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {period.correct}/{period.total} doğru
                              </div>
                              <div className="text-xs text-cyan-400 mt-0.5">
                                ~%{period.avgConfidence.toFixed(0)} güven
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CONFIDENCE THRESHOLD ANALYSIS */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <FiTarget className="w-5 h-5 text-emerald-400" />
                Güven Eşiği Analizi - {MODEL_NAMES[selectedModel]}
              </h2>
              <p className="text-gray-400 text-sm mb-6">Hangi güven oranından itibaren tahminler tutarlı? Yeşil = Önerilen (%60+ başarı, 5+ tahmin)</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {detailedStats.confidenceAnalysis
                  .filter(ca => ca.model === selectedModel)
                  .map((analysis) => (
                    <div key={analysis.market} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h3 className="font-semibold text-white mb-4 text-center text-lg">
                        {MARKET_NAMES[analysis.market] || analysis.market}
                      </h3>
                      <div className="space-y-2">
                        {analysis.thresholds.map((threshold) => (
                          <div
                            key={`${threshold.minConfidence}-${threshold.maxConfidence}`}
                            className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                              threshold.recommendedBet
                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                : 'bg-white/5 border border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm font-medium">
                                %{threshold.minConfidence}-{threshold.maxConfidence}
                              </span>
                              {threshold.recommendedBet && (
                                <span className="text-xs bg-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                                  ✓ Önerilir
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`font-bold text-lg ${getAccuracyColor(threshold.accuracy)}`}>
                                %{threshold.accuracy.toFixed(1)}
                              </span>
                              <span className="text-gray-500 text-xs ml-2">
                                ({threshold.correct}/{threshold.total})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* WEEKLY BREAKDOWN TABLE */}
            {detailedStats.weeklyBreakdown && detailedStats.weeklyBreakdown.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <FiCalendar className="w-5 h-5 text-blue-400" />
                  Haftalık Performans Karşılaştırması
                </h2>
                <p className="text-gray-400 text-sm mb-6">Son 8 haftanın model bazında performans analizi</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold">Hafta</th>
                        {['claude', 'gpt4', 'gemini', 'perplexity', 'consensus'].map((model) => (
                          <th key={model} className="text-center py-3 px-4 text-gray-400 font-semibold">
                            {MODEL_NAMES[model]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailedStats.weeklyBreakdown.slice(0, 8).map((week, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 text-white font-medium">
                            {new Date(week.weekStart).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                            {' - '}
                            {new Date(week.weekEnd).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                          </td>
                          {['claude', 'gpt4', 'gemini', 'perplexity', 'consensus'].map((modelName) => {
                            const modelData = week.models.find(m => m.model === modelName);
                            const accuracy = modelData?.overallAccuracy || 0;
                            return (
                              <td key={modelName} className={`text-center py-3 px-4 font-bold ${getAccuracyColor(accuracy)}`}>
                                {accuracy > 0 ? `%${accuracy.toFixed(1)}` : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ALL MODELS COMPARISON - COMPACT VIEW */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <FiAward className="w-5 h-5 text-amber-400" />
                Tüm Modeller - Aylık Karşılaştırma (Bahis Türü Bazında)
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Model</th>
                      <th className="text-center py-3 px-4 text-orange-400 font-semibold">
                        ⚽ MS
                      </th>
                      <th className="text-center py-3 px-4 text-blue-400 font-semibold">
                        📊 Ü/A 2.5
                      </th>
                      <th className="text-center py-3 px-4 text-green-400 font-semibold">
                        🥅 KG Var/Yok
                      </th>
                      <th className="text-center py-3 px-4 text-purple-400 font-semibold">
                        📈 Genel
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedStats.modelStats.map((model) => {
                      const monthlyStats = model.markets.reduce((acc, market) => {
                        const monthly = market.periods.find(p => p.period === 'monthly');
                        acc[market.market] = monthly || { accuracy: 0, total: 0, correct: 0 };
                        return acc;
                      }, {} as any);
                      
                      const totalCorrect = model.markets.reduce((sum, m) => {
                        const monthly = m.periods.find(p => p.period === 'monthly');
                        return sum + (monthly?.correct || 0);
                      }, 0);
                      const totalAll = model.markets.reduce((sum, m) => {
                        const monthly = m.periods.find(p => p.period === 'monthly');
                        return sum + (monthly?.total || 0);
                      }, 0);
                      const overallAccuracy = totalAll > 0 ? (totalCorrect / totalAll) * 100 : 0;
                      
                      const Icon = MODEL_ICONS[model.model] || FiTarget;
                      
                      return (
                        <tr key={model.model} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${MODEL_COLORS[model.model] || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <span className="font-semibold text-white">{MODEL_NAMES[model.model]}</span>
                            </div>
                          </td>
                          <td className={`text-center py-4 px-4 font-bold text-lg ${getAccuracyColor(monthlyStats.matchResult?.accuracy || 0)}`}>
                            %{(monthlyStats.matchResult?.accuracy || 0).toFixed(1)}
                            <div className="text-xs text-gray-500 font-normal">
                              ({monthlyStats.matchResult?.correct || 0}/{monthlyStats.matchResult?.total || 0})
                            </div>
                          </td>
                          <td className={`text-center py-4 px-4 font-bold text-lg ${getAccuracyColor(monthlyStats.over25?.accuracy || 0)}`}>
                            %{(monthlyStats.over25?.accuracy || 0).toFixed(1)}
                            <div className="text-xs text-gray-500 font-normal">
                              ({monthlyStats.over25?.correct || 0}/{monthlyStats.over25?.total || 0})
                            </div>
                          </td>
                          <td className={`text-center py-4 px-4 font-bold text-lg ${getAccuracyColor(monthlyStats.btts?.accuracy || 0)}`}>
                            %{(monthlyStats.btts?.accuracy || 0).toFixed(1)}
                            <div className="text-xs text-gray-500 font-normal">
                              ({monthlyStats.btts?.correct || 0}/{monthlyStats.btts?.total || 0})
                            </div>
                          </td>
                          <td className={`text-center py-4 px-4 font-bold text-xl ${getAccuracyColor(overallAccuracy)}`}>
                            %{overallAccuracy.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ==================== PREDICTIONS TAB ==================== */}
        {activeTab === 'predictions' && (
          <>
            {/* Predictions List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FiFilter className="w-5 h-5 text-cyan-400" />
              Tahmin Kayıtları
            </h2>
            <div className="flex gap-2">
              {(['all', 'pending', 'settled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setFilterStatus(s);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    filterStatus === s
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {s === 'all' ? 'Tümü' : s === 'pending' ? 'Bekleyen' : 'Sonuçlanan'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {predictions.map((pred) => (
              <div
                key={pred.id}
                className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedPrediction(
                    expandedPrediction === pred.id ? null : pred.id
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        pred.status === 'settled' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {pred.status === 'settled' ? 'Sonuçlandı' : 'Bekliyor'}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {pred.home_team} vs {pred.away_team}
                        </p>
                        <p className="text-gray-400 text-sm">{pred.league}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-2 py-1 rounded text-xs ${
                        pred.analysis_type === 'quad-brain' 
                          ? 'bg-purple-500/20 text-purple-400'
                          : pred.analysis_type === 'agents'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {ANALYSIS_TYPE_NAMES[pred.analysis_type] || pred.analysis_type}
                      </div>
                      <span className="text-gray-500 text-sm">
                        {formatDate(pred.created_at)}
                      </span>
                      {expandedPrediction === pred.id ? (
                        <FiChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <FiChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedPrediction === pred.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Consensus Predictions */}
                      <div>
                        <h4 className="text-gray-400 text-sm mb-2">Consensus Tahminleri</h4>
                        <div className="space-y-2">
                          {Object.entries(pred.consensus || {}).map(([market, data]: [string, any]) => (
                            <div key={market} className="flex justify-between text-sm">
                              <span className="text-gray-400">{MARKET_NAMES[market] || market}</span>
                              <span className="text-white">
                                {data?.prediction} 
                                <span className="text-cyan-400 ml-1">(%{data?.confidence})</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Model Predictions */}
                      <div>
                        <h4 className="text-gray-400 text-sm mb-2">Model Tahminleri</h4>
                        <div className="space-y-2">
                          {Object.entries(pred.predictions || {}).map(([model, data]: [string, any]) => (
                            <div key={model} className="flex justify-between text-sm">
                              <span className="text-gray-400">{MODEL_NAMES[model] || model}</span>
                              <span className="text-white">{data?.matchResult}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Best Bets */}
                      <div>
                        <h4 className="text-gray-400 text-sm mb-2">En İyi Bahisler</h4>
                        <div className="space-y-2">
                          {(pred.best_bets || []).slice(0, 3).map((bet: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-400">#{bet.rank} {bet.market}</span>
                              <span className="text-emerald-400">{bet.selection}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Fixture ID for settling */}
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-gray-500 text-sm">Fixture ID: {pred.fixture_id}</span>
                      <span className="text-gray-500 text-sm">Risk: {pred.risk_level}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 disabled:opacity-50 hover:bg-white/10"
                >
                  Önceki
                </button>
                <span className="px-4 py-2 text-gray-400">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 disabled:opacity-50 hover:bg-white/10"
                >
                  Sonraki
                </button>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

