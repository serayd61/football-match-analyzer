import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen AGRESİF bir bahis strateji uzmanı ajanısın. DeepAnalysis, Stats ve Odds agent analizlerini sentezle.

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

  en: `You are an AGGRESSIVE betting strategy expert agent. Synthesize DeepAnalysis, Stats and Odds agent analyses.

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

function calculateConsensus(deepAnalysis: any, stats: any, odds: any): {
  overUnderConsensus: { prediction: string; agree: number; confidence: number; reasoning: string };
  matchResultConsensus: { prediction: string; agree: number; confidence: number; reasoning: string };
  bttsConsensus: { prediction: string; agree: number; confidence: number; reasoning: string };
} {
  // Over/Under consensus - now includes deepAnalysis
  const deepOverUnder = deepAnalysis?.overUnder?.prediction?.toLowerCase() || '';
  const statsOverUnder = stats?.overUnder?.toLowerCase() || '';
  const oddsOverUnder = odds?.recommendation?.toLowerCase() || '';
  
  const deepIsOver = deepOverUnder.includes('over') || deepOverUnder.includes('üst');
  const statsIsOver = statsOverUnder.includes('over') || statsOverUnder.includes('üst');
  const oddsIsOver = oddsOverUnder.includes('over') || oddsOverUnder.includes('üst');
  
  let overUnderAgree = 0;
  let overUnderPrediction = 'Over';
  
  // Count agreements
  const overVotes = [deepIsOver, statsIsOver, oddsIsOver].filter(Boolean).length;
  const underVotes = 3 - overVotes;
  
  if (overVotes >= 2) {
    overUnderAgree = overVotes;
    overUnderPrediction = 'Over';
  } else if (underVotes >= 2) {
    overUnderAgree = underVotes;
    overUnderPrediction = 'Under';
  } else {
    overUnderAgree = 1;
    // Take deepAnalysis as tiebreaker
    overUnderPrediction = deepIsOver ? 'Over' : 'Under';
  }
  
  const deepOverConf = deepAnalysis?.overUnder?.confidence || 60;
  const statsOverConf = stats?.overUnderConfidence || stats?.confidence || 60;
  const oddsOverConf = odds?.confidence || 60;
  
  // Weight: DeepAnalysis 40%, Stats 35%, Odds 25%
  const baseConfidence = deepOverConf * 0.40 + statsOverConf * 0.35 + oddsOverConf * 0.25;
  const overUnderConfidence = overUnderAgree >= 2 
    ? Math.round(baseConfidence + (overUnderAgree - 1) * 3) // Bonus for agreement
    : Math.round(baseConfidence - 5); // Penalty for disagreement
  
  const overUnderReasoning = overUnderAgree >= 2
    ? `🧠 DeepAnalysis: ${deepAnalysis?.overUnder?.prediction || 'N/A'} (%${deepOverConf}). Stats: ${stats?.overUnder || 'N/A'} (%${statsOverConf}). Odds: ${odds?.recommendation || 'N/A'}. ${overUnderAgree}/3 agent HEMFİKİR → GÜÇLÜ SİNYAL!`
    : `🧠 DeepAnalysis: ${deepAnalysis?.overUnder?.prediction || 'N/A'}. Stats: ${stats?.overUnder || 'N/A'}. Odds: ${odds?.recommendation || 'N/A'}. Agentlar FARKLI görüşte. DeepAnalysis tercih edildi.`;
  
  // Match Result consensus
  const deepResult = (deepAnalysis?.matchResult?.prediction || '').toUpperCase();
  const statsResult = (stats?.matchResult || '').toUpperCase();
  const oddsResult = (odds?.matchWinnerValue || '').toLowerCase();
  
  let deepMatchPred = 'X';
  if (deepResult.includes('1') || deepResult.includes('HOME')) deepMatchPred = '1';
  else if (deepResult.includes('2') || deepResult.includes('AWAY')) deepMatchPred = '2';
  
  let statsMatchPred = 'X';
  if (statsResult.includes('1') || statsResult.includes('HOME')) statsMatchPred = '1';
  else if (statsResult.includes('2') || statsResult.includes('AWAY')) statsMatchPred = '2';
  
  let oddsMatchPred = 'X';
  if (oddsResult.includes('home') || oddsResult.includes('1')) oddsMatchPred = '1';
  else if (oddsResult.includes('away') || oddsResult.includes('2')) oddsMatchPred = '2';
  
  // Count match result votes
  const matchVotes: Record<string, number> = { '1': 0, 'X': 0, '2': 0 };
  matchVotes[deepMatchPred]++;
  matchVotes[statsMatchPred]++;
  matchVotes[oddsMatchPred]++;
  
  const maxVotes = Math.max(matchVotes['1'], matchVotes['X'], matchVotes['2']);
  let matchResultPrediction = '1';
  if (matchVotes['X'] === maxVotes) matchResultPrediction = 'X';
  else if (matchVotes['2'] === maxVotes) matchResultPrediction = '2';
  else if (matchVotes['1'] === maxVotes) matchResultPrediction = '1';
  
  const matchResultAgree = maxVotes;
  
  const deepMatchConf = deepAnalysis?.matchResult?.confidence || 55;
  const statsMatchConf = stats?.matchResultConfidence || stats?.confidence || 60;
  const oddsMatchConf = odds?.confidence || 60;
  
  const baseMatchConf = deepMatchConf * 0.40 + statsMatchConf * 0.35 + oddsMatchConf * 0.25;
  const matchResultConfidence = matchResultAgree >= 2
    ? Math.round(baseMatchConf + (matchResultAgree - 1) * 3)
    : Math.round(baseMatchConf - 5);
  
  const matchResultReasoning = matchResultAgree >= 2
    ? `🧠 DeepAnalysis: MS ${deepMatchPred} (%${deepMatchConf}). Stats: MS ${statsMatchPred} (%${statsMatchConf}). Odds: ${oddsMatchPred}. ${matchResultAgree}/3 agent HEMFİKİR!`
    : `🧠 DeepAnalysis: MS ${deepMatchPred}. Stats: MS ${statsMatchPred}. Odds: ${oddsMatchPred}. Görüş ayrılığı var. DeepAnalysis tercih edildi.`;
  
  // BTTS consensus
  const deepBtts = (deepAnalysis?.btts?.prediction || '').toLowerCase();
  const statsBtts = (stats?.btts || '').toLowerCase();
  const oddsBtts = (odds?.bttsValue || '').toLowerCase();
  
  const deepIsBttsYes = deepBtts.includes('yes') || deepBtts.includes('var') || deepBtts.includes('evet');
  const statsIsBttsYes = statsBtts.includes('yes') || statsBtts.includes('var') || statsBtts.includes('evet');
  const oddsIsBttsYes = oddsBtts.includes('yes') || oddsBtts.includes('var');
  
  const bttsYesVotes = [deepIsBttsYes, statsIsBttsYes, oddsIsBttsYes].filter(Boolean).length;
  const bttsNoVotes = 3 - bttsYesVotes;
  
  let bttsAgree = 0;
  let bttsPrediction = 'Yes';
  
  if (bttsYesVotes >= 2) {
    bttsAgree = bttsYesVotes;
    bttsPrediction = 'Yes';
  } else if (bttsNoVotes >= 2) {
    bttsAgree = bttsNoVotes;
    bttsPrediction = 'No';
  } else {
    bttsAgree = 1;
    bttsPrediction = deepIsBttsYes ? 'Yes' : 'No';
  }
  
  const deepBttsConf = deepAnalysis?.btts?.confidence || 60;
  const statsBttsConf = stats?.bttsConfidence || stats?.confidence || 60;
  const oddsBttsConf = odds?.confidence || 60;
  
  const baseBttsConf = deepBttsConf * 0.40 + statsBttsConf * 0.35 + oddsBttsConf * 0.25;
  const bttsConfidence = bttsAgree >= 2
    ? Math.round(baseBttsConf + (bttsAgree - 1) * 3)
    : Math.round(baseBttsConf - 5);
  
  const bttsReasoning = bttsAgree >= 2
    ? `🧠 DeepAnalysis: KG ${deepIsBttsYes ? 'Var' : 'Yok'} (%${deepBttsConf}). Stats: ${statsIsBttsYes ? 'Var' : 'Yok'} (%${statsBttsConf}). Odds: ${oddsIsBttsYes ? 'Yes' : 'No'}. ${bttsAgree}/3 agent HEMFİKİR!`
    : `🧠 DeepAnalysis: KG ${deepIsBttsYes ? 'Var' : 'Yok'}. Stats: ${statsIsBttsYes ? 'Var' : 'Yok'}. Odds: ${oddsIsBttsYes ? 'Yes' : 'No'}. Görüş farklı. DeepAnalysis tercih edildi.`;
  
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
  previousReports: { deepAnalysis?: any; stats?: any; odds?: any },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('🧠 Strategy Agent starting AGGRESSIVE synthesis...');
  
  const { deepAnalysis, stats, odds } = previousReports;
  
  // Calculate consensus with 3 agents
  const consensus = calculateConsensus(deepAnalysis, stats, odds);
  
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
  
  // Risk assessment - now based on 3 agents (max 9 agreement)
  const totalAgree = consensus.overUnderConsensus.agree + consensus.matchResultConsensus.agree + consensus.bttsConsensus.agree;
  const avgConfidence = Math.round((consensus.overUnderConsensus.confidence + consensus.matchResultConsensus.confidence + consensus.bttsConsensus.confidence) / 3);
  
  let riskAssessment = 'Medium';
  let stakeSuggestion = 'Medium';
  
  if (totalAgree >= 7 && avgConfidence >= 70) {
    riskAssessment = 'Low';
    stakeSuggestion = 'High';
  } else if (totalAgree >= 6 && avgConfidence >= 65) {
    riskAssessment = 'Low';
    stakeSuggestion = 'Medium';
  } else if (totalAgree <= 4 || avgConfidence < 55) {
    riskAssessment = 'High';
    stakeSuggestion = 'Low';
  }
  
  // Generate agent summary
  const agentSummaryTr = `🧠 STRATEGY: ${allBets[0].agree >= 2 ? 'GÜÇLÜ KONSENSÜS' : 'ZAYIF KONSENSÜS'}! En iyi: ${allBets[0].type} - ${allBets[0].selection} (%${allBets[0].confidence}). ${totalAgree}/9 toplam uyum. Risk: ${riskAssessment}.`;
  const agentSummaryEn = `🧠 STRATEGY: ${allBets[0].agree >= 2 ? 'STRONG CONSENSUS' : 'WEAK CONSENSUS'}! Best: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].confidence}%). ${totalAgree}/9 total agreement. Risk: ${riskAssessment}.`;
  
  const agentSummary = language === 'tr' ? agentSummaryTr : agentSummaryEn;

  const userPrompt = `MATCH: ${matchData.homeTeam} vs ${matchData.awayTeam}

