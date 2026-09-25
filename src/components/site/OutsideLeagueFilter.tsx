'use client';
import { useMemo, useRef, useState } from 'react';

// Kapsam dışı ülke + lig seçici (2026-09-26). Ülke değişince lig listesi ANINDA o ülkeye
// daralır (sunucuya gitmeden); lig seçilince form kendiliğinden gönderilir. JS yoksa
// iki <select> + Uygula olarak çalışmaya devam eder (GET formu).

export interface OutsideCountry { ccode: string; country: string; n: number }
export interface OutsideLeague { id: number; name: string; ccode: string | null; n: number }
export interface OutsideLabels { filter: string; country: string; league: string; countryAll: string; leagueAll: string; apply: string; clear: string }

export default function OutsideLeagueFilter({ countries, leagues, country, leagueId, hidden, labels, clearHref }: {
  countries: OutsideCountry[]; leagues: OutsideLeague[]; country: string | null; leagueId: number | null;
  hidden: Record<string, string>; labels: OutsideLabels; clearHref: string | null;
}) {
  const [cc, setCc] = useState(country ?? '');
  const [lg, setLg] = useState(leagueId != null ? `u${leagueId}` : '');
  const form = useRef<HTMLFormElement>(null);
  const visible = useMemo(() => countries.filter((c) => !cc || c.ccode === cc), [countries, cc]);

  return (
    <form ref={form} method="get" action="" className="rule-b-1 flex flex-wrap items-center gap-2 py-3 text-[13px]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <span className="text-s-muted">{labels.filter}</span>
      <label className="sr-only" htmlFor="flt-country">{labels.country}</label>
      <select id="flt-country" name="country" value={cc} onChange={(e) => { setCc(e.target.value); setLg(''); }} className="input h-9 w-full sm:w-auto sm:max-w-[260px]">
        <option value="">{labels.countryAll}</option>
        {countries.map((c) => <option key={c.ccode} value={c.ccode}>{c.country} ({c.n})</option>)}
      </select>
      <label className="sr-only" htmlFor="flt-uleague">{labels.league}</label>
      <select id="flt-uleague" name="league" value={lg} onChange={(e) => { setLg(e.target.value); form.current?.requestSubmit(); }} className="input h-9 w-full sm:w-auto sm:max-w-[300px]">
        <option value="">{labels.leagueAll}</option>
        {visible.map((c) => (
          <optgroup key={c.ccode} label={c.country}>
            {leagues.filter((u) => (u.ccode ?? '') === c.ccode).map((u) => <option key={u.id} value={`u${u.id}`}>{u.name} ({u.n})</option>)}
          </optgroup>
        ))}
      </select>
      <button type="submit" className="btn btn-sm btn-primary">{labels.apply}</button>
      {clearHref && <a href={clearHref} className="btn btn-sm btn-secondary">{labels.clear}</a>}
    </form>
  );
}
