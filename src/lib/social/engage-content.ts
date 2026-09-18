// ============================================================================
// X etkileşim paketi (saf) — günün büyük maçları için kopyala-yapıştır yanıtlar.
// ----------------------------------------------------------------------------
// Neden (2026-09-18): X hesabı yeni ve "insan var mı" kısıtında; etiket ve
// otomatik gönderi tek başına erişim getirmiyor. Kullanıcı günde 5 dakika elle
// yanıt yazacak; içerik ve hedef buradan çıkar. Bot bunu kullanıcıya özel
// mesajla gönderir (TELEGRAM_ADMIN_CHAT). Reddit yok (kullanıcı istemedi).
// ============================================================================
import { SITE, tweetLength } from './content';

export interface EngageMatch {
  fixtureId: number; leagueSlug: string | null; leagueName: string; homeName: string; awayName: string; kickoff: string;
  pHome: number; pDraw: number; pAway: number; pOver: number | null; pBtts: number | null;
  homeScore?: number | null; awayScore?: number | null;
}

/** Resmi İngilizce kulüp hesapları (ad parçası → @hesap). Emin olunmayanlar listede yok. */
export const CLUB_HANDLES: [string, string][] = [
  ['Manchester United', '@ManUtd'], ['Manchester City', '@ManCity'], ['Liverpool', '@LFC'], ['Arsenal', '@Arsenal'], ['Chelsea', '@ChelseaFC'],
  ['Tottenham', '@SpursOfficial'], ['Newcastle', '@NUFC'], ['Aston Villa', '@AVFCOfficial'], ['West Ham', '@WestHam'], ['Everton', '@Everton'],
  ['Brighton', '@OfficialBHAFC'], ['Leeds', '@LUFC'], ['Brentford', '@BrentfordFC'], ['Nottingham', '@NFFC'],
  ['Bayern', '@FCBayernEN'], ['Dortmund', '@BlackYellow'], ['Leverkusen', '@bayer04_en'], ['Leipzig', '@RBLeipzig_EN'], ['Frankfurt', '@Eintracht_eng'],
  ['Real Madrid', '@realmadriden'], ['Barcelona', '@FCBarcelona'], ['Atlético', '@atletienglish'], ['Atletico', '@atletienglish'], ['Sevilla', '@SevillaFC_ENG'],
  ['Juventus', '@juventusfcen'], ['Inter', '@Inter_en'], ['Milan', '@acmilan'], ['Napoli', '@en_sscnapoli'], ['Roma', '@OfficialASRoma'],
  ['Paris', '@PSG_English'], ['PSG', '@PSG_English'], ['Marseille', '@OM_English'], ['Monaco', '@AS_Monaco_EN'],
  ['Ajax', '@AFCAjax'], ['PSV', '@PSV'], ['Feyenoord', '@Feyenoord'],
  ['Benfica', '@SLBenfica_en'], ['Porto', '@FCPorto'], ['Sporting', '@SportingCP'],
  ['Galatasaray', '@GalatasaraySK'], ['Fenerbahçe', '@Fenerbahce_EN'], ['Beşiktaş', '@Besiktas_EN'], ['Celtic', '@CelticFC'], ['Rangers', '@RangersFC'],
];
export const LEAGUE_HANDLES: Record<string, string> = {
  'premier-league': '@premierleague', 'la-liga': '@LaLigaEN', 'serie-a': '@SerieA_EN', bundesliga: '@Bundesliga_EN', 'ligue-1': '@Ligue1_ENG',
  eredivisie: '@eredivisie', 'liga-portugal': '@ligaportugal', 'champions-league': '@ChampionsLeague', championship: '@SkyBetChamp',
};
const LEAGUE_WEIGHT: Record<string, number> = { 'premier-league': 5, 'champions-league': 5, 'la-liga': 4, bundesliga: 4, 'serie-a': 3, 'ligue-1': 2, eredivisie: 2, championship: 1, 'liga-portugal': 1, 'super-lig': 1 };

export const clubHandle = (name: string): string | null => CLUB_HANDLES.find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1] ?? null;

/** Maç büyüklüğü: büyük kulüp sayısı ağır basar, lig ağırlığı ikinci, dengeli maç küçük bonus. */
export function matchScore(m: EngageMatch): number {
  const clubs = (clubHandle(m.homeName) ? 1 : 0) + (clubHandle(m.awayName) ? 1 : 0);
  const league = m.leagueSlug ? LEAGUE_WEIGHT[m.leagueSlug] ?? 0 : 0;
  const balance = 1 - Math.abs(m.pHome - m.pAway); // 0..1
  return clubs * 10 + league + balance;
}

