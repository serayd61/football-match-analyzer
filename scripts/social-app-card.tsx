// Uygulama + site tanıtım kartı (1080×1350): Google Play QR + web QR, yan yana.
// Çalıştırma: TSX_TSCONFIG_PATH=tsconfig.scripts.json node --import tsx scripts/social-app-card.tsx <play-qr.png> <site-qr.png> <çıktı.png> [en|tr]
// QR PNG'leri önceden üretilir (ör. `qrcode` paketi). Renkler image.tsx ile aynı kimlik.
import { readFileSync, writeFileSync } from 'node:fs';
import { ImageResponse } from 'next/og';

const BG = '#f5f3ee', INK = '#1c1b18', MUTED = '#6a655b', ACCENT = '#a8432a', LINE = '#dfdad0', CARD = '#ffffff';
const W = 1080, H = 1350;

async function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:10.0) Gecko/20100101 Firefox/10.0' } }).then((r) => r.text());
  const m = css.match(/src: url\(([^)]+\.(?:ttf|otf|woff))\)/);
  if (!m) throw new Error(`font url yok: ${family}`);
  return fetch(m[1]).then((r) => r.arrayBuffer());
}

async function main() {
  const [playPath, sitePath, out, langArg] = process.argv.slice(2);
  const lang = langArg === 'tr' ? 'tr' : 'en';
  const dataUri = (p: string) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  const [display, body] = await Promise.all([googleFont('Archivo', 700), googleFont('IBM Plex Sans', 500)]);
  const t = lang === 'tr'
    ? { kicker: 'ÜCRETSİZ · WEB + ANDROID', title: 'Futbol analizi cebinde.', app: 'Android uygulaması', appSub: 'Google Play', web: 'Web sitesi', webSub: 'footballanalytics.pro', scan: 'Kamerayı QR\'a tut', f: ['xG ve kazanma olasılığı · 350+ lig', 'Günün model seçimleri, maçtan önce dondurulur', 'Ölçülmüş karne: çifte şans %77,7 (21.953 maç)'], foot: 'Kayıt ücretsiz. Kazanan da kaybeden de yazılır.' }
    : { kicker: 'FREE · WEB + ANDROID', title: 'Football analytics, in your pocket.', app: 'Android app', appSub: 'Google Play', web: 'Website', webSub: 'footballanalytics.pro', scan: 'Point your camera at the QR', f: ['xG & win probability · 350+ leagues', "Daily model picks, frozen before kick-off", 'Measured record: double chance 77.7% (21,953 matches)'], foot: 'Free to join. Wins and losses both recorded.' };
  const Panel = (title: string, sub: string, src: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: CARD, border: `2px solid ${LINE}`, padding: 30, alignItems: 'center' }}>
      <span style={{ fontFamily: 'Archivo', fontSize: 34 }}>{title}</span>
      <span style={{ fontSize: 24, color: MUTED, marginTop: 4 }}>{sub}</span>
      <img src={src} width={360} height={360} style={{ marginTop: 22 }} />
    </div>
  );
  const img = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: BG, color: INK, padding: 64, fontFamily: 'Plex' }}>
        <div style={{ display: 'flex', flexDirection: 'column', borderBottom: `4px solid ${INK}`, paddingBottom: 22 }}>
          <span style={{ fontSize: 26, color: ACCENT, letterSpacing: 2 }}>{t.kicker}</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 72, lineHeight: 1.02, marginTop: 8 }}>{t.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 40 }}>
          {Panel(t.app, t.appSub, dataUri(playPath))}
          {Panel(t.web, t.webSub, dataUri(sitePath))}
        </div>
        <span style={{ fontSize: 26, color: MUTED, marginTop: 16, textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>{t.scan}</span>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44, borderTop: `2px solid ${LINE}` }}>
          {t.f.map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 0', borderBottom: `2px solid ${LINE}`, fontSize: 32 }}>
              <div style={{ display: 'flex', width: 14, height: 14, background: ACCENT }} />
              <span>{line}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: 18 }}>
          <span style={{ fontSize: 24, color: MUTED, lineHeight: 1.35 }}>{t.foot}</span>
          <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Archivo', fontSize: 34 }}>
            <span>football</span><span style={{ color: ACCENT }}>analytics</span><span style={{ color: MUTED }}>.pro</span>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: 'Archivo', data: display, weight: 700, style: 'normal' }, { name: 'Plex', data: body, weight: 500, style: 'normal' }] },
  );
  const png = Buffer.from(await img.arrayBuffer());
  writeFileSync(out, png);
  console.log(`yazıldı: ${out} (${png.length} bayt)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
