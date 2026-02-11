'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Shield, Users, Database } from 'lucide-react';

// ============================================================================
// SURVIVAL VERDICT CARD
// Tek sonuç. Tek karar. Cesur ve net.
// ============================================================================

interface SurvivalVerdictData {
  market: 'MS' | 'OU' | 'BTTS';
  marketLabel: string;
  selection: string;
  selectionLabel: string;
  confidence: number;
  reasoning: string;
  agentAgreement: string;
  historicalBacking: string;
  riskLevel: 'dusuk' | 'orta' | 'yuksek';
  certaintyScore: number;
  totalAgentsConsulted: number;
}

interface Props {
  verdict?: SurvivalVerdictData | null;
}

const RISK_CONFIG = {
  dusuk: { label: 'DÜŞÜK RİSK', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  orta: { label: 'ORTA RİSK', color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  yuksek: { label: 'YÜKSEK RİSK', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
};

export default function SurvivalVerdictCard({ verdict }: Props) {
  if (!verdict) return null;

  const risk = RISK_CONFIG[verdict.riskLevel] || RISK_CONFIG.orta;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(0,240,255,0.06) 0%, rgba(139,92,246,0.06) 50%, rgba(236,72,153,0.06) 100%)',
        border: '1px solid rgba(0,240,255,0.2)',
      }}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: 'linear-gradient(90deg, #00f0ff, #8b5cf6, #ec4899)',
      }} />

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-gray-400">
                Hayatta Kal Ajanı
              </div>
              <div className="text-[10px] text-gray-500 tracking-wide">
                TEK SONUÇ
              </div>
            </div>
          </div>
          <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${risk.bg} ${risk.color} border ${risk.border}`}>
            {risk.label}
          </span>
        </div>

        {/* Main verdict */}
        <div className="flex items-center gap-5 mb-5">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">{verdict.marketLabel}</div>
            <div className="text-3xl md:text-4xl font-black text-white tracking-tight" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
              {verdict.selectionLabel}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl md:text-5xl font-black text-[#00f0ff]" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
              %{verdict.confidence}
            </div>
            <div className="text-[10px] text-gray-500 tracking-wider uppercase">güven</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">
            <Users className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>{verdict.agentAgreement}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">
            <Database className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>{verdict.historicalBacking}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">
            <Shield className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>{verdict.totalAgentsConsulted} ajan istişare</span>
          </div>
        </div>

        {/* Reasoning */}
        <div className="text-sm text-gray-300 leading-relaxed bg-white/[0.02] rounded-lg px-4 py-3 border border-white/5">
          {verdict.reasoning}
        </div>
      </div>
    </motion.div>
  );
}
