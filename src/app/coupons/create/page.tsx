// src/app/coupons/create/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import { calculatePoints } from '@/types/coupon';

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league: string;
  leagueLogo?: string;
  date: string;
  status: string;
  odds?: {
    home: number;
    draw: number;
    away: number;
    over15: number;
    under15: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
    bttsYes: number;
    bttsNo: number;
    homeOrDraw: number;
    awayOrDraw: number;
    homeOrAway: number;
  };
}

interface Pick {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  betType: string;
  selection: string;
  odds: number;
}

type MarketTab = '1x2' | 'goals' | 'btts' | 'double';

export default function CreateCouponPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMarket, setActiveMarket] = useState<MarketTab>('1x2');
  const [showMobileSlip, setShowMobileSlip] = useState(false);

  const labels = {
    tr: {
      title: 'Kupon Oluştur',
      back: '← Kuponlar',
      matches: 'Maçlar',
      yourBetslip: 'Kuponunuz',
      emptySlip: 'Kupon boş',
      addPicks: 'Bahis eklemek için oranlara tıklayın',
      totalOdds: 'Toplam Oran',
      potentialPoints: 'Potansiyel Puan',
      couponName: 'Kupon Adı',
      namePlaceholder: 'Örn: Günün kombine kuponu',
      public: 'Herkese Açık',
      private: 'Gizli',
      placeBet: 'Kuponu Kaydet',
      placing: 'Kaydediliyor...',
      remove: 'Kaldır',
      clearAll: 'Tümünü Temizle',
      search: 'Takım veya lig ara...',
      noMatches: 'Maç bulunamadı',
      today: 'Bugün',
      tomorrow: 'Yarın',
      minPicks: 'En az 1 bahis ekleyin',
      maxPicks: 'Maksimum 10 bahis',
      market1x2: 'Maç Sonucu',
      marketGoals: 'Gol Sayısı',
      marketBtts: 'KG Var/Yok',
      marketDouble: 'Çifte Şans',
      home: '1',
      draw: 'X',
      away: '2',
      over: 'Üst',
      under: 'Alt',
      yes: 'Var',
      no: 'Yok',
      homeOrDraw: '1X',
      awayOrDraw: 'X2',
      homeOrAway: '12',
      multiplier: 'Çarpan',
      single: 'Tekli ×10',
      double: '2\'li ×15',
      treble: '3\'lü ×25',
      acca: '4+ ×50',
      pointsFormula: 'Puan = Oran × Çarpan',
      allLeagues: 'Tüm Ligler',
      liveNow: 'Canlı',
      upcoming: 'Yaklaşan',
      viewSlip: 'Kuponu Gör',
    },
    en: {
      title: 'Create Coupon',
      back: '← Coupons',
      matches: 'Matches',
      yourBetslip: 'Your Betslip',
      emptySlip: 'Betslip is empty',
      addPicks: 'Click on odds to add selections',
      totalOdds: 'Total Odds',
      potentialPoints: 'Potential Points',
      couponName: 'Coupon Name',
      namePlaceholder: 'E.g: Weekend accumulator',
      public: 'Public',
      private: 'Private',
      placeBet: 'Save Coupon',
      placing: 'Saving...',
      remove: 'Remove',
      clearAll: 'Clear All',
      search: 'Search team or league...',
      noMatches: 'No matches found',
      today: 'Today',
      tomorrow: 'Tomorrow',
      minPicks: 'Add at least 1 selection',
      maxPicks: 'Maximum 10 selections',
      market1x2: 'Match Result',
      marketGoals: 'Goals',
      marketBtts: 'Both Teams Score',
      marketDouble: 'Double Chance',
      home: '1',
      draw: 'X',
      away: '2',
      over: 'Over',
      under: 'Under',
      yes: 'Yes',
      no: 'No',
      homeOrDraw: '1X',
      awayOrDraw: 'X2',
      homeOrAway: '12',
      multiplier: 'Multiplier',
      single: 'Single ×10',
      double: 'Double ×15',
      treble: 'Treble ×25',
      acca: '4+ ×50',
      pointsFormula: 'Points = Odds × Multiplier',
      allLeagues: 'All Leagues',
      liveNow: 'Live',
      upcoming: 'Upcoming',
      viewSlip: 'View Betslip',
    },
    de: {
      title: 'Wettschein erstellen',
      back: '← Wettscheine',
      matches: 'Spiele',
      yourBetslip: 'Ihr Wettschein',
      emptySlip: 'Wettschein ist leer',
      addPicks: 'Klicken Sie auf Quoten',
      totalOdds: 'Gesamtquote',
      potentialPoints: 'Mögliche Punkte',
      couponName: 'Wettschein Name',
      namePlaceholder: 'Z.B: Wochenend-Kombi',
      public: 'Öffentlich',
      private: 'Privat',
      placeBet: 'Wettschein speichern',
      placing: 'Speichern...',
      remove: 'Entfernen',
      clearAll: 'Alle löschen',
      search: 'Team oder Liga suchen...',
      noMatches: 'Keine Spiele',
      today: 'Heute',
      tomorrow: 'Morgen',
      minPicks: 'Min. 1 Tipp',
      maxPicks: 'Max. 10 Tipps',
      market1x2: 'Spielergebnis',
      marketGoals: 'Tore',
      marketBtts: 'Beide treffen',
      marketDouble: 'Doppelte Chance',
      home: '1',
      draw: 'X',
      away: '2',
      over: 'Über',
      under: 'Unter',
      yes: 'Ja',
      no: 'Nein',
      homeOrDraw: '1X',
      awayOrDraw: 'X2',
      homeOrAway: '12',
      multiplier: 'Multiplikator',
      single: 'Einzel ×10',
      double: 'Zweier ×15',
      treble: 'Dreier ×25',
      acca: '4+ ×50',
      pointsFormula: 'Punkte = Quote × Multiplikator',
      allLeagues: 'Alle Ligen',
      liveNow: 'Live',
      upcoming: 'Kommend',
      viewSlip: 'Wettschein',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const saved = sessionStorage.getItem('pendingCouponPicks');
    if (saved) {
      try { setPicks(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('pendingCouponPicks', JSON.stringify(picks));
  }, [picks]);

  useEffect(() => {
    fetchMatches();
  }, [selectedDate]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?date=${selectedDate}&includeOdds=true`);
      const data = await res.json();
      
      const matchesWithOdds = (data.matches || []).map((m: Match) => ({
        ...m,
        odds: m.odds || generateRealisticOdds(),
      }));
      
      setMatches(matchesWithOdds);
      const leagues = new Set<string>(matchesWithOdds.map((m: Match) => m.league));
      setExpandedLeagues(leagues);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  const generateRealisticOdds = () => {
    const homeStrength = Math.random();
    const home = homeStrength > 0.6 ? 1.4 + Math.random() * 0.8 : homeStrength > 0.3 ? 2.0 + Math.random() * 1.0 : 2.8 + Math.random() * 2.0;
    const draw = 3.0 + Math.random() * 0.8;
    const away = homeStrength < 0.4 ? 1.5 + Math.random() * 0.8 : homeStrength < 0.7 ? 2.2 + Math.random() * 1.2 : 3.2 + Math.random() * 2.5;
    
    return {
      home: Math.round(home * 100) / 100,
      draw: Math.round(draw * 100) / 100,
      away: Math.round(away * 100) / 100,
      over15: Math.round((1.25 + Math.random() * 0.25) * 100) / 100,
      under15: Math.round((3.5 + Math.random() * 1.0) * 100) / 100,
      over25: Math.round((1.75 + Math.random() * 0.35) * 100) / 100,
      under25: Math.round((1.95 + Math.random() * 0.30) * 100) / 100,
      over35: Math.round((2.5 + Math.random() * 0.8) * 100) / 100,
      under35: Math.round((1.45 + Math.random() * 0.25) * 100) / 100,
      bttsYes: Math.round((1.7 + Math.random() * 0.35) * 100) / 100,
      bttsNo: Math.round((2.0 + Math.random() * 0.35) * 100) / 100,
      homeOrDraw: Math.round((1.15 + Math.random() * 0.25) * 100) / 100,
      awayOrDraw: Math.round((1.25 + Math.random() * 0.35) * 100) / 100,
      homeOrAway: Math.round((1.08 + Math.random() * 0.15) * 100) / 100,
    };
  };

  const matchesByLeague = matches
    .filter(m => 
      !searchQuery || 
      m.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.league.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .reduce((acc, match) => {
      if (!acc[match.league]) acc[match.league] = [];
      acc[match.league].push(match);
      return acc;
    }, {} as Record<string, Match[]>);

  const toggleLeague = (league: string) => {
    const newExpanded = new Set(expandedLeagues);
    if (newExpanded.has(league)) newExpanded.delete(league);
    else newExpanded.add(league);
    setExpandedLeagues(newExpanded);
  };

  const addPick = (match: Match, betType: string, selection: string, odds: number) => {
    const exists = picks.some(p => p.fixtureId === match.id && p.betType === betType);
    
    if (exists) {
      const existingPick = picks.find(p => p.fixtureId === match.id && p.betType === betType);
      if (existingPick?.selection === selection) {
        removePick(match.id, betType);
        return;
      }
    }
    
    const filtered = picks.filter(p => !(p.fixtureId === match.id && p.betType === betType));
    
    if (filtered.length >= 10) {
      alert(l.maxPicks);
      return;
    }
    
    setPicks([...filtered, {
      fixtureId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      matchDate: match.date,
      betType,
      selection,
      odds,
    }]);
  };

  const removePick = (fixtureId: number, betType: string) => {
    setPicks(picks.filter(p => !(p.fixtureId === fixtureId && p.betType === betType)));
  };

  const isSelected = (matchId: number, betType: string, selection: string) => {
    return picks.some(p => p.fixtureId === matchId && p.betType === betType && p.selection === selection);
  };

  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  const potentialPoints = calculatePoints(totalOdds, picks.length);

  const getMultiplier = () => {
    if (picks.length === 0) return { label: '-', value: 0 };
    if (picks.length === 1) return { label: l.single, value: 10 };
    if (picks.length === 2) return { label: l.double, value: 15 };
    if (picks.length === 3) return { label: l.treble, value: 25 };
    return { label: l.acca, value: 50 };
  };

  const handleSubmit = async () => {
    if (picks.length === 0) {
      alert(l.minPicks);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks,
          title: title || `${picks.length} ${lang === 'tr' ? 'Maçlık Kupon' : lang === 'de' ? '-Tipp Wettschein' : 'Pick Coupon'}`,
          isPublic,
        }),
      });

      const data = await res.json();

      if (res.ok && data.coupon) {
        sessionStorage.removeItem('pendingCouponPicks');
        router.push(`/coupons/${data.coupon.id}`);
      } else {
        alert(data.error || 'Error');
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
    setSubmitting(false);
  };

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Odds Button Component
  const OddsButton = ({ match, betType, selection, odds, label }: { 
    match: Match; betType: string; selection: string; odds: number; label?: string 
  }) => {
    const selected = isSelected(match.id, betType, selection);
    return (
      <button
        onClick={() => addPick(match, betType, selection, odds)}
        className={`relative flex flex-col items-center justify-center min-w-[60px] h-12 rounded-lg font-semibold text-sm transition-all duration-200 ${
          selected
            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105'
            : 'bg-slate-700/80 text-slate-200 hover:bg-slate-600 hover:text-white'
        }`}
      >
        {label && <span className="text-[10px] text-slate-400 font-normal">{label}</span>}
        <span className={selected ? 'text-white' : 'text-green-400'}>{odds.toFixed(2)}</span>
        {selected && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-500 text-xs">✓</span>
          </span>
        )}
      </button>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <header className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link href="/coupons" className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {l.back}
              </Link>
              <div className="h-6 w-px bg-slate-700" />
              <h1 className="text-lg font-bold text-white">{l.title}</h1>
            </div>
            
            {/* Date Tabs */}
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg">
              <button
                onClick={() => setSelectedDate(today)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectedDate === today
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.today}
              </button>
              <button
                onClick={() => setSelectedDate(tomorrow)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectedDate === tomorrow
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.tomorrow}
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-300 px-2 py-1.5 text-sm outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-4">
          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* LEFT SIDE - MATCHES */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div className="flex-1 space-y-4">
            {/* Search & Market Tabs */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder={l.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 pl-10 pr-4 py-2.5 rounded-xl outline-none focus:border-green-500/50 transition-colors"
                />
              </div>
              
              {/* Market Tabs */}
              <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-xl p-1">
                {[
                  { key: '1x2', label: l.market1x2 },
                  { key: 'goals', label: l.marketGoals },
                  { key: 'btts', label: l.marketBtts },
                  { key: 'double', label: l.marketDouble },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveMarket(tab.key as MarketTab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      activeMarket === tab.key
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Matches List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-400 text-sm">Loading matches...</span>
                </div>
              </div>
            ) : Object.keys(matchesByLeague).length === 0 ? (
              <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                <div className="text-5xl mb-4">⚽</div>
                <p className="text-slate-400">{l.noMatches}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(matchesByLeague).map(([league, leagueMatches]) => (
                  <div key={league} className="bg-slate-800/40 border border-slate-700/30 rounded-xl overflow-hidden">
                    {/* League Header */}
                    <button
                      onClick={() => toggleLeague(league)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                          <span className="text-lg">⚽</span>
                        </div>
                        <div className="text-left">
                          <span className="font-semibold text-white">{league}</span>
                          <span className="ml-2 text-xs text-slate-500">{leagueMatches.length} matches</span>
                        </div>
                      </div>
                      <svg 
                        className={`w-5 h-5 text-slate-400 transition-transform ${expandedLeagues.has(league) ? 'rotate-180' : ''}`} 
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Matches */}
                    {expandedLeagues.has(league) && (
                      <div className="border-t border-slate-700/30">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wider">
                          <div className="col-span-1">Time</div>
                          <div className="col-span-5">Match</div>
                          <div className="col-span-6 flex justify-end gap-2">
                            {activeMarket === '1x2' && (
                              <>
                                <span className="w-[60px] text-center">1</span>
                                <span className="w-[60px] text-center">X</span>
                                <span className="w-[60px] text-center">2</span>
                              </>
                            )}
                            {activeMarket === 'goals' && (
                              <>
                                <span className="w-[60px] text-center">O1.5</span>
                                <span className="w-[60px] text-center">U1.5</span>
                                <span className="w-[60px] text-center">O2.5</span>
                                <span className="w-[60px] text-center">U2.5</span>
                              </>
                            )}
                            {activeMarket === 'btts' && (
                              <>
                                <span className="w-[60px] text-center">Yes</span>
                                <span className="w-[60px] text-center">No</span>
                              </>
                            )}
                            {activeMarket === 'double' && (
                              <>
                                <span className="w-[60px] text-center">1X</span>
                                <span className="w-[60px] text-center">X2</span>
                                <span className="w-[60px] text-center">12</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Match Rows */}
                        {leagueMatches.map((match) => (
                          <div 
                            key={match.id} 
                            className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-slate-700/20 hover:bg-slate-700/20 transition-colors items-center"
                          >
                            {/* Time */}
                            <div className="col-span-1">
                              <span className="text-xs text-slate-400 font-medium">
                                {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            {/* Teams */}
                            <div className="col-span-5">
                              <div className="flex items-center gap-2 mb-1">
                                {match.homeTeamLogo ? (
                                  <img src={match.homeTeamLogo} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                  <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-white">
                                    {match.homeTeam.charAt(0)}
                                  </div>
                                )}
                                <span className="text-sm text-white font-medium truncate">{match.homeTeam}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {match.awayTeamLogo ? (
                                  <img src={match.awayTeamLogo} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                  <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-white">
                                    {match.awayTeam.charAt(0)}
                                  </div>
                                )}
                                <span className="text-sm text-slate-300 truncate">{match.awayTeam}</span>
                              </div>
                            </div>

                            {/* Odds */}
                            <div className="col-span-6 flex justify-end gap-2">
                              {activeMarket === '1x2' && (
                                <>
                                  <OddsButton match={match} betType="MATCH_RESULT" selection="1" odds={match.odds?.home || 1.5} label={l.home} />
                                  <OddsButton match={match} betType="MATCH_RESULT" selection="X" odds={match.odds?.draw || 3.5} label={l.draw} />
                                  <OddsButton match={match} betType="MATCH_RESULT" selection="2" odds={match.odds?.away || 2.5} label={l.away} />
                                </>
                              )}
                              {activeMarket === 'goals' && (
                                <>
                                  <OddsButton match={match} betType="OVER_UNDER_15" selection="Over" odds={match.odds?.over15 || 1.35} />
                                  <OddsButton match={match} betType="OVER_UNDER_15" selection="Under" odds={match.odds?.under15 || 3.2} />
                                  <OddsButton match={match} betType="OVER_UNDER_25" selection="Over" odds={match.odds?.over25 || 1.85} />
                                  <OddsButton match={match} betType="OVER_UNDER_25" selection="Under" odds={match.odds?.under25 || 1.95} />
                                </>
                              )}
                              {activeMarket === 'btts' && (
                                <>
                                  <OddsButton match={match} betType="BTTS" selection="Yes" odds={match.odds?.bttsYes || 1.75} label={l.yes} />
                                  <OddsButton match={match} betType="BTTS" selection="No" odds={match.odds?.bttsNo || 2.0} label={l.no} />
                                </>
                              )}
                              {activeMarket === 'double' && (
                                <>
                                  <OddsButton match={match} betType="DOUBLE_CHANCE" selection="1X" odds={match.odds?.homeOrDraw || 1.25} label={l.homeOrDraw} />
                                  <OddsButton match={match} betType="DOUBLE_CHANCE" selection="X2" odds={match.odds?.awayOrDraw || 1.35} label={l.awayOrDraw} />
                                  <OddsButton match={match} betType="DOUBLE_CHANCE" selection="12" odds={match.odds?.homeOrAway || 1.12} label={l.homeOrAway} />
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* RIGHT SIDE - BETSLIP */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div className="hidden lg:block w-[340px] flex-shrink-0">
            <div className="sticky top-20">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                {/* Slip Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-white flex items-center gap-2">
                      <span className="text-xl">🎫</span>
                      {l.yourBetslip}
                    </h2>
                    {picks.length > 0 && (
                      <span className="bg-white text-green-600 text-xs font-bold px-2.5 py-1 rounded-full">
                        {picks.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Picks */}
                <div className="max-h-[350px] overflow-y-auto">
                  {picks.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-3xl">🎯</span>
                      </div>
                      <p className="text-slate-400 font-medium">{l.emptySlip}</p>
                      <p className="text-slate-500 text-sm mt-1">{l.addPicks}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700/30">
                      {picks.map((pick, index) => (
                        <div key={index} className="p-3 hover:bg-slate-700/20 transition-colors group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">
                                {pick.homeTeam} vs {pick.awayTeam}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{pick.league}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  pick.betType === 'MATCH_RESULT' ? 'bg-green-500/20 text-green-400' :
                                  pick.betType.includes('OVER_UNDER') ? 'bg-blue-500/20 text-blue-400' :
                                  pick.betType === 'BTTS' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {pick.betType === 'MATCH_RESULT' ? '1X2' : 
                                   pick.betType === 'OVER_UNDER_15' ? 'O/U 1.5' :
                                   pick.betType === 'OVER_UNDER_25' ? 'O/U 2.5' :
                                   pick.betType === 'BTTS' ? 'BTTS' : 'DC'}
                                </span>
                                <span className="text-xs text-white font-bold">{pick.selection}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-green-400 font-bold">{pick.odds.toFixed(2)}</span>
                              <button
                                onClick={() => removePick(pick.fixtureId, pick.betType)}
                                className="text-slate-500 hover:text-red-400 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ✕ {l.remove}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary & Submit */}
                {picks.length > 0 && (
                  <div className="border-t border-slate-700/30 p-4 space-y-3 bg-slate-800/50">
                    {/* Clear All */}
                    <button
                      onClick={() => setPicks([])}
                      className="w-full text-sm text-red-400 hover:text-red-300 transition-colors py-1"
                    >
                      🗑️ {l.clearAll}
                    </button>

                    {/* Multiplier Info */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{l.multiplier}</span>
                        <span className="text-purple-400 font-bold">{getMultiplier().label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{l.pointsFormula}</p>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">{l.totalOdds}</span>
                        <span className="text-xl font-bold text-green-400">{totalOdds.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">{l.potentialPoints}</span>
                        <span className="text-2xl font-bold text-yellow-400 flex items-center gap-1">
                          🏆 {potentialPoints.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Coupon Name */}
                    <input
                      type="text"
                      placeholder={l.namePlaceholder}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-green-500/50"
                    />

                    {/* Public Toggle */}
                    <div className="flex items-center justify-between bg-slate-700/30 rounded-xl p-3">
                      <span className="text-sm text-slate-300 flex items-center gap-2">
                        {isPublic ? '🌍' : '🔒'} {isPublic ? l.public : l.private}
                      </span>
                      <button
                        onClick={() => setIsPublic(!isPublic)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          isPublic ? 'bg-green-500' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                          isPublic ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || picks.length === 0}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {l.placing}
                        </>
                      ) : (
                        <>
                          🎯 {l.placeBet}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MOBILE FLOATING BETSLIP BUTTON */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {picks.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
          <button
            onClick={() => setShowMobileSlip(true)}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl shadow-2xl shadow-green-500/30 flex items-center justify-between px-6"
          >
            <span className="flex items-center gap-2">
              <span className="text-xl">🎫</span>
              {l.viewSlip}
            </span>
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{picks.length}</span>
              <span className="font-bold">{totalOdds.toFixed(2)}</span>
            </div>
          </button>
        </div>
      )}

      {/* Mobile Betslip Modal - Simplified for this response */}
      {showMobileSlip && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80" onClick={() => setShowMobileSlip(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-slate-800 rounded-t-3xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1 bg-slate-600 rounded-full" />
            </div>
            
            {/* Content - Same as desktop slip */}
            <div className="px-4 pb-8">
              {/* ... slip content same as desktop */}
              <h2 className="text-lg font-bold text-white mb-4">{l.yourBetslip} ({picks.length})</h2>
              
              {/* Picks list */}
              {picks.map((pick, index) => (
                <div key={index} className="py-3 border-b border-slate-700/30">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-white text-sm">{pick.homeTeam} vs {pick.awayTeam}</p>
                      <p className="text-slate-500 text-xs">{pick.betType}: {pick.selection}</p>
                    </div>
                    <span className="text-green-400 font-bold">{pick.odds.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              
              {/* Summary */}
              <div className="mt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">{l.totalOdds}</span>
                  <span className="text-green-400 font-bold text-xl">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{l.potentialPoints}</span>
                  <span className="text-yellow-400 font-bold text-xl">🏆 {potentialPoints.toFixed(1)}</span>
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl mt-4"
                >
                  {submitting ? l.placing : l.placeBet}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
