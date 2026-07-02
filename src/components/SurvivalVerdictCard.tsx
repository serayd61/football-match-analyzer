'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Shield, Users, Database, Zap } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

// ============================================================================
// SURVIVAL VERDICT CARD v2
// "Ya Bil Ya Öl" - Tek sonuç. Tek karar. Ya güçlü ya ölü.
// Üç dilli (useLanguage). NOT: marketLabel/selectionLabel/reasoning AI
// çıktısıdır — analizin üretildiği dilde gelir; burada arayüz etiketleri döner.
// ============================================================================

const L = {
  tr: {
    agentName: 'Hayatta Kal Ajanı',
    strongSignal: 'GÜÇLÜ SİNYAL', singleVerdict: 'TEK SONUÇ', playCareful: 'DİKKATLİ OYNA',
    confidence: 'güven', agentsConsulted: 'ajan istişare',
    riskLow: 'DÜŞÜK RİSK', riskMedium: 'ORTA RİSK', riskHigh: 'YÜKSEK RİSK',
  },
  en: {
    agentName: 'Survival Agent',
    strongSignal: 'STRONG SIGNAL', singleVerdict: 'SINGLE VERDICT', playCareful: 'PLAY IT SAFE',
    confidence: 'confidence', agentsConsulted: 'agents consulted',
    riskLow: 'LOW RISK', riskMedium: 'MEDIUM RISK', riskHigh: 'HIGH RISK',
  },
  de: {
    agentName: 'Survival-Agent',
    strongSignal: 'STARKES SIGNAL', singleVerdict: 'EIN URTEIL', playCareful: 'VORSICHTIG SPIELEN',
    confidence: 'Konfidenz', agentsConsulted: 'Agents befragt',
    riskLow: 'GERINGES RISIKO', riskMedium: 'MITTLERES RISIKO', riskHigh: 'HOHES RISIKO',
  },
} as const;

interface SurvivalVerdictData {
  market: 'MS' | 'OU' | 'BTTS' | string;
  marketLabel: string;
  selection: string;
  selectionLabel: string;
  confidence: number;
  reasoning: string;
  agentAgreement: string;
  historicalBacking: string;
  riskLevel: 'dusuk' | 'orta' | 'yuksek' | string;
  certaintyScore: number;
  totalAgentsConsulted: number;
  isDead?: boolean;
  deathReason?: string;
}

interface Props {
  verdict?: SurvivalVerdictData | null;
}

const RISK_STYLE: Record<string, { key: 'riskLow' | 'riskMedium' | 'riskHigh'; color: string; bg: string; border: string }> = {
  dusuk: { key: 'riskLow', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  orta: { key: 'riskMedium', color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  yuksek: { key: 'riskHigh', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
};

export default function SurvivalVerdictCard({ verdict }: Props) {
  const { lang } = useLanguage();
  const t = (L as any)[lang] || L.en;
  // Ajan karar veremedi veya veri yok → hiçbir şey gösterme
  if (!verdict || verdict.isDead || verdict.confidence === 0) return null;

  const risk = RISK_STYLE[verdict.riskLevel] || RISK_STYLE.orta;
  const riskLabel = t[risk.key];

  // Güven rengini belirle
  const confColor = verdict.confidence >= 70 ? 'text-emerald-400' :
                    verdict.confidence >= 60 ? 'text-[#00f0ff]' :
                    'text-yellow-400';

  // Arka plan gradyanı güvene göre
  const bgGradient = verdict.confidence >= 70
    ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(0,240,255,0.06) 50%, rgba(139,92,246,0.04) 100%)'
    : verdict.confidence >= 60
    ? 'linear-gradient(135deg, rgba(0,240,255,0.06) 0%, rgba(139,92,246,0.06) 50%, rgba(236,72,153,0.04) 100%)'
    : 'linear-gradient(135deg, rgba(234,179,8,0.06) 0%, rgba(249,115,22,0.05) 100%)';

  const borderColor = verdict.confidence >= 70
    ? 'rgba(16,185,129,0.25)'
    : verdict.confidence >= 60
    ? 'rgba(0,240,255,0.2)'
    : 'rgba(234,179,8,0.2)';

  const accentGradient = verdict.confidence >= 70
    ? 'linear-gradient(90deg, #10b981, #00f0ff, #8b5cf6)'
    : verdict.confidence >= 60
    ? 'linear-gradient(90deg, #00f0ff, #8b5cf6, #ec4899)'
    : 'linear-gradient(90deg, #eab308, #f97316)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{ background: bgGradient, border: `1px solid ${borderColor}` }}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accentGradient }} />

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <motion.div 
              className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center"
              animate={verdict.confidence >= 70 ? { boxShadow: ['0 0 0 0 rgba(0,240,255,0)', '0 0 12px 2px rgba(0,240,255,0.15)', '0 0 0 0 rgba(0,240,255,0)'] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {verdict.confidence >= 70 ? (
                <Zap className="w-5 h-5 text-emerald-400" />
              ) : (
                <Crosshair className="w-5 h-5 text-[#00f0ff]" />
              )}
            </motion.div>
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-gray-400">
                {t.agentName}
              </div>
              <div className="text-[10px] text-gray-500 tracking-wide">
                {verdict.confidence >= 70 ? t.strongSignal : verdict.confidence >= 60 ? t.singleVerdict : t.playCareful}
              </div>
            </div>
          </div>
          <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${risk.bg} ${risk.color} border ${risk.border}`}>
            {riskLabel}
          </span>
        </div>

        {/* Main verdict */}
        <div className="flex items-center gap-5 mb-5">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">{verdict.marketLabel}</div>
            <motion.div 
              className="text-3xl md:text-4xl font-black text-white tracking-tight"
              style={{ fontFamily: 'var(--font-heading, inherit)' }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {verdict.selectionLabel}
            </motion.div>
          </div>
          <div className="text-right">
            <motion.div 
              className={`text-4xl md:text-5xl font-black ${confColor}`}
              style={{ fontFamily: 'var(--font-heading, inherit)' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              %{verdict.confidence}
            </motion.div>
            <div className="text-[10px] text-gray-500 tracking-wider uppercase">{t.confidence}</div>
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
            <span>{verdict.totalAgentsConsulted} {t.agentsConsulted}</span>
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
