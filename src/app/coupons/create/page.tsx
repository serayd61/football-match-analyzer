// src/app/coupons/create/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import { 
  Trash2, 
  Plus,
  ArrowLeft,
  Trophy,
  Calculator,
  Globe,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { calculatePoints } from '@/types/coupon';

interface Pick {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  betType: string;
  selection: string;
  odds: number;
}

export default function CreateCouponPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  
  const [picks, setPicks] = useState<Pick[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = {
    tr: {
      createCoupon: 'Kupon Oluştur',
      backToCoupons: 'Kuponlara Dön',
      couponTitle: 'Kupon Başlığı',
      couponTitlePlaceholder: 'Örn: Hafta sonu kombine',
      description: 'Açıklama (opsiyonel)',
      descriptionPlaceholder: 'Bu kupon hakkında not...',
      makePublic: 'Herkese Açık',
      makePublicDesc: 'Diğer kullanıcılar kuponunuzu görebilir',
      yourPicks: 'Bahisleriniz',
      noPicks: 'Henüz bahis eklenmedi',
      addPicksDesc: 'Maç analizinden bahis ekleyin',
      goToMatches: 'Maçlara Git',
      remove: 'Kaldır',
      clearAll: 'Tümünü Temizle',
      summary: 'Özet',
      totalPicks: 'Toplam Bahis',
      totalOdds: 'Toplam Oran',
      potentialPoints: 'Potansiyel Puan',
      publishCoupon: 'Kuponu Yayınla',
      publishing: 'Yayınlanıyor...',
      loginRequired: 'Kupon oluşturmak için giriş yapmalısınız',
      minOnePick: 'En az 1 bahis eklemelisiniz',
      maxTenPicks: 'Maksimum 10 bahis ekleyebilirsiniz',
      couponCreated: 'Kupon başarıyla oluşturuldu!',
      betMatchResult: 'Maç Sonucu',
      betOverUnder25: 'Alt/Üst 2.5',
      betOverUnder35: 'Alt/Üst 3.5',
      betBtts: 'Karşılıklı Gol',
      betDoubleChance: 'Çifte Şans',
      picksCount: '{count} Maçlık Kupon',
      pointsMultiplier: 'Puan Çarpanı',
      single: 'Tekli',
      double: '2\'li',
      treble: '3\'lü',
      accumulator: '4+',
    },
    en: {
      createCoupon: 'Create Coupon',
      backToCoupons: 'Back to Coupons',
      couponTitle: 'Coupon Title',
      couponTitlePlaceholder: 'E.g: Weekend combo',
      description: 'Description (optional)',
      descriptionPlaceholder: 'Notes about this coupon...',
      makePublic: 'Public',
      makePublicDesc: 'Other users can see your coupon',
      yourPicks: 'Your Picks',
      noPicks: 'No picks added yet',
      addPicksDesc: 'Add picks from match analysis',
      goToMatches: 'Go to Matches',
      remove: 'Remove',
      clearAll: 'Clear All',
      summary: 'Summary',
      totalPicks: 'Total Picks',
      totalOdds: 'Total Odds',
      potentialPoints: 'Potential Points',
      publishCoupon: 'Publish Coupon',
      publishing: 'Publishing...',
      loginRequired: 'You must login to create a coupon',
      minOnePick: 'Add at least 1 pick',
      maxTenPicks: 'Maximum 10 picks allowed',
      couponCreated: 'Coupon created successfully!',
      betMatchResult: 'Match Result',
      betOverUnder25: 'Over/Under 2.5',
      betOverUnder35: 'Over/Under 3.5',
      betBtts: 'Both Teams to Score',
      betDoubleChance: 'Double Chance',
      picksCount: '{count} Pick Coupon',
      pointsMultiplier: 'Points Multiplier',
      single: 'Single',
      double: 'Double',
      treble: 'Treble',
      accumulator: '4+',
    },
    de: {
      createCoupon: 'Wettschein erstellen',
      backToCoupons: 'Zurück zu Wettscheinen',
      couponTitle: 'Wettschein-Titel',
      couponTitlePlaceholder: 'Z.B: Wochenend-Kombi',
      description: 'Beschreibung (optional)',
      descriptionPlaceholder: 'Notizen zu diesem Wettschein...',
      makePublic: 'Öffentlich',
      makePublicDesc: 'Andere Benutzer können Ihren Wettschein sehen',
      yourPicks: 'Ihre Tipps',
      noPicks: 'Noch keine Tipps hinzugefügt',
      addPicksDesc: 'Tipps aus der Spielanalyse hinzufügen',
      goToMatches: 'Zu den Spielen',
      remove: 'Entfernen',
      clearAll: 'Alle löschen',
      summary: 'Zusammenfassung',
      totalPicks: 'Gesamt Tipps',
      totalOdds: 'Gesamtquote',
      potentialPoints: 'Mögliche Punkte',
      publishCoupon: 'Wettschein veröffentlichen',
      publishing: 'Veröffentlichen...',
      loginRequired: 'Sie müssen angemeldet sein, um einen Wettschein zu erstellen',
      minOnePick: 'Mindestens 1 Tipp hinzufügen',
      maxTenPicks: 'Maximal 10 Tipps erlaubt',
      couponCreated: 'Wettschein erfolgreich erstellt!',
      betMatchResult: 'Spielergebnis',
      betOverUnder25: 'Über/Unter 2.5',
      betOverUnder35: 'Über/Unter 3.5',
      betBtts: 'Beide Teams treffen',
      betDoubleChance: 'Doppelte Chance',
      picksCount: '{count}-Tipp Wettschein',
      pointsMultiplier: 'Punkte-Multiplikator',
      single: 'Einzel',
      double: 'Zweier',
      treble: 'Dreier',
      accumulator: '4+',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const BET_TYPE_LABELS: Record<string, string> = {
    MATCH_RESULT: l.betMatchResult,
    OVER_UNDER_25: l.betOverUnder25,
    OVER_UNDER_35: l.betOverUnder35,
    BTTS: l.betBtts,
    DOUBLE_CHANCE: l.betDoubleChance,
  };

  // Load picks from session storage
  useEffect(() => {
    const savedPicks = sessionStorage.getItem('pendingCouponPicks');
    if (savedPicks) {
      try {
        setPicks(JSON.parse(savedPicks));
      } catch (e) {
        console.error('Failed to parse picks:', e);
      }
    }
  }, []);

  // Save picks to session storage
  useEffect(() => {
    sessionStorage.setItem('pendingCouponPicks', JSON.stringify(picks));
  }, [picks]);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const removePick = (index: number) => {
    setPicks(picks.filter((_, i) => i !== index));
  };

  const clearAllPicks = () => {
    setPicks([]);
    sessionStorage.removeItem('pendingCouponPicks');
  };

  const totalOdds = picks.reduce((acc, pick) => acc * pick.odds, 1);
  const potentialPoints = calculatePoints(totalOdds, picks.length);

  const getMultiplierInfo = () => {
    if (picks.length === 1) return { label: l.single, multiplier: '×10' };
    if (picks.length === 2) return { label: l.double, multiplier: '×15' };
    if (picks.length === 3) return { label: l.treble, multiplier: '×25' };
    return { label: l.accumulator, multiplier: '×50' };
  };

  const handleSubmit = async () => {
    if (picks.length === 0) {
      setError(l.minOnePick);
      return;
    }

    if (picks.length > 10) {
      setError(l.maxTenPicks);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks,
          title: title || l.picksCount.replace('{count}', picks.length.toString()),
          description,
          isPublic,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create coupon');
        return;
      }

      // Clear picks and redirect
      sessionStorage.removeItem('pendingCouponPicks');
      router.push(`/coupons/${data.coupon.id}`);
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Back */}
        <Link href="/coupons" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6">
          <ArrowLeft className="w-5 h-5" />
          {l.backToCoupons}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {l.createCoupon}
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Coupon Details */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {l.couponTitle}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={l.couponTitlePlaceholder}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {l.description}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={l.descriptionPlaceholder}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    {isPublic ? <Globe className="w-5 h-5 text-green-500" /> : <Lock className="w-5 h-5 text-gray-500" />}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{l.makePublic}</p>
                      <p className="text-sm text-gray-500">{l.makePublicDesc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      isPublic ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Picks */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {l.yourPicks} ({picks.length}/10)
                </h2>
                {picks.length > 0 && (
                  <button
                    onClick={clearAllPicks}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    {l.clearAll}
                  </button>
                )}
              </div>

              {picks.length === 0 ? (
                <div className="p-8 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">{l.noPicks}</p>
                  <p className="text-sm text-gray-400 mb-4">{l.addPicksDesc}</p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    {l.goToMatches}
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {picks.map((pick, index) => (
                    <div key={index} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {pick.homeTeam} vs {pick.awayTeam}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">{pick.league}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {BET_TYPE_LABELS[pick.betType] || pick.betType}: <strong>{pick.selection}</strong>
                            </span>
                            <span className="text-sm font-semibold text-green-600">
                              {pick.odds.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removePick(index)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 sticky top-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                {l.summary}
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{l.totalPicks}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{picks.length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{l.totalOdds}</span>
                  <span className="font-bold text-green-600 text-xl">{totalOdds.toFixed(2)}</span>
                </div>

                {picks.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">{l.pointsMultiplier}</span>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium">
                      {getMultiplierInfo().label} {getMultiplierInfo().multiplier}
                    </span>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">{l.potentialPoints}</span>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      <span className="font-bold text-yellow-600 text-2xl">
                        {potentialPoints.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || picks.length === 0}
                className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {l.publishing}
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5" />
                    {l.publishCoupon}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
