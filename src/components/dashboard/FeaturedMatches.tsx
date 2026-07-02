'use client';

// ============================================================================
// FeaturedMatches — "kayıt → ilk analiz" köprüsünün kalbi.
// Bugün + yarının öne çıkan maçlarını tek tık "Analiz et" ile /match/[id]'ye
// bağlar. Free kullanıcının 3 günlük analiz hakkını HARCAYACAĞI yer burası.
// Kaynak: /api/v2/fixtures (public, edge-cache'li). Dünya Kupası / uluslararası
// maçlar önceliklidir (sezon arasında da içerik olsun).
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Zap, CalendarOff, RefreshCw } from 'lucide-react';
import { displayLeague } from '@/lib/league-names';

interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  leagueId: number;
  leagueCountry: string;
  date: string;
  status: string;
}

const LOGO = (id: number | null | undefined) =>
  id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '';

// FotMob lig id'leri: 77=Dünya Kupası (klasik), 894789=Dünya Kupası 2026
// (feed'in sezonluk turnuva id'si — prod'da doğrulandı), 42=UCL, 47=PL,
// 87=LaLiga, 55=SerieA, 54=Bundesliga, 53=Ligue1. Düşük öncelik = önce.
const WORLD_CUP_IDS = new Set([77, 894789]);
const TOP_LEAGUE_IDS = new Set([42, 47, 87, 55, 54, 53]);
function priority(f: Fixture): number {
  if (WORLD_CUP_IDS.has(f.leagueId)) return 0;
  if ((f.leagueCountry || '').toUpperCase() === 'INT') return 1; // uluslararası
  if (TOP_LEAGUE_IDS.has(f.leagueId)) return 2;
  return 3;
}

const STR = {
  tr: {
    analyze: 'Analiz et',
    today: 'Bugün', tomorrow: 'Yarın',
    emptyTitle: 'Şu an yaklaşan maç yok',
    emptyDesc: 'Sezon arası olabilir — motor yeni fikstürler açıklandığında burada listeler. Bu arada aşağıdaki örnek analize göz atabilirsin.',
    loading: 'Maçlar yükleniyor...',
    locale: 'tr-TR',
  },
  en: {
    analyze: 'Analyze',
    today: 'Today', tomorrow: 'Tomorrow',
    emptyTitle: 'No upcoming matches right now',
    emptyDesc: 'Could be the off-season break — new fixtures appear here as soon as they are announced. Meanwhile, check the sample analysis below.',
    loading: 'Loading matches...',
    locale: 'en-US',
  },
  de: {
    analyze: 'Analysieren',
    today: 'Heute', tomorrow: 'Morgen',
    emptyTitle: 'Derzeit keine anstehenden Spiele',
    emptyDesc: 'Vermutlich Saisonpause — neue Spiele erscheinen hier, sobald sie angesetzt sind. Schau dir solange die Beispielanalyse unten an.',
    loading: 'Spiele werden geladen...',
    locale: 'de-DE',
  },
};

export default function FeaturedMatches({ lang = 'tr', limit = 6 }: { lang?: string; limit?: number }) {
  const t = (STR as any)[lang] || STR.en;
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date();
        const tomorrow = new Date(Date.now() + 86_400_000);
        const iso = (d: Date) => d.toISOString().split('T')[0];
        const [r1, r2] = await Promise.all([
          fetch(`/api/v2/fixtures?date=${iso(today)}`, { cache: 'no-store' }),
          fetch(`/api/v2/fixtures?date=${iso(tomorrow)}`, { cache: 'no-store' }),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        const all: Fixture[] = [
          ...(d1?.data?.fixtures || d1?.fixtures || []),
          ...(d2?.data?.fixtures || d2?.fixtures || []),
        ];
        // Yalnızca başlamamış maçlar; fixture id'ye göre tekille
        const seen = new Set<number>();
        const upcoming = all.filter((f) => {
          if (f.status !== 'NS' || !f.date || seen.has(f.id)) return false;
          if (new Date(f.date).getTime() <= Date.now()) return false;
          seen.add(f.id);
          return true;
        });
        upcoming.sort((a, b) => {
          const p = priority(a) - priority(b);
          if (p !== 0) return p;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        if (!cancelled) setFixtures(upcoming.slice(0, limit));
      } catch {
        if (!cancelled) setFixtures([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [limit]);

  const dayLabel = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (d: string) => (new Date(d).toDateString() === todayStr ? t.today : t.tomorrow);
  }, [t]);

  if (loading) {
    return (
      <div className="text-center py-12 text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">
        <RefreshCw className="animate-spin mx-auto mb-3" /> {t.loading}
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <CalendarOff size={28} className="mx-auto mb-3 text-white/30" />
        <h3 className="text-base font-semibold text-white mb-1">{t.emptyTitle}</h3>
        <p className="text-sm text-white/50 max-w-md mx-auto">{t.emptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {fixtures.map((f, i) => {
        const ko = new Date(f.date);
        const koStr = ko.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' });
        return (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.3) }}
            className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 hover:border-brand-400/40 transition-colors flex flex-col"
          >
            <div className="flex items-center justify-between text-xs text-white/40 mb-3">
              <span className="truncate max-w-[60%]">{displayLeague(f.league, f.leagueId)}</span>
              <span className="flex items-center gap-1 shrink-0">
                <Clock size={12} /> {dayLabel(f.date)} {koStr}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mb-4 flex-1">
              <TeamCol id={f.homeTeamId} name={f.homeTeam} />
              <div className="text-white/30 text-xs font-bold px-1">VS</div>
              <TeamCol id={f.awayTeamId} name={f.awayTeam} />
            </div>

            <Link
              // Fixture bağlamı query'de taşınır — analyze API takım adı+id ister,
              // match sayfası böylece ek fikstür sorgusu yapmadan analize başlar.
              href={`/match/${f.id}?home=${encodeURIComponent(f.homeTeam)}&away=${encodeURIComponent(f.awayTeam)}&homeId=${f.homeTeamId}&awayId=${f.awayTeamId}&league=${encodeURIComponent(f.league)}&date=${encodeURIComponent(f.date)}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl font-semibold text-sm text-[#06281d] bg-gradient-to-r from-brand-400 to-brand-500 hover:opacity-90 transition-opacity"
            >
              <Zap size={15} /> {t.analyze}
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function TeamCol({ id, name }: { id: number; name: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      {ok && id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO(id)} alt={name} onError={() => setOk(false)}
          className="w-10 h-10 object-contain" loading="lazy" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/70">
          {(name || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="text-xs text-center text-white/80 truncate w-full">{name}</span>
    </div>
  );
}
