'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Admin emails that can access this page
const ADMIN_EMAILS = ['serayd61@hotmail.com', 'info@swissdigital.life'];

// AI Model configurations
const AI_MODELS: Record<string, { name: string; icon: string; color: string; gradient: string }> = {
  claude: { name: 'Claude', icon: '🧠', color: '#FF6B35', gradient: 'from-orange-500 to-red-500' },
  gpt4: { name: 'GPT-4', icon: '🤖', color: '#10B981', gradient: 'from-green-500 to-emerald-500' },
  gemini: { name: 'Gemini', icon: '💎', color: '#3B82F6', gradient: 'from-blue-500 to-cyan-500' },
  perplexity: { name: 'Perplexity', icon: '🔮', color: '#8B5CF6', gradient: 'from-purple-500 to-violet-500' },
  stats_agent: { name: 'Stats Agent', icon: '📊', color: '#F59E0B', gradient: 'from-amber-500 to-yellow-500' },
  deep_analysis: { name: 'Deep Analysis', icon: '🔬', color: '#EC4899', gradient: 'from-pink-500 to-rose-500' },
  consensus: { name: 'Consensus', icon: '🎯', color: '#14B8A6', gradient: 'from-teal-500 to-cyan-500' },
};

interface OverallStats {
  total_predictions: number;
  settled_predictions: number;
  pending_predictions: number;
  btts: { total: number; correct: number; accuracy: string };
  over_under: { total: number; correct: number; accuracy: string };
  match_result: { total: number; correct: number; accuracy: string };
}

interface ModelStat {
  model_name: string;
  total_predictions: number;
  btts: { total: number; correct: number; accuracy: string };
  over_under: { total: number; correct: number; accuracy: string };
  match_result: { total: number; correct: number; accuracy: string };
  overall: { total: number; correct: number; accuracy: string };
  avg_confidence: string;
}

interface Prediction {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  prediction_source: string;
  consensus_btts: string;
  consensus_btts_confidence: number;
  consensus_over_under: string;
  consensus_over_under_confidence: number;
  consensus_match_result: string;
  consensus_match_result_confidence: number;
  is_settled: boolean;
  actual_home_score: number;
  actual_away_score: number;
  btts_correct: boolean;
  over_under_correct: boolean;
  match_result_correct: boolean;
  created_at: string;
  ai_model_predictions?: any[];
}

