import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { memberRewritePath, isMemberPath, MEMBER_SEGMENT } from '@/lib/site/member-routes';
import { ANON_ACCESS, canSeeMatches } from '@/lib/site/access';
import { routing } from '@/i18n/routing';

// Anonim ISR ayrımı (2026-11-08, Core Web Vitals).
//
// Maç sayfası `force-dynamic`'ti çünkü gövdesi oturum okuyordu → her istekte
// `private, no-store` + CDN MISS + kaynakta TTFB ~1,0 sn (SC mobil CWV: 0 iyi
// URL). Artık anonim istek ISR rotasından, üye isteği rewrite ile dinamik
// rotadan geliyor. En kırılgan nokta: ISR ağacındaki herhangi bir dosya
// `cookies()` / `headers()` / `getServerSession` / `isTwa()` ÇAĞIRIRSA Next
// sessizce dinamiğe düşer ve kazanç uyarı vermeden kaybolur. Bu test import
// grafiğini yürüyüp o çağrıları arıyor.

const ROOT = resolve(__dirname, '..');
const ISR_ROUTE = resolve(ROOT, 'src/app/(site)/[locale]/matches/[slug]/page.tsx');
const MEMBER_ROUTE = resolve(ROOT, `src/app/(site)/[locale]/${MEMBER_SEGMENT}/matches/[slug]/page.tsx`);

/** `@/x` ve göreli importları dosya yoluna çözer; çözülemeyeni atlar (node_modules). */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = resolve(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // paket
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    if (existsSync(base + ext) && !existsSync(base + ext + '/')) return base + ext;
  }
  return null;
}

/** Yorumları ve şablon/dize içeriğini bozmadan yalnız satır yorumlarını atar. */
const stripComments = (src: string) =>
  src.split('\n').filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('/*')).join('\n');

function importGraph(entry: string): Map<string, string> {
  const out = new Map<string, string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (out.has(file)) continue;
    const src = readFileSync(file, 'utf8');
    out.set(file, src);
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g)) {
      const dep = resolveImport(m[1], file);
      if (dep) queue.push(dep);
    }
    for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const dep = resolveImport(m[1], file);
      if (dep) queue.push(dep);
    }
  }
  return out;
}

