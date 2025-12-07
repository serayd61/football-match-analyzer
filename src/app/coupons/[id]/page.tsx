// src/app/coupons/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Trophy, Clock, Check, X, ArrowLeft, Share2, 
  Globe, Lock, Trash2, User, Calendar, Target, Loader2
} from 'lucide-react';

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  WON: { label: 'Kazandı', color: 'bg-green-100 text-green-700', icon: Check },
  LOST: { label: 'Kaybetti', color: 'bg-red-100 text-red-700', icon: X },
  PARTIAL: { label: 'Kısmi', color: 'bg-orange-100 text-orange-700', icon: Target },
  CANCELLED: { label: 'İptal', color: 'bg-gray-100 text-gray-700', icon: X },
};

const BET_TYPE_LABELS: Record<string, string> = {
  MATCH_RESULT: 'Maç Sonucu',
  OVER_UNDER_25: 'Alt/Üst 2.5',
  OVER_UNDER_35: 'Alt/Üst 3.5',
  BTTS: 'Karşılıklı Gol',
  DOUBLE_CHANCE: 'Çifte Şans',
};

export default function CouponDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const couponId = params.id as string;
  
  const [coupon, setCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCoupon();
  }, [couponId]);

  const fetchCoupon = async () => {
    try {
      const res = await fetch(`/api/coupons/${couponId}`);
      const data = await res.json();
      if (data.coupon) {
        setCoupon(data.coupon);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bu kuponu silmek istediğinize emin misiniz?')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/coupons/${couponId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/coupons');
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: coupon?.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link kopyalandı!');
    }
  };

  const toggleVisibility = async () => {
    try {
      const res = await fetch(`/api/coupons/${couponId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !coupon.is_public }),
      });
      if (res.ok) {
        setCoupon({ ...coupon, is_public: !coupon.is_public });
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Kupon bulunamadı</p>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[coupon.status] || STATUS_BADGES.PENDING;
  const StatusIcon = statusBadge.icon;
  const isOwner = (session?.user as any)?.id === coupon.user_id;
  const wonPicks = coupon.picks?.filter((p: any) => p.result === 'WON').length || 0;
  const totalPicks = coupon.picks?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Back */}
        <Link href="/coupons" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-5 h-5" />
          Kuponlara Dön
        </Link>

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {coupon.user?.image ? (
                  <img src={coupon.user.image} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {coupon.user?.name || 'Anonim'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(coupon.created_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
              <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusBadge.label}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {coupon.title || `${totalPicks} Maçlık Kupon`}
            </h1>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{coupon.total_odds?.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Toplam Oran</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPicks}</p>
                <p className="text-xs text-gray-500">Maç</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{wonPicks}/{totalPicks}</p>
                <p className="text-xs text-gray-500">Doğru</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{coupon.points_earned?.toFixed(1) || 0}</p>
                <p className="text-xs text-gray-500">Puan</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {isOwner && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex gap-2">
              <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
                <Share2 className="w-4 h-4" /> Paylaş
              </button>
              <button onClick={toggleVisibility} className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                {coupon.is_public ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {coupon.is_public ? 'Gizle' : 'Yayınla'}
              </button>
              {coupon.status === 'PENDING' && (
                <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg ml-auto">
                  <Trash2 className="w-4 h-4" /> Sil
                </button>
              )}
            </div>
          )}
        </div>

        {/* Picks */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Bahisler</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {coupon.picks?.map((pick: any, index: number) => (
              <div key={index} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{pick.league}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    pick.result === 'WON' ? 'bg-green-100 text-green-700' :
                    pick.result === 'LOST' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {pick.result === 'WON' ? 'Kazandı' : pick.result === 'LOST' ? 'Kaybetti' : 'Bekliyor'}
                  </span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {pick.home_team} vs {pick.away_team}
                </p>
                {(pick.home_score !== null && pick.away_score !== null) && (
                  <p className="text-sm text-blue-600 font-semibold">
                    Skor: {pick.home_score} - {pick.away_score}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-500">
                    {BET_TYPE_LABELS[pick.bet_type] || pick.bet_type}: <strong>{pick.selection}</strong>
                  </span>
                  <span className="font-semibold text-green-600">{pick.odds?.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
