'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';

// League / country picker (v3, 2026-09-27). One search box over the day's fixtures:
// type to narrow, pick a covered league (league=<slug>), a country (country=<ccode>,
// all its leagues) or a single uncovered league (league=u<id>). Keyboard: ↑ ↓ ⏎ Esc.

export interface PickerLeague { slug: string; name: string; country: string | null; n: number }
export interface PickerCountry { ccode: string; country: string; n: number }
export interface PickerULeague { id: number; name: string; ccode: string | null; n: number }
export interface PickerLabels { placeholder: string; modelLeagues: string; countries: string; otherLeagues: string; noResults: string; clear: string }

type Item =
  | { kind: 'league'; key: string; label: string; sub: string | null; n: number; over: Record<string, string | undefined> }
  | { kind: 'country'; key: string; label: string; sub: string | null; n: number; over: Record<string, string | undefined> }
  | { kind: 'uleague'; key: string; label: string; sub: string | null; n: number; over: Record<string, string | undefined> };

const fold = (v: string) => v.replace(/[İIı]/g, 'i').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

export default function LeaguePicker({ leagues, countries, uLeagues, selected, labels, onPick, onClear }: {
  leagues: PickerLeague[]; countries: PickerCountry[]; uLeagues: PickerULeague[];
  /** current selection label (covered league, country or uncovered league) or null */
  selected: string | null;
  labels: PickerLabels;
  onPick: (over: Record<string, string | undefined>) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const countryName = useMemo(() => new Map(countries.map((c) => [c.ccode, c.country])), [countries]);

  const items = useMemo<Item[]>(() => {
    const f = fold(q.trim());
    const hit = (s: string | null | undefined) => !f || (s ? fold(s).includes(f) : false);
    const out: Item[] = [];
    for (const l of leagues) if (hit(l.name) || hit(l.country)) out.push({ kind: 'league', key: `l:${l.slug}`, label: l.name, sub: l.country, n: l.n, over: { league: l.slug, country: undefined, scope: undefined } });
    for (const c of countries) if (hit(c.country) || hit(c.ccode)) out.push({ kind: 'country', key: `c:${c.ccode}`, label: c.country, sub: c.ccode || null, n: c.n, over: { country: c.ccode || undefined, league: undefined, scope: undefined } });
    for (const u of uLeagues) if (hit(u.name) || hit(u.ccode) || hit(countryName.get(u.ccode ?? '') ?? null)) out.push({ kind: 'uleague', key: `u:${u.id}`, label: u.name, sub: countryName.get(u.ccode ?? '') ?? u.ccode ?? null, n: u.n, over: { league: `u${u.id}`, country: undefined, scope: undefined } });
    return out.slice(0, 40);
  }, [q, leagues, countries, uLeagues, countryName]);

  useEffect(() => { setIdx(0); }, [q, open]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (it: Item) => { setOpen(false); setQ(''); onPick(it.over); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { if (open && items[idx]) { e.preventDefault(); pick(items[idx]); } }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
  };

  let lastKind: Item['kind'] | null = null;
  const heading: Record<Item['kind'], string> = { league: labels.modelLeagues, country: labels.countries, uleague: labels.otherLeagues };

  return (
    <div ref={root} className="relative min-w-0 flex-1 sm:max-w-[360px]">
      {selected && !open ? (
        <div className="flex h-[34px] items-center gap-1 rounded-full border border-s-ink bg-s-ink pl-3 pr-1.5 text-[13.5px] font-semibold text-s-bg">
          <span className="truncate">{selected}</span>
          <button type="button" onClick={onClear} aria-label={labels.clear} className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-s-bg/20"><X size={13} /></button>
          <button type="button" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }} aria-label={labels.placeholder} className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-s-bg/20"><Search size={13} /></button>
        </div>
      ) : (
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-s-muted" aria-hidden />
          <input
            ref={input} type="search" role="combobox" aria-expanded={open} aria-controls="league-picker-list" aria-autocomplete="list"
            value={q} placeholder={labels.placeholder} maxLength={60}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
            className="input !h-[34px] !rounded-full !pl-9 !text-[13.5px]"
          />
        </label>
      )}
      {open && (
        <ul id="league-picker-list" role="listbox" className="absolute left-0 z-30 mt-1.5 max-h-[360px] w-[min(92vw,380px)] overflow-y-auto rounded-xl border border-s-line bg-s-surface p-1 shadow-[var(--s-shadow)]">
          {items.length === 0 && <li className="px-3 py-2 text-[13px] text-s-muted">{labels.noResults}</li>}
          {items.map((it, i) => {
            const head = it.kind !== lastKind; lastKind = it.kind;
            return (
              <li key={it.key} role="presentation">
                {head && <div className="kicker px-3 pb-1 pt-2 !text-[10.5px]">{heading[it.kind]}</div>}
                <button
                  type="button" role="option" aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(it)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] ${i === idx ? 'bg-s-raised' : ''}`}
                >
                  {it.kind === 'uleague' && it.sub && <span className="shrink-0 text-s-muted"><ChevronRight size={12} /></span>}
                  <span className="min-w-0 flex-1 truncate font-medium">{it.label}{it.sub && <span className="ml-1.5 font-normal text-s-muted">{it.sub}</span>}</span>
                  <span className="num shrink-0 text-[12px] text-s-muted">{it.n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
