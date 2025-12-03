'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  date: string;
  status: string;
}

interface UserProfile {
  subscription_status: string;
  subscription_end: string;
  analyses_today: number;
  analyses_limit: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();

  const [matches, setMatches] = useState<Match[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Analysis states
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  
  // Agent states
  const [agentMode, setAgentMode] = useState(false);
  const [agentAnalysis, setAgentAnalysis] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentPhase, setAgentPhase] = useState('');
  
  // UI states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // Labels
  const labels = {
    tr: {
      dashboard: 'Dashboard',
      todayMatches: 'Günün Maçları',
      weekMatches: 'Haftalık Maçlar',
      search: 'Takım ara...',
      allLeagues: 'Tüm Ligler',
      analyze: 'Analiz Et',
      analyzing: 'Analiz ediliyor...',
      aiAgents: 'AI Ajanları',
      agentAnalysis: 'Ajan Analizi',
      standardAnalysis: 'Standart Analiz',
      close: 'Kapat',
      noMatches: 'Bu tarihte maç bulunamadı',
      loading: 'Yükleniyor...',
      profile: 'Profil',
      settings: 'Ayarlar',
      billing: 'Faturalandırma',
      logout: 'Çıkış Yap',
      pro: 'PRO',
      free: 'ÜCRETSİZ',
      premium: 'Premium',
      upgradeToPro: 'Pro\'ya Yükselt',
      proMember: 'Pro Üye',
      freeMember: 'Ücretsiz Üye',
      analysesLeft: 'Kalan Analiz',
      validUntil: 'Geçerlilik',
      selectMatch: 'Analiz için maç seçin',
      matchResult: 'Maç Sonucu',
      overUnder: 'Üst/Alt 2.5',
      btts: 'Karşılıklı Gol',
      bestBet: 'En İyi Bahis',
      confidence: 'Güven',
      riskLevel: 'Risk',
      viewAll: 'Tümünü Gör',
      favorites: 'Favoriler',
      recentAnalyses: 'Son Analizler',
      quickStats: 'Hızlı İstatistikler',
      aiPowered: 'AI Destekli',
      liveOdds: 'Canlı Oranlar',
      valueBets: 'Value Bahisler',
      welcome: 'Hoş geldin',
    },
    en: {
      dashboard: 'Dashboard',
      todayMatches: "Today's Matches",
      weekMatches: 'Weekly Matches',
      search: 'Search team...',
      allLeagues: 'All Leagues',
      analyze: 'Analyze',
      analyzing: 'Analyzing...',
      aiAgents: 'AI Agents',
      agentAnalysis: 'Agent Analysis',
      standardAnalysis: 'Standard Analysis',
      close: 'Close',
      noMatches: 'No matches found',
      loading: 'Loading...',
      profile: 'Profile',
      settings: 'Settings',
      billing: 'Billing',
      logout: 'Sign Out',
      pro: 'PRO',
      free: 'FREE',
      premium: 'Premium',
      upgradeToPro: 'Upgrade to Pro',
      proMember: 'Pro Member',
      freeMember: 'Free Member',
      analysesLeft: 'Analyses Left',
      validUntil: 'Valid Until',
      selectMatch: 'Select a match to analyze',
      matchResult: 'Match Result',
      overUnder: 'Over/Under 2.5',
      btts: 'Both Teams Score',
      bestBet: 'Best Bet',
      confidence: 'Confidence',
      riskLevel: 'Risk',
      viewAll: 'View All',
      favorites: 'Favorites',
      recentAnalyses: 'Recent Analyses',
      quickStats: 'Quick Stats',
      aiPowered: 'AI Powered',
      liveOdds: 'Live Odds',
      valueBets: 'Value Bets',
      welcome: 'Welcome',
    },
    de: {
      dashboard: 'Dashboard',
      todayMatches: 'Heutige Spiele',
      weekMatches: 'Wöchentliche Spiele',
      search: 'Team suchen...',
      allLeagues: 'Alle Ligen',
      analyze: 'Analysieren',
      analyzing: 'Analysiere...',
      aiAgents: 'KI-Agenten',
      agentAnalysis: 'Agenten-Analyse',
      standardAnalysis: 'Standard-Analyse',
      close: 'Schließen',
      noMatches: 'Keine Spiele gefunden',
      loading: 'Laden...',
      profile: 'Profil',
      settings: 'Einstellungen',
      billing: 'Abrechnung',
      logout: 'Abmelden',
      pro: 'PRO',
      free: 'KOSTENLOS',
      premium: 'Premium',
      upgradeToPro: 'Auf Pro upgraden',
      proMember: 'Pro-Mitglied',
      freeMember: 'Kostenloses Mitglied',
      analysesLeft: 'Verbleibende Analysen',
      validUntil: 'Gültig bis',
      selectMatch: 'Wählen Sie ein Spiel zur Analyse',
      matchResult: 'Spielergebnis',
      overUnder: 'Über/Unter 2.5',
      btts: 'Beide treffen',
      bestBet: 'Beste Wette',
      confidence: 'Konfidenz',
      riskLevel: 'Risiko',
      viewAll: 'Alle anzeigen',
      favorites: 'Favoriten',
      recentAnalyses: 'Letzte Analysen',
      quickStats: 'Schnellstatistiken',
      aiPowered: 'KI-gestützt',
      liveOdds: 'Live-Quoten',
      valueBets: 'Value Wetten',
      welcome: 'Willkommen',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      setUserProfile(data);
      if (data.favorites) {
        setFavoriteIds(data.favorites.map((f: any) => f.fixture_id));
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  };

  // Fetch matches
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?date=${selectedDate}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setFilteredMatches(data.matches || []);
    } catch (error) {
      console.error('Fetch matches error:', error);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    if (session) {
      fetchMatches();
      fetchUserProfile();
    }
  }, [session, fetchMatches]);