// Next'te bunlardan HERHANGİ BİRİ render sırasında çalışırsa rotanın
// `revalidate`'i 0'a çekilir ve yanıt `private, no-store` ile çıkar — hata
// yakalansa bile. 2026-11-08 ölçümü: oturum okuması tek suçlu değildi;
// `loadEngineVersions()` (cache: 'no-store') maç/takım/gün sayfalarını
// sessizce dinamiğe düşürüyordu ve hangisinin düşeceği 5 dakikalık süreç
// memo'sunun (predictions.ts loadContext) o anda sıcak olup olmamasına
// bağlıydı. Site artık aktif sürümü official.ts siteActiveVersionRow ile,
// db() üzerinden (revalidate 300) okuyor.
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bcookies\s*\(\s*\)/, 'cookies()'],
  [/\bheaders\s*\(\s*\)/, 'headers()'],
  [/\bgetServerSession\s*\(/, 'getServerSession()'],
  [/\bisTwa\s*\(\s*\)/, 'isTwa()'],
  [/\bgetSiteAccess\s*\(\s*\)/, 'getSiteAccess()'],
  [/\brequireSiteAccess\s*\(/, 'requireSiteAccess()'],
  [/\bunstable_noStore\b/, 'unstable_noStore()'],
  [/\bloadEngineVersions\s*\(/, 'loadEngineVersions()'],
];

/** Kuralın kendi TANIMINI eşlediği dosyalar (çağrı değil, bildirim). */
const DECLARES: Record<string, string[]> = {
  'src/lib/engine/versions.ts': ['loadEngineVersions()'], // burada tanımlanır; ingest/params rotası çağırabilir
  'src/lib/site/twa.ts': ['isTwa()', 'cookies()'],
  'src/lib/site/access.ts': ['getSiteAccess()', 'getServerSession()', 'requireSiteAccess()'],
};

/**
 * `cache: 'no-store'` fetch'i ÜRETEN, ISR ağacından erişilebilen modüller.
 * Bunlar istemciyi TANIMLAR; tehlikeli olan onları render içinden çağırmak.
 * Liste anlık görüntü: BÜYÜMEMESİ gerekiyor. Yeni bir satır eklenirse, o
 * modülün herkese açık sayfa yolundan çağrılıp çağrılmadığı incelenmeli.
 *
 * goal-book.ts, db.ts'in kendi notuna rağmen (`Sayfalar db() ile kalır`)
 * dbFresh() kullanıyor ve /predictions/{id} ile liste fonksiyonlarından
 * çağrılıyor — maç sayfası oranları göstermediği için 2a'yı etkilemiyor, ama
 * ana sayfa / predictions ISR'a alınırken (2b/2c) önce bu çözülmeli.
 */
const KNOWN_NO_STORE = [
  'src/lib/site/db.ts',              // dbFresh() fabrikası
  'src/lib/site/goal-book.ts',       // dbFresh() ÇAĞIRIYOR — 2b/2c öncesi incelenecek
  'src/lib/engine/versions.ts',      // no-store istemci (ingest / params rotası)
  'src/lib/calibration.ts',
  'src/lib/league-catalog.ts',
  'src/lib/data-sources/free-football.ts',
].sort();

test('ISR maç rotasının import grafiğinde istek başına okuma yapan hiçbir çağrı yok', () => {
  const graph = importGraph(ISR_ROUTE);
  assert.ok(graph.size > 15, `import grafiği yürümedi (${graph.size} dosya)`);
  const hits: string[] = [];
  for (const [file, src] of graph) {
    // İstemci bileşenleri tarayıcıda çalışır, sunucu render'ını dinamik yapmaz.
    if (/^\s*['"]use client['"]/m.test(src)) continue;
    const rel = file.slice(ROOT.length + 1);
    const code = stripComments(src);
    for (const [rx, name] of FORBIDDEN) {
      if (!rx.test(code)) continue;
      if (DECLARES[rel]?.includes(name)) continue; // tanım, çağrı değil
      hits.push(`${rel} → ${name}`);
    }
  }
  assert.deepEqual(hits, [], `ISR ağacı dinamiğe düşecek:\n${hits.join('\n')}`);
});

test('ISR ağacındaki no-store üreten modül listesi büyümedi', () => {
  const graph = importGraph(ISR_ROUTE);
  const found: string[] = [];
  for (const [file, src] of graph) {
    if (/^\s*['"]use client['"]/m.test(src)) continue;
    const code = stripComments(src);
    if (/cache:\s*['"]no-store['"]/.test(code) || /\bnext:\s*\{[^}]*revalidate:\s*0/.test(code) || /(?<!function )\bdbFresh\s*\(\s*\)/.test(code)) {
      found.push(file.slice(ROOT.length + 1));
    }
  }
  assert.deepEqual(found.sort(), KNOWN_NO_STORE,
    'ISR ağacına yeni bir no-store kaynağı girdi ya da biri çıktı — herkese açık sayfa yolundan çağrılıyor mu, kontrol et');
});

test('ISR rotası generateStaticParams tanımlar — yoksa revalidate yok sayılır', () => {
  // 2026-11-08 yerel üretim ölçümü (tam korelasyon):
  //   generateStaticParams VAR  → Cache-Control: s-maxage=300, stale-while-revalidate
  //   generateStaticParams YOK  → Cache-Control: private, no-store   (revalidate yok sayılır)
  // /leagues/{slug} ve /performance/{slug} tanımlıyordu ve önbellekleniyordu;
  // /teams/{slug}, /matches/{slug} ve gün merkezleri tanımlamıyordu, girmiyordu.
  // Boş liste dönmek yeterli: build'de sayfa üretilmez, ilk istek MISS olup
  // ISR önbelleğine yazılır.
  const isr = readFileSync(ISR_ROUTE, 'utf8');
  assert.match(isr, /export function generateStaticParams/);
});

test('ISR rotası revalidate veriyor, force-dynamic vermiyor; üye rotası tersi', () => {
  const isr = readFileSync(ISR_ROUTE, 'utf8');
  assert.match(isr, /export const revalidate = \d+/);
  assert.ok(!/force-dynamic/.test(stripComments(isr)), 'ISR rotasında force-dynamic kalmış');
  assert.match(isr, /ANON_ACCESS/);

  const member = readFileSync(MEMBER_ROUTE, 'utf8');
  assert.match(member, /export const dynamic = 'force-dynamic'/);
  assert.match(member, /getSiteAccess\(\)/);
  assert.match(member, /isTwa\(\)/);
  // noindex yalnız /m/ adresi elle yazıldığında; rewrite'ta temiz URL
  // indekslenebilir kalır (middleware MEMBER_REWRITE_HEADER ekler).
  assert.match(member, /robots: \{ index: false/);
  assert.match(member, /MEMBER_REWRITE_HEADER/);
  assert.ok(!/^\s*return \{ \.\.\.meta, robots/m.test(member), 'noindex koşulsuz basılıyor');
});

test('iki rota da aynı render bileşenini çağırır (kod tekrarı yok)', () => {
  const isr = readFileSync(ISR_ROUTE, 'utf8');
  const member = readFileSync(MEMBER_ROUTE, 'utf8');
  for (const [name, src] of [['ISR', isr], ['üye', member]] as const) {
    assert.match(src, /from '@\/components\/site\/pages\/MatchPage'/, name);
    assert.match(src, /matchMetadata\(/, name);
  }
  // Gövde yalnız bileşende: rota dosyaları ince kalmalı.
  assert.ok(isr.split('\n').length < 60 && member.split('\n').length < 60);
});

test('rewrite kuralı: yalnız maç yolları, her dil, döngü koruması', () => {
  for (const l of routing.locales) {
    assert.equal(memberRewritePath(`/${l}/matches/arsenal-vs-chelsea-1`), `/${l}/${MEMBER_SEGMENT}/matches/arsenal-vs-chelsea-1`);
    assert.equal(memberRewritePath(`/${l}/matches/today`), `/${l}/${MEMBER_SEGMENT}/matches/today`);
    // Döngü: zaten üye ağacındayız
    assert.equal(memberRewritePath(`/${l}/${MEMBER_SEGMENT}/matches/arsenal-vs-chelsea-1`), null);
    assert.ok(isMemberPath(`/${l}/${MEMBER_SEGMENT}/matches/x`));
    assert.ok(!isMemberPath(`/${l}/matches/x`));
    // Hub'ın kendisi oturumdan bağımsız → dokunulmaz, herkese CDN'den
    assert.equal(memberRewritePath(`/${l}/matches`), null);
  }
  // Başka hiçbir yol yazılmaz
  for (const p of ['/en/leagues/premier-league', '/en/performance', '/en', '/matches/today', '/fr/matches/x', '/en/matches/a/b']) {
    assert.equal(memberRewritePath(p), null, p);
  }
});

test('ANON_ACCESS gerçekten kilitli bir ziyaretçi', () => {
  assert.equal(ANON_ACCESS.state, 'anon');
  assert.equal(ANON_ACCESS.email, null);
  assert.equal(canSeeMatches(ANON_ACCESS), false);
});

test('middleware rewrite\'ı intl yönlendirmesinden ÖNCE yapar', () => {
  const mw = readFileSync(resolve(ROOT, 'src/middleware.ts'), 'utf8');
  assert.ok(mw.indexOf('memberRewritePath') < mw.indexOf('intlMiddleware(req)'), 'rewrite intlMiddleware\'den sonra kalmış');
  assert.match(mw, /NextResponse\.rewrite/);
  // Rewrite işaret başlığı: üye sayfası temiz URL'e noindex basmasın diye.
  assert.match(mw, /MEMBER_REWRITE_HEADER/);
  assert.match(mw, /request: \{ headers \}/);
  // redirect DEĞİL: adres çubuğunda temiz URL kalmalı
  assert.ok(!/rewrite[\s\S]{0,80}NextResponse\.redirect\(url\)/.test(mw));
});
