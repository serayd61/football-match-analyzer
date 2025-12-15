'use client';

import React, { useState, useEffect } from 'react';
import AIBrainVisualization from './AIBrainVisualization';
import AIBrainLoading from './AIBrainLoading';
import AIBrainError from './AIBrainError';
import { RefreshCw } from 'lucide-react';

interface AIBrainContainerProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league?: string;
  language?: string;
}

export default function AIBrainContainer({
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  league = '',
  language = 'tr'
}: AIBrainContainerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          homeTeam,
          awayTeam,
          homeTeamId,
          awayTeamId,
          league,
          language
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze match');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount or when teams change
  useEffect(() => {
    if (homeTeamId && awayTeamId) {
      fetchAnalysis();
    }
  }, [homeTeamId, awayTeamId]);

  return (
    <div className="w-full">
      {/* Refresh Button (always visible when we have data) */}
      {data && !loading && (
        <div className="flex justify-end mb-4">
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && <AIBrainLoading />}

      {/* Error State */}
      {error && !loading && (
        <AIBrainError error={error} onRetry={fetchAnalysis} />
      )}

      {/* Success State */}
      {data && !loading && !error && (
        <AIBrainVisualization 
          data={data} 
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      )}

      {/* Initial State - No data yet */}
      {!data && !loading && !error && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-12 text-center">
          <p className="text-gray-400 mb-4">Select a match to start AI Brain analysis</p>
          <button
            onClick={fetchAnalysis}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-medium transition-all"
          >
            Analyze Match
          </button>
        </div>
      )}
    </div>
  );
}
