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
  const [activeTab, setActiveTab] = useState<'overview' | 'analyses' | 'patterns' | 'settings'>('overview');

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
              { id: 'patterns', label: '🔍 Pattern Analizi', icon: TrendingUp },
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

        {/* PATTERNS TAB */}
        {activeTab === 'patterns' && (
          <PatternAnalysisTab />
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
// PATTERN ANALYSIS TAB COMPONENT
// ============================================================================

function PatternAnalysisTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [settling, setSettling] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<any[]>([]);
  
  useEffect(() => {
    fetchLogs();
  }, []);
  
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v2/odds-analysis-detailed?limit=100');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSettleAll = async () => {
    setSettling(true);
    try {
      const response = await fetch('/api/v2/odds-analysis-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settleAll: true })
      });
      const data = await response.json();
      alert(`✅ ${data.settled || 0} maç sonucu güncellendi`);
      await fetchLogs();
    } catch (error) {
      alert('Hata: ' + error);
    } finally {
      setSettling(false);
    }
  };
  
  const findSimilarMatches = (log: any) => {
    const similar = logs.filter(l => 
      l.fixture_id !== log.fixture_id &&
      l.best_value_market === log.best_value_market &&
      Math.abs((l.best_value_amount || 0) - (log.best_value_amount || 0)) < 5 &&
      l.actual_result // Only settled matches
    );
    
    // Sort by success rate
    const withSuccess = similar.map(l => ({
      ...l,
      success: l.value_bet_success
    }));
    
    setSimilarMatches(withSuccess.slice(0, 5));
  };
  
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        Yükleniyor...
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">🔍 Pattern Analizi</h2>
          <p className="text-gray-400">Analiz edilen maçlar ve detaylı analizler</p>
        </div>
        <button
          onClick={handleSettleAll}
          disabled={settling}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium disabled:opacity-50"
        >
          {settling ? 'Güncelleniyor...' : '✅ Tüm Sonuçları Güncelle'}
        </button>
      </div>
      
      {/* Logs List */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/10">
              <tr>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Maç</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Best Value</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Value %</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Rating</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Sonuç</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Başarı</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition">
                  <td className="py-3 px-4">
                    <div className="text-white font-medium">{log.home_team} vs {log.away_team}</div>
                    <div className="text-gray-400 text-sm">{log.league}</div>
                    <div className="text-gray-500 text-xs">
                      {new Date(log.match_date).toLocaleDateString('tr-TR')}
                    </div>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className="text-blue-400 font-medium">{log.best_value_market || 'N/A'}</span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className={`font-bold ${
                      (log.best_value_amount || 0) >= 10 ? 'text-green-400' :
                      (log.best_value_amount || 0) >= 5 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      +{log.best_value_amount || 0}%
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.value_rating === 'High' ? 'bg-green-500/20 text-green-400' :
                      log.value_rating === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      log.value_rating === 'Low' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {log.value_rating || 'None'}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    {log.actual_result ? (
                      <div>
                        <div className="text-white font-medium">{log.actual_result}</div>
                        <div className="text-gray-400 text-sm">{log.actual_score}</div>
                      </div>
                    ) : (
                      <span className="text-gray-500">Bekleniyor</span>
                    )}
                  </td>
                  <td className="text-center py-3 px-4">
                    {log.value_bet_success !== undefined ? (
                      log.value_bet_success ? (
                        <span className="text-green-400 font-bold">✓ Başarılı</span>
                      ) : (
                        <span className="text-red-400 font-bold">✗ Başarısız</span>
                      )
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="text-center py-3 px-4">
                    <button
                      onClick={() => {
                        setSelectedLog(log);
                        findSimilarMatches(log);
                      }}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Detailed Analysis Modal */}
      {selectedLog && (
        <DetailedAnalysisModal
          log={selectedLog}
          similarMatches={similarMatches}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// DETAILED ANALYSIS MODAL
// ============================================================================

function DetailedAnalysisModal({ log, similarMatches, onClose }: { 
  log: any; 
  similarMatches: any[];
  onClose: () => void;
}) {
  const agents = log.agentAnalysis || {};
  const odds = agents.odds || {};
  const stats = agents.stats || {};
  const deepAnalysis = agents.deepAnalysis || {};
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-white/10 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-white/10 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{log.home_team} vs {log.away_team}</h3>
            <p className="text-gray-400 text-sm">{log.league} • {new Date(log.match_date).toLocaleDateString('tr-TR')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Match Result */}
          {log.actual_result && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <h4 className="text-green-400 font-bold mb-2">✅ Maç Sonucu</h4>
              <div className="text-white text-lg font-bold">{log.actual_score} ({log.actual_result})</div>
              <div className="text-gray-400 text-sm mt-1">
                Over 2.5: {log.actual_over_25 ? 'Evet' : 'Hayır'} • BTTS: {log.actual_btts ? 'Evet' : 'Hayır'}
              </div>
            </div>
          )}
          
          {/* ODDS AGENT */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <h4 className="text-green-400 font-bold mb-3 flex items-center gap-2">
              💰 ODDS AGENT (Bahis Oranları Analiz Ajanı)
            </h4>
            <p className="text-gray-300 text-sm mb-4">Görevi: Bahis oranlarını form verileriyle karşılaştırarak VALUE BET (değerli bahis) tespit eder.</p>
            
            <div className="space-y-3">
              <div>
                <h5 className="text-white font-semibold mb-2">Oran Analizi:</h5>
                <div className="bg-black/20 rounded p-3 space-y-1 text-sm">
                  <p className="text-gray-300">
                    Ev Sahibi: Oran %{log.home_implied_prob} implied, Form %{log.home_form_prob} → Value: 
                    <span className={log.home_value > 0 ? 'text-green-400' : 'text-red-400'}>
                      {log.home_value > 0 ? '+' : ''}{log.home_value}%
                    </span>
                  </p>
                  <p className="text-gray-300">
                    Deplasman: Oran %{log.away_implied_prob} implied, Form %{log.away_form_prob} → Value: 
                    <span className={log.away_value > 0 ? 'text-green-400' : 'text-red-400'}>
                      {log.away_value > 0 ? '+' : ''}{log.away_value}%
                    </span>
                  </p>
                  <p className="text-gray-300">
                    Over 2.5: Oran %{log.over_25_implied_prob} implied, Form %{log.over_25_form_prob} → Value: 
                    <span className={log.over_25_value > 0 ? 'text-green-400' : 'text-red-400'}>
                      {log.over_25_value > 0 ? '+' : ''}{log.over_25_value}%
                    </span>
                  </p>
                  <p className="text-green-400 font-semibold mt-2">
                    🏆 En İyi Value: {log.best_value_market} (+{log.best_value_amount}%)
                  </p>
                </div>
              </div>
              
              {odds.recommendation && (
                <div>
                  <h5 className="text-white font-semibold mb-2">ODDS AGENT TAHMİNLERİ:</h5>
                  <div className="bg-black/20 rounded p-3 space-y-2 text-sm">
                    <p className="text-white">
                      <span className="text-green-400 font-semibold">Ana Öneri:</span> {odds.recommendation} (%{odds.confidence} güven)
                    </p>
                    {odds.recommendationReasoning && (
                      <p className="text-gray-400 text-xs">{odds.recommendationReasoning}</p>
                    )}
                    {odds.matchWinnerValue && (
                      <p className="text-white">
                        <span className="text-green-400 font-semibold">Maç Sonucu Value:</span> {odds.matchWinnerValue}
                      </p>
                    )}
                    {odds.matchWinnerReasoning && (
                      <p className="text-gray-400 text-xs">{odds.matchWinnerReasoning}</p>
                    )}
                    {odds.asianHandicap && (
                      <p className="text-white">
                        <span className="text-green-400 font-semibold">Asian Handicap:</span> {odds.asianHandicap.recommendation} (%{odds.asianHandicap.confidence} güven)
                      </p>
                    )}
                    {odds.correctScore && (
                      <p className="text-white">
                        <span className="text-green-400 font-semibold">Correct Score:</span> {odds.correctScore.mostLikely} (%{odds.correctScore.confidence} güven)
                        {odds.correctScore.second && (
                          <span className="text-gray-400"> • 2. Olası: {odds.correctScore.second}, 3. Olası: {odds.correctScore.third}</span>
                        )}
                      </p>
                    )}
                    {odds.cornersAnalysis && (
                      <p className="text-white">
                        <span className="text-green-400 font-semibold">Korner:</span> {odds.cornersAnalysis.totalCorners} (%{odds.cornersAnalysis.confidence} güven)
                      </p>
                    )}
                    {log.value_bets && log.value_bets.length > 0 && (
                      <p className="text-green-400 font-semibold mt-2">
                        💰 Value Bets: {log.value_bets.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* STATS AGENT */}
          {stats.formAnalysis && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h4 className="text-blue-400 font-bold mb-3">📊 STATS AGENT (İstatistik Analiz Ajanı)</h4>
              <p className="text-gray-300 text-sm mb-4">Görevi: Form, gol istatistikleri, xG (Expected Goals), timing patterns ve clean sheet analizi yapar.</p>
              
              <div className="bg-black/20 rounded p-3 space-y-2 text-sm">
                {stats.formAnalysis && (
                  <p className="text-white">
                    <span className="text-blue-400 font-semibold">Form Analizi:</span> {stats.formAnalysis}
                  </p>
                )}
                {stats.xgAnalysis && (
                  <div>
                    <p className="text-white">
                      <span className="text-blue-400 font-semibold">xG Analizi:</span> Ev {stats.xgAnalysis.homeXG}, Dep {stats.xgAnalysis.awayXG}, Toplam {stats.xgAnalysis.totalXG}
                    </p>
                  </div>
                )}
                {stats.overUnder && (
                  <p className="text-white">
                    <span className="text-blue-400 font-semibold">Over/Under:</span> {stats.overUnder} (%{stats.confidence} güven)
                  </p>
                )}
                {stats.matchResult && (
                  <p className="text-white">
                    <span className="text-blue-400 font-semibold">Maç Sonucu:</span> {stats.matchResult} (%{stats.matchResultConfidence || stats.confidence} güven)
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* DEEP ANALYSIS AGENT */}
          {deepAnalysis.matchAnalysis && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h4 className="text-purple-400 font-bold mb-3">🎯 DEEP ANALYSIS AGENT (Derin Analiz Ajanı)</h4>
              <p className="text-gray-300 text-sm mb-4">Görevi: Çok katmanlı analiz yapar - takım formu, taktiksel yapı, H2H, hakem, hava durumu, diziliş analizi.</p>
              
              <div className="bg-black/20 rounded p-3 space-y-2 text-sm">
                <p className="text-gray-300">{deepAnalysis.matchAnalysis}</p>
                {deepAnalysis.overUnder && (
                  <p className="text-white">
                    <span className="text-purple-400 font-semibold">Over/Under:</span> {deepAnalysis.overUnder.prediction} (%{deepAnalysis.overUnder.confidence} güven)
                  </p>
                )}
                {deepAnalysis.matchResult && (
                  <p className="text-white">
                    <span className="text-purple-400 font-semibold">Maç Sonucu:</span> {deepAnalysis.matchResult.prediction} (%{deepAnalysis.matchResult.confidence} güven)
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Similar Matches */}
          {similarMatches.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h4 className="text-blue-400 font-bold mb-3">🔍 Benzer Durumlar</h4>
              <p className="text-gray-400 text-sm mb-3">Gelecekte benzer durumlarla karşılaştığınızda bu sonuçları referans alabilirsiniz:</p>
              <div className="space-y-2">
                {similarMatches.map((match, idx) => (
                  <div key={idx} className="bg-black/20 rounded p-2 text-sm">
                    <div className="text-white font-medium">{match.home_team} vs {match.away_team}</div>
                    <div className="text-gray-400">
                      Value: +{match.best_value_amount}% • 
                      Sonuç: {match.actual_result} ({match.actual_score}) • 
                      {match.value_bet_success ? (
                        <span className="text-green-400">✓ Başarılı</span>
                      ) : (
                        <span className="text-red-400">✗ Başarısız</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
