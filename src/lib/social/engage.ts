// X etkileşim paketi (sunucu): günün maçlarını oku, büyük 3'ü seç, dünkü paketin
// sonuçlarını ekle, kullanıcıya Telegram özel mesajı gönder. Kayıt: social_posts kind=pack.
import 'server-only';
import { dbFresh as db } from '@/lib/site/db';
import { fetchPredictionsForDay } from '@/lib/site/predictions';
import { todayYmd, addDays } from '@/lib/site/time';
import { hasTelegram, sendMessage } from './telegram';
import { packMessage, pickBigMatches, type EngageMatch } from './engage-content';

const TABLE = 'social_posts';
export const adminChat = () => (process.env.TELEGRAM_ADMIN_CHAT || '').trim() || null;

async function matchesFor(day: string, onlyIds?: number[]): Promise<EngageMatch[]> {
  const rows = await fetchPredictionsForDay(day);
  return rows
    .filter((p) => p.hasModel && (!onlyIds || onlyIds.includes(p.fixtureId)))
    .map((p) => ({
      fixtureId: p.fixtureId, leagueSlug: p.league?.slug ?? null, leagueName: p.leagueName, homeName: p.homeName, awayName: p.awayName, kickoff: p.kickoff,
      pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway,
      pOver: p.overUnder ? (p.overUnder.pick === 'over' ? p.overUnder.pRaw : 1 - p.overUnder.pRaw) : null,
      pBtts: p.btts ? (p.btts.pick === 'yes' ? p.btts.pRaw : 1 - p.btts.pRaw) : null,
      homeScore: p.homeScore, awayScore: p.awayScore,
    }));
}

export async function sendEngagementPack(opts: { day?: string; dry?: boolean } = {}) {
  const day = opts.day ?? todayYmd();
  const chat = adminChat();
  if (!chat || !hasTelegram()) return { ok: false, day, note: 'TELEGRAM_ADMIN_CHAT ya da bot token yok' };
  const key = `pack|${day}|telegram|admin`;
  const { data: prev } = await db().from(TABLE).select('key, status').eq('key', key).eq('status', 'posted');
  if (!opts.dry && prev?.length) return { ok: true, day, status: 'already' };
  const today = pickBigMatches((await matchesFor(day)).filter((m) => Date.parse(m.kickoff) > Date.now() - 60 * 60_000), 3);
  const yday = addDays(day, -1);
  const { data: yrow } = await db().from(TABLE).select('fixture_ids').eq('key', `pack|${yday}|telegram|admin`).maybeSingle();
  const yIds = ((yrow as any)?.fixture_ids ?? []).map(Number);
  const yesterday = yIds.length ? await matchesFor(yday, yIds) : [];
  const text = packMessage(day, today, yesterday);
  if (opts.dry) return { ok: true, day, dry: true, matches: today.map((m) => `${m.homeName} – ${m.awayName}`), followUps: yesterday.length, text };
  const r = await sendMessage(chat, text);
  await db().from(TABLE).upsert({ key, kind: 'pack', day, platform: 'telegram', account: 'en', fixture_ids: today.map((m) => m.fixtureId), post_id: r.ok ? r.id : null, parent_id: null, body: text, status: r.ok ? 'posted' : 'failed', error: r.ok ? null : r.error }, { onConflict: 'key' });
  return { ok: r.ok, day, status: r.ok ? 'posted' : 'failed', error: r.ok ? undefined : r.error, matches: today.map((m) => `${m.homeName} – ${m.awayName}`), followUps: yesterday.length };
}