═══════════════════════════════════════════════════════════════
🔬 DEEP ANALYSIS AGENT
═══════════════════════════════════════════════════════════════
Best Bet: ${deepAnalysis?.bestBet?.type || 'N/A'} - ${deepAnalysis?.bestBet?.selection || 'N/A'} (${deepAnalysis?.bestBet?.confidence || '?'}%)
Over/Under: ${deepAnalysis?.overUnder?.prediction || 'N/A'} (${deepAnalysis?.overUnder?.confidence || '?'}%)
Match Result: MS ${deepAnalysis?.matchResult?.prediction || 'N/A'} (${deepAnalysis?.matchResult?.confidence || '?'}%)
BTTS: ${deepAnalysis?.btts?.prediction || 'N/A'} (${deepAnalysis?.btts?.confidence || '?'}%)
Score Prediction: ${deepAnalysis?.scorePrediction?.score || 'N/A'}
Risk Level: ${deepAnalysis?.riskLevel || 'N/A'}
Summary: ${deepAnalysis?.agentSummary || 'N/A'}

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
🎯 CONSENSUS ANALYSIS (3 AGENTS)
═══════════════════════════════════════════════════════════════
Over/Under: ${consensus.overUnderConsensus.prediction} | Agree: ${consensus.overUnderConsensus.agree}/3 | Conf: ${consensus.overUnderConsensus.confidence}%
Match Result: MS ${consensus.matchResultConsensus.prediction} | Agree: ${consensus.matchResultConsensus.agree}/3 | Conf: ${consensus.matchResultConsensus.confidence}%
BTTS: ${consensus.bttsConsensus.prediction} | Agree: ${consensus.bttsConsensus.agree}/3 | Conf: ${consensus.bttsConsensus.confidence}%

