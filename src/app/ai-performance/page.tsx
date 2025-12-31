'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import Navigation from '@/components/Navigation';
import { FootballBall3D } from '@/components/Football3D';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface ModelStats {
  model: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  roi: number;
  hasRealData: boolean;
}

interface MarketStats {
  market: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface LeagueStats {
  league: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface RecentPrediction {
  id: string;
  match: string;
  league: string;
  status: 'won' | 'lost' | 'pending';
  date: string;
  analysisType: string;
}

interface PerformanceData {
  models: ModelStats[];
  markets: MarketStats[];
  leagues: LeagueStats[];
  overall: {
    totalPredictions: number;
    totalCorrect: number;
    totalSettled: number;
    pendingCount: number;
    overallAccuracy: number;
    avgConfidence: number;
    lastUpdated: string;
  };
  weeklyTrend: { week: string; total: number; accuracy: number }[];
  recentPredictions: RecentPrediction[];
  summary: {
    totalPredictions: number;
    settledCount: number;
    pendingCount: number;
    wonCount: number;
    lostCount: number;
  };
}

export default function AIPerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'markets' | 'history'>('overview');
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: '🧠 AI Performans Merkezi',
      subtitle: 'Yapay zeka modellerimizin gerçek zamanlı performans analizi',
      tabs: {
        overview: '📊 Genel Bakış',
        models: '🤖 AI Modelleri',
        markets: '📈 Pazarlar',
        history: '📜 Geçmiş',
      },
      stats: {
        totalPredictions: 'Toplam Tahmin',
        settled: 'Sonuçlanan',
        pending: 'Bekleyen',
        won: 'Kazanan',
        lost: 'Kaybeden',
        accuracy: 'Doğruluk',
        avgConfidence: 'Ort. Güven',
        roi: 'ROI',
      },
      period: {
        '7d': 'Son 7 Gün',
        '30d': 'Son 30 Gün',
        'all': 'Tüm Zamanlar',
      },
      model: {
        name: 'Model',
        predictions: 'Tahmin',
        correct: 'Doğru',
        accuracy: 'Doğruluk',
        confidence: 'Güven',
        roi: 'ROI',
        status: 'Durum',
      },
      recent: {
        title: 'Son Tahminler',
        match: 'Maç',
        league: 'Lig',
        status: 'Durum',
        date: 'Tarih',
        won: '✅ Kazandı',
        lost: '❌ Kaybetti',
        pending: '⏳ Bekliyor',
      },
      insights: {
        title: '💡 AI İçgörüleri',
        bestModel: 'En İyi Model',
        bestMarket: 'En İyi Pazar',
        bestLeague: 'En İyi Lig',
        hotStreak: 'Sıcak Seri',
        recommendation: 'Öneri',
      },
      transparency: {
        title: '✅ Şeffaflık Taahhüdü',
        desc: 'Tüm tahminlerimiz blockchain\'e kaydedilir ve sonuçlarla karşılaştırılır. Manipülasyon mümkün değildir.',
      },
      noData: 'Henüz yeterli veri yok',
      disclaimer: '⚠️ Geçmiş performans gelecekteki sonuçları garanti etmez. Sorumlu bahis yapın.',
    },
    en: {
      title: '🧠 AI Performance Center',
      subtitle: 'Real-time performance analysis of our AI models',
      tabs: {
        overview: '📊 Overview',
        models: '🤖 AI Models',
        markets: '📈 Markets',
        history: '📜 History',
      },
      stats: {
        totalPredictions: 'Total Predictions',
        settled: 'Settled',
        pending: 'Pending',
        won: 'Won',
        lost: 'Lost',
        accuracy: 'Accuracy',
        avgConfidence: 'Avg Confidence',
        roi: 'ROI',
      },
      period: {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        'all': 'All Time',
      },
      model: {
        name: 'Model',
        predictions: 'Predictions',
        correct: 'Correct',
        accuracy: 'Accuracy',
        confidence: 'Confidence',
        roi: 'ROI',
        status: 'Status',
      },
      recent: {
        title: 'Recent Predictions',
        match: 'Match',
        league: 'League',
        status: 'Status',
        date: 'Date',
        won: '✅ Won',
        lost: '❌ Lost',
        pending: '⏳ Pending',
      },
      insights: {
        title: '💡 AI Insights',
        bestModel: 'Best Model',
        bestMarket: 'Best Market',
        bestLeague: 'Best League',
        hotStreak: 'Hot Streak',
        recommendation: 'Recommendation',
      },
      transparency: {
        title: '✅ Transparency Commitment',
        desc: 'All predictions are recorded on blockchain and compared with results. Manipulation is impossible.',
      },
      noData: 'Not enough data yet',
      disclaimer: '⚠️ Past performance does not guarantee future results. Bet responsibly.',
    },
    de: {
      title: '🧠 KI-Leistungszentrum',
      subtitle: 'Echtzeit-Leistungsanalyse unserer KI-Modelle',
      tabs: {
        overview: '📊 Übersicht',
        models: '🤖 KI-Modelle',
        markets: '📈 Märkte',
        history: '📜 Verlauf',
      },
      stats: {
        totalPredictions: 'Gesamtvorhersagen',
        settled: 'Abgeschlossen',
        pending: 'Ausstehend',
        won: 'Gewonnen',
        lost: 'Verloren',
        accuracy: 'Genauigkeit',
        avgConfidence: 'Durchschn. Vertrauen',
        roi: 'ROI',
      },
      period: {
        '7d': 'Letzte 7 Tage',
        '30d': 'Letzte 30 Tage',
        'all': 'Alle Zeiten',
      },
      model: {
        name: 'Modell',
        predictions: 'Vorhersagen',
        correct: 'Richtig',
        accuracy: 'Genauigkeit',
        confidence: 'Vertrauen',
        roi: 'ROI',
        status: 'Status',
      },
      recent: {
        title: 'Letzte Vorhersagen',
        match: 'Spiel',
        league: 'Liga',
        status: 'Status',
        date: 'Datum',
        won: '✅ Gewonnen',
        lost: '❌ Verloren',
        pending: '⏳ Ausstehend',
      },
      insights: {
        title: '💡 KI-Einblicke',
        bestModel: 'Bestes Modell',
        bestMarket: 'Bester Markt',
        bestLeague: 'Beste Liga',
        hotStreak: 'Heiße Serie',
        recommendation: 'Empfehlung',
      },
      transparency: {
        title: '✅ Transparenz-Verpflichtung',
        desc: 'Alle Vorhersagen werden auf der Blockchain aufgezeichnet. Manipulation ist unmöglich.',
      },
      noData: 'Noch nicht genug Daten',
      disclaimer: '⚠️ Vergangene Leistung garantiert keine zukünftigen Ergebnisse. Verantwortungsvoll wetten.',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      // 🆕 Unified performance endpoint kullan
      const res = await fetch(`/api/unified/performance?days=${selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 365}&_t=${Date.now()}`);
      const json = await res.json();
      
      if (json.success) {
        // Unified format'ı eski format'a dönüştür (backward compatibility)
        const unifiedStats = json.stats;
        setData({
          models: [
            {
              model: 'Unified Consensus',
              totalPredictions: unifiedStats.overview.settled,
              correctPredictions: unifiedStats.accuracy.overall.correct,
              accuracy: unifiedStats.accuracy.overall.rate,
              avgConfidence: unifiedStats.confidenceDistribution.high.count > 0 
                ? (unifiedStats.confidenceDistribution.high.count * 75 + 
                   unifiedStats.confidenceDistribution.medium.count * 65 + 
                   unifiedStats.confidenceDistribution.low.count * 50) / unifiedStats.overview.settled
                : 60,
              roi: 0,
              hasRealData: true
            }
          ],
          markets: [
            {
              market: 'Match Result',
              total: unifiedStats.accuracy.matchResult.total,
              correct: unifiedStats.accuracy.matchResult.correct,
              accuracy: unifiedStats.accuracy.matchResult.rate
            },
            {
              market: 'Over/Under',
              total: unifiedStats.accuracy.overUnder.total,
              correct: unifiedStats.accuracy.overUnder.correct,
              accuracy: unifiedStats.accuracy.overUnder.rate
            },
            {
              market: 'BTTS',
              total: unifiedStats.accuracy.btts.total,
              correct: unifiedStats.accuracy.btts.correct,
              accuracy: unifiedStats.accuracy.btts.rate
            }
          ],
          leagues: [],
          overall: {
            totalPredictions: unifiedStats.overview.total,
            totalCorrect: unifiedStats.accuracy.overall.correct,
            totalSettled: unifiedStats.overview.settled,
            pendingCount: unifiedStats.overview.pending,
            overallAccuracy: unifiedStats.accuracy.overall.rate,
            avgConfidence: unifiedStats.confidenceDistribution.high.count > 0 
              ? (unifiedStats.confidenceDistribution.high.count * 75 + 
                 unifiedStats.confidenceDistribution.medium.count * 65 + 
                 unifiedStats.confidenceDistribution.low.count * 50) / unifiedStats.overview.settled
              : 60,
            lastUpdated: new Date().toISOString()
          },
          weeklyTrend: [],
          recentPredictions: unifiedStats.recentAnalyses.map((a: any) => ({
            id: String(a.fixtureId),
            match: `${a.homeTeam} vs ${a.awayTeam}`,
            league: a.league,
            status: a.isSettled ? (a.accuracy?.matchResult ? 'won' : 'lost') : 'pending',
            date: a.matchDate,
            analysisType: 'unified'
          })),
          summary: {
            totalPredictions: unifiedStats.overview.total,
            settledCount: unifiedStats.overview.settled,
            pendingCount: unifiedStats.overview.pending,
            wonCount: unifiedStats.accuracy.overall.correct,
            lostCount: unifiedStats.overview.settled - unifiedStats.accuracy.overall.correct
          }
        });
      } else {
        // Fallback to old endpoint
        const res = await fetch(`/api/public/ai-performance?period=${selectedPeriod}`);
      const json = await res.json();
      setData(json);
      }
    } catch (err) {
      console.error('Error fetching performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 70) return 'text-green-400';
    if (accuracy >= 60) return 'text-yellow-400';
    if (accuracy >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 70) return 'bg-green-500';
    if (accuracy >= 60) return 'bg-yellow-500';
    if (accuracy >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getModelIcon = (model: string) => {
    const icons: { [key: string]: { icon: string; color: string } } = {
      'claude': { icon: '🧠', color: 'from-orange-500 to-amber-600' },
      'gpt-4': { icon: '🤖', color: 'from-green-500 to-emerald-600' },
      'gemini': { icon: '💎', color: 'from-blue-500 to-cyan-600' },
      'perplexity': { icon: '🔍', color: 'from-purple-500 to-pink-600' },
      'ai consensus': { icon: '🎯', color: 'from-cyan-500 to-teal-600' },
    };
    return icons[model.toLowerCase()] || { icon: '🤖', color: 'from-gray-500 to-gray-600' };
  };

  const getBestPerformers = () => {
    if (!data) return { model: null, market: null, league: null };
    
    const bestModel = data.models?.length > 0 
      ? data.models.reduce((a, b) => a.accuracy > b.accuracy ? a : b) 
      : null;
    const bestMarket = data.markets?.length > 0 
      ? data.markets.reduce((a, b) => a.accuracy > b.accuracy ? a : b) 
      : null;
    const bestLeague = data.leagues?.length > 0 
      ? data.leagues.reduce((a, b) => a.accuracy > b.accuracy ? a : b) 
      : null;
    
    return { model: bestModel, market: bestMarket, league: bestLeague };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00f0ff] border-t-transparent mx-auto" />
              <p className="mt-4 text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-body)' }}>Yükleniyor...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const best = getBestPerformers();

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-3">
            <FootballBall3D size={50} autoRotate={true} />
            <h1 className="text-4xl md:text-5xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
              {l.title}
            </h1>
        </div>
          <p className="text-gray-400 text-lg" style={{ fontFamily: 'var(--font-body)' }}>{l.subtitle}</p>
        </motion.div>

        {/* Period Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(['7d', '30d', 'all'] as const).map(period => (
            <motion.button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                selectedPeriod === period
                  ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/30 neon-glow-cyan'
                  : 'glass-futuristic border border-[#00f0ff]/30 text-gray-400 hover:neon-border-cyan hover:text-white'
              }`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {l.period[period]}
            </motion.button>
          ))}
        </div>

        {/* Main Stats Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: l.stats.totalPredictions, value: data.summary.totalPredictions, color: 'text-white', bg: 'from-[#00f0ff]/20 to-[#00f0ff]/5', border: 'border-[#00f0ff]/30' },
              { label: l.stats.won, value: data.summary.wonCount, color: 'text-[#00ff88]', bg: 'from-[#00ff88]/20 to-[#00ff88]/5', border: 'border-[#00ff88]/30' },
              { label: l.stats.lost, value: data.summary.lostCount, color: 'text-[#ff00f0]', bg: 'from-[#ff00f0]/20 to-[#ff00f0]/5', border: 'border-[#ff00f0]/30' },
              { label: l.stats.pending, value: data.summary.pendingCount, color: 'text-[#ffff00]', bg: 'from-[#ffff00]/20 to-[#ffff00]/5', border: 'border-[#ffff00]/30' },
              { label: l.stats.accuracy, value: data.overall?.totalSettled > 0 ? `%${data.overall.overallAccuracy.toFixed(1)}` : '—', color: data.overall?.totalSettled > 0 ? getAccuracyColor(data.overall.overallAccuracy) : 'text-gray-500', bg: 'from-[#00f0ff]/20 to-[#00f0ff]/5', border: 'border-[#00f0ff]/30' }
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`glass-futuristic bg-gradient-to-br ${stat.bg} border ${stat.border} rounded-2xl p-5 text-center hover:neon-border-cyan transition-all relative overflow-hidden`}
              >
                <div className="absolute top-2 right-2 opacity-10">
                  <FootballBall3D size={30} autoRotate={true} />
            </div>
                <p className="text-gray-400 text-sm mb-2 relative z-10" style={{ fontFamily: 'var(--font-body)' }}>{stat.label}</p>
                <p className={`text-4xl font-bold ${stat.color} neon-glow-cyan relative z-10`} style={{ fontFamily: 'var(--font-heading)' }}>
                  {stat.value}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(Object.keys(l.tabs) as Array<keyof typeof l.tabs>).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {l.tabs[tab]}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* AI Insights */}
              <div className="bg-gradient-to-r from-purple-900/30 via-blue-900/30 to-cyan-900/30 border border-purple-500/30 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">{l.insights.title}</h2>
                {(best.model?.hasRealData || (best.market?.accuracy ?? 0) > 0 || (best.league?.accuracy ?? 0) > 0) ? (
                  <div className="grid md:grid-cols-3 gap-4">
                    {best.model && best.model.hasRealData && (
                      <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-sm mb-2">{l.insights.bestModel}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getModelIcon(best.model.model).icon}</span>
                          <div>
                            <p className="text-white font-bold">{best.model.model}</p>
                            <p className={`text-sm ${getAccuracyColor(best.model.accuracy)}`}>
                              %{best.model.accuracy.toFixed(1)} {l.stats.accuracy}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {best.market && (best.market.accuracy ?? 0) > 0 && (
                      <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-sm mb-2">{l.insights.bestMarket}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">📊</span>
                          <div>
                            <p className="text-white font-bold">{best.market.market}</p>
                            <p className={`text-sm ${getAccuracyColor(best.market.accuracy)}`}>
                              %{best.market.accuracy.toFixed(1)} {l.stats.accuracy}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {best.league && (best.league.accuracy ?? 0) > 0 && (
                      <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-gray-400 text-sm mb-2">{l.insights.bestLeague}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🏆</span>
                          <div>
                            <p className="text-white font-bold">{best.league.league}</p>
                            <p className={`text-sm ${getAccuracyColor(best.league.accuracy)}`}>
                              %{best.league.accuracy.toFixed(1)} {l.stats.accuracy}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">⏳</div>
                    <p className="text-gray-400 text-lg">
                      {lang === 'tr' ? 'Maçlar tamamlandığında performans verileri burada görünecek' : 
                       lang === 'de' ? 'Leistungsdaten werden hier angezeigt, wenn die Spiele abgeschlossen sind' :
                       'Performance data will appear here once matches are completed'}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      {lang === 'tr' ? `${data?.summary?.pendingCount || 0} tahmin sonuç bekliyor` :
                       lang === 'de' ? `${data?.summary?.pendingCount || 0} Vorhersagen warten auf Ergebnisse` :
                       `${data?.summary?.pendingCount || 0} predictions awaiting results`}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Model Overview */}
              {data?.models && data.models.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4">🤖 {l.tabs.models}</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.models.map((model, idx) => {
                      const { icon, color } = getModelIcon(model.model);
                      return (
                        <div key={idx} className={`bg-gradient-to-br ${color} p-0.5 rounded-xl`}>
                          <div className="bg-gray-900 rounded-xl p-4 h-full">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-2xl">{icon}</span>
                              <span className="text-white font-bold">{model.model}</span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400 text-sm">{l.stats.accuracy}</span>
                              {model.hasRealData ? (
                                <span className={`font-bold text-lg ${getAccuracyColor(model.accuracy)}`}>
                                  %{model.accuracy.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-gray-500 text-sm">—</span>
                              )}
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${model.hasRealData ? getAccuracyBg(model.accuracy) : 'bg-gray-600'} rounded-full transition-all`}
                                style={{ width: model.hasRealData ? `${Math.min(model.accuracy, 100)}%` : '0%' }}
                              />
                            </div>
                            <div className="mt-3 text-xs text-gray-400">
                              {model.totalPredictions} {l.model.predictions} • {model.correctPredictions} {l.model.correct}
                              {!model.hasRealData && <span className="text-yellow-500 ml-2">⏳</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && data?.models && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="text-left p-4 text-gray-400 font-medium">{l.model.name}</th>
                      <th className="text-center p-4 text-gray-400 font-medium">{l.model.predictions}</th>
                      <th className="text-center p-4 text-gray-400 font-medium">{l.model.correct}</th>
                      <th className="text-center p-4 text-gray-400 font-medium">{l.model.accuracy}</th>
                      <th className="text-center p-4 text-gray-400 font-medium">{l.model.confidence}</th>
                      <th className="text-center p-4 text-gray-400 font-medium">{l.model.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {data.models.map((model, idx) => {
                      const { icon } = getModelIcon(model.model);
                      return (
                        <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{icon}</span>
                              <span className="text-white font-medium">{model.model}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center text-white">{model.totalPredictions}</td>
                          <td className="p-4 text-center text-green-400">{model.correctPredictions}</td>
                          <td className="p-4 text-center">
                            {model.hasRealData ? (
                              <span className={`font-bold ${getAccuracyColor(model.accuracy)}`}>
                                %{model.accuracy.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center text-blue-400">
                            {model.avgConfidence > 0 ? `%${model.avgConfidence}` : '—'}
                          </td>
                          <td className="p-4 text-center">
                            {model.hasRealData ? (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                ✅ {lang === 'tr' ? 'Gerçek' : lang === 'de' ? 'Echt' : 'Real'}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                                ⏳ {lang === 'tr' ? 'Bekliyor' : lang === 'de' ? 'Wartend' : 'Pending'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Info Note */}
              {data.models.every(m => !m.hasRealData) && (
                <div className="p-4 bg-yellow-500/10 border-t border-yellow-500/20">
                  <p className="text-yellow-400 text-sm text-center">
                    ℹ️ {lang === 'tr' ? 'Maçlar tamamlandığında doğruluk oranları hesaplanacak' : 
                        lang === 'de' ? 'Die Genauigkeitsraten werden berechnet, wenn die Spiele abgeschlossen sind' :
                        'Accuracy rates will be calculated when matches are completed'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Markets Tab */}
          {activeTab === 'markets' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Market Performance */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">📊 {l.tabs.markets}</h2>
                <div className="space-y-4">
                  {data?.markets?.map((market, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{market.market}</span>
                        <span className={`font-bold ${getAccuracyColor(market.accuracy)}`}>
                          %{market.accuracy.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div 
                          className={`h-full ${getAccuracyBg(market.accuracy)} rounded-full`}
                          style={{ width: `${Math.min(market.accuracy, 100)}%` }}
                        />
                      </div>
                      <p className="text-gray-400 text-xs">{market.correct}/{market.total} {l.model.correct}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* League Performance */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">🏆 {lang === 'tr' ? 'Lig Performansı' : 'League Performance'}</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data?.leagues?.map((league, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                      <div>
                        <p className="text-white font-medium">{league.league}</p>
                        <p className="text-gray-400 text-xs">{league.correct}/{league.total}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full ${getAccuracyBg(league.accuracy)}/20`}>
                        <span className={`font-bold ${getAccuracyColor(league.accuracy)}`}>
                          %{league.accuracy.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && data?.recentPredictions && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">{l.recent.title}</h2>
              </div>
              <div className="divide-y divide-gray-700/50">
                {data.recentPredictions.map((pred, idx) => (
                  <div key={idx} className="p-4 hover:bg-gray-700/30 transition-colors flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{pred.match}</p>
                      <p className="text-gray-400 text-sm">{pred.league}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm">{new Date(pred.date).toLocaleDateString(lang)}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        pred.status === 'won' ? 'bg-green-500/20 text-green-400' :
                        pred.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {l.recent[pred.status]}
                      </span>
                    </div>
                  </div>
                ))}
                {data.recentPredictions.length === 0 && (
                  <div className="p-8 text-center text-gray-400">{l.noData}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Transparency Section */}
        <div className="mt-8 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🔐</div>
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">{l.transparency.title}</h3>
              <p className="text-gray-300">{l.transparency.desc}</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-gray-500 text-sm italic mt-6">{l.disclaimer}</p>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/dashboard" className="text-purple-400 hover:text-purple-300 transition-colors">
            ← {lang === 'tr' ? 'Dashboard\'a Dön' : lang === 'de' ? 'Zurück zum Dashboard' : 'Back to Dashboard'}
          </Link>
        </div>
      </div>
    </div>
  );
}
