// ============================================================================
// SABAH RAPORU (2026-11-02) — kişiye özel günlük dönüş e-postası.
// ----------------------------------------------------------------------------
// Neden: son 14 günde 58 kayıt → 35 maç açtı → ertesi gün dönen 7 (%12).
// Deneme mailleri modeli anlatıyor; kullanıcının kendisiyle ilgili tek satır yok.
// Bu mail üç kişisel parçadan oluşur, hiçbiri yoksa GÖNDERİLMEZ (spam değil):
//   1) dün baktığın maç nasıl bitti (site_match_views, maça açılıştan sonra sonuç)
//   2) bugün takımın oynuyor (site_watchlist + motor görüşü)
//   3) günün tek seçimi (site_daily_picks; yalnız 1 ya da 2 varsa eklenir)
// Saf modül: veri route'tan gelir (api/cron/morning-brief), burada yalnız
// seçim ve metin. İngilizce (site varsayılanı, deneme mailleriyle aynı).
// ============================================================================

export type Pick12 = '1' | 'X' | '2' | null;
export type ViewedOutcome = 'won' | 'lost' | 'void' | 'nopick' | 'pending';

export interface BriefViewed {
  fixtureId: number;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  leagueName: string;
  pick: Pick12;
  confidence: number | null;
  outcome: ViewedOutcome;
}
export interface BriefClubMatch {
  teamId: number;
  teamName: string;
  fixtureId: number;
  homeName: string;
  awayName: string;
  kickoff: string;
  leagueName: string;
  hasModel: boolean;
  pick: Pick12;
  confidence: number | null;
}
export interface BriefPick {
  fixtureId: number;
  homeName: string;
  awayName: string;
  market: string;
  selection: string;
  modelP: number;
  odds: number;
  kickoff: string;
}
export interface BriefUrls { site: string; dashboard: string; telegram: string; unsubscribe: string; play?: string }
export interface BriefInput {
  name: string | null;
  viewed: BriefViewed[];
  clubs: BriefClubMatch[];
  pick: BriefPick | null;
  /** deneme sürüyorsa kalan gün; ödeyen için null */
  trialDaysLeft: number | null;
  urls: BriefUrls;
}
export interface Brief { subject: string; title: string; sub: string; body: string; text: string }

export const BRIEF_CAMPAIGN_PREFIX = 'morning-brief-';
/** Günün log anahtarı: kişi başı günde tek gönderim (email_campaign_log UNIQUE). */
export const briefCampaignKey = (ymd: string) => `${BRIEF_CAMPAIGN_PREFIX}${ymd}`;
/** "Dün baktığın" penceresi: görüntüleme bu kadar eski olabilir (cron 07 UTC → önceki sabahtan beri). */
export const VIEW_WINDOW_MS = 36 * 3600_000;
/** "Bugün oynuyor" penceresi: başlangıç şu andan en fazla bu kadar ileride. */
export const CLUB_WINDOW_MS = 24 * 3600_000;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (p: number | null) => (p == null ? '' : `${Math.round(p * 100)}%`);
const hhmm = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(d)} UTC`;
};

export function pickLabel(p: Pick12, homeName: string, awayName: string): string {
  return p === '1' ? homeName : p === '2' ? awayName : p === 'X' ? 'Draw' : 'no favourite';
}
export function marketLabel(market: string, selection: string): string {
  if (market === 'btts') return `Both teams to score · ${selection === 'no' ? 'No' : 'Yes'}`;
  if (market === 'ou25') return `${selection === 'under' ? 'Under' : 'Over'} 2.5 goals`;
  if (market === 'x12') return selection === 'X' ? 'Draw' : selection === '1' ? 'Home win' : 'Away win';
  return `${market} · ${selection}`;
}
const verdict = (o: ViewedOutcome) => (o === 'won' ? 'hit' : o === 'lost' ? 'missed' : o === 'nopick' ? 'no call' : 'void');

/** Konu satırı: en kişisel parça öne. Dışa açık (test). */
export function briefSubject(i: BriefInput): string {
  const v = i.viewed[0];
  const c = i.clubs[0];
  const more = i.viewed.length > 1 ? ` (+${i.viewed.length - 1} more)` : '';
  if (v && c) return `${c.teamName} play today · yesterday's ${v.homeName}–${v.awayName} ended ${v.homeScore}–${v.awayScore}`;
  if (v) {
    const call = v.outcome === 'won' || v.outcome === 'lost' ? ` — the model's call ${verdict(v.outcome)}` : ' — result inside';
    return `${v.homeName} ${v.homeScore}–${v.awayScore} ${v.awayName}${call}${more}`;
  }
  if (c) return i.clubs.length > 1 ? `${c.teamName} and ${i.clubs[1].teamName} play today — the model's view` : `${c.teamName} play today — the model's view`;
  return '';
}