export function pickBigMatches(all: EngageMatch[], n = 3): EngageMatch[] {
  return [...all].sort((a, b) => matchScore(b) - matchScore(a) || a.kickoff.localeCompare(b.kickoff)).slice(0, n);
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Hedef hesaplar: lig + iki kulüp (varsa). */
export function targets(m: EngageMatch): string[] {
  const out: string[] = [];
  const l = m.leagueSlug ? LEAGUE_HANDLES[m.leagueSlug] : null; if (l) out.push(l);
  for (const n of [m.homeName, m.awayName]) { const h = clubHandle(n); if (h && !out.includes(h)) out.push(h); }
  return out;
}

/** Maç öncesi yanıt (≤280, link yok: yanıtta link erişimi düşürür). */
export function replyText(m: EngageMatch): string {
  const goals = [m.pOver != null ? `Over 2.5 ${pct(m.pOver)}` : null, m.pBtts != null ? `BTTS ${pct(m.pBtts)}` : null].filter(Boolean).join(' · ');
  let t = `Our Dixon-Coles model on ${m.homeName} v ${m.awayName}: ${m.homeName} ${pct(m.pHome)} · Draw ${pct(m.pDraw)} · ${m.awayName} ${pct(m.pAway)}.${goals ? ` ${goals}.` : ''} Frozen before kick-off, recorded either way.`;
  if (tweetLength(t) > 280) t = `Dixon-Coles model: ${m.homeName} ${pct(m.pHome)} · Draw ${pct(m.pDraw)} · ${m.awayName} ${pct(m.pAway)}.${goals ? ` ${goals}.` : ''} Recorded either way.`;
  return t;
}

export const matchLink = (fixtureId: number) => `${SITE}/en/predictions/${fixtureId}?utm_source=twitter&utm_medium=reply&utm_campaign=engage`;

/** Ertesi gün: sonuç satırı (yanıtın altına yazılır). Skor yoksa null. */
export function followUpText(m: EngageMatch): string | null {
  if (m.homeScore == null || m.awayScore == null) return null;
  const h = m.homeScore, a = m.awayScore;
  const fav = m.pHome >= m.pAway && m.pHome >= m.pDraw ? { name: m.homeName, p: m.pHome, hit: h > a } : m.pAway >= m.pDraw ? { name: m.awayName, p: m.pAway, hit: a > h } : { name: 'Draw', p: m.pDraw, hit: h === a };
  const mark = (ok: boolean) => (ok ? '✓' : '✗');
  const parts = [`${fav.name} ${pct(fav.p)} ${mark(fav.hit)}`];
  if (m.pOver != null) parts.push(`Over 2.5 ${pct(m.pOver)} ${mark(h + a > 2.5 ? m.pOver >= 0.5 : m.pOver < 0.5)}`);
  if (m.pBtts != null) parts.push(`BTTS ${pct(m.pBtts)} ${mark(h > 0 && a > 0 ? m.pBtts >= 0.5 : m.pBtts < 0.5)}`);
  return `Result: ${m.homeName} ${h}-${a} ${m.awayName}. Model had ${parts.join(', ')}. Every call recorded: ${SITE}/en/performance`;
}

export function fmtKick(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Zurich' }).format(new Date(iso));
}

/** Telegram özel mesajı (düz metin). */
export function packMessage(day: string, today: EngageMatch[], yesterday: EngageMatch[]): string {
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const lines: string[] = [`X engagement pack · ${date}`, ''];
  if (!today.length) lines.push('No rated matches today.');
  today.forEach((m, i) => {
    lines.push(`${i + 1}) ${m.homeName} v ${m.awayName} · ${m.leagueName} · ${fmtKick(m.kickoff)} CET`);
    const t = targets(m); if (t.length) lines.push(`Reply under match-day posts of: ${t.join(', ')}`);
    lines.push('Paste:', replyText(m), `Match page: ${matchLink(m.fixtureId)}`, '');
  });
  const fu = yesterday.map(followUpText).filter((s): s is string => !!s);
  if (fu.length) { lines.push("Yesterday's follow-ups (paste under your replies):"); for (const s of fu) lines.push(s, ''); }
  lines.push('5 minutes, then done. Likes and follows on the same accounts help the reach filter.');
  return lines.join('\n').trim();
}
