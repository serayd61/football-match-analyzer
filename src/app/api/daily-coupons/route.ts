export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const MIN_CONFIDENCE = 60; // Minimum güven oranı

// Günün maçlarını çek
async function getTodayMatches() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/between/${today}/${tomorrow}?api_token=${SPORTMONKS_API_KEY}&include=odds;league;participants&per_page=50`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Sportmonks error:', error);
    return [];
  }
}

// Oranları parse et
function parseOdds(fixture: any) {
  const odds: any = { home: null, draw: null, away: null, over25: null, under25: null, bttsYes: null, bttsNo: null };
  
  if (!fixture.odds) return odds;
  
  for (const odd of fixture.odds) {
    const market = odd.market_description?.toLowerCase() || '';
    if (market.includes('fulltime') || market.includes('1x2')) {
      if (odd.label === 'Home' || odd.label === '1') odds.home = parseFloat(odd.value);
      if (odd.label === 'Draw' || odd.label === 'X') odds.draw = parseFloat(odd.value);
      if (odd.label === 'Away' || odd.label === '2') odds.away = parseFloat(odd.value);
    }
    if (market.includes('over/under') && (odd.total === 2.5 || odd.total === '2.5')) {
      if (odd.label === 'Over') odds.over25 = parseFloat(odd.value);
      if (odd.label === 'Under') odds.under25 = parseFloat(odd.value);
    }
    if (market.includes('both teams')) {
      if (odd.label === 'Yes') odds.bttsYes = parseFloat(odd.value);
      if (odd.label === 'No') odds.bttsNo = parseFloat(odd.value);
    }
  }
  
  return odds;
}

// Tek maç için AI analizi
async function analyzeMatchWithAI(match: any, model: string): Promise<any> {
  const prompt = `Maç: ${match.home_team} vs ${match.away_team} (${match.league})
Oranlar: 1=${match.odds.home} X=${match.odds.draw} 2=${match.odds.away} | Ü2.5=${match.odds.over25} A2.5=${match.odds.under25} | KGVar=${match.odds.bttsYes}

