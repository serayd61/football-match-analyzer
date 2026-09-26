'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Search, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

// Predictions toolbar v3 (2026-09-26). ONE control surface for the day list:
//   row 1 · day strip (‹ yesterday · today · tomorrow ›) + native date input + match count
//   row 2 · league chips (only leagues with matches that day) + "other leagues" toggle
//   row 3 · collapsible filters: search · status · sort · market ≥ p · ready · country/league
// State lives in the URL exactly as before (same query keys), so links, back/forward and
// the match page's "back" keep working. Every change navigates immediately — no Apply.

export interface ToolbarLeague { slug: string; name: string; n: number }
export interface ToolbarCountry { ccode: string; country: string; n: number }
export interface ToolbarULeague { id: number; name: string; ccode: string | null; n: number }
export interface ToolbarState {
  date: string; today: string; league: string | null; country: string | null; uLeagueId: number | null; scope: 'covered' | 'all';
  q: string; status: string; sort: string; ready: boolean; market: string | null; minP: number | null; note: boolean;
}
export interface ToolbarLabels {
  yesterday: string; today: string; tomorrow: string; prevDay: string; nextDay: string; pickDate: string;
  all: string; otherLeagues: string; filters: string; clear: string; search: string; searchPh: string;
  status: string; statusAll: string; statusUpcoming: string; statusLive: string; statusFinished: string;
  sort: string; sortTime: string; sortConfidence: string; ready: string;
  market: string; marketAll: string; markets: Record<string, string>; minP: Record<string, string>;
  country: string; countryAll: string; league: string; leagueAll: string; matches: string;
}

