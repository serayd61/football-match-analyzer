'use client';

// ============================================================================
// ODDS PATTERN ANALYSIS
// Analizlerden pattern çıkarır ve benzer durumları gösterir
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, BarChart3, Target, CheckCircle, XCircle,
  ArrowUp, ArrowDown, Filter, Download
} from 'lucide-react';

interface PatternAnalysis {
  pattern: string;
  totalMatches: number;
  successRate: number;
  avgValue: number;
  bestValueMarket: string;
  recommendations: string[];
}

export default function OddsPatternsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [patterns, setPatterns] = useState<PatternAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    minMatches: 5,
    minSuccessRate: 50,
    minValue: 5
  });
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  useEffect(() => {
    if (session) {
      fetchPatterns();
    }
  }, [session, filters]);
  
  const fetchPatterns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        minMatches: filters.minMatches.toString(),
        minSuccessRate: filters.minSuccessRate.toString(),
        minValue: filters.minValue.toString()
      });
      
      const response = await fetch(`/api/v2/odds-patterns?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setPatterns(data.patterns || []);
      }
    } catch (error) {
      console.error('Error fetching patterns:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">📊 Odds Pattern Analizi</h1>
          <p className="text-gray-300">Analizlerden çıkarılan pattern'ler ve başarı oranları</p>
        </div>
        
        {/* Filters */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Min Maç Sayısı</label>
            <input
              type="number"
              value={filters.minMatches}
              onChange={(e) => setFilters({ ...filters, minMatches: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Min Başarı Oranı (%)</label>
            <input
              type="number"
              value={filters.minSuccessRate}
              onChange={(e) => setFilters({ ...filters, minSuccessRate: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Min Value (%)</label>
            <input
              type="number"
              value={filters.minValue}
              onChange={(e) => setFilters({ ...filters, minValue: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
        </div>
        
        {/* Patterns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.map((pattern, index) => (
            <div key={index} className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{pattern.pattern}</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  pattern.successRate >= 70 ? 'bg-green-500/20 text-green-400' :
                  pattern.successRate >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  %{pattern.successRate.toFixed(1)}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Toplam Maç:</span>
                  <span className="text-white font-medium">{pattern.totalMatches}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Ortalama Value:</span>
                  <span className="text-green-400 font-medium">+{pattern.avgValue.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">En İyi Market:</span>
                  <span className="text-blue-400 font-medium">{pattern.bestValueMarket}</span>
                </div>
              </div>
              
              {pattern.recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-400 mb-2">Öneriler:</p>
                  <ul className="space-y-1">
                    {pattern.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {patterns.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Henüz yeterli veri yok. Daha fazla analiz yapıldıkça pattern'ler görünecek.
          </div>
        )}
      </div>
    </div>
  );
}

