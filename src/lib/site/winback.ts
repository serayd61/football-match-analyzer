// ============================================================================
// Geri kazanım serisi (win-back) — alıcı seçimi (saf, test edilir). 2026-11-14
// ----------------------------------------------------------------------------
// Neden: 29 Eki–14 Kas arası 103 kayıt, denemesi biten 76 üyeden deneme sonrası
// görülen 6. Deneme bitince giden tek mail `ended` (bitişten sonraki 2 gün,
// lib/site/trial-emails.ts); sonrasında üyeye hiçbir şey gitmiyordu.
//
// Kural (kullanıcı kararı 2026-11-14: "3 günde bir, o günün ücretsiz maçları ve
// Google Play'de satın almanın açıldığı haberi"):
//   - kime    : denemesi bitmiş, abone olmayan, unsubscribe etmemiş üye
//   - ne zaman: bitişten 3 gün sonra başlar (ilk 2 gün `ended` mailinin),
//               sonra kişi başına 3 günde bir
//   - kaç kez : en çok WINBACK_MAX_STEPS (5) → 15 günde biter. Süresiz gönderim
//               spam şikâyeti ve gönderen itibarı riskidir; son mail bunun son
//               olduğunu söyler.
//   - eski    : seri yalnız son WINBACK_MAX_AGE_DAYS (120) günde biten denemeler
//               için BAŞLAR; başlamış seri yaş sınırını geçse de tamamlanır.
//   - öncelik : denemesi en yeni biten önce (günlük parti sınırına takılan
//               eski hesaplar ertesi güne kalır).
// Günün ücretsiz maçı yoksa (milli ara) yalnız 1. adım, maçsız şablonla gider; sonraki
// adımlar maç olan ilk günü bekler (2026-11-15) — route karar verir.
//
// Dedup: email_campaign_log (campaign_key,email) UNIQUE; adım başına ayrı anahtar
// `winback-2026-11:s{n}`. Kişinin adımı = logdaki en yüksek adım + 1, son gönderim
// zamanı = logdaki en yeni sent_at (başarısız deneme de sayılır: aynı adrese
// art arda denenmez).
// ============================================================================
import { trialEndOf, type TrialUser } from '@/lib/site/trial-emails';

export const WINBACK_CAMPAIGN = 'winback-2026-11';
export const WINBACK_KEY_PREFIX = `${WINBACK_CAMPAIGN}:s`;
export const winbackKey = (step: number) => `${WINBACK_KEY_PREFIX}${step}`;
export const WINBACK_MAX_STEPS = 5;
export const WINBACK_EVERY_DAYS = 3;
export const WINBACK_START_AFTER_DAYS = 3;
export const WINBACK_MAX_AGE_DAYS = 120;
/** Cron her gün aynı saatte koşar, gönderim birkaç dakika sürer: "3 gün" eşiği yarım gün toleranslı. */
const TOLERANCE_DAYS = 0.5;
const DAY = 86_400_000;

export interface WinbackLogRow { email: string; campaign_key: string; sent_at?: string | null }
export interface WinbackHistory { steps: number; lastAt: number }
export interface WinbackRecipient { email: string; name: string | null; step: number; daysSinceEnd: number }

/** Postgres `timestamp` (saat dilimsiz) UTC'dir; `Date.parse` onu yerel saat sanmasın. */
export function parseTs(s: string | null | undefined): number {
  if (!s) return NaN;
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  return Date.parse(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(iso) ? iso : `${iso}Z`);
}

/** Log satırlarından kişi başı durum. Zamanı okunamayan satır "şimdi gönderildi" sayılır (güvenli taraf). */
export function winbackHistory(rows: WinbackLogRow[], now = Date.now()): Map<string, WinbackHistory> {
  const out = new Map<string, WinbackHistory>();
  for (const r of rows) {
    if (!r.campaign_key?.startsWith(WINBACK_KEY_PREFIX)) continue;
    const step = parseInt(r.campaign_key.slice(WINBACK_KEY_PREFIX.length), 10);
    if (!Number.isFinite(step) || step < 1) continue;
    const email = String(r.email || '').toLowerCase().trim();
    if (!email) continue;
    const at = parseTs(r.sent_at);
    const h = out.get(email) ?? { steps: 0, lastAt: 0 };
    h.steps = Math.max(h.steps, step);
    h.lastAt = Math.max(h.lastAt, Number.isFinite(at) ? at : now);
    out.set(email, h);
  }
  return out;
}

export function selectWinbackRecipients(users: TrialUser[], history: Map<string, WinbackHistory>, opts: {
  now?: number; unsubscribed?: Set<string>; exclude?: Set<string>;
  maxSteps?: number; everyDays?: number; startAfterDays?: number; maxAgeDays?: number;
} = {}): WinbackRecipient[] {
  const now = opts.now ?? Date.now();
  const maxSteps = opts.maxSteps ?? WINBACK_MAX_STEPS;
  const every = opts.everyDays ?? WINBACK_EVERY_DAYS;
  const startAfter = opts.startAfterDays ?? WINBACK_START_AFTER_DAYS;
  const maxAge = opts.maxAgeDays ?? WINBACK_MAX_AGE_DAYS;
  const out: WinbackRecipient[] = [];
  const seen = new Set<string>();
  for (const u of users) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    if (opts.unsubscribed?.has(email) || opts.exclude?.has(email)) continue;
    const st = (u.subscriptionStatus || '').toLowerCase();
    if (['active', 'trialing', 'trial', 'past_due'].includes(st)) continue;
    if (!Number.isFinite(Date.parse(u.createdAt))) continue;
    const end = trialEndOf(u);
    const sinceEnd = (now - end) / DAY;
    if (!(sinceEnd >= startAfter)) continue; // deneme sürüyor ya da `ended` penceresinde
    const h = history.get(email);
    const step = (h?.steps ?? 0) + 1;
    if (step > maxSteps) continue;
    if (h) {
      if ((now - h.lastAt) / DAY < every - TOLERANCE_DAYS) continue;
    } else if (sinceEnd > maxAge) continue; // çok eski hesapta seri başlamaz
    seen.add(email);
    out.push({ email, name: u.name || null, step, daysSinceEnd: Math.floor(sinceEnd) });
  }
  return out.sort((a, b) => a.daysSinceEnd - b.daysSinceEnd);
}

/**
 * Günün ücretsiz maçı olmayan gün kime gönderilir: yalnız 1. adım (maçsız şablon).
 * 2.–5. adımdakiler bekler; adımları tüketilmez, maç olan ilk gün sıraları gelir.
 */
export function splitNoMatchDay(recipients: WinbackRecipient[]): { send: WinbackRecipient[]; waiting: number } {
  const send = recipients.filter((r) => r.step === 1);
  return { send, waiting: recipients.length - send.length };
}
