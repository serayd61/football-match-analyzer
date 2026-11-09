import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
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
// 2026-11-10: ana sayfa da aynı ayrıma girdi (CrUX origin TTFB p75 2,0 sn, LCP 3,7 sn).
const ROUTES = [
  {
    name: 'maç',
    isr: resolve(ROOT, 'src/app/(site)/[locale]/matches/[slug]/page.tsx'),
    member: resolve(ROOT, `src/app/(site)/[locale]/${MEMBER_SEGMENT}/matches/[slug]/page.tsx`),
    component: 'MatchPage',
    metadata: 'matchMetadata',
  },
  {
    name: 'ana sayfa',
    isr: resolve(ROOT, 'src/app/(site)/[locale]/page.tsx'),
    member: resolve(ROOT, `src/app/(site)/[locale]/${MEMBER_SEGMENT}/page.tsx`),
    component: 'HomePage',
    metadata: 'homeMetadata',
  },
] as const;
const ISR_ROUTE = ROUTES[0].isr;
const MEMBER_ROUTE = ROUTES[0].member;

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
 * goal-book.ts 2026-11-10'a kadar dbFresh() kullanıyordu; ana sayfa ISR'a
 * alınırken (2b) prerender'da "Dynamic server usage" üretip kitabı boş
 * döndürdüğü görüldü → dbOdds() (5 dk + ODDS_TAG). Listeden çıktı.
 */
const KNOWN_NO_STORE = [
  'src/lib/site/db.ts',              // dbFresh() fabrikası
  'src/lib/engine/versions.ts',      // no-store istemci (ingest / params rotası)
  'src/lib/calibration.ts',
  'src/lib/league-catalog.ts',
  'src/lib/data-sources/free-football.ts',
].sort();

for (const route of ROUTES) test(`ISR ${route.name} rotasının import grafiğinde istek başına okuma yapan hiçbir çağrı yok`, () => {
  const graph = importGraph(route.isr);
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

for (const route of ROUTES) test(`ISR ${route.name} ağacındaki no-store üreten modül listesi büyümedi`, () => {
  const graph = importGraph(route.isr);
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

for (const route of ROUTES) test(`ISR ${route.name} rotası generateStaticParams tanımlar — yoksa revalidate yok sayılır`, () => {
  // 2026-11-08 yerel üretim ölçümü (tam korelasyon):
  //   generateStaticParams VAR  → Cache-Control: s-maxage=300, stale-while-revalidate
  //   generateStaticParams YOK  → Cache-Control: private, no-store   (revalidate yok sayılır)
  // /leagues/{slug} ve /performance/{slug} tanımlıyordu ve önbellekleniyordu;
  // /teams/{slug}, /matches/{slug} ve gün merkezleri tanımlamıyordu, girmiyordu.
  // Boş liste dönmek yeterli: build'de sayfa üretilmez, ilk istek MISS olup
  // ISR önbelleğine yazılır.
  const isr = readFileSync(route.isr, 'utf8');
  assert.match(isr, /export function generateStaticParams/);
});

for (const route of ROUTES) test(`${route.name}: ISR rotası revalidate veriyor, force-dynamic vermiyor; üye rotası tersi`, () => {
  const isr = readFileSync(route.isr, 'utf8');
  assert.match(isr, /export const revalidate = \d+/);
  assert.ok(!/force-dynamic/.test(stripComments(isr)), 'ISR rotasında force-dynamic kalmış');
  assert.match(isr, /ANON_ACCESS/);

  const member = readFileSync(route.member, 'utf8');
  assert.match(member, /export const dynamic = 'force-dynamic'/);
  assert.match(member, /getSiteAccess\(\)/);
  assert.match(member, /isTwa\(\)/);
  // noindex yalnız /m/ adresi elle yazıldığında; rewrite'ta temiz URL
  // indekslenebilir kalır (middleware MEMBER_REWRITE_HEADER ekler).
  assert.match(member, /robots: \{ index: false/);
  assert.match(member, /MEMBER_REWRITE_HEADER/);
  assert.ok(!/^\s*return \{ \.\.\.meta, robots/m.test(member), 'noindex koşulsuz basılıyor');
});

for (const route of ROUTES) test(`${route.name}: iki rota da aynı render bileşenini çağırır (kod tekrarı yok)`, () => {
  const isr = readFileSync(route.isr, 'utf8');
  const member = readFileSync(route.member, 'utf8');
  for (const [name, src] of [['ISR', isr], ['üye', member]] as const) {
    assert.ok(src.includes(`from '@/components/site/pages/${route.component}'`), `${name}: ${route.component} import edilmeli`);
    assert.ok(src.includes(`${route.metadata}(`), `${name}: ${route.metadata} çağrılmalı`);
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
    // Ana sayfa (2026-11-10): /{l} ve /{l}/ → /{l}/m; /{l}/m döngüye girmez
    assert.equal(memberRewritePath(`/${l}`), `/${l}/${MEMBER_SEGMENT}`);
    assert.equal(memberRewritePath(`/${l}/`), `/${l}/${MEMBER_SEGMENT}`);
    assert.equal(memberRewritePath(`/${l}/${MEMBER_SEGMENT}`), null);
    assert.ok(isMemberPath(`/${l}/${MEMBER_SEGMENT}`));
  }
  // Başka hiçbir yol yazılmaz (kök '/' intl yönlendirmesine kalır)
  for (const p of ['/en/leagues/premier-league', '/en/performance', '/', '/matches/today', '/fr/matches/x', '/en/matches/a/b', '/en/methodology']) {
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

// Ana sayfa ayrımının özel sınırı: üyeye özel veri/bileşen HomePage'e değil,
// yalnız üye rotasının çağırdığı HomeMemberHero'ya girer.
test('HomePage anonim-güvenli kalır; HomeMemberHero yalnız üye rotasından import edilir', () => {
  const home = stripComments(readFileSync(resolve(ROOT, 'src/components/site/pages/HomePage.tsx'), 'utf8'));
  for (const bad of ['site/MatchRow', 'site/ai-analysis', 'site/fixtures', 'site/results', 'site/dashboard', 'site/daily-standing', 'site/outside-standing', 'site/access\'', 'site/twa']) {
    assert.ok(!home.includes(bad), `HomePage.tsx üyeye özel modül import ediyor: ${bad}`);
  }
  assert.match(home, /memberHero \?\? \(/, 'üye hero kartı prop üzerinden düşmeli');
  assert.match(home, /export async function homeMetadata\(locale: string\)/);
  const hero = readFileSync(resolve(ROOT, 'src/components/site/pages/HomeMemberHero.tsx'), 'utf8');
  assert.match(hero, /from '@\/components\/site\/MatchRow'/);
  assert.match(hero, /if \(!todayRows\.length\) return null;/, 'maç yoksa null → HomePage örnek karta düşer');
  const importers = execSync("grep -rl 'pages/HomeMemberHero' src --include='*.tsx' --include='*.ts'", { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(importers, ['src/app/(site)/[locale]/m/page.tsx', 'src/components/site/pages/HomeMemberHero.tsx'].filter((f) => importers.includes(f) || f.endsWith('m/page.tsx')), `HomeMemberHero başka yerden import ediliyor: ${importers.join(', ')}`);
});
