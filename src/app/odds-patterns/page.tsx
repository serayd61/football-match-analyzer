'use client';

// ============================================================================
// ODDS PATTERN ANALYSIS
// Analizlerden pattern çıkarır ve benzer durumları gösterir
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SiteNav from '@/components/SiteNav';
import { Spinner } from '@/components/ui';
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
      <div className="fa-shell min-h-screen">
        <SiteNav />
        <div className="grid place-items-center py-32">
          <div className="text-center">
            <Spinner size={28} className="text-brand-400" />
            <p className="mt-4 text-content-muted">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-4"
        >
          <motion.button
            onClick={() => router.push('/dashboard')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="fa-btn fa-btn-ghost p-2"
          >
            <ArrowLeft className="w-5 h-5 text-brand-400" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-bold text-content tracking-tight">
              📊 Odds Pattern Analizi
            </h1>
            <p className="text-content-muted text-sm mt-1">
              Analizlerden çıkarılan pattern&apos;ler ve başarı oranları
            </p>
          </div>
        </motion.div>
        
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="fa-card p-6 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          <div>
            <label className="text-sm text-content-muted mb-1 block">Min Maç Sayısı</label>
            <input
              type="number"
              value={filters.minMatches}
              onChange={(e) => setFilters({ ...filters, minMatches: parseInt(e.target.value) || 0 })}
              className="fa-input w-full"
            />
          </div>
          <div>
            <label className="text-sm text-content-muted mb-1 block">Min Başarı Oranı (%)</label>
            <input
              type="number"
              value={filters.minSuccessRate}
              onChange={(e) => setFilters({ ...filters, minSuccessRate: parseInt(e.target.value) || 0 })}
              className="fa-input w-full"
            />
          </div>
          <div>
            <label className="text-sm text-content-muted mb-1 block">Min Value (%)</label>
            <input
              type="number"
              value={filters.minValue}
              onChange={(e) => setFilters({ ...filters, minValue: parseInt(e.target.value) || 0 })}
              className="fa-input w-full"
            />
          </div>
        </motion.div>
        
        {/* Patterns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.map((pattern, index) => (
            <div key={index} className="fa-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-content tracking-tight">{pattern.pattern}</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-bold border ${
                  pattern.successRate >= 70 ? 'bg-positive/10 text-positive border-positive/30' :
                  pattern.successRate >= 60 ? 'bg-caution/10 text-caution border-caution/30' :
                  'bg-negative/10 text-negative border-negative/30'
                }`}>
                  %{pattern.successRate.toFixed(1)}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-muted">Toplam Maç:</span>
                  <span className="text-content font-medium">{pattern.totalMatches}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-muted">Ortalama Value:</span>
                  <span className="text-positive font-medium">+{pattern.avgValue.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-muted">En İyi Market:</span>
                  <span className="text-brand-400 font-medium">{pattern.bestValueMarket}</span>
                </div>
              </div>
              
              {pattern.recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-xs text-content-muted mb-2">Öneriler:</p>
                  <ul className="space-y-1">
                    {pattern.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-content-muted">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {patterns.length === 0 && (
          <div className="text-center py-12 text-content-muted">
            Henüz yeterli veri yok. Daha fazla analiz yapıldıkça pattern&apos;ler görünecek.
          </div>
        )}
      </div>
    </div>
  );
}

