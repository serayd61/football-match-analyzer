'use client';

// ============================================================================
// DailyPicks — "Kanıt Döngüsü": Dünün Karnesi (public) + Bugünün Seçimleri
// (Pro). Dönüşümün kalbi: kullanıcı dünün tarih damgalı, ayıklanmamış sonuç
// listesini görür (kaybedenler dahil — kanıt), bugünün seçimlerinin sayısını
// ve ilk maç saatini görür ama içerik kilitlidir (FOMO). Kaynak:
// /api/v2/daily-picks. Veri yoksa (karne boş + bugün seçim yok) hiç render
// edilmez — boş kutu göstermez.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, Lock, Clock, Check, X, Trophy, ArrowRight, Sparkles,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui';
import { displayLeague } from '@/lib/league-names';

interface Pick {
  fixtureId: number;
  leagueId: number; leagueName: string;
  homeId: number; homeName: string;
  awayId: number; awayName: string;
  kickoff: string;
  pick: string; confidence: number | null;
  homeScore: number | null; awayScore: number | null;
  result: string | null; correct: boolean | null;
  rationale?: string | null;
}

interface DailyPicksData {
  ok: boolean;
  yesterday: { date: string | null; picks: Pick[]; total: number; correct: number; accuracy: number };
  today: { count: number; firstKickoff: string | null; locked: boolean; picks: Pick[] };
  worldCup: { total: number; correct: number };
}

const STR = {
  tr: {
    sectionTitle: 'Günlük kanıt döngüsü',
    sectionSubtitle: 'Motorun dünkü karnesi açık — bugünün seçimleri hazır',
    receiptTitle: 'Dünün karnesi',
    receiptSummary: (total: number, correct: number, acc: number) =>
      `${total} seçimden ${correct} doğru · %${acc}`,
    receiptEmpty: 'Karne, maçlar sonuçlandıkça burada yayınlanır.',
    receiptNote: 'Tarih damgalı, ayıklanmamış liste — kaybedenler dahil.',
    todayTitle: 'Bugünün seçimleri',
    todayCount: (n: number) => `${n} yüksek güvenli seçim hazır`,
    todayEmpty: 'Motor şu an yeni seçim üretiyor — maçlar yaklaştıkça burada listelenir.',
    firstMatch: 'İlk maç',
    inHours: (h: number) => (h <= 0 ? 'birazdan' : h === 1 ? '1 saat sonra' : `${h} saat sonra`),
    lockedCta: (n: number) => `Dünün karnesi ortada — bugünün ${n} seçimi kilitli.`,
    unlock: "Pro ile aç",
    viewAll: 'Tüm tahminleri gör',
    pickLabel: 'Seçim',
    conf: 'güven',
    draw: 'Beraberlik',
    wcRecord: (c: number, t: number) => `Motorun Dünya Kupası karnesi: ${t} seçimde ${c} doğru`,
    locale: 'tr-TR',
  },
  en: {
    sectionTitle: 'Daily proof loop',
    sectionSubtitle: "Yesterday's receipt is public — today's picks are ready",
    receiptTitle: "Yesterday's receipt",
    receiptSummary: (total: number, correct: number, acc: number) =>
      `${correct} of ${total} picks correct · ${acc}%`,
    receiptEmpty: 'The receipt is published here as matches get settled.',
    receiptNote: 'Timestamped, unfiltered list — losses included.',
    todayTitle: "Today's picks",
    todayCount: (n: number) => `${n} high-confidence picks ready`,
    todayEmpty: 'The engine is generating new picks — they appear here as matches approach.',
    firstMatch: 'First match',
    inHours: (h: number) => (h <= 0 ? 'soon' : h === 1 ? 'in 1 hour' : `in ${h} hours`),
    lockedCta: (n: number) => `Yesterday's receipt is public — today's ${n} picks are locked.`,
    unlock: 'Unlock with Pro',
    viewAll: 'View all predictions',
    pickLabel: 'Pick',
    conf: 'conf.',
    draw: 'Draw',
    wcRecord: (c: number, t: number) => `Engine's World Cup record: ${c} of ${t} picks correct`,
    locale: 'en-US',
  },
  de: {
    sectionTitle: 'Täglicher Beweis-Loop',
    sectionSubtitle: 'Die gestrige Bilanz ist öffentlich — die heutigen Tipps stehen bereit',
    receiptTitle: 'Bilanz von gestern',
    receiptSummary: (total: number, correct: number, acc: number) =>
      `${correct} von ${total} Tipps richtig · ${acc}%`,
    receiptEmpty: 'Die Bilanz erscheint hier, sobald Spiele abgerechnet sind.',
    receiptNote: 'Zeitgestempelte, ungefilterte Liste — Verluste inklusive.',
    todayTitle: 'Heutige Tipps',
    todayCount: (n: number) => `${n} Tipps mit hoher Konfidenz bereit`,
    todayEmpty: 'Die Engine erstellt neue Tipps — sie erscheinen hier, sobald Spiele näher rücken.',
    firstMatch: 'Erstes Spiel',
    inHours: (h: number) => (h <= 0 ? 'in Kürze' : h === 1 ? 'in 1 Stunde' : `in ${h} Stunden`),
    lockedCta: (n: number) => `Die gestrige Bilanz ist öffentlich — die heutigen ${n} Tipps sind gesperrt.`,
    unlock: 'Mit Pro freischalten',
    viewAll: 'Alle Vorhersagen ansehen',
    pickLabel: 'Tipp',
    conf: 'Konf.',
    draw: 'Unentschieden',
    wcRecord: (c: number, t: number) => `WM-Bilanz der Engine: ${c} von ${t} Tipps richtig`,
    locale: 'de-DE',
  },
};

