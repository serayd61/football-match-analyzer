import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { freeFixtures } from '@/lib/site/free-today';
import { getPrediction, type SitePrediction } from '@/lib/site/predictions';
import LocalTime from './LocalTime';

// Günün ücretsiz maçları (2026-11-14) — denemesi biten üyenin duvarın üstünde
// gördüğü liste. Telegram'da ve geri kazanım e-postasında yayınlananla aynı
// maçlar (lib/site/free-today.ts); her satır maçın tam analizine gider. O gün
// yayın yoksa (ör. milli ara) blok hiç basılmaz. Yalnız `expired` dalında çağrılır.
export default async function FreeTodayBlock() {
  const { today } = await freeFixtures();
  if (!today.length) return null;
  const rows = (await Promise.all(today.map((id) => getPrediction(id).catch(() => null))))
    .filter((p): p is SitePrediction => !!p)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!rows.length) return null;
  const t = await getTranslations('paywall');
  return (
    <section className="mt-8 rounded-[14px] border border-s-accent/40 bg-s-accent-100/40 p-5 sm:p-6" aria-labelledby="free-today-title">
      <p className="kicker !text-s-accent-700">{t('freeKicker')}</p>
      <h2 id="free-today-title" className="mt-1 text-[22px]">{t('freeListTitle', { n: rows.length })}</h2>
      <p className="mt-1 max-w-[60ch] text-[14px] text-s-muted">{t('freeListLead')}</p>
      <ul className="mt-4 divide-y divide-s-line rounded-[10px] border border-s-line bg-s-surface">
        {rows.map((p) => (
          <li key={p.fixtureId}>
            {/* Telefonda takım adı kesilmesin: düğme metni adların altına iner. */}
            <Link href={`/predictions/${p.fixtureId}`} data-cta="free-today-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 hover:bg-s-raised/60 sm:flex-nowrap sm:px-4">
              <LocalTime iso={p.kickoff} format="time" className="w-12 shrink-0 text-[13px] text-s-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{p.homeName} – {p.awayName}</span>
                <span className="block truncate text-[12.5px] text-s-muted">{p.leagueName}</span>
              </span>
              <span className="basis-full pl-[60px] text-[13px] font-semibold text-s-accent sm:basis-auto sm:shrink-0 sm:pl-0">{t('freeOpen')} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
