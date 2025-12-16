export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy load AI clients to avoid build-time initialization
let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;
let _genAI: GoogleGenerativeAI | null = null;

function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getGenAI() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  return _genAI;
}

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const MIN_CONFIDENCE = 50;

// 27 Lig Paketi - Tüm desteklenen ligler
const SUPPORTED_LEAGUE_IDS = [
  8,     // Premier League (England)
  9,     // Championship (England)
  24,    // FA Cup (England)
  27,    // League Cup (England)
  72,    // Eredivisie (Netherlands)
  82,    // Bundesliga (Germany)
  181,   // Jupiler Pro League (Belgium)
  208,   // Pro League (Belgium)
  244,   // Primeira Liga (Portugal)
  271,   // Superliga (Denmark)
  301,   // Ligue 1 (France)
  384,   // Serie A (Italy)
  387,   // Serie B (Italy)
  390,   // Coppa Italia (Italy)
  444,   // Eredivisie (Netherlands alt)
  453,   // Ekstraklasa (Poland)
  462,   // Liga Portugal (Portugal)
  486,   // Premiership (Scotland)
  501,   // La Liga 2 (Spain)
  564,   // La Liga (Spain)
  567,   // Copa del Rey (Spain)
  570,   // Super Lig (Turkey)
  573,   // Turkish Cup (Turkey)
  591,   // Allsvenskan (Sweden)
  600,   // Süper Lig (Turkey alt)
  1371,  // Champions League
];

async function getTodayMatches() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const leagueFilter = SUPPORTED_LEAGUE_IDS.join(',');
  
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/between/${today}/${tomorrow}?api_token=${SPORTMONKS_API_KEY}&include=odds;league;participants&filters=fixtureLeagues:${leagueFilter}&per_page=150`
    );
    
    if (!response.ok) {
      console.error('SportMonks API error:', response.status, await response.text());
      return [];
    }
    
    const data = await response.json();
    console.log(`📊 SportMonks: ${data.data?.length || 0} maç bulundu (27 lig)`);
    return data.data || [];
  } catch (error) {
    console.error('Sportmonks error:', error);
    return [];
  }
}

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

// 🎯 CLAUDE - TACTICAL ANALYST (30% weight)
// Formasyon analizi, oyun stili, set piece, defans hattı
function getClaudePrompt(match: any): string {
  return `Sen bir TAKTİK ANALİSTİsin. Bu maçı SADECE taktiksel açıdan değerlendir.

MAÇ: ${match.home_team} vs ${match.away_team} (${match.league})
ORANLAR: Ev=${match.odds.home} | Beraberlik=${match.odds.draw} | Deplasman=${match.odds.away}
Ü2.5=${match.odds.over25} | A2.5=${match.odds.under25} | KG Var=${match.odds.bttsYes}

