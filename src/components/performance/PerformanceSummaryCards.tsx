'use client';

import { motion } from 'framer-motion';
import { BarChart3, CheckCircle, XCircle, Target, Clock, TrendingUp } from 'lucide-react';

interface SummaryProps {
  totalMatches: number;
  settledMatches: number;
  pendingMatches: number;
  consensusAccuracy: number;
  matchResultAccuracy: number;
  overUnderAccuracy: number;
  bttsAccuracy: number;
  isLoading?: boolean;
}

export default function PerformanceSummaryCards({
  totalMatches,
  settledMatches,
  pendingMatches,
  consensusAccuracy,
  matchResultAccuracy,
  overUnderAccuracy,
  bttsAccuracy,
  isLoading = false
}: SummaryProps) {
  const cards = [
    {
      title: 'Toplam Analiz',
      value: totalMatches,
      icon: BarChart3,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30'
    },
    {
      title: 'Sonuçlanan',
      value: settledMatches,
      icon: CheckCircle,
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30'
    },
    {
      title: 'Bekleyen',
      value: pendingMatches,
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30'
    },
    {
      title: 'Genel Doğruluk',
      value: `${consensusAccuracy}%`,
      icon: Target,
      color: consensusAccuracy >= 60 ? 'from-emerald-500 to-green-500' : 'from-red-500 to-rose-500',
      bgColor: consensusAccuracy >= 60 ? 'bg-emerald-500/10' : 'bg-red-500/10',
      borderColor: consensusAccuracy >= 60 ? 'border-emerald-500/30' : 'border-red-500/30'
    }
  ];

  const marketCards = [
    {
      title: 'Maç Sonucu',
      value: `${matchResultAccuracy}%`,
      color: matchResultAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'
    },
    {
      title: 'Alt/Üst',
      value: `${overUnderAccuracy}%`,
      color: overUnderAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'
    },
    {
      title: 'KG Var',
      value: `${bttsAccuracy}%`,
      color: bttsAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-20 mb-2"></div>
            <div className="h-8 bg-white/10 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Ana Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`${card.bgColor} backdrop-blur-sm rounded-xl p-4 border ${card.borderColor} hover:scale-[1.02] transition-transform`}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`} style={{ color: card.color.includes('emerald') ? '#10b981' : card.color.includes('blue') ? '#3b82f6' : card.color.includes('amber') ? '#f59e0b' : '#ef4444' }} />
              <span className="text-xs text-white/60">{card.title}</span>
            </div>
            <div className={`text-2xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
              {card.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Market Doğrulukları */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-white/80 font-medium">Market Bazlı Doğruluk</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {marketCards.map((market) => (
            <div key={market.title} className="text-center">
              <div className={`text-xl font-bold ${market.color}`}>{market.value}</div>
              <div className="text-xs text-white/50">{market.title}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
