'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Match {
  id: number;
  name: string;
  league: string;
  leagueId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  statusCode: number;
  minute: number | null;
  startTime: string;
  venue: string;
}

const STATUS_MAP: { [key: number]: { label: string; color: string; isLive: boolean } } = {
  1: { label: 'Başlamadı', color: 'bg-gray-500', isLive: false },
  2: { label: '1. Yarı', color: 'bg-red-500', isLive: true },
  3: { label: 'Devre Arası', color: 'bg-yellow-500', isLive: true },
  4: { label: '2. Yarı', color: 'bg-red-500', isLive: true },
  5: { label: 'Bitti', color: 'bg-green-600', isLive: false },
  6: { label: 'Uzatma', color: 'bg-orange-500', isLive: true },
  7: { label: 'Penaltılar', color: 'bg-purple-500', isLive: true },
};

export default function LiveScoresPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  const fetchLiveScores = useCallback(async () => {
    try {
      const response = await fetch('/api/livescores');
      const data = await response.json();
      setMatches(data.matches || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveScores();
    const interval = setInterval(fetchLiveScores, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveScores]);

  const filteredMatches = matches.filter(match => {
    const status = STATUS_MAP[match.statusCode] || { isLive: false };
    switch (filter) {
      case 'live': return status.isLive;
      case 'upcoming': return match.statusCode === 1;
      case 'finished': return match.statusCode === 5;
      default: return true;
    }
  });

  const liveCount = matches.filter(m => STATUS_MAP[m.statusCode]?.isLive).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-2xl font-bold text-white hover:text-green-400 transition">
                ⚽ Football Analytics
              </Link>
              <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse">
                🔴 CANLI
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {lastUpdate && (
                <span>Güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</span>
              )}
              <button
                onClick={fetchLiveScores}
                className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs hover:bg-blue-500/30"
              >
                ↻ Yenile
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-white">{matches.length}</div>
            <div className="text-gray-400 text-sm">Toplam</div>
          </div>
          <div className="bg-red-500/20 rounded-xl p-4 border border-red-500/50 text-center">
            <div className="text-2xl font-bold text-red-400">{liveCount}</div>
            <div className="text-red-300 text-sm">Canlı</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {matches.filter(m => m.statusCode === 1).length}
            </div>
            <div className="text-gray-400 text-sm">Başlayacak</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-green-400">
              {matches.filter(m => m.statusCode === 5).length}
            </div>
            <div className="text-gray-400 text-sm">Biten</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'live', label: '🔴 Canlı' },
            { key: 'upcoming', label: '⏰ Başlayacak' },
            { key: 'finished', label: '✅ Biten' },
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
              {tab.label}
            </button>
          ))}
        </div>

        {/* Matches */}
        {filteredMatches.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-bold text-white mb-2">Maç Bulunamadı</h3>
            <p className="text-gray-400">Bu kategoride maç yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMatches.map(match => {
              const status = STATUS_MAP[match.statusCode] || { label: '?', color: 'bg-gray-500', isLive: false };
              
              return (
                <div 
                  key={match.id}
                  className={`bg-gray-800/50 rounded-xl border overflow-hidden ${
                    status.isLive ? 'border-red-500/50' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-700">
                    <span className="text-sm text-gray-400">{match.league}</span>
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

                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-right">
                        <span className="text-white font-semibold">{match.homeTeam}</span>
                      </div>
                      <div className="px-6">
                        {match.statusCode === 1 ? (
                          <div className="text-gray-400 text-sm">
                            {new Date(match.startTime).toLocaleTimeString('tr-TR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        ) : (
                          <div className={`text-2xl font-bold ${status.isLive ? 'text-green-400' : 'text-white'}`}>
                            {match.homeScore ?? 0} - {match.awayScore ?? 0}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-white font-semibold">{match.awayTeam}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
