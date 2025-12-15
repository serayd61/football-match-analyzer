'use client';

import React from 'react';
import { Brain, BarChart3, Sparkles, Newspaper } from 'lucide-react';

const AI_STEPS = [
  { name: 'Claude', role: 'Analyzing tactics...', icon: Brain, color: 'text-orange-400' },
  { name: 'GPT-4', role: 'Calculating statistics...', icon: BarChart3, color: 'text-emerald-400' },
  { name: 'Gemini', role: 'Finding patterns...', icon: Sparkles, color: 'text-blue-400' },
  { name: 'Perplexity', role: 'Gathering context...', icon: Newspaper, color: 'text-purple-400' },
];

export default function AIBrainLoading() {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
      {/* Brain Animation */}
      <div className="flex flex-col items-center justify-center mb-8">
        <div className="relative">
          {/* Outer Ring */}
          <div className="absolute inset-0 w-24 h-24 border-4 border-purple-500/30 rounded-full animate-ping" />
          
          {/* Middle Ring */}
          <div className="absolute inset-2 w-20 h-20 border-4 border-blue-500/40 rounded-full animate-spin" 
               style={{ animationDuration: '3s' }} />
          
          {/* Inner Ring */}
          <div className="absolute inset-4 w-16 h-16 border-4 border-cyan-500/50 rounded-full animate-spin" 
               style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
          
          {/* Brain Icon */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <Brain className="w-10 h-10 text-purple-400 animate-pulse" />
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white mt-6 mb-2">AI Brain Processing</h3>
        <p className="text-gray-400 text-sm">Analyzing match with 4 specialized AI models</p>
      </div>

      {/* AI Steps */}
      <div className="space-y-3">
        {AI_STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div 
              key={idx}
              className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/50 border border-gray-700/50"
              style={{ 
                animation: `fadeInSlide 0.5s ease-out ${idx * 0.15}s both`
              }}
            >
              <div className={`p-2 rounded-lg bg-gray-700/50`}>
                <Icon className={`w-5 h-5 ${step.color} animate-pulse`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{step.name}</p>
                <p className="text-xs text-gray-500">{step.role}</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                  <div 
                    key={dot}
                    className={`w-2 h-2 rounded-full ${step.color.replace('text-', 'bg-')}`}
                    style={{
                      animation: `bounce 1s ease-in-out ${dot * 0.2}s infinite`
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-full"
            style={{
              animation: 'progress 8s ease-in-out infinite'
            }}
          />
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          This may take 5-10 seconds...
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        
        @keyframes progress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
