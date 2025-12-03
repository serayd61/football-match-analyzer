'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recent' | 'favorites'>('recent');

  const labels: Record<string, Record<string, string>> = {
    tr: {
      profile: 'Profilim',
      todayUsage: 'Bugünkü Kullanım',
      totalAnalyses: 'Toplam Analiz',
      favorites: 'Favoriler',
      recentAnalyses: 'Son Analizler',
      noAnalyses: 'Henüz analiz yapmadınız',
      noFavorites: 'Favori analiz yok',
      backToDashboard: '← Dashboard\'a Dön',
      analysesRemaining: 'Kalan Analiz Hakkı',
    },
    en: {
      profile: 'My Profile',
      todayUsage: 'Today\'s Usage',
      totalAnalyses: 'Total Analyses',
      favorites: 'Favorites',
      recentAnalyses: 'Recent Analyses',
      noAnalyses: 'No analyses yet',
      noFavorites: 'No favorite analyses',
      backToDashboard: '← Back to Dashboard',
      analysesRemaining: 'Analyses Remaining',
    },
    de: {
      profile: 'Mein Profil',
      todayUsage: 'Heutige Nutzung',
      totalAnalyses: 'Gesamtanalysen',
      favorites: 'Favoriten',
      recentAnalyses: 'Letzte Analysen',
      noAnalyses: 'Noch keine Analysen',
      noFavorites: 'Keine Favoritenanalysen',
      backToDashboard: '← Zurück zum Dashboard',
      analysesRemaining: 'Verbleibende Analysen',
    },
  };

  const l = labels[lang] || labels.en;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      console.log('Profile data:', data);
      if (data.success) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
    setLoading(false);
  };

  const toggleFavorite = async (fixtureId: number, currentStatus: boolean) => {
    try {
      await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, isFavorite: !currentStatus }),
      });
      fetchProfile();
    } catch (error) {
      console.error('Favorite toggle error:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!session) return null;

  const analyses = activeTab === 'recent' ? profile?.recentAnalyses : profile?.favorites;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
              {l.backToDashboard}
            </Link>
            <h1 className="text-3xl font-bold">👤 {l.profile}</h1>
            <p className="text-gray-400">{session.user?.email}</p>
          </div>
          <LanguageSelector />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">{l.todayUsage}</div>
            <div className="text-3xl font-bold text-green-400">
              {profile?.usage?.today || 0} / {profile?.usage?.limit || 50}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(((profile?.usage?.today || 0) / (profile?.usage?.limit || 50)) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="text-gray-500 text-xs mt-1">
              {l.analysesRemaining}: {(profile?.usage?.limit || 50) - (profile?.usage?.today || 0)}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">{l.totalAnalyses}</div>
            <div className="text-3xl font-bold text-blue-400">
              {profile?.stats?.totalAnalyses || 0}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-1">{l.favorites}</div>
            <div className="text-3xl font-bold text-yellow-400">
              {profile?.stats?.favoritesCount || 0}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'recent' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            📋 {l.recentAnalyses} ({profile?.recentAnalyses?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'favorites' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ⭐ {l.favorites} ({profile?.favorites?.length || 0})
          </button>
        </div>

        {/* Analyses List */}
        <div className="bg-gray-800 rounded-xl p-6">
          {analyses && analyses.length > 0 ? (
            <div className="space-y-4">
              {analyses.map((item: any, idx: number) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg">
                      {item.home_team} vs {item.away_team}
                    </div>
                    <div className="text-sm text-gray-400">
                      Fixture ID: {item.fixture_id} • {new Date(item.viewed_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleFavorite(item.fixture_id, item.is_favorite)}
                      className={`px-3 py-2 rounded-lg transition-all ${
                        item.is_favorite 
                          ? 'bg-yellow-500 text-black hover:bg-yellow-400' 
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    >
                      {item.is_favorite ? '⭐ Favorilerde' : '☆ Favoriye Ekle'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-4">{activeTab === 'recent' ? '📋' : '⭐'}</div>
              <p className="text-lg">{activeTab === 'recent' ? l.noAnalyses : l.noFavorites}</p>
              <Link href="/dashboard" className="mt-4 inline-block px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">
                {l.backToDashboard}
              </Link>
            </div>
          )}
        </div>

        {/* Debug Info - Geliştirme aşamasında kaldırılabilir */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-800 rounded-xl">
            <h3 className="text-sm font-bold text-gray-400 mb-2">Debug Info:</h3>
            <pre className="text-xs text-gray-500 overflow-auto">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
