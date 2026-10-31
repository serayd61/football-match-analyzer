// Kanıt kartı PNG'sini yerelde üretir (Instagram'a elle yüklemek için).
// Çalıştırma: TSX_TSCONFIG_PATH=tsconfig.scripts.json node --import tsx scripts/social-proof-card.ts [en|tr] [çıktı.png]
// tsconfig.scripts.json: jsx + "server-only" stub (paket Next dışında fırlatır).
import { writeFileSync } from 'node:fs';
import { proofImage } from '../src/lib/social/image';

async function main() {
  const lang = (process.argv[2] === 'tr' ? 'tr' : 'en') as 'tr' | 'en';
  const out = process.argv[3] || `proof-${lang}.png`;
  const j: any = await fetch('https://footballanalytics.pro/api/v2/proof').then((r) => r.json());
  if (!j?.ok) throw new Error('proof yok');
  const png = await proofImage(j, lang);
  writeFileSync(out, png);
  console.log(`yazıldı: ${out} (${png.length} bayt) — ${j.record.doubleChance.accuracy}% / dün ${j.yesterday.correct}/${j.yesterday.total}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