export default function PredictionsToolbar({ state, leagues, uncoveredCount, countries, uLeagues, minPSteps, labels, dayLabel }: {
  state: ToolbarState; leagues: ToolbarLeague[]; uncoveredCount: number; countries: ToolbarCountry[]; uLeagues: ToolbarULeague[];
  minPSteps: readonly number[]; labels: ToolbarLabels; /** yesterday/today/tomorrow rendered by the server (locale) */ dayLabel: { prev: string; cur: string; next: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!!(state.q || state.status !== 'all' || state.sort !== 'time' || state.ready || state.market || state.country || state.uLeagueId != null));
  const [q, setQ] = useState(state.q);
  const [cc, setCc] = useState(state.country ?? '');
  const first = useRef(true);

  const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  const build = (over: Partial<Record<string, string | null | undefined>>) => {
    const m: Record<string, string | null | undefined> = {
      date: state.date !== state.today ? state.date : undefined,
      league: state.league ?? (state.uLeagueId != null ? `u${state.uLeagueId}` : undefined),
      country: state.country ?? undefined,
      scope: state.scope === 'all' && !state.market && state.uLeagueId == null && !state.country ? 'all' : undefined,
      note: state.note ? undefined : '0',
      q: state.q || undefined,
      status: state.status !== 'all' ? state.status : undefined,
      ready: state.ready ? '1' : undefined,
      sort: state.sort !== 'time' ? state.sort : undefined,
      market: state.market ?? undefined,
      minp: state.market && state.minP ? String(state.minP) : undefined,
      ...over,
    };
    if (m.date === state.today) m.date = undefined;
    if (!m.market) m.minp = undefined;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(m)) if (v) qs.set(k, v);
    const s = qs.toString();
    return `/predictions${s ? `?${s}` : ''}`;
  };
  const go = (over: Partial<Record<string, string | null | undefined>>) => start(() => router.push(build(over), { scroll: false }));

  // Debounced search → URL.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { if (q.trim() !== state.q) go({ q: q.trim() || undefined }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const outsideMode = state.uLeagueId != null || !!state.country;
  const activeCount = [state.q, state.status !== 'all', state.sort !== 'time', state.ready, state.market, state.country, state.uLeagueId != null].filter(Boolean).length;
  const visibleU = useMemo(() => uLeagues.filter((u) => !cc || (u.ccode ?? '') === cc), [uLeagues, cc]);
  const ctl = 'input !h-10 !text-[14px] w-full sm:w-auto';

  return (
    <div className={`rounded-2xl border border-s-line bg-s-surface shadow-[var(--s-shadow)] ${pending ? 'opacity-70' : ''} transition-opacity`} aria-busy={pending}>
      {/* Row 1 — day */}
      <div className="flex flex-wrap items-center gap-2 p-3 sm:px-4">
        <button type="button" onClick={() => go({ date: addDays(state.date, -1) })} className="btn btn-secondary !h-10 !w-10 !px-0" aria-label={labels.prevDay}><ChevronLeft size={18} /></button>
        <div className="seg" role="tablist" aria-label={labels.pickDate}>
          {[{ d: addDays(state.today, -1), l: labels.yesterday }, { d: state.today, l: labels.today }, { d: addDays(state.today, 1), l: labels.tomorrow }].map((x) => (
            <button key={x.d} type="button" role="tab" aria-current={state.date === x.d ? 'true' : undefined} onClick={() => go({ date: x.d })} className="seg-btn">{x.l}</button>
          ))}
        </div>
        <button type="button" onClick={() => go({ date: addDays(state.date, 1) })} className="btn btn-secondary !h-10 !w-10 !px-0" aria-label={labels.nextDay}><ChevronRight size={18} /></button>
        <label className="ml-1 inline-flex items-center gap-2 text-[13.5px] text-s-muted">
          <span className="sr-only">{labels.pickDate}</span>
          <input type="date" value={state.date} onChange={(e) => e.target.value && go({ date: e.target.value })} className="input !h-10 !w-[150px] !text-[14px]" />
        </label>
        <span className="ml-auto text-[13.5px] font-semibold text-s-muted">{dayLabel.cur} · {labels.matches}</span>
      </div>

      {/* Row 2 — leagues */}
      <div className="rule-t-1 flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" aria-current={!state.league && !outsideMode ? 'true' : undefined} onClick={() => go({ league: undefined, country: undefined })} className="chip chip-sm">{labels.all}</button>
          {leagues.map((l) => (
            <button key={l.slug} type="button" aria-current={state.league === l.slug ? 'true' : undefined} onClick={() => go({ league: l.slug, country: undefined })} className="chip chip-sm">
              {l.name} <span className="chip-n num">{l.n}</span>
            </button>
          ))}
          {uncoveredCount > 0 && (
            <button type="button" aria-current={state.scope === 'all' || outsideMode ? 'true' : undefined} onClick={() => go({ scope: state.scope === 'all' || outsideMode ? undefined : 'all', league: undefined, country: undefined })} className="chip chip-sm !border-dashed">
              {labels.otherLeagues} <span className="chip-n num">{uncoveredCount}</span>
            </button>
          )}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`chip chip-sm shrink-0 ${open || activeCount ? 'chip-on' : ''}`}>
          <SlidersHorizontal size={14} /> {labels.filters}{activeCount ? <span className="num ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-s-accent px-1 text-[11px] text-white">{activeCount}</span> : null}
        </button>
      </div>

      {/* Row 3 — filters (collapsible) */}
      {open && (
        <div className="rule-t-1 grid gap-2 px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-[minmax(200px,1.4fr)_repeat(3,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">{labels.search}</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-s-muted" aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.searchPh} maxLength={60} className="input !h-10 !pl-9 !text-[14px]" />
          </label>
          <label className="block"><span className="sr-only">{labels.status}</span>
            <select value={state.status} onChange={(e) => go({ status: e.target.value === 'all' ? undefined : e.target.value })} className={ctl + ' !w-full'}>
              <option value="all">{labels.statusAll}</option><option value="upcoming">{labels.statusUpcoming}</option><option value="live">{labels.statusLive}</option><option value="finished">{labels.statusFinished}</option>
            </select>
          </label>
          <label className="block"><span className="sr-only">{labels.sort}</span>
            <select value={state.sort} onChange={(e) => go({ sort: e.target.value === 'time' ? undefined : e.target.value })} className={ctl + ' !w-full'}>
              <option value="time">{labels.sortTime}</option><option value="confidence">{labels.sortConfidence}</option>
            </select>
          </label>
          <div className="flex gap-2">
            <label className="block min-w-0 flex-1"><span className="sr-only">{labels.market}</span>
              <select value={state.market ?? ''} onChange={(e) => go({ market: e.target.value || undefined, minp: e.target.value ? String(state.minP ?? 60) : undefined })} className={ctl + ' !w-full'}>
                <option value="">{labels.marketAll}</option>
                {Object.entries(labels.markets).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block w-[92px] shrink-0"><span className="sr-only">{labels.market}</span>
              <select value={String(state.minP ?? 60)} disabled={!state.market} onChange={(e) => go({ minp: e.target.value })} className={ctl + ' !w-full disabled:opacity-50'}>
                {minPSteps.map((p) => <option key={p} value={String(p)}>{labels.minP[String(p)]}</option>)}
              </select>
            </label>
          </div>
          {countries.length > 0 && (
            <>
              <label className="block"><span className="sr-only">{labels.country}</span>
                <select value={cc} onChange={(e) => { setCc(e.target.value); go({ country: e.target.value || undefined, league: undefined }); }} className={ctl + ' !w-full'}>
                  <option value="">{labels.countryAll}</option>
                  {countries.map((c) => <option key={c.ccode} value={c.ccode}>{c.country} ({c.n})</option>)}
                </select>
              </label>
              <label className="block"><span className="sr-only">{labels.league}</span>
                <select value={state.uLeagueId != null ? `u${state.uLeagueId}` : ''} onChange={(e) => go({ league: e.target.value || undefined })} className={ctl + ' !w-full'}>
                  <option value="">{labels.leagueAll}</option>
                  {countries.filter((c) => !cc || c.ccode === cc).map((c) => (
                    <optgroup key={c.ccode} label={c.country}>
                      {visibleU.filter((u) => (u.ccode ?? '') === c.ccode).map((u) => <option key={u.id} value={`u${u.id}`}>{u.name} ({u.n})</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="inline-flex h-10 items-center gap-2 text-[14px]">
            <input type="checkbox" checked={state.ready} onChange={(e) => go({ ready: e.target.checked ? '1' : undefined })} className="h-4 w-4 accent-[rgb(var(--s-brand))]" /> {labels.ready}
          </label>
          {activeCount > 0 && (
            <button type="button" onClick={() => { setQ(''); setCc(''); go({ q: undefined, status: undefined, sort: undefined, ready: undefined, market: undefined, minp: undefined, country: undefined, league: state.league ?? undefined }); }} className="btn btn-secondary btn-sm justify-self-start sm:justify-self-end"><X size={14} /> {labels.clear}</button>
          )}
        </div>
      )}
    </div>
  );
}
