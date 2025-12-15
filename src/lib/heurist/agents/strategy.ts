// src/lib/heurist/agents/strategy.ts
// Advanced Strategy Agent v2.0 - Uses ALL available data
// ═══════════════════════════════════════════════════════════════════════════════

import { heurist, HeuristMessage } from '../client';
import { MatchData } from '../types';

// ==================== PROMPTS ====================

const PROMPTS = {
  tr: `Sen PROFESYONEL bir bahis strateji uzmanısın. TÜM agent verilerini ve AI konsensüsünü sentezle.

KULLANACAĞIN VERİLER:
1. DeepAnalysis Agent - Derin maç analizi
2. Stats Agent - İstatistiksel analiz  
3. Odds Agent - Oran ve value analizi
4. Sentiment Agent - Psikolojik faktörler, sakatlıklar, moral
5. Multi-Model AI - 3 farklı AI'ın konsensüsü
6. Professional Calc - Venue-specific hesaplamalar

ANALİZ KURALLARI:
- Tüm agentları ve AI modellerini değerlendir
- Psikolojik faktörleri (moral, sakatlık, baskı) dikkate al
- Venue-specific (ev/deplasman) istatistiklerini kullan
- Sharp money sinyallerini kontrol et
- Risk/ödül dengesini hesapla

PUANLAMA SİSTEMİ:
- 4+ agent/AI hemfikir → GÜÇLÜ SİNYAL (+15 puan)
- 3 agent/AI hemfikir → ORTA SİNYAL (+10 puan)
- Sharp money onayı → +10 puan
- Yüksek moral avantajı → +5 puan
- Kritik sakatlık → -10 puan
- Yönetici baskısı → -5 puan

JSON DÖNDÜR:
{
  "masterAnalysis": {
    "summary": "Tüm verilerin özeti",
    "keyFactors": ["En önemli 5 faktör"],
    "concerns": ["Endişe verici faktörler"]
  },
  "consensus": {
    "overUnder": { "prediction": "Over/Under", "agree": "X/6", "confidence": 75, "reasoning": "Detaylı açıklama" },
    "matchResult": { "prediction": "1/X/2", "agree": "X/6", "confidence": 70, "reasoning": "Detaylı açıklama" },
    "btts": { "prediction": "Yes/No", "agree": "X/6", "confidence": 72, "reasoning": "Detaylı açıklama" }
  },
  "riskAssessment": {
    "level": "Düşük/Orta/Yüksek",
    "score": 75,
    "factors": ["Risk faktörleri"]
  },
  "recommendedBets": [
    {
      "rank": 1,
      "type": "Over/Under 2.5",
      "selection": "Over",
      "confidence": 78,
      "reasoning": "🎯 Detaylı analiz...",
      "agentSupport": ["DeepAnalysis", "Stats", "AI-GPT", "AI-Claude"],
      "valueScore": 8,
      "riskScore": 3
    }
  ],
  "avoidBets": ["Kaçınılacak bahisler ve nedenleri"],
  "stakeSuggestion": {
    "level": "Düşük/Orta/Yüksek/Çok Yüksek",
    "percentage": "2-5%",
    "reasoning": "Stake açıklaması"
  },
  "specialAlerts": ["Özel uyarılar (sakatlık, sharp money, vs)"],
  "agentSummary": "🎯 MASTER STRATEGY: [Final özet]"
}`,

  en: `You are a PROFESSIONAL betting strategy expert. Synthesize ALL agent data and AI consensus.

DATA SOURCES:
1. DeepAnalysis Agent - Deep match analysis
2. Stats Agent - Statistical analysis
3. Odds Agent - Odds and value analysis
4. Sentiment Agent - Psychological factors, injuries, morale
5. Multi-Model AI - 3 different AI consensus
6. Professional Calc - Venue-specific calculations

ANALYSIS RULES:
- Evaluate all agents and AI models
- Consider psychological factors (morale, injuries, pressure)
- Use venue-specific (home/away) statistics
- Check sharp money signals
- Calculate risk/reward balance

SCORING SYSTEM:
- 4+ agents/AI agree → STRONG SIGNAL (+15 points)
- 3 agents/AI agree → MEDIUM SIGNAL (+10 points)
- Sharp money confirmation → +10 points
- High morale advantage → +5 points
- Critical injury → -10 points
- Manager pressure → -5 points

RETURN JSON with comprehensive analysis.`,

  de: `Du bist ein PROFESSIONELLER Wett-Strategie-Experte. Synthetisiere ALLE Agent-Daten.

Analysiere alle Quellen und gib JSON mit detaillierter Begründung zurück.`
};