/** Kişisel içerik yoksa null: o gün mail yok. */
export function buildMorningBrief(i: BriefInput): Brief | null {
  if (!i.viewed.length && !i.clubs.length) return null;
  const hi = i.name ? ` ${esc(i.name)}` : '';
  const u = i.urls;
  const matchUrl = (id: number) => `${u.site}/predictions/${id}`;
  const H: string[] = [];
  const T: string[] = [];

  H.push(`<p>Hi${hi}, here is your morning brief — only the matches that are yours.</p>`);
  T.push(`Hi${i.name ? ` ${i.name}` : ''}, here is your morning brief.`);

  if (i.viewed.length) {
    H.push(`<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#6ee7b7;text-transform:uppercase;margin:18px 0 8px">Yesterday — the matches you opened</div>`);
    T.push('', 'YESTERDAY — the matches you opened');
    for (const v of i.viewed) {
      const call = v.pick ? `${pickLabel(v.pick, v.homeName, v.awayName)}${v.confidence != null ? ` ${pct(v.confidence)}` : ''}` : 'no favourite';
      const res = verdict(v.outcome);
      const color = v.outcome === 'won' ? '#059669' : v.outcome === 'lost' ? '#dc2626' : '#64748b';
      H.push(`<div style="background:#0d0f14;border:1px solid #1e2430;border-radius:12px;padding:14px 16px;margin:0 0 10px">
        <div style="font-size:12px;color:#9aa3b2">${esc(v.leagueName)}</div>
        <div style="font-size:17px;font-weight:700;color:#e7eaf0;margin:4px 0">${esc(v.homeName)} <span style="color:#6ee7b7">${v.homeScore}–${v.awayScore}</span> ${esc(v.awayName)}</div>
        <div style="font-size:13px;color:#9aa3b2">Model call: ${esc(call)} · <span style="color:${color};font-weight:600">${res}</span> · <a href="${matchUrl(v.fixtureId)}" style="color:#6ee7b7">see the breakdown</a></div>
      </div>`);
      T.push(`  ${v.homeName} ${v.homeScore}-${v.awayScore} ${v.awayName} (${v.leagueName}) · model call: ${call} · ${res} · ${matchUrl(v.fixtureId)}`);
    }
  }

  if (i.clubs.length) {
    H.push(`<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#6ee7b7;text-transform:uppercase;margin:18px 0 8px">Today — your club</div>`);
    T.push('', 'TODAY — your club');
    for (const c of i.clubs) {
      const view = c.hasModel ? `Model: ${pickLabel(c.pick, c.homeName, c.awayName)}${c.confidence != null ? ` ${pct(c.confidence)}` : ''}` : 'Model view publishes closer to kick-off';
      H.push(`<div style="background:#0d0f14;border:1px solid #1e2430;border-radius:12px;padding:14px 16px;margin:0 0 10px">
        <div style="font-size:12px;color:#9aa3b2">${esc(c.leagueName)} · ${hhmm(c.kickoff)}</div>
        <div style="font-size:17px;font-weight:700;color:#e7eaf0;margin:4px 0">${esc(c.homeName)} – ${esc(c.awayName)}</div>
        <div style="font-size:13px;color:#9aa3b2">${esc(view)} · <a href="${matchUrl(c.fixtureId)}" style="color:#6ee7b7">open the match</a></div>
      </div>`);
      T.push(`  ${c.homeName} - ${c.awayName} (${c.leagueName}, ${hhmm(c.kickoff)}) · ${view} · ${matchUrl(c.fixtureId)}`);
    }
  }

  if (i.pick) {
    const p = i.pick;
    H.push(`<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#6ee7b7;text-transform:uppercase;margin:18px 0 8px">Today's pick — validated goal-market rule</div>
      <p style="margin:0 0 6px"><strong>${esc(p.homeName)} – ${esc(p.awayName)}</strong> · ${hhmm(p.kickoff)}<br>
      <span style="color:#64748b">${esc(marketLabel(p.market, p.selection))} · model ${pct(p.modelP)} · odds ${p.odds.toFixed(2)}</span> · <a href="${matchUrl(p.fixtureId)}" style="color:#059669">open</a></p>`);
    T.push('', `TODAY'S PICK: ${p.homeName} - ${p.awayName} (${hhmm(p.kickoff)}) · ${marketLabel(p.market, p.selection)} · model ${pct(p.modelP)} · odds ${p.odds.toFixed(2)} · ${matchUrl(p.fixtureId)}`);
  }

  H.push(`<p style="text-align:center;margin:22px 0"><a href="${u.dashboard}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">Open today's dashboard →</a></p>`);
  T.push('', `Dashboard: ${u.dashboard}`);
  if (i.trialDaysLeft != null) {
    const d = i.trialDaysLeft;
    H.push(`<p style="font-size:13px;color:#64748b;text-align:center">Your trial: ${d <= 0 ? 'last day' : `${d} day${d === 1 ? '' : 's'} left`}. Everything stays unlocked until then.</p>`);
    T.push(`Trial: ${d <= 0 ? 'last day' : `${d} day(s) left`}.`);
  }
  H.push(`<p style="font-size:12px;color:#94a3b8;text-align:center">Daily picks also go out on <a href="${u.telegram}" style="color:#94a3b8">Telegram</a>${u.play ? ` · <a href="${u.play}" style="color:#94a3b8">Android app</a>` : ''}.</p>`);
  T.push(`Telegram: ${u.telegram}${u.play ? `\nAndroid app: ${u.play}` : ''}`, `Unsubscribe: ${u.unsubscribe}`);

  const dayTitle = i.viewed.length && i.clubs.length ? 'Your result, your club' : i.viewed.length ? 'How your match ended' : `${i.clubs[0].teamName} play today`;
  return { subject: briefSubject(i), title: dayTitle, sub: 'Morning brief · only your matches', body: H.join('\n'), text: T.join('\n') };
}

/** Canary için örnek girdi: sahibin şablonu görmesi (gerçek veri yoksa). */
export const SAMPLE_BRIEF_INPUT: Omit<BriefInput, 'urls'> = {
  name: 'Serkan',
  viewed: [{ fixtureId: 1, homeName: 'Arsenal', awayName: 'Chelsea', homeScore: 2, awayScore: 1, leagueName: 'Premier League', pick: '1', confidence: 0.58, outcome: 'won' }],
  clubs: [{ teamId: 1, teamName: 'Galatasaray', fixtureId: 2, homeName: 'Galatasaray', awayName: 'Fenerbahçe', kickoff: new Date(Date.now() + 8 * 3600_000).toISOString(), leagueName: 'Süper Lig', hasModel: true, pick: '1', confidence: 0.52 }],
  pick: { fixtureId: 3, homeName: 'Bayern', awayName: 'Dortmund', market: 'ou25', selection: 'over', modelP: 0.71, odds: 1.55, kickoff: new Date(Date.now() + 10 * 3600_000).toISOString() },
  trialDaysLeft: 4,
};
