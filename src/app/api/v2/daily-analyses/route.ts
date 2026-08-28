// ============================================================================
// API V2: DAILY ANALYSES — Günün Analizleri (public özet)
// ----------------------------------------------------------------------------
// Gece batch'i (queue-daily → QStash worker) üst lig maçlarını zaten analiz
// edip unified_analysis'e yazıyor; settle-unified cron'u da sonuçları işliyor.
// Bu uç o hazır veriden iki liste türetir:
//   today   — önümüzdeki 36 saatin en vitrin-değerli 3 analizi (özet)
//   settled — son 48 saatte sonuçlanan 3 analiz: skor + tuttu/tutmadı
// Tam analiz maç sayfasında (login + günlük hak) — burada yalnızca özet var,
// o yüzden uç halka açık. Link paramları (homeId/awayId) fikstür listesinden
// zenginleştirilir; bulunamazsa satır yine döner (id'ler null olur, arayüz
// linki id'siz kurar — maç sayfası bugünün maçını kendisi çözebilir).
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOrSet } from '@/lib/cache/redis';
import { getMatchesByDate, FFMatch } from '@/lib/data-sources/free-football';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TAKE = 3;

// Vitrin önceliği: büyük turnuva/lig önce. unified_analysis lig ID taşımadığı
// için ad üzerinden — ama ÇAPALI (^...$): gevşek /premier league/i "Canadian
// Premier League"i, /bundesliga/i "Frauen-Bundesliga"yı yakalıyordu.
const LEAGUE_PRIORITY: [RegExp, number][] = [
  [/^(uefa )?champions league$/i, 0],
  [/^(fifa )?world cup( 2\d{3})?$/i, 0],
  [/^premier league$/i, 1],
  [/^la ?liga$/i, 1],
  [/^serie a$/i, 1],
  [/^bundesliga$/i, 1],
  [/^ligue 1$/i, 1],
  [/^(uefa )?europa league$/i, 2],
  [/^conference league/i, 3],
];
function leaguePriority(name: string | null): number {
  for (const [re, p] of LEAGUE_PRIORITY) if (re.test(name || '')) return p;
  return 4;
}

interface Row {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string | null;
  match_date: string;
  match_result_prediction: string | null;
  match_result_confidence: number | null;
  over_under_prediction: string | null;
  over_under_confidence: number | null;
  btts_prediction: string | null;
  btts_confidence: number | null;
  risk_level: string | null;
  is_settled: boolean | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  match_result_correct: boolean | null;
  over_under_correct: boolean | null;
  btts_correct: boolean | null;
}

const COLS =
  'fixture_id, home_team, away_team, league, match_date, ' +
  'match_result_prediction, match_result_confidence, over_under_prediction, ' +
  'over_under_confidence, btts_prediction, btts_confidence, risk_level, ' +
  'is_settled, actual_home_score, actual_away_score, ' +
  'match_result_correct, over_under_correct, btts_correct';

function rank(a: Row, b: Row): number {
  const p = leaguePriority(a.league) - leaguePriority(b.league);
  if (p !== 0) return p;
  return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
}

function summarize(r: Row, fx: Map<number, FFMatch>) {
  const f = fx.get(r.fixture_id);
  return {
    fixtureId: r.fixture_id,
    home: r.home_team,
    away: r.away_team,
    homeId: f?.homeId ?? null,
    awayId: f?.awayId ?? null,
    league: r.league,
    kickoff: r.match_date,
    matchResult: r.match_result_prediction
      ? { prediction: r.match_result_prediction, confidence: r.match_result_confidence ?? 0 }
      : null,
    overUnder: r.over_under_prediction
      ? { prediction: r.over_under_prediction, confidence: r.over_under_confidence ?? 0 }
      : null,
    btts: r.btts_prediction
      ? { prediction: r.btts_prediction, confidence: r.btts_confidence ?? 0 }
      : null,
    risk: r.risk_level,
    result: r.is_settled
      ? {
          homeScore: r.actual_home_score,
          awayScore: r.actual_away_score,
          matchResultCorrect: r.match_result_correct,
          overUnderCorrect: r.over_under_correct,
          bttsCorrect: r.btts_correct,
        }
      : null,
  };
}

async function build() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const now = Date.now();
  const [upcoming, settled] = await Promise.all([
    supabase
      .from('unified_analysis')
      .select(COLS)
      .gte('match_date', new Date(now - 2 * 3600_000).toISOString())
      .lte('match_date', new Date(now + 36 * 3600_000).toISOString())
      .order('match_date', { ascending: true })
      .limit(60),
    supabase
      .from('unified_analysis')
      .select(COLS)
      .eq('is_settled', true)
      .gte('match_date', new Date(now - 48 * 3600_000).toISOString())
      .lt('match_date', new Date(now).toISOString())
      .order('match_date', { ascending: false })
      .limit(60),
  ]);

  // Kalite kapısı: yalnızca TAM konsensüs satırları ('1'/'X'/'2' formatı).
  // 'home/under/no' formatlı satırlar smart-only hızlı analizden gelir —
  // jenerik şablon güvenleri + saatsiz match_date taşır, vitrine çıkmaz.
  const isFull = (r: Row) => ['1', 'X', '2'].includes(r.match_result_prediction || '');
  const todayRows = ((upcoming.data || []) as unknown as Row[])
    .filter((r) => !r.is_settled && isFull(r))
    .sort(rank)
    .slice(0, TAKE);
  const settledRows = ((settled.data || []) as unknown as Row[])
    .filter(isFull)
    .sort(rank)
    .slice(0, TAKE);

  // Link paramları için takım id zenginleştirmesi (en fazla 3 tarih çağrısı)
  const dates = new Set<string>();
  for (const r of [...todayRows, ...settledRows]) dates.add(r.match_date.slice(0, 10));
  const fx = new Map<number, FFMatch>();
  await Promise.all(
    Array.from(dates)
      .slice(0, 3)
      .map(async (d) => {
        try {
          for (const m of await getMatchesByDate(d)) fx.set(m.id, m);
        } catch {
          /* zenginleştirme opsiyonel */
        }
      }),
  );

  return {
    ok: true,
    today: todayRows.map((r) => summarize(r, fx)),
    settled: settledRows.map((r) => summarize(r, fx)),
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const data = await getOrSet('daily-analyses:v2', build, 15 * 60);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (e: any) {
    console.error('[daily-analyses]', e?.message);
    return NextResponse.json({ ok: false, today: [], settled: [] }, { status: 200 });
  }
}
