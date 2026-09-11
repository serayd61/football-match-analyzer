// Risk primitives (design handoff 2026-09-11). Server-safe, no hooks.
//   <RiskLabel risk/>  — 11px/600 "Low risk" (neutral-800) · "Medium risk"
//                        (accent-2-700) · "High risk" (accent-700)
//   <RiskNote/>        — 13px paragraph, 2px accent left border, no fill
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Risk } from '@/lib/site/risk';

const TONE: Record<Risk, string> = {
  low: 'text-s-n800',
  medium: 'text-s-accent2-700',
  high: 'text-s-accent-700',
};

export async function RiskLabel({ risk, className = '' }: { risk: Risk; className?: string }) {
  const t = await getTranslations('v2.risk');
  return <span className={`text-[11px] font-semibold leading-none ${TONE[risk]} ${className}`}>{t(risk)}</span>;
}

export function RiskNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`risk-note ${className}`}>{children}</p>;
}
