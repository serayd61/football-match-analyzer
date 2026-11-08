import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import IntlMessageFormat from 'intl-messageformat';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// ============================================================================
// SEO denetimi 2026-11-08 — snippet uzunluğu regresyon kilidi.
//
// Search Console: TO %2,4 / ort. konum 44,3. Ölçümde maç açıklamaları 164-255,
// takım 162-185, maç başlıkları 75-86 karakterdi; Google ~160 karakterde
// açıklamayı, ~60 karakterde başlığı kesiyor, yani veri taşıyan kısım (sıra +
// puan, maç sonucu, "classifica"/"puan durumu") SERP'te hiç görünmüyordu.
//
// Önceki ölçümüm iki şeyi kaçırdığı için olduğundan kısa çıkmıştı; test ikisini
// de modelliyor:
//   1) YAKLAŞAN maçta açıklamanın başına `descLean` ("Model pick: …") ekleniyor
//      (MatchPage.tsx: `${t('descLean')} ${t(descKey)}`).
//   2) Takım adları uzun olabiliyor (Tottenham Hotspur 17, Manchester City 15).
// Sabit sınır yerine şablonlar GERÇEKTEN render edilip ölçülüyor.
// ============================================================================

const LOCALES = { en, de, it, tr } as Record<string, any>;
const DESC_MAX = 165;
const TITLE_MAX = 62;

const get = (o: any, path: string) => path.split('.').reduce((a, k) => a?.[k], o);
const render = (locale: string, path: string, vars: Record<string, unknown> = {}) =>
  new IntlMessageFormat(get(LOCALES[locale], path) as string, locale).format(vars) as string;

/** Tarih biçimleri getFormatter'ın { day:'numeric', month:'short', year:'numeric' } çıktısı. */
const DATE: Record<string, string> = { en: '15 Nov 2026', de: '15. Nov. 2026', it: '15 nov 2026', tr: '15 Kas 2026' };
/** En kötü hal önemli: kısa adlarla her şey sığar, uzun adlarla sığmıyordu. */
const NAMES = [
  { home: 'Arsenal', away: 'Chelsea', league: 'Premier League', team: 'Arsenal' },
  { home: 'Manchester City', away: 'Tottenham Hotspur', league: 'Conference League', team: 'Tottenham Hotspur' },
];
const brand = (locale: string) => ` · ${get(LOCALES[locale], 'meta.siteName')}`.length;

test('maç başlığı ve açıklaması Google snippet sınırına sığıyor', () => {
  for (const locale of Object.keys(LOCALES)) {
    for (const n of NAMES) {
      const vars = { ...n, date: DATE[locale], hs: 2, as: 1, hpos: 2, hpts: 25, apos: 11, apts: 17 };
      // Yaklaşan maçta gerçek açıklama = descLean + boşluk + gövde (MatchPage.tsx).
      const lean = render(locale, 'matches.match.descLean', {
        pick: render(locale, 'matches.match.pickHome', { team: n.home }),
      });
      for (const key of ['metaDescription', 'metaDescriptionRanked'] as const) {
        const full = `${lean} ${render(locale, `matches.match.${key}`, vars)}`;
        assert.ok(full.length <= DESC_MAX, `${locale} matches.match.${key} + descLean = ${full.length} > ${DESC_MAX}: ${full}`);
      }
      for (const key of ['metaDescriptionSettled', 'metaDescriptionSettledRanked'] as const) {
        const full = render(locale, `matches.match.${key}`, vars);
        assert.ok(full.length <= DESC_MAX, `${locale} matches.match.${key} = ${full.length} > ${DESC_MAX}: ${full}`);
      }
      // Maç başlığı absolute (marka eki yok) — MatchPage.tsx: title.absolute.
      for (const key of ['metaTitle', 'metaTitleSettled'] as const) {
        const title = render(locale, `matches.match.${key}`, vars);
        assert.ok(title.length <= TITLE_MAX, `${locale} matches.match.${key} = ${title.length} > ${TITLE_MAX}: ${title}`);
      }
    }
  }
});

test('takım ve lig sayfası başlık/açıklaması sınıra sığıyor', () => {
  for (const locale of Object.keys(LOCALES)) {
    for (const n of NAMES) {
      const title = render(locale, 'team.metaTitle', { team: n.team });
      const desc = render(locale, 'team.metaDescription', { team: n.team, league: 'Premier League' });
      assert.ok(title.length <= TITLE_MAX, `${locale} team.metaTitle = ${title.length}: ${title}`);
      assert.ok(desc.length <= DESC_MAX, `${locale} team.metaDescription = ${desc.length}: ${desc}`);

      const lt = render(locale, 'league.metaTitle', { league: n.league });
      const ld = render(locale, 'league.metaDescription', { league: n.league, country: 'England' });
      assert.ok(lt.length <= TITLE_MAX, `${locale} league.metaTitle = ${lt.length}: ${lt}`);
      assert.ok(ld.length <= DESC_MAX, `${locale} league.metaDescription = ${ld.length}: ${ld}`);
    }
  }
});

