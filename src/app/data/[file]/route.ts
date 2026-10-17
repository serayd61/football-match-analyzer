import { parseOpenDataFile, toCsv, toJson, openDataMeta, OPEN_DATA_ALL } from '@/lib/site/open-data';
import { listOpenDataRows } from '@/lib/site/open-data-data';

// /data/{all|league-slug}.{csv|json} — the open-data files (SEO Faz 2.1).
// Unlocalized like /sitemap.xml: a dataset URL should not change with the
// reader's language. Settled matches only (lib/site/open-data.ts); cached an
// hour at the edge and re-read from the hourly `listOpenDataRows` cache.
// CORS is open so the files load straight into notebooks and Observable.
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const parsed = parseOpenDataFile(params.file);
  if (!parsed) return new Response('Not found', { status: 404 });
  const all = await listOpenDataRows().catch((e) => { console.error('[open-data]', e); return null; });
  if (!all) return new Response('Temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
  const rows = parsed.name === OPEN_DATA_ALL ? all : all.filter((r) => r.league_slug === parsed.name);
  const meta = openDataMeta(parsed.name, rows);
  const body = parsed.ext === 'csv' ? toCsv(rows) : toJson(rows, meta);
  return new Response(body, {
    headers: {
      'Content-Type': parsed.ext === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `inline; filename="footballanalytics-${parsed.name}.${parsed.ext}"`,
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'X-Dataset-Rows': String(rows.length),
      'X-Dataset-License': 'CC-BY-4.0',
    },
  });
}
