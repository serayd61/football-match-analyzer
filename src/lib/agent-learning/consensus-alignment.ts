// ============================================================================
// CONSENSUS ALIGNMENT TRACKER
// Agent'ların consensus'a ne kadar yakın sonuçlar verdiğini takip eder
// Consensus'a yakın agent'lar daha yüksek ağırlık alır
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

export interface ConsensusAlignment {
  agentName: string;
  fixtureId: number;
  matchResultAlignment: number; // 0-100, consensus'a ne kadar yakın
  overUnderAlignment: number;
  bttsAlignment: number;
  overallAlignment: number; // Ortalama alignment
}

/**
 * Agent'ın consensus'a ne kadar yakın olduğunu hesapla
 */
export function calculateConsensusAlignment(
  agentPrediction: {
    matchResult?: string;
    overUnder?: string;
    btts?: string;
  },
  consensus: {
    matchResult: string;
    overUnder: string;
    btts: string;
  }
): ConsensusAlignment {
  const normalize = (val: string | undefined): string => {
    if (!val) return '';
    const s = String(val).toLowerCase().trim();
    if (s === 'home' || s === '1') return '1';
    if (s === 'away' || s === '2') return '2';
    if (s === 'draw' || s === 'x') return 'X';
    if (s === 'over') return 'Over';
    if (s === 'under') return 'Under';
    if (s === 'yes') return 'Yes';
    if (s === 'no') return 'No';
    return s;
  };

  const matchResultAlignment = agentPrediction.matchResult && consensus.matchResult
    ? (normalize(agentPrediction.matchResult) === normalize(consensus.matchResult) ? 100 : 0)
    : 50; // Eksik veri varsa orta değer

  const overUnderAlignment = agentPrediction.overUnder && consensus.overUnder
    ? (normalize(agentPrediction.overUnder) === normalize(consensus.overUnder) ? 100 : 0)
    : 50;

  const bttsAlignment = agentPrediction.btts && consensus.btts
    ? (normalize(agentPrediction.btts) === normalize(consensus.btts) ? 100 : 0)
    : 50;

  const overallAlignment = Math.round(
    (matchResultAlignment + overUnderAlignment + bttsAlignment) / 3
  );

  return {
    agentName: '', // Caller'dan gelecek
    fixtureId: 0, // Caller'dan gelecek
    matchResultAlignment,
    overUnderAlignment,
    bttsAlignment,
    overallAlignment
  };
}

/**
 * Agent'ın consensus alignment'ını kaydet (gelecekteki ağırlık hesaplamaları için)
 */
export async function recordConsensusAlignment(
  fixtureId: number,
  agentName: string,
  alignment: ConsensusAlignment
): Promise<boolean> {
  try {
    const supabase = getSupabase();

    // agent_predictions tablosuna alignment bilgisini ekle
    const { error } = await (supabase
      .from('agent_predictions') as any)
      .update({
        consensus_alignment: alignment.overallAlignment,
        consensus_match_result_alignment: alignment.matchResultAlignment,
        consensus_over_under_alignment: alignment.overUnderAlignment,
        consensus_btts_alignment: alignment.bttsAlignment,
      })
      .eq('fixture_id', fixtureId)
      .eq('agent_name', agentName);

    if (error) {
      console.error(`❌ Error recording consensus alignment for ${agentName}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Exception recording consensus alignment:', error);
    return false;
  }
}

/**
 * Agent'ın geçmiş consensus alignment ortalamasını getir
 * Yüksek alignment = consensus'a yakın = daha yüksek ağırlık
 */
export async function getAgentConsensusAlignment(
  agentName: string,
  league?: string
): Promise<number> {
  try {
    const supabase = getSupabase();

    // Son 30 maç için consensus alignment ortalaması
    const { data, error } = await (supabase
      .from('agent_predictions') as any)
      .select('consensus_alignment')
      .eq('agent_name', agentName)
      .eq(league ? 'league' : 'league', league || null)
      .not('consensus_alignment', 'is', null)
      .order('settled_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      return 50; // Default: orta seviye alignment
    }

    const avgAlignment = data.reduce((sum: number, row: any) => 
      sum + (row.consensus_alignment || 50), 0
    ) / data.length;

    return Math.round(avgAlignment);
  } catch (error) {
    console.error('❌ Exception getting consensus alignment:', error);
    return 50;
  }
}

/**
 * Consensus alignment'a göre agent ağırlığını ayarla
 * Yüksek alignment = daha yüksek ağırlık (max 1.3x)
 * Düşük alignment = daha düşük ağırlık (min 0.7x)
 */
export function adjustWeightByConsensusAlignment(
  baseWeight: number,
  consensusAlignment: number
): number {
  // Alignment 0-100 arası
  // 100 = perfect alignment = 1.3x weight
  // 50 = average alignment = 1.0x weight
  // 0 = no alignment = 0.7x weight

  if (consensusAlignment >= 80) {
    // Yüksek alignment: 1.15x - 1.3x
    const multiplier = 1.15 + ((consensusAlignment - 80) / 20) * 0.15;
    return baseWeight * multiplier;
  } else if (consensusAlignment >= 60) {
    // Orta-yüksek alignment: 1.0x - 1.15x
    const multiplier = 1.0 + ((consensusAlignment - 60) / 20) * 0.15;
    return baseWeight * multiplier;
  } else if (consensusAlignment >= 40) {
    // Orta alignment: 0.85x - 1.0x
    const multiplier = 0.85 + ((consensusAlignment - 40) / 20) * 0.15;
    return baseWeight * multiplier;
  } else {
    // Düşük alignment: 0.7x - 0.85x
    const multiplier = 0.7 + ((consensusAlignment - 0) / 40) * 0.15;
    return baseWeight * multiplier;
  }
}
