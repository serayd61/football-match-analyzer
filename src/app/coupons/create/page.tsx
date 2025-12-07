'use client';

import { useState, useEffect } from 'react';
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
  league: string;
  date: string;
  status: string;
  odds?: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
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

  const labels = {
    tr: {
      createCoupon: 'Kupon Oluştur',
      back: '← Geri',
      matches: 'Maçlar',
      yourCoupon: 'Kuponunuz',
      emptySlip: 'Kupon boş',
      addPicks: 'Bahis eklemek için maçlara tıklayın',
      totalOdds: 'Toplam Oran',
      potentialPoints: 'Potansiyel Puan',
      stake: 'Kupon Adı',
      stakePlaceholder: 'Örn: Hafta sonu kombine',
      public: 'Herkese Açık',
      private: 'Gizli',
      placeBet: 'Kuponu Kaydet',
      placing: 'Kaydediliyor...',
      remove: 'Kaldır',
      clearAll: 'Tümünü Temizle',
      search: 'Takım ara...',
      noMatches: 'Maç bulunamadı',
      matchResult: 'Maç Sonucu',
      overUnder: 'Alt/Üst 2.5',
      btts: 'Karşılıklı Gol',
      home: 'Ev',
      draw: 'X',
      away: 'Dep',
      over: 'Üst',
      under: 'Alt',
      yes: 'Var',
      no: 'Yok',
      minPicks: 'En az 1 bahis ekleyin',
      maxPicks: 'Maksimum 10 bahis',
      success: 'Kupon oluşturuldu!',
      loginRequired: 'Giriş yapmalısınız',
      today: 'Bugün',
      tomorrow: 'Yarın',
      allLeagues: 'Tüm Ligler',
      pointsInfo: 'Puan = Oran × Çarpan',
      multiplier: 'Çarpan',
      single: 'Tekli ×10',
      double: '2\'li ×15',
      treble: '3\'lü ×25',
      acca: '4+ ×50',
    },
    en: {
      createCoupon: 'Create Coupon',
      back: '← Back',
      matches: 'Matches',
      yourCoupon: 'Your Coupon',
      emptySlip: 'Coupon is empty',
      addPicks: 'Click on odds to add picks',
      totalOdds: 'Total Odds',
      potentialPoints: 'Potential Points',
      stake: 'Coupon Name',
      stakePlaceholder: 'E.g: Weekend combo',
      public: 'Public',
      private: 'Private',
      placeBet: 'Save Coupon',
      placing: 'Saving...',
      remove: 'Remove',
      clearAll: 'Clear All',
      search: 'Search team...',
      noMatches: 'No matches found',
      matchResult: 'Match Result',
      overUnder: 'Over/Under 2.5',
      btts: 'Both Teams Score',
      home: 'Home',
      draw: 'X',
      away: 'Away',
      over: 'Over',
      under: 'Under',
      yes: 'Yes',
      no: 'No',
      minPicks: 'Add at least 1 pick',
      maxPicks: 'Maximum 10 picks',
      success: 'Coupon created!',
      loginRequired: 'Login required',
      today: 'Today',
      tomorrow: 'Tomorrow',
      allLeagues: 'All Leagues',
      pointsInfo: 'Points = Odds × Multiplier',
      multiplier: 'Multiplier',
      single: 'Single ×10',
      double: 'Double ×15',
      treble: 'Treble ×25',
      acca: '4+ ×50',
    },
    de: {
      createCoupon: 'Wettschein erstellen',
      back: '← Zurück',
      matches: 'Spiele',
      yourCoupon: 'Ihr Wettschein',
      emptySlip: 'Wettschein ist leer',
      addPicks: 'Klicken Sie auf Quoten',
      totalOdds: 'Gesamtquote',
      potentialPoints: 'Mögliche Punkte',
      stake: 'Wettschein Name',
      stakePlaceholder: 'Z.B: Wochenend-Kombi',
      public: 'Öffentlich',
      private: 'Privat',
      placeBet: 'Wettschein speichern',
      placing: 'Speichern...',
      remove: 'Entfernen',
      clearAll: 'Alle löschen',
      search: 'Team suchen...',
      noMatches: 'Keine Spiele',
      matchResult: 'Spielergebnis',
      overUnder: 'Über/Unter 2.5',
      btts: 'Beide treffen',
      home: 'Heim',
      draw: 'X',
      away: 'Ausw',
      over: 'Über',
      under: 'Unter',
      yes: 'Ja',
      no: 'Nein',
      minPicks: 'Min. 1 Tipp',
      maxPicks: 'Max. 10 Tipps',
      success: 'Wettschein erstellt!',
      loginRequired: 'Anmeldung erforderlich',
      today: 'Heute',
      tomorrow: 'Morgen',
      allLeagues: 'Alle Ligen',
      pointsInfo: 'Punkte = Quote × Multiplikator',
      multiplier: 'Multiplikator',
      single: 'Einzel ×10',
      double: 'Zweier ×15',
      treble: 'Dreier ×25',
      acca: '4+ ×50',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load saved picks
  useEffect(() => {
    const saved = sessionStorage.getItem('pendingCouponPicks');
    if (saved) {
      try {
        setPicks(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save picks
  useEffect(() => {
    sessionStorage.setItem('pendingCouponPicks', JSON.stringify(picks));
  }, [picks]);

  // Fetch matches
  useEffect(() => {
    fetchMatches();
  }, [selectedDate]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?date=${selectedDate}`);
      const data = await res.json();
      
      // Add mock odds if not present
      const matchesWithOdds = (data.matches || []).map((m: Match) => ({
        ...m,
        odds: m.odds || generateMockOdds(),
      }));
      
      setMatches(matchesWithOdds);
      
      // Expand all leagues by default
      const leagues = new Set(matchesWithOdds.map((m: Match) => m.league));
      setExpandedLeagues(leagues);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  // Generate realistic mock odds
  const generateMockOdds = () => {
    const homeBase = 1.5 + Math.random() * 2;
    const drawBase = 3 + Math.random() * 1;
    const awayBase = 2 + Math.random() * 3;
    
    return {
      home: Math.round(homeBase * 100) / 100,
      draw: Math.round(drawBase * 100) / 100,
      away: Math.round(awayBase * 100) / 100,
      over25: Math.round((1.7 + Math.random() * 0.5) * 100) / 100,
      under25: Math.round((1.9 + Math.random() * 0.4) * 100) / 100,
      bttsYes: Math.round((1.7 + Math.random() * 0.4) * 100) / 100,
      bttsNo: Math.round((1.9 + Math.random() * 0.5) * 100) / 100,
    };
  };

  // Group matches by league
  const matchesByLeague = matches
    .filter(m => 
      !searchQuery || 
      m.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.awayTeam.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .reduce((acc, match) => {
      if (!acc[match.league]) acc[match.league] = [];
      acc[match.league].push(match);
      return acc;
    }, {} as Record<string, Match[]>);

  // Toggle league expansion
  const toggleLeague = (league: string) => {
    const newExpanded = new Set(expandedLeagues);
    if (newExpanded.has(league)) {
      newExpanded.delete(league);
    } else {
      newExpanded.add(league);
    }
    setExpandedLeagues(newExpanded);
  };

  // Add pick
  const addPick = (match: Match, betType: string, selection: string, odds: number) => {
    // Check if already exists
    const exists = picks.some(
      p => p.fixtureId === match.id && p.betType === betType
    );
    
    if (exists) {
      // Remove if same selection, replace if different
      const existingPick = picks.find(p => p.fixtureId === match.id && p.betType === betType);
      if (existingPick?.selection === selection) {
        removePick(match.id, betType);
        return;
      }
    }
    
    // Remove any existing pick for same match and bet type
    const filtered = picks.filter(
      p => !(p.fixtureId === match.id && p.betType === betType)
    );
    
    if (filtered.length >= 10) {
      alert(l.maxPicks);
      return;
    }
    
    const newPick: Pick = {
      fixtureId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      matchDate: match.date,
      betType,
      selection,
      odds,
    };
    
    setPicks([...filtered, newPick]);
  };

  // Remove pick
  const removePick = (fixtureId: number, betType: string) => {
    setPicks(picks.filter(p => !(p.fixtureId === fixtureId && p.betType === betType)));
  };

  // Check if pick is selected
  const isSelected = (matchId: number, betType: string, selection: string) => {
    return picks.some(
      p => p.fixtureId === matchId && p.betType === betType && p.selection === selection
    );
  };

  // Calculate totals
  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  const potentialPoints = calculatePoints(totalOdds, picks.length);

  // Get multiplier info
  const getMultiplier = () => {
    if (picks.length === 0) return { label: '-', value: 0 };
    if (picks.length === 1) return { label: l.single, value: 10 };
    if (picks.length === 2) return { label: l.double, value: 15 };
    if (picks.length === 3) return { label: l.treble, value: 25 };
    return { label: l.acca, value: 50 };
  };

  // Submit coupon
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

  // Date shortcuts
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900/90 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/coupons" className="text-gray-400 hover:text-white transition-colors">
                {l.back}
              </Link>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                🎫 {l.createCoupon}
              </h1>
            </div>
            
            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(today)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedDate === today
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {l.today}
              </button>
              <button
                onClick={() => setSelectedDate(tomorrow)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedDate === tomorrow
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {l.tomorrow}
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ============ MATCHES LIST ============ */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              <input
                type="text"
                placeholder={l.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 pl-12 pr-4 py-3 rounded-xl outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* Matches by League */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : Object.keys(matchesByLeague).length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="text-5xl mb-4">📭</div>
                <p>{l.noMatches}</p>
              </div>
            ) : (
              Object.entries(matchesByLeague).map(([league, leagueMatches]) => (
                <div key={league} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                  {/* League Header */}
                  <button
                    onClick={() => toggleLeague(league)}
                    className="w-full px-4 py-3 bg-gray-800 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">⚽</span>
                      <span className="font-semibold text-white">{league}</span>
                      <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
                        {leagueMatches.length}
                      </span>
                    </div>
                    <span className={`text-gray-400 transition-transform ${expandedLeagues.has(league) ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {/* Matches */}
                  {expandedLeagues.has(league) && (
                    <div className="divide-y divide-gray-700/50">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800/50 text-xs text-gray-400">
                        <div className="col-span-1">⏰</div>
                        <div className="col-span-4">{l.matches}</div>
                        <div className="col-span-3 text-center">{l.matchResult}</div>
                        <div className="col-span-2 text-center">{l.overUnder}</div>
                        <div className="col-span-2 text-center">{l.btts}</div>
                      </div>

                      {leagueMatches.map((match) => (
                        <div key={match.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-700/20 transition-colors items-center">
                          {/* Time */}
                          <div className="col-span-1 text-xs text-gray-400">
                            {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          
                          {/* Teams */}
                          <div className="col-span-4">
                            <div className="text-sm text-white font-medium">{match.homeTeam}</div>
                            <div className="text-sm text-gray-400">{match.awayTeam}</div>
                          </div>

                          {/* 1X2 */}
                          <div className="col-span-3 flex gap-1">
                            <button
                              onClick={() => addPick(match, 'MATCH_RESULT', '1', match.odds?.home || 1.5)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'MATCH_RESULT', '1')
                                  ? 'bg-green-600 text-white ring-2 ring-green-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">1</div>
                              {match.odds?.home?.toFixed(2)}
                            </button>
                            <button
                              onClick={() => addPick(match, 'MATCH_RESULT', 'X', match.odds?.draw || 3.5)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'MATCH_RESULT', 'X')
                                  ? 'bg-green-600 text-white ring-2 ring-green-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">X</div>
                              {match.odds?.draw?.toFixed(2)}
                            </button>
                            <button
                              onClick={() => addPick(match, 'MATCH_RESULT', '2', match.odds?.away || 2.5)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'MATCH_RESULT', '2')
                                  ? 'bg-green-600 text-white ring-2 ring-green-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">2</div>
                              {match.odds?.away?.toFixed(2)}
                            </button>
                          </div>

                          {/* Over/Under 2.5 */}
                          <div className="col-span-2 flex gap-1">
                            <button
                              onClick={() => addPick(match, 'OVER_UNDER_25', 'Over', match.odds?.over25 || 1.85)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'OVER_UNDER_25', 'Over')
                                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">Ü</div>
                              {match.odds?.over25?.toFixed(2)}
                            </button>
                            <button
                              onClick={() => addPick(match, 'OVER_UNDER_25', 'Under', match.odds?.under25 || 1.95)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'OVER_UNDER_25', 'Under')
                                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">A</div>
                              {match.odds?.under25?.toFixed(2)}
                            </button>
                          </div>

                          {/* BTTS */}
                          <div className="col-span-2 flex gap-1">
                            <button
                              onClick={() => addPick(match, 'BTTS', 'Yes', match.odds?.bttsYes || 1.75)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'BTTS', 'Yes')
                                  ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">{l.yes}</div>
                              {match.odds?.bttsYes?.toFixed(2)}
                            </button>
                            <button
                              onClick={() => addPick(match, 'BTTS', 'No', match.odds?.bttsNo || 2.0)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected(match.id, 'BTTS', 'No')
                                  ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              <div className="text-[10px] text-gray-400 font-normal">{l.no}</div>
                              {match.odds?.bttsNo?.toFixed(2)}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ============ COUPON SLIP ============ */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden sticky top-24">
              {/* Slip Header */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    🎫 {l.yourCoupon}
                  </h2>
                  {picks.length > 0 && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {picks.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Picks List */}
              <div className="max-h-[400px] overflow-y-auto">
                {picks.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="font-medium">{l.emptySlip}</p>
                    <p className="text-sm mt-1">{l.addPicks}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700/50">
                    {picks.map((pick, index) => (
                      <div key={index} className="p-3 hover:bg-gray-700/20 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">
                              {pick.homeTeam} vs {pick.awayTeam}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{pick.league}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                pick.betType === 'MATCH_RESULT' ? 'bg-green-500/20 text-green-400' :
                                pick.betType === 'OVER_UNDER_25' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {pick.betType === 'MATCH_RESULT' ? '1X2' : 
                                 pick.betType === 'OVER_UNDER_25' ? 'O/U' : 'BTTS'}
                              </span>
                              <span className="text-xs text-white font-bold">{pick.selection}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 font-bold">{pick.odds.toFixed(2)}</p>
                            <button
                              onClick={() => removePick(pick.fixtureId, pick.betType)}
                              className="text-xs text-red-400 hover:text-red-300 mt-1"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              {picks.length > 0 && (
                <div className="border-t border-gray-700/50 p-4 space-y-3">
                  {/* Clear All */}
                  <button
                    onClick={() => setPicks([])}
                    className="w-full text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    {l.clearAll}
                  </button>

                  {/* Multiplier Info */}
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{l.multiplier}</span>
                      <span className="text-purple-400 font-bold">{getMultiplier().label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{l.pointsInfo}</p>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{l.totalOdds}</span>
                      <span className="text-xl font-bold text-green-400">{totalOdds.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{l.potentialPoints}</span>
                      <span className="text-2xl font-bold text-yellow-400 flex items-center gap-1">
                        🏆 {potentialPoints.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Coupon Name */}
                  <input
                    type="text"
                    placeholder={l.stakePlaceholder}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 text-white placeholder-gray-500 px-4 py-2.5 rounded-xl text-sm outline-none focus:border-green-500"
                  />

                  {/* Public Toggle */}
                  <div className="flex items-center justify-between bg-gray-700/30 rounded-xl p-3">
                    <span className="text-sm text-gray-300">
                      {isPublic ? '🌍 ' + l.public : '🔒 ' + l.private}
                    </span>
                    <button
                      onClick={() => setIsPublic(!isPublic)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        isPublic ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || picks.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
  );
}
