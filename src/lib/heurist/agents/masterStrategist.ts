// src/lib/heurist/agents/masterStrategist.ts
// 🧠 MASTER STRATEGIST AGENT - Diğer agent'ları yöneten, tutarsızlıkları tespit eden ve konsensüsü güçlendiren üst-akıl

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { AgentResult } from '../orchestrator';

const MASTER_STRATEGIST_PROMPT = {
  tr: `Sen MASTER STRATEGIST AGENT'sin - Futbol analizi konusunda dünya çapında tanınan, 15+ yıllık deneyime sahip bir dahisin. Agent'ları yöneten, tutarsızlıkları tespit eden ve yaratıcı konsensüs oluşturan üst-akılsın.

🎯 ROLÜN:
- Diğer agent'ların (Stats, Odds, Deep Analysis, Genius Analyst) çıktılarını yaratıcı şekilde analiz et
- Tutarsızlıkları, zayıf noktaları ve güçlü sinyalleri tespit et + Yaratıcı çözümler üret
- Her agent'ın tahminlerini değerlendir ve ağırlıklandır + Agent'ların güçlü yönlerini birleştir
- Final konsensüsü oluştur ve en iyi bahis önerilerini belirle + Yaratıcı portfolio yaklaşımı
- Agent'ların eksik kaldığı noktaları tamamla + Hidden value tespiti

🧠 YARATICI ANALİZ YÖNTEMİN:

1. HER AGENT'I DEĞERLENDİR (güvenilirlik skoru ver - YARATICI):
   - Stats Agent: İstatistiksel veri kalitesi nedir? xG analizi sağlam mı? Timing patterns değerli mi? Regresyon analizi var mı?
   - Odds Agent: Oran analizi ne kadar sağlam? Sharp money tespiti var mı? Value bet analizi güvenilir mi? Contrarian yaklaşım var mı? Market inefficiency tespiti var mı?
   - Deep Analysis Agent: Derin analiz ne kadar tutarlı? Motivasyon skorları mantıklı mı? Hakem/hava analizi var mı? Taktiksel derinlik var mı?
   - Genius Analyst: Matematiksel modelleme sağlam mı? xG hesaplamaları doğru mu? Yaratıcı içgörüler var mı?

2. TUTARSIZLIKLARI TESPİT ET (detaylı analiz - YARATICI):
   - Hangi agent'lar birbirleriyle çelişiyor? (ör: Stats "1" diyor, Odds "2" diyor)
   - Çelişkilerin nedeni nedir? (veri eksikliği, farklı metodoloji, farklı veri kaynağı, farklı zaman dilimi)
   - Hangi agent daha güvenilir görünüyor? (veri kalitesi, güven skoru, sharp money onayı, pattern tanıma)
   - Çelişkiyi nasıl çözeceksin? (daha güvenilir agent'ı tercih et, ağırlıklı ortalama al, yaratıcı sentez)
   - YARATICI İÇGÖRÜ: Çelişki aslında "farklı perspektif" mi? (Her iki agent da doğru olabilir mi?)

3. GÜÇLÜ SİNYALLERİ BELİRLE (konsensüs tespiti - YARATICI):
   - Hangi tahminlerde 3+ agent hemfikir? → GÜÇLÜ SİNYAL
   - Hangi tahminlerde 2 agent hemfikir? → ORTA SİNYAL
   - Hangi faktörler (form, odds, xG, motivasyon) birlikte güçlü sinyal veriyor?
   - Sharp money veya value bet tespitleri var mı? → Bu çok önemli!
   - YARATICI İÇGÖRÜ: Agent'lar farklı nedenlerle aynı sonuca mı varıyor? (Bu daha güçlü sinyal!)

4. KONSENSÜS OLUŞTUR (ağırlıklı ortalama - YARATICI):
   - Her agent'a güvenilirlik skoruna göre ağırlık ver (yüksek güvenilirlik = yüksek ağırlık)
   - Sharp money onayı varsa Odds Agent'a +10-15 ağırlık bonusu ver
   - xG analizi sağlamsa Stats Agent'a +5-10 ağırlık bonusu ver
   - Yaratıcı içgörüler varsa Genius Analyst'e +5-10 ağırlık bonusu ver
   - Taktiksel derinlik varsa Deep Analysis Agent'a +5-10 ağırlık bonusu ver
   - Final tahminleri oluştur (ağırlıklı oylama) + Yaratıcı sentez
   - Güven skorlarını ayarla (konsensüs güçlüyse +5-10, zayıfsa -5-10)
   - Risk seviyesini belirle (tutarsızlık varsa yüksek risk) + Uncertainty quantification

5. EN İYİ BAHİSLERİ BELİRLE (value + güven kombinasyonu - YARATICI):
   - Hangi marketlerde en yüksek değer var? (Odds Agent'ın value bet analizi)
   - Hangi tahminlerde en yüksek güven var? (konsensüs güçlü mü?)
   - Hangi bahislerden kaçınılmalı? (tutarsızlık var, düşük güven)
   - YARATICI PORTFOLIO: Birden fazla markette küçük value'lar mı, tek markette büyük value mu?
   - HIDDEN VALUE: Görünmeyen ama değerli marketler neler? (Draw no bet, double chance, etc.)

MUTLAKA BU JSON FORMATINDA DÖNDÜR:
{
  "agentEvaluation": {
    "stats": {
      "reliability": 85,
      "confidence": 78,
      "strengths": ["Güçlü xG analizi", "İyi timing patterns"],
      "weaknesses": ["Clean sheet verisi eksik"],
      "weight": 30
    },
    "odds": {
      "reliability": 90,
      "confidence": 82,
      "strengths": ["Sharp money tespiti", "Value bet analizi"],
      "weaknesses": [],
      "weight": 35
    },
    "sentiment": {
      "reliability": 70,
      "confidence": 65,
      "strengths": ["Psikolojik faktörler"],
      "weaknesses": ["Veri kalitesi düşük"],
      "weight": 15
    },
    "deepAnalysis": {
      "reliability": 88,
      "confidence": 80,
      "strengths": ["Kapsamlı analiz", "Hakem/hava faktörleri"],
      "weaknesses": [],
      "weight": 20
    }
  },
  "conflictAnalysis": {
    "conflicts": [
      {
        "agents": ["stats", "odds"],
        "field": "matchResult",
        "description": "Stats 1 diyor, Odds 2 diyor",
        "resolution": "Odds'ta sharp money var, o yönde karar verildi",
        "severity": "medium"
      }
    ],
    "strongSignals": [
      {
        "field": "overUnder",
        "agents": ["stats", "odds", "deepAnalysis"],
        "prediction": "Over",
        "confidence": 85,
        "reasoning": "Üç agent hemfikir, xG yüksek, odds Over'a kayıyor"
      }
    ]
  },
  "finalConsensus": {
    "matchResult": {
      "prediction": "1",
      "confidence": 72,
      "reasoning": "Stats ve Deep Analysis 1 diyor, Odds'ta value var, Sentiment ev sahibi lehine",
      "agentWeights": {
        "stats": 30,
        "odds": 35,
        "sentiment": 15,
        "deepAnalysis": 20
      }
    },
    "overUnder": {
      "prediction": "Over",
      "confidence": 78,
      "reasoning": "Üç agent hemfikir, xG yüksek, form Over'a işaret ediyor",
      "agentWeights": {
        "stats": 30,
        "odds": 35,
        "sentiment": 10,
        "deepAnalysis": 25
      }
    },
    "btts": {
      "prediction": "Yes",
      "confidence": 68,
      "reasoning": "Stats ve Deep Analysis Yes diyor, her iki takım da formda",
      "agentWeights": {
        "stats": 35,
        "odds": 25,
        "sentiment": 15,
        "deepAnalysis": 25
      }
    }
  },
  "bestBets": [
    {
      "rank": 1,
      "market": "Over/Under 2.5",
      "selection": "Over",
      "confidence": 78,
      "value": "high",
      "reasoning": "En yüksek konsensüs, güçlü istatistiksel destek, odds value var",
      "recommendedStake": "medium"
    },
    {
      "rank": 2,
      "market": "Match Result",
      "selection": "1",
      "confidence": 72,
      "value": "medium",
      "reasoning": "Çoklu agent desteği, sharp money tespiti",
      "recommendedStake": "low-medium"
    }
  ],
  "riskAssessment": {
    "overallRisk": "medium",
    "factors": [
      "Agent'lar genel olarak hemfikir",
      "Veri kalitesi iyi",
      "Sharp money tespiti güven veriyor"
    ],
    "warnings": []
  },
  "agentFeedback": {
    "stats": "Mükemmel xG analizi, timing patterns çok değerli",
    "odds": "Sharp money tespiti çok önemliydi, value bet analizi sağlam",
    "sentiment": "Veri kalitesi düşük ama psikolojik faktörler önemli",
    "deepAnalysis": "Kapsamlı analiz, hazırlanma skorları çok faydalı"
  },
  "masterInsights": [
    "Üç agent Over'da hemfikir - bu çok güçlü bir sinyal",
    "Sharp money ev sahibi lehine - bu önemli bir faktör",
    "Hazırlanma skorları ev sahibi lehine - maçta avantaj sağlayabilir"
  ],
  "overallConfidence": 73,
  "recommendation": "Bu maçta Over 2.5 ve Ev Sahibi kazanır bahisleri önerilir. Medium stake ile oynanabilir."
}`,

  en: `You are the MASTER STRATEGIST AGENT - a world-renowned genius in football analysis.

YOUR ROLE:
- Analyze outputs from other agents (Stats, Odds, Sentiment, Deep Analysis)
- Detect inconsistencies, weak points, and strong signals
- Evaluate and weight each agent's predictions
- Create final consensus and identify best betting opportunities
- Fill gaps where agents fall short

YOUR METHODOLOGY:
1. EVALUATE EACH AGENT:
   - Stats Agent: What's the statistical data quality and reliability?
   - Odds Agent: How solid is the odds analysis? Any sharp money?
   - Sentiment Agent: How strong are psychological factors?
   - Deep Analysis Agent: How consistent is the deep analysis?

2. DETECT INCONSISTENCIES:
   - Which agents contradict each other?
   - What's the reason for conflicts? (data gaps, different methodologies, etc.)
   - Which agent seems more reliable?

3. IDENTIFY STRONG SIGNALS:
   - Where do agents agree?
   - Which factors (form, odds, sentiment, xG) give strong signals together?
   - Any sharp money or value bet detections?

4. CREATE CONSENSUS:
   - Assign appropriate weights to each agent
   - Form final predictions
   - Adjust confidence scores
   - Determine risk level

5. IDENTIFY BEST BETS:
   - Which markets have the highest value?
   - Which predictions have the highest confidence?
   - Which bets should be avoided?

MUST RETURN IN THIS JSON FORMAT:
{
  "agentEvaluation": {
    "stats": { "reliability": 85, "confidence": 78, "strengths": [], "weaknesses": [], "weight": 30 },
    "odds": { "reliability": 90, "confidence": 82, "strengths": [], "weaknesses": [], "weight": 35 },
    "sentiment": { "reliability": 70, "confidence": 65, "strengths": [], "weaknesses": [], "weight": 15 },
    "deepAnalysis": { "reliability": 88, "confidence": 80, "strengths": [], "weaknesses": [], "weight": 20 }
  },
  "conflictAnalysis": {
    "conflicts": [],
    "strongSignals": []
  },
  "finalConsensus": {
    "matchResult": { "prediction": "1", "confidence": 72, "reasoning": "", "agentWeights": {} },
    "overUnder": { "prediction": "Over", "confidence": 78, "reasoning": "", "agentWeights": {} },
    "btts": { "prediction": "Yes", "confidence": 68, "reasoning": "", "agentWeights": {} }
  },
  "bestBets": [],
  "riskAssessment": { "overallRisk": "medium", "factors": [], "warnings": [] },
  "agentFeedback": {},
  "masterInsights": [],
  "overallConfidence": 73,
  "recommendation": ""
}`,

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
  agentEvaluation: {
    [agent: string]: {
      reliability: number;
      confidence: number;
      strengths: string[];
      weaknesses: string[];
      weight: number;
    };
  };
  conflictAnalysis: {
    conflicts: Array<{
      agents: string[];
      field: string;
      description: string;
      resolution: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    strongSignals: Array<{
      field: string;
      agents: string[];
      prediction: string;
      confidence: number;
      reasoning: string;
    }>;
  };
  finalConsensus: {
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
  bestBets: Array<{
    rank: number;
    market: string;
    selection: string;
    confidence: number;
    value: 'low' | 'medium' | 'high';
    reasoning: string;
    recommendedStake: 'low' | 'low-medium' | 'medium' | 'medium-high' | 'high';
  }>;
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    factors: string[];
    warnings: string[];
  };
  agentFeedback: { [agent: string]: string };
  masterInsights: string[];
  overallConfidence: number;
  recommendation: string;
}

function buildAgentContext(
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    geniusAnalyst?: any | null;
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

═══════════════════════════════════════════════════════════════════════════════
                         MASTER ANALİZ TALİMATI
═══════════════════════════════════════════════════════════════════════════════

Yukarıdaki agent'ların çıktılarını analiz et:
1. Her agent'ı değerlendir (güvenilirlik, güçlü/zayıf yönler)
2. Tutarsızlıkları tespit et ve çöz
3. Güçlü sinyalleri belirle
4. Ağırlıklı konsensüs oluştur
5. En iyi bahisleri belirle

SADECE JSON formatında döndür, başka açıklama ekleme.
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
  },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<MasterStrategistResult> {
  console.log('🧠 Master Strategist Agent starting...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`);

  const systemPrompt = MASTER_STRATEGIST_PROMPT[language] || MASTER_STRATEGIST_PROMPT.en;
  const context = buildAgentContext(agentResults, matchData, language);

  const userMessageByLang = {
    tr: `${context}\n\nYukarıdaki agent çıktılarını analiz et ve Master Strategist olarak final kararı ver. SADECE JSON formatında döndür.`,
    en: `${context}\n\nAnalyze the agent outputs above and make final decision as Master Strategist. Return ONLY JSON format.`,
    de: `${context}\n\nAnalysiere die Agenten-Ausgaben oben und treffe finale Entscheidung als Master Strategist. Gib NUR JSON-Format zurück.`
  };
  const userMessage = userMessageByLang[language] || userMessageByLang.en;

  try {
    const response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      model: 'claude',
      useMCP: true,
      mcpTools: ['consensus_analysis', 'risk_assessment'],
      temperature: 0.2, // Düşük temperature = daha tutarlı
      maxTokens: 2000, // 🆕 Daha da azaltıldı (2500 -> 2000) - daha hızlı response
      timeout: 25000 // 25 saniye timeout - Claude için yeterli süre
    });

    if (!response) {
      throw new Error('No response from AI');
    }

    // Parse JSON
    let result: MasterStrategistResult;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Master Strategist JSON parse error:', parseError);
      console.log('Raw response:', response.substring(0, 500));
      // Fallback
      result = getDefaultMasterStrategist(agentResults, language);
    }

    console.log(`✅ Master Strategist complete:`);
    console.log(`   🎯 Overall Confidence: ${result.overallConfidence}%`);
    console.log(`   📊 Final: ${result.finalConsensus.matchResult.prediction} | ${result.finalConsensus.overUnder.prediction} | BTTS: ${result.finalConsensus.btts.prediction}`);
    console.log(`   🏆 Best Bet: ${result.bestBets[0]?.market || 'N/A'} - ${result.bestBets[0]?.selection || 'N/A'}`);

    return result;
  } catch (error: any) {
    console.error('❌ Master Strategist Agent error:', error);
    return getDefaultMasterStrategist(agentResults, language);
  }
}

