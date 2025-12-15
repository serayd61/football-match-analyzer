// src/components/AIConsensusLoading.tsx
'use client';

import { useState, useEffect } from 'react';

interface AIConsensusLoadingProps {
  isLoading: boolean;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  language?: 'tr' | 'en' | 'de';
}

const AI_MODELS = [
  { id: 'claude', name: 'Claude', icon: '🟣', color: 'purple', gradient: 'from-purple-500 to-purple-600' },
  { id: 'openai', name: 'GPT-4', icon: '🟢', color: 'green', gradient: 'from-green-500 to-green-600' },
  { id: 'gemini', name: 'Gemini', icon: '🔵', color: 'blue', gradient: 'from-blue-500 to-blue-600' },
  { id: 'perplexity', name: 'Perplexity', icon: '🟠', color: 'orange', gradient: 'from-orange-500 to-orange-600' },
];

const LOADING_STEPS = {
  tr: [
    { step: 1, text: '📊 Maç verileri toplanıyor...', subtext: 'Sportmonks API' },
    { step: 2, text: '📈 Form analizi yapılıyor...', subtext: 'Son 5 maç' },
    { step: 3, text: '🔄 H2H istatistikleri çekiliyor...', subtext: 'Kafa kafaya' },
    { step: 4, text: '💰 Bahis oranları analiz ediliyor...', subtext: 'Value betting' },
    { step: 5, text: '🤖 AI modelleri çalışıyor...', subtext: '4 model paralel' },
    { step: 6, text: '🗳️ Oylar hesaplanıyor...', subtext: 'Konsensüs' },
    { step: 7, text: '✨ Sonuçlar hazırlanıyor...', subtext: 'Tamamlandı!' },
  ],
  en: [
    { step: 1, text: '📊 Fetching match data...', subtext: 'Sportmonks API' },
    { step: 2, text: '📈 Analyzing team form...', subtext: 'Last 5 matches' },
    { step: 3, text: '🔄 Loading H2H statistics...', subtext: 'Head to head' },
    { step: 4, text: '💰 Processing betting odds...', subtext: 'Value betting' },
    { step: 5, text: '🤖 AI models working...', subtext: '4 models parallel' },
    { step: 6, text: '🗳️ Calculating votes...', subtext: 'Consensus' },
    { step: 7, text: '✨ Preparing results...', subtext: 'Complete!' },
  ],
  de: [
    { step: 1, text: '📊 Spieldaten werden geladen...', subtext: 'Sportmonks API' },
    { step: 2, text: '📈 Formanalyse läuft...', subtext: 'Letzte 5 Spiele' },
    { step: 3, text: '🔄 H2H-Statistiken...', subtext: 'Direktvergleich' },
    { step: 4, text: '💰 Quoten werden analysiert...', subtext: 'Value Wetten' },
    { step: 5, text: '🤖 KI-Modelle arbeiten...', subtext: '4 Modelle parallel' },
    { step: 6, text: '🗳️ Stimmen werden gezählt...', subtext: 'Konsens' },
    { step: 7, text: '✨ Ergebnisse vorbereiten...', subtext: 'Fertig!' },
  ],
};

const FUN_FACTS = {
  tr: [
    '💡 AI modelleri 10.000+ maçtan öğrendi',
    '🎯 Ortalama doğruluk oranı: %72',
    '⚡ 4 AI model paralel çalışıyor',
    '📊 Venue-specific istatistikler kullanılıyor',
    '🔥 Sharp money analizi yapılıyor',
  ],
  en: [
    '💡 AI models trained on 10,000+ matches',
    '🎯 Average accuracy rate: 72%',
    '⚡ 4 AI models working in parallel',
    '📊 Using venue-specific statistics',
    '🔥 Sharp money analysis included',
  ],
  de: [
    '💡 KI-Modelle mit 10.000+ Spielen trainiert',
    '🎯 Durchschnittliche Genauigkeit: 72%',
    '⚡ 4 KI-Modelle arbeiten parallel',
    '📊 Venue-spezifische Statistiken',
    '🔥 Sharp Money Analyse inklusive',
  ],
};

const LABELS = {
  tr: {
    title: 'AI Konsensüs Analizi',
    subtitle: '4 AI model çalışıyor',
    progress: 'İlerleme',
    complete: 'Tamamlandı',
  },
  en: {
    title: 'AI Consensus Analysis',
    subtitle: '4 AI models working',
    progress: 'Progress',
    complete: 'Complete',
  },
  de: {
    title: 'KI-Konsensanalyse',
    subtitle: '4 KI-Modelle arbeiten',
    progress: 'Fortschritt',
    complete: 'Fertig',
  },
};

