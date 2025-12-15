'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DailyCoupons from '@/components/DailyCoupons';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import AgentReports from '@/components/AgentReports';
import AgentLoadingProgress from '@/components/AgentLoadingProgress';
import AIConsensusLoading from '@/components/AIConsensusLoading';  // ← YENİ IMPORT

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamLogo?: string;  
  awayTeamLogo?: string;  
  league: string;
  leagueLogo?: string;    
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
  totalPoints?: number;
  rank?: number;
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
  const [activeNav, setActiveNav] = useState('matches');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Labels - aynı kalıyor...
  const labels = {
    tr: {
      matches: 'Maçlar',
      coupons: 'Kuponlar',
      leaderboard: 'Liderlik',
      createCoupon: 'Kupon Oluştur',
      todayMatches: 'Günün Maçları',
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
      addToCoupon: 'Kupona Ekle',
      added: 'Eklendi',
      yourPoints: 'Puanınız',
      yourRank: 'Sıralamanız',
      activeCoupons: 'Aktif Kupon',
      monthlyPrize: 'Aylık Ödül',
      prizeDesc: 'En çok puan toplayın, 1 ay Pro kazanın!',
      viewAll: 'Tümünü Gör',
      noCoupons: 'Henüz kupon yok',
      startPredicting: 'Tahmin yapmaya başla!',
    },
    en: {
      matches: 'Matches',
      coupons: 'Coupons',
      leaderboard: 'Leaderboard',
      createCoupon: 'Create Coupon',
      todayMatches: 'Today\'s Matches',
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
      addToCoupon: 'Add to Coupon',
      added: 'Added',
      yourPoints: 'Your Points',
      yourRank: 'Your Rank',
      activeCoupons: 'Active Coupons',
      monthlyPrize: 'Monthly Prize',
      prizeDesc: 'Top scorer wins 1 month Pro!',
      viewAll: 'View All',
      noCoupons: 'No coupons yet',
      startPredicting: 'Start predicting!',
    },
    de: {
      matches: 'Spiele',
      coupons: 'Wettscheine',
      leaderboard: 'Rangliste',
      createCoupon: 'Erstellen',
      todayMatches: 'Heutige Spiele',
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
      addToCoupon: 'Zum Wettschein',
      added: 'Hinzugefügt',
      yourPoints: 'Ihre Punkte',
      yourRank: 'Ihr Rang',
      activeCoupons: 'Aktive Scheine',
      monthlyPrize: 'Monatspreis',
      prizeDesc: 'Topscorer gewinnt 1 Monat Pro!',
      viewAll: 'Alle anzeigen',
      noCoupons: 'Keine Wettscheine',
      startPredicting: 'Starten Sie!',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      setUserProfile(data);
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  };

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

  const leagues = Array.from(new Set(matches.map((m) => m.league)));

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

  const addToCoupon = (betType: string, selection: string, odds: number) => {
    if (!selectedMatch) return;
    
    const pick = {
      fixtureId: selectedMatch.id,
      homeTeam: selectedMatch.homeTeam,
      awayTeam: selectedMatch.awayTeam,
      league: selectedMatch.league,
      matchDate: selectedMatch.date,
      betType,
      selection,
      odds,
    };
    
    const existingPicks = JSON.parse(sessionStorage.getItem('pendingCouponPicks') || '[]');
    const exists = existingPicks.some(
      (p: any) => p.fixtureId === pick.fixtureId && p.betType === pick.betType
    );
    
    if (!exists) {
      existingPicks.push(pick);
      sessionStorage.setItem('pendingCouponPicks', JSON.stringify(existingPicks));
    }
    
    router.push('/coupons/create');
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

  const getVoteStatus = (votes: number, total: number) => {
    if (votes === total) return { text: l.unanimous, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (votes >= total * 0.75) return { text: l.majority, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    return { text: l.split, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  };

  const getRiskColor = (risk: string) => {
    const r = risk?.toLowerCase();
    if (r === 'low') return 'text-green-400 bg-green-500/20';
    if (r === 'medium') return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getModelName = (model: string) => {
    switch (model) {
      case 'openai': return 'GPT-4';
      case 'claude': return 'Claude';
      case 'gemini': return 'Gemini';
      case 'perplexity': return 'Perplexity';
      default: return model;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* HEADER - Aynı kalıyor */}
      <header className="bg-gray-900/90 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-xl">⚽</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">Football Analytics</h1>
                <div className="flex items-center gap-2">
                  {userProfile?.isPro ? (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] font-bold rounded text-black">PRO</span>
                  ) : userProfile?.isTrial ? (
                    <span className="text-xs text-gray-400">{userProfile.trialDaysLeft} {l.daysLeft}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <Link href="/dashboard" className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${activeNav === 'matches' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} onClick={() => setActiveNav('matches')}>
                <span>📅</span> {l.matches}
              </Link>
              <Link href="/coupons" className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <span>🎫</span> {l.coupons}
              </Link>
              <Link href="/leaderboard" className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <span>🏆</span> {l.leaderboard}
              </Link>
              <Link href="/coupons/create" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all ml-2">
                <span>➕</span> {l.createCoupon}
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              {!userProfile?.isPro && (
                <Link href="/pricing" className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400">
                  ⭐ {l.upgradeToPro}
                </Link>
              )}
              
              <LanguageSelector />
              
              <div className="relative">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm text-white">{session.user?.name?.split(' ')[0]}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10">
                      <div className="font-semibold text-white">{session.user?.name}</div>
                      <div className="text-sm text-gray-400">{session.user?.email}</div>
                      {userProfile?.totalPoints !== undefined && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-yellow-400">🏆</span>
                          <span className="text-white font-bold">{userProfile.totalPoints?.toFixed(1)} pts</span>
                        </div>
                      )}
                    </div>
                    <div className="py-2">
                      <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <span>👤</span> {l.profile}
                      </Link>
                      <Link href="/coupons" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <span>🎫</span> {l.coupons}
                      </Link>
                      <Link href="/leaderboard" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <span>🏆</span> {l.leaderboard}
                      </Link>
                      {!userProfile?.isPro && (
                        <Link href="/pricing" className="flex items-center gap-3 px-4 py-3 text-yellow-400 hover:bg-gray-700/50 transition-colors">
                          <span>⭐</span> {l.upgradeToPro}
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-gray-700 py-2">
                      <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-gray-700/50 transition-colors">
                        <span>🚪</span> {l.logout}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden p-2 text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur-xl">
            <nav className="flex flex-col p-4 gap-2">
              <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/20 text-green-400 font-medium" onClick={() => setShowMobileMenu(false)}>
                <span>📅</span> {l.matches}
              </Link>
              <Link href="/coupons" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-800" onClick={() => setShowMobileMenu(false)}>
                <span>🎫</span> {l.coupons}
              </Link>
              <Link href="/leaderboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-800" onClick={() => setShowMobileMenu(false)}>
                <span>🏆</span> {l.leaderboard}
              </Link>
              <Link href="/coupons/create" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium" onClick={() => setShowMobileMenu(false)}>
                <span>➕</span> {l.createCoupon}
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {userProfile?.isTrial && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/10 to-orange-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <div className="text-white font-bold">{l.trialBanner}: {userProfile.trialDaysLeft} {l.daysLeft}</div>
                <div className="text-sm text-gray-400">{userProfile.analysesUsed}/{userProfile.analysesLimit} {l.analysesUsed}</div>
              </div>
            </div>
            <Link href="/pricing" className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-xl hover:from-green-500 hover:to-green-400 transition-all">
              🚀 {l.goToPricing}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <p className="text-sm text-gray-400">{l.yourPoints}</p>
                <p className="text-2xl font-bold text-yellow-400">{userProfile?.totalPoints?.toFixed(1) || '0'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-400">{l.yourRank}</p>
                <p className="text-2xl font-bold text-blue-400">#{userProfile?.rank || '-'}</p>
              </div>
            </div>
          </div>

          <Link href="/leaderboard" className="col-span-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4 hover:from-purple-600/30 hover:to-pink-600/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🎁</span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">{l.monthlyPrize}</p>
                  <p className="text-white font-semibold">{l.prizeDesc}</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </Link>
        </div>

        <div className="mb-6">
          <DailyCoupons />
        </div>

        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-gray-700/50 text-white px-4 py-2.5 rounded-xl outline-none border border-gray-600/50 focus:border-green-500/50 transition-colors" />
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              <input type="text" placeholder={l.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-700/50 text-white placeholder-gray-500 pl-12 pr-4 py-2.5 rounded-xl outline-none border border-gray-600/50 focus:border-green-500/50 transition-colors" />
            </div>
            <select value={selectedLeague} onChange={(e) => setSelectedLeague(e.target.value)} className="bg-gray-700/50 text-white px-4 py-2.5 rounded-xl outline-none border border-gray-600/50 focus:border-green-500/50 transition-colors">
              <option value="all">{l.allLeagues}</option>
              {leagues.map((league) => (
                <option key={league} value={league}>{league}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* MATCHES LIST - LOGOLU YENİ TASARIM */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📅 {l.todayMatches}
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-sm rounded-full">{filteredMatches.length}</span>
              </h2>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-700/50">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-lg">{l.noMatches}</p>
                </div>
              ) : (
                filteredMatches.map((match) => (
                  <div 
                    key={match.id} 
                    onClick={() => setSelectedMatch(match)} 
                    className={`p-4 hover:bg-gray-700/30 cursor-pointer transition-all ${
                      selectedMatch?.id === match.id ? 'bg-green-500/10 border-l-4 border-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Team Logos & Names */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {/* Home Team */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {match.homeTeamLogo ? (
                              <img 
                                src={match.homeTeamLogo} 
                                alt="" 
                                className="w-8 h-8 object-contain flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                {match.homeTeam.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-white truncate">{match.homeTeam}</span>
                          </div>
                          
                          <span className="text-gray-500 text-sm flex-shrink-0">vs</span>
                          
                          {/* Away Team */}
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            <span className="font-semibold text-white truncate text-right">{match.awayTeam}</span>
                            {match.awayTeamLogo ? (
                              <img 
                                src={match.awayTeamLogo} 
                                alt="" 
                                className="w-8 h-8 object-contain flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                {match.awayTeam.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* League & Time */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {match.leagueLogo && (
                              <img 
                                src={match.leagueLogo} 
                                alt="" 
                                className="w-4 h-4 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <span className="text-sm text-gray-400 truncate max-w-[150px]">{match.league}</span>
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded flex-shrink-0">
                            {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      
                      {/* Analyze Button */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); analyzeMatch(match); }} 
                        disabled={analyzing || !userProfile?.canAnalyze} 
                        className={`px-4 py-3 rounded-xl font-medium transition-all flex flex-col items-center gap-1 flex-shrink-0 ${
                          userProfile?.canAnalyze 
                            ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg shadow-green-500/20' 
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {analyzing && selectedMatch?.id === match.id ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="text-lg">🤖</span>
                            <span className="text-xs">{l.analyze}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ANALYSIS PANEL */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl overflow-hidden">
            {selectedMatch ? (
              <>
                {/* Header with Team Logos */}
                <div className="p-5 border-b border-gray-700/50 bg-gradient-to-r from-green-500/10 to-blue-500/10">
                  <div className="flex items-center justify-center gap-4">
                    {/* Home Team */}
                    <div className="flex items-center gap-2">
                      {selectedMatch.homeTeamLogo ? (
                        <img 
                          src={selectedMatch.homeTeamLogo} 
                          alt="" 
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-lg font-bold text-white">
                          {selectedMatch.homeTeam.charAt(0)}
                        </div>
                      )}
                      <span className="font-bold text-white text-lg">{selectedMatch.homeTeam}</span>
                    </div>
                    
                    <span className="text-gray-400 font-bold">vs</span>
                    
                    {/* Away Team */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">{selectedMatch.awayTeam}</span>
                      {selectedMatch.awayTeamLogo ? (
                        <img 
                          src={selectedMatch.awayTeamLogo} 
                          alt="" 
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-lg font-bold text-white">
                          {selectedMatch.awayTeam.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-2">
                    {selectedMatch.leagueLogo && (
                      <img 
                        src={selectedMatch.leagueLogo} 
                        alt="" 
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-sm text-gray-400">{selectedMatch.league}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(selectedMatch.date).toLocaleString(lang, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="p-4 border-b border-gray-700/50">
                  <div className="flex gap-3">
                    <button onClick={() => analyzeMatch(selectedMatch)} disabled={analyzing || !userProfile?.canAnalyze} className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${userProfile?.canAnalyze ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                      🤖 {analyzing ? l.analyzing : l.analyze}
                    </button>
                    <button onClick={runAgentAnalysis} disabled={agentLoading || !userProfile?.canUseAgents} className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${userProfile?.canUseAgents ? 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                      🧠 {agentLoading ? '...' : l.aiAgents}
                      {!userProfile?.canUseAgents && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">PRO</span>}
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {analysisError && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-red-400 font-medium">{analysisError}</p>
                      <Link href="/pricing" className="text-yellow-400 hover:underline text-sm mt-2 inline-block">{l.goToPricing} →</Link>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* YENİ LOADING STATE - AIConsensusLoading */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {(analyzing || agentLoading) ? (
                    agentLoading ? (
                      <AgentLoadingProgress isLoading={true} />
                    ) : (
                      <AIConsensusLoading 
                        isLoading={true}
                        homeTeam={selectedMatch.homeTeam}
                        awayTeam={selectedMatch.awayTeam}
                        homeTeamLogo={selectedMatch.homeTeamLogo}
                        awayTeamLogo={selectedMatch.awayTeamLogo}
                        language={lang as 'tr' | 'en' | 'de'}
                      />
                    )
                  ) : (analysis || agentAnalysis) ? (
                    <div className="space-y-4">
                      {agentAnalysis && (
                        <div className="flex gap-2 p-1 bg-gray-700/30 rounded-xl">
                          <button onClick={() => setAgentMode(false)} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!agentMode ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                            {l.standardAnalysis}
                          </button>
                          <button onClick={() => setAgentMode(true)} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${agentMode ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                            {l.agentAnalysis}
                          </button>
                        </div>
                      )}

                      {!agentMode && analysis && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { key: 'claude', label: 'Claude', icon: '🟣' },
                              { key: 'openai', label: 'GPT-4', icon: '🟢' },
                              { key: 'gemini', label: 'Gemini', icon: '🔵' },
                              { key: 'perplexity', label: 'Perplexity', icon: '🟠' },
                            ].map((model) => (
                              <div key={model.key} className={`p-2 rounded-xl text-center transition-all ${analysis.aiStatus?.[model.key] ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                                <div className="text-lg">{model.icon}</div>
                                <div className={`text-xs font-medium ${analysis.aiStatus?.[model.key] ? 'text-green-400' : 'text-red-400'}`}>
                                  {model.label} {analysis.aiStatus?.[model.key] ? '✓' : '✗'}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="text-center py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div className="text-sm text-green-400 font-medium">🤖 {l.aiConsensus}: 4 AI Models Voting</div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {analysis.analysis?.matchResult && (
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 hover:bg-blue-500/15 transition-all">
                                <div className="text-xs text-gray-400 mb-1">{l.matchResult}</div>
                                <div className="text-3xl font-bold text-blue-400">{analysis.analysis.matchResult.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.matchResult.confidence}%</div>
                                {analysis.analysis.matchResult.votes && (
                                  <div className={`text-xs mt-2 px-2 py-1 rounded-lg inline-block ${getVoteStatus(analysis.analysis.matchResult.votes, analysis.analysis.matchResult.totalVotes || 4).bg} ${getVoteStatus(analysis.analysis.matchResult.votes, analysis.analysis.matchResult.totalVotes || 4).color}`}>
                                    {analysis.analysis.matchResult.votes}/{analysis.analysis.matchResult.totalVotes || 4} {l.modelVotes}
                                  </div>
                                )}
                                <button onClick={() => addToCoupon('MATCH_RESULT', analysis.analysis.matchResult.prediction, 1.85)} className="mt-3 w-full py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 rounded-lg text-xs font-medium transition-all">
                                  ➕ {l.addToCoupon}
                                </button>
                              </div>
                            )}

                            {analysis.analysis?.overUnder25 && (
                              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 hover:bg-green-500/15 transition-all">
                                <div className="text-xs text-gray-400 mb-1">{l.overUnder}</div>
                                <div className="text-3xl font-bold text-green-400">{analysis.analysis.overUnder25.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.overUnder25.confidence}%</div>
                                {analysis.analysis.overUnder25.votes && (
                                  <div className={`text-xs mt-2 px-2 py-1 rounded-lg inline-block ${getVoteStatus(analysis.analysis.overUnder25.votes, analysis.analysis.overUnder25.totalVotes || 4).bg} ${getVoteStatus(analysis.analysis.overUnder25.votes, analysis.analysis.overUnder25.totalVotes || 4).color}`}>
                                    {analysis.analysis.overUnder25.votes}/{analysis.analysis.overUnder25.totalVotes || 4} {l.modelVotes}
                                  </div>
                                )}
                                <button onClick={() => addToCoupon('OVER_UNDER_25', analysis.analysis.overUnder25.prediction, 1.90)} className="mt-3 w-full py-2 bg-green-600/30 hover:bg-green-600/50 text-green-400 rounded-lg text-xs font-medium transition-all">
                                  ➕ {l.addToCoupon}
                                </button>
                              </div>
                            )}

                            {analysis.analysis?.btts && (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 hover:bg-orange-500/15 transition-all">
                                <div className="text-xs text-gray-400 mb-1">{l.btts}</div>
                                <div className="text-3xl font-bold text-orange-400">{analysis.analysis.btts.prediction}</div>
                                <div className="text-sm text-gray-300">{analysis.analysis.btts.confidence}%</div>
                                {analysis.analysis.btts.votes && (
                                  <div className={`text-xs mt-2 px-2 py-1 rounded-lg inline-block ${getVoteStatus(analysis.analysis.btts.votes, analysis.analysis.btts.totalVotes || 4).bg} ${getVoteStatus(analysis.analysis.btts.votes, analysis.analysis.btts.totalVotes || 4).color}`}>
                                    {analysis.analysis.btts.votes}/{analysis.analysis.btts.totalVotes || 4} {l.modelVotes}
                                  </div>
                                )}
                                <button onClick={() => addToCoupon('BTTS', analysis.analysis.btts.prediction, 1.80)} className="mt-3 w-full py-2 bg-orange-600/30 hover:bg-orange-600/50 text-orange-400 rounded-lg text-xs font-medium transition-all">
                                  ➕ {l.addToCoupon}
                                </button>
                              </div>
                            )}

                            {analysis.analysis?.riskLevel && (
                              <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-1">{l.riskLevel}</div>
                                <div className={`text-2xl font-bold ${getRiskColor(analysis.analysis.riskLevel).split(' ')[0]}`}>
                                  {analysis.analysis.riskLevel}
                                </div>
                              </div>
                            )}
                          </div>

                          {analysis.analysis?.bestBets?.[0] && (
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm text-yellow-400 mb-1 font-medium">💰 {l.bestBet}</div>
                                  <div className="font-bold text-white text-xl">{analysis.analysis.bestBets[0].type}: {analysis.analysis.bestBets[0].selection}</div>
                                  <div className="text-sm text-gray-300 mt-1">{analysis.analysis.bestBets[0].confidence}% {l.confidence}</div>
                                </div>
                                <button onClick={() => addToCoupon(analysis.analysis.bestBets[0].type, analysis.analysis.bestBets[0].selection, 1.85)} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all">
                                  ➕ {l.addToCoupon}
                                </button>
                              </div>
                              {analysis.analysis.bestBets[0].reasoning && (
                                <div className="text-sm text-gray-400 mt-3 p-3 bg-gray-800/50 rounded-lg">{analysis.analysis.bestBets[0].reasoning}</div>
                              )}
                            </div>
                          )}

                          {analysis.individualAnalyses && (
                            <div className="space-y-2">
                              <div className="text-sm text-gray-400 font-medium">🔍 Individual AI Predictions:</div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(analysis.individualAnalyses)
                                  .filter(([_, pred]) => pred !== null && pred !== undefined)
                                  .map(([model, rawPred]: [string, any]) => {
                                    const pred = Array.isArray(rawPred) ? rawPred[0] : rawPred;
                                    return (
                                      <div key={model} className="bg-gray-700/30 rounded-xl p-3 text-xs">
                                        <div className="font-semibold text-white capitalize mb-2">{getModelName(model)}</div>
                                        <div className="space-y-1 text-gray-400">
                                          <div className="flex justify-between">
                                            <span>Result:</span>
                                            <span className="text-blue-400 font-medium">{pred?.matchResult?.prediction || '-'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>O/U:</span>
                                            <span className="text-green-400 font-medium">{pred?.overUnder25?.prediction || '-'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>BTTS:</span>
                                            <span className="text-orange-400 font-medium">{pred?.btts?.prediction || '-'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                          {analysis.analysis?.overallAnalyses?.[0] && (
                            <div className="bg-gray-700/30 rounded-xl p-4">
                              <div className="text-sm text-gray-400 mb-2 font-medium">📝 {l.overallAnalysis}</div>
                              <p className="text-sm text-gray-300 leading-relaxed">{analysis.analysis.overallAnalyses[0]}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {agentMode && agentAnalysis && (
                        <AgentReports 
                          reports={agentAnalysis.reports}
                          homeTeam={selectedMatch.homeTeam}
                          awayTeam={selectedMatch.awayTeam}
                          language={lang as 'tr' | 'en' | 'de'}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-gray-400">
                      <div className="text-6xl mb-4">🤖</div>
                      <p className="text-lg">{l.selectMatch}</p>
                      <p className="text-sm text-gray-500 mt-2">Click &quot;Analyze&quot; to get AI predictions</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[600px] text-gray-400">
                <div className="text-center">
                  <div className="text-7xl mb-4">⚽</div>
                  <p className="text-xl font-medium">{l.selectMatch}</p>
                  <p className="text-sm text-gray-500 mt-2">Choose a match from the list to analyze</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {(showProfileMenu || showMobileMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowProfileMenu(false); setShowMobileMenu(false); }} />
      )}
    </div>
  );
}
