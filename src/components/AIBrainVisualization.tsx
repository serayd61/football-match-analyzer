'use client';

import React, { useState } from 'react';
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Sparkles, 
  Newspaper,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Shield,
  Swords
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AIAnalysis {
  matchResult: {
    prediction: string;
    confidence: number;
    reasoning: string;
  };
  overUnder25: {
    prediction: string;
    confidence: number;
    reasoning: string;
  };
  btts: {
    prediction: string;
    confidence: number;
    reasoning: string;
  };
  overallAnalysis: string;
  role: string;
  specialization: string;
}

interface AIStatus {
  active: boolean;
  role: string;
  weight: number;
}

interface ConsensusResult {
  prediction: string;
  confidence: number;
  votes: number;
  totalVotes: number;
  weightedAgreement: number;
  reasonings: string[];
}

interface BestBet {
  type: string;
  selection: string;
  confidence: number;
  votes: number;
  totalVotes: number;
  weightedAgreement: number;
  consensusStrength: string;
}

interface AIBrainResponse {
  success: boolean;
  brainVersion: string;
  analysis: {
    matchResult: ConsensusResult;
    overUnder25: ConsensusResult;
    btts: ConsensusResult;
    riskLevel: string;
    bestBets: BestBet[];
  };
  aiStatus: {
    claude: AIStatus;
    openai: AIStatus;
    gemini: AIStatus;
    perplexity: AIStatus;
  };
  individualAnalyses: {
    claude?: AIAnalysis;
    openai?: AIAnalysis;
    gemini?: AIAnalysis;
    perplexity?: AIAnalysis;
  };
  stats: {
    home: { name: string };
    away: { name: string };
  };
  timing: {
    total: string;
  };
}

interface AIBrainVisualizationProps {
  data: AIBrainResponse;
  homeTeam: string;
  awayTeam: string;
}

// ============================================================================
// AI MODEL CONFIG
// ============================================================================

