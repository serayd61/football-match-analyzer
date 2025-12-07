// src/app/coupons/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Trophy, 
  Clock, 
  Check, 
  X, 
  Share2, 
  Trash2,
  Globe,
  Lock,
  ArrowLeft,
  User,
  Calendar,
  Target,
  Loader2
} from 'lucide-react';
import { Coupon, BET_TYPE_LABELS, SELECTION_LABELS, calculatePoints } from '@/types/coupon';

const STATUS_CONFIG = {
  PENDING: { 
    label: 'Bekliyor', 
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock 
  },
  WON: { 
    label: 'Kazandı', 
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: Check 
  },
  LOST: { 
    label: 'Kaybetti', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: X 
  },
  PARTIAL: { 
    label: 'Kısmi', 
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    icon: Target 
  },
  CANCELLED: { 
    label: 'İptal', 
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    icon: X 
  },
};

const PICK_STATUS_CONFIG = {
  PENDING: { label: 'Bekliyor', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
  WON: { label: 'Kazandı', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  LOST: { label: 'Kaybetti', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  VOID: { label: 'İptal', color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20' },
};

export default function CouponDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  
  useEffect(() => {
    fetchCoupon();
  }, [params.id]);
  
  const fetchCoupon = async () => {
    try {
      const res = await fetch(`/api/coupons/${params.id}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Kupon bulunamadı');
      }
      
      setCoupon(data.coupon);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Bu kuponu silmek istediğinize emin misiniz?')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/coupons/${params.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      
      router.push('/coupons/my');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };
  
  const handleShare = async () => {
    setSharing(true);
    try {
      const url = `${window.location.origin}/coupons/${params.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: coupon?.title || 'Kupon',
          text: `${coupon?.picks.length} maçlık kupon - Toplam oran: ${coupon?.totalOdds.toFixed(2)}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link kopyalandı!');
      }
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setSharing(false);
    }
  };
  
  const toggleVisibility = async () => {
    try {
      const res = await fetch(`/api/coupons/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !coupon?.isPublic }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      
      setCoupon({ ...coupon!, isPublic: !coupon?.isPublic });
    } catch (err: any) {
      alert(err.message);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  if (error || !coupon) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <X className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kupon Bulunamadı</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/coupons')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Kuponlara Dön
          </button>
        </div>
      </div>
    );
  }
  
  const statusConfig = STATUS_CONFIG[coupon.status];
  const StatusIcon = statusConfig.icon;
  const isOwner = session?.user?.id === coupon.userId;
  const potentialPoints = calculatePoints(coupon.totalOdds, coupon.picks.length);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Geri
        </button>
        
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {coupon.title || `${coupon.picks.length} Maçlık Kupon`}
              </h1>
              {coupon.description && (
                <p className="text-gray-500 dark:text-gray-400">{coupon.description}</p>
              )}
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.color}`}>
              <StatusIcon className="w-5 h-5" />
              <span className="font-medium">{statusConfig.label}</span>
            </div>
          </div>
          
          {/* User & Date */}
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-6">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{coupon.user?.name || 'Anonim'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(coupon.createdAt).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {coupon.isPublic ? (
                <>
                  <Globe className="w-4 h-4 text-green-500" />
                  <span>Herkese Açık</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span>Gizli</span>
                </>
              )}
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Bahis Sayısı</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {coupon.picks.length}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Oran</p>
              <p className="text-2xl font-bold text-green-600">
                {coupon.totalOdds.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {coupon.status === 'WON' ? 'Kazanılan Puan' : 'Potansiyel Puan'}
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {coupon.status === 'WON' ? coupon.pointsEarned.toFixed(1) : potentialPoints.toFixed(1)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Kazanma</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {coupon.picks.filter(p => p.result === 'WON').length}/{coupon.picks.length}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          {isOwner && (
            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                Paylaş
              </button>
              <button
                onClick={toggleVisibility}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {coupon.isPublic ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {coupon.isPublic ? 'Gizle' : 'Herkese Aç'}
              </button>
              {coupon.status === 'PENDING' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Sil
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Picks */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Bahisler
          </h2>
          
          <div className="space-y-4">
            {coupon.picks.map((pick, index) => {
              const pickStatus = PICK_STATUS_CONFIG[pick.result || 'PENDING'];
              
              return (
                <div
                  key={pick.id || index}
                  className={`p-4 rounded-lg border-2 ${
                    pick.result === 'WON' 
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                      : pick.result === 'LOST'
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {pick.league}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(pick.matchDate).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${pickStatus.color}`}>
                      {pickStatus.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">
                        {pick.homeTeam} vs {pick.awayTeam}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-blue-600 dark:text-blue-400">
                          {BET_TYPE_LABELS[pick.betType]}:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {SELECTION_LABELS[pick.selection] || pick.selection}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {pick.odds.toFixed(2)}
                      </p>
                      {pick.homeScore !== null && pick.awayScore !== null && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Skor: {pick.homeScore} - {pick.awayScore}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
