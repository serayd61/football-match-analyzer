// src/lib/heurist/agents/masterStrategist.ts
// 🧠 MASTER STRATEGIST AGENT - Diğer agent'ları yöneten, tutarsızlıkları tespit eden ve konsensüsü güçlendiren üst-akıl

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { AgentResult } from '../orchestrator';
import { getLearningContext } from '../../ai-brain/learning-context';

const MASTER_STRATEGIST_PROMPT = {
  tr: `Sen bir çok-agent futbol maç analiz sisteminin MASTER STRATEGIST'isin.

═══════════════════════════════════════════════════════════════════════════════
🎯 YENİ ANALİZ FELSEFESİ: %50 VERİ + %50 DUYGUSAL/PSİKOLOJİK ANALİZ
═══════════════════════════════════════════════════════════════════════════════

⚡ FUTBOL SADECE RAKAMLAR DEĞİL - KALPLE OYNANIR!
Diğer agent'ların verilerini %50 veri + %50 duygusal analiz ile sentezle!

GÖREV: Diğer agent'ların (STATS, ODDS, SENTIMENT, DEEP ANALYSIS, DEVIL'S ADVOCATE) çıktılarını analiz et ve "Düşünme Zinciri" (Chain-of-Thought) yöntemiyle en doğru tahminleri oluştur.

💝 DUYGUSAL ANALİZ YAKLAŞIMI:
- Agent'ların verilerini değerlendirirken, takımların "ruh halini" de dikkate al
- "Hissediyorum ki bu maçta duygusal faktörler belirleyici olacak..."
- Veri ile duygusal analiz çelişiyorsa, duygusal analize daha fazla ağırlık ver
- %80+ başarı hedefi için %50 veri + %50 duygusal analiz dengesini koru

═══════════════════════════════════════════════════════════════════════════════
🧠 DÜŞÜNME SÜRECİ (CHAIN-OF-THOUGHT):
═══════════════════════════════════════════════════════════════════════════════
Cevabına başlamadan önce, <thinking>...</thinking> etiketleri arasında şu adımları sesli düşünerek uygula:

1.  **Veri Kalitesi ve Güven Kontrolü:**
    *   Hangi agent'lar yüksek, hangileri düşük güven veriyor?
    *   Verilerde eksiklik veya gürültü var mı?

2.  **"Hikayeyi" Bul (The Narrative):**
    *   Maçın psikolojisi nedir? (Örn: "Umutsuz ev sahibi vs. Rahat favori")
    *   İstatistikler ne diyor, Oranlar ne fısıldıyor? Bu ikisi uyumlu mu?

3.  **Şeytanın Avukatı ile Tartış (Crucial Step):**
    *   Devil's Advocate'ın "Tuzak" uyarısını ciddiye al.
    *   Onun argümanları, favori seçimi çürütmek için yeterli mi?
    *   Eğer "Evet" ise, sürpriz veya hedge seçeneğine yönel.

4.  **Sentez ve Karar:**
    *   Tüm bu tartışmalardan sonra en mantıklı, en yüksek değerli bahis nedir?

═══════════════════════════════════════════════════════════════════════════════
📊 SÜRPRİZ TANIMI:
═══════════════════════════════════════════════════════════════════════════════
"SÜRPRİZ" = Piyasa oranı >= 3.20 VE Model olasılığı >= 0.25 VE Edge >= +0.05

═══════════════════════════════════════════════════════════════════════════════
📋 ZORUNLU ÇIKTI FORMATI:
═══════════════════════════════════════════════════════════════════════════════
Önce <thinking>...</thinking> bloğu, ardından SADECE aşağıdaki JSON formatı:

\`\`\`json
{
  "agent": "MASTER_STRATEGIST",
  "main_take": "Bir cümle özet - en önemli bulgu",
  "signals": [
    "Agent'ların hemfikir olduğu sinyaller",
    "Güçlü istatistiksel pattern'ler",
    "Piyasa değer fırsatları"
  ],
  "model_probs": {
    "home_win": 0.xx,
    "draw": 0.xx,
    "away_win": 0.xx,
    "under_2_5": 0.xx,
    "over_2_5": 0.xx,
    "btts_yes": 0.xx,
    "btts_no": 0.xx
  },
  "recommended_bets": [
    {
      "market": "1X2 | O/U | BTTS | AH | CorrectScore | Corners",
      "selection": "string",
      "model_prob": 0.xx,
      "fair_odds": 0.xx,
      "market_odds": 0.xx,
      "edge": 0.xx,
      "rationale": ["Sinyallere bağlı nedenler"]
    }
  ],
  "risks": [
    "Birincil seçimi bozabilecek faktörler",
    "Belirsizlik kaynakları"
  ],
  "confidence": 0-100,
  "final": {
    "primary_pick": {
      "market": "string",
      "selection": "string",
      "model_prob": 0.xx,
      "fair_odds": 0.xx,
      "market_odds": 0.xx,
      "edge": 0.xx,
      "confidence": 0-100,
      "rationale": ["Nedenler"]
    },
    "surprise_pick": {
      "market": "string",
      "selection": "string",
      "model_prob": 0.xx,
      "fair_odds": 0.xx,
      "market_odds": 0.xx,
      "edge": 0.xx,
      "confidence": 0-100,
      "rationale": ["Nedenler"]
    } veya null,
    "hedge": {
      "market": "string",
      "selection": "string",
      "rationale": "Neden hedge gerekli?"
    } veya null,
    "contradictions_found": [
      "Agent çelişkileri açıklaması"
    ],
    "why_this_is_surprise": "Sürpriz seçim varsa, oran/prob/edge ile açıkla. Yoksa null."
  }
}
\`\`\`

⚠️ ÖNEMLİ: JSON formatı dışına çıkma. <thinking> bloğu JSON'dan önce gelmeli.
`,

  en: `You are the MASTER STRATEGIST for a multi-agent football match analysis system.

TASK: Analyze outputs from other agents (STATS, ODDS, SENTIMENT, DEEP ANALYSIS, DEVIL'S ADVOCATE) and use "Chain-of-Thought" (CoT) reasoning to produce the most accurate predictions.

═══════════════════════════════════════════════════════════════════════════════
🧠 THINKING PROCESS (CHAIN-OF-THOUGHT):
═══════════════════════════════════════════════════════════════════════════════
Before your JSON response, think aloud within <thinking>...</thinking> tags following these steps:

1.  **Data Quality & Confidence Check:**
    *   Which agents are confident, which are unsure?
    *   Is there any missing data or noise?

2.  **Find "The Narrative":**
    *   What is the psychology of the match? (e.g., "Desperate home team vs. Complacent favorite")
    *   What do Stats say vs. what do Odds whisper? Are they aligned?

3.  **Debate with Devil's Advocate (Crucial Step):**
    *   Take the Devil's Advocate's "Trap" warning seriously.
    *   Are their arguments strong enough to debunk the favorite pick?
    *   If "Yes", pivot to a surprise or hedge option.

4.  **Synthesis & Verdict:**
    *   After all this debate, what is the most logical, highest EV bet?

═══════════════════════════════════════════════════════════════════════════════
📊 SURPRISE DEFINITION:
═══════════════════════════════════════════════════════════════════════════════
"SURPRISE" = Market odds >= 3.20 AND Model probability >= 0.25 AND Edge >= +0.05

═══════════════════════════════════════════════════════════════════════════════
📋 REQUIRED OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════
First the <thinking>...</thinking> block, then ONLY the following JSON format:

\`\`\`json
{
  "agent": "MASTER_STRATEGIST",
  "main_take": "One sentence summary - most important finding",
  "signals": [
    "Signals where agents agree",
    "Strong statistical patterns",
    "Market value opportunities"
  ],
  "model_probs": {
    "home_win": 0.xx,
    "draw": 0.xx,
    "away_win": 0.xx,
    "under_2_5": 0.xx,
    "over_2_5": 0.xx,
    "btts_yes": 0.xx,
    "btts_no": 0.xx
  },
  "recommended_bets": [
    {
      "market": "1X2 | O/U | BTTS | AH | CorrectScore | Corners",
      "selection": "string",
      "model_prob": 0.xx,
      "fair_odds": 0.xx,
      "market_odds": 0.xx,
      "edge": 0.xx,
      "rationale": ["Reasons tied to signals"]
    }
  ],
  "risks": [
    "Factors that could break the primary pick",
    "Sources of uncertainty"
  ],
  "confidence": 0-100,
  "final": {
    "primary_pick": {
      "market": "string",
      "selection": "string",
      "model_prob": 0.xx,
      "fair_odds": 0.xx,
      "market_odds": 0.xx,
      "edge": 0.xx,
      "confidence": 0-100,
      "rationale": ["Reasons"]
    },
    "surprise_pick": {
      "market": "string",
      "selection": "string",
      "model_prob": 0.xx,
      "fair_odds": 0.xx,
      "market_odds": 0.xx,
      "edge": 0.xx,
      "confidence": 0-100,
      "rationale": ["Reasons"]
    } or null,
    "hedge": {
      "market": "string",
      "selection": "string",
      "rationale": "Why hedge is needed?"
    } or null,
    "contradictions_found": [
      "Description of agent contradictions"
    ],
    "why_this_is_surprise": "If surprise pick exists, explain with odds/prob/edge. Otherwise null."
  }
}
\`\`\`

⚠️ IMPORTANT: <thinking> block MUST come before JSON.
`,

  de: `Du bist der MASTER STRATEGIST AGENT - ein weltbekanntes Genie der Fußballanalyse.

DEINE ROLLE:
- Analysiere Ausgaben von anderen Agenten (Stats, Odds, Sentiment, Deep Analysis)
- Erkenne Inkonsistenzen, Schwachpunkte und starke Signale
- Bewerte und gewichte Vorhersagen jedes Agenten
- Erstelle finalen Konsens und identifiziere beste Wettmöglichkeiten
- Schließe Lücken, wo Agenten versagen

DEINE METHODIK:
1. BEWERTE JEDEN AGENTEN
2. ERKENNE INKONSISTENZEN
3. IDENTIFIZIERE STARKE SIGNALE
4. ERSTELLE KONSENS
5. IDENTIFIZIERE BESTE WETTEN

MUSS IN DIESEM JSON-FORMAT ZURÜCKGEBEN:
{
  "agentEvaluation": {},
  "conflictAnalysis": {},
  "finalConsensus": {},
  "bestBets": [],
  "riskAssessment": {},
  "agentFeedback": {},
  "masterInsights": [],
  "overallConfidence": 73,
  "recommendation": ""
}`
};