// Marka eki şablonla gelen sayfalar (layout.tsx: template `%s · siteName`).
test('marka eki alan başlıklar ek dahil sınıra sığıyor ve markayı iki kez yazmıyor', () => {
  for (const locale of Object.keys(LOCALES)) {
    const siteName = get(LOCALES[locale], 'meta.siteName') as string;
    for (const key of ['docs.about.metaTitle', 'docs.methodology.metaTitle', 'docs.glossary.metaTitle']) {
      const t = render(locale, key);
      assert.ok(t.length + brand(locale) <= TITLE_MAX, `${locale} ${key} + marka = ${t.length + brand(locale)}: ${t}`);
      assert.ok(!t.includes(siteName), `${locale} ${key} markayı içeriyor, şablon bir kez daha ekliyor: "${t} · ${siteName}"`);
    }
    // Ana sayfa markayı kendisi ekler (page.tsx: title.absolute).
    const home = render(locale, 'home.metaTitle', { count: 17 });
    assert.ok(home.length + brand(locale) <= TITLE_MAX, `${locale} home.metaTitle + marka = ${home.length + brand(locale)}`);
  }
});

// Sabit sınırların doğru sayfaya uygulandığını kodda doğrula: maç/takım/lig
// başlıkları marka eki ALMAMALI, yoksa yukarıdaki TITLE_MAX hesabı yanlış olur.
test('maç, takım ve lig sayfaları absolute başlık kullanıyor', () => {
  const files = {
    'src/components/site/pages/MatchPage.tsx': /title:\s*\{\s*absolute:/,
    'src/app/(site)/[locale]/teams/[slug]/page.tsx': /title:\s*\{\s*absolute:/,
    'src/app/(site)/[locale]/leagues/[slug]/page.tsx': /title:\s*\{\s*absolute:/,
  };
  for (const [rel, rx] of Object.entries(files)) {
    const src = readFileSync(resolve(__dirname, '..', rel), 'utf8');
    assert.match(src, rx, `${rel}: generateMetadata absolute başlık kullanmıyor`);
  }
});

// ---------------------------------------------------------------------------
// Lig merkezi: tek JSON-LD bloğu BreadcrumbList olan tek sayfa tipiydi ve
// puan durumundaki 20 takım adının hiçbiri bağlantılı değildi (xG tablosu
// hepsini bağlıyor). İkisi de geri gitmesin.
// ---------------------------------------------------------------------------
test('lig sayfası breadcrumb + WebPage + FAQPage basıyor ve takımları bağlıyor', () => {
  const page = readFileSync(resolve(__dirname, '../src/app/(site)/[locale]/leagues/[slug]/page.tsx'), 'utf8');
  for (const fn of ['breadcrumbJsonLd', 'webPageJsonLd', 'faqPageJsonLd']) {
    assert.ok(page.includes(`${fn}(`), `lig sayfası ${fn} kullanmıyor`);
  }
  assert.match(page, /<StandingsTable rows=\{table\} slugOf=\{slugOf\} \/>/, 'lig sayfası puan durumuna slugOf geçirmiyor');

  const tbl = readFileSync(resolve(__dirname, '../src/components/site/StandingsTable.tsx'), 'utf8');
  assert.ok(tbl.includes('teamPath('), 'StandingsTable takım sayfasına bağlamıyor');
});

// ---------------------------------------------------------------------------
// SC: "football analytics" 4.458 gösterim / konum 60, "ai football analysis"
// konum 68 ve tıkları getiren ifade bu. İkisi de H1/lead'de geçmiyordu.
// ---------------------------------------------------------------------------
test('ana sayfa ve /about hedef ifadeleri taşıyor', () => {
  const h1 = (get(en, 'v3.landing.title') as string).toLowerCase();
  assert.ok(h1.includes('ai football analysis'), `ana sayfa H1'inde "ai football analysis" yok: ${h1}`);
  const lead = (get(en, 'v3.landing.lead') as string).toLowerCase();
  assert.ok(lead.includes('football analytics'), 'ana sayfa lead\'inde "football analytics" yok');

  for (const locale of Object.keys(LOCALES)) {
    const about = get(LOCALES[locale], 'docs.about');
    // H1 çıplak etiket olmasın ("About" / "Hakkında"): hedef ifadeyi taşısın.
    assert.ok(/football analytics/i.test(about.title), `${locale} /about H1 marka/anahtar kelime taşımıyor: ${about.title}`);
    assert.notEqual(about.title, about.metaTitle, `${locale} /about H1 ve <title> aynı`);
    // Açıklama bir cümlelik etiket değil, gerçek bir snippet olsun.
    assert.ok(about.lead.length >= 120, `${locale} /about açıklaması ${about.lead.length} karakter, snippet için kısa`);
    assert.ok(about.lead.length <= DESC_MAX, `${locale} /about açıklaması ${about.lead.length} > ${DESC_MAX}`);
  }
});
