import { SITE_URL } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import type { SiteLeague } from '@/lib/site/leagues';
import type { SitePrediction } from '@/lib/site/predictions';
import { venueFor } from '@/lib/site/stadiums';

// Structured data (schema.org JSON-LD) for the public site — SEO denetimi 2026-10-10.
// Google reads it from any <script type="application/ld+json">; `JsonLd` renders it.
// Only facts that are visible on the page go in here (Google's "match the content" rule).

export const ORG_NAME = 'Football Analytics';
export const ORG_LOGO = `${SITE_URL}/icons/icon-512x512.png`;
/** Public profiles of the organisation (schema.org sameAs) — SEO Faz 0. */
export const ORG_SAME_AS = [
  'https://t.me/fanalytics_pro',
  'https://x.com/fanalytics_pro',
  'https://play.google.com/store/apps/details?id=pro.footballanalytics',
];

/**
 * Typed reference to the organisation for creator/publisher fields. A bare
 * `{ "@id" }` only resolves when the Organization node is on the same page
 * (it is on the home page only); Search Console flagged the /data Dataset's
 * publisher as "invalid object type" on 2026-10-19.
 */
export const ORG_REF = { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: ORG_NAME, url: SITE_URL } as const;

/** Organization + WebSite — home page only (Google: "place it on your home page"). */
export function organizationJsonLd(locale: Locale, description: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: ORG_NAME,
      alternateName: 'footballanalytics.pro',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: ORG_LOGO, width: 512, height: 512 },
      description,
      sameAs: ORG_SAME_AS,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: ORG_NAME,
      url: `${SITE_URL}/${locale}`,
      inLanguage: locale,
      publisher: ORG_REF,
    },
  ];
}

const EVENT_STATUS: Partial<Record<SitePrediction['status'], string>> = {
  scheduled: 'https://schema.org/EventScheduled',
  live: 'https://schema.org/EventScheduled',
  postponed: 'https://schema.org/EventPostponed',
  cancelled: 'https://schema.org/EventCancelled',
};

/**
 * SportsEvent per upcoming fixture on a league page. Google's Event rich result
 * requires name, startDate and a location with a postal address, so fixtures
 * whose home venue is unknown (see lib/site/stadiums.ts) are left out rather
 * than emitted with an error. Finished matches are not events any more.
 * The venue is also printed in the fixture list, so the markup matches the page.
 */
export type EventRow = Pick<SitePrediction, 'fixtureId' | 'homeId' | 'homeName' | 'awayName' | 'kickoff' | 'status'>;

export function sportsEventsJsonLd<R extends EventRow>(locale: Locale, league: SiteLeague, rows: R[], describe: (r: R) => string, pageUrl?: string) {
  // Default: the league page; a public match page passes its own URL (2026-10-10).
  const page = pageUrl ?? `${SITE_URL}/${locale}/leagues/${league.slug}`;
  const out = [];
  for (const r of rows) {
    const status = EVENT_STATUS[r.status];
    const venue = venueFor(r.homeId);
    if (!status || !venue) continue;
    const start = new Date(r.kickoff);
    if (Number.isNaN(start.getTime())) continue;
    const address: Record<string, string> = { '@type': 'PostalAddress', addressCountry: venue.country };
    if (venue.address) address.streetAddress = venue.address;
    if (venue.city) address.addressLocality = venue.city;
    const team = (name: string) => ({ '@type': 'SportsTeam', name });
    out.push({
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      '@id': `${page}#fixture-${r.fixtureId}`,
      name: `${r.homeName} vs ${r.awayName}`,
      description: describe(r),
      startDate: start.toISOString(),
      endDate: new Date(start.getTime() + 115 * 60_000).toISOString(),
      eventStatus: status,
      sport: 'Soccer',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: venue.venue, address },
      homeTeam: team(r.homeName),
      awayTeam: team(r.awayName),
      competitor: [team(r.homeName), team(r.awayName)],
      performer: [team(r.homeName), team(r.awayName)],
      organizer: { '@type': 'Organization', name: league.name },
      // no `image`: Next serves the league OG card under a hashed URL that is not known here (recommended field, not required)
      url: page,
    });
  }
  return out;
}

