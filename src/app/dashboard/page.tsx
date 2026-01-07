'use client';

// ============================================================================
// DASHBOARD - Hızlı AI Analiz Sistemi
// Claude + DeepSeek | ~10-15 saniye analiz
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import { FootballBall3D, SimpleFootballIcon } from '@/components/Football3D';
import { Paywall } from '@/components/Paywall';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Calendar, Search, RefreshCw, Zap, 
  TrendingUp, CheckCircle, AlertCircle, Clock,
  ChevronRight, Star, Target, Shield, User,
  Settings, LogOut, Crown, BarChart3, Menu, X,
  ChevronDown, FileText
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league: string;
  leagueId?: number;
  leagueLogo?: string;
  date: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  hasAnalysis?: boolean;
}

interface League {
  id: number;
  name: string;
  logo?: string;
  count: number;
}

interface SmartAnalysis {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  btts?: { prediction: string; confidence: number; reasoning: string };
  overUnder?: { prediction: string; confidence: number; reasoning: string };
  matchResult?: { prediction: string; confidence: number; reasoning: string };
  corners?: { prediction: string; confidence: number; reasoning: string; line: number; dataAvailable?: boolean };
  // YENİ: Agent özel tahminler
  halfTimeGoals?: { prediction: string; confidence: number; reasoning: string; line: number; expectedGoals?: number };
  halfTimeFullTime?: { prediction: string; confidence: number; reasoning: string };
  matchResultOdds?: { home: number; draw: number; away: number; reasoning: string };
  bestBet: { market: string; selection: string; confidence: number; reason: string };
  agreement: number;
  riskLevel: 'low' | 'medium' | 'high';
  overallConfidence: number;
  processingTime: number;
  modelsUsed: string[];
  analyzedAt: string;
  // Agent analiz verileri (sadece Agent Analysis için)
  agents?: {
    stats?: any;
    odds?: any;
    deepAnalysis?: any;
    masterStrategist?: any;
    geniusAnalyst?: any;
  };
  top3Predictions?: Array<{
    rank: number;
    market: string;
    selection: string;
    confidence: number;
    reasoning: string;
    agentSupport: string[];
  }>;
  league?: string;
  matchDate?: string;
  dataQuality?: string;
}

// ============================================================================
// TRANSLATIONS
// ============================================================================

const translations = {
  tr: {
    title: 'Football Analytics',
    subtitle: 'AI Tahmin Sistemi',
    profile: 'Profil',
    settings: 'Ayarlar',
    admin: 'Admin Panel',
    logout: 'Çıkış Yap',
    selectDate: 'Tarih Seç',
    selectLeague: 'Lig Seç',
    allLeagues: 'Tüm Ligler',
    matches: 'Maçlar',
    searchPlaceholder: 'Takım veya lig ara...',
    noMatches: 'Maç bulunamadı',
    analyzing: 'Analiz Yapılıyor...',
    analyzeTime: '~10-15 saniye',
    tryAgain: 'Tekrar Dene',
    selectMatch: 'Maç Seçin',
    selectMatchDesc: 'Sol taraftan bir maç seçerek analiz başlatın.',
    analyzeTimeShort: 'Analiz sadece 10-15 saniye sürer!',
    riskLow: 'Düşük',
    riskMedium: 'Orta',
    riskHigh: 'Yüksek',
    btts: 'BTTS',
    overUnder: 'Üst/Alt 2.5',
    matchResult: 'Maç Sonucu',
    corners: 'Korner',
    halfTimeGoals: 'İlk Yarı Goller',
    halfTimeFullTime: 'İlk Yarı/Maç Sonucu',
    matchResultOdds: 'Maç Sonucu Oranları',
    bestBet: 'En İyi Bahis',
    aiRecommendation: 'AI önerisi',
    confidence: 'güven',
    agreement: 'Uyum',
    models: 'Modeller',
    allRecommendations: 'Tüm Öneriler',
    play: 'OYNA',
    caution: 'DİKKAT',
    skip: 'ATLA',
    value: 'value',
    sourcesAgree: 'kaynak uyumlu',
    analysis: 'Analiz',
    yes: 'EVET',
    no: 'HAYIR',
    over: 'ÜST',
    under: 'ALT',
    home: 'EV SAHİBİ',
    away: 'DEPLASMAN',
    draw: 'BERABERLİK',
    cached: 'Önbellek',
    analyzed: 'Analiz Edildi',
    aiAnalysis: 'AI Analiz',
    agentAnalysis: 'Agent Analiz',
    selectAnalysisType: 'Analiz Türü Seçin'
  },
  en: {
    title: 'Football Analytics',
    subtitle: 'AI Prediction System',
    profile: 'Profile',
    settings: 'Settings',
    admin: 'Admin Panel',
    logout: 'Sign Out',
    selectDate: 'Select Date',
    selectLeague: 'Select League',
    allLeagues: 'All Leagues',
    matches: 'Matches',
    searchPlaceholder: 'Search team or league...',
    noMatches: 'No matches found',
    analyzing: 'Analyzing...',
    analyzeTime: '~10-15 seconds',
    tryAgain: 'Try Again',
    selectMatch: 'Select a Match',
    selectMatchDesc: 'Select a match from the left to start analysis.',
    analyzeTimeShort: 'Analysis takes only 10-15 seconds!',
    riskLow: 'Low',
    riskMedium: 'Medium',
    riskHigh: 'High',
    btts: 'BTTS',
    overUnder: 'Over/Under 2.5',
    matchResult: 'Match Result',
    corners: 'Corners',
    halfTimeGoals: 'Half-Time Goals',
    halfTimeFullTime: 'HT/FT Result',
    matchResultOdds: 'Match Result Odds',
    bestBet: 'Best Bet',
    aiRecommendation: 'AI recommendation',
    confidence: 'confidence',
    agreement: 'Agreement',
    models: 'Models',
    allRecommendations: 'All Recommendations',
    play: 'PLAY',
    caution: 'CAUTION',
    skip: 'SKIP',
    value: 'value',
    sourcesAgree: 'sources agree',
    analysis: 'Analysis',
    yes: 'YES',
    no: 'NO',
    over: 'OVER',
    under: 'UNDER',
    home: 'HOME',
    away: 'AWAY',
    draw: 'DRAW',
    cached: 'Cached',
    analyzed: 'Analyzed',
    aiAnalysis: 'AI Analysis',
    agentAnalysis: 'Agent Analysis',
    selectAnalysisType: 'Select Analysis Type'
  },
  de: {
    title: 'Football Analytics',
    subtitle: 'KI-Vorhersagesystem',
    profile: 'Profil',
    settings: 'Einstellungen',
    admin: 'Admin Panel',
    logout: 'Abmelden',
    selectDate: 'Datum wählen',
    selectLeague: 'Liga wählen',
    allLeagues: 'Alle Ligen',
    matches: 'Spiele',
    searchPlaceholder: 'Team oder Liga suchen...',
    noMatches: 'Keine Spiele gefunden',
    analyzing: 'Analysieren...',
    analyzeTime: '~10-15 Sekunden',
    tryAgain: 'Erneut versuchen',
    selectMatch: 'Spiel auswählen',
    selectMatchDesc: 'Wählen Sie ein Spiel auf der linken Seite.',
    analyzeTimeShort: 'Die Analyse dauert nur 10-15 Sekunden!',
    riskLow: 'Niedrig',
    riskMedium: 'Mittel',
    riskHigh: 'Hoch',
    btts: 'BTTS',
    overUnder: 'Über/Unter 2.5',
    matchResult: 'Spielergebnis',
    corners: 'Ecken',
    halfTimeGoals: 'Halbzeit-Tore',
    halfTimeFullTime: 'HZ/ET Ergebnis',
    matchResultOdds: 'Spielergebnis Quoten',
    bestBet: 'Beste Wette',
    aiRecommendation: 'KI-Empfehlung',
    confidence: 'Vertrauen',
    agreement: 'Übereinstimmung',
    models: 'Modelle',
    allRecommendations: 'Alle Empfehlungen',
    play: 'SPIELEN',
    caution: 'VORSICHT',
    skip: 'ÜBERSPRINGEN',
    value: 'Wert',
    sourcesAgree: 'Quellen stimmen zu',
    analysis: 'Analyse',
    yes: 'JA',
    no: 'NEIN',
    over: 'ÜBER',
    under: 'UNTER',
    home: 'HEIM',
    away: 'AUSWÄRTS',
    draw: 'UNENTSCHIEDEN',
    cached: 'Zwischengespeichert',
    analyzed: 'Analysiert',
    aiAnalysis: 'KI-Analyse',
    agentAnalysis: 'Agent-Analyse',
    selectAnalysisType: 'Analysetyp auswählen'
  }
};

// ============================================================================
// ANALYSIS DETAILS SECTION COMPONENT
// ============================================================================

