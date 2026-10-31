// ============================================================================
// OPS RAPORU (2026-10-31) — günde iki kez (08:00 / 20:00 Zürih) sahibine e-posta:
// pencere içinde kayıt olanlar + 7 günlük denemesi bitenler + yaklaşan bitişler.
// Saf fonksiyon: veri route'tan gelir, burada yalnız sınıflandırma ve metin.
// Erişim kuralı accessControl.ts ile aynı (isGrantLive + kayıt denemesi); burada
// kopyalandı ki test Supabase istemcisini yüklemesin.
// ============================================================================
import { TRIAL_DAYS } from './trial-emails';

const DAY = 86_400_000;
const GRACE_DAYS = 3;
const LIVE = ['active', 'trialing', 'pro', 'premium'];

export interface OpsUser { id?: string | null; email: string; name?: string | null; createdAt: string; passwordHash?: string | null }
export interface OpsProfile { email: string; trialEndsAt?: string | null; subscriptionStatus?: string | null; subscriptionEnd?: string | null; lastSeenAt?: string | null; firstMatchViewAt?: string | null }
export interface OpsSub { userId: string; status?: string | null; currentPeriodEnd?: string | null; stripeSubscriptionId?: string | null }
export interface OpsInput { users: OpsUser[]; profiles: OpsProfile[]; subs: OpsSub[] }

export type AccessKind = 'paid' | 'trial' | 'expired';
export interface OpsRow { email: string; name: string | null; method: 'google' | 'password'; createdAt: string; trialEndsAt: string; access: AccessKind; lastSeenAt: string | null; firstMatchViewAt: string | null; returned: boolean }
export interface OpsReport {
  now: string; from: string; to: string;
  newSignups: OpsRow[];
  trialEnded: OpsRow[];      // deneme bitişi pencerede (ödeyenler de listelenir, access=paid)
  trialEndingSoon: OpsRow[]; // sonraki pencere içinde bitecek, henüz ödememiş
  totals: { users: number; paid: number; trialActive: number; signups7d: number };
}

function grantLive(status?: string | null, endsAt?: string | null, hasStripe = false, now = Date.now()): boolean {
  if (!LIVE.includes(String(status || '').toLowerCase())) return false;
  if (!endsAt) return hasStripe;
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return hasStripe;
  return end > now - GRACE_DAYS * DAY;
}
function utcMs(iso?: string | null): number | null {
  if (!iso) return null;
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

export function buildOpsReport(input: OpsInput, opts: { now?: number; windowMs?: number } = {}): OpsReport {
  const now = opts.now ?? Date.now();
  const win = opts.windowMs ?? 12 * 3600_000;
  const from = now - win;
  const prof = new Map<string, OpsProfile>();
  for (const p of input.profiles) if (p.email) prof.set(p.email.toLowerCase().trim(), p);
  const subByUser = new Map<string, OpsSub>();
  for (const s of input.subs) if (s.userId && ['active', 'trialing'].includes(String(s.status || '').toLowerCase())) subByUser.set(String(s.userId), s);

  const rows: Array<OpsRow & { createdMs: number; endMs: number }> = [];
  const seen = new Set<string>();
  for (const u of input.users) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const createdMs = Date.parse(u.createdAt);
    if (!Number.isFinite(createdMs)) continue;
    const p = prof.get(email);
    const endMs = utcMs(p?.trialEndsAt) ?? createdMs + TRIAL_DAYS * DAY;
    const sub = u.id ? subByUser.get(String(u.id)) : undefined;
    const paid = grantLive(p?.subscriptionStatus, p?.subscriptionEnd, false, now) || (sub ? grantLive(sub.status, sub.currentPeriodEnd, !!sub.stripeSubscriptionId, now) : false);
    const access: AccessKind = paid ? 'paid' : endMs > now ? 'trial' : 'expired';
    const seenMs = p?.lastSeenAt ? Date.parse(p.lastSeenAt) : NaN;
    rows.push({
      email, name: u.name || null, method: u.passwordHash ? 'password' : 'google', createdAt: new Date(createdMs).toISOString(), trialEndsAt: new Date(endMs).toISOString(),
      access, lastSeenAt: p?.lastSeenAt ?? null, firstMatchViewAt: p?.firstMatchViewAt ?? null, returned: Number.isFinite(seenMs) && seenMs - createdMs > 3600_000,
      createdMs, endMs,
    });
  }
  const strip = (r: OpsRow & { createdMs: number; endMs: number }): OpsRow => { const { createdMs: _c, endMs: _e, ...rest } = r; return rest; };
  const byCreatedDesc = (a: { createdMs: number }, b: { createdMs: number }) => b.createdMs - a.createdMs;
  const byEndAsc = (a: { endMs: number }, b: { endMs: number }) => a.endMs - b.endMs;
  return {
    now: new Date(now).toISOString(), from: new Date(from).toISOString(), to: new Date(now).toISOString(),
    newSignups: rows.filter((r) => r.createdMs >= from && r.createdMs < now).sort(byCreatedDesc).map(strip),
    trialEnded: rows.filter((r) => r.endMs >= from && r.endMs < now).sort(byEndAsc).map(strip),
    trialEndingSoon: rows.filter((r) => r.endMs >= now && r.endMs < now + win && r.access !== 'paid').sort(byEndAsc).map(strip),
    totals: {
      users: rows.length,
      paid: rows.filter((r) => r.access === 'paid').length,
      trialActive: rows.filter((r) => r.access === 'trial').length,
      signups7d: rows.filter((r) => r.createdMs >= now - 7 * DAY).length,
    },
  };
}