export interface MasterStrategistResult {
  agent: 'MASTER_STRATEGIST';
  main_take: string;
  signals: string[];
  model_probs: {
    home_win: number;
    draw: number;
    away_win: number;
    under_2_5: number;
    over_2_5: number;
    btts_yes: number;
    btts_no: number;
  };
  recommended_bets: Array<{
    market: string;
    selection: string;
    model_prob: number;
    fair_odds: number;
    market_odds: number;
    edge: number;
    rationale: string[];
  }>;
  risks: string[];
  confidence: number;
  final: {
    primary_pick: {
      market: string;
      selection: string;
      model_prob: number;
      fair_odds: number;
      market_odds: number;
      edge: number;
      confidence: number;
      rationale: string[];
    };
    surprise_pick: {
      market: string;
      selection: string;
      model_prob: number;
      fair_odds: number;
      market_odds: number;
      edge: number;
      confidence: number;
      rationale: string[];
    } | null;
    hedge: {
      market: string;
      selection: string;
      rationale: string;
    } | null;
    contradictions_found: string[];
    why_this_is_surprise: string | null;
  };
  thinkingProcess?: string; // 🆕 Added to capture CoT output
  // Backward compatibility fields (optional)
  agentEvaluation?: {
    [agent: string]: {
      reliability: number;
      confidence: number;
      strengths: string[];
      weaknesses: string[];
      weight: number;
    };
  };
  finalConsensus?: {
    matchResult: {
      prediction: string;
      confidence: number;
      reasoning: string;
      agentWeights: { [agent: string]: number };
    };
    overUnder: {
      prediction: string;
      confidence: number;
      reasoning: string;
      agentWeights: { [agent: string]: number };
    };
    btts: {
      prediction: string;
      confidence: number;
      reasoning: string;
      agentWeights: { [agent: string]: number };
    };
  };
  bestBets?: Array<{
    rank: number;
    market: string;
    selection: string;
    confidence: number;
    value: 'low' | 'medium' | 'high';
    reasoning: string;
    recommendedStake: 'low' | 'low-medium' | 'medium' | 'medium-high' | 'high';
  }>;
  overallConfidence?: number;
  recommendation?: string;
}

