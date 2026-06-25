'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const L = {
  tr: {
    mr: 'Maç Sonucu', ou: 'Alt/Üst', btts: 'KG Var',
    loading: 'Tarihsel veri yükleniyor...',
    loadFailed: 'Veri yüklenemedi',
    notEnough: 'Yeterli tarihsel veri yok',
    notEnoughShort: 'Yeterli veri yok',
    histAccuracy: 'Tarihsel Doğruluk',
    histAccuracyAnalysis: 'Tarihsel Doğruluk Analizi',
    atConfidence: 'güven aralığında',
    match: 'maç',
    confidence: 'güven',
    loadingPlural: 'Tarihsel veriler yükleniyor...',
  },
  en: {
    mr: 'Match Result', ou: 'Over/Under', btts: 'BTTS',
    loading: 'Loading historical data...',
    loadFailed: "Couldn't load data",
    notEnough: 'Not enough historical data',
    notEnoughShort: 'Not enough data',
    histAccuracy: 'Historical Accuracy',
    histAccuracyAnalysis: 'Historical Accuracy Analysis',
    atConfidence: 'at confidence',
    match: 'matches',
    confidence: 'confidence',
    loadingPlural: 'Loading historical data...',
  },
  de: {
    mr: 'Spielergebnis', ou: 'Über/Unter', btts: 'BTTS',
    loading: 'Historische Daten werden geladen...',
    loadFailed: 'Daten konnten nicht geladen werden',
    notEnough: 'Nicht genug historische Daten',
    notEnoughShort: 'Nicht genug Daten',
    histAccuracy: 'Historische Genauigkeit',
    histAccuracyAnalysis: 'Historische Genauigkeitsanalyse',
    atConfidence: 'bei Konfidenz',
    match: 'Spiele',
    confidence: 'Konfidenz',
    loadingPlural: 'Historische Daten werden geladen...',
  },
} as const;

interface HistoricalAccuracyData {
  market: string;
  prediction: string;
  confidenceRange: string;
  confRangeStart: number;
  confRangeEnd: number;
  totalMatches: number;
  correctMatches: number;
  accuracy: number;
  hasEnoughData: boolean;
}

interface Props {
  market: 'mr' | 'ou' | 'btts';
  prediction: string;
  confidence: number;
  compact?: boolean;
  showDetails?: boolean;
}

export default function HistoricalAccuracyBadge({
  market,
  prediction,
  confidence,
  compact = false,
  showDetails = true
}: Props) {
  const { lang } = useLanguage();
  const t = L[lang] || L.en;
  const [data, setData] = useState<HistoricalAccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistoricalAccuracy = async () => {
      // confidence 0 olabilir, sadece market ve prediction gerekli
      if (!market || !prediction || confidence === undefined || confidence === null) {
        setLoading(false);
        return;
      }
      
      // Confidence 0 veya çok düşükse skip
      if (confidence < 1) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          market,
          prediction: prediction.toString(),
          confidence: Math.round(confidence).toString()
        });
        
        console.log('🔍 Fetching historical accuracy:', { market, prediction, confidence, url: `/api/performance/historical-accuracy?${params}` });
        
        const res = await fetch(`/api/performance/historical-accuracy?${params}`);
        const result = await res.json();
        
        console.log('📊 Historical accuracy result:', result);
        
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Unknown error');
        }
      } catch (err: any) {
        console.error('❌ Historical accuracy fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalAccuracy();
  }, [market, prediction, confidence]);

  if (loading) {
    return (
      <div className={`flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'} text-white/40`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>{t.loading}</span>
      </div>
    );
  }

  if (error) {
    console.error('Historical accuracy error:', error);
    return (
      <div className={`flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'} text-red-400/60`}>
        <AlertCircle className="w-3 h-3" />
        <span>{t.loadFailed}</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!data.hasEnoughData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-1.5 px-2 py-1 bg-gray-500/20 border border-gray-500/30 rounded-lg ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <AlertCircle className="w-3 h-3 text-gray-400" />
        <span className="text-gray-400">{t.notEnough}</span>
      </motion.div>
    );
  }

  // Determine badge color based on accuracy
  let badgeColor = 'bg-gray-500/20 border-gray-500/30 text-gray-300';
  let Icon = Minus;
  let iconColor = 'text-gray-400';

  if (data.accuracy >= 65) {
    badgeColor = 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300';
    Icon = TrendingUp;
    iconColor = 'text-emerald-400';
  } else if (data.accuracy >= 55) {
    badgeColor = 'bg-amber-500/20 border-amber-500/30 text-amber-300';
    Icon = Minus;
    iconColor = 'text-amber-400';
  } else if (data.accuracy < 50) {
    badgeColor = 'bg-red-500/20 border-red-500/30 text-red-300';
    Icon = TrendingDown;
    iconColor = 'text-red-400';
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${badgeColor} text-xs`}
        title={`%${data.confRangeStart}-${data.confRangeEnd} ${t.atConfidence} ${data.totalMatches} ${t.match}, ${data.correctMatches} (${data.accuracy}%)`}
      >
        <History className="w-3 h-3" />
        <span>{data.accuracy}%</span>
        <span className="text-white/40">({data.totalMatches})</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col gap-1 p-2 rounded-lg border ${badgeColor}`}
    >
      <div className="flex items-center gap-2">
        <History className={`w-4 h-4 ${iconColor}`} />
        <span className="font-medium">{t.histAccuracy}</span>
        <Icon className={`w-4 h-4 ml-auto ${iconColor}`} />
      </div>
      
      {showDetails && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">
            %{data.confRangeStart}-{data.confRangeEnd} {t.atConfidence}
          </span>
          <span className="font-bold">
            {data.accuracy}% ({data.correctMatches}/{data.totalMatches})
          </span>
        </div>
      )}
    </motion.div>
  );
}

