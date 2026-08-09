'use client';

// ============================================================================
// MyAnalyses — kullanıcının kendi analiz geçmişi ("dün analiz ettiğim maçı
// bulamıyorum" çözümü). /api/me/analyses'ten okur, güne göre gruplar
// (Bugün / Dün / tarih) ve tek tıkla maç sayfasına geri götürür.
// Geçmiş boşsa hiç render edilmez — yeni kullanıcıya gürültü yok.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ChevronRight } from 'lucide-react';
import { SectionHeader } from '@/components/ui';
import { displayLeague } from '@/lib/league-names';
import { countryInfo } from '@/lib/countries';

interface HistoryRow {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeId: number | null;
  awayId: number | null;
  league: string;
  leagueCcode: string;
  matchDate: string | null;
  analyzedAt: string;
}

const STR: Record<string, { title: string; subtitle: string; today: string; yesterday: string; empty: string }> = {
  tr: {
    title: 'Analizlerim',
    subtitle: 'Analiz ettiğin maçlar — tıkla, analize geri dön',
    today: 'Bugün', yesterday: 'Dün', empty: '',
  },
  en: {
    title: 'My analyses',
    subtitle: 'Matches you analysed — click to reopen the analysis',
    today: 'Today', yesterday: 'Yesterday', empty: '',
  },
  de: {
    title: 'Meine Analysen',
    subtitle: 'Von dir analysierte Spiele — klicken, um zur Analyse zurückzukehren',
    today: 'Heute', yesterday: 'Gestern', empty: '',
  },
};

const LOCALE: Record<string, string> = { tr: 'tr-TR', de: 'de-DE', en: 'en-US' };

export default function MyAnalyses({ lang = 'tr', limit = 12 }: { lang?: string; limit?: number }) {
  const t = STR[lang] || STR.en;
  const locale = LOCALE[lang] || LOCALE.en;
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/analyses?limit=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setRows(d.analyses || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (rows.length === 0) return null;

  // Güne göre grupla (analyzedAt yerel gün)
  const dayKey = (iso: string) => new Date(iso).toDateString();
  const todayKey = new Date().toDateString();
  const yesterdayKey = new Date(Date.now() - 86_400_000).toDateString();
  const groups: { label: string; items: HistoryRow[] }[] = [];
  const visible = expanded ? rows : rows.slice(0, limit);
  for (const r of visible) {
    const k = dayKey(r.analyzedAt);
    const label =
      k === todayKey ? t.today
      : k === yesterdayKey ? t.yesterday
      : new Date(r.analyzedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(r);
    else groups.push({ label, items: [r] });
  }

  return (
    <section className="mb-12">
      <SectionHeader icon={<History size={18} />} title={t.title} subtitle={t.subtitle} />
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 overflow-hidden">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              {g.label}
            </div>
            {g.items.map((r) => {
              const flag = countryInfo(r.leagueCcode)?.flag;
              const league = displayLeague(r.league);
              const time = new Date(r.analyzedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
              return (
                <Link
                  key={r.fixtureId}
                  href={`/match/${r.fixtureId}?home=${encodeURIComponent(r.homeTeam)}&away=${encodeURIComponent(r.awayTeam)}&homeId=${r.homeId ?? ''}&awayId=${r.awayId ?? ''}&league=${encodeURIComponent(r.league || '')}&date=${encodeURIComponent(r.matchDate || '')}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white/85 truncate">
                      <span className="font-medium">{r.homeTeam}</span>
                      <span className="text-white/35 mx-1.5">–</span>
                      <span className="font-medium">{r.awayTeam}</span>
                    </div>
                    <div className="text-xs text-white/35 truncate">
                      {flag ? `${flag} ` : ''}{league || ''}{league ? ' · ' : ''}{time}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-white/25 group-hover:text-brand-400 transition-colors" />
                </Link>
              );
            })}
          </div>
        ))}
        {rows.length > limit && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 py-2.5 text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-white/[0.03] transition-colors text-center"
          >
            {expanded
              ? (lang === 'tr' ? 'Daha az göster' : lang === 'de' ? 'Weniger anzeigen' : 'Show less')
              : (lang === 'tr' ? `Tümünü göster (${rows.length})` : lang === 'de' ? `Alle anzeigen (${rows.length})` : `Show all (${rows.length})`)}
          </button>
        )}
      </div>
    </section>
  );
}
