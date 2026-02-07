
import React, { useState } from 'react';
import { generateSlidesFromText, suggestVisualTheme } from '../services/geminiService';
import { ItemType, ServiceItem } from '../types';
import { SparklesIcon, BibleIcon, MonitorIcon } from './Icons'; // Assuming icons exist or use generics

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (item: ServiceItem) => void;
}

type AIMode = 'SONG' | 'ANNOUNCEMENT' | 'SERMON' | 'SCRIPTURE' | 'VISUAL';

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<AIMode>('SONG');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Prompt Engineering based on Mode
      let prompt = inputText;
      if (mode === 'SERMON') prompt = `Create a sermon outline presentation from these notes: ${inputText}`;
      if (mode === 'SCRIPTURE') prompt = `Create a visual scripture presentation for: ${inputText}`;

      // 1. Generate Slides Structure
      const slideData = await generateSlidesFromText(prompt);
      
      if (slideData) {
        // 2. Suggest Theme
        const themeKeyword = await suggestVisualTheme(inputText);
        const bgUrl = `https://picsum.photos/seed/${themeKeyword}/1920/1080`;

        const newItem: ServiceItem = {
          id: Date.now().toString(),
          title: mode === 'SCRIPTURE' ? inputText : (slideData.slides[0]?.content.substring(0, 20) || "AI Generated"),
          type: mode === 'SONG' ? ItemType.SONG : ItemType.ANNOUNCEMENT, // Map others to generic or keep simple
          theme: {
            backgroundUrl: bgUrl,
            fontFamily: mode === 'SONG' || mode === 'SCRIPTURE' ? 'serif' : 'sans-serif',
            textColor: '#ffffff',
            shadow: true,
            fontSize: mode === 'SERMON' ? 'medium' : 'large'
          },
          slides: slideData.slides.map((s, idx) => ({
            id: `gen-${Date.now()}-${idx}`,
            content: s.content,
            label: s.label || `Slide ${idx + 1}`
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

  const ModeButton = ({ m, label, icon }: { m: AIMode, label: string, icon?: React.ReactNode }) => (
    <button 
        onClick={() => setMode(m)}
        className={`flex-1 px-2 py-3 flex flex-col items-center justify-center gap-2 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all border ${mode === m ? 'bg-zinc-800 text-white border-blue-500/50 shadow-lg shadow-blue-900/10' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:bg-zinc-900 hover:text-zinc-300'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-3xl mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center">
                <SparklesIcon className="text-white w-3 h-3" />
            </div>
            <div>
                <h2 className="text-sm font-bold text-zinc-100">LUMINA AI ENGINE <span className="text-[9px] px-1 bg-blue-900/30 text-blue-400 rounded border border-blue-900/50">V2.0</span></h2>
                <p className="text-[10px] text-zinc-500">Generative Content Assistance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">✕</button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-4 gap-2 mb-6">
                <ModeButton m="SONG" label="Lyrics" icon={<span className="text-lg">🎵</span>} />
                <ModeButton m="ANNOUNCEMENT" label="Announce" icon={<span className="text-lg">📢</span>} />
                <ModeButton m="SERMON" label="Sermon" icon={<span className="text-lg">🎙️</span>} />
                <ModeButton m="SCRIPTURE" label="Scripture" icon={<span className="text-lg">📖</span>} />
            </div>

            <div className="mb-6">
                <label className="flex justify-between items-end text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    <span>{mode === 'SONG' ? 'Paste Lyrics' : mode === 'SERMON' ? 'Paste Sermon Notes / Outline' : mode === 'SCRIPTURE' ? 'Enter Reference (e.g. John 3:16)' : 'Enter Details'}</span>
                    <span className="text-purple-400 text-[9px]">✨ GPT-4o Optimized</span>
                </label>
                <div className="relative group">
                    <textarea
                        className="w-full h-64 bg-zinc-900/50 border border-zinc-800 rounded-md p-4 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-900/50 resize-none font-mono text-sm leading-relaxed transition-all"
                        placeholder={
                            mode === 'SONG' ? "Amazing grace how sweet the sound..." : 
                            mode === 'SERMON' ? "Title: The Power of Hope\n1. Definition of Hope\n2. Biblical Examples\n3. Application" : 
                            mode === 'SCRIPTURE' ? "John 3:16-18 (NKJV)" : 
                            "Church picnic this Sunday at 2PM..."}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        maxLength={5000}
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono">{inputText.length}/5000</div>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs rounded-md flex justify-between items-center">
                    <span className="flex items-center gap-2">⚠️ {error}</span>
                    <button onClick={() => setError(null)} className="hover:text-white">✕</button>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
            >
                CANCEL
            </button>
            <button 
                onClick={handleGenerate}
                disabled={isProcessing || !inputText.trim()}
                className="relative overflow-hidden group flex items-center gap-2 px-8 py-2.5 bg-zinc-100 text-black hover:bg-white rounded-md text-xs font-bold tracking-wide transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 shadow-lg shadow-purple-900/20"
            >
                {isProcessing && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent animate-shimmer" />}
                <SparklesIcon className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'GENERATING...' : 'GENERATE SLIDES'}
            </button>
        </div>
      </div>
    </div>
  );
};