// ==================== COMPREHENSIVE CONSENSUS CALCULATOR ====================

interface ComprehensiveConsensus {
  overUnder: {
    prediction: string;
    votes: { agent: string; prediction: string; confidence: number }[];
    totalAgree: number;
    totalSources: number;
    avgConfidence: number;
    reasoning: string;
  };
  matchResult: {
    prediction: string;
    votes: { agent: string; prediction: string; confidence: number }[];
    totalAgree: number;
    totalSources: number;
    avgConfidence: number;
    reasoning: string;
  };
  btts: {
    prediction: string;
    votes: { agent: string; prediction: string; confidence: number }[];
    totalAgree: number;
    totalSources: number;
    avgConfidence: number;
    reasoning: string;
  };
}

function calculateComprehensiveConsensus(
  deepAnalysis: any,
  stats: any,
  odds: any,
  sentiment: any,
  multiModel: any,
  professionalCalc: any,
  language: 'tr' | 'en' | 'de'
): ComprehensiveConsensus {
  
  // ═══════════════════════════════════════════════════════════════
  // OVER/UNDER CONSENSUS (6 kaynak)
  // ═══════════════════════════════════════════════════════════════
  
  const overUnderVotes: { agent: string; prediction: string; confidence: number }[] = [];
  
  // 1. DeepAnalysis
  const deepOU = deepAnalysis?.overUnder?.prediction?.toLowerCase() || '';
  if (deepOU) {
    overUnderVotes.push({
      agent: 'DeepAnalysis',
      prediction: deepOU.includes('over') ? 'Over' : 'Under',
      confidence: deepAnalysis?.overUnder?.confidence || 60
    });
  }
  
  // 2. Stats Agent
  const statsOU = stats?.overUnder?.toLowerCase() || '';
  if (statsOU) {
    overUnderVotes.push({
      agent: 'Stats',
      prediction: statsOU.includes('over') ? 'Over' : 'Under',
      confidence: stats?.overUnderConfidence || 60
    });
  }
  
  // 3. Odds Agent
  const oddsOU = odds?.recommendation?.toLowerCase() || '';
  if (oddsOU) {
    overUnderVotes.push({
      agent: 'Odds',
      prediction: oddsOU.includes('over') ? 'Over' : 'Under',
      confidence: odds?.confidence || 60
    });
  }
  
  // 4. Professional Calc (venue-based)
  const profOU = professionalCalc?.overUnder?.prediction || '';
  if (profOU) {
    overUnderVotes.push({
      agent: 'ProfCalc',
      prediction: profOU,
      confidence: professionalCalc?.overUnder?.confidence || 60
    });
  }
  
  // 5-7. Multi-Model AI (3 models)
  if (multiModel?.predictions) {
    for (const pred of multiModel.predictions) {
      const aiOU = pred.overUnder?.toLowerCase() || '';
      if (aiOU) {
        overUnderVotes.push({
          agent: `AI-${pred.model?.split('-')[0] || 'Model'}`,
          prediction: aiOU.includes('over') ? 'Over' : 'Under',
          confidence: pred.confidence || 60
        });
      }
    }
  }
  
  // Calculate Over/Under winner
  const overCount = overUnderVotes.filter(v => v.prediction === 'Over').length;
  const underCount = overUnderVotes.filter(v => v.prediction === 'Under').length;
  const ouWinner = overCount >= underCount ? 'Over' : 'Under';
  const ouAgree = Math.max(overCount, underCount);
  const ouAvgConf = overUnderVotes.length > 0 
    ? Math.round(overUnderVotes.filter(v => v.prediction === ouWinner).reduce((a, b) => a + b.confidence, 0) / ouAgree)
    : 55;
  
  // ═══════════════════════════════════════════════════════════════
  // MATCH RESULT CONSENSUS
  // ═══════════════════════════════════════════════════════════════
  
  const matchResultVotes: { agent: string; prediction: string; confidence: number }[] = [];
  
  // Similar logic for match result...
  const deepMR = deepAnalysis?.matchResult?.prediction?.toUpperCase() || '';
  if (deepMR) {
    let pred = 'X';
    if (deepMR.includes('1') || deepMR.includes('HOME')) pred = '1';
    else if (deepMR.includes('2') || deepMR.includes('AWAY')) pred = '2';
    matchResultVotes.push({ agent: 'DeepAnalysis', prediction: pred, confidence: deepAnalysis?.matchResult?.confidence || 55 });
  }
  
  const statsMR = stats?.matchResult?.toUpperCase() || '';
  if (statsMR) {
    let pred = 'X';
    if (statsMR.includes('1') || statsMR.includes('HOME')) pred = '1';
    else if (statsMR.includes('2') || statsMR.includes('AWAY')) pred = '2';
    matchResultVotes.push({ agent: 'Stats', prediction: pred, confidence: stats?.matchResultConfidence || 55 });
  }
  
  const oddsMR = odds?.matchWinnerValue?.toLowerCase() || '';
  if (oddsMR) {
    let pred = 'X';
    if (oddsMR.includes('home') || oddsMR.includes('1')) pred = '1';
    else if (oddsMR.includes('away') || oddsMR.includes('2')) pred = '2';
    matchResultVotes.push({ agent: 'Odds', prediction: pred, confidence: odds?.confidence || 55 });
  }
  
  // Sentiment-based adjustment
  if (sentiment?.psychologicalEdge?.team) {
    const edge = sentiment.psychologicalEdge;
    if (edge.team === 'home' && edge.confidence >= 65) {
      matchResultVotes.push({ agent: 'Sentiment', prediction: '1', confidence: edge.confidence });
    } else if (edge.team === 'away' && edge.confidence >= 65) {
      matchResultVotes.push({ agent: 'Sentiment', prediction: '2', confidence: edge.confidence });
    }
  }
  
  // Multi-Model AI
  if (multiModel?.predictions) {
    for (const pred of multiModel.predictions) {
      const aiMR = pred.matchResult?.toUpperCase() || '';
      if (aiMR) {
        let p = 'X';
        if (aiMR.includes('1') || aiMR.includes('HOME')) p = '1';
        else if (aiMR.includes('2') || aiMR.includes('AWAY')) p = '2';
        matchResultVotes.push({ agent: `AI-${pred.model?.split('-')[0] || 'Model'}`, prediction: p, confidence: pred.confidence || 55 });
      }
    }
  }
  
  // Calculate Match Result winner
  const mrCounts: Record<string, number> = { '1': 0, 'X': 0, '2': 0 };
  matchResultVotes.forEach(v => mrCounts[v.prediction]++);
  const mrWinner = Object.entries(mrCounts).sort((a, b) => b[1] - a[1])[0][0];
  const mrAgree = mrCounts[mrWinner];
  const mrAvgConf = matchResultVotes.length > 0
    ? Math.round(matchResultVotes.filter(v => v.prediction === mrWinner).reduce((a, b) => a + b.confidence, 0) / mrAgree)
    : 50;
  
  // ═══════════════════════════════════════════════════════════════
  // BTTS CONSENSUS
  // ═══════════════════════════════════════════════════════════════
  
  const bttsVotes: { agent: string; prediction: string; confidence: number }[] = [];
  
  const deepBtts = deepAnalysis?.btts?.prediction?.toLowerCase() || '';
  if (deepBtts) {
    bttsVotes.push({
      agent: 'DeepAnalysis',
      prediction: deepBtts.includes('yes') || deepBtts.includes('var') ? 'Yes' : 'No',
      confidence: deepAnalysis?.btts?.confidence || 60
    });
  }
  
  const statsBtts = stats?.btts?.toLowerCase() || '';
  if (statsBtts) {
    bttsVotes.push({
      agent: 'Stats',
      prediction: statsBtts.includes('yes') || statsBtts.includes('var') ? 'Yes' : 'No',
      confidence: stats?.bttsConfidence || 60
    });
  }
  
  const oddsBtts = odds?.bttsValue?.toLowerCase() || '';
  if (oddsBtts) {
    bttsVotes.push({
      agent: 'Odds',
      prediction: oddsBtts.includes('yes') || oddsBtts.includes('var') ? 'Yes' : 'No',
      confidence: odds?.confidence || 60
    });
  }
  
  // Multi-Model AI
  if (multiModel?.predictions) {
    for (const pred of multiModel.predictions) {
      const aiBtts = pred.btts?.toLowerCase() || '';
      if (aiBtts) {
        bttsVotes.push({
          agent: `AI-${pred.model?.split('-')[0] || 'Model'}`,
          prediction: aiBtts.includes('yes') || aiBtts.includes('var') ? 'Yes' : 'No',
          confidence: pred.confidence || 60
        });
      }
    }
  }
  
  // Calculate BTTS winner
  const bttsYes = bttsVotes.filter(v => v.prediction === 'Yes').length;
  const bttsNo = bttsVotes.filter(v => v.prediction === 'No').length;
  const bttsWinner = bttsYes >= bttsNo ? 'Yes' : 'No';
  const bttsAgree = Math.max(bttsYes, bttsNo);
  const bttsAvgConf = bttsVotes.length > 0
    ? Math.round(bttsVotes.filter(v => v.prediction === bttsWinner).reduce((a, b) => a + b.confidence, 0) / bttsAgree)
    : 55;
  
  // ═══════════════════════════════════════════════════════════════
  // REASONING GENERATION
  // ═══════════════════════════════════════════════════════════════
  
  const reasoningTemplates = {
    tr: {
      strong: (count: number, total: number, supporters: string[]) => 
        `🎯 GÜÇLÜ SİNYAL! ${count}/${total} kaynak hemfikir (${supporters.join(', ')}). Yüksek güvenle oyna.`,
      medium: (count: number, total: number, supporters: string[]) => 
        `✅ İYİ SİNYAL. ${count}/${total} kaynak destekliyor (${supporters.join(', ')}). Makul güvenle oyna.`,
      weak: (count: number, total: number) => 
        `⚠️ ZAYIF SİNYAL. Sadece ${count}/${total} kaynak destekliyor. Dikkatli ol.`
    },
    en: {
      strong: (count: number, total: number, supporters: string[]) => 
        `🎯 STRONG SIGNAL! ${count}/${total} sources agree (${supporters.join(', ')}). Play with high confidence.`,
      medium: (count: number, total: number, supporters: string[]) => 
        `✅ GOOD SIGNAL. ${count}/${total} sources support (${supporters.join(', ')}). Play with reasonable confidence.`,
      weak: (count: number, total: number) => 
        `⚠️ WEAK SIGNAL. Only ${count}/${total} sources support. Be careful.`
    },
    de: {
      strong: (count: number, total: number, supporters: string[]) => 
        `🎯 STARKES SIGNAL! ${count}/${total} Quellen einig (${supporters.join(', ')}).`,
      medium: (count: number, total: number, supporters: string[]) => 
        `✅ GUTES SIGNAL. ${count}/${total} Quellen unterstützen (${supporters.join(', ')}).`,
      weak: (count: number, total: number) => 
        `⚠️ SCHWACHES SIGNAL. Nur ${count}/${total} Quellen.`
    }
  };
  
  const t = reasoningTemplates[language];
  
  const generateReasoning = (
    agree: number, 
    total: number, 
    votes: { agent: string; prediction: string; confidence: number }[],
    winner: string
  ): string => {
    const supporters = votes.filter(v => v.prediction === winner).map(v => v.agent);
    if (agree >= 4) return t.strong(agree, total, supporters);
    if (agree >= 3) return t.medium(agree, total, supporters);
    return t.weak(agree, total);
  };
  
  return {
    overUnder: {
      prediction: ouWinner,
      votes: overUnderVotes,
      totalAgree: ouAgree,
      totalSources: overUnderVotes.length,
      avgConfidence: ouAvgConf,
      reasoning: generateReasoning(ouAgree, overUnderVotes.length, overUnderVotes, ouWinner)
    },
    matchResult: {
      prediction: mrWinner,
      votes: matchResultVotes,
      totalAgree: mrAgree,
      totalSources: matchResultVotes.length,
      avgConfidence: mrAvgConf,
      reasoning: generateReasoning(mrAgree, matchResultVotes.length, matchResultVotes, mrWinner)
    },
    btts: {
      prediction: bttsWinner,
      votes: bttsVotes,
      totalAgree: bttsAgree,
      totalSources: bttsVotes.length,
      avgConfidence: bttsAvgConf,
      reasoning: generateReasoning(bttsAgree, bttsVotes.length, bttsVotes, bttsWinner)
    }
  };
}

