'use client';

import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const L = {
  tr: { noData: 'Henüz lig performans verisi yok', title: 'Lig Bazlı Performans', match: 'maç' },
  en: { noData: 'No league data yet', title: 'League Performance', match: 'matches' },
  de: { noData: 'Noch keine Liga-Daten', title: 'Liga-Leistung', match: 'Spiele' },
} as const;

interface LeagueStats {
  league: string;
  total_matches: number;
  mr_correct: number;
  mr_accuracy: number;
  ou_correct: number;
  ou_accuracy: number;
  btts_correct: number;
  btts_accuracy: number;
  avg_confidence: number;
}

interface Props {
  leagueStats: LeagueStats[];
  isLoading?: boolean;
}

export default function LeagueBreakdown({ leagueStats, isLoading = false }: Props) {
  const { lang } = useLanguage();
  const t = L[lang] || L.en;
  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-white/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!leagueStats || leagueStats.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 text-center">
        <p className="text-white/50">{t.noData}</p>
      </div>
    );
  }

  // Sort by total matches
  const sortedStats = [...leagueStats].sort((a, b) => b.total_matches - a.total_matches);

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="text-white font-medium">{t.title}</h3>
      </div>

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {sortedStats.map((league, index) => {
          const overallAccuracy = Math.round(((league.mr_accuracy + league.ou_accuracy + league.btts_accuracy) / 3) * 10) / 10;
          const isGood = overallAccuracy >= 55;
          
          return (
            <motion.div
              key={league.league}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate max-w-[200px]">
                    {league.league}
                  </span>
                  <span className="text-xs text-white/40">
                    ({league.total_matches} {t.match})
                  </span>
                </div>
                <div className={`flex items-center gap-1 ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isGood ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-medium">{overallAccuracy}%</span>
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-8">MS</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${league.mr_accuracy >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${league.mr_accuracy}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/60 w-10 text-right">{league.mr_accuracy}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-8">O/U</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${league.ou_accuracy >= 50 ? 'bg-purple-500' : 'bg-red-500'}`}
                      style={{ width: `${league.ou_accuracy}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/60 w-10 text-right">{league.ou_accuracy}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-8">BTTS</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${league.btts_accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${league.btts_accuracy}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/60 w-10 text-right">{league.btts_accuracy}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
