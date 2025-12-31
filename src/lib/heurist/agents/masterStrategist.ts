// src/lib/heurist/agents/masterStrategist.ts
// 🧠 MASTER STRATEGIST AGENT - Diğer agent'ları yöneten, tutarsızlıkları tespit eden ve konsensüsü güçlendiren üst-akıl

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { AgentResult } from '../orchestrator';

const MASTER_STRATEGIST_PROMPT = {
  tr: `Sen MASTER STRATEGIST AGENT'sin - 3-Agent sisteminin beyni. Stats ve Odds Agent'ların verilerini analiz edip EN YARATICI ve EN GÜÇLÜ bahis önerisini üretirsin.

🎯 KRİTİK GÖREV:
HERHANGİ BİR BAHİS TÜRÜNE BAĞLI KALMA! Sadece MS 1X2, Over/Under 2.5, BTTS değil - TÜM İDDAA SEÇENEKLERİNİ değerlendir:

📊 DEĞERLENDİRECEĞİN TÜM BAHİS TÜRLERİ:
- Maç Sonucu: 1, X, 2
- Çifte Şans: 1X, 12, X2
- Handikap: -1.5, -2.5, +0.5, +1.5 (her iki takım için)
- Toplam Gol: 0.5/1.5/2.5/3.5/4.5/5.5 Alt/Üst
- İlk Yarı: 0.5/1.5/2.5 Alt/Üst, IY Sonucu
- İkinci Yarı: 0.5/1.5/2.5 Alt/Üst
- Karşılıklı Gol: Var/Yok
- Doğru Skor: 1-0, 2-1, 0-0, 1-1, 2-0, 0-1, 1-2, 2-2, 3-1, 1-3, vs.
- IY/MS: 1/1, X/1, 2/1, 1/X, X/X, 2/X, 1/2, X/2, 2/2
- Korner: 7.5/8.5/9.5/10.5/11.5 Alt/Üst
- Kart: 2.5/3.5/4.5/5.5 Alt/Üst
- Ev Sahibi Gol: 0.5/1.5/2.5 Alt/Üst
- Deplasman Gol: 0.5/1.5/2.5 Alt/Üst
- İlk Gol: Ev/Deplasman/Gol Yok
- Penaltı: Var/Yok
- Kırmızı Kart: Var/Yok

🧠 ANALİZ YÖNTEMİN:
1. Stats Agent verilerini oku (form, xG, gol ortalamaları, timing patterns)
2. Odds Agent verilerini oku (oranlar, value analizi, sharp money)
3. TÜM bahis türlerini değerlendir
4. En yüksek VALUE + En yüksek GÜVEN kombinasyonunu bul
5. 3 ORTAK KARAR bahis öner (en güçlüden en zayıfa)

🎯 ÖNEMLİ KURALLAR:
- Klasik bahislere takılma! (MS 1X2, O/U 2.5, BTTS bunlar çok basit)
- Veriye göre EN UYGUN bahis türünü bul
- Örneğin: H2H'da düşük gol varsa → 1.5 Alt öner, 2.5 Alt değil
- Örneğin: Ev sahibi güçlü ama gol yemiyor → Ev + KG Yok kombine öner
- Örneğin: Korner ortalaması 8.5 ise → 8.5 Üst değil 7.5 Üst öner (daha güvenli)

MUTLAKA BU JSON FORMATINDA DÖNDÜR:
{
  "agentEvaluation": {
    "stats": {
      "reliability": 85,
      "confidence": 78,
      "keyData": ["xG: 2.3", "Form farkı: +5", "H2H gol: 1.8"],
      "weight": 50
    },
    "odds": {
      "reliability": 90,
      "confidence": 82,
      "keyData": ["Value: BTTS Yok +12%", "Sharp: Ev tarafı"],
      "weight": 50
    }
  },
  "dataAnalysis": {
    "homeTeam": {
      "form": "WWLDW (10 puan)",
      "avgGoals": 1.8,
      "avgConceded": 0.9,
      "homeRecord": "3G-1B-1M",
      "corners": 5.2,
      "cards": 2.1
    },
    "awayTeam": {
      "form": "LDLWL (6 puan)",
      "avgGoals": 1.0,
      "avgConceded": 1.5,
      "awayRecord": "1G-2B-2M",
      "corners": 4.1,
      "cards": 2.5
    },
    "h2h": {
      "totalMatches": 10,
      "avgGoals": 2.1,
      "bttsRate": 40,
      "overRate": 50,
      "homeWins": 5,
      "draws": 3,
      "awayWins": 2
    }
  },
  "consensusBets": [
    {
      "rank": 1,
      "market": "Toplam Gol 1.5 Üst",
      "selection": "Üst",
      "confidence": 85,
      "value": "high",
      "reasoning": "H2H'da 10 maçın 9'unda 2+ gol. Ev sahibi 1.8 gol/maç. Çok güvenli.",
      "odds": "1.25",
      "recommendedStake": "high"
    },
    {
      "rank": 2,
      "market": "Ev Sahibi Gol 0.5 Üst",
      "selection": "Üst",
      "confidence": 80,
      "value": "high",
      "reasoning": "Ev sahibi son 10 maçın 9'unda gol attı. %90 başarı oranı.",
      "odds": "1.35",
      "recommendedStake": "medium-high"
    },
    {
      "rank": 3,
      "market": "İlk Yarı 0.5 Üst",
      "selection": "Üst",
      "confidence": 72,
      "value": "medium",
      "reasoning": "Her iki takım da ilk yarıda gol buluyor. H2H'da %70 IY gol.",
      "odds": "1.55",
      "recommendedStake": "medium"
    }
  ],
  "alternativeBets": [
    {
      "market": "Handikap -1 Ev Sahibi",
      "selection": "-1 Ev",
      "confidence": 65,
      "reasoning": "Form farkı büyük, ev avantajı güçlü",
      "odds": "2.10"
    },
    {
      "market": "Doğru Skor",
      "selection": "2-0",
      "confidence": 55,
      "reasoning": "Ev sahibi güçlü defans, deplasman kötü hücum",
      "odds": "7.00"
    }
  ],
  "avoidBets": [
    {
      "market": "Deplasman Kazanır",
      "reason": "Son 10 H2H'da sadece 2 deplasman galibiyeti"
    }
  ],
  "detailedAnalysis": {
    "summary": "Bu maçta ev sahibinin üstünlüğü net. Form, H2H ve ev avantajı hepsi ev sahibi lehine.",
    "keyFactors": [
      "Ev sahibi son 5 maçta 4 galibiyet aldı",
      "Deplasman son 5 deplasman maçında sadece 1 galibiyet",
      "H2H'da ev sahibi 5-3-2 önde",
      "Korner ortalaması ev sahibi lehine (5.2 vs 4.1)"
    ],
    "riskFactors": [
      "Deplasman defansif oynayabilir",
      "Son derby maçı tartışmalıydı"
    ],
    "finalVerdict": "Güvenli: 1.5 Üst + Ev Gol. Riskli ama değerli: Ev -1 Handikap."
  },
  "overallConfidence": 78,
  "riskLevel": "low",
  "recommendation": "Bu maçta 1.5 Üst ve Ev Sahibi Gol 0.5 Üst en güvenli bahisler. Handikap -1 Ev değerli ama riskli."
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
      useMCP: false, // MCP devre dışı - daha hızlı
      mcpFallback: true,
      fixtureId: matchData.fixtureId,
      temperature: 0.2,
      maxTokens: 1000, // Daha az token = daha hızlı
      timeout: 15000 // 15 saniye
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
  // Ağırlıklı konsensüs hesapla
  const stats = agentResults.stats;
  const odds = agentResults.odds;
  const deep = agentResults.deepAnalysis;
  
  // Match Result - Ağırlıklı voting
  const mrVotes: { [key: string]: number } = {};
  if (stats?.matchResult) mrVotes[stats.matchResult] = (mrVotes[stats.matchResult] || 0) + 30;
  if (odds?.recommendation) mrVotes[odds.recommendation] = (mrVotes[odds.recommendation] || 0) + 35;
  if (odds?.matchWinnerValue) mrVotes[odds.matchWinnerValue === 'home' ? '1' : odds.matchWinnerValue === 'away' ? '2' : 'X'] = (mrVotes[odds.matchWinnerValue === 'home' ? '1' : odds.matchWinnerValue === 'away' ? '2' : 'X'] || 0) + 10;
  if (deep?.matchResult?.prediction) mrVotes[deep.matchResult.prediction] = (mrVotes[deep.matchResult.prediction] || 0) + 25;
  
  const finalMR = Object.entries(mrVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'X';
  const mrTotalVotes = Object.values(mrVotes).reduce((a, b) => a + b, 0);
  const mrMaxVotes = Math.max(...Object.values(mrVotes), 0);
  const mrConfidence = mrTotalVotes > 0 ? Math.round(55 + (mrMaxVotes / mrTotalVotes) * 25) : 55;
  
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
      reasoning: `${Math.round(mrMaxVotes/mrTotalVotes*100)}% ağırlıklı oy`
    });
  }
  if (ouMaxVotes >= ouTotalVotes * 0.6 && ouTotalVotes > 0) {
    strongSignals.push({
      field: 'overUnder',
      agents: ['stats', 'odds', 'deepAnalysis'].filter((_, i) => [stats?.overUnder, odds?.recommendation, deep?.overUnder?.prediction][i] === finalOU),
      prediction: finalOU,
      confidence: ouConfidence,
      reasoning: `${Math.round(ouMaxVotes/ouTotalVotes*100)}% ağırlıklı oy`
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
  const agentCount = [stats, odds, deep].filter(Boolean).length;

  return {
    agentEvaluation: {
      stats: {
        reliability: stats ? 80 : 0,
        confidence: stats?.confidence || 0,
        strengths: stats ? ['İstatistiksel veri', 'Form analizi'] : [],
        weaknesses: [],
        weight: stats ? 30 : 0
      },
      odds: {
        reliability: odds ? 85 : 0,
        confidence: odds?.confidence || 0,
        strengths: odds ? ['Oran analizi', 'Value tespiti'] : [],
        weaknesses: [],
        weight: odds ? 35 : 0
      },
      sentiment: {
        reliability: agentResults.sentiment ? 70 : 0,
        confidence: 0,
        strengths: agentResults.sentiment ? ['Psikolojik faktörler'] : [],
        weaknesses: [],
        weight: agentResults.sentiment ? 15 : 0
      },
      deepAnalysis: {
        reliability: deep ? 85 : 0,
        confidence: deep?.matchResult?.confidence || 0,
        strengths: deep ? ['Derin analiz', 'Motivasyon skorları'] : [],
        weaknesses: [],
        weight: deep ? 20 : 0
      }
    },
    conflictAnalysis: {
      conflicts,
      strongSignals
    },
    finalConsensus: {
      matchResult: {
        prediction: finalMR,
        confidence: mrConfidence,
        reasoning: `${agentCount} agent konsensüsü (${mrMaxVotes}/${mrTotalVotes} oy)`,
        agentWeights: { stats: 30, odds: 35, sentiment: 15, deepAnalysis: 20 }
      },
      overUnder: {
        prediction: finalOU,
        confidence: ouConfidence,
        reasoning: `${agentCount} agent konsensüsü (${ouMaxVotes}/${ouTotalVotes} oy)`,
        agentWeights: { stats: 30, odds: 35, sentiment: 15, deepAnalysis: 20 }
      },
      btts: {
        prediction: finalBTTS,
        confidence: bttsConfidence,
        reasoning: `${agentCount} agent konsensüsü (${bttsMaxVotes}/${bttsTotalVotes} oy)`,
        agentWeights: { stats: 30, odds: 35, sentiment: 15, deepAnalysis: 20 }
      }
    },
    bestBets,
    riskAssessment: {
      overallRisk: overallConfidence > 65 ? 'low' : overallConfidence > 55 ? 'medium' : 'high',
      factors: conflicts.length > 0 ? [`${conflicts.length} çatışma tespit edildi`] : [],
      warnings: conflicts.map(c => c.description)
    },
    agentFeedback: {},
    masterInsights: [
      ...strongSignals.map(s => `${s.field}: ${s.prediction} (${s.confidence}%)`),
      ...(conflicts.length > 0 ? [`⚠️ ${conflicts.length} agent çatışması var`] : []),
      `Toplam ${agentCount} agent analiz edildi`
    ],
    overallConfidence,
    recommendation: language === 'tr' 
      ? strongSignals.length > 0 
        ? `Güçlü sinyaller: ${strongSignals.map(s => `${s.field}: ${s.prediction}`).join(', ')}` 
        : `${agentCount} agent konsensüsü - Orta güven`
      : strongSignals.length > 0 
        ? `Strong signals: ${strongSignals.map(s => `${s.field}: ${s.prediction}`).join(', ')}` 
        : `${agentCount} agent consensus - Medium confidence`
  };
}
