import { SITE_URL } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

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
