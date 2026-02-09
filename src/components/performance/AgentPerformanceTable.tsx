'use client';

import { motion } from 'framer-motion';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AgentStats {
  agent_name: string;
  total_matches: number;
  mr_correct: number;
  mr_accuracy: number;
  ou_correct: number;
  ou_accuracy: number;
  btts_correct: number;
  btts_accuracy: number;
  overall_accuracy: number;
  avg_confidence: number;
}

interface Props {
  agentStats: AgentStats[];
  isLoading?: boolean;
}

const agentDisplayNames: Record<string, string> = {
  consensus: 'Konsensüs',
  stats_agent: 'Stats Agent',
  odds_agent: 'Odds Agent',
  deep_analysis: 'Deep Analysis',
  master_strategist: 'Master Strategist',
  ai_smart: 'AI Smart'
};

const agentColors: Record<string, string> = {
  consensus: 'from-cyan-500 to-blue-500',
  stats_agent: 'from-emerald-500 to-green-500',
  odds_agent: 'from-purple-500 to-violet-500',
  deep_analysis: 'from-amber-500 to-orange-500',
  master_strategist: 'from-rose-500 to-pink-500',
  ai_smart: 'from-indigo-500 to-blue-500'
};

function AccuracyBadge({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-400 bg-emerald-500/20' 
    : value >= 50 ? 'text-amber-400 bg-amber-500/20' 
    : 'text-red-400 bg-red-500/20';
  
  const Icon = value >= 60 ? TrendingUp : value >= 50 ? Minus : TrendingDown;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {value}%
    </span>
  );
}

export default function AgentPerformanceTable({ agentStats, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!agentStats || agentStats.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 text-center">
        <p className="text-white/50">Henüz agent performans verisi yok</p>
      </div>
    );
  }

  // Sort by overall accuracy
  const sortedStats = [...agentStats].sort((a, b) => b.overall_accuracy - a.overall_accuracy);
  const bestAgent = sortedStats[0];

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-medium">Agent Performansları</h3>
        </div>
        {bestAgent && (
          <span className="text-xs text-amber-400">
            En İyi: {agentDisplayNames[bestAgent.agent_name] || bestAgent.agent_name}
          </span>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-white/10">
        {sortedStats.map((agent, index) => (
          <motion.div
            key={agent.agent_name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {index === 0 && <Award className="w-4 h-4 text-amber-400" />}
                <span className={`font-medium bg-gradient-to-r ${agentColors[agent.agent_name] || 'from-gray-400 to-gray-500'} bg-clip-text text-transparent`}>
                  {agentDisplayNames[agent.agent_name] || agent.agent_name}
                </span>
              </div>
              <AccuracyBadge value={agent.overall_accuracy} />
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-white/50 mb-1">MS</div>
                <div className={`text-sm font-medium ${agent.mr_accuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {agent.mr_accuracy}%
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-white/50 mb-1">O/U</div>
                <div className={`text-sm font-medium ${agent.ou_accuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {agent.ou_accuracy}%
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-white/50 mb-1">BTTS</div>
                <div className={`text-sm font-medium ${agent.btts_accuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {agent.btts_accuracy}%
                </div>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-white/40 text-center">
              {agent.total_matches} maç analiz edildi
            </div>
          </motion.div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-white/50 border-b border-white/10">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Agent</th>
              <th className="px-4 py-3 text-center">Maç</th>
              <th className="px-4 py-3 text-center">MS</th>
              <th className="px-4 py-3 text-center">O/U</th>
              <th className="px-4 py-3 text-center">BTTS</th>
              <th className="px-4 py-3 text-center">Genel</th>
              <th className="px-4 py-3 text-center">Güven</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedStats.map((agent, index) => (
              <motion.tr
                key={agent.agent_name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3">
                  {index === 0 ? (
                    <Award className="w-4 h-4 text-amber-400" />
                  ) : (
                    <span className="text-white/40 text-sm">{index + 1}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-medium bg-gradient-to-r ${agentColors[agent.agent_name] || 'from-gray-400 to-gray-500'} bg-clip-text text-transparent`}>
                    {agentDisplayNames[agent.agent_name] || agent.agent_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-white/60 text-sm">
                  {agent.total_matches}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-medium ${agent.mr_accuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {agent.mr_accuracy}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-medium ${agent.ou_accuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {agent.ou_accuracy}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-medium ${agent.btts_accuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {agent.btts_accuracy}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <AccuracyBadge value={agent.overall_accuracy} />
                </td>
                <td className="px-4 py-3 text-center text-white/60 text-sm">
                  {agent.avg_confidence || '-'}%
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