interface ProMarketStats {
  overview: {
    total: number;
    settled: number;
    pending: number;
  };
  markets: Record<string, { total: number; correct: number; accuracy: string; avgConfidence: string }>;
  recent: any[];
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'predictions' | 'analytics' | 'pro_markets'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [models, setModels] = useState<ModelStat[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [proMarketStats, setProMarketStats] = useState<ProMarketStats | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'settled'>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');

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

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching admin data...');
      
      // Add cache-busting timestamp
      const timestamp = Date.now();
      
      // Fetch both regular stats and professional market stats in parallel
      const [res, proMarketRes] = await Promise.all([
        fetch(`/api/admin/enhanced-stats?type=all&limit=100&_t=${timestamp}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch(`/api/admin/professional-markets?_t=${timestamp}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
      ]);
      
      const data = await res.json();
      const proMarketData = await proMarketRes.json();
      
      console.log('📊 API Response:', data);
      console.log('📊 Recent predictions count:', data.recent?.length || 0);
      console.log('🎰 Pro Market Stats:', proMarketData);

      if (data.success) {
        // Calculate overall from recent if overall is empty
        const recentData = data.recent || [];
        
        if (recentData.length > 0 && (!data.overall || data.overall.total_predictions === 0)) {
          const settled = recentData.filter((p: any) => p.is_settled);
          const calculatedOverall = {
            total_predictions: recentData.length,
            settled_predictions: settled.length,
            pending_predictions: recentData.length - settled.length,
            btts: {
              total: settled.length,
              correct: settled.filter((p: any) => p.btts_correct).length,
              accuracy: settled.length > 0 
                ? ((settled.filter((p: any) => p.btts_correct).length / settled.length) * 100).toFixed(1) 
                : '0'
            },
            over_under: {
              total: settled.length,
              correct: settled.filter((p: any) => p.over_under_correct).length,
              accuracy: settled.length > 0 
                ? ((settled.filter((p: any) => p.over_under_correct).length / settled.length) * 100).toFixed(1) 
                : '0'
            },
            match_result: {
              total: settled.length,
              correct: settled.filter((p: any) => p.match_result_correct).length,
              accuracy: settled.length > 0 
                ? ((settled.filter((p: any) => p.match_result_correct).length / settled.length) * 100).toFixed(1) 
                : '0'
            }
          };
          setOverall(calculatedOverall);
          console.log('📊 Calculated overall from recent:', calculatedOverall);
        } else {
          setOverall(data.overall);
        }
        
        setModels(data.models || []);
        setPredictions(recentData);
        console.log('✅ Predictions set:', recentData.length, 'items');
      } else {
        console.error('❌ API returned success: false');
      }

      // Set professional market stats
      if (proMarketData.success) {
        setProMarketStats({
          overview: proMarketData.overview || { total: 0, settled: 0, pending: 0 },
          markets: proMarketData.markets || {},
          recent: proMarketData.recent || []
        });
        console.log('✅ Pro Market Stats set');
      } else {
        // Set empty state if API failed or table doesn't exist
        setProMarketStats({
          overview: { total: 0, settled: 0, pending: 0 },
          markets: {},
          recent: []
        });
        console.log('⚠️ Pro Market Stats: No data or table not found');
      }
    } catch (error) {
      console.error('❌ Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && ADMIN_EMAILS.includes(session.user?.email || '')) {
      fetchData();
    }
  }, [session, fetchData]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Settle results
  const handleSettle = async () => {
    setSettling(true);
    try {
      const res = await fetch('/api/cron/settle-admin-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ ${data.settled || 0} tahmin güncellendi!`);
        await fetchData();
      } else {
        alert(`❌ Hata: ${data.error || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      alert('❌ Sonuç güncelleme hatası');
    } finally {
      setSettling(false);
    }
  };

  // Filter predictions
  const filteredPredictions = predictions.filter(p => {
    if (filterStatus === 'pending' && p.is_settled) return false;
    if (filterStatus === 'settled' && !p.is_settled) return false;
    if (selectedModel !== 'all' && p.prediction_source !== selectedModel) return false;
    return true;
  });

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Admin Panel Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Unauthorized
  if (!session || !ADMIN_EMAILS.includes(session.user?.email || '')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-white">
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                ⚙️ Admin Panel
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full">
                  PRO
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                Yenile
              </button>
              <button
                onClick={handleSettle}
                disabled={settling}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <span className={settling ? 'animate-spin' : ''}>⚡</span>
                Sonuçları Güncelle
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {[
              { id: 'overview', label: '📊 Genel Bakış', icon: '📊' },
              { id: 'models', label: '🤖 AI Modelleri', icon: '🤖' },
              { id: 'predictions', label: '📝 Tahminler', icon: '📝' },
              { id: 'analytics', label: '📈 Analitik', icon: '📈' },
              { id: 'pro_markets', label: '🎰 Pro Markets', icon: '🎰' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
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
        {activeTab === 'overview' && overall && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon="📊"
                label="Toplam Tahmin"
                value={overall.total_predictions}
                color="blue"
              />
              <StatCard
                icon="✅"
                label="Sonuçlanan"
                value={overall.settled_predictions}
                color="green"
              />
              <StatCard
                icon="⏳"
                label="Bekleyen"
                value={overall.pending_predictions}
                color="yellow"
              />
              <StatCard
                icon="🎯"
                label="Genel Başarı"
                value={`${((parseInt(overall.btts.accuracy) + parseInt(overall.over_under.accuracy) + parseInt(overall.match_result.accuracy)) / 3).toFixed(1)}%`}
                color="purple"
              />
            </div>

            {/* Market Performance */}
            <div className="grid md:grid-cols-3 gap-4">
              <MarketCard
                title="KG Var/Yok (BTTS)"
                emoji="⚽"
                total={overall.btts.total}
                correct={overall.btts.correct}
                accuracy={overall.btts.accuracy}
                color="emerald"
              />
              <MarketCard
                title="Üst/Alt 2.5"
                emoji="📈"
                total={overall.over_under.total}
                correct={overall.over_under.correct}
                accuracy={overall.over_under.accuracy}
                color="blue"
              />
              <MarketCard
                title="Maç Sonucu"
                emoji="🏆"
                total={overall.match_result.total}
                correct={overall.match_result.correct}
                accuracy={overall.match_result.accuracy}
                color="purple"
              />
            </div>

            {/* Model Leaderboard */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                🏅 Model Liderlik Tablosu
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Model</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Tahmin</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">BTTS</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Ü/A 2.5</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">MS</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Genel</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Güven</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model, idx) => {
                      const config = AI_MODELS[model.model_name.toLowerCase().replace(/[^a-z0-9]/g, '_')] || 
                                    AI_MODELS[model.model_name.toLowerCase()] ||
                                    { name: model.model_name, icon: '🤖', color: '#666', gradient: 'from-gray-500 to-gray-600' };
                      
                      return (
                        <tr key={model.model_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-3 px-4">
                            <span className={`text-xl ${idx === 0 ? '' : idx === 1 ? '' : idx === 2 ? '' : 'text-gray-500'}`}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{config.icon}</span>
                              <span className="text-white font-medium">{config.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-300">{model.total_predictions}</td>
                          <td className="py-3 px-4 text-center">
                            <AccuracyBadge accuracy={parseFloat(model.btts.accuracy)} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <AccuracyBadge accuracy={parseFloat(model.over_under.accuracy)} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <AccuracyBadge accuracy={parseFloat(model.match_result.accuracy)} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <AccuracyBadge accuracy={parseFloat(model.overall.accuracy)} large />
                          </td>
                          <td className="py-3 px-4 text-center text-gray-300">~{model.avg_confidence}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODELS TAB */}
        {activeTab === 'models' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map(model => {
              const key = model.model_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
              const config = AI_MODELS[key] || AI_MODELS[model.model_name.toLowerCase()] ||
                            { name: model.model_name, icon: '🤖', color: '#666', gradient: 'from-gray-500 to-gray-600' };

              return (
                <div 
                  key={model.model_name}
                  className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className={`bg-gradient-to-r ${config.gradient} p-4`}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{config.icon}</span>
                      <div>
                        <h3 className="text-xl font-bold text-white">{config.name}</h3>
                        <p className="text-white/70 text-sm">{model.total_predictions} tahmin</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Genel Başarı</span>
                      <span className={`text-2xl font-bold ${
                        parseFloat(model.overall.accuracy) >= 60 ? 'text-green-400' :
                        parseFloat(model.overall.accuracy) >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        %{model.overall.accuracy}
                      </span>
                    </div>

                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${config.gradient}`}
                        style={{ width: `${model.overall.accuracy}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="text-center p-2 bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-400">BTTS</p>
                        <p className="text-lg font-bold text-white">%{model.btts.accuracy}</p>
                        <p className="text-xs text-gray-500">{model.btts.correct}/{model.btts.total}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-400">Ü/A</p>
                        <p className="text-lg font-bold text-white">%{model.over_under.accuracy}</p>
                        <p className="text-xs text-gray-500">{model.over_under.correct}/{model.over_under.total}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-400">MS</p>
                        <p className="text-lg font-bold text-white">%{model.match_result.accuracy}</p>
                        <p className="text-xs text-gray-500">{model.match_result.correct}/{model.match_result.total}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Ort. Güven</span>
                        <span className="text-white">~{model.avg_confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PREDICTIONS TAB */}
        {activeTab === 'predictions' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex gap-2">
                {['all', 'pending', 'settled'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status as any)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {status === 'all' ? '📋 Tümü' : status === 'pending' ? '⏳ Bekleyen' : '✅ Sonuçlanan'}
                  </button>
                ))}
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
              >
                <option value="all">Tüm Kaynaklar</option>
                <option value="quad_brain">Quad-Brain</option>
                <option value="ai_agents">AI Agents</option>
                <option value="consensus">Consensus</option>
                <option value="daily_coupon">Günlük Kupon</option>
              </select>
              <span className="text-gray-400 text-sm self-center ml-auto">
                {filteredPredictions.length} kayıt
              </span>
            </div>

            {/* Predictions List */}
            <div className="space-y-3">
              {filteredPredictions.map(pred => (
                <PredictionCard key={pred.id} prediction={pred} />
              ))}

              {filteredPredictions.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <span className="text-4xl mb-4 block">📭</span>
                  Kayıt bulunamadı
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && overall && (
          <div className="space-y-6">
            {/* Confidence vs Accuracy Analysis */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">📊 Güven vs Başarı Analizi</h3>
              <p className="text-gray-400 mb-4">Güven seviyesine göre başarı oranları</p>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Yüksek Güven (&gt;70%)</p>
                  <p className="text-2xl font-bold text-green-400">Hesaplanıyor...</p>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Orta Güven (60-70%)</p>
                  <p className="text-2xl font-bold text-yellow-400">Hesaplanıyor...</p>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Düşük Güven (&lt;60%)</p>
                  <p className="text-2xl font-bold text-red-400">Hesaplanıyor...</p>
                </div>
              </div>
            </div>

            {/* Best & Worst */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 border border-green-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">🏆 En İyi Performans</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">En iyi pazar:</span>
                    <span className="text-white font-medium">Üst/Alt 2.5 ({overall.over_under.accuracy}%)</span>
                  </div>
                  {models[0] && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">En iyi model:</span>
                      <span className="text-white font-medium">{models[0].model_name} ({models[0].overall.accuracy}%)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-800/50 border border-red-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-red-400 mb-4">⚠️ İyileştirme Gereken</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Zayıf pazar:</span>
                    <span className="text-white font-medium">Maç Sonucu ({overall.match_result.accuracy}%)</span>
                  </div>
                  {models.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Düşük model:</span>
                      <span className="text-white font-medium">
                        {models[models.length - 1].model_name} ({models[models.length - 1].overall.accuracy}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">💡 Sistem Önerileri</h3>
              <ul className="space-y-2 text-gray-300">
                {parseFloat(overall.match_result.accuracy) < 40 && (
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">⚠️</span>
                    Maç Sonucu tahminleri düşük. Daha fazla faktör (kadro, form, ev/deplasman) entegre edilmeli.
                  </li>
                )}
                {parseFloat(overall.over_under.accuracy) > 60 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✅</span>
                    Üst/Alt tahminleri güçlü. Bu pazara daha fazla odaklanılabilir.
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">💡</span>
                  Heurist ajanlarını günlük kupona entegre etmek başarıyı artırabilir.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* PROFESSIONAL MARKETS TAB */}
        {activeTab === 'pro_markets' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon="🎰"
                label="Toplam Analiz"
                value={proMarketStats?.overview.total || 0}
                color="blue"
              />
              <StatCard
                icon="✅"
                label="Sonuçlanan"
                value={proMarketStats?.overview.settled || 0}
                color="green"
              />
              <StatCard
                icon="⏳"
                label="Bekleyen"
                value={proMarketStats?.overview.pending || 0}
                color="yellow"
              />
              <StatCard
                icon="🎯"
                label="Safe Bet Başarı"
                value={`${proMarketStats?.markets.safe_bet_1?.accuracy || '0'}%`}
                color="purple"
              />
            </div>

            {/* Market Performance Grid */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                🎰 Market Başarı Oranları
              </h3>
              
              {proMarketStats && Object.keys(proMarketStats.markets).length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(proMarketStats.markets)
                    .sort((a, b) => parseFloat(b[1].accuracy) - parseFloat(a[1].accuracy))
                    .map(([market, stats]) => (
                      <ProMarketCard 
                        key={market} 
                        market={market} 
                        stats={stats} 
                      />
                    ))
                  }
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <span className="text-4xl mb-4 block">📭</span>
                  Henüz veri yok. Maç analizi yapıldıkça veriler burada görünecek.
                </div>
              )}
            </div>

            {/* Core Markets Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <MarketCard
                title="Üst/Alt 2.5"
                emoji="📈"
                total={proMarketStats?.markets.over_under_25?.total || 0}
                correct={proMarketStats?.markets.over_under_25?.correct || 0}
                accuracy={proMarketStats?.markets.over_under_25?.accuracy || '0'}
                color="blue"
              />
              <MarketCard
                title="KG Var/Yok (BTTS)"
                emoji="⚽"
                total={proMarketStats?.markets.btts?.total || 0}
                correct={proMarketStats?.markets.btts?.correct || 0}
                accuracy={proMarketStats?.markets.btts?.accuracy || '0'}
                color="emerald"
              />
              <MarketCard
                title="Maç Sonucu"
                emoji="🏆"
                total={proMarketStats?.markets.match_result?.total || 0}
                correct={proMarketStats?.markets.match_result?.correct || 0}
                accuracy={proMarketStats?.markets.match_result?.accuracy || '0'}
                color="purple"
              />
            </div>

            {/* First Half Markets */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">⏱️ İlk Yarı Marketleri</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <MiniMarketCard 
                  label="İY Sonucu" 
                  accuracy={proMarketStats?.markets.fh_result?.accuracy} 
                  total={proMarketStats?.markets.fh_result?.total}
                />
                <MiniMarketCard 
                  label="İY Üst 0.5" 
                  accuracy={proMarketStats?.markets.fh_over_05?.accuracy}
                  total={proMarketStats?.markets.fh_over_05?.total}
                />
                <MiniMarketCard 
                  label="İY Üst 1.5" 
                  accuracy={proMarketStats?.markets.fh_over_15?.accuracy}
                  total={proMarketStats?.markets.fh_over_15?.total}
                />
                <MiniMarketCard 
                  label="İY BTTS" 
                  accuracy={proMarketStats?.markets.fh_btts?.accuracy}
                  total={proMarketStats?.markets.fh_btts?.total}
                />
              </div>
            </div>

            {/* Special Markets */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">⚡ Özel Marketler</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <MiniMarketCard 
                  label="HT/FT" 
                  accuracy={proMarketStats?.markets.htft?.accuracy}
                  total={proMarketStats?.markets.htft?.total}
                />
                <MiniMarketCard 
                  label="Asian Handicap" 
                  accuracy={proMarketStats?.markets.asian_hc?.accuracy}
                  total={proMarketStats?.markets.asian_hc?.total}
                />
                <MiniMarketCard 
                  label="İlk Gol" 
                  accuracy={proMarketStats?.markets.first_goal?.accuracy}
                  total={proMarketStats?.markets.first_goal?.total}
                />
                <MiniMarketCard 
                  label="Korner" 
                  accuracy={proMarketStats?.markets.corners?.accuracy}
                  total={proMarketStats?.markets.corners?.total}
                />
              </div>
            </div>

            {/* Team Goals */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">⚽ Takım Gol Marketleri</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <MiniMarketCard 
                  label="Ev Üst 0.5" 
                  accuracy={proMarketStats?.markets.home_over_05?.accuracy}
                  total={proMarketStats?.markets.home_over_05?.total}
                />
                <MiniMarketCard 
                  label="Dep Üst 0.5" 
                  accuracy={proMarketStats?.markets.away_over_05?.accuracy}
                  total={proMarketStats?.markets.away_over_05?.total}
                />
                <MiniMarketCard 
                  label="Ev Üst 1.5" 
                  accuracy={proMarketStats?.markets.home_over_15?.accuracy}
                  total={proMarketStats?.markets.home_over_15?.total}
                />
                <MiniMarketCard 
                  label="Dep Üst 1.5" 
                  accuracy={proMarketStats?.markets.away_over_15?.accuracy}
                  total={proMarketStats?.markets.away_over_15?.total}
                />
              </div>
            </div>

            {/* Combo Bets */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">🎲 Kombine Bahisler</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <MiniMarketCard 
                  label="1 & Üst 1.5" 
                  accuracy={proMarketStats?.markets.home_and_over_15?.accuracy}
                  total={proMarketStats?.markets.home_and_over_15?.total}
                />
                <MiniMarketCard 
                  label="2 & Üst 1.5" 
                  accuracy={proMarketStats?.markets.away_and_over_15?.accuracy}
                  total={proMarketStats?.markets.away_and_over_15?.total}
                />
                <MiniMarketCard 
                  label="X & Alt 2.5" 
                  accuracy={proMarketStats?.markets.draw_and_under_25?.accuracy}
                  total={proMarketStats?.markets.draw_and_under_25?.total}
                />
                <MiniMarketCard 
                  label="BTTS & Üst 2.5" 
                  accuracy={proMarketStats?.markets.btts_and_over_25?.accuracy}
                  total={proMarketStats?.markets.btts_and_over_25?.total}
                />
              </div>
            </div>

            {/* Safe Bets Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">🛡️ Safe Bet 1 Performansı</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toplam:</span>
                    <span className="text-white font-medium">{proMarketStats?.markets.safe_bet_1?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Doğru:</span>
                    <span className="text-white font-medium">{proMarketStats?.markets.safe_bet_1?.correct || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Başarı:</span>
                    <span className="text-green-400 font-bold text-xl">%{proMarketStats?.markets.safe_bet_1?.accuracy || '0'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-blue-400 mb-4">🛡️ Safe Bet 2 Performansı</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toplam:</span>
                    <span className="text-white font-medium">{proMarketStats?.markets.safe_bet_2?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Doğru:</span>
                    <span className="text-white font-medium">{proMarketStats?.markets.safe_bet_2?.correct || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Başarı:</span>
                    <span className="text-blue-400 font-bold text-xl">%{proMarketStats?.markets.safe_bet_2?.accuracy || '0'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Pro Predictions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📋 Son Analizler</h3>
              <div className="space-y-3">
                {proMarketStats?.recent && proMarketStats.recent.length > 0 ? (
                  proMarketStats.recent.slice(0, 10).map((pred: any) => (
                    <ProPredictionRow key={pred.id} prediction={pred} />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Henüz analiz yok
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MarketCard({ title, emoji, total, correct, accuracy, color }: {
  title: string;
  emoji: string;
  total: number;
  correct: number;
  accuracy: string;
  color: string;
}) {
  const colors: Record<string, { bg: string; text: string; bar: string }> = {
    emerald: { bg: 'from-emerald-500/20 to-emerald-600/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    blue: { bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-400', bar: 'bg-blue-500' },
    purple: { bg: 'from-purple-500/20 to-purple-600/20', text: 'text-purple-400', bar: 'bg-purple-500' },
  };

  const c = colors[color];
  const acc = parseFloat(accuracy);

  return (
    <div className={`bg-gradient-to-br ${c.bg} border border-gray-700 rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h3>
        <span className={`text-2xl font-bold ${c.text}`}>%{accuracy}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${c.bar}`} style={{ width: `${acc}%` }} />
      </div>
      <p className="text-gray-400 text-sm">{correct}/{total} doğru</p>
    </div>
  );
}

function AccuracyBadge({ accuracy, large }: { accuracy: number; large?: boolean }) {
  const color = accuracy >= 60 ? 'bg-green-500/20 text-green-400' :
                accuracy >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400';
  
  return (
    <span className={`inline-block px-2 py-1 rounded-lg font-medium ${color} ${large ? 'text-lg' : 'text-sm'}`}>
      %{accuracy.toFixed(1)}
    </span>
  );
}

function ProMarketCard({ market, stats }: { 
  market: string; 
  stats: { total: number; correct: number; accuracy: string; avgConfidence: string } 
}) {
  const marketNames: Record<string, string> = {
    match_result: 'Maç Sonucu',
    over_under_25: 'Üst/Alt 2.5',
    over_under_15: 'Üst/Alt 1.5',
    over_under_35: 'Üst/Alt 3.5',
    btts: 'KG Var/Yok',
    fh_result: 'İY Sonucu',
    fh_over_05: 'İY Üst 0.5',
    fh_over_15: 'İY Üst 1.5',
    fh_btts: 'İY BTTS',
    htft: 'HT/FT',
    asian_hc: 'Asian Handicap',
    first_goal: 'İlk Gol',
    home_over_05: 'Ev Üst 0.5',
    away_over_05: 'Dep Üst 0.5',
    home_over_15: 'Ev Üst 1.5',
    away_over_15: 'Dep Üst 1.5',
    home_and_over_15: '1 & Üst 1.5',
    away_and_over_15: '2 & Üst 1.5',
    draw_and_under_25: 'X & Alt 2.5',
    btts_and_over_25: 'BTTS & Üst 2.5',
    corners: 'Korner',
    cards: 'Kart',
    safe_bet_1: 'Safe Bet 1',
    safe_bet_2: 'Safe Bet 2',
  };

  const acc = parseFloat(stats.accuracy);
  const color = acc >= 60 ? 'green' : acc >= 50 ? 'yellow' : 'red';
  const colorClasses = {
    green: 'border-green-500/30 bg-green-500/10',
    yellow: 'border-yellow-500/30 bg-yellow-500/10',
    red: 'border-red-500/30 bg-red-500/10'
  };
  const textColors = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400'
  };

  return (
    <div className={`border rounded-xl p-4 ${colorClasses[color]}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-white font-medium">{marketNames[market] || market}</h4>
        <span className={`text-xl font-bold ${textColors[color]}`}>%{stats.accuracy}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-400">
        <span>{stats.correct}/{stats.total} doğru</span>
        <span>~%{stats.avgConfidence} güven</span>
      </div>
    </div>
  );
}

function MiniMarketCard({ label, accuracy, total }: { label: string; accuracy?: string; total?: number }) {
  const acc = parseFloat(accuracy || '0');
  const color = !total ? 'gray' : acc >= 60 ? 'green' : acc >= 50 ? 'yellow' : 'red';
  const textColors = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    gray: 'text-gray-500'
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${textColors[color]}`}>
        {total ? `%${accuracy}` : '-'}
      </p>
      {total !== undefined && total > 0 && (
        <p className="text-xs text-gray-500">{total} tahmin</p>
      )}
    </div>
  );
}

function ProPredictionRow({ prediction }: { prediction: any }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
      <div className="flex-1">
        <p className="text-white font-medium text-sm">
          {prediction.home_team} vs {prediction.away_team}
        </p>
        <p className="text-gray-400 text-xs">{prediction.league}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Match Result */}
        <div className="text-center">
          <p className="text-xs text-gray-400">MS</p>
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${
            prediction.match_result?.correct === true ? 'bg-green-500/20 text-green-400' :
            prediction.match_result?.correct === false ? 'bg-red-500/20 text-red-400' :
            'bg-gray-600/50 text-gray-400'
          }`}>
            {prediction.match_result?.selection || '-'}
          </span>
        </div>
        {/* Over/Under */}
        <div className="text-center">
          <p className="text-xs text-gray-400">Ü/A</p>
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${
            prediction.over_under_25?.correct === true ? 'bg-green-500/20 text-green-400' :
            prediction.over_under_25?.correct === false ? 'bg-red-500/20 text-red-400' :
            'bg-gray-600/50 text-gray-400'
          }`}>
            {prediction.over_under_25?.selection?.replace('Over ', 'Ü').replace('Under ', 'A') || '-'}
          </span>
        </div>
        {/* BTTS */}
        <div className="text-center">
          <p className="text-xs text-gray-400">KG</p>
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${
            prediction.btts?.correct === true ? 'bg-green-500/20 text-green-400' :
            prediction.btts?.correct === false ? 'bg-red-500/20 text-red-400' :
            'bg-gray-600/50 text-gray-400'
          }`}>
            {prediction.btts?.selection?.replace('Yes', 'V').replace('No', 'Y') || '-'}
          </span>
        </div>
        {/* Score */}
        <div className="text-center min-w-[40px]">
          <p className="text-xs text-gray-400">Skor</p>
          <span className="text-white text-xs">
            {prediction.is_settled ? `${prediction.actual_home_score}-${prediction.actual_away_score}` : '?'}
          </span>
        </div>
        {/* Status */}
        <span className={`px-2 py-0.5 rounded text-xs ${
          prediction.is_settled ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {prediction.is_settled ? '✓' : '⏳'}
        </span>
      </div>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              prediction.is_settled 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {prediction.is_settled ? 'Sonuçlandı' : 'Bekliyor'}
            </span>
            <div>
              <p className="text-white font-medium">
                {prediction.home_team} vs {prediction.away_team}
              </p>
              <p className="text-gray-400 text-sm">{prediction.league}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-2 py-1 rounded text-xs ${
              prediction.prediction_source === 'quad_brain' 
                ? 'bg-purple-500/20 text-purple-400'
                : prediction.prediction_source === 'ai_agents'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {prediction.prediction_source}
            </span>
            <span className="text-gray-400 text-sm">
              {new Date(prediction.created_at).toLocaleDateString('tr-TR')}
            </span>
            <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-4 bg-gray-900/50">
          <div className="grid md:grid-cols-3 gap-4">
            {/* BTTS */}
            <div className={`p-3 rounded-lg ${
              prediction.is_settled
                ? prediction.btts_correct ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                : 'bg-gray-700/50'
            }`}>
              <p className="text-gray-400 text-sm">KG Var/Yok</p>
              <p className="text-white font-medium">
                {prediction.consensus_btts?.toUpperCase() || '-'} 
                <span className="text-gray-400 text-sm ml-1">({prediction.consensus_btts_confidence}%)</span>
              </p>
              {prediction.is_settled && (
                <p className={`text-sm ${prediction.btts_correct ? 'text-green-400' : 'text-red-400'}`}>
                  {prediction.btts_correct ? '✅ Doğru' : '❌ Yanlış'}
                </p>
              )}
            </div>

            {/* Over/Under */}
            <div className={`p-3 rounded-lg ${
              prediction.is_settled
                ? prediction.over_under_correct ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                : 'bg-gray-700/50'
            }`}>
              <p className="text-gray-400 text-sm">Üst/Alt 2.5</p>
              <p className="text-white font-medium">
                {prediction.consensus_over_under?.toUpperCase() || '-'}
                <span className="text-gray-400 text-sm ml-1">({prediction.consensus_over_under_confidence}%)</span>
              </p>
              {prediction.is_settled && (
                <p className={`text-sm ${prediction.over_under_correct ? 'text-green-400' : 'text-red-400'}`}>
                  {prediction.over_under_correct ? '✅ Doğru' : '❌ Yanlış'}
                </p>
              )}
            </div>

            {/* Match Result */}
            <div className={`p-3 rounded-lg ${
              prediction.is_settled
                ? prediction.match_result_correct ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                : 'bg-gray-700/50'
            }`}>
              <p className="text-gray-400 text-sm">Maç Sonucu</p>
              <p className="text-white font-medium">
                {prediction.consensus_match_result?.toUpperCase() || '-'}
                <span className="text-gray-400 text-sm ml-1">({prediction.consensus_match_result_confidence}%)</span>
              </p>
              {prediction.is_settled && (
                <p className={`text-sm ${prediction.match_result_correct ? 'text-green-400' : 'text-red-400'}`}>
                  {prediction.match_result_correct ? '✅ Doğru' : '❌ Yanlış'}
                </p>
              )}
            </div>
          </div>

          {prediction.is_settled && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                Skor: <span className="text-white font-medium">{prediction.actual_home_score} - {prediction.actual_away_score}</span>
              </p>
            </div>
          )}

          {/* Individual Model Predictions */}
          {prediction.ai_model_predictions && prediction.ai_model_predictions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-gray-400 text-sm mb-2">Model Tahminleri:</p>
              <div className="flex flex-wrap gap-2">
                {prediction.ai_model_predictions.map((mp: any, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                    {mp.model_name}: {mp.match_result_prediction || '-'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
