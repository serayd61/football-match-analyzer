'use client';

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Sparkles, 
  Newspaper,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface AIPrediction {
  model: string;
  role: string;
  confidence: number;
  predictions: {
    matchResult: { prediction: string; confidence: number; reasoning: string };
    goals: { over25: boolean; confidence: number; reasoning: string };
    btts: { prediction: boolean; confidence: number; reasoning: string };
  };
  keyInsights: string[];
  riskFactors: string[];
}

interface ConsensusPrediction {
  matchId: number;
  predictions: AIPrediction[];
  consensus: {
    matchResult: { prediction: string; confidence: number; agreement: number };
    goals: { over25: boolean; confidence: number; agreement: number };
    btts: { prediction: boolean; confidence: number; agreement: number };
  };
  overallConfidence: number;
  conflictingViews: string[];
  unanimousInsights: string[];
}

const AI_MODELS = {
  claude: { 
    name: 'Claude', 
    role: 'Tactical Analyst',
    icon: Brain,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30'
  },
  gpt4: { 
    name: 'GPT-4', 
    role: 'Statistical Engine',
    icon: BarChart3,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
  gemini: { 
    name: 'Gemini', 
    role: 'Pattern Hunter',
    icon: Sparkles,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  perplexity: { 
    name: 'Perplexity', 
    role: 'News & Context',
    icon: Newspaper,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  }
};

interface AIBrainVisualizationProps {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
}

export default function AIBrainVisualization({ 
  fixtureId, 
  homeTeam, 
  awayTeam 
}: AIBrainVisualizationProps) {
  const [analysis, setAnalysis] = useState<ConsensusPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, mode: 'consensus' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Failed to connect to AI Brain');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    fetchAnalysis();
  }, [fixtureId]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500';
    if (confidence >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getAgreementBadge = (agreement: number) => {
    if (agreement === 4) return { text: 'Unanimous', color: 'bg-green-500' };
    if (agreement === 3) return { text: 'Strong', color: 'bg-blue-500' };
    if (agreement === 2) return { text: 'Split', color: 'bg-yellow-500' };
    return { text: 'Divided', color: 'bg-red-500' };
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <Brain className="w-16 h-16 text-purple-500 animate-pulse" />
            <div className="absolute -inset-4 border-4 border-purple-500/30 rounded-full animate-spin" />
          </div>
          <p className="text-gray-400">AI Brain analyzing match...</p>
          <div className="flex space-x-2">
            {Object.entries(AI_MODELS).map(([key, model]) => (
              <div 
                key={key}
                className={`w-3 h-3 rounded-full ${model.bgColor} animate-pulse`}
                style={{ animationDelay: `${Object.keys(AI_MODELS).indexOf(key) * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-red-800">
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-red-400">{error}</p>
          <button 
            onClick={fetchAnalysis}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const selectedPrediction = activeModel 
    ? analysis.predictions.find(p => p.model === activeModel)
    : null;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">AI Brain Analysis</h2>
              <p className="text-white/70 text-sm">{homeTeam} vs {awayTeam}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getConfidenceColor(analysis.overallConfidence)}`}>
              {analysis.overallConfidence}%
            </div>
            <p className="text-white/70 text-sm">Consensus Confidence</p>
          </div>
        </div>
      </div>

      {/* AI Model Cards */}
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(AI_MODELS).map(([key, model]) => {
          const prediction = analysis.predictions.find(p => p.model === key);
          const Icon = model.icon;
          const isActive = activeModel === key;
          
          return (
            <button
              key={key}
              onClick={() => setActiveModel(isActive ? null : key)}
              className={`p-4 rounded-xl border transition-all ${
                isActive 
                  ? `${model.bgColor} ${model.borderColor} ring-2 ring-${model.color.split('-')[1]}-500`
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${model.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">{model.name}</p>
                  <p className="text-xs text-gray-400">{model.role}</p>
                </div>
              </div>
              {prediction && (
                <div className="mt-3 text-left">
                  <div className={`text-lg font-bold ${getConfidenceColor(prediction.confidence)}`}>
                    {prediction.confidence}%
                  </div>
                  <p className="text-xs text-gray-500">Confidence</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Consensus Results */}
      <div className="px-6 pb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
          Consensus Predictions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Match Result */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Match Result</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-white">
                {analysis.consensus.matchResult.prediction === '1' ? homeTeam :
                 analysis.consensus.matchResult.prediction === '2' ? awayTeam : 'Draw'}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                getAgreementBadge(analysis.consensus.matchResult.agreement).color
              }`}>
                {getAgreementBadge(analysis.consensus.matchResult.agreement).text}
              </span>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  style={{ width: `${analysis.consensus.matchResult.confidence}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analysis.consensus.matchResult.confidence}% confidence
              </p>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Goals</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-white">
                {analysis.consensus.goals.over25 ? 'Over 2.5' : 'Under 2.5'}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                getAgreementBadge(analysis.consensus.goals.agreement).color
              }`}>
                {getAgreementBadge(analysis.consensus.goals.agreement).text}
              </span>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                  style={{ width: `${analysis.consensus.goals.confidence}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analysis.consensus.goals.confidence}% confidence
              </p>
            </div>
          </div>

          {/* BTTS */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Both Teams to Score</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-white">
                {analysis.consensus.btts.prediction ? 'Yes' : 'No'}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                getAgreementBadge(analysis.consensus.btts.agreement).color
              }`}>
                {getAgreementBadge(analysis.consensus.btts.agreement).text}
              </span>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{ width: `${analysis.consensus.btts.confidence}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analysis.consensus.btts.confidence}% confidence
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Model Details */}
      {selectedPrediction && (
        <div className="px-6 pb-6">
          <div className={`rounded-xl p-4 border ${
            AI_MODELS[activeModel as keyof typeof AI_MODELS].bgColor
          } ${AI_MODELS[activeModel as keyof typeof AI_MODELS].borderColor}`}>
            <h4 className="font-semibold text-white mb-3">
              {AI_MODELS[activeModel as keyof typeof AI_MODELS].name} Analysis
            </h4>
            
            {/* Key Insights */}
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-400">Key Insights:</p>
              {selectedPrediction.keyInsights.map((insight, i) => (
                <div key={i} className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">{insight}</p>
                </div>
              ))}
            </div>

            {/* Risk Factors */}
            {selectedPrediction.riskFactors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Risk Factors:</p>
                {selectedPrediction.riskFactors.map((risk, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-300">{risk}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reasoning */}
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <p className="text-sm text-gray-400 mb-2">Match Result Reasoning:</p>
              <p className="text-sm text-gray-300">
                {selectedPrediction.predictions.matchResult.reasoning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conflicting Views */}
      {analysis.conflictingViews.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <h4 className="font-semibold text-yellow-500 mb-2 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Conflicting Views
            </h4>
            <ul className="space-y-1">
              {analysis.conflictingViews.map((view, i) => (
                <li key={i} className="text-sm text-gray-300">• {view}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="px-6 pb-6">
        <button
          onClick={fetchAnalysis}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl font-semibold flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>
    </div>
  );
}
