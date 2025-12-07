// src/app/coupons/create/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  Trophy, 
  Calculator,
  Share2,
  Lock,
  Globe,
  AlertCircle,
  Check
} from 'lucide-react';
import { BetType, BET_TYPE_LABELS, SELECTION_LABELS, calculatePoints } from '@/types/coupon';

interface MatchSelection {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  betType: BetType;
  selection: string;
  odds: number;
}

export default function CreateCouponPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [picks, setPicks] = useState<MatchSelection[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Analiz sayfasından gelen maç varsa ekle
  useEffect(() => {
    const savedPick = sessionStorage.getItem('pendingCouponPick');
    if (savedPick) {
      const pick = JSON.parse(savedPick);
      setPicks([pick]);
      sessionStorage.removeItem('pendingCouponPick');
    }
  }, []);
  
  // Toplam oran
  const totalOdds = picks.reduce((acc, pick) => acc * pick.odds, 1);
  
  // Potansiyel puan
  const potentialPoints = picks.length > 0 ? calculatePoints(totalOdds, picks.length) : 0;
  
  // Pick ekle
  const addPick = (pick: MatchSelection) => {
    // Aynı maça aynı tip bahis kontrolü
    const exists = picks.some(
      p => p.fixtureId === pick.fixtureId && p.betType === pick.betType
    );
    
    if (exists) {
      setError('Bu maça bu tipte zaten bahis eklediniz');
      return;
    }
    
    if (picks.length >= 10) {
      setError('Maksimum 10 bahis ekleyebilirsiniz');
      return;
    }
    
    setPicks([...picks, pick]);
    setError('');
  };
  
  // Pick sil
  const removePick = (index: number) => {
    setPicks(picks.filter((_, i) => i !== index));
  };
  
  // Kupon oluştur
  const handleSubmit = async () => {
    if (picks.length === 0) {
      setError('En az 1 bahis eklemelisiniz');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks,
          title: title || `${picks.length} Maçlık Kupon`,
          description,
          isPublic,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Kupon oluşturulamadı');
      }
      
      setSuccess(true);
      
      // 2 saniye sonra kupon sayfasına yönlendir
      setTimeout(() => {
        router.push(`/coupons/${data.coupon.id}`);
      }, 2000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Giriş Yapın</h2>
          <p className="text-gray-500 mb-4">Kupon oluşturmak için giriş yapmalısınız</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Kupon Oluşturuldu!</h2>
          <p className="text-gray-500">Yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Kupon Oluştur
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Analizlerinizi kupon haline getirin ve puan kazanın!
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol - Bahisler */}
          <div className="lg:col-span-2 space-y-4">
            {/* Bahis Listesi */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Bahisleriniz ({picks.length}/10)
                </h2>
                <button
                  onClick={() => router.push('/matches')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Maç Ekle
                </button>
              </div>
              
              {picks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Henüz bahis eklemediniz</p>
                  <p className="text-sm mt-2">
                    Maç listesinden analiz yapıp bahis ekleyin
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {picks.map((pick, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {pick.league}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(pick.matchDate).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">
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
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-green-600">
                          {pick.odds.toFixed(2)}
                        </span>
                        <button
                          onClick={() => removePick(index)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Kupon Detayları */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Kupon Detayları
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Başlık (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Süper Lig Özel Kuponu"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    maxLength={100}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Açıklama (Opsiyonel)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Kupon hakkında notlarınız..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={3}
                    maxLength={500}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe className="w-5 h-5 text-green-500" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {isPublic ? 'Herkese Açık' : 'Gizli'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {isPublic 
                          ? 'Kuponunuz herkese görünür' 
                          : 'Sadece siz görebilirsiniz'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isPublic ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sağ - Özet */}
          <div className="space-y-4">
            {/* Kupon Özeti */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Kupon Özeti
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Bahis Sayısı</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {picks.length}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Toplam Oran</span>
                  <span className="font-bold text-xl text-green-600">
                    {totalOdds.toFixed(2)}
                  </span>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-yellow-500" />
                      <span className="text-gray-500 dark:text-gray-400">
                        Potansiyel Puan
                      </span>
                    </div>
                    <span className="font-bold text-2xl text-yellow-500">
                      {potentialPoints.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {picks.length >= 4 ? '4+ kombine: x50' : 
                     picks.length === 3 ? '3\'lü kombine: x25' :
                     picks.length === 2 ? '2\'li kombine: x15' : 'Tekli: x10'} çarpan
                  </p>
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}
                
                <button
                  onClick={handleSubmit}
                  disabled={loading || picks.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-5 h-5" />
                      Kuponu Paylaş
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Puan Sistemi Bilgi */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Puan Sistemi
                </h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>• Tekli bahis: Oran × 10</li>
                <li>• 2'li kombine: Oran × 15</li>
                <li>• 3'lü kombine: Oran × 25</li>
                <li>• 4+ kombine: Oran × 50</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                🏆 Ay sonunda en çok puan toplayan 1 aylık Pro üyelik kazanır!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
