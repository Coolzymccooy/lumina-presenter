
import React, { useState, useEffect } from 'react';
import { BibleIcon, SearchIcon, PlayIcon, PlusIcon, SparklesIcon, TrashIcon } from './Icons';
import { ServiceItem, ItemType, MediaType } from '../types';
import { DEFAULT_BACKGROUNDS, SOLID_COLORS } from '../constants';
import { semanticBibleSearch, generateVisionaryBackdrop } from '../services/geminiService';

interface Verse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleBrowserProps {
  onAddRequest: (item: ServiceItem) => void;
  onProjectRequest: (item: ServiceItem) => void;
}

const PRESET_BGS = DEFAULT_BACKGROUNDS.slice(0, 4);

export const BibleBrowser: React.FC<BibleBrowserProps> = ({ onAddRequest, onProjectRequest }) => {
  const [search, setSearch] = useState('John 3:16');
  const [results, setResults] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('kjv');
  const [isVisionaryMode, setIsVisionaryMode] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Background State Management
  const [generatedBg, setGeneratedBg] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<string>(DEFAULT_BACKGROUNDS[1]);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType>('image');

  const fetchScripture = async (query: string, useSemantic = false) => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      let finalQuery = query;
      if (useSemantic) {
        setAiLoading(true);
        finalQuery = await semanticBibleSearch(query);
      }

      const res = await fetch(`https://bible-api.com/${encodeURIComponent(finalQuery)}?translation=${selectedVersion}`);
      const data = await res.json();
      
      if (data.verses) {
        setResults(data.verses);
        setGeneratedBg(null); // Clear AI art on new search
        setSelectedBg(DEFAULT_BACKGROUNDS[1]); // Reset to safe default
        setSelectedMediaType('image');
      } else {
        setError("Reference not found. Try 'John 3:16' or an emotion.");
        setResults([]);
      }
    } catch (err) {
      setError("Network error. Could not reach Bible API.");
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  const handleVisionaryVisuals = async () => {
    if (results.length === 0) return;
    setAiLoading(true);
    try {
      const verseText = results.map(v => v.text).join(' ');
      const bg = await generateVisionaryBackdrop(verseText);
      if (bg) {
          setGeneratedBg(bg);
          setSelectedBg(bg); // Auto-select the new AI art
          setSelectedMediaType('image');
      }
    } catch (err) {
      setError("AI Visual failed. Using default.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length > 3 && !isVisionaryMode) fetchScripture(search);
    }, 800);
    return () => clearTimeout(timer);
  }, [search, selectedVersion]);

  const createServiceItem = (verses: Verse[]): ServiceItem => {
    const title = `${verses[0].book_name} ${verses[0].chapter}:${verses[0].verse}${verses.length > 1 ? '-' + verses[verses.length-1].verse : ''}`;
    return {
      id: `bible-${Date.now()}`,
      title: title,
      type: ItemType.BIBLE,
      theme: {
        backgroundUrl: selectedBg,
        mediaType: selectedMediaType,
        fontFamily: 'serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'large'
      },
      slides: verses.map(v => ({
        id: `v-${v.verse}-${Date.now()}`,
        content: v.text.trim(),
        label: `${v.book_name} ${v.chapter}:${v.verse}`
      }))
    };
  };

  const handleSchedule = () => {
    if (results.length === 0) return;
    onAddRequest(createServiceItem(results));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleBgSelect = (url: string, type: MediaType) => {
      setSelectedBg(url);
      setSelectedMediaType(type);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex items-center justify-between bg-zinc-950">
        <div className="flex items-center">
            <BibleIcon className="w-3 h-3 mr-2" />
            Scripture Engine
        </div>
        <button 
            onClick={() => setIsVisionaryMode(!isVisionaryMode)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] border transition-all ${isVisionaryMode ? 'bg-purple-950/30 text-purple-400 border-purple-800' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
        >
            <SparklesIcon className="w-2 h-2" />
            {isVisionaryMode ? 'VISIONARY ON' : 'AI MODE'}
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="relative">
          <input 
            type="text"
            className={`w-full bg-zinc-900 border rounded-sm py-2 pl-8 pr-3 text-xs text-white focus:outline-none font-mono transition-colors ${isVisionaryMode ? 'border-purple-900 focus:border-purple-500' : 'border-zinc-800 focus:border-blue-600'}`}
            placeholder={isVisionaryMode ? "e.g. I need peace..." : "Reference (e.g. John 3:16)..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && isVisionaryMode) fetchScripture(search, true);
            }}
          />
          {isVisionaryMode ? (
              <SparklesIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-purple-600 animate-pulse" />
          ) : (
              <SearchIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-zinc-600" />
          )}
        </div>

        <div className="flex gap-2">
           <select 
             value={selectedVersion} 
             onChange={e => setSelectedVersion(e.target.value)}
             className="flex-1 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 py-1 px-2 rounded-sm focus:outline-none"
           >
              <option value="kjv">KJV</option>
              <option value="web">WEB</option>
              <option value="bbe">BBE</option>
           </select>
           {isVisionaryMode && (
               <button 
                onClick={() => fetchScripture(search, true)}
                className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-sm text-[9px] font-bold transition-all active:scale-95"
               >
                 GO
               </button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading || aiLoading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-3">
                <div className="w-6 h-6 border-2 border-zinc-800 border-t-purple-500 rounded-full animate-spin"></div>
                <span className="text-[10px] font-mono text-zinc-600 uppercase animate-pulse">{aiLoading ? 'AI Thinking...' : 'Searching...'}</span>
            </div>
        ) : error ? (
            <div className="p-4 text-center text-[10px] text-red-400 font-mono opacity-60 uppercase">{error}</div>
        ) : results.length > 0 ? (
            <div className="space-y-4 animate-in fade-in duration-500">
                
                {/* Visual Theme Selector */}
                <div className="bg-zinc-900/60 rounded-sm p-3 border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Background Style</span>
                        {generatedBg && (
                            <button onClick={() => setGeneratedBg(null)} className="text-[9px] text-red-500 hover:text-red-400 flex items-center gap-1">
                                <TrashIcon className="w-2.5 h-2.5" /> REVERT
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {/* AI Slot */}
                        <div className="flex flex-col gap-1 items-center shrink-0">
                            {generatedBg ? (
                                <button 
                                    onClick={() => handleBgSelect(generatedBg, 'image')}
                                    className={`w-10 h-10 rounded-sm border-2 overflow-hidden bg-cover bg-center transition-all ${selectedBg === generatedBg ? 'border-purple-500 ring-1 ring-purple-500/50 scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'}`}
                                    style={{ backgroundImage: `url(${generatedBg})` }}
                                />
                            ) : (
                                <button 
                                    onClick={handleVisionaryVisuals}
                                    className="w-10 h-10 rounded-sm border border-dashed border-purple-900/50 bg-purple-950/10 flex items-center justify-center text-purple-600 hover:bg-purple-900/20 transition-all group"
                                    title="Generate AI Background"
                                >
                                    <SparklesIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                </button>
                            )}
                            <span className="text-[7px] text-zinc-600 uppercase font-bold">AI ART</span>
                        </div>

                        <div className="h-6 w-px bg-zinc-800 mx-1 shrink-0" />

                        {/* Presets */}
                        {PRESET_BGS.map((url, i) => (
                             <div key={i} className="flex flex-col gap-1 items-center shrink-0">
                                <button 
                                    onClick={() => handleBgSelect(url, 'image')}
                                    className={`w-10 h-10 rounded-sm border-2 overflow-hidden bg-cover bg-center transition-all ${selectedBg === url ? 'border-blue-500 ring-1 ring-blue-500/50 scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'}`}
                                    style={{ backgroundImage: `url(${url})` }}
                                />
                                <span className="text-[7px] text-zinc-600 uppercase font-bold">#{i+1}</span>
                             </div>
                        ))}

                        <div className="h-6 w-px bg-zinc-800 mx-1 shrink-0" />

                        {/* Solid / Minimal */}
                        <div className="flex flex-col gap-1 items-center shrink-0">
                            <button 
                                onClick={() => handleBgSelect('#000000', 'color')}
                                className={`w-10 h-10 rounded-sm border-2 transition-all bg-black ${selectedBg === '#000000' ? 'border-white ring-1 ring-white/50 scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'}`}
                            />
                            <span className="text-[7px] text-zinc-600 uppercase font-bold">PLAIN</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="px-1 text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
                        Preview: {results[0].book_name} {results[0].chapter}
                    </div>
                    {results.map((v, i) => (
                        <div key={i} className={`p-3 rounded-sm border transition-all ${selectedBg === generatedBg ? 'bg-purple-950/10 border-purple-900/30' : 'bg-zinc-900/40 border-zinc-900'}`}>
                            <div className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter mb-1">Verse {v.verse}</div>
                            <p className="text-[11px] leading-relaxed text-zinc-200 font-serif italic">"{v.text.trim()}"</p>
                        </div>
                    ))}
                </div>
                
                <div className="flex gap-2 p-1 pt-2 sticky bottom-0 bg-zinc-950/80 backdrop-blur-md pb-4">
                    <button 
                        onClick={() => onProjectRequest(createServiceItem(results))}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-2.5 rounded-sm text-[10px] font-bold transition-all group active:scale-95"
                    >
                        <PlayIcon className="w-3 h-3 fill-current group-hover:text-white" />
                        PROJECT NOW
                    </button>
                    <button 
                        onClick={handleSchedule}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-[10px] font-bold transition-all active:scale-95 border ${showSuccess ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'}`}
                    >
                        {showSuccess ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                SCHEDULED
                            </>
                        ) : (
                            <>
                                <PlusIcon className="w-3 h-3" />
                                SCHEDULE
                            </>
                        )}
                    </button>
                </div>
            </div>
        ) : (
            <div className="text-center py-20 opacity-20"><BibleIcon className="w-12 h-12 mx-auto mb-2 text-zinc-500" /><span className="text-[10px] font-mono tracking-widest uppercase">Bible Library</span></div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-900 bg-zinc-950/50">
          <p className="text-[9px] text-zinc-600 leading-tight">
              Select a background style above before projecting. Use <b>Plain</b> for high-contrast text or <b>AI Art</b> for cinematic visuals.
          </p>
      </div>
    </div>
  );
};