Bu maç için EN GÜVENLİ bahis önerisini ver. Güven oranı 60-80 arasında GERÇEKÇI olsun.
SADECE JSON döndür:
{"bet_type": "MATCH_RESULT veya OVER_UNDER veya BTTS", "selection": "1/X/2/Over/Under/Yes/No", "confidence": 60-80 arası sayı}`;

  try {
    if (model === 'claude') {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const json = text.match(/\{[\s\S]*?\}/);
      return json ? JSON.parse(json[0]) : null;
    }
    
    if (model === 'gpt') {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0]?.message?.content || '{}');
    }
    
    if (model === 'gemini') {
      const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      const json = text.match(/\{[\s\S]*?\}/);
      return json ? JSON.parse(json[0]) : null;
    }
    
    if (model === 'perplexity') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      const json = text.match(/\{[\s\S]*?\}/);
      return json ? JSON.parse(json[0]) : null;
    }
  } catch (error) {
    console.error(`${model} error:`, error);
    return null;
  }
  return null;
}

// Agent analizi (Stats, Odds, Strategy)
function analyzeWithAgents(match: any): any {
  const odds = match.odds;
  
  // Stats Agent (%40) - Form ve istatistiklere dayalı
  const statsAgent = {
    bet_type: 'MATCH_RESULT',
    selection: odds.home < odds.away ? '1' : odds.away < odds.home ? '2' : 'X',
    confidence: 62
  };
  
  // Odds Agent (%35) - Oran analizine dayalı
  let oddsSelection = '1';
  let oddsType = 'MATCH_RESULT';
  let oddsConfidence = 63;
  
  if (odds.over25 && odds.over25 < 1.70) {
    oddsType = 'OVER_UNDER';
    oddsSelection = 'Over';
    oddsConfidence = 68;
  } else if (odds.under25 && odds.under25 < 1.70) {
    oddsType = 'OVER_UNDER';
    oddsSelection = 'Under';
    oddsConfidence = 66;
  } else if (odds.home < 1.50) {
    oddsSelection = '1';
    oddsConfidence = 70;
  } else if (odds.away < 1.50) {
    oddsSelection = '2';
    oddsConfidence = 70;
  }
  
  const oddsAgent = {
    bet_type: oddsType,
    selection: oddsSelection,
    confidence: oddsConfidence
  };
  
  // Strategy Agent (%25) - Value betting
  let strategySelection = 'X';
  let strategyType = 'MATCH_RESULT';
  let strategyConfidence = 60;
  
  if (odds.bttsYes && odds.bttsYes > 1.60 && odds.bttsYes < 2.00) {
    strategyType = 'BTTS';
    strategySelection = 'Yes';
    strategyConfidence = 64;
  } else if (odds.draw && odds.draw > 3.00 && odds.draw < 3.50) {
    strategySelection = 'X';
    strategyConfidence = 58;
  } else {
    strategySelection = odds.home < odds.away ? '1' : '2';
    strategyConfidence = 61;
  }
  
  const strategyAgent = {
    bet_type: strategyType,
    selection: strategySelection,
    confidence: strategyConfidence
  };
  
  return { statsAgent, oddsAgent, strategyAgent };
}

// Konsensüs hesapla
function calculateConsensus(aiResults: any[], agentResults: any): { 
  hasConsensus: boolean; 
  bet_type: string; 
  selection: string; 
  confidence: number;
  aiVotes: number;
  agentVotes: number;
} {
  // AI oylarını say
  const aiVotes: Record<string, number> = {};
  const aiConfidences: Record<string, number[]> = {};
  
  for (const ai of aiResults) {
    if (ai?.selection) {
      const key = `${ai.bet_type}-${ai.selection}`;
      aiVotes[key] = (aiVotes[key] || 0) + 1;
      if (!aiConfidences[key]) aiConfidences[key] = [];
      aiConfidences[key].push(ai.confidence || 60);
    }
  }
  
  // En çok oy alan AI tahmini
  let topAiVote = { key: '', count: 0 };
  for (const [key, count] of Object.entries(aiVotes)) {
    if (count > topAiVote.count) {
      topAiVote = { key, count };
    }
  }
  
  // Agent oylarını say
  const agents = [agentResults.statsAgent, agentResults.oddsAgent, agentResults.strategyAgent];
  const agentVotesMap: Record<string, number> = {};
  const agentConfidences: Record<string, number[]> = {};
  
  for (const agent of agents) {
    if (agent?.selection) {
      const key = `${agent.bet_type}-${agent.selection}`;
      agentVotesMap[key] = (agentVotesMap[key] || 0) + 1;
      if (!agentConfidences[key]) agentConfidences[key] = [];
      agentConfidences[key].push(agent.confidence || 60);
    }
  }
  
  // En çok oy alan Agent tahmini
  let topAgentVote = { key: '', count: 0 };
  for (const [key, count] of Object.entries(agentVotesMap)) {
    if (count > topAgentVote.count) {
      topAgentVote = { key, count };
    }
  }
  
  // Konsensüs kontrolü - AI ve Agent aynı fikirde mi?
  const hasConsensus = topAiVote.key === topAgentVote.key && topAiVote.count >= 2 && topAgentVote.count >= 2;
  
  if (hasConsensus) {
    const [bet_type, selection] = topAiVote.key.split('-');
    
    // Ortalama güveni hesapla
    const allConfidences = [
      ...(aiConfidences[topAiVote.key] || []),
      ...(agentConfidences[topAgentVote.key] || [])
    ];
    const avgConfidence = Math.round(
      allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
    );
    
    return {
      hasConsensus: true,
      bet_type,
      selection,
      confidence: avgConfidence,
      aiVotes: topAiVote.count,
      agentVotes: topAgentVote.count
    };
  }
  
  return { hasConsensus: false, bet_type: '', selection: '', confidence: 0, aiVotes: 0, agentVotes: 0 };
}

// Oran değerini al
function getOddsValue(odds: any, betType: string, selection: string): number {
  if (betType === 'MATCH_RESULT') {
    if (selection === '1') return odds.home || 1.5;
    if (selection === 'X') return odds.draw || 3.0;
    if (selection === '2') return odds.away || 2.0;
  }
  if (betType === 'OVER_UNDER') {
    if (selection === 'Over') return odds.over25 || 1.8;
    if (selection === 'Under') return odds.under25 || 2.0;
  }
  if (betType === 'BTTS') {
    if (selection === 'Yes') return odds.bttsYes || 1.8;
    if (selection === 'No') return odds.bttsNo || 2.0;
  }
  return 1.5;
}

// Kupon oluştur
function createCoupon(matches: any[], type: string, count: number, stake: number) {
  // %60 altı güveni olanları filtrele
  const filtered = matches.filter(m => m.confidence >= MIN_CONFIDENCE);
  
  if (filtered.length < count) {
    console.log(`⚠️ ${type} kupon için yeterli maç yok (${filtered.length}/${count})`);
    return null;
  }

  let selected;
  if (type === 'safe') {
    // En yüksek güvenli maçlar
    selected = filtered.slice(0, count);
  } else if (type === 'balanced') {
    // Orta güvenli maçlar
    selected = filtered.slice(Math.min(2, filtered.length - count), Math.min(2, filtered.length - count) + count);
  } else {
    // Riskli - daha düşük güvenli ama yine de %60+
    selected = filtered.slice(-count);
  }

  if (selected.length < count) {
    return null;
  }

  const totalOdds = selected.reduce((acc, m) => acc * m.odds_value, 1);
  const avgConfidence = Math.round(selected.reduce((acc, m) => acc + m.confidence, 0) / selected.length);

  // Kupon güveni de %60 altındaysa oluşturma
  if (avgConfidence < MIN_CONFIDENCE) {
    console.log(`⚠️ ${type} kupon ortalama güveni çok düşük: %${avgConfidence}`);
    return null;
  }

  return {
    matches: selected.map(m => ({
      fixture_id: m.fixture_id,
      home_team: m.home_team,
      away_team: m.away_team,
      league: m.league,
      kick_off: m.kick_off,
      bet_type: m.bet_type,
      selection: m.selection,
      odds: m.odds_value,
      confidence: m.confidence,
      aiVotes: m.aiVotes,
      agentVotes: m.agentVotes
    })),
    total_odds: Math.round(totalOdds * 100) / 100,
    confidence: avgConfidence,
    suggested_stake: stake,
    potential_win: Math.round(stake * totalOdds * 100) / 100,
    ai_reasoning: `${selected.length} maç seçildi. Tüm maçlarda AI-Agent konsensüsü var. ${selected.filter(m => m.aiVotes >= 3).length} maçta güçlü AI desteği (3+/4). Ortalama güven: %${avgConfidence}`
  };
}

// GET - Günün kuponlarını getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam || new Date().toISOString().split('T')[0];

    const { data: coupons, error } = await supabaseAdmin
      .from('daily_coupons')
      .select('*')
      .eq('date', date)
      .order('coupon_type');

    if (error) throw error;

    const result: any = { safe: null, balanced: null, risky: null, date };
    
    for (const coupon of coupons || []) {
      result[coupon.coupon_type] = {
        id: coupon.id,
        matches: coupon.matches,
        total_odds: coupon.total_odds,
        confidence: coupon.confidence,
        suggested_stake: coupon.suggested_stake,
        potential_win: coupon.potential_win,
        ai_reasoning: coupon.ai_reasoning,
        status: coupon.status,
        created_at: coupon.created_at
      };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Get daily coupons error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Günün kuponlarını oluştur
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.CRON_SECRET || 'tipster-league-secret-2024';
    
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Bugün için zaten kupon var mı?
    const { data: existing } = await supabaseAdmin
      .from('daily_coupons')
      .select('id')
      .eq('date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Coupons already exist for today', date: today });
    }

    console.log('🎯 Generating daily coupons for', today);
    console.log(`📊 Minimum confidence threshold: ${MIN_CONFIDENCE}%`);

    // Maçları çek
    const fixtures = await getTodayMatches();
    console.log(`📊 Found ${fixtures.length} fixtures`);

    if (fixtures.length < 5) {
      return NextResponse.json({ error: 'Not enough matches today', count: fixtures.length }, { status: 400 });
    }

    // Her maç için format
    const matches = fixtures.slice(0, 15).map((f: any) => {
      const odds = parseOdds(f);
      return {
        fixture_id: f.id,
        home_team: f.participants?.find((p: any) => p.meta?.location === 'home')?.name || 'Home',
        away_team: f.participants?.find((p: any) => p.meta?
