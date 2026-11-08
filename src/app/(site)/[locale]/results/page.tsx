import { permanentRedirect } from 'next/navigation';

// /results merged into /performance (Modernist redesign 2026-09-11). The
// league and page parameters carry over; period filters are gone.
// 2026-11-08: `redirect()` 307 (geçici) basıyordu, birleşme ise kalıcı —
// SC "Yönlendirmeli sayfa" (141) altında duruyordu. 308 ile eski URL'nin
// bağlantı değeri /performance'a geçer.
export default function ResultsRedirect({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: { page?: string; league?: string } }) {
  const qs = new URLSearchParams();
  if (searchParams.league) qs.set('league', searchParams.league);
  if (searchParams.page && searchParams.page !== '1') qs.set('page', searchParams.page);
  const q = qs.toString();
  permanentRedirect(`/${locale}/performance${q ? `?${q}` : ''}#results`);
}
