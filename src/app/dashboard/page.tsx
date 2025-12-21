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
  leagueId?: number;
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
  
  // NEW: League standings state
  const [leagueStandings, setLeagueStandings] = useState<any>(null);
  const [leagueStandingsLoading, setLeagueStandingsLoading] = useState(false);
  
  // NEW: Analyzed matches state (sorted by confidence)
  const [analyzedMatches, setAnalyzedMatches] = useState<any[]>([]);
  const [analyzedMatchesLoading, setAnalyzedMatchesLoading] = useState(false);

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
      analyze: 'Tam Analiz',
      fullAnalysis: '🎯 Tam Analiz',
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
      analyze: 'Full Analysis',
      fullAnalysis: '🎯 Full Analysis',
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

  // Fetch analyzed matches sorted by confidence
  const fetchAnalyzedMatches = useCallback(async () => {
    setAnalyzedMatchesLoading(true);
    try {
      const res = await fetch(`/api/analyzed-matches?date=${selectedDate}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setAnalyzedMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Fetch analyzed matches error:', error);
    }
    setAnalyzedMatchesLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    if (session) {
      fetchMatches();
      fetchUserProfile();
      fetchAnalyzedMatches();
    }
  }, [session, fetchMatches, fetchAnalyzedMatches]);

  // Fetch league standings when match is selected
  useEffect(() => {
    const fetchLeagueStandings = async () => {
      if (!selectedMatch?.leagueId && !selectedMatch?.league) return;
      
      setLeagueStandingsLoading(true);
      try {
        const params = selectedMatch.leagueId 
          ? `leagueId=${selectedMatch.leagueId}`
          : `leagueName=${encodeURIComponent(selectedMatch.league)}`;
        
        const res = await fetch(`/api/league-standings?${params}`);
        const data = await res.json();
        
        if (data.success) {
          setLeagueStandings(data);
        } else {
          setLeagueStandings(null);
        }
      } catch (error) {
        console.error('Error fetching league standings:', error);
        setLeagueStandings(null);
      } finally {
        setLeagueStandingsLoading(false);
      }
    };

    fetchLeagueStandings();
  }, [selectedMatch?.leagueId, selectedMatch?.league]);

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

  // ⚡ OTOMATIK ANALİZ KONTROLÜ: Maç seçildiğinde mevcut analizi kontrol et
  useEffect(() => {
    if (!selectedMatch) return;

    const loadExistingAnalysis = async () => {
      try {
        console.log(`🔍 Auto-loading analysis for ${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}...`);
        const existingRes = await fetch(`/api/match-full-analysis?fixture_id=${selectedMatch.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          if (existingData.success && existingData.analysis?.deepseek_master) {
            console.log('✅ Found existing analysis! Auto-loading...');
            
            // DeepSeek Master analysis
            // Note: deepseek_master contains: finalVerdict, confidence, reasoning, systemAgreement, riskLevel, bestBet, warnings, processingTime
            setDeepSeekMasterAnalysis({
              finalVerdict: existingData.analysis.deepseek_master?.finalVerdict,
              confidence: existingData.analysis.deepseek_master?.confidence,
              reasoning: existingData.analysis.deepseek_master?.reasoning,
              systemAgreement: existingData.analysis.deepseek_master?.systemAgreement,
              riskLevel: existingData.analysis.deepseek_master?.riskLevel,
              bestBet: existingData.analysis.deepseek_master?.bestBet,
              warnings: existingData.analysis.deepseek_master?.warnings,
              processingTime: existingData.analysis.deepseek_master?.processingTime,
              aiConsensusRaw: existingData.analysis.ai_consensus,
              quadBrainRaw: existingData.analysis.quad_brain,
              aiAgentsRaw: existingData.analysis.ai_agents,
            });
            
            // Individual analyses
            if (existingData.analysis.ai_consensus) {
              setAnalysis(existingData.analysis.ai_consensus);
            }
            if (existingData.analysis.quad_brain) {
              setQuadBrainAnalysis(existingData.analysis.quad_brain);
            }
            if (existingData.analysis.ai_agents) {
              setAgentAnalysis(existingData.analysis.ai_agents);
            }
            
            // Set to deepseek mode to show the results
            setAnalysisMode('deepseek');
            setDeepSeekLoading(false);
            setAnalyzing(false);
          }
        }
      } catch (error) {
        console.log('No existing analysis found');
      }
    };

    loadExistingAnalysis();
  }, [selectedMatch?.id]); // Only run when match ID changes

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
  const runDeepSeekMasterAnalysis = async (matchToAnalyze?: Match) => {
    const match = matchToAnalyze || selectedMatch;
    if (!match || !userProfile?.canAnalyze) return;
    
    // ⚠️ Maç başlamış mı kontrol et
    const matchDate = new Date(match.date);
    const now = new Date();
    if (matchDate <= now) {
      setAnalysisError('Bu maç başlamış, analiz yapılamaz.');
      return;
    }
    
    // Maçı seç (eğer parametre olarak geldiyse)
    if (matchToAnalyze) {
      setSelectedMatch(matchToAnalyze);
    }
    
    setAnalysisMode('deepseek');
    setDeepSeekLoading(true);
    setDeepSeekMasterAnalysis(null);
    setAnalysisError(null);

    try {
      const overallStartTime = Date.now();
      console.log('🎯 Starting DeepSeek Master Analysis...');
      
      // ÖNCE MEVCUT ANALİZİ KONTROL ET
      console.log('   🔍 Checking for existing analysis...');
      try {
        const existingRes = await fetch(`/api/match-full-analysis?fixture_id=${match.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          if (existingData.success && existingData.analysis?.deepseek_master) {
            console.log('   ✅ Found existing analysis! Loading...');
            console.log('   📊 Analysis structure check:', {
              hasDeepSeek: !!existingData.analysis.deepseek_master,
              hasAIConsensus: !!existingData.analysis.ai_consensus,
              hasQuadBrain: !!existingData.analysis.quad_brain,
              hasAIAgents: !!existingData.analysis.ai_agents,
            });
            setDeepSeekMasterAnalysis({
              ...existingData.analysis.deepseek_master,
              aiConsensusRaw: existingData.analysis.ai_consensus,
              quadBrainRaw: existingData.analysis.quad_brain,
              aiAgentsRaw: existingData.analysis.ai_agents,
              duration: existingData.analysis.deepseek_master?.processingTime || 0, // Fallback to 0 if not available
            });
            // Set individual analyses too
            if (existingData.analysis.ai_consensus) setAnalysis(existingData.analysis.ai_consensus);
            if (existingData.analysis.quad_brain) setQuadBrainAnalysis(existingData.analysis.quad_brain);
            if (existingData.analysis.ai_agents) setAgentAnalysis(existingData.analysis.ai_agents);
            setDeepSeekLoading(false);
            return; // Exit early - no need to run new analysis
          }
        }
      } catch (checkError) {
        console.log('   ℹ️ No existing analysis found');
      }
      
      // ⚠️ ANALİZ YOKSA: Otomatik analiz sistemini bilgilendir, yeni analiz yapma
      console.log('   ⚠️ No existing analysis found');
      setAnalysisError(
        lang === 'tr' 
          ? 'Bu maç henüz analiz edilmemiş. Otomatik analiz sistemi yakında bu maçı analiz edecek. Lütfen birkaç dakika sonra tekrar deneyin. (Otomatik analiz her 30 dakikada bir çalışır)'
          : lang === 'de'
          ? 'Dieses Spiel wurde noch nicht analysiert. Das automatische Analysesystem wird dieses Spiel bald analysieren. Bitte versuchen Sie es in ein paar Minuten erneut. (Automatische Analyse läuft alle 30 Minuten)'
          : 'This match has not been analyzed yet. The automatic analysis system will analyze this match soon. Please try again in a few minutes. (Automatic analysis runs every 30 minutes)'
      );
      setDeepSeekLoading(false);
      return; // Exit - don't create new analysis, wait for cron job
    } catch (error) {
      console.error('DeepSeek Master error:', error);
      setAnalysisError('Network error');
      setDeepSeekLoading(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Extract predictions from any system response structure
  const extractSystemPredictions = (raw: any) => {
    if (!raw) {
      console.log('⚠️ extractSystemPredictions: raw is null/undefined');
      return null;
    }
    
    // Helper function to normalize prediction strings to standard format
    const normalizeBtts = (val: any): { prediction: 'yes' | 'no'; confidence: number } | null => {
      if (!val) return null;
      if (typeof val === 'object' && val.prediction) return val;
      const str = String(val).toLowerCase();
      const confidence = raw.bttsConf || raw.btts?.confidence || 0;
      return { prediction: (str.includes('yes') || str === '1') ? 'yes' : 'no', confidence };
    };
    
    const normalizeOverUnder = (val: any): { prediction: 'over' | 'under'; confidence: number } | null => {
      if (!val) return null;
      if (typeof val === 'object' && val.prediction) return val;
      const str = String(val).toLowerCase();
      const confidence = raw.overUnderConf || raw.overUnder?.confidence || raw.overUnder25?.confidence || 0;
      return { prediction: str.includes('over') ? 'over' : 'under', confidence };
    };
    
    const normalizeMatchResult = (val: any): { prediction: 'home' | 'draw' | 'away'; confidence: number } | null => {
      if (!val) return null;
      if (typeof val === 'object' && val.prediction) return val;
      const str = String(val).toLowerCase();
      const confidence = raw.matchResultConf || raw.matchResult?.confidence || 0;
      let prediction: 'home' | 'draw' | 'away' = 'home';
      if (str.includes('draw') || str === 'x' || str === '0') prediction = 'draw';
      else if (str.includes('away') || str === '2' || str.includes('win') && str.includes('away')) prediction = 'away';
      else if (str.includes('home') || str === '1' || str.includes('win') && str.includes('home')) prediction = 'home';
      return { prediction, confidence };
    };
    
    // Try various possible structures
    // 1. Direct consensus (from database) - SystemAnalysis format
    if (raw.consensus && raw.consensus.btts) {
      console.log('✅ Found: raw.consensus');
      return {
        btts: raw.consensus.btts,
        overUnder: raw.consensus.overUnder || raw.consensus.overUnder25,
        matchResult: raw.consensus.matchResult,
      };
    }
    
    // 2. result.consensus (from API response)
    if (raw.result?.consensus) {
      console.log('✅ Found: raw.result.consensus');
      return {
        btts: raw.result.consensus.btts,
        overUnder: raw.result.consensus.overUnder || raw.result.consensus.overUnder25,
        matchResult: raw.result.consensus.matchResult,
      };
    }
    
    // 3. analysis object (from API response)
    if (raw.analysis) {
      console.log('✅ Found: raw.analysis');
      return {
        btts: raw.analysis.btts,
        overUnder: raw.analysis.overUnder || raw.analysis.overUnder25,
        matchResult: raw.analysis.matchResult,
      };
    }
    
    // 4. multiModel.consensus (for AI Agents)
    if (raw.multiModel?.consensus) {
      console.log('✅ Found: raw.multiModel.consensus');
      return {
        btts: raw.multiModel.consensus.btts,
        overUnder: raw.multiModel.consensus.overUnder || raw.multiModel.consensus.overUnder25,
        matchResult: raw.multiModel.consensus.matchResult,
      };
    }
    
    // 5. professionalMarkets (for AI Agents fallback)
    if (raw.professionalMarkets) {
      console.log('✅ Found: raw.professionalMarkets');
      return {
        btts: raw.professionalMarkets.btts,
        overUnder: raw.professionalMarkets.overUnder25,
        matchResult: raw.professionalMarkets.matchResult,
      };
    }
    
    // 6. reports[0].predictions (for AI Agents last resort)
    if (raw.reports?.[0]?.predictions) {
      console.log('✅ Found: raw.reports[0].predictions');
      return {
        btts: raw.reports[0].predictions.btts,
        overUnder: raw.reports[0].predictions.overUnder || raw.reports[0].predictions.overUnder25,
        matchResult: raw.reports[0].predictions.matchResult,
      };
    }
    
    // 7. Flat structure with btts, overUnder, matchResult as strings (from DeepSeek evaluate)
    if (raw.btts || raw.overUnder || raw.matchResult) {
      console.log('✅ Found: flat structure with string predictions');
      const btts = normalizeBtts(raw.btts);
      const overUnder = normalizeOverUnder(raw.overUnder || raw.overUnder25);
      const matchResult = normalizeMatchResult(raw.matchResult);
      
      if (btts || overUnder || matchResult) {
        return { btts, overUnder, matchResult };
      }
    }
    
    console.log('❌ extractSystemPredictions: No valid structure found');
    return null;
  };

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
                    <div 
                      key={match.id} 
                      onClick={() => setSelectedMatch(match)}
                      className={`p-4 hover:bg-gray-700/30 transition-all cursor-pointer ${selectedMatch?.id === match.id ? 'bg-green-500/10 border-l-4 border-green-500' : ''}`}
                    >
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
                                <span className="w-2 h-2 rounded-full bg-green-500" title="AI Consensus"></span>
                                <span className="w-2 h-2 rounded-full bg-cyan-500" title="Quad-Brain"></span>
                                <span className="w-2 h-2 rounded-full bg-purple-500" title="AI Agents"></span>
                                <span className="text-[10px] text-gray-400 ml-1">✓ Analyzed</span>
                              </div>
                            )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            runDeepSeekMasterAnalysis(match);
                          }}
                          className="ml-2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1"
                          title={l.analyze || 'Tam Analiz'}
                        >
                          🎯 <span className="hidden sm:inline">{l.analyze || 'Tam Analiz'}</span>
                        </button>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Analyzed Matches (Top Confidence) */}
            {analyzedMatches.length > 0 && (
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl border border-purple-500/30 overflow-hidden">
                <div className="p-4 border-b border-purple-500/30 bg-purple-900/20">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <span>🎯</span> {lang === 'tr' ? 'En İyi Analizler' : 'Top Analyses'}
                    <span className="ml-auto px-2 py-1 bg-purple-500/30 text-purple-200 text-xs rounded-lg">{analyzedMatches.length}</span>
                  </h2>
                  <p className="text-xs text-purple-300/70 mt-1">{lang === 'tr' ? 'DeepSeek Master confidence\'a göre sıralanmış' : 'Sorted by DeepSeek Master confidence'}</p>
                </div>
                
                <div className="max-h-[500px] overflow-y-auto divide-y divide-purple-500/20">
                  {analyzedMatchesLoading ? (
                    <div className="p-8 text-center text-purple-300/50">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      {l.loading}
                    </div>
                  ) : (
                    analyzedMatches.map((analyzedMatch: any) => {
                      const confidence = analyzedMatch.averageConfidence || 0;
                      const riskLevel = analyzedMatch.risk_level?.toLowerCase() || 'medium';
                      
                      // Confidence color based on value
                      const confidenceColor = confidence >= 75 ? 'text-green-400' : confidence >= 60 ? 'text-yellow-400' : 'text-orange-400';
                      const confidenceBg = confidence >= 75 ? 'bg-green-500/20' : confidence >= 60 ? 'bg-yellow-500/20' : 'bg-orange-500/20';
                      
                      // Risk color
                      const riskColor = riskLevel === 'low' ? 'text-green-400' : riskLevel === 'medium' ? 'text-yellow-400' : 'text-red-400';
                      
                      return (
                        <div
                          key={analyzedMatch.fixture_id}
                          onClick={async () => {
                            // Find match in matches list and select it
                            const match = matches.find(m => m.id === analyzedMatch.fixture_id);
                            if (match) {
                              setSelectedMatch(match);
                              // Load existing analysis immediately
                              try {
                                console.log(`🔍 Loading analysis for ${analyzedMatch.home_team} vs ${analyzedMatch.away_team}...`);
                                const existingRes = await fetch(`/api/match-full-analysis?fixture_id=${analyzedMatch.fixture_id}`, {
                                  method: 'GET',
                                  headers: { 'Content-Type': 'application/json' },
                                });
                                if (existingRes.ok) {
                                  const existingData = await existingRes.json();
                                  console.log('📊 Analysis data received:', existingData);
                                  console.log('   📊 Analysis structure check:', {
                                    hasDeepSeek: !!existingData.analysis?.deepseek_master,
                                    hasAIConsensus: !!existingData.analysis?.ai_consensus,
                                    hasQuadBrain: !!existingData.analysis?.quad_brain,
                                    hasAIAgents: !!existingData.analysis?.ai_agents,
                                  });
                                  
                                  if (existingData.success && existingData.analysis?.deepseek_master) {
                                    console.log('✅ Setting DeepSeek Master analysis...');
                                    console.log('   - AI Consensus structure:', existingData.analysis.ai_consensus ? 'EXISTS' : 'MISSING');
                                    console.log('   - AI Consensus keys:', existingData.analysis.ai_consensus ? Object.keys(existingData.analysis.ai_consensus) : 'N/A');
                                    console.log('   - AI Consensus.consensus:', existingData.analysis.ai_consensus?.consensus);
                                    console.log('   - Quad Brain structure:', existingData.analysis.quad_brain ? 'EXISTS' : 'MISSING');
                                    console.log('   - AI Agents structure:', existingData.analysis.ai_agents ? 'EXISTS' : 'MISSING');
                                    
                                    // Set DeepSeek Master with raw system data
                                    // Note: deepseek_master contains: finalVerdict, confidence, reasoning, systemAgreement, riskLevel, bestBet, warnings, processingTime
                                    setDeepSeekMasterAnalysis({
                                      finalVerdict: existingData.analysis.deepseek_master?.finalVerdict,
                                      confidence: existingData.analysis.deepseek_master?.confidence,
                                      reasoning: existingData.analysis.deepseek_master?.reasoning,
                                      systemAgreement: existingData.analysis.deepseek_master?.systemAgreement,
                                      riskLevel: existingData.analysis.deepseek_master?.riskLevel,
                                      bestBet: existingData.analysis.deepseek_master?.bestBet,
                                      warnings: existingData.analysis.deepseek_master?.warnings,
                                      processingTime: existingData.analysis.deepseek_master?.processingTime,
                                      aiConsensusRaw: existingData.analysis.ai_consensus,
                                      quadBrainRaw: existingData.analysis.quad_brain,
                                      aiAgentsRaw: existingData.analysis.ai_agents,
                                    });
                                    
                                    // Also set individual analyses so they can be viewed separately
                                    if (existingData.analysis.ai_consensus) {
                                      setAnalysis(existingData.analysis.ai_consensus);
                                    }
                                    if (existingData.analysis.quad_brain) {
                                      setQuadBrainAnalysis(existingData.analysis.quad_brain);
                                    }
                                    if (existingData.analysis.ai_agents) {
                                      setAgentAnalysis(existingData.analysis.ai_agents);
                                    }
                                    
                                    // Set to deepseek mode to show the results
                                    setAnalysisMode('deepseek');
                                  } else {
                                    console.warn('⚠️ No DeepSeek Master analysis found');
                                  }
                                }
                              } catch (e) {
                                console.error('❌ Error loading analysis:', e);
                              }
                            } else {
                              console.warn(`⚠️ Match not found in matches list for fixture_id: ${analyzedMatch.fixture_id}`);
                            }
                          }}
                          className={`p-4 hover:bg-purple-900/40 transition-all cursor-pointer ${
                            selectedMatch?.id === analyzedMatch.fixture_id ? 'bg-purple-800/50 border-l-4 border-purple-400' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-white text-sm mb-1">
                                {analyzedMatch.home_team} vs {analyzedMatch.away_team}
                              </div>
                              <div className="text-xs text-purple-300/70">{analyzedMatch.league}</div>
                            </div>
                            <div className={`px-2 py-1 rounded-lg ${confidenceBg} ${confidenceColor} text-xs font-bold ml-2`}>
                              %{confidence}
                            </div>
                          </div>
                          
                          {/* Predictions Preview */}
                          <div className="flex items-center gap-3 text-xs mt-2">
                            <div className="flex items-center gap-1">
                              <span className="text-purple-300/70">BTTS:</span>
                              <span className={`font-medium ${analyzedMatch.best_btts === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                                {analyzedMatch.best_btts?.toUpperCase() || '-'}
                              </span>
                              <span className="text-purple-300/50">({analyzedMatch.best_btts_confidence || 0}%)</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-purple-300/70">O/U:</span>
                              <span className={`font-medium ${analyzedMatch.best_over_under === 'over' ? 'text-green-400' : 'text-red-400'}`}>
                                {analyzedMatch.best_over_under?.toUpperCase() || '-'}
                              </span>
                              <span className="text-purple-300/50">({analyzedMatch.best_over_under_confidence || 0}%)</span>
                            </div>
                          </div>
                          
                          {/* Risk Level */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${riskColor} bg-gray-800/50`}>
                              {lang === 'tr' ? 'Risk' : 'Risk'}: {riskLevel === 'low' ? (lang === 'tr' ? 'Düşük' : 'Low') : riskLevel === 'medium' ? (lang === 'tr' ? 'Orta' : 'Medium') : (lang === 'tr' ? 'Yüksek' : 'High')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Analysis Panel or League Stats */}
          <div className="lg:col-span-2">
            {selectedMatch ? (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                {/* Match Header */}
                <div className="p-6 bg-gradient-to-r from-gray-800/80 to-gray-700/80 border-b border-gray-700/50">
                  {/* Back Button */}
                  {(analysis || agentAnalysis || quadBrainAnalysis || deepSeekMasterAnalysis) && (
                    <button
                      onClick={() => {
                        setSelectedMatch(null);
                        setDeepSeekMasterAnalysis(null);
                        setAnalysis(null);
                        setAgentAnalysis(null);
                        setQuadBrainAnalysis(null);
                        setAnalysisMode('standard');
                      }}
                      className="mb-4 flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-lg transition-all text-sm"
                    >
                      <span>←</span>
                      <span>{lang === 'tr' ? 'Geri' : lang === 'de' ? 'Zurück' : 'Back'}</span>
                    </button>
                  )}
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

                {/* Action Buttons - Clean Layout */}
                <div className="p-4 border-b border-gray-700/50 space-y-3">
                  {/* 🎯 MAIN BUTTON - Full Analysis */}
                  <button 
                    onClick={() => runDeepSeekMasterAnalysis()} 
                    disabled={deepSeekLoading || analyzing || quadBrainLoading || agentLoading || !userProfile?.canAnalyze} 
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${userProfile?.canAnalyze ? 'bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 hover:from-red-500 hover:via-orange-400 hover:to-yellow-400 text-white shadow-lg shadow-orange-500/25' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    <span className="text-2xl">🎯</span>
                    <div className="flex flex-col items-start">
                      <span className="text-sm">{deepSeekLoading ? 'Analiz Yapılıyor...' : 'Tam Analiz Başlat'}</span>
                      <span className="text-[10px] opacity-75">AI + Quad-Brain + Agents → DeepSeek Master</span>
                    </div>
                    {deepSeekLoading && <span className="animate-spin text-xl">⏳</span>}
                  </button>

                  {/* Quick Access - Individual Systems */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Hızlı:</span>
                    <button 
                      onClick={() => analyzeMatch(selectedMatch)} 
                      disabled={analyzing || !userProfile?.canAnalyze} 
                      className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${userProfile?.canAnalyze ? 'bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30' : 'bg-gray-700/50 text-gray-500'}`}
                    >
                      🤖 {analyzing ? '...' : 'AI'}
                    </button>
                    <button 
                      onClick={runQuadBrainAnalysis} 
                      disabled={quadBrainLoading || !userProfile?.canAnalyze} 
                      className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${userProfile?.canAnalyze ? 'bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-600/30' : 'bg-gray-700/50 text-gray-500'}`}
                    >
                      🧠 {quadBrainLoading ? '...' : 'Quad'}
                    </button>
                    <button 
                      onClick={runAgentAnalysis} 
                      disabled={agentLoading || !userProfile?.canUseAgents} 
                      className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${userProfile?.canUseAgents ? 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-600/30' : 'bg-gray-700/50 text-gray-500'}`}
                    >
                      🔮 {agentLoading ? '...' : 'Agents'}
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
                                deepSeekMasterAnalysis.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                                deepSeekMasterAnalysis.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {deepSeekMasterAnalysis.riskLevel?.toUpperCase() || 'MEDIUM'} RISK
                              </div>
                            </div>
                            <p className="text-gray-400 text-xs">
                              AI Consensus + Quad-Brain + AI Agents → DeepSeek Master Final Verdict
                            </p>
                          </div>

                          {/* Best Bet */}
                          {deepSeekMasterAnalysis.bestBet && (
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/40 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-yellow-400 text-xs font-medium mb-1">🏆 BEST BET</div>
                                  <div className="text-2xl font-bold text-white">
                                    {deepSeekMasterAnalysis.bestBet.market} - {deepSeekMasterAnalysis.bestBet.selection}
                                  </div>
                                  <div className="text-sm text-gray-400 mt-1">
                                    {deepSeekMasterAnalysis.bestBet.reasoning}
                                  </div>
                                </div>
                                <div className="text-3xl font-bold text-yellow-400">
                                  %{deepSeekMasterAnalysis.bestBet.confidence}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Final Verdict - 3 Markets */}
                          {deepSeekMasterAnalysis.finalVerdict && (
                            <div className="grid grid-cols-3 gap-3">
                              {/* BTTS */}
                              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                                <div className="text-xs text-gray-500 mb-1">BTTS</div>
                                <div className={`text-lg font-bold ${
                                  deepSeekMasterAnalysis.finalVerdict.btts?.prediction === 'yes' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {deepSeekMasterAnalysis.finalVerdict.btts?.prediction?.toUpperCase()}
                                </div>
                                <div className="text-sm text-gray-400">
                                  %{deepSeekMasterAnalysis.finalVerdict.btts?.confidence}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {deepSeekMasterAnalysis.systemAgreement?.btts}/3 systems agree
                                </div>
                              </div>

                              {/* Over/Under */}
                              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                                <div className="text-xs text-gray-500 mb-1">Over/Under 2.5</div>
                                <div className={`text-lg font-bold ${
                                  deepSeekMasterAnalysis.finalVerdict.overUnder?.prediction === 'over' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {deepSeekMasterAnalysis.finalVerdict.overUnder?.prediction?.toUpperCase()}
                                </div>
                                <div className="text-sm text-gray-400">
                                  %{deepSeekMasterAnalysis.finalVerdict.overUnder?.confidence}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {deepSeekMasterAnalysis.systemAgreement?.overUnder}/3 systems agree
                                </div>
                              </div>

                              {/* Match Result */}
                              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                                <div className="text-xs text-gray-500 mb-1">Match Result</div>
                                <div className={`text-lg font-bold ${
                                  deepSeekMasterAnalysis.finalVerdict.matchResult?.prediction === 'home' ? 'text-blue-400' :
                                  deepSeekMasterAnalysis.finalVerdict.matchResult?.prediction === 'away' ? 'text-orange-400' : 'text-gray-400'
                                }`}>
                                  {deepSeekMasterAnalysis.finalVerdict.matchResult?.prediction?.toUpperCase()}
                                </div>
                                <div className="text-sm text-gray-400">
                                  %{deepSeekMasterAnalysis.finalVerdict.matchResult?.confidence}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {deepSeekMasterAnalysis.systemAgreement?.matchResult}/3 systems agree
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
                                {(() => {
                                  const predictions = extractSystemPredictions(deepSeekMasterAnalysis.aiConsensusRaw);
                                  if (!predictions || (!predictions.btts && !predictions.overUnder && !predictions.matchResult)) {
                                    return <div className="text-[10px] text-gray-500">No data</div>;
                                  }
                                  
                                  return (
                                    <div className="space-y-1 text-[10px]">
                                      <div>BTTS: <span className="text-green-400">{(String(predictions.btts?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.btts?.confidence || 0}</span></div>
                                      <div>O/U: <span className="text-blue-400">{(String(predictions.overUnder?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.overUnder?.confidence || 0}</span></div>
                                      <div>MS: <span className="text-yellow-400">{(String(predictions.matchResult?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.matchResult?.confidence || 0}</span></div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Quad Brain */}
                              <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                                <div className="text-cyan-400 text-lg mb-1">🧠</div>
                                <div className="text-xs text-gray-400 mb-2">Quad-Brain</div>
                                {(() => {
                                  const predictions = extractSystemPredictions(deepSeekMasterAnalysis.quadBrainRaw);
                                  if (!predictions || (!predictions.btts && !predictions.overUnder && !predictions.matchResult)) {
                                    return <div className="text-[10px] text-gray-500">No data</div>;
                                  }
                                  
                                  return (
                                    <div className="space-y-1 text-[10px]">
                                      <div>BTTS: <span className="text-green-400">{(String(predictions.btts?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.btts?.confidence || 0}</span></div>
                                      <div>O/U: <span className="text-blue-400">{(String(predictions.overUnder?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.overUnder?.confidence || 0}</span></div>
                                      <div>MS: <span className="text-yellow-400">{(String(predictions.matchResult?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.matchResult?.confidence || 0}</span></div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* AI Agents */}
                              <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                                <div className="text-purple-400 text-lg mb-1">🔮</div>
                                <div className="text-xs text-gray-400 mb-2">AI Agents</div>
                                {(() => {
                                  const predictions = extractSystemPredictions(deepSeekMasterAnalysis.aiAgentsRaw);
                                  if (!predictions || (!predictions.btts && !predictions.overUnder && !predictions.matchResult)) {
                                    return <div className="text-[10px] text-gray-500">No data</div>;
                                  }
                                  
                                  return (
                                    <div className="space-y-1 text-[10px]">
                                      <div>BTTS: <span className="text-green-400">{(String(predictions.btts?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.btts?.confidence || 0}</span></div>
                                      <div>O/U: <span className="text-blue-400">{(String(predictions.overUnder?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.overUnder?.confidence || 0}</span></div>
                                      <div>MS: <span className="text-yellow-400">{(String(predictions.matchResult?.prediction || '-')).toUpperCase()}</span> <span className="text-gray-500">%{predictions.matchResult?.confidence || 0}</span></div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Warnings */}
                          {deepSeekMasterAnalysis.warnings && deepSeekMasterAnalysis.warnings.length > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                              <div className="text-yellow-400 text-xs font-medium mb-2">⚠️ Warnings</div>
                              {deepSeekMasterAnalysis.warnings.map((warning: string, i: number) => (
                                <div key={i} className="text-sm text-yellow-300/80">• {warning}</div>
                              ))}
                            </div>
                          )}

                          {/* Processing Time */}
                          {deepSeekMasterAnalysis.duration && (
                            <div className="text-center text-xs text-gray-500">
                              Analysis completed in {(deepSeekMasterAnalysis.duration / 1000).toFixed(1)}s
                            </div>
                          )}
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
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-gray-700/50">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>📊</span> Lig Analiz Özeti
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Bugünün maçlarına göre lig bazında analiz durumu</p>
                </div>
                
                <div className="max-h-[600px] overflow-y-auto p-4">
                  {leagues.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <div className="text-6xl mb-4">⚽</div>
                      <p className="text-lg">Maç bulunamadı</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {leagues.map((league) => {
                        const leagueMatches = filteredMatches.filter(m => m.league === league);
                        const analyzedCount = leagueMatches.filter(m => matchAnalysisStatus[m.id]?.hasAnalysis).length;
                        const totalCount = leagueMatches.length;
                        const analysisPercentage = totalCount > 0 ? Math.round((analyzedCount / totalCount) * 100) : 0;
                        
                        return (
                          <div key={league} className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-bold text-white">{league}</h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{analyzedCount}/{totalCount} analiz</span>
                                <div className="w-24 h-2 bg-gray-600 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      analysisPercentage >= 80 ? 'bg-green-500' :
                                      analysisPercentage >= 50 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${analysisPercentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-12 text-right">{analysisPercentage}%</span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                              {leagueMatches.slice(0, 6).map((match) => {
                                const status = matchAnalysisStatus[match.id];
                                const hasAnalysis = status?.hasAnalysis;
                                
                                return (
                                  <div
                                    key={match.id}
                                    onClick={() => setSelectedMatch(match)}
                                    className="p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-all cursor-pointer border border-gray-600/20"
                                  >
                                    <div className="text-xs text-white font-medium truncate">
                                      {match.homeTeam} vs {match.awayTeam}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      {hasAnalysis ? (
                                        <>
                                          <span className="text-[10px] text-green-400">✅</span>
                                          <span className="text-[10px] text-gray-400">
                                            {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-[10px] text-gray-500">⏳</span>
                                          <span className="text-[10px] text-gray-500">
                                            {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {leagueMatches.length > 6 && (
                              <div className="text-center mt-3">
                                <span className="text-xs text-gray-500">
                                  +{leagueMatches.length - 6} maç daha
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - League Standings & Stats */}
          <div className="lg:col-span-1 space-y-4">
            {selectedMatch ? (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                {/* League Header */}
                <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/80 to-gray-700/80">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedMatch.leagueLogo && (
                      <img src={selectedMatch.leagueLogo} alt="" className="w-6 h-6" />
                    )}
                    <h3 className="font-bold text-white text-sm">{selectedMatch.league}</h3>
                  </div>
                  <p className="text-xs text-gray-400">Lig Analiz Tablosu</p>
                </div>

                {/* Standings Content */}
                <div className="p-4 max-h-[800px] overflow-y-auto">
                  {leagueStandingsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : leagueStandings?.standings ? (
                    <div className="space-y-4">
                      {/* Overall Standings Table */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-2">
                          <span>📊</span> Genel Puan Tablosu
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-700/50">
                                <th className="text-left py-2 px-2 text-gray-400 font-medium">#</th>
                                <th className="text-left py-2 px-2 text-gray-400 font-medium">Takım</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">O</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">G</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">B</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">M</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">A</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">Y</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">P</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leagueStandings.standings.slice(0, 10).map((team: any) => (
                                <tr 
                                  key={team.teamId} 
                                  className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${
                                    team.teamId === selectedMatch.homeTeamId || team.teamId === selectedMatch.awayTeamId
                                      ? 'bg-green-500/10'
                                      : ''
                                  }`}
                                >
                                  <td className="py-2 px-2 text-gray-300 font-medium">{team.position}</td>
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-1.5">
                                      {team.teamLogo && (
                                        <img src={team.teamLogo} alt="" className="w-4 h-4" />
                                      )}
                                      <span className="text-white text-[10px] font-medium truncate max-w-[80px]">
                                        {team.teamName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.played}</td>
                                  <td className="py-2 px-1 text-center text-green-400">{team.won}</td>
                                  <td className="py-2 px-1 text-center text-yellow-400">{team.drawn}</td>
                                  <td className="py-2 px-1 text-center text-red-400">{team.lost}</td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.goalsFor}</td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.goalsAgainst}</td>
                                  <td className="py-2 px-1 text-center text-white font-bold">{team.points}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Home Standings Table */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-2">
                          <span>🏠</span> Ev Sahibi İstatistikleri
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-700/50">
                                <th className="text-left py-2 px-2 text-gray-400 font-medium">Takım</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">O</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">G</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">B</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">M</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">A</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">Y</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">P</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leagueStandings.standings
                                .sort((a: any, b: any) => b.homePoints - a.homePoints)
                                .slice(0, 10)
                                .map((team: any) => (
                                <tr 
                                  key={team.teamId} 
                                  className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${
                                    team.teamId === selectedMatch.homeTeamId
                                      ? 'bg-green-500/10'
                                      : ''
                                  }`}
                                >
                                  <td className="py-2 px-2">
                                    <span className="text-white text-[10px] font-medium truncate max-w-[100px] block">
                                      {team.teamName}
                                    </span>
                                  </td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.homePlayed}</td>
                                  <td className="py-2 px-1 text-center text-green-400">{team.homeWon}</td>
                                  <td className="py-2 px-1 text-center text-yellow-400">{team.homeDrawn}</td>
                                  <td className="py-2 px-1 text-center text-red-400">{team.homeLost}</td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.homeGoalsFor}</td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.homeGoalsAgainst}</td>
                                  <td className="py-2 px-1 text-center text-white font-bold">{team.homePoints}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Away Standings Table */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-2">
                          <span>✈️</span> Deplasman İstatistikleri
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-700/50">
                                <th className="text-left py-2 px-2 text-gray-400 font-medium">Takım</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">O</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">G</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">B</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">M</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">A</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">Y</th>
                                <th className="text-center py-2 px-1 text-gray-400 font-medium">P</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leagueStandings.standings
                                .sort((a: any, b: any) => b.awayPoints - a.awayPoints)
                                .slice(0, 10)
                                .map((team: any) => (
                                <tr 
                                  key={team.teamId} 
                                  className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${
                                    team.teamId === selectedMatch.awayTeamId
                                      ? 'bg-green-500/10'
                                      : ''
                                  }`}
                                >
                                  <td className="py-2 px-2">
                                    <span className="text-white text-[10px] font-medium truncate max-w-[100px] block">
                                      {team.teamName}
                                    </span>
                                  </td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.awayPlayed}</td>
                                  <td className="py-2 px-1 text-center text-green-400">{team.awayWon}</td>
                                  <td className="py-2 px-1 text-center text-yellow-400">{team.awayDrawn}</td>
                                  <td className="py-2 px-1 text-center text-red-400">{team.awayLost}</td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.awayGoalsFor}</td>
                                  <td className="py-2 px-1 text-center text-gray-300">{team.awayGoalsAgainst}</td>
                                  <td className="py-2 px-1 text-center text-white font-bold">{team.awayPoints}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <span className="text-2xl block mb-2">📊</span>
                      <p className="text-xs">Lig verileri yüklenemedi</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 flex items-center justify-center h-[400px] text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-sm">Maç seçin</p>
                  <p className="text-xs text-gray-500 mt-1">Lig analiz tablosu görüntülenecek</p>
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
