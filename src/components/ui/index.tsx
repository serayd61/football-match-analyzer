'use client';

// ============================================================================
// UI PRIMITIVES — modern clean SaaS design system
// Used by the rebuilt dashboard (and future pages). Styling relies on the
// `.fa-shell` scoped layer in globals.css + tailwind design tokens.
// ============================================================================

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({
  className,
  hover = false,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cx('fa-card', hover && 'fa-card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 mt-0.5 w-9 h-9 rounded-lg grid place-items-center bg-surface-3 border border-line text-brand-400">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-content leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-xs text-content-subtle mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg',
  md: '',
  lg: 'text-[15px] px-5 py-3 rounded-xl',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: ReactNode;
    loading?: boolean;
  }
>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx('fa-btn', `fa-btn-${variant}`, BTN_SIZE[size], className)}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
});

// ── Badge ───────────────────────────────────────────────────────────────────
type Tone = 'neutral' | 'brand' | 'positive' | 'caution' | 'negative' | 'info';

const TONE_STYLE: Record<Tone, string> = {
  neutral: 'border-line bg-surface-3 text-content-muted',
  brand: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  positive: 'border-positive/40 bg-positive/10 text-positive',
  caution: 'border-caution/40 bg-caution/10 text-caution',
  negative: 'border-negative/40 bg-negative/10 text-negative',
  info: 'border-info/40 bg-info/10 text-info',
};

export function Badge({
  tone = 'neutral',
  icon,
  className,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full border',
        TONE_STYLE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

// ── Stat ────────────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const accent: Record<Tone, string> = {
    neutral: 'text-content-muted',
    brand: 'text-brand-400',
    positive: 'text-positive',
    caution: 'text-caution',
    negative: 'text-negative',
    info: 'text-info',
  };
  return (
    <div className={cx('fa-card p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-content-subtle font-medium">{label}</span>
        {icon && <span className={accent[tone]}>{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-content tracking-tight tabular-nums">{value}</div>
      {hint && <div className="text-xs text-content-subtle mt-1">{hint}</div>}
    </div>
  );
}

// ── Section header (page-level) ───────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl grid place-items-center bg-brand-500/10 border border-brand-500/25 text-brand-400">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-content tracking-tight">{title}</h2>
          {subtitle && <p className="text-[13px] text-content-subtle mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('fa-skeleton', className)} />;
}

// ── Empty / error states ─────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('fa-card flex flex-col items-center justify-center text-center px-6 py-14', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl grid place-items-center bg-surface-3 border border-line text-content-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-content">{title}</h3>
      {description && <p className="text-sm text-content-subtle mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Segmented control ────────────────────────────────────────────────────────
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex p-0.5 rounded-lg bg-surface-1 border border-line', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[7px] transition-colors',
            value === o.value
              ? 'bg-surface-4 text-content shadow-elev-1'
              : 'text-content-subtle hover:text-content-muted',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-block rounded-full border-2 border-current border-t-transparent animate-spin', className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number; // 0..100
  tone?: Tone;
  className?: string;
}) {
  const bar: Record<Tone, string> = {
    neutral: 'bg-content-muted',
    brand: 'bg-brand-500',
    positive: 'bg-positive',
    caution: 'bg-caution',
    negative: 'bg-negative',
    info: 'bg-info',
  };
  return (
    <div className={cx('h-1.5 rounded-full bg-surface-4 overflow-hidden', className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', bar[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export { cx };
