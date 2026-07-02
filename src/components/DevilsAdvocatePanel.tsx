'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Shield, Skull } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';

// ============================================================================
// DEVIL'S ADVOCATE PANEL
// Çelişki tespit edildiğinde kırmızı/turuncu uyarı kutusu gösterir.
// Üç dilli (useLanguage). NOT: risk/analiz metinlerinin kendisi AI çıktısıdır
// ve analizin üretildiği dilde gelir — burada yalnız arayüz etiketleri döner.
// ============================================================================

const L = {
  tr: {
    title: 'Şeytanın Avukatı', active: 'aktif', contrarianAvailable: 'Kontrarian analiz mevcut',
    conflictsDetected: (n: number) => `${n} çelişki tespit edildi`,
    risks: 'Riskler', trapIndicators: 'Tuzak Belirtileri', agentConflicts: 'Ajan Çelişkileri', resolution: 'Çözüm',
  },
  en: {
    title: "Devil's Advocate", active: 'active', contrarianAvailable: 'Contrarian analysis available',
    conflictsDetected: (n: number) => `${n} conflicts detected`,
    risks: 'Risks', trapIndicators: 'Trap Indicators', agentConflicts: 'Agent Conflicts', resolution: 'Resolution',
  },
  de: {
    title: 'Advocatus Diaboli', active: 'aktiv', contrarianAvailable: 'Konträre Analyse verfügbar',
    conflictsDetected: (n: number) => `${n} Konflikte erkannt`,
    risks: 'Risiken', trapIndicators: 'Fallen-Indikatoren', agentConflicts: 'Agent-Konflikte', resolution: 'Auflösung',
  },
} as const;

interface DevilsAdvocateData {
  contrarianView?: string;
  risks?: string[];
  trapMatchIndicators?: string[];
  whyFavoriteMightFail?: string;
  matchResult?: string;
  confidence?: number;
  agentSummary?: string;
}

interface DevilsAdvocatePanelProps {
  data?: DevilsAdvocateData | null;
  conflicts?: Array<{ field: string; description: string; resolution: string }>;
  isActivated?: boolean;
}

export default function DevilsAdvocatePanel({ data, conflicts, isActivated }: DevilsAdvocatePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { lang } = useLanguage();
  const t = (L as any)[lang] || L.en;

  if (!data && (!conflicts || conflicts.length === 0)) return null;

  const hasDA = !!data;
  const hasConflicts = conflicts && conflicts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(251,146,60,0.08) 100%)',
        border: '1px solid rgba(239,68,68,0.25)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Skull className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-red-400 flex items-center gap-2">
              {t.title}
              {isActivated && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 uppercase tracking-wider">
                  {t.active}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {hasDA
                ? data.agentSummary || t.contrarianAvailable
                : t.conflictsDetected(conflicts?.length || 0)
              }
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasDA && (
            <span className="text-xs font-mono text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-md">
              {data.matchResult || '?'} @ %{data.confidence || 0}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              {/* Contrarian View */}
              {hasDA && data.contrarianView && (
                <div className="text-sm text-gray-300 leading-relaxed bg-white/[0.03] rounded-lg p-3">
                  {data.contrarianView}
                </div>
              )}

              {/* Why Favorite Might Fail */}
              {hasDA && data.whyFavoriteMightFail && (
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <span className="text-orange-300">{data.whyFavoriteMightFail}</span>
                </div>
              )}

              {/* Risks */}
              {hasDA && data.risks && data.risks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    {t.risks}
                  </div>
                  <div className="grid gap-1">
                    {data.risks.map((risk, i) => (
                      <div key={i} className="text-xs text-gray-400 flex items-start gap-2 pl-1">
                        <span className="text-red-400/60 shrink-0">•</span>
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trap Match Indicators */}
              {hasDA && data.trapMatchIndicators && data.trapMatchIndicators.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-yellow-400/80">{t.trapIndicators}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.trapMatchIndicators.map((indicator, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400/80 border border-yellow-500/20"
                      >
                        {indicator}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Consensus Conflicts */}
              {hasConflicts && (
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="text-xs font-medium text-gray-400">{t.agentConflicts}</div>
                  {conflicts.map((conflict, i) => (
                    <div key={i} className="text-xs bg-white/[0.03] rounded-lg p-2.5 space-y-1">
                      <div className="text-orange-300 font-medium">{conflict.field}: {conflict.description}</div>
                      <div className="text-gray-500">{t.resolution}: {conflict.resolution}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
