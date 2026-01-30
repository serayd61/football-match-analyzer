'use client';

// ============================================================================
// AI CHATBOT COMPONENT
// Sidebar style - Gemini powered football predictions
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, Send, X, Bot, User, 
  Loader2, Sparkles, ChevronLeft, ChevronRight,
  Zap
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function AIChatbot({ isOpen, onToggle }: AIChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '⚽ Merhaba! Ben Football Analytics AI asistanıyım.\n\nBana herhangi bir maç hakkında sorabilirsin:\n• "Galatasaray - Fenerbahçe ne olur?"\n• "Barcelona Real Madrid tahmini"\n• "Premier Lig şampiyonu kim olur?"\n\nHemen tahminimi söyleyeyim! 🎯',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Üzgünüm, bir hata oluştu. Lütfen tekrar dene.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    "Bugünkü maçlar?",
    "En iyi bahis?",
    "Derbi tahmini"
  ];

  return (
    <>
      {/* Toggle Button - Always visible */}
      <motion.button
        onClick={onToggle}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 
          ${isOpen ? 'translate-x-[320px]' : 'translate-x-0'}
          bg-gradient-to-r from-emerald-500 to-cyan-500 
          text-white p-3 rounded-l-xl shadow-lg
          hover:from-emerald-400 hover:to-cyan-400
          transition-all duration-300`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <span className="text-sm font-medium hidden md:block">AI Chat</span>
            <ChevronLeft className="w-4 h-4" />
          </div>
        )}
      </motion.button>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[320px] z-40
              bg-gradient-to-b from-gray-900 via-gray-900 to-black
              border-l border-emerald-500/30 shadow-2xl
              flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-emerald-500/30 bg-black/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 
                      flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full 
                      border-2 border-gray-900 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">Football AI</h3>
                    <p className="text-emerald-400 text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Gemini Powered
                    </p>
                  </div>
                </div>
                <button
                  onClick={onToggle}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                      : 'bg-gray-800/80 text-gray-100 border border-gray-700/50'
                  }`}>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
                        <Bot className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 text-xs font-medium">AI Tahmin</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                    <p className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-white/60' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString('tr-TR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-800/80 rounded-2xl px-4 py-3 border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span className="text-gray-400 text-sm">Analiz ediyorum...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Questions */}
            <div className="px-4 py-2 border-t border-gray-800/50">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs
                      bg-gray-800/50 text-gray-300 border border-gray-700/50
                      hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-400
                      transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-emerald-500/30 bg-black/50">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Maç sorusu sor..."
                  disabled={isLoading}
                  className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-xl
                    px-4 py-3 text-white text-sm placeholder-gray-500
                    focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30
                    disabled:opacity-50 transition-all"
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 
                    text-white p-3 rounded-xl
                    disabled:opacity-50 disabled:cursor-not-allowed
                    hover:from-emerald-400 hover:to-cyan-400
                    transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
              <p className="text-gray-600 text-xs mt-2 text-center">
                Powered by Gemini AI • Tahminler bilgilendirme amaçlıdır
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
