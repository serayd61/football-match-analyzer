'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import AgentReports from '@/components/AgentReports';
import AgentLoadingProgress from '@/components/AgentLoadingProgress';
import AIConsensusLoading from '@/components/AIConsensusLoading';
import MobileBottomNav from '@/components/MobileBottomNav';
import DashboardWidgets from '@/components/DashboardWidgets';
import ProfessionalBetting from '@/components/ProfessionalBetting';

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

// ============================================================================
// AI MODEL CONFIGURATION
// ============================================================================

const AI_MODELS: Record<string, { 
  name: string; 
  icon: string; 
  color: string; 
  bgColor: string; 
  borderColor: string;
  role: string;
}> = {
  claude: {
    name: 'Claude',
    icon: '🧠',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    role: 'Tactical'
  },
  openai: {
    name: 'GPT-4',
    icon: '📊',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    role: 'Statistical'
  },
  gemini: {
    name: 'Gemini',
    icon: '🔍',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    role: 'Pattern'
  },
  mistral: {
    name: 'Mistral',
    icon: '📰',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    role: 'Context'
  }
};

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
  
  // Quad-Brain states
  const [quadBrainAnalysis, setQuadBrainAnalysis] = useState<any>(null);
  const [quadBrainLoading, setQuadBrainLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'standard' | 'quadbrain' | 'agents' | 'deepseek'>('standard');
  
  // DeepSeek Master states
  const [deepSeekMasterAnalysis, setDeepSeekMasterAnalysis] = useState<any>(null);
  const [deepSeekLoading, setDeepSeekLoading] = useState(false);
  
  // UI states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeNav, setActiveNav] = useState('matches');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // NEW: Expanded AI card state
  const [expandedAI, setExpandedAI] = useState<string | null>(null);
  const [showAllReasonings, setShowAllReasonings] = useState(false);
  
  // NEW: Pre-analyzed matches status
  const [matchAnalysisStatus, setMatchAnalysisStatus] = useState<Record<number, any>>({});

  // Labels
  const labels = {
    tr: {
      matches: 'Maçlar',
      coupons: 'Kuponlar',
      leaderboard: 'Liderlik',
      aiPerformance: 'AI Performans',
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
      aiDetails: 'AI Detayları',
      showReasons: 'Gerekçeleri Göster',
      hideReasons: 'Gizle',
      agreed: 'Hemfikir',
      disagreed: 'Farklı Görüş',
      weightedAgreement: 'Ağırlıklı Oy',
      brainVersion: 'Brain v2.0',
      conflictWarning: 'AI modelleri farklı görüşlerde',
    },
    en: {
      matches: 'Matches',
      coupons: 'Coupons',
      leaderboard: 'Leaderboard',
      aiPerformance: 'AI Performance',
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
      aiDetails: 'AI Details',
      showReasons: 'Show Reasons',
      hideReasons: 'Hide',
      agreed: 'Agreed',
      disagreed: 'Disagreed',
      weightedAgreement: 'Weighted',
      brainVersion: 'Brain v2.0',
      conflictWarning: 'AI models have different opinions',
    },
    de: {
      matches: 'Spiele',
      coupons: 'Wettscheine',
      leaderboard: 'Rangliste',
      aiPerformance: 'KI-Leistung',
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
      aiDetails: 'KI-Details',
      showReasons: 'Gründe zeigen',
      hideReasons: 'Ausblenden',
      agreed: 'Einig',
      disagreed: 'Anders',
      weightedAgreement: 'Gewichtet',
      brainVersion: 'Brain v2.0',
      conflictWarning: 'KI-Modelle haben unterschiedliche Meinungen',
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
      const matchList = data.matches || [];
      setMatches(matchList);
      setFilteredMatches(matchList);
      
      // Fetch pre-analysis status for all matches
      if (matchList.length > 0) {
        const fixtureIds = matchList.map((m: Match) => m.id);
        try {
          const statusRes = await fetch('/api/match-analysis-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixture_ids: fixtureIds })
          });
          const statusData = await statusRes.json();
          setMatchAnalysisStatus(statusData);
        } catch (e) {
          console.error('Analysis status fetch error:', e);
        }
      }
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
    setExpandedAI(null);
    setShowAllReasonings(false);

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
    
    setAnalysisMode('agents');
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

  // 🧠 QUAD-BRAIN ANALYSIS
  const runQuadBrainAnalysis = async () => {
    if (!selectedMatch || !userProfile?.canAnalyze) return;
    
    setAnalysisMode('quadbrain');
    setQuadBrainLoading(true);
    setQuadBrainAnalysis(null);
    setAnalysisError(null);

    try {
      const res = await fetch('/api/quad-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: selectedMatch.id,
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          homeTeamId: selectedMatch.homeTeamId,
          awayTeamId: selectedMatch.awayTeamId,
          league: selectedMatch.league,
          language: lang,
          fetchNews: true,
          trackPerformance: true,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setQuadBrainAnalysis(data.result);
        fetchUserProfile();
      } else {
        setAnalysisError(data.error || 'Quad-Brain analysis failed');
      }
    } catch (error) {
      console.error('Quad-Brain error:', error);
      setAnalysisError('Network error');
    }
    setQuadBrainLoading(false);
  };

  // 🎯 DEEPSEEK MASTER ANALYSIS - 3 Sistem + DeepSeek Master
  const runDeepSeekMasterAnalysis = async () => {
    if (!selectedMatch || !userProfile?.canAnalyze) return;
    
    setAnalysisMode('deepseek');
    setDeepSeekLoading(true);
    setDeepSeekMasterAnalysis(null);
    setAnalysisError(null);

    try {
      console.log('🎯 Starting DeepSeek Master Analysis...');
      
      // Step 1: Run AI Consensus (existing API)
      console.log('   📊 Step 1: AI Consensus...');
      const aiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          homeTeamId: selectedMatch.homeTeamId,
          awayTeamId: selectedMatch.awayTeamId,
          league: selectedMatch.league,
          fixtureId: selectedMatch.id,
          language: lang,
        }),
      });
      const aiData = await aiRes.json();
      
      // Step 2: Run Quad-Brain (existing API)
      console.log('   🧠 Step 2: Quad-Brain...');
      const quadRes = await fetch('/api/quad-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          homeTeamId: selectedMatch.homeTeamId,
          awayTeamId: selectedMatch.awayTeamId,
          league: selectedMatch.league,
          fixtureId: selectedMatch.id,
          language: lang,
        }),
      });
      const quadData = await quadRes.json();
      
      // Step 3: Run Agents (existing API)
      console.log('   🔮 Step 3: AI Agents...');
      const agentsRes = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          homeTeamId: selectedMatch.homeTeamId,
          awayTeamId: selectedMatch.awayTeamId,
          league: selectedMatch.league,
          fixtureId: selectedMatch.id,
          language: lang,
        }),
      });
      const agentsData = await agentsRes.json();
      
      // Step 4: Send all 3 results to DeepSeek Master for evaluation
      console.log('   🎯 Step 4: DeepSeek Master Evaluation...');
      const masterRes = await fetch('/api/deepseek-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: selectedMatch.id,
          home_team: selectedMatch.homeTeam,
          away_team: selectedMatch.awayTeam,
          league: selectedMatch.league,
          aiConsensus: aiData,
          quadBrain: quadData,
          aiAgents: agentsData,
        }),
      });
      const masterData = await masterRes.json();
      
      if (masterData.success) {
        setDeepSeekMasterAnalysis({
          ...masterData,
          aiConsensusRaw: aiData,
          quadBrainRaw: quadData,
          aiAgentsRaw: agentsData,
        });
        // Also set the individual analyses so they can be viewed
        if (aiData.success) setAnalysis(aiData.result);
        if (quadData.success) setQuadBrainAnalysis(quadData.result);
        if (agentsData.success) setAgentAnalysis(agentsData.result);
        fetchUserProfile();
      } else {
        setAnalysisError(masterData.error || 'DeepSeek Master analysis failed');
      }
    } catch (error) {
      console.error('DeepSeek Master error:', error);
      setAnalysisError('Network error');
    }
    setDeepSeekLoading(false);
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getVoteStatus = (votes: number, total: number) => {
    if (votes === total) return { text: l.unanimous, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (votes >= total * 0.75) return { text: l.majority, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    return { text: l.split, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  };

  const getRiskColor = (risk: string) => {
    const r = risk?.toLowerCase();
    if (r === 'low') return 'text-green-400';
    if (r === 'medium') return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskBg = (risk: string) => {
    const r = risk?.toLowerCase();
    if (r === 'low') return 'bg-green-500/10 border-green-500/30';
    if (r === 'medium') return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 70) return 'text-green-400';
    if (conf >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Find which AIs agreed/disagreed with consensus
  const getAIAgreement = (consensusPrediction: string, type: 'matchResult' | 'overUnder25' | 'btts') => {
    const agreed: string[] = [];
    const disagreed: string[] = [];

    if (analysis?.individualAnalyses) {
      Object.entries(analysis.individualAnalyses).forEach(([key, ai]: [string, any]) => {
        if (!ai) return;
        
        let aiPrediction = '';
        if (type === 'matchResult') aiPrediction = ai.matchResult?.prediction;
        else if (type === 'overUnder25') aiPrediction = ai.overUnder25?.prediction;
        else if (type === 'btts') aiPrediction = ai.btts?.prediction;

        if (aiPrediction === consensusPrediction) {
          agreed.push(key);
        } else if (aiPrediction) {
          disagreed.push(key);
        }
      });
    }

    return { agreed, disagreed };
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

  // ============================================================================
  // RENDER - AI BRAIN PREDICTION CARD
  // ============================================================================

  const renderPredictionCard = (
    title: string,
    prediction: any,
    type: 'matchResult' | 'overUnder25' | 'btts',
    color: { bg: string; border: string; text: string; buttonBg: string },
    odds: number = 1.85
  ) => {
    if (!prediction) return null;

    const agreement = getAIAgreement(prediction.prediction, type);
    const hasConflict = agreement.disagreed.length > 0;

    return (
      <div className={`${color.bg} border ${color.border} rounded-xl overflow-hidden transition-all hover:scale-[1.02]`}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">{title}</span>
            {prediction.weightedAgreement && (
              <span className="text-xs text-gray-500">
                {prediction.weightedAgreement}% {l.weightedAgreement}
              </span>
            )}
          </div>

          {/* Prediction */}
          <div className="flex items-end justify-between mb-3">
            <div className={`text-2xl font-bold ${color.text}`}>
              {prediction.prediction}
            </div>
            <div className={`text-3xl font-bold ${getConfidenceColor(prediction.confidence)}`}>
              {prediction.confidence}%
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
            <div 
              className={`h-full transition-all duration-500 ${
                prediction.confidence >= 70 ? 'bg-green-500' :
                prediction.confidence >= 55 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${prediction.confidence}%` }}
            />
          </div>

          {/* AI Agreement Badges */}
          <div className="flex flex-wrap gap-1 mb-3">
            {agreement.agreed.map(key => (
              <span 
                key={key}
                className={`px-2 py-0.5 rounded text-xs ${AI_MODELS[key]?.bgColor} ${AI_MODELS[key]?.color}`}
              >
                {AI_MODELS[key]?.icon} {AI_MODELS[key]?.name} ✓
              </span>
            ))}
            {agreement.disagreed.map(key => (
              <span 
                key={key}
                className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400"
              >
                {AI_MODELS[key]?.icon} {AI_MODELS[key]?.name} ✗
              </span>
            ))}
          </div>

          {/* Vote Count Badge */}
          {prediction.votes && (
            <div className={`text-xs mb-3 px-2 py-1 rounded-lg inline-block ${getVoteStatus(prediction.votes, prediction.totalVotes || 4).bg} ${getVoteStatus(prediction.votes, prediction.totalVotes || 4).color}`}>
              {prediction.votes}/{prediction.totalVotes || 4} {l.modelVotes}
            </div>
          )}

        </div>

        {/* Expandable Reasonings */}
        {prediction.reasonings && prediction.reasonings.length > 0 && (
          <div className="border-t border-gray-700/50">
            <button
              onClick={() => setShowAllReasonings(!showAllReasonings)}
              className="w-full px-4 py-2 text-xs text-gray-400 hover:text-white flex items-center justify-between transition-colors"
            >
              <span>{showAllReasonings ? l.hideReasons : l.showReasons}</span>
              <span>{showAllReasonings ? '▲' : '▼'}</span>
            </button>
            
            {showAllReasonings && (
              <div className="px-4 pb-4 space-y-2">
                {prediction.reasonings.slice(0, 3).map((reason: string, idx: number) => (
                  <p key={idx} className="text-xs text-gray-400 leading-relaxed pl-3 border-l-2 border-gray-600">
                    {reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* HEADER - Mobile Optimized */}
      <header className="bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50 safe-area-inset-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-lg sm:text-xl">⚽</span>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white">
                  Football<span className="text-green-400">Analytics</span>
                </h1>
                <div className="flex items-center gap-2">
                  {userProfile?.isPro ? (
                    <span className="px-1.5 sm:px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-[9px] sm:text-[10px] font-bold rounded text-black">PRO</span>
                  ) : userProfile?.isTrial ? (
                    <span className="text-[10px] sm:text-xs text-gray-400">{userProfile.trialDaysLeft} {l.daysLeft}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <Link href="/dashboard" className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${activeNav === 'matches' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} onClick={() => setActiveNav('matches')}>
                <span>📅</span> {l.matches}
              </Link>
              <Link href="/ai-performance" className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all relative">
                <span>🧠</span> {l.aiPerformance}
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full animate-pulse">NEW</span>
              </Link>
              <Link href="/admin" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all ml-2">
                <span>🎯</span> DeepSeek Master
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <LanguageSelector />
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700/80 rounded-xl transition-all"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {session?.user?.name?.charAt(0) || userProfile?.name?.charAt(0) || 'T'}
                  </div>
                  <span className="hidden sm:block text-white font-medium">{session?.user?.name?.split(' ')[0] || userProfile?.name || 'Test'}</span>
                  <span className="text-gray-400">▼</span>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 top-12 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-all">
                      <span>👤</span>
                      <span className="text-gray-300">{l.profile}</span>
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-all">
                      <span>⚙️</span>
                      <span className="text-gray-300">{l.settings}</span>
                    </Link>
                    <hr className="border-gray-700" />
                    <button onClick={() => signOut()} className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-all w-full text-left">
                      <span>🚪</span>
                      <span className="text-red-400">{l.logout}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT - Mobile Optimized */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-mobile-nav">
        {/* 🎯 DASHBOARD WIDGETS - Hot Matches, Stats, Live Scores, AI Insight */}
        <DashboardWidgets />

        {/* 🎯 DAILY COUPONS - AI Consensus */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN - Match List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Date & Filters */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-4 space-y-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder={l.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">{l.allLeagues}</option>
                {leagues.map((league) => (
                  <option key={league} value={league}>{league}</option>
                ))}
              </select>
            </div>

            {/* Match List */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <span>📅</span> {l.todayMatches}
                  <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg">{filteredMatches.length}</span>
                </h2>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-700/30">
                {loading ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    {l.loading}
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">{l.noMatches}</div>
                ) : (
                  filteredMatches.map((match) => {
                    const status = matchAnalysisStatus[match.id];
                    const hasPreAnalysis = status?.hasAnalysis;
                    
                    return (
                      <div key={match.id} className={`p-4 hover:bg-gray-700/30 transition-all cursor-pointer ${selectedMatch?.id === match.id ? 'bg-green-500/10 border-l-4 border-green-500' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {match.homeTeamLogo && <img src={match.homeTeamLogo} alt="" className="w-5 h-5" />}
                              <span className="font-medium text-white">{match.homeTeam}</span>
                              <span className="text-gray-500 text-xs">vs</span>
                              <span className="font-medium text-white">{match.awayTeam}</span>
                              {match.awayTeamLogo && <img src={match.awayTeamLogo} alt="" className="w-5 h-5" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {match.leagueLogo && <img src={match.leagueLogo} alt="" className="w-3 h-3" />}
                              <span>{match.league}</span>
                            </div>
                            
                            {/* 3-System Analysis Indicators */}
                            {hasPreAnalysis && (
                              <div className="flex items-center gap-1 mt-2">
                                {/* AI Consensus */}
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  status.ai_consensus?.available 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-gray-700/50 text-gray-500'
                                }`} title={status.ai_consensus?.available ? `BTTS: ${status.ai_consensus.summary?.btts} (${status.ai_consensus.summary?.bttsConf}%)` : ''}>
                                  <span>🤖</span>
                                  {status.ai_consensus?.available && status.ai_consensus.summary?.btts && (
                                    <span className="hidden sm:inline">{status.ai_consensus.summary.btts?.toUpperCase()}</span>
                                  )}
                                </div>
                                
                                {/* Quad-Brain */}
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  status.quad_brain?.available 
                                    ? 'bg-cyan-500/20 text-cyan-400' 
                                    : 'bg-gray-700/50 text-gray-500'
                                }`} title={status.quad_brain?.available ? `BTTS: ${status.quad_brain.summary?.btts} (${status.quad_brain.summary?.bttsConf}%)` : ''}>
                                  <span>🧠</span>
                                  {status.quad_brain?.available && status.quad_brain.summary?.btts && (
                                    <span className="hidden sm:inline">{status.quad_brain.summary.btts?.toUpperCase()}</span>
                                  )}
                                </div>
                                
                                {/* AI Agents */}
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  status.ai_agents?.available 
                                    ? 'bg-purple-500/20 text-purple-400' 
                                    : 'bg-gray-700/50 text-gray-500'
                                }`} title={status.ai_agents?.available ? `BTTS: ${status.ai_agents.summary?.btts} (${status.ai_agents.summary?.bttsConf}%)` : ''}>
                                  <span>🔮</span>
                                  {status.ai_agents?.available && status.ai_agents.summary?.btts && (
                                    <span className="hidden sm:inline">{status.ai_agents.summary.btts?.toUpperCase()}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => analyzeMatch(match)}
                              disabled={analyzing}
                              className={`px-3 py-2 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 ${
                                hasPreAnalysis 
                                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400'
                                  : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400'
                              }`}
                            >
                              {analyzing && selectedMatch?.id === match.id ? '...' : hasPreAnalysis ? '📊' : l.analyze}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Analysis Panel */}
          <div className="lg:col-span-2">
            {selectedMatch ? (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                {/* Match Header */}
                <div className="p-6 bg-gradient-to-r from-gray-800/80 to-gray-700/80 border-b border-gray-700/50">
                  <div className="flex items-center justify-center gap-4">
                    {selectedMatch.homeTeamLogo ? (
                      <img src={selectedMatch.homeTeamLogo} alt="" className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-white">
                        {selectedMatch.homeTeam.charAt(0)}
                      </div>
                    )}
                    <span className="font-bold text-white text-xl">{selectedMatch.homeTeam}</span>
                    <span className="text-gray-400 font-bold px-3">vs</span>
                    <span className="font-bold text-white text-xl">{selectedMatch.awayTeam}</span>
                    {selectedMatch.awayTeamLogo ? (
                      <img src={selectedMatch.awayTeamLogo} alt="" className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-white">
                        {selectedMatch.awayTeam.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    {selectedMatch.leagueLogo && <img src={selectedMatch.leagueLogo} alt="" className="w-5 h-5" />}
                    <span className="text-sm text-gray-400">{selectedMatch.league}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(selectedMatch.date).toLocaleString(lang, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Action Buttons - 4 Analysis Modes */}
                <div className="p-4 border-b border-gray-700/50">
                  <div className="grid grid-cols-4 gap-2">
                    {/* Standard AI Consensus */}
                    <button 
                      onClick={() => analyzeMatch(selectedMatch)} 
                      disabled={analyzing || !userProfile?.canAnalyze} 
                      className={`py-3 rounded-xl font-semibold flex flex-col items-center justify-center gap-1 transition-all ${userProfile?.canAnalyze ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                      <span className="text-lg">🤖</span>
                      <span className="text-[10px]">{analyzing ? '...' : 'AI'}</span>
                    </button>
                    
                    {/* 🧠 QUAD-BRAIN */}
                    <button 
                      onClick={runQuadBrainAnalysis} 
                      disabled={quadBrainLoading || !userProfile?.canAnalyze} 
                      className={`py-3 rounded-xl font-semibold flex flex-col items-center justify-center gap-1 transition-all ${userProfile?.canAnalyze ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                      <span className="text-lg">🧠</span>
                      <span className="text-[10px]">{quadBrainLoading ? '...' : 'Quad'}</span>
                    </button>
                    
                    {/* Heurist Agents */}
                    <button 
                      onClick={runAgentAnalysis} 
                      disabled={agentLoading || !userProfile?.canUseAgents} 
                      className={`py-3 rounded-xl font-semibold flex flex-col items-center justify-center gap-1 transition-all ${userProfile?.canUseAgents ? 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                      <span className="text-lg">🔮</span>
                      <span className="text-[10px]">{agentLoading ? '...' : 'Agents'}</span>
                    </button>

                    {/* 🎯 DEEPSEEK MASTER */}
                    <button 
                      onClick={runDeepSeekMasterAnalysis} 
                      disabled={deepSeekLoading || !userProfile?.canAnalyze} 
                      className={`py-3 rounded-xl font-semibold flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden ${userProfile?.canAnalyze ? 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                      <span className="absolute top-0.5 right-0.5 px-1 py-0.5 bg-yellow-400 text-black text-[6px] font-bold rounded">MASTER</span>
                      <span className="text-lg">🎯</span>
                      <span className="text-[10px]">{deepSeekLoading ? '...' : 'DeepSeek'}</span>
                    </button>
                  </div>
                </div>

                {/* Analysis Content */}
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  {/* Error State */}
                  {analysisError && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-red-400 font-medium">{analysisError}</p>
                      <Link href="/pricing" className="text-yellow-400 hover:underline text-sm mt-2 inline-block">{l.goToPricing} →</Link>
                    </div>
                  )}

                  {/* Loading State */}
                  {(analyzing || agentLoading || quadBrainLoading || deepSeekLoading) ? (
                    deepSeekLoading ? (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                          <div className="text-4xl mb-4 animate-pulse">🎯</div>
                          <h3 className="text-xl font-bold text-white mb-2">DeepSeek Master Analysis</h3>
                          <p className="text-gray-400 text-sm mb-4">3 AI systems + DeepSeek Master evaluating...</p>
                          <div className="flex justify-center gap-3">
                            {['AI Consensus', 'Quad-Brain', 'AI Agents', 'DeepSeek'].map((model, i) => (
                              <div key={model} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg animate-pulse ${
                                  i === 0 ? 'bg-green-500/20' :
                                  i === 1 ? 'bg-cyan-500/20' :
                                  i === 2 ? 'bg-purple-500/20' : 'bg-red-500/20'
                                }`}>
                                  {i === 0 ? '🤖' : i === 1 ? '🧠' : i === 2 ? '🔮' : '🎯'}
                                </div>
                                <span className="text-[8px] text-gray-500 mt-1">{model}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 animate-[loading_3s_ease-in-out_infinite]" style={{width: '70%'}}></div>
                          </div>
                        </div>
                      </div>
                    ) : agentLoading ? (
                      <AgentLoadingProgress isLoading={true} />
                    ) : quadBrainLoading ? (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6 text-center">
                          <div className="text-4xl mb-4 animate-pulse">🧠</div>
                          <h3 className="text-xl font-bold text-white mb-2">Quad-Brain Analysis</h3>
                          <p className="text-gray-400 text-sm mb-4">4 AI models analyzing in parallel...</p>
                          <div className="flex justify-center gap-3">
                            {['Claude', 'GPT-4', 'Gemini', 'Mistral'].map((model, i) => (
                              <div key={model} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg animate-pulse ${
                                  i === 0 ? 'bg-orange-500/20' :
                                  i === 1 ? 'bg-green-500/20' :
                                  i === 2 ? 'bg-blue-500/20' : 'bg-purple-500/20'
                                }`}>
                                  {i === 0 ? '🧠' : i === 1 ? '📊' : i === 2 ? '🔍' : '📰'}
                                </div>
                                <span className="text-[10px] text-gray-500 mt-1">{model}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-[loading_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                          </div>
                        </div>
                      </div>
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
                  ) : (analysis || agentAnalysis || quadBrainAnalysis || deepSeekMasterAnalysis) ? (
                    <div className="space-y-4">
                      {/* Mode Toggle - 4 Modes */}
                      {(analysis || quadBrainAnalysis || agentAnalysis || deepSeekMasterAnalysis) && (
                        <div className="flex gap-1 p-1 bg-gray-700/30 rounded-xl">
                          {analysis && (
                            <button onClick={() => setAnalysisMode('standard')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${analysisMode === 'standard' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                              🤖
                            </button>
                          )}
                          {quadBrainAnalysis && (
                            <button onClick={() => setAnalysisMode('quadbrain')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${analysisMode === 'quadbrain' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                              🧠
                            </button>
                          )}
                          {agentAnalysis && (
                            <button onClick={() => setAnalysisMode('agents')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${analysisMode === 'agents' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                              🔮
                            </button>
                          )}
                          {deepSeekMasterAnalysis && (
                            <button onClick={() => setAnalysisMode('deepseek')} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${analysisMode === 'deepseek' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                              🎯 Master
                            </button>
                          )}
                        </div>
                      )}

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* AI BRAIN V2.0 - UPGRADED ANALYSIS VIEW */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {analysisMode === 'standard' && analysis && (
                        <div className="space-y-4">
                          
                          {/* AI Status Bar - Enhanced */}
                          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🧠</span>
                                <div>
                                  <span className="font-bold text-white">{l.aiConsensus}</span>
                                  <span className="ml-2 px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded-full">
                                    {l.brainVersion}
                                  </span>
                                </div>
                              </div>
                              {analysis.timing?.total && (
                                <span className="text-xs text-gray-500 font-mono">{analysis.timing.total}</span>
                              )}
                            </div>
                            
                            {/* AI Model Cards */}
                            <div className="grid grid-cols-4 gap-2">
                              {Object.entries(AI_MODELS).map(([key, model]) => {
                                const isActive = analysis.aiStatus?.[key]?.active;
                                const aiAnalysis = analysis.individualAnalyses?.[key];
                                
                                return (
                                  <button
                                    key={key}
                                    onClick={() => setExpandedAI(expandedAI === key ? null : key)}
                                    disabled={!isActive}
                                    className={`p-3 rounded-xl text-center transition-all ${
                                      isActive 
                                        ? `${model.bgColor} border ${model.borderColor} hover:scale-105 cursor-pointer` 
                                        : 'bg-gray-700/30 border border-gray-700 opacity-50 cursor-not-allowed'
                                    } ${expandedAI === key ? 'ring-2 ring-white/50' : ''}`}
                                  >
                                    <div className="text-xl mb-1">{model.icon}</div>
                                    <div className={`text-xs font-bold ${isActive ? model.color : 'text-gray-500'}`}>
                                      {model.name}
                                    </div>
                                    <div className={`text-[10px] ${isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {model.role}
                                    </div>
                                    {isActive && (
                                      <div className="mt-1 text-[10px] text-green-400">✓ Active</div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Expanded AI Detail */}
                            {expandedAI && analysis.individualAnalyses?.[expandedAI] && (
                              <div className={`mt-4 p-4 rounded-xl ${AI_MODELS[expandedAI]?.bgColor} border ${AI_MODELS[expandedAI]?.borderColor}`}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">{AI_MODELS[expandedAI]?.icon}</span>
                                  <span className={`font-bold ${AI_MODELS[expandedAI]?.color}`}>
                                    {AI_MODELS[expandedAI]?.name} Analysis
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-500">Result</p>
                                    <p className="text-sm font-bold text-white">{analysis.individualAnalyses[expandedAI]?.matchResult?.prediction}</p>
                                    <p className="text-xs text-gray-400">{analysis.individualAnalyses[expandedAI]?.matchResult?.confidence}%</p>
                                  </div>
                                  <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-500">Goals</p>
                                    <p className="text-sm font-bold text-white">{analysis.individualAnalyses[expandedAI]?.overUnder25?.prediction}</p>
                                    <p className="text-xs text-gray-400">{analysis.individualAnalyses[expandedAI]?.overUnder25?.confidence}%</p>
                                  </div>
                                  <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-500">BTTS</p>
                                    <p className="text-sm font-bold text-white">{analysis.individualAnalyses[expandedAI]?.btts?.prediction}</p>
                                    <p className="text-xs text-gray-400">{analysis.individualAnalyses[expandedAI]?.btts?.confidence}%</p>
                                  </div>
                                </div>

                                {analysis.individualAnalyses[expandedAI]?.overallAnalysis && (
                                  <p className="text-sm text-gray-300 leading-relaxed">
                                    {analysis.individualAnalyses[expandedAI].overallAnalysis}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Conflict Warning */}
                          {analysis.analysis?.matchResult?.votes < (analysis.analysis?.matchResult?.totalVotes || 4) && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-3">
                              <span className="text-xl">⚠️</span>
                              <div>
                                <p className="text-sm font-medium text-yellow-400">{l.conflictWarning}</p>
                                <p className="text-xs text-gray-400">
                                  {analysis.analysis.matchResult.votes}/{analysis.analysis.matchResult.totalVotes || 4} AI models agree on {analysis.analysis.matchResult.prediction}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Prediction Cards Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {renderPredictionCard(
                              l.matchResult,
                              analysis.analysis?.matchResult,
                              'matchResult',
                              { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', buttonBg: 'bg-blue-600/30 hover:bg-blue-600/50' },
                              1.85
                            )}

                            {renderPredictionCard(
                              l.overUnder,
                              analysis.analysis?.overUnder25,
                              'overUnder25',
                              { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', buttonBg: 'bg-green-600/30 hover:bg-green-600/50' },
                              1.90
                            )}

                            {renderPredictionCard(
                              l.btts,
                              analysis.analysis?.btts,
                              'btts',
                              { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', buttonBg: 'bg-orange-600/30 hover:bg-orange-600/50' },
                              1.80
                            )}

                            {/* Risk Level Card */}
                            {analysis.analysis?.riskLevel && (
                              <div className={`${getRiskBg(analysis.analysis.riskLevel)} border rounded-xl p-4`}>
                                <div className="text-xs text-gray-400 mb-1">{l.riskLevel}</div>
                                <div className={`text-2xl font-bold ${getRiskColor(analysis.analysis.riskLevel)}`}>
                                  {analysis.analysis.riskLevel === 'Low' ? '🛡️ Low' : 
                                   analysis.analysis.riskLevel === 'Medium' ? '⚡ Medium' : '🔥 High'}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Best Bet Highlight */}
                          {analysis.analysis?.bestBets?.[0] && (
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm text-yellow-400 mb-1 font-medium flex items-center gap-2">
                                    <span className="text-xl">💰</span> {l.bestBet}
                                    {analysis.analysis.bestBets[0].consensusStrength && (
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        analysis.analysis.bestBets[0].consensusStrength === 'Strong' ? 'bg-green-500/20 text-green-400' :
                                        analysis.analysis.bestBets[0].consensusStrength === 'Moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                      }`}>
                                        {analysis.analysis.bestBets[0].consensusStrength}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-bold text-white text-xl">
                                    {analysis.analysis.bestBets[0].type}: {analysis.analysis.bestBets[0].selection}
                                  </div>
                                  <div className="text-sm text-gray-300 mt-1">
                                    {analysis.analysis.bestBets[0].confidence}% {l.confidence}
                                    {analysis.analysis.bestBets[0].weightedAgreement && (
                                      <span className="ml-2 text-gray-500">
                                        • {analysis.analysis.bestBets[0].weightedAgreement}% {l.weightedAgreement}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Overall Analysis */}
                          {analysis.analysis?.overallAnalyses?.[0] && (
                            <div className="bg-gray-700/30 rounded-xl p-4">
                              <div className="text-sm text-gray-400 mb-2 font-medium">📝 {l.overallAnalysis}</div>
                              <p className="text-sm text-gray-300 leading-relaxed">{analysis.analysis.overallAnalyses[0]}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* 🧠 QUAD-BRAIN RESULTS */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {analysisMode === 'quadbrain' && quadBrainAnalysis && (
                        <div className="space-y-4">
                          {/* Quad-Brain Header */}
                          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🧠</span>
                                <div>
                                  <span className="font-bold text-white">Quad-Brain Consensus</span>
                                  <span className="ml-2 px-2 py-0.5 bg-cyan-500/30 text-cyan-300 text-xs rounded-full">
                                    v2.0
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">Data Quality</div>
                                <div className="text-sm font-bold text-cyan-400">{quadBrainAnalysis.dataQuality?.overall || 0}/100</div>
                              </div>
                            </div>

                            {/* 4 AI Models Status */}
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { key: 'claude', name: 'Claude', icon: '🧠', color: 'orange', role: 'Tactical' },
                                { key: 'gpt4', name: 'GPT-4', icon: '📊', color: 'green', role: 'Statistical' },
                                { key: 'gemini', name: 'Gemini', icon: '🔍', color: 'blue', role: 'Pattern' },
                                { key: 'mistral', name: 'Mistral', icon: '🌀', color: 'purple', role: 'Context' }
                              ].map((model) => {
                                const pred = quadBrainAnalysis.individualPredictions?.[model.key];
                                const isActive = !!pred;
                                return (
                                  <div 
                                    key={model.key}
                                    className={`p-2 rounded-lg text-center ${
                                      isActive 
                                        ? `bg-${model.color}-500/20 border border-${model.color}-500/30` 
                                        : 'bg-gray-700/30 border border-gray-700 opacity-50'
                                    }`}
                                  >
                                    <div className="text-lg">{model.icon}</div>
                                    <div className={`text-xs font-bold ${isActive ? `text-${model.color}-400` : 'text-gray-500'}`}>
                                      {model.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500">{model.role}</div>
                                    {isActive && <div className="text-[10px] text-green-400 mt-1">✓</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Debate Alert */}
                          {quadBrainAnalysis.debates?.length > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-3">
                              <span className="text-xl">⚖️</span>
                              <div>
                                <p className="text-sm font-medium text-yellow-400">AI Debate Occurred</p>
                                <p className="text-xs text-gray-400">
                                  {quadBrainAnalysis.debates.length} conflict(s) resolved via arbitration
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Consensus Predictions */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Match Result */}
                            {quadBrainAnalysis.consensus?.matchResult && (
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-1">Match Result</div>
                                <div className="flex items-end justify-between mb-2">
                                  <div className="text-2xl font-bold text-blue-400">
                                    {quadBrainAnalysis.consensus.matchResult.prediction}
                                  </div>
                                  <div className={`text-3xl font-bold ${
                                    quadBrainAnalysis.consensus.matchResult.confidence >= 70 ? 'text-green-400' :
                                    quadBrainAnalysis.consensus.matchResult.confidence >= 55 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {quadBrainAnalysis.consensus.matchResult.confidence}%
                                  </div>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className={`h-full ${
                                      quadBrainAnalysis.consensus.matchResult.confidence >= 70 ? 'bg-green-500' :
                                      quadBrainAnalysis.consensus.matchResult.confidence >= 55 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${quadBrainAnalysis.consensus.matchResult.confidence}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500">
                                  {quadBrainAnalysis.consensus.matchResult.agreement?.majoritySize}/{quadBrainAnalysis.consensus.matchResult.agreement?.totalModels} AI models agree
                                </div>
                              </div>
                            )}

                            {/* Over/Under 2.5 */}
                            {quadBrainAnalysis.consensus?.overUnder25 && (
                              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-1">Over/Under 2.5</div>
                                <div className="flex items-end justify-between mb-2">
                                  <div className="text-2xl font-bold text-green-400">
                                    {quadBrainAnalysis.consensus.overUnder25.prediction}
                                  </div>
                                  <div className={`text-3xl font-bold ${
                                    quadBrainAnalysis.consensus.overUnder25.confidence >= 70 ? 'text-green-400' :
                                    quadBrainAnalysis.consensus.overUnder25.confidence >= 55 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {quadBrainAnalysis.consensus.overUnder25.confidence}%
                                  </div>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className={`h-full ${
                                      quadBrainAnalysis.consensus.overUnder25.confidence >= 70 ? 'bg-green-500' :
                                      quadBrainAnalysis.consensus.overUnder25.confidence >= 55 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${quadBrainAnalysis.consensus.overUnder25.confidence}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500">
                                  {quadBrainAnalysis.consensus.overUnder25.agreement?.majoritySize}/{quadBrainAnalysis.consensus.overUnder25.agreement?.totalModels} AI models agree
                                </div>
                              </div>
                            )}

                            {/* BTTS */}
                            {quadBrainAnalysis.consensus?.btts && (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-1">BTTS</div>
                                <div className="flex items-end justify-between mb-2">
                                  <div className="text-2xl font-bold text-orange-400">
                                    {quadBrainAnalysis.consensus.btts.prediction}
                                  </div>
                                  <div className={`text-3xl font-bold ${
                                    quadBrainAnalysis.consensus.btts.confidence >= 70 ? 'text-green-400' :
                                    quadBrainAnalysis.consensus.btts.confidence >= 55 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {quadBrainAnalysis.consensus.btts.confidence}%
                                  </div>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className={`h-full ${
                                      quadBrainAnalysis.consensus.btts.confidence >= 70 ? 'bg-green-500' :
                                      quadBrainAnalysis.consensus.btts.confidence >= 55 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${quadBrainAnalysis.consensus.btts.confidence}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500">
                                  {quadBrainAnalysis.consensus.btts.agreement?.majoritySize}/{quadBrainAnalysis.consensus.btts.agreement?.totalModels} AI models agree
                                </div>
                              </div>
                            )}

                            {/* Risk Level */}
                            {quadBrainAnalysis.riskAssessment && (
                              <div className={`rounded-xl p-4 border ${
                                quadBrainAnalysis.riskAssessment.overall === 'low' ? 'bg-green-500/10 border-green-500/30' :
                                quadBrainAnalysis.riskAssessment.overall === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                'bg-red-500/10 border-red-500/30'
                              }`}>
                                <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                                <div className={`text-2xl font-bold ${
                                  quadBrainAnalysis.riskAssessment.overall === 'low' ? 'text-green-400' :
                                  quadBrainAnalysis.riskAssessment.overall === 'medium' ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {quadBrainAnalysis.riskAssessment.overall === 'low' ? '🛡️ Low' :
                                   quadBrainAnalysis.riskAssessment.overall === 'medium' ? '⚡ Medium' : '🔥 High'}
                                </div>
                                {quadBrainAnalysis.riskAssessment.warnings?.length > 0 && (
                                  <div className="mt-2 text-xs text-gray-400">
                                    {quadBrainAnalysis.riskAssessment.warnings[0]}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Best Bets */}
                          {quadBrainAnalysis.bestBets?.[0] && (
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm text-yellow-400 mb-1 font-medium flex items-center gap-2">
                                    <span className="text-xl">💰</span> Best Bet
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      quadBrainAnalysis.bestBets[0].consensusStrength === 'strong' ? 'bg-green-500/20 text-green-400' :
                                      quadBrainAnalysis.bestBets[0].consensusStrength === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-red-500/20 text-red-400'
                                    }`}>
                                      {quadBrainAnalysis.bestBets[0].consensusStrength}
                                    </span>
                                  </div>
                                  <div className="font-bold text-white text-xl">
                                    {quadBrainAnalysis.bestBets[0].market}: {quadBrainAnalysis.bestBets[0].selection}
                                  </div>
                                  <div className="text-sm text-gray-300 mt-1">
                                    {quadBrainAnalysis.bestBets[0].confidence}% confidence
                                    <span className="ml-2 text-gray-500">
                                      • {quadBrainAnalysis.bestBets[0].weightedAgreement}% weighted
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Timing Info */}
                          {quadBrainAnalysis.timing && (
                            <div className="text-xs text-gray-500 text-right">
                              ⏱️ Total: {quadBrainAnalysis.timing.total}ms | AI: {quadBrainAnalysis.timing.aiCalls}ms
                              {quadBrainAnalysis.timing.debate && ` | Debate: ${quadBrainAnalysis.timing.debate}ms`}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Agent Mode */}
                      {analysisMode === 'agents' && agentAnalysis && (
                        <>
                          <AgentReports 
                            reports={agentAnalysis.reports}
                            homeTeam={selectedMatch.homeTeam}
                            awayTeam={selectedMatch.awayTeam}
                          />
                          
                          {/* Professional Betting Analysis */}
                          {agentAnalysis.professionalMarkets && (
                            <ProfessionalBetting 
                              data={agentAnalysis.professionalMarkets}
                              homeTeam={selectedMatch.homeTeam}
                              awayTeam={selectedMatch.awayTeam}
                              language={lang}
                            />
                          )}
                        </>
                      )}

                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {/* 🎯 DEEPSEEK MASTER RESULTS */}
                      {/* ═══════════════════════════════════════════════════════════════ */}
                      {analysisMode === 'deepseek' && deepSeekMasterAnalysis && (
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🎯</span>
                                <div>
                                  <span className="font-bold text-white">DeepSeek Master Analyst</span>
                                  <span className="ml-2 px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
                                    3 Systems Combined
                                  </span>
                                </div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                deepSeekMasterAnalysis.deepseekMaster?.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                                deepSeekMasterAnalysis.deepseekMaster?.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {deepSeekMasterAnalysis.deepseekMaster?.riskLevel?.toUpperCase()} RISK
                              </div>
                            </div>
                            <p className="text-gray-400 text-xs">
                              AI Consensus + Quad-Brain + AI Agents → DeepSeek Master Final Verdict
                            </p>
                          </div>

                          {/* Best Bet */}
                          {deepSeekMasterAnalysis.deepseekMaster?.bestBet && (
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/40 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-yellow-400 text-xs font-medium mb-1">🏆 BEST BET</div>
                                  <div className="text-2xl font-bold text-white">
                                    {deepSeekMasterAnalysis.deepseekMaster.bestBet.market} - {deepSeekMasterAnalysis.deepseekMaster.bestBet.selection}
                                  </div>
                                  <div className="text-sm text-gray-400 mt-1">
                                    {deepSeekMasterAnalysis.deepseekMaster.bestBet.reasoning}
                                  </div>
                                </div>
                                <div className="text-3xl font-bold text-yellow-400">
                                  %{deepSeekMasterAnalysis.deepseekMaster.bestBet.confidence}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Final Verdict - 3 Markets */}
                          {deepSeekMasterAnalysis.deepseekMaster?.finalVerdict && (
                            <div className="grid grid-cols-3 gap-3">
                              {/* BTTS */}
                              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                                <div className="text-xs text-gray-500 mb-1">BTTS</div>
                                <div className={`text-lg font-bold ${
                                  deepSeekMasterAnalysis.deepseekMaster.finalVerdict.btts?.prediction === 'yes' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {deepSeekMasterAnalysis.deepseekMaster.finalVerdict.btts?.prediction?.toUpperCase()}
                                </div>
                                <div className="text-sm text-gray-400">
                                  %{deepSeekMasterAnalysis.deepseekMaster.finalVerdict.btts?.confidence}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {deepSeekMasterAnalysis.deepseekMaster.systemAgreement?.btts}/3 systems agree
                                </div>
                              </div>

                              {/* Over/Under */}
                              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                                <div className="text-xs text-gray-500 mb-1">Over/Under 2.5</div>
                                <div className={`text-lg font-bold ${
                                  deepSeekMasterAnalysis.deepseekMaster.finalVerdict.overUnder?.prediction === 'over' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {deepSeekMasterAnalysis.deepseekMaster.finalVerdict.overUnder?.prediction?.toUpperCase()}
                                </div>
                                <div className="text-sm text-gray-400">
                                  %{deepSeekMasterAnalysis.deepseekMaster.finalVerdict.overUnder?.confidence}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {deepSeekMasterAnalysis.deepseekMaster.systemAgreement?.overUnder}/3 systems agree
                                </div>
                              </div>

                              {/* Match Result */}
                              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                                <div className="text-xs text-gray-500 mb-1">Match Result</div>
                                <div className={`text-lg font-bold ${
                                  deepSeekMasterAnalysis.deepseekMaster.finalVerdict.matchResult?.prediction === 'home' ? 'text-blue-400' :
                                  deepSeekMasterAnalysis.deepseekMaster.finalVerdict.matchResult?.prediction === 'away' ? 'text-orange-400' : 'text-gray-400'
                                }`}>
                                  {deepSeekMasterAnalysis.deepseekMaster.finalVerdict.matchResult?.prediction?.toUpperCase()}
                                </div>
                                <div className="text-sm text-gray-400">
                                  %{deepSeekMasterAnalysis.deepseekMaster.finalVerdict.matchResult?.confidence}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {deepSeekMasterAnalysis.deepseekMaster.systemAgreement?.matchResult}/3 systems agree
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 3 System Comparison */}
                          <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/30">
                            <div className="text-sm font-medium text-gray-300 mb-3">📊 System Comparison</div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                              {/* AI Consensus */}
                              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                                <div className="text-green-400 text-lg mb-1">🤖</div>
                                <div className="text-xs text-gray-400 mb-2">AI Consensus</div>
                                {deepSeekMasterAnalysis.aiConsensus && (
                                  <div className="space-y-1 text-[10px]">
                                    <div>BTTS: <span className="text-green-400">{deepSeekMasterAnalysis.aiConsensus.btts?.prediction?.toUpperCase()}</span></div>
                                    <div>O/U: <span className="text-blue-400">{deepSeekMasterAnalysis.aiConsensus.overUnder?.prediction?.toUpperCase()}</span></div>
                                    <div>MS: <span className="text-yellow-400">{deepSeekMasterAnalysis.aiConsensus.matchResult?.prediction?.toUpperCase()}</span></div>
                                  </div>
                                )}
                              </div>

                              {/* Quad Brain */}
                              <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                                <div className="text-cyan-400 text-lg mb-1">🧠</div>
                                <div className="text-xs text-gray-400 mb-2">Quad-Brain</div>
                                {deepSeekMasterAnalysis.quadBrain && (
                                  <div className="space-y-1 text-[10px]">
                                    <div>BTTS: <span className="text-green-400">{deepSeekMasterAnalysis.quadBrain.btts?.prediction?.toUpperCase()}</span></div>
                                    <div>O/U: <span className="text-blue-400">{deepSeekMasterAnalysis.quadBrain.overUnder?.prediction?.toUpperCase()}</span></div>
                                    <div>MS: <span className="text-yellow-400">{deepSeekMasterAnalysis.quadBrain.matchResult?.prediction?.toUpperCase()}</span></div>
                                  </div>
                                )}
                              </div>

                              {/* AI Agents */}
                              <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                                <div className="text-purple-400 text-lg mb-1">🔮</div>
                                <div className="text-xs text-gray-400 mb-2">AI Agents</div>
                                {deepSeekMasterAnalysis.aiAgents && (
                                  <div className="space-y-1 text-[10px]">
                                    <div>BTTS: <span className="text-green-400">{deepSeekMasterAnalysis.aiAgents.btts?.prediction?.toUpperCase()}</span></div>
                                    <div>O/U: <span className="text-blue-400">{deepSeekMasterAnalysis.aiAgents.overUnder?.prediction?.toUpperCase()}</span></div>
                                    <div>MS: <span className="text-yellow-400">{deepSeekMasterAnalysis.aiAgents.matchResult?.prediction?.toUpperCase()}</span></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Warnings */}
                          {deepSeekMasterAnalysis.deepseekMaster?.warnings && deepSeekMasterAnalysis.deepseekMaster.warnings.length > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                              <div className="text-yellow-400 text-xs font-medium mb-2">⚠️ Warnings</div>
                              {deepSeekMasterAnalysis.deepseekMaster.warnings.map((warning: string, i: number) => (
                                <div key={i} className="text-sm text-yellow-300/80">• {warning}</div>
                              ))}
                            </div>
                          )}

                          {/* Processing Time */}
                          <div className="text-center text-xs text-gray-500">
                            Analysis completed in {(deepSeekMasterAnalysis.duration / 1000).toFixed(1)}s
                          </div>
                        </div>
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
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 flex items-center justify-center h-[600px] text-gray-400">
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

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      
      {/* Mobile Bottom Spacer */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
