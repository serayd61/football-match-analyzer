'use client';

// ============================================================================
// MatchIntelligence — "Match Intelligence Layer" gösterimi.
// İstatistik tahmini (LLM DEĞİL) + Dolphin news_digest + çok dilli preview.
// ⚠️ Salt okuma: /api/match-intelligence (CACHE). Senkron Dolphin çağrısı YOK.
// engine_predictions/EnginePredictions ile aynı erişim deseni (401/403 gate).
// Dil seçici TR/EN/DE — seçilen dile göre preview_* gösterilir.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Clock, Newspaper, Activity, AlertTriangle, ChevronUp,
  RefreshCw, Lock, Crown, Languages, Info, Brain,
} from 'lucide-react';

type Lang = 'tr' | 'en' | 'de';

interface StatsPrediction {
  pHome?: number; pDraw?: number; pAway?: number;
  pOver25?: number; pBttsYes?: number;
  lambdaHome?: number; lambdaAway?: number;
  topScores?: { score: string; p: number }[];
  source?: string;
}
interface NewsItem { team?: string; player?: string; status?: string }
interface NewsDigest {
  injuries?: NewsItem[]; suspensions?: NewsItem[];
  form_notes?: string[]; key_facts?: string[]; as_of?: string;
}
export interface MatchIntel {
  matchId: number;
  leagueId: number | null; leagueName: string | null;
  homeId: number | null; homeName: string | null; homeCrest?: string | null;
  awayId: number | null; awayName: string | null; awayCrest?: string | null;
  kickoff: string | null;
  statsPrediction: StatsPrediction | null;
  newsDigest: NewsDigest | null;
  preview: { tr: string | null; en: string | null; de: string | null };
  previewDeProvider: string | null;
  confidence: string | null;
  updatedAt: string | null;
}

