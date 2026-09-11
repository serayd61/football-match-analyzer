// Small shared primitives for the public site: page frame, section heading,
// skeleton rows, empty state. Server-safe (no hooks). Page gutters are 24px.
import type { ReactNode } from 'react';

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-6 ${className}`}>{children}</div>;
}

export function PageTitle({ eyebrow, title, lead, aside }: { eyebrow?: string; title: string; lead?: string; aside?: ReactNode }) {
  return (
    <div className="rule-b flex flex-wrap items-end justify-between gap-4 pb-4 pt-8">
      <div className="max-w-2xl">
        {eyebrow && <p className="kicker mb-2">{eyebrow}</p>}
        <h1 className="text-[32px] sm:text-[40px]">{title}</h1>
        {lead && <p className="mt-2 text-[14px] text-s-muted">{lead}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export function SectionTitle({ title, meta, sub, children }: { title: string; meta?: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rule-b flex flex-wrap items-end justify-between gap-x-4 gap-y-1 pb-3">
      <div>
        <h2 className="text-[24px] sm:text-[30px]">{title}</h2>
        {sub && <p className="mt-1 text-[14px] text-s-muted">{sub}</p>}
      </div>
      {meta && <span className="text-[13px] font-semibold">{meta}</span>}
      {children}
    </div>
  );
}

export function SkeletonRows({ rows = 6, height = 'h-10' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`skeleton ${height}`} style={{ width: `${100 - (i % 3) * 6}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return (
    <div className="rule-t rule-b-1 px-0 py-10">
      <p className="text-[20px] font-extrabold">{title}</p>
      {lead && <p className="mt-1 max-w-xl text-sm text-s-muted">{lead}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
