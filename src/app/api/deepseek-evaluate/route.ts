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
  
  // Timeout: 30 saniye
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    console.log('📤 Calling DeepSeek Master...');
    const startTime = Date.now();
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2500, // Reduced from 3000 for faster response
        temperature: 0.3,
        stream: false
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ DeepSeek API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || '';
    const duration = Date.now() - startTime;
    console.log(`✅ DeepSeek Master responded in ${duration}ms`);
    return result;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      console.error('❌ DeepSeek API timeout (>30s)');
    } else {
      console.error('❌ DeepSeek exception:', e);
    }
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
🎯 SEN "DEEPSEEK MASTER ANALİST"SİN - FUTBOL TAHMİN UZMANI

Sen, dünyaca ünlü bir futbol analiz uzmanısın. 20+ yıllık deneyiminle binlerce maçı doğru tahmin ettin.
Şimdi sana 3 farklı yapay zeka sisteminin analizlerini sunuyorum. 

GÖREV: 
1. Bu 3 sistemi DEĞERLENDİR
2. KENDİ BAĞIMSIZ ANALİZİNİ YAP (takımların güçlü/zayıf yönleri, form, motivasyon, taktik)
3. TÜM VERİLERİ BİRLEŞTİREREK final kararını ver

═══════════════════════════════════════════════════════════════
📋 MAÇ BİLGİSİ
═══════════════════════════════════════════════════════════════
${home_team} vs ${away_team}
Lig: ${league}

═══════════════════════════════════════════════════════════════
🤖 SİSTEM 1: AI CONSENSUS (Claude + GPT-4 + Gemini)
═══════════════════════════════════════════════════════════════
• BTTS: ${String(aiPreds.btts).toUpperCase()} (%${aiPreds.bttsConf || 0})
• Over/Under 2.5: ${String(aiPreds.overUnder).toUpperCase()} (%${aiPreds.overUnderConf || 0})
• Maç Sonucu: ${String(aiPreds.matchResult).toUpperCase()} (%${aiPreds.matchResultConf || 0})

═══════════════════════════════════════════════════════════════
🧠 SİSTEM 2: QUAD-BRAIN (4 Model Ağırlıklı Konsensüs)
═══════════════════════════════════════════════════════════════
• BTTS: ${String(quadPreds.btts).toUpperCase()} (%${quadPreds.bttsConf || 0})
• Over/Under 2.5: ${String(quadPreds.overUnder).toUpperCase()} (%${quadPreds.overUnderConf || 0})
• Maç Sonucu: ${String(quadPreds.matchResult).toUpperCase()} (%${quadPreds.matchResultConf || 0})

═══════════════════════════════════════════════════════════════
🔮 SİSTEM 3: AI AGENTS (5 Uzman Ajan Analizi)
═══════════════════════════════════════════════════════════════
• BTTS: ${String(agentPreds.btts).toUpperCase()} (%${agentPreds.bttsConf || 0})
• Over/Under 2.5: ${String(agentPreds.overUnder).toUpperCase()} (%${agentPreds.overUnderConf || 0})
• Maç Sonucu: ${String(agentPreds.matchResult).toUpperCase()} (%${agentPreds.matchResultConf || 0})

═══════════════════════════════════════════════════════════════
🎯 MASTER ANALİST GÖREVLERİN:
═══════════════════════════════════════════════════════════════

1. **KENDİ ANALİZİN**: ${home_team} ve ${away_team} hakkında kendi bilgilerinle bağımsız bir analiz yap:
   - Takımların mevcut formu
   - Ev sahibi/Deplasman performansları
   - Gol atma ve yeme eğilimleri
   - Motivasyon faktörleri
   - Olası taktik yaklaşımlar

2. **SİSTEM DEĞERLENDİRMESİ**: 3 sistemin tahminlerini karşılaştır ve uyumu değerlendir

3. **FİNAL KARAR**: Kendi analizin + sistem verileri = Final tahmin (her market için)

4. **EN İYİ BAHİS**: Tüm verilere göre en güvenilir bahis önerisi

5. **RİSK ANALİZİ**: Potansiyel riskler ve uyarılar

Yanıtını SADECE JSON formatında ver:
{
  "myAnalysis": {
    "homeTeam": {
      "name": "${home_team}",
      "form": "Son 5 maç performansı hakkında kısa değerlendirme",
      "strengths": ["Güçlü yön 1", "Güçlü yön 2"],
      "weaknesses": ["Zayıf yön 1"]
    },
    "awayTeam": {
      "name": "${away_team}",
      "form": "Son 5 maç performansı hakkında kısa değerlendirme",
      "strengths": ["Güçlü yön 1"],
      "weaknesses": ["Zayıf yön 1", "Zayıf yön 2"]
    },
    "keyFactors": ["Bu maçı etkileyecek en önemli faktör 1", "Faktör 2", "Faktör 3"],
    "myPrediction": {
      "btts": "yes/no",
      "overUnder": "over/under",
      "matchResult": "home/draw/away",
      "scorePrediction": "1-0 veya 2-1 gibi tahmin"
    }
  },
  "systemEvaluation": {
    "agreement": "Sistemler arasındaki uyum hakkında 1-2 cümle",
    "mostReliable": "En güvenilir görünen sistem ve neden",
    "conflicts": "Sistemler arası çelişkiler varsa"
  },
  "finalVerdict": {
    "btts": { "prediction": "yes/no", "confidence": 75, "reasoning": "Kendi analizim + sistemlerin değerlendirmesi" },
    "overUnder": { "prediction": "over/under", "confidence": 70, "reasoning": "Kendi analizim + sistemlerin değerlendirmesi" },
    "matchResult": { "prediction": "home/draw/away", "confidence": 65, "reasoning": "Kendi analizim + sistemlerin değerlendirmesi" }
  },
  "systemAgreement": {
    "btts": 2,
    "overUnder": 3,
    "matchResult": 1
  },
  "riskLevel": "low/medium/high",
  "bestBet": {
    "market": "En iyi market",
    "selection": "Seçim",
    "confidence": 78,
    "reasoning": "Neden bu en iyi bahis"
  },
  "masterAnalysis": "Master Analist olarak genel değerlendirmem ve taktik öngörülerim (3-4 cümle)",
  "warnings": ["Risk uyarısı 1", "Risk uyarısı 2"]
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

