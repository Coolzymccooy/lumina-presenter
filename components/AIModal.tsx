
import React, { useState } from 'react';
import { generateSlidesFromText, suggestVisualTheme } from '../services/geminiService';
import { ItemType, ServiceItem } from '../types';
import { SparklesIcon } from './Icons';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (item: ServiceItem) => void;
}

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'SONG' | 'ANNOUNCEMENT'>('SONG');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Generate Slides Structure
      const slideData = await generateSlidesFromText(inputText);
      
      if (slideData) {
        // 2. Suggest Theme
        const themeKeyword = await suggestVisualTheme(inputText);
        const bgUrl = `https://picsum.photos/seed/${themeKeyword}/1920/1080`;

        const newItem: ServiceItem = {
          id: Date.now().toString(),
          title: inputText.split('\n')[0].substring(0, 30) || "New Item",
          type: mode === 'SONG' ? ItemType.SONG : ItemType.ANNOUNCEMENT,
          theme: {
            backgroundUrl: bgUrl,
            fontFamily: mode === 'SONG' ? 'serif' : 'sans-serif',
            textColor: '#ffffff',
            shadow: true,
          },
          slides: slideData.slides.map((s, idx) => ({
            id: `gen-${Date.now()}-${idx}`,
            content: s.content,
            label: s.label
          }))
        };

        onGenerate(newItem);
        onClose();
        setInputText('');
      } else {
          throw new Error("Empty response from AI");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Connection failed. Please verify API Key and Network.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm w-full max-w-2xl mx-4 shadow-none">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2">
            <SparklesIcon className="text-purple-500 w-4 h-4" />
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">AI Content Generator</h2>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white">✕</button>
        </div>

        <div className="p-6">
            <div className="mb-4 flex gap-2">
                <button 
                    onClick={() => setMode('SONG')}
                    className={`flex-1 px-4 py-2 rounded-sm text-xs font-bold transition-colors border ${mode === 'SONG' ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                >
                    LYRICS / POEM
                </button>
                <button 
                    onClick={() => setMode('ANNOUNCEMENT')}
                    className={`flex-1 px-4 py-2 rounded-sm text-xs font-bold transition-colors border ${mode === 'ANNOUNCEMENT' ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                >
                    ANNOUNCEMENT
                </button>
            </div>

            <div className="mb-6">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Input Text
            </label>
            <textarea
                className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded-sm p-3 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-purple-600 resize-none font-mono text-sm"
                placeholder={mode === 'SONG' ? "Paste lyrics here..." : "Paste announcement details here..."}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                maxLength={5000} // Basic Input Sanitization
            />
            </div>

            {error && (
                <div className="mb-4 p-2 bg-red-900/20 border border-red-900/50 text-red-400 text-xs font-mono rounded-sm flex justify-between items-center">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)} className="text-white underline">Dismiss</button>
                </div>
            )}

            <div className="flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
            >
                CANCEL
            </button>
            <button 
                onClick={handleGenerate}
                disabled={isProcessing || !inputText.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-sm text-xs font-bold tracking-wide transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
                {isProcessing ? 'PROCESSING...' : error ? 'RETRY' : 'GENERATE'}
            </button>
            </div>
        </div>
      </div>
    </div>
  );
};
