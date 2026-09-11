// Stat row — equal-width cells separated by 1px left rules, the row bounded
// by 2px top/bottom rules. Label 11–12px muted over a 34–40px/800 value.
// Server-safe.
import type { ReactNode } from 'react';

export function StatRow({ children, cols, className = '', rule = 2, dense = false }: { children: ReactNode; cols: 2 | 3 | 4; className?: string; rule?: 1 | 2; dense?: boolean }) {
  const grid = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
  const rules = rule === 2 ? 'rule-t rule-b' : 'rule-t-1 rule-b-1';
  return (
    <dl className={`grid ${grid} ${rules} ${dense ? 'stat-dense' : ''} ${className}`}>{children}</dl>
  );
}

export function StatCell({ label, value, note, tone, size = 'md', first = false }: {
  label: string; value: ReactNode; note?: ReactNode;
  tone?: 'accent' | 'muted' | 'accent-700';
  size?: 'sm' | 'md' | 'lg';
  /** first cell in the row carries no left rule */
  first?: boolean;
}) {
  const color = tone === 'accent' ? 'text-s-accent' : tone === 'muted' ? 'text-s-muted' : tone === 'accent-700' ? 'text-s-accent-700' : '';
  const fs = size === 'lg' ? 'text-[40px]' : size === 'sm' ? 'text-[24px]' : 'text-[34px]';
  return (
    <div className={`flex flex-col gap-1 py-3 ${first ? 'pr-3' : 'px-3 rule-l-1'} ${size === 'sm' ? 'py-2' : ''}`}>
      <dt className="text-[11px] font-medium leading-tight text-s-muted">{label}</dt>
      <dd className={`num font-head font-extrabold leading-none ${fs} ${color}`}>{value}</dd>
      {note && <dd className="text-[11px] text-s-muted">{note}</dd>}
    </div>
  );
}
