import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import MatchRow from '@/components/site/MatchRow';
import { aiFixtureFlags } from '@/lib/site/ai-analysis';
import { listDay } from '@/lib/site/fixtures';
import { getPerformance } from '@/lib/site/performance';
import { getMarketSnapshots } from '@/lib/site/dashboard';
import { dailyStandingBoard } from '@/lib/site/daily-standing';
import { outsideStandingFor } from '@/lib/site/outside-standing';
import { todayYmd } from '@/lib/site/time';

// Ana sayfa hero kartının ÜYE sürümü: günün ilk 5 modellenmiş maçı + karneye
// uyan seçim sayısı (anonim ISR ayrımı, 2026-11-10). Yalnız m/page.tsx çağırır.
//
// Neden HomePage.tsx'te değil: MatchRow → PredictionCard → LockedPick → isTwa()
// (cookies) zinciri ve listDay → feed-fallback → `cache: 'no-store'` fetch'i.
// İkisi de anonim ISR ağacına girerse Next rotayı sessizce dinamiğe düşürür.
// Üye rotası zaten force-dynamic; burada serbest.
//
// Bileşen bir fonksiyon olarak `await HomeMemberHero({ locale })` ile çağrılır
// (JSX olarak değil): günün maçı yoksa null döner ve HomePage örnek analiz
// kartına düşer — bu kararı JSX düğümünden okumak mümkün olmazdı.
export default async function HomeMemberHero({ locale }: { locale: string }) {
  const [t3, tpk, perf, today] = await Promise.all([
    getTranslations({ locale, namespace: 'v3.home' }),
    getTranslations({ locale, namespace: 'picks' }),
    getPerformance(null),
    listDay(todayYmd()).catch(() => null),
  ]);
  const rows = today?.rows ?? [];
  // v3: members see the day's first modelled fixtures right in the hero.
  const covered = rows.filter((r) => r.covered && r.hasModel);
  const todayRows = [...covered].sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 5);
  if (!todayRows.length) return null;
  const todayTotal = covered.length;
  const aiIds = await aiFixtureFlags(todayRows.map((r) => r.fixtureId)).catch(() => new Map<number, { verdict: boolean }>());
  // Karneye uyan maçlar (8 Eki): günün güçlü seçim sayısı; maç listesinin altında /picks bağlantısı.
  const outside = await outsideStandingFor().catch(() => null);
  const fitRows = rows.filter((r) => r.hasModel && (r.covered || !!outside?.eligible(r)));
  const fitBoard = fitRows.length > 0
    ? dailyStandingBoard(fitRows, await getMarketSnapshots(fitRows.map((r) => r.fixtureId)).catch(() => ({})), perf.signals, undefined, outside?.standing)
    : null;
  return (
    <section className="overflow-hidden rounded-2xl border border-s-line bg-s-surface shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)]" aria-label={t3('todayTitle')}>
      <header className="flex items-center justify-between gap-3 border-b border-s-line px-4 py-3">
        <h2 className="text-[15px] font-bold">{t3('todayTitle')} <span className="num ml-1 font-semibold text-s-muted">{todayTotal}</span></h2>
        <Link href="/predictions" className="text-[13.5px] font-semibold text-s-accent-700 hover:underline">{t3('todayAll')} →</Link>
      </header>
      <div className="divide-rule">{todayRows.map((p) => <MatchRow key={p.fixtureId} p={p} ai={aiIds.has(p.fixtureId)} aiVerdict={!!aiIds.get(p.fixtureId)?.verdict} />)}</div>
      {fitBoard && fitBoard.matches > 0 && (
        <Link href="/picks" className="flex items-center justify-between gap-3 border-t border-s-line bg-s-raised/50 px-4 py-3 hover:bg-s-raised" data-cta="hero-picks">
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">{tpk('homeTitle')}</span>
            <span className="block truncate text-[12.5px] text-s-muted">{tpk('homeLead', { matches: fitBoard.matches })}</span>
          </span>
          <span className="shrink-0 text-[13.5px] font-semibold text-s-accent-700">{tpk('homeCta')} →</span>
        </Link>
      )}
    </section>
  );
}
