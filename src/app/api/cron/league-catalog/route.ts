// ============================================================================
// CRON: LEAGUE CATALOG — çözümsüz lig id'lerini ada+ülkeye çevirir.
//
// Sorun: feed maçlarda SEZONLUK lig id'si taşıyor; all-leagues haritası
// eşleşmiyor → engine_predictions'ta 263/263 lig "League 938221" kalmıştı ve
// ülke bilgisi hiç yoktu. Bu cron:
//  1) Bugün+yarının maçlarını çeker → haritadan çözülen adlar zaten
//     getMergedLeagueMap ile kataloğa akar.
//  2) Çözümsüz kalan id'leri (maçlardan + engine_predictions'tan) toplar,
//     /football-get-league-detail ile tek tek çözer, kataloğa upsert eder.
//  3) Katalog kalıcıdır → aynı id için ikinci kez API çağrısı yapılmaz.
//
// Günlük cron + elle backfill: ?limit=N (vars. 40, max 150). CRON_SECRET.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMatchesByDate, getLeagueDetail, getMatchLeagueInfo } from '@/lib/data-sources/free-football';
import { getCatalogMap, upsertLeagueCatalog, isUnresolvedLeagueName } from '@/lib/league-catalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get('limit') || '', 10);
  // Fallback'li çözüm ~2.2s/lig sürer; maxDuration 120s'e güvenli sığması
  // için parti üst sınırı 45 (backfill birkaç çağrıyla tamamlanır).
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 45) : 40;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) },
    }
  );

  // 1) Bugün+yarının maçları → çözümsüz id'ler (harita+katalog birleşimi
  //    normalize'da uygulandığı için burada kalanlar gerçekten çözümsüz).
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const [d1, d2] = await Promise.all([
    getMatchesByDate(today).catch(() => []),
    getMatchesByDate(tomorrow).catch(() => []),
  ]);
  // Lig başına örnek maç id'si: sezonluk id'ler league-detail'de çözülemiyor,
  // match-detail fallback'i bu örnek maçla lig adını + ülkeyi çıkarır.
  const sampleEvent = new Map<number, number>();
  const unresolvedFromFeed = new Set<number>();
  for (const m of [...d1, ...d2]) {
    if (isUnresolvedLeagueName(m.leagueName) && m.leagueId) {
      unresolvedFromFeed.add(m.leagueId);
      if (!sampleEvent.has(m.leagueId) && m.id) sampleEvent.set(m.leagueId, m.id);
    }
  }

  // 2) engine_predictions'taki tarihi çözümsüzler (karne/tahmin ekranları
  //    okuma anında katalogdan düzelsin diye onları da çözeriz).
  const { data: predRows } = await supabase
    .from('engine_predictions')
    .select('league_id, league_name, fixture_id')
    .like('league_name', 'League %')
    .limit(3000);
  const unresolvedFromDb = new Set<number>();
  for (const r of (predRows || []) as any[]) {
    if (r.league_id && isUnresolvedLeagueName(r.league_name)) {
      const lid = Number(r.league_id);
      unresolvedFromDb.add(lid);
      if (!sampleEvent.has(lid) && r.fixture_id) sampleEvent.set(lid, Number(r.fixture_id));
    }
  }

  // 3) Katalogda zaten çözülmüş olanları düş
  const catalog = await getCatalogMap();
  const targets: number[] = [];
  // Feed'dekiler öncelikli (bugün ekranda görünüyorlar)
  for (const id of unresolvedFromFeed) if (!catalog.has(id)) targets.push(id);
  for (const id of unresolvedFromDb) if (!catalog.has(id) && !unresolvedFromFeed.has(id)) targets.push(id);
  const batch = targets.slice(0, limit);

  // 4) Tek tek çöz (rate limit: ~700ms ara)
  let resolved = 0;
  let failed = 0;
  let sampleRaw: any = null;
  const resolvedEntries: { id: number; name: string; ccode: string; logo: string }[] = [];
  for (const id of batch) {
    // 1) league-detail (kanonik id'lerde çalışır)
    let entry: { name: string; ccode: string } | null = null;
    const det = await getLeagueDetail(id);
    if (det) entry = { name: det.name, ccode: det.ccode };

    // 2) fallback: ligin örnek maçının detayından leagueName + countryCode
    if (!entry) {
      const ev = sampleEvent.get(id);
      if (ev) {
        await sleep(500);
        const info = await getMatchLeagueInfo(ev);
        if (info) entry = { name: info.name, ccode: info.ccode };
      }
    }

    if (entry) {
      resolvedEntries.push({
        id,
        name: entry.name,
        ccode: entry.ccode,
        logo: `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${id}.png`,
      });
      resolved++;
      if (!sampleRaw) sampleRaw = { id, parsed: entry };
    } else {
      failed++;
    }
    await sleep(700);
  }
  const upserted = await upsertLeagueCatalog(resolvedEntries, 'league-detail');

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[league-catalog] done: feedUnresolved=${unresolvedFromFeed.size} dbUnresolved=${unresolvedFromDb.size} ` +
      `attempted=${batch.length} resolved=${resolved} failed=${failed} upserted=${upserted} (${elapsed}s)`
  );

  return NextResponse.json({
    success: true,
    catalogSize: catalog.size,
    feedUnresolved: unresolvedFromFeed.size,
    dbUnresolved: unresolvedFromDb.size,
    attempted: batch.length,
    resolved,
    failed,
    upserted,
    remaining: Math.max(0, targets.length - batch.length),
    sample: sampleRaw,
    elapsedSeconds: elapsed,
  });
}
