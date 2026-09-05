// ============================================================================
// Guard for test / debug endpoints that write through the service role.
// Denetim 2026-09-05 (P0): /api/test-unified-save GET, kimlik doğrulaması
// olmadan service-role ile unified_analysis'e yazıp siliyordu ve middleware
// matcher'ı bu yolu kapsamıyordu. Bu yardımcı:
//   • üretimde (NODE_ENV=production) varsayılan olarak 404 döndürür,
//   • yalnızca `Authorization: Bearer <CRON_SECRET|ADMIN_SECRET>` ile açılır,
//   • geliştirmede serbesttir.
// 404 (403 değil) bilinçli: uç noktanın varlığı bile dışarıya sızmasın.
// ============================================================================

import { NextResponse } from 'next/server';

type HeaderReader = { headers: { get(name: string): string | null } };

export function hasServiceSecret(req: HeaderReader): boolean {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter((s): s is string => !!s);
  if (!secrets.length) return false;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return !!token && secrets.includes(token);
}

/** Null when the caller may proceed; otherwise the response to return. */
export function devOnlyGuard(req: HeaderReader): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null;
  if (hasServiceSecret(req)) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
