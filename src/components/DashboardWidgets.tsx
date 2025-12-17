'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageProvider';

interface HotMatch {
  id: number;
  home: string;
  away: string;
  league: string;
  time: string;
  aiConfidence: number;
  prediction: string;
  isValueBet: boolean;
}

interface UserStats {
  totalPredictions: number;
  wonPredictions: number;
  winRate: number;
  currentStreak: number;
  streakType: 'win' | 'lose' | 'none';
  profit: number;
  rank: number;
  totalUsers: number;
}

interface LiveScore {
  id: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  league: string;
}

export default function DashboardWidgets() {
  const [hotMatches, setHotMatches] = useState<HotMatch[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  const labels = {
    tr: {
      hotMatches: '🔥 Sıcak Maçlar',
      aiPicks: 'AI Önerileri',
      yourStats: '📊 Senin İstatistiklerin',
      predictions: 'Tahmin',
      won: 'Kazandı',
      winRate: 'Başarı',
      streak: 'Seri',
      profit: 'Kar/Zarar',
      rank: 'Sıralama',
      liveScores: '🔴 Canlı Skorlar',
      aiInsight: '💡 AI Günlük Tavsiye',
      valueBet: 'Value Bet',
      confidence: 'Güven',
      viewAll: 'Tümünü Gör',
      noLiveMatches: 'Şu an canlı maç yok',
      winStreak: 'Kazanma Serisi',
      loseStreak: 'Kayıp Serisi',
      leaderboard: 'Liderlik',
      analyzeNow: 'Analiz Et',
      todayTip: 'Bugünün Tavsiyesi',
    },
    en: {
      hotMatches: '🔥 Hot Matches',
      aiPicks: 'AI Picks',
      yourStats: '📊 Your Statistics',
      predictions: 'Predictions',
      won: 'Won',
      winRate: 'Win Rate',
      streak: 'Streak',
      profit: 'Profit/Loss',
      rank: 'Rank',
      liveScores: '🔴 Live Scores',
      aiInsight: '💡 AI Daily Tip',
      valueBet: 'Value Bet',
      confidence: 'Confidence',
      viewAll: 'View All',
      noLiveMatches: 'No live matches right now',
      winStreak: 'Win Streak',
      loseStreak: 'Lose Streak',
      leaderboard: 'Leaderboard',
      analyzeNow: 'Analyze',
      todayTip: "Today's Tip",
    },
    de: {
      hotMatches: '🔥 Heiße Spiele',
      aiPicks: 'KI-Tipps',
      yourStats: '📊 Deine Statistiken',
      predictions: 'Vorhersagen',
      won: 'Gewonnen',
      winRate: 'Gewinnrate',
      streak: 'Serie',
      profit: 'Gewinn/Verlust',
      rank: 'Rang',
      liveScores: '🔴 Live-Ergebnisse',
      aiInsight: '💡 KI-Tagestipp',
      valueBet: 'Value Bet',
      confidence: 'Vertrauen',
      viewAll: 'Alle anzeigen',
      noLiveMatches: 'Keine Live-Spiele',
      winStreak: 'Gewinnserie',
      loseStreak: 'Verlustserie',
      leaderboard: 'Rangliste',
      analyzeNow: 'Analysieren',
      todayTip: 'Tipp des Tages',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchLiveScores, 60000); // Update live scores every minute
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchHotMatches(),
      fetchUserStats(),
      fetchLiveScores(),
      fetchAiInsight(),
    ]);
    setLoading(false);
  };

  const fetchHotMatches = async () => {
    // Simulated data - would come from API
    setHotMatches([
      { id: 1, home: 'Man City', away: 'Arsenal', league: 'Premier League', time: '20:45', aiConfidence: 78, prediction: '1', isValueBet: true },
      { id: 2, home: 'Barcelona', away: 'Real Madrid', league: 'La Liga', time: '21:00', aiConfidence: 65, prediction: 'X', isValueBet: false },
      { id: 3, home: 'Bayern', away: 'Dortmund', league: 'Bundesliga', time: '18:30', aiConfidence: 72, prediction: '1', isValueBet: true },
    ]);
  };

  const fetchUserStats = async () => {
    // Simulated data - would come from API
    setUserStats({
      totalPredictions: 47,
      wonPredictions: 31,
      winRate: 66,
      currentStreak: 4,
      streakType: 'win',
      profit: 234.50,
      rank: 127,
      totalUsers: 10547,
    });
  };

  const fetchLiveScores = async () => {
    try {
      const res = await fetch('/api/livescores');
      const data = await res.json();
      if (data.matches) {
        setLiveScores(data.matches.slice(0, 5).map((m: any) => ({
          id: m.id,
          home: m.homeTeam?.name || m.home || 'Home',
          away: m.awayTeam?.name || m.away || 'Away',
          homeScore: m.homeScore ?? m.score?.home ?? 0,
          awayScore: m.awayScore ?? m.score?.away ?? 0,
          minute: m.minute || m.elapsed || 45,
          league: m.league?.name || m.league || '',
        })));
      }
    } catch (error) {
      console.error('Error fetching live scores:', error);
    }
  };

  const fetchAiInsight = async () => {
    const insights = {
      tr: [
        'Bugün Premier League maçlarında Over 2.5 oranı yüksek görünüyor. Son 5 maçta %80 isabet.',
        'İspanya liginde ev sahibi avantajı bu hafta belirgin. Ev sahiplerini değerlendirin.',
        'Bundesliga\'da düşük oranlı favoriler güvenli görünüyor. Kombine için ideal.',
        'Bugün beraberlik oranları normalin üzerinde. X seçeneklerini gözden geçirin.',
      ],
      en: [
        'Premier League matches today show high Over 2.5 potential. 80% hit rate in last 5 matches.',
        'Home advantage is prominent in La Liga this week. Consider home teams.',
        'Low-odds favorites in Bundesliga look safe. Ideal for accumulators.',
        'Draw odds are above normal today. Review X options carefully.',
      ],
      de: [
        'Premier League Spiele zeigen heute hohes Over 2.5 Potenzial. 80% Trefferquote.',
        'Heimvorteil ist diese Woche in La Liga ausgeprägt. Heimteams in Betracht ziehen.',
        'Niedrige Quoten-Favoriten in der Bundesliga sehen sicher aus. Ideal für Kombis.',
        'Unentschieden-Quoten sind heute überdurchschnittlich. X-Optionen prüfen.',
      ],
    };
    
    const langInsights = insights[lang as keyof typeof insights] || insights.en;
    setAiInsight(langInsights[Math.floor(Math.random() * langInsights.length)]);
  };

  const getPredictionLabel = (pred: string) => {
    if (pred === '1') return lang === 'tr' ? 'Ev' : lang === 'de' ? 'Heim' : 'Home';
    if (pred === 'X') return lang === 'tr' ? 'Beraberlik' : lang === 'de' ? 'Unent.' : 'Draw';
    if (pred === '2') return lang === 'tr' ? 'Deplasman' : lang === 'de' ? 'Ausw.' : 'Away';
    return pred;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-800/50 rounded-2xl p-4 animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Top Row - 4 Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 🔥 Hot Matches */}
        <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white text-sm">{l.hotMatches}</h3>
            <span className="text-orange-400 text-xs animate-pulse">● LIVE</span>
          </div>
          <div className="space-y-2">
            {hotMatches.slice(0, 2).map(match => (
              <div key={match.id} className="bg-black/30 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-xs font-medium truncate">{match.home} vs {match.away}</span>
                  {match.isValueBet && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded">💎</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">{match.league}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold">{getPredictionLabel(match.prediction)}</span>
                    <span className="text-gray-400">{match.aiConfidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 📊 User Stats */}
        {userStats && (
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3">{l.yourStats}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{userStats.winRate}%</p>
                <p className="text-gray-400 text-[10px]">{l.winRate}</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${userStats.streakType === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                  {userStats.currentStreak}🔥
                </p>
                <p className="text-gray-400 text-[10px]">{userStats.streakType === 'win' ? l.winStreak : l.loseStreak}</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-bold ${userStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {userStats.profit >= 0 ? '+' : ''}{userStats.profit.toFixed(0)}
                </p>
                <p className="text-gray-400 text-[10px]">{l.profit}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">#{userStats.rank}</p>
                <p className="text-gray-400 text-[10px]">{l.rank}</p>
              </div>
            </div>
          </div>
        )}

        {/* 🔴 Live Scores */}
        <div className="bg-gradient-to-br from-red-900/30 to-pink-900/30 border border-red-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white text-sm">{l.liveScores}</h3>
            <Link href="/live" className="text-red-400 text-[10px] hover:underline">{l.viewAll}</Link>
          </div>
          {liveScores.length > 0 ? (
            <div className="space-y-2">
              {liveScores.slice(0, 2).map(match => (
                <div key={match.id} className="bg-black/30 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex-1 truncate">
                    <span className="text-white text-xs">{match.home}</span>
                    <span className="text-gray-500 text-xs mx-1">vs</span>
                    <span className="text-white text-xs">{match.away}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{match.homeScore}-{match.awayScore}</span>
                    <span className="text-red-400 text-[10px] animate-pulse">{match.minute}'</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-xs text-center py-4">{l.noLiveMatches}</p>
          )}
        </div>

        {/* 💡 AI Insight */}
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-4">
          <h3 className="font-bold text-white text-sm mb-2">{l.aiInsight}</h3>
          <div className="bg-black/30 rounded-lg p-3">
            <p className="text-gray-300 text-xs leading-relaxed">{aiInsight}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-green-400 text-[10px]">🧠 AI Consensus</span>
            <span className="text-gray-500 text-[10px]">{l.todayTip}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-2">
        <Link 
          href="/ai-performance" 
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 text-sm transition-all"
        >
          🧠 AI {lang === 'tr' ? 'Performans' : lang === 'de' ? 'Leistung' : 'Performance'}
        </Link>
        <Link 
          href="/leaderboard" 
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-xl text-yellow-300 text-sm transition-all"
        >
          🏆 {l.leaderboard}
        </Link>
        <Link 
          href="/coupons" 
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-300 text-sm transition-all"
        >
          🎫 {lang === 'tr' ? 'Kuponlarım' : lang === 'de' ? 'Meine Tipps' : 'My Coupons'}
        </Link>
        <Link 
          href="/predictions" 
          className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 text-sm transition-all"
        >
          🎯 {lang === 'tr' ? 'Tahminlerim' : lang === 'de' ? 'Vorhersagen' : 'Predictions'}
        </Link>
      </div>
    </div>
  );
}

