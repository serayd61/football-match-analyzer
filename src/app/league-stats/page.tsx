'use client';

// ============================================================================
// LEAGUE STATISTICS PAGE
// Analiz edilen liglerin puan tablosu, takım istatistikleri, son maçlar
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, BarChart3, TrendingUp, TrendingDown, 
  Target, Shield, Activity, Calendar, 
  ChevronRight, ChevronDown, RefreshCw,
  Home, ArrowLeft, Users, Award, Zap
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TeamStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  recentMatches: Array<{
    date: string;
    opponent: string;
    score: string;
    result: 'W' | 'D' | 'L';
  }>;
}

interface LeagueData {
  league: string;
  teamStats: Record<string, TeamStats>;
  standings: any[] | null;
  analyzedLeagues: string[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LeagueStatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [leagues, setLeagues] = useState<string[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [includeStandings, setIncludeStandings] = useState(false);

  // Analiz edilen ligleri yükle
  useEffect(() => {
    loadLeagues();
  }, []);

  // Seçili lig değiştiğinde verileri yükle
  useEffect(() => {
    if (selectedLeague) {
      loadLeagueData(selectedLeague);
    }
  }, [selectedLeague, includeStandings]);

  const loadLeagues = async () => {
    try {
      const response = await fetch('/api/league-stats');
      const data = await response.json();
      
      if (data.success) {
        setLeagues(data.analyzedLeagues || []);
        if (data.analyzedLeagues && data.analyzedLeagues.length > 0) {
          setSelectedLeague(data.analyzedLeagues[0]);
        }
      }
    } catch (error) {
      console.error('❌ Error loading leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeagueData = async (league: string) => {
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/league-stats?league=${encodeURIComponent(league)}&includeStandings=${includeStandings}`
      );
      const data = await response.json();
      
      if (data.success) {
        setLeagueData(data);
      }
    } catch (error) {
      console.error('❌ Error loading league data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getGoalDifference = (goalsFor: number, goalsAgainst: number): number => {
    return goalsFor - goalsAgainst;
  };

  const getFormColor = (result: 'W' | 'D' | 'L'): string => {
    switch (result) {
      case 'W': return 'text-green-400';
      case 'D': return 'text-yellow-400';
      case 'L': return 'text-red-400';
    }
  };

  const getFormBg = (result: 'W' | 'D' | 'L'): string => {
    switch (result) {
      case 'W': return 'bg-green-500/20 border-green-500/50';
      case 'D': return 'bg-yellow-500/20 border-yellow-500/50';
      case 'L': return 'bg-red-500/20 border-red-500/50';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#00f0ff] text-lg">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  // Takımları puan tablosuna göre sırala
  const sortedTeams = leagueData?.teamStats
    ? Object.entries(leagueData.teamStats)
        .map(([team, stats]) => ({
          team,
          ...stats,
          goalDifference: getGoalDifference(stats.goalsFor, stats.goalsAgainst)
        }))
        .sort((a, b) => {
          // Önce puana göre, sonra gol farkına göre
          if (b.points !== a.points) return b.points - a.points;
          return b.goalDifference - a.goalDifference;
        })
    : [];

  return (
    <div className="min-h-screen bg-black relative">
      {/* Header */}
      <header className="border-b border-[#00f0ff]/30 glass-futuristic sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 rounded-lg glass-futuristic hover:neon-border-cyan transition-all">
              <ArrowLeft className="w-5 h-5 text-[#00f0ff]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white neon-glow-cyan flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-[#00f0ff]" />
                Lig İstatistikleri
              </h1>
              <p className="text-xs text-[#00f0ff] font-medium tracking-wider uppercase">
                Puan Tablosu, Takım İstatistikleri, Son Maçlar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncludeStandings(!includeStandings)}
              className={`px-4 py-2 rounded-lg glass-futuristic transition-all ${
                includeStandings ? 'neon-border-cyan' : ''
              }`}
            >
              <Trophy className={`w-5 h-5 ${includeStandings ? 'text-[#00f0ff]' : 'text-gray-400'}`} />
            </button>
            <button
              onClick={() => selectedLeague && loadLeagueData(selectedLeague)}
              disabled={refreshing}
              className="p-2 rounded-lg glass-futuristic hover:neon-border-cyan transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-[#00f0ff] ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* League Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Lig Seç
          </label>
          <div className="flex flex-wrap gap-2">
            {leagues.map((league) => (
              <button
                key={league}
                onClick={() => setSelectedLeague(league)}
                className={`px-4 py-2 rounded-lg glass-futuristic transition-all ${
                  selectedLeague === league
                    ? 'neon-border-cyan bg-[#00f0ff]/10'
                    : 'hover:border-[#00f0ff]/30'
                }`}
              >
                <span className="text-white font-medium">{league}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedLeague && leagueData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* League Header */}
            <div className="mb-6 p-6 rounded-xl glass-futuristic neon-border-cyan">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-[#00f0ff]" />
                    {selectedLeague}
                  </h2>
                  <p className="text-gray-400">
                    {sortedTeams.length} takım • Son 30 gün içindeki analiz edilen maçlar
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#00f0ff]">
                    {Object.values(leagueData.teamStats).reduce((sum, stats) => sum + stats.matches, 0) / 2}
                  </div>
                  <div className="text-sm text-gray-400">Toplam Maç</div>
                </div>
              </div>
            </div>

            {/* Standings Table */}
            <div className="mb-8 rounded-xl glass-futuristic neon-border-cyan overflow-hidden">
              <div className="p-4 bg-[#00f0ff]/10 border-b border-[#00f0ff]/30">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#00f0ff]" />
                  Puan Tablosu
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#00f0ff]/20">
                      <th className="text-left p-4 text-gray-300 font-medium">#</th>
                      <th className="text-left p-4 text-gray-300 font-medium">Takım</th>
                      <th className="text-center p-4 text-gray-300 font-medium">O</th>
                      <th className="text-center p-4 text-gray-300 font-medium">G</th>
                      <th className="text-center p-4 text-gray-300 font-medium">B</th>
                      <th className="text-center p-4 text-gray-300 font-medium">M</th>
                      <th className="text-center p-4 text-gray-300 font-medium">A</th>
                      <th className="text-center p-4 text-gray-300 font-medium">Y</th>
                      <th className="text-center p-4 text-gray-300 font-medium">+/-</th>
                      <th className="text-center p-4 text-gray-300 font-medium">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((teamData, index) => (
                      <motion.tr
                        key={teamData.team}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-[#00f0ff]/10 hover:bg-[#00f0ff]/5 cursor-pointer transition-all"
                        onClick={() => setExpandedTeam(expandedTeam === teamData.team ? null : teamData.team)}
                      >
                        <td className="p-4">
                          <span className={`text-lg font-bold ${
                            index < 3 ? 'text-[#00f0ff]' : 'text-gray-400'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-medium">{teamData.team}</span>
                            {index < 3 && (
                              <Trophy className="w-4 h-4 text-yellow-400" />
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center text-gray-300">{teamData.matches}</td>
                        <td className="p-4 text-center text-green-400 font-medium">{teamData.wins}</td>
                        <td className="p-4 text-center text-yellow-400 font-medium">{teamData.draws}</td>
                        <td className="p-4 text-center text-red-400 font-medium">{teamData.losses}</td>
                        <td className="p-4 text-center text-gray-300">{teamData.goalsFor}</td>
                        <td className="p-4 text-center text-gray-300">{teamData.goalsAgainst}</td>
                        <td className="p-4 text-center">
                          <span className={`font-medium ${
                            teamData.goalDifference > 0 ? 'text-green-400' :
                            teamData.goalDifference < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {teamData.goalDifference > 0 ? '+' : ''}{teamData.goalDifference}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-xl font-bold text-[#00f0ff]">{teamData.points}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Team Details - Expandable */}
            <AnimatePresence>
              {expandedTeam && leagueData.teamStats[expandedTeam] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 rounded-xl glass-futuristic neon-border-cyan overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-[#00f0ff]" />
                        {expandedTeam}
                      </h3>
                      <button
                        onClick={() => setExpandedTeam(null)}
                        className="p-2 rounded-lg hover:bg-[#00f0ff]/10 transition-all"
                      >
                        <ChevronDown className="w-5 h-5 text-[#00f0ff] rotate-180" />
                      </button>
                    </div>

                    {/* Team Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 rounded-lg glass-futuristic">
                        <div className="text-sm text-gray-400 mb-1">Oynanan Maç</div>
                        <div className="text-2xl font-bold text-white">
                          {leagueData.teamStats[expandedTeam].matches}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg glass-futuristic">
                        <div className="text-sm text-gray-400 mb-1">Attığı Gol</div>
                        <div className="text-2xl font-bold text-green-400">
                          {leagueData.teamStats[expandedTeam].goalsFor}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg glass-futuristic">
                        <div className="text-sm text-gray-400 mb-1">Yediği Gol</div>
                        <div className="text-2xl font-bold text-red-400">
                          {leagueData.teamStats[expandedTeam].goalsAgainst}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg glass-futuristic">
                        <div className="text-sm text-gray-400 mb-1">Gol Farkı</div>
                        <div className={`text-2xl font-bold ${
                          getGoalDifference(
                            leagueData.teamStats[expandedTeam].goalsFor,
                            leagueData.teamStats[expandedTeam].goalsAgainst
                          ) > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {getGoalDifference(
                            leagueData.teamStats[expandedTeam].goalsFor,
                            leagueData.teamStats[expandedTeam].goalsAgainst
                          ) > 0 ? '+' : ''}
                          {getGoalDifference(
                            leagueData.teamStats[expandedTeam].goalsFor,
                            leagueData.teamStats[expandedTeam].goalsAgainst
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recent Matches */}
                    <div>
                      <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#00f0ff]" />
                        Son 10 Maç
                      </h4>
                      <div className="space-y-2">
                        {leagueData.teamStats[expandedTeam].recentMatches.map((match, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-4 rounded-lg border ${getFormBg(match.result)}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                  match.result === 'W' ? 'bg-green-500/30 text-green-400' :
                                  match.result === 'D' ? 'bg-yellow-500/30 text-yellow-400' :
                                  'bg-red-500/30 text-red-400'
                                }`}>
                                  {match.result}
                                </div>
                                <div>
                                  <div className="text-white font-medium">
                                    vs {match.opponent}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {new Date(match.date).toLocaleDateString('tr-TR')}
                                  </div>
                                </div>
                              </div>
                              <div className={`text-lg font-bold ${getFormColor(match.result)}`}>
                                {match.score}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {!selectedLeague && (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Lütfen bir lig seçin</p>
          </div>
        )}
      </main>
    </div>
  );
}
