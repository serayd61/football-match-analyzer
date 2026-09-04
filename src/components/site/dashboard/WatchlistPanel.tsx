'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Add/remove followed clubs. The list itself (next match, form, table
// position) is rendered by the server page; this only mutates and refreshes.
export interface TeamOption { id: number; name: string; league: string; leagueSlug: string }

export default function WatchlistPanel({
  teams, following, available, max = 30,
}: { teams: TeamOption[]; following: number[]; available: boolean; max?: number }) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const followed = useMemo(() => new Set(following), [following]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return teams.filter((x) => !followed.has(x.id) && x.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, teams, followed]);

  async function add(team: TeamOption) {
    setError(null);
    const res = await fetch('/api/site/watchlist', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: team.id, teamName: team.name, leagueSlug: team.leagueSlug }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body?.code === 'limit' ? t('watchLimit', { max }) : t('watchError')); return; }
    setQuery('');
    start(() => router.refresh());
  }

  if (!available) return <p className="text-sm text-s-muted">{t('watchUnavailable')}</p>;

  return (
    <div className="relative">
      <label htmlFor="watch-q" className="sr-only">{t('watchSearch')}</label>
      <input
        id="watch-q"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('watchSearch')}
        autoComplete="off"
        disabled={pending || followed.size >= max}
        className="h-9 w-full rounded-sm border border-s-line bg-s-surface px-3 text-sm text-s-ink placeholder:text-s-muted focus:outline-none focus:ring-2 focus:ring-s-accent disabled:opacity-60"
      />
      {matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full divide-y divide-s-line rounded-sm border border-s-line bg-s-surface shadow-sm" role="listbox">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => add(m)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-s-raised"
              >
                <span>{m.name}</span>
                <span className="text-xs text-s-muted">{m.league}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-s-loss" role="alert">{error}</p>}
      {followed.size >= max && <p className="mt-2 text-xs text-s-muted">{t('watchLimit', { max })}</p>}
    </div>
  );
}

export function UnfollowButton({ teamId, label }: { teamId: number; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  async function remove() {
    await fetch('/api/site/watchlist', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId }) });
    start(() => router.refresh());
  }
  return (
    <button type="button" onClick={remove} disabled={pending} className="text-xs text-s-muted underline-offset-2 hover:text-s-ink hover:underline disabled:opacity-60">
      {label}
    </button>
  );
}
