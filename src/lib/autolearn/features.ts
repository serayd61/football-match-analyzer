// ============================================================================
// AUTOLEARN AGENT - Feature Extraction
// Agent output'larini model input'larina cevirir
// Her katman icin gerekli feature'lari cikarir
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface AgentPrediction {
  prediction: string;
  confidence: number;
  reasoning?: string;
}

export interface AgentPredictions {
  stats?: {
    matchResult?: string;
    matchResultConfidence?: number;
    overUnder?: string;
    overUnderConfidence?: number;
    btts?: string;
    bttsConfidence?: number;
    [key: string]: any;
  };
  odds?: {
    matchWinnerValue?: string;
    recommendation?: string;
    overUnderValue?: string;
    bttsValue?: string;
    confidence?: number;
    [key: string]: any;
  };
  deepAnalysis?: {
    predicted_outcome?: { most_likely_result?: string };
    betting_insights?: {
      over_2_5_goals?: { recommendation?: string };
      both_teams_to_score?: { recommendation?: string };
    };
    [key: string]: any;
  };
  masterStrategist?: {
    model_probs?: Record<string, number>;
    final?: {
      primary_pick?: { market?: string; selection?: string; confidence?: number };
    };
    weightedAnalysis?: {
      finalProbabilities?: Record<string, number>;
    };
    [key: string]: any;
  };
  smart?: {
    matchResult?: string;
    overUnder?: string;
    btts?: string;
    confidence?: number;
    [key: string]: any;
  };
  genius?: {
    matchResult?: string;
    overUnder?: string;
    btts?: string;
    confidence?: number;
    [key: string]: any;
  };
  // Consensus (son tahmin)
  consensus?: {
    matchResult?: { prediction: string; confidence: number };
    overUnder?: { prediction: string; confidence: number };
    btts?: { prediction: string; confidence: number };
  };
}

export interface MatchContext {
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  agreement?: number;
  riskLevel?: string;
  dataQuality?: string;
  overallConfidence?: number;
}

export interface MarketFeatures {
  prediction: string;
  confidence: number;
  confRange: string;

  // Agent agreement
  agentAgreement: 'strong' | 'majority' | 'weak' | 'unknown';
  agreeCount: number;
  totalAgents: number;
  agreeingAgents: string[];
  disagreeingAgents: string[];

  // Per-agent predictions
  agentPredictions: Record<string, string>;

  // Meta features
  agreement: number;
  riskLevel: string;
  dataQuality: string;
  overallConfidence: number;

  // Context
  league: string;
}

export interface ExtractedFeatures {
  mr: MarketFeatures | null;
  ou: MarketFeatures | null;
  btts: MarketFeatures | null;
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

function normalizeMR(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === '1' || v === 'home' || v.includes('home')) return '1';
  if (v === '2' || v === 'away' || v.includes('away')) return '2';
  if (v === 'x' || v === 'draw' || v.includes('draw')) return 'X';
  return v;
}

function normalizeOU(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst') || v === 'o') return 'Over';
  if (v.includes('under') || v.includes('alt') || v === 'u') return 'Under';
  return v;
}

function normalizeBTTS(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var' || v === 'y') return 'Yes';
  if (v === 'no' || v === 'hayır' || v === 'yok' || v === 'n') return 'No';
  return v;
}

function getConfRange(conf: number): string {
  const start = Math.floor(conf / 5) * 5;
  return `${start}-${start + 4}`;
}

// ============================================================================
// EXTRACT FEATURES
// ============================================================================

export function extractFeatures(
  agents: AgentPredictions,
  context: MatchContext
): ExtractedFeatures {
  return {
    mr: extractMarketFeatures('mr', agents, context),
    ou: extractMarketFeatures('ou', agents, context),
    btts: extractMarketFeatures('btts', agents, context)
  };
}