TAKTİKSEL ANALİZ KRİTERLERİ:
1. Formasyon uyumu (4-3-3 vs 4-4-2 gibi matchup'lar)
2. Oyun stili (yüksek pres vs kontra atak)
3. Set piece etkinliği (korner, serbest vuruş gol oranı)
4. Defans hattı yüksekliği (offside tuzağı riski)
5. Kanat oyunu vs merkez hakimiyeti

Bu kriterlere göre EN GÜVENLİ tahmini yap. Confidence 55-75 arası GERÇEKÇI olsun.
SADECE JSON döndür:
{"bet_type": "MATCH_RESULT", "selection": "1/X/2", "confidence": 55-75, "reasoning": "taktiksel neden"}`;
}

// 📊 GPT-4 - STATISTICAL SCIENTIST (30% weight)
// xG, şut kalitesi, pas istatistikleri, clean sheet
function getGPTPrompt(match: any): string {
  return `Sen bir İSTATİSTİK BİLİMCİSİsin. Bu maçı SADECE sayısal verilerle analiz et.

MAÇ: ${match.home_team} vs ${match.away_team} (${match.league})
ORANLAR: Ev=${match.odds.home} | Beraberlik=${match.odds.draw} | Deplasman=${match.odds.away}
Ü2.5=${match.odds.over25} | A2.5=${match.odds.under25} | KG Var=${match.odds.bttsYes}

İSTATİSTİKSEL ANALİZ KRİTERLERİ:
1. xG (Expected Goals) trendleri - son 5 maç ortalaması
2. Şut kalitesi metrikleri (şut/gol dönüşüm oranı)
3. Ceza sahası içi pas yüzdesi
4. Clean sheet olasılık hesabı
5. Ev/Deplasman gol ortalaması farkı

Oranlardan implied probability hesapla:
- Ev kazanma olasılığı: ${match.odds.home ? Math.round(100/match.odds.home) : '?'}%
- Beraberlik olasılığı: ${match.odds.draw ? Math.round(100/match.odds.draw) : '?'}%
- Deplasman olasılığı: ${match.odds.away ? Math.round(100/match.odds.away) : '?'}%

İstatistiksel olarak EN GÜVENLİ tahmini yap. Confidence 55-75 arası.
SADECE JSON döndür:
{"bet_type": "OVER_UNDER", "selection": "Over/Under", "confidence": 55-75, "reasoning": "istatistiksel neden"}`;
}

// 🔮 GEMINI - PATTERN HUNTER (25% weight)
// Tarihsel pattern, momentum, psikoloji, zamanlama
function getGeminiPrompt(match: any): string {
  return `Sen bir PATTERN ANALİSTİsin. Bu maçı tarihsel kalıplar ve psikolojik faktörlerle değerlendir.

MAÇ: ${match.home_team} vs ${match.away_team} (${match.league})
ORANLAR: Ev=${match.odds.home} | Beraberlik=${match.odds.draw} | Deplasman=${match.odds.away}
Ü2.5=${match.odds.over25} | A2.5=${match.odds.under25} | KG Var=${match.odds.bttsYes}

PATTERN ANALİZ KRİTERLERİ:
1. H2H tarihsel pattern (son 5 yıl, kim dominant?)
2. Ev/Deplasman form trendi (son 5 maç momentum)
3. Milli ara sonrası performans
4. Gol zamanlaması dağılımı (erken gol vs geç gol)
5. Takım motivasyonu (derbi, küme düşme, şampiyonluk yarışı)

Tarihsel kalıplara göre EN GÜVENLİ tahmini yap. Confidence 55-75 arası.
SADECE JSON döndür:
{"bet_type": "BTTS", "selection": "Yes/No", "confidence": 55-75, "reasoning": "pattern nedeni"}`;
}

// 📰 PERPLEXITY - NEWS & REAL-TIME (15% weight)
// Güncel haberler, sakatlıklar, transfer söylentileri
function getPerplexityPrompt(match: any): string {
  return `${match.home_team} vs ${match.away_team} maçı için GÜNCEL bilgileri ara:
1. Son sakatlık haberleri
2. Kadro değişiklikleri
3. Takım morali ve iç çekişmeler
4. Hava durumu etkisi
5. Hakem istatistikleri

Bu bilgilere göre maç için TAHMİN ver. Confidence 55-75.
JSON döndür:
{"bet_type": "MATCH_RESULT/OVER_UNDER/BTTS", "selection": "seçim", "confidence": 55-75, "reasoning": "güncel bilgi"}`;
}

async function analyzeMatchWithAI(match: any, model: string): Promise<any> {
  try {
    if (model === 'claude') {
      const response = await getAnthropic().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: getClaudePrompt(match) }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const json = text.match(/\{[\s\S]*?\}/);
      const result = json ? JSON.parse(json[0]) : null;
      if (result) result.weight = 0.30; // 30% ağırlık
      return result;
    }

    if (model === 'gpt') {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: getGPTPrompt(match) }],
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      if (result) result.weight = 0.30; // 30% ağırlık
      return result;
    }

    if (model === 'gemini') {
      const geminiModel = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await geminiModel.generateContent(getGeminiPrompt(match));
      const text = result.response.text();
      const json = text.match(/\{[\s\S]*?\}/);
      const parsed = json ? JSON.parse(json[0]) : null;
      if (parsed) parsed.weight = 0.25; // 25% ağırlık
      return parsed;
    }
    
    if (model === 'perplexity') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: getPerplexityPrompt(match) }],
          max_tokens: 600,
        }),
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      const json = text.match(/\{[\s\S]*?\}/);
      const parsed = json ? JSON.parse(json[0]) : null;
      if (parsed) parsed.weight = 0.15; // 15% ağırlık
      return parsed;
    }
  } catch (error) {
    console.error(`${model} error:`, error);
    return null;
  }
  return null;
}

function analyzeWithAgents(match: any): any {
  const odds = match.odds;
  
  const statsAgent = {
    bet_type: 'MATCH_RESULT',
    selection: odds.home < odds.away ? '1' : odds.away < odds.home ? '2' : 'X',
    confidence: 62
  };
  
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
  
  const oddsAgent = { bet_type: oddsType, selection: oddsSelection, confidence: oddsConfidence };
  
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
  
  const strategyAgent = { bet_type: strategyType, selection: strategySelection, confidence: strategyConfidence };
  
  return { statsAgent, oddsAgent, strategyAgent };
}

function calculateConsensus(aiResults: any[], agentResults: any) {
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
  
  let topAiVote = { key: '', count: 0 };
  for (const [key, count] of Object.entries(aiVotes)) {
    if (count > topAiVote.count) topAiVote = { key, count };
  }
  
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
  
  let topAgentVote = { key: '', count: 0 };
  for (const [key, count] of Object.entries(agentVotesMap)) {
    if (count > topAgentVote.count) topAgentVote = { key, count };
  }
  
  const hasConsensus = topAiVote.key === topAgentVote.key && topAiVote.count >= 2 && topAgentVote.count >= 2;
  
  if (hasConsensus) {
    const [bet_type, selection] = topAiVote.key.split('-');
    const allConfidences = [...(aiConfidences[topAiVote.key] || []), ...(agentConfidences[topAgentVote.key] || [])];
    const avgConfidence = Math.round(allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length);
    
    return { hasConsensus: true, bet_type, selection, confidence: avgConfidence, aiVotes: topAiVote.count, agentVotes: topAgentVote.count };
  }
  
  return { hasConsensus: false, bet_type: '', selection: '', confidence: 0, aiVotes: 0, agentVotes: 0 };
}

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

function createCoupon(matches: any[], type: string, count: number, stake: number) {
  // Tüm maçları confidence'a göre sırala
  const sorted = [...matches].sort((a, b) => b.confidence - a.confidence);
  
  // Minimum 1 maç yeterli
  const available = Math.min(count, sorted.length);
  if (available < 1) return null;

  let selected;
  if (type === 'safe') {
    // En yüksek güvenli maçları al
    selected = sorted.slice(0, available);
  } else if (type === 'balanced') {
    // Ortadaki maçları al
    const start = Math.floor(sorted.length / 3);
    selected = sorted.slice(start, start + available);
  } else {
    // En düşük güvenli ama yine de onaylanmış maçları al (risky)
    selected = sorted.slice(-available);
  }

  if (selected.length < 1) return null;

  const totalOdds = selected.reduce((acc, m) => acc * (m.odds_value || 1.5), 1);
  const avgConfidence = Math.round(selected.reduce((acc, m) => acc + (m.confidence || 50), 0) / selected.length);

  return {
    matches: selected.map(m => ({
      fixture_id: m.fixture_id,
      home_team: m.home_team,
      away_team: m.away_team,
      league: m.league,
      kick_off: m.kick_off,
      bet_type: m.bet_type,
      selection: m.selection,
      odds: m.odds_value || 1.5,
      confidence: m.confidence || 50,
      aiVotes: m.aiVotes,
      agentVotes: m.agentVotes
    })),
    total_odds: Math.round(totalOdds * 100) / 100,
    confidence: avgConfidence,
    suggested_stake: stake,
    potential_win: Math.round(stake * totalOdds * 100) / 100,
    ai_reasoning: `${selected.length} maç seçildi. Ortalama güven: %${avgConfidence}`
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: coupons, error } = await getSupabaseAdmin()
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.CRON_SECRET || 'tipster-league-secret-2025';
    
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // force=true parametresi ile eski kuponları sil ve yeniden oluştur
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await getSupabaseAdmin()
      .from('daily_coupons')
      .select('id')
      .eq('date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      if (force) {
        // Force mode: eski kuponları sil
        await getSupabaseAdmin()
          .from('daily_coupons')
          .delete()
          .eq('date', today);
        console.log('🗑️ Eski kuponlar silindi, yeniden oluşturuluyor...');
      } else {
        return NextResponse.json({ message: 'Coupons already exist for today', date: today });
      }
    }

    console.log('🎯 Generating daily coupons for', today);

    const fixtures = await getTodayMatches();
    console.log(`📊 Found ${fixtures.length} fixtures`);

    if (fixtures.length < 3) {
      return NextResponse.json({ error: 'Not enough matches today', count: fixtures.length }, { status: 400 });
    }

    const matches = fixtures.slice(0, 15).map((f: any) => {
      const odds = parseOdds(f);
      return {
        fixture_id: f.id,
        home_team: f.participants?.find((p: any) => p.meta?.location === 'home')?.name || 'Home',
        away_team: f.participants?.find((p: any) => p.meta?.location === 'away')?.name || 'Away',
        league: f.league?.name || 'Unknown',
        kick_off: f.starting_at,
        odds
      };
    }).filter((m: any) => m.odds.home && m.odds.away);

    console.log(`🔍 Analyzing ${matches.length} matches...`);

    const approvedMatches: any[] = [];

    for (const match of matches) {
      console.log(`  📍 ${match.home_team} vs ${match.away_team}`);
      
      const [claude, gpt, gemini, perplexity] = await Promise.all([
        analyzeMatchWithAI(match, 'claude'),
        analyzeMatchWithAI(match, 'gpt'),
        analyzeMatchWithAI(match, 'gemini'),
        analyzeMatchWithAI(match, 'perplexity'),
      ]);
      
      const agents = analyzeWithAgents(match);
      const consensus = calculateConsensus([claude, gpt, gemini, perplexity], agents);
      
      if (consensus.hasConsensus && consensus.confidence >= MIN_CONFIDENCE) {
        console.log(`    ✅ Approved: ${consensus.bet_type} → ${consensus.selection} (${consensus.confidence}%)`);
        approvedMatches.push({
          ...match,
          bet_type: consensus.bet_type,
          selection: consensus.selection,
          confidence: consensus.confidence,
          odds_value: getOddsValue(match.odds, consensus.bet_type, consensus.selection),
          aiVotes: consensus.aiVotes,
          agentVotes: consensus.agentVotes
        });
      } else {
        console.log(`    ❌ Skipped`);
      }
    }

    console.log(`\n🎯 Approved: ${approvedMatches.length}`);

    if (approvedMatches.length < 1) {
      return NextResponse.json({ error: 'Not enough high-confidence matches', approved: approvedMatches.length, analyzed: matches.length }, { status: 400 });
    }

    approvedMatches.sort((a, b) => b.confidence - a.confidence);

    // Sadece güvenli kupon oluştur (en yüksek güvenli 3-5 maç)
    const matchCount = Math.min(5, Math.max(3, approvedMatches.length));
    const safeCoupon = createCoupon(approvedMatches, 'safe', matchCount, 50);
    
    if (!safeCoupon) {
      return NextResponse.json({ error: 'Could not create coupon', approved: approvedMatches.length }, { status: 400 });
    }

    // Veritabanına kaydet
    await getSupabaseAdmin().from('daily_coupons').insert({
      date: today,
      coupon_type: 'safe',
      matches: safeCoupon.matches,
      total_odds: safeCoupon.total_odds,
      confidence: safeCoupon.confidence,
      suggested_stake: safeCoupon.suggested_stake,
      potential_win: safeCoupon.potential_win,
      ai_reasoning: safeCoupon.ai_reasoning,
      status: 'pending'
    });

    console.log(`✅ Güvenli kupon oluşturuldu! ${safeCoupon.matches.length} maç`);

    return NextResponse.json({ 
      success: true, 
      date: today, 
      approved: approvedMatches.length, 
      coupon: safeCoupon 
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