export default function AIConsensusLoading({
  isLoading,
  homeTeam,
  awayTeam,
  homeTeamLogo,
  awayTeamLogo,
  language = 'en',
}: AIConsensusLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [modelStatus, setModelStatus] = useState<Record<string, 'waiting' | 'loading' | 'done'>>({
    claude: 'waiting',
    openai: 'waiting',
    gemini: 'waiting',
    perplexity: 'waiting',
  });
  const [progress, setProgress] = useState(0);
  const [currentFact, setCurrentFact] = useState(0);

  const steps = LOADING_STEPS[language];
  const facts = FUN_FACTS[language];
  const labels = LABELS[language];

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setProgress(0);
      setModelStatus({
        claude: 'waiting',
        openai: 'waiting',
        gemini: 'waiting',
        perplexity: 'waiting',
      });
      return;
    }

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 2;
      });
    }, 150);

    // Fun facts rotation
    const factInterval = setInterval(() => {
      setCurrentFact((prev) => (prev + 1) % facts.length);
    }, 3000);

    // Step animation
    let stepIndex = 0;
    const stepDurations = [1500, 2000, 1500, 2000, 3000, 1500, 1000];
    
    const runStep = () => {
      if (stepIndex >= steps.length) return;
      
      setCurrentStep(stepIndex);
      
      // Activate AI models at step 4-5
      if (stepIndex === 4) {
        setTimeout(() => setModelStatus(prev => ({ ...prev, claude: 'loading' })), 0);
        setTimeout(() => setModelStatus(prev => ({ ...prev, openai: 'loading' })), 400);
        setTimeout(() => setModelStatus(prev => ({ ...prev, gemini: 'loading' })), 800);
        setTimeout(() => setModelStatus(prev => ({ ...prev, perplexity: 'loading' })), 1200);
        
        setTimeout(() => setModelStatus(prev => ({ ...prev, claude: 'done' })), 1800);
        setTimeout(() => setModelStatus(prev => ({ ...prev, openai: 'done' })), 2200);
        setTimeout(() => setModelStatus(prev => ({ ...prev, gemini: 'done' })), 2600);
        setTimeout(() => setModelStatus(prev => ({ ...prev, perplexity: 'done' })), 3000);
      }
      
      stepIndex++;
      if (stepIndex < steps.length) {
        setTimeout(runStep, stepDurations[stepIndex - 1]);
      }
    };

    runStep();

    return () => {
      clearInterval(progressInterval);
      clearInterval(factInterval);
    };
  }, [isLoading, steps.length, facts.length]);

  if (!isLoading) return null;

  const getModelStatusIcon = (status: 'waiting' | 'loading' | 'done') => {
    switch (status) {
      case 'waiting':
        return <div className="w-5 h-5 rounded-full bg-gray-600 border-2 border-gray-500" />;
      case 'loading':
        return (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        );
      case 'done':
        return (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden shadow-2xl">
      {/* Header with Teams */}
      <div className="relative p-6 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 border-b border-gray-700/50">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-blue-500/5 to-purple-500/5 animate-pulse" />
        
        <div className="relative flex items-center justify-center gap-8">
          {/* Home Team */}
          <div className="flex flex-col items-center">
            <div className="relative">
              {homeTeamLogo ? (
                <img 
                  src={homeTeamLogo} 
                  alt={homeTeam} 
                  className="w-20 h-20 object-contain drop-shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                  {homeTeam.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                H
              </div>
            </div>
            <span className="mt-3 text-white font-bold text-sm truncate max-w-[120px] text-center">
              {homeTeam}
            </span>
          </div>

          {/* VS Badge */}
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center border-2 border-gray-600 shadow-xl">
              <span className="text-gray-300 font-bold text-lg">VS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 bg-green-500/20 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400 font-medium">ANALYZING</span>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center">
            <div className="relative">
              {awayTeamLogo ? (
                <img 
                  src={awayTeamLogo} 
                  alt={awayTeam} 
                  className="w-20 h-20 object-contain drop-shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                  {awayTeam.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                A
              </div>
            </div>
            <span className="mt-3 text-white font-bold text-sm truncate max-w-[120px] text-center">
              {awayTeam}
            </span>
          </div>
        </div>
      </div>

      {/* AI Models Status */}
      <div className="p-5 border-b border-gray-700/50">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
            <span className="text-xl">🤖</span>
            {labels.title}
          </h3>
          <p className="text-sm text-gray-400 mt-1">{labels.subtitle}</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {AI_MODELS.map((model) => {
            const status = modelStatus[model.id];
            return (
              <div
                key={model.id}
                className={`relative p-4 rounded-xl border-2 transition-all duration-500 ${
                  status === 'done' 
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' 
                    : status === 'loading'
                    ? 'border-gray-500 bg-gray-700/50 shadow-lg'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                {status === 'loading' && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 animate-pulse" />
                )}
                
                <div className="relative flex flex-col items-center">
                  <span className="text-3xl mb-2">{model.icon}</span>
                  <span className={`text-xs font-semibold mb-2 ${
                    status === 'done' ? 'text-green-400' : 
                    status === 'loading' ? 'text-white' : 'text-gray-500'
                  }`}>
                    {model.name}
                  </span>
                  {getModelStatusIcon(status)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step */}
      <div className="p-5 border-b border-gray-700/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
            <div className="w-6 h-6 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-base">
              {steps[currentStep]?.text || steps[0].text}
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              {steps[currentStep]?.subtext}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">{Math.round(progress)}%</div>
            <div className="text-xs text-gray-500">{labels.complete}</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 pt-4">
        <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Step indicators */}
        <div className="flex justify-between mt-4 px-1">
          {steps.map((step, index) => (
            <div key={step.step} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  index < currentStep
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : index === currentStep
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white animate-pulse shadow-lg'
                    : 'bg-gray-700 text-gray-500'
                }`}
              >
                {index < currentStep ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.step
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fun Facts */}
      <div className="p-5">
        <div className="bg-gradient-to-r from-gray-700/30 to-gray-800/30 rounded-xl p-4 text-center border border-gray-700/50">
          <div className="text-sm text-gray-300 transition-all duration-500">
            {facts[currentFact]}
          </div>
        </div>
      </div>
    </div>
  );
}
