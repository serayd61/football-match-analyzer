'use client';

import React from 'react';
import { Brain, TrendingUp, TrendingDown, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// ============================================================================
// AUTOLEARN BADGE
// AutoLearn Agent'ın pattern-based skorunu gosterir
// ============================================================================

interface AutoLearnResult {
  market: string;
  prediction: string;
  originalConfidence: number;
  autoLearnScore: number;
  adjustedConfidence: number;
  patternMatch: string;
  patternsUsed: number;
  reliability: 'high' | 'medium' | 'low' | 'insufficient';
  insights: string[];
}

interface AutoLearnBadgeProps {
  market: 'mr' | 'ou' | 'btts';
  autoLearnData?: {
    results?: AutoLearnResult[];
    insights?: string[];
    reliability?: string;
    patternsUsed?: number;
  };
  compact?: boolean;
}

export default function AutoLearnBadge({ market, autoLearnData, compact = false }: AutoLearnBadgeProps) {
  if (!autoLearnData?.results || autoLearnData.results.length === 0) return null;

  const result = autoLearnData.results.find(r => r.market === market);
  if (!result || result.reliability === 'insufficient') return null;

  const diff = result.autoLearnScore - result.originalConfidence;
  const isHigher = diff > 2;
  const isLower = diff < -2;

  // Renk ve ikon
  const reliabilityColor = {
    high: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    medium: 'text-amber-400 border-amber-400/30 bg-amber-400/5',
    low: 'text-gray-400 border-gray-400/30 bg-gray-400/5',
    insufficient: 'text-gray-600 border-gray-600/30 bg-gray-600/5'
  }[result.reliability];

  const reliabilityLabel = {
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
    insufficient: 'Yetersiz'
  }[result.reliability];

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] ${reliabilityColor}`}>
        <Brain className="w-3 h-3" />
        <span className="font-bold">AL: %{Math.round(result.autoLearnScore)}</span>
        {isHigher && <TrendingUp className="w-3 h-3 text-emerald-400" />}
        {isLower && <TrendingDown className="w-3 h-3 text-red-400" />}
        <span className="opacity-60">({result.patternsUsed}p)</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-3 ${reliabilityColor}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">AutoLearn</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] opacity-60">{reliabilityLabel} güvenilirlik</span>
          <Sparkles className="w-3 h-3 opacity-40" />
        </div>
      </div>

      <div className="flex items-end gap-3 mb-2">
        <div className="text-2xl font-black">%{Math.round(result.autoLearnScore)}</div>
        <div className="flex items-center gap-1 pb-1">
          {isHigher && (
            <span className="flex items-center text-emerald-400 text-xs font-bold">
              <TrendingUp className="w-3 h-3 mr-0.5" />+{Math.round(diff)}
            </span>
          )}
          {isLower && (
            <span className="flex items-center text-red-400 text-xs font-bold">
              <TrendingDown className="w-3 h-3 mr-0.5" />{Math.round(diff)}
            </span>
          )}
          {!isHigher && !isLower && (
            <span className="text-gray-500 text-xs">= orijinal</span>
          )}
        </div>
        <div className="text-[10px] opacity-50 pb-1">
          {result.patternsUsed} pattern eşleşti
        </div>
      </div>

      {/* Insights */}
      {result.insights.length > 0 && (
        <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
          {result.insights.slice(0, 3).map((insight, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 opacity-60" />
              <p className="text-[10px] leading-tight opacity-80">{insight}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// AUTOLEARN PANEL - Tüm market sonuçlarını gösteren özet panel
// ============================================================================

interface AutoLearnPanelProps {
  autoLearnData?: {
    results?: AutoLearnResult[];
    insights?: string[];
    reliability?: string;
    patternsUsed?: number;
  };
}

export function AutoLearnPanel({ autoLearnData }: AutoLearnPanelProps) {
  if (!autoLearnData?.results || autoLearnData.results.length === 0) return null;

  const validResults = autoLearnData.results.filter(r => r.reliability !== 'insufficient');
  if (validResults.length === 0) return null;

  const totalPatterns = autoLearnData.patternsUsed || validResults.reduce((s, r) => s + r.patternsUsed, 0);
  const allInsights = autoLearnData.insights || validResults.flatMap(r => r.insights);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-futuristic rounded-2xl p-6 border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
          <Brain className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">AutoLearn Agent</h3>
          <p className="text-[10px] text-gray-500">Geçmiş pattern'lardan öğrenilmiş skorlar · {totalPatterns} pattern</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {validResults.map(result => {
          const marketLabel = result.market === 'mr' ? 'Maç Sonucu' : result.market === 'ou' ? 'Over/Under' : 'BTTS';
          const diff = result.autoLearnScore - result.originalConfidence;

          return (
            <div key={result.market} className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{marketLabel}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-white">%{Math.round(result.autoLearnScore)}</span>
                {diff > 2 && (
                  <span className="text-emerald-400 text-xs font-bold flex items-center">
                    <TrendingUp className="w-3 h-3" />+{Math.round(diff)}
                  </span>
                )}
                {diff < -2 && (
                  <span className="text-red-400 text-xs font-bold flex items-center">
                    <TrendingDown className="w-3 h-3" />{Math.round(diff)}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-gray-600 mt-1">
                Orijinal: %{Math.round(result.originalConfidence)} · {result.patternsUsed}p
              </div>
            </div>
          );
        })}
      </div>

      {/* All Insights */}
      {allInsights.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5">
          {allInsights.slice(0, 4).map((insight, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Sparkles className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-400 leading-tight">{insight}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
