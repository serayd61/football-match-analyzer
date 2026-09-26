'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Section tabs v3: server-rendered panels, client-side switching. The active
// tab is mirrored in the URL hash (#markets) so links stay shareable; every
// panel is in the HTML, so search engines and no-JS readers see all of it.
export interface TabPanel { id: string; label: string; content: ReactNode; badge?: string | number }

export default function SectionTabs({ panels, ariaLabel }: { panels: TabPanel[]; ariaLabel: string }) {
  const [active, setActive] = useState(panels[0]?.id);
  useEffect(() => {
    const fromHash = () => { const h = window.location.hash.slice(1); if (panels.some((p) => p.id === h)) setActive(h); };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [panels]);
  const pick = (id: string) => { setActive(id); try { history.replaceState(null, '', `#${id}`); } catch {} };

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="no-scrollbar sticky top-[60px] z-30 -mx-4 flex gap-1 overflow-x-auto border-b border-s-line bg-s-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        {panels.map((p) => (
          <button
            key={p.id} type="button" role="tab" id={`tab-${p.id}`} aria-selected={active === p.id} aria-controls={`panel-${p.id}`}
            onClick={() => pick(p.id)}
            className={`relative -mb-px shrink-0 whitespace-nowrap px-3 py-3 text-[14.5px] font-semibold transition-colors ${active === p.id ? 'text-s-ink' : 'text-s-muted hover:text-s-ink'}`}
          >
            {p.label}{p.badge != null && <span className="num ml-1.5 rounded-full bg-s-raised px-1.5 py-0.5 text-[11px] text-s-muted">{p.badge}</span>}
            {active === p.id && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-s-accent" aria-hidden />}
          </button>
        ))}
      </div>
      {panels.map((p) => (
        <section key={p.id} role="tabpanel" id={`panel-${p.id}`} aria-labelledby={`tab-${p.id}`} hidden={active !== p.id} className="pt-8">
          {p.content}
        </section>
      ))}
    </div>
  );
}