// ==================== RISK CALCULATOR ====================

function calculateAdvancedRisk(
  consensus: ComprehensiveConsensus,
  sentiment: any,
  odds: any,
  language: 'tr' | 'en' | 'de'
): { level: string; score: number; factors: string[] } {
  
  let riskScore = 50; // Base score
  const factors: string[] = [];
  
  const factorTexts = {
    tr: {
      highConsensus: 'Yüksek konsensüs (-15 risk)',
      mediumConsensus: 'Orta konsensüs (-5 risk)',
      lowConsensus: 'Düşük konsensüs (+15 risk)',
      injuryHome: (count: number) => `Ev sahibi ${count} eksik (+10 risk)`,
      injuryAway: (count: number) => `Deplasman ${count} eksik (+10 risk)`,
      highPressureHome: 'Ev sahibi yönetici baskıda (+5 risk)',
      highPressureAway: 'Deplasman yönetici baskıda (+5 risk)',
      sharpMoney: 'Sharp money onayı (-10 risk)',
      valueFound: 'Value bet bulundu (-5 risk)',
      noValue: 'Value bulunamadı (+5 risk)',
      psychEdge: (team: string) => `Psikolojik avantaj: ${team} (-5 risk)`
    },
    en: {
      highConsensus: 'High consensus (-15 risk)',
      mediumConsensus: 'Medium consensus (-5 risk)',
      lowConsensus: 'Low consensus (+15 risk)',
      injuryHome: (count: number) => `Home team ${count} players out (+10 risk)`,
      injuryAway: (count: number) => `Away team ${count} players out (+10 risk)`,
      highPressureHome: 'Home manager under pressure (+5 risk)',
      highPressureAway: 'Away manager under pressure (+5 risk)',
      sharpMoney: 'Sharp money confirmation (-10 risk)',
      valueFound: 'Value bet found (-5 risk)',
      noValue: 'No value found (+5 risk)',
      psychEdge: (team: string) => `Psychological edge: ${team} (-5 risk)`
    },
    de: {
      highConsensus: 'Hoher Konsens (-15 Risiko)',
      mediumConsensus: 'Mittlerer Konsens (-5 Risiko)',
      lowConsensus: 'Niedriger Konsens (+15 Risiko)',
      injuryHome: (count: number) => `Heimteam ${count} Spieler fehlen (+10 Risiko)`,
      injuryAway: (count: number) => `Auswärtsteam ${count} Spieler fehlen (+10 Risiko)`,
      highPressureHome: 'Heimtrainer unter Druck (+5 Risiko)',
      highPressureAway: 'Auswärtstrainer unter Druck (+5 Risiko)',
      sharpMoney: 'Sharp Money Bestätigung (-10 Risiko)',
      valueFound: 'Value Bet gefunden (-5 Risiko)',
      noValue: 'Kein Value gefunden (+5 Risiko)',
      psychEdge: (team: string) => `Psychologischer Vorteil: ${team} (-5 Risiko)`
    }
  };
  
  const ft = factorTexts[language];
  
  // Consensus impact
  const totalAgree = consensus.overUnder.totalAgree + consensus.matchResult.totalAgree + consensus.btts.totalAgree;
  const totalSources = consensus.overUnder.totalSources + consensus.matchResult.totalSources + consensus.btts.totalSources;
  const consensusRatio = totalAgree / Math.max(totalSources, 1);
  
  if (consensusRatio >= 0.7) {
    riskScore -= 15;
    factors.push(ft.highConsensus);
  } else if (consensusRatio >= 0.5) {
    riskScore -= 5;
    factors.push(ft.mediumConsensus);
  } else {
    riskScore += 15;
    factors.push(ft.lowConsensus);
  }
  
  // Injury impact
  const homeInjuries = sentiment?.homeTeam?.injuries?.out?.length || 0;
  const awayInjuries = sentiment?.awayTeam?.injuries?.out?.length || 0;
  
  if (homeInjuries >= 2) {
    riskScore += 10;
    factors.push(ft.injuryHome(homeInjuries));
  }
  if (awayInjuries >= 2) {
    riskScore += 10;
    factors.push(ft.injuryAway(awayInjuries));
  }
  
  // Manager pressure
  if (sentiment?.homeTeam?.managerSituation?.pressure === 'high') {
    riskScore += 5;
    factors.push(ft.highPressureHome);
  }
  if (sentiment?.awayTeam?.managerSituation?.pressure === 'high') {
    riskScore += 5;
    factors.push(ft.highPressureAway);
  }
  
  // Sharp money
  if (odds?.hasSharpConfirmation) {
    riskScore -= 10;
    factors.push(ft.sharpMoney);
  }
  
  // Value bets
  if (odds?.valueBets && odds.valueBets.length > 0) {
    riskScore -= 5;
    factors.push(ft.valueFound);
  } else {
    riskScore += 5;
    factors.push(ft.noValue);
  }
  
  // Psychological edge
  if (sentiment?.psychologicalEdge?.confidence >= 70) {
    riskScore -= 5;
    factors.push(ft.psychEdge(sentiment.psychologicalEdge.team));
  }
  
  // Clamp score
  riskScore = Math.max(10, Math.min(90, riskScore));
  
  // Determine level
  let level = 'Medium';
  if (riskScore <= 35) level = language === 'tr' ? 'Düşük' : language === 'de' ? 'Niedrig' : 'Low';
  else if (riskScore >= 65) level = language === 'tr' ? 'Yüksek' : language === 'de' ? 'Hoch' : 'High';
  else level = language === 'tr' ? 'Orta' : language === 'de' ? 'Mittel' : 'Medium';
  
  return { level, score: riskScore, factors };
}

