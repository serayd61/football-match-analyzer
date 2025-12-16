// src/components/AgentLoadingProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';

interface AgentLoadingProgressProps {
  isLoading: boolean;
}

export default function AgentLoadingProgress({ isLoading }: AgentLoadingProgressProps) {
  const { lang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const labels = {
    tr: {
      title: 'AI Ajanları Çalışıyor',
      subtitle: '5 farklı AI agent maçı analiz ediyor...',
      working: 'Çalışıyor',
      completed: 'Tamamlandı',
      progress: 'Toplam İlerleme',
      tip: 'İpucu',
      tipText: 'AI ajanları maç verilerini, istatistikleri, oranları ve haberleri analiz ediyor. Bu işlem 15-30 saniye sürebilir.',
      agents: [
        { id: 'scout', name: 'Scout Agent', description: 'Veri toplama...' },
        { id: 'stats', name: 'Stats Agent', description: 'İstatistik analizi...' },
        { id: 'odds', name: 'Odds Agent', description: 'Oran analizi...' },
        { id: 'sentiment', name: 'Sentiment Agent', description: 'Duygu analizi...' },
        { id: 'strategy', name: 'Strategy Agent', description: 'Strateji oluşturma...' },
      ]
    },
    en: {
      title: 'AI Agents Working',
      subtitle: '5 different AI agents analyzing the match...',
      working: 'Working',
      completed: 'Completed',
      progress: 'Total Progress',
      tip: 'Tip',
      tipText: 'AI agents are analyzing match data, statistics, odds and news. This process may take 15-30 seconds.',
      agents: [
        { id: 'scout', name: 'Scout Agent', description: 'Collecting data...' },
        { id: 'stats', name: 'Stats Agent', description: 'Statistical analysis...' },
        { id: 'odds', name: 'Odds Agent', description: 'Odds analysis...' },
        { id: 'sentiment', name: 'Sentiment Agent', description: 'Sentiment analysis...' },
        { id: 'strategy', name: 'Strategy Agent', description: 'Creating strategy...' },
      ]
    },
    de: {
      title: 'KI-Agenten arbeiten',
      subtitle: '5 verschiedene KI-Agenten analysieren das Spiel...',
      working: 'Arbeitet',
      completed: 'Abgeschlossen',
      progress: 'Gesamtfortschritt',
      tip: 'Tipp',
      tipText: 'KI-Agenten analysieren Spieldaten, Statistiken, Quoten und Nachrichten. Dieser Vorgang kann 15-30 Sekunden dauern.',
      agents: [
        { id: 'scout', name: 'Scout Agent', description: 'Daten sammeln...' },
        { id: 'stats', name: 'Stats Agent', description: 'Statistische Analyse...' },
        { id: 'odds', name: 'Odds Agent', description: 'Quotenanalyse...' },
        { id: 'sentiment', name: 'Sentiment Agent', description: 'Stimmungsanalyse...' },
        { id: 'strategy', name: 'Strategy Agent', description: 'Strategie erstellen...' },
      ]
    }
  };

  const l = labels[lang as keyof typeof labels] || labels.en;
  const agents = l.agents.map((agent, idx) => ({
    ...agent,
    icon: ['🔍', '📊', '💰', '🎭', '🧠'][idx],
    color: [
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-yellow-500 to-orange-500',
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500'
    ][idx]
  }));

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setCompletedSteps([]);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < agents.length - 1) {
          setCompletedSteps((completed) => [...completed, agents[prev].id]);
          return prev + 1;
        }
        return prev;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isLoading, agents.length]);

  if (!isLoading) return null;

  return (
    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-purple-500/20 rounded-full border border-purple-500/30 mb-4">
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
          <span className="text-purple-400 font-medium">{l.title}</span>
        </div>
        <p className="text-gray-400 text-sm">{l.subtitle}</p>
      </div>

      {/* Agent Progress */}
      <div className="space-y-3">
        {agents.map((agent, index) => {
          const isCompleted = completedSteps.includes(agent.id);
          const isActive = index === currentStep && !isCompleted;
          const isPending = index > currentStep;

          return (
            <div
              key={agent.id}
              className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                isCompleted
                  ? 'bg-green-500/10 border-green-500/30'
                  : isActive
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-gray-800/30 border-gray-700/30 opacity-50'
              }`}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-green-500'
                    : isActive
                    ? `bg-gradient-to-r ${agent.color}`
                    : 'bg-gray-700'
                }`}
              >
                {isCompleted ? (
                  <span className="text-white text-xl">✓</span>
                ) : (
                  <span className="text-2xl">{agent.icon}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{agent.name}</span>
                  {isActive && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full animate-pulse">
                      {l.working}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                      {l.completed}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{agent.description}</p>
              </div>

              {/* Progress indicator for active agent */}
              {isActive && (
                <div className="w-8 h-8">
                  <svg className="animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{l.progress}</span>
          <span>{Math.min(100, Math.round(((completedSteps.length + (currentStep === agents.length - 1 ? 1 : 0)) / agents.length) * 100))}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${((completedSteps.length + (currentStep === agents.length - 1 ? 0.5 : 0)) / agents.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <p className="text-blue-400 font-medium text-sm">{l.tip}</p>
            <p className="text-gray-400 text-xs mt-1">{l.tipText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
