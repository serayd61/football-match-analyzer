import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen AGRESİF bir bahis strateji uzmanı ajanısın. Stats ve Odds agent analizlerini sentezle.

GÖREV: Diğer agentların analizlerini değerlendir ve EN İYİ STRATEJİYİ belirle.

AGRESİF KURALLAR:
- Agentlar hemfikirse YÜKSEK güven ver
- En az 2 agent aynı görüşteyse o bahsi öner
- Her öneride DETAYLI AÇIKLAMA yap
- Risk/ödül dengesini değerlendir

JSON DÖNDÜR:
{
  "riskAssessment": "Düşük/Orta/Yüksek",
  "riskReasoning": "🧠 Risk değerlendirmesi açıklaması",
  "recommendedBets": [
    {
      "type": "Over/Under 2.5",
      "selection": "Over",
      "confidence": 75,
      "reasoning": "🧠 Stats: Over (%X). Odds: Over değerli (+X%). 2/2 agent hemfikir → GÜÇLÜ SİNYAL"
    }
  ],
  "avoidBets": ["Kaçınılacak bahis ve nedeni"],
  "stakeSuggestion": "Düşük/Orta/Yüksek",
  "stakingReasoning": "Stake önerisi açıklaması",
  "overallStrategy": "Genel strateji özeti",
  "agentSummary": "🧠 STRATEGY AGENT: [final karar özeti - agentların konsensüsü]"
}`,

  en: `You are an AGGRESSIVE betting strategy expert agent. Synthesize Stats and Odds agent analyses.

TASK: Evaluate other agents' analyses and determine the BEST STRATEGY.

AGGRESSIVE RULES:
- If agents agree, give HIGH confidence
- If at least 2 agents agree, recommend that bet
- Give DETAILED EXPLANATION for each recommendation
- Evaluate risk/reward balance

RETURN JSON:
{
  "riskAssessment": "Low/Medium/High",
  "riskReasoning": "🧠 Risk assessment explanation",
  "recommendedBets": [
    {
      "type": "Over/Under 2.5",
      "selection": "Over",
      "confidence": 75,
      "reasoning": "🧠 Stats: Over (X%). Odds: Over value (+X%). 2/2 agents agree → STRONG SIGNAL"
    }
  ],
  "avoidBets": ["Bet to avoid and why"],
  "stakeSuggestion": "Low/Medium/High",
  "stakingReasoning": "Staking suggestion explanation",
  "overallStrategy": "Overall strategy summary",
  "agentSummary": "🧠 STRATEGY AGENT: [final decision summary - agent consensus]"
}`,

  de: `Du bist ein AGGRESSIVER Strategie-Experte. Synthetisiere die Analysen.