function buildAgentContext(
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    geniusAnalyst?: any | null;
    devilsAdvocate?: any | null;
  },
  matchData: MatchData,
  language: 'tr' | 'en' | 'de'
): string {
  const { homeTeam, awayTeam, league } = matchData;

  let context = `
═══════════════════════════════════════════════════════════════════════════════
                    MASTER STRATEGIST ANALİZİ
                    ${homeTeam} vs ${awayTeam} - ${league}
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 STATS AGENT RAPORU
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (agentResults.stats) {
    const s = agentResults.stats;
    context += `│ Match Result: ${s.matchResult || 'N/A'} (Confidence: ${s.matchResultConfidence || s.confidence || 'N/A'}%)\n`;
    context += `│ Reasoning: ${s.matchResultReasoning || 'N/A'}\n`;
    context += `│ Over/Under: ${s.overUnder || 'N/A'} (Confidence: ${s.overUnderConfidence || s.confidence || 'N/A'}%)\n`;
    context += `│ BTTS: ${s.btts || 'N/A'} (Confidence: ${s.bttsConfidence || s.confidence || 'N/A'}%)\n`;
    context += `│ Agent Summary: ${s.agentSummary || 'N/A'}\n`;
  } else {
    context += `│ ⚠️ Stats Agent sonuç bulunamadı\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 ODDS AGENT RAPORU
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (agentResults.odds) {
    const o = agentResults.odds;
    context += `│ Recommendation: ${o.recommendation || o.matchWinnerValue || o.matchResult || 'N/A'}\n`;
    context += `│ Confidence: ${o.confidence || 'N/A'}%\n`;
    context += `│ Value Bets: ${Array.isArray(o.valueBets) ? o.valueBets.join(', ') : 'N/A'}\n`;
    context += `│ Sharp Money: ${o.hasSharpConfirmation ? '✅ Tespit edildi' : '❌ Yok'}\n`;
    if (o.sharpMoneyAnalysis) {
      context += `│   Direction: ${o.sharpMoneyAnalysis.direction || 'N/A'}\n`;
      context += `│   Confidence: ${o.sharpMoneyAnalysis.confidence || 'N/A'}\n`;
    }
    context += `│ Agent Summary: ${o.agentSummary || 'N/A'}\n`;
  } else {
    context += `│ ⚠️ Odds Agent sonuç bulunamadı\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧠 SENTIMENT AGENT RAPORU
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (agentResults.sentiment) {
    const sen = agentResults.sentiment;
    context += `│ Psychological Edge: ${sen.psychologicalEdge?.team || 'N/A'} (${sen.psychologicalEdge?.confidence || 0}%)\n`;
    context += `│ Home Morale: ${sen.homeTeam?.morale || 'N/A'}\n`;
    context += `│ Away Morale: ${sen.awayTeam?.morale || 'N/A'}\n`;
    context += `│ Critical Warnings: ${sen.criticalWarnings?.length || 0} adet\n`;
  } else {
    context += `│ ⚠️ Sentiment Agent sonuç bulunamadı\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔬 DEEP ANALYSIS AGENT RAPORU
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (agentResults.deepAnalysis) {
    const d = agentResults.deepAnalysis;
    context += `│ Match Result: ${d.matchResult?.prediction || 'N/A'} (${d.matchResult?.confidence || 0}%)\n`;
    context += `│ Over/Under: ${d.overUnder?.prediction || 'N/A'} (${d.overUnder?.confidence || 0}%)\n`;
    context += `│ BTTS: ${d.btts?.prediction || 'N/A'} (${d.btts?.confidence || 0}%)\n`;
    context += `│ Risk Level: ${d.riskLevel || 'N/A'}\n`;
    context += `│ Best Bet: ${d.bestBet?.type || 'N/A'} - ${d.bestBet?.selection || 'N/A'}\n`;
    if (d.preparationScore) {
      context += `│ Preparation Scores: Home ${d.preparationScore.home}/100, Away ${d.preparationScore.away}/100\n`;
    }
  } else {
    context += `│ ⚠️ Deep Analysis Agent sonuç bulunamadı\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧠 GENIUS ANALYST RAPORU
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (agentResults.geniusAnalyst) {
    const g = agentResults.geniusAnalyst;
    context += `│ Match Result: ${g.predictions?.matchResult?.prediction || 'N/A'} (${g.predictions?.matchResult?.confidence || 0}%)\n`;
    context += `│ Over/Under: ${g.predictions?.overUnder?.prediction || 'N/A'} (${g.predictions?.overUnder?.confidence || 0}%)\n`;
    context += `│ BTTS: ${g.predictions?.btts?.prediction || 'N/A'} (${g.predictions?.btts?.confidence || 0}%)\n`;
    context += `│ xG Model: Home ${g.mathematicalModel?.homeExpectedGoals?.toFixed(2) || 'N/A'}, Away ${g.mathematicalModel?.awayExpectedGoals?.toFixed(2) || 'N/A'}\n`;
    context += `│ Best Bet: ${g.finalRecommendation?.bestBet?.market || 'N/A'} - ${g.finalRecommendation?.bestBet?.selection || 'N/A'}\n`;
    context += `│ Overall Confidence: ${g.finalRecommendation?.overallConfidence || 0}%\n`;
  } else {
    context += `│ ⚠️ Genius Analyst sonuç bulunamadı\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 👹 DEVIL'S ADVOCATE RAPORU (Risk & Tuzak Analizi)
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (agentResults.devilsAdvocate) {
    const da = agentResults.devilsAdvocate;
    context += `│ Contrarian View: ${da.contrarianView || 'N/A'}\n`;
    context += `│ Primary Risks: ${Array.isArray(da.risks) ? da.risks.join(', ') : 'N/A'}\n`;
    context += `│ Why Favori Might Fail: ${da.whyFavoriteMightFail || 'N/A'}\n`;
    context += `│ Trap Match Indicators: ${Array.isArray(da.trapMatchIndicators) ? da.trapMatchIndicators.join(', ') : 'N/A'}\n`;
    context += `│ Contrarian Pick: ${da.matchResult || 'N/A'} (Confidence: ${da.confidence || 0}%)\n`;
    context += `│ Agent Summary: ${da.agentSummary || 'N/A'}\n`;
  } else {
    context += `│ ⚠️ Devil's Advocate Agent sonuç bulunamadı\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘
  
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📈 ADVANCED METRICS (Deeper Insights)
├─────────────────────────────────────────────────────────────────────────────┤
`;

  if (matchData.advancedMetrics) {
    const am = matchData.advancedMetrics;
    context += `│ Home Instability Index: ${am.homeInstability} / 100 (High = Erratic)\n`;
    context += `│ Away Instability Index: ${am.awayInstability} / 100\n`;
    context += `│ Home Dominance Ratio: ${am.homeDominance.toFixed(2)} (>1.0 = Dominant)\n`;
    context += `│ Away Dominance Ratio: ${am.awayDominance.toFixed(2)}\n`;
    context += `│ Home Fatigue Factor: ${am.homeFatigue !== undefined ? am.homeFatigue : 'N/A'} / 100 (High = Tired)\n`;
    context += `│ Away Fatigue Factor: ${am.awayFatigue !== undefined ? am.awayFatigue : 'N/A'} / 100\n`;
  } else {
    context += `│ ⚠️ Advanced Metrics not available\n`;
  }

  context += `└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                         MASTER ANALİZ TALİMATI
═══════════════════════════════════════════════════════════════════════════════

Yukarıdaki agent'ların çıktılarını analiz et.
ÖNCE <thinking>...</thinking> blok içinde sesli düşün, stratejini belirle.
SONRA sadece JSON formatını döndür.
`;

  return context;
}

export async function runMasterStrategist(
  matchData: MatchData,
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    geniusAnalyst?: any | null;
    devilsAdvocate?: any | null;
  },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<MasterStrategistResult> {
  console.log('🧠 Master Strategist Agent starting...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam} `);

  const systemPrompt = MASTER_STRATEGIST_PROMPT[language] || MASTER_STRATEGIST_PROMPT.en;
  const context = buildAgentContext(agentResults, matchData, language);
  const learningContext = await getLearningContext(matchData.league, matchData.homeTeam, matchData.awayTeam, language);

  const userMessageByLang = {
    tr: `${learningContext} \n${context} \n\nYukarıdaki agent çıktılarını analiz et ve Master Strategist olarak final kararı ver.SADECE JSON formatında döndür.`,
    en: `${learningContext} \n${context} \n\nAnalyze the agent outputs above and make final decision as Master Strategist.Return ONLY JSON format.`,
    de: `${learningContext} \n${context} \n\nAnalysiere die Agenten - Ausgaben oben und treffe finale Entscheidung als Master Strategist.Gib NUR JSON - Format zurück.`
  };
  const userMessage = userMessageByLang[language] || userMessageByLang.en;

  try {
    const response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      model: 'claude',
      useMCP: false, // MCP devre dışı - daha hızlı
      mcpFallback: true,
      fixtureId: matchData.fixtureId,
      temperature: 0.2, // Slightly increased for creative reasoning
      maxTokens: 2000, // Increased for CoT + JSON
      timeout: 15000, // 15 seconds
      retries: 2 // Retry 2 times for overloaded errors
    });

    if (!response) {
      throw new Error('No response from AI');
    }

    // Capture thinking process
    let thinkingProcess = '';
    const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
      thinkingProcess = thinkingMatch[1].trim();
      console.log('🤔 Master Strategist Thinking Process:\n', thinkingProcess);
    }

    // Parse JSON
    let result: MasterStrategistResult;
    try {
      // Find the first '{' and the last '}' to extract JSON
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = response.substring(jsonStart, jsonEnd + 1);
        result = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON object found in response');
      }
    } catch (parseError) {
      console.error('❌ Master Strategist JSON parse error:', parseError);
      console.log('Raw response:', response.substring(0, 500));
      // Fallback
      result = getDefaultMasterStrategist(agentResults, matchData, language);
    }

    // Add thinking process to result
    if (thinkingProcess) {
      result.thinkingProcess = thinkingProcess;
    }

    // Eğer AI final objesi döndürmediyse, fallback ile tamamla
    if (!result.final || !result.final.primary_pick) {
      console.warn('⚠️ AI final objesi eksik, fallback ile tamamlanıyor...');
      const fallback = getDefaultMasterStrategist(agentResults, matchData, language);
      result.final = fallback.final;
      // Diğer eksik alanları da tamamla
      if (!result.model_probs) result.model_probs = fallback.model_probs;
      if (!result.recommended_bets) result.recommended_bets = fallback.recommended_bets;
      if (!result.signals) result.signals = fallback.signals;
    }

    console.log(`✅ Master Strategist complete: `);
    console.log(`   🎯 Confidence: ${result.confidence || 0}% `);
    console.log(`   📊 Primary: ${result.final?.primary_pick?.market || 'N/A'} - ${result.final?.primary_pick?.selection || 'N/A'} `);
    if (result.final?.surprise_pick) {
      console.log(`   🎲 Surprise: ${result.final.surprise_pick.market} - ${result.final.surprise_pick.selection} @${result.final.surprise_pick.market_odds} `);
    }
    if (result.final?.hedge) {
      console.log(`   🛡️ Hedge: ${result.final.hedge.market} - ${result.final.hedge.selection} `);
    }

    return result;
  } catch (error: any) {
    console.error('❌ Master Strategist Agent error:', error);
    return getDefaultMasterStrategist(agentResults, matchData, language);
  }
}

