'use client';

import { useState, useEffect, useCallback } from 'react';
import SiteNav from '@/components/SiteNav';
import { RefreshCw, Radio } from 'lucide-react';
import { Stat, Spinner, EmptyState, Segmented } from '@/components/ui';

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

const STATUS_MAP: { [key: number]: { label: string; tone: string; isLive: boolean } } = {
  1: { label: 'Başlamadı', tone: 'text-content-subtle bg-surface-3 border-line', isLive: false },
  2: { label: '1. Yarı', tone: 'text-negative bg-negative/10 border-negative/30', isLive: true },
  3: { label: 'Devre Arası', tone: 'text-caution bg-caution/10 border-caution/30', isLive: true },
  4: { label: '2. Yarı', tone: 'text-negative bg-negative/10 border-negative/30', isLive: true },
  5: { label: 'Bitti', tone: 'text-positive bg-positive/10 border-positive/30', isLive: false },
  6: { label: 'Uzatma', tone: 'text-caution bg-caution/10 border-caution/30', isLive: true },
  7: { label: 'Penaltılar', tone: 'text-info bg-info/10 border-info/30', isLive: true },
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

  const filteredMatches = matches.filter((match) => {
    const status = STATUS_MAP[match.statusCode] || { isLive: false };
    switch (filter) {
      case 'live': return status.isLive;
      case 'upcoming': return match.statusCode === 1;
      case 'finished': return match.statusCode === 5;
      default: return true;
    }
  });

  const liveCount = matches.filter((m) => STATUS_MAP[m.statusCode]?.isLive).length;

  if (loading) {
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
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center bg-negative/10 border border-negative/30 text-negative">
              <Radio size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-content tracking-tight flex items-center gap-2">
                Canlı Skorlar
                {liveCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-negative/15 text-negative border border-negative/30 font-semibold animate-pulse">
                    {liveCount} canlı
                  </span>
                )}
              </h1>
              {lastUpdate && (
                <p className="text-xs text-content-subtle mt-0.5">Güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</p>
              )}
            </div>
          </div>
          <button onClick={fetchLiveScores} className="fa-btn fa-btn-secondary">
            <RefreshCw size={15} /> Yenile
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Toplam" value={matches.length} />
          <Stat label="Canlı" value={liveCount} tone="negative" />
          <Stat label="Başlayacak" value={matches.filter((m) => m.statusCode === 1).length} tone="caution" />
          <Stat label="Biten" value={matches.filter((m) => m.statusCode === 5).length} tone="positive" />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'live', label: '🔴 Canlı' },
              { value: 'upcoming', label: '⏰ Başlayacak' },
              { value: 'finished', label: '✅ Biten' },
            ]}
          />
        </div>

        {/* Matches */}
        {filteredMatches.length === 0 ? (
          <EmptyState icon={<span className="text-3xl">⚽</span>} title="Maç Bulunamadı" description="Bu kategoride maç yok." />
        ) : (
          <div className="space-y-3">
            {filteredMatches.map((match) => {
              const status = STATUS_MAP[match.statusCode] || { label: '?', tone: 'text-content-subtle bg-surface-3 border-line', isLive: false };
              return (
                <div key={match.id} className={`fa-card overflow-hidden ${status.isLive ? 'border-negative/40' : ''}`}>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface-1/60">
                    <span className="text-sm text-content-subtle truncate">{match.league}</span>
                    <div className="flex items-center gap-2">
                      {status.isLive && match.minute && (
                        <span className="text-negative font-mono text-sm animate-pulse">{match.minute}&apos;</span>
                      )}
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${status.tone}`}>{status.label}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-right">
                        <span className="text-content font-semibold">{match.homeTeam}</span>
                      </div>
                      <div className="px-6">
                        {match.statusCode === 1 ? (
                          <div className="text-content-subtle text-sm tabular-nums">
                            {new Date(match.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ) : (
                          <div className={`text-2xl font-bold tabular-nums ${status.isLive ? 'text-brand-400' : 'text-content'}`}>
                            {match.homeScore ?? 0} – {match.awayScore ?? 0}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-content font-semibold">{match.awayTeam}</span>
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
