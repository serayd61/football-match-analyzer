// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - MAIN EXPORTS
// 4 AI Model Consensus Architecture for Football Predictions
// ============================================================================

// Types
export * from './types';

// Configuration
export * from './config';

// Main Engine
export { runQuadBrainAnalysis } from './engine';

// Debate Protocol
export { detectConflicts, runDebate, runBatchDebates } from './debate';

// Dynamic Weighting
export { 
  assessDataQuality, 
  calculateDynamicWeights, 
  applyWeights,
  formatWeightsSummary,
  formatDataQualitySummary
} from './weighting';

// Performance Tracking
export {
  recordPrediction,
  settlePrediction,
  getModelPerformance,
  getAllModelPerformance,
  getDailyStats,
  formatPerformanceReport,
  DATABASE_SCHEMA
} from './tracking';

// News Integration
export {
  fetchNewsContext,
  quickInjuryCheck,
  searchWithPerplexity
} from './news';

// Version
export const QUAD_BRAIN_VERSION = '2.0.0';

