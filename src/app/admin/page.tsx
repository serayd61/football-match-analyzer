'use client';

// ============================================================================
// ADMIN PANEL V2 - Smart Analysis Dashboard
// Temiz, hızlı ve sadece V2 sistemine odaklı
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, RefreshCw, CheckCircle, Clock, AlertCircle,
  TrendingUp, Target, Trophy, Zap, Calendar, ArrowLeft,
  Settings, Download, Filter
} from 'lucide-react';

// Admin emails
const ADMIN_EMAILS = ['serayd61@hotmail.com', 'info@swissdigital.life'];

interface PerformanceStats {
  overview: {
    total: number;
    settled: number;
    pending: number;
    periodDays: number;
  };
  accuracy: {
    btts: { total: number; correct: number; rate: string };
    overUnder: { total: number; correct: number; rate: string };
    matchResult: { total: number; correct: number; rate: string };
    overall: { total: number; correct: number; rate: string };
  };
  confidenceDistribution: {
    high: { count: number; correct: number; rate: string };
    medium: { count: number; correct: number; rate: string };
    low: { count: number; correct: number; rate: string };
  };
  performance: {
    avgProcessingTime: number;
    avgConfidence: number;
    modelsUsage: Record<string, number>;
  };
  recentAnalyses: Array<{
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    league: string;
    matchDate: string;
    btts: { prediction: string; confidence: number };
    overUnder: { prediction: string; confidence: number };
    matchResult: { prediction: string; confidence: number };
    riskLevel: string;
    overallConfidence: number;
    processingTime: number;
    isSettled: boolean;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'analyses' | 'settings'>('overview');

  // Auth check
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (!ADMIN_EMAILS.includes(session.user?.email || '')) {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v2/performance?days=${periodDays}&_t=${Date.now()}`);
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  }, [periodDays]);

  useEffect(() => {
    if (session && ADMIN_EMAILS.includes(session.user?.email || '')) {
      fetchStats();
    }
  }, [session, fetchStats]);

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  // Settle results
  const handleSettle = async () => {
    setSettling(true);
    try {
      const res = await fetch('/api/v2/settle', { method: 'POST' });
      const data = await res.json();
      alert(`✅ Sonuçlar güncellendi!\n\nGüncellenen: ${data.updated || 0} maç`);
      await fetchStats();
    } catch (error) {
      alert('Hata: ' + error);
    }
    setSettling(false);
  };

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-white">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!session || !ADMIN_EMAILS.includes(session.user?.email || '')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                  <p className="text-xs text-purple-300">Smart Analysis V2</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Period Selector */}
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(parseInt(e.target.value))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value={7}>Son 7 gün</option>
                <option value={14}>Son 14 gün</option>
                <option value={30}>Son 30 gün</option>
                <option value={90}>Son 90 gün</option>
              </select>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleSettle}
                disabled={settling}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className={`w-4 h-4 ${settling ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">Sonuçları Güncelle</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'overview', label: '📊 Genel Bakış', icon: BarChart3 },
              { id: 'analyses', label: '📋 Analizler', icon: Target },
              { id: 'settings', label: '⚙️ Ayarlar', icon: Settings },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Zap className="w-6 h-6" />}
                label="Toplam Analiz"
                value={stats.overview.total}
                color="purple"
              />
              <StatCard
                icon={<CheckCircle className="w-6 h-6" />}
                label="Sonuçlanan"
                value={stats.overview.settled}
                color="green"
              />
              <StatCard
                icon={<Clock className="w-6 h-6" />}
                label="Bekleyen"
                value={stats.overview.pending}
                color="yellow"
              />
              <StatCard
                icon={<Target className="w-6 h-6" />}
                label="Genel Başarı"
                value={`${stats.accuracy.overall.rate}%`}
                color="blue"
              />
            </div>

            {/* Market Performance */}
            <div className="grid md:grid-cols-3 gap-4">
              <MarketCard
                title="BTTS"
                emoji="⚽"
                total={stats.accuracy.btts.total}
                correct={stats.accuracy.btts.correct}
                rate={stats.accuracy.btts.rate}
                color="emerald"
              />
              <MarketCard
                title="Üst/Alt 2.5"
                emoji="📈"
                total={stats.accuracy.overUnder.total}
                correct={stats.accuracy.overUnder.correct}
                rate={stats.accuracy.overUnder.rate}
                color="blue"
              />
              <MarketCard
                title="Maç Sonucu"
                emoji="🏆"
                total={stats.accuracy.matchResult.total}
                correct={stats.accuracy.matchResult.correct}
                rate={stats.accuracy.matchResult.rate}
                color="purple"
              />
            </div>

            {/* Confidence Distribution */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                📊 Güven Seviyesi vs Başarı
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="text-green-400 font-bold mb-1">Yüksek Güven (&gt;70%)</div>
                  <div className="text-3xl font-bold text-white">{stats.confidenceDistribution.high.rate}%</div>
                  <div className="text-gray-400 text-sm">
                    {stats.confidenceDistribution.high.correct} / {stats.confidenceDistribution.high.count} doğru
                  </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="text-yellow-400 font-bold mb-1">Orta Güven (60-70%)</div>
                  <div className="text-3xl font-bold text-white">{stats.confidenceDistribution.medium.rate}%</div>
                  <div className="text-gray-400 text-sm">
                    {stats.confidenceDistribution.medium.correct} / {stats.confidenceDistribution.medium.count} doğru
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="text-red-400 font-bold mb-1">Düşük Güven (&lt;60%)</div>
                  <div className="text-3xl font-bold text-white">{stats.confidenceDistribution.low.rate}%</div>
                  <div className="text-gray-400 text-sm">
                    {stats.confidenceDistribution.low.correct} / {stats.confidenceDistribution.low.count} doğru
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  ⚡ Sistem Performansı
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Ortalama Analiz Süresi</span>
                    <span className="text-white font-bold">{stats.performance.avgProcessingTime}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Ortalama Güven</span>
                    <span className="text-white font-bold">%{stats.performance.avgConfidence}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Dönem</span>
                    <span className="text-white font-bold">{stats.overview.periodDays} gün</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  🤖 Kullanılan Modeller
                </h3>
                <div className="space-y-2">
                  {stats.performance.modelsUsage && Object.entries(stats.performance.modelsUsage).map(([model, count]) => (
                    <div key={model} className="flex justify-between items-center">
                      <span className="text-gray-400 capitalize flex items-center gap-2">
                        {model === 'claude' ? '🧠' : '🔮'} {model}
                      </span>
                      <span className="text-white font-bold">{count} analiz</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANALYSES TAB */}
        {activeTab === 'analyses' && stats && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  📋 Son Analizler ({stats.recentAnalyses?.length || 0})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Maç</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">BTTS</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Ü/A</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">MS</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Risk</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Süre</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Durum</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentAnalyses?.map((analysis, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{analysis.homeTeam}</div>
                          <div className="text-gray-400 text-sm">vs {analysis.awayTeam}</div>
                          <div className="text-gray-500 text-xs">{analysis.league}</div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <PredictionBadge
                            prediction={analysis.btts.prediction}
                            confidence={analysis.btts.confidence}
                            type="btts"
                          />
                        </td>
                        <td className="text-center py-3 px-4">
                          <PredictionBadge
                            prediction={analysis.overUnder.prediction}
                            confidence={analysis.overUnder.confidence}
                            type="ou"
                          />
                        </td>
                        <td className="text-center py-3 px-4">
                          <PredictionBadge
                            prediction={analysis.matchResult.prediction}
                            confidence={analysis.matchResult.confidence}
                            type="mr"
                          />
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            analysis.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                            analysis.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {analysis.riskLevel === 'low' ? 'Düşük' : 
                             analysis.riskLevel === 'medium' ? 'Orta' : 'Yüksek'}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 text-gray-400 text-sm">
                          {analysis.processingTime}ms
                        </td>
                        <td className="text-center py-3 px-4">
                          {analysis.isSettled ? (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
                              ✓ Sonuçlandı
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400">
                              ⏳ Bekliyor
                            </span>
                          )}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-400 text-sm">
                          {new Date(analysis.createdAt).toLocaleDateString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(!stats.recentAnalyses || stats.recentAnalyses.length === 0) && (
                <div className="p-8 text-center text-gray-500">
                  Henüz analiz yapılmamış
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-xl font-bold text-white mb-4">⚙️ Sistem Ayarları</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-white font-medium">Analiz Sistemi</div>
                    <div className="text-gray-400 text-sm">Claude + DeepSeek (V2)</div>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    Aktif
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-white font-medium">Ortalama Analiz Süresi</div>
                    <div className="text-gray-400 text-sm">~10-15 saniye</div>
                  </div>
                  <span className="text-purple-400 font-bold">
                    {stats?.performance.avgProcessingTime || 0}ms
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-white font-medium">Toplam Analiz (Tüm Zamanlar)</div>
                    <div className="text-gray-400 text-sm">smart_analysis tablosu</div>
                  </div>
                  <span className="text-white font-bold">
                    {stats?.overview.total || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-xl font-bold text-white mb-4">🚀 Hızlı İşlemler</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className="p-4 bg-green-600/20 border border-green-500/30 rounded-xl text-left hover:bg-green-600/30 transition disabled:opacity-50"
                >
                  <div className="text-green-400 font-bold mb-1">✅ Sonuçları Güncelle</div>
                  <div className="text-gray-400 text-sm">Tamamlanan maçların sonuçlarını kontrol et</div>
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-4 bg-purple-600/20 border border-purple-500/30 rounded-xl text-left hover:bg-purple-600/30 transition disabled:opacity-50"
                >
                  <div className="text-purple-400 font-bold mb-1">🔄 İstatistikleri Yenile</div>
                  <div className="text-gray-400 text-sm">Tüm performans verilerini güncelle</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({ icon, label, value, color }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  color: string 
}) {
  const colorClasses = {
    purple: 'from-purple-600/20 to-purple-500/10 border-purple-500/30 text-purple-400',
    green: 'from-green-600/20 to-green-500/10 border-green-500/30 text-green-400',
    yellow: 'from-yellow-600/20 to-yellow-500/10 border-yellow-500/30 text-yellow-400',
    blue: 'from-blue-600/20 to-blue-500/10 border-blue-500/30 text-blue-400',
  }[color] || 'from-gray-600/20 to-gray-500/10 border-gray-500/30 text-gray-400';

  return (
    <div className={`bg-gradient-to-r ${colorClasses} border rounded-2xl p-4`}>
      <div className={`mb-2 ${color === 'purple' ? 'text-purple-400' : color === 'green' ? 'text-green-400' : color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className={`text-sm ${color === 'purple' ? 'text-purple-400' : color === 'green' ? 'text-green-400' : color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'}`}>
        {label}
      </div>
    </div>
  );
}

function MarketCard({ title, emoji, total, correct, rate, color }: {
  title: string;
  emoji: string;
  total: number;
  correct: number;
  rate: string;
  color: string;
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500',
    blue: 'text-blue-400 bg-blue-500',
    purple: 'text-purple-400 bg-purple-500',
  }[color] || 'text-gray-400 bg-gray-500';

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{emoji}</span>
        <h4 className="text-lg font-bold text-white">{title}</h4>
      </div>
      <div className={`text-4xl font-bold mb-2 ${colorClasses.split(' ')[0]}`}>{rate}%</div>
      <div className="text-gray-400 text-sm">
        {correct} / {total} doğru
      </div>
      <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses.split(' ')[1]} rounded-full`}
          style={{ width: `${parseFloat(rate) || 0}%` }}
        />
      </div>
    </div>
  );
}

function PredictionBadge({ prediction, confidence, type }: {
  prediction: string;
  confidence: number;
  type: 'btts' | 'ou' | 'mr';
}) {
  let bgColor = 'bg-gray-500/20';
  let textColor = 'text-gray-400';
  let label = prediction?.toUpperCase() || '-';

  if (type === 'btts') {
    bgColor = prediction === 'yes' ? 'bg-green-500/20' : 'bg-red-500/20';
    textColor = prediction === 'yes' ? 'text-green-400' : 'text-red-400';
    label = prediction === 'yes' ? 'VAR' : 'YOK';
  } else if (type === 'ou') {
    bgColor = prediction === 'over' ? 'bg-blue-500/20' : 'bg-orange-500/20';
    textColor = prediction === 'over' ? 'text-blue-400' : 'text-orange-400';
    label = prediction === 'over' ? 'ÜST' : 'ALT';
  } else if (type === 'mr') {
    bgColor = 'bg-purple-500/20';
    textColor = 'text-purple-400';
    label = prediction === 'home' ? 'EV' : prediction === 'away' ? 'DEP' : 'BER';
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${bgColor} ${textColor}`}>
      {label} %{confidence}
    </span>
  );
}
