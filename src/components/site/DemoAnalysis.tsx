// Örnek analiz kartı (görsel yenileme 2026-09-19). TEMSİLİ veri — canlı maç değildir ve
// öyle sanılmayacak biçimde etiketlenir ("Takım A / Takım B", canlı rozeti yok). Üyeye özel
// gerçek veri istemciye gönderilip bulanıklaştırılmaz; bu kartta gerçek tahmin YOKTUR.
// Değerler tutarlı: 1X2 toplamı %100, güven = seçimin kalibre olasılığı (ham %72 → %67),
// risk etiketi gerçek eşiklerden (lib/site/risk) türetilir.
import { getTranslations } from 'next-intl/server';
import ProbBar from './ProbBar';
import ConfidenceRing from './ConfidenceRing';
import { RiskLabel } from './Risk';
import { riskOf } from '@/lib/site/risk';

const DEMO = { pHome: 0.72, pDraw: 0.17, pAway: 0.11, conf: 0.67, xgHome: 1.9, xgAway: 0.8, over25: 0.58, btts: 0.44 };

export default async function DemoAnalysis({ id }: { id?: string }) {
  const t = await getTranslations('v2.landing');
  const tc = await getTranslations('common');
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <figure id={id} className="card !gap-5 scroll-mt-24" aria-label={t('demoTag')}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="tag tag-outline">{t('demoTag')}</span>
        <span className="text-[13px] text-s-muted">{t('demoLeague')} · {t('demoKick')}</span>
      </figcaption>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[26px] font-extrabold leading-[1.1] sm:text-[30px]">{t('demoHome')}</p>
          <p className="text-[26px] font-extrabold leading-[1.1] text-s-muted sm:text-[30px]">{t('demoAway')}</p>
        </div>
        <ConfidenceRing conf={DEMO.conf} size={96} label={t('demoConf')} inner="surface" />
      </div>

      <div>
        <p className="kicker mb-2">{t('demoProb')}</p>
        <ProbBar home={DEMO.pHome} draw={DEMO.pDraw} away={DEMO.pAway} highlight="1" size="lg" labels={{ home: tc('home'), draw: tc('draw'), away: tc('away') }} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-s-line pt-4 text-[14px] sm:grid-cols-4">
        <div><dt className="text-[12px] text-s-muted">{t('demoPick')}</dt><dd className="font-semibold">{t('demoPickV')}</dd></div>
        <div><dt className="text-[12px] text-s-muted">{t('demoRisk')}</dt><dd><RiskLabel risk={riskOf(DEMO.conf)} className="!text-[14px]" /></dd></div>
        <div><dt className="text-[12px] text-s-muted">{t('demoXg')}</dt><dd className="num font-semibold">{DEMO.xgHome.toFixed(1)} – {DEMO.xgAway.toFixed(1)}</dd></div>
        <div><dt className="text-[12px] text-s-muted">{t('demoOu')} · {t('demoBtts')}</dt><dd className="num font-semibold">{pct(DEMO.over25)} · {pct(DEMO.btts)}</dd></div>
      </dl>

      <p className="risk-note !text-[13px] text-s-muted">{t('demoNote', { conf: Math.round(DEMO.conf * 100), loss: 3 })}</p>
    </figure>
  );
}
