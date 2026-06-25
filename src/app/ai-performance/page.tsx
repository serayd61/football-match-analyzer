'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Spinner } from '@/components/ui';

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
    if (accuracy >= 70) return 'text-positive';
    if (accuracy >= 60) return 'text-caution';
    if (accuracy >= 50) return 'text-caution';
    return 'text-negative';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 70) return 'bg-positive';
    if (accuracy >= 60) return 'bg-caution';
    if (accuracy >= 50) return 'bg-caution';
    return 'bg-negative';
  };

  const getModelIcon = (model: string) => {
    const icons: { [key: string]: { icon: string } } = {
      'claude': { icon: '🧠' },
      'gpt-4': { icon: '🤖' },
      'gemini': { icon: '💎' },
      'perplexity': { icon: '🔍' },
      'ai consensus': { icon: '🎯' },
    };
    return icons[model.toLowerCase()] || { icon: '🤖' };
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
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Spinner size={48} className="text-brand-400 mx-auto" />
              <p className="mt-4 text-content">{lang === 'tr' ? 'Yükleniyor...' : lang === 'de' ? 'Lädt...' : 'Loading...'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const best = getBestPerformers();

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 flex flex-col items-center gap-4"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-content tracking-tight">
            {l.title}
          </h1>
          <p className="text-content-muted text-lg">{l.subtitle}</p>
        </motion.div>

        {/* Period Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(['7d', '30d', 'all'] as const).map(period => (
            <motion.button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`fa-btn ${
                selectedPeriod === period
                  ? 'fa-btn-primary'
                  : 'fa-btn-secondary'
              }`}
            >
              {l.period[period]}
            </motion.button>
          ))}
        </div>

        {/* Main Stats Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: l.stats.totalPredictions, value: data.summary.totalPredictions, color: 'text-content' },
              { label: l.stats.won, value: data.summary.wonCount, color: 'text-positive' },
              { label: l.stats.lost, value: data.summary.lostCount, color: 'text-negative' },
              { label: l.stats.pending, value: data.summary.pendingCount, color: 'text-caution' },
              { label: l.stats.accuracy, value: data.overall?.totalSettled > 0 ? `%${data.overall.overallAccuracy.toFixed(1)}` : '—', color: data.overall?.totalSettled > 0 ? getAccuracyColor(data.overall.overallAccuracy) : 'text-content-subtle' }
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="fa-card p-5 text-center"
              >
                <p className="text-content-muted text-sm mb-2">{stat.label}</p>
                <p className={`text-4xl font-bold ${stat.color}`}>
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
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all border ${
                activeTab === tab
                  ? 'bg-surface-3 text-content border-line'
                  : 'text-content-muted border-transparent hover:text-content hover:bg-surface-2'
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
              <div className="fa-card p-6">
                <h2 className="text-xl font-semibold text-content tracking-tight mb-4">{l.insights.title}</h2>
                {(best.model?.hasRealData || (best.market?.accuracy ?? 0) > 0 || (best.league?.accuracy ?? 0) > 0) ? (
                  <div className="grid md:grid-cols-3 gap-4">
                    {best.model && best.model.hasRealData && (
                      <div className="bg-surface-2 border border-line rounded-xl p-4">
                        <p className="text-content-muted text-sm mb-2">{l.insights.bestModel}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getModelIcon(best.model.model).icon}</span>
                          <div>
                            <p className="text-content font-bold">{best.model.model}</p>
                            <p className={`text-sm ${getAccuracyColor(best.model.accuracy)}`}>
                              %{best.model.accuracy.toFixed(1)} {l.stats.accuracy}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {best.market && (best.market.accuracy ?? 0) > 0 && (
                      <div className="bg-surface-2 border border-line rounded-xl p-4">
                        <p className="text-content-muted text-sm mb-2">{l.insights.bestMarket}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">📊</span>
                          <div>
                            <p className="text-content font-bold">{best.market.market}</p>
                            <p className={`text-sm ${getAccuracyColor(best.market.accuracy)}`}>
                              %{best.market.accuracy.toFixed(1)} {l.stats.accuracy}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {best.league && (best.league.accuracy ?? 0) > 0 && (
                      <div className="bg-surface-2 border border-line rounded-xl p-4">
                        <p className="text-content-muted text-sm mb-2">{l.insights.bestLeague}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🏆</span>
                          <div>
                            <p className="text-content font-bold">{best.league.league}</p>
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
                    <p className="text-content-muted text-lg">
                      {lang === 'tr' ? 'Maçlar tamamlandığında performans verileri burada görünecek' :
                       lang === 'de' ? 'Leistungsdaten werden hier angezeigt, wenn die Spiele abgeschlossen sind' :
                       'Performance data will appear here once matches are completed'}
                    </p>
                    <p className="text-content-subtle text-sm mt-2">
                      {lang === 'tr' ? `${data?.summary?.pendingCount || 0} tahmin sonuç bekliyor` :
                       lang === 'de' ? `${data?.summary?.pendingCount || 0} Vorhersagen warten auf Ergebnisse` :
                       `${data?.summary?.pendingCount || 0} predictions awaiting results`}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Model Overview */}
              {data?.models && data.models.length > 0 && (
                <div className="fa-card p-6">
                  <h2 className="text-xl font-semibold text-content tracking-tight mb-4">🤖 {l.tabs.models}</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.models.map((model, idx) => {
                      const { icon } = getModelIcon(model.model);
                      return (
                        <div key={idx} className="bg-surface-2 border border-line rounded-xl p-4 h-full">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">{icon}</span>
                            <span className="text-content font-bold">{model.model}</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-content-muted text-sm">{l.stats.accuracy}</span>
                            {model.hasRealData ? (
                              <span className={`font-bold text-lg ${getAccuracyColor(model.accuracy)}`}>
                                %{model.accuracy.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-content-subtle text-sm">—</span>
                            )}
                          </div>
                          <div className="h-2 bg-surface-4 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${model.hasRealData ? getAccuracyBg(model.accuracy) : 'bg-surface-4'} rounded-full transition-all`}
                              style={{ width: model.hasRealData ? `${Math.min(model.accuracy, 100)}%` : '0%' }}
                            />
                          </div>
                          <div className="mt-3 text-xs text-content-muted">
                            {model.totalPredictions} {l.model.predictions} • {model.correctPredictions} {l.model.correct}
                            {!model.hasRealData && <span className="text-caution ml-2">⏳</span>}
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
            <div className="fa-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-1/60">
                    <tr>
                      <th className="text-left p-4 text-content-muted font-medium">{l.model.name}</th>
                      <th className="text-center p-4 text-content-muted font-medium">{l.model.predictions}</th>
                      <th className="text-center p-4 text-content-muted font-medium">{l.model.correct}</th>
                      <th className="text-center p-4 text-content-muted font-medium">{l.model.accuracy}</th>
                      <th className="text-center p-4 text-content-muted font-medium">{l.model.confidence}</th>
                      <th className="text-center p-4 text-content-muted font-medium">{l.model.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.models.map((model, idx) => {
                      const { icon } = getModelIcon(model.model);
                      return (
                        <tr key={idx} className="hover:bg-surface-2 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{icon}</span>
                              <span className="text-content font-medium">{model.model}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center text-content">{model.totalPredictions}</td>
                          <td className="p-4 text-center text-positive">{model.correctPredictions}</td>
                          <td className="p-4 text-center">
                            {model.hasRealData ? (
                              <span className={`font-bold ${getAccuracyColor(model.accuracy)}`}>
                                %{model.accuracy.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-content-subtle">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center text-info">
                            {model.avgConfidence > 0 ? `%${model.avgConfidence}` : '—'}
                          </td>
                          <td className="p-4 text-center">
                            {model.hasRealData ? (
                              <span className="px-2 py-1 bg-positive/10 text-positive text-xs rounded">
                                ✅ {lang === 'tr' ? 'Gerçek' : lang === 'de' ? 'Echt' : 'Real'}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-caution/10 text-caution text-xs rounded">
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
                <div className="p-4 bg-caution/10 border-t border-caution/20">
                  <p className="text-caution text-sm text-center">
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
              <div className="fa-card p-6">
                <h2 className="text-xl font-semibold text-content tracking-tight mb-4">📊 {l.tabs.markets}</h2>
                <div className="space-y-4">
                  {data?.markets?.map((market, idx) => (
                    <div key={idx} className="bg-surface-2 border border-line rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-content font-medium">{market.market}</span>
                        <span className={`font-bold ${getAccuracyColor(market.accuracy)}`}>
                          %{market.accuracy.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-4 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full ${getAccuracyBg(market.accuracy)} rounded-full`}
                          style={{ width: `${Math.min(market.accuracy, 100)}%` }}
                        />
                      </div>
                      <p className="text-content-muted text-xs">{market.correct}/{market.total} {l.model.correct}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* League Performance */}
              <div className="fa-card p-6">
                <h2 className="text-xl font-semibold text-content tracking-tight mb-4">🏆 {lang === 'tr' ? 'Lig Performansı' : lang === 'de' ? 'Liga-Leistung' : 'League Performance'}</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {data?.leagues?.map((league, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface-2 border border-line rounded-lg p-3">
                      <div>
                        <p className="text-content font-medium">{league.league}</p>
                        <p className="text-content-muted text-xs">{league.correct}/{league.total}</p>
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
            <div className="fa-card overflow-hidden">
              <div className="p-4 border-b border-line">
                <h2 className="text-xl font-semibold text-content tracking-tight">{l.recent.title}</h2>
              </div>
              <div className="divide-y divide-line">
                {data.recentPredictions.map((pred, idx) => (
                  <div key={idx} className="p-4 hover:bg-surface-2 transition-colors flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-content font-medium">{pred.match}</p>
                      <p className="text-content-muted text-sm">{pred.league}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-content-muted text-sm">{new Date(pred.date).toLocaleDateString(lang)}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        pred.status === 'won' ? 'bg-positive/10 text-positive' :
                        pred.status === 'lost' ? 'bg-negative/10 text-negative' :
                        'bg-caution/10 text-caution'
                      }`}>
                        {l.recent[pred.status]}
                      </span>
                    </div>
                  </div>
                ))}
                {data.recentPredictions.length === 0 && (
                  <div className="p-8 text-center text-content-muted">{l.noData}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Transparency Section */}
        <div className="mt-8 fa-card p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🔐</div>
            <div>
              <h3 className="text-xl font-semibold text-positive tracking-tight mb-2">{l.transparency.title}</h3>
              <p className="text-content-muted">{l.transparency.desc}</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-content-subtle text-sm italic mt-6">{l.disclaimer}</p>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/dashboard" className="text-brand-400 hover:text-brand-300 transition-colors">
            ← {lang === 'tr' ? 'Dashboard\'a Dön' : lang === 'de' ? 'Zurück zum Dashboard' : 'Back to Dashboard'}
          </Link>
        </div>
      </div>
    </div>
  );
}
