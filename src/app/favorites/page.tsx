'use client';

// ============================================================================
// FAVORİLER SAYFASI
// Kullanıcının favoriye eklediği maçları ve analizlerini gösterir
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Star, ArrowLeft, Calendar, Trophy, Target, TrendingUp,
  CheckCircle, XCircle, Clock, Trash2, ExternalLink
} from 'lucide-react';

interface Favorite {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  analysis_data: any;
  genius_analysis: any;
  match_result_prediction: string;
  over_under_prediction: string;
  btts_prediction: string;
  best_bet_market: string;
  best_bet_selection: string;
  best_bet_confidence: number;
  overall_confidence: number;
  user_notes: string;
  created_at: string;
}

const translations = {
  tr: {
    title: 'Favori Maçlarım',
    subtitle: 'Kaydettiğiniz analizleri buradan görüntüleyebilirsiniz',
    noFavorites: 'Henüz favori maçınız yok',
    noFavoritesDesc: 'Dashboard\'da analiz yaptığınız maçları favoriye ekleyebilirsiniz',
    goToDashboard: 'Dashboard\'a Git',
    home: 'Ev',
    away: 'Deplasman',
    draw: 'Beraberlik',
    over: 'Üst',
    under: 'Alt',
    yes: 'Evet',
    no: 'Hayır',
    bestBet: 'En İyi Bahis',
    confidence: 'Güven',
    remove: 'Kaldır',
    viewAnalysis: 'Analizi Görüntüle',
    matchDate: 'Maç Tarihi',
    savedAt: 'Kaydedilme',
    league: 'Lig',
    predictions: 'Tahminler',
    geniusAnalysis: 'Genius Analizi',
    notes: 'Notlar',
    addNote: 'Not Ekle',
    saveNote: 'Kaydet',
  },
  en: {
    title: 'My Favorite Matches',
    subtitle: 'View your saved analyses here',
    noFavorites: 'No favorite matches yet',
    noFavoritesDesc: 'You can add matches to favorites from the dashboard',
    goToDashboard: 'Go to Dashboard',
    home: 'Home',
    away: 'Away',
    draw: 'Draw',
    over: 'Over',
    under: 'Under',
    yes: 'Yes',
    no: 'No',
    bestBet: 'Best Bet',
    confidence: 'Confidence',
    remove: 'Remove',
    viewAnalysis: 'View Analysis',
    matchDate: 'Match Date',
    savedAt: 'Saved At',
    league: 'League',
    predictions: 'Predictions',
    geniusAnalysis: 'Genius Analysis',
    notes: 'Notes',
    addNote: 'Add Note',
    saveNote: 'Save',
  },
};

export default function FavoritesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'tr' | 'en'>('tr');
  const t = translations[lang];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchFavorites();
    }
  }, [status]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/favorites');
      const data = await res.json();
      
      if (data.success) {
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Fetch favorites error:', error);
    }
    setLoading(false);
  };

  const removeFavorite = async (fixtureId: number) => {
    if (!confirm('Bu maçı favorilerden kaldırmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      const res = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId,
          isFavorite: false,
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setFavorites(favorites.filter(f => f.fixture_id !== fixtureId));
      }
    } catch (error) {
      console.error('Remove favorite error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPredictionText = (prediction: string, type: 'mr' | 'ou' | 'btts') => {
    if (type === 'mr') {
      if (prediction === 'home' || prediction === '1') return t.home;
      if (prediction === 'away' || prediction === '2') return t.away;
      return t.draw;
    }
    if (type === 'ou') {
      return prediction === 'over' ? t.over : t.under;
    }
    if (type === 'btts') {
      return prediction === 'yes' ? t.yes : t.no;
    }
    return prediction;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-[#00f0ff]/30 glass-futuristic sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30"
              >
                <ArrowLeft className="w-5 h-5 text-[#00f0ff]" />
              </motion.button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white neon-glow-cyan">
                {t.title}
              </h1>
              <p className="text-xs text-[#00f0ff] font-medium">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
            <span className="text-white font-bold">{favorites.length}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {favorites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Star className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">{t.noFavorites}</h2>
            <p className="text-gray-400 mb-6">{t.noFavoritesDesc}</p>
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-[#00f0ff] to-[#ff00f0] text-white font-bold rounded-xl"
              >
                {t.goToDashboard}
              </motion.button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-6">
            {favorites.map((favorite, index) => (
              <motion.div
                key={favorite.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-futuristic rounded-2xl border p-6 neon-border-cyan relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">
                        {favorite.home_team}
                      </h3>
                      <span className="text-[#00f0ff] font-black">VS</span>
                      <h3 className="text-2xl font-bold text-white">
                        {favorite.away_team}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(favorite.match_date)}</span>
                      </div>
                      {favorite.league && (
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          <span>{favorite.league}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <motion.button
                    onClick={() => removeFavorite(favorite.fixture_id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </motion.button>
                </div>

                {/* Predictions Grid */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {/* Match Result */}
                  {favorite.match_result_prediction && (
                    <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-5 h-5 text-yellow-400" />
                        <h4 className="text-white font-bold">Maç Sonucu</h4>
                      </div>
                      <div className="text-2xl font-black text-yellow-400 mb-2">
                        {getPredictionText(favorite.match_result_prediction, 'mr')}
                      </div>
                      {favorite.overall_confidence && (
                        <div className="text-sm text-gray-400">
                          Güven: %{Math.round(favorite.overall_confidence)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Over/Under */}
                  {favorite.over_under_prediction && (
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        <h4 className="text-white font-bold">Over/Under</h4>
                      </div>
                      <div className="text-2xl font-black text-purple-400 mb-2">
                        {getPredictionText(favorite.over_under_prediction, 'ou')}
                      </div>
                    </div>
                  )}

                  {/* BTTS */}
                  {favorite.btts_prediction && (
                    <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-cyan-400" />
                        <h4 className="text-white font-bold">BTTS</h4>
                      </div>
                      <div className="text-2xl font-black text-cyan-400 mb-2">
                        {getPredictionText(favorite.btts_prediction, 'btts')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Best Bet */}
                {favorite.best_bet_market && favorite.best_bet_selection && (
                  <div className="bg-gradient-to-r from-[#00ff88]/10 via-[#00f0ff]/10 to-[#ff00f0]/10 rounded-xl border border-[#00ff88]/30 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-[#00ff88]" fill="currentColor" />
                      <h4 className="text-white font-bold">{t.bestBet}</h4>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black text-[#00ff88]">
                          {favorite.best_bet_market} → {favorite.best_bet_selection}
                        </div>
                      </div>
                      {favorite.best_bet_confidence && (
                        <div className="text-3xl font-black text-[#00ff88]">
                          %{Math.round(favorite.best_bet_confidence)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Genius Analysis */}
                {favorite.genius_analysis?.boldBet && (
                  <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 rounded-xl border border-red-500/30 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🔥</span>
                      <h4 className="text-red-400 font-bold">{t.geniusAnalysis}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-white font-bold">{favorite.genius_analysis.boldBet.type}</span>
                        <span className="text-yellow-400 ml-2">@ {favorite.genius_analysis.boldBet.odds?.toFixed(2)}</span>
                      </div>
                      <p className="text-gray-300">{favorite.genius_analysis.boldBet.scenario}</p>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                  <div className="text-xs text-gray-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {t.savedAt}: {formatDate(favorite.created_at)}
                  </div>
                  <Link href={`/dashboard?fixture=${favorite.fixture_id}`}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 rounded-lg text-[#00f0ff] text-sm font-medium flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.viewAnalysis}
                    </motion.button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

