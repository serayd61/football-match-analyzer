import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

// League group v3: a card with a slim header (league · country · count) and
// divided match rows. `muted` marks leagues outside model coverage.
export default function LeagueGroup({ id, name, meta, href, count, tags = [], muted = false, children }: {
  id?: string; name: string; meta?: string; href?: string; count: number; tags?: string[]; muted?: boolean; children: ReactNode;
}) {
  const title = href ? <Link href={href} className="hover:underline">{name}</Link> : name;
  return (
    <section id={id} className={`scroll-mt-20 overflow-hidden rounded-2xl border bg-s-surface shadow-[var(--s-shadow)] ${muted ? 'border-dashed border-s-n400/70' : 'border-s-line'}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-s-line bg-s-raised/40 px-4 py-2.5">
        <h2 className="text-[14.5px] font-bold leading-none">{title}</h2>
        {meta && <span className="num truncate text-[12px] text-s-muted">{meta}</span>}
        <span className="num ml-auto text-[12px] font-semibold text-s-muted">{count}</span>
        {tags.length > 0 && <span className="flex w-full flex-wrap gap-1.5 pt-1">{tags.map((m) => <span key={m} className="tag tag-accent num !normal-case !tracking-normal">{m}</span>)}</span>}
      </header>
      <div className="divide-rule">{children}</div>
    </section>
  );
}
