'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import { motion } from 'framer-motion';
import { 
  FiGlobe, FiBell, FiSun, FiMoon, FiHeart, FiShield, 
  FiSettings, FiChevronRight, FiCheck, FiX, FiSave
} from 'react-icons/fi';
import { BsRobot, BsCpu } from 'react-icons/bs';
import { GiBrain } from 'react-icons/gi';

interface UserSettings {
  language: 'tr' | 'en' | 'de';
  theme: 'dark' | 'light' | 'system';
  defaultAnalysisType: 'quad-brain' | 'agents' | 'ai-consensus';
  notifications: {
    matchStart: boolean;
    predictionResults: boolean;
    weeklyReport: boolean;
    promotions: boolean;
  };
  favoriteTeams: string[];
  favoriteLeagues: string[];
}

const DEFAULT_SETTINGS: UserSettings = {
  language: 'tr',
  theme: 'dark',
  defaultAnalysisType: 'quad-brain',
  notifications: {
    matchStart: true,
    predictionResults: true,
    weeklyReport: true,
    promotions: false,
  },
  favoriteTeams: [],
  favoriteLeagues: [],
};

const POPULAR_LEAGUES = [
  { id: 'premier-league', name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'la-liga', name: 'La Liga', country: '🇪🇸' },
  { id: 'bundesliga', name: 'Bundesliga', country: '🇩🇪' },
  { id: 'serie-a', name: 'Serie A', country: '🇮🇹' },
  { id: 'ligue-1', name: 'Ligue 1', country: '🇫🇷' },
  { id: 'super-lig', name: 'Süper Lig', country: '🇹🇷' },
  { id: 'eredivisie', name: 'Eredivisie', country: '🇳🇱' },
  { id: 'primeira-liga', name: 'Primeira Liga', country: '🇵🇹' },
];

