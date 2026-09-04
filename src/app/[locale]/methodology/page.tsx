import type { Metadata } from 'next';
import DocPage, { docMetadata } from '@/components/site/DocPage';

export const revalidate = 86400;

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  return docMetadata(locale, 'methodology');
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  return <DocPage locale={locale} doc="methodology" updated="2026-09-04" />;
}
