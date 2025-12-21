'use client';

// ============================================================================
// DASHBOARD V2 - Yeni Hızlı Arayüz
// Edge Cache + Smart Analyzer + Realtime Updates
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Trophy, Calendar, Search, RefreshCw, Zap, 
  TrendingUp, CheckCircle, AlertCircle, Clock,
  ChevronRight, Star, Target, Shield
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league: string;
  leagueId?: number;
  leagueLogo?: string;
  date: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

interface League {
  id: number;
  name: string;
  logo?: string;
  count: number;
}

interface SmartAnalysis {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  btts: { prediction: string; confidence: number; reasoning: string };
  overUnder: { prediction: string; confidence: number; reasoning: string };
  matchResult: { prediction: string; confidence: number; reasoning: string };
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
  overallConfidence: number;
  processingTime: number;
  modelsUsed: string[];
  analyzedAt: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardV2() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // States
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [analysis, setAnalysis] = useState<SmartAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // ============================================================================
  // FETCH FIXTURES - Ultra-hızlı cache
  // ============================================================================
  
  const fetchFixtures = useCallback(async () => {
    setLoading(true);
    try {
      const leagueParam = selectedLeague !== 'all' ? `&league_id=${selectedLeague}` : '';
      const res = await fetch(`/api/v2/fixtures?date=${selectedDate}${leagueParam}`);
      const data = await res.json();
      
      if (data.success) {
        setFixtures(data.fixtures);
        setLeagues(data.leagues || []);
        setTotalCount(data.totalCount || data.count);
        setCached(data.cached);
        console.log(`📦 Fixtures loaded: ${data.count}/${data.totalCount} in ${data.processingTime}ms (cached: ${data.cached})`);
      }
    } catch (error) {
      console.error('Fetch fixtures error:', error);
    }
    setLoading(false);
  }, [selectedDate, selectedLeague]);
  
  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);
  
  // ============================================================================
  // ANALYZE MATCH - 10-15 saniye
  // ============================================================================
  
  const analyzeMatch = async (fixture: Fixture) => {
    setSelectedFixture(fixture);
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    
    try {
      const res = await fetch('/api/v2/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: fixture.id,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          league: fixture.league,
          matchDate: fixture.date.split('T')[0]
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        console.log(`✅ Analysis complete in ${data.processingTime}ms (cached: ${data.cached})`);
      } else {
        setAnalysisError(data.error || 'Analiz başarısız');
      }
    } catch (error) {
      setAnalysisError('Bağlantı hatası');
    }
    
    setAnalyzing(false);
  };
  
  // ============================================================================
  // FILTER FIXTURES
  // ============================================================================
  
  const filteredFixtures = fixtures.filter(f => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return f.homeTeam.toLowerCase().includes(query) ||
           f.awayTeam.toLowerCase().includes(query) ||
           f.league.toLowerCase().includes(query);
  });
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Football Analytics</h1>
              <p className="text-xs text-purple-300">V2 - Ultra Fast</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {cached && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Cached
              </span>
            )}
            <button
              onClick={fetchFixtures}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Fixtures List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Date Picker */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Tarih Seç</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedLeague('all');
                }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              />
            </div>
            
            {/* League Selector */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-medium">Lig Seç</span>
                <span className="text-xs text-gray-500 ml-auto">{totalCount} maç</span>
              </div>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white appearance-none cursor-pointer"
              >
                <option value="all" className="bg-gray-900">Tüm Ligler ({totalCount})</option>
                {leagues.map(league => (
                  <option key={league.id} value={league.id} className="bg-gray-900">
                    {league.name} ({league.count})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Takım veya lig ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500"
              />
            </div>
            
            {/* Fixtures */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-white font-medium flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Maçlar ({filteredFixtures.length})
                </span>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : filteredFixtures.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Maç bulunamadı
                  </div>
                ) : (
                  filteredFixtures.map((fixture) => (
                    <button
                      key={fixture.id}
                      onClick={() => analyzeMatch(fixture)}
                      className={`w-full p-3 border-b border-white/5 hover:bg-white/5 transition text-left ${
                        selectedFixture?.id === fixture.id ? 'bg-purple-500/20 border-l-2 border-l-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {fixture.homeTeamLogo && (
                              <img src={fixture.homeTeamLogo} alt="" className="w-5 h-5 object-contain" />
                            )}
                            <span className="text-white text-sm font-medium truncate">
                              {fixture.homeTeam}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {fixture.awayTeamLogo && (
                              <img src={fixture.awayTeamLogo} alt="" className="w-5 h-5 object-contain" />
                            )}
                            <span className="text-gray-400 text-sm truncate">
                              {fixture.awayTeam}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-xs text-purple-400">
                            {new Date(fixture.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[80px]">
                            {fixture.league}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 ml-2" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Right: Analysis Panel */}
          <div className="lg:col-span-2">
            {analyzing ? (
              <div className="bg-white/5 rounded-xl border border-white/10 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent" />
                  <Zap className="absolute inset-0 m-auto w-8 h-8 text-purple-400 animate-pulse" />
                </div>
                <p className="mt-4 text-white font-medium">Analiz Yapılıyor...</p>
                <p className="text-sm text-gray-400">~10-15 saniye</p>
              </div>
            ) : analysisError ? (
              <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <p className="mt-4 text-red-400 font-medium">{analysisError}</p>
                <button
                  onClick={() => selectedFixture && analyzeMatch(selectedFixture)}
                  className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-sm"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Match Header */}
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <h3 className="text-xl font-bold text-white">{analysis.homeTeam}</h3>
                    </div>
                    <div className="px-4">
                      <span className="text-2xl font-bold text-purple-400">vs</span>
                    </div>
                    <div className="text-center flex-1">
                      <h3 className="text-xl font-bold text-white">{analysis.awayTeam}</h3>
                    </div>
                  </div>
                  
                  {/* Meta Info */}
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                    <span className={`px-3 py-1 rounded-full ${
                      analysis.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                      analysis.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      Risk: {analysis.riskLevel === 'low' ? 'Düşük' : analysis.riskLevel === 'medium' ? 'Orta' : 'Yüksek'}
                    </span>
                    <span className="text-gray-400">
                      Uyum: %{analysis.agreement}
                    </span>
                    <span className="text-gray-400">
                      {analysis.processingTime}ms
                    </span>
                  </div>
                </div>
                
                {/* Predictions Grid */}
                <div className="grid md:grid-cols-3 gap-4">
                  {/* BTTS */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-5 h-5 text-blue-400" />
                      <h4 className="text-white font-medium">BTTS</h4>
                    </div>
                    <div className={`text-2xl font-bold ${
                      analysis.btts.prediction === 'yes' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {analysis.btts.prediction === 'yes' ? 'EVET' : 'HAYIR'}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${analysis.btts.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm text-blue-400">%{analysis.btts.confidence}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">{analysis.btts.reasoning}</p>
                  </div>
                  
                  {/* Over/Under */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-5 h-5 text-purple-400" />
                      <h4 className="text-white font-medium">Üst/Alt 2.5</h4>
                    </div>
                    <div className={`text-2xl font-bold ${
                      analysis.overUnder.prediction === 'over' ? 'text-green-400' : 'text-orange-400'
                    }`}>
                      {analysis.overUnder.prediction === 'over' ? 'ÜST' : 'ALT'}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${analysis.overUnder.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm text-purple-400">%{analysis.overUnder.confidence}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">{analysis.overUnder.reasoning}</p>
                  </div>
                  
                  {/* Match Result */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <h4 className="text-white font-medium">Maç Sonucu</h4>
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {analysis.matchResult.prediction === 'home' ? 'EV SAHİBİ' :
                       analysis.matchResult.prediction === 'away' ? 'DEPLASMAN' : 'BERABERLİK'}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500 rounded-full"
                          style={{ width: `${analysis.matchResult.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm text-yellow-400">%{analysis.matchResult.confidence}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">{analysis.matchResult.reasoning}</p>
                  </div>
                </div>
                
                {/* Best Bet */}
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Star className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold">En İyi Bahis</h4>
                      <p className="text-xs text-gray-400">AI önerisi</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-green-400 text-lg font-bold">{analysis.bestBet.market}</span>
                      <span className="text-white text-lg mx-2">→</span>
                      <span className="text-white text-lg font-bold">{analysis.bestBet.selection}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-400">%{analysis.bestBet.confidence}</div>
                      <div className="text-xs text-gray-400">güven</div>
                    </div>
                  </div>
                  
                  <p className="mt-3 text-sm text-gray-400">{analysis.bestBet.reason}</p>
                </div>
                
                {/* Models Used */}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span>Modeller: {analysis.modelsUsed.join(', ')}</span>
                  <span>•</span>
                  <span>Analiz: {new Date(analysis.analyzedAt).toLocaleTimeString('tr-TR')}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl border border-white/10 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <Shield className="w-16 h-16 text-purple-400/50" />
                <h3 className="mt-4 text-xl font-bold text-white">Maç Seçin</h3>
                <p className="mt-2 text-gray-400 text-center">
                  Sol taraftan bir maç seçerek analiz başlatın.<br />
                  Analiz sadece 10-15 saniye sürer!
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