NUR JSON mit detaillierten Begründungen zurückgeben.`,
};

// ==================== CONSENSUS CALCULATOR ====================

function calculateConsensus(stats: any, odds: any): {
  overUnderConsensus: { prediction: string; agree: number; confidence: number; reasoning: string };
  matchResultConsensus: { prediction: string; agree: number; confidence: number; reasoning: string };
  bttsConsensus: { prediction: string; agree: number; confidence: number; reasoning: string };
} {
  // Over/Under consensus
  const statsOverUnder = stats?.overUnder?.toLowerCase() || '';
  const oddsOverUnder = odds?.recommendation?.toLowerCase() || '';
  
  const statsIsOver = statsOverUnder.includes('over') || statsOverUnder.includes('üst');
  const oddsIsOver = oddsOverUnder.includes('over') || oddsOverUnder.includes('üst');
  
  let overUnderAgree = 0;
  let overUnderPrediction = 'Over';
  
  if (statsIsOver && oddsIsOver) {
    overUnderAgree = 2;
    overUnderPrediction = 'Over';
  } else if (!statsIsOver && !oddsIsOver) {
    overUnderAgree = 2;
    overUnderPrediction = 'Under';
  } else {
    overUnderAgree = 1;
    // Take the one with higher confidence
    const statsConf = stats?.overUnderConfidence || stats?.confidence || 60;
    const oddsConf = odds?.confidence || 60;
    overUnderPrediction = statsConf > oddsConf ? (statsIsOver ? 'Over' : 'Under') : (oddsIsOver ? 'Over' : 'Under');
  }
  
  const statsOverConf = stats?.overUnderConfidence || stats?.confidence || 60;
  const oddsOverConf = odds?.confidence || 60;
  const overUnderConfidence = overUnderAgree === 2 
    ? Math.round((statsOverConf * 0.55 + oddsOverConf * 0.45) + 5) // Bonus for agreement
    : Math.round((statsOverConf * 0.55 + oddsOverConf * 0.45) - 5); // Penalty for disagreement
  
  const overUnderReasoning = overUnderAgree === 2
    ? `🧠 Stats: ${stats?.overUnder || 'N/A'} (%${statsOverConf}). Odds: ${odds?.recommendation || 'N/A'} (+${odds?._valueAnalysis?.overValue || 0}% value). 2/2 agent HEMFİKİR → GÜÇLÜ SİNYAL!`
    : `🧠 Stats: ${stats?.overUnder || 'N/A'}. Odds: ${odds?.recommendation || 'N/A'}. Agentlar FARKLI görüşte. Daha yüksek güvenli olan tercih edildi.`;
  
  // Match Result consensus
  const statsResult = (stats?.matchResult || '').toUpperCase();
  const oddsResult = (odds?.matchWinnerValue || '').toLowerCase();
  
  let statsMatchPred = 'X';
  if (statsResult.includes('1') || statsResult.includes('HOME')) statsMatchPred = '1';
  else if (statsResult.includes('2') || statsResult.includes('AWAY')) statsMatchPred = '2';
  
  let oddsMatchPred = 'X';
  if (oddsResult.includes('home') || oddsResult.includes('1')) oddsMatchPred = '1';
  else if (oddsResult.includes('away') || oddsResult.includes('2')) oddsMatchPred = '2';
  
  let matchResultAgree = 0;
  let matchResultPrediction = '1';
  
  if (statsMatchPred === oddsMatchPred) {
    matchResultAgree = 2;
    matchResultPrediction = statsMatchPred;
  } else {
    matchResultAgree = 1;
    const statsMatchConf = stats?.matchResultConfidence || stats?.confidence || 60;
    const oddsMatchConf = odds?.confidence || 60;
    matchResultPrediction = statsMatchConf > oddsMatchConf ? statsMatchPred : oddsMatchPred;
  }
  
  const statsMatchConf = stats?.matchResultConfidence || stats?.confidence || 60;
  const oddsMatchConf = odds?.confidence || 60;
  const matchResultConfidence = matchResultAgree === 2
    ? Math.round((statsMatchConf * 0.55 + oddsMatchConf * 0.45) + 5)
    : Math.round((statsMatchConf * 0.55 + oddsMatchConf * 0.45) - 5);
  
  const matchResultReasoning = matchResultAgree === 2
    ? `🧠 Stats: MS ${statsMatchPred} (%${statsMatchConf}). Odds: ${oddsMatchPred} (value: ${odds?._valueAnalysis?.homeValue || 0}%). 2/2 agent HEMFİKİR → GÜÇLÜ SİNYAL!`
    : `🧠 Stats: MS ${statsMatchPred}. Odds: ${oddsMatchPred}. Görüş ayrılığı var. Form analizi ağırlıklı tercih edildi.`;
  
  // BTTS consensus
  const statsBtts = (stats?.btts || '').toLowerCase();
  const oddsBtts = (odds?.bttsValue || '').toLowerCase();
  
  const statsIsBttsYes = statsBtts.includes('yes') || statsBtts.includes('var') || statsBtts.includes('evet');
  const oddsIsBttsYes = oddsBtts.includes('yes') || oddsBtts.includes('var');
  
  let bttsAgree = 0;
  let bttsPrediction = 'Yes';
  
  if (statsIsBttsYes && oddsIsBttsYes) {
    bttsAgree = 2;
    bttsPrediction = 'Yes';
  } else if (!statsIsBttsYes && !oddsIsBttsYes) {
    bttsAgree = 2;
    bttsPrediction = 'No';
  } else {
    bttsAgree = 1;
    const statsBttsConf = stats?.bttsConfidence || stats?.confidence || 60;
    const oddsBttsConf = odds?.confidence || 60;
    bttsPrediction = statsBttsConf > oddsBttsConf ? (statsIsBttsYes ? 'Yes' : 'No') : (oddsIsBttsYes ? 'Yes' : 'No');
  }
  
  const statsBttsConf = stats?.bttsConfidence || stats?.confidence || 60;
  const oddsBttsConf = odds?.confidence || 60;
  const bttsConfidence = bttsAgree === 2
    ? Math.round((statsBttsConf * 0.55 + oddsBttsConf * 0.45) + 5)
    : Math.round((statsBttsConf * 0.55 + oddsBttsConf * 0.45) - 5);
  
  const bttsReasoning = bttsAgree === 2
    ? `🧠 Stats: KG ${statsIsBttsYes ? 'Var' : 'Yok'} (%${statsBttsConf}). Odds: ${oddsIsBttsYes ? 'Yes' : 'No'} (value: ${odds?._valueAnalysis?.bttsValue || 0}%). 2/2 agent HEMFİKİR!`
    : `🧠 Stats: KG ${statsIsBttsYes ? 'Var' : 'Yok'}. Odds: ${oddsIsBttsYes ? 'Yes' : 'No'}. Görüş farklı. İstatistik ağırlıklı tercih.`;
  
  return {
    overUnderConsensus: {
      prediction: overUnderPrediction,
      agree: overUnderAgree,
      confidence: Math.min(83, Math.max(50, overUnderConfidence)),
      reasoning: overUnderReasoning,
    },
    matchResultConsensus: {
      prediction: matchResultPrediction,
      agree: matchResultAgree,
      confidence: Math.min(80, Math.max(48, matchResultConfidence)),
      reasoning: matchResultReasoning,
    },
    bttsConsensus: {
      prediction: bttsPrediction,
      agree: bttsAgree,
      confidence: Math.min(82, Math.max(50, bttsConfidence)),
      reasoning: bttsReasoning,
    },
  };
}

// ==================== STRATEGY AGENT ====================

export async function runStrategyAgent(
  matchData: MatchData,
  previousReports: { scout?: any; stats?: any; odds?: any },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('🧠 Strategy Agent starting AGGRESSIVE synthesis...');
  
  const { stats, odds } = previousReports;
  
  // Calculate consensus
  const consensus = calculateConsensus(stats, odds);
  
  // Find best bet (highest agreement + confidence)
  const allBets = [
    { 
      type: 'Over/Under 2.5', 
      selection: consensus.overUnderConsensus.prediction,
      agree: consensus.overUnderConsensus.agree,
      confidence: consensus.overUnderConsensus.confidence,
      reasoning: consensus.overUnderConsensus.reasoning,
      score: consensus.overUnderConsensus.agree * 30 + consensus.overUnderConsensus.confidence,
    },
    { 
      type: 'Match Result', 
      selection: `MS ${consensus.matchResultConsensus.prediction}`,
      agree: consensus.matchResultConsensus.agree,
      confidence: consensus.matchResultConsensus.confidence,
      reasoning: consensus.matchResultConsensus.reasoning,
      score: consensus.matchResultConsensus.agree * 30 + consensus.matchResultConsensus.confidence,
    },
    { 
      type: 'BTTS', 
      selection: consensus.bttsConsensus.prediction === 'Yes' ? 'KG Var' : 'KG Yok',
      agree: consensus.bttsConsensus.agree,
      confidence: consensus.bttsConsensus.confidence,
      reasoning: consensus.bttsConsensus.reasoning,
      score: consensus.bttsConsensus.agree * 30 + consensus.bttsConsensus.confidence,
    },
  ];
  
  // Sort by score (agreement * 30 + confidence)
  allBets.sort((a, b) => b.score - a.score);
  
  // Risk assessment
  const totalAgree = consensus.overUnderConsensus.agree + consensus.matchResultConsensus.agree + consensus.bttsConsensus.agree;
  const avgConfidence = Math.round((consensus.overUnderConsensus.confidence + consensus.matchResultConsensus.confidence + consensus.bttsConsensus.confidence) / 3);
  
  let riskAssessment = 'Medium';
  let stakeSuggestion = 'Medium';
  
  if (totalAgree >= 5 && avgConfidence >= 70) {
    riskAssessment = 'Low';
    stakeSuggestion = 'High';
  } else if (totalAgree >= 4 && avgConfidence >= 65) {
    riskAssessment = 'Low';
    stakeSuggestion = 'Medium';
  } else if (totalAgree <= 3 || avgConfidence < 55) {
    riskAssessment = 'High';
    stakeSuggestion = 'Low';
  }
  
  // Generate agent summary
  const agentSummaryTr = `🧠 STRATEGY: ${allBets[0].agree === 2 ? 'GÜÇLÜ KONSENSÜS' : 'ZAYIF KONSENSÜS'}! En iyi: ${allBets[0].type} - ${allBets[0].selection} (%${allBets[0].confidence}). ${totalAgree}/6 toplam uyum. Risk: ${riskAssessment}.`;
  const agentSummaryEn = `🧠 STRATEGY: ${allBets[0].agree === 2 ? 'STRONG CONSENSUS' : 'WEAK CONSENSUS'}! Best: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].confidence}%). ${totalAgree}/6 total agreement. Risk: ${riskAssessment}.`;
  
  const agentSummary = language === 'tr' ? agentSummaryTr : agentSummaryEn;

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

═══════════════════════════════════════════════════════════════
📊 STATS AGENT ANALYSIS
═══════════════════════════════════════════════════════════════
Over/Under: ${stats?.overUnder || 'N/A'} (${stats?.overUnderConfidence || stats?.confidence || '?'}%)
Reasoning: ${stats?.overUnderReasoning || 'N/A'}

Match Result: MS ${stats?.matchResult || 'N/A'} (${stats?.matchResultConfidence || stats?.confidence || '?'}%)
Reasoning: ${stats?.matchResultReasoning || 'N/A'}

BTTS: ${stats?.btts || 'N/A'} (${stats?.bttsConfidence || stats?.confidence || '?'}%)
Reasoning: ${stats?.bttsReasoning || 'N/A'}

Summary: ${stats?.agentSummary || 'N/A'}

═══════════════════════════════════════════════════════════════
💰 ODDS AGENT ANALYSIS
═══════════════════════════════════════════════════════════════
Over/Under: ${odds?.recommendation || 'N/A'} (${odds?.confidence || '?'}%)
Reasoning: ${odds?.recommendationReasoning || 'N/A'}

Match Winner Value: ${odds?.matchWinnerValue || 'N/A'}
Reasoning: ${odds?.matchWinnerReasoning || 'N/A'}

BTTS Value: ${odds?.bttsValue || 'N/A'}
Reasoning: ${odds?.bttsReasoning || 'N/A'}

Value Bets: ${odds?.valueBets?.join(', ') || 'None'}
Summary: ${odds?.agentSummary || 'N/A'}

═══════════════════════════════════════════════════════════════
🎯 CONSENSUS ANALYSIS (MY CALCULATION)
═══════════════════════════════════════════════════════════════
Over/Under: ${consensus.overUnderConsensus.prediction} | Agree: ${consensus.overUnderConsensus.agree}/2 | Conf: ${consensus.overUnderConsensus.confidence}%
Match Result: MS ${consensus.matchResultConsensus.prediction} | Agree: ${consensus.matchResultConsensus.agree}/2 | Conf: ${consensus.matchResultConsensus.confidence}%
BTTS: ${consensus.bttsConsensus.prediction} | Agree: ${consensus.bttsConsensus.agree}/2 | Conf: ${consensus.bttsConsensus.confidence}%

BEST BET: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].confidence}%, ${allBets[0].agree}/2 agree)
TOTAL AGREEMENT: ${totalAgree}/6
AVERAGE CONFIDENCE: ${avgConfidence}%
RISK LEVEL: ${riskAssessment}

BE AGGRESSIVE! Synthesize and recommend the best strategy. Return JSON:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PROMPTS[language] || PROMPTS.en },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await heurist.chat(messages, { temperature: 0.3, maxTokens: 1000 });
    
    if (response) {
      const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').replace(/\*\*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Enhance with calculated values
        if (!parsed.agentSummary) {
          parsed.agentSummary = agentSummary;
        }
        
        // Ensure recommendedBets has proper structure
        if (!parsed.recommendedBets || parsed.recommendedBets.length === 0) {
          parsed.recommendedBets = allBets.filter(b => b.agree >= 1).map(b => ({
            type: b.type,
            selection: b.selection,
            confidence: b.confidence,
            reasoning: b.reasoning,
            agentAgreement: `${b.agree}/2`,
          }));
        } else {
          // Add reasoning to existing bets if missing
          parsed.recommendedBets = parsed.recommendedBets.map((bet: any, index: number) => {
            if (!bet.reasoning || bet.reasoning.length < 20) {
              bet.reasoning = allBets[index]?.reasoning || bet.reasoning;
            }
            bet.agentAgreement = allBets.find(b => b.type === bet.type)?.agree + '/2' || '1/2';
            return bet;
          });
        }
        
        // Add consensus data
        parsed._consensus = consensus;
        parsed._bestBet = allBets[0];
        parsed._totalAgreement = totalAgree;
        parsed._avgConfidence = avgConfidence;
        
        console.log(`✅ Strategy Agent: Best=${allBets[0].type} ${allBets[0].selection} | Risk=${riskAssessment} | Agree=${totalAgree}/6`);
        console.log(`   📝 Summary: ${parsed.agentSummary}`);
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ Strategy agent error:', error);
  }

  // Fallback with calculated values
  const fallbackResult = {
    riskAssessment,
    riskReasoning: language === 'tr' 
      ? `🧠 ${totalAgree}/6 agent uyumu. Ortalama güven %${avgConfidence}. ${riskAssessment === 'Low' ? 'Güvenli bahis ortamı.' : riskAssessment === 'High' ? 'Dikkatli olunmalı.' : 'Normal risk seviyesi.'}`
      : `🧠 ${totalAgree}/6 agent agreement. Average confidence ${avgConfidence}%. ${riskAssessment === 'Low' ? 'Safe betting environment.' : riskAssessment === 'High' ? 'Caution advised.' : 'Normal risk level.'}`,
    recommendedBets: allBets.filter(b => b.agree >= 1).map(b => ({
      type: b.type,
      selection: b.selection,
      confidence: b.confidence,
      reasoning: b.reasoning,
      agentAgreement: `${b.agree}/2`,
    })),
    avoidBets: allBets.filter(b => b.agree === 1 && b.confidence < 55).map(b => 
      language === 'tr' ? `${b.type} - Agentlar hemfikir değil` : `${b.type} - Agents disagree`
    ),
    stakeSuggestion,
    stakingReasoning: language === 'tr'
      ? `${stakeSuggestion === 'High' ? 'Yüksek uyum, agresif stake önerilir.' : stakeSuggestion === 'Low' ? 'Düşük uyum, küçük stake önerilir.' : 'Normal stake önerilir.'}`
      : `${stakeSuggestion === 'High' ? 'High agreement, aggressive stake recommended.' : stakeSuggestion === 'Low' ? 'Low agreement, small stake recommended.' : 'Normal stake recommended.'}`,
    overallStrategy: language === 'tr'
      ? `En güvenli: ${allBets[0].type} - ${allBets[0].selection}. ${allBets[0].agree === 2 ? '2 agent hemfikir!' : 'Tek agent desteği.'}`
      : `Safest: ${allBets[0].type} - ${allBets[0].selection}. ${allBets[0].agree === 2 ? '2 agents agree!' : 'Single agent support.'}`,
    agentSummary,
    _consensus: consensus,
    _bestBet: allBets[0],
    _totalAgreement: totalAgree,
    _avgConfidence: avgConfidence,
  };
  
  console.log(`⚠️ Strategy Agent Fallback: Best=${allBets[0].type} ${allBets[0].selection} | Risk=${riskAssessment}`);
  console.log(`   📝 Summary: ${fallbackResult.agentSummary}`);
  return fallbackResult;
}