// Batch version for fetching multiple predictions at once
interface BatchProps {
  predictions: Array<{
    market: 'mr' | 'ou' | 'btts';
    prediction: string;
    confidence: number;
  }>;
  onDataLoaded?: (data: HistoricalAccuracyData[]) => void;
}

export function useHistoricalAccuracyBatch(predictions: BatchProps['predictions']) {
  const [data, setData] = useState<HistoricalAccuracyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatch = async () => {
      if (!predictions || predictions.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/performance/historical-accuracy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictions })
        });

        const result = await res.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [JSON.stringify(predictions)]);

  return { data, loading, error };
}

// Helper component to display all predictions with historical accuracy
interface HistoricalAccuracySummaryProps {
  mrPrediction?: string;
  mrConfidence?: number;
  ouPrediction?: string;
  ouConfidence?: number;
  bttsPrediction?: string;
  bttsConfidence?: number;
}

export function HistoricalAccuracySummary({
  mrPrediction,
  mrConfidence,
  ouPrediction,
  ouConfidence,
  bttsPrediction,
  bttsConfidence
}: HistoricalAccuracySummaryProps) {
  const predictions = [];
  
  if (mrPrediction && mrConfidence) {
    predictions.push({ market: 'mr' as const, prediction: mrPrediction, confidence: mrConfidence });
  }
  if (ouPrediction && ouConfidence) {
    predictions.push({ market: 'ou' as const, prediction: ouPrediction, confidence: ouConfidence });
  }
  if (bttsPrediction && bttsConfidence) {
    predictions.push({ market: 'btts' as const, prediction: bttsPrediction, confidence: bttsConfidence });
  }

  const { lang } = useLanguage();
  const t = L[lang] || L.en;
  const { data, loading, error } = useHistoricalAccuracyBatch(predictions);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{t.loadingPlural}</span>
      </div>
    );
  }

  if (error || data.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <History className="w-5 h-5 text-cyan-400" />
        <h4 className="text-white font-medium">{t.histAccuracyAnalysis}</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.map((item, index) => {
          if (!item.hasEnoughData) {
            return (
              <div key={index} className="bg-gray-500/10 rounded-lg p-3 text-center">
                <div className="text-xs text-white/50 mb-1">{(t as any)[item.market]}</div>
                <div className="text-sm text-gray-400">{t.notEnoughShort}</div>
              </div>
            );
          }

          let bgColor = 'bg-gray-500/10';
          let textColor = 'text-gray-300';
          
          if (item.accuracy >= 65) {
            bgColor = 'bg-emerald-500/10';
            textColor = 'text-emerald-400';
          } else if (item.accuracy >= 55) {
            bgColor = 'bg-amber-500/10';
            textColor = 'text-amber-400';
          } else if (item.accuracy < 50) {
            bgColor = 'bg-red-500/10';
            textColor = 'text-red-400';
          }

          return (
            <div key={index} className={`${bgColor} rounded-lg p-3 text-center`}>
              <div className="text-xs text-white/50 mb-1">{(t as any)[item.market]}</div>
              <div className={`text-xl font-bold ${textColor}`}>{item.accuracy}%</div>
              <div className="text-xs text-white/40">
                {item.correctMatches}/{item.totalMatches} {t.match}
              </div>
              <div className="text-[10px] text-white/30 mt-1">
                %{item.confRangeStart}-{item.confRangeEnd} {t.confidence}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
