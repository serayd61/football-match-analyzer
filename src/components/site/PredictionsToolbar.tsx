'use client';

import { useTransition } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import LeaguePicker from './LeaguePicker';

// Predictions toolbar v3 (2026-09-26). ONE control surface for the day list:
//   row 1 · day strip (‹ yesterday · today · tomorrow ›) + native date input + match count
//   row 2 · league chips (only leagues with matches that day) + "other leagues" toggle
//   row 2 (right) · "AI · Ajan" toggle (24 Eki): satır altında AI en iyi bahis + ajan kararı
// özeti. Eski 3. satır (arama · durum · sıralama · pazar eşiği · hazır) kaldırıldı; sorgu
// anahtarları (q/status/sort/market/minp/ready) hâlâ çözülür, dış bağlantılar kırılmaz.
// State lives in the URL exactly as before (same query keys), so links, back/forward and
// the match page's "back" keep working. Every change navigates immediately — no Apply.

export interface ToolbarLeague { slug: string; name: string; country: string | null; n: number }
export interface ToolbarCountry { ccode: string; country: string; n: number }
export interface ToolbarULeague { id: number; name: string; ccode: string | null; n: number }
export interface ToolbarState {
  date: string; today: string; league: string | null; country: string | null; uLeagueId: number | null; scope: 'covered' | 'all';
  q: string; status: string; sort: string; ready: boolean; market: string | null; minP: number | null; note: boolean;
  /** satır altı AI · ajan özeti açık (varsayılan açık; `ai=0` kapatır) */
  ai: boolean;
}
export interface ToolbarLabels {
  yesterday: string; today: string; tomorrow: string; prevDay: string; nextDay: string; pickDate: string;
  all: string; otherLeagues: string; clear: string;
  /** "AI · Ajan" düğmesi ve erişilebilirlik açıklaması */
  ai: string; aiHint: string;
  country: string; countryAll: string; league: string; leagueAll: string; matches: string;
  picker: { placeholder: string; modelLeagues: string; countries: string; otherLeagues: string; noResults: string };
}

export default function PredictionsToolbar({ state, leagues, uncoveredCount, countries, uLeagues, aiCount, labels, dayLabel }: {
  state: ToolbarState; leagues: ToolbarLeague[]; uncoveredCount: number; countries: ToolbarCountry[]; uLeagues: ToolbarULeague[];
  /** listede AI görüşü hazır maç sayısı (düğme sayacı) */ aiCount: number; labels: ToolbarLabels; /** yesterday/today/tomorrow rendered by the server (locale) */ dayLabel: { prev: string; cur: string; next: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

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
      ai: state.ai ? undefined : '0',
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

  const outsideMode = state.uLeagueId != null || !!state.country;
  const selectedLabel = state.uLeagueId != null ? (uLeagues.find((u) => u.id === state.uLeagueId)?.name ?? `#${state.uLeagueId}`)
    : state.country ? (countries.find((c) => c.ccode === state.country)?.country ?? state.country)
    : state.league ? (leagues.find((l) => l.slug === state.league)?.name ?? state.league) : null;

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
        <LeaguePicker
          leagues={leagues} countries={countries} uLeagues={uLeagues}
          selected={selectedLabel}
          labels={{ ...labels.picker, clear: labels.clear }}
          onPick={(over) => go(over)}
          onClear={() => go({ league: undefined, country: undefined })}
        />
        <button type="button" onClick={() => go({ ai: state.ai ? '0' : undefined })} aria-pressed={state.ai} title={labels.aiHint} className={`chip chip-sm shrink-0 ${state.ai ? 'chip-on' : ''}`} data-testid="ai-toggle">
          <Sparkles size={14} /> {labels.ai}{aiCount ? <span className="num ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-s-accent px-1 text-[11px] text-white">{aiCount}</span> : null}
        </button>
      </div>
    </div>
  );
}