// ==================== STAKE CALCULATOR ====================

function calculateStakeSuggestion(
  riskScore: number,
  consensus: ComprehensiveConsensus,
  language: 'tr' | 'en' | 'de'
): { level: string; percentage: string; reasoning: string } {
  
  const avgConfidence = (consensus.overUnder.avgConfidence + consensus.matchResult.avgConfidence + consensus.btts.avgConfidence) / 3;
  const avgAgree = (consensus.overUnder.totalAgree + consensus.matchResult.totalAgree + consensus.btts.totalAgree) / 3;
  
  let level: string;
  let percentage: string;
  let reasoning: string;
  
  const templates = {
    tr: {
      veryHigh: { level: 'Çok Yüksek', pct: '4-5%', reason: 'Mükemmel konsensüs ve düşük risk. Agresif stake önerilir.' },
      high: { level: 'Yüksek', pct: '3-4%', reason: 'Güçlü konsensüs. Normal üstü stake uygun.' },
      medium: { level: 'Orta', pct: '2-3%', reason: 'Kabul edilebilir risk. Standart stake önerilir.' },
      low: { level: 'Düşük', pct: '1-2%', reason: 'Yüksek risk veya düşük konsensüs. Küçük stake önerilir.' },
      veryLow: { level: 'Çok Düşük', pct: '0.5-1%', reason: 'Çok riskli. Minimum stake veya pas geç.' }
    },
    en: {
      veryHigh: { level: 'Very High', pct: '4-5%', reason: 'Excellent consensus and low risk. Aggressive stake recommended.' },
      high: { level: 'High', pct: '3-4%', reason: 'Strong consensus. Above normal stake appropriate.' },
      medium: { level: 'Medium', pct: '2-3%', reason: 'Acceptable risk. Standard stake recommended.' },
      low: { level: 'Low', pct: '1-2%', reason: 'High risk or low consensus. Small stake recommended.' },
      veryLow: { level: 'Very Low', pct: '0.5-1%', reason: 'Very risky. Minimum stake or skip.' }
    },
    de: {
      veryHigh: { level: 'Sehr Hoch', pct: '4-5%', reason: 'Ausgezeichneter Konsens. Aggressiver Einsatz empfohlen.' },
      high: { level: 'Hoch', pct: '3-4%', reason: 'Starker Konsens. Überdurchschnittlicher Einsatz.' },
      medium: { level: 'Mittel', pct: '2-3%', reason: 'Akzeptables Risiko. Standardeinsatz empfohlen.' },
      low: { level: 'Niedrig', pct: '1-2%', reason: 'Hohes Risiko. Kleiner Einsatz empfohlen.' },
      veryLow: { level: 'Sehr Niedrig', pct: '0.5-1%', reason: 'Sehr riskant. Minimaler Einsatz oder überspringen.' }
    }
  };
  
  const t = templates[language];
  
  if (riskScore <= 30 && avgConfidence >= 70 && avgAgree >= 3) {
    return t.veryHigh;
  } else if (riskScore <= 40 && avgConfidence >= 65) {
    return t.high;
  } else if (riskScore <= 55 && avgConfidence >= 55) {
    return t.medium;
  } else if (riskScore <= 70) {
    return t.low;
  } else {
    return t.veryLow;
  }
}

