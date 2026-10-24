import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, User, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';

interface AIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAiGenerated?: boolean;
}

export const AIDrawer: React.FC<AIDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I'm your Vektor HCM Assistant. Ask me anything about attendance, leaves, payroll calculations, or company policies.`,
      isAiGenerated: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const role = user?.role || 'employee';

  const quickChips =
    role === 'employee'
      ? [
          'How many sick leaves do I have left?',
          'What is the office start and grace period?',
          'How many hours count as a half day?',
        ]
      : [
          'How many active employees are in the company?',
          'Who came late today?',
          'What is this month’s attendance rate?',
          'What is the monthly payroll total?',
        ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await api.post('/ai/chat', {
        prompt: text,
        conversation_history: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const botMsg: Message = {
        role: 'assistant',
        content: data.response || 'I could not generate a response.',
        isAiGenerated: true,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'The AI assistant is taking a moment. Please verify the AI API key or retry in a few seconds.',
          isAiGenerated: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-brand-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">Vektor AI Assistant</h3>
              <p className="text-[10px] text-brand-100">Live HCM Intelligence & Policy Q&A</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setMessages([
                  {
                    role: 'assistant',
                    content: 'Chat history cleared. How can I help you?',
                    isAiGenerated: true,
                  },
                ])
              }
              title="Clear chat"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-1.5">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="text-[11px] bg-white border border-gray-200 px-2.5 py-1 rounded-full text-gray-700 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-left cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                  m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-xs'
                    : 'bg-gray-100 text-gray-800 rounded-tl-xs border border-gray-200/50'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.isAiGenerated && (
                  <span className="block text-[9px] text-gray-400 mt-1 font-medium">
                    ✨ AI-generated from company rules & live data
                  </span>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 items-center text-xs text-gray-400 pl-9">
              <span className="inline-block animate-bounce">●</span>
              <span className="inline-block animate-bounce delay-100">●</span>
              <span className="inline-block animate-bounce delay-200">●</span>
              <span>Querying HCM data...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything or request leave..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-gray-900"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
