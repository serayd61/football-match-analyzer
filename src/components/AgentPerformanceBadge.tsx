'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

// ============================================================================
// AGENT PERFORMANCE BADGE
// Her tahmin kartında ajanların o market için başarı yüzdelerini gösterir
// ============================================================================

interface AgentProfile {
  agentName: string;
  league: string;
  mrAccuracy: number;
  ouAccuracy: number;
  bttsAccuracy: number;
  overallAccuracy: number;
  totalMatches: number;
  trend: 'improving' | 'declining' | 'stable';
  strongMarket: 'mr' | 'ou' | 'btts' | 'none';
  weakMarket: 'mr' | 'ou' | 'btts' | 'none';
  currentWeight: number;
  recentForm: number;
}

interface AgentPerformanceBadgeProps {
  market: 'mr' | 'ou' | 'btts';
  agentProfiles?: Record<string, AgentProfile>;
  compact?: boolean;
}

const AGENT_LABELS: Record<string, string> = {
  stats: 'Stats',
  odds: 'Odds',
  deepAnalysis: 'Deep',
  masterStrategist: 'Master',
  geniusAnalyst: 'Genius',
};

function getAccuracyForMarket(profile: AgentProfile, market: 'mr' | 'ou' | 'btts'): number {
  switch (market) {
    case 'mr': return profile.mrAccuracy;
    case 'ou': return profile.ouAccuracy;
    case 'btts': return profile.bttsAccuracy;
    default: return 0;
  }
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 65) return 'text-emerald-400';
  if (accuracy >= 55) return 'text-cyan-400';
  if (accuracy >= 45) return 'text-yellow-400';
  if (accuracy > 0) return 'text-red-400';
  return 'text-gray-500';
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    case 'declining':
      return <TrendingDown className="w-3 h-3 text-red-400" />;
    default:
      return <Minus className="w-3 h-3 text-gray-500" />;
  }
}

export default function AgentPerformanceBadge({ market, agentProfiles, compact = false }: AgentPerformanceBadgeProps) {
  if (!agentProfiles || Object.keys(agentProfiles).length === 0) return null;

  const agents = Object.values(agentProfiles)
    .filter(p => getAccuracyForMarket(p, market) > 0)
    .sort((a, b) => getAccuracyForMarket(b, market) - getAccuracyForMarket(a, market));

  if (agents.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <Activity className="w-3 h-3 text-gray-500 shrink-0" />
        {agents.slice(0, 4).map((agent) => {
          const acc = getAccuracyForMarket(agent, market);
          const label = AGENT_LABELS[agent.agentName] || agent.agentName;
          return (
            <span
              key={agent.agentName}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 ${getAccuracyColor(acc)}`}
              title={`${label}: %${acc} (${agent.totalMatches} maç) ${agent.trend === 'improving' ? '↑' : agent.trend === 'declining' ? '↓' : '→'}`}
            >
              <span className="font-medium opacity-60 text-gray-400">{label}</span>
              <span className="font-bold">%{acc.toFixed(0)}</span>
              <TrendIcon trend={agent.trend} />
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Activity className="w-3.5 h-3.5" />
        <span className="font-medium">Ajan Performansları</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {agents.map((agent) => {
          const acc = getAccuracyForMarket(agent, market);
          const label = AGENT_LABELS[agent.agentName] || agent.agentName;
          const isStrong = agent.strongMarket === market;
          return (
            <div
              key={agent.agentName}
              className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] ${
                isStrong ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5'
              }`}
            >
              <span className="text-gray-400 font-medium">{label}</span>
              <span className={`font-bold flex items-center gap-1 ${getAccuracyColor(acc)}`}>
                %{acc.toFixed(0)}
                <TrendIcon trend={agent.trend} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
