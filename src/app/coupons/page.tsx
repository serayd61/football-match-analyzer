// src/app/coupons/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import { 
  Trophy, 
  Clock, 
  Check, 
  X, 
  Plus,
  Filter,
  User,
  Globe,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface CouponPick {
  id: string;
  home_team: string;
  away_team: string;
  result: string;
}

interface Coupon {
  id: string;
  user_id: string;
  title?: string;
  total_odds: number;
  status: string;
  points_earned: number;
  is_public: boolean;
  created_at: string;
  picks: CouponPick[];
  user?: {
    id: string;
    name: string;
    image?: string;
  };
}

export default function CouponsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<'public' | 'my'>('public');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const labels = {
    tr: {
      coupons: 'Kuponlar',
      couponsDesc: 'Topluluk kuponlarını incele ve kendi kuponunu oluştur',
      createCoupon: 'Kupon Oluştur',
      publicCoupons: 'Herkesin Kuponları',
      myCoupons: 'Kuponlarım',
      all: 'Tümü',
      pending: 'Bekleyen',
      won: 'Kazanan',
      lost: 'Kaybeden',
      leaderboard: 'Liderlik Tablosu',
      leaderboardDesc: 'Ay birincisi 1 aylık Pro üyelik kazanır!',
      noCouponsYet: 'Henüz kupon yok',
      noCouponsYetDesc: 'Henüz kupon oluşturmadınız',
      noPublicCoupons: 'Henüz paylaşılan kupon yok',
      createFirstCoupon: 'İlk Kuponu Oluştur',
      statusPending: 'Bekliyor',
      statusWon: 'Kazandı',
      statusLost: 'Kaybetti',
      statusPartial: 'Kısmi',
      statusCancelled: 'İptal',
      totalOdds: 'Oran',
      result: 'Sonuç',
      anonymous: 'Anonim',
      picksCount: '{count} Maçlık Kupon',
      more: 'daha...',
    },
    en: {
      coupons: 'Coupons',
      couponsDesc: 'Browse community coupons and create your own',
      createCoupon: 'Create Coupon',
      publicCoupons: 'Public Coupons',
      myCoupons: 'My Coupons',
      all: 'All',
      pending: 'Pending',
      won: 'Won',
      lost: 'Lost',
      leaderboard: 'Leaderboard',
      leaderboardDesc: 'Top scorer each month wins 1 month Pro!',
      noCouponsYet: 'No coupons yet',
      noCouponsYetDesc: 'You haven\'t created any coupons yet',
      noPublicCoupons: 'No public coupons yet',
      createFirstCoupon: 'Create First Coupon',
      statusPending: 'Pending',
      statusWon: 'Won',
      statusLost: 'Lost',
      statusPartial: 'Partial',
      statusCancelled: 'Cancelled',
      totalOdds: 'Odds',
      result: 'Result',
      anonymous: 'Anonymous',
      picksCount: '{count} Pick Coupon',
      more: 'more...',
    },
    de: {
      coupons: 'Wettscheine',
      couponsDesc: 'Durchsuchen Sie Community-Wettscheine und erstellen Sie Ihre eigenen',
      createCoupon: 'Wettschein erstellen',
      publicCoupons: 'Öffentliche Wettscheine',
      myCoupons: 'Meine Wettscheine',
      all: 'Alle',
      pending: 'Ausstehend',
      won: 'Gewonnen',
      lost: 'Verloren',
      leaderboard: 'Rangliste',
      leaderboardDesc: 'Der Monatssieger gewinnt 1 Monat Pro!',
      noCouponsYet: 'Noch keine Wettscheine',
      noCouponsYetDesc: 'Sie haben noch keine Wettscheine erstellt',
      noPublicCoupons: 'Noch keine öffentlichen Wettscheine',
      createFirstCoupon: 'Ersten Wettschein erstellen',
      statusPending: 'Ausstehend',
      statusWon: 'Gewonnen',
      statusLost: 'Verloren',
      statusPartial: 'Teilweise',
      statusCancelled: 'Storniert',
      totalOdds: 'Quote',
      result: 'Ergebnis',
      anonymous: 'Anonym',
      picksCount: '{count}-Tipp Wettschein',
      more: 'mehr...',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const STATUS_BADGES: Record<string, { label: string; color: string }> = {
    PENDING: { label: l.statusPending, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    WON: { label: l.statusWon, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    LOST: { label: l.statusLost, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    PARTIAL: { label: l.statusPartial, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    CANCELLED: { label: l.statusCancelled, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' },
  };

  const FILTERS = [
    { value: 'all', label: l.all },
    { value: 'PENDING', label: l.pending },
    { value: 'WON', label: l.won },
    { value: 'LOST', label: l.lost },
  ];
  
  useEffect(() => {
    fetchCoupons();
  }, [tab, filter]);
  
  const fetchCoupons = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter: tab,
        page: page.toString(),
        limit: '20',
      });
      
      if (filter !== 'all') {
        params.set('status', filter);
      }
      
      const res = await fetch(`/api/coupons?${params}`);
      const data = await res.json();
      
      setCoupons(data.coupons || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Fetch coupons error:', error);
    } finally {
      setLoading(false);
    }
  };

  const CouponCard = ({ coupon }: { coupon: Coupon }) => {
    const statusBadge = STATUS_BADGES[coupon.status] || STATUS_BADGES.PENDING;
    const wonPicks = coupon.picks?.filter(p => p.result === 'WON').length || 0;
    const totalPicks = coupon.picks?.length || 0;
    
    return (
      <Link
        href={`/coupons/${coupon.id}`}
        className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {coupon.user?.image ? (
                <img
                  src={coupon.user.image}
                  alt={coupon.user.name || ''}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {coupon.user?.name || l.anonymous}
              </span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {coupon.title || l.picksCount.replace('{count}', totalPicks.toString())}
          </h3>
        </div>
        
        {/* Picks Preview */}
        <div className="p-4 space-y-2">
          {coupon.picks?.slice(0, 3).map((pick, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                {pick.home_team} vs {pick.away_team}
              </span>
              <span className={`ml-2 w-2 h-2 rounded-full ${
                pick.result === 'WON' ? 'bg-green-500' :
                pick.result === 'LOST' ? 'bg-red-500' :
                'bg-yellow-500'
              }`} />
            </div>
          ))}
          {totalPicks > 3 && (
            <p className="text-xs text-gray-400">+{totalPicks - 3} {l.more}</p>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{l.totalOdds}</p>
              <p className="font-bold text-green-600">{coupon.total_odds?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{l.result}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {wonPicks}/{totalPicks}
              </p>
            </div>
          </div>
          {coupon.status === 'WON' && coupon.points_earned > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <Trophy className="w-4 h-4" />
              <span className="font-bold">{coupon.points_earned?.toFixed(1)}</span>
            </div>
          )}
        </div>
      </Link>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {l.coupons}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {l.couponsDesc}
            </p>
          </div>
          <Link
            href="/coupons/create"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-5 h-5" />
            {l.createCoupon}
          </Link>
        </div>
        
        {/* Tabs & Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab('public')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  tab === 'public'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                {l.publicCoupons}
              </button>
              {session && (
                <button
                  onClick={() => setTab('my')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    tab === 'my'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  <User className="w-4 h-4" />
                  {l.myCoupons}
                </button>
              )}
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="flex items-center gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filter === f.value
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Leaderboard Banner */}
        <Link
          href="/leaderboard"
          className="block bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 mb-6 hover:from-yellow-500 hover:to-orange-600 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Trophy className="w-12 h-12 text-white" />
              <div>
                <h3 className="text-xl font-bold text-white">{l.leaderboard}</h3>
                <p className="text-yellow-100">
                  {l.leaderboardDesc}
                </p>
              </div>
            </div>
            <ChevronRight className="w-8 h-8 text-white" />
          </div>
        </Link>
        
        {/* Coupons List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {l.noCouponsYet}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {tab === 'my' ? l.noCouponsYetDesc : l.noPublicCoupons}
            </p>
            <Link
              href="/coupons/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              {l.createFirstCoupon}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} />
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => fetchCoupons(page)}
                className={`w-10 h-10 rounded-lg font-medium ${
                  pagination.page === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
