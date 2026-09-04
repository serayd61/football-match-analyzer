// src/app/leaderboard/page.tsx (migrated to fa-shell design system)

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import { motion } from 'framer-motion';
import { EmptyState } from '@/components/ui';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_image?: string;
  total_points: number;
  total_coupons: number;
  won_coupons: number;
  win_rate: number;
  user?: {
    id: string;
    name: string;
    image?: string;
  };
}

interface Winner {
  year: number;
  month: number;
  monthName: string;
  userId: string;
  userName: string;
  userImage?: string;
  totalPoints: number;
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const { lang } = useLanguage();
  
  const [period, setPeriod] = useState<'monthly' | 'alltime'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);

  const labels = {
    tr: {
      leaderboard: 'Liderlik Tablosu',
      leaderboardDesc: 'En iyi tahmin uzmanları arasında yerinizi alın',
      monthlyPrize: '🎁 Aylık Ödül',
      prizeDescription: 'Her ay 1. olan kullanıcı 1 aylık Pro üyelik kazanır!',
      monthly: 'Bu Ay',
      allTime: 'Tüm Zamanlar',
      yourRank: 'Sıralamanız',
      youAreRanked: '{rank}. sırada',
      earnPoints: '+ Puan Kazan',
      noRankingYet: 'Henüz sıralama yok',
      noPointsYet: 'Bu dönemde henüz puan kazanan yok. İlk sen ol!',
      pastWinners: 'Şampiyonlar Galerisi',
      points: 'puan',
      pts: 'PTS',
      coupons: 'kupon',
      winRate: 'başarı',
      wins: 'galibiyet',
      you: '(Siz)',
      anonymous: 'Anonim',
      january: 'Ocak', february: 'Şubat', march: 'Mart', april: 'Nisan',
      may: 'Mayıs', june: 'Haziran', july: 'Temmuz', august: 'Ağustos',
      september: 'Eylül', october: 'Ekim', november: 'Kasım', december: 'Aralık',
      rank: 'Sıra',
      player: 'Oyuncu',
      stats: 'İstatistik',
      score: 'Puan',
      topPlayers: 'En İyi Oyuncular',
      champion: 'Şampiyon',
      runnerUp: 'İkinci',
      thirdPlace: 'Üçüncü',
      createCoupon: 'Kupon Oluştur',
      startCompeting: 'Yarışmaya Başla',
      daysLeft: 'gün kaldı',
      hoursLeft: 'saat kaldı',
    },
    en: {
      leaderboard: 'Leaderboard',
      leaderboardDesc: 'Compete with the best prediction experts',
      monthlyPrize: '🎁 Monthly Prize',
      prizeDescription: 'Top scorer wins 1 month Pro subscription!',
      monthly: 'This Month',
      allTime: 'All Time',
      yourRank: 'Your Rank',
      youAreRanked: 'Ranked #{rank}',
      earnPoints: '+ Earn Points',
      noRankingYet: 'No rankings yet',
      noPointsYet: 'No points earned this period. Be the first!',
      pastWinners: 'Hall of Fame',
      points: 'points',
      pts: 'PTS',
      coupons: 'coupons',
      winRate: 'win rate',
      wins: 'wins',
      you: '(You)',
      anonymous: 'Anonymous',
      january: 'January', february: 'February', march: 'March', april: 'April',
      may: 'May', june: 'June', july: 'July', august: 'August',
      september: 'September', october: 'October', november: 'November', december: 'December',
      rank: 'Rank',
      player: 'Player',
      stats: 'Stats',
      score: 'Score',
      topPlayers: 'Top Players',
      champion: 'Champion',
      runnerUp: 'Runner Up',
      thirdPlace: 'Third Place',
      createCoupon: 'Create Coupon',
      startCompeting: 'Start Competing',
      daysLeft: 'days left',
      hoursLeft: 'hours left',
    },
    de: {
      leaderboard: 'Rangliste',
      leaderboardDesc: 'Messen Sie sich mit den besten Tippern',
      monthlyPrize: '🎁 Monatspreis',
      prizeDescription: 'Monatssieger gewinnt 1 Monat Pro-Abo!',
      monthly: 'Dieser Monat',
      allTime: 'Alle Zeiten',
      yourRank: 'Ihr Rang',
      youAreRanked: 'Platz {rank}',
      earnPoints: '+ Punkte sammeln',
      noRankingYet: 'Noch keine Rangliste',
      noPointsYet: 'Noch keine Punkte. Sei der Erste!',
      pastWinners: 'Hall of Fame',
      points: 'Punkte',
      pts: 'PTS',
      coupons: 'Tipps',
      winRate: 'Quote',
      wins: 'Siege',
      you: '(Sie)',
      anonymous: 'Anonym',
      january: 'Januar', february: 'Februar', march: 'März', april: 'April',
      may: 'Mai', june: 'Juni', july: 'Juli', august: 'August',
      september: 'September', october: 'Oktober', november: 'November', december: 'Dezember',
      rank: 'Rang',
      player: 'Spieler',
      stats: 'Statistik',
      score: 'Punkte',
      topPlayers: 'Top Spieler',
      champion: 'Sieger',
      runnerUp: 'Zweiter',
      thirdPlace: 'Dritter',
      createCoupon: 'Tipp erstellen',
      startCompeting: 'Jetzt mitmachen',
      daysLeft: 'Tage übrig',
      hoursLeft: 'Stunden übrig',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const MONTHS = [
    l.january, l.february, l.march, l.april, l.may, l.june,
    l.july, l.august, l.september, l.october, l.november, l.december
  ];

  // Ay sonuna kalan süre
  const getTimeRemaining = () => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const diff = endOfMonth.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours };
  };

  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    fetchLeaderboard();
    fetchWinners();
  }, [period, year, month]);
  
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        year: year.toString(),
        month: month.toString(),
        limit: '50',
      });
      
      const res = await fetch(`/api/leaderboard?${params}`);
      const data = await res.json();
      
      setLeaderboard(data.leaderboard || []);
      
      const odersuserId = (session?.user as any)?.id;
      if (userId) {
        const userEntry = data.leaderboard?.find(
          (e: LeaderboardEntry) => e.user_id === odersuserId || e.user?.id === odersuserId
        );
        setMyRank(userEntry?.rank || null);
        setMyEntry(userEntry || null);
      }
    } catch (error) {
      console.error('Fetch leaderboard error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchWinners = async () => {
    try {
      const res = await fetch('/api/coupons/monthly-prize?limit=6');
      const data = await res.json();
      setWinners(data.winners || []);
    } catch (error) {
      console.error('Fetch winners error:', error);
    }
  };
  
  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  
  const goToNextMonth = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (year === currentYear && month >= currentMonth) return;
    
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const userId = (session?.user as any)?.id;

  // Top 3 players
  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  // Avatar component
  const Avatar = ({ src, name, size = 'md', rank }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; rank?: number }) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-16 h-16 text-xl',
      xl: 'w-24 h-24 text-3xl',
    };
    
    const ringColors = {
      1: 'ring-4 ring-amber-400 shadow-lg shadow-amber-400/40',
      2: 'ring-4 ring-slate-300 shadow-lg shadow-slate-300/40',
      3: 'ring-4 ring-orange-600 shadow-lg shadow-orange-600/40',
    };

    return (
      <div className={`${sizes[size]} rounded-full flex items-center justify-center overflow-hidden ${rank && rank <= 3 ? ringColors[rank as 1|2|3] : 'ring-2 ring-line-strong'}`}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-4 flex items-center justify-center text-content font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />
      
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-4">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="text-5xl">🏆</span>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-content">
                {l.leaderboard}
              </h1>
            </div>
            <p className="text-content-muted text-lg">{l.leaderboardDesc}</p>
          </div>

          {/* Prize Banner */}
          <div className="max-w-2xl mx-auto mb-8 fa-card p-4 md:p-6 border-brand-500/30">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/25 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">🎁</span>
                  </div>
                  <div className="text-center md:text-left">
                    <h3 className="text-xl font-semibold tracking-tight text-content">{l.monthlyPrize}</h3>
                    <p className="text-content-muted text-sm">{l.prizeDescription}</p>
                  </div>
                </div>
                {period === 'monthly' && (
                  <div className="flex items-center gap-3 bg-surface-3 border border-line rounded-xl px-4 py-2">
                    <div className="text-center">
                      <span className="text-2xl font-bold text-content">{timeRemaining.days}</span>
                      <p className="text-xs text-content-subtle">{l.daysLeft}</p>
                    </div>
                    <div className="text-content-subtle text-xl">:</div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-content">{timeRemaining.hours}</span>
                      <p className="text-xs text-content-subtle">{l.hoursLeft}</p>
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* Period Tabs & Month Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            {/* Period Toggle */}
            <div className="flex bg-surface-2 border border-line rounded-xl p-1">
              <button
                onClick={() => setPeriod('monthly')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                  period === 'monthly'
                    ? 'bg-brand-500 text-surface-0 shadow-elev-1'
                    : 'text-content-muted hover:text-content'
                }`}
              >
                <span>📅</span>
                {l.monthly}
              </button>
              <button
                onClick={() => setPeriod('alltime')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                  period === 'alltime'
                    ? 'bg-brand-500 text-surface-0 shadow-elev-1'
                    : 'text-content-muted hover:text-content'
                }`}
              >
                <span>⭐</span>
                {l.allTime}
              </button>
            </div>

            {/* Month Selector */}
            {period === 'monthly' && (
              <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-xl p-1">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg hover:bg-surface-3 text-content-muted hover:text-content transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="px-4 py-2 text-content font-semibold min-w-[160px] text-center">
                  {MONTHS[month - 1]} {year}
                </span>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-surface-3 text-content-muted hover:text-content transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-content-muted">Loading rankings...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          /* ══════════════════════════════════════════════════════════════════════ */
          /* EMPTY STATE */
          /* ══════════════════════════════════════════════════════════════════════ */
          <EmptyState
            icon={<span className="text-4xl">🏆</span>}
            title={l.noRankingYet}
            description={l.noPointsYet}
            action={
              <Link href="/coupons/create" className="fa-btn fa-btn-primary fa-btn-lg">
                <span>🎯</span>
                {l.startCompeting}
              </Link>
            }
          />
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* TOP 3 PODIUM */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {topThree.length >= 3 && (
              <div className="mb-12">
                <h2 className="text-center text-xl font-semibold tracking-tight text-content mb-8 flex items-center justify-center gap-2">
                  <span>👑</span> {l.topPlayers}
                </h2>
                
                <div className="flex items-end justify-center gap-4 md:gap-8">
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-3">
                      <Avatar 
                        src={topThree[1]?.user_image || topThree[1]?.user?.image} 
                        name={topThree[1]?.user_name || topThree[1]?.user?.name || l.anonymous}
                        size="lg"
                        rank={2}
                      />
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center text-slate-800 font-bold shadow-lg">
                        2
                      </div>
                    </div>
                    <p className="text-content font-semibold text-sm mb-1 max-w-[100px] truncate text-center">
                      {topThree[1]?.user_name || topThree[1]?.user?.name || l.anonymous}
                    </p>
                    <p className="text-slate-300 font-bold">{topThree[1]?.total_points?.toFixed(1)}</p>
                    <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-t from-slate-600 to-slate-500 rounded-t-lg mt-3 flex items-end justify-center pb-2">
                      <span className="text-4xl font-black text-slate-300/50">2</span>
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="flex flex-col items-center -mt-8">
                    <div className="text-4xl mb-2 animate-bounce">👑</div>
                    <div className="relative mb-3">
                      <Avatar 
                        src={topThree[0]?.user_image || topThree[0]?.user?.image} 
                        name={topThree[0]?.user_name || topThree[0]?.user?.name || l.anonymous}
                        size="xl"
                        rank={1}
                      />
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-surface-0 font-bold shadow-lg shadow-amber-500/40">
                        1
                      </div>
                    </div>
                    <p className="text-content font-bold text-lg mb-1 max-w-[120px] truncate text-center">
                      {topThree[0]?.user_name || topThree[0]?.user?.name || l.anonymous}
                    </p>
                    <p className="text-amber-400 font-bold text-xl">{topThree[0]?.total_points?.toFixed(1)}</p>
                    <div className="w-28 h-32 md:w-36 md:h-40 bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-lg mt-3 flex items-end justify-center pb-2 shadow-lg shadow-amber-500/30">
                      <span className="text-5xl font-black text-amber-300/50">1</span>
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-3">
                      <Avatar 
                        src={topThree[2]?.user_image || topThree[2]?.user?.image} 
                        name={topThree[2]?.user_name || topThree[2]?.user?.name || l.anonymous}
                        size="lg"
                        rank={3}
                      />
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-700 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                        3
                      </div>
                    </div>
                    <p className="text-content font-semibold text-sm mb-1 max-w-[100px] truncate text-center">
                      {topThree[2]?.user_name || topThree[2]?.user?.name || l.anonymous}
                    </p>
                    <p className="text-orange-400 font-bold">{topThree[2]?.total_points?.toFixed(1)}</p>
                    <div className="w-24 h-20 md:w-28 md:h-24 bg-gradient-to-t from-orange-700 to-orange-600 rounded-t-lg mt-3 flex items-end justify-center pb-2">
                      <span className="text-4xl font-black text-orange-500/50">3</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MY RANK CARD */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {session && myRank && myEntry && (
              <div className="mb-6">
                <div className="fa-card p-4 md:p-6 border-info/30">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-info/15 border border-info/30 rounded-xl flex items-center justify-center text-info text-2xl font-black">
                          {myRank}
                        </div>
                        <div>
                          <p className="text-info text-sm font-medium">{l.yourRank}</p>
                          <p className="text-content text-xl font-bold">
                            {l.youAreRanked.replace('{rank}', myRank.toString())}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-400">{myEntry.total_points?.toFixed(1)}</p>
                          <p className="text-xs text-content-muted">{l.points}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-content">{myEntry.win_rate}%</p>
                          <p className="text-xs text-content-muted">{l.winRate}</p>
                        </div>
                        <Link href="/coupons/create" className="fa-btn fa-btn-primary">
                          {l.earnPoints}
                        </Link>
                      </div>
                    </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* LEADERBOARD TABLE */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 md:px-6 py-4 bg-surface-1 border-b border-line text-xs uppercase tracking-wider text-content-subtle">
                <div className="col-span-1 text-center">{l.rank}</div>
                <div className="col-span-5 md:col-span-6">{l.player}</div>
                <div className="col-span-4 md:col-span-3 text-center hidden sm:block">{l.stats}</div>
                <div className="col-span-6 sm:col-span-2 text-right">{l.score}</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-line">
                {leaderboard.map((entry, index) => {
                  const userName = entry.user_name || entry.user?.name || l.anonymous;
                  const userImage = entry.user_image || entry.user?.image;
                  const isCurrentUser = userId === (entry.user_id || entry.user?.id);
                  const rank = entry.rank;
                  
                  return (
                    <div
                      key={entry.user_id || entry.user?.id || index}
                      className={`grid grid-cols-12 gap-4 px-4 md:px-6 py-4 items-center transition-colors ${
                        isCurrentUser
                          ? 'bg-info/10 border-l-4 border-l-info'
                          : rank <= 3
                            ? 'bg-amber-500/5'
                            : 'hover:bg-surface-3'
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex justify-center">
                        {rank === 1 ? (
                          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <span className="text-xl">🥇</span>
                          </div>
                        ) : rank === 2 ? (
                          <div className="w-8 h-8 bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg flex items-center justify-center shadow-lg">
                            <span className="text-xl">🥈</span>
                          </div>
                        ) : rank === 3 ? (
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center shadow-lg">
                            <span className="text-xl">🥉</span>
                          </div>
                        ) : (
                          <span className="w-8 h-8 flex items-center justify-center text-content-muted font-bold">
                            {rank}
                          </span>
                        )}
                      </div>

                      {/* Player */}
                      <div className="col-span-5 md:col-span-6 flex items-center gap-3">
                        <Avatar src={userImage} name={userName} size="md" />
                        <div className="min-w-0">
                          <p className="text-content font-semibold truncate">
                            {userName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-info">{l.you}</span>
                            )}
                          </p>
                          <p className="text-xs text-content-subtle sm:hidden">
                            {entry.won_coupons}/{entry.total_coupons} • {entry.win_rate}%
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="col-span-3 hidden sm:flex items-center justify-center gap-4">
                        <div className="text-center">
                          <p className="text-content font-semibold">{entry.won_coupons}/{entry.total_coupons}</p>
                          <p className="text-xs text-content-subtle">{l.wins}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-content font-semibold">{entry.win_rate}%</p>
                          <p className="text-xs text-content-subtle">{l.winRate}</p>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="col-span-6 sm:col-span-2 text-right">
                        <span className={`text-xl font-bold ${
                          rank === 1 ? 'text-amber-400' :
                          rank === 2 ? 'text-slate-300' :
                          rank === 3 ? 'text-orange-500' :
                          'text-content'
                        }`}>
                          {entry.total_points?.toFixed(1)}
                        </span>
                        <span className="text-xs text-content-subtle ml-1">{l.pts}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* HALL OF FAME */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {winners.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-semibold tracking-tight text-content mb-8 flex items-center gap-3">
                  <span className="text-3xl">🏅</span>
                  {l.pastWinners}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {winners.map((winner) => (
                    <div
                      key={`${winner.year}-${winner.month}`}
                      className="fa-card fa-card-hover p-5 group"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">👑</span>
                        <span className="font-semibold text-content-muted">
                          {MONTHS[winner.month - 1]} {winner.year}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Avatar src={winner.userImage} name={winner.userName} size="lg" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-content truncate group-hover:text-amber-400 transition-colors">
                            {winner.userName}
                          </p>
                          <p className="text-amber-500 font-semibold">
                            🏆 {winner.totalPoints?.toFixed(1)} {l.points}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