// Static concrete-class lookup for analysis-type accents (Tailwind cannot
// compile dynamically interpolated class names like `bg-${color}-500`).
const ANALYSIS_ACCENT: Record<string, { iconWrap: string; icon: string }> = {
  'quad-brain': { iconWrap: 'bg-brand-500/20', icon: 'text-brand-300' },
  agents: { iconWrap: 'bg-purple-500/20', icon: 'text-purple-300' },
  'ai-consensus': { iconWrap: 'bg-positive/20', icon: 'text-positive' },
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('general');
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        // Apply saved theme on load
        applyTheme(parsed.theme);
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
    setLoading(false);
  }, []);

  // Auto-save and apply settings whenever they change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('userSettings', JSON.stringify(settings));
      
      // Update language context immediately
      if (settings.language !== lang) {
        setLang(settings.language);
      }
      
      // Apply theme immediately
      applyTheme(settings.theme);
      
      // Show auto-save notification
      const messages = {
        tr: '✓ Ayarlar kaydedildi',
        en: '✓ Settings saved',
        de: '✓ Einstellungen gespeichert',
      };
      setAutoSaveMessage(messages[settings.language] || messages.en);
      const timer = setTimeout(() => setAutoSaveMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [settings, loading]);

  const applyTheme = (theme: 'dark' | 'light' | 'system') => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('light-theme', !prefersDark);
      root.classList.toggle('dark-theme', prefersDark);
    } else if (theme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }
    
    // Also update CSS variable for components that need it
    root.style.setProperty('--theme-mode', theme);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      localStorage.setItem('userSettings', JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
    setSaving(false);
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleNotification = (key: keyof UserSettings['notifications']) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
  };

  const toggleFavoriteLeague = (leagueId: string) => {
    setSettings(prev => ({
      ...prev,
      favoriteLeagues: prev.favoriteLeagues.includes(leagueId)
        ? prev.favoriteLeagues.filter(id => id !== leagueId)
        : [...prev.favoriteLeagues, leagueId],
    }));
  };

  const labels = {
    tr: {
      title: 'Ayarlar',
      general: 'Genel',
      notifications: 'Bildirimler',
      analysis: 'Analiz Tercihleri',
      favorites: 'Favoriler',
      security: 'Güvenlik',
      language: 'Dil',
      theme: 'Tema',
      dark: 'Koyu',
      light: 'Açık',
      system: 'Sistem',
      defaultAnalysis: 'Varsayılan Analiz Tipi',
      quadBrain: 'Quad-Brain AI',
      agents: 'AI Agents',
      aiConsensus: 'AI Consensus',
      matchStart: 'Maç Başlangıcı',
      matchStartDesc: 'Favori takımlarınızın maçları başladığında bildirim alın',
      predictionResults: 'Tahmin Sonuçları',
      predictionResultsDesc: 'Tahminlerinizin sonuçları belli olduğunda bildirim alın',
      weeklyReport: 'Haftalık Rapor',
      weeklyReportDesc: 'Haftalık performans raporunuzu alın',
      promotions: 'Promosyonlar',
      promotionsDesc: 'Özel teklifler ve indirimler hakkında bilgi alın',
      favoriteLeagues: 'Favori Ligler',
      favoriteLeaguesDesc: 'Takip etmek istediğiniz ligleri seçin',
      changePassword: 'Şifre Değiştir',
      deleteAccount: 'Hesabı Sil',
      deleteAccountWarning: 'Bu işlem geri alınamaz!',
      save: 'Kaydet',
      saving: 'Kaydediliyor...',
      saved: 'Kaydedildi!',
      back: 'Geri',
    },
    en: {
      title: 'Settings',
      general: 'General',
      notifications: 'Notifications',
      analysis: 'Analysis Preferences',
      favorites: 'Favorites',
      security: 'Security',
      language: 'Language',
      theme: 'Theme',
      dark: 'Dark',
      light: 'Light',
      system: 'System',
      defaultAnalysis: 'Default Analysis Type',
      quadBrain: 'Quad-Brain AI',
      agents: 'AI Agents',
      aiConsensus: 'AI Consensus',
      matchStart: 'Match Start',
      matchStartDesc: 'Get notified when your favorite teams play',
      predictionResults: 'Prediction Results',
      predictionResultsDesc: 'Get notified when your predictions are settled',
      weeklyReport: 'Weekly Report',
      weeklyReportDesc: 'Receive your weekly performance report',
      promotions: 'Promotions',
      promotionsDesc: 'Get info about special offers and discounts',
      favoriteLeagues: 'Favorite Leagues',
      favoriteLeaguesDesc: 'Select leagues you want to follow',
      changePassword: 'Change Password',
      deleteAccount: 'Delete Account',
      deleteAccountWarning: 'This action cannot be undone!',
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved!',
      back: 'Back',
    },
    de: {
      title: 'Einstellungen',
      general: 'Allgemein',
      notifications: 'Benachrichtigungen',
      analysis: 'Analyse-Einstellungen',
      favorites: 'Favoriten',
      security: 'Sicherheit',
      language: 'Sprache',
      theme: 'Design',
      dark: 'Dunkel',
      light: 'Hell',
      system: 'System',
      defaultAnalysis: 'Standard-Analysetyp',
      quadBrain: 'Quad-Brain KI',
      agents: 'KI-Agenten',
      aiConsensus: 'KI-Konsens',
      matchStart: 'Spielbeginn',
      matchStartDesc: 'Benachrichtigung wenn Ihre Lieblingsteams spielen',
      predictionResults: 'Vorhersage-Ergebnisse',
      predictionResultsDesc: 'Benachrichtigung wenn Vorhersagen ausgewertet werden',
      weeklyReport: 'Wochenbericht',
      weeklyReportDesc: 'Erhalten Sie Ihren wöchentlichen Leistungsbericht',
      promotions: 'Aktionen',
      promotionsDesc: 'Infos über Sonderangebote und Rabatte',
      favoriteLeagues: 'Lieblingsligen',
      favoriteLeaguesDesc: 'Wählen Sie die Ligen, denen Sie folgen möchten',
      changePassword: 'Passwort ändern',
      deleteAccount: 'Konto löschen',
      deleteAccountWarning: 'Diese Aktion kann nicht rückgängig gemacht werden!',
      save: 'Speichern',
      saving: 'Speichern...',
      saved: 'Gespeichert!',
      back: 'Zurück',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const sections = [
    { id: 'general', icon: FiSettings, label: l.general },
    { id: 'notifications', icon: FiBell, label: l.notifications },
    { id: 'analysis', icon: GiBrain, label: l.analysis },
    { id: 'favorites', icon: FiHeart, label: l.favorites },
    { id: 'security', icon: FiShield, label: l.security },
  ];

  if (status === 'loading' || loading) {
    return (
      <div className="fa-shell min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />
      {/* Auto-save notification */}
      {autoSaveMessage && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-brand-500 text-content px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm">
            <FiCheck className="w-4 h-4" />
            <span className="text-sm font-medium">{autoSaveMessage}</span>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/profile" className="p-2 rounded-lg bg-surface-3 hover:bg-surface-4 border border-line text-content-muted hover:text-content transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-content tracking-tight">{l.title}</h1>
              <p className="text-content-muted text-sm">{session.user?.email}</p>
            </div>
          </div>
          <div className="text-sm text-content-muted flex items-center gap-2">
            <div className="w-2 h-2 bg-positive rounded-full animate-pulse"></div>
            {settings.language === 'tr' ? 'Otomatik Kayıt' : settings.language === 'de' ? 'Auto-Speichern' : 'Auto-save'}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="fa-card p-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeSection === section.id
                      ? 'bg-brand-500/10 text-brand-300'
                      : 'text-content-muted hover:bg-surface-3 hover:text-content'
                  }`}
                >
                  <section.icon className="w-5 h-5" />
                  <span className="font-medium">{section.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            <div className="fa-card p-6">
              
              {/* General Settings */}
              {activeSection === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-content tracking-tight mb-6">{l.general}</h2>
                  
                  {/* Language */}
                  <div>
                    <label className="block text-content-muted text-sm mb-3">{l.language}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
                        { code: 'en', label: 'English', flag: '🇬🇧' },
                        { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                      ].map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => updateSetting('language', lang.code as any)}
                          className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                            settings.language === lang.code
                              ? 'border-brand-500 bg-brand-500/10 text-content'
                              : 'border-line hover:border-line-strong text-content-muted'
                          }`}
                        >
                          <span className="text-2xl">{lang.flag}</span>
                          <span className="font-medium">{lang.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme */}
                  <div>
                    <label className="block text-content-muted text-sm mb-3">{l.theme}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { code: 'dark', label: l.dark, icon: FiMoon },
                        { code: 'light', label: l.light, icon: FiSun },
                        { code: 'system', label: l.system, icon: FiSettings },
                      ].map((theme) => (
                        <button
                          key={theme.code}
                          onClick={() => updateSetting('theme', theme.code as any)}
                          className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                            settings.theme === theme.code
                              ? 'border-brand-500 bg-brand-500/10 text-content'
                              : 'border-line hover:border-line-strong text-content-muted'
                          }`}
                        >
                          <theme.icon className="w-5 h-5" />
                          <span className="font-medium">{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeSection === 'notifications' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-content tracking-tight mb-6">{l.notifications}</h2>
                  
                  {[
                    { key: 'matchStart', label: l.matchStart, desc: l.matchStartDesc },
                    { key: 'predictionResults', label: l.predictionResults, desc: l.predictionResultsDesc },
                    { key: 'weeklyReport', label: l.weeklyReport, desc: l.weeklyReportDesc },
                    { key: 'promotions', label: l.promotions, desc: l.promotionsDesc },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 bg-surface-3 rounded-xl border border-line"
                    >
                      <div>
                        <div className="font-medium text-content">{item.label}</div>
                        <div className="text-sm text-content-muted">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => toggleNotification(item.key as keyof UserSettings['notifications'])}
                        className={`w-14 h-8 rounded-full transition-all relative ${
                          settings.notifications[item.key as keyof UserSettings['notifications']]
                            ? 'bg-brand-500'
                            : 'bg-surface-4'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-6 h-6 bg-content rounded-full transition-all ${
                            settings.notifications[item.key as keyof UserSettings['notifications']]
                              ? 'left-7'
                              : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Analysis Preferences */}
              {activeSection === 'analysis' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-content tracking-tight mb-6">{l.analysis}</h2>
                  
                  <div>
                    <label className="block text-content-muted text-sm mb-3">{l.defaultAnalysis}</label>
                    <div className="space-y-3">
                      {[
                        { code: 'quad-brain', label: l.quadBrain, icon: GiBrain, desc: '4 AI modeli birlikte çalışır' },
                        { code: 'agents', label: l.agents, icon: BsRobot, desc: 'Uzman ajanlar analiz yapar' },
                        { code: 'ai-consensus', label: l.aiConsensus, icon: FiSettings, desc: 'Temel AI consensus sistemi' },
                      ].map((type) => {
                        const accent = ANALYSIS_ACCENT[type.code] || ANALYSIS_ACCENT['quad-brain'];
                        return (
                        <button
                          key={type.code}
                          onClick={() => updateSetting('defaultAnalysisType', type.code as any)}
                          className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
                            settings.defaultAnalysisType === type.code
                              ? 'border-brand-500 bg-brand-500/10'
                              : 'border-line hover:border-line-strong'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl ${accent.iconWrap} flex items-center justify-center`}>
                            <type.icon className={`w-6 h-6 ${accent.icon}`} />
                          </div>
                          <div className="text-left">
                            <div className={`font-semibold ${settings.defaultAnalysisType === type.code ? 'text-content' : 'text-content-muted'}`}>
                              {type.label}
                            </div>
                            <div className="text-sm text-content-subtle">{type.desc}</div>
                          </div>
                          {settings.defaultAnalysisType === type.code && (
                            <FiCheck className="w-5 h-5 text-brand-300 ml-auto" />
                          )}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Favorites */}
              {activeSection === 'favorites' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-content tracking-tight mb-2">{l.favorites}</h2>
                  <p className="text-content-muted text-sm mb-6">{l.favoriteLeaguesDesc}</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {POPULAR_LEAGUES.map((league) => (
                      <button
                        key={league.id}
                        onClick={() => toggleFavoriteLeague(league.id)}
                        className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                          settings.favoriteLeagues.includes(league.id)
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-line hover:border-line-strong'
                        }`}
                      >
                        <span className="text-2xl">{league.country}</span>
                        <span className={`font-medium ${settings.favoriteLeagues.includes(league.id) ? 'text-content' : 'text-content-muted'}`}>
                          {league.name}
                        </span>
                        {settings.favoriteLeagues.includes(league.id) && (
                          <FiCheck className="w-5 h-5 text-brand-300 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Security */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-content tracking-tight mb-6">{l.security}</h2>
                  
                  <button className="w-full p-4 bg-surface-3 hover:bg-surface-4 border border-line rounded-xl flex items-center justify-between transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-info/20 rounded-lg flex items-center justify-center">
                        <FiShield className="w-5 h-5 text-info" />
                      </div>
                      <span className="text-content font-medium">{l.changePassword}</span>
                    </div>
                    <FiChevronRight className="w-5 h-5 text-content-muted" />
                  </button>

                  <div className="border-t border-line pt-6">
                    <button className="w-full p-4 bg-negative/10 hover:bg-negative/20 border border-negative/40 rounded-xl flex items-center justify-between transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-negative/20 rounded-lg flex items-center justify-center">
                          <FiX className="w-5 h-5 text-negative" />
                        </div>
                        <div className="text-left">
                          <div className="text-negative font-medium">{l.deleteAccount}</div>
                          <div className="text-negative/60 text-sm">{l.deleteAccountWarning}</div>
                        </div>
                      </div>
                      <FiChevronRight className="w-5 h-5 text-negative" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

