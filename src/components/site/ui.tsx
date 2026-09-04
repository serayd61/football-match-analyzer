// Small shared primitives for the public site: page frame, section heading,
// skeleton rows, empty state. Server-safe (no hooks).
import type { ReactNode } from 'react';

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function PageTitle({ eyebrow, title, lead, aside }: { eyebrow?: string; title: string; lead?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-5">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-s-muted">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {lead && <p className="mt-2 text-s-muted">{lead}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export function SectionTitle({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-s-line pb-2">
      <h2 className="text-xl">{title}</h2>
      {meta && <span className="text-xs text-s-muted">{meta}</span>}
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
    <div className="rounded-sm border border-dashed border-s-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {lead && <p className="mt-1 text-sm text-s-muted">{lead}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
