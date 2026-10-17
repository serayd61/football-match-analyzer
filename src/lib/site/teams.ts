import { slugify } from '@/lib/seo';
import type { SiteLeague } from './leagues';

// ============================================================================
// Team pages (SEO Faz 1b, 2026-10-17): /teams/{slug}. "{Verein} Prognose",
// "{takım} maçı", "{squadra} prossima partita" are the club-name queries the
// league and match pages cannot own. There is no team table: the index is
// built from the engine rows of the covered leagues (team-data.ts). Pure
// helpers here so the slug rules are unit-tested.
//
// Slug = slugify(name). When two clubs share a slug (rare: same name in two
// covered leagues) the one with more matches keeps the plain slug and the
// other gets "{slug}-{id}", so URLs stay stable as a season fills in.
// ============================================================================

export interface TeamSeed { id: number; name: string; league: SiteLeague; n: number }
export interface TeamEntry extends TeamSeed { slug: string; crest: string }

export const teamCrest = (id: number) => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;

export function buildTeamIndex(seeds: TeamSeed[]): TeamEntry[] {
  const bySlug = new Map<string, TeamSeed[]>();
  for (const s of seeds) {
    const base = slugify(s.name);
    if (!base || !s.id) continue;
    if (!bySlug.has(base)) bySlug.set(base, []);
    bySlug.get(base)!.push(s);
  }
  const out: TeamEntry[] = [];
  for (const [base, list] of bySlug) {
    list.sort((a, b) => b.n - a.n || a.id - b.id);
    list.forEach((s, i) => out.push({ ...s, slug: i === 0 ? base : `${base}-${s.id}`, crest: teamCrest(s.id) }));
  }
  return out.sort((a, b) => a.league.slug.localeCompare(b.league.slug) || a.name.localeCompare(b.name));
}

export const teamPath = (t: { slug: string }) => `/teams/${t.slug}`;
