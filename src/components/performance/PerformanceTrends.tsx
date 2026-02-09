'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface DailyTrend {
  date: string;
  totalMatches: number;
  mrCorrect: number;
  mrAccuracy: number;
  ouCorrect: number;
  ouAccuracy: number;
  bttsCorrect: number;
  bttsAccuracy: number;
  overallAccuracy: number;
  avgConfidence: number;
}

interface WeeklyTrend {
  week: string;
  weekStart: string;
  weekEnd: string;
  totalMatches: number;
  mrAccuracy: number;
  ouAccuracy: number;
  bttsAccuracy: number;
  overallAccuracy: number;
}

interface CumulativeStats {
  totalMatches: number;
  avgMrAccuracy: number;
  avgOuAccuracy: number;
  avgBttsAccuracy: number;
  avgOverallAccuracy: number;
  bestDay: DailyTrend | null;
  worstDay: DailyTrend | null;
}

interface Props {
  dailyTrends: DailyTrend[];
  weeklyTrends: WeeklyTrend[];
  cumulativeStats: CumulativeStats;
  isLoading?: boolean;
}

type ChartType = 'line' | 'area' | 'bar';
type ViewType = 'daily' | 'weekly';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-xl">
        <p className="text-white/80 text-xs mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PerformanceTrends({ 
  dailyTrends, 
  weeklyTrends, 
  cumulativeStats,
  isLoading = false 
}: Props) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [viewType, setViewType] = useState<ViewType>('daily');

  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-48 mb-4"></div>
          <div className="h-[300px] bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  const data = viewType === 'daily' 
    ? dailyTrends.slice(0, 30).reverse().map(d => ({
        name: new Date(d.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        MS: d.mrAccuracy,
        'O/U': d.ouAccuracy,
        BTTS: d.bttsAccuracy,
        Genel: d.overallAccuracy,
        Maç: d.totalMatches
      }))
    : weeklyTrends.slice(0, 12).reverse().map(w => ({
        name: `${new Date(w.weekStart).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}`,
        MS: w.mrAccuracy,
        'O/U': w.ouAccuracy,
        BTTS: w.bttsAccuracy,
        Genel: w.overallAccuracy,
        Maç: w.totalMatches
      }));

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 10, left: -20, bottom: 0 }
    };

    const commonLineProps = {
      strokeWidth: 2,
      dot: false,
      activeDot: { r: 4, strokeWidth: 0 }
    };

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Line type="monotone" dataKey="MS" stroke="#06b6d4" {...commonLineProps} />
          <Line type="monotone" dataKey="O/U" stroke="#a855f7" {...commonLineProps} />
          <Line type="monotone" dataKey="BTTS" stroke="#f59e0b" {...commonLineProps} />
          <Line type="monotone" dataKey="Genel" stroke="#10b981" {...commonLineProps} />
        </LineChart>
      );
    }

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id="colorMS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOU" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBTTS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorGenel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Area type="monotone" dataKey="MS" stroke="#06b6d4" fill="url(#colorMS)" strokeWidth={2} />
          <Area type="monotone" dataKey="O/U" stroke="#a855f7" fill="url(#colorOU)" strokeWidth={2} />
          <Area type="monotone" dataKey="BTTS" stroke="#f59e0b" fill="url(#colorBTTS)" strokeWidth={2} />
          <Area type="monotone" dataKey="Genel" stroke="#10b981" fill="url(#colorGenel)" strokeWidth={2} />
        </AreaChart>
      );
    }

    return (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '10px' }} />
        <Bar dataKey="MS" fill="#06b6d4" radius={[2, 2, 0, 0]} />
        <Bar dataKey="O/U" fill="#a855f7" radius={[2, 2, 0, 0]} />
        <Bar dataKey="BTTS" fill="#f59e0b" radius={[2, 2, 0, 0]} />
      </BarChart>
    );
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-medium">Performans Trendi</h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Type Toggle */}
            <div className="flex bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setViewType('daily')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  viewType === 'daily' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Günlük
              </button>
              <button
                onClick={() => setViewType('weekly')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  viewType === 'weekly' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Haftalık
              </button>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setChartType('area')}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  chartType === 'area' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Alan
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  chartType === 'line' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Çizgi
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  chartType === 'bar' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Bar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-white/50">
            Trend verisi bulunamadı
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {cumulativeStats && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-xs text-white/50 mb-1">Ort. MS</div>
              <div className={`text-lg font-bold ${cumulativeStats.avgMrAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cumulativeStats.avgMrAccuracy}%
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-xs text-white/50 mb-1">Ort. O/U</div>
              <div className={`text-lg font-bold ${cumulativeStats.avgOuAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cumulativeStats.avgOuAccuracy}%
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-xs text-white/50 mb-1">Ort. BTTS</div>
              <div className={`text-lg font-bold ${cumulativeStats.avgBttsAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cumulativeStats.avgBttsAccuracy}%
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-xs text-white/50 mb-1">Ort. Genel</div>
              <div className={`text-lg font-bold ${cumulativeStats.avgOverallAccuracy >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cumulativeStats.avgOverallAccuracy}%
              </div>
            </div>
          </div>

          {/* Best/Worst Days */}
          {(cumulativeStats.bestDay || cumulativeStats.worstDay) && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {cumulativeStats.bestDay && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <div className="text-xs text-emerald-400 mb-1">En İyi Gün</div>
                  <div className="text-sm text-white">
                    {new Date(cumulativeStats.bestDay.date).toLocaleDateString('tr-TR')}
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    {cumulativeStats.bestDay.overallAccuracy}%
                  </div>
                </div>
              )}
              {cumulativeStats.worstDay && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="text-xs text-red-400 mb-1">En Kötü Gün</div>
                  <div className="text-sm text-white">
                    {new Date(cumulativeStats.worstDay.date).toLocaleDateString('tr-TR')}
                  </div>
                  <div className="text-lg font-bold text-red-400">
                    {cumulativeStats.worstDay.overallAccuracy}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