function pickLabel(p: Pick, drawLabel: string): string {
  return p.pick === '1' ? p.homeName : p.pick === '2' ? p.awayName : drawLabel;
}

export default function DailyPicks({ lang = 'tr' }: { lang?: string }) {
  const t = (STR as any)[lang] || STR.en;
  const [data, setData] = useState<DailyPicksData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v2/daily-picks', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Veri yokken (yüklenirken de) hiç yer kaplama — dashboard zıplamasın
  if (loading || !data) return null;
  const { yesterday, today, worldCup } = data;
  if (yesterday.total === 0 && today.count === 0) return null;

  const dateStr = yesterday.date
    ? new Date(`${yesterday.date}T12:00:00Z`).toLocaleDateString(t.locale, {
        day: 'numeric', month: 'long',
      })
    : '';
  const firstKo = today.firstKickoff ? new Date(today.firstKickoff) : null;
  const hoursToFirst = firstKo
    ? Math.max(0, Math.round((firstKo.getTime() - Date.now()) / 3_600_000))
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mb-12"
    >
      <SectionHeader
        icon={<ClipboardCheck size={18} />}
        title={t.sectionTitle}
        subtitle={t.sectionSubtitle}
      />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* --- DÜNÜN KARNESİ (herkese açık kanıt) --- */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ClipboardCheck size={15} className="text-brand-300" /> {t.receiptTitle}
            </h3>
            {dateStr && <span className="text-xs text-white/40">{dateStr}</span>}
          </div>

          {yesterday.total > 0 ? (
            <>
              <div className="text-lg font-bold text-brand-300 mb-3">
                {t.receiptSummary(yesterday.total, yesterday.correct, yesterday.accuracy)}
              </div>
              <div className="space-y-1.5">
                {yesterday.picks.map((p) => (
                  <div
                    key={p.fixtureId}
                    className="flex items-center gap-2 text-xs rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-2"
                  >
                    {p.correct ? (
                      <Check size={14} className="text-brand-400 shrink-0" />
                    ) : (
                      <X size={14} className="text-red-400/80 shrink-0" />
                    )}
                    <span className="text-white/80 truncate flex-1 min-w-0">
                      {p.homeName} – {p.awayName}
                      <span className="text-white/35 ml-1.5 hidden sm:inline">
                        {displayLeague(p.leagueName, p.leagueId)}
                      </span>
                    </span>
                    <span className="text-white/50 shrink-0 max-w-[90px] truncate">
                      {pickLabel(p, t.draw)}
                    </span>
                    <span className="font-bold text-white shrink-0 tabular-nums">
                      {p.homeScore}–{p.awayScore}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/35 mt-3">{t.receiptNote}</p>
            </>
          ) : (
            <p className="text-sm text-white/50 py-4">{t.receiptEmpty}</p>
          )}

          {worldCup.total > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-amber-300/90">
              <Trophy size={13} className="shrink-0" />
              {t.wcRecord(worldCup.correct, worldCup.total)}
            </div>
          )}
        </div>

        {/* --- BUGÜNÜN SEÇİMLERİ (Pro'da açık, free'de kilitli) --- */}
        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles size={15} className="text-brand-300" /> {t.todayTitle}
            </h3>
            {firstKo && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Clock size={12} />
                {t.firstMatch}:{' '}
                {firstKo.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}
                {hoursToFirst != null && ` · ${t.inHours(hoursToFirst)}`}
              </span>
            )}
          </div>

          {today.count === 0 ? (
            <p className="text-sm text-white/50 py-4">{t.todayEmpty}</p>
          ) : today.locked ? (
            <>
              <div className="text-lg font-bold text-white mb-3">{t.todayCount(today.count)}</div>
              {/* Blur silueti — arkada gerçek liste olduğunu hissettirir, veri sızdırmaz */}
              <div aria-hidden className="space-y-1.5 blur-[6px] opacity-40 select-none pointer-events-none">
                {Array.from({ length: Math.min(today.count, 5) }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/5 px-2.5 py-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-white/20 shrink-0" />
                    <div className="h-3 rounded bg-white/20" style={{ width: `${55 - i * 6}%` }} />
                    <div className="h-3 w-10 rounded bg-brand-400/40 ml-auto" />
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-white/60 mb-3">{t.lockedCta(today.count)}</p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:opacity-90 transition-opacity"
                >
                  <Lock size={14} /> {t.unlock}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-white mb-3">{t.todayCount(today.count)}</div>
              <div className="space-y-1.5">
                {today.picks.map((p) => (
                  <div
                    key={p.fixtureId}
                    className="flex items-center gap-2 text-xs rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-2"
                  >
                    <span className="text-white/40 shrink-0 tabular-nums">
                      {new Date(p.kickoff).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-white/80 truncate flex-1 min-w-0">
                      {p.homeName} – {p.awayName}
                      <span className="text-white/35 ml-1.5 hidden sm:inline">
                        {displayLeague(p.leagueName, p.leagueId)}
                      </span>
                    </span>
                    <span className="font-semibold text-brand-300 shrink-0 max-w-[110px] truncate">
                      {pickLabel(p, t.draw)}
                    </span>
                    <span className="text-white/50 shrink-0 tabular-nums">
                      {p.confidence != null ? `${Math.round(p.confidence * 100)}%` : '–'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <Link
                  href="/tahminler"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-400 hover:text-brand-300 transition-colors"
                >
                  {t.viewAll} <ArrowRight size={14} />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}
