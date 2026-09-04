// ============================================================================
// CRON — DAILY FEATURED ANALYSES (günde 1 kez, sabah)
// ----------------------------------------------------------------------------
// "Günün Analizleri" bloğunun ÜRETİM ayağı. Ölçüm (2026-08-28): tam konsensüs
// analizi (dixonColes/marketModel + smart + survival) yalnızca kullanıcı maç
// sayfası açınca üretiliyordu — 5 günde 2 satır; batch worker sadece ucuz
// 'smart' analizini koşuyor. Bu cron her sabah vitrin-değerli EN FAZLA 3 maç
// için TAM unified consensus'u koşar ve unified_analysis'e yazar → kullanıcı
// tıklayınca analiz cache'ten anında açılır, ertesi gün settle-unified
// sonuçlandırınca dashboard'daki karne şeridine düşer.
// Maliyet tavanı: günde ≤3 tam analiz, süre bütçesi dolunca erken durur.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMatchesByDate, FFMatch } from '@/lib/data-sources/free-football';
import { runUnifiedConsensus, saveUnifiedAnalysis } from '@/lib/unified-consensus';
import { getRedisClient } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TAKE = 3;
const TIME_BUDGET_MS = 240_000; // 300s limitine 60s emniyet payı

// Vitrin önceliği (queue-daily ile aynı yöntem): kanonik lig id'leri + TAM
// "ad|ülke" eşleşmesi. Gevşek regex TUZAK: /premier league/i "Canadian
// Premier League"i, /bundesliga/i "Frauen-Bundesliga"yı yakalar (2026-08-28
// ilk koşuda yaşandı). Sadece bu ligler analiz edilir — maliyet kontrolü.
const SHOWCASE_IDS = new Map<number, number>([
  [77, 0], [894789, 0], [42, 0],          // Dünya Kupası, UCL
  [47, 1], [87, 1], [55, 1], [54, 1], [53, 1], // top-5
  [73, 2],                                 // UEL
]);
const SHOWCASE_NAMES = new Map<string, number>([
  ['World Cup|INT', 0], ['Champions League|INT', 0],
  ['Premier League|ENG', 1], ['LaLiga|ESP', 1], ['Serie A|ITA', 1],
  ['Bundesliga|GER', 1], ['Ligue 1|FRA', 1],
  ['Europa League|INT', 2],
]);
function showcasePriority(f: FFMatch): number | null {
  const byId = SHOWCASE_IDS.get(f.leagueId);
  if (byId != null) return byId;
  const byName = SHOWCASE_NAMES.get(`${f.leagueName}|${(f.leagueCountry || '').toUpperCase()}`);
  return byName ?? null; // vitrin dışı — analiz edilmez
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const t0 = Date.now();

  // 1) Bugün + yarının fikstürleri; önümüzdeki 2-40 saat penceresi
  const now = Date.now();
  const [d1, d2] = await Promise.all([
    getMatchesByDate(new Date()),
    getMatchesByDate(new Date(now + 86_400_000)),
  ]);
  const seen = new Set<number>();
  const candidates = [...d1, ...d2]
    .filter((m) => {
      if (!m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      if (m.started || m.finished || m.cancelled) return false;
      const ko = new Date(m.utcTime).getTime();
      return ko > now + 2 * 3600_000 && ko < now + 40 * 3600_000;
    })
    .map((m) => ({ m, p: showcasePriority(m) }))
    .filter((x): x is { m: FFMatch; p: number } => x.p != null)
    .sort(
      (a, b) =>
        a.p - b.p || new Date(a.m.utcTime).getTime() - new Date(b.m.utcTime).getTime(),
    );

  if (!candidates.length) {
    return NextResponse.json({ ok: true, analyzed: [], reason: 'no showcase fixtures' });
  }

  // 2) Zaten TAM analizi olan maçları atla (smart-only satırlar tam sayılmaz)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const ids = candidates.slice(0, 30).map((x) => x.m.id);
  const { data: existing } = await supabase
    .from('unified_analysis')
    .select('fixture_id, match_result_prediction')
    .in('fixture_id', ids);
  const hasFull = new Set(
    (existing || [])
      .filter((r: any) => ['1', 'X', '2'].includes(r.match_result_prediction))
      .map((r: any) => r.fixture_id),
  );

  // 2b) Yeniden deneme koruması (vercel.json: 06:00 + 09:00). Pencerede zaten
  // ≥TAKE tam analiz varsa yeni maliyet üretme. 06:00 koşusu veri kaynağı
  // kesintisinde boş dönerse (2026-09-04: RapidAPI ödeme gecikmesi, 06:01 koşusu
  // HTTP 429/403 → "no showcase fixtures", vitrin gün boyu boş kaldı) 09:00 koşusu doldurur.
  if (hasFull.size >= TAKE) {
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - t0,
      analyzed: [],
      reason: `already have ${hasFull.size} full analyses in window`,
    });
  }

  // 3) En fazla TAKE maç için tam konsensüs (sıralı; süre bütçesi dolunca dur)
  const analyzed: any[] = [];
  const skipped: any[] = [];
  for (const { m } of candidates) {
    if (analyzed.length >= TAKE) break;
    if (Date.now() - t0 > TIME_BUDGET_MS) {
      skipped.push({ fixtureId: m.id, reason: 'time budget' });
      break;
    }
    if (hasFull.has(m.id)) {
      skipped.push({ fixtureId: m.id, reason: 'already analyzed' });
      continue;
    }
    try {
      const input = {
        fixtureId: m.id,
        homeTeam: m.homeName,
        awayTeam: m.awayName,
        homeTeamId: m.homeId,
        awayTeamId: m.awayId,
        league: m.leagueName,
        matchDate: m.utcTime,
        lang: 'tr' as const,
      };
      const result = await runUnifiedConsensus(input);
      await saveUnifiedAnalysis(input, result);
      analyzed.push({
        fixtureId: m.id,
        match: `${m.homeName} vs ${m.awayName}`,
        league: m.leagueName,
        prediction: result.predictions?.matchResult?.prediction,
        confidence: result.predictions?.matchResult?.confidence,
        systems: (result as any).systemsUsed,
      });
    } catch (e: any) {
      console.error(`[daily-featured] ${m.homeName} vs ${m.awayName} failed:`, e?.message);
      skipped.push({ fixtureId: m.id, reason: e?.message || 'error' });
    }
  }

  // 4) Vitrin cache'ini tazele (yeni analizler hemen görünsün)
  if (analyzed.length) {
    try {
      await getRedisClient().del('daily-analyses:v2');
    } catch {
      /* cache tazeleme opsiyonel */
    }
  }

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - t0,
    analyzed,
    skipped: skipped.slice(0, 10),
  });
}