function AnalysisDetailsSection({ analysis }: { analysis: SmartAnalysis }) {
  const [isOpen, setIsOpen] = useState(false);
  const { lang } = useLanguage();
  const t = translations[lang as keyof typeof translations] || translations.en;

  if (!analysis.agents) return null;

  const { stats, odds, deepAnalysis, masterStrategist, geniusAnalyst } = analysis.agents;

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-400" />
          <h4 className="text-white font-bold">Analiz Detayı</h4>
          <span className="text-xs text-gray-400">(Detaylı agent analizleri)</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-6 space-y-6 border-t border-white/10">
          {/* STATS AGENT */}
          {stats && (
            <div className="bg-blue-500/10 rounded-lg border border-blue-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h5 className="text-white font-bold text-lg">📊 STATS AGENT (İstatistik Analiz Ajanı)</h5>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-300 mb-2"><strong>Görevi:</strong> Form, gol istatistikleri, xG (Expected Goals), timing patterns ve clean sheet analizi yapar.</p>
                </div>

                {stats.formAnalysis && (
                  <div>
                    <p className="text-blue-400 font-semibold mb-1">Form Analizi:</p>
                    <p className="text-gray-300">{stats.formAnalysis}</p>
                  </div>
                )}

                {stats.xgAnalysis && (
                  <div>
                    <p className="text-blue-400 font-semibold mb-1">xG (Expected Goals) Analizi:</p>
                    <div className="bg-black/20 rounded p-2 space-y-1 text-xs">
                      <p className="text-gray-300">Ev Sahibi xG: <span className="text-blue-400">{stats.xgAnalysis.homeXG}</span></p>
                      <p className="text-gray-300">Deplasman xG: <span className="text-blue-400">{stats.xgAnalysis.awayXG}</span></p>
                      <p className="text-gray-300">Toplam xG: <span className="text-blue-400">{stats.xgAnalysis.totalXG}</span></p>
                      <p className="text-gray-300">Performans: <span className="text-blue-400">{stats.xgAnalysis.homePerformance} / {stats.xgAnalysis.awayPerformance}</span></p>
                      {stats.xgAnalysis.regressionRisk && (
                        <p className="text-yellow-400">⚠️ {stats.xgAnalysis.regressionRisk}</p>
                      )}
                    </div>
                  </div>
                )}

                {stats.goalExpectancy && (
                  <div>
                    <p className="text-blue-400 font-semibold mb-1">Gol Beklentisi:</p>
                    <p className="text-gray-300">Goal Expectancy: <span className="text-blue-400 font-bold">{stats.goalExpectancy}</span> gol</p>
                    {stats._calculatedStats && (
                      <div className="bg-black/20 rounded p-2 mt-1 text-xs space-y-1">
                        <p className="text-gray-300">Son 5 Maç Over 2.5: <span className="text-blue-400">%{stats._calculatedStats.avgOver25}</span></p>
                        <p className="text-gray-300">Son 5 Maç BTTS: <span className="text-blue-400">%{stats._calculatedStats.avgBtts}</span></p>
                        {stats._calculatedStats.homeExpected && stats._calculatedStats.awayExpected && (
                          <>
                            <p className="text-gray-300 mt-2 pt-2 border-t border-white/10">
                              <span className="text-blue-400 font-semibold">Gol Atma Beklentisi:</span>
                            </p>
                            <p className="text-gray-300">Ev Sahibi: <span className="text-blue-400">{stats._calculatedStats.homeExpected}</span> gol</p>
                            <p className="text-gray-300">Deplasman: <span className="text-blue-400">{stats._calculatedStats.awayExpected}</span> gol</p>
                          </>
                        )}
                        {stats._calculatedStats.homeConcededExpected && stats._calculatedStats.awayConcededExpected && (
                          <>
                            <p className="text-gray-300 mt-2 pt-2 border-t border-white/10">
                              <span className="text-blue-400 font-semibold">Gol Yeme Beklentisi:</span>
                            </p>
                            <p className="text-gray-300">Ev Sahibi: <span className="text-blue-400">{stats._calculatedStats.homeConcededExpected}</span> gol</p>
                            <p className="text-gray-300">Deplasman: <span className="text-blue-400">{stats._calculatedStats.awayConcededExpected}</span> gol</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {stats.timingPatterns && (
                  <div>
                    <p className="text-blue-400 font-semibold mb-1">Timing Patterns (Zamanlama Paternleri):</p>
                    <div className="bg-black/20 rounded p-2 text-xs space-y-1">
                      <p className="text-gray-300">Ev Sahibi: İlk yarı %{stats.timingPatterns.homeFirstHalfGoals}, İkinci yarı %{stats.timingPatterns.homeSecondHalfGoals}</p>
                      <p className="text-gray-300">Deplasman: İlk yarı %{stats.timingPatterns.awayFirstHalfGoals}, İkinci yarı %{stats.timingPatterns.awaySecondHalfGoals}</p>
                      {stats.timingPatterns.htftPattern && (
                        <p className="text-yellow-400 mt-1">📌 {stats.timingPatterns.htftPattern}</p>
                      )}
                    </div>
                  </div>
                )}

                {stats.cleanSheetAnalysis && (
                  <div>
                    <p className="text-blue-400 font-semibold mb-1">Clean Sheet Analizi:</p>
                    <div className="bg-black/20 rounded p-2 text-xs space-y-1">
                      <p className="text-gray-300">Ev Clean Sheet Serisi: <span className="text-blue-400">{stats.cleanSheetAnalysis.homeCleanSheetStreak}</span></p>
                      <p className="text-gray-300">Dep Clean Sheet Serisi: <span className="text-blue-400">{stats.cleanSheetAnalysis.awayCleanSheetStreak}</span></p>
                      <p className="text-gray-300">Clean Sheet %: Ev %{stats.cleanSheetAnalysis.homeCleanSheetPct}, Dep %{stats.cleanSheetAnalysis.awayCleanSheetPct}</p>
                      {stats.cleanSheetAnalysis.defensiveRating && (
                        <p className="text-yellow-400 mt-1">🛡️ {stats.cleanSheetAnalysis.defensiveRating}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-blue-500/30 pt-3 mt-3">
                  <p className="text-blue-400 font-semibold mb-2">STATS AGENT TAHMİNLERİ:</p>
                  <div className="space-y-2">
                    {stats.overUnder && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Over/Under 2.5: <span className="text-blue-400">{stats.overUnder}</span> (%{Math.round(stats.overUnderConfidence || stats.confidence)} güven)</p>
                        {stats.overUnderReasoning && <p className="text-gray-400 text-xs mt-1">{stats.overUnderReasoning}</p>}
                      </div>
                    )}
                    {stats.btts && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">BTTS: <span className="text-blue-400">{stats.btts}</span> (%{Math.round(stats.bttsConfidence || stats.confidence)} güven)</p>
                        {stats.bttsReasoning && <p className="text-gray-400 text-xs mt-1">{stats.bttsReasoning}</p>}
                      </div>
                    )}
                    {stats.matchResult && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Maç Sonucu: <span className="text-blue-400">{
                          stats.matchResult === '1' || stats.matchResult === 'home' ? 'Ev Sahibi' : 
                          stats.matchResult === '2' || stats.matchResult === 'away' ? 'Deplasman' : 
                          'Beraberlik'
                        }</span> (%{Math.round(stats.matchResultConfidence || stats.confidence)} güven)</p>
                        {stats.matchResultReasoning && <p className="text-gray-400 text-xs mt-1">{stats.matchResultReasoning}</p>}
                      </div>
                    )}
                    {stats.firstHalfPrediction && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">İlk Yarı: <span className="text-blue-400">{stats.firstHalfPrediction.goals}</span> (%{stats.firstHalfConfidence || stats.confidence} güven)</p>
                        {stats.firstHalfPrediction.reasoning && <p className="text-gray-400 text-xs mt-1">{stats.firstHalfPrediction.reasoning}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ODDS AGENT - ÖNEMLİ BÖLÜM */}
          {odds ? (
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg border-2 border-green-500/50 p-4 shadow-lg shadow-green-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h5 className="text-white font-bold text-lg">💰 ODDS AGENT</h5>
                  <p className="text-green-300 text-xs">Bahis Oranları & Value Bet Analiz Ajanı</p>
                </div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-300 mb-2"><strong>Görevi:</strong> Bahis oranlarını form verileriyle karşılaştırarak VALUE BET (değerli bahis) tespit eder.</p>
                </div>

                {odds._valueAnalysis && (
                  <div>
                    <p className="text-green-400 font-semibold mb-1">Oran Analizi:</p>
                    <div className="bg-black/20 rounded p-2 text-xs space-y-1">
                      <p className="text-gray-300">Ev Sahibi: Oran %{odds._valueAnalysis.homeImplied} implied, Form %{odds._valueAnalysis.homeFormProb} → Value: <span className={odds._valueAnalysis.homeValue > 0 ? 'text-green-400' : 'text-red-400'}>{odds._valueAnalysis.homeValue > 0 ? '+' : ''}{odds._valueAnalysis.homeValue}%</span></p>
                      <p className="text-gray-300">Deplasman: Oran %{odds._valueAnalysis.awayImplied} implied, Form %{odds._valueAnalysis.awayFormProb} → Value: <span className={odds._valueAnalysis.awayValue > 0 ? 'text-green-400' : 'text-red-400'}>{odds._valueAnalysis.awayValue > 0 ? '+' : ''}{odds._valueAnalysis.awayValue}%</span></p>
                      <p className="text-gray-300">Over 2.5: Oran %{odds._valueAnalysis.overImplied} implied, Form %{odds._valueAnalysis.overProb} → Value: <span className={odds._valueAnalysis.overValue > 0 ? 'text-green-400' : 'text-red-400'}>{odds._valueAnalysis.overValue > 0 ? '+' : ''}{odds._valueAnalysis.overValue}%</span></p>
                      {odds._valueAnalysis.bestValue && (
                        <p className="text-green-400 font-semibold mt-2">🏆 En İyi Value: {odds._valueAnalysis.bestValue} (+{odds._valueAnalysis.bestValueAmount}%)</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-green-500/30 pt-3 mt-3">
                  <p className="text-green-400 font-semibold mb-2">ODDS AGENT TAHMİNLERİ:</p>
                  <div className="space-y-2">
                    {odds.recommendation && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Ana Öneri: <span className="text-green-400">{odds.recommendation === 'Over' ? 'Over 2.5' : odds.recommendation === 'Under' ? 'Under 2.5' : odds.recommendation}</span> (%{Math.round(odds.confidence)} güven)</p>
                        {odds.recommendationReasoning && <p className="text-gray-400 text-xs mt-1">{odds.recommendationReasoning}</p>}
                      </div>
                    )}
                    {odds.matchWinnerValue && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Maç Sonucu Value: <span className="text-green-400">{odds.matchWinnerValue === 'home' ? 'Ev Sahibi' : odds.matchWinnerValue === 'away' ? 'Deplasman' : 'Beraberlik'}</span></p>
                        {odds.matchWinnerReasoning && <p className="text-gray-400 text-xs mt-1">{odds.matchWinnerReasoning}</p>}
                      </div>
                    )}
                    {odds.asianHandicap && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Asian Handicap: <span className="text-green-400">{odds.asianHandicap.recommendation}</span> (%{odds.asianHandicap.confidence} güven)</p>
                        {odds.asianHandicap.reasoning && <p className="text-gray-400 text-xs mt-1">{odds.asianHandicap.reasoning}</p>}
                      </div>
                    )}
                    {odds.correctScore && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Correct Score: <span className="text-green-400">{odds.correctScore.mostLikely}</span> (%{odds.correctScore.confidence} güven)</p>
                        <p className="text-gray-400 text-xs mt-1">2. Olası: {odds.correctScore.second}, 3. Olası: {odds.correctScore.third}</p>
                      </div>
                    )}
                    {odds.cornersAnalysis && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Korner: <span className="text-green-400">{odds.cornersAnalysis.totalCorners}</span> (%{odds.cornersAnalysis.confidence} güven)</p>
                        {odds.cornersAnalysis.reasoning && <p className="text-gray-400 text-xs mt-1">{odds.cornersAnalysis.reasoning}</p>}
                      </div>
                    )}
                    {odds.valueBets && odds.valueBets.length > 0 && (
                      <div className="bg-green-500/20 rounded p-2">
                        <p className="text-green-400 font-semibold">💰 Value Bets: {odds.valueBets.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-gray-500" />
                <h5 className="text-gray-400 font-bold text-lg">💰 ODDS AGENT</h5>
              </div>
              <p className="text-gray-500 text-sm">Odds agent analizi henüz mevcut değil. Analiz yapıldığında burada görünecek.</p>
            </div>
          )}

          {/* DEEP ANALYSIS AGENT */}
          {deepAnalysis && (
            <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-400" />
                <h5 className="text-white font-bold text-lg">🎯 DEEP ANALYSIS AGENT (Derin Analiz Ajanı)</h5>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-300 mb-2"><strong>Görevi:</strong> Çok katmanlı analiz yapar - takım formu, taktiksel yapı, H2H, hakem, hava durumu, diziliş analizi.</p>
                </div>

                {deepAnalysis.matchAnalysis && (
                  <div>
                    <p className="text-purple-400 font-semibold mb-1">Maç Analizi:</p>
                    <p className="text-gray-300">{deepAnalysis.matchAnalysis}</p>
                  </div>
                )}

                {deepAnalysis.criticalFactors && deepAnalysis.criticalFactors.length > 0 && (
                  <div>
                    <p className="text-purple-400 font-semibold mb-1">Kritik Faktörler:</p>
                    <ul className="bg-black/20 rounded p-2 space-y-1">
                      {deepAnalysis.criticalFactors.map((factor: string, idx: number) => (
                        <li key={idx} className="text-gray-300 text-xs">• {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {deepAnalysis.probabilities && (
                  <div>
                    <p className="text-purple-400 font-semibold mb-1">Olasılıklar:</p>
                    <div className="bg-black/20 rounded p-2 text-xs space-y-1">
                      <p className="text-gray-300">Ev Kazanır: <span className="text-purple-400">%{deepAnalysis.probabilities.homeWin}</span></p>
                      <p className="text-gray-300">Beraberlik: <span className="text-purple-400">%{deepAnalysis.probabilities.draw}</span></p>
                      <p className="text-gray-300">Deplasman Kazanır: <span className="text-purple-400">%{deepAnalysis.probabilities.awayWin}</span></p>
                    </div>
                  </div>
                )}

                {/* 💪 MOTİVASYON & HAZIRLIK SKORLARI - ÖNEMLİ BÖLÜM */}
                {/* Deep Analysis, Stats Agent veya Fallback'tan alınır */}
                {(() => {
                  // Motivasyon skorlarını bul (Deep Analysis > Stats Agent > null)
                  const motivationScores = deepAnalysis?.motivationScores || 
                                          (analysis.agents?.stats as any)?.motivationScores || 
                                          null;
                  const preparationScore = deepAnalysis?.preparationScore || null;
                  
                  if (!motivationScores && !preparationScore) return null;
                  
                  return (
                    <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border-2 border-purple-500/50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">💪</span>
                        <h6 className="text-purple-300 font-bold text-base">MACA HAZIRLANMA & MOTİVASYON ANALİZİ (0-100)</h6>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Ev Sahibi */}
                        <div className="bg-black/30 rounded-lg p-3 border border-purple-500/30">
                          <p className="text-xs text-gray-400 mb-2">🏠 EV SAHİBİ</p>
                          {motivationScores ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-3xl font-bold ${motivationScores.home >= 70 ? 'text-green-400' : motivationScores.home >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {motivationScores.home}
                                </span>
                                <span className="text-gray-400 text-sm">/100</span>
                                {motivationScores.homeTrend === 'improving' && <span className="text-green-400 text-xl">📈</span>}
                                {motivationScores.homeTrend === 'declining' && <span className="text-red-400 text-xl">📉</span>}
                                {motivationScores.homeTrend === 'stable' && <span className="text-gray-400 text-xl">➡️</span>}
                              </div>
                              {motivationScores.homeFormGraph && (
                                <p className="text-gray-300 text-xs mb-1">Form: <span className="font-mono">{motivationScores.homeFormGraph}</span></p>
                              )}
                              <div className={`h-2 rounded-full mt-2 ${motivationScores.home >= 70 ? 'bg-green-500' : motivationScores.home >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${motivationScores.home}%` }}></div>
                            </>
                          ) : preparationScore ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-3xl font-bold ${preparationScore.home >= 70 ? 'text-green-400' : preparationScore.home >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {preparationScore.home}
                                </span>
                                <span className="text-gray-400 text-sm">/100</span>
                              </div>
                              {preparationScore.reasoning?.home && (
                                <p className="text-gray-300 text-xs">{preparationScore.reasoning.home}</p>
                              )}
                              <div className={`h-2 rounded-full mt-2 ${preparationScore.home >= 70 ? 'bg-green-500' : preparationScore.home >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${preparationScore.home}%` }}></div>
                            </>
                          ) : null}
                        </div>
                        
                        {/* Deplasman */}
                        <div className="bg-black/30 rounded-lg p-3 border border-purple-500/30">
                          <p className="text-xs text-gray-400 mb-2">✈️ DEPLASMAN</p>
                          {motivationScores ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-3xl font-bold ${motivationScores.away >= 70 ? 'text-green-400' : motivationScores.away >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {motivationScores.away}
                                </span>
                                <span className="text-gray-400 text-sm">/100</span>
                                {motivationScores.awayTrend === 'improving' && <span className="text-green-400 text-xl">📈</span>}
                                {motivationScores.awayTrend === 'declining' && <span className="text-red-400 text-xl">📉</span>}
                                {motivationScores.awayTrend === 'stable' && <span className="text-gray-400 text-xl">➡️</span>}
                              </div>
                              {motivationScores.awayFormGraph && (
                                <p className="text-gray-300 text-xs mb-1">Form: <span className="font-mono">{motivationScores.awayFormGraph}</span></p>
                              )}
                              <div className={`h-2 rounded-full mt-2 ${motivationScores.away >= 70 ? 'bg-green-500' : motivationScores.away >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${motivationScores.away}%` }}></div>
                            </>
                          ) : preparationScore ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-3xl font-bold ${preparationScore.away >= 70 ? 'text-green-400' : preparationScore.away >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {preparationScore.away}
                                </span>
                                <span className="text-gray-400 text-sm">/100</span>
                              </div>
                              {preparationScore.reasoning?.away && (
                                <p className="text-gray-300 text-xs">{preparationScore.reasoning.away}</p>
                              )}
                              <div className={`h-2 rounded-full mt-2 ${preparationScore.away >= 70 ? 'bg-green-500' : preparationScore.away >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${preparationScore.away}%` }}></div>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {/* 🆕 Detaylı Skor Ayrımı (%50 Performans + %50 Takım İçi) */}
                      {(motivationScores as any)?.homePerformanceScore !== undefined && (
                        <div className="mt-4 pt-3 border-t border-purple-500/30 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            {/* Ev Sahibi Detay */}
                            <div className="bg-black/20 rounded-lg p-2">
                              <p className="text-xs text-gray-400 mb-1">🏠 {analysis.homeTeam}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Performans:</span>
                                  <span className="text-blue-400 font-bold">{(motivationScores as any).homePerformanceScore}/100</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Takım İçi:</span>
                                  <span className="text-purple-400 font-bold">{(motivationScores as any).homeTeamMotivationScore}/100</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700">
                                  <span className="text-gray-300 font-semibold">Final:</span>
                                  <span className="text-white font-bold">{motivationScores.home}/100</span>
                                </div>
                              </div>
                              {/* Sakatlıklar */}
                              {(motivationScores as any).homeInjuries?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                  <p className="text-xs text-red-400 mb-1">⚠️ Sakatlıklar:</p>
                                  <ul className="text-xs text-gray-400 space-y-0.5">
                                    {(motivationScores as any).homeInjuries.slice(0, 2).map((inj: string, idx: number) => (
                                      <li key={idx}>• {inj}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {/* Kadro Sorunları */}
                              {(motivationScores as any).homeSquadIssues?.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs text-yellow-400 mb-1">📋 Kadro:</p>
                                  <ul className="text-xs text-gray-400 space-y-0.5">
                                    {(motivationScores as any).homeSquadIssues.slice(0, 1).map((issue: string, idx: number) => (
                                      <li key={idx}>• {issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            
                            {/* Deplasman Detay */}
                            <div className="bg-black/20 rounded-lg p-2">
                              <p className="text-xs text-gray-400 mb-1">✈️ {analysis.awayTeam}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Performans:</span>
                                  <span className="text-blue-400 font-bold">{(motivationScores as any).awayPerformanceScore}/100</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Takım İçi:</span>
                                  <span className="text-purple-400 font-bold">{(motivationScores as any).awayTeamMotivationScore}/100</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700">
                                  <span className="text-gray-300 font-semibold">Final:</span>
                                  <span className="text-white font-bold">{motivationScores.away}/100</span>
                                </div>
                              </div>
                              {/* Sakatlıklar */}
                              {(motivationScores as any).awayInjuries?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                  <p className="text-xs text-red-400 mb-1">⚠️ Sakatlıklar:</p>
                                  <ul className="text-xs text-gray-400 space-y-0.5">
                                    {(motivationScores as any).awayInjuries.slice(0, 2).map((inj: string, idx: number) => (
                                      <li key={idx}>• {inj}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {/* Kadro Sorunları */}
                              {(motivationScores as any).awaySquadIssues?.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs text-yellow-400 mb-1">📋 Kadro:</p>
                                  <ul className="text-xs text-gray-400 space-y-0.5">
                                    {(motivationScores as any).awaySquadIssues.slice(0, 1).map((issue: string, idx: number) => (
                                      <li key={idx}>• {issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Haberler */}
                          {((motivationScores as any).homeNewsImpact || (motivationScores as any).awayNewsImpact) && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <p className="text-xs text-cyan-400 mb-1">📰 Son Haberler:</p>
                              {(motivationScores as any).homeNewsImpact && (
                                <p className="text-xs text-gray-400 mb-1">
                                  <span className="text-white font-semibold">{analysis.homeTeam}:</span> {(motivationScores as any).homeNewsImpact.substring(0, 100)}...
                                </p>
                              )}
                              {(motivationScores as any).awayNewsImpact && (
                                <p className="text-xs text-gray-400">
                                  <span className="text-white font-semibold">{analysis.awayTeam}:</span> {(motivationScores as any).awayNewsImpact.substring(0, 100)}...
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {motivationScores?.reasoning && (
                        <p className="text-gray-300 text-xs mt-3 pt-3 border-t border-purple-500/30">{motivationScores.reasoning}</p>
                      )}
                      <div className="mt-3 text-xs text-gray-400">
                        <p>💡 <strong>Skor Anlamı:</strong> 70-100 = Çok hazır, 50-69 = Normal, 30-49 = Hazırlıksız, 0-29 = Çok kötü durum</p>
                        {(motivationScores as any)?.homePerformanceScore !== undefined && (
                          <p className="mt-1">📊 <strong>Hesaplama:</strong> Final Skor = (%50 Performans + %50 Takım İçi Motivasyon) - Gemini API ile sakatlıklar, haberler ve kadro durumu analiz edilir</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-purple-500/30 pt-3 mt-3">
                  <p className="text-purple-400 font-semibold mb-2">DEEP ANALYSIS AGENT TAHMİNLERİ:</p>
                  <div className="space-y-2">
                    {deepAnalysis.overUnder && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Over/Under 2.5: <span className="text-purple-400">{deepAnalysis.overUnder.prediction}</span> (%{deepAnalysis.overUnder.confidence} güven)</p>
                        {deepAnalysis.overUnder.reasoning && <p className="text-gray-400 text-xs mt-1">{deepAnalysis.overUnder.reasoning}</p>}
                      </div>
                    )}
                    {deepAnalysis.btts && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">BTTS: <span className="text-purple-400">{deepAnalysis.btts.prediction}</span> (%{deepAnalysis.btts.confidence} güven)</p>
                        {deepAnalysis.btts.reasoning && <p className="text-gray-400 text-xs mt-1">{deepAnalysis.btts.reasoning}</p>}
                      </div>
                    )}
                    {deepAnalysis.matchResult && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Maç Sonucu: <span className="text-purple-400">{deepAnalysis.matchResult.prediction === '1' ? 'Ev Sahibi' : deepAnalysis.matchResult.prediction === '2' ? 'Deplasman' : 'Beraberlik'}</span> (%{deepAnalysis.matchResult.confidence} güven)</p>
                        {deepAnalysis.matchResult.reasoning && <p className="text-gray-400 text-xs mt-1">{deepAnalysis.matchResult.reasoning}</p>}
                      </div>
                    )}
                    {deepAnalysis.scorePrediction && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Skor Tahmini: <span className="text-purple-400">{deepAnalysis.scorePrediction.score}</span></p>
                        {deepAnalysis.scorePrediction.reasoning && <p className="text-gray-400 text-xs mt-1">{deepAnalysis.scorePrediction.reasoning}</p>}
                      </div>
                    )}
                    {deepAnalysis.halfTimeGoals && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">İlk Yarı: <span className="text-purple-400">{deepAnalysis.halfTimeGoals.prediction} {deepAnalysis.halfTimeGoals.line}</span> (%{deepAnalysis.halfTimeGoals.confidence} güven)</p>
                        {deepAnalysis.halfTimeGoals.reasoning && <p className="text-gray-400 text-xs mt-1">{deepAnalysis.halfTimeGoals.reasoning}</p>}
                      </div>
                    )}
                    {deepAnalysis.cornersAndCards && (
                      <div className="bg-black/20 rounded p-2">
                        <p className="text-white font-semibold">Korner: <span className="text-purple-400">{deepAnalysis.cornersAndCards.cornersLine}</span> (%{deepAnalysis.cornersAndCards.cornersConfidence} güven)</p>
                        <p className="text-white font-semibold mt-1">Kart: <span className="text-purple-400">{deepAnalysis.cornersAndCards.cardsLine}</span> (%{deepAnalysis.cornersAndCards.cardsConfidence} güven)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 💪 MOTİVASYON & HAZIRLIK SKORLARI - BAĞIMSIZ BÖLÜM */}
          {/* Stats Agent'tan veya Deep Analysis'ten alınır - Her zaman görünür! */}
          {(() => {
            // Motivasyon skorlarını bul (Deep Analysis > Stats Agent > null)
            const motivationScores = (analysis.agents?.deepAnalysis as any)?.motivationScores || 
                                    (analysis.agents?.stats as any)?.motivationScores || 
                                    null;
            
            if (!motivationScores) return null;
            
            return (
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border-2 border-purple-500/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">💪</span>
                  <h5 className="text-white font-bold text-lg">MACA HAZIRLANMA & MOTİVASYON ANALİZİ (0-100)</h5>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Ev Sahibi */}
                  <div className="bg-black/30 rounded-lg p-3 border border-purple-500/30">
                    <p className="text-xs text-gray-400 mb-2">🏠 EV SAHİBİ</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-3xl font-bold ${motivationScores.home >= 70 ? 'text-green-400' : motivationScores.home >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {motivationScores.home}
                      </span>
                      <span className="text-gray-400 text-sm">/100</span>
                      {motivationScores.homeTrend === 'improving' && <span className="text-green-400 text-xl">📈</span>}
                      {motivationScores.homeTrend === 'declining' && <span className="text-red-400 text-xl">📉</span>}
                      {motivationScores.homeTrend === 'stable' && <span className="text-gray-400 text-xl">➡️</span>}
                    </div>
                    {motivationScores.homeFormGraph && (
                      <p className="text-gray-300 text-xs mb-1">Form: <span className="font-mono">{motivationScores.homeFormGraph}</span></p>
                    )}
                    <div className={`h-2 rounded-full mt-2 ${motivationScores.home >= 70 ? 'bg-green-500' : motivationScores.home >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${motivationScores.home}%` }}></div>
                  </div>
                  
                  {/* Deplasman */}
                  <div className="bg-black/30 rounded-lg p-3 border border-purple-500/30">
                    <p className="text-xs text-gray-400 mb-2">✈️ DEPLASMAN</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-3xl font-bold ${motivationScores.away >= 70 ? 'text-green-400' : motivationScores.away >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {motivationScores.away}
                      </span>
                      <span className="text-gray-400 text-sm">/100</span>
                      {motivationScores.awayTrend === 'improving' && <span className="text-green-400 text-xl">📈</span>}
                      {motivationScores.awayTrend === 'declining' && <span className="text-red-400 text-xl">📉</span>}
                      {motivationScores.awayTrend === 'stable' && <span className="text-gray-400 text-xl">➡️</span>}
                    </div>
                    {motivationScores.awayFormGraph && (
                      <p className="text-gray-300 text-xs mb-1">Form: <span className="font-mono">{motivationScores.awayFormGraph}</span></p>
                    )}
                    <div className={`h-2 rounded-full mt-2 ${motivationScores.away >= 70 ? 'bg-green-500' : motivationScores.away >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${motivationScores.away}%` }}></div>
                  </div>
                </div>
                {motivationScores.reasoning && (
                  <p className="text-gray-300 text-xs mt-3 pt-3 border-t border-purple-500/30">{motivationScores.reasoning}</p>
                )}
                <div className="mt-3 text-xs text-gray-400">
                  <p>💡 <strong>Skor Anlamı:</strong> 70-100 = Çok hazır, 50-69 = Normal, 30-49 = Hazırlıksız, 0-29 = Çok kötü durum</p>
                </div>
              </div>
            );
          })()}

          {/* SPORTMONKS VERİ BAZLI MAÇ SONUCU */}
          {analysis.matchResult && (
            <div className="bg-yellow-500/10 rounded-lg border border-yellow-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h5 className="text-white font-bold text-lg">📊 SPORTMONKS VERİ BAZLI MAÇ SONUCU TAHMİNİ</h5>
              </div>
              
              <div className="space-y-2 text-sm">
                <p className="text-gray-300 mb-2"><strong>Sistem:</strong> Puan bazlı hesaplama (Agent'ların kendi tahmin seçenekleri yok, sadece veri bazlı)</p>
                <div className="bg-black/20 rounded p-2">
                  <p className="text-white font-semibold">Tahmin: <span className="text-yellow-400">{
                    analysis.matchResult.prediction === 'home' || analysis.matchResult.prediction === '1' ? 'Ev Sahibi' : 
                    analysis.matchResult.prediction === 'away' || analysis.matchResult.prediction === '2' ? 'Deplasman' : 
                    'Beraberlik'
                  }</span> (%{Math.round(analysis.matchResult.confidence)} güven)</p>
                  {analysis.matchResult.reasoning && (
                    <div className="text-gray-400 text-xs mt-2 whitespace-pre-line">{analysis.matchResult.reasoning}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 🆕 MASTER STRATEGIST AGENT */}
          {masterStrategist && (
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-lg border border-purple-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-400" />
                <h5 className="text-white font-bold text-lg">🎯 MASTER STRATEGIST AGENT (Üst-Akıl Konsensüs)</h5>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-300 mb-2"><strong>Görevi:</strong> Tüm agent'ların çıktılarını analiz eder, tutarsızlıkları tespit eder ve ağırlıklı konsensüs oluşturur.</p>
                </div>

                {/* Main Take */}
                {masterStrategist.main_take && (
                  <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 p-3">
                    <p className="text-purple-400 font-semibold mb-2">📋 ANA GÖRÜŞ:</p>
                    <p className="text-gray-300 text-sm">{masterStrategist.main_take}</p>
                  </div>
                )}

                {/* Signals */}
                {masterStrategist.signals && masterStrategist.signals.length > 0 && (
                  <div className="bg-indigo-500/10 rounded-lg border border-indigo-500/30 p-3">
                    <p className="text-indigo-400 font-semibold mb-2">📊 GÜÇLÜ SİNYALLER:</p>
                    <ul className="text-gray-300 text-xs space-y-1">
                      {masterStrategist.signals.map((signal: string, i: number) => (
                        <li key={i}>• {signal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Bets */}
                {masterStrategist.recommended_bets && masterStrategist.recommended_bets.length > 0 && (
                  <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-3">
                    <p className="text-green-400 font-semibold mb-2">💰 ÖNERİLEN BAHİSLER:</p>
                    <div className="space-y-2">
                      {masterStrategist.recommended_bets.map((bet: any, i: number) => (
                        <div key={i} className="bg-black/20 rounded p-2">
                          <p className="text-white font-semibold">
                            {bet.market} → <span className="text-green-400">{bet.selection}</span>
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs">
                            <span className="text-gray-300">Olasılık: <span className="text-purple-400">%{Math.round((bet.model_prob || 0) * 100)}</span></span>
                            <span className="text-gray-300">Oran: <span className="text-yellow-400">@{bet.market_odds}</span></span>
                            <span className="text-gray-300">Edge: <span className="text-green-400">+{Math.round((bet.edge || 0) * 100)}%</span></span>
                          </div>
                          {bet.rationale && Array.isArray(bet.rationale) && (
                            <ul className="text-gray-400 text-xs mt-1 space-y-0.5">
                              {bet.rationale.map((r: string, j: number) => (
                                <li key={j}>• {r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {masterStrategist.risks && masterStrategist.risks.length > 0 && (
                  <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-3">
                    <p className="text-red-400 font-semibold mb-2">⚠️ RİSKLER:</p>
                    <ul className="text-gray-300 text-xs space-y-1">
                      {masterStrategist.risks.map((risk: string, i: number) => (
                        <li key={i}>• {risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Yeni format: final.primary_pick ve final.surprise_pick */}
                {masterStrategist.final && (
                  <div className="border-t border-purple-500/30 pt-3 mt-3">
                    <p className="text-purple-400 font-semibold mb-2">FİNAL TAHMİNLER:</p>
                    <div className="space-y-3">
                      {/* Primary Pick */}
                      {masterStrategist.final.primary_pick && (
                        <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-lg border border-purple-500/40 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🎯</span>
                            <p className="text-white font-bold">ANA TAHMİN (Primary Pick)</p>
                          </div>
                          <p className="text-white font-semibold">
                            <span className="text-purple-400">{masterStrategist.final.primary_pick.market}</span> → 
                            <span className="text-green-400 ml-2">{masterStrategist.final.primary_pick.selection}</span>
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-gray-300">Güven: <span className="text-purple-400 font-bold">%{masterStrategist.final.primary_pick.confidence}</span></span>
                            <span className="text-gray-300">Oran: <span className="text-yellow-400 font-bold">@{masterStrategist.final.primary_pick.market_odds}</span></span>
                            <span className="text-gray-300">Edge: <span className="text-green-400 font-bold">+{Math.round((masterStrategist.final.primary_pick.edge || 0) * 100)}%</span></span>
                          </div>
                          {masterStrategist.final.primary_pick.rationale && Array.isArray(masterStrategist.final.primary_pick.rationale) && (
                            <ul className="text-gray-400 text-xs mt-2 space-y-1">
                              {masterStrategist.final.primary_pick.rationale.map((r: string, i: number) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      
                      {/* Surprise Pick */}
                      {masterStrategist.final.surprise_pick && (
                        <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/40 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🔥</span>
                            <p className="text-white font-bold">SÜRPRİZ TAHMİN (Surprise Pick)</p>
                          </div>
                          <p className="text-white font-semibold">
                            <span className="text-orange-400">{masterStrategist.final.surprise_pick.market}</span> → 
                            <span className="text-red-400 ml-2">{masterStrategist.final.surprise_pick.selection}</span>
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-gray-300">Güven: <span className="text-orange-400 font-bold">%{masterStrategist.final.surprise_pick.confidence}</span></span>
                            <span className="text-gray-300">Oran: <span className="text-yellow-400 font-bold">@{masterStrategist.final.surprise_pick.market_odds}</span></span>
                            <span className="text-gray-300">Edge: <span className="text-green-400 font-bold">+{Math.round((masterStrategist.final.surprise_pick.edge || 0) * 100)}%</span></span>
                          </div>
                          {masterStrategist.final.surprise_pick.rationale && Array.isArray(masterStrategist.final.surprise_pick.rationale) && (
                            <ul className="text-gray-400 text-xs mt-2 space-y-1">
                              {masterStrategist.final.surprise_pick.rationale.map((r: string, i: number) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}
                          {masterStrategist.final.why_this_is_surprise && (
                            <p className="text-orange-300 text-xs mt-2 italic">💡 {masterStrategist.final.why_this_is_surprise}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Hedge */}
                      {masterStrategist.final.hedge && (
                        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-500/40 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🛡️</span>
                            <p className="text-white font-bold">HEDGE (Koruma)</p>
                          </div>
                          <p className="text-white font-semibold">
                            <span className="text-blue-400">{masterStrategist.final.hedge.market}</span> → 
                            <span className="text-cyan-400 ml-2">{masterStrategist.final.hedge.selection}</span>
                          </p>
                          {masterStrategist.final.hedge.rationale && Array.isArray(masterStrategist.final.hedge.rationale) && (
                            <ul className="text-gray-400 text-xs mt-2 space-y-1">
                              {masterStrategist.final.hedge.rationale.map((r: string, i: number) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      
                      {/* Contradictions */}
                      {masterStrategist.final.contradictions_found && masterStrategist.final.contradictions_found.length > 0 && (
                        <div className="bg-yellow-500/10 rounded-lg border border-yellow-500/30 p-3">
                          <p className="text-yellow-400 font-semibold mb-2">⚠️ TESPİT EDİLEN TUTARSIZLIKLAR:</p>
                          <ul className="text-gray-300 text-xs space-y-1">
                            {masterStrategist.final.contradictions_found.map((c: string, i: number) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Eski format: finalConsensus (backward compatibility) */}
                {!masterStrategist.final && masterStrategist.finalConsensus && (
                  <div className="border-t border-purple-500/30 pt-3 mt-3">
                    <p className="text-purple-400 font-semibold mb-2">FİNAL KONSENSÜS:</p>
                    <div className="space-y-2">
                      {masterStrategist.finalConsensus.matchResult && (
                        <div className="bg-black/20 rounded p-2">
                          <p className="text-white font-semibold">Maç Sonucu: <span className="text-purple-400">{masterStrategist.finalConsensus.matchResult.prediction === '1' ? 'Ev Sahibi' : masterStrategist.finalConsensus.matchResult.prediction === '2' ? 'Deplasman' : 'Beraberlik'}</span> (%{masterStrategist.finalConsensus.matchResult.confidence} güven)</p>
                          {masterStrategist.finalConsensus.matchResult.reasoning && <p className="text-gray-400 text-xs mt-1">{masterStrategist.finalConsensus.matchResult.reasoning}</p>}
                        </div>
                      )}
                      {masterStrategist.finalConsensus.overUnder && (
                        <div className="bg-black/20 rounded p-2">
                          <p className="text-white font-semibold">Over/Under 2.5: <span className="text-purple-400">{masterStrategist.finalConsensus.overUnder.prediction}</span> (%{masterStrategist.finalConsensus.overUnder.confidence} güven)</p>
                          {masterStrategist.finalConsensus.overUnder.reasoning && <p className="text-gray-400 text-xs mt-1">{masterStrategist.finalConsensus.overUnder.reasoning}</p>}
                        </div>
                      )}
                      {masterStrategist.finalConsensus.btts && (
                        <div className="bg-black/20 rounded p-2">
                          <p className="text-white font-semibold">BTTS: <span className="text-purple-400">{masterStrategist.finalConsensus.btts.prediction}</span> (%{masterStrategist.finalConsensus.btts.confidence} güven)</p>
                          {masterStrategist.finalConsensus.btts.reasoning && <p className="text-gray-400 text-xs mt-1">{masterStrategist.finalConsensus.btts.reasoning}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {masterStrategist.overallConfidence && (
                  <div className="bg-purple-500/20 rounded p-2">
                    <p className="text-purple-400 font-semibold">Toplam Güven: %{masterStrategist.overallConfidence}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🆕 GENIUS ANALYST AGENT */}
          {geniusAnalyst && (
            <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 rounded-lg border border-amber-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-amber-400" />
                <h5 className="text-white font-bold text-lg">🧠 GENIUS ANALYST AGENT (Matematiksel & Taktiksel Analiz)</h5>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-300 mb-2"><strong>Görevi:</strong> Matematiksel modelleme (xG, Poisson), taktiksel analiz, value betting ve risk senaryoları.</p>
                </div>

                {geniusAnalyst.predictions && (
                  <div className="border-t border-amber-500/30 pt-3 mt-3">
                    <p className="text-amber-400 font-semibold mb-2">TAHMİNLER:</p>
                    <div className="space-y-2">
                      {geniusAnalyst.predictions.matchResult && (
                        <div className="bg-black/20 rounded p-2">
                          <p className="text-white font-semibold">Maç Sonucu: <span className="text-amber-400">{geniusAnalyst.predictions.matchResult.prediction === '1' ? 'Ev Sahibi' : geniusAnalyst.predictions.matchResult.prediction === '2' ? 'Deplasman' : 'Beraberlik'}</span> (%{geniusAnalyst.predictions.matchResult.confidence} güven)</p>
                          {geniusAnalyst.predictions.matchResult.reasoning && <p className="text-gray-400 text-xs mt-1">{geniusAnalyst.predictions.matchResult.reasoning}</p>}
                        </div>
                      )}
                      {geniusAnalyst.predictions.overUnder && (
                        <div className="bg-black/20 rounded p-2">
                          <p className="text-white font-semibold">Over/Under 2.5: <span className="text-amber-400">{geniusAnalyst.predictions.overUnder.prediction}</span> (%{geniusAnalyst.predictions.overUnder.confidence} güven)</p>
                          {geniusAnalyst.predictions.overUnder.reasoning && <p className="text-gray-400 text-xs mt-1">{geniusAnalyst.predictions.overUnder.reasoning}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {geniusAnalyst.mathematicalModel && (
                  <div className="bg-black/20 rounded p-2 text-xs">
                    <p className="text-amber-400 font-semibold mb-1">Matematiksel Model:</p>
                    <p className="text-gray-300">Ev xG: {geniusAnalyst.mathematicalModel.homeExpectedGoals?.toFixed(2) || 'N/A'}</p>
                    <p className="text-gray-300">Dep xG: {geniusAnalyst.mathematicalModel.awayExpectedGoals?.toFixed(2) || 'N/A'}</p>
                    <p className="text-gray-300">Toplam xG: {geniusAnalyst.mathematicalModel.totalExpectedGoals?.toFixed(2) || 'N/A'}</p>
                  </div>
                )}

                {/* 🔥 CESUR TAHMİN (BOLD BET) */}
                {geniusAnalyst.boldBet && (
                  <div className="border-t border-amber-500/30 pt-3 mt-3">
                    <div className="bg-gradient-to-r from-red-900/60 to-orange-900/60 rounded-lg border-2 border-red-500/50 p-4 relative overflow-hidden">
                      {/* Arka plan efekti */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.1),transparent_70%)]"></div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🔥</span>
                            <h6 className="text-red-400 font-bold text-lg">CESUR TAHMİN</h6>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-red-500/30 text-red-300 text-xs px-2 py-1 rounded-full border border-red-500/50">
                              {geniusAnalyst.boldBet.riskLevel === 'extreme' ? '💀 EXTREM RİSK' : 
                               geniusAnalyst.boldBet.riskLevel === 'very-high' ? '⚠️ ÇOK YÜKSEK' : '⚡ YÜKSEK'}
                            </span>
                            <span className="bg-green-500/30 text-green-300 text-sm px-2 py-1 rounded-full border border-green-500/50 font-bold">
                              {geniusAnalyst.boldBet.potentialReturn}
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-black/40 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-bold text-xl">{geniusAnalyst.boldBet.type}</span>
                            <span className="text-yellow-400 font-bold text-lg">@ {geniusAnalyst.boldBet.odds?.toFixed(2) || '?'}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-400 text-xs">📋 Senaryo:</p>
                            <p className="text-white">{geniusAnalyst.boldBet.scenario}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">💡 Neden?</p>
                            <p className="text-gray-300">{geniusAnalyst.boldBet.reasoning}</p>
                          </div>
                          {geniusAnalyst.boldBet.historicalHit && (
                            <div>
                              <p className="text-gray-400 text-xs">📊 Tarihsel:</p>
                              <p className="text-gray-300">{geniusAnalyst.boldBet.historicalHit}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-red-500/30">
                          <p className="text-red-300 text-xs flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Güven: %{geniusAnalyst.boldBet.confidence} - Yüksek risk! Sadece kaybetmeyi göze alabileceğin miktarla oyna.</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOP 3 TAHMİN */}
          {analysis.top3Predictions && analysis.top3Predictions.length > 0 && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-cyan-400" />
                <h5 className="text-white font-bold text-lg">🏆 TOP 3 TAHMİN (Agent'ların Birleşik Analizi)</h5>
              </div>
              
              <div className="space-y-2 text-sm">
                <p className="text-gray-300 mb-3">Sistem, tüm agent'ların tahminlerini toplayıp en yüksek güven ve agent desteğine göre sıralar:</p>
                {analysis.top3Predictions.map((pred, idx) => (
                  <div key={idx} className="bg-black/20 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-cyan-400 font-bold">#{pred.rank} {pred.market}</span>
                      <span className="text-white font-semibold">%{pred.confidence} güven</span>
                    </div>
                    <p className="text-white font-semibold mb-1">{pred.selection}</p>
                    <p className="text-gray-400 text-xs mb-1">{pred.reasoning}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-gray-500 text-xs">Agent Desteği:</span>
                      {pred.agentSupport.map((agent, i) => (
                        <span key={i} className="text-cyan-400 text-xs bg-cyan-500/10 px-2 py-0.5 rounded">{agent}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = (translations[lang as keyof typeof translations] || translations.en) as any;
  
  // States
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [analysis, setAnalysis] = useState<SmartAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  
  // 🔥 Cesur Tahmin State'leri
  const [boldBet, setBoldBet] = useState<{
    type: string;
    odds: number;
    confidence: number;
    reasoning: string;
    scenario: string;
    riskLevel: 'high' | 'very-high' | 'extreme';
    potentialReturn: string;
    historicalHit?: string;
  } | null>(null);
  const [loadingBoldBet, setLoadingBoldBet] = useState(false);
  const [boldBetError, setBoldBetError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [analysisType, setAnalysisType] = useState<'ai' | 'agent'>('agent'); // 🆕 Agent Analysis ana sistem
  const [showPaywall, setShowPaywall] = useState(false);
  const [accessStatus, setAccessStatus] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  
  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // ============================================================================
  // FETCH FIXTURES
  // ============================================================================
  
  const fetchFixtures = useCallback(async () => {
    setLoading(true);
    try {
      const leagueParam = selectedLeague !== 'all' ? `&league_id=${selectedLeague}` : '';
      const res = await fetch(`/api/v2/fixtures?date=${selectedDate}${leagueParam}`);
      const data = await res.json();
      
      if (data.success) {
        setFixtures(data.fixtures);
        setLeagues(data.leagues || []);
        setTotalCount(data.totalCount || data.count);
        setCached(data.cached);
      }
    } catch (error) {
      console.error('Fetch fixtures error:', error);
    }
    setLoading(false);
  }, [selectedDate, selectedLeague]);
  
  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  // Query parametresinden fixture ID'yi oku ve maçı seç
  useEffect(() => {
    const fixtureIdParam = searchParams.get('fixture');
    if (fixtureIdParam && fixtures.length > 0) {
      const fixtureId = parseInt(fixtureIdParam);
      const fixture = fixtures.find(f => f.id === fixtureId);
      
      if (fixture && (!selectedFixture || selectedFixture.id !== fixtureId)) {
        console.log('Fixture from URL:', fixtureId, fixture);
        setSelectedFixture(fixture);
        
        // Eğer analiz yoksa, analiz yap
        if (!analysis || analysis.fixtureId !== fixtureId) {
          // Favorilerden analiz verisini çek
          fetchFavoriteAnalysis(fixtureId).then(favoriteAnalysis => {
            if (favoriteAnalysis) {
              console.log('Using favorite analysis');
              setAnalysis(favoriteAnalysis);
              setAnalysisType('agent');
            } else {
              // Favorilerde yoksa yeni analiz yap
              console.log('No favorite analysis, running new analysis');
              analyzeMatch(fixture, false);
            }
          });
        }
        
        // URL'den query parametresini temizle
        router.replace('/dashboard', { scroll: false });
      }
    }
  }, [searchParams, fixtures, selectedFixture, analysis]);

  // Favorilerden analiz verisini çek
  const fetchFavoriteAnalysis = async (fixtureId: number): Promise<SmartAnalysis | null> => {
    try {
      const res = await fetch('/api/user/favorites');
      const data = await res.json();
      
      if (data.success && data.favorites) {
        const favorite = data.favorites.find((f: any) => f.fixture_id === fixtureId);
        if (favorite && favorite.analysis_data) {
          // Favorilerden gelen analiz verisini SmartAnalysis formatına dönüştür
          const analysisData = favorite.analysis_data;
          
          // Eğer analysis_data bir SmartAnalysis objesi ise direkt kullan
          if (analysisData.fixtureId && analysisData.homeTeam) {
            return analysisData as SmartAnalysis;
          }
          
          // Eğer unified analysis formatındaysa dönüştür
          if (analysisData.predictions) {
            return {
              fixtureId: fixtureId,
              homeTeam: favorite.home_team,
              awayTeam: favorite.away_team,
              league: favorite.league || '',
              matchDate: favorite.match_date?.split('T')[0] || '',
              matchResult: analysisData.predictions.matchResult ? {
                prediction: analysisData.predictions.matchResult.prediction,
                confidence: analysisData.predictions.matchResult.confidence,
                reasoning: analysisData.predictions.matchResult.reasoning || ''
              } : undefined,
              overUnder: analysisData.predictions.overUnder ? {
                prediction: analysisData.predictions.overUnder.prediction,
                confidence: analysisData.predictions.overUnder.confidence,
                reasoning: analysisData.predictions.overUnder.reasoning || ''
              } : undefined,
              btts: analysisData.predictions.btts ? {
                prediction: analysisData.predictions.btts.prediction,
                confidence: analysisData.predictions.btts.confidence,
                reasoning: analysisData.predictions.btts.reasoning || ''
              } : undefined,
              bestBet: analysisData.bestBet ? {
                market: analysisData.bestBet.market,
                selection: analysisData.bestBet.selection,
                confidence: analysisData.bestBet.confidence,
                reason: analysisData.bestBet.reasoning || ''
              } : {
                market: favorite.best_bet_market || '',
                selection: favorite.best_bet_selection || '',
                confidence: favorite.best_bet_confidence || 50,
                reason: ''
              },
              agreement: analysisData.systemPerformance?.agreement || 0,
              riskLevel: analysisData.systemPerformance?.riskLevel || 'medium',
              overallConfidence: analysisData.systemPerformance?.overallConfidence || favorite.overall_confidence || 50,
              processingTime: analysisData.metadata?.processingTime || 0,
              modelsUsed: analysisData.metadata?.systemsUsed || [],
              analyzedAt: favorite.created_at
            };
          }
        }
      }
    } catch (error) {
      console.error('Fetch favorite analysis error:', error);
    }
    return null;
  };
  
  // ============================================================================
  // ANALYZE MATCH
  // ============================================================================
  
  // Access kontrolü - kullanıcı erişim durumunu kontrol et
  useEffect(() => {
    const checkAccess = async () => {
      if (!session?.user?.email) return;
      
      try {
        const res = await fetch('/api/user/access-status');
        const data = await res.json();
        if (data.success) {
          setAccessStatus(data.access);
        }
      } catch (error) {
        console.error('Access check error:', error);
      }
    };
    
    checkAccess();
  }, [session]);
  
  // 🆕 Unified Analysis - Tek analiz butonu, Agent + AI birleşik sistem
  const analyzeMatch = async (fixture: Fixture, forceRefresh: boolean = false) => {
    // Access kontrolü
    if (accessStatus && !accessStatus.canAnalyze) {
      setShowPaywall(true);
      return;
    }
    
    setSelectedFixture(fixture);
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    
    try {
      // Unified Consensus System endpoint
      const endpoint = '/api/unified/analyze';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: fixture.id,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          league: fixture.league,
          matchDate: fixture.date.split('T')[0],
          skipCache: forceRefresh,
          lang: lang // Dil parametresini API'ye gönder
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Unified analysis formatını SmartAnalysis formatına dönüştür (UI uyumluluğu için)
        const unifiedAnalysis = data.analysis;
        const convertedAnalysis: SmartAnalysis = {
          fixtureId: fixture.id,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          league: fixture.league,
          matchDate: fixture.date.split('T')[0],
          agents: {
            stats: unifiedAnalysis.sources?.agents?.stats,
            odds: unifiedAnalysis.sources?.agents?.odds,
            deepAnalysis: unifiedAnalysis.sources?.agents?.deepAnalysis,
            masterStrategist: unifiedAnalysis.sources?.agents?.masterStrategist,
            geniusAnalyst: unifiedAnalysis.sources?.agents?.geniusAnalyst
          },
          matchResult: {
            prediction: unifiedAnalysis.predictions.matchResult.prediction,
            confidence: unifiedAnalysis.predictions.matchResult.confidence,
            reasoning: unifiedAnalysis.predictions.matchResult.reasoning
          },
          top3Predictions: [
            {
              rank: 1,
              market: unifiedAnalysis.bestBet.market,
              selection: unifiedAnalysis.bestBet.selection,
              confidence: unifiedAnalysis.bestBet.confidence,
              reasoning: unifiedAnalysis.bestBet.reasoning,
              agentSupport: ['Unified Consensus']
            }
          ],
          bestBet: {
            market: unifiedAnalysis.bestBet.market,
            selection: unifiedAnalysis.bestBet.selection,
            confidence: unifiedAnalysis.bestBet.confidence,
            reason: unifiedAnalysis.bestBet.reasoning
          },
          agreement: unifiedAnalysis.systemPerformance.agreement,
          riskLevel: unifiedAnalysis.systemPerformance.riskLevel,
          overallConfidence: unifiedAnalysis.systemPerformance.overallConfidence,
          dataQuality: unifiedAnalysis.systemPerformance.dataQuality,
          processingTime: unifiedAnalysis.metadata.processingTime,
          modelsUsed: unifiedAnalysis.metadata.systemsUsed || ['unified-consensus'],
          analyzedAt: unifiedAnalysis.metadata.analyzedAt
        };
        
        setAnalysis(convertedAnalysis);
        setAnalysisType('agent'); // Unified system = agent formatında göster
        
        // Update fixture hasAnalysis status
        setFixtures(prev => prev.map(f => 
          f.id === fixture.id ? { ...f, hasAnalysis: true } : f
        ));
      } else {
        setAnalysisError(data.error || 'Analiz başarısız');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError('Bağlantı hatası');
    }
    
    setAnalyzing(false);
  };
  
  // ============================================================================
  // 🔥 CESUR TAHMİN (BOLD BET) - Ayrı Endpoint
  // ============================================================================
  
  // selectedFixture değiştiğinde boldBet state'ini temizle (cache sorunu önleme)
  useEffect(() => {
    setBoldBet(null);
    setBoldBetError(null);
  }, [selectedFixture?.id]);
  
  const fetchBoldBet = async () => {
    if (!selectedFixture) return;
    
    setLoadingBoldBet(true);
    setBoldBetError(null);
    setBoldBet(null);
    
    try {
      const res = await fetch('/api/genius/bold-bet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store', // Cache'i devre dışı bırak
        body: JSON.stringify({
          fixtureId: selectedFixture.id,
          language: lang
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.boldBet) {
        setBoldBet(data.boldBet);
      } else {
        setBoldBetError(data.error || 'Cesur tahmin alınamadı');
      }
    } catch (error) {
      console.error('Bold Bet error:', error);
      setBoldBetError('Bağlantı hatası');
    }
    
    setLoadingBoldBet(false);
  };

  // Favoriye ekle/kaldır
  const toggleFavorite = async () => {
    if (!selectedFixture || !analysis) return;
    
    setSavingFavorite(true);
    const newFavoriteStatus = !isFavorite;
    
    try {
      const res = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: selectedFixture.id,
          isFavorite: newFavoriteStatus,
          analysis: analysis, // Unified analysis verisi
          geniusAnalysis: boldBet ? { boldBet } : null, // Genius analizi varsa ekle
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setIsFavorite(newFavoriteStatus);
        console.log(newFavoriteStatus ? '✅ Favoriye eklendi' : '❌ Favorilerden kaldırıldı');
      } else {
        console.error('Favorite error:', data.error);
        console.error('Error details:', data.details);
        alert(`Favoriye eklenirken hata: ${data.error || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      console.error('Favorite toggle error:', error);
    }
    
    setSavingFavorite(false);
  };

  // Favori durumunu kontrol et
  useEffect(() => {
    if (!selectedFixture?.id) {
      setIsFavorite(false);
      return;
    }
    
    const checkFavorite = async () => {
      try {
        const res = await fetch(`/api/user/favorites?fixtureId=${selectedFixture.id}`);
        const data = await res.json();
        if (data.success) {
          setIsFavorite(data.isFavorite || false);
        }
      } catch (error) {
        console.error('Check favorite error:', error);
      }
    };
    
    checkFavorite();
  }, [selectedFixture?.id]);
  
  // ============================================================================
  // FILTER FIXTURES
  // ============================================================================
  
  const filteredFixtures = fixtures.filter(f => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return f.homeTeam.toLowerCase().includes(query) ||
           f.awayTeam.toLowerCase().includes(query) ||
           f.league.toLowerCase().includes(query);
  });
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black relative">
      {/* Header - Futuristic Design */}
      <header className="border-b border-[#00f0ff]/30 glass-futuristic sticky top-0 z-50">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo - Neon Glow */}
          <motion.div 
            className="flex items-center gap-4"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#ff00f0] flex items-center justify-center neon-border-cyan relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <SimpleFootballIcon className="w-8 h-8" />
                </div>
                <Zap className="w-5 h-5 text-white relative z-10" />
              </div>
              <div className="absolute inset-0 rounded-lg bg-[#00f0ff] opacity-20 blur-xl animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                {t.title}
              </h1>
              <p className="text-xs text-[#00f0ff] font-medium tracking-wider uppercase">{t.subtitle}</p>
            </div>
          </motion.div>
          
          {/* Right Controls - Futuristic */}
          <div className="flex items-center gap-3 sm:gap-4">
            {cached && (
              <motion.span 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden sm:flex text-xs text-[#00ff88] items-center gap-2 px-3 py-1.5 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30"
              >
                <Zap className="w-3 h-3" /> {t.cached}
              </motion.span>
            )}
            
            <motion.button
              onClick={fetchFixtures}
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              className="p-2.5 rounded-lg glass-futuristic hover:neon-border-cyan transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-[#00f0ff] ${loading ? 'animate-spin' : ''}`} />
            </motion.button>
            
            <motion.div whileHover={{ scale: 1.05 }}>
              <Link
                href="/performance"
                className="p-2.5 rounded-lg glass-futuristic hover:neon-border-cyan transition-all"
                title="Performans Takibi"
              >
                <BarChart3 className="w-5 h-5 text-[#00f0ff]" />
              </Link>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }}>
              <Link
                href="/favorites"
                className="p-2.5 rounded-lg glass-futuristic hover:neon-border-cyan transition-all"
                title="Favorilerim"
              >
                <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
              </Link>
            </motion.div>
            
            <LanguageSelector />
            
            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="hidden sm:block text-white text-sm truncate max-w-[100px]">
                  {session?.user?.name || session?.user?.email?.split('@')[0]}
                </span>
              </button>
              
              {showProfileMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <motion.div 
                    className="absolute right-0 mt-2 w-64 glass-futuristic rounded-2xl border neon-border-cyan shadow-2xl z-50 overflow-hidden"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-4 border-b border-[#00f0ff]/20 bg-black/20">
                      <p className="text-white font-bold truncate" style={{ fontFamily: 'var(--font-heading)' }}>
                        {session?.user?.name}
                      </p>
                      <p className="text-xs text-[#00f0ff] font-mono truncate mt-1">{session?.user?.email}</p>
                    </div>
                    
                    <div className="py-2">
                      <motion.div whileHover={{ x: 5 }}>
                      <Link
                        href="/profile"
                          className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-[#00f0ff]/10 transition-all group"
                        onClick={() => setShowProfileMenu(false)}
                      >
                          <User className="w-5 h-5 text-[#00f0ff] group-hover:scale-110 transition-transform" />
                          <span className="font-medium">{t.profile}</span>
                      </Link>
                      </motion.div>
                      <motion.div whileHover={{ x: 5 }}>
                      <Link
                        href="/settings"
                          className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-[#00f0ff]/10 transition-all group"
                        onClick={() => setShowProfileMenu(false)}
                      >
                          <Settings className="w-5 h-5 text-[#00f0ff] group-hover:scale-110 transition-transform" />
                          <span className="font-medium">{t.settings}</span>
                      </Link>
                      </motion.div>
                      <motion.div whileHover={{ x: 5 }}>
                      <Link
                          href="/performance"
                          className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-[#00ff88]/10 transition-all group"
                        onClick={() => setShowProfileMenu(false)}
                      >
                          <BarChart3 className="w-5 h-5 text-[#00ff88] group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Performans Takibi</span>
                      </Link>
                      </motion.div>
                      <motion.div whileHover={{ x: 5 }}>
                        <Link
                          href="/odds-analysis"
                          className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-[#00ff88]/10 transition-all group"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <TrendingUp className="w-5 h-5 text-[#00ff88] group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Odds Analiz Kayıtları</span>
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ x: 5 }}>
                        <Link
                          href="/odds-patterns"
                          className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-[#00f0ff]/10 transition-all group"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <BarChart3 className="w-5 h-5 text-[#00f0ff] group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Pattern Analizi</span>
                        </Link>
                      </motion.div>
                    </div>
                    
                    <div className="border-t border-[#00f0ff]/20 py-2">
                      <motion.button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex items-center gap-3 px-4 py-3 w-full text-[#ff00f0] hover:bg-[#ff00f0]/10 transition-all group"
                        whileHover={{ x: 5 }}
                      >
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="font-medium">{t.logout}</span>
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
        </motion.div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Fixtures List - Futuristic Cards */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-1 space-y-5"
          >
            {/* Date Picker - Neon Style */}
            <motion.div 
              className="glass-futuristic rounded-2xl p-5 neon-border-cyan"
              whileHover={{ scale: 1.02, borderColor: 'rgba(0, 240, 255, 0.5)' }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#00f0ff]/20 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-[#00f0ff]" />
                </div>
                <span className="text-white font-semibold tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
                  {t.selectDate}
                </span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedLeague('all');
                  setSelectedFixture(null);
                  setAnalysis(null);
                }}
                className="w-full bg-black/40 border border-[#00f0ff]/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00f0ff] transition-all cursor-pointer appearance-none"
                style={{ 
                  fontFamily: 'var(--font-body)',
                  colorScheme: 'dark'
                }}
              />
            </motion.div>
            
            {/* League Selector - Neon Style */}
            <motion.div 
              className="glass-futuristic rounded-2xl p-5 neon-border-cyan"
              whileHover={{ scale: 1.02, borderColor: 'rgba(0, 240, 255, 0.5)' }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#ffff00]/20 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-[#ffff00]" />
                </div>
                <span className="text-white font-semibold tracking-wide flex-1" style={{ fontFamily: 'var(--font-heading)' }}>
                  {t.selectLeague}
                </span>
                <span className="text-xs text-[#00f0ff] font-mono bg-[#00f0ff]/10 px-2 py-1 rounded">
                  {totalCount}
                </span>
              </div>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full bg-black/40 border border-[#00f0ff]/30 rounded-lg px-4 py-3 text-white appearance-none cursor-pointer focus:outline-none focus:neon-border-cyan transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <option value="all" className="bg-black">{t.allLeagues} ({totalCount})</option>
                {leagues.map(league => (
                  <option key={league.id} value={league.id} className="bg-black">
                    {league.name} ({league.count})
                  </option>
                ))}
              </select>
            </motion.div>
            
            {/* Search - Futuristic */}
            <motion.div 
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00f0ff]" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full glass-futuristic rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:neon-border-cyan transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </motion.div>
            
            {/* Fixtures - Futuristic Cards */}
            <motion.div 
              className="glass-futuristic rounded-2xl overflow-hidden neon-border-cyan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="p-4 border-b border-[#00f0ff]/20 flex items-center justify-between bg-black/20">
                <span className="text-white font-bold flex items-center gap-2 tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
                  <Trophy className="w-5 h-5 text-[#ffff00]" />
                  {t.matches}
                </span>
                <span className="text-[#00f0ff] text-sm font-mono bg-[#00f0ff]/10 px-2 py-1 rounded">
                  {filteredFixtures.length}
                </span>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="p-12 flex flex-col items-center justify-center">
                    <motion.div 
                      className="w-12 h-12 border-2 border-[#00f0ff] border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <p className="mt-4 text-[#00f0ff] text-sm">Loading...</p>
                  </div>
                ) : filteredFixtures.length === 0 ? (
                  <div className="p-12 text-center">
                    <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">{t.noMatches}</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredFixtures.map((fixture, index) => (
                      <motion.button
                      key={fixture.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        setSelectedFixture(fixture);
                        setAnalysis(null);
                        setAnalysisError(null);
                      }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        className={`w-full p-4 border-b border-[#00f0ff]/10 hover:bg-[#00f0ff]/5 transition-all text-left relative overflow-hidden group ${
                          selectedFixture?.id === fixture.id 
                            ? 'bg-[#00f0ff]/10 border-l-4 border-l-[#00f0ff]' 
                            : ''
                        }`}
                      >
                        {selectedFixture?.id === fixture.id && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/10 to-transparent"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            transition={{ duration: 0.3 }}
                          />
                        )}
                        <div className="flex items-center justify-between relative z-10">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                            {fixture.homeTeamLogo && (
                                <img src={fixture.homeTeamLogo} alt="" className="w-6 h-6 object-contain" />
                            )}
                              <span className="text-white text-sm font-semibold truncate">
                              {fixture.homeTeam}
                            </span>
                            {fixture.hasAnalysis && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring" }}
                                >
                                  <CheckCircle className="w-4 h-4 text-[#00ff88]" />
                                </motion.div>
                            )}
                          </div>
                            <div className="flex items-center gap-3">
                            {fixture.awayTeamLogo && (
                                <img src={fixture.awayTeamLogo} alt="" className="w-6 h-6 object-contain" />
                            )}
                            <span className="text-gray-400 text-sm truncate">
                              {fixture.awayTeam}
                            </span>
                          </div>
                        </div>
                          <div className="text-right ml-4">
                            <div className="text-sm text-[#00f0ff] font-mono font-semibold">
                            {new Date(fixture.date).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                            <div className="text-xs text-gray-500 truncate max-w-[100px] mt-1">
                            {fixture.league}
                          </div>
                        </div>
                          <ChevronRight className="w-5 h-5 text-[#00f0ff] ml-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          </motion.div>
          
          {/* Right: Analysis Panel - Futuristic */}
          <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {selectedFixture && !analyzing && !analysis && !analysisError ? (
              <motion.div 
                className="glass-futuristic rounded-2xl p-8 neon-border-cyan"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-3 neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                    Unified Consensus Analysis
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Agent'lar ve AI sistemlerini birleştiren en gelişmiş analiz
                  </p>
                    </div>
                
                <motion.button
                  onClick={() => analyzeMatch(selectedFixture)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full p-8 rounded-2xl border-2 neon-border-cyan bg-gradient-to-br from-[#00f0ff]/10 via-[#ff00f0]/10 to-[#00f0ff]/10 relative overflow-hidden group"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/20 to-[#ff00f0]/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    animate={{ 
                      backgroundPosition: ['0% 0%', '100% 100%'],
                    }}
                    transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
                  />
                  
                  {/* 3D Football Background */}
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div className="absolute top-4 left-4">
                      <FootballBall3D size={60} autoRotate={true} />
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <FootballBall3D size={40} autoRotate={true} />
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-4 relative z-10">
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#00f0ff]/30 to-[#ff00f0]/30 relative">
                      <FootballBall3D size={50} className="absolute" autoRotate={true} />
                      <Target className="w-6 h-6 text-white relative z-10" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-xl block mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                        Analiz Başlat
                      </span>
                      <p className="text-xs text-gray-400 text-center">
                        Stats • Odds • Deep Analysis • Master Strategist • Genius Analyst • AI Systems
                      </p>
                </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Zap className="w-4 h-4 text-[#00f0ff]" />
                      <span className="text-[#00f0ff] text-sm font-mono">~15-20 saniye</span>
              </div>
                  </div>
                </motion.button>
              </motion.div>
            ) : analyzing ? (
              <motion.div 
                className="glass-futuristic rounded-2xl p-8 flex flex-col items-center justify-center min-h-[500px] neon-border-cyan relative overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Background Animation */}
                <div className="absolute inset-0 overflow-hidden">
                  <motion.div
                    className="absolute w-96 h-96 bg-[#00f0ff]/5 rounded-full blur-3xl"
                    animate={{ 
                      x: ['-50%', '150%', '-50%'],
                      y: ['-50%', '50%', '-50%']
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    style={{ left: '-10%', top: '-10%' }}
                  />
                  <motion.div
                    className="absolute w-96 h-96 bg-[#ff00ff]/5 rounded-full blur-3xl"
                    animate={{ 
                      x: ['150%', '-50%', '150%'],
                      y: ['50%', '-50%', '50%']
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    style={{ right: '-10%', bottom: '-10%' }}
                  />
                </div>

                {/* Football Ball Animation */}
                <div className="relative z-10 mb-8">
                  <motion.div
                    className="w-24 h-24 flex items-center justify-center"
                    animate={{ 
                      rotateY: [0, 360],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      rotateY: { duration: 2, repeat: Infinity, ease: "linear" },
                      scale: { duration: 1.5, repeat: Infinity }
                    }}
                  >
                    <span className="text-6xl">⚽</span>
                  </motion.div>
                  
                  {/* Orbit Effect */}
                  <motion.div
                    className="absolute inset-[-20px] border-2 border-[#00f0ff]/30 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <motion.div
                      className="absolute w-3 h-3 bg-[#00f0ff] rounded-full shadow-lg shadow-[#00f0ff]"
                      style={{ top: '-6px', left: '50%', transform: 'translateX(-50%)' }}
                    />
                  </motion.div>
                </div>

                {/* Title */}
                <motion.h3 
                  className="relative z-10 text-2xl font-bold text-white mb-4"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {t.analyzing}
                </motion.h3>

                {/* Agent Progress */}
                <div className="relative z-10 w-full max-w-md space-y-3 mb-6">
                  {[
                    { name: '📊 Stats Agent', delay: 0 },
                    { name: '💰 Odds Agent', delay: 0.3 },
                    { name: '🔬 Deep Analysis', delay: 0.6 },
                    { name: '🧠 Master Strategist', delay: 0.9 },
                  ].map((agent, idx) => (
                    <motion.div
                      key={agent.name}
                      className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: agent.delay }}
                    >
                      <motion.div
                        className="w-5 h-5 border-2 border-[#00f0ff] border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      <span className="text-white/80 text-sm font-medium">{agent.name}</span>
                      <motion.span
                        className="ml-auto text-[#00f0ff] text-xs font-mono"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: agent.delay }}
                      >
                        processing...
                      </motion.span>
                    </motion.div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="relative z-10 w-full max-w-md">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#00f0ff] to-[#ff00ff]"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 15, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="mt-3 text-center text-sm text-[#00f0ff]/70 font-mono">
                    {t.analyzeTime}
                  </p>
                </div>
              </motion.div>
            ) : analysisError ? (
              <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <p className="mt-4 text-red-400 font-medium">{analysisError}</p>
                <button
                  onClick={() => selectedFixture && analyzeMatch(selectedFixture)}
                  className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-sm"
                >
                  {t.tryAgain}
                </button>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* 🆕 Unified Analysis Badge */}
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between bg-gradient-to-r from-[#00f0ff]/10 to-[#ff00f0]/10 rounded-lg p-4 border border-[#00f0ff]/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00f0ff]/30 to-[#ff00f0]/30 flex items-center justify-center relative overflow-hidden">
                      <FootballBall3D size={30} className="absolute" autoRotate={true} />
                      <Target className="w-4 h-4 text-white relative z-10" />
                    </div>
                    <div>
                      <span className="text-white font-bold text-sm block">Unified Consensus Analysis</span>
                      <span className="text-xs text-gray-400">Agent + AI Systems Combined</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cached && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Cached</span>
                    )}
                  <button
                      onClick={() => selectedFixture && analyzeMatch(selectedFixture, true)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title="Yenile"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-400 hover:text-[#00f0ff]" />
                  </button>
                </div>
                </motion.div>
                
                {/* Match Header - Futuristic */}
                <motion.div 
                  className={`glass-futuristic rounded-2xl border p-8 relative overflow-hidden ${
                  analysisType === 'ai'
                      ? 'neon-border-magenta'
                      : 'neon-border-cyan'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f0ff]/5 to-transparent opacity-50" />
                  {/* 3D Football Background Effect */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-4 left-1/4">
                      <FootballBall3D size={40} autoRotate={true} />
                    </div>
                    <div className="absolute bottom-4 right-1/4">
                      <FootballBall3D size={30} autoRotate={true} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="text-center flex-1">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <FootballBall3D size={25} autoRotate={true} />
                      </div>
                      <h3 className="text-2xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                        {analysis.homeTeam}
                      </h3>
                    </div>
                    <div className="px-6 relative">
                      <FootballBall3D size={50} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" autoRotate={true} />
                      <span className={`text-3xl font-black relative z-10 ${
                        analysisType === 'ai' ? 'text-[#ff00f0] neon-glow-magenta' : 'text-[#00f0ff] neon-glow-cyan'
                      }`} style={{ fontFamily: 'var(--font-heading)' }}>
                        VS
                      </span>
                    </div>
                    <div className="text-center flex-1">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <FootballBall3D size={25} autoRotate={true} />
                      </div>
                      <h3 className="text-2xl font-bold text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                        {analysis.awayTeam}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Meta Info - Futuristic */}
                  <div className="mt-6 flex items-center justify-center gap-4 text-sm flex-wrap relative z-10">
                    <motion.span 
                      className={`px-4 py-2 rounded-full font-semibold border ${
                        analysis.riskLevel === 'low' ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30' :
                        analysis.riskLevel === 'medium' ? 'bg-[#ffff00]/10 text-[#ffff00] border-[#ffff00]/30' :
                        'bg-[#ff00f0]/10 text-[#ff00f0] border-[#ff00f0]/30'
                      }`}
                      whileHover={{ scale: 1.1 }}
                    >
                      Risk: {analysis.riskLevel === 'low' ? t.riskLow : analysis.riskLevel === 'medium' ? t.riskMedium : t.riskHigh}
                    </motion.span>
                    <span className="text-[#00f0ff] font-mono bg-[#00f0ff]/10 px-3 py-1.5 rounded">
                      {t.agreement}: %{analysis.agreement}
                    </span>
                    <span className="text-gray-400 font-mono">
                      {analysis.processingTime}ms
                    </span>
                  </div>
                </motion.div>
                
                {/* Predictions Grid - Futuristic Cards */}
                {analysisType === 'ai' && analysis.btts && analysis.overUnder && analysis.matchResult && (
                  <motion.div 
                    className="grid md:grid-cols-3 gap-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, staggerChildren: 0.1 }}
                  >
                    {/* BTTS */}
                    <motion.div 
                      className="glass-futuristic rounded-2xl border p-5 neon-border-cyan relative overflow-hidden group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05, borderColor: 'rgba(0, 240, 255, 0.8)' }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-lg bg-[#00f0ff]/20 flex items-center justify-center">
                          <Target className="w-5 h-5 text-[#00f0ff]" />
                    </div>
                        <h4 className="text-white font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t.btts}</h4>
                      </div>
                      <div className={`text-4xl font-black mb-3 relative z-10 ${
                        analysis.btts.prediction === 'yes' ? 'text-[#00ff88] neon-glow-yellow' : 'text-[#ff00f0] neon-glow-magenta'
                      }`} style={{ fontFamily: 'var(--font-heading)' }}>
                      {analysis.btts.prediction === 'yes' ? t.yes : t.no}
                    </div>
                      <div className="mt-4 flex items-center gap-3 relative z-10">
                        <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden border border-[#00f0ff]/20">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-[#00f0ff] to-[#00ff88] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.btts.confidence}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                        />
                      </div>
                        <span className="text-sm text-[#00f0ff] font-mono font-bold">%{Math.round(analysis.btts.confidence)}</span>
                    </div>
                      <p className="mt-3 text-xs text-gray-400 relative z-10">{analysis.btts.reasoning}</p>
                    </motion.div>
                  
                  {/* Over/Under */}
                  <motion.div 
                    className="glass-futuristic rounded-2xl border p-5 neon-border-cyan relative overflow-hidden group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.05, borderColor: 'rgba(0, 240, 255, 0.8)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ff00f0]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="w-10 h-10 rounded-lg bg-[#ff00f0]/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#ff00f0]" />
                    </div>
                      <h4 className="text-white font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t.overUnder}</h4>
                    </div>
                    <div className={`text-4xl font-black mb-3 relative z-10 ${
                      analysis.overUnder.prediction === 'over' ? 'text-[#00ff88] neon-glow-yellow' : 'text-[#ffff00] neon-glow-yellow'
                    }`} style={{ fontFamily: 'var(--font-heading)' }}>
                      {analysis.overUnder.prediction === 'over' ? t.over : t.under}
                    </div>
                    <div className="mt-4 flex items-center gap-3 relative z-10">
                      <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden border border-[#ff00f0]/20">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-[#ff00f0] to-[#00f0ff] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.overUnder.confidence}%` }}
                          transition={{ duration: 1, delay: 0.6 }}
                        />
                      </div>
                      <span className="text-sm text-[#ff00f0] font-mono font-bold">%{Math.round(analysis.overUnder.confidence)}</span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400 relative z-10">{analysis.overUnder.reasoning}</p>
                  </motion.div>
                  
                  {/* Match Result */}
                  <motion.div 
                    className="glass-futuristic rounded-2xl border p-5 neon-border-cyan relative overflow-hidden group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.05, borderColor: 'rgba(0, 240, 255, 0.8)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ffff00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="w-10 h-10 rounded-lg bg-[#ffff00]/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-[#ffff00]" />
                    </div>
                      <h4 className="text-white font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t.matchResult}</h4>
                    </div>
                    <div className="text-4xl font-black mb-3 relative z-10 text-[#ffff00] neon-glow-yellow" style={{ fontFamily: 'var(--font-heading)' }}>
                      {analysis.matchResult.prediction === 'home' ? t.home :
                       analysis.matchResult.prediction === 'away' ? t.away : t.draw}
                    </div>
                    <div className="mt-4 flex items-center gap-3 relative z-10">
                      <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden border border-[#ffff00]/20">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-[#ffff00] to-[#00ff88] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.matchResult.confidence}%` }}
                          transition={{ duration: 1, delay: 0.7 }}
                        />
                      </div>
                      <span className="text-sm text-[#ffff00] font-mono font-bold">%{Math.round(analysis.matchResult.confidence)}</span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400 relative z-10">{analysis.matchResult.reasoning}</p>
                  </motion.div>
                  
                  {/* Corners - Sadece Agent Analysis için göster (AI Analysis'te korner verisi gelmiyor) */}
                  {analysisType !== 'ai' && analysis.corners && (
                  <div className={`rounded-xl border p-4 ${
                    analysis.corners.dataAvailable 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-gray-800/30 border-gray-700/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🚩</span>
                      <h4 className="text-white font-medium">{t.corners}</h4>
                    </div>
                    {analysis.corners.dataAvailable ? (
                      <>
                        <div className="text-2xl font-bold text-orange-400">
                          {analysis.corners.prediction === 'over' ? 'ÜST' : 'ALT'} {analysis.corners.line}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-orange-500 rounded-full"
                              style={{ width: `${analysis.corners.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-orange-400">%{analysis.corners.confidence}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{analysis.corners.reasoning}</p>
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <div className="text-gray-500 text-sm">⚠️ Korner verisi mevcut değil</div>
                        <p className="text-xs text-gray-600 mt-1">Bu maç için korner istatistikleri bulunamadı</p>
                      </div>
                    )}
                  </div>
                  )}
                  </motion.div>
                )}
                
                {/* Agent Özel Tahminler (Sadece Agent Analysis için - Standart tahminler yok) */}
                {analysisType !== 'ai' && (
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* İlk Yarı Gol Tahmini */}
                    {analysis.halfTimeGoals && (
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">⏱️</span>
                          <h4 className="text-white font-medium">{t.halfTimeGoals}</h4>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">
                          {analysis.halfTimeGoals.prediction === 'over' ? 'ÜST' : 'ALT'} {analysis.halfTimeGoals.line}
                        </div>
                        {analysis.halfTimeGoals.expectedGoals !== undefined && (
                          <div className="text-sm text-gray-400 mt-1">
                            Beklenen: {analysis.halfTimeGoals.expectedGoals.toFixed(1)} gol
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${analysis.halfTimeGoals.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-blue-400">%{analysis.halfTimeGoals.confidence}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{analysis.halfTimeGoals.reasoning}</p>
                      </div>
                    )}
                    
                    {/* İlk Yarı / Maç Sonucu Kombinasyonu */}
                    {analysis.halfTimeFullTime && (
                      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">🎯</span>
                          <h4 className="text-white font-medium">{t.halfTimeFullTime}</h4>
                        </div>
                        <div className="text-3xl font-bold text-purple-400">
                          {analysis.halfTimeFullTime.prediction}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {analysis.halfTimeFullTime.prediction === '1/1' ? 'İY Ev - Maç Ev' :
                           analysis.halfTimeFullTime.prediction === '1/X' ? 'İY Ev - Maç Beraberlik' :
                           analysis.halfTimeFullTime.prediction === '1/2' ? 'İY Ev - Maç Deplasman' :
                           analysis.halfTimeFullTime.prediction === 'X/1' ? 'İY Beraberlik - Maç Ev' :
                           analysis.halfTimeFullTime.prediction === 'X/X' ? 'İY Beraberlik - Maç Beraberlik' :
                           analysis.halfTimeFullTime.prediction === 'X/2' ? 'İY Beraberlik - Maç Deplasman' :
                           analysis.halfTimeFullTime.prediction === '2/1' ? 'İY Deplasman - Maç Ev' :
                           analysis.halfTimeFullTime.prediction === '2/X' ? 'İY Deplasman - Maç Beraberlik' :
                           analysis.halfTimeFullTime.prediction === '2/2' ? 'İY Deplasman - Maç Deplasman' :
                           'Kombinasyon'}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${analysis.halfTimeFullTime.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-purple-400">%{analysis.halfTimeFullTime.confidence}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{analysis.halfTimeFullTime.reasoning}</p>
                      </div>
                    )}
                    
                    {/* Maç Sonucu Oranları */}
                    {analysis.matchResultOdds && (
                      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">📊</span>
                          <h4 className="text-white font-medium">{t.matchResultOdds}</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">{t.home}</span>
                            <span className="text-green-400 font-bold">{analysis.matchResultOdds.home}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">{t.draw}</span>
                            <span className="text-yellow-400 font-bold">{analysis.matchResultOdds.draw}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">{t.away}</span>
                            <span className="text-red-400 font-bold">{analysis.matchResultOdds.away}%</span>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-gray-400">{analysis.matchResultOdds.reasoning}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Best Bet - Futuristic Highlight */}
                {analysis.bestBet && (
                  <motion.div 
                    className="glass-futuristic rounded-2xl border p-8 neon-border-cyan relative overflow-hidden"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, type: "spring" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00ff88]/10 via-[#00f0ff]/10 to-[#ff00f0]/10 animate-pulse" />
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                      <motion.div 
                        className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#00f0ff] flex items-center justify-center"
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Star className="w-7 h-7 text-black" fill="currentColor" />
                      </motion.div>
                      <div>
                        <h4 className="text-white font-black text-2xl neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                          {t.bestBet}
                        </h4>
                        <p className="text-xs text-[#00f0ff] font-mono mt-1">{t.aiRecommendation}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between flex-wrap gap-6 relative z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-[#00ff88] text-xl font-black neon-glow-yellow" style={{ fontFamily: 'var(--font-heading)' }}>
                          {analysis.bestBet.market}
                        </span>
                        <motion.span 
                          className="text-[#00f0ff] text-2xl"
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          →
                        </motion.span>
                        <span className="text-white text-xl font-black" style={{ fontFamily: 'var(--font-heading)' }}>
                          {analysis.bestBet.selection}
                        </span>
                      </div>
                      <div className="text-right">
                        <motion.div 
                          className="text-4xl font-black text-[#00ff88] neon-glow-yellow"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 1, type: "spring", stiffness: 200 }}
                          style={{ fontFamily: 'var(--font-heading)' }}
                        >
                          %{Math.round(analysis.bestBet.confidence)}
                        </motion.div>
                        <div className="text-xs text-[#00f0ff] font-mono mt-1">{t.confidence}</div>
                      </div>
                    </div>
                    
                    <p className="mt-4 text-sm text-gray-300 relative z-10">{analysis.bestBet.reason}</p>
                    
                    {/* 🔥 CESUR TAHMİN BUTONU */}
                    <div className="mt-6 pt-4 border-t border-gray-700/50 relative z-10">
                      {!boldBet && !loadingBoldBet && (
                        <motion.button
                          onClick={fetchBoldBet}
                          className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-red-500/25"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="text-2xl">🔥</span>
                          <span className="text-lg">{t.boldBet} AL</span>
                          <span className="text-xs opacity-75">({t.boldBetDesc})</span>
                        </motion.button>
                      )}
                      
                      {loadingBoldBet && (
                        <div className="w-full py-4 px-6 bg-gradient-to-r from-red-900/50 to-orange-900/50 text-white font-bold rounded-xl flex items-center justify-center gap-3 border border-red-500/30">
                          <motion.span 
                            className="text-2xl"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            🔄
                          </motion.span>
                          <span>Genius Analyst çalışıyor...</span>
                        </div>
                      )}
                      
                      {boldBetError && (
                        <div className="w-full py-3 px-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-sm flex items-center gap-2">
                          <span>❌</span>
                          <span>{boldBetError}</span>
                          <button onClick={fetchBoldBet} className="ml-auto text-xs underline">Tekrar Dene</button>
                        </div>
                      )}
                      
                      {boldBet && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gradient-to-r from-red-900/60 to-orange-900/60 rounded-xl border-2 border-red-500/50 p-5 relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.15),transparent_70%)]"></div>
                          
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-3xl">🔥</span>
                                <h6 className="text-red-400 font-bold text-xl">{t.boldBet}</h6>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="bg-red-500/30 text-red-300 text-xs px-2 py-1 rounded-full border border-red-500/50">
                                  {boldBet.riskLevel === 'extreme' ? '💀 EXTREM' : 
                                   boldBet.riskLevel === 'very-high' ? '⚠️ ÇOK YÜKSEK' : '⚡ YÜKSEK'}
                                </span>
                                <span className="bg-green-500/30 text-green-300 text-sm px-3 py-1 rounded-full border border-green-500/50 font-bold">
                                  {boldBet.potentialReturn}
                                </span>
                              </div>
                            </div>
                            
                            <div className="bg-black/40 rounded-lg p-4 mb-4">
                              <div className="flex items-center justify-between">
                                <span className="text-white font-black text-2xl">{boldBet.type}</span>
                                <span className="text-yellow-400 font-bold text-xl">@ {boldBet.odds?.toFixed(2) || '?'}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">📋 {t.scenario}:</p>
                                <p className="text-white">{boldBet.scenario}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">💡 Neden?</p>
                                <p className="text-gray-300">{boldBet.reasoning}</p>
                              </div>
                              {boldBet.historicalHit && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">📊 Tarihsel:</p>
                                  <p className="text-gray-300">{boldBet.historicalHit}</p>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-red-500/30 flex items-center justify-between">
                              <p className="text-red-300 text-xs flex items-center gap-1">
                                <span>⚠️</span>
                                <span>Güven: %{Math.round(boldBet.confidence)} - Sadece kaybetmeyi göze alabileceğin miktarla oyna!</span>
                              </p>
                              <button 
                                onClick={() => setBoldBet(null)} 
                                className="text-xs text-gray-400 hover:text-white underline"
                              >
                                Kapat
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                    
                    {/* ⭐ FAVORİYE EKLE BUTONU */}
                    <div className="mt-6 pt-4 border-t border-gray-700/50 relative z-10">
                      <motion.button
                        onClick={toggleFavorite}
                        disabled={savingFavorite}
                        className={`w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all font-bold ${
                          isFavorite
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white'
                            : 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white border border-gray-500/50'
                        }`}
                        whileHover={{ scale: savingFavorite ? 1 : 1.02 }}
                        whileTap={{ scale: savingFavorite ? 1 : 0.98 }}
                      >
                        {savingFavorite ? (
                          <>
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              ⏳
                            </motion.span>
                            <span>Kaydediliyor...</span>
                          </>
                        ) : isFavorite ? (
                          <>
                            <Star className="w-5 h-5" fill="currentColor" />
                            <span>Favorilerden Kaldır</span>
                          </>
                        ) : (
                          <>
                            <Star className="w-5 h-5" />
                            <span>⭐ Favoriye Ekle</span>
                          </>
                        )}
                      </motion.button>
                      {isFavorite && (
                        <p className="mt-2 text-xs text-center text-gray-400">
                          Bu maç favorilerinize kaydedildi. Favoriler sayfasından görüntüleyebilirsiniz.
                        </p>
                      )}
                    </div>
                    
                    {/* 🆕 TÜM ÖNERİLER BÖLÜMÜ */}
                    {analysis.agents && (
                      <div className="mt-6 pt-6 border-t border-gray-700/50 relative z-10">
                        <h5 className="text-sm font-bold text-[#00f0ff] mb-4 flex items-center gap-2">
                          <span>📊</span> {t.allRecommendations}
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {/* BTTS Öneri */}
                          {(() => {
                            const bttsValue = analysis.agents?.odds?._valueAnalysis?.bttsValue || 0;
                            const bttsConf = analysis.agents?.stats?.bttsConfidence || 50;
                            const bttsPred = analysis.agents?.stats?.btts || 'No';
                            const allAgree = analysis.agents?.stats?.btts === (analysis.agents?.odds?.bttsValue === 'no' ? 'No' : 'Yes');
                            const hasValue = Math.abs(bttsValue) > 10;
                            const status = hasValue && allAgree ? 'play' : hasValue || allAgree ? 'caution' : 'skip';
                            
                            return (
                              <div className={`p-3 rounded-xl border transition-all ${
                                status === 'play' ? 'bg-green-500/10 border-green-500/40' :
                                status === 'caution' ? 'bg-yellow-500/10 border-yellow-500/40' :
                                'bg-red-500/10 border-red-500/40'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">BTTS</span>
                                  <span className={`text-lg ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? '✅' : status === 'caution' ? '⚠️' : '❌'}
                                  </span>
                                </div>
                                <p className="text-white font-bold">{bttsPred === 'No' ? 'Hayır' : 'Evet'}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`text-xs font-bold ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? t.play : status === 'caution' ? t.caution : t.skip}
                                  </span>
                                  <span className="text-xs text-gray-400">%{Math.round(bttsConf)}</span>
                                </div>
                                {hasValue && (
                                  <p className="text-xs text-green-400 mt-1">+{Math.abs(bttsValue)}% {t.value}</p>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Over/Under Öneri */}
                          {(() => {
                            const overValue = analysis.agents?.odds?._valueAnalysis?.overValue || 0;
                            const overConf = analysis.agents?.stats?.overUnderConfidence || 50;
                            const overPred = analysis.agents?.stats?.overUnder || 'Over';
                            const oddsRec = analysis.agents?.odds?.recommendation || '';
                            const allAgree = overPred?.toLowerCase() === oddsRec?.toLowerCase();
                            const hasValue = overValue > 5;
                            const status = hasValue && allAgree ? 'play' : allAgree ? 'caution' : 'skip';
                            
                            return (
                              <div className={`p-3 rounded-xl border transition-all ${
                                status === 'play' ? 'bg-green-500/10 border-green-500/40' :
                                status === 'caution' ? 'bg-yellow-500/10 border-yellow-500/40' :
                                'bg-red-500/10 border-red-500/40'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">Over/Under</span>
                                  <span className={`text-lg ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? '✅' : status === 'caution' ? '⚠️' : '❌'}
                                  </span>
                                </div>
                                <p className="text-white font-bold">{overPred}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`text-xs font-bold ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? t.play : status === 'caution' ? t.caution : t.skip}
                                  </span>
                                  <span className="text-xs text-gray-400">%{Math.round(overConf)}</span>
                                </div>
                                {hasValue && (
                                  <p className="text-xs text-green-400 mt-1">+{overValue}% {t.value}</p>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Match Result Öneri */}
                          {(() => {
                            const homeValue = analysis.agents?.odds?._valueAnalysis?.homeValue || 0;
                            const mrConf = analysis.agents?.stats?.matchResultConfidence || 50;
                            const mrPred = analysis.agents?.stats?.matchResult || 'X';
                            const oddsRec = analysis.agents?.odds?.matchWinnerValue || '';
                            const normalizedMr = mrPred === '1' ? 'home' : mrPred === '2' ? 'away' : 'draw';
                            const allAgree = normalizedMr === oddsRec;
                            const hasValue = homeValue > 10;
                            const status = hasValue && allAgree ? 'play' : hasValue || mrConf > 60 ? 'caution' : 'skip';
                            
                            const displayPred = mrPred === '1' || mrPred?.toLowerCase() === 'home' ? 'MS 1' : 
                                               mrPred === '2' || mrPred?.toLowerCase() === 'away' ? 'MS 2' : 'Beraberlik';
                            
                            return (
                              <div className={`p-3 rounded-xl border transition-all ${
                                status === 'play' ? 'bg-green-500/10 border-green-500/40' :
                                status === 'caution' ? 'bg-yellow-500/10 border-yellow-500/40' :
                                'bg-red-500/10 border-red-500/40'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">Maç Sonucu</span>
                                  <span className={`text-lg ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? '✅' : status === 'caution' ? '⚠️' : '❌'}
                                  </span>
                                </div>
                                <p className="text-white font-bold">{displayPred}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`text-xs font-bold ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? t.play : status === 'caution' ? t.caution : t.skip}
                                  </span>
                                  <span className="text-xs text-gray-400">%{Math.round(mrConf)}</span>
                                </div>
                                {hasValue && (
                                  <p className="text-xs text-green-400 mt-1">+{homeValue}% {t.value}</p>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Under 2.5 Öneri (Alternatif) */}
                          {(() => {
                            const underValue = -(analysis.agents?.odds?._valueAnalysis?.overValue || 0);
                            const overPred = analysis.agents?.stats?.overUnder || 'Over';
                            const probUnder = analysis.agents?.stats?.probabilityEngine?.final?.overUnderConfidence || 50;
                            const hasValue = underValue > 5;
                            const isUnder = overPred === 'Under' || analysis.agents?.odds?.recommendation === 'Under';
                            const status = hasValue && isUnder ? 'play' : isUnder ? 'caution' : 'skip';
                            
                            return (
                              <div className={`p-3 rounded-xl border transition-all ${
                                status === 'play' ? 'bg-green-500/10 border-green-500/40' :
                                status === 'caution' ? 'bg-yellow-500/10 border-yellow-500/40' :
                                'bg-red-500/10 border-red-500/40'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">Under 2.5</span>
                                  <span className={`text-lg ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? '✅' : status === 'caution' ? '⚠️' : '❌'}
                                  </span>
                                </div>
                                <p className="text-white font-bold">{isUnder ? 'Under' : 'Over tercih'}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`text-xs font-bold ${
                                    status === 'play' ? 'text-green-400' :
                                    status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {status === 'play' ? t.play : status === 'caution' ? t.caution : t.skip}
                                  </span>
                                  <span className="text-xs text-gray-400">%{probUnder}</span>
                                </div>
                                {hasValue && isUnder && (
                                  <p className="text-xs text-green-400 mt-1">+{underValue}% {t.value}</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Açıklama */}
                        <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
                          <p className="text-xs text-gray-400 text-center">
                            <span className="text-green-400">✅ {t.play}</span> = Value + Konsensüs |
                            <span className="text-yellow-400 ml-2">⚠️ {t.caution}</span> = Karışık sinyal |
                            <span className="text-red-400 ml-2">❌ {t.skip}</span> = Value yok
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                
                {/* Analiz Detayı - Sadece Agent Analysis için */}
                {analysisType !== 'ai' && analysis.agents && (
                  <AnalysisDetailsSection analysis={analysis} />
                )}
                
                {/* Models Used */}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500 flex-wrap">
                  <span>{t.models}: {analysis.modelsUsed?.join(', ') || 'Claude, DeepSeek'}</span>
                  <span>•</span>
                  <span>{t.analysis}: {analysis.analyzedAt ? new Date(analysis.analyzedAt).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US') : 'Şimdi'}</span>
                </div>
              </div>
            ) : (
              <motion.div 
                className="glass-futuristic rounded-2xl border p-12 flex flex-col items-center justify-center min-h-[400px] neon-border-cyan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Shield className="w-20 h-20 text-[#00f0ff]/50" />
                </motion.div>
                <h3 className="mt-6 text-2xl font-black text-white neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>
                  {t.selectMatch}
                </h3>
                <p className="mt-4 text-gray-400 text-center max-w-md">
                  {t.selectMatchDesc}<br />
                  <span className="text-[#00f0ff] font-mono">{t.analyzeTimeShort}</span>
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
      
      {/* Paywall Modal */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={accessStatus?.canAnalyze === false ? 'limit_reached' : 'premium_feature'}
        currentUsage={accessStatus?.analysesUsed || 0}
        limit={accessStatus?.analysesLimit || 1}
      />
    </div>
  );
}