BEST BET: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].confidence}%, ${allBets[0].agree}/3 agree)
TOTAL AGREEMENT: ${totalAgree}/9
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
            agentAgreement: `${b.agree}/3`,
          }));
        } else {
          // Add reasoning to existing bets if missing
          parsed.recommendedBets = parsed.recommendedBets.map((bet: any, index: number) => {
            if (!bet.reasoning || bet.reasoning.length < 20) {
              bet.reasoning = allBets[index]?.reasoning || bet.reasoning;
            }
            bet.agentAgreement = allBets.find(b => b.type === bet.type)?.agree + '/3' || '1/3';
            return bet;
          });
        }
        
        // Add consensus data
        parsed._consensus = consensus;
        parsed._bestBet = allBets[0];
        parsed._totalAgreement = totalAgree;
        parsed._avgConfidence = avgConfidence;
        
        console.log(`✅ Strategy Agent: Best=${allBets[0].type} ${allBets[0].selection} | Risk=${riskAssessment} | Agree=${totalAgree}/9`);
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
      ? `🧠 ${totalAgree}/9 agent uyumu. Ortalama güven %${avgConfidence}. ${riskAssessment === 'Low' ? 'Güvenli bahis ortamı.' : riskAssessment === 'High' ? 'Dikkatli olunmalı.' : 'Normal risk seviyesi.'}`
      : `🧠 ${totalAgree}/9 agent agreement. Average confidence ${avgConfidence}%. ${riskAssessment === 'Low' ? 'Safe betting environment.' : riskAssessment === 'High' ? 'Caution advised.' : 'Normal risk level.'}`,
    recommendedBets: allBets.filter(b => b.agree >= 1).map(b => ({
      type: b.type,
      selection: b.selection,
      confidence: b.confidence,
      reasoning: b.reasoning,
      agentAgreement: `${b.agree}/3`,
    })),
    avoidBets: allBets.filter(b => b.agree === 1 && b.confidence < 55).map(b => 
      language === 'tr' ? `${b.type} - Agentlar hemfikir değil` : `${b.type} - Agents disagree`
    ),
    stakeSuggestion,
    stakingReasoning: language === 'tr'
      ? `${stakeSuggestion === 'High' ? 'Yüksek uyum, agresif stake önerilir.' : stakeSuggestion === 'Low' ? 'Düşük uyum, küçük stake önerilir.' : 'Normal stake önerilir.'}`
      : `${stakeSuggestion === 'High' ? 'High agreement, aggressive stake recommended.' : stakeSuggestion === 'Low' ? 'Low agreement, small stake recommended.' : 'Normal stake recommended.'}`,
    overallStrategy: language === 'tr'
      ? `En güvenli: ${allBets[0].type} - ${allBets[0].selection}. ${allBets[0].agree >= 2 ? `${allBets[0].agree} agent hemfikir!` : 'Tek agent desteği.'}`
      : `Safest: ${allBets[0].type} - ${allBets[0].selection}. ${allBets[0].agree >= 2 ? `${allBets[0].agree} agents agree!` : 'Single agent support.'}`,
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
