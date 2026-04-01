import React, { useEffect, useRef, useState } from 'react';
import { searchCatalogHymns } from '../services/hymnCatalog';
import { generateSlidesFromHymn } from '../services/hymnGenerator';
import { getSuggestedBackgroundForHymn } from '../services/hymnThemeRouter';
import { stampItemBackgroundSource } from '../services/backgroundPersistence';
import {
  analyzeSermonAndGenerateDeck,
  assistQueryWithAI,
  generateSlidesFromText,
  suggestVisualTheme,
  type AIAssistResult,
  type AIAssistSection,
} from '../services/geminiService';
import { ItemType, ServiceItem } from '../types';
import type { Hymn } from '../types/hymns';
import { SparklesIcon, SearchIcon, MusicIcon } from './Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type AIMode = 'SEARCH' | 'SONG' | 'ANNOUNCEMENT' | 'SERMON' | 'SCRIPTURE';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (item: ServiceItem) => void;
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectQueryIntent(q: string): AIMode {
  const lower = q.toLowerCase();
  if (/\b(psalm|proverbs|genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|ecclesiastes|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\b|\d+:\d+/.test(lower)) return 'SCRIPTURE';
  if (/\b(sermon|message|preach|outline|devotion|teaching|bible study)\b/.test(lower)) return 'SERMON';
  if (/\b(announc|event|sunday|service|meeting|notice|program|upcoming)\b/.test(lower)) return 'ANNOUNCEMENT';
  return 'SONG';
}

const SECTION_TYPE_COLORS: Record<string, string> = {
  verse:   'bg-blue-900/40 text-blue-300 border-blue-800/50',
  chorus:  'bg-purple-900/40 text-purple-300 border-purple-800/50',
  bridge:  'bg-amber-900/40 text-amber-300 border-amber-800/50',
  intro:   'bg-zinc-800 text-zinc-400 border-zinc-700',
  outro:   'bg-zinc-800 text-zinc-400 border-zinc-700',
  point:   'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  heading: 'bg-rose-900/30 text-rose-300 border-rose-800/50',
  body:    'bg-zinc-800/60 text-zinc-300 border-zinc-700',
};

// ─── Section Badge ────────────────────────────────────────────────────────────

const SectionBadge: React.FC<{ section: AIAssistSection }> = ({ section }) => {
  const colorClass = SECTION_TYPE_COLORS[section.type] || SECTION_TYPE_COLORS.body;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${colorClass}`}>
      {section.label}
    </span>
  );
};

// ─── Hymn Result Card ─────────────────────────────────────────────────────────

const HymnResultCard: React.FC<{
  hymn: Hymn;
  onGenerate: (item: ServiceItem) => void;
  onClose: () => void;
}> = ({ hymn, onGenerate, onClose }) => {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    try {
      const suggestion = getSuggestedBackgroundForHymn(hymn);
      const result = generateSlidesFromHymn(hymn, {
        chorusStrategy: hymn.presentationDefaults.defaultChorusStrategy,
        typographyPresetId: hymn.presentationDefaults.defaultTypographyPresetId,
        backgroundOverride: suggestion.candidate,
      });
      const item = stampItemBackgroundSource(result.item, 'system');
      onGenerate(item);
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  const sectionSummary = hymn.sections.slice(0, 8).map((s) => {
    const tag = s.type === 'chorus' || s.type === 'refrain' ? 'Ch' :
                s.type === 'bridge' ? 'Br' :
                s.type === 'doxology' ? 'Dx' :
                `V${s.order}`;
    return tag;
  });

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-all overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <MusicIcon className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="text-[11px] font-bold text-zinc-100 truncate">{hymn.title}</span>
            </div>
            <div className="text-[9px] text-zinc-500 truncate">
              {hymn.authors[0]?.name || 'Traditional'} •{' '}
              {hymn.sections.length} section{hymn.sections.length !== 1 ? 's' : ''} •{' '}
              <span className="text-emerald-400 font-semibold">Local Library</span>
            </div>
          </div>
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
            {hymn.copyright.publicDomain ? 'Public Domain' : 'Library'}
          </span>
        </div>

        {/* Section chips */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {sectionSummary.map((tag, i) => (
            <span key={i} className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${tag.startsWith('Ch') || tag.startsWith('Br') ? 'bg-purple-900/40 text-purple-300 border-purple-800/50' : 'bg-blue-900/30 text-blue-300 border-blue-800/40'}`}>
              {tag}
            </span>
          ))}
        </div>

        {/* First line preview */}
        <p className="text-[10px] text-zinc-400 italic leading-relaxed mb-2.5 line-clamp-2">
          "{hymn.firstLine}"
        </p>

        {/* Expandable sections */}
        {expanded && (
          <div className="mb-2.5 space-y-1.5 border-t border-zinc-800 pt-2">
            {hymn.sections.slice(0, 6).map((s) => (
              <div key={s.id} className="text-[9px]">
                <span className="font-bold text-zinc-500 uppercase tracking-wider">{s.label}: </span>
                <span className="text-zinc-400">{s.text.split('\n')[0].slice(0, 60)}…</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95"
          >
            <SparklesIcon className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'Generate Slides'}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300 text-[9px] font-bold uppercase tracking-wide border border-zinc-800 hover:border-zinc-600 rounded transition-all"
          >
            {expanded ? 'Less' : 'Preview'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Manual Input Prompt Card ─────────────────────────────────────────────────
// Shown when AI recognises the song title but won't fabricate copyrighted lyrics

const ManualInputCard: React.FC<{
  title: string;
  onPasteManually: () => void;
}> = ({ title, onPasteManually }) => (
  <div className="rounded-md border border-amber-800/50 bg-amber-950/30 overflow-hidden">
    <div className="p-3">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg leading-none shrink-0">🎵</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-zinc-100 truncate mb-0.5">{title}</div>
          <div className="text-[9px] text-amber-400 font-semibold">Song Recognised — Lyrics Not Generated</div>
        </div>
      </div>
      <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
        To protect accuracy, Lumina does not generate lyrics for modern copyrighted songs — AI lyrics are often wrong and will differ between users. Paste the exact lyrics from an authorised source (e.g. the song book, publisher website, or SongSelect).
      </p>
      <button
        onClick={onPasteManually}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-700/60 hover:bg-amber-600/70 text-amber-100 rounded text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95 border border-amber-700/50"
      >
        Paste Lyrics Manually →
      </button>
    </div>
  </div>
);

// ─── AI Result Card ───────────────────────────────────────────────────────────

const AIResultCard: React.FC<{
  result: AIAssistResult;
  onGenerate: (item: ServiceItem) => void;
  onClose: () => void;
  onInsertText: (text: string, mode: AIMode) => void;
}> = ({ result, onGenerate, onClose, onInsertText }) => {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fullText = result.sections.map((s) => `${s.label}\n${s.text}`).join('\n\n');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const themeKeyword = await suggestVisualTheme(result.rawText || fullText);
      const bgUrl = `https://picsum.photos/seed/${encodeURIComponent(themeKeyword)}/1920/1080`;
      const slideData = await generateSlidesFromText(fullText);
      if (!slideData) throw new Error('No slides generated');
      const item: ServiceItem = {
        id: `ai-${Date.now()}`,
        title: result.title || 'AI Content',
        type: result.intent === 'lyrics' ? ItemType.SONG : ItemType.ANNOUNCEMENT,
        theme: {
          backgroundUrl: bgUrl,
          fontFamily: result.intent === 'lyrics' ? 'serif' : 'sans-serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: 'large',
        },
        slides: slideData.slides.map((s, idx) => ({
          id: `ai-${Date.now()}-${idx}`,
          content: s.content,
          label: s.label || `Slide ${idx + 1}`,
        })),
      };
      onGenerate(item);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const modeForInsert: AIMode = result.intent === 'lyrics' ? 'SONG' :
    result.intent === 'sermon' ? 'SERMON' :
    result.intent === 'announcement' ? 'ANNOUNCEMENT' : 'SONG';

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-all overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-zinc-100 truncate mb-0.5">{result.title}</div>
            <div className="text-[9px] text-zinc-500">
              {result.sections.length} section{result.sections.length !== 1 ? 's' : ''} •{' '}
              <span className="text-blue-400 font-semibold">AI Generated</span>
              {result.confidence >= 0.8 && <span className="text-zinc-600"> • High confidence</span>}
            </div>
          </div>
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase bg-blue-900/30 text-blue-400 border border-blue-800/50">
            AI
          </span>
        </div>

        {/* Section chips */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {result.sections.slice(0, 8).map((s, i) => <SectionBadge key={i} section={s} />)}
        </div>

        {/* Expandable content */}
        {expanded && (
          <div className="mb-2.5 space-y-2 border-t border-zinc-800 pt-2 max-h-40 overflow-y-auto custom-scrollbar">
            {result.sections.map((s, i) => (
              <div key={i}>
                <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">{s.label}</div>
                <p className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{s.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95"
          >
            <SparklesIcon className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'Generate Slides'}
          </button>
          <button
            onClick={() => onInsertText(fullText, modeForInsert)}
            className="px-2 py-1.5 text-zinc-400 hover:text-zinc-200 text-[9px] font-bold uppercase tracking-wide border border-zinc-800 hover:border-zinc-600 rounded transition-all"
          >
            Edit
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300 text-[9px] font-bold uppercase tracking-wide border border-zinc-800 hover:border-zinc-600 rounded transition-all"
          >
            {expanded ? 'Less' : 'Preview'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [mode, setMode] = useState<AIMode>('SEARCH');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSearchError, setAiSearchError] = useState<{ kind: 'unavailable' | 'not-found'; msg: string } | null>(null);

  // Search results
  const [hymnResults, setHymnResults] = useState<Hymn[]>([]);
  const [aiResult, setAiResult] = useState<AIAssistResult | null>(null);
  const [detectedIntent, setDetectedIntent] = useState<AIMode | null>(null);

  // Sermon validation (preserve existing feature)
  const [sermonValidation, setSermonValidation] = useState<{ references: string[]; points: string[] } | null>(null);

  const searchDebounceRef = useRef<number | null>(null);
  const hasResults = hymnResults.length > 0 || aiResult !== null;

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setInputText('');
    setHymnResults([]);
    setAiResult(null);
    setDetectedIntent(null);
    setError(null);
    setAiSearchError(null);
    setSermonValidation(null);
  }, [isOpen]);

  // Debounced local hymn search as user types
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setHymnResults([]);
      setDetectedIntent(null);
      return;
    }
    setAiSearchError(null);   // clear stale AI error when user types
    const intent = detectQueryIntent(searchQuery);
    setDetectedIntent(intent);
    if (intent === 'SONG' || mode === 'SONG' || mode === 'SEARCH') {
      searchDebounceRef.current = window.setTimeout(() => {
        const results = searchCatalogHymns(searchQuery, { limit: 4 }).map((r) => r.hymn);
        setHymnResults(results);
      }, 180);
    } else {
      setHymnResults([]);
    }
  }, [searchQuery, mode]);

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setAiResult(null);
    setAiSearchError(null);
    try {
      const modeParam = detectedIntent === 'SONG' ? 'lyrics' :
        detectedIntent === 'SERMON' ? 'sermon' :
        detectedIntent === 'ANNOUNCEMENT' ? 'announcement' :
        detectedIntent === 'SCRIPTURE' ? 'scripture' : 'auto';
      const result = await assistQueryWithAI(searchQuery, modeParam);
      if (result?.requiresManualInput) {
        // AI recognised the song but won't fabricate copyrighted/uncertain lyrics
        setAiResult(result);
      } else if (result && result.sections?.length) {
        setAiResult(result);
      } else if (result) {
        // AI responded but returned empty sections
        setAiSearchError({ kind: 'not-found', msg: `Couldn't find content for "${searchQuery}". Try a different spelling, or paste the lyrics manually in the Lyrics tab.` });
      } else {
        // null = server unreachable / endpoint not found
        setAiSearchError({ kind: 'unavailable', msg: 'AI search is warming up — the server may still be deploying. Try again in a moment, or paste the lyrics manually in the Lyrics tab.' });
      }
    } catch (e: any) {
      setAiSearchError({ kind: 'unavailable', msg: e.message || 'AI search failed. Check your connection and try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  // Original paste-and-generate flow
  const handleGenerateFromText = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setError(null);
    setSermonValidation(null);
    try {
      let prompt = inputText;
      if (mode === 'SERMON') prompt = `Create a sermon outline presentation from these notes: ${inputText}`;
      if (mode === 'SCRIPTURE') prompt = `Create a visual scripture presentation for: ${inputText}`;

      const slideData = mode === 'SERMON'
        ? await analyzeSermonAndGenerateDeck(inputText)
        : await generateSlidesFromText(prompt);

      if (!slideData) throw new Error('AI returned no slide content.');

      if (mode === 'SERMON') {
        setSermonValidation({
          references: (slideData as any).scriptureReferences || [],
          points: (slideData as any).keyPoints || [],
        });
      }

      const themeKeyword = await suggestVisualTheme(inputText);
      const bgUrl = `https://picsum.photos/seed/${encodeURIComponent(themeKeyword)}/1920/1080`;
      const slides = slideData.slides.slice(0, mode === 'SERMON' ? 20 : slideData.slides.length);

      onGenerate({
        id: Date.now().toString(),
        title: mode === 'SCRIPTURE' ? inputText : mode === 'SERMON' ? 'AI Sermon Deck' : (slides[0]?.content.substring(0, 24) || 'AI Generated'),
        type: mode === 'SONG' ? ItemType.SONG : ItemType.ANNOUNCEMENT,
        theme: {
          backgroundUrl: bgUrl,
          fontFamily: mode === 'SONG' || mode === 'SCRIPTURE' ? 'serif' : 'sans-serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: mode === 'SERMON' ? 'medium' : 'large',
        },
        slides: slides.map((s, idx) => ({
          id: `gen-${Date.now()}-${idx}`,
          content: s.content,
          label: s.label || `Slide ${idx + 1}`,
        })),
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Generation failed. Check API key and network.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInsertText = (text: string, targetMode: AIMode) => {
    setInputText(text);
    setMode(targetMode);
    setAiResult(null);
    setHymnResults([]);
    setSearchQuery('');
  };

  if (!isOpen) return null;

  const modeLabel: Record<AIMode, string> = {
    SEARCH: 'Search',
    SONG: 'Paste Lyrics',
    ANNOUNCEMENT: 'Enter Details',
    SERMON: 'Paste Sermon Notes / Outline',
    SCRIPTURE: 'Enter Reference (e.g. John 3:16)',
  };

  const placeholderText: Record<AIMode, string> = {
    SEARCH: '',
    SONG: 'Amazing grace how sweet the sound\nThat saved a wretch like me...',
    SERMON: 'Title: The Power of Hope\n1. Definition of Hope\n2. Biblical Examples\n3. Application',
    SCRIPTURE: 'John 3:16-18 (NKJV)',
    ANNOUNCEMENT: 'Church picnic this Sunday at 2PM...',
  };

  const tabs: Array<{ id: AIMode; label: string; icon: string }> = [
    { id: 'SEARCH',       label: 'Search',   icon: '🔍' },
    { id: 'SONG',         label: 'Lyrics',   icon: '🎵' },
    { id: 'ANNOUNCEMENT', label: 'Announce', icon: '📢' },
    { id: 'SERMON',       label: 'Sermon',   icon: '🎙️' },
    { id: 'SCRIPTURE',    label: 'Scripture',icon: '📖' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-3xl mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center">
              <SparklesIcon className="text-white w-3 h-3" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                LUMINA AI ENGINE{' '}
                <span className="text-[9px] px-1 bg-blue-900/30 text-blue-400 rounded border border-blue-900/50">V3.0</span>
              </h2>
              <p className="text-[10px] text-zinc-500">Smart Content Fetch + Slide Generation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">✕</button>
        </div>

        {/* ── Body ── */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">

          {/* Mode tabs */}
          <div className="grid grid-cols-5 gap-1.5">
            {tabs.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => { setMode(id); setError(null); }}
                className={`flex-1 px-2 py-2.5 flex flex-col items-center justify-center gap-1.5 rounded-sm text-[9px] font-bold uppercase tracking-wide transition-all border ${
                  mode === id
                    ? 'bg-zinc-800 text-white border-blue-500/50 shadow-lg shadow-blue-900/10'
                    : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:bg-zinc-900 hover:text-zinc-300'
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ── SEARCH mode ── */}
          {mode === 'SEARCH' && (
            <div className="space-y-3">
              {/* Smart query bar */}
              <div>
                <label className="flex justify-between items-end text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  <span>Search songs, scripture, or describe content</span>
                  {detectedIntent && detectedIntent !== 'SEARCH' && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
                      detectedIntent === 'SONG' ? 'bg-purple-900/30 text-purple-300 border-purple-800/50' :
                      detectedIntent === 'SERMON' ? 'bg-amber-900/30 text-amber-300 border-amber-800/50' :
                      detectedIntent === 'ANNOUNCEMENT' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/50' :
                      'bg-blue-900/30 text-blue-300 border-blue-800/50'
                    }`}>
                      Detected: {detectedIntent === 'SONG' ? 'Lyrics' : detectedIntent === 'ANNOUNCEMENT' ? 'Announcement' : detectedIntent.charAt(0) + detectedIntent.slice(1).toLowerCase()}
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleAISearch(); }}
                      placeholder="Amazing Grace lyrics, Psalm 23 NIV, Sunday announcement…"
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/60 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 text-[11px] transition-all"
                    />
                  </div>
                  <button
                    onClick={handleAISearch}
                    disabled={!searchQuery.trim() || isSearching}
                    className="px-4 py-2.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white rounded-md text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5"
                  >
                    <SparklesIcon className={`w-3 h-3 ${isSearching ? 'animate-spin' : ''}`} />
                    {isSearching ? 'Searching…' : 'AI Search'}
                  </button>
                </div>
              </div>

              {/* Local hymn results */}
              {hymnResults.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Found in Local Library
                  </div>
                  {hymnResults.map((hymn) => (
                    <HymnResultCard key={hymn.id} hymn={hymn} onGenerate={onGenerate} onClose={onClose} />
                  ))}
                </div>
              )}

              {/* AI result */}
              {aiResult && (
                <div className="space-y-2">
                  {aiResult.requiresManualInput ? (
                    <>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Song Found — Exact Lyrics Required
                      </div>
                      <ManualInputCard
                        title={aiResult.title}
                        onPasteManually={() => { setMode('SONG'); setInputText(''); setAiResult(null); setSearchQuery(''); }}
                      />
                    </>
                  ) : (
                    <>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                        AI Generated Content
                      </div>
                      <AIResultCard
                        result={aiResult}
                        onGenerate={onGenerate}
                        onClose={onClose}
                        onInsertText={handleInsertText}
                      />
                    </>
                  )}
                </div>
              )}

              {/* AI search error */}
              {aiSearchError && (
                <div className={`p-3 rounded-md border flex gap-3 items-start text-xs ${
                  aiSearchError.kind === 'unavailable'
                    ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                    : 'bg-zinc-900/60 border-zinc-700 text-zinc-400'
                }`}>
                  <span className="text-lg leading-none shrink-0">
                    {aiSearchError.kind === 'unavailable' ? '⏳' : '🔍'}
                  </span>
                  <div className="space-y-1.5 flex-1">
                    <p className="font-semibold text-[10px] uppercase tracking-wide">
                      {aiSearchError.kind === 'unavailable' ? 'AI Search Warming Up' : 'No AI Content Found'}
                    </p>
                    <p className="text-[10px] leading-relaxed opacity-80">{aiSearchError.msg}</p>
                    {aiSearchError.kind === 'not-found' && (
                      <button
                        onClick={() => { setMode('SONG'); setInputText(''); setAiSearchError(null); }}
                        className="mt-1 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wide border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
                      >
                        Paste Lyrics Manually →
                      </button>
                    )}
                  </div>
                  <button onClick={() => setAiSearchError(null)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">✕</button>
                </div>
              )}

              {/* Empty state */}
              {!hasResults && !isSearching && !aiSearchError && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                  <SearchIcon className="w-8 h-8 text-zinc-600" />
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Smart Content Search</p>
                    <p className="text-[9px] text-zinc-600 mt-1 max-w-xs mx-auto">
                      Type a song title, scripture reference, or describe the content you need.
                      Lumina checks the local library first, then uses AI for anything else.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    {['Amazing Grace', 'Psalm 23 KJV', '3 welcome announcements', 'Sermon on faith'].map((eg) => (
                      <button key={eg} onClick={() => setSearchQuery(eg)}
                        className="px-2 py-1 rounded text-[8px] border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all">
                        {eg}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LYRICS / ANNOUNCE / SERMON / SCRIPTURE modes — paste & generate ── */}
          {mode !== 'SEARCH' && (
            <div className="space-y-3">
              {/* Inline search bar for SONG mode */}
              {mode === 'SONG' && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Quick Search Library</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleAISearch(); }}
                        placeholder="Search hymn library or find lyrics…"
                        className="w-full pl-8 pr-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/40 text-[10px] transition-all"
                      />
                    </div>
                    <button
                      onClick={handleAISearch}
                      disabled={!searchQuery.trim() || isSearching}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 rounded text-[9px] font-bold uppercase tracking-wide transition-all"
                    >
                      {isSearching ? '…' : 'Find'}
                    </button>
                  </div>
                  {hymnResults.length > 0 && (
                    <div className="space-y-1.5">
                      {hymnResults.map((hymn) => (
                        <HymnResultCard key={hymn.id} hymn={hymn} onGenerate={onGenerate} onClose={onClose} />
                      ))}
                    </div>
                  )}
                  {aiResult && (
                    <AIResultCard result={aiResult} onGenerate={onGenerate} onClose={onClose} onInsertText={handleInsertText} />
                  )}
                  {aiSearchError && (
                    <div className={`p-2.5 rounded border flex gap-2 items-start text-[10px] ${
                      aiSearchError.kind === 'unavailable'
                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                        : 'bg-zinc-900/60 border-zinc-700 text-zinc-400'
                    }`}>
                      <span className="shrink-0">{aiSearchError.kind === 'unavailable' ? '⏳' : '🔍'}</span>
                      <span className="leading-relaxed opacity-80">{aiSearchError.msg}</span>
                    </div>
                  )}
                  {(hymnResults.length > 0 || aiResult) && (
                    <div className="text-[9px] text-zinc-600 text-center">— or paste lyrics manually below —</div>
                  )}
                </div>
              )}

              {/* Textarea */}
              <div>
                <label className="flex justify-between items-end text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  <span>{modeLabel[mode]}</span>
                  <span className="text-purple-400 text-[9px]">✨ GPT-4o Optimized</span>
                </label>
                <div className="relative">
                  <textarea
                    className="w-full h-52 bg-zinc-900/50 border border-zinc-800 rounded-md p-4 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-900/50 resize-none font-mono text-sm leading-relaxed transition-all"
                    placeholder={placeholderText[mode]}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    maxLength={5000}
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono">{inputText.length}/5000</div>
                </div>
              </div>

              {/* Sermon validation */}
              {mode === 'SERMON' && sermonValidation && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs rounded-md">
                  <div className="font-bold mb-1">Validated Sermon Analysis</div>
                  <div>Scripture References: {sermonValidation.references.length ? sermonValidation.references.join(', ') : 'None detected'}</div>
                  <div className="mt-1">Key Points Found: {sermonValidation.points.length}</div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs rounded-md flex justify-between items-center">
              <span className="flex items-center gap-2">⚠️ {error}</span>
              <button onClick={() => setError(null)} className="hover:text-white ml-2">✕</button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-between items-center shrink-0">
          <div className="text-[9px] text-zinc-600 font-mono">
            {mode === 'SEARCH' ? 'Local library + AI-powered search' : 'Paste content, then generate'}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
              CANCEL
            </button>
            {mode !== 'SEARCH' && (
              <button
                onClick={handleGenerateFromText}
                disabled={isProcessing || !inputText.trim()}
                className="relative overflow-hidden group flex items-center gap-2 px-7 py-2.5 bg-zinc-100 text-black hover:bg-white rounded-md text-xs font-bold tracking-wide transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 shadow-lg shadow-purple-900/20"
              >
                {isProcessing && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent animate-shimmer" />}
                <SparklesIcon className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'GENERATING…' : 'GENERATE SLIDES'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