/** BreadcrumbList — `items` are (label, locale-free path) pairs; the last one is the current page. */
export function breadcrumbJsonLd(locale: Locale, items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}/${locale}${it.path === '/' ? '' : it.path}`,
    })),
  };
}

/** FAQPage — the landing page's question/answer list (SEO Faz 0, 2026-10-17). */
export function faqPageJsonLd(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** Dataset — the public, settled prediction record on /performance (SEO Faz 0). */
export function datasetJsonLd(locale: Locale, input: { name: string; description: string; settled: number; dateModified: Date | null }) {
  const url = `${SITE_URL}/${locale}/performance`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${url}#dataset`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: locale,
    isAccessibleForFree: true,
    creator: ORG_REF,
    keywords: ['football predictions', 'expected goals', 'Dixon-Coles', 'prediction accuracy', 'Brier score'],
    variableMeasured: ['hit rate', 'Brier score', 'calibration'],
    ...(input.dateModified ? { dateModified: input.dateModified.toISOString() } : {}),
    ...(input.settled > 0 ? { size: `${input.settled} settled predictions` } : {}),
  };
}

/** WebPage with a real dateModified (the engine row's updated_at) — SEO Faz 1a. */
export function webPageJsonLd(locale: Locale, input: { url: string; name: string; dateModified: string | null }) {
  const d = input.dateModified ? new Date(input.dateModified) : null;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${input.url}#webpage`,
    url: input.url,
    name: input.name,
    inLanguage: locale,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(d && !Number.isNaN(d.getTime()) ? { dateModified: d.toISOString() } : {}),
  };
}

/** SportsTeam — a club page (SEO Faz 1b). `url` is the localized team page. */
export function sportsTeamJsonLd(locale: Locale, input: { url: string; name: string; crest: string; league: SiteLeague; venue?: { name: string; city?: string | null } | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': `${input.url}#team`,
    name: input.name,
    sport: 'Soccer',
    url: input.url,
    logo: input.crest,
    inLanguage: locale,
    memberOf: { '@type': 'SportsOrganization', name: input.league.name },
    ...(input.venue ? { location: { '@type': 'Place', name: input.venue.name, ...(input.venue.city ? { address: { '@type': 'PostalAddress', addressLocality: input.venue.city } } : {}) } } : {}),
  };
}

/** DefinedTermSet — the glossary (SEO Faz 1b): one DefinedTerm per entry, each with its anchor URL. */
export function definedTermSetJsonLd(locale: Locale, input: { url: string; name: string; terms: Array<{ id: string; term: string; description: string }> }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${input.url}#terms`,
    name: input.name,
    url: input.url,
    inLanguage: locale,
    hasDefinedTerm: input.terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${input.url}#${t.id}`,
      name: t.term,
      description: t.description,
      url: `${input.url}#${t.id}`,
      inDefinedTermSet: `${input.url}#terms`,
    })),
  };
}

/**
 * Dataset with downloadable distributions — the open-data page (SEO Faz 2.1).
 * Google Dataset Search needs `distribution` with a contentUrl per file and a
 * machine-readable `license`; `isBasedOn` ties it to the track record.
 */
export function openDatasetJsonLd(locale: Locale, input: {
  name: string; description: string; rows: number; dateModified: Date | null;
  files: Array<{ name: string; csv: string; json: string }>; license: string; since: string;
}) {
  const url = `${SITE_URL}/${locale}/data`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${url}#dataset`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: 'en',
    isAccessibleForFree: true,
    license: input.license,
    creator: ORG_REF,
    publisher: ORG_REF,
    keywords: ['football predictions dataset', 'match outcome probabilities', 'expected goals', 'Dixon-Coles', 'open data', 'CSV'],
    variableMeasured: ['p_home', 'p_draw', 'p_away', 'lambda_home', 'lambda_away', 'home_score', 'away_score'],
    temporalCoverage: `${input.since}/..`,
    isBasedOn: `${SITE_URL}/${locale}/performance`,
    ...(input.dateModified ? { dateModified: input.dateModified.toISOString() } : {}),
    ...(input.rows > 0 ? { size: `${input.rows} settled matches` } : {}),
    distribution: input.files.flatMap((f) => [
      { '@type': 'DataDownload', name: `${f.name} (CSV)`, encodingFormat: 'text/csv', contentUrl: `${SITE_URL}${f.csv}` },
      { '@type': 'DataDownload', name: `${f.name} (JSON)`, encodingFormat: 'application/json', contentUrl: `${SITE_URL}${f.json}` },
    ]),
  };
}