const AI_MODELS = {
  claude: {
    name: 'Claude',
    role: 'Tactical Analyst',
    icon: Brain,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    description: 'Momentum & Tactics'
  },
  openai: {
    name: 'GPT-4',
    role: 'Statistical Engine',
    icon: BarChart3,
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    description: 'xG & Probabilities'
  },
  gemini: {
    name: 'Gemini',
    role: 'Pattern Hunter',
    icon: Sparkles,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    description: 'H2H & Trends'
  },
  perplexity: {
    name: 'Perplexity',
    role: 'Context Analyst',
    icon: Newspaper,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    description: 'News & Context'
  }
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ConfidenceBar = ({ value, color = 'blue' }: { value: number; color?: string }) => {
  const getBarColor = () => {
    if (value >= 75) return 'bg-gradient-to-r from-green-500 to-emerald-400';
    if (value >= 60) return 'bg-gradient-to-r from-blue-500 to-cyan-400';
    if (value >= 50) return 'bg-gradient-to-r from-yellow-500 to-amber-400';
    return 'bg-gradient-to-r from-red-500 to-orange-400';
  };

  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div 
        className={`h-full ${getBarColor()} transition-all duration-500 ease-out`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

const ConsensusStrengthBadge = ({ strength }: { strength: string }) => {
  const config = {
    Strong: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    Moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    Weak: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' }
  };
  
  const { bg, text, border } = config[strength as keyof typeof config] || config.Weak;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text} border ${border}`}>
      {strength}
    </span>
  );
};

const RiskLevelIndicator = ({ level }: { level: string }) => {
  const config = {
    Low: { icon: Shield, color: 'text-green-400', bg: 'bg-green-500/20' },
    Medium: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    High: { icon: Zap, color: 'text-red-400', bg: 'bg-red-500/20' }
  };
  
  const { icon: Icon, color, bg } = config[level as keyof typeof config] || config.Medium;
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg}`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-sm font-medium ${color}`}>{level} Risk</span>
    </div>
  );
};

// ============================================================================
// AI MODEL CARD
// ============================================================================

const AIModelCard = ({ 
  modelKey, 
  status, 
  analysis,
  isExpanded,
  onToggle,
  consensusPredictions
}: { 
  modelKey: string;
  status: AIStatus;
  analysis?: AIAnalysis;
  isExpanded: boolean;
  onToggle: () => void;
  consensusPredictions: {
    matchResult: string;
    overUnder25: string;
    btts: string;
  };
}) => {
  const model = AI_MODELS[modelKey as keyof typeof AI_MODELS];
  const Icon = model.icon;
  
  const isAgreeWithConsensus = (prediction: string, consensusPred: string) => {
    return prediction === consensusPred;
  };

  return (
    <div className={`rounded-xl border transition-all duration-300 ${
      status.active 
        ? `${model.bgColor} ${model.borderColor}` 
        : 'bg-gray-800/30 border-gray-700/50 opacity-50'
    }`}>
      {/* Header */}
      <button 
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between"
        disabled={!status.active}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${model.color} shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{model.name}</span>
              {status.active ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
            <p className="text-xs text-gray-400">{model.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Weight</p>
            <p className={`font-bold ${model.textColor}`}>{Math.round(status.weight * 100)}%</p>
          </div>
          {status.active && (
            isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {status.active && isExpanded && analysis && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50">
          {/* Predictions Grid */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            {/* Match Result */}
            <div className={`p-3 rounded-lg ${
              isAgreeWithConsensus(analysis.matchResult.prediction, consensusPredictions.matchResult)
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className="text-xs text-gray-400 mb-1">Match Result</p>
              <p className="font-bold text-white text-sm">{analysis.matchResult.prediction}</p>
              <p className={`text-xs ${
                isAgreeWithConsensus(analysis.matchResult.prediction, consensusPredictions.matchResult)
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {analysis.matchResult.confidence}% conf
              </p>
            </div>

            {/* Over/Under */}
            <div className={`p-3 rounded-lg ${
              isAgreeWithConsensus(analysis.overUnder25.prediction, consensusPredictions.overUnder25)
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className="text-xs text-gray-400 mb-1">Goals</p>
              <p className="font-bold text-white text-sm">{analysis.overUnder25.prediction}</p>
              <p className={`text-xs ${
                isAgreeWithConsensus(analysis.overUnder25.prediction, consensusPredictions.overUnder25)
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {analysis.overUnder25.confidence}% conf
              </p>
            </div>

            {/* BTTS */}
            <div className={`p-3 rounded-lg ${
              isAgreeWithConsensus(analysis.btts.prediction, consensusPredictions.btts)
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className="text-xs text-gray-400 mb-1">BTTS</p>
              <p className="font-bold text-white text-sm">{analysis.btts.prediction}</p>
              <p className={`text-xs ${
                isAgreeWithConsensus(analysis.btts.prediction, consensusPredictions.btts)
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {analysis.btts.confidence}% conf
              </p>
            </div>
          </div>

          {/* Reasoning */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Analysis</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              {analysis.overallAnalysis || analysis.matchResult.reasoning}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CONSENSUS CARD
// ============================================================================

const ConsensusCard = ({ 
  title, 
  result, 
  icon: Icon,
  iconColor 
}: { 
  title: string;
  result: ConsensusResult;
  icon: React.ElementType;
  iconColor: string;
}) => {
  const [showReasons, setShowReasons] = useState(false);

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            <span className="text-sm text-gray-400">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {result.votes}/{result.totalVotes} AI
            </span>
            <ConsensusStrengthBadge 
              strength={result.weightedAgreement >= 70 ? 'Strong' : result.weightedAgreement >= 50 ? 'Moderate' : 'Weak'} 
            />
          </div>
        </div>

        <div className="flex items-end justify-between mb-3">
          <h3 className="text-2xl font-bold text-white">{result.prediction}</h3>
          <span className={`text-3xl font-bold ${
            result.confidence >= 70 ? 'text-green-400' : 
            result.confidence >= 55 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {result.confidence}%
          </span>
        </div>

        <ConfidenceBar value={result.confidence} />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">
            Weighted Agreement: {result.weightedAgreement}%
          </span>
          {result.reasonings && result.reasonings.length > 0 && (
            <button 
              onClick={() => setShowReasons(!showReasons)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showReasons ? 'Hide' : 'Show'} Reasons
            </button>
          )}
        </div>
      </div>

      {/* Expandable Reasons */}
      {showReasons && result.reasonings && (
        <div className="border-t border-gray-700/50 p-4 space-y-3 bg-gray-900/50">
          {result.reasonings.map((reason, idx) => (
            <div key={idx} className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
              <p className="text-xs text-gray-400 leading-relaxed">{reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// BEST BETS SECTION
// ============================================================================

const BestBetsSection = ({ bets, homeTeam, awayTeam }: { 
  bets: BestBet[];
  homeTeam: string;
  awayTeam: string;
}) => {
  const getBetLabel = (type: string, selection: string) => {
    switch(type) {
      case 'MATCH_RESULT':
        if (selection === 'Home Win') return `${homeTeam} Win`;
        if (selection === 'Away Win') return `${awayTeam} Win`;
        return selection;
      case 'OVER_UNDER_25':
        return selection;
      case 'BTTS':
        return `BTTS ${selection}`;
      default:
        return selection;
    }
  };

  const getBetIcon = (type: string) => {
    switch(type) {
      case 'MATCH_RESULT': return Swords;
      case 'OVER_UNDER_25': return Target;
      case 'BTTS': return Zap;
      default: return Target;
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Target className="w-5 h-5 text-yellow-400" />
        Best Bets (Ranked)
      </h3>
      
      <div className="space-y-2">
        {bets.map((bet, idx) => {
          const Icon = getBetIcon(bet.type);
          return (
            <div 
              key={idx}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                idx === 0 
                  ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30' 
                  : 'bg-gray-800/50 border-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  idx === 0 ? 'bg-yellow-500/20' : 'bg-gray-700/50'
                }`}>
                  <span className={`font-bold ${idx === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    #{idx + 1}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${idx === 0 ? 'text-yellow-400' : 'text-gray-400'}`} />
                    <span className="font-bold text-white">{getBetLabel(bet.type, bet.selection)}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {bet.votes}/{bet.totalVotes} AI agree • {bet.weightedAgreement}% weight
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <ConsensusStrengthBadge strength={bet.consensusStrength} />
                <div className={`text-2xl font-bold ${
                  bet.confidence >= 70 ? 'text-green-400' : 
                  bet.confidence >= 55 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {bet.confidence}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AIBrainVisualization({ data, homeTeam, awayTeam }: AIBrainVisualizationProps) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const consensusPredictions = {
    matchResult: data.analysis.matchResult.prediction,
    overUnder25: data.analysis.overUnder25.prediction,
    btts: data.analysis.btts.prediction
  };

  const activeModels = Object.entries(data.aiStatus).filter(([_, s]) => s.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20 rounded-2xl border border-purple-500/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/25">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">AI Brain Analysis</h2>
              <p className="text-gray-400">v{data.brainVersion} • {activeModels}/4 Models Active</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <RiskLevelIndicator level={data.analysis.riskLevel} />
            <div className="text-right">
              <p className="text-xs text-gray-500">Analysis Time</p>
              <p className="font-mono text-green-400">{data.timing.total}</p>
            </div>
          </div>
        </div>

        {/* Match Header */}
        <div className="flex items-center justify-center gap-4 py-4">
          <span className="text-xl font-bold text-white">{homeTeam}</span>
          <span className="px-4 py-2 rounded-lg bg-gray-800/50 text-gray-400 font-bold">VS</span>
          <span className="text-xl font-bold text-white">{awayTeam}</span>
        </div>
      </div>

      {/* Consensus Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ConsensusCard 
          title="Match Result"
          result={data.analysis.matchResult}
          icon={Swords}
          iconColor="text-blue-400"
        />
        <ConsensusCard 
          title="Total Goals"
          result={data.analysis.overUnder25}
          icon={Target}
          iconColor="text-green-400"
        />
        <ConsensusCard 
          title="Both Teams Score"
          result={data.analysis.btts}
          icon={Zap}
          iconColor="text-yellow-400"
        />
      </div>

      {/* Best Bets */}
      <BestBetsSection 
        bets={data.analysis.bestBets} 
        homeTeam={homeTeam}
        awayTeam={awayTeam}
      />

      {/* AI Models */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          Individual AI Analysis
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(AI_MODELS).map(([key, _]) => (
            <AIModelCard
              key={key}
              modelKey={key}
              status={data.aiStatus[key as keyof typeof data.aiStatus]}
              analysis={data.individualAnalyses[key as keyof typeof data.individualAnalyses]}
              isExpanded={expandedModel === key}
              onToggle={() => setExpandedModel(expandedModel === key ? null : key)}
              consensusPredictions={consensusPredictions}
            />
          ))}
        </div>
      </div>

      {/* Conflict Warning */}
      {data.analysis.matchResult.votes < data.analysis.matchResult.totalVotes && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-yellow-400 mb-1">Conflicting Views Detected</h4>
              <p className="text-sm text-gray-400">
                AI models have different opinions on the match result. 
                {data.analysis.matchResult.votes}/{data.analysis.matchResult.totalVotes} models agree on {data.analysis.matchResult.prediction}.
                Consider the lower confidence when placing bets.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
