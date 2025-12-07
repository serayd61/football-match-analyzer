// src/app/leaderboard/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Trophy, 
  Medal,
  Crown,
  Star,
  TrendingUp,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Gift
} from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage?: string;
  totalPoints: number;
  totalCoupons: number;
  wonCoupons: number;
  winRate: number;
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
  totalCoupons: number;
  wonCoupons: number;
  winRate: number;
}

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function LeaderboardPage() {
  const { data: session } = useSession();
  
  const [period, setPeriod] = useState<'monthly' | 'alltime'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  
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
      
      // Find current user's rank
      const userId = (session?.user as any)?.id;
if (userId) {
  const userEntry = data.leaderboard?.find(
    (e: LeaderboardEntry) => e.userId === userId || e.user?.id === userId
  );
        setMyRank(userEntry?.rank || null);
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
    
    // Don't go beyond current month
    if (year === currentYear && month >= currentMonth) return;
    
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">{rank}</span>;
    }
  };
  
  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-gray-200 dark:border-gray-700';
      case 3:
        return 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700';
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-10 h-10 text-yellow-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Liderlik Tablosu
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            En çok puan toplayanlar arasında yerinizi alın!
          </p>
        </div>
        
        {/* Prize Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Gift className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Aylık Ödül</h3>
              <p className="text-purple-100">
                Her ay en çok puan toplayan kullanıcı <strong>1 aylık Pro üyelik</strong> kazanır!
              </p>
            </div>
          </div>
        </div>
        
        {/* Period Tabs */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setPeriod('monthly')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              period === 'monthly'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Calendar className="w-5 h-5" />
            Aylık
          </button>
          <button
            onClick={() => setPeriod('alltime')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              period === 'alltime'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Star className="w-5 h-5" />
            Tüm Zamanlar
          </button>
        </div>
        
        {/* Month Selector (for monthly) */}
        {period === 'monthly' && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[200px]">
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {MONTHS[month - 1]} {year}
              </p>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* My Rank Card */}
        {session && myRank && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {myRank}
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Sıralamanız</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {myRank}. sıradasınız
                  </p>
                </div>
              </div>
              <Link
                href="/coupons/create"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Puan Kazan
              </Link>
            </div>
          </div>
        )}
        
        {/* Leaderboard Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Henüz sıralama yok
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Bu dönemde henüz puan kazanan yok
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {leaderboard.map((entry) => {
                const userName = entry.userName || entry.user?.name || 'Anonim';
                const userImage = entry.userImage || entry.user?.image;
                const isCurrentUser = session?.user?.id === (entry.userId || entry.user?.id);
                
                return (
                  <div
                    key={entry.userId || entry.user?.id}
                    className={`flex items-center gap-4 p-4 border-l-4 ${getRankBg(entry.rank)} ${
                      isCurrentUser ? 'ring-2 ring-blue-500 ring-inset' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-12 flex justify-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    
                    {/* User */}
                    <div className="flex items-center gap-3 flex-1">
                      {userImage ? (
                        <img
                          src={userImage}
                          alt={userName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {userName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Siz)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {entry.wonCoupons}/{entry.totalCoupons} kupon • %{entry.winRate} başarı
                        </p>
                      </div>
                    </div>
                    
                    {/* Points */}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-600">
                        {entry.totalPoints.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">puan</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Past Winners */}
        {winners.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              Geçmiş Kazananlar
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {winners.map((winner) => (
                <div
                  key={`${winner.year}-${winner.month}`}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {winner.monthName} {winner.year}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {winner.userImage ? (
                      <img
                        src={winner.userImage}
                        alt={winner.userName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {winner.userName}
                      </p>
                      <p className="text-sm text-yellow-600 font-medium">
                        {winner.totalPoints.toFixed(1)} puan
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
