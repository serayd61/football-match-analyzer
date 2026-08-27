// ============================================================================
// API V2: PREDICTIONS LIST (korumalı, salt okuma)
// engine_predictions tablosundan yaklaşan tahminleri döndürür.
// ERİŞİM: giriş + aktif abonelik/deneme (veya admin) gerekir.
// Giriş yoksa 401, abonelik yoksa 403 döner — veri sızdırmaz.
//
// İki mod:
//   (varsayılan)      — önümüzdeki 24 saatin tahminleri + son 72 saatin
//                       sonuçları (recentResults).
//   ?results=<gün>    — SONUÇ/KARNE modu (istek 2026-08-27): son N günün
//                       sonuçlanmış tahminleri + pazar bazında isabet özeti.
//                       Özet SUNUCUDA hesaplanır (30-90 günlük pencere binlerce
//                       satır olabilir; istemciye yalnızca özet + son 150 satır
//                       gider). PostgREST 1000 satır sınırı .range() ile aşılır.
// ============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasEnginePredictionAccess } from '@/lib/accessControl';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';
import { getCalibration, applyCurve } from '@/lib/calibration';
import { deriveDoubleChance, isDoubleChanceCorrect } from '@/lib/double-chance';
import {
  deriveOverUnder, deriveBtts, isOverUnderCorrect, isBttsCorrect, MARKET_EDGE,
} from '@/lib/goal-markets';

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

