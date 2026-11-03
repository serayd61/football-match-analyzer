// feed_matches geri doldurma (2026-11-03). Akışın son N gününü tabloya yazar;
// günlük cron yalnız D-3..D'yi işlediği için ilk kurulumda bir kez çalıştırılır.
// Kullanım (repo kökünde, .env.local ile):
//   TSX_TSCONFIG_PATH=tsconfig.scripts.json node --import tsx scripts/backfill-feed-matches.ts [gün=60]
// (tsconfig.scripts.json "server-only" paketini stub'lar; onsuz db.ts import'u fırlatır.)
// Her gün 1 akış çağrısı (~1 sn aralıklı); 60 gün ≈ 60 çağrı, kota 200k/ay.
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v as string;

async function main() {
  const { ingestFeedDay } = await import('@/lib/site/feed-matches');
  const { recentDays } = await import('@/lib/site/feed-matches-pure');
  const back = Number(process.argv[2] || 60);
  const dates = recentDays(back);
  let fetched = 0, written = 0, finished = 0, errors = 0;
  for (const d of dates) {
    const r = await ingestFeedDay(d);
    fetched += r.fetched; written += r.written; finished += r.finished; if (r.error) errors++;
    console.log(`${d}  akış ${String(r.fetched).padStart(4)}  yazıldı ${String(r.written).padStart(4)}  bitmiş ${String(r.finished).padStart(4)}${r.error ? `  HATA ${r.error}` : ''}`);
    await new Promise((res) => setTimeout(res, 1100));
  }
  console.log(`\nToplam ${dates.length} gün · akış ${fetched} · yazıldı ${written} · bitmiş ${finished} · hatalı gün ${errors}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
