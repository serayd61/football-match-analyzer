'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

interface ModelStats {
  model: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  roi: number;
  streak: number;
  bestMarket: string;
  bestLeague: string;
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
  weeklyTrend: { week: string; accuracy: number }[];
}

export default function AIPerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: '🧠 AI Performans Analizi',
      subtitle: 'Yapay zeka modellerimizin gerçek performansı',
      overall: 'Genel Performans',
      totalPredictions: 'Toplam Tahmin',
      accuracy: 'Doğruluk Oranı',
      avgConfidence: 'Ort. Güven',
      lastUpdated: 'Son Güncelleme',
      modelPerformance: 'Model Performansı',
      model: 'Model',
      predictions: 'Tahmin',
      correct: 'Doğru',
      roi: 'ROI',
      streak: 'Seri',
      bestMarket: 'En İyi Pazar',
      bestLeague: 'En İyi Lig',
      marketPerformance: 'Pazar Bazlı Performans',
      market: 'Pazar',
      leaguePerformance: 'Lig Bazlı Performans',
      league: 'Lig',
      weeklyTrend: 'Haftalık Trend',
      week: 'Hafta',
      period7d: 'Son 7 Gün',
      period30d: 'Son 30 Gün',
      periodAll: 'Tüm Zamanlar',
      noData: 'Henüz yeterli veri yok',
      transparency: 'Şeffaflık Taahhüdü',
      transparencyDesc: 'Tüm tahminlerimiz kaydedilir ve gerçek sonuçlarla karşılaştırılır. Bu sayfada gördüğünüz veriler tamamen gerçektir.',
      disclaimer: 'Geçmiş performans gelecekteki sonuçları garanti etmez. Sorumlu bahis yapın.',
    },
    en: {
      title: '🧠 AI Performance Analysis',
      subtitle: 'Real performance of our AI models',
      overall: 'Overall Performance',
      totalPredictions: 'Total Predictions',
      accuracy: 'Accuracy Rate',
      avgConfidence: 'Avg Confidence',
      lastUpdated: 'Last Updated',
      modelPerformance: 'Model Performance',
      model: 'Model',
      predictions: 'Predictions',
      correct: 'Correct',
      roi: 'ROI',
      streak: 'Streak',
      bestMarket: 'Best Market',
      bestLeague: 'Best League',
      marketPerformance: 'Market Performance',
      market: 'Market',
      leaguePerformance: 'League Performance',
      league: 'League',
      weeklyTrend: 'Weekly Trend',
      week: 'Week',
      period7d: 'Last 7 Days',
      period30d: 'Last 30 Days',
      periodAll: 'All Time',
      noData: 'Not enough data yet',
      transparency: 'Transparency Commitment',
      transparencyDesc: 'All our predictions are recorded and compared with actual results. The data you see on this page is completely real.',
      disclaimer: 'Past performance does not guarantee future results. Bet responsibly.',
    },
    de: {
      title: '🧠 KI-Leistungsanalyse',
      subtitle: 'Echte Leistung unserer KI-Modelle',
      overall: 'Gesamtleistung',
      totalPredictions: 'Gesamtvorhersagen',
      accuracy: 'Genauigkeitsrate',
      avgConfidence: 'Durchschn. Vertrauen',
      lastUpdated: 'Zuletzt aktualisiert',
      modelPerformance: 'Modellleistung',
      model: 'Modell',
      predictions: 'Vorhersagen',
      correct: 'Richtig',
      roi: 'ROI',
      streak: 'Serie',
      bestMarket: 'Bester Markt',
      bestLeague: 'Beste Liga',
      marketPerformance: 'Marktleistung',
      market: 'Markt',
      leaguePerformance: 'Liga-Leistung',
      league: 'Liga',
      weeklyTrend: 'Wöchentlicher Trend',
      week: 'Woche',
      period7d: 'Letzte 7 Tage',
      period30d: 'Letzte 30 Tage',
      periodAll: 'Alle Zeiten',
      noData: 'Noch nicht genug Daten',
      transparency: 'Transparenz-Verpflichtung',
      transparencyDesc: 'Alle unsere Vorhersagen werden aufgezeichnet und mit den tatsächlichen Ergebnissen verglichen. Die Daten auf dieser Seite sind völlig real.',
      disclaimer: 'Vergangene Leistungen garantieren keine zukünftigen Ergebnisse. Wetten Sie verantwortungsvoll.',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/public/ai-performance?period=${selectedPeriod}`);
      const json = await res.json();
      setData(json);
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
    if (accuracy >= 70) return 'bg-green-500/20';
    if (accuracy >= 60) return 'bg-yellow-500/20';
    if (accuracy >= 50) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  };

  const getModelIcon = (model: string) => {
    const icons: { [key: string]: string } = {
      'claude': '🟠',
      'gpt-4': '🟢',
      'gpt4': '🟢',
      'gemini': '🔵',
      'perplexity': '🟣',
      'consensus': '🧠',
    };
    return icons[model.toLowerCase()] || '🤖';
  };

  const getModelColor = (model: string) => {
    const colors: { [key: string]: string } = {
      'claude': 'from-orange-500 to-orange-600',
      'gpt-4': 'from-green-500 to-green-600',
      'gpt4': 'from-green-500 to-green-600',
      'gemini': 'from-blue-500 to-blue-600',
      'perplexity': 'from-purple-500 to-purple-600',
      'consensus': 'from-cyan-500 to-cyan-600',
    };
    return colors[model.toLowerCase()] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-96"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-800 rounded-xl"></div>)}
            </div>
            <div className="h-96 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{l.title}</h1>
          <p className="text-gray-400">{l.subtitle}</p>
        </div>

        {/* Period Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(['7d', '30d', 'all'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedPeriod === period
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {period === '7d' ? l.period7d : period === '30d' ? l.period30d : l.periodAll}
            </button>
          ))}
        </div>

        {/* Pending Info Banner */}
        {data?.overall && data.overall.pendingCount > 0 && data.overall.totalSettled === 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-yellow-400">
              ⏳ {lang === 'tr' 
                ? `${data.overall.pendingCount} tahmin sonuç bekleniyor. Maçlar bittikten sonra doğruluk oranları hesaplanacak.`
                : lang === 'de'
                ? `${data.overall.pendingCount} Vorhersagen warten auf Ergebnisse. Die Genauigkeit wird nach Spielende berechnet.`
                : `${data.overall.pendingCount} predictions awaiting results. Accuracy will be calculated after matches finish.`
              }
            </p>
          </div>
        )}

        {/* Overall Stats */}
        {data?.overall && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">{l.totalPredictions}</p>
              <p className="text-3xl font-bold text-white">{data.overall.totalPredictions}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/50 to-orange-900/50 border border-yellow-500/30 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">
                {lang === 'tr' ? 'Bekleyen' : lang === 'de' ? 'Ausstehend' : 'Pending'}
              </p>
              <p className="text-3xl font-bold text-yellow-400">{data.overall.pendingCount || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 border border-green-500/30 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">{l.accuracy}</p>
              <p className={`text-3xl font-bold ${data.overall.totalSettled > 0 ? getAccuracyColor(data.overall.overallAccuracy) : 'text-gray-500'}`}>
                {data.overall.totalSettled > 0 ? `%${data.overall.overallAccuracy.toFixed(1)}` : '—'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border border-blue-500/30 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">{l.avgConfidence}</p>
              <p className="text-3xl font-bold text-blue-400">%{data.overall.avgConfidence.toFixed(1)}</p>
            </div>
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-500/30 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-1">{l.correct}</p>
              <p className="text-3xl font-bold text-white">{data.overall.totalCorrect}</p>
            </div>
          </div>
        )}

        {/* Model Performance */}
        {data?.models && data.models.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              🤖 {l.modelPerformance}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.models.map((model, idx) => (
                <div
                  key={idx}
                  className={`bg-gradient-to-br ${getModelColor(model.model)} rounded-xl p-1`}
                >
                  <div className="bg-gray-900 rounded-xl p-4 h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{getModelIcon(model.model)}</span>
                      <span className="text-white font-bold">{model.model}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">{l.accuracy}</span>
                        <span className={`font-bold ${getAccuracyColor(model.accuracy)}`}>
                          %{model.accuracy.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">{l.predictions}</span>
                        <span className="text-white">{model.totalPredictions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">{l.correct}</span>
                        <span className="text-green-400">{model.correctPredictions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">{l.avgConfidence}</span>
                        <span className="text-blue-400">%{model.avgConfidence.toFixed(0)}</span>
                      </div>
                      {model.roi !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">{l.roi}</span>
                          <span className={model.roi >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {model.roi >= 0 ? '+' : ''}{model.roi.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Accuracy Bar */}
                    <div className="mt-4">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getAccuracyBg(model.accuracy).replace('/20', '')} rounded-full`}
                          style={{ width: `${model.accuracy}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market & League Performance */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Market Performance */}
          {data?.markets && data.markets.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                📊 {l.marketPerformance}
              </h2>
              <div className="space-y-3">
                {data.markets.map((market, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                    <div>
                      <p className="text-white font-medium">{market.market}</p>
                      <p className="text-gray-400 text-xs">{market.correct}/{market.total} {l.correct}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full ${getAccuracyBg(market.accuracy)}`}>
                      <span className={`font-bold ${getAccuracyColor(market.accuracy)}`}>
                        %{market.accuracy.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* League Performance */}
          {data?.leagues && data.leagues.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                🏆 {l.leaguePerformance}
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.leagues.slice(0, 10).map((league, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                    <div>
                      <p className="text-white font-medium">{league.league}</p>
                      <p className="text-gray-400 text-xs">{league.correct}/{league.total} {l.correct}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full ${getAccuracyBg(league.accuracy)}`}>
                      <span className={`font-bold ${getAccuracyColor(league.accuracy)}`}>
                        %{league.accuracy.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transparency Note */}
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-4xl">✅</div>
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">{l.transparency}</h3>
              <p className="text-gray-300">{l.transparencyDesc}</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-gray-500 text-sm italic">
          ⚠️ {l.disclaimer}
        </p>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
            ← {lang === 'tr' ? 'Ana Sayfaya Dön' : lang === 'de' ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
        </div>
      </div>
    </div>
  );
}

