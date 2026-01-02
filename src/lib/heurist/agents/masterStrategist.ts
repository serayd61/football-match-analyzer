// src/lib/heurist/agents/masterStrategist.ts
// 🧠 MASTER STRATEGIST AGENT - Diğer agent'ları yöneten, tutarsızlıkları tespit eden ve konsensüsü güçlendiren üst-akıl

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { AgentResult } from '../orchestrator';

const MASTER_STRATEGIST_PROMPT = {
  tr: `Sen bir çok-agent futbol maç analiz sisteminin MASTER STRATEGIST'isin.

GÖREV: Diğer agent'ların (STATS, ODDS, SENTIMENT, DEEP ANALYSIS) çıktılarını analiz edip:
1. Birincil seçim (en sağlam)
2. SÜRPRİZ seçim (yüksek oran + değer) - eğer kriterleri karşılıyorsa
3. Hedge fikri (opsiyonel) - downside koruması

═══════════════════════════════════════════════════════════════════════════════
📊 SÜRPRİZ TANIMI:
═══════════════════════════════════════════════════════════════════════════════
"SÜRPRİZ" = Piyasa oranı >= 3.20 VE Model olasılığı >= 0.25 VE Edge >= +0.05

═══════════════════════════════════════════════════════════════════════════════
🎯 ANALİZ ADIMLARI:
═══════════════════════════════════════════════════════════════════════════════
1. Her agent'ı değerlendir (güvenilirlik, güven, güçlü/zayıf yönler)
2. Çelişkileri tespit et (hangi agent'lar birbiriyle çelişiyor?)
3. Güçlü sinyalleri belirle (hangi tahminlerde agent'lar hemfikir?)
4. Model olasılıklarını hesapla (agent'ların ağırlıklı ortalaması)
5. Piyasa oranlarıyla karşılaştır (edge hesapla)
6. Birincil seçimi belirle (en yüksek güven + değer)
7. SÜRPRİZ seçimi bul (oran >= 3.20, prob >= 0.25, edge >= +0.05)
8. Hedge öner (birincil seçimin tersi veya koruyucu bahis)

═══════════════════════════════════════════════════════════════════════════════
📋 ZORUNLU JSON FORMATI:
═══════════════════════════════════════════════════════════════════════════════
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

⚠️ ÖNEMLİ: SADECE bu JSON formatında döndür. Başka açıklama ekleme.

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

  en: `You are the MASTER STRATEGIST for a multi-agent football match analysis system.

TASK: Analyze outputs from other agents (STATS, ODDS, SENTIMENT, DEEP ANALYSIS) and produce:
1. Primary pick (most robust)
2. SURPRISE pick (high odds + value) - if criteria met
3. Hedge idea (optional) - protects downside

═══════════════════════════════════════════════════════════════════════════════
📊 SURPRISE DEFINITION:
═══════════════════════════════════════════════════════════════════════════════
"SURPRISE" = Market odds >= 3.20 AND Model probability >= 0.25 AND Edge >= +0.05

═══════════════════════════════════════════════════════════════════════════════
🎯 ANALYSIS STEPS:
═══════════════════════════════════════════════════════════════════════════════
1. Evaluate each agent (reliability, confidence, strengths/weaknesses)
2. Detect contradictions (which agents contradict each other?)
3. Identify strong signals (where do agents agree?)
4. Calculate model probabilities (weighted average of agents)
5. Compare with market odds (calculate edge)
6. Determine primary pick (highest confidence + value)
7. Find SURPRISE pick (odds >= 3.20, prob >= 0.25, edge >= +0.05)
8. Suggest hedge (opposite of primary or protective bet)

═══════════════════════════════════════════════════════════════════════════════
📋 REQUIRED JSON FORMAT:
═══════════════════════════════════════════════════════════════════════════════
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

⚠️ IMPORTANT: Return ONLY this JSON format. No additional explanations.

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
      maxTokens: 1200, // JSON tamamlanması için yeterli
      timeout: 10000 // 10 saniye
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
    console.log(`   🎯 Confidence: ${result.confidence}%`);
    console.log(`   📊 Primary: ${result.final.primary_pick.market} - ${result.final.primary_pick.selection}`);
    if (result.final.surprise_pick) {
      console.log(`   🎲 Surprise: ${result.final.surprise_pick.market} - ${result.final.surprise_pick.selection} @ ${result.final.surprise_pick.market_odds}`);
    }
    if (result.final.hedge) {
      console.log(`   🛡️ Hedge: ${result.final.hedge.market} - ${result.final.hedge.selection}`);
    }

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
  
  // DÜZELTME: Belirsizlik kontrolü
  const mrTotalVotes = Object.values(mrVotes).reduce((a, b) => a + b, 0);
  const mrMaxVotes = Math.max(...Object.values(mrVotes), 0);
  const mrAgreementRatio = mrTotalVotes > 0 ? mrMaxVotes / mrTotalVotes : 0;
  
  // Maç sonucu tahmini - daha akıllı mantık
  let finalMR = Object.entries(mrVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'X';
  
  // BUG FIX: finalMR sadece 1, X, 2 olabilir - başka değer gelirse X yap
  if (!['1', 'X', '2'].includes(finalMR)) {
    console.warn(`⚠️ Invalid matchResult "${finalMR}" detected, defaulting to X`);
    finalMR = 'X';
  }
  
  // DÜZELTME: Value bet varsa ve güçlüyse, onu dikkate al
  // Odds agent +15% üstü value bulmuşsa, o yönde git
  const valueAnalysis = odds?._valueAnalysis;
  const bestValueAmount = valueAnalysis?.bestValueAmount || 0;
  const bestValueDirection = valueAnalysis?.bestValue;
  
  // Eğer güçlü value bet varsa (>15%) ve agent'lar tam hemfikir değilse
  if (bestValueAmount >= 15 && mrAgreementRatio < 0.60) {
    if (bestValueDirection === 'home') finalMR = '1';
    else if (bestValueDirection === 'away') finalMR = '2';
    // Value bet X için nadiren olur, o yüzden kontrol etmiyoruz
  }
  // Eğer hiç value yok ve konsensüs zayıfsa → X
  else if (mrAgreementRatio < 0.45 && bestValueAmount < 10) {
    finalMR = 'X'; // Belirsizlik durumunda beraberlik
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
        ? `Piyasa oranı ${surprisePick.market_odds} (implied ${Math.round(1/surprisePick.market_odds*100)}%), model olasılığı ${Math.round(surprisePick.model_prob*100)}%, edge +${Math.round(surprisePick.edge*100)}%`
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
