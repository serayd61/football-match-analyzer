// ============================================================================
// DEEPSEEK EVALUATE - 3 Sistemin Sonuçlarını Değerlendirir
// AI Consensus + Quad-Brain + Agents → DeepSeek Master Final Verdict
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// ============================================================================
// DEEPSEEK API CALL
// ============================================================================

async function callDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY is missing!');
    return '';
  }
  
  try {
    console.log('📤 Calling DeepSeek Master...');
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.3
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ DeepSeek API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || '';
    console.log('✅ DeepSeek Master responded');
    return result;
  } catch (e) {
    console.error('❌ DeepSeek exception:', e);
    return '';
  }
}

// ============================================================================
// EXTRACT PREDICTIONS FROM SYSTEM RESULTS
// ============================================================================

function extractPredictions(systemData: any, systemName: string) {
  try {
    if (!systemData?.success) {
      console.log(`   ⚠️ ${systemName}: No success flag or failed`);
      return { btts: 'unknown', overUnder: 'unknown', matchResult: 'unknown', confidence: 0 };
    }
    
    console.log(`   📊 ${systemName} response keys:`, Object.keys(systemData));
    
    if (systemName === 'aiConsensus') {
      // AI Consensus format: { success, analysis: { btts, overUnder25, matchResult } }
      const analysis = systemData.analysis;
      if (!analysis) {
        console.log(`   ⚠️ ${systemName}: No analysis found`);
        return { btts: 'unknown', overUnder: 'unknown', matchResult: 'unknown', confidence: 0 };
      }
      return {
        btts: analysis?.btts?.prediction || 'unknown',
        bttsConf: analysis?.btts?.confidence || 0,
        overUnder: analysis?.overUnder25?.prediction || 'unknown',
        overUnderConf: analysis?.overUnder25?.confidence || 0,
        matchResult: analysis?.matchResult?.prediction || 'unknown',
        matchResultConf: analysis?.matchResult?.confidence || 0,
      };
    }
    
    if (systemName === 'quadBrain') {
      // Quad-Brain format: { success, result: { consensus: { btts, overUnder25, matchResult } } }
      const result = systemData.result;
      const consensus = result?.consensus;
      if (!consensus) {
        console.log(`   ⚠️ ${systemName}: No consensus found`);
        return { btts: 'unknown', overUnder: 'unknown', matchResult: 'unknown', confidence: 0 };
      }
      return {
        btts: consensus?.btts?.prediction || 'unknown',
        bttsConf: consensus?.btts?.confidence || 0,
        overUnder: consensus?.overUnder25?.prediction || 'unknown',
        overUnderConf: consensus?.overUnder25?.confidence || 0,
        matchResult: consensus?.matchResult?.prediction || 'unknown',
        matchResultConf: consensus?.matchResult?.confidence || 0,
      };
    }
    
    if (systemName === 'aiAgents') {
      // AI Agents format: { success, reports, multiModel: { consensus }, professionalMarkets }
      
      // Try multiModel.consensus first (most reliable)
      const multiModel = systemData.multiModel;
      if (multiModel?.consensus) {
        const consensus = multiModel.consensus;
        return {
          btts: consensus.btts?.prediction || 'unknown',
          bttsConf: consensus.btts?.confidence || 0,
          overUnder: consensus.overUnder25?.prediction || consensus.overUnder?.prediction || 'unknown',
          overUnderConf: consensus.overUnder25?.confidence || consensus.overUnder?.confidence || 0,
          matchResult: consensus.matchResult?.prediction || 'unknown',
          matchResultConf: consensus.matchResult?.confidence || 0,
        };
      }
      
      // Try professionalMarkets as fallback
      const pm = systemData.professionalMarkets;
      if (pm?.enabled) {
        return {
          btts: pm.btts?.prediction || 'unknown',
          bttsConf: pm.btts?.confidence || 0,
          overUnder: pm.overUnder25?.prediction || 'unknown',
          overUnderConf: pm.overUnder25?.confidence || 0,
          matchResult: pm.matchResult?.prediction || 'unknown',
          matchResultConf: pm.matchResult?.confidence || 0,
        };
      }
      
      // Last resort: try reports
      const reports = systemData.reports || [];
      if (reports.length > 0) {
        const firstReport = reports[0];
        return {
          btts: firstReport?.predictions?.btts?.prediction || 'unknown',
          bttsConf: firstReport?.predictions?.btts?.confidence || 0,
          overUnder: firstReport?.predictions?.overUnder?.prediction || 'unknown',
          overUnderConf: firstReport?.predictions?.overUnder?.confidence || 0,
          matchResult: firstReport?.predictions?.matchResult?.prediction || 'unknown',
          matchResultConf: firstReport?.predictions?.matchResult?.confidence || 0,
        };
      }
      
      return { btts: 'unknown', overUnder: 'unknown', matchResult: 'unknown', confidence: 0 };
    }
    
    return { btts: 'unknown', overUnder: 'unknown', matchResult: 'unknown', confidence: 0 };
  } catch (e) {
    console.error(`Error extracting ${systemName} predictions:`, e);
    return { btts: 'unknown', overUnder: 'unknown', matchResult: 'unknown', confidence: 0 };
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { fixture_id, home_team, away_team, league, aiConsensus, quadBrain, aiAgents } = body;

    if (!home_team || !away_team) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🎯 DeepSeek Master Evaluation: ${home_team} vs ${away_team}`);

    // Extract predictions from each system
    const aiPreds = extractPredictions(aiConsensus, 'aiConsensus');
    const quadPreds = extractPredictions(quadBrain, 'quadBrain');
    const agentPreds = extractPredictions(aiAgents, 'aiAgents');

    console.log('   📊 AI Consensus:', aiPreds);
    console.log('   🧠 Quad-Brain:', quadPreds);
    console.log('   🔮 AI Agents:', agentPreds);

    // Build prompt for DeepSeek
    const prompt = `
Sen bir futbol maç analizi uzmanısın. Sana 3 farklı yapay zeka sisteminden gelen analizleri sunuyorum. 
Bu analizleri değerlendirerek kendi nihai kararını ver.

MAÇ: ${home_team} vs ${away_team} (${league})

═══════════════════════════════════════════════════════════════
🤖 AI CONSENSUS ANALİZİ (Claude + GPT-4 + Gemini)
═══════════════════════════════════════════════════════════════
• BTTS (Her İki Takım Gol Atar): ${String(aiPreds.btts).toUpperCase()} (%${aiPreds.bttsConf || 0})
• Over/Under 2.5: ${String(aiPreds.overUnder).toUpperCase()} (%${aiPreds.overUnderConf || 0})
• Maç Sonucu: ${String(aiPreds.matchResult).toUpperCase()} (%${aiPreds.matchResultConf || 0})

═══════════════════════════════════════════════════════════════
🧠 QUAD-BRAIN ANALİZİ (4 Model Ağırlıklı)
═══════════════════════════════════════════════════════════════
• BTTS: ${String(quadPreds.btts).toUpperCase()} (%${quadPreds.bttsConf || 0})
• Over/Under 2.5: ${String(quadPreds.overUnder).toUpperCase()} (%${quadPreds.overUnderConf || 0})
• Maç Sonucu: ${String(quadPreds.matchResult).toUpperCase()} (%${quadPreds.matchResultConf || 0})

═══════════════════════════════════════════════════════════════
🔮 AI AGENTS ANALİZİ (5 Uzman Ajan)
═══════════════════════════════════════════════════════════════
• BTTS: ${String(agentPreds.btts).toUpperCase()} (%${agentPreds.bttsConf || 0})
• Over/Under 2.5: ${String(agentPreds.overUnder).toUpperCase()} (%${agentPreds.overUnderConf || 0})
• Maç Sonucu: ${String(agentPreds.matchResult).toUpperCase()} (%${agentPreds.matchResultConf || 0})

═══════════════════════════════════════════════════════════════
GÖREVLERİN:
═══════════════════════════════════════════════════════════════
1. Her market (BTTS, Over/Under 2.5, Maç Sonucu) için 3 sistemin analizlerini karşılaştır
2. Kendi nihai kararını ver (sistemlerden bağımsız kendi görüşün)
3. Sistemler arası uyumu belirt (kaç sistem aynı fikirde: 0, 1, 2 veya 3)
4. Genel risk seviyesi belirle (low, medium, high)
5. En iyi bahis önerini sun

Yanıtını SADECE JSON formatında ver:
{
  "finalVerdict": {
    "btts": { "prediction": "yes/no", "confidence": 75, "reasoning": "Kısa gerekçe" },
    "overUnder": { "prediction": "over/under", "confidence": 70, "reasoning": "Kısa gerekçe" },
    "matchResult": { "prediction": "home/draw/away", "confidence": 65, "reasoning": "Kısa gerekçe" }
  },
  "systemAgreement": {
    "btts": 2,
    "overUnder": 3,
    "matchResult": 1
  },
  "riskLevel": "medium",
  "bestBet": {
    "market": "BTTS",
    "selection": "YES",
    "confidence": 78,
    "reasoning": "En güvenli seçim gerekçesi"
  },
  "masterAnalysis": "Genel değerlendirme ve öneriler (2-3 cümle)",
  "warnings": ["Varsa uyarılar"]
}`;

    // Call DeepSeek
    const deepseekResponse = await callDeepSeek(prompt);
    
    if (!deepseekResponse) {
      return NextResponse.json({
        success: false,
        error: 'DeepSeek API failed'
      }, { status: 500 });
    }

    // Parse DeepSeek response
    let parsedResult;
    try {
      const jsonMatch = deepseekResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      console.error('Failed to parse DeepSeek response:', e);
      parsedResult = {
        finalVerdict: {
          btts: { prediction: 'unknown', confidence: 0, reasoning: 'Parse error' },
          overUnder: { prediction: 'unknown', confidence: 0, reasoning: 'Parse error' },
          matchResult: { prediction: 'unknown', confidence: 0, reasoning: 'Parse error' }
        },
        riskLevel: 'high',
        warnings: ['Response parse error']
      };
    }

    const totalTime = Date.now() - startTime;
    console.log(`   ✅ DeepSeek Master completed in ${totalTime}ms`);

    // Save to database
    if (fixture_id) {
      try {
        await supabase
          .from('match_full_analysis')
          .upsert({
            fixture_id,
            home_team,
            away_team,
            league,
            match_date: new Date().toISOString().split('T')[0],
            ai_consensus: aiPreds,
            quad_brain: quadPreds,
            ai_agents: agentPreds,
            deepseek_master: parsedResult,
            created_at: new Date().toISOString()
          }, { onConflict: 'fixture_id' });
      } catch (e) {
        console.error('Error saving to database:', e);
      }
    }

    return NextResponse.json({
      success: true,
      match: `${home_team} vs ${away_team}`,
      duration: totalTime,
      deepseekMaster: parsedResult,
      systemInputs: {
        aiConsensus: aiPreds,
        quadBrain: quadPreds,
        aiAgents: agentPreds
      }
    });

  } catch (error: any) {
    console.error('DeepSeek Evaluate Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

