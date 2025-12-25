'use client';

// ============================================================================
// DASHBOARD - Hızlı AI Analiz Sistemi
// Claude + DeepSeek | ~10-15 saniye analiz
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import { 
  Trophy, Calendar, Search, RefreshCw, Zap, 
  TrendingUp, CheckCircle, AlertCircle, Clock,
  ChevronRight, Star, Target, Shield, User,
  Settings, LogOut, Crown, BarChart3, Menu, X
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
  hasAnalysis?: boolean;
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
  btts?: { prediction: string; confidence: number; reasoning: string };
  overUnder?: { prediction: string; confidence: number; reasoning: string };
  matchResult?: { prediction: string; confidence: number; reasoning: string };
  corners?: { prediction: string; confidence: number; reasoning: string; line: number; dataAvailable?: boolean };
  // YENİ: Agent özel tahminler
  halfTimeGoals?: { prediction: string; confidence: number; reasoning: string; line: number; expectedGoals?: number };
  halfTimeFullTime?: { prediction: string; confidence: number; reasoning: string };
  matchResultOdds?: { home: number; draw: number; away: number; reasoning: string };
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
  overallConfidence: number;
  processingTime: number;
  modelsUsed: string[];
  analyzedAt: string;
}

// ============================================================================
// TRANSLATIONS
// ============================================================================

