'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sun, Moon, Monitor } from 'lucide-react';

type Mode = 'system' | 'light' | 'dark';
const KEY = 'site-theme';

function apply(mode: Mode) {
  const root = document.querySelector<HTMLElement>('.site');
  if (!root) return;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const t = useTranslations('theme');
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Mode | null;
      if (saved === 'light' || saved === 'dark') setMode(saved);
    } catch {}
  }, []);

  function cycle() {
    const next: Mode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    apply(next);
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
  }

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border border-s-line bg-s-surface text-s-ink hover:border-s-muted ${className}`}
      aria-label={`${t('label')}: ${t(mode)}`}
      title={`${t('label')}: ${t(mode)}`}
    >
      <Icon size={16} strokeWidth={2} aria-hidden />
    </button>
  );
}
