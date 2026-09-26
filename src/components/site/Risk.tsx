// Risk primitives (v3). Server-safe, no hooks.
//   <RiskLabel risk/>  — coloured pill with a dot: Low (green) · Medium (amber) · High (red)
//   <RiskNote/>        — 13px note, 3px accent left border, tinted background
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Risk } from '@/lib/site/risk';

export async function RiskLabel({ risk, className = '', short = false }: { risk: Risk; className?: string; short?: boolean }) {
  const t = await getTranslations('v2.risk');
  return <span className={`risk risk-${risk} ${className}`}>{t(short ? `${risk}Short` : risk)}</span>;
}

export function RiskNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`risk-note ${className}`}>{children}</p>;
}
