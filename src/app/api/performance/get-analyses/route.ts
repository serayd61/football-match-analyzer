// ============================================================================
// API: Get Analyses from unified_analysis Table
// GET /api/performance/get-analyses
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Normalize fonksiyonları - agent tahminlerini karşılaştırmak için (DÜZELTME: Daha kapsamlı)
function normalizeMR(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  // Daha kapsamlı kontrol - 'away', 'home', 'away_win', 'home_win' gibi formatları da yakala
  if (v === '1' || v === 'home' || v === 'ev sahibi' || v === 'home_win' || v === 'homewin' || (v.includes('home') && v.includes('win'))) return '1';
  if (v === '2' || v === 'away' || v === 'deplasman' || v === 'away_win' || v === 'awaywin' || (v.includes('away') && v.includes('win'))) return '2';
  if (v === 'x' || v === 'draw' || v === 'beraberlik' || v === 'tie' || v === 'd') return 'X';
  return v;
}

function normalizeOU(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst') || v === 'o') return 'over';
  if (v.includes('under') || v.includes('alt') || v === 'u') return 'under';
  return v;
}

function normalizeBTTS(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var' || v === 'y' || v === 'true') return 'yes';
  if (v === 'no' || v === 'hayır' || v === 'yok' || v === 'n' || v === 'false') return 'no';
  return v;
}