// ==================== MAIN STRATEGY AGENT ====================

export async function runStrategyAgent(
  matchData: MatchData,
  previousReports: { 
    deepAnalysis?: any; 
    stats?: any; 
    odds?: any; 
    sentiment?: any;
  },
  multiModel?: any,
  professionalCalc?: any,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('\n🧠 STRATEGY AGENT v2.0 - Comprehensive Analysis');
  console.log('═'.repeat(50));
  
  const { deepAnalysis, stats, odds, sentiment } = previousReports;
  
  // Calculate comprehensive consensus
  const consensus = calculateComprehensiveConsensus(
    deepAnalysis, stats, odds, sentiment, multiModel, professionalCalc, language
  );
  
  console.log(`   📊 Over/Under: ${consensus.overUnder.prediction} (${consensus.overUnder.totalAgree}/${consensus.overUnder.totalSources} agree)`);
  console.log(`   📊 Match Result: ${consensus.matchResult.prediction} (${consensus.matchResult.totalAgree}/${consensus.matchResult.totalSources} agree)`);
  console.log(`   📊 BTTS: ${consensus.btts.prediction} (${consensus.btts.totalAgree}/${consensus.btts.totalSources} agree)`);
  
  // Calculate risk
  const risk = calculateAdvancedRisk(consensus, sentiment, odds, language);
  console.log(`   ⚠️ Risk: ${risk.level} (${risk.score}/100)`);
  
  // Calculate stake
  const stake = calculateStakeSuggestion(risk.score, consensus, language);
  console.log(`   💰 Stake: ${stake.level} (${stake.percentage})`);
  
  // Build recommended bets
  const allBets = [
    {
      rank: 1,
      type: 'Over/Under 2.5',
      selection: consensus.overUnder.prediction,
      confidence: consensus.overUnder.avgConfidence,
      agree: consensus.overUnder.totalAgree,
      total: consensus.overUnder.totalSources,
      reasoning: consensus.overUnder.reasoning,
      supporters: consensus.overUnder.votes.filter(v => v.prediction === consensus.overUnder.prediction).map(v => v.agent),
      valueScore: odds?.realValueChecks?.over25?.isValue ? 8 : 5,
      riskScore: Math.round(risk.score / 10)
    },
    {
      rank: 2,
      type: language === 'tr' ? 'Maç Sonucu' : 'Match Result',
      selection: `MS ${consensus.matchResult.prediction}`,
      confidence: consensus.matchResult.avgConfidence,
      agree: consensus.matchResult.totalAgree,
      total: consensus.matchResult.totalSources,
      reasoning: consensus.matchResult.reasoning,
      supporters: consensus.matchResult.votes.filter(v => v.prediction === consensus.matchResult.prediction).map(v => v.agent),
      valueScore: odds?.realValueChecks?.home?.isValue || odds?.realValueChecks?.away?.isValue ? 7 : 4,
      riskScore: Math.round(risk.score / 10)
    },
    {
      rank: 3,
      type: 'BTTS',
      selection: consensus.btts.prediction === 'Yes' ? (language === 'tr' ? 'KG Var' : 'Yes') : (language === 'tr' ? 'KG Yok' : 'No'),
      confidence: consensus.btts.avgConfidence,
      agree: consensus.btts.totalAgree,
      total: consensus.btts.totalSources,
      reasoning: consensus.btts.reasoning,
      supporters: consensus.btts.votes.filter(v => v.prediction === consensus.btts.prediction).map(v => v.agent),
      valueScore: odds?.realValueChecks?.btts?.isValue ? 8 : 5,
      riskScore: Math.round(risk.score / 10)
    }
  ];
  
  // Sort by (agree * 20 + confidence + valueScore * 3)
  allBets.sort((a, b) => {
    const scoreA = a.agree * 20 + a.confidence + a.valueScore * 3;
    const scoreB = b.agree * 20 + b.confidence + b.valueScore * 3;
    return scoreB - scoreA;
  });
  
  // Update ranks after sorting
  allBets.forEach((bet, i) => bet.rank = i + 1);
  
  // Special alerts
  const specialAlerts: string[] = [];
  
  if (sentiment?.criticalWarnings) {
    specialAlerts.push(...sentiment.criticalWarnings);
  }
  
  if (odds?.hasSharpConfirmation) {
    specialAlerts.push(language === 'tr' 
      ? `💰 SHARP MONEY: ${odds.sharpMoneyAnalysis?.direction} yönünde hareket!`
      : `💰 SHARP MONEY: Movement towards ${odds.sharpMoneyAnalysis?.direction}!`);
  }
  
  if (multiModel?.modelAgreement === 100) {
    specialAlerts.push(language === 'tr'
      ? '🤖 3/3 AI model tamamen hemfikir!'
      : '🤖 3/3 AI models fully agree!');
  }
  
  // Generate summary
  const summaryTemplates = {
    tr: `🎯 MASTER STRATEGY: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].agree}/${allBets[0].total} kaynak, %${allBets[0].confidence} güven). Risk: ${risk.level}. Stake: ${stake.level}.`,
    en: `🎯 MASTER STRATEGY: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].agree}/${allBets[0].total} sources, ${allBets[0].confidence}% confidence). Risk: ${risk.level}. Stake: ${stake.level}.`,
    de: `🎯 MASTER STRATEGY: ${allBets[0].type} - ${allBets[0].selection} (${allBets[0].agree}/${allBets[0].total} Quellen, ${allBets[0].confidence}% Vertrauen). Risiko: ${risk.level}. Einsatz: ${stake.level}.`
  };
  
  const result = {
    masterAnalysis: {
      summary: language === 'tr' 
        ? `${matchData.homeTeam} vs ${matchData.awayTeam} için ${allBets.filter(b => b.agree >= 3).length} güçlü sinyal bulundu.`
        : `${allBets.filter(b => b.agree >= 3).length} strong signals found for ${matchData.homeTeam} vs ${matchData.awayTeam}.`,
      keyFactors: [
        ...allBets.filter(b => b.agree >= 3).map(b => `${b.type}: ${b.selection} (${b.agree}/${b.total})`),
        ...(sentiment?.keyInsights?.slice(0, 2) || [])
      ],
      concerns: risk.factors.filter(f => f.includes('+'))
    },
    consensus: {
      overUnder: {
        prediction: consensus.overUnder.prediction,
        agree: `${consensus.overUnder.totalAgree}/${consensus.overUnder.totalSources}`,
        confidence: consensus.overUnder.avgConfidence,
        reasoning: consensus.overUnder.reasoning,
        votes: consensus.overUnder.votes
      },
      matchResult: {
        prediction: consensus.matchResult.prediction,
        agree: `${consensus.matchResult.totalAgree}/${consensus.matchResult.totalSources}`,
        confidence: consensus.matchResult.avgConfidence,
        reasoning: consensus.matchResult.reasoning,
        votes: consensus.matchResult.votes
      },
      btts: {
        prediction: consensus.btts.prediction,
        agree: `${consensus.btts.totalAgree}/${consensus.btts.totalSources}`,
        confidence: consensus.btts.avgConfidence,
        reasoning: consensus.btts.reasoning,
        votes: consensus.btts.votes
      }
    },
    riskAssessment: risk,
    recommendedBets: allBets.map(b => ({
      rank: b.rank,
      type: b.type,
      selection: b.selection,
      confidence: b.confidence,
      reasoning: b.reasoning,
      agentSupport: b.supporters,
      agentAgreement: `${b.agree}/${b.total}`,
      valueScore: b.valueScore,
      riskScore: b.riskScore
    })),
    avoidBets: allBets.filter(b => b.agree <= 2 && b.confidence < 55).map(b => 
      language === 'tr' 
        ? `${b.type} - Düşük konsensüs (${b.agree}/${b.total})`
        : `${b.type} - Low consensus (${b.agree}/${b.total})`
    ),
    stakeSuggestion: stake,
    specialAlerts,
    agentSummary: summaryTemplates[language],
    
    // Legacy fields for backward compatibility
    _consensus: {
      overUnderConsensus: { prediction: consensus.overUnder.prediction, confidence: consensus.overUnder.avgConfidence, agree: consensus.overUnder.totalAgree },
      matchResultConsensus: { prediction: consensus.matchResult.prediction, confidence: consensus.matchResult.avgConfidence, agree: consensus.matchResult.totalAgree },
      bttsConsensus: { prediction: consensus.btts.prediction, confidence: consensus.btts.avgConfidence, agree: consensus.btts.totalAgree }
    },
    _bestBet: allBets[0],
    _totalAgreement: consensus.overUnder.totalAgree + consensus.matchResult.totalAgree + consensus.btts.totalAgree,
    _avgConfidence: Math.round((consensus.overUnder.avgConfidence + consensus.matchResult.avgConfidence + consensus.btts.avgConfidence) / 3)
  };
  
  console.log(`   ✅ Best Bet: ${allBets[0].type} - ${allBets[0].selection}`);
  console.log(`   📝 ${result.agentSummary}`);
  console.log('═'.repeat(50));
  
  return result;
}
