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
  
  const [activeTab, setActiveTab] = useState<'overview' | 'deepseek_master' | 'system_analyses' | 'models' | 'predictions' | 'analytics'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [masterAnalyses, setMasterAnalyses] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
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
      
      // Fetch all stats in parallel
      const [res, proMarketRes, masterRes] = await Promise.all([
        fetch(`/api/admin/enhanced-stats?type=all&limit=100&_t=${timestamp}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch(`/api/admin/professional-markets?_t=${timestamp}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch(`/api/admin/deepseek-master?limit=50&_t=${timestamp}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
      ]);
      
      const data = await res.json();
      const proMarketData = await proMarketRes.json();
      const masterData = await masterRes.json();
      
      // Set DeepSeek Master data
      if (masterData.success) {
        setMasterAnalyses(masterData.recent || []);
        console.log('🎯 DeepSeek Master analyses:', masterData.recent?.length || 0);
      }
      
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
    setLastChecked(new Date());
    setRefreshing(false);
  };

  // Check/Sync all data from database
  const handleCheckData = async () => {
    setChecking(true);
    try {
      console.log('🔍 Checking all data from database...');
      
      // Force fresh data fetch
      const timestamp = Date.now();
      const res = await fetch(`/api/admin/enhanced-stats?type=all&limit=200&_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      const data = await res.json();
      
      if (data.success) {
        const recentData = data.recent || [];
        
        // Calculate overall from recent
        if (recentData.length > 0) {
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
        }
        
        setModels(data.models || []);
        setPredictions(recentData);
        setLastChecked(new Date());
        
        console.log(`✅ Data synced: ${recentData.length} predictions, ${data.models?.length || 0} models`);
        alert(`✅ Veriler güncellendi!\n\n📊 Toplam: ${recentData.length} tahmin\n🤖 Model: ${data.models?.length || 0} AI modeli`);
      } else {
        alert('❌ Veri çekme hatası');
      }
    } catch (error) {
      console.error('Check data error:', error);
      alert('❌ Veri kontrol hatası');
    } finally {
      setChecking(false);
    }
  };

  // Auto-refresh every hour
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh triggered (1 hour)');
      handleCheckData();
    }, 60 * 60 * 1000); // 1 hour
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Settle results - calls sync-predictions API
  const handleSettle = async () => {
    setSettling(true);
    try {
      // First try the new sync-predictions endpoint
      const syncRes = await fetch('/api/cron/sync-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const syncData = await syncRes.json();
      
      // Also call settle-admin-predictions for backward compatibility
      const settleRes = await fetch('/api/cron/settle-admin-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const settleData = await settleRes.json();
      
      const totalSettled = (syncData.settled || 0) + (settleData.settled || 0);
      
      if (syncData.success || settleData.success) {
        alert(`✅ Sonuçlar güncellendi!\n\n📊 Sync: ${syncData.settled || 0} maç\n⚡ Settle: ${settleData.settled || 0} tahmin\n⏳ Bekleyen: ${syncData.skipped || 0}`);
        await fetchData();
        setLastChecked(new Date());
      } else {
        alert(`❌ Hata: ${syncData.error || settleData.error || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      console.error('Settle error:', error);
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
            <div className="flex items-center gap-2 flex-wrap">
              {/* Last Checked Time */}
              {lastChecked && (
                <span className="text-xs text-gray-500 hidden sm:block">
                  Son: {lastChecked.toLocaleTimeString('tr-TR')}
                </span>
              )}
              
              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
                  autoRefresh 
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                    : 'bg-gray-700/50 text-gray-400 hover:text-white'
                }`}
                title={autoRefresh ? 'Otomatik yenileme aktif (1 saat)' : 'Otomatik yenilemeyi aç'}
              >
                <span className={autoRefresh ? 'animate-pulse' : ''}>⏰</span>
                <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Auto'}</span>
              </button>
              
              {/* Check Data Button */}
              <button
                onClick={handleCheckData}
                disabled={checking}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <span className={checking ? 'animate-spin' : ''}>🔍</span>
                <span className="hidden sm:inline">Verileri Kontrol Et</span>
                <span className="sm:hidden">Check</span>
              </button>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                <span className="hidden sm:inline">Yenile</span>
              </button>
              
              {/* Settle Results Button */}
              <button
                onClick={handleSettle}
                disabled={settling}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <span className={settling ? 'animate-spin' : ''}>⚡</span>
                <span className="hidden sm:inline">Sonuçları Güncelle</span>
                <span className="sm:hidden">Settle</span>
              </button>
              
              {/* Auto-Analyze Button */}
              <button
                onClick={async () => {
                  const btn = document.activeElement as HTMLButtonElement;
                  btn.disabled = true;
                  btn.innerHTML = '<span class="animate-spin">🤖</span> Analyzing...';
                  try {
                    const res = await fetch('/api/cron/auto-analyze-matches', { method: 'POST' });
                    const data = await res.json();
                    alert(`🤖 Otomatik Analiz Tamamlandı!\n\n✅ Analiz Edilen: ${data.analyzed || 0} maç\n❌ Hata: ${data.errors || 0}\n⏱️ Süre: ${Math.round((data.duration || 0) / 1000)}s`);
                    await fetchData();
                  } catch (e) {
                    alert('Hata: ' + e);
                  } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<span>🤖</span> Auto-Analyze';
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white rounded-lg flex items-center gap-2"
              >
                <span>🤖</span>
                <span className="hidden sm:inline">Auto-Analyze</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {[
              { id: 'overview', label: '📊 Genel Bakış', icon: '📊' },
              { id: 'deepseek_master', label: '🎯 DeepSeek Master', icon: '🎯' },
              { id: 'system_analyses', label: '🔬 Sistem Analizleri', icon: '🔬' },
              { id: 'models', label: '🤖 AI Modelleri', icon: '🤖' },
              { id: 'predictions', label: '📝 Tahminler', icon: '📝' },
              { id: 'analytics', label: '📈 Analitik', icon: '📈' },
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

        {/* DEEPSEEK MASTER TAB */}
        {activeTab === 'deepseek_master' && (
          <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🎯</span>
                  <span className="text-gray-400 text-sm">Toplam Analiz</span>
                </div>
                <p className="text-3xl font-bold text-white">{masterAnalyses.length}</p>
              </div>
              <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <span className="text-gray-400 text-sm">Sonuçlanan</span>
                </div>
                <p className="text-3xl font-bold text-green-400">{masterAnalyses.filter(m => m.is_settled).length}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⏳</span>
                  <span className="text-gray-400 text-sm">Bekleyen</span>
                </div>
                <p className="text-3xl font-bold text-yellow-400">{masterAnalyses.filter(m => !m.is_settled).length}</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📊</span>
                  <span className="text-gray-400 text-sm">Ort. Güven</span>
                </div>
                <p className="text-3xl font-bold text-cyan-400">
                  %{masterAnalyses.length > 0 
                    ? Math.round(masterAnalyses.reduce((sum, m) => sum + (m.master?.confidence || 0), 0) / masterAnalyses.length)
                    : 0}
                </p>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>⚠️</span> Risk Dağılımı
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-3xl font-bold text-green-400">
                    {masterAnalyses.filter(m => m.master?.riskLevel === 'low').length}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Düşük Risk</p>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-3xl font-bold text-yellow-400">
                    {masterAnalyses.filter(m => m.master?.riskLevel === 'medium').length}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Orta Risk</p>
                </div>
                <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-3xl font-bold text-red-400">
                    {masterAnalyses.filter(m => m.master?.riskLevel === 'high').length}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Yüksek Risk</p>
                </div>
              </div>
            </div>

            {/* Recent Master Analyses - FULL DETAILS */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🎯</span> DeepSeek Master Analizleri (Tam Detay)
                </h3>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full">
                  {masterAnalyses.length} analiz
                </span>
              </div>
              
              <div className="divide-y divide-gray-700/50 max-h-[800px] overflow-y-auto">
                {masterAnalyses.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <span className="text-4xl mb-4 block">🎯</span>
                    <p>Henüz DeepSeek Master analizi yok</p>
                    <p className="text-sm mt-2">Dashboard&apos;dan Tam Analiz butonuna basarak analiz başlatın</p>
                  </div>
                ) : (
                  masterAnalyses.map((analysis) => (
                    <div key={analysis.id} className="p-4 hover:bg-gray-700/30 transition-colors space-y-4">
                      {/* Match Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xl font-bold text-white">
                            {analysis.home_team} vs {analysis.away_team}
                          </p>
                          <p className="text-sm text-gray-400">{analysis.league}</p>
                          <p className="text-xs text-gray-500">{new Date(analysis.match_date).toLocaleDateString('tr-TR', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {analysis.is_settled && (
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-bold rounded-lg">
                              ⚽ {analysis.actual_score}
                            </span>
                          )}
                          <span className={`px-3 py-1 text-sm font-bold rounded-lg ${
                            analysis.master?.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                            analysis.master?.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {analysis.master?.riskLevel === 'low' ? '🟢 Düşük' :
                             analysis.master?.riskLevel === 'medium' ? '🟡 Orta' :
                             '🔴 Yüksek'} Risk
                          </span>
                        </div>
                      </div>

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* DEEPSEEK'İN KENDİ ANALİZİ */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {analysis.myAnalysis && (
                        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                            <span>🧠</span> DeepSeek Master Kendi Analizi
                          </h4>
                          
                          {/* Team Analysis */}
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            {/* Home Team */}
                            {analysis.myAnalysis.homeTeam && (
                              <div className="bg-gray-800/50 rounded-lg p-3">
                                <p className="font-bold text-white mb-2">🏠 {analysis.myAnalysis.homeTeam.name}</p>
                                <p className="text-xs text-gray-300 mb-2">{analysis.myAnalysis.homeTeam.form}</p>
                                {analysis.myAnalysis.homeTeam.strengths?.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs text-green-400 font-medium">💪 Güçlü Yönler:</p>
                                    <ul className="text-xs text-gray-400 list-disc list-inside">
                                      {analysis.myAnalysis.homeTeam.strengths.map((s: string, i: number) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {analysis.myAnalysis.homeTeam.weaknesses?.length > 0 && (
                                  <div>
                                    <p className="text-xs text-red-400 font-medium">⚠️ Zayıf Yönler:</p>
                                    <ul className="text-xs text-gray-400 list-disc list-inside">
                                      {analysis.myAnalysis.homeTeam.weaknesses.map((w: string, i: number) => (
                                        <li key={i}>{w}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Away Team */}
                            {analysis.myAnalysis.awayTeam && (
                              <div className="bg-gray-800/50 rounded-lg p-3">
                                <p className="font-bold text-white mb-2">✈️ {analysis.myAnalysis.awayTeam.name}</p>
                                <p className="text-xs text-gray-300 mb-2">{analysis.myAnalysis.awayTeam.form}</p>
                                {analysis.myAnalysis.awayTeam.strengths?.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs text-green-400 font-medium">💪 Güçlü Yönler:</p>
                                    <ul className="text-xs text-gray-400 list-disc list-inside">
                                      {analysis.myAnalysis.awayTeam.strengths.map((s: string, i: number) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {analysis.myAnalysis.awayTeam.weaknesses?.length > 0 && (
                                  <div>
                                    <p className="text-xs text-red-400 font-medium">⚠️ Zayıf Yönler:</p>
                                    <ul className="text-xs text-gray-400 list-disc list-inside">
                                      {analysis.myAnalysis.awayTeam.weaknesses.map((w: string, i: number) => (
                                        <li key={i}>{w}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Key Factors */}
                          {analysis.myAnalysis.keyFactors?.length > 0 && (
                            <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                              <p className="text-xs text-cyan-400 font-medium mb-2">🔑 Anahtar Faktörler:</p>
                              <ul className="text-xs text-gray-300 space-y-1">
                                {analysis.myAnalysis.keyFactors.map((f: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-cyan-500">•</span> {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* DeepSeek's Own Prediction */}
                          {analysis.myAnalysis.myPrediction && (
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-gray-700/50 rounded-lg p-2">
                                <p className="text-xs text-gray-400">BTTS</p>
                                <p className="font-bold text-purple-400">{String(analysis.myAnalysis.myPrediction.btts).toUpperCase()}</p>
                              </div>
                              <div className="bg-gray-700/50 rounded-lg p-2">
                                <p className="text-xs text-gray-400">Ü/A 2.5</p>
                                <p className="font-bold text-purple-400">{String(analysis.myAnalysis.myPrediction.overUnder).toUpperCase()}</p>
                              </div>
                              <div className="bg-gray-700/50 rounded-lg p-2">
                                <p className="text-xs text-gray-400">Maç Sonucu</p>
                                <p className="font-bold text-purple-400">{String(analysis.myAnalysis.myPrediction.matchResult).toUpperCase()}</p>
                              </div>
                              <div className="bg-gray-700/50 rounded-lg p-2">
                                <p className="text-xs text-gray-400">Skor Tahmini</p>
                                <p className="font-bold text-purple-400">{analysis.myAnalysis.myPrediction.scorePrediction || '-'}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* 3 SİSTEM KARŞILAŞTIRMASI */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span>⚔️</span> 3 Sistem Karşılaştırması
                        </h4>
                        
                        <div className="grid md:grid-cols-3 gap-3">
                          {/* AI Consensus */}
                          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-3">
                            <p className="text-xs font-bold text-blue-400 mb-2">🤖 AI Consensus</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">BTTS:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.ai_consensus?.btts?.prediction || analysis.systems?.ai_consensus?.consensus?.btts?.prediction || '-').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Ü/A 2.5:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.ai_consensus?.overUnder?.prediction || analysis.systems?.ai_consensus?.consensus?.overUnder?.prediction || '-').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">MS:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.ai_consensus?.matchResult?.prediction || analysis.systems?.ai_consensus?.consensus?.matchResult?.prediction || '-').toUpperCase()}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Quad-Brain */}
                          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-400 mb-2">🧠 Quad-Brain</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">BTTS:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.quad_brain?.btts?.prediction || analysis.systems?.quad_brain?.consensus?.btts?.prediction || '-').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Ü/A 2.5:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.quad_brain?.overUnder?.prediction || analysis.systems?.quad_brain?.consensus?.overUnder?.prediction || '-').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">MS:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.quad_brain?.matchResult?.prediction || analysis.systems?.quad_brain?.consensus?.matchResult?.prediction || '-').toUpperCase()}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* AI Agents */}
                          <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-500/30 rounded-lg p-3">
                            <p className="text-xs font-bold text-orange-400 mb-2">🔮 AI Agents</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">BTTS:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.ai_agents?.btts?.prediction || analysis.systems?.ai_agents?.consensus?.btts?.prediction || '-').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Ü/A 2.5:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.ai_agents?.overUnder?.prediction || analysis.systems?.ai_agents?.consensus?.overUnder?.prediction || '-').toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">MS:</span>
                                <span className="text-white font-medium">{String(analysis.systems?.ai_agents?.matchResult?.prediction || analysis.systems?.ai_agents?.consensus?.matchResult?.prediction || '-').toUpperCase()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* SİSTEM DEĞERLENDİRMESİ */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {analysis.systemEvaluation && (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span>📊</span> DeepSeek Sistem Değerlendirmesi
                          </h4>
                          <div className="space-y-2 text-sm">
                            {analysis.systemEvaluation.agreement && (
                              <p className="text-gray-300">
                                <span className="text-cyan-400 font-medium">Uyum:</span> {analysis.systemEvaluation.agreement}
                              </p>
                            )}
                            {analysis.systemEvaluation.mostReliable && (
                              <p className="text-gray-300">
                                <span className="text-green-400 font-medium">En Güvenilir:</span> {analysis.systemEvaluation.mostReliable}
                              </p>
                            )}
                            {analysis.systemEvaluation.conflicts && (
                              <p className="text-gray-300">
                                <span className="text-yellow-400 font-medium">Çelişkiler:</span> {analysis.systemEvaluation.conflicts}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* FİNAL VERDİKT */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      <div className="bg-gradient-to-br from-red-900/30 via-orange-900/30 to-yellow-900/30 border border-orange-500/40 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                          <span>🎯</span> MASTER FİNAL VERDİKT
                        </h4>
                        
                        {/* Final Predictions with Details */}
                        <div className="grid md:grid-cols-3 gap-3 mb-4">
                          <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400 mb-1">BTTS</p>
                            <p className="text-2xl font-bold text-white">{analysis.master?.btts?.prediction?.toUpperCase() || '-'}</p>
                            <p className="text-sm text-cyan-400">%{analysis.master?.btts?.confidence || 0}</p>
                            {analysis.master?.btts?.reasoning && (
                              <p className="text-xs text-gray-400 mt-2 text-left">{analysis.master.btts.reasoning}</p>
                            )}
                          </div>
                          <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400 mb-1">Ü/A 2.5</p>
                            <p className="text-2xl font-bold text-white">{analysis.master?.overUnder?.prediction?.toUpperCase() || '-'}</p>
                            <p className="text-sm text-cyan-400">%{analysis.master?.overUnder?.confidence || 0}</p>
                            {analysis.master?.overUnder?.reasoning && (
                              <p className="text-xs text-gray-400 mt-2 text-left">{analysis.master.overUnder.reasoning}</p>
                            )}
                          </div>
                          <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400 mb-1">Maç Sonucu</p>
                            <p className="text-2xl font-bold text-white">{analysis.master?.matchResult?.prediction?.toUpperCase() || '-'}</p>
                            <p className="text-sm text-cyan-400">%{analysis.master?.matchResult?.confidence || 0}</p>
                            {analysis.master?.matchResult?.reasoning && (
                              <p className="text-xs text-gray-400 mt-2 text-left">{analysis.master.matchResult.reasoning}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* System Agreement */}
                        {analysis.master?.systemAgreement && (
                          <div className="flex items-center gap-4 text-sm mb-3 justify-center">
                            <span className="text-gray-400">Sistem Uyumu:</span>
                            <span className={`px-2 py-1 rounded ${analysis.master.systemAgreement.btts >= 2 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              BTTS: {analysis.master.systemAgreement.btts}/3
                            </span>
                            <span className={`px-2 py-1 rounded ${analysis.master.systemAgreement.overUnder >= 2 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              Ü/A: {analysis.master.systemAgreement.overUnder}/3
                            </span>
                            <span className={`px-2 py-1 rounded ${analysis.master.systemAgreement.matchResult >= 2 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              MS: {analysis.master.systemAgreement.matchResult}/3
                            </span>
                          </div>
                        )}
                        
                        {/* Master Analysis Text */}
                        {analysis.master?.masterAnalysis && (
                          <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                            <p className="text-sm text-gray-300 italic">&ldquo;{analysis.master.masterAnalysis}&rdquo;</p>
                          </div>
                        )}
                      </div>

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* EN İYİ BAHİS */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {analysis.master?.bestBet && (
                        <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-2 border-purple-500/50 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">🎯 EN İYİ BAHİS ÖNERİSİ</p>
                              <p className="text-xl font-bold text-white">
                                {analysis.master.bestBet.market}: <span className="text-purple-400">{analysis.master.bestBet.selection}</span>
                              </p>
                              {analysis.master.bestBet.reasoning && (
                                <p className="text-sm text-gray-300 mt-2">{analysis.master.bestBet.reasoning}</p>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="text-3xl font-bold text-purple-400">%{analysis.master.bestBet.confidence}</p>
                              <p className="text-xs text-gray-400">Güven</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Warnings */}
                      {analysis.master?.warnings && analysis.master.warnings.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                          <p className="text-xs text-yellow-400 font-medium mb-1">⚠️ Uyarılar:</p>
                          <ul className="text-xs text-yellow-300 space-y-1">
                            {analysis.master.warnings.map((w: string, i: number) => (
                              <li key={i}>• {w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM ANALYSES TAB - AI Consensus, Quad-Brain, AI Agents Details */}
        {activeTab === 'system_analyses' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600/20 via-green-600/20 to-orange-600/20 border border-gray-700 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-2">🔬 Sistem Analizleri Detay</h2>
              <p className="text-gray-400">AI Consensus, Quad-Brain ve AI Agents sistemlerinin tam analizleri</p>
            </div>

            {/* System Stats Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border border-blue-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🤖</span>
                  <div>
                    <p className="text-lg font-bold text-blue-400">AI Consensus</p>
                    <p className="text-sm text-gray-400">Claude + GPT-4 + Gemini</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{masterAnalyses.filter(m => m.systems?.ai_consensus).length} analiz</p>
              </div>
              <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🧠</span>
                  <div>
                    <p className="text-lg font-bold text-green-400">Quad-Brain</p>
                    <p className="text-sm text-gray-400">4 Model Ağırlıklı</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{masterAnalyses.filter(m => m.systems?.quad_brain).length} analiz</p>
              </div>
              <div className="bg-gradient-to-br from-orange-900/40 to-amber-900/40 border border-orange-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🔮</span>
                  <div>
                    <p className="text-lg font-bold text-orange-400">AI Agents</p>
                    <p className="text-sm text-gray-400">5 Uzman Ajan</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{masterAnalyses.filter(m => m.systems?.ai_agents).length} analiz</p>
              </div>
            </div>

            {/* Detailed Analyses List */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-bold text-white">📋 Maç Bazlı Sistem Analizleri</h3>
              </div>
              
              <div className="divide-y divide-gray-700/50 max-h-[800px] overflow-y-auto">
                {masterAnalyses.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <span className="text-4xl mb-4 block">🔬</span>
                    <p>Henüz sistem analizi yok</p>
                  </div>
                ) : (
                  masterAnalyses.map((analysis) => (
                    <div key={analysis.id} className="p-4 space-y-4">
                      {/* Match Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-white">{analysis.home_team} vs {analysis.away_team}</p>
                          <p className="text-sm text-gray-400">{analysis.league} • {new Date(analysis.match_date).toLocaleDateString('tr-TR')}</p>
                        </div>
                        {analysis.is_settled && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-bold rounded-lg">
                            ⚽ {analysis.actual_score}
                          </span>
                        )}
                      </div>

                      {/* 3 Systems Side by Side */}
                      <div className="grid lg:grid-cols-3 gap-4">
                        
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* AI CONSENSUS DETAIL */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                            <span>🤖</span> AI Consensus
                          </h4>
                          
                          {analysis.systems?.ai_consensus ? (
                            <div className="space-y-3">
                              {/* Consensus Predictions */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">BTTS</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.ai_consensus?.consensus?.btts?.prediction || analysis.systems.ai_consensus?.btts?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-cyan-400 ml-2">%{analysis.systems.ai_consensus?.consensus?.btts?.confidence || analysis.systems.ai_consensus?.btts?.confidence || 0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">Ü/A 2.5</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.ai_consensus?.consensus?.overUnder?.prediction || analysis.systems.ai_consensus?.overUnder?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-cyan-400 ml-2">%{analysis.systems.ai_consensus?.consensus?.overUnder?.confidence || analysis.systems.ai_consensus?.overUnder?.confidence || 0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">Maç Sonucu</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.ai_consensus?.consensus?.matchResult?.prediction || analysis.systems.ai_consensus?.matchResult?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-cyan-400 ml-2">%{analysis.systems.ai_consensus?.consensus?.matchResult?.confidence || analysis.systems.ai_consensus?.matchResult?.confidence || 0}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Individual Model Predictions - FIXED: Use individualPredictions structure */}
                              {analysis.systems.ai_consensus?.individualPredictions ? (
                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                  <p className="text-xs text-gray-400 mb-2">Model Tahminleri:</p>
                                  <div className="space-y-1">
                                    {Object.entries(analysis.systems.ai_consensus.individualPredictions).map(([model, pred]: [string, any]) => (
                                      <div key={model} className="flex justify-between text-xs">
                                        <span className="text-gray-300 capitalize">{model}</span>
                                        <span className="text-blue-300">
                                          BTTS: <span className="text-white font-medium">{pred?.btts?.prediction?.toUpperCase() || '-'}</span> <span className="text-cyan-400">%{pred?.btts?.confidence || 0}</span> | 
                                          O/U: <span className="text-white font-medium">{pred?.overUnder?.prediction?.toUpperCase() || '-'}</span> <span className="text-cyan-400">%{pred?.overUnder?.confidence || 0}</span> | 
                                          MS: <span className="text-white font-medium">{pred?.matchResult?.prediction?.toUpperCase() || '-'}</span> <span className="text-cyan-400">%{pred?.matchResult?.confidence || 0}</span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : analysis.systems.ai_consensus?.modelVotes ? (
                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                  <p className="text-xs text-gray-400 mb-2">Model Oyları:</p>
                                  <div className="space-y-1">
                                    {Object.entries(analysis.systems.ai_consensus.modelVotes).map(([model, votes]: [string, any]) => (
                                      <div key={model} className="flex justify-between text-xs">
                                        <span className="text-gray-300">{model}</span>
                                        <span className="text-blue-300">
                                          {votes?.btts?.prediction || '-'} | {votes?.overUnder?.prediction || '-'} | {votes?.matchResult?.prediction || '-'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              
                              {/* Reasoning */}
                              {(analysis.systems.ai_consensus?.reasoning || analysis.systems.ai_consensus?.consensus?.reasoning) && (
                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                  <p className="text-xs text-gray-400 mb-1">Gerekçe:</p>
                                  <p className="text-xs text-gray-300">{analysis.systems.ai_consensus.reasoning || analysis.systems.ai_consensus.consensus?.reasoning}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Veri yok</p>
                          )}
                        </div>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* QUAD-BRAIN DETAIL */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                            <span>🧠</span> Quad-Brain
                          </h4>
                          
                          {analysis.systems?.quad_brain ? (
                            <div className="space-y-3">
                              {/* Consensus Predictions */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">BTTS</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.quad_brain?.consensus?.btts?.prediction || analysis.systems.quad_brain?.btts?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-green-400 ml-2">%{analysis.systems.quad_brain?.consensus?.btts?.confidence || analysis.systems.quad_brain?.btts?.confidence || 0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">Ü/A 2.5</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.quad_brain?.consensus?.overUnder?.prediction || analysis.systems.quad_brain?.overUnder?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-green-400 ml-2">%{analysis.systems.quad_brain?.consensus?.overUnder?.confidence || analysis.systems.quad_brain?.overUnder?.confidence || 0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">Maç Sonucu</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.quad_brain?.consensus?.matchResult?.prediction || analysis.systems.quad_brain?.matchResult?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-green-400 ml-2">%{analysis.systems.quad_brain?.consensus?.matchResult?.confidence || analysis.systems.quad_brain?.matchResult?.confidence || 0}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Individual Model Predictions - FIXED: Show confidence values */}
                              {analysis.systems.quad_brain?.individualPredictions && (
                                <div className="mt-3 pt-3 border-t border-green-500/20">
                                  <p className="text-xs text-gray-400 mb-2">Model Tahminleri:</p>
                                  <div className="space-y-1">
                                    {Object.entries(analysis.systems.quad_brain.individualPredictions).map(([model, preds]: [string, any]) => (
                                      <div key={model} className="flex justify-between text-xs">
                                        <span className="text-gray-300 capitalize">{model}</span>
                                        <span className="text-green-300 text-right">
                                          BTTS: <span className="text-white font-medium">{preds?.btts?.prediction?.toUpperCase() || '-'}</span> <span className="text-green-400">%{preds?.btts?.confidence || 0}</span> | 
                                          O/U: <span className="text-white font-medium">{preds?.overUnder?.prediction?.toUpperCase() || '-'}</span> <span className="text-green-400">%{preds?.overUnder?.confidence || 0}</span> | 
                                          MS: <span className="text-white font-medium">{preds?.matchResult?.prediction?.toUpperCase() || '-'}</span> <span className="text-green-400">%{preds?.matchResult?.confidence || 0}</span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Weights if available */}
                              {analysis.systems.quad_brain?.weights && (
                                <div className="mt-3 pt-3 border-t border-green-500/20">
                                  <p className="text-xs text-gray-400 mb-1">Model Ağırlıkları:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(analysis.systems.quad_brain.weights).map(([model, weight]: [string, any]) => (
                                      <span key={model} className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                                        {model}: {typeof weight === 'number' ? weight.toFixed(2) : weight}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Veri yok</p>
                          )}
                        </div>

                        {/* ═══════════════════════════════════════════════════════════════ */}
                        {/* AI AGENTS DETAIL */}
                        {/* ═══════════════════════════════════════════════════════════════ */}
                        <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-500/30 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                            <span>🔮</span> AI Agents
                          </h4>
                          
                          {analysis.systems?.ai_agents ? (
                            <div className="space-y-3">
                              {/* Consensus/Final Predictions */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">BTTS</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.ai_agents?.consensus?.btts?.prediction || analysis.systems.ai_agents?.finalConsensus?.btts?.prediction || analysis.systems.ai_agents?.btts?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-orange-400 ml-2">%{analysis.systems.ai_agents?.consensus?.btts?.confidence || analysis.systems.ai_agents?.finalConsensus?.btts?.confidence || analysis.systems.ai_agents?.btts?.confidence || 0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">Ü/A 2.5</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.ai_agents?.consensus?.overUnder?.prediction || analysis.systems.ai_agents?.finalConsensus?.overUnder?.prediction || analysis.systems.ai_agents?.overUnder?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-orange-400 ml-2">%{analysis.systems.ai_agents?.consensus?.overUnder?.confidence || analysis.systems.ai_agents?.finalConsensus?.overUnder?.confidence || analysis.systems.ai_agents?.overUnder?.confidence || 0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                                  <span className="text-xs text-gray-400">Maç Sonucu</span>
                                  <div className="text-right">
                                    <span className="font-bold text-white">{String(analysis.systems.ai_agents?.consensus?.matchResult?.prediction || analysis.systems.ai_agents?.finalConsensus?.matchResult?.prediction || analysis.systems.ai_agents?.matchResult?.prediction || '-').toUpperCase()}</span>
                                    <span className="text-xs text-orange-400 ml-2">%{analysis.systems.ai_agents?.consensus?.matchResult?.confidence || analysis.systems.ai_agents?.finalConsensus?.matchResult?.confidence || analysis.systems.ai_agents?.matchResult?.confidence || 0}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Individual Agent Predictions - FIXED: Use individualPredictions structure */}
                              {analysis.systems.ai_agents?.individualPredictions ? (
                                <div className="mt-3 pt-3 border-t border-orange-500/20">
                                  <p className="text-xs text-gray-400 mb-2">Ajan Tahminleri:</p>
                                  <div className="space-y-1.5">
                                    {Object.entries(analysis.systems.ai_agents.individualPredictions).map(([agentName, pred]: [string, any]) => (
                                      <div key={agentName} className="p-2 bg-gray-800/50 rounded">
                                        <p className="text-xs font-medium text-orange-300 mb-1 capitalize">{agentName.replace(/_/g, ' ')}</p>
                                        <div className="flex gap-2 text-xs">
                                          <span className="text-gray-400">BTTS: <span className="text-white font-medium">{pred?.btts?.prediction?.toUpperCase() || '-'}</span> <span className="text-orange-400">%{pred?.btts?.confidence || 0}</span></span>
                                          <span className="text-gray-400">Ü/A: <span className="text-white font-medium">{pred?.overUnder?.prediction?.toUpperCase() || '-'}</span> <span className="text-orange-400">%{pred?.overUnder?.confidence || 0}</span></span>
                                          <span className="text-gray-400">MS: <span className="text-white font-medium">{pred?.matchResult?.prediction?.toUpperCase() || '-'}</span> <span className="text-orange-400">%{pred?.matchResult?.confidence || 0}</span></span>
                                        </div>
                                        {pred?.btts?.reasoning && (
                                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{pred.btts.reasoning}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : analysis.systems.ai_agents?.agentReports ? (
                                <div className="mt-3 pt-3 border-t border-orange-500/20">
                                  <p className="text-xs text-gray-400 mb-2">Ajan Raporları:</p>
                                  <div className="space-y-2">
                                    {analysis.systems.ai_agents.agentReports.map((agent: any, i: number) => (
                                      <div key={i} className="p-2 bg-gray-800/50 rounded">
                                        <p className="text-xs font-medium text-orange-300 mb-1">{agent.agentName || agent.name || `Ajan ${i+1}`}</p>
                                        <div className="flex gap-2 text-xs">
                                          <span className="text-gray-400">BTTS: <span className="text-white">{agent.predictions?.btts?.prediction || '-'}</span></span>
                                          <span className="text-gray-400">Ü/A: <span className="text-white">{agent.predictions?.overUnder?.prediction || '-'}</span></span>
                                          <span className="text-gray-400">MS: <span className="text-white">{agent.predictions?.matchResult?.prediction || '-'}</span></span>
                                        </div>
                                        {agent.reasoning && (
                                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{agent.reasoning}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              
                              {/* Professional Markets if available */}
                              {analysis.systems.ai_agents?.professionalMarkets && (
                                <div className="mt-3 pt-3 border-t border-orange-500/20">
                                  <p className="text-xs text-gray-400 mb-1">Pro Marketler:</p>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    {Object.entries(analysis.systems.ai_agents.professionalMarkets).slice(0, 6).map(([market, data]: [string, any]) => (
                                      <div key={market} className="flex justify-between">
                                        <span className="text-gray-400">{market}:</span>
                                        <span className="text-orange-300">{data?.prediction || '-'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Veri yok</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODELS TAB */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            {/* Model Cards Grid */}
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

            {/* Model Son Tahminler Table */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                📋 Model Tahmin Geçmişi
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-3 text-gray-400 font-medium">Maç</th>
                      <th className="text-center py-3 px-3 text-gray-400 font-medium">Tarih</th>
                      {models.slice(0, 5).map(m => {
                        const key = m.model_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                        const config = AI_MODELS[key] || AI_MODELS[m.model_name.toLowerCase()] || { icon: '🤖' };
                        return (
                          <th key={m.model_name} className="text-center py-3 px-2 text-gray-400 font-medium">
                            <span title={m.model_name}>{config.icon}</span>
                          </th>
                        );
                      })}
                      <th className="text-center py-3 px-3 text-gray-400 font-medium">Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.filter(p => p.is_settled).slice(0, 10).map(pred => (
                      <tr key={pred.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 px-3">
                          <p className="text-white text-sm">{pred.home_team} vs {pred.away_team}</p>
                          <p className="text-gray-500 text-xs">{pred.league}</p>
                        </td>
                        <td className="py-2 px-3 text-center text-gray-400 text-xs">
                          {new Date(pred.created_at).toLocaleDateString('tr-TR')}
                        </td>
                        {models.slice(0, 5).map(m => {
                          const modelPred = pred.ai_model_predictions?.find((mp: any) => mp.model_name === m.model_name);
                          if (!modelPred) return <td key={m.model_name} className="py-2 px-2 text-center text-gray-600">-</td>;
                          
                          const correct = (modelPred.btts_correct ? 1 : 0) + 
                                         (modelPred.over_under_correct ? 1 : 0) + 
                                         (modelPred.match_result_correct ? 1 : 0);
                          const total = (modelPred.btts_prediction ? 1 : 0) + 
                                       (modelPred.over_under_prediction ? 1 : 0) + 
                                       (modelPred.match_result_prediction ? 1 : 0);
                          
                          return (
                            <td key={m.model_name} className="py-2 px-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                                correct === total && total > 0 ? 'bg-green-500/20 text-green-400' :
                                correct > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {correct}/{total}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-center text-white font-medium">
                          {pred.actual_home_score}-{pred.actual_away_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {predictions.filter(p => p.is_settled).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Henüz sonuçlanmış tahmin yok
                </div>
              )}
            </div>
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
                <option value="deepseek_master">🎯 DeepSeek Master</option>
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
            {/* Confidence vs Accuracy Analysis - Real Calculations */}
            {(() => {
              // Calculate confidence-based accuracy from settled predictions
              const settled = predictions.filter(p => p.is_settled);
              
              // High confidence (>70%)
              const highConf = settled.filter(p => {
                const avgConf = ((p.consensus_btts_confidence || 0) + 
                                (p.consensus_over_under_confidence || 0) + 
                                (p.consensus_match_result_confidence || 0)) / 3;
                return avgConf > 70;
              });
              const highConfCorrect = highConf.filter(p => 
                (p.btts_correct ? 1 : 0) + (p.over_under_correct ? 1 : 0) + (p.match_result_correct ? 1 : 0) >= 2
              );
              const highConfAcc = highConf.length > 0 
                ? ((highConfCorrect.length / highConf.length) * 100).toFixed(1) 
                : '0';
              
              // Medium confidence (60-70%)
              const medConf = settled.filter(p => {
                const avgConf = ((p.consensus_btts_confidence || 0) + 
                                (p.consensus_over_under_confidence || 0) + 
                                (p.consensus_match_result_confidence || 0)) / 3;
                return avgConf >= 60 && avgConf <= 70;
              });
              const medConfCorrect = medConf.filter(p => 
                (p.btts_correct ? 1 : 0) + (p.over_under_correct ? 1 : 0) + (p.match_result_correct ? 1 : 0) >= 2
              );
              const medConfAcc = medConf.length > 0 
                ? ((medConfCorrect.length / medConf.length) * 100).toFixed(1) 
                : '0';
              
              // Low confidence (<60%)
              const lowConf = settled.filter(p => {
                const avgConf = ((p.consensus_btts_confidence || 0) + 
                                (p.consensus_over_under_confidence || 0) + 
                                (p.consensus_match_result_confidence || 0)) / 3;
                return avgConf < 60;
              });
              const lowConfCorrect = lowConf.filter(p => 
                (p.btts_correct ? 1 : 0) + (p.over_under_correct ? 1 : 0) + (p.match_result_correct ? 1 : 0) >= 2
              );
              const lowConfAcc = lowConf.length > 0 
                ? ((lowConfCorrect.length / lowConf.length) * 100).toFixed(1) 
                : '0';

              // Market breakdown
              const bttsTotal = settled.length;
              const bttsCorrect = settled.filter(p => p.btts_correct).length;
              const ouTotal = settled.length;
              const ouCorrect = settled.filter(p => p.over_under_correct).length;
              const mrTotal = settled.length;
              const mrCorrect = settled.filter(p => p.match_result_correct).length;

              return (
                <>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">📊 Güven vs Başarı Analizi</h3>
                    <p className="text-gray-400 mb-4">Güven seviyesine göre başarı oranları (2/3 doğru = başarılı)</p>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">Yüksek Güven (&gt;70%)</p>
                        <p className={`text-2xl font-bold ${parseFloat(highConfAcc) >= 60 ? 'text-green-400' : parseFloat(highConfAcc) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {highConf.length > 0 ? `%${highConfAcc}` : 'Veri yok'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{highConfCorrect.length}/{highConf.length} tahmin</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">Orta Güven (60-70%)</p>
                        <p className={`text-2xl font-bold ${parseFloat(medConfAcc) >= 60 ? 'text-green-400' : parseFloat(medConfAcc) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {medConf.length > 0 ? `%${medConfAcc}` : 'Veri yok'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{medConfCorrect.length}/{medConf.length} tahmin</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">Düşük Güven (&lt;60%)</p>
                        <p className={`text-2xl font-bold ${parseFloat(lowConfAcc) >= 60 ? 'text-green-400' : parseFloat(lowConfAcc) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {lowConf.length > 0 ? `%${lowConfAcc}` : 'Veri yok'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{lowConfCorrect.length}/{lowConf.length} tahmin</p>
                      </div>
                    </div>
                  </div>

                  {/* Market Breakdown */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">📈 Pazar Bazlı Performans</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400">⚽ BTTS</span>
                          <span className={`text-xl font-bold ${bttsTotal > 0 && (bttsCorrect/bttsTotal)*100 >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            %{bttsTotal > 0 ? ((bttsCorrect/bttsTotal)*100).toFixed(1) : '0'}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${bttsTotal > 0 ? (bttsCorrect/bttsTotal)*100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{bttsCorrect}/{bttsTotal} doğru</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400">📊 Üst/Alt 2.5</span>
                          <span className={`text-xl font-bold ${ouTotal > 0 && (ouCorrect/ouTotal)*100 >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            %{ouTotal > 0 ? ((ouCorrect/ouTotal)*100).toFixed(1) : '0'}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${ouTotal > 0 ? (ouCorrect/ouTotal)*100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{ouCorrect}/{ouTotal} doğru</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400">🏆 Maç Sonucu</span>
                          <span className={`text-xl font-bold ${mrTotal > 0 && (mrCorrect/mrTotal)*100 >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            %{mrTotal > 0 ? ((mrCorrect/mrTotal)*100).toFixed(1) : '0'}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500" style={{ width: `${mrTotal > 0 ? (mrCorrect/mrTotal)*100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{mrCorrect}/{mrTotal} doğru</p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

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
  const [activeModelTab, setActiveModelTab] = useState<string | null>(null);

  // Model configurations
  const modelConfigs: Record<string, { icon: string; color: string; name: string }> = {
    claude: { icon: '🧠', color: 'from-orange-500 to-red-500', name: 'Claude' },
    gpt4: { icon: '🤖', color: 'from-green-500 to-emerald-500', name: 'GPT-4' },
    gemini: { icon: '💎', color: 'from-blue-500 to-cyan-500', name: 'Gemini' },
    perplexity: { icon: '🔮', color: 'from-purple-500 to-violet-500', name: 'Perplexity' },
    deepseek: { icon: '🔬', color: 'from-indigo-500 to-purple-500', name: 'DeepSeek' },
    grok: { icon: '⚡', color: 'from-amber-500 to-orange-500', name: 'Grok' },
    stats_agent: { icon: '📊', color: 'from-teal-500 to-cyan-500', name: 'Stats Agent' },
    deep_analysis: { icon: '🔍', color: 'from-pink-500 to-rose-500', name: 'Deep Analysis' },
    odds_agent: { icon: '💰', color: 'from-yellow-500 to-amber-500', name: 'Odds Agent' },
    strategy_agent: { icon: '♟️', color: 'from-slate-500 to-gray-500', name: 'Strategy Agent' },
    news_agent: { icon: '📰', color: 'from-sky-500 to-blue-500', name: 'News Agent' },
  };

  const getModelConfig = (name: string) => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    return modelConfigs[key] || modelConfigs[name.toLowerCase()] || { icon: '🤖', color: 'from-gray-500 to-gray-600', name };
  };

  const models = prediction.ai_model_predictions || [];

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
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
              prediction.prediction_source === 'deepseek_master'
                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30'
                : prediction.prediction_source === 'quad_brain' 
                ? 'bg-purple-500/20 text-purple-400'
                : prediction.prediction_source === 'ai_agents'
                ? 'bg-blue-500/20 text-blue-400'
                : prediction.prediction_source === 'consensus'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {prediction.prediction_source === 'deepseek_master' ? '🎯 DeepSeek Master' : prediction.prediction_source}
            </span>
            <span className="text-gray-400 text-sm">
              {new Date(prediction.created_at).toLocaleDateString('tr-TR')}
            </span>
            <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-4 bg-gray-900/50 space-y-4">
          {/* Consensus Summary */}
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

          {/* Score if settled */}
          {prediction.is_settled && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                Skor: <span className="text-white font-medium text-lg">{prediction.actual_home_score} - {prediction.actual_away_score}</span>
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              AI MODEL DETAILED ANALYSIS TABLE
              ═══════════════════════════════════════════════════════════════════ */}
          {models.length > 0 && (
            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                🤖 AI Model Analizleri
                <span className="text-xs text-gray-400 font-normal">({models.length} model)</span>
              </h4>

              {/* Model Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {models.map((mp: any) => {
                  const config = getModelConfig(mp.model_name);
                  const isActive = activeModelTab === mp.model_name;
                  return (
                    <button
                      key={mp.model_name}
                      onClick={() => setActiveModelTab(isActive ? null : mp.model_name)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        isActive
                          ? `bg-gradient-to-r ${config.color} text-white`
                          : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <span>{config.icon}</span>
                      {config.name}
                    </button>
                  );
                })}
              </div>

              {/* Model Comparison Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Model</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-medium">BTTS</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-medium">Ü/A 2.5</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-medium">MS</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-medium">Öneri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((mp: any) => {
                      const config = getModelConfig(mp.model_name);
                      return (
                        <tr 
                          key={mp.model_name} 
                          className={`border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer ${
                            activeModelTab === mp.model_name ? 'bg-gray-700/50' : ''
                          }`}
                          onClick={() => setActiveModelTab(activeModelTab === mp.model_name ? null : mp.model_name)}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span>{config.icon}</span>
                              <span className="text-white font-medium">{config.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              mp.btts_prediction === 'yes' ? 'bg-green-500/20 text-green-400' : 
                              mp.btts_prediction === 'no' ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-gray-400'
                            }`}>
                              {mp.btts_prediction?.toUpperCase() || '-'}
                              {mp.btts_confidence && <span className="ml-1 opacity-70">{mp.btts_confidence}%</span>}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              mp.over_under_prediction === 'over' ? 'bg-blue-500/20 text-blue-400' : 
                              mp.over_under_prediction === 'under' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-600 text-gray-400'
                            }`}>
                              {mp.over_under_prediction?.toUpperCase() || '-'}
                              {mp.over_under_confidence && <span className="ml-1 opacity-70">{mp.over_under_confidence}%</span>}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              mp.match_result_prediction === 'home' ? 'bg-green-500/20 text-green-400' : 
                              mp.match_result_prediction === 'away' ? 'bg-red-500/20 text-red-400' : 
                              mp.match_result_prediction === 'draw' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-600 text-gray-400'
                            }`}>
                              {mp.match_result_prediction === 'home' ? '1' : 
                               mp.match_result_prediction === 'away' ? '2' : 
                               mp.match_result_prediction === 'draw' ? 'X' : '-'}
                              {mp.match_result_confidence && <span className="ml-1 opacity-70">{mp.match_result_confidence}%</span>}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {mp.primary_recommendation_market && (
                              <span className="text-xs text-cyan-400">
                                {mp.primary_recommendation_market}: {mp.primary_recommendation_selection}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Selected Model Detail */}
              {activeModelTab && (
                <div className="bg-gray-800/80 border border-gray-600 rounded-xl p-4">
                  {(() => {
                    const selectedModel = models.find((m: any) => m.model_name === activeModelTab);
                    if (!selectedModel) return null;
                    const config = getModelConfig(selectedModel.model_name);
                    
                    return (
                      <>
                        <div className={`flex items-center gap-3 mb-4 pb-3 border-b border-gray-700`}>
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${config.color} flex items-center justify-center text-xl`}>
                            {config.icon}
                          </div>
                          <div>
                            <h5 className="text-white font-bold">{config.name} Detaylı Analiz</h5>
                            <p className="text-gray-400 text-xs">
                              {selectedModel.model_type} • {selectedModel.response_time_ms}ms
                              {selectedModel.tokens_used && ` • ${selectedModel.tokens_used} tokens`}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {/* BTTS Reasoning */}
                          {selectedModel.btts_reasoning && (
                            <div className="bg-gray-700/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-300">⚽ BTTS Analizi</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  selectedModel.btts_prediction === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {selectedModel.btts_prediction?.toUpperCase()} ({selectedModel.btts_confidence}%)
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm leading-relaxed">{selectedModel.btts_reasoning}</p>
                            </div>
                          )}

                          {/* Over/Under Reasoning */}
                          {selectedModel.over_under_reasoning && (
                            <div className="bg-gray-700/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-300">📊 Üst/Alt 2.5 Analizi</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  selectedModel.over_under_prediction === 'over' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {selectedModel.over_under_prediction?.toUpperCase()} ({selectedModel.over_under_confidence}%)
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm leading-relaxed">{selectedModel.over_under_reasoning}</p>
                            </div>
                          )}

                          {/* Match Result Reasoning */}
                          {selectedModel.match_result_reasoning && (
                            <div className="bg-gray-700/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-300">🏆 Maç Sonucu Analizi</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  selectedModel.match_result_prediction === 'home' ? 'bg-green-500/20 text-green-400' : 
                                  selectedModel.match_result_prediction === 'away' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {selectedModel.match_result_prediction === 'home' ? '1 (Ev)' : 
                                   selectedModel.match_result_prediction === 'away' ? '2 (Dep)' : 'X (Berabere)'} 
                                  ({selectedModel.match_result_confidence}%)
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm leading-relaxed">{selectedModel.match_result_reasoning}</p>
                            </div>
                          )}

                          {/* No reasoning available */}
                          {!selectedModel.btts_reasoning && !selectedModel.over_under_reasoning && !selectedModel.match_result_reasoning && (
                            <div className="text-center py-6 text-gray-500">
                              <span className="text-2xl block mb-2">📭</span>
                              Bu model için detaylı analiz metni kaydedilmemiş
                            </div>
                          )}

                          {/* Accuracy Results */}
                          {prediction.is_settled && (
                            <div className="flex gap-3 pt-3 border-t border-gray-700">
                              <span className={`px-2 py-1 rounded text-xs ${
                                selectedModel.btts_correct === true ? 'bg-green-500/20 text-green-400' :
                                selectedModel.btts_correct === false ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-gray-400'
                              }`}>
                                BTTS: {selectedModel.btts_correct === true ? '✅' : selectedModel.btts_correct === false ? '❌' : '?'}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                selectedModel.over_under_correct === true ? 'bg-green-500/20 text-green-400' :
                                selectedModel.over_under_correct === false ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-gray-400'
                              }`}>
                                Ü/A: {selectedModel.over_under_correct === true ? '✅' : selectedModel.over_under_correct === false ? '❌' : '?'}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                selectedModel.match_result_correct === true ? 'bg-green-500/20 text-green-400' :
                                selectedModel.match_result_correct === false ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-gray-400'
                              }`}>
                                MS: {selectedModel.match_result_correct === true ? '✅' : selectedModel.match_result_correct === false ? '❌' : '?'}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* No models warning */}
          {models.length === 0 && (
            <div className="pt-4 border-t border-gray-700 text-center py-6 text-gray-500">
              <span className="text-2xl block mb-2">🤖</span>
              Bu tahmin için bireysel model verileri kaydedilmemiş
            </div>
          )}
        </div>
      )}
    </div>
  );
}
