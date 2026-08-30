// ============================================================================
// API V2: PROOF — landing "kanıt" bloğunun tek veri kaynağı (HERKESE AÇIK)
// ----------------------------------------------------------------------------
// NEDEN: reklamdan gelen ziyaretçi kayıt olmadan hiçbir gerçek sayı
// görmüyordu (landing yalnızca görsel + jenerik özellik metniydi; 14 tıklama →
// 0 kayıt, 2026-08-29). Bu uç, ürünün ölçülmüş karnesini anonim ziyaretçiye
// açar: hangi orana ne kadar güvenebileceğini ilk ekranda görür.
//
// DÜRÜSTLÜK KURALI: seçim kuralı SONUÇTAN ÖNCE sabittir (kapsanan lig +
// çifte şans olasılığı >= HIGH_P) ve dönen listede kaybedenler de vardır.
// Ayıklanmış "sadece tutanlar" listesi ASLA üretilmez — karnenin tüm değeri
// denetlenebilir olmasından gelir.
//
// Manşet metrik ÇİFTE ŞANS'tır (1X/X2/12), 1X2 değil: 1X2 argmax'ı yapısal
// olarak ~%49 tavanlı (maçların ~%24'ü beraberlik biter ama beraberlik
// neredeyse hiç argmax olmaz — bkz. lib/double-chance.ts). Aynı olasılıklar
// çifte şansa çevrildiğinde ölçülen isabet %76. İki rakam da döner ve
// arayüzde İKİSİ BİRDEN gösterilir — yüksek olanı seçip diğerini gizlemek
// yanıltıcı olurdu.
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getOrSet } from '@/lib/cache/redis';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';
import { deriveDoubleChance, isDoubleChanceCorrect } from '@/lib/double-chance';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CACHE_KEY = 'proof:v1';
const CACHE_TTL = 900; // 15 dk — karne gün içinde nadiren değişir
/** Vitrin eşiği: çifte şans ham olasılığı. Ölçüm: bu dilimde isabet ~%80. */
const HIGH_P = 0.8;
const MAX_ROWS = 8;
/** Karne için geriye bakılacak en fazla gün (maç olmayan günler atlanır). */
const LOOKBACK_DAYS = 7;

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

interface ScopeRow { scope: string; n: number; ok: number; acc: number }

export interface ProofPick {
  fixtureId: number;
  home: string;
  away: string;
  league: string;
  ccode: string;
  homeScore: number | null;
  awayScore: number | null;
  /** '1X' | 'X2' | '12' */
  dcPick: string;
  /** Seçimin kapsadığı takım adı ("X takımı veya beraberlik" arayüzde kurulur) */
  dcExcludes: 'H' | 'D' | 'A';
  probability: number;
  correct: boolean;
}

async function build() {
  // ── 1) Manşet oranlar (agregat, DB fonksiyonu) ───────────────────────────
  // 6.800+ satırı her istekte istemciye çekmemek için Postgres'te toplanır.
  const { data: scopes, error: scopeErr } = await sb().rpc('engine_proof_summary');
  if (scopeErr) throw new Error(`proof summary: ${scopeErr.message}`);

  const byScope = new Map<string, ScopeRow>(
    ((scopes as ScopeRow[]) || []).map((r) => [r.scope, r]),
  );
  const pick = (k: string) => {
    const r = byScope.get(k);
    return r ? { total: Number(r.n), correct: Number(r.ok), accuracy: Number(r.acc) } : null;
  };

  // ── 2) Dünün (en yakın sonuçlanmış günün) gerçek karnesi ─────────────────
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: rows, error: rowErr } = await sb()
    .from('engine_predictions')
    .select(
      'fixture_id, league_id, league_name, home_name, away_name, kickoff, ' +
      'home_score, away_score, result, p_home, p_draw, p_away',
    )
    .eq('settled', true)
    .not('result', 'is', null)
    .gte('kickoff', since)
    .order('kickoff', { ascending: false })
    .limit(1200);
  if (rowErr) throw new Error(`proof rows: ${rowErr.message}`);

  const catalog = await getCatalogMap().catch(() => new Map());

  // Kapsanan lig + yüksek güvenli çifte şans → vitrin adayları
  const candidates = (rows || [])
    .map((r: any) => {
      const cat = catalog.get(Number(r.league_id));
      const leagueName =
        isUnresolvedLeagueName(r.league_name) && cat ? cat.name : r.league_name;
      const ccode = cat?.ccode || '';
      const dc = deriveDoubleChance(r.p_home, r.p_draw, r.p_away);
      return { r, leagueName, ccode, dc };
    })
    .filter(
      (x) =>
        x.dc != null &&
        x.dc.p >= HIGH_P &&
        isModelCovered(x.leagueName, x.r.league_id, x.ccode),
    );

  // En yakın maçı OLAN günü seç (dün maç yoksa bir önceki güne düşer)
  const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
  const day = candidates.length ? dayKey(candidates[0].r.kickoff) : null;
  const dayRows = day ? candidates.filter((x) => dayKey(x.r.kickoff) === day) : [];

  const picks: ProofPick[] = dayRows
    .sort((a, b) => (b.dc!.p - a.dc!.p))
    .slice(0, MAX_ROWS)
    .map((x) => ({
      fixtureId: x.r.fixture_id,
      home: x.r.home_name,
      away: x.r.away_name,
      league: x.leagueName,
      ccode: x.ccode,
      homeScore: x.r.home_score,
      awayScore: x.r.away_score,
      dcPick: x.dc!.pick,
      dcExcludes: x.dc!.excludes,
      probability: Math.round(x.dc!.p * 100),
      correct: isDoubleChanceCorrect(x.dc!.pick, x.r.result as 'H' | 'D' | 'A'),
    }));

  return {
    ok: true,
    record: {
      doubleChance: pick('dc_all'),
      doubleChance30d: pick('dc_30d'),
      doubleChanceHigh: pick('dc_high'),
      matchResult: pick('mr_all'),
    },
    yesterday: {
      date: day,
      picks,
      total: picks.length,
      correct: picks.filter((p) => p.correct).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const payload = await getOrSet(CACHE_KEY, build, CACHE_TTL);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (e: any) {
    console.error('[proof]', e?.message);
    // Kanıt bloğu landing'i ASLA kırmamalı — bileşen ok:false'ta hiç render etmez
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 200 });
  }
}
