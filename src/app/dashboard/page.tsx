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
  email: string;
  name: string;
  hasAccess: boolean;
  isPro: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  trialExpired: boolean;
  analysesUsed: number;
  analysesLimit: number;
  canAnalyze: boolean;
  canUseAgents: boolean;
  favorites: { fixture_id: number }[];
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
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Agent states
  const [agentAnalysis, setAgentAnalysis] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  
  // UI states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // Labels
  const labels = {
    tr: {
      todayMatches: 'Maçlar',
      search: 'Takım ara...',
      allLeagues: 'Tüm Ligler',
      analyze: 'Analiz Et',
      analyzing: 'Analiz ediliyor...',
      aiAgents: 'AI Ajanları',
      standardAnalysis: 'AI Konsensüs',
      agentAnalysis: 'Ajan Analizi',
      noMatches: 'Maç bulunamadı',
      loading: 'Yükleniyor...',
      profile: 'Profil',
      settings: 'Ayarlar',
      logout: 'Çıkış Yap',
      pro: 'PRO',
      proMember: 'Pro Üye',
      trialMember: 'Deneme',
      upgradeToPro: "Pro'ya Geç",
      selectMatch: 'Analiz için maç seçin',
      matchResult: 'Maç Sonucu',
      overUnder: 'Üst/Alt 2.5',
      btts: 'KG Var/Yok',
      bestBet: 'En İyi Bahis',
      confidence: 'Güven',
      trialBanner: 'Deneme Süresi',
      daysLeft: 'gün kaldı',
      analysesUsed: 'analiz kullanıldı',
      trialExpired: 'Deneme Süresi Bitti',
      trialExpiredMsg: 'Devam etmek için Pro üyelik satın alın.',
      limitReached: 'Günlük limit doldu',
      goToPricing: "Pro'ya Geç",
      onlyPro: 'Sadece Pro',
      unlimitedAnalysis: 'Sınırsız analiz + AI Ajanları',
      weightedConsensus: 'Ağırlıklı Konsensüs',
      agentContributions: 'Agent Katkıları',
      aiConsensus: 'AI Konsensüs',
      modelVotes: 'Model Oyları',
      unanimous: 'Oybirliği',
      majority: 'Çoğunluk',
      split: 'Bölünmüş',
      riskLevel: 'Risk Seviyesi',
      overallAnalysis: 'Genel Analiz',
    },
    en: {
      todayMatches: 'Matches',
      search: 'Search team...',
      allLeagues: 'All Leagues',
      analyze: 'Analyze',
      analyzing: 'Analyzing...',
      aiAgents: 'AI Agents',
      standardAnalysis: 'AI Consensus',
      agentAnalysis: 'Agent Analysis',
      noMatches: 'No matches found',
      loading: 'Loading...',
      profile: 'Profile',
      settings: 'Settings',
      logout: 'Sign Out',
      pro: 'PRO',
      proMember: 'Pro Member',
      trialMember: 'Trial',
      upgradeToPro: 'Upgrade to Pro',
      selectMatch: 'Select a match to analyze',
      matchResult: 'Match Result',
      overUnder: 'Over/Under 2.5',
      btts: 'BTTS',
      bestBet: 'Best Bet',
      confidence: 'Confidence',
      trialBanner: 'Trial Period',
      daysLeft: 'days left',
      analysesUsed: 'analyses used',
      trialExpired: 'Trial Expired',
      trialExpiredMsg: 'Purchase Pro to continue using the platform.',
      limitReached: 'Daily limit reached',
      goToPricing: 'Go Pro',
      onlyPro: 'Pro Only',
      unlimitedAnalysis: 'Unlimited analyses + AI Agents',
      weightedConsensus: 'Weighted Consensus',
      agentContributions: 'Agent Contributions',
      aiConsensus: 'AI Consensus',
      modelVotes: 'Model Votes',
      unanimous: 'Unanimous',
      majority: 'Majority',
      split: 'Split',
      riskLevel: 'Risk Level',
      overallAnalysis: 'Overall Analysis',
    },
    de: {
      todayMatches: 'Spiele',
      search: 'Team suchen...',
      allLeagues: 'Alle Ligen',
      analyze: 'Analysieren',
      analyzing: 'Analysiere...',
      aiAgents: 'KI-Agenten',
      standardAnalysis: 'KI-Konsens',
      agentAnalysis: 'Agent-Analyse',
      noMatches: 'Keine Spiele gefunden',
      loading: 'Laden...',
      profile: 'Profil',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      pro: 'PRO',
      proMember: 'Pro-Mitglied',
      trialMember: 'Testversion',
      upgradeToPro: 'Pro werden',
      selectMatch: 'Wählen Sie ein Spiel',
      matchResult: 'Ergebnis',
      overUnder: 'Über/Unter 2.5',
      btts: 'Beide treffen',
      bestBet: 'Beste Wette',
      confidence: 'Konfidenz',
      trialBanner: 'Testversion',
      daysLeft: 'Tage übrig',
      analysesUsed: 'Analysen verwendet',
      trialExpired: 'Testversion abgelaufen',
      trialExpiredMsg: 'Kaufen Sie Pro, um fortzufahren.',
      limitReached: 'Tageslimit erreicht',
      goToPricing: 'Pro werden',
      onlyPro: 'Nur Pro',
      unlimitedAnalysis: 'Unbegrenzte Analysen + KI-Agenten',
      weightedConsensus: 'Gewichteter Konsens',
      agentContributions: 'Agent-Beiträge',
      aiConsensus: 'KI-Konsens',
      modelVotes: 'Modell-Stimmen',
      unanimous: 'Einstimmig',
      majority: 'Mehrheit',
      split: 'Geteilt',
      riskLevel: 'Risikostufe',
      overallAnalysis: 'Gesamtanalyse',
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

  // Standard Analysis
  const analyzeMatch = async (match: Match) => {
    if (!userProfile?.canAnalyze) {
      setAnalysisError(l.limitReached);
      return;
    }

    setSelectedMatch(match);
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
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
      
      if (!res.ok) {
        if (data.limitReached) {
          setAnalysisError(l.limitReached);
        } else if (data.trialExpired) {
          setAnalysisError(l.trialExpired);
        } else {
          setAnalysisError(data.error || 'Analysis failed');
        }
      } else if (data.success) {
        setAnalysis(data);
        fetchUserProfile();
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError('Network error');
    }
    setAnalyzing(false);
  };

  // Agent Analysis (Pro only)
  const runAgentAnalysis = async () => {
    if (!selectedMatch || !userProfile?.canUseAgents) return;
    
    setAgentMode(true);
    setAgentLoading(true);
    setAgentAnalysis(null);

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
      }
    } catch (error) {
      console.error('Agent error:', error);
    }
    setAgentLoading(false);
  };

  // Loading state
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

  // Trial Expired Block
  if (userProfile?.trialExpired && !userProfile?.isPro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur border border-gray-700 rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">⏰</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">{l.trialExpired}</h1>
          <p className="text-gray-400 mb-8">{l.trialExpiredMsg}</p>
          <Link href="/pricing" className="block w-full py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-xl">
            {l.goToPricing}
          </Link>
        </div>
      </div>
    );
  }

  // Get consensus data for agent analysis
  const getConsensusData = () => {
    if (!agentAnalysis?.reports) return null;
    return agentAnalysis.reports.weightedConsensus || agentAnalysis.reports.consensus || null;
  };

  const consensusData = getConsensusData();

  // Helper: Get vote status text
  const getVoteStatus = (votes: number, total: number) => {
    if (votes === total) return { text: l.unanimous, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (votes >= total * 0.75) return { text: l.majority, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    return { text: l.split, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  };

  // Helper: Get risk level color
  const getRiskColor = (risk: string) => {
    const r = risk?.toLowerCase();
    if (r === 'low') return 'text-green-400 bg-green-500/20';
    if (r === 'medium') return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-xl">⚽</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Football Analytics</h1>
                {userProfile?.isPro && (
                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] font-bold rounded text-black">PRO</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!userProfile?.isPro && (
                <Link href="/pricing" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold rounded-xl">
                  ⭐ {l.upgradeToPro}
                </Link>
              )}
              <LanguageSelector />
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm text-white">{session.user?.name}</span>
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50">
                    <div className="p-4 border-b border-gray-700">
                      <div className="font-medium text-white">{session.user?.name}</div>
                      <div className="text-sm text-gray-400">{session.user?.email}</div>
                    </div>
                    <div className="py-2">
                      <Link href="/profile" className="block px-4 py-2 text-gray-300 hover:bg-gray-700/50">{l.profile}</Link>
                      {!userProfile?.isPro && (
                        <Link href="/pricing" className="block px-4 py-2 text-yellow-400 hover:bg-gray-700/50">{l.upgradeToPro}</Link>
                      )}
                    </div>
                    <div className="border-t border-gray-700 py-2">
                      <button onClick={() => signOut({ callbackUrl: '/login' })} className="block w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700/50">
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
        {/* Trial Banner */}
        {userProfile?.isTrial && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/10 to-orange-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <div className="text-white font-bold">{l.trialBanner}: {userProfile.trialDaysLeft} {l.daysLeft}</div>
                <div className="text-sm text-gray-400">{userProfile.analysesUsed}/{userProfile.analysesLimit} {l.analysesUsed}</div>
              </div>
            </div>
            <Link href="/pricing" className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-xl">
              🚀 {l.goToPricing}
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-700/50 text-white px-3 py-2 rounded-xl outline-none"
            />
            <input
              type="text"
              placeholder={l.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] bg-gray-700/50 text-white placeholder-gray-500 px-4 py-2 rounded-xl outline-none"
            />
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-gray-700/50 text-white px-4 py-2 rounded-xl outline-none"
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
            
            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-700/50">
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
                filteredMatches.map((match) => (
                  <div
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`p-4 hover:bg-gray-700/30 cursor-pointer transition-all ${
                      selectedMatch?.id === match.id ? 'bg-green-500/10 border-l-2 border-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white">{match.homeTeam} vs {match.awayTeam}</div>
                        <div className="text-sm text-gray-400 mt-1">{match.league}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); analyzeMatch(match); }}
                        disabled={analyzing || !userProfile?.canAnalyze}
                        className={`px-3 py-2 rounded-lg ${userProfile?.canAnalyze ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 opacity-50'}`}
                      >
                        {analyzing && selectedMatch?.id === match.id ? '⏳' : '🤖'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl overflow-hidden">
            {selectedMatch ? (
              <>
                {/* Match Header */}
                <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-green-500/10 to-blue-500/10">
                  <h2 className="text-xl font-bold text-white">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</h2>
                  <p className="text-sm text-gray-400">{selectedMatch.league}</p>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-b border-gray-700/50">
                  <div className="flex gap-3">
                    <button
                      onClick={() => analyzeMatch(selectedMatch)}
                      disabled={analyzing || !userProfile?.canAnalyze}
                      className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                        userProfile?.canAnalyze ? 'bg-gradient-to-r from-green-600 to-green-500' : 'bg-gray-700 opacity-50'
                      }`}
                    >
                      🤖 {analyzing ? l.analyzing : l.analyze}
                    </button>
                    <button
                      onClick={runAgentAnalysis}
                      disabled={agentLoading || !userProfile?.canUseAgents}
                      className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                        userProfile?.canUseAgents ? 'bg-gradient-to-r from-purple-600 to-pink-500' : 'bg-gray-700 opacity-50'
                      }`}
                    >
                      🧠 {agentLoading ? '...' : l.aiAgents}
                      {!userProfile?.canUseAgents && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">PRO</span>}
                    </button>
                  </div>
                </div>

                {/* Analysis Content */}
                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {analysisError && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-red-400">{analysisError}</p>
                      <Link href="/pricing" className="text-yellow-400 hover:underline text-sm">{l.goToPricing} →</Link>
                    </div>
                  )}

                  {(analyzing || agentLoading) ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-400">{l.analyzing}</p>
                    </div>
                  ) : analysis || agentAnalysis ? (
                    <div className="space-y-4">
                      {/* Tabs */}
                      {agentAnalysis && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAgentMode(false)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${!agentMode ? 'bg-green-600 text-white' : 'bg-gray-700/50 text-gray-400'}`}
                          >
                            {l.standardAnalysis}
                          </button>
                          <button
                            onClick={() => setAgentMode(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${agentMode ? 'bg-purple-600 text-white' : 'bg-gray-700/50 text-gray-400'}`}
                          >
                            {l.agentAnalysis}
                          </button>
                        </div>
                      )}

                      {/* ============ STANDARD ANALYSIS - DETAILED ============ */}
                      {!agentMode && analysis && (
                        <div className="space-y-4">
                          {/* AI Model Status */}
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { key: 'claude', label: 'Claude', icon: '🟣' },
                              { key: 'openai', label: 'GPT-4', icon: '🟢' },
                              { key: 'gemini', label: 'Gemini', icon: '🔵' },
                              { key: 'heurist', label: 'Heurist', icon: '🟠' },
                            ].map((model) => (
                              <div key={model.key} className={`p-2 rounded-lg text-center ${
                                analysis.aiStatus?.[model.key] ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                              }`}>
                                <div className="text-lg">{model.icon}</div>
                                <div className={`text-xs font-medium ${analysis.aiStatus?.[model.key] ? 'text-green-400' : 'text-red-400'}`}>
                                  {model.label} {analysis.aiStatus?.[model.key] ? '✓' : '✗'}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* AI Consensus Header */}
                          <div className="text-center py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div className="text-xs text-green-400">
                              🤖 {l.aiConsensus}: 4 AI Models Voting
                            </div>
                          </div>

                          {/* Predictions Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Match Result */}
                            {analysis.analysis?.matchResult && (
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.matchResult}</div>
                                <div className="text-3xl font-bold text-blue-400">{analysis.analysis.matchResult.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.matchResult.confidence}%</div>
                                {analysis.analysis.matchResult.votes && (
                                  <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                                    getVoteStatus(analysis.analysis.matchResult.votes, analysis.analysis.matchResult.totalVotes || 4).bg
                                  } ${getVoteStatus(analysis.analysis.matchResult.votes, analysis.analysis.matchResult.totalVotes || 4).color}`}>
                                    {analysis.analysis.matchResult.votes}/{analysis.analysis.matchResult.totalVotes || 4} {l.modelVotes}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Over/Under */}
                            {analysis.analysis?.overUnder25 && (
                              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.overUnder}</div>
                                <div className="text-3xl font-bold text-green-400">{analysis.analysis.overUnder25.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.overUnder25.confidence}%</div>
                                {analysis.analysis.overUnder25.votes && (
                                  <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                                    getVoteStatus(analysis.analysis.overUnder25.votes, analysis.analysis.overUnder25.totalVotes || 4).bg
                                  } ${getVoteStatus(analysis.analysis.overUnder25.votes, analysis.analysis.overUnder25.totalVotes || 4).color}`}>
                                    {analysis.analysis.overUnder25.votes}/{analysis.analysis.overUnder25.totalVotes || 4} {l.modelVotes}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* BTTS */}
                            {analysis.analysis?.btts && (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.btts}</div>
                                <div className="text-3xl font-bold text-orange-400">{analysis.analysis.btts.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.btts.confidence}%</div>
                                {analysis.analysis.btts.votes && (
                                  <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                                    getVoteStatus(analysis.analysis.btts.votes, analysis.analysis.btts.totalVotes || 4).bg
                                  } ${getVoteStatus(analysis.analysis.btts.votes, analysis.analysis.btts.totalVotes || 4).color}`}>
                                    {analysis.analysis.btts.votes}/{analysis.analysis.btts.totalVotes || 4} {l.modelVotes}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Risk Level */}
                            {analysis.analysis?.riskLevel && (
                              <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-3">
                                <div className="text-xs text-gray-400">{l.riskLevel}</div>
                                <div className={`text-2xl font-bold ${getRiskColor(analysis.analysis.riskLevel).split(' ')[0]}`}>
                                  {analysis.analysis.riskLevel}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Best Bet */}
                          {analysis.analysis?.bestBets?.[0] && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                              <div className="text-sm text-yellow-400 mb-2">💰 {l.bestBet}</div>
                              <div className="font-bold text-white text-lg">
                                {analysis.analysis.bestBets[0].type}: {analysis.analysis.bestBets[0].selection}
                              </div>
                              <div className="text-sm text-gray-300">{analysis.analysis.bestBets[0].confidence}% {l.confidence}</div>
                              {analysis.analysis.bestBets[0].reasoning && (
                                <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-800/50 rounded-lg">
                                  {analysis.analysis.bestBets[0].reasoning}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Individual Model Predictions */}
                          {analysis.individualAnalyses && (
                            <div className="space-y-2">
                              <div className="text-sm text-gray-400 font-medium">🔍 Individual AI Predictions:</div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(analysis.individualAnalyses).map(([model, pred]: [string, any]) => (
                                  <div key={model} className="bg-gray-700/30 rounded-lg p-2 text-xs">
                                    <div className="font-medium text-white capitalize mb-1">
                                      {model === 'openai' ? 'GPT-4' : model}
                                    </div>
                                    <div className="space-y-0.5 text-gray-400">
                                      <div>Result: <span className="text-blue-400">{pred.matchResult?.prediction}</span></div>
                                      <div>O/U: <span className="text-green-400">{pred.overUnder25?.prediction}</span></div>
                                      <div>BTTS: <span className="text-orange-400">{pred.btts?.prediction}</span></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Overall Analysis */}
                          {analysis.analysis?.overallAnalyses?.[0] && (
                            <div className="bg-gray-700/30 rounded-xl p-4">
                              <div className="text-sm text-gray-400 mb-2">📝 {l.overallAnalysis}</div>
                              <p className="text-sm text-gray-300">{analysis.analysis.overallAnalyses[0]}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ============ AGENT ANALYSIS ============ */}
                      {agentMode && agentAnalysis && (
                        <div className="space-y-4">
                          {/* Agent Status */}
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { key: 'scout', label: 'Scout', weight: '', icon: '🔍' },
                              { key: 'stats', label: 'Stats', weight: '40%', icon: '📊' },
                              { key: 'odds', label: 'Odds', weight: '35%', icon: '💰' },
                              { key: 'strategy', label: 'Strategy', weight: '25%', icon: '🧠' },
                            ].map((agent) => (
                              <div key={agent.key} className={`p-2 rounded-lg text-center ${
                                agentAnalysis.reports?.[agent.key] ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                              }`}>
                                <div className="text-lg">{agent.icon}</div>
                                <div className={`text-xs font-medium ${agentAnalysis.reports?.[agent.key] ? 'text-green-400' : 'text-red-400'}`}>
                                  {agent.label} {agentAnalysis.reports?.[agent.key] ? '✓' : '✗'}
                                </div>
                                {agent.weight && (
                                  <div className="text-[10px] text-purple-400 font-bold">{agent.weight}</div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Weighted Consensus Header */}
                          {consensusData && (
                            <div className="text-center py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                              <div className="text-xs text-purple-400">
                                ⚖️ {l.weightedConsensus}: Stats 40% + Odds 35% + Strategy 25%
                              </div>
                            </div>
                          )}

                          {/* Consensus Results */}
                          {consensusData && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                {(consensusData.matchResult || consensusData.matchWinner) && (
                                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                                    <div className="text-xs text-gray-400">{l.matchResult}</div>
                                    <div className="text-3xl font-bold text-blue-400">
                                      {consensusData.matchResult?.prediction || consensusData.matchWinner?.prediction}
                                    </div>
                                    <div className="text-sm text-gray-300">
                                      {consensusData.matchResult?.confidence || consensusData.matchWinner?.confidence}%
                                    </div>
                                  </div>
                                )}
                                {(consensusData.overUnder || consensusData.overUnder25) && (
                                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                    <div className="text-xs text-gray-400">{l.overUnder}</div>
                                    <div className="text-3xl font-bold text-green-400">
                                      {consensusData.overUnder?.prediction || consensusData.overUnder25?.prediction}
                                    </div>
                                    <div className="text-sm text-gray-300">
                                      {consensusData.overUnder?.confidence || consensusData.overUnder25?.confidence}%
                                    </div>
                                  </div>
                                )}
                                {consensusData.btts && (
                                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                                    <div className="text-xs text-gray-400">{l.btts}</div>
                                    <div className="text-3xl font-bold text-orange-400">{consensusData.btts.prediction}</div>
                                    <div className="text-sm text-gray-300">{consensusData.btts.confidence}%</div>
                                  </div>
                                )}
                              </div>

                              {/* Best Bet */}
                              {consensusData.bestBet && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                  <div className="text-sm text-yellow-400 mb-2">💰 {l.bestBet}</div>
                                  <div className="font-bold text-white text-lg">
                                    {consensusData.bestBet.type}: {consensusData.bestBet.selection}
                                  </div>
                                  <div className="text-sm text-gray-300">{consensusData.bestBet.confidence}% {l.confidence}</div>
                                  {consensusData.bestBet.reasoning && (
                                    <div className="text-xs text-gray-400 mt-2">{consensusData.bestBet.reasoning}</div>
                                  )}
                                </div>
                              )}

                              {/* Agent Contributions */}
                              {consensusData.agentContributions && (
                                <div className="bg-gray-700/30 rounded-xl p-3">
                                  <div className="text-xs text-gray-400 mb-2">{l.agentContributions}:</div>
                                  <div className="grid grid-cols-3 gap-2 text-sm text-center">
                                    <div><span className="text-green-400">📊 Stats</span><div className="text-white font-bold">40%</div></div>
                                    <div><span className="text-yellow-400">💰 Odds</span><div className="text-white font-bold">35%</div></div>
                                    <div><span className="text-purple-400">🧠 Strategy</span><div className="text-white font-bold">25%</div></div>
                                  </div>
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

      {showProfileMenu && <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>}
    </div>
  );
}