export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    console.log('📊 GET /api/performance/get-analyses called at', timestamp);

    const { searchParams } = new URL(request.url);

    const settledParam = searchParams.get('settled');
    const limit = parseInt(searchParams.get('limit') || '1000', 10); // Default 1000, tüm maçları getir
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const league = searchParams.get('league');
    const agent = searchParams.get('agent'); // 'all', 'stats', 'odds', 'deepAnalysis', 'masterStrategist', 'smart'
    
    // Çoklu kriter filtreleri (aynı anda MS + O/U + BTTS seçilebilir, her biri için ayrı confidence range)
    const msSelection = searchParams.get('msSelection'); // 'all', 'home', 'away', 'draw'
    const msMinConf = parseInt(searchParams.get('msMinConf') || '50', 10);
    const msMaxConf = parseInt(searchParams.get('msMaxConf') || '100', 10);
    
    const ouSelection = searchParams.get('ouSelection'); // 'all', 'over', 'under'
    const ouMinConf = parseInt(searchParams.get('ouMinConf') || '50', 10);
    const ouMaxConf = parseInt(searchParams.get('ouMaxConf') || '100', 10);
    
    const bttsSelection = searchParams.get('bttsSelection'); // 'all', 'yes', 'no'
    const bttsMinConf = parseInt(searchParams.get('bttsMinConf') || '50', 10);
    const bttsMaxConf = parseInt(searchParams.get('bttsMaxConf') || '100', 10);
    
    // Eski tek market/selection parametreleri (geriye uyumluluk)
    const market = searchParams.get('market'); // 'MS', 'O/U', 'BTTS'
    const selection = searchParams.get('selection'); // 'home', 'away', 'over', 'under', etc.
    const minConfidence = parseInt(searchParams.get('minConfidence') || '50', 10);
    const maxConfidence = parseInt(searchParams.get('maxConfidence') || '100', 10);

    console.log(`   Params: settled=${settledParam}, limit=${limit}, offset=${offset}, league=${league}, agent=${agent}`);
    console.log(`   Multi-filters: ms=${msSelection}(${msMinConf}-${msMaxConf}%), ou=${ouSelection}(${ouMinConf}-${ouMaxConf}%), btts=${bttsSelection}(${bttsMinConf}-${bttsMaxConf}%)`);

    // Create fresh client inline
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all data with ORDER BY match_date
    const { data: allData, error } = await supabase
      .from('unified_analysis')
      .select('*')
      .order('match_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Filter in JavaScript (more reliable than Supabase .eq())
    let filteredData = allData || [];

    // Filter by settled status
    if (settledParam !== null) {
      const wantSettled = settledParam === 'true';
      filteredData = filteredData.filter(r => r.is_settled === wantSettled);
    }

    // Filter by league
    if (league) {
      filteredData = filteredData.filter(r => r.league === league);
    }

    // ============================================================================
    // ÇOKLU KRİTER FİLTRELEME (AND mantığı - MS + O/U + BTTS aynı anda)
    // ============================================================================
    
    // Helper: Consensus tahminlerini normalize et
    const matchesMSSelection = (row: any, sel: string): boolean => {
      const mr = normalizeMR(row.match_result_prediction || row.consensus_match_result || '');
      if (sel === 'home') return mr === '1';
      if (sel === 'away') return mr === '2';
      if (sel === 'draw') return mr === 'x';
      return true;
    };
    
    const matchesOUSelection = (row: any, sel: string): boolean => {
      const ou = normalizeOU(row.over_under_prediction || row.consensus_over_under || '');
      if (sel === 'over') return ou === 'over';
      if (sel === 'under') return ou === 'under';
      return true;
    };
    
    const matchesBTTSSelection = (row: any, sel: string): boolean => {
      const btts = normalizeBTTS(row.btts_prediction || row.consensus_btts || '');
      if (sel === 'yes') return btts === 'yes';
      if (sel === 'no') return btts === 'no';
      return true;
    };
    
    // Helper: Confidence kontrolü (her market için ayrı)
    const getConfidence = (row: any, market: 'mr' | 'ou' | 'btts'): number => {
      const analysis = row.analysis || {};
      const predictions = analysis.predictions || {};
      
      if (market === 'mr') {
        return predictions.matchResult?.confidence || row.match_result_confidence || 50;
      } else if (market === 'ou') {
        return predictions.overUnder?.confidence || row.over_under_confidence || 50;
      } else if (market === 'btts') {
        return predictions.btts?.confidence || row.btts_confidence || 50;
      }
      return 50;
    };
    
    const checkConfidenceRange = (row: any, market: 'mr' | 'ou' | 'btts', minConf: number, maxConf: number): boolean => {
      const conf = getConfidence(row, market);
      return conf >= minConf && conf <= maxConf;
    };
    
    // Agent bazlı tahmin eşleştirme
    const getAgentPrediction = (row: any, agentName: string, predType: 'mr' | 'ou' | 'btts'): string => {
      const analysis = row.analysis || {};
      const sources = analysis.sources || {};
      const agents = sources.agents || {};
      const ai = sources.ai || {};
      
      let agentData: any = null;
      
      switch (agentName) {
        case 'stats':
          agentData = agents.stats || {};
          break;
        case 'odds':
          agentData = agents.odds || {};
          break;
        case 'deepAnalysis':
          agentData = agents.deepAnalysis || {};
          break;
        case 'masterStrategist':
          agentData = agents.masterStrategist || {};
          break;
        case 'smart':
          agentData = ai.smart || {};
          break;
        default:
          return '';
      }
      
      if (predType === 'mr') {
        return normalizeMR(
          agentData.matchResult?.prediction || 
          agentData.matchResult || 
          agentData.final?.primary_pick?.selection ||
          agentData.predictions?.matchResult?.prediction ||
          ''
        );
      } else if (predType === 'ou') {
        return normalizeOU(
          agentData.overUnder?.prediction || 
          agentData.overUnder || 
          agentData.final?.primary_pick?.selection ||
          agentData.predictions?.overUnder?.prediction ||
          ''
        );
      } else if (predType === 'btts') {
        return normalizeBTTS(
          agentData.btts?.prediction || 
          agentData.btts || 
          agentData.predictions?.btts?.prediction ||
          ''
        );
      }
      return '';
    };
    
    // Çoklu kriter filtreleme (AND mantığı + her market için ayrı confidence range)
    if (msSelection || ouSelection || bttsSelection) {
      filteredData = filteredData.filter(r => {
        let pass = true;
        
        // Agent seçilmişse o agent'ın tahminlerine göre filtrele
        if (agent && agent !== 'all') {
          if (msSelection) {
            const agentMR = getAgentPrediction(r, agent, 'mr');
            if (msSelection === 'home') pass = pass && agentMR === '1';
            else if (msSelection === 'away') pass = pass && agentMR === '2';
            else if (msSelection === 'draw') pass = pass && agentMR === 'x';
            // MS confidence range kontrolü
            if (msSelection !== 'all') {
              pass = pass && checkConfidenceRange(r, 'mr', msMinConf, msMaxConf);
            }
          }
          if (ouSelection) {
            const agentOU = getAgentPrediction(r, agent, 'ou');
            if (ouSelection === 'over') pass = pass && agentOU === 'over';
            else if (ouSelection === 'under') pass = pass && agentOU === 'under';
            // O/U confidence range kontrolü
            if (ouSelection !== 'all') {
              pass = pass && checkConfidenceRange(r, 'ou', ouMinConf, ouMaxConf);
            }
          }
          if (bttsSelection) {
            const agentBTTS = getAgentPrediction(r, agent, 'btts');
            if (bttsSelection === 'yes') pass = pass && agentBTTS === 'yes';
            else if (bttsSelection === 'no') pass = pass && agentBTTS === 'no';
            // BTTS confidence range kontrolü
            if (bttsSelection !== 'all') {
              pass = pass && checkConfidenceRange(r, 'btts', bttsMinConf, bttsMaxConf);
            }
          }
        } else {
          // Agent seçilmemişse consensus tahminlerine göre filtrele
          if (msSelection) {
            if (msSelection !== 'all') {
              pass = pass && matchesMSSelection(r, msSelection);
              pass = pass && checkConfidenceRange(r, 'mr', msMinConf, msMaxConf);
            }
          }
          if (ouSelection) {
            if (ouSelection !== 'all') {
              pass = pass && matchesOUSelection(r, ouSelection);
              pass = pass && checkConfidenceRange(r, 'ou', ouMinConf, ouMaxConf);
            }
          }
          if (bttsSelection) {
            if (bttsSelection !== 'all') {
              pass = pass && matchesBTTSSelection(r, bttsSelection);
              pass = pass && checkConfidenceRange(r, 'btts', bttsMinConf, bttsMaxConf);
            }
          }
        }
        
        return pass;
      });
    }
    
    // ============================================================================
    // ESKİ TEK MARKET/SELECTION FİLTRESİ (geriye uyumluluk)
    // ============================================================================
    
    // Filter by Best Bet market (eski sistem - geriye uyumluluk)
    if (market && market !== 'all' && !msSelection && !ouSelection && !bttsSelection) {
      filteredData = filteredData.filter(r => {
        if (!r.best_bet_market) return false;
        const marketLower = r.best_bet_market.toLowerCase();

        if (market === 'MS') {
          return marketLower.includes('match result') || marketLower.includes('maç sonucu') ||
            marketLower.includes('1x2') || marketLower === 'ms';
        } else if (market === 'O/U') {
          return marketLower.includes('over/under') || marketLower.includes('alt/üst') ||
            marketLower.includes('2.5') || marketLower === 'o/u';
        } else if (market === 'BTTS') {
          return marketLower.includes('btts') || marketLower.includes('both teams') ||
            marketLower.includes('kg var') || marketLower.includes('gol-gol');
        }
        return true;
      });
    }

    // Filter by Best Bet selection (eski sistem - geriye uyumluluk)
    if (selection && selection !== 'all' && market && market !== 'all' && !msSelection && !ouSelection && !bttsSelection) {
      filteredData = filteredData.filter(r => {
        if (!r.best_bet_selection) return false;
        const sel = r.best_bet_selection.toLowerCase();

        if (market === 'MS') {
          if (selection === 'home') return sel.includes('home') || sel === '1' || sel.includes('ev');
          if (selection === 'away') return sel.includes('away') || sel === '2' || sel.includes('dep');
          if (selection === 'draw') return sel.includes('draw') || sel === 'x' || sel.includes('ber');
        } else if (market === 'O/U') {
          if (selection === 'over') return sel.includes('over') || sel.includes('üst');
          if (selection === 'under') return sel.includes('under') || sel.includes('alt');
        } else if (market === 'BTTS') {
          if (selection === 'yes') return sel.includes('yes') || sel.includes('evet');
          if (selection === 'no') return sel.includes('no') || sel.includes('hayır');
        }
        return true;
      });
    }

    // Filter by confidence range
    if (minConfidence !== 50 || maxConfidence !== 100) {
      filteredData = filteredData.filter(r => {
        if (r.best_bet_confidence === null || r.best_bet_confidence === undefined) return false;
        return r.best_bet_confidence >= minConfidence && r.best_bet_confidence <= maxConfidence;
      });
    }

    const totalCount = filteredData.length;

    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + limit);

    console.log(`   Result: ${paginatedData.length} records (total filtered: ${totalCount})`);

    // Transform data to match the expected format for the performance page
    const transformedData = paginatedData.map(row => {
      // Parse analysis JSONB to extract agent predictions
      const analysis = row.analysis || {};
      const sources = analysis.sources || {};
      const agents = sources.agents || {};

      // Extract individual agent predictions
      const statsAgent = agents.stats || {};
      const oddsAgent = agents.odds || {};
      const deepAnalysis = agents.deepAnalysis || {};
      const geniusAnalyst = agents.geniusAnalyst || {};
      const masterStrategist = agents.masterStrategist || {};

      // Determine which agent's prediction matches consensus (for display)
      const getAgentSource = (prediction: string, type: 'mr' | 'ou' | 'btts') => {
        const normalizedPred = prediction?.toLowerCase() || '';

        if (type === 'mr') {
          const statsMR = normalizeMR(statsAgent.matchResult || '');
          const oddsMR = normalizeMR(oddsAgent.matchWinnerValue || '');
          const deepMR = normalizeMR(deepAnalysis.matchResult?.prediction || '');
          const geniusMR = normalizeMR(geniusAnalyst.predictions?.matchResult?.prediction || '');
          const masterMR = normalizeMR(masterStrategist.finalConsensus?.matchResult?.prediction || '');

          if (normalizeMR(normalizedPred) === statsMR) return 'Stats Agent';
          if (normalizeMR(normalizedPred) === oddsMR) return 'Odds Agent';
          if (normalizeMR(normalizedPred) === deepMR) return 'Deep Analysis';
          if (normalizeMR(normalizedPred) === geniusMR) return 'Genius Analyst';
          if (normalizeMR(normalizedPred) === masterMR) return 'Master Strategist';
        } else if (type === 'ou') {
          const statsOU = normalizeOU(statsAgent.overUnder || '');
          const oddsOU = normalizeOU(oddsAgent.recommendation || '');
          const deepOU = normalizeOU(deepAnalysis.overUnder?.prediction || '');
          const geniusOU = normalizeOU(geniusAnalyst.predictions?.overUnder?.prediction || '');
          const masterOU = normalizeOU(masterStrategist.finalConsensus?.overUnder?.prediction || '');

          if (normalizeOU(normalizedPred) === statsOU) return 'Stats Agent';
          if (normalizeOU(normalizedPred) === oddsOU) return 'Odds Agent';
          if (normalizeOU(normalizedPred) === deepOU) return 'Deep Analysis';
          if (normalizeOU(normalizedPred) === geniusOU) return 'Genius Analyst';
          if (normalizeOU(normalizedPred) === masterOU) return 'Master Strategist';
        } else if (type === 'btts') {
          const statsBTTS = normalizeBTTS(statsAgent.btts || '');
          const oddsBTTS = normalizeBTTS(oddsAgent.bttsValue || '');
          const deepBTTS = normalizeBTTS(deepAnalysis.btts?.prediction || '');
          const geniusBTTS = normalizeBTTS(geniusAnalyst.predictions?.btts?.prediction || '');
          const masterBTTS = normalizeBTTS(masterStrategist.finalConsensus?.btts?.prediction || '');

          if (normalizeBTTS(normalizedPred) === statsBTTS) return 'Stats Agent';
          if (normalizeBTTS(normalizedPred) === oddsBTTS) return 'Odds Agent';
          if (normalizeBTTS(normalizedPred) === deepBTTS) return 'Deep Analysis';
          if (normalizeBTTS(normalizedPred) === geniusBTTS) return 'Genius Analyst';
          if (normalizeBTTS(normalizedPred) === masterBTTS) return 'Master Strategist';
        }

        return 'Konsensüs'; // Default - birden fazla agent birleşimi
      };

      return {
        id: row.id,
        fixture_id: row.fixture_id,
        home_team: row.home_team,
        away_team: row.away_team,
        league: row.league,
        match_date: row.match_date,
        match_settled: row.is_settled,

        // Consensus predictions
        consensus_match_result: row.match_result_prediction,
        consensus_over_under: row.over_under_prediction,
        consensus_btts: row.btts_prediction,
        consensus_confidence: row.overall_confidence,

        // Agent sources (hangi agent'tan geldiği)
        mr_source: getAgentSource(row.match_result_prediction || '', 'mr'),
        ou_source: getAgentSource(row.over_under_prediction || '', 'ou'),
        btts_source: getAgentSource(row.btts_prediction || '', 'btts'),

        // Best Bet (En İyi Bahis)
        best_bet_market: row.best_bet_market,
        best_bet_selection: row.best_bet_selection,
        best_bet_confidence: row.best_bet_confidence,

        // Actual results
        actual_home_score: row.actual_home_score,
        actual_away_score: row.actual_away_score,
        actual_match_result: row.actual_match_result,
        actual_over_under: row.actual_total_goals !== null
          ? (row.actual_total_goals > 2.5 ? 'Over' : 'Under')
          : null,
        actual_btts: row.actual_btts !== null
          ? (row.actual_btts ? 'Yes' : 'No')
          : null,

        // Correctness
        consensus_mr_correct: row.match_result_correct,
        consensus_ou_correct: row.over_under_correct,
        consensus_btts_correct: row.btts_correct,

        // Metadata
        created_at: row.created_at,
        settled_at: row.settled_at,
      };
    });

    // Set cache control headers to prevent caching
    const response = NextResponse.json({
      success: true,
      data: transformedData,
      count: totalCount,
      limit,
      offset,
      timestamp
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');

    return response;

  } catch (error: any) {
    console.error('❌ Get analyses API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
