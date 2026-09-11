import { redirect } from 'next/navigation';

// /results merged into /performance (Modernist redesign 2026-09-11). The
// league and page parameters carry over; period filters are gone.
export default function ResultsRedirect({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: { page?: string; league?: string } }) {
  const qs = new URLSearchParams();
  if (searchParams.league) qs.set('league', searchParams.league);
  if (searchParams.page && searchParams.page !== '1') qs.set('page', searchParams.page);
  const q = qs.toString();
  redirect(`/${locale}/performance${q ? `?${q}` : ''}#results`);
}
