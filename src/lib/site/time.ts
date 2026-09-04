import { DEFAULT_TIME_ZONE } from '@/i18n/routing';

/** Parts of an instant in a given IANA zone. */
function partsIn(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(date)) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset (ms) of `timeZone` from UTC at `date`. */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUtc - date.getTime();
}

/** Start of the calendar day `yyyy-mm-dd` in `timeZone`, as a UTC instant. */
export function zonedStartOfDay(ymd: string, timeZone = DEFAULT_TIME_ZONE): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // Two passes handle DST transitions on the day itself.
  let t = guess.getTime() - offsetMs(guess, timeZone);
  t = guess.getTime() - offsetMs(new Date(t), timeZone);
  return new Date(t);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Today's `yyyy-mm-dd` in `timeZone`. */
export function todayYmd(timeZone = DEFAULT_TIME_ZONE): string {
  const p = partsIn(new Date(), timeZone);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** `yyyy-mm-dd` of an instant in `timeZone`. */
export function ymdOf(date: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  const p = partsIn(new Date(date), timeZone);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