  // Filter matches
  useEffect(() => {
    let filtered = matches;
    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.awayTeam.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedLeague !== 'all') {
      filtered = filtered.filter((m) => m.league === selectedLeague);
    }
    setFilteredMatches(filtered);
  }, [matches, searchQuery, selectedLeague]);

  // Get unique leagues
  const leagues = Array.from(new Set(matches.map((m) => m.league)));

  // Check if user is Pro
  const isPro = userProfile?.subscription_status === 'active';
  const analysesUsed = userProfile?.analyses_today || 0;
  const analysesLimit = userProfile?.analyses_limit || 50;

  // Standard Analysis
  const analyzeMatch = async (match: Match) => {
    setSelectedMatch(match);
    setAnalyzing(true);
    setAnalysis(null);
    setAgentMode(false);
    setAgentAnalysis(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          language: lang,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data);
        fetchUserProfile(); // Refresh usage
      }
    } catch (error) {
      console.error('Analysis error:', error);
    }
    setAnalyzing(false);
  };

  // Agent Analysis
  const runAgentAnalysis = async () => {
    if (!selectedMatch) return;
    setAgentMode(true);
    setAgentLoading(true);
    setAgentAnalysis(null);
    setAgentPhase(lang === 'tr' ? '🔍 Ajanlar çalışıyor...' : '🔍 Agents running...');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: selectedMatch.id,
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          homeTeamId: selectedMatch.homeTeamId,
          awayTeamId: selectedMatch.awayTeamId,
          language: lang,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentAnalysis(data);
        setAgentPhase('✅');
      }
    } catch (error) {
      console.error('Agent error:', error);
    }
    setAgentLoading(false);
  };

  // Toggle favorite
  const toggleFavorite = async (fixtureId: number) => {
    try {
      await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId }),
      });
      if (favoriteIds.includes(fixtureId)) {
        setFavoriteIds(favoriteIds.filter((id) => id !== fixtureId));
      } else {
        setFavoriteIds([...favoriteIds, fixtureId]);
      }
    } catch (error) {
      console.error('Favorite error:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{l.loading}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-xl">⚽</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Football Analytics</h1>
                <div className="flex items-center gap-1">
                  {isPro ? (
                    <span className="px-1.5 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] font-bold rounded text-black">PRO</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-gray-700 text-[10px] font-medium rounded text-gray-300">FREE</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4">
              {/* Usage Stats */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="text-right">
                  <div className="text-xs text-gray-400">{l.analysesLeft}</div>
                  <div className="text-sm font-bold text-white">{analysesLimit - analysesUsed}/{analysesLimit}</div>
                </div>
                <div className="w-px h-8 bg-gray-700"></div>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      analysesUsed / analysesLimit > 0.8 ? 'bg-red-500' : 
                      analysesUsed / analysesLimit > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${((analysesLimit - analysesUsed) / analysesLimit) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Upgrade Button (if not Pro) */}
              {!isPro && (
                <Link
                  href="/pricing"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-semibold rounded-xl shadow-lg shadow-yellow-500/20 transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {l.upgradeToPro}
                </Link>
              )}

              {/* Language Selector */}
              <LanguageSelector />

              {/* Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium text-white">{session.user?.name || 'User'}</div>
                    <div className="text-xs text-gray-400">{isPro ? l.proMember : l.freeMember}</div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="p-4 border-b border-gray-700">
                      <div className="font-medium text-white">{session.user?.name}</div>
                      <div className="text-sm text-gray-400">{session.user?.email}</div>
                      {isPro && userProfile?.subscription_end && (
                        <div className="mt-2 text-xs text-green-400">
                          {l.validUntil}: {new Date(userProfile.subscription_end).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="py-2">
                      <Link href="/profile" className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {l.profile}
                      </Link>
                      <Link href="/settings" className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {l.settings}
                      </Link>
                      {!isPro && (
                        <Link href="/pricing" className="flex items-center gap-3 px-4 py-2 text-yellow-400 hover:bg-gray-700/50 transition-colors">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {l.upgradeToPro}
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-gray-700 py-2">
                      <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-gray-700/50 transition-colors w-full"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {l.logout}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Banner (for Pro users) */}
        {isPro && (
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{l.welcome}, {session.user?.name}! 👋</h2>
                  <p className="text-sm text-gray-400">
                    {lang === 'tr' ? 'Pro üyeliğiniz aktif. Tüm özelliklere erişebilirsiniz.' : 
                     lang === 'de' ? 'Ihre Pro-Mitgliedschaft ist aktiv. Sie haben Zugriff auf alle Funktionen.' :
                     'Your Pro membership is active. You have access to all features.'}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                  ✓ {lang === 'tr' ? 'Aktif' : lang === 'de' ? 'Aktiv' : 'Active'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{matches.length}</div>
                <div className="text-xs text-gray-400">{l.todayMatches}</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">9</div>
                <div className="text-xs text-gray-400">{l.aiPowered}</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">⭐</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{favoriteIds.length}</div>
                <div className="text-xs text-gray-400">{l.favorites}</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{leagues.length}</div>
                <div className="text-xs text-gray-400">{l.allLeagues}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 bg-gray-700/50 rounded-xl px-3 py-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white outline-none"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 bg-gray-700/50 rounded-xl px-3 py-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={l.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-gray-500 outline-none flex-1"
                />
              </div>
            </div>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-gray-700/50 text-white px-4 py-2 rounded-xl outline-none border border-gray-600/50 min-w-[150px]"
            >
              <option value="all">{l.allLeagues}</option>
              {leagues.map((league) => (
                <option key={league} value={league}>{league}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Matches List */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📅 {l.todayMatches}
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-sm rounded-full">{filteredMatches.length}</span>
              </h2>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p>{l.noMatches}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {filteredMatches.map((match) => (
                    <div
                      key={match.id}
                      onClick={() => setSelectedMatch(match)}
                      className={`p-4 hover:bg-gray-700/30 cursor-pointer transition-all ${
                        selectedMatch?.id === match.id ? 'bg-green-500/10 border-l-2 border-green-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-white flex items-center gap-2">
                            {favoriteIds.includes(match.id) && <span className="text-yellow-400">⭐</span>}
                            {match.homeTeam} vs {match.awayTeam}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{match.league}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(match.id); }}
                            className="p-2 hover:bg-gray-600/50 rounded-lg transition-colors"
                          >
                            {favoriteIds.includes(match.id) ? '⭐' : '☆'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); analyzeMatch(match); }}
                            disabled={analyzing}
                            className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {analyzing && selectedMatch?.id === match.id ? '⏳' : '🤖'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl overflow-hidden">
            {selectedMatch ? (
              <>
                {/* Match Header */}
                <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-green-500/10 to-blue-500/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</h2>
                      <p className="text-sm text-gray-400">{selectedMatch.league}</p>
                    </div>
                    <button
                      onClick={() => toggleFavorite(selectedMatch.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        favoriteIds.includes(selectedMatch.id) ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700/50 text-gray-400'
                      }`}
                    >
                      {favoriteIds.includes(selectedMatch.id) ? '⭐' : '☆'}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-b border-gray-700/50">
                  <div className="flex gap-3">
                    <button
                      onClick={() => analyzeMatch(selectedMatch)}
                      disabled={analyzing}
                      className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>🤖</span>
                      {analyzing ? l.analyzing : l.analyze}
                    </button>
                    <button
                      onClick={runAgentAnalysis}
                      disabled={agentLoading || !isPro}
                      className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                        isPro 
                          ? 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400' 
                          : 'bg-gray-700 cursor-not-allowed'
                      } disabled:opacity-50`}
                    >
                      <span>🧠</span>
                      {agentLoading ? '...' : l.aiAgents}
                      {!isPro && <span className="text-xs bg-yellow-500 text-black px-1 rounded">PRO</span>}
                    </button>
                  </div>
                </div>

                {/* Analysis Content */}
                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {(analyzing || agentLoading) ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-400">{agentLoading ? agentPhase : l.analyzing}</p>
                    </div>
                  ) : analysis || agentAnalysis ? (
                    <div className="space-y-4">
                      {/* Tabs */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAgentMode(false)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !agentMode ? 'bg-green-600 text-white' : 'bg-gray-700/50 text-gray-400'
                          }`}
                        >
                          {l.standardAnalysis}
                        </button>
                        {agentAnalysis && (
                          <button
                            onClick={() => setAgentMode(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              agentMode ? 'bg-purple-600 text-white' : 'bg-gray-700/50 text-gray-400'
                            }`}
                          >
                            {l.agentAnalysis}
                          </button>
                        )}
                      </div>

                      {/* Results Display */}
                      {!agentMode && analysis && (
                        <div className="space-y-4">
                          {/* AI Status */}
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(analysis.aiStatus || {}).map(([key, value]) => (
                              <span key={key} className={`px-2 py-1 rounded text-xs ${value === '✅' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {key} {value as string}
                              </span>
                            ))}
                          </div>

                          {/* Predictions Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {analysis.analysis?.matchResult && (
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.matchResult}</div>
                                <div className="text-2xl font-bold text-blue-400">{analysis.analysis.matchResult.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.matchResult.confidence}%</div>
                              </div>
                            )}
                            {analysis.analysis?.overUnder25 && (
                              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.overUnder}</div>
                                <div className="text-2xl font-bold text-green-400">{analysis.analysis.overUnder25.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.overUnder25.confidence}%</div>
                              </div>
                            )}
                            {analysis.analysis?.btts && (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.btts}</div>
                                <div className="text-2xl font-bold text-orange-400">{analysis.analysis.btts.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.btts.confidence}%</div>
                              </div>
                            )}
                          </div>

                          {/* Best Bet */}
                          {analysis.analysis?.bestBets?.[0] && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                              <div className="text-sm text-yellow-400 mb-2">💰 {l.bestBet}</div>
                              <div className="font-bold text-white">{analysis.analysis.bestBets[0].type}: {analysis.analysis.bestBets[0].selection}</div>
                              <div className="text-sm text-gray-300">{analysis.analysis.bestBets[0].confidence}% {l.confidence}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Agent Analysis Display */}
                      {agentMode && agentAnalysis && (
                        <div className="space-y-4">
                          {/* Agent Status */}
                          <div className="grid grid-cols-5 gap-2">
                            {['scout', 'stats', 'odds', 'strategy', 'consensus'].map((agent) => (
                              <div key={agent} className={`p-2 rounded-lg text-center text-xs ${
                                agentAnalysis.reports?.[agent] ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {agent} {agentAnalysis.reports?.[agent] ? '✅' : '❌'}
                              </div>
                            ))}
                          </div>

                          {/* Consensus Results */}
                          {agentAnalysis.reports?.consensus && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                                  <div className="text-xs text-gray-400">{l.matchResult}</div>
                                  <div className="text-2xl font-bold text-blue-400">{agentAnalysis.reports.consensus.matchResult?.prediction}</div>
                                  <div className="text-sm text-gray-300">{agentAnalysis.reports.consensus.matchResult?.confidence}%</div>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                  <div className="text-xs text-gray-400">{l.overUnder}</div>
                                  <div className="text-2xl font-bold text-green-400">{agentAnalysis.reports.consensus.overUnder25?.prediction}</div>
                                  <div className="text-sm text-gray-300">{agentAnalysis.reports.consensus.overUnder25?.confidence}%</div>
                                </div>
                              </div>

                              {agentAnalysis.reports.consensus.bestBet && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                  <div className="text-sm text-yellow-400 mb-2">💰 {l.bestBet}</div>
                                  <div className="font-bold text-white">{agentAnalysis.reports.consensus.bestBet.type}: {agentAnalysis.reports.consensus.bestBet.selection}</div>
                                  <div className="text-sm text-gray-300">{agentAnalysis.reports.consensus.bestBet.confidence}%</div>
                                  <div className="text-xs text-gray-400 mt-2">{agentAnalysis.reports.consensus.bestBet.reasoning}</div>
                                </div>
                              )}

                              {agentAnalysis.reports.consensus.overallAnalysis && (
                                <div className="bg-gray-700/50 rounded-xl p-4">
                                  <p className="text-sm text-gray-300">{agentAnalysis.reports.consensus.overallAnalysis}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-5xl mb-4">🤖</div>
                      <p>{l.selectMatch}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[600px] text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">⚽</div>
                  <p className="text-lg">{l.selectMatch}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Click outside to close profile menu */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
      )}
    </div>
  );
}
