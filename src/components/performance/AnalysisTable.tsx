'use client';

import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface AnalysisRecord {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  match_settled: boolean;
  consensus_match_result: string;
  consensus_over_under: string;
  consensus_btts: string;
  consensus_confidence: number;
  actual_home_score: number | null;
  actual_away_score: number | null;
  actual_match_result: string | null;
  actual_over_under: string | null;
  actual_btts: string | null;
  consensus_mr_correct: boolean | null;
  consensus_ou_correct: boolean | null;
  consensus_btts_correct: boolean | null;
}

interface Props {
  analyses: AnalysisRecord[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasMore: boolean;
  };
  onPageChange?: (page: number) => void;
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function PredictionBadge({ 
  prediction, 
  actual, 
  isCorrect, 
  type 
}: { 
  prediction: string; 
  actual: string | null; 
  isCorrect: boolean | null;
  type: 'mr' | 'ou' | 'btts';
}) {
  const displayPrediction = type === 'mr' 
    ? (prediction === '1' ? 'Ev' : prediction === '2' ? 'Dep' : prediction === 'X' ? 'Ber' : prediction)
    : type === 'ou'
    ? (prediction?.toLowerCase().includes('over') ? 'Üst' : prediction?.toLowerCase().includes('under') ? 'Alt' : prediction)
    : (prediction?.toLowerCase() === 'yes' ? 'Evet' : prediction?.toLowerCase() === 'no' ? 'Hayır' : prediction);

  if (isCorrect === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 border border-gray-500/30 rounded text-gray-300 text-xs">
        <Clock className="w-3 h-3" />
        {displayPrediction || '-'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
      isCorrect 
        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' 
        : 'bg-red-500/20 border border-red-500/30 text-red-300'
    }`}>
      {isCorrect ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {displayPrediction || '-'}
    </span>
  );
}

export default function AnalysisTable({ analyses, isLoading = false, pagination, onPageChange }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: analyses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!analyses || analyses.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 text-center">
        <p className="text-white/50">Filtrelere uygun analiz bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-white font-medium">Analizler</h3>
        {pagination && (
          <span className="text-xs text-white/50">
            {pagination.totalRecords} kayıt
          </span>
        )}
      </div>

      {/* Virtual Scroll Container */}
      <div 
        ref={parentRef}
        className="h-[500px] overflow-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const analysis = analyses[virtualRow.index];
            
            return (
              <div
                key={analysis.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="border-b border-white/5"
              >
                <div className="p-3 hover:bg-white/5 transition-colors h-full">
                  {/* Match Info */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">
                        {analysis.home_team} vs {analysis.away_team}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{analysis.league}</span>
                        <span>•</span>
                        <span>{formatDate(analysis.match_date)}</span>
                      </div>
                    </div>
                    
                    {/* Score */}
                    {analysis.match_settled && analysis.actual_home_score !== null && (
                      <div className="text-lg font-bold text-white ml-4">
                        {analysis.actual_home_score} - {analysis.actual_away_score}
                      </div>
                    )}
                  </div>

                  {/* Predictions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <PredictionBadge
                      prediction={analysis.consensus_match_result}
                      actual={analysis.actual_match_result}
                      isCorrect={analysis.consensus_mr_correct}
                      type="mr"
                    />
                    <PredictionBadge
                      prediction={analysis.consensus_over_under}
                      actual={analysis.actual_over_under}
                      isCorrect={analysis.consensus_ou_correct}
                      type="ou"
                    />
                    <PredictionBadge
                      prediction={analysis.consensus_btts}
                      actual={analysis.actual_btts}
                      isCorrect={analysis.consensus_btts_correct}
                      type="btts"
                    />
                    <span className="text-xs text-white/40 ml-auto">
                      {analysis.consensus_confidence}% güven
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Önceki
          </button>
          
          <span className="text-sm text-white/60">
            Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasMore}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
          >
            Sonraki
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
