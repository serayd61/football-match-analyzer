'use client';

import { useState, useEffect, useCallback } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';

interface MultiFilter {
  ms: { enabled: boolean; selection: 'all' | 'home' | 'away' | 'draw'; minConf: number };
  ou: { enabled: boolean; selection: 'all' | 'over' | 'under'; minConf: number };
  btts: { enabled: boolean; selection: 'all' | 'yes' | 'no'; minConf: number };
}

interface FiltersProps {
  leagues: string[];
  selectedLeague: string;
  onLeagueChange: (league: string) => void;
  multiFilter: MultiFilter;
  onMultiFilterChange: (filter: MultiFilter) => void;
  settled: 'all' | 'true' | 'false';
  onSettledChange: (settled: 'all' | 'true' | 'false') => void;
  onClearFilters: () => void;
}

export default function PerformanceFilters({
  leagues,
  selectedLeague,
  onLeagueChange,
  multiFilter,
  onMultiFilterChange,
  settled,
  onSettledChange,
  onClearFilters
}: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = 
    selectedLeague !== 'all' || 
    multiFilter.ms.enabled || 
    multiFilter.ou.enabled || 
    multiFilter.btts.enabled ||
    settled !== 'true';

  const activeFilterCount = [
    selectedLeague !== 'all',
    multiFilter.ms.enabled,
    multiFilter.ou.enabled,
    multiFilter.btts.enabled,
    settled !== 'true'
  ].filter(Boolean).length;

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 mb-6 overflow-hidden">
      {/* Kompakt Başlık */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-white font-medium">Filtreler</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-300 text-xs">
              {activeFilterCount} aktif
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Genişletilmiş Filtreler */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/10">
          {/* Durum ve Lig */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {/* Durum Filtresi */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Durum</label>
              <select
                value={settled}
                onChange={(e) => onSettledChange(e.target.value as 'all' | 'true' | 'false')}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="true">Sonuçlanan</option>
                <option value="false">Bekleyen</option>
                <option value="all">Tümü</option>
              </select>
            </div>

            {/* Lig Filtresi */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Lig</label>
              <select
                value={selectedLeague}
                onChange={(e) => onLeagueChange(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="all">Tüm Ligler</option>
                {leagues.map((league) => (
                  <option key={league} value={league}>{league}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Market Filtreleri */}
          <div className="grid grid-cols-3 gap-3">
            {/* MS Filtresi */}
            <div className={`p-3 rounded-lg border transition-all ${
              multiFilter.ms.enabled 
                ? 'bg-cyan-500/20 border-cyan-500/50' 
                : 'bg-white/5 border-white/10'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={multiFilter.ms.enabled}
                  onChange={(e) => onMultiFilterChange({
                    ...multiFilter,
                    ms: { ...multiFilter.ms, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500/50"
                />
                <span className="text-sm text-white font-medium">MS</span>
              </label>
              {multiFilter.ms.enabled && (
                <div className="space-y-2">
                  <select
                    value={multiFilter.ms.selection}
                    onChange={(e) => onMultiFilterChange({
                      ...multiFilter,
                      ms: { ...multiFilter.ms, selection: e.target.value as any }
                    })}
                    className="w-full px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-xs focus:outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="home">1 (Ev)</option>
                    <option value="away">2 (Dep)</option>
                    <option value="draw">X (Ber)</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/50">%</span>
                    <select
                      value={multiFilter.ms.minConf}
                      onChange={(e) => onMultiFilterChange({
                        ...multiFilter,
                        ms: { ...multiFilter.ms, minConf: parseInt(e.target.value) }
                      })}
                      className="flex-1 px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] focus:outline-none"
                    >
                      <option value="0">Hepsi</option>
                      {[50, 55, 60, 65, 70, 75, 80, 85, 90].map(num => (
                        <option key={num} value={num}>{num}%</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* O/U Filtresi */}
            <div className={`p-3 rounded-lg border transition-all ${
              multiFilter.ou.enabled 
                ? 'bg-purple-500/20 border-purple-500/50' 
                : 'bg-white/5 border-white/10'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={multiFilter.ou.enabled}
                  onChange={(e) => onMultiFilterChange({
                    ...multiFilter,
                    ou: { ...multiFilter.ou, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-500/50"
                />
                <span className="text-sm text-white font-medium">O/U</span>
              </label>
              {multiFilter.ou.enabled && (
                <div className="space-y-2">
                  <select
                    value={multiFilter.ou.selection}
                    onChange={(e) => onMultiFilterChange({
                      ...multiFilter,
                      ou: { ...multiFilter.ou, selection: e.target.value as any }
                    })}
                    className="w-full px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-xs focus:outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="over">Üst 2.5</option>
                    <option value="under">Alt 2.5</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/50">%</span>
                    <select
                      value={multiFilter.ou.minConf}
                      onChange={(e) => onMultiFilterChange({
                        ...multiFilter,
                        ou: { ...multiFilter.ou, minConf: parseInt(e.target.value) }
                      })}
                      className="flex-1 px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] focus:outline-none"
                    >
                      <option value="0">Hepsi</option>
                      {[50, 55, 60, 65, 70, 75, 80, 85, 90].map(num => (
                        <option key={num} value={num}>{num}%</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* BTTS Filtresi */}
            <div className={`p-3 rounded-lg border transition-all ${
              multiFilter.btts.enabled 
                ? 'bg-amber-500/20 border-amber-500/50' 
                : 'bg-white/5 border-white/10'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={multiFilter.btts.enabled}
                  onChange={(e) => onMultiFilterChange({
                    ...multiFilter,
                    btts: { ...multiFilter.btts, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500/50"
                />
                <span className="text-sm text-white font-medium">BTTS</span>
              </label>
              {multiFilter.btts.enabled && (
                <div className="space-y-2">
                  <select
                    value={multiFilter.btts.selection}
                    onChange={(e) => onMultiFilterChange({
                      ...multiFilter,
                      btts: { ...multiFilter.btts, selection: e.target.value as any }
                    })}
                    className="w-full px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-xs focus:outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="yes">Evet</option>
                    <option value="no">Hayır</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/50">%</span>
                    <select
                      value={multiFilter.btts.minConf}
                      onChange={(e) => onMultiFilterChange({
                        ...multiFilter,
                        btts: { ...multiFilter.btts, minConf: parseInt(e.target.value) }
                      })}
                      className="flex-1 px-1 py-0.5 bg-black/30 border border-white/20 rounded text-white text-[10px] focus:outline-none"
                    >
                      <option value="0">Hepsi</option>
                      {[50, 55, 60, 65, 70, 75, 80, 85, 90].map(num => (
                        <option key={num} value={num}>{num}%</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Temizle Butonu */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm hover:bg-red-500/30 transition-colors"
            >
              <X className="w-4 h-4" />
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {/* Aktif Filtre Badges (Kapalıyken) */}
      {!isExpanded && hasActiveFilters && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {selectedLeague !== 'all' && (
            <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-xs">
              {selectedLeague}
            </span>
          )}
          {multiFilter.ms.enabled && (
            <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-300 text-xs">
              MS{multiFilter.ms.selection !== 'all' ? `=${multiFilter.ms.selection === 'home' ? '1' : multiFilter.ms.selection === 'away' ? '2' : 'X'}` : ''}{multiFilter.ms.minConf > 0 ? ` (${multiFilter.ms.minConf}%)` : ''}
            </span>
          )}
          {multiFilter.ou.enabled && (
            <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">
              O/U{multiFilter.ou.selection !== 'all' ? `=${multiFilter.ou.selection === 'over' ? 'Üst' : 'Alt'}` : ''}{multiFilter.ou.minConf > 0 ? ` (${multiFilter.ou.minConf}%)` : ''}
            </span>
          )}
          {multiFilter.btts.enabled && (
            <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 text-xs">
              BTTS{multiFilter.btts.selection !== 'all' ? `=${multiFilter.btts.selection === 'yes' ? 'Evet' : 'Hayır'}` : ''}{multiFilter.btts.minConf > 0 ? ` (${multiFilter.btts.minConf}%)` : ''}
            </span>
          )}
          {settled !== 'true' && (
            <span className="px-2 py-1 bg-gray-500/20 border border-gray-500/30 rounded text-gray-300 text-xs">
              {settled === 'false' ? 'Bekleyen' : 'Tümü'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
