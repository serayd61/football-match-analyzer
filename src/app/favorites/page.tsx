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
  Star, Calendar, Trophy, Target, TrendingUp,
  Clock, Trash2, ExternalLink
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { Spinner, EmptyState } from '@/components/ui';
import { useLanguage } from '@/components/LanguageProvider';

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
  de: {
    title: 'Meine Lieblingsspiele',
    subtitle: 'Sehen Sie hier Ihre gespeicherten Analysen',
    noFavorites: 'Noch keine Lieblingsspiele',
    noFavoritesDesc: 'Sie können Spiele über das Dashboard zu den Favoriten hinzufügen',
    goToDashboard: 'Zum Dashboard',
    home: 'Heim',
    away: 'Auswärts',
    draw: 'Unentschieden',
    over: 'Über',
    under: 'Unter',
    yes: 'Ja',
    no: 'Nein',
    bestBet: 'Beste Wette',
    confidence: 'Konfidenz',
    remove: 'Entfernen',
    viewAnalysis: 'Analyse ansehen',
    matchDate: 'Spieldatum',
    savedAt: 'Gespeichert',
    league: 'Liga',
    predictions: 'Vorhersagen',
    geniusAnalysis: 'Genius-Analyse',
    notes: 'Notizen',
    addNote: 'Notiz hinzufügen',
    saveNote: 'Speichern',
  },
};

export default function FavoritesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();
  const t = translations[lang] || translations.en;

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
      
      console.log('Favorites API response:', data);
      
      if (data.success) {
        setFavorites(data.favorites || []);
        console.log('Favorites loaded:', data.favorites?.length || 0);
      } else {
        console.error('Fetch favorites error:', data.error);
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
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="grid place-items-center py-32"><Spinner size={28} className="text-brand-400" /></div>
      </div>
    );
  }

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center bg-amber-500/10 border border-amber-500/25 text-amber-400">
              <Star size={18} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-content tracking-tight">{t.title}</h1>
              <p className="text-content-subtle text-sm mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <span className="fa-badge"><Star size={12} className="text-amber-400" fill="currentColor" /> {favorites.length}</span>
        </div>

        {favorites.length === 0 ? (
          <EmptyState
            icon={<Star size={26} className="text-content-subtle" />}
            title={t.noFavorites}
            description={t.noFavoritesDesc}
            action={<Link href="/dashboard" className="fa-btn fa-btn-primary fa-btn-lg">{t.goToDashboard}</Link>}
          />
        ) : (
          <div className="grid gap-6">
            {favorites.map((favorite, index) => (
              <motion.div
                key={favorite.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="fa-card p-6 relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-xl font-semibold text-content">{favorite.home_team}</h3>
                      <span className="text-brand-400 font-bold text-sm">VS</span>
                      <h3 className="text-xl font-semibold text-content">{favorite.away_team}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-content-muted flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(favorite.match_date)}</span>
                      </div>
                      {favorite.league && (
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-4 h-4" />
                          <span>{favorite.league}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFavorite(favorite.fixture_id)}
                    className="p-2 rounded-lg bg-negative/10 hover:bg-negative/20 border border-negative/30 transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-negative" />
                  </button>
                </div>

                {/* Predictions Grid */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {favorite.match_result_prediction && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <h4 className="text-content font-semibold">Maç Sonucu</h4>
                      </div>
                      <div className="text-2xl font-bold text-amber-400 mb-2">{getPredictionText(favorite.match_result_prediction, 'mr')}</div>
                      {favorite.overall_confidence && (
                        <div className="text-sm text-content-muted">{t.confidence}: %{Math.round(favorite.overall_confidence)}</div>
                      )}
                    </div>
                  )}

                  {favorite.over_under_prediction && (
                    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-sky-400" />
                        <h4 className="text-content font-semibold">Over/Under</h4>
                      </div>
                      <div className="text-2xl font-bold text-sky-400 mb-2">{getPredictionText(favorite.over_under_prediction, 'ou')}</div>
                    </div>
                  )}

                  {favorite.btts_prediction && (
                    <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-brand-400" />
                        <h4 className="text-content font-semibold">BTTS</h4>
                      </div>
                      <div className="text-2xl font-bold text-brand-400 mb-2">{getPredictionText(favorite.btts_prediction, 'btts')}</div>
                    </div>
                  )}
                </div>

                {/* Best Bet */}
                {favorite.best_bet_market && favorite.best_bet_selection && (
                  <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.07] p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-brand-400" fill="currentColor" />
                      <h4 className="text-content font-semibold">{t.bestBet}</h4>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-lg font-bold text-brand-300">{favorite.best_bet_market} → {favorite.best_bet_selection}</div>
                      {favorite.best_bet_confidence && (
                        <div className="text-3xl font-bold text-brand-400 tabular-nums">%{Math.round(favorite.best_bet_confidence)}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Genius Analysis */}
                {favorite.genius_analysis?.boldBet && (
                  <div className="rounded-xl border border-negative/30 bg-negative/[0.06] p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🔥</span>
                      <h4 className="text-negative font-semibold">{t.geniusAnalysis}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-content font-bold">{favorite.genius_analysis.boldBet.type}</span>
                        <span className="text-caution ml-2">@ {favorite.genius_analysis.boldBet.odds?.toFixed(2)}</span>
                      </div>
                      <p className="text-content-muted">{favorite.genius_analysis.boldBet.scenario}</p>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-line gap-3 flex-wrap">
                  <div className="text-xs text-content-subtle">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {t.savedAt}: {formatDate(favorite.created_at)}
                  </div>
                  <Link href={`/dashboard?fixture=${favorite.fixture_id}`} className="fa-btn fa-btn-secondary fa-btn-sm">
                    <ExternalLink className="w-4 h-4" />
                    {t.viewAnalysis}
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

