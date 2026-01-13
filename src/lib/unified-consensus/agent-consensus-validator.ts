// ============================================================================
// AGENT CONSENSUS VALIDATOR
// Agent'lar arası tutarlılık kontrolü ve conflict resolution
// ============================================================================

export interface AgentPrediction {
  agentName: string;
  matchResult?: '1' | 'X' | '2';
  overUnder?: 'Over' | 'Under';
  btts?: 'Yes' | 'No';
  confidence: number;
  weight: number;
  reasoning?: string;
}

export interface ConsensusValidation {
  isValid: boolean;
  agreement: number; // 0-100
  conflicts: Array<{
    field: string;
    agents: string[];
    predictions: string[];
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: Array<{
    field: string;
    action: 'use_consensus' | 'use_best_agent' | 'reduce_confidence' | 'flag_uncertain';
    reasoning: string;
  }>;
}

/**
 * Agent'ların tahminlerini analiz eder ve tutarlılık kontrolü yapar
 */
export function validateAgentConsensus(
  predictions: AgentPrediction[]
): ConsensusValidation {
  const validPredictions = predictions.filter(p => 
    p.matchResult || p.overUnder || p.btts
  );

  if (validPredictions.length < 2) {
    return {
      isValid: true,
      agreement: 100,
      conflicts: [],
      recommendations: []
    };
  }

  const conflicts: ConsensusValidation['conflicts'] = [];
  const recommendations: ConsensusValidation['recommendations'] = [];

  // Match Result tutarlılık kontrolü
  const mrPredictions = validPredictions
    .filter(p => p.matchResult)
    .map(p => ({ agent: p.agentName, prediction: p.matchResult!, confidence: p.confidence, weight: p.weight }));
  
  if (mrPredictions.length >= 2) {
    const uniquePredictions = new Set(mrPredictions.map(p => p.prediction));
    if (uniquePredictions.size > 1) {
      const predictionGroups = Array.from(uniquePredictions).map(pred => ({
        prediction: pred,
        agents: mrPredictions.filter(p => p.prediction === pred).map(p => p.agent),
        totalWeight: mrPredictions.filter(p => p.prediction === pred).reduce((sum, p) => sum + p.weight, 0),
        avgConfidence: mrPredictions.filter(p => p.prediction === pred).reduce((sum, p) => sum + p.confidence, 0) / mrPredictions.filter(p => p.prediction === pred).length
      }));

      const maxWeightGroup = predictionGroups.reduce((max, group) => 
        group.totalWeight > max.totalWeight ? group : max
      );

      const otherGroups = predictionGroups.filter(g => g !== maxWeightGroup);
      const totalDisagreement = otherGroups.reduce((sum, g) => sum + g.totalWeight, 0);
      const disagreementRatio = totalDisagreement / (maxWeightGroup.totalWeight + totalDisagreement);

      if (disagreementRatio > 0.3) { // %30'dan fazla anlaşmazlık
        conflicts.push({
          field: 'Match Result',
          agents: mrPredictions.map(p => p.agent),
          predictions: Array.from(uniquePredictions),
          severity: disagreementRatio > 0.5 ? 'high' : disagreementRatio > 0.4 ? 'medium' : 'low'
        });

        if (disagreementRatio > 0.5) {
          recommendations.push({
            field: 'Match Result',
            action: 'reduce_confidence',
            reasoning: `Yüksek anlaşmazlık (${Math.round(disagreementRatio * 100)}%). Agent'lar farklı sonuçlar öneriyor. Güven seviyesi düşürülmeli.`
          });
        } else {
          recommendations.push({
            field: 'Match Result',
            action: 'use_consensus',
            reasoning: `Orta seviye anlaşmazlık. Ağırlıklı konsensüs kullanılmalı (${maxWeightGroup.prediction} yönünde ${Math.round(maxWeightGroup.totalWeight)}% ağırlık).`
          });
        }
      }
    }
  }

  // Over/Under tutarlılık kontrolü
  const ouPredictions = validPredictions
    .filter(p => p.overUnder)
    .map(p => ({ agent: p.agentName, prediction: p.overUnder!, confidence: p.confidence, weight: p.weight }));
  
  if (ouPredictions.length >= 2) {
    const uniquePredictions = new Set(ouPredictions.map(p => p.prediction));
    if (uniquePredictions.size > 1) {
      const predictionGroups = Array.from(uniquePredictions).map(pred => ({
        prediction: pred,
        agents: ouPredictions.filter(p => p.prediction === pred).map(p => p.agent),
        totalWeight: ouPredictions.filter(p => p.prediction === pred).reduce((sum, p) => sum + p.weight, 0),
        avgConfidence: ouPredictions.filter(p => p.prediction === pred).reduce((sum, p) => sum + p.confidence, 0) / ouPredictions.filter(p => p.prediction === pred).length
      }));

      const maxWeightGroup = predictionGroups.reduce((max, group) => 
        group.totalWeight > max.totalWeight ? group : max
      );

      const otherGroups = predictionGroups.filter(g => g !== maxWeightGroup);
      const totalDisagreement = otherGroups.reduce((sum, g) => sum + g.totalWeight, 0);
      const disagreementRatio = totalDisagreement / (maxWeightGroup.totalWeight + totalDisagreement);

      if (disagreementRatio > 0.3) {
        conflicts.push({
          field: 'Over/Under',
          agents: ouPredictions.map(p => p.agent),
          predictions: Array.from(uniquePredictions),
          severity: disagreementRatio > 0.5 ? 'high' : disagreementRatio > 0.4 ? 'medium' : 'low'
        });

        if (disagreementRatio > 0.5) {
          recommendations.push({
            field: 'Over/Under',
            action: 'reduce_confidence',
            reasoning: `Yüksek anlaşmazlık (${Math.round(disagreementRatio * 100)}%). Agent'lar farklı sonuçlar öneriyor.`
          });
        } else {
          recommendations.push({
            field: 'Over/Under',
            action: 'use_consensus',
            reasoning: `Ağırlıklı konsensüs kullanılmalı (${maxWeightGroup.prediction} yönünde).`
          });
        }
      }
    }
  }

  // BTTS tutarlılık kontrolü
  const bttsPredictions = validPredictions
    .filter(p => p.btts)
    .map(p => ({ agent: p.agentName, prediction: p.btts!, confidence: p.confidence, weight: p.weight }));
  
  if (bttsPredictions.length >= 2) {
    const uniquePredictions = new Set(bttsPredictions.map(p => p.prediction));
    if (uniquePredictions.size > 1) {
      const predictionGroups = Array.from(uniquePredictions).map(pred => ({
        prediction: pred,
        agents: bttsPredictions.filter(p => p.prediction === pred).map(p => p.agent),
        totalWeight: bttsPredictions.filter(p => p.prediction === pred).reduce((sum, p) => sum + p.weight, 0),
        avgConfidence: bttsPredictions.filter(p => p.prediction === pred).reduce((sum, p) => sum + p.confidence, 0) / bttsPredictions.filter(p => p.prediction === pred).length
      }));

      const maxWeightGroup = predictionGroups.reduce((max, group) => 
        group.totalWeight > max.totalWeight ? group : max
      );

      const otherGroups = predictionGroups.filter(g => g !== maxWeightGroup);
      const totalDisagreement = otherGroups.reduce((sum, g) => sum + g.totalWeight, 0);
      const disagreementRatio = totalDisagreement / (maxWeightGroup.totalWeight + totalDisagreement);

      if (disagreementRatio > 0.3) {
        conflicts.push({
          field: 'BTTS',
          agents: bttsPredictions.map(p => p.agent),
          predictions: Array.from(uniquePredictions),
          severity: disagreementRatio > 0.5 ? 'high' : disagreementRatio > 0.4 ? 'medium' : 'low'
        });

        if (disagreementRatio > 0.5) {
          recommendations.push({
            field: 'BTTS',
            action: 'flag_uncertain',
            reasoning: `Yüksek anlaşmazlık (${Math.round(disagreementRatio * 100)}%). BTTS tahmini belirsiz.`
          });
        } else {
          recommendations.push({
            field: 'BTTS',
            action: 'use_consensus',
            reasoning: `Ağırlıklı konsensüs kullanılmalı (${maxWeightGroup.prediction} yönünde).`
          });
        }
      }
    }
  }

  // Agreement hesapla (tüm alanlar için)
  const totalFields = [mrPredictions, ouPredictions, bttsPredictions].filter(p => p.length > 0).length;
  const agreedFields = totalFields - conflicts.length;
  const agreement = totalFields > 0 ? Math.round((agreedFields / totalFields) * 100) : 100;

  return {
    isValid: conflicts.filter(c => c.severity === 'high').length === 0,
    agreement,
    conflicts,
    recommendations
  };
}

/**
 * Conflict'leri çözer ve düzeltilmiş tahminler döner
 */
export function resolveConflicts(
  predictions: AgentPrediction[],
  validation: ConsensusValidation
): {
  adjustedPredictions: AgentPrediction[];
  confidenceReduction: number; // 0-100, ne kadar confidence düşürülecek
} {
  const adjustedPredictions = [...predictions];
  let totalConfidenceReduction = 0;

  validation.conflicts.forEach(conflict => {
    if (conflict.severity === 'high') {
      // Yüksek seviye conflict: Confidence'i düşür
      const affectedAgents = adjustedPredictions.filter(p => 
        conflict.agents.includes(p.agentName)
      );
      
      affectedAgents.forEach(agent => {
        const originalConfidence = agent.confidence;
        agent.confidence = Math.max(20, agent.confidence - 15); // En az %20'ye düşür
        totalConfidenceReduction += originalConfidence - agent.confidence;
      });
    } else if (conflict.severity === 'medium') {
      // Orta seviye conflict: Hafif confidence düşür
      const affectedAgents = adjustedPredictions.filter(p => 
        conflict.agents.includes(p.agentName)
      );
      
      affectedAgents.forEach(agent => {
        const originalConfidence = agent.confidence;
        agent.confidence = Math.max(30, agent.confidence - 8);
        totalConfidenceReduction += originalConfidence - agent.confidence;
      });
    }
  });

  return {
    adjustedPredictions,
    confidenceReduction: totalConfidenceReduction / predictions.length
  };
}
