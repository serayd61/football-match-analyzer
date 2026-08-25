// ============================================================================
// API V2: PREDICTIONS LIST (korumalı, salt okuma)
// engine_predictions tablosundan yaklaşan tahminleri döndürür.
// ERİŞİM: giriş + aktif abonelik/deneme (veya admin) gerekir.
// Giriş yoksa 401, abonelik yoksa 403 döner — veri sızdırmaz.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasEnginePredictionAccess } from '@/lib/accessControl';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';
import { getCalibration, applyCurve } from '@/lib/calibration';
import { deriveDoubleChance } from '@/lib/double-chance';
import { deriveOverUnder, deriveBtts } from '@/lib/goal-markets';

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

export async function GET(request: NextRequest) {
  // --- Erişim kontrolü: giriş + abonelik/deneme (veya admin) ---
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json(
      { ok: false, code: 'auth_required', error: 'Giriş gerekli', predictions: [] },
      { status: 401 },
    );
  }
  const allowed = await hasEnginePredictionAccess(email);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, code: 'subscription_required', error: 'Aktif abonelik/deneme gerekli', predictions: [] },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date'); // YYYY-MM-DD (opsiyonel)
  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500);

  let q = sb()
    .from('engine_predictions')
    .select(
      'fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, ' +
        'p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, ' +
        'pick, confidence, rationale, settled, home_score, away_score, result, correct, model_version',
    )
    .order('kickoff', { ascending: true })
    .limit(limit);

  if (date) {
    // o günün maçları (kickoff o tarihte)
    q = q.gte('kickoff', `${date}T00:00:00Z`).lt('kickoff', `${date}T23:59:59Z`);
  } else {
    // Dashboard varsayılanı: SADECE önümüzdeki 24 saat içindeki, henüz
    // sonuçlanmamış maçlar. Geçmiş maçlar settlement ile performansa taşınır.
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    q = q
      .eq('settled', false)
      .gte('kickoff', now.toISOString())
      .lte('kickoff', in24h.toISOString());
  }

  const { data, error } = await q;
  if (error) {
    console.error('[predictions/list] error:', error.message);
    return NextResponse.json({ ok: false, error: error.message, predictions: [] }, { status: 500 });
  }

  // Okuma-anı lig onarımı: insert anında ad çözümsüz kaldıysa ("League X")
  // katalogdan ad + ülke kodu tamamlanır (bkz. league-catalog cron'u).
  const EMPTY_CURVE = { knots: [], segment: 'none', nSamples: 0, fittedAt: null };
  const [catalog, calib, calibOu, calibBtts] = await Promise.all([
    getCatalogMap().catch(() => new Map()),
    getCalibration().catch(() => EMPTY_CURVE),
    getCalibration('ou25').catch(() => EMPTY_CURVE),
    getCalibration('btts').catch(() => EMPTY_CURVE),
  ]);

  const predictions = (data || []).map((p: any) => {
    const cat = catalog.get(Number(p.league_id));
    const rawConf = p.confidence != null ? Number(p.confidence) : null;
    // Gol pazarları: seçim ham olasılıktan, GÖSTERİLEN güven kalibre eğriden.
    // Ham değerler 10-30 puan şişik (bkz. lib/goal-markets.ts ölçümü).
    const ou = deriveOverUnder(p.p_over25);
    const bt = deriveBtts(p.p_btts_yes);
    return {
    fixtureId: p.fixture_id,
    leagueId: p.league_id,
    leagueName: isUnresolvedLeagueName(p.league_name) && cat ? cat.name : p.league_name,
    leagueCcode: cat?.ccode || '',
    homeId: p.home_id,
    homeName: p.home_name,
    awayId: p.away_id,
    awayName: p.away_name,
    kickoff: p.kickoff,
    pHome: Number(p.p_home),
    pDraw: Number(p.p_draw),
    pAway: Number(p.p_away),
    pOver25: p.p_over25 != null ? Number(p.p_over25) : null,
    pBttsYes: p.p_btts_yes != null ? Number(p.p_btts_yes) : null,
    lambdaHome: p.lambda_home != null ? Number(p.lambda_home) : null,
    lambdaAway: p.lambda_away != null ? Number(p.lambda_away) : null,
    pick: p.pick,
    // Çifte şans: aynı olasılıklardan türetilir (bkz. lib/double-chance.ts).
    // 1X2 argmax yapısal olarak ~%49 tavanlı; çifte şans ölçülen %76.5.
    doubleChance: deriveDoubleChance(p.p_home, p.p_draw, p.p_away),
    overUnder: ou ? { pick: ou.pick, p: applyCurve(ou.p, calibOu.knots), pRaw: ou.p } : null,
    btts: bt ? { pick: bt.pick, p: applyCurve(bt.p, calibBtts.knots), pRaw: bt.p } : null,
    // Gösterilen güven KALİBRE değerdir (bkz. lib/calibration.ts); ham model
    // çıktısı confidenceRaw'da korunur.
    confidence: applyCurve(rawConf, calib.knots),
    confidenceRaw: rawConf,
    rationale: p.rationale,
    settled: p.settled,
    homeScore: p.home_score,
    awayScore: p.away_score,
    result: p.result,
    correct: p.correct,
    };
  });

  // Model kapsamı: tahminler GİZLENMEZ, ETİKETLENİR. Fit edilmiş ligler
  // ana liste; kalanlar `uncovered` altında ayrı döner ve arayüzde "kapsam
  // dışı — istatistiksel yedek" olarak gösterilir.
  // Ölçüm 2026-08-11: kapsam dışı ligler %49.4 isabet; ana listeyle
  // karıştırılırsa karne motoru değil yedeği ölçer (bkz. model-coverage.ts).
  const withFlag = predictions.map((p) => ({
    ...p,
    modelCovered: isModelCovered(p.leagueName, p.leagueId, p.leagueCcode),
  }));
  const visible = withFlag.filter((p) => p.modelCovered);
  const uncovered = withFlag.filter((p) => !p.modelCovered);

  return NextResponse.json({
    ok: true,
    count: visible.length,
    predictions: visible,
    // Ayrı alan: eski istemciler bunu görmez → karne/istatistik hesapları
    // yanlışlıkla kapsam dışını içine almaz.
    uncovered,
    uncoveredCount: uncovered.length,
    coverage: { enforced: true, filteredOut: uncovered.length },
    calibration: {
      applied: calib.knots.length >= 2,
      segment: calib.segment,
      nSamples: calib.nSamples,
      fittedAt: calib.fittedAt,
    },
  });
}