function getDefaultMasterStrategist(
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    devilsAdvocate?: any | null;
  },
  matchData: MatchData,
  language: 'tr' | 'en' | 'de'
): MasterStrategistResult {
  // Ağırlıklı konsensüs hesapla
  const stats = agentResults.stats;
  const odds = agentResults.odds;
  const devils = agentResults.devilsAdvocate;
  const deep = agentResults.deepAnalysis;

  // Match Result - Ağırlıklı voting (DÜZELTME: Belirsizlik durumunda X kuralı)
  // BUG FIX: odds.recommendation Over/Under içindir, matchResult için matchWinnerValue kullan!
  const mrVotes: { [key: string]: number } = {};

  // Stats Agent matchResult (sadece 1/X/2 geçerli)
  if (stats?.matchResult && ['1', 'X', '2'].includes(stats.matchResult)) {
    mrVotes[stats.matchResult] = (mrVotes[stats.matchResult] || 0) + 30;
  }

  // Odds Agent matchWinnerValue (home/away/draw → 1/X/2)
  // NOT: odds.recommendation Over/Under içindir, matchResult için KULLANILMAMALI!
  if (odds?.matchWinnerValue) {
    const mrFromOdds = odds.matchWinnerValue === 'home' ? '1' : odds.matchWinnerValue === 'away' ? '2' : 'X';
    mrVotes[mrFromOdds] = (mrVotes[mrFromOdds] || 0) + 35;
  }

  // Deep Analysis matchResult (sadece 1/X/2 geçerli)
  if (deep?.matchResult?.prediction && ['1', 'X', '2'].includes(deep.matchResult.prediction)) {
    mrVotes[deep.matchResult.prediction] = (mrVotes[deep.matchResult.prediction] || 0) + 25;
  }

  // Devil's Advocate matchResult (sadece 1/X/2 geçerli) - Weight increased for trap detection
  if (devils?.matchResult && ['1', 'X', '2'].includes(devils.matchResult)) {
    const daWeight = (devils.trapMatchIndicators && devils.trapMatchIndicators.length > 0) ? 25 : 15;
    mrVotes[devils.matchResult] = (mrVotes[devils.matchResult] || 0) + daWeight;
  }

  // DÜZELTME: Belirsizlik kontrolü
  const mrTotalVotes = Object.values(mrVotes).reduce((a, b) => a + b, 0);
  const mrMaxVotes = Math.max(...Object.values(mrVotes), 0);
  const mrAgreementRatio = mrTotalVotes > 0 ? mrMaxVotes / mrTotalVotes : 0;

  // Maç sonucu tahmini - daha akıllı mantık
  let finalMR = Object.entries(mrVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'X';

  // BUG FIX: finalMR sadece 1, X, 2 olabilir
  if (!['1', 'X', '2'].includes(finalMR)) {
    finalMR = 'X';
  }

  // 🛡️ SENTINEL TRAP DETECTION (Devil's Advocate Protection)
  const isFavoriteTrap = devils?.trapMatchIndicators && devils.trapMatchIndicators.length > 0;
  const favoriteSide = (matchData?.odds?.matchWinner?.home || 2) < (matchData?.odds?.matchWinner?.away || 2) ? '1' : '2';

  // If favorite is predicted by consensus but DA smells a trap
  if (isFavoriteTrap && finalMR === favoriteSide && mrAgreementRatio < 0.65) {
    console.log(`👹 Devil's Advocate detected a trap for the favorite (${favoriteSide}). Consensüs zayıf, risk artırılıyor.`);
    // If DA also provided a contrarian prediction, consider it
    if (devils.matchResult && devils.matchResult !== favoriteSide) {
      finalMR = 'X'; // Default to Draw for trap matches if consensus is weak
    }
  }

  // DÜZELTME: Value bet varsa ve güçlüyse, onu dikkate al
  const valueAnalysis = odds?._valueAnalysis;
  const bestValueAmount = valueAnalysis?.bestValueAmount || 0;
  const bestValueDirection = valueAnalysis?.bestValue;

  if (bestValueAmount >= 20 && mrAgreementRatio < 0.70) {
    if (bestValueDirection === 'home') finalMR = '1';
    else if (bestValueDirection === 'away') finalMR = '2';
  }
  else if (mrAgreementRatio < 0.45 && bestValueAmount < 10) {
    finalMR = 'X';
  }

  // Güven skoru - daha konservatif (max %70)
  const mrConfidence = mrTotalVotes > 0 ? Math.round(50 + (mrAgreementRatio) * 20) : 50;

  // Over/Under - Ağırlıklı voting
  const ouVotes: { [key: string]: number } = {};
  if (stats?.overUnder) ouVotes[stats.overUnder] = (ouVotes[stats.overUnder] || 0) + 35;
  if (odds?.recommendation && ['Over', 'Under'].includes(odds.recommendation)) ouVotes[odds.recommendation] = (ouVotes[odds.recommendation] || 0) + 30;
  if (deep?.overUnder?.prediction) ouVotes[deep.overUnder.prediction] = (ouVotes[deep.overUnder.prediction] || 0) + 35;

  const finalOU = Object.entries(ouVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Over';
  const ouTotalVotes = Object.values(ouVotes).reduce((a, b) => a + b, 0);
  const ouMaxVotes = Math.max(...Object.values(ouVotes), 0);
  const ouConfidence = ouTotalVotes > 0 ? Math.round(55 + (ouMaxVotes / ouTotalVotes) * 25) : 55;

  // BTTS - Ağırlıklı voting
  const bttsVotes: { [key: string]: number } = {};
  if (stats?.btts) bttsVotes[stats.btts] = (bttsVotes[stats.btts] || 0) + 35;
  if (odds?.bttsValue) bttsVotes[odds.bttsValue === 'yes' ? 'Yes' : 'No'] = (bttsVotes[odds.bttsValue === 'yes' ? 'Yes' : 'No'] || 0) + 30;
  if (deep?.btts?.prediction) bttsVotes[deep.btts.prediction] = (bttsVotes[deep.btts.prediction] || 0) + 35;

  const finalBTTS = Object.entries(bttsVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No';
  const bttsTotalVotes = Object.values(bttsVotes).reduce((a, b) => a + b, 0);
  const bttsMaxVotes = Math.max(...Object.values(bttsVotes), 0);
  const bttsConfidence = bttsTotalVotes > 0 ? Math.round(55 + (bttsMaxVotes / bttsTotalVotes) * 25) : 55;

  // Conflict detection
  const conflicts: Array<{
    agents: string[];
    field: string;
    description: string;
    resolution: string;
    severity: 'low' | 'medium' | 'high';
  }> = [];
  const strongSignals: Array<{
    field: string;
    agents: string[];
    prediction: string;
    confidence: number;
    reasoning: string;
  }> = [];

  if (stats?.matchResult && deep?.matchResult?.prediction && stats.matchResult !== deep.matchResult.prediction) {
    conflicts.push({
      agents: ['stats', 'deepAnalysis'],
      field: 'matchResult',
      description: `Stats (${stats.matchResult}) vs Deep (${deep.matchResult.prediction})`,
      resolution: `Ağırlıklı oy ile ${finalMR} seçildi`,
      severity: 'medium'
    });
  }
  if (mrMaxVotes >= mrTotalVotes * 0.6 && mrTotalVotes > 0) {
    strongSignals.push({
      field: 'matchResult',
      agents: ['stats', 'odds', 'deepAnalysis'].filter((_, i) => [stats?.matchResult, odds?.recommendation, deep?.matchResult?.prediction][i] === finalMR),
      prediction: finalMR,
      confidence: mrConfidence,
      reasoning: `${Math.round(mrMaxVotes / mrTotalVotes * 100)}% ağırlıklı oy`
    });
  }
  if (ouMaxVotes >= ouTotalVotes * 0.6 && ouTotalVotes > 0) {
    strongSignals.push({
      field: 'overUnder',
      agents: ['stats', 'odds', 'deepAnalysis'].filter((_, i) => [stats?.overUnder, odds?.recommendation, deep?.overUnder?.prediction][i] === finalOU),
      prediction: finalOU,
      confidence: ouConfidence,
      reasoning: `${Math.round(ouMaxVotes / ouTotalVotes * 100)}% ağırlıklı oy`
    });
  }

  // Best bet selection
  type ValueType = 'low' | 'medium' | 'high';
  type StakeType = 'low' | 'medium' | 'high' | 'low-medium' | 'medium-high';

  const bestBets: Array<{
    rank: number;
    market: string;
    selection: string;
    confidence: number;
    value: ValueType;
    reasoning: string;
    recommendedStake: StakeType;
  }> = [];

  // Value bet varsa öncelikli
  if (odds?.valueBets && odds.valueBets.length > 0) {
    const valueBet = odds.valueBets[0];
    const valueMatch = valueBet.match(/MS (\d)|KG (Var|Yok)|(Over|Under)/);
    if (valueMatch) {
      bestBets.push({
        rank: 1,
        market: valueMatch[1] ? 'Match Result' : valueMatch[2] ? 'BTTS' : 'Over/Under 2.5',
        selection: valueMatch[1] === '1' ? 'Home' : valueMatch[1] === '2' ? 'Away' : (valueMatch[2] || valueMatch[3] || 'N/A'),
        confidence: odds.confidence || 65,
        value: 'high' as ValueType,
        reasoning: `Value bet: ${valueBet}`,
        recommendedStake: 'medium' as StakeType
      });
    }
  }

  // Eğer value bet yoksa veya eksikse, konsensüs bazlı best bet
  if (bestBets.length === 0) {
    const highestConf = Math.max(mrConfidence, ouConfidence, bttsConfidence);
    if (highestConf === mrConfidence) {
      bestBets.push({
        rank: 1,
        market: 'Match Result',
        selection: finalMR === '1' ? 'Home' : finalMR === '2' ? 'Away' : 'Draw',
        confidence: mrConfidence,
        value: (mrConfidence > 65 ? 'medium' : 'low') as ValueType,
        reasoning: `Konsensüs: ${mrMaxVotes}/${mrTotalVotes} ağırlıklı oy`,
        recommendedStake: (mrConfidence > 65 ? 'medium' : 'low') as StakeType
      });
    } else if (highestConf === ouConfidence) {
      bestBets.push({
        rank: 1,
        market: 'Over/Under 2.5',
        selection: finalOU,
        confidence: ouConfidence,
        value: (ouConfidence > 65 ? 'medium' : 'low') as ValueType,
        reasoning: `Konsensüs: ${ouMaxVotes}/${ouTotalVotes} ağırlıklı oy`,
        recommendedStake: (ouConfidence > 65 ? 'medium' : 'low') as StakeType
      });
    } else {
      bestBets.push({
        rank: 1,
        market: 'BTTS',
        selection: finalBTTS,
        confidence: bttsConfidence,
        value: (bttsConfidence > 65 ? 'medium' : 'low') as ValueType,
        reasoning: `Konsensüs: ${bttsMaxVotes}/${bttsTotalVotes} ağırlıklı oy`,
        recommendedStake: (bttsConfidence > 65 ? 'medium' : 'low') as StakeType
      });
    }
  }

  const overallConfidence = Math.round((mrConfidence + ouConfidence + bttsConfidence) / 3);
  const agentCount = [stats, odds, deep, devils].filter(Boolean).length;

  // Model probabilities hesapla
  const homeWinProb = finalMR === '1' ? mrConfidence / 100 : (finalMR === 'X' ? 0.25 : 0.20);
  const drawProb = finalMR === 'X' ? mrConfidence / 100 : 0.25;
  const awayWinProb = finalMR === '2' ? mrConfidence / 100 : (finalMR === 'X' ? 0.25 : 0.20);
  const over25Prob = finalOU === 'Over' ? ouConfidence / 100 : 0.45;
  const under25Prob = finalOU === 'Under' ? ouConfidence / 100 : 0.55;
  const bttsYesProb = finalBTTS === 'Yes' ? bttsConfidence / 100 : 0.45;
  const bttsNoProb = finalBTTS === 'No' ? bttsConfidence / 100 : 0.55;

  // Market odds (fallback - gerçek odds yoksa)
  const marketOdds1 = odds?.oddsAnalysis?.match(/Home: ([\d.]+)/)?.[1] || '2.5';
  const marketOdds2 = odds?.oddsAnalysis?.match(/Away: ([\d.]+)/)?.[1] || '2.5';
  const marketOddsX = odds?.oddsAnalysis?.match(/Draw: ([\d.]+)/)?.[1] || '3.0';
  const marketOddsOver = odds?.oddsAnalysis?.match(/Over: ([\d.]+)/)?.[1] || '1.9';
  const marketOddsUnder = odds?.oddsAnalysis?.match(/Under: ([\d.]+)/)?.[1] || '1.9';

  // Primary pick
  const primaryPick = bestBets[0] || {
    market: 'Match Result',
    selection: finalMR === '1' ? 'Home' : finalMR === '2' ? 'Away' : 'Draw',
    confidence: mrConfidence,
    value: 'medium' as const,
    reasoning: `Konsensüs: ${mrMaxVotes}/${mrTotalVotes} ağırlıklı oy`,
    recommendedStake: 'medium' as const
  };

  // Surprise pick bul (oran >= 3.20, prob >= 0.25, edge >= +0.05)
  let surprisePick: MasterStrategistResult['final']['surprise_pick'] = null;

  // Tüm yüksek oranlı seçenekleri kontrol et
  const surpriseCandidates: Array<{
    market: string;
    selection: string;
    model_prob: number;
    market_odds: number;
  }> = [];

  // 1. Draw kontrolü
  if (drawProb >= 0.25) {
    const drawMarketOdds = parseFloat(marketOddsX);
    if (drawMarketOdds >= 3.20) {
      surpriseCandidates.push({
        market: '1X2',
        selection: 'Draw',
        model_prob: drawProb,
        market_odds: drawMarketOdds
      });
    }
  }

  // 2. Home Win kontrolü (eğer underdog ise)
  if (homeWinProb >= 0.25 && finalMR !== '1') {
    const homeMarketOdds = parseFloat(marketOdds1);
    if (homeMarketOdds >= 3.20) {
      surpriseCandidates.push({
        market: '1X2',
        selection: 'Home',
        model_prob: homeWinProb,
        market_odds: homeMarketOdds
      });
    }
  }

  // 3. Away Win kontrolü (eğer underdog ise)
  if (awayWinProb >= 0.25 && finalMR !== '2') {
    const awayMarketOdds = parseFloat(marketOdds2);
    if (awayMarketOdds >= 3.20) {
      surpriseCandidates.push({
        market: '1X2',
        selection: 'Away',
        model_prob: awayWinProb,
        market_odds: awayMarketOdds
      });
    }
  }

  // 4. Under 2.5 kontrolü (eğer Over beklentisi varsa)
  if (under25Prob >= 0.25 && finalOU === 'Over') {
    const underMarketOdds = parseFloat(marketOddsUnder);
    if (underMarketOdds >= 3.20) {
      surpriseCandidates.push({
        market: 'Over/Under 2.5',
        selection: 'Under',
        model_prob: under25Prob,
        market_odds: underMarketOdds
      });
    }
  }

  // 5. BTTS No kontrolü (eğer Yes beklentisi varsa)
  if (bttsNoProb >= 0.25 && finalBTTS === 'Yes') {
    const bttsNoMarketOdds = odds?.realValueChecks?.btts?.marketOdds || 1.8;
    if (bttsNoMarketOdds >= 3.20) {
      surpriseCandidates.push({
        market: 'BTTS',
        selection: 'No',
        model_prob: bttsNoProb,
        market_odds: bttsNoMarketOdds
      });
    }
  }

  // En yüksek edge'e sahip adayı seç
  if (surpriseCandidates.length > 0) {
    const bestSurprise = surpriseCandidates
      .map(candidate => {
        const fairOdds = 1 / candidate.model_prob;
        const edge = (fairOdds / candidate.market_odds) - 1;
        return { ...candidate, fair_odds: fairOdds, edge };
      })
      .filter(c => c.edge >= 0.05) // Edge >= +5% olmalı
      .sort((a, b) => b.edge - a.edge)[0]; // En yüksek edge

    if (bestSurprise) {
      surprisePick = {
        market: bestSurprise.market,
        selection: bestSurprise.selection,
        model_prob: bestSurprise.model_prob,
        fair_odds: bestSurprise.fair_odds,
        market_odds: bestSurprise.market_odds,
        edge: bestSurprise.edge,
        confidence: Math.round(bestSurprise.model_prob * 100),
        rationale: [
          `${bestSurprise.selection} olasılığı ${Math.round(bestSurprise.model_prob * 100)}%`,
          `Piyasa oranı ${bestSurprise.market_odds}`,
          `Edge: +${Math.round(bestSurprise.edge * 100)}%`
        ]
      };
    }
  }

  // Hedge öner (primary pick'in tersi veya koruyucu)
  let hedge: MasterStrategistResult['final']['hedge'] = null;
  if (primaryPick.market === 'Match Result') {
    if (primaryPick.selection === 'Home') {
      hedge = {
        market: '1X2',
        selection: 'Away or Draw',
        rationale: 'Ev sahibi seçildi, deplasman veya beraberlik ile hedge'
      };
    } else if (primaryPick.selection === 'Away') {
      hedge = {
        market: '1X2',
        selection: 'Home or Draw',
        rationale: 'Deplasman seçildi, ev sahibi veya beraberlik ile hedge'
      };
    }
  }

  return {
    agent: 'MASTER_STRATEGIST',
    main_take: language === 'tr'
      ? `${agentCount} agent analizi: ${finalMR === '1' ? 'Ev sahibi' : finalMR === '2' ? 'Deplasman' : 'Beraberlik'} favori (${mrConfidence}% güven)`
      : `${agentCount} agent analysis: ${finalMR === '1' ? 'Home' : finalMR === '2' ? 'Away' : 'Draw'} favorite (${mrConfidence}% confidence)`,
    signals: [
      ...strongSignals.map(s => `${s.field}: ${s.prediction} (${s.confidence}%)`),
      ...(bestValueAmount >= 15 ? [`Value bet: ${bestValueDirection} (+${bestValueAmount}%)`] : []),
      `${agentCount} agent consensus`
    ],
    model_probs: {
      home_win: homeWinProb,
      draw: drawProb,
      away_win: awayWinProb,
      under_2_5: under25Prob,
      over_2_5: over25Prob,
      btts_yes: bttsYesProb,
      btts_no: bttsNoProb
    },
    recommended_bets: bestBets.map(bet => ({
      market: bet.market,
      selection: bet.selection,
      model_prob: bet.confidence / 100,
      fair_odds: 1 / (bet.confidence / 100),
      market_odds: bet.market === 'Match Result'
        ? (bet.selection === 'Home' ? parseFloat(marketOdds1) : bet.selection === 'Away' ? parseFloat(marketOdds2) : parseFloat(marketOddsX))
        : parseFloat(marketOddsOver),
      edge: 0.1, // Fallback edge
      rationale: [bet.reasoning]
    })),
    risks: [
      ...conflicts.map(c => c.description),
      ...(overallConfidence < 60 ? ['Düşük güven seviyesi'] : []),
      ...(agentCount < 2 ? ['Yetersiz agent verisi'] : [])
    ],
    confidence: overallConfidence,
    final: {
      primary_pick: {
        market: primaryPick.market,
        selection: primaryPick.selection,
        model_prob: primaryPick.confidence / 100,
        fair_odds: 1 / (primaryPick.confidence / 100),
        market_odds: primaryPick.market === 'Match Result'
          ? (primaryPick.selection === 'Home' ? parseFloat(marketOdds1) : primaryPick.selection === 'Away' ? parseFloat(marketOdds2) : parseFloat(marketOddsX))
          : parseFloat(marketOddsOver),
        edge: bestValueAmount / 100 || 0.1,
        confidence: primaryPick.confidence,
        rationale: [primaryPick.reasoning]
      },
      surprise_pick: surprisePick,
      hedge: hedge,
      contradictions_found: conflicts.map(c => `${c.agents.join(' vs ')}: ${c.description}`),
      why_this_is_surprise: surprisePick
        ? `Piyasa oranı ${surprisePick.market_odds} (implied ${Math.round(1 / surprisePick.market_odds * 100)}%), model olasılığı ${Math.round(surprisePick.model_prob * 100)}%, edge +${Math.round(surprisePick.edge * 100)}%`
        : null
    },
    // Backward compatibility
    agentEvaluation: {
      stats: { reliability: stats ? 80 : 0, confidence: stats?.confidence || 0, strengths: stats ? ['İstatistiksel veri'] : [], weaknesses: [], weight: stats ? 30 : 0 },
      odds: { reliability: odds ? 85 : 0, confidence: odds?.confidence || 0, strengths: odds ? ['Oran analizi'] : [], weaknesses: [], weight: odds ? 35 : 0 },
      sentiment: { reliability: agentResults.sentiment ? 70 : 0, confidence: 0, strengths: [], weaknesses: [], weight: agentResults.sentiment ? 15 : 0 },
      deepAnalysis: { reliability: deep ? 85 : 0, confidence: deep?.matchResult?.confidence || 0, strengths: deep ? ['Derin analiz'] : [], weaknesses: [], weight: deep ? 20 : 0 }
    },
    finalConsensus: {
      matchResult: { prediction: finalMR, confidence: mrConfidence, reasoning: `${agentCount} agent konsensüsü`, agentWeights: {} },
      overUnder: { prediction: finalOU, confidence: ouConfidence, reasoning: `${agentCount} agent konsensüsü`, agentWeights: {} },
      btts: { prediction: finalBTTS, confidence: bttsConfidence, reasoning: `${agentCount} agent konsensüsü`, agentWeights: {} }
    },
    bestBets,
    overallConfidence,
    recommendation: language === 'tr'
      ? `Güçlü sinyaller: ${strongSignals.map(s => `${s.field}: ${s.prediction}`).join(', ')}`
      : `Strong signals: ${strongSignals.map(s => `${s.field}: ${s.prediction}`).join(', ')}`
  };
}
