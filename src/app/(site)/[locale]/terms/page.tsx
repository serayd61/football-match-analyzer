import type { Metadata } from 'next';
import DocPage, { docMetadata } from '@/components/site/DocPage';

export const revalidate = 86400;

// Legal text: bump the date whenever the wording changes.
export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  return docMetadata(locale, 'terms');
}

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  return <DocPage locale={locale} doc="terms" updated="2026-09-04" />;
}
