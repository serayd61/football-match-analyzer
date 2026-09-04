// src/app/stats/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import { Spinner } from '@/components/ui';
import { motion } from 'framer-motion';

interface TeamStats {
  id: number;
  name: string;
  logo?: string;
  recentForm: {
    form: string[];
    points: number;
    goalsScored: number;
    goalsConceded: number;
  };
  recentMatches: any[];
  stats?: any;
}

interface H2HStats {
  matches: any[];
  stats: {
    team1Wins: number;
    team2Wins: number;
    draws: number;
    totalGoals: number;
    avgGoals: string;
    totalMatches: number;
  };
}

interface MatchData {
  fixture: {
    id: number;
    startTime: string;
    venue: string;
    league: string;
    leagueId: number;
    leagueLogo?: string;
  };
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  h2h: H2HStats;
}

// Team Logo Component
const TeamLogo = ({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-2xl'
  };

  if (src) {
    return (
      <img 
        src={src} 
        alt={name}
        className={`${sizeClasses[size].split(' ').slice(0, 2).join(' ')} object-contain`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center font-bold text-content`}>
      {name.charAt(0)}
    </div>
  );
};

export default function StatsPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'form' | 'h2h' | 'goals'>('overview');
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: '📊 Maç İstatistikleri',
      subtitle: 'Detaylı takım analizi ve karşılaştırmaları',
      back: '← Dashboard',
      loading: 'Yükleniyor...',
      noMatches: 'Bugün maç bulunmuyor',
      selectMatch: 'Detaylı istatistik için maç seçin',
      overview: 'Genel Bakış',
      form: 'Form Durumu',
      h2h: 'Karşılıklı',
      goals: 'Gol İstatistikleri',
      last5: 'Son 5 Maç',
      homeForm: 'Ev Sahibi Formu',
      awayForm: 'Deplasman Formu',
      win: 'G',
      draw: 'B',
      loss: 'M',
      points: 'Puan',
      scored: 'Attığı',
      conceded: 'Yediği',
      avgGoals: 'Ort. Gol',
      h2hRecord: 'Karşılıklı Sonuçlar',
      totalMatches: 'Toplam Maç',
      wins: 'Galibiyet',
      draws: 'Beraberlik',
      venue: 'Stadyum',
      kickoff: 'Başlama',
      league: 'Lig',
      recentResults: 'Son Sonuçlar',
      goalTrends: 'Gol Trendleri',
      over25: '2.5 Üst Oranı',
      bttsRate: 'KG Var Oranı',
      cleanSheets: 'Gol Yememe',
      failedToScore: 'Gol Atamama',
      homeAdvantage: 'Ev Avantajı',
      awayRecord: 'Deplasman Performansı',
      bothTeams: 'Her İki Takım',
      team1: 'Ev Sahibi',
      team2: 'Deplasman',
      vsHistory: 'Tarihçe',
      prediction: 'Tahmin İpucu',
      strong: 'Güçlü',
      weak: 'Zayıf',
      neutral: 'Nötr'
    },
    en: {
      title: '📊 Match Statistics',
      subtitle: 'Detailed team analysis and comparisons',
      back: '← Dashboard',
      loading: 'Loading...',
      noMatches: 'No matches today',
      selectMatch: 'Select a match for detailed stats',
      overview: 'Overview',
      form: 'Form Guide',
      h2h: 'Head to Head',
      goals: 'Goal Stats',
      last5: 'Last 5 Matches',
      homeForm: 'Home Team Form',
      awayForm: 'Away Team Form',
      win: 'W',
      draw: 'D',
      loss: 'L',
      points: 'Points',
      scored: 'Scored',
      conceded: 'Conceded',
      avgGoals: 'Avg Goals',
      h2hRecord: 'Head to Head Record',
      totalMatches: 'Total Matches',
      wins: 'Wins',
      draws: 'Draws',
      venue: 'Venue',
      kickoff: 'Kick-off',
      league: 'League',
      recentResults: 'Recent Results',
      goalTrends: 'Goal Trends',
      over25: 'Over 2.5 Rate',
      bttsRate: 'BTTS Rate',
      cleanSheets: 'Clean Sheets',
      failedToScore: 'Failed to Score',
      homeAdvantage: 'Home Advantage',
      awayRecord: 'Away Record',
      bothTeams: 'Both Teams',
      team1: 'Home',
      team2: 'Away',
      vsHistory: 'History',
      prediction: 'Prediction Hint',
      strong: 'Strong',
      weak: 'Weak',
      neutral: 'Neutral'
    },
    de: {
      title: '📊 Spielstatistiken',
      subtitle: 'Detaillierte Teamanalyse und Vergleiche',
      back: '← Dashboard',
      loading: 'Laden...',
      noMatches: 'Heute keine Spiele',
      selectMatch: 'Spiel für Details auswählen',
      overview: 'Übersicht',
      form: 'Formkurve',
      h2h: 'Direktvergleich',
      goals: 'Torstatistik',
      last5: 'Letzte 5 Spiele',
      homeForm: 'Heimform',
      awayForm: 'Auswärtsform',
      win: 'S',
      draw: 'U',
      loss: 'N',
      points: 'Punkte',
      scored: 'Erzielt',
      conceded: 'Kassiert',
      avgGoals: 'Ø Tore',
      h2hRecord: 'Direktvergleich',
      totalMatches: 'Gesamt Spiele',
      wins: 'Siege',
      draws: 'Unentschieden',
      venue: 'Stadion',
      kickoff: 'Anpfiff',
      league: 'Liga',
      recentResults: 'Letzte Ergebnisse',
      goalTrends: 'Tortrends',
      over25: 'Über 2.5 Quote',
      bttsRate: 'Beide treffen Quote',
      cleanSheets: 'Ohne Gegentor',
      failedToScore: 'Ohne Tor',
      homeAdvantage: 'Heimvorteil',
      awayRecord: 'Auswärtsbilanz',
      bothTeams: 'Beide Teams',
      team1: 'Heim',
      team2: 'Auswärts',
      vsHistory: 'Historie',
      prediction: 'Tipp-Hinweis',
      strong: 'Stark',
      weak: 'Schwach',
      neutral: 'Neutral'
    }
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?type=overview&date=${selectedDate}`);
      const data = await res.json();
      
      if (data.success) {
        setMatches(data.matches || []);
        if (data.matches?.length > 0 && !selectedMatch) {
          setSelectedMatch(data.matches[0]);
        }
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getFormColor = (result: string) => {
    switch (result) {
      case 'W': return 'bg-green-500 text-content';
      case 'D': return 'bg-yellow-500 text-black';
      case 'L': return 'bg-red-500 text-content';
      default: return 'bg-gray-500 text-content';
    }
  };

  const getStrengthLevel = (points: number) => {
    if (points >= 12) return { text: l.strong, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (points >= 7) return { text: l.neutral, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { text: l.weak, color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const calculateGoalStats = (recentMatches: any[], teamId: number | undefined) => {
    if (!recentMatches || recentMatches.length === 0 || !teamId) {
      return { over25: 0, btts: 0, cleanSheets: 0, failedToScore: 0, avgScored: 0, avgConceded: 0 };
    }

    let over25Count = 0;
    let bttsCount = 0;
    let cleanSheets = 0;
    let failedToScore = 0;
    let totalScored = 0;
    let totalConceded = 0;
    let validMatches = 0;

    recentMatches.forEach((match: any) => {
      const homeParticipant = match.participants?.find((p: any) => p.meta?.location === 'home');
      const isHome = homeParticipant?.id === teamId || String(homeParticipant?.id) === String(teamId);
      
      let homeScore = 0;
      let awayScore = 0;

      if (match.scores && Array.isArray(match.scores)) {
        match.scores.forEach((s: any) => {
          if (s.description === 'CURRENT' || s.type_id === 1525 || s.description === '2ND_HALF') {
            if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
            if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
          }
        });
      }
      
      if (homeScore === 0 && awayScore === 0) {
        homeScore = match.scores?.home || match.home_score || 0;
        awayScore = match.scores?.away || match.away_score || 0;
      }

      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;
      const totalGoals = homeScore + awayScore;

      if (totalGoals > 0 || (homeScore === 0 && awayScore === 0)) {
        validMatches++;
        totalScored += teamScore;
        totalConceded += opponentScore;

        if (totalGoals > 2.5) over25Count++;
        if (homeScore > 0 && awayScore > 0) bttsCount++;
        if (opponentScore === 0) cleanSheets++;
        if (teamScore === 0) failedToScore++;
      }
    });

    const total = validMatches > 0 ? validMatches : 1;
    return {
      over25: Math.round((over25Count / total) * 100),
      btts: Math.round((bttsCount / total) * 100),
      cleanSheets: Math.round((cleanSheets / total) * 100),
      failedToScore: Math.round((failedToScore / total) * 100),
      avgScored: Number((totalScored / total).toFixed(1)),
      avgConceded: Number((totalConceded / total).toFixed(1))
    };
  };

  const matchesByLeague = matches.reduce((acc: Record<string, MatchData[]>, match) => {
    const league = match.fixture.league || 'Other';
    if (!acc[league]) acc[league] = [];
    acc[league].push(match);
    return acc;
  }, {});

  const toggleLeague = (league: string) => {
    const newExpanded = new Set(expandedLeagues);
    if (newExpanded.has(league)) {
      newExpanded.delete(league);
    } else {
      newExpanded.add(league);
    }
    setExpandedLeagues(newExpanded);
  };

  if (loading) {
    return (
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="grid place-items-center py-32 text-center">
          <div>
            <Spinner size={28} className="text-brand-400 mx-auto mb-4" />
            <p className="text-content-muted">{l.loading}</p>
            <p className="text-content-subtle text-sm mt-2">Takım istatistikleri yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      {/* Header */}
      <header className="border-b border-line bg-surface-0/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard" className="text-content-muted hover:text-content text-sm mb-2 inline-block">
                {l.back}
              </Link>
              <h1 className="text-2xl font-bold text-content">{l.title}</h1>
              <p className="text-content-muted text-sm">{l.subtitle}</p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-surface-2 text-content px-4 py-2 rounded-xl border border-line focus:border-brand-500 outline-none"
              />
              <div className="text-sm text-content-muted">
                📅 {matches.length} maç
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {matches.length === 0 ? (
          <div className="text-center py-20 bg-surface-2 rounded-2xl">
            <div className="text-7xl mb-4">📭</div>
            <p className="text-content-muted text-xl">{l.noMatches}</p>
            <p className="text-content-subtle mt-2">Başka bir tarih seçin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol Panel - Maç Listesi */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-surface-2 border border-line/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-line/50">
                  <h2 className="text-lg font-bold text-content">📅 {l.selectMatch}</h2>
                </div>
                <div className="max-h-[700px] overflow-y-auto">
                  {Object.entries(matchesByLeague).map(([league, leagueMatches]) => (
                    <div key={league}>
                      <button
                        onClick={() => toggleLeague(league)}
                        className="w-full px-4 py-3 bg-surface-3 flex items-center justify-between hover:bg-surface-3 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          {leagueMatches[0]?.fixture.leagueLogo && (
                            <img 
                              src={leagueMatches[0].fixture.leagueLogo} 
                              alt="" 
                              className="w-5 h-5 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <span className="text-sm font-medium text-content-muted">{league}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-content-subtle">{leagueMatches.length} maç</span>
                          <span className="text-content-muted">{expandedLeagues.has(league) ? '▼' : '▶'}</span>
                        </div>
                      </button>
                      {(expandedLeagues.has(league) || expandedLeagues.size === 0) && (
                        <div className="divide-y divide-gray-700/30">
                          {leagueMatches.map((match) => (
                            <button
                              key={match.fixture.id}
                              onClick={() => setSelectedMatch(match)}
                              className={`w-full p-4 text-left hover:bg-surface-3 transition-all ${
                                selectedMatch?.fixture.id === match.fixture.id
                                  ? 'bg-blue-500/10 border-l-4 border-blue-500'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Home Team with Logo */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {match.homeTeam.logo ? (
                                      <img 
                                        src={match.homeTeam.logo} 
                                        alt="" 
                                        className="w-6 h-6 object-contain flex-shrink-0"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    ) : (
                                      <div className="w-6 h-6 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-content flex-shrink-0">
                                        {match.homeTeam.name.charAt(0)}
                                      </div>
                                    )}
                                    <span className="font-medium text-content truncate text-sm">{match.homeTeam.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {match.awayTeam.logo ? (
                                      <img 
                                        src={match.awayTeam.logo} 
                                        alt="" 
                                        className="w-6 h-6 object-contain flex-shrink-0"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    ) : (
                                      <div className="w-6 h-6 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-content flex-shrink-0">
                                        {match.awayTeam.name.charAt(0)}
                                      </div>
                                    )}
                                    <span className="font-medium text-content truncate text-sm">{match.awayTeam.name}</span>
                                  </div>
                                </div>
                                
                                {/* Form indicators */}
                                <div className="flex flex-col items-end gap-1 ml-2">
                                  <div className="flex gap-0.5">
                                    {match.homeTeam.recentForm.form.slice(0, 5).map((r, i) => (
                                      <span key={i} className={`w-4 h-4 rounded text-[10px] flex items-center justify-center ${getFormColor(r)}`}>
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex gap-0.5">
                                    {match.awayTeam.recentForm.form.slice(0, 5).map((r, i) => (
                                      <span key={i} className={`w-4 h-4 rounded text-[10px] flex items-center justify-center ${getFormColor(r)}`}>
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-content-subtle">
                                  {new Date(match.fixture.startTime).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {match.h2h.stats.totalMatches > 0 && (
                                  <span className="text-xs text-purple-400">
                                    H2H: {match.h2h.stats.totalMatches} maç
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sağ Panel - Detaylı İstatistikler */}
            <div className="lg:col-span-2">
              {selectedMatch ? (
                <div className="space-y-6">
                  {/* Maç Başlığı - LOGOLU */}
                  <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {selectedMatch.fixture.leagueLogo && (
                          <img 
                            src={selectedMatch.fixture.leagueLogo} 
                            alt="" 
                            className="w-5 h-5 object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <span className="text-sm text-content-muted">{selectedMatch.fixture.league}</span>
                      </div>
                      <div className="text-sm text-content-muted">
                        {new Date(selectedMatch.fixture.startTime).toLocaleString(lang, {
                          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    {/* Teams with Logos */}
                    <div className="flex items-center justify-center gap-6">
                      {/* Home Team */}
                      <div className="text-center flex-1">
                        <div className="flex justify-center mb-3">
                          {selectedMatch.homeTeam.logo ? (
                            <img 
                              src={selectedMatch.homeTeam.logo} 
                              alt={selectedMatch.homeTeam.name}
                              className="w-16 h-16 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-2xl font-bold text-content">
                              {selectedMatch.homeTeam.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="text-xl font-bold text-content mb-2">{selectedMatch.homeTeam.name}</div>
                        <div className="flex justify-center gap-1">
                          {selectedMatch.homeTeam.recentForm.form.map((r, i) => (
                            <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${getFormColor(r)}`}>
                              {r === 'W' ? l.win : r === 'D' ? l.draw : l.loss}
                            </span>
                          ))}
                        </div>
                        <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm ${getStrengthLevel(selectedMatch.homeTeam.recentForm.points).bg} ${getStrengthLevel(selectedMatch.homeTeam.recentForm.points).color}`}>
                          {getStrengthLevel(selectedMatch.homeTeam.recentForm.points).text} ({selectedMatch.homeTeam.recentForm.points} pts)
                        </div>
                      </div>
                      
                      {/* VS */}
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center border-2 border-line">
                          <span className="text-xl font-bold text-content-muted">VS</span>
                        </div>
                      </div>
                      
                      {/* Away Team */}
                      <div className="text-center flex-1">
                        <div className="flex justify-center mb-3">
                          {selectedMatch.awayTeam.logo ? (
                            <img 
                              src={selectedMatch.awayTeam.logo} 
                              alt={selectedMatch.awayTeam.name}
                              className="w-16 h-16 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-2xl font-bold text-content">
                              {selectedMatch.awayTeam.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="text-xl font-bold text-content mb-2">{selectedMatch.awayTeam.name}</div>
                        <div className="flex justify-center gap-1">
                          {selectedMatch.awayTeam.recentForm.form.map((r, i) => (
                            <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${getFormColor(r)}`}>
                              {r === 'W' ? l.win : r === 'D' ? l.draw : l.loss}
                            </span>
                          ))}
                        </div>
                        <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm ${getStrengthLevel(selectedMatch.awayTeam.recentForm.points).bg} ${getStrengthLevel(selectedMatch.awayTeam.recentForm.points).color}`}>
                          {getStrengthLevel(selectedMatch.awayTeam.recentForm.points).text} ({selectedMatch.awayTeam.recentForm.points} pts)
                        </div>
                      </div>
                    </div>
                    
                    {selectedMatch.fixture.venue && (
                      <div className="text-center mt-4 text-sm text-content-muted">
                        🏟️ {selectedMatch.fixture.venue}
                      </div>
                    )}
                  </div>

                  {/* Sekmeler */}
                  <div className="flex gap-2 bg-surface-2 p-1 rounded-xl">
                    {(['overview', 'form', 'h2h', 'goals'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          activeTab === tab
                            ? 'bg-blue-600 text-content shadow-lg'
                            : 'text-content-muted hover:text-content hover:bg-surface-3'
                        }`}
                      >
                        {tab === 'overview' && '📊'} {l[tab]}
                      </button>
                    ))}
                  </div>

                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Home Form Card with Logo */}
                      <div className="bg-surface-2 border border-line/50 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          {selectedMatch.homeTeam.logo ? (
                            <img src={selectedMatch.homeTeam.logo} alt="" className="w-8 h-8 object-contain" />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-content">
                              {selectedMatch.homeTeam.name.charAt(0)}
                            </div>
                          )}
                          <h3 className="text-lg font-bold text-content">{l.homeForm}</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.points} (Son 5)</span>
                            <span className="text-content font-bold">{selectedMatch.homeTeam.recentForm.points}/15</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.scored}</span>
                            <span className="text-green-400 font-bold">{selectedMatch.homeTeam.recentForm.goalsScored}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.conceded}</span>
                            <span className="text-red-400 font-bold">{selectedMatch.homeTeam.recentForm.goalsConceded}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.avgGoals}</span>
                            <span className="text-yellow-400 font-bold">
                              {((selectedMatch.homeTeam.recentForm.goalsScored + selectedMatch.homeTeam.recentForm.goalsConceded) / 5).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Away Form Card with Logo */}
                      <div className="bg-surface-2 border border-line/50 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          {selectedMatch.awayTeam.logo ? (
                            <img src={selectedMatch.awayTeam.logo} alt="" className="w-8 h-8 object-contain" />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-content">
                              {selectedMatch.awayTeam.name.charAt(0)}
                            </div>
                          )}
                          <h3 className="text-lg font-bold text-content">{l.awayForm}</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.points} (Son 5)</span>
                            <span className="text-content font-bold">{selectedMatch.awayTeam.recentForm.points}/15</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.scored}</span>
                            <span className="text-green-400 font-bold">{selectedMatch.awayTeam.recentForm.goalsScored}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.conceded}</span>
                            <span className="text-red-400 font-bold">{selectedMatch.awayTeam.recentForm.goalsConceded}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-content-muted">{l.avgGoals}</span>
                            <span className="text-yellow-400 font-bold">
                              {((selectedMatch.awayTeam.recentForm.goalsScored + selectedMatch.awayTeam.recentForm.goalsConceded) / 5).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* H2H Record */}
                      {selectedMatch.h2h.stats.totalMatches > 0 && (
                        <div className="col-span-2 bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-500/30 rounded-xl p-5">
                          <h3 className="text-lg font-bold text-content mb-4">⚔️ {l.h2hRecord}</h3>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="flex flex-col items-center">
                              {selectedMatch.homeTeam.logo && (
                                <img src={selectedMatch.homeTeam.logo} alt="" className="w-8 h-8 object-contain mb-2" />
                              )}
                              <div className="text-3xl font-bold text-green-400">{selectedMatch.h2h.stats.team1Wins}</div>
                              <div className="text-sm text-content-muted">{selectedMatch.homeTeam.name}</div>
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-yellow-400">{selectedMatch.h2h.stats.draws}</div>
                              <div className="text-sm text-content-muted">{l.draws}</div>
                            </div>
                            <div className="flex flex-col items-center">
                              {selectedMatch.awayTeam.logo && (
                                <img src={selectedMatch.awayTeam.logo} alt="" className="w-8 h-8 object-contain mb-2" />
                              )}
                              <div className="text-3xl font-bold text-blue-400">{selectedMatch.h2h.stats.team2Wins}</div>
                              <div className="text-sm text-content-muted">{selectedMatch.awayTeam.name}</div>
                            </div>
                          </div>
                          <div className="mt-4 text-center text-sm text-content-muted">
                            {l.totalMatches}: {selectedMatch.h2h.stats.totalMatches} | {l.avgGoals}: {selectedMatch.h2h.stats.avgGoals}
                          </div>
                        </div>
                      )}

                      {/* Prediction Tips */}
                      <div className="col-span-2 bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-yellow-500/30 rounded-xl p-5">
                        <h3 className="text-lg font-bold text-yellow-400 mb-3">💡 {l.prediction}</h3>
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const homeGoalStats = calculateGoalStats(selectedMatch.homeTeam.recentMatches, selectedMatch.homeTeam.id);
                            const awayGoalStats = calculateGoalStats(selectedMatch.awayTeam.recentMatches, selectedMatch.awayTeam.id);
                            const avgOver25 = (homeGoalStats.over25 + awayGoalStats.over25) / 2;
                            const avgBtts = (homeGoalStats.btts + awayGoalStats.btts) / 2;
                            
                            const tips = [];
                            
                            if (avgOver25 >= 60) {
                              tips.push({ text: `Üst 2.5 Gol (Her iki takımın maçlarının %${Math.round(avgOver25)}'i 2.5 üstü)`, type: 'success' });
                            } else if (avgOver25 <= 40) {
                              tips.push({ text: `Alt 2.5 Gol (Her iki takımın maçlarının sadece %${Math.round(avgOver25)}'i 2.5 üstü)`, type: 'warning' });
                            }
                            
                            if (avgBtts >= 60) {
                              tips.push({ text: `KG Var (Maçların %${Math.round(avgBtts)}'inde her iki takım da gol attı)`, type: 'success' });
                            }
                            
                            const homePts = selectedMatch.homeTeam.recentForm.points;
                            const awayPts = selectedMatch.awayTeam.recentForm.points;
                            
                            if (homePts >= 12 && awayPts <= 6) {
                              tips.push({ text: `Ev sahibi favori (Form: ${homePts} vs ${awayPts} puan)`, type: 'info' });
                            } else if (awayPts >= 12 && homePts <= 6) {
                              tips.push({ text: `Deplasman sürprizi olabilir (Form: ${awayPts} vs ${homePts} puan)`, type: 'info' });
                            } else if (Math.abs(homePts - awayPts) <= 3) {
                              tips.push({ text: `Dengeli maç, beraberlik ihtimali yüksek`, type: 'warning' });
                            }
                            
                            return tips.length > 0 ? tips.map((tip, i) => (
                              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${
                                tip.type === 'success' ? 'bg-green-500/10 text-green-400' :
                                tip.type === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                <span>{tip.type === 'success' ? '✅' : tip.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                                <span>{tip.text}</span>
                              </div>
                            )) : (
                              <div className="text-content-muted">Yeterli veri yok</div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Tab - with Logos */}
                  {activeTab === 'form' && (
                    <div className="space-y-6">
                      <div className="bg-surface-2 border border-line/50 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-line/50 bg-green-500/10 flex items-center gap-3">
                          {selectedMatch.homeTeam.logo && (
                            <img src={selectedMatch.homeTeam.logo} alt="" className="w-8 h-8 object-contain" />
                          )}
                          <h3 className="font-bold text-content">{selectedMatch.homeTeam.name} - {l.last5}</h3>
                        </div>
                        <div className="divide-y divide-gray-700/30">
                          {selectedMatch.homeTeam.recentMatches?.slice(0, 5).map((match: any, idx: number) => {
                            const home = match.participants?.find((p: any) => p.meta?.location === 'home');
                            const away = match.participants?.find((p: any) => p.meta?.location === 'away');
                            let homeScore = 0, awayScore = 0;
                            (match.scores || []).forEach((s: any) => {
                              if (s.description === 'CURRENT' || s.type_id === 1525) {
                                if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
                                if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
                              }
                            });
                            
                            return (
                              <div key={idx} className="p-3 flex items-center justify-between hover:bg-surface-3/20">
                                <div className="flex items-center gap-3">
                                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${getFormColor(selectedMatch.homeTeam.recentForm.form[idx])}`}>
                                    {selectedMatch.homeTeam.recentForm.form[idx]}
                                  </span>
                                  <div>
                                    <div className="text-content text-sm">{home?.name} vs {away?.name}</div>
                                    <div className="text-xs text-content-subtle">{match.league?.name}</div>
                                  </div>
                                </div>
                                <div className="text-lg font-bold text-content">
                                  {homeScore} - {awayScore}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-surface-2 border border-line/50 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-line/50 bg-blue-500/10 flex items-center gap-3">
                          {selectedMatch.awayTeam.logo && (
                            <img src={selectedMatch.awayTeam.logo} alt="" className="w-8 h-8 object-contain" />
                          )}
                          <h3 className="font-bold text-content">{selectedMatch.awayTeam.name} - {l.last5}</h3>
                        </div>
                        <div className="divide-y divide-gray-700/30">
                          {selectedMatch.awayTeam.recentMatches?.slice(0, 5).map((match: any, idx: number) => {
                            const home = match.participants?.find((p: any) => p.meta?.location === 'home');
                            const away = match.participants?.find((p: any) => p.meta?.location === 'away');
                            let homeScore = 0, awayScore = 0;
                            (match.scores || []).forEach((s: any) => {
                              if (s.description === 'CURRENT' || s.type_id === 1525) {
                                if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
                                if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
                              }
                            });
                            
                            return (
                              <div key={idx} className="p-3 flex items-center justify-between hover:bg-surface-3/20">
                                <div className="flex items-center gap-3">
                                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${getFormColor(selectedMatch.awayTeam.recentForm.form[idx])}`}>
                                    {selectedMatch.awayTeam.recentForm.form[idx]}
                                  </span>
                                  <div>
                                    <div className="text-content text-sm">{home?.name} vs {away?.name}</div>
                                    <div className="text-xs text-content-subtle">{match.league?.name}</div>
                                  </div>
                                </div>
                                <div className="text-lg font-bold text-content">
                                  {homeScore} - {awayScore}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* H2H Tab */}
                  {activeTab === 'h2h' && (
                    <div className="space-y-6">
                      {selectedMatch.h2h.stats.totalMatches > 0 ? (
                        <>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 text-center">
                              {selectedMatch.homeTeam.logo && (
                                <img src={selectedMatch.homeTeam.logo} alt="" className="w-10 h-10 object-contain mx-auto mb-2" />
                              )}
                              <div className="text-4xl font-bold text-green-400">{selectedMatch.h2h.stats.team1Wins}</div>
                              <div className="text-sm text-content-muted mt-1">{selectedMatch.homeTeam.name}</div>
                              <div className="text-xs text-content-subtle">{l.wins}</div>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 text-center">
                              <div className="text-4xl font-bold text-yellow-400">{selectedMatch.h2h.stats.draws}</div>
                              <div className="text-sm text-content-muted mt-1">{l.draws}</div>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 text-center">
                              {selectedMatch.awayTeam.logo && (
                                <img src={selectedMatch.awayTeam.logo} alt="" className="w-10 h-10 object-contain mx-auto mb-2" />
                              )}
                              <div className="text-4xl font-bold text-blue-400">{selectedMatch.h2h.stats.team2Wins}</div>
                              <div className="text-sm text-content-muted mt-1">{selectedMatch.awayTeam.name}</div>
                              <div className="text-xs text-content-subtle">{l.wins}</div>
                            </div>
                          </div>

                          <div className="bg-surface-2 border border-line/50 rounded-xl p-5">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-center p-4 bg-surface-3 rounded-lg">
                                <div className="text-2xl font-bold text-content">{selectedMatch.h2h.stats.totalGoals}</div>
                                <div className="text-sm text-content-muted">Toplam Gol</div>
                              </div>
                              <div className="text-center p-4 bg-surface-3 rounded-lg">
                                <div className="text-2xl font-bold text-yellow-400">{selectedMatch.h2h.stats.avgGoals}</div>
                                <div className="text-sm text-content-muted">{l.avgGoals}</div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-surface-2 border border-line/50 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-line/50">
                              <h3 className="font-bold text-content">⚔️ {l.vsHistory}</h3>
                            </div>
                            <div className="divide-y divide-gray-700/30">
                              {selectedMatch.h2h.matches.map((match: any, idx: number) => (
                                <div key={idx} className="p-4 hover:bg-surface-3/20">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-content">{match.homeTeam}</span>
                                        <span className="text-2xl font-bold text-content">{match.homeScore} - {match.awayScore}</span>
                                        <span className="text-content">{match.awayTeam}</span>
                                      </div>
                                      <div className="text-xs text-content-subtle mt-1">
                                        {new Date(match.date).toLocaleDateString(lang)} • {match.league}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        match.homeScore + match.awayScore > 2.5 
                                          ? 'bg-green-500/20 text-green-400' 
                                          : 'bg-red-500/20 text-red-400'
                                      }`}>
                                        {match.homeScore + match.awayScore > 2.5 ? 'Ü2.5' : 'A2.5'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-16 bg-surface-2 rounded-2xl">
                          <div className="text-6xl mb-4">🤷</div>
                          <p className="text-content-muted">Bu takımlar daha önce karşılaşmamış</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Goals Tab - with Logos */}
                  {activeTab === 'goals' && (
                    <div className="space-y-6">
                      {(() => {
                        const homeStats = calculateGoalStats(selectedMatch.homeTeam.recentMatches, selectedMatch.homeTeam.id);
                        const awayStats = calculateGoalStats(selectedMatch.awayTeam.recentMatches, selectedMatch.awayTeam.id);
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="bg-surface-2 border border-line/50 rounded-xl p-5">
                                <div className="flex items-center gap-3 mb-4">
                                  {selectedMatch.homeTeam.logo && (
                                    <img src={selectedMatch.homeTeam.logo} alt="" className="w-8 h-8 object-contain" />
                                  )}
                                  <h3 className="font-bold text-content">{selectedMatch.homeTeam.name}</h3>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.over25}</span>
                                      <span className="text-content font-bold">{homeStats.over25}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${homeStats.over25}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.bttsRate}</span>
                                      <span className="text-content font-bold">{homeStats.btts}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${homeStats.btts}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.cleanSheets}</span>
                                      <span className="text-content font-bold">{homeStats.cleanSheets}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${homeStats.cleanSheets}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.failedToScore}</span>
                                      <span className="text-content font-bold">{homeStats.failedToScore}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${homeStats.failedToScore}%` }}></div>
                                    </div>
                                  </div>
                                  <div className="pt-4 border-t border-line">
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                      <div className="p-3 bg-green-500/10 rounded-lg">
                                        <div className="text-2xl font-bold text-green-400">{homeStats.avgScored}</div>
                                        <div className="text-xs text-content-muted">{l.scored}/maç</div>
                                      </div>
                                      <div className="p-3 bg-red-500/10 rounded-lg">
                                        <div className="text-2xl font-bold text-red-400">{homeStats.avgConceded}</div>
                                        <div className="text-xs text-content-muted">{l.conceded}/maç</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-surface-2 border border-line/50 rounded-xl p-5">
                                <div className="flex items-center gap-3 mb-4">
                                  {selectedMatch.awayTeam.logo && (
                                    <img src={selectedMatch.awayTeam.logo} alt="" className="w-8 h-8 object-contain" />
                                  )}
                                  <h3 className="font-bold text-content">{selectedMatch.awayTeam.name}</h3>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.over25}</span>
                                      <span className="text-content font-bold">{awayStats.over25}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${awayStats.over25}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.bttsRate}</span>
                                      <span className="text-content font-bold">{awayStats.btts}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${awayStats.btts}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.cleanSheets}</span>
                                      <span className="text-content font-bold">{awayStats.cleanSheets}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${awayStats.cleanSheets}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-content-muted">{l.failedToScore}</span>
                                      <span className="text-content font-bold">{awayStats.failedToScore}%</span>
                                    </div>
                                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${awayStats.failedToScore}%` }}></div>
                                    </div>
                                  </div>
                                  <div className="pt-4 border-t border-line">
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                      <div className="p-3 bg-green-500/10 rounded-lg">
                                        <div className="text-2xl font-bold text-green-400">{awayStats.avgScored}</div>
                                        <div className="text-xs text-content-muted">{l.scored}/maç</div>
                                      </div>
                                      <div className="p-3 bg-red-500/10 rounded-lg">
                                        <div className="text-2xl font-bold text-red-400">{awayStats.avgConceded}</div>
                                        <div className="text-xs text-content-muted">{l.conceded}/maç</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-gradient-to-r from-green-600/10 to-yellow-600/10 border border-green-500/30 rounded-xl p-5">
                              <h3 className="font-bold text-content mb-4">🎯 {l.goalTrends}</h3>
                              <div className="grid grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-surface-2 rounded-lg">
                                  <div className="text-3xl font-bold text-green-400">
                                    {Math.round((homeStats.over25 + awayStats.over25) / 2)}%
                                  </div>
                                  <div className="text-xs text-content-muted mt-1">{l.over25}</div>
                                  <div className="text-[10px] text-content-subtle">Ort.</div>
                                </div>
                                <div className="text-center p-4 bg-surface-2 rounded-lg">
                                  <div className="text-3xl font-bold text-yellow-400">
                                    {Math.round((homeStats.btts + awayStats.btts) / 2)}%
                                  </div>
                                  <div className="text-xs text-content-muted mt-1">{l.bttsRate}</div>
                                  <div className="text-[10px] text-content-subtle">Ort.</div>
                                </div>
                                <div className="text-center p-4 bg-surface-2 rounded-lg">
                                  <div className="text-3xl font-bold text-content">
                                    {(homeStats.avgScored + awayStats.avgScored).toFixed(1)}
                                  </div>
                                  <div className="text-xs text-content-muted mt-1">Beklenen Gol</div>
                                  <div className="text-[10px] text-content-subtle">Toplam</div>
                                </div>
                                <div className="text-center p-4 bg-surface-2 rounded-lg">
                                  <div className={`text-3xl font-bold ${
                                    (homeStats.avgScored + awayStats.avgScored) > 2.5 
                                      ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {(homeStats.avgScored + awayStats.avgScored) > 2.5 ? 'ÜST' : 'ALT'}
                                  </div>
                                  <div className="text-xs text-content-muted mt-1">2.5 Gol</div>
                                  <div className="text-[10px] text-content-subtle">Tahmin</div>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface-2 border border-line/50 rounded-2xl flex items-center justify-center h-[600px]">
                  <div className="text-center">
                    <div className="text-7xl mb-4">📊</div>
                    <p className="text-xl text-content-muted">{l.selectMatch}</p>
                    <p className="text-sm text-content-subtle mt-2">Sol taraftan bir maç seçin</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
