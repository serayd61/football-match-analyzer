import type { Metadata } from 'next';

// SEO denetimi 2026-10-10: account-recovery pages are not search content.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
