// src/app/coupons/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import { 
  Trophy, Clock, Check, X, ArrowLeft, Share2, 
  Globe, Lock, Trash2, User, Loader2
} from 'lucide-react';

export default function CouponDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const couponId = params.id as string;
  
  const [coupon, setCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const labels = {
    tr: {
      backToCoupons: 'Kuponlara Dön',
      statusPending: 'Bekliyor',
      statusWon: 'Kazandı',
      statusLost: 'Kaybetti',
      statusPartial: 'Kısmi',
      statusCancelled: 'İptal',
      totalOdds: 'Toplam Oran',
      match: 'Maç',
      correct: 'Doğru',
      points: 'Puan',
      share: 'Paylaş',
      makePrivate: 'Gizle',
      makePublic: 'Yayınla',
      delete: 'Sil',
      picks: 'Bahisler',
      score: 'Skor',
      anonymous: 'Anonim',
      couponNotFound: 'Kupon bulunamadı',
      confirmDelete: 'Bu kuponu silmek istediğinize emin misiniz?',
      linkCopied: 'Link kopyalandı!',
      picksCount: '{count} Maçlık Kupon',
      betMatchResult: 'Maç Sonucu',
      betOverUnder25: 'Alt/Üst 2.5',
      betOverUnder35: 'Alt/Üst 3.5',
      betBtts: 'Karşılıklı Gol',
      betDoubleChance: 'Çifte Şans',
    },
    en: {
      backToCoupons: 'Back to Coupons',
      statusPending: 'Pending',
      statusWon: 'Won',
      statusLost: 'Lost',
      statusPartial: 'Partial',
      statusCancelled: 'Cancelled',
      totalOdds: 'Total Odds',
      match: 'Match',
      correct: 'Correct',
      points: 'Points',
      share: 'Share',
      makePrivate: 'Make Private',
      makePublic: 'Make Public',
      delete: 'Delete',
      picks: 'Picks',
      score: 'Score',
      anonymous: 'Anonymous',
      couponNotFound: 'Coupon not found',
      confirmDelete: 'Are you sure you want to delete this coupon?',
      linkCopied: 'Link copied!',
      picksCount: '{count} Pick Coupon',
      betMatchResult: 'Match Result',
      betOverUnder25: 'Over/Under 2.5',
      betOverUnder35: 'Over/Under 3.5',
      betBtts: 'Both Teams to Score',
      betDoubleChance: 'Double Chance',
    },
    de: {
      backToCoupons: 'Zurück zu Wettscheinen',
      statusPending: 'Ausstehend',
      statusWon: 'Gewonnen',
      statusLost: 'Verloren',
      statusPartial: 'Teilweise',
      statusCancelled: 'Storniert',
      totalOdds: 'Gesamtquote',
      match: 'Spiel',
      correct: 'Richtig',
      points: 'Punkte',
      share: 'Teilen',
      makePrivate: 'Verbergen',
      makePublic: 'Veröffentlichen',
      delete: 'Löschen',
      picks: 'Tipps',
      score: 'Ergebnis',
      anonymous: 'Anonym',
      couponNotFound: 'Wettschein nicht gefunden',
      confirmDelete: 'Möchten Sie diesen Wettschein wirklich löschen?',
      linkCopied: 'Link kopiert!',
      picksCount: '{count}-Tipp Wettschein',
      betMatchResult: 'Spielergebnis',
      betOverUnder25: 'Über/Unter 2.5',
      betOverUnder35: 'Über/Unter 3.5',
      betBtts: 'Beide Teams treffen',
      betDoubleChance: 'Doppelte Chance',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
    PENDING: { label: l.statusPending, color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    WON: { label: l.statusWon, color: 'bg-green-100 text-green-700', icon: Check },
    LOST: { label: l.statusLost, color: 'bg-red-100 text-red-700', icon: X },
    PARTIAL: { label: l.statusPartial, color: 'bg-orange-100 text-orange-700', icon: Clock },
    CANCELLED: { label: l.statusCancelled, color: 'bg-gray-100 text-gray-700', icon: X },
  };

  const BET_TYPE_LABELS: Record<string, string> = {
    MATCH_RESULT: l.betMatchResult,
    OVER_UNDER_25: l.betOverUnder25,
    OVER_UNDER_35: l.betOverUnder35,
    BTTS: l.betBtts,
    DOUBLE_CHANCE: l.betDoubleChance,
  };

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
    if (!confirm(l.confirmDelete)) return;
    
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
      alert(l.linkCopied);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">{l.couponNotFound}</p>
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
        <Link href="/coupons" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6">
          <ArrowLeft className="w-5 h-5" />
          {l.backToCoupons}
        </Link>

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {coupon.user?.image ? (
                  <img src={coupon.user.image} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {coupon.user?.name || l.anonymous}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(coupon.created_at).toLocaleDateString(lang)}
                  </p>
                </div>
              </div>
              <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusBadge.label}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {coupon.title || l.picksCount.replace('{count}', totalPicks.toString())}
            </h1>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{coupon.total_odds?.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{l.totalOdds}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPicks}</p>
                <p className="text-xs text-gray-500">{l.match}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{wonPicks}/{totalPicks}</p>
                <p className="text-xs text-gray-500">{l.correct}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{coupon.points_earned?.toFixed(1) || 0}</p>
                <p className="text-xs text-gray-500">{l.points}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {isOwner && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex gap-2">
              <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Share2 className="w-4 h-4" /> {l.share}
              </button>
              <button onClick={toggleVisibility} className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                {coupon.is_public ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {coupon.is_public ? l.makePrivate : l.makePublic}
              </button>
              {coupon.status === 'PENDING' && (
                <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg ml-auto hover:bg-red-200">
                  <Trash2 className="w-4 h-4" /> {l.delete}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Picks */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">{l.picks}</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {coupon.picks?.map((pick: any, index: number) => (
              <div key={index} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{pick.league}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    pick.result === 'WON' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    pick.result === 'LOST' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {pick.result === 'WON' ? l.statusWon : pick.result === 'LOST' ? l.statusLost : l.statusPending}
                  </span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {pick.home_team} vs {pick.away_team}
                </p>
                {(pick.home_score !== null && pick.away_score !== null) && (
                  <p className="text-sm text-blue-600 font-semibold">
                    {l.score}: {pick.home_score} - {pick.away_score}
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
