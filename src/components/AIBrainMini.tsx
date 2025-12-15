'use client';

import React from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AIBrainMiniProps {
  prediction: {
    matchResult: string;
    confidence: number;
    votes: number;
    totalVotes: number;
    riskLevel: string;
  };
  homeTeam: string;
  awayTeam: string;
  onClick?: () => void;
}

export default function AIBrainMini({ prediction, homeTeam, awayTeam, onClick }: AIBrainMiniProps) {
  const getResultIcon = () => {
    if (prediction.matchResult === 'Home Win') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (prediction.matchResult === 'Away Win') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-yellow-400" />;
  };

  const getResultLabel = () => {
    if (prediction.matchResult === 'Home Win') return homeTeam;
    if (prediction.matchResult === 'Away Win') return awayTeam;
    return 'Draw';
  };

  const getConfidenceColor = () => {
    if (prediction.confidence >= 70) return 'text-green-400';
    if (prediction.confidence >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  const isStrongConsensus = prediction.votes >= 3;

  return (
    <button 
      onClick={onClick}
      className="w-full p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-all group"
    >
      <div className="flex items-center justify-between">
        {/* Left: Brain Icon + Prediction */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              {getResultIcon()}
              <span className="font-medium text-white text-sm">{getResultLabel()}</span>
              {isStrongConsensus && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              )}
            </div>
            <p className="text-xs text-gray-500">
              {prediction.votes}/{prediction.totalVotes} AI • {prediction.riskLevel} Risk
            </p>
          </div>
        </div>

        {/* Right: Confidence */}
        <div className="text-right">
          <span className={`text-lg font-bold ${getConfidenceColor()}`}>
            {prediction.confidence}%
          </span>
          <p className="text-xs text-gray-500">confidence</p>
        </div>
      </div>
    </button>
  );
}
