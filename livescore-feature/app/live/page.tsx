'use client';

import { useState, useEffect, useCallback } from 'react';

interface Match {
  id: number;
  name: string;
  league: string;
  leagueId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  statusCode: number;
  minute: number | null;
  startTime: string;
  events: Event[];
  venue: string;
}

interface Event {
  id: number;
  type: string;
  minute: number;
  player: string;
  team: string;
  description: string;
}

const STATUS_MAP: { [key: number]: { label: string; color: string; isLive: boolean } } = {
  1: { label: 'Başlamadı', color: 'bg-gray-500', isLive: false },
  2: { label: 'CANLI', color: 'bg-red-500', isLive: true },
  3: { label: 'Devre Arası', color: 'bg-yellow-500', isLive: true },
  4: { label: '2. Yarı', color: 'bg-red-500', isLive: true },
  5: { label: 'Bitti', color: 'bg-green-600', isLive: false },
  6: { label: 'Uzatma', color: 'bg-orange-500', isLive: true },
  7: { label: 'Penaltılar', color: 'bg-purple-500', isLive: true },
  14: { label: 'Ertelendi', color: 'bg-gray-600', isLive: false },
};

const LEAGUE_FLAGS: { [key: number]: string } = {
  8: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', // Premier League
  564: '🇪🇸', // La Liga
  384: '🇮🇹', // Serie A
  82: '🇩🇪', // Bundesliga
  301: '🇫🇷', // Ligue 1
  600: '🇹🇷', // Süper Lig
  72: '🇳🇱', // Eredivisie
  462: '🇵🇹', // Liga Portugal
  501: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // Scottish Premiership
  208: '🇧🇪', // Pro League
};

export default function LiveScoresPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLiveScores = useCallback(async () => {
    try {
      const response = await fetch('/api/livescores');
      if (!response.ok) throw new Error('API hatası');
      const data = await response.json();
      setMatches(data.matches || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Veriler yüklenemedi. Tekrar deneniyor...');
      console.error('Livescore fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveScores();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLiveScores, 30000); // 30 saniyede bir güncelle
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchLiveScores, autoRefresh]);

  const filteredMatches = matches.filter(match => {
    const status = STATUS_MAP[match.statusCode] || { isLive: false };
    switch (filter) {
      case 'live':
        return status.isLive;
      case 'upcoming':
        return match.statusCode === 1;
      case 'finished':
        return match.statusCode === 5;
      default:
        return true;
    }
  });

  const liveCount = matches.filter(m => STATUS_MAP[m.statusCode]?.isLive).length;

  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'goal': return '⚽';
      case 'yellowcard': return '🟨';
      case 'redcard': return '🟥';
      case 'substitution': return '🔄';
      case 'penalty': return '🎯';
      case 'var': return '📺';
      default: return '📌';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Canlı skorlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <a href="/" className="text-2xl font-bold text-white hover:text-green-400 transition">
                ⚽ Football Analytics
              </a>
              <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse">
                🔴 CANLI
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {lastUpdate && (
                <span>
                  Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
                </span>
              )}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  autoRefresh 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                    : 'bg-gray-700 text-gray-400 border border-gray-600'
                }`}
              >
                {autoRefresh ? '🔄 Otomatik' : '⏸️ Durduruldu'}
              </button>
              <button
                onClick={fetchLiveScores}
                className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-full text-xs font-medium hover:bg-blue-500/30 transition"
              >
                ↻ Yenile
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-white">{matches.length}</div>
            <div className="text-gray-400 text-sm">Toplam Maç</div>
          </div>
          <div className="bg-red-500/20 rounded-xl p-4 border border-red-500/50">
            <div className="text-3xl font-bold text-red-400">{liveCount}</div>
            <div className="text-red-300 text-sm">Canlı Maç</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-yellow-400">
              {matches.filter(m => m.statusCode === 1).length}
            </div>
            <div className="text-gray-400 text-sm">Başlayacak</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-green-400">
              {matches.filter(m => m.statusCode === 5).length}
            </div>
            <div className="text-gray-400 text-sm">Biten</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all', label: 'Tümü', count: matches.length },
            { key: 'live', label: '🔴 Canlı', count: liveCount },
            { key: 'upcoming', label: '⏰ Başlayacak', count: matches.filter(m => m.statusCode === 1).length },
            { key: 'finished', label: '✅ Biten', count: matches.filter(m => m.statusCode === 5).length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === tab.key
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Matches List */}
        {filteredMatches.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-bold text-white mb-2">Maç Bulunamadı</h3>
            <p className="text-gray-400">
              {filter === 'live' 
                ? 'Şu anda canlı maç yok' 
                : 'Bu kategoride maç bulunmuyor'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMatches.map(match => {
              const status = STATUS_MAP[match.statusCode] || { label: 'Bilinmiyor', color: 'bg-gray-500', isLive: false };
              const flag = LEAGUE_FLAGS[match.leagueId] || '🏆';
              
              return (
                <div 
                  key={match.id}
                  className={`bg-gray-800/50 rounded-xl border overflow-hidden transition hover:border-gray-600 ${
                    status.isLive ? 'border-red-500/50 shadow-lg shadow-red-500/10' : 'border-gray-700'
                  }`}
                >
                  {/* Match Header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>{flag}</span>
                      <span>{match.league}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {status.isLive && match.minute && (
                        <span className="text-red-400 font-mono text-sm animate-pulse">
                          {match.minute}&apos;
                        </span>
                      )}
                      <span className={`px-2 py-0.5 ${status.color} text-white text-xs font-bold rounded`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Match Content */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <div className="flex-1 text-right">
                        <span className="text-white font-semibold text-lg">
                          {match.homeTeam}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="px-6">
                        {match.statusCode === 1 ? (
                          <div className="text-center">
                            <div className="text-gray-400 text-sm">
                              {new Date(match.startTime).toLocaleTimeString('tr-TR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={`text-3xl font-bold ${status.isLive ? 'text-green-400' : 'text-white'}`}>
                            {match.homeScore ?? 0} - {match.awayScore ?? 0}
                          </div>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 text-left">
                        <span className="text-white font-semibold text-lg">
                          {match.awayTeam}
                        </span>
                      </div>
                    </div>

                    {/* Events */}
                    {match.events && match.events.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex flex-wrap gap-2">
                          {match.events.slice(-5).map(event => (
                            <div 
                              key={event.id}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-900/50 rounded text-xs text-gray-300"
                            >
                              <span>{getEventIcon(event.type)}</span>
                              <span>{event.minute}&apos;</span>
                              <span className="text-gray-500">|</span>
                              <span>{event.player || event.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Venue */}
                    {match.venue && (
                      <div className="mt-2 text-xs text-gray-500">
                        📍 {match.venue}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>⚽ Football Analytics Pro - Canlı Skorlar</p>
          <p className="mt-1">Veriler her 30 saniyede güncellenir • Sportmonks API</p>
        </div>
      </footer>
    </div>
  );
}
