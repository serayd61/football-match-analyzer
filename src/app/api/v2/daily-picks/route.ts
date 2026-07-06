// ============================================================================
// API V2: DAILY PICKS — "Kanıt Döngüsü" (Dünün Karnesi + Bugünün Seçimleri)
// yesterday: en yakın geçmiş günün SONUÇLANMIŞ motor seçimleri (✓/✗ + skor +
//   gün toplamı) — HERKESE AÇIK (agregat kanıt, kaybedenler dahil; pazarlama
//   yüzeyi). Void'ler (settled ama result IS NULL) hariç.
// today: önümüzdeki 24 saatin yüksek-güven seçimleri — sayı + ilk maç saati
//   herkese açık, seçimlerin kendisi Pro (hasEnginePredictionAccess, list
//   route'la aynı kapı). Free'ye picks boş + locked=true döner, veri sızmaz.
// Seçim kuralı iki taraf için AYNI (güven >= eşik, en çok 15): dünün karnesi
// bugün satılan listeyle aynı kuralla üretilmiş olmalı ki kanıt dürüst olsun.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasEnginePredictionAccess } from '@/lib/accessControl';

const CONFIDENCE_MIN = 0.58;
const MAX_PICKS = 15;
const WORLD_CUP_LEAGUE_IDS = [77, 894789];

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _sb;
}

const PICK_COLS =
  'fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, ' +
  'kickoff, pick, confidence, home_score, away_score, result, correct';

function mapPick(r: any) {
  return {
    fixtureId: r.fixture_id,
    leagueId: r.league_id,
    leagueName: r.league_name,
    homeId: r.home_id,
    homeName: r.home_name,
    awayId: r.away_id,
    awayName: r.away_name,
    kickoff: r.kickoff,
    pick: r.pick,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    homeScore: r.home_score,
    awayScore: r.away_score,
    result: r.result,
    correct: r.correct,
  };
}

export async function GET(_request: NextRequest) {
  try {
    // --- DÜNÜN KARNESİ: en yakın geçmiş gün (7 güne kadar geriye bak) ---
    // Maçsız günler / settlement gecikmesi karneyi boş bırakmasın diye tek
    // sorguyla son 7 günün settled seçimleri çekilir, en yeni GÜN seçilir.
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: settledRows, error: settledErr } = await sb()
      .from('engine_predictions')
      .select(PICK_COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .gte('confidence', CONFIDENCE_MIN)
      .gte('kickoff', sevenDaysAgo.toISOString())
      .lt('kickoff', now.toISOString())
      .order('kickoff', { ascending: false })
      .limit(200);

    if (settledErr) {
      return NextResponse.json({ ok: false, error: settledErr.message }, { status: 500 });
    }

    let yesterday: {
      date: string | null;
      picks: any[];
      total: number;
      correct: number;
      accuracy: number;
    } = { date: null, picks: [], total: 0, correct: 0, accuracy: 0 };

    const settled = (settledRows || []) as any[];
    if (settled.length > 0) {
      const latestDay = new Date(settled[0].kickoff).toISOString().split('T')[0];
      const dayRows = settled
        .filter((r: any) => new Date(r.kickoff).toISOString().split('T')[0] === latestDay)
        .sort((a: any, b: any) => Number(b.confidence || 0) - Number(a.confidence || 0))
        .slice(0, MAX_PICKS);
      const correct = dayRows.filter((r: any) => r.correct === true).length;
      yesterday = {
        date: latestDay,
        picks: dayRows.map(mapPick),
        total: dayRows.length,
        correct,
        accuracy: dayRows.length ? Math.round((correct / dayRows.length) * 1000) / 10 : 0,
      };
    }

    // --- BUGÜNÜN SEÇİMLERİ: önümüzdeki 24 saat (predictions/list ile aynı pencere) ---
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { data: todayRows, error: todayErr } = await sb()
      .from('engine_predictions')
      .select(PICK_COLS + ', rationale')
      .eq('settled', false)
      .gte('confidence', CONFIDENCE_MIN)
      .gte('kickoff', now.toISOString())
      .lte('kickoff', in24h.toISOString())
      .order('confidence', { ascending: false })
      .limit(MAX_PICKS);

    if (todayErr) {
      return NextResponse.json({ ok: false, error: todayErr.message }, { status: 500 });
    }

    const upcoming = ((todayRows || []) as any[]).sort(
      (a: any, b: any) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
    );
    const firstKickoff = upcoming.length ? upcoming[0].kickoff : null;

    // Pro kapısı: seçimlerin kendisi yalnızca erişimi olana açılır
    const session = await getServerSession(authOptions);
    const unlocked = await hasEnginePredictionAccess(session?.user?.email);

    const today = {
      count: upcoming.length,
      firstKickoff,
      locked: !unlocked,
      picks: unlocked
        ? upcoming.map((r: any) => ({ ...mapPick(r), rationale: r.rationale ?? null }))
        : [],
    };

    // --- DÜNYA KUPASI KARNESİ (settled WC seçimleri, tüm zamanlar) ---
    const { data: wcRows } = await sb()
      .from('engine_predictions')
      .select('correct')
      .eq('settled', true)
      .not('result', 'is', null)
      .in('league_id', WORLD_CUP_LEAGUE_IDS);

    const wcTotal = wcRows?.length || 0;
    const wcCorrect = wcRows?.filter((r: any) => r.correct === true).length || 0;

    return NextResponse.json({
      ok: true,
      yesterday,
      today,
      worldCup: { total: wcTotal, correct: wcCorrect },
    });
  } catch (e: any) {
    console.error('[daily-picks] error:', e?.message);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
