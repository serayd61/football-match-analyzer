// ============================================================================
// Google Play lansman duyurusu (2026-10-30) — kayıtlı üyelere tek seferlik.
// Saf şablon: dış bağımlılık yok (önizleme betiği doğrudan çalıştırır).
// Dil: yalnızca İngilizce (kullanıcı kararı 2026-10-30; profiles'ta locale yok, adreslerin %98'i .com).
// Footer'da zorunlu unsubscribe + List-Unsubscribe başlığı runner'da eklenir.
// ============================================================================

export type PlayLaunchEmailInput = {
  /** UTM'li Play mağaza linki (düğme) */
  playUrl: string;
  /** Sitedeki uygulama ayrıntı sayfası */
  appPageUrl: string;
  /** Barındırılan QR PNG (e-posta istemcileri SVG göstermez) */
  qrImageUrl: string;
  /** Barındırılan uygulama simgesi (192px PNG) */
  iconUrl: string;
  unsubscribeUrl: string;
  name?: string | null;
};

const BRAND = '#0f7a4a';
const INK = '#131a17';
const MUTED = '#5b6660';
const LINE = '#e3e8e5';
const BG = '#f4f6f5';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildPlayLaunchEmail(i: PlayLaunchEmailInput): { subject: string; html: string; text: string } {
  const hi = i.name ? `${esc(i.name)}, ` : '';
  const btn = (label: string) =>
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 6px"><tr><td style="background:${BRAND};border-radius:10px">` +
    `<a href="${i.playUrl}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">▶&nbsp; ${label}</a></td></tr></table>`;
  const block = (title: string, body: string, cta: string, more: string) => `
      <tr><td style="padding:24px 28px;border-top:1px solid ${LINE}">
        <h2 style="margin:0 0 8px;font-size:19px;line-height:1.3;color:${INK}">${title}</h2>
        <p style="margin:0;font-size:15px;line-height:1.55;color:${INK}">${body}</p>
        ${btn(cta)}
        <p style="margin:6px 0 0;font-size:13px;color:${MUTED}"><a href="${i.appPageUrl}" style="color:${MUTED}">${more}</a></p>
      </td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Football Analytics Pro — now on Google Play</title></head>
<body style="margin:0;padding:0;background:${BG}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <!-- Hero -->
  <tr><td style="padding:28px 28px 22px;background:${INK};color:#ffffff">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
      <td valign="top">
        <img src="${i.iconUrl}" width="56" height="56" alt="" style="display:block;border-radius:14px;border:1px solid rgba(255,255,255,.15)">
        <p style="margin:16px 0 4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7fd3a6;font-weight:700">Now on Google Play</p>
        <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff">Football Analytics Pro,<br>now on your phone.</h1>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#b9c4be">Today's probabilities, the public track record and league context — in a free Android app.</p>
      </td>
      <td valign="top" width="132" align="right" style="padding-left:16px">
        <a href="${i.playUrl}" style="text-decoration:none"><img src="${i.qrImageUrl}" width="124" height="124" alt="QR — Google Play" style="display:block;background:#ffffff;padding:6px;border-radius:10px"></a>
        <p style="margin:6px 0 0;font-size:11px;line-height:1.4;color:#b9c4be;text-align:center">Scan with your<br>phone camera</p>
      </td>
    </tr></table>
  </td></tr>

  ${block(`${hi}the app is ready.`,
    "Same model, same public track record, now in an app: today's matches with probabilities, confidence and risk, league tables, form and head-to-head. Free to install; sign in with your web account.",
    'Get it on Google Play', 'App details →')}

  <!-- Footer -->
  <tr><td style="padding:18px 28px 24px;border-top:1px solid ${LINE};background:#fafbfa">
    <p style="margin:0 0 8px;font-size:11px;line-height:1.5;color:#8a948f">Android 7.0 or newer. 18+. Football Analytics Pro is an information and statistics service; it does not offer or accept bets.</p>
    <p style="margin:0;font-size:11px;line-height:1.5;color:#8a948f">You received this because you signed up at footballanalytics.pro.<br>
    <a href="${i.unsubscribeUrl}" style="color:#8a948f">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `Football Analytics Pro — now on Google Play

The app is ready. Same model, same public track record, now in an app: today's matches with probabilities, confidence and risk, league tables, form and head-to-head. Free to install; sign in with your web account.

Get it on Google Play: ${i.playUrl}
App details: ${i.appPageUrl}

Android 7.0 or newer. 18+. An information and statistics service; no betting.
Unsubscribe: ${i.unsubscribeUrl}`;

  return {
    subject: 'Football Analytics Pro is now on Google Play',
    html,
    text,
  };
}
