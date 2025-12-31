'use client';

// ============================================================================
// ODDS PATTERN ANALYSIS
// Analizlerden pattern çıkarır ve benzer durumları gösterir
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FootballBall3D } from '@/components/Football3D';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { 
  TrendingUp, BarChart3, Target, CheckCircle, XCircle,
  ArrowUp, ArrowDown, Filter, Download, ArrowLeft
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00f0ff] border-t-transparent mx-auto" />
          <p className="mt-4 text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-body)' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-4"
        >
          <motion.button
            onClick={() => router.push('/dashboard')}
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg glass-futuristic hover:neon-border-cyan transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-[#00f0ff]" />
          </motion.button>
          <div className="flex items-center gap-3">
            <FootballBall3D size={40} autoRotate={true} />
            <div>
              <h1 className="text-3xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                📊 Odds Pattern Analizi
              </h1>
              <p className="text-gray-400 text-sm mt-1" style={{ fontFamily: 'var(--font-body)' }}>
                Analizlerden çıkarılan pattern'ler ve başarı oranları
              </p>
            </div>
          </div>
        </motion.div>
        
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-futuristic border border-[#00f0ff]/30 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 hover:neon-border-cyan transition-all"
        >
          <div>
            <label className="text-sm text-gray-400 mb-1 block" style={{ fontFamily: 'var(--font-body)' }}>Min Maç Sayısı</label>
            <input
              type="number"
              value={filters.minMatches}
              onChange={(e) => setFilters({ ...filters, minMatches: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 glass-futuristic border border-[#00f0ff]/30 rounded-lg text-white hover:neon-border-cyan transition-all bg-black/50"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block" style={{ fontFamily: 'var(--font-body)' }}>Min Başarı Oranı (%)</label>
            <input
              type="number"
              value={filters.minSuccessRate}
              onChange={(e) => setFilters({ ...filters, minSuccessRate: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 glass-futuristic border border-[#00f0ff]/30 rounded-lg text-white hover:neon-border-cyan transition-all bg-black/50"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block" style={{ fontFamily: 'var(--font-body)' }}>Min Value (%)</label>
            <input
              type="number"
              value={filters.minValue}
              onChange={(e) => setFilters({ ...filters, minValue: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 glass-futuristic border border-[#00f0ff]/30 rounded-lg text-white hover:neon-border-cyan transition-all bg-black/50"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
        </motion.div>
        
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