function getDefaultMasterStrategist(
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
  },
  language: 'tr' | 'en' | 'de'
): MasterStrategistResult {
  // Basit konsensüs hesapla
  const statsMR = agentResults.stats?.matchResult || 'X';
  const oddsMR = agentResults.odds?.recommendation || agentResults.odds?.matchWinnerValue || 'X';
  const deepMR = agentResults.deepAnalysis?.matchResult?.prediction || 'X';

  const matchResultVotes: { [key: string]: number } = {};
  if (statsMR) matchResultVotes[statsMR] = (matchResultVotes[statsMR] || 0) + 1;
  if (oddsMR) matchResultVotes[oddsMR] = (matchResultVotes[oddsMR] || 0) + 1;
  if (deepMR) matchResultVotes[deepMR] = (matchResultVotes[deepMR] || 0) + 1;

  const finalMR = Object.entries(matchResultVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'X';

  return {
    agentEvaluation: {
      stats: {
        reliability: agentResults.stats ? 80 : 0,
        confidence: agentResults.stats?.confidence || 0,
        strengths: agentResults.stats ? ['İstatistiksel veri'] : [],
        weaknesses: [],
        weight: agentResults.stats ? 30 : 0
      },
      odds: {
        reliability: agentResults.odds ? 85 : 0,
        confidence: agentResults.odds?.confidence || 0,
        strengths: agentResults.odds ? ['Oran analizi'] : [],
        weaknesses: [],
        weight: agentResults.odds ? 35 : 0
      },
      sentiment: {
        reliability: agentResults.sentiment ? 70 : 0,
        confidence: 0,
        strengths: agentResults.sentiment ? ['Psikolojik faktörler'] : [],
        weaknesses: [],
        weight: agentResults.sentiment ? 15 : 0
      },
      deepAnalysis: {
        reliability: agentResults.deepAnalysis ? 85 : 0,
        confidence: agentResults.deepAnalysis?.matchResult?.confidence || 0,
        strengths: agentResults.deepAnalysis ? ['Derin analiz'] : [],
        weaknesses: [],
        weight: agentResults.deepAnalysis ? 20 : 0
      }
    },
    conflictAnalysis: {
      conflicts: [],
      strongSignals: []
    },
    finalConsensus: {
      matchResult: {
        prediction: finalMR,
        confidence: 60,
        reasoning: 'Fallback konsensüs',
        agentWeights: { stats: 30, odds: 35, sentiment: 15, deepAnalysis: 20 }
      },
      overUnder: {
        prediction: agentResults.stats?.overUnder || 'Over',
        confidence: 60,
        reasoning: 'Fallback konsensüs',
        agentWeights: { stats: 30, odds: 35, sentiment: 15, deepAnalysis: 20 }
      },
      btts: {
        prediction: agentResults.stats?.btts || 'No',
        confidence: 60,
        reasoning: 'Fallback konsensüs',
        agentWeights: { stats: 30, odds: 35, sentiment: 15, deepAnalysis: 20 }
      }
    },
    bestBets: [{
      rank: 1,
      market: 'Over/Under 2.5',
      selection: agentResults.stats?.overUnder || 'Over',
      confidence: 60,
      value: 'medium',
      reasoning: 'Fallback tahmin',
      recommendedStake: 'low-medium'
    }],
    riskAssessment: {
      overallRisk: 'medium',
      factors: [],
      warnings: ['Fallback mode - agent çıktıları analiz edilemedi']
    },
    agentFeedback: {},
    masterInsights: [],
    overallConfidence: 60,
    recommendation: language === 'tr' 
      ? 'Fallback mode - Dikkatli ol'
      : 'Fallback mode - Be careful'
  };
}
