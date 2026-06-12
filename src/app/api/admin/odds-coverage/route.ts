// ============================================================================
// ODDS COVERAGE AUDIT — piyasa-çıpası blend'inin canlıda GERÇEKTEN çalışıp
// çalışmadığını ölçer. Blend yalnızca geçerli bahisçi oranı gelirse devreye
// girer (marj guard'ı %0.1–15). Sahte default oran (2.0/3.0/2.5, marj ~%23)
// veya oran yokluğu → blend atlanır, saf DC kullanılır.
//
// Bu uç, LIVE tahmin akışıyla AYNI yolu (dataProviderManager.getPreMatchOdds)
// kullanır; böylece "blend prod'da devrede mi?" sorusunu kesin yanıtlar.
//
// Kullanım (prod, env key'leriyle):
//   GET /api/admin/odds-coverage?fixtures=19135052,19135053&secret=<CRON_SECRET>
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { dataProviderManager } from '@/lib/data-providers';
import { bookmakerMargin } from '@/lib/odds/devig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Opsiyonel koruma: CRON_SECRET tanımlıysa eşleşme iste (oran hassas değil ama temkinli).
  const secret = process.env.CRON_SECRET;
  const provided = req.nextUrl.searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get('fixtures') || '';
  const ids = idsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));

  if (!ids.length) {
    return NextResponse.json(
      { ok: false, error: 'fixtures query gerekli, örn: ?fixtures=19135052,19135053' },
      { status: 400 }
    );
  }

  const rows: any[] = [];
  for (const id of ids) {
    try {
      const res: any = await dataProviderManager.getPreMatchOdds(id);
      const odds: any = res?.data ?? res; // manager {data} veya doğrudan OddsData
      const mw = odds?.matchWinner;
      if (mw && [mw.home, mw.draw, mw.away].every((v: any) => typeof v === 'number' && v > 1)) {
        const margin = bookmakerMargin([mw.home, mw.draw, mw.away]);
        const passesGuard = margin > 0.001 && margin < 0.15;
        const looksFakeDefault = mw.home === 2.0 && mw.draw === 3.0 && mw.away === 2.5;
        rows.push({
          fixtureId: id,
          hasOdds: true,
          matchWinner: { home: mw.home, draw: mw.draw, away: mw.away },
          marginPct: +(margin * 100).toFixed(2),
          passesGuard,
          looksFakeDefault,
        });
      } else {
        rows.push({ fixtureId: id, hasOdds: false });
      }
    } catch (e: any) {
      rows.push({ fixtureId: id, error: e?.message || 'hata' });
    }
  }

  const hasOdds = rows.filter((r) => r.hasOdds).length;
  const pass = rows.filter((r) => r.passesGuard).length;
  const fake = rows.filter((r) => r.looksFakeDefault).length;

  const verdict =
    pass === 0
      ? '🔴 Blend CANLIDA DEVREDE DEĞİL — geçerli bahisçi oranı gelmiyor (sağlayıcı/parser sorunu). Tahminler saf DC kullanıyor.'
      : `🟢 Blend ${pass}/${ids.length} maçta aktif. Geri kalanlarda saf DC (regresyon yok).`;

  return NextResponse.json({
    ok: true,
    summary: {
      total: ids.length,
      hasOdds,
      passesGuard: pass,
      fakeDefaults: fake,
      coveragePct: ids.length ? +((pass / ids.length) * 100).toFixed(1) : 0,
      verdict,
    },
    rows,
  });
}
