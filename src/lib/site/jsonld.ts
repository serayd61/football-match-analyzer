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
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: ORG_NAME,
      url: `${SITE_URL}/${locale}`,
      inLanguage: locale,
      publisher: { '@id': `${SITE_URL}/#organization` },
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