// ---- Metin (Türkçe; alıcı site sahibi) --------------------------------------
const TZ = 'Europe/Zurich';
const fmt = (iso: string | null | undefined, withDate = true) => {
  if (!iso) return '–';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, ...(withDate ? { day: '2-digit', month: 'short' } : {}), hour: '2-digit', minute: '2-digit' }).format(d).replace(',', '');
};
const ACCESS_TR: Record<AccessKind, string> = { paid: 'ödeyen / erişimli', trial: 'deneme sürüyor', expired: 'deneme bitti' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function opsReportSubject(r: OpsReport): string {
  const when = fmt(r.now);
  return `Ops raporu ${when} · ${r.newSignups.length} yeni kayıt · ${r.trialEnded.length} deneme bitti`;
}

export function opsReportText(r: OpsReport): string {
  const L: string[] = [];
  L.push(`Ops raporu · ${fmt(r.now)} (Zürih) · pencere ${fmt(r.from)} → ${fmt(r.to)}`);
  L.push('');
  L.push(`YENİ KAYITLAR (${r.newSignups.length})`);
  if (!r.newSignups.length) L.push('  — yok');
  for (const x of r.newSignups) L.push(`  ${fmt(x.createdAt)}  ${x.email}${x.name ? ` (${x.name})` : ''}  ·  ${x.method}  ·  son görülme ${fmt(x.lastSeenAt)}  ·  ilk maç ${fmt(x.firstMatchViewAt)}  ·  ${ACCESS_TR[x.access]}`);
  L.push('');
  L.push(`DENEMESİ BİTENLER (${r.trialEnded.length})`);
  if (!r.trialEnded.length) L.push('  — yok');
  for (const x of r.trialEnded) L.push(`  bitiş ${fmt(x.trialEndsAt)}  ${x.email}${x.name ? ` (${x.name})` : ''}  ·  kayıt ${fmt(x.createdAt)}  ·  ${x.access === 'paid' ? 'PRO’YA GEÇTİ' : 'dönmedi'}  ·  son görülme ${fmt(x.lastSeenAt)}  ·  geri geldi ${x.returned ? 'evet' : 'hayır'}`);
  L.push('');
  L.push(`SONRAKİ 12 SAATTE BİTECEK (${r.trialEndingSoon.length})`);
  if (!r.trialEndingSoon.length) L.push('  — yok');
  for (const x of r.trialEndingSoon) L.push(`  bitiş ${fmt(x.trialEndsAt)}  ${x.email}  ·  son görülme ${fmt(x.lastSeenAt)}  ·  ilk maç ${fmt(x.firstMatchViewAt)}`);
  L.push('');
  L.push(`TOPLAM: ${r.totals.users} üye · ${r.totals.paid} ödeyen/erişimli · ${r.totals.trialActive} aktif deneme · son 7 gün ${r.totals.signups7d} kayıt`);
  return L.join('\n');
}

export function opsReportHtml(r: OpsReport): string {
  const th = 'text-align:left;padding:6px 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0';
  const td = 'padding:6px 8px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:top';
  const who = (x: OpsRow) => `${esc(x.email)}${x.name ? `<br><span style="color:#64748b">${esc(x.name)}</span>` : ''}`;
  const table = (heads: string[], rows: string[][]) => rows.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 20px"><tr>${heads.map((h) => `<th style="${th}">${h}</th>`).join('')}</tr>${rows.map((cells) => `<tr>${cells.map((c) => `<td style="${td}">${c}</td>`).join('')}</tr>`).join('')}</table>`
    : `<p style="color:#64748b;font-size:13px;margin:4px 0 20px">— yok</p>`;
  const h3 = (t: string, n: number) => `<h3 style="margin:18px 0 4px;font-size:15px">${t} <span style="color:#64748b;font-weight:500">(${n})</span></h3>`;
  const badge = (x: OpsRow) => x.access === 'paid' ? '<span style="color:#059669;font-weight:600">PRO</span>' : x.access === 'trial' ? '<span style="color:#2563eb">deneme</span>' : '<span style="color:#dc2626">bitti</span>';
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 4px">Ops raporu</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 14px">${fmt(r.now)} Zürih · pencere ${fmt(r.from)} → ${fmt(r.to)}</p>
    ${h3('Yeni kayıtlar', r.newSignups.length)}
    ${table(['Kayıt', 'Kim', 'Yöntem', 'Son görülme', 'İlk maç', 'Durum'], r.newSignups.map((x) => [fmt(x.createdAt), who(x), x.method, fmt(x.lastSeenAt), fmt(x.firstMatchViewAt), badge(x)]))}
    ${h3('Denemesi bitenler', r.trialEnded.length)}
    ${table(['Bitiş', 'Kim', 'Kayıt', 'Sonuç', 'Son görülme', 'Geri geldi'], r.trialEnded.map((x) => [fmt(x.trialEndsAt), who(x), fmt(x.createdAt), x.access === 'paid' ? '<span style="color:#059669;font-weight:600">Pro’ya geçti</span>' : '<span style="color:#dc2626">dönmedi</span>', fmt(x.lastSeenAt), x.returned ? 'evet' : 'hayır']))}
    ${h3('Sonraki 12 saatte bitecek', r.trialEndingSoon.length)}
    ${table(['Bitiş', 'Kim', 'Son görülme', 'İlk maç'], r.trialEndingSoon.map((x) => [fmt(x.trialEndsAt), who(x), fmt(x.lastSeenAt), fmt(x.firstMatchViewAt)]))}
    <p style="font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:8px">
      <strong>${r.totals.users}</strong> üye · <strong>${r.totals.paid}</strong> ödeyen/erişimli · <strong>${r.totals.trialActive}</strong> aktif deneme · son 7 gün <strong>${r.totals.signups7d}</strong> kayıt
    </p>
    <p style="font-size:11px;color:#94a3b8">Erişim kuralı accessControl ile aynı: profiles süresi geçmemiş active/trialing, Stripe aboneliği veya kayıt denemesi. Manuel uzun süreli erişim (ör. 2099) “ödeyen/erişimli” sayılır.</p>
  </div>`;
}
