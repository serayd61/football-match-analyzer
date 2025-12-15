// AI Brain Components
// Export all components from a single entry point

export { default as AIBrainVisualization } from './AIBrainVisualization';
export { default as AIBrainLoading } from './AIBrainLoading';
export { default as AIBrainError } from './AIBrainError';
export { default as AIBrainContainer } from './AIBrainContainer';
export { default as AIBrainMini } from './AIBrainMini';

// Types
export interface AIBrainPrediction {
  matchResult: {
    prediction: string;
    confidence: number;
    votes: number;
    totalVotes: number;
    weightedAgreement: number;
    reasonings: string[];
  };
  overUnder25: {
    prediction: string;
    confidence: number;
    votes: number;
    totalVotes: number;
    weightedAgreement: number;
    reasonings: string[];
  };
  btts: {
    prediction: string;
    confidence: number;
    votes: number;
    totalVotes: number;
    weightedAgreement: number;
    reasonings: string[];
  };
  riskLevel: string;
  bestBets: Array<{
    type: string;
    selection: string;
    confidence: number;
    votes: number;
    totalVotes: number;
    weightedAgreement: number;
    consensusStrength: string;
  }>;
}

export interface AIBrainResponse {
  success: boolean;
  brainVersion: string;
  analysis: AIBrainPrediction;
  aiStatus: {
    claude: { active: boolean; role: string; weight: number };
    openai: { active: boolean; role: string; weight: number };
    gemini: { active: boolean; role: string; weight: number };
    perplexity: { active: boolean; role: string; weight: number };
  };
  individualAnalyses: Record<string, any>;
  timing: {
    total: string;
  };
}