function extractMarketFeatures(
  market: 'mr' | 'ou' | 'btts',
  agents: AgentPredictions,
  context: MatchContext
): MarketFeatures | null {
  // Consensus tahmini al
  let prediction = '';
  let confidence = 0;

  if (agents.consensus) {
    if (market === 'mr' && agents.consensus.matchResult) {
      prediction = normalizeMR(agents.consensus.matchResult.prediction);
      confidence = agents.consensus.matchResult.confidence;
    } else if (market === 'ou' && agents.consensus.overUnder) {
      prediction = normalizeOU(agents.consensus.overUnder.prediction);
      confidence = agents.consensus.overUnder.confidence;
    } else if (market === 'btts' && agents.consensus.btts) {
      prediction = normalizeBTTS(agents.consensus.btts.prediction);
      confidence = agents.consensus.btts.confidence;
    }
  }

  if (!prediction) return null;

  // Her ajanin bu market icin tahmini
  const agentPreds: Record<string, string> = {};

  // Stats Agent
  if (agents.stats) {
    if (market === 'mr') agentPreds['stats'] = normalizeMR(agents.stats.matchResult);
    if (market === 'ou') agentPreds['stats'] = normalizeOU(agents.stats.overUnder);
    if (market === 'btts') agentPreds['stats'] = normalizeBTTS(agents.stats.btts);
  }

  // Odds Agent
  if (agents.odds) {
    if (market === 'mr') agentPreds['odds'] = normalizeMR(agents.odds.matchWinnerValue || agents.odds.recommendation);
    if (market === 'ou') agentPreds['odds'] = normalizeOU(agents.odds.overUnderValue || agents.odds.recommendation);
    if (market === 'btts') agentPreds['odds'] = normalizeBTTS(agents.odds.bttsValue);
  }

  // Deep Analysis
  if (agents.deepAnalysis) {
    const deep = agents.deepAnalysis;
    if (market === 'mr') {
      const predicted = deep.predicted_outcome?.most_likely_result || '';
      if (predicted.toLowerCase().includes('home') || predicted.includes('1')) agentPreds['deep'] = '1';
      else if (predicted.toLowerCase().includes('away') || predicted.includes('2')) agentPreds['deep'] = '2';
      else if (predicted.toLowerCase().includes('draw')) agentPreds['deep'] = 'X';
    }
    if (market === 'ou') {
      const ouRec = deep.betting_insights?.over_2_5_goals?.recommendation || '';
      agentPreds['deep'] = ouRec.toLowerCase().includes('yes') || ouRec.toLowerCase().includes('over') ? 'Over' : 'Under';
    }
    if (market === 'btts') {
      const bttsRec = deep.betting_insights?.both_teams_to_score?.recommendation || '';
      agentPreds['deep'] = bttsRec.toLowerCase().includes('yes') ? 'Yes' : 'No';
    }
  }

  // Smart Analysis
  if (agents.smart) {
    if (market === 'mr') agentPreds['smart'] = normalizeMR(agents.smart.matchResult);
    if (market === 'ou') agentPreds['smart'] = normalizeOU(agents.smart.overUnder);
    if (market === 'btts') agentPreds['smart'] = normalizeBTTS(agents.smart.btts);
  }

  // Genius Analyst
  if (agents.genius) {
    if (market === 'mr') agentPreds['genius'] = normalizeMR(agents.genius.matchResult);
    if (market === 'ou') agentPreds['genius'] = normalizeOU(agents.genius.overUnder);
    if (market === 'btts') agentPreds['genius'] = normalizeBTTS(agents.genius.btts);
  }

  // Master Strategist
  if (agents.masterStrategist?.final?.primary_pick) {
    const ms = agents.masterStrategist.final.primary_pick;
    if (market === 'mr' && ms.market?.toLowerCase().includes('result')) {
      agentPreds['master'] = normalizeMR(ms.selection);
    }
    if (market === 'ou' && ms.market?.toLowerCase().includes('over')) {
      agentPreds['master'] = normalizeOU(ms.selection);
    }
    if (market === 'btts' && ms.market?.toLowerCase().includes('btts')) {
      agentPreds['master'] = normalizeBTTS(ms.selection);
    }
  }

  // Agreement hesapla
  const validPreds = Object.entries(agentPreds).filter(([_, v]) => v !== '');
  const agreeing = validPreds.filter(([_, v]) => v === prediction);
  const disagreeing = validPreds.filter(([_, v]) => v !== prediction);

  const agreeRatio = validPreds.length > 0 ? agreeing.length / validPreds.length : 0;
  let agentAgreement: 'strong' | 'majority' | 'weak' | 'unknown' = 'unknown';
  if (validPreds.length === 0) agentAgreement = 'unknown';
  else if (agreeRatio >= 0.75) agentAgreement = 'strong';
  else if (agreeRatio >= 0.5) agentAgreement = 'majority';
  else agentAgreement = 'weak';

  return {
    prediction,
    confidence,
    confRange: getConfRange(confidence),
    agentAgreement,
    agreeCount: agreeing.length,
    totalAgents: validPreds.length,
    agreeingAgents: agreeing.map(([name]) => name),
    disagreeingAgents: disagreeing.map(([name]) => name),
    agentPredictions: agentPreds,
    agreement: context.agreement || 0,
    riskLevel: context.riskLevel || 'medium',
    dataQuality: context.dataQuality || 'minimal',
    overallConfidence: context.overallConfidence || 0,
    league: context.league || 'unknown'
  };
}

// ============================================================================
// HELPER: Agent Predictions'i consensus analysis'ten extract et
// ============================================================================

export function extractAgentPredictionsFromAnalysis(analysis: any): AgentPredictions {
  const sources = analysis?.sources?.agents || {};
  const predictions = analysis?.predictions || {};

  return {
    stats: sources.stats || undefined,
    odds: sources.odds || undefined,
    deepAnalysis: sources.deepAnalysis || undefined,
    masterStrategist: sources.masterStrategist || undefined,
    smart: sources.smart || undefined,
    genius: sources.geniusAnalyst || undefined,
    consensus: predictions ? {
      matchResult: predictions.matchResult ? {
        prediction: predictions.matchResult.prediction,
        confidence: predictions.matchResult.confidence
      } : undefined,
      overUnder: predictions.overUnder ? {
        prediction: predictions.overUnder.prediction,
        confidence: predictions.overUnder.confidence
      } : undefined,
      btts: predictions.btts ? {
        prediction: predictions.btts.prediction,
        confidence: predictions.btts.confidence
      } : undefined
    } : undefined
  };
}

export function extractMatchContextFromAnalysis(analysis: any, match?: any): MatchContext {
  const systemPerformance = analysis?.systemPerformance || {};
  return {
    league: match?.league || '',
    homeTeam: match?.home_team || '',
    awayTeam: match?.away_team || '',
    agreement: systemPerformance.agreement || 0,
    riskLevel: systemPerformance.riskLevel || 'medium',
    dataQuality: systemPerformance.dataQuality || 'minimal',
    overallConfidence: systemPerformance.overallConfidence || 0
  };
}