const pct = (x?: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`);

const STR = {
  tr: {
    analyze: 'Analiz Et', close: 'Kapat',
    title: 'Match Intelligence', home: 'Ev sahibi', draw: 'Beraberlik', away: 'Deplasman',
    over: 'Üst 2.5', btts: 'KG Var', stats: 'İstatistik tahmini', news: 'Haber özeti',
    preview: 'Maç önizlemesi', injuries: 'Sakatlıklar', suspensions: 'Cezalılar',
    facts: 'Öne çıkanlar', none: 'yok', why: 'Detay', noData: 'Henüz veri yok',
    empty: 'Şu an gösterilecek önizleme yok. Gece güncellemesiyle otomatik eklenir.',
    loading: 'Yükleniyor...', locale: 'tr-TR', updated: 'Güncellendi',
    disclaimer: 'Bu içerik yalnızca bilgilendirme amaçlıdır, bahis tavsiyesi değildir. Olasılıklar istatistik modelinden gelir; metinler yapay zekâ ile üretilmiştir.',
    statsNote: 'Olasılıklar istatistik modelinden gelir — yapay zekâ tahmin üretmez.',
    gateAuthTitle: 'Görmek için giriş yapın', gateAuthDesc: 'Match Intelligence yalnızca üyelere açıktır.',
    gateAuthCta: 'Giriş yap / Üye ol', gateSubTitle: 'Aktif abonelik gerekli',
    gateSubDesc: '7 gün ücretsiz deneyin, dilediğiniz zaman iptal edin.', gateSubCta: '7 gün ücretsiz dene',
  },
  en: {
    analyze: 'Analyze', close: 'Close',
    title: 'Match Intelligence', home: 'Home', draw: 'Draw', away: 'Away',
    over: 'Over 2.5', btts: 'BTTS', stats: 'Statistical prediction', news: 'News digest',
    preview: 'Match preview', injuries: 'Injuries', suspensions: 'Suspensions',
    facts: 'Key facts', none: 'none', why: 'Details', noData: 'No data yet',
    empty: 'No previews to show right now. They are added automatically with the nightly update.',
    loading: 'Loading...', locale: 'en-US', updated: 'Updated',
    disclaimer: 'For information only — not betting advice. Probabilities come from a statistical model; texts are AI-generated.',
    statsNote: 'Probabilities come from a statistical model — the AI does not produce predictions.',
    gateAuthTitle: 'Sign in to view', gateAuthDesc: 'Match Intelligence is available to members only.',
    gateAuthCta: 'Sign in / Sign up', gateSubTitle: 'Active subscription required',
    gateSubDesc: 'Try free for 7 days, cancel anytime.', gateSubCta: 'Start 7-day free trial',
  },
  de: {
    analyze: 'Analysieren', close: 'Schliessen',
    title: 'Match Intelligence', home: 'Heim', draw: 'Unentschieden', away: 'Auswärts',
    over: 'Über 2.5', btts: 'BTTS', stats: 'Statistische Vorhersage', news: 'Nachrichten',
    preview: 'Spielvorschau', injuries: 'Verletzungen', suspensions: 'Sperren',
    facts: 'Wichtige Fakten', none: 'keine', why: 'Details', noData: 'Noch keine Daten',
    empty: 'Derzeit keine Vorschauen. Sie werden mit dem nächtlichen Update automatisch ergänzt.',
    loading: 'Wird geladen...', locale: 'de-DE', updated: 'Aktualisiert',
    disclaimer: 'Nur zur Information — keine Wettempfehlung. Wahrscheinlichkeiten stammen aus einem statistischen Modell; Texte sind KI-generiert.',
    statsNote: 'Wahrscheinlichkeiten stammen aus einem statistischen Modell — die KI erstellt keine Vorhersagen.',
    gateAuthTitle: 'Zum Ansehen anmelden', gateAuthDesc: 'Match Intelligence ist nur für Mitglieder verfügbar.',
    gateAuthCta: 'Anmelden / Registrieren', gateSubTitle: 'Aktives Abo erforderlich',
    gateSubDesc: '7 Tage kostenlos testen, jederzeit kündbar.', gateSubCta: '7 Tage kostenlos testen',
  },
};

function TeamLogo({ src, name }: { src?: string | null; name: string }) {
  const [ok, setOk] = useState(true);
  if (!ok || !src) {
    return (
      <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
        {(name || '?').slice(0, 2).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} onError={() => setOk(false)} className="w-9 h-9 object-contain" loading="lazy" />;
}

export default function MatchIntelligence({
  lang = 'tr',
  matchId,
  limit = 12,
}: {
  lang?: string;
  matchId?: number; // verilirse tek maç (maç kartı sekmesi), yoksa yaklaşan liste
  limit?: number;
}) {
  // Önizleme dili — dışarıdan gelen lang varsayılan, kullanıcı değiştirebilir.
  const [viewLang, setViewLang] = useState<Lang>((['tr', 'en', 'de'].includes(lang) ? lang : 'en') as Lang);
  const t = STR[viewLang];

  const [items, setItems] = useState<MatchIntel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(matchId ?? null);
  const [gate, setGate] = useState<null | 'auth' | 'subscription'>(null);

  async function load() {
    setLoading(true);
    try {
      const url = matchId ? `/api/match-intelligence?matchId=${matchId}` : `/api/match-intelligence?limit=${limit}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401) { setGate('auth'); setItems([]); return; }
      if (res.status === 403) { setGate('subscription'); setItems([]); return; }
      const data = await res.json();
      setGate(null);
      setItems(matchId ? (data.item ? [data.item] : []) : (data.items || []));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [matchId, limit]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(a.kickoff || 0).getTime() - new Date(b.kickoff || 0).getTime()),
    [items],
  );

  // Erişim engeli
  if (!loading && gate) {
    const isAuth = gate === 'auth';
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-400/10 border border-brand-400/30 flex items-center justify-center text-brand-300">
          {isAuth ? <Lock size={24} /> : <Crown size={24} />}
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{isAuth ? t.gateAuthTitle : t.gateSubTitle}</h3>
        <p className="text-sm text-white/50 mb-5 max-w-md mx-auto">{isAuth ? t.gateAuthDesc : t.gateSubDesc}</p>
        <Link href={isAuth ? '/login' : '/pricing'}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-500 to-sky-500 hover:opacity-90 transition-opacity">
          {isAuth ? t.gateAuthCta : t.gateSubCta}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Başlık + dil seçici */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Newspaper size={18} className="text-brand-300" />
          <h3 className="text-sm font-bold text-white">{t.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
            <Languages size={13} className="text-white/40 ml-1.5" />
            {(['tr', 'en', 'de'] as Lang[]).map((l) => (
              <button key={l} onClick={() => setViewLang(l)}
                className={`text-[11px] px-2 py-1 rounded-md font-semibold uppercase ${viewLang === l ? 'bg-brand-400/15 text-brand-300' : 'text-white/45 hover:text-white/70'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={load}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40"><RefreshCw className="animate-spin mx-auto mb-3" /> {t.loading}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">{t.empty}</div>
      ) : (
        <div className={matchId ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
          {sorted.map((m, i) => (
            <IntelCard key={m.matchId} m={m} t={t} viewLang={viewLang} i={i}
              open={open === m.matchId} onToggle={() => setOpen(open === m.matchId ? null : m.matchId)} />
          ))}
        </div>
      )}

      {/* Bahis disclaimer'ı — KORUNUR */}
      {!loading && sorted.length > 0 && (
        <div className="mt-5 flex items-start gap-2 text-[11px] text-white/40 border border-white/10 rounded-xl bg-white/[0.02] p-3">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{t.disclaimer}</span>
        </div>
      )}
    </div>
  );
}

function IntelCard({ m, t, viewLang, i, open, onToggle }: {
  m: MatchIntel; t: typeof STR['tr']; viewLang: Lang; i: number; open: boolean; onToggle: () => void;
}) {
  const s = m.statsPrediction || {};
  const d = m.newsDigest;
  const ko = m.kickoff ? new Date(m.kickoff) : null;
  const koStr = ko ? ko.toLocaleString(t.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const previewText = m.preview?.[viewLang] || m.preview?.en || m.preview?.tr || '';

  const injuries = d?.injuries || [];
  const suspensions = d?.suspensions || [];
  const facts = d?.key_facts || [];
  const hasIntel = !!(previewText || d || (s && s.pHome != null));

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.4) }}
      className={`rounded-2xl border bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 transition-colors ${open ? 'border-brand-400/40' : 'border-white/10 hover:border-brand-400/20'}`}>
      {/* başlık */}
      <div className="flex items-center justify-between text-xs text-white/40 mb-3">
        <span className="truncate max-w-[55%]">{m.leagueName || '—'}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {koStr}</span>
      </div>

      {/* takımlar + Analiz Et butonu */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <TeamLogo src={m.homeCrest} name={m.homeName || '?'} />
            <span className="text-[11px] text-center text-white/80 truncate w-full">{m.homeName}</span>
          </div>
          <div className="text-white/30 text-xs font-bold px-1">VS</div>
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <TeamLogo src={m.awayCrest} name={m.awayName || '?'} />
            <span className="text-[11px] text-center text-white/80 truncate w-full">{m.awayName}</span>
          </div>
        </div>
        <button onClick={onToggle}
          className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-colors ${open
            ? 'border-white/15 text-white/60 hover:text-white'
            : 'border-brand-400/40 bg-brand-400/10 text-brand-300 hover:bg-brand-400/20'}`}>
          {open ? (<>{t.close} <ChevronUp size={14} /></>) : (<><Brain size={14} /> {t.analyze}</>)}
        </button>
      </div>

      {/* açılır: tıklamayla o maçın analizi */}
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 border-t border-white/10 pt-4 space-y-3 overflow-hidden">
          {!hasIntel ? (
            <p className="text-xs text-white/40 py-2">{t.noData}</p>
          ) : (
            <>
              {/* istatistik tahmini (LLM DEĞİL) */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1.5">
                  <Activity size={12} className="text-brand-300" /> {t.stats}
                  {s.source && <span className="text-white/25">· {s.source}</span>}
                </div>
                <div className="flex h-2 rounded-full overflow-hidden mb-1">
                  <div style={{ width: `${(s.pHome || 0) * 100}%` }} className="bg-brand-400/70" />
                  <div style={{ width: `${(s.pDraw || 0) * 100}%` }} className="bg-amber-400/70" />
                  <div style={{ width: `${(s.pAway || 0) * 100}%` }} className="bg-sky-500/70" />
                </div>
                <div className="flex justify-between text-[10px] text-white/40 mb-2">
                  <span>1 · {pct(s.pHome)}</span>
                  <span>X · {pct(s.pDraw)}</span>
                  <span>2 · {pct(s.pAway)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">{t.over}: <b className="text-white/80">{pct(s.pOver25)}</b></span>
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">{t.btts}: <b className="text-white/80">{pct(s.pBttsYes)}</b></span>
                </div>
              </div>

              {/* preview (seçili dil) */}
              {previewText && (
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1.5">
                    <Newspaper size={12} className="text-brand-300" /> {t.preview}
                  </div>
                  <p className="text-xs text-white/75 leading-relaxed">{previewText}</p>
                </div>
              )}

              {/* news digest */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1.5">
                  <AlertTriangle size={12} className="text-amber-300/80" /> {t.news}
                  {d?.as_of && <span className="text-white/25">· {new Date(d.as_of).toLocaleDateString(t.locale)}</span>}
                </div>
                {!d ? (
                  <p className="text-[11px] text-white/35">{t.noData}</p>
                ) : (
                  <div className="text-[11px] text-white/60 space-y-1">
                    <p><b className="text-white/70">{t.injuries}:</b>{' '}
                      {injuries.length ? injuries.map((x) => `${x.team || ''} ${x.player || ''}${x.status ? ` (${x.status})` : ''}`).join(', ') : t.none}</p>
                    <p><b className="text-white/70">{t.suspensions}:</b>{' '}
                      {suspensions.length ? suspensions.map((x) => `${x.team || ''} ${x.player || ''}`).join(', ') : t.none}</p>
                    {facts.length > 0 && (
                      <ul className="list-disc list-inside text-white/55">
                        {facts.slice(0, 4).map((f, k) => <li key={k}>{f}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {m.confidence && (
                <div className="text-[11px] text-white/60 border-t border-white/5 pt-2">
                  <b className="text-white/70">Confidence:</b> {m.confidence}
                </div>
              )}
              <p className="text-[10px] text-white/30">{t.statsNote}</p>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