// Karne özetindeki "yüksek güven" dilim eşikleri (kalibre değerler üzerinden).
// 1X2'de %60+, çifte şansta %75+ dilimi ayrıca raporlanır — kullanıcı
// "hangi yüzdeye güveneyim" sorusunu bu dilimlerle yanıtlar.
const HI_1X2 = 0.60;
const HI_DC = 0.75;
const RESULTS_ROWS = 150; // listeye giden satır sayısı (özet TÜM satırlardan)

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
  const resultsDaysRaw = parseInt(searchParams.get('results') || '', 10);
  const resultsDays = Number.isFinite(resultsDaysRaw)
    ? Math.min(Math.max(resultsDaysRaw, 1), 90)
    : null;

  const COLS =
    'fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, ' +
    'p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, ' +
    'pick, confidence, rationale, settled, home_score, away_score, result, correct, model_version';

  // Okuma-anı lig onarımı + kalibrasyon eğrileri her iki modda da gerekli.
  const EMPTY_CURVE = { knots: [], segment: 'none', nSamples: 0, fittedAt: null };
  const [catalog, calib, calibOu, calibBtts] = await Promise.all([
    getCatalogMap().catch(() => new Map()),
    getCalibration().catch(() => EMPTY_CURVE),
    getCalibration('ou25').catch(() => EMPTY_CURVE),
    getCalibration('btts').catch(() => EMPTY_CURVE),
  ]);

  const mapRow = (p: any) => {
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
  };
  const coveredOf = (p: ReturnType<typeof mapRow>) =>
    isModelCovered(p.leagueName, p.leagueId, p.leagueCcode);

  const calibrationInfo = {
    applied: calib.knots.length >= 2,
    segment: calib.segment,
    nSamples: calib.nSamples,
    fittedAt: calib.fittedAt,
  };

  // ==========================================================================
  // SONUÇ/KARNE MODU — pazar bazında isabet yüzdeleri + son maç listesi.
  // Yalnızca model kapsamındaki ligler (karneyle tutarlı); void'ler (result
  // NULL) zaten sorgu dışı. Yüzdeler kalibre değerler üzerinden dilimlenir.
  // ==========================================================================
  if (resultsDays) {
    const now = new Date();
    const back = new Date(now.getTime() - resultsDays * 24 * 60 * 60 * 1000);
    const PAGE = 1000;
    const raw: any[] = [];
    for (let from = 0; from < 20000; from += PAGE) {
      const { data: page, error } = await sb()
        .from('engine_predictions')
        .select(COLS)
        .eq('settled', true)
        .not('result', 'is', null)
        .gte('kickoff', back.toISOString())
        .lt('kickoff', now.toISOString())
        .order('kickoff', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error('[predictions/list results] error:', error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      if (!page?.length) break;
      raw.push(...page);
      if (page.length < PAGE) break;
    }

    const rows = raw.map(mapRow).filter(coveredOf);

    const mk = () => ({ n: 0, ok: 0, hiN: 0, hiOk: 0 });
    const summary = { x12: mk(), dc: mk(), ou25: mk(), btts: mk() };
    for (const p of rows) {
      if (p.correct != null) {
        summary.x12.n++;
        if (p.correct === true) summary.x12.ok++;
        if ((p.confidence ?? 0) >= HI_1X2) {
          summary.x12.hiN++;
          if (p.correct === true) summary.x12.hiOk++;
        }
      }
      const res = p.result as 'H' | 'D' | 'A' | null;
      if (p.doubleChance && res) {
        const ok = isDoubleChanceCorrect(p.doubleChance.pick, res);
        summary.dc.n++;
        if (ok) summary.dc.ok++;
        if (p.doubleChance.p >= HI_DC) {
          summary.dc.hiN++;
          if (ok) summary.dc.hiOk++;
        }
      }
      const hs = p.homeScore, as = p.awayScore;
      if (hs != null && as != null) {
        if (p.overUnder) {
          const ok = isOverUnderCorrect(p.overUnder.pick, hs, as);
          summary.ou25.n++;
          if (ok) summary.ou25.ok++;
          // "hi" = arayüzde GÖSTERİLEN seçimler (kalibre güven ≥ MARKET_EDGE):
          // kullanıcının gördüğü satırların gerçek isabetini ölçer.
          if ((p.overUnder.p ?? 0) >= MARKET_EDGE) {
            summary.ou25.hiN++;
            if (ok) summary.ou25.hiOk++;
          }
        }
        if (p.btts) {
          const ok = isBttsCorrect(p.btts.pick, hs, as);
          summary.btts.n++;
          if (ok) summary.btts.ok++;
          if ((p.btts.p ?? 0) >= MARKET_EDGE) {
            summary.btts.hiN++;
            if (ok) summary.btts.hiOk++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      days: resultsDays,
      totalRows: rows.length,
      summary,
      thresholds: { x12Hi: HI_1X2, dcHi: HI_DC, goalEdge: MARKET_EDGE },
      results: rows.slice(0, RESULTS_ROWS),
      calibration: calibrationInfo,
    });
  }

  // ==========================================================================
  // VARSAYILAN MOD — yaklaşan tahminler (+ son 72 saatin sonuçları)
  // ==========================================================================
  let q = sb()
    .from('engine_predictions')
    .select(COLS)
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

  // Sonuçlanan tahminler ekranda 3 GÜN kalır (istek: 2026-08-25). Maç
  // başlayınca karttan anında düşmesi "tahminler yok oluyor" hissi
  // veriyordu; ayrıca skor + tuttu/tutmadı görünmesi kanıt döngüsünün
  // parçası. Veri SİLİNMEZ (kalibrasyon + karne bu satırlardan beslenir),
  // yalnızca 72 saatten eskiler bu listeden çıkar. Void'ler (result NULL)
  // gösterilmez. Daha uzun pencere için ?results= modu kullanılır.
  let settledData: any[] = [];
  if (!date) {
    const now = new Date();
    const back72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const { data: sd, error: sErr } = await sb()
      .from('engine_predictions')
      .select(COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .gte('kickoff', back72h.toISOString())
      .lt('kickoff', now.toISOString())
      .order('kickoff', { ascending: false })
      .limit(120);
    if (sErr) console.error('[predictions/list] settled read:', sErr.message);
    else settledData = sd || [];
  }

  const predictions = (data || []).map(mapRow);

  // Model kapsamı: tahminler GİZLENMEZ, ETİKETLENİR. Fit edilmiş ligler
  // ana liste; kalanlar `uncovered` altında ayrı döner ve arayüzde "kapsam
  // dışı — istatistiksel yedek" olarak gösterilir.
  // Ölçüm 2026-08-11: kapsam dışı ligler %49.4 isabet; ana listeyle
  // karıştırılırsa karne motoru değil yedeği ölçer (bkz. model-coverage.ts).
  const withFlag = predictions.map((p) => ({
    ...p,
    modelCovered: coveredOf(p),
  }));
  const visible = withFlag.filter((p) => p.modelCovered);
  const uncovered = withFlag.filter((p) => !p.modelCovered);

  // Son 3 günün sonuçları — yalnızca kapsanan ligler (kapsam dışı zaten
  // istatistiklere girmez; sonuç listesinde de karneyi bulandırmasın).
  const recentResults = settledData.map(mapRow).filter(coveredOf);

  return NextResponse.json({
    ok: true,
    count: visible.length,
    predictions: visible,
    recentResults,
    recentDays: 3,
    // Ayrı alan: eski istemciler bunu görmez → karne/istatistik hesapları
    // yanlışlıkla kapsam dışını içine almaz.
    uncovered,
    uncoveredCount: uncovered.length,
    coverage: { enforced: true, filteredOut: uncovered.length },
    calibration: calibrationInfo,
  });
}