const translations = {
  tr: {
    title: 'Football Analytics',
    subtitle: 'AI Tahmin Sistemi',
    profile: 'Profil',
    settings: 'Ayarlar',
    admin: 'Admin Panel',
    logout: 'Çıkış Yap',
    selectDate: 'Tarih Seç',
    selectLeague: 'Lig Seç',
    allLeagues: 'Tüm Ligler',
    matches: 'Maçlar',
    searchPlaceholder: 'Takım veya lig ara...',
    noMatches: 'Maç bulunamadı',
    analyzing: 'Analiz Yapılıyor...',
    analyzeTime: '~10-15 saniye',
    tryAgain: 'Tekrar Dene',
    selectMatch: 'Maç Seçin',
    selectMatchDesc: 'Sol taraftan bir maç seçerek analiz başlatın.',
    analyzeTimeShort: 'Analiz sadece 10-15 saniye sürer!',
    riskLow: 'Düşük',
    riskMedium: 'Orta',
    riskHigh: 'Yüksek',
    btts: 'BTTS',
    overUnder: 'Üst/Alt 2.5',
    matchResult: 'Maç Sonucu',
    corners: 'Korner',
    halfTimeGoals: 'İlk Yarı Goller',
    halfTimeFullTime: 'İlk Yarı/Maç Sonucu',
    matchResultOdds: 'Maç Sonucu Oranları',
    bestBet: 'En İyi Bahis',
    aiRecommendation: 'AI önerisi',
    confidence: 'güven',
    agreement: 'Uyum',
    models: 'Modeller',
    analysis: 'Analiz',
    yes: 'EVET',
    no: 'HAYIR',
    over: 'ÜST',
    under: 'ALT',
    home: 'EV SAHİBİ',
    away: 'DEPLASMAN',
    draw: 'BERABERLİK',
    cached: 'Önbellek',
    analyzed: 'Analiz Edildi',
    aiAnalysis: 'AI Analiz',
    agentAnalysis: 'Agent Analiz',
    selectAnalysisType: 'Analiz Türü Seçin'
  },
  en: {
    title: 'Football Analytics',
    subtitle: 'AI Prediction System',
    profile: 'Profile',
    settings: 'Settings',
    admin: 'Admin Panel',
    logout: 'Sign Out',
    selectDate: 'Select Date',
    selectLeague: 'Select League',
    allLeagues: 'All Leagues',
    matches: 'Matches',
    searchPlaceholder: 'Search team or league...',
    noMatches: 'No matches found',
    analyzing: 'Analyzing...',
    analyzeTime: '~10-15 seconds',
    tryAgain: 'Try Again',
    selectMatch: 'Select a Match',
    selectMatchDesc: 'Select a match from the left to start analysis.',
    analyzeTimeShort: 'Analysis takes only 10-15 seconds!',
    riskLow: 'Low',
    riskMedium: 'Medium',
    riskHigh: 'High',
    btts: 'BTTS',
    overUnder: 'Over/Under 2.5',
    matchResult: 'Match Result',
    corners: 'Corners',
    halfTimeGoals: 'Half-Time Goals',
    halfTimeFullTime: 'HT/FT Result',
    matchResultOdds: 'Match Result Odds',
    bestBet: 'Best Bet',
    aiRecommendation: 'AI recommendation',
    confidence: 'confidence',
    agreement: 'Agreement',
    models: 'Models',
    analysis: 'Analysis',
    yes: 'YES',
    no: 'NO',
    over: 'OVER',
    under: 'UNDER',
    home: 'HOME',
    away: 'AWAY',
    draw: 'DRAW',
    cached: 'Cached',
    analyzed: 'Analyzed',
    aiAnalysis: 'AI Analysis',
    agentAnalysis: 'Agent Analysis',
    selectAnalysisType: 'Select Analysis Type'
  },
  de: {
    title: 'Football Analytics',
    subtitle: 'KI-Vorhersagesystem',
    profile: 'Profil',
    settings: 'Einstellungen',
    admin: 'Admin Panel',
    logout: 'Abmelden',
    selectDate: 'Datum wählen',
    selectLeague: 'Liga wählen',
    allLeagues: 'Alle Ligen',
    matches: 'Spiele',
    searchPlaceholder: 'Team oder Liga suchen...',
    noMatches: 'Keine Spiele gefunden',
    analyzing: 'Analysieren...',
    analyzeTime: '~10-15 Sekunden',
    tryAgain: 'Erneut versuchen',
    selectMatch: 'Spiel auswählen',
    selectMatchDesc: 'Wählen Sie ein Spiel auf der linken Seite.',
    analyzeTimeShort: 'Die Analyse dauert nur 10-15 Sekunden!',
    riskLow: 'Niedrig',
    riskMedium: 'Mittel',
    riskHigh: 'Hoch',
    btts: 'BTTS',
    overUnder: 'Über/Unter 2.5',
    matchResult: 'Spielergebnis',
    corners: 'Ecken',
    halfTimeGoals: 'Halbzeit-Tore',
    halfTimeFullTime: 'HZ/ET Ergebnis',
    matchResultOdds: 'Spielergebnis Quoten',
    bestBet: 'Beste Wette',
    aiRecommendation: 'KI-Empfehlung',
    confidence: 'Vertrauen',
    agreement: 'Übereinstimmung',
    models: 'Modelle',
    analysis: 'Analyse',
    yes: 'JA',
    no: 'NEIN',
    over: 'ÜBER',
    under: 'UNTER',
    home: 'HEIM',
    away: 'AUSWÄRTS',
    draw: 'UNENTSCHIEDEN',
    cached: 'Zwischengespeichert',
    analyzed: 'Analysiert',
    aiAnalysis: 'KI-Analyse',
    agentAnalysis: 'Agent-Analyse',
    selectAnalysisType: 'Analysetyp auswählen'
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = translations[lang as keyof typeof translations] || translations.en;
  
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [analysisType, setAnalysisType] = useState<'ai' | 'agent'>('agent'); // 🆕 Agent Analysis ana sistem
  
  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // ============================================================================
  // FETCH FIXTURES
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
  // ANALYZE MATCH
  // ============================================================================
  
  const analyzeMatch = async (fixture: Fixture, type: 'ai' | 'agent' = analysisType) => {
    setSelectedFixture(fixture);
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    
    try {
      // 🆕 /api/v2/analyze artık Agent Analysis'i önce deniyor, başarısız olursa Smart Analysis'e geçiyor
      // Bu yüzden her zaman /api/v2/analyze kullanıyoruz
      const endpoint = '/api/v2/analyze';
      const res = await fetch(endpoint, {
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
        // 🆕 Response'dan gelen analysisType'a göre UI'ı güncelle
        if (data.analysisType === 'agent') {
          setAnalysisType('agent');
        } else if (data.analysisType === 'smart') {
          setAnalysisType('ai'); // Smart Analysis = AI Analysis UI'da
        }
        // Update fixture hasAnalysis status
        setFixtures(prev => prev.map(f => 
          f.id === fixture.id ? { ...f, hasAnalysis: true } : f
        ));
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-white">{t.title}</h1>
              <p className="text-xs text-purple-300">{t.subtitle}</p>
            </div>
          </div>
          
          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {cached && (
              <span className="hidden sm:flex text-xs text-green-400 items-center gap-1">
                <Zap className="w-3 h-3" /> {t.cached}
              </span>
            )}
            
            <button
              onClick={fetchFixtures}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <LanguageSelector />
            
            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="hidden sm:block text-white text-sm truncate max-w-[100px]">
                  {session?.user?.name || session?.user?.email?.split('@')[0]}
                </span>
              </button>
              
              {showProfileMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-white/10">
                      <p className="text-white font-medium truncate">{session?.user?.name}</p>
                      <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
                    </div>
                    
                    <div className="py-2">
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-white/5 transition"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <User className="w-4 h-4" />
                        {t.profile}
                      </Link>
                      <Link
                        href="/settings"
                        className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-white/5 transition"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <Settings className="w-4 h-4" />
                        {t.settings}
                      </Link>
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-white/5 transition"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <Crown className="w-4 h-4 text-yellow-400" />
                        {t.admin}
                      </Link>
                    </div>
                    
                    <div className="border-t border-white/10 py-2">
                      <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex items-center gap-3 px-4 py-2 w-full text-red-400 hover:bg-red-500/10 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        {t.logout}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
                <span className="text-white font-medium">{t.selectDate}</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedLeague('all');
                  setSelectedFixture(null);
                  setAnalysis(null);
                }}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              />
            </div>
            
            {/* League Selector */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-medium">{t.selectLeague}</span>
                <span className="text-xs text-gray-500 ml-auto">{totalCount} {t.matches.toLowerCase()}</span>
              </div>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white appearance-none cursor-pointer"
              >
                <option value="all" className="bg-gray-900">{t.allLeagues} ({totalCount})</option>
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
                placeholder={t.searchPlaceholder}
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
                  {t.matches} ({filteredFixtures.length})
                </span>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : filteredFixtures.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {t.noMatches}
                  </div>
                ) : (
                  filteredFixtures.map((fixture) => (
                    <button
                      key={fixture.id}
                      onClick={() => {
                        setSelectedFixture(fixture);
                        setAnalysis(null);
                        setAnalysisError(null);
                      }}
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
                            {fixture.hasAnalysis && (
                              <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                            )}
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
                            {new Date(fixture.date).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
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
            {selectedFixture && !analyzing && !analysis && !analysisError ? (
              <div className="bg-white/5 rounded-xl border border-white/10 p-8">
                <h3 className="text-lg font-bold text-white mb-4">{t.selectAnalysisType}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setAnalysisType('ai');
                      analyzeMatch(selectedFixture, 'ai');
                    }}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      analysisType === 'ai'
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Zap className="w-6 h-6 text-purple-400" />
                      <span className="text-white font-medium">{t.aiAnalysis}</span>
                    </div>
                    <p className="text-sm text-gray-400">Claude + DeepSeek AI modelleri</p>
                  </button>
                  <button
                    onClick={() => {
                      setAnalysisType('agent');
                      analyzeMatch(selectedFixture, 'agent');
                    }}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      analysisType === 'agent'
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Target className="w-6 h-6 text-blue-400" />
                      <span className="text-white font-medium">{t.agentAnalysis}</span>
                    </div>
                    <p className="text-sm text-gray-400">Stats, Odds, DeepAnalysis Agent'ları</p>
                  </button>
                </div>
              </div>
            ) : analyzing ? (
              <div className="bg-white/5 rounded-xl border border-white/10 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent" />
                  <Zap className="absolute inset-0 m-auto w-8 h-8 text-purple-400 animate-pulse" />
                </div>
                <p className="mt-4 text-white font-medium">{t.analyzing}</p>
                <p className="text-sm text-gray-400">{t.analyzeTime}</p>
              </div>
            ) : analysisError ? (
              <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <p className="mt-4 text-red-400 font-medium">{analysisError}</p>
                <button
                  onClick={() => selectedFixture && analyzeMatch(selectedFixture)}
                  className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-sm"
                >
                  {t.tryAgain}
                </button>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Analysis Type Tabs */}
                <div className="flex gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
                  <button
                    onClick={() => {
                      setAnalysisType('ai');
                      if (selectedFixture) {
                        setAnalysis(null);
                        analyzeMatch(selectedFixture, 'ai');
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-md transition-all ${
                      analysisType === 'ai'
                        ? 'bg-purple-500/20 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.aiAnalysis}
                  </button>
                  <button
                    onClick={() => {
                      setAnalysisType('agent');
                      if (selectedFixture) {
                        setAnalysis(null);
                        analyzeMatch(selectedFixture, 'agent');
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-md transition-all ${
                      analysisType === 'agent'
                        ? 'bg-blue-500/20 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.agentAnalysis}
                  </button>
                </div>
                
                {/* Match Header */}
                <div className={`bg-gradient-to-r rounded-xl border p-6 ${
                  analysisType === 'ai'
                    ? 'from-purple-500/20 to-pink-500/20 border-purple-500/30'
                    : 'from-blue-500/20 to-cyan-500/20 border-blue-500/30'
                }`}>
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
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm flex-wrap">
                    <span className={`px-3 py-1 rounded-full ${
                      analysis.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                      analysis.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      Risk: {analysis.riskLevel === 'low' ? t.riskLow : analysis.riskLevel === 'medium' ? t.riskMedium : t.riskHigh}
                    </span>
                    <span className="text-gray-400">
                      {t.agreement}: %{analysis.agreement}
                    </span>
                    <span className="text-gray-400">
                      {analysis.processingTime}ms
                    </span>
                  </div>
                </div>
                
                {/* Predictions Grid - Sadece AI Analiz için standart tahminler */}
                {analysisType === 'ai' && analysis.btts && analysis.overUnder && analysis.matchResult && (
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* BTTS */}
                    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-5 h-5 text-blue-400" />
                      <h4 className="text-white font-medium">{t.btts}</h4>
                    </div>
                    <div className={`text-2xl font-bold ${
                      analysis.btts.prediction === 'yes' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {analysis.btts.prediction === 'yes' ? t.yes : t.no}
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
                      <h4 className="text-white font-medium">{t.overUnder}</h4>
                    </div>
                    <div className={`text-2xl font-bold ${
                      analysis.overUnder.prediction === 'over' ? 'text-green-400' : 'text-orange-400'
                    }`}>
                      {analysis.overUnder.prediction === 'over' ? t.over : t.under}
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
                      <h4 className="text-white font-medium">{t.matchResult}</h4>
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {analysis.matchResult.prediction === 'home' ? t.home :
                       analysis.matchResult.prediction === 'away' ? t.away : t.draw}
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
                  
                  {/* Corners */}
                  {analysis.corners && (
                  <div className={`rounded-xl border p-4 ${
                    analysis.corners.dataAvailable 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-gray-800/30 border-gray-700/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🚩</span>
                      <h4 className="text-white font-medium">{t.corners}</h4>
                    </div>
                    {analysis.corners.dataAvailable ? (
                      <>
                        <div className="text-2xl font-bold text-orange-400">
                          {analysis.corners.prediction === 'over' ? 'ÜST' : 'ALT'} {analysis.corners.line}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-orange-500 rounded-full"
                              style={{ width: `${analysis.corners.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-orange-400">%{analysis.corners.confidence}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{analysis.corners.reasoning}</p>
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <div className="text-gray-500 text-sm">⚠️ Korner verisi mevcut değil</div>
                        <p className="text-xs text-gray-600 mt-1">Bu maç için korner istatistikleri bulunamadı</p>
                      </div>
                    )}
                  </div>
                  )}
                  </div>
                )}
                
                {/* Agent Özel Tahminler (Sadece Agent Analysis için - Standart tahminler yok) */}
                {analysisType === 'agent' && (
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* İlk Yarı Gol Tahmini */}
                    {analysis.halfTimeGoals && (
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">⏱️</span>
                          <h4 className="text-white font-medium">{t.halfTimeGoals}</h4>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">
                          {analysis.halfTimeGoals.prediction === 'over' ? 'ÜST' : 'ALT'} {analysis.halfTimeGoals.line}
                        </div>
                        {analysis.halfTimeGoals.expectedGoals !== undefined && (
                          <div className="text-sm text-gray-400 mt-1">
                            Beklenen: {analysis.halfTimeGoals.expectedGoals.toFixed(1)} gol
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${analysis.halfTimeGoals.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-blue-400">%{analysis.halfTimeGoals.confidence}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{analysis.halfTimeGoals.reasoning}</p>
                      </div>
                    )}
                    
                    {/* İlk Yarı / Maç Sonucu Kombinasyonu */}
                    {analysis.halfTimeFullTime && (
                      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">🎯</span>
                          <h4 className="text-white font-medium">{t.halfTimeFullTime}</h4>
                        </div>
                        <div className="text-3xl font-bold text-purple-400">
                          {analysis.halfTimeFullTime.prediction}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {analysis.halfTimeFullTime.prediction === '1/1' ? 'İY Ev - Maç Ev' :
                           analysis.halfTimeFullTime.prediction === '1/X' ? 'İY Ev - Maç Beraberlik' :
                           analysis.halfTimeFullTime.prediction === '1/2' ? 'İY Ev - Maç Deplasman' :
                           analysis.halfTimeFullTime.prediction === 'X/1' ? 'İY Beraberlik - Maç Ev' :
                           analysis.halfTimeFullTime.prediction === 'X/X' ? 'İY Beraberlik - Maç Beraberlik' :
                           analysis.halfTimeFullTime.prediction === 'X/2' ? 'İY Beraberlik - Maç Deplasman' :
                           analysis.halfTimeFullTime.prediction === '2/1' ? 'İY Deplasman - Maç Ev' :
                           analysis.halfTimeFullTime.prediction === '2/X' ? 'İY Deplasman - Maç Beraberlik' :
                           analysis.halfTimeFullTime.prediction === '2/2' ? 'İY Deplasman - Maç Deplasman' :
                           'Kombinasyon'}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${analysis.halfTimeFullTime.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-purple-400">%{analysis.halfTimeFullTime.confidence}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{analysis.halfTimeFullTime.reasoning}</p>
                      </div>
                    )}
                    
                    {/* Maç Sonucu Oranları */}
                    {analysis.matchResultOdds && (
                      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">📊</span>
                          <h4 className="text-white font-medium">{t.matchResultOdds}</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">{t.home}</span>
                            <span className="text-green-400 font-bold">{analysis.matchResultOdds.home}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">{t.draw}</span>
                            <span className="text-yellow-400 font-bold">{analysis.matchResultOdds.draw}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">{t.away}</span>
                            <span className="text-red-400 font-bold">{analysis.matchResultOdds.away}%</span>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-gray-400">{analysis.matchResultOdds.reasoning}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Best Bet */}
                {analysis.bestBet && (
                  <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold">{t.bestBet}</h4>
                        <p className="text-xs text-gray-400">{t.aiRecommendation}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <span className="text-green-400 text-lg font-bold">{analysis.bestBet.market}</span>
                        <span className="text-white text-lg mx-2">→</span>
                        <span className="text-white text-lg font-bold">{analysis.bestBet.selection}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-400">%{analysis.bestBet.confidence}</div>
                        <div className="text-xs text-gray-400">{t.confidence}</div>
                      </div>
                    </div>
                    
                    <p className="mt-3 text-sm text-gray-400">{analysis.bestBet.reason}</p>
                  </div>
                )}
                
                {/* Models Used */}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500 flex-wrap">
                  <span>{t.models}: {analysis.modelsUsed?.join(', ') || 'Claude, DeepSeek'}</span>
                  <span>•</span>
                  <span>{t.analysis}: {analysis.analyzedAt ? new Date(analysis.analyzedAt).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US') : 'Şimdi'}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl border border-white/10 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <Shield className="w-16 h-16 text-purple-400/50" />
                <h3 className="mt-4 text-xl font-bold text-white">{t.selectMatch}</h3>
                <p className="mt-2 text-gray-400 text-center">
                  {t.selectMatchDesc}<br />
                  {t.analyzeTimeShort}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
