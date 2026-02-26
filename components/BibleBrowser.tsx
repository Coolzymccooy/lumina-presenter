
import React, { useState, useEffect, useRef } from 'react';
import { BibleIcon, SearchIcon, PlayIcon, PlusIcon, SparklesIcon, TrashIcon } from './Icons';
import { ServiceItem, ItemType, MediaType } from '../types';
import { DEFAULT_BACKGROUNDS } from '../constants';
import { semanticBibleSearch, generateVisionaryBackdrop } from '../services/geminiService';

interface Verse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

const VERSIONS = [
  { id: 'kjv', name: 'King James Version' },
  { id: 'web', name: 'World English Bible' },
  { id: 'bbe', name: 'Bible in Basic English' },
  { id: 'asv', name: 'American Standard Version' },
  { id: 'ylt', name: "Young's Literal Translation" },
  { id: 'darby', name: 'Darby Translation' },
  { id: 'dra', name: 'Douay-Rheims 1899' },
  { id: 'webbe', name: 'WEB British Edition' },
];

// Books list with chapter counts
const BIBLE_BOOKS: { name: string; chapters: number }[] = [
  { name: 'Genesis', chapters: 50 }, { name: 'Exodus', chapters: 40 }, { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 }, { name: 'Deuteronomy', chapters: 34 }, { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 }, { name: '1 Kings', chapters: 22 }, { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 }, { name: '2 Chronicles', chapters: 36 }, { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 }, { name: 'Proverbs', chapters: 31 }, { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 }, { name: 'Isaiah', chapters: 66 }, { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 }, { name: 'Ezekiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 }, { name: 'Joel', chapters: 3 }, { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 }, { name: 'Jonah', chapters: 4 }, { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 }, { name: 'Habakkuk', chapters: 3 }, { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 }, { name: 'Zechariah', chapters: 14 }, { name: 'Malachi', chapters: 4 },
  { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 }, { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 }, { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 }, { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 }, { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 },
];

const PRESET_BGS = DEFAULT_BACKGROUNDS.slice(0, 4);

export const BibleBrowser: React.FC<any> = ({ onAddRequest, onProjectRequest }) => {
  const [bookInput, setBookInput] = useState('');
  const [selectedBook, setSelectedBook] = useState<{ name: string; chapters: number } | null>(null);
  const [chapter, setChapter] = useState<number>(1);
  const [verseFrom, setVerseFrom] = useState<number>(1);
  const [verseTo, setVerseTo] = useState<number>(1);
  const [showBookDropdown, setShowBookDropdown] = useState(false);
  const [filteredBooks, setFilteredBooks] = useState<{ name: string; chapters: number }[]>([]);

  // AI / free-text mode
  const [aiQuery, setAiQuery] = useState('');
  const [isVisionaryMode, setIsVisionaryMode] = useState(false);

  const [results, setResults] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('kjv');
  const [showSuccess, setShowSuccess] = useState(false);

  const [selectedBg, setSelectedBg] = useState<string>(DEFAULT_BACKGROUNDS[1]);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType>('image');

  const bookInputRef = useRef<HTMLInputElement>(null);

  // Filter book suggestions as user types
  useEffect(() => {
    if (!bookInput.trim()) { setFilteredBooks([]); setShowBookDropdown(false); return; }
    const q = bookInput.toLowerCase();
    const matches = BIBLE_BOOKS.filter(b => b.name.toLowerCase().startsWith(q) || b.name.toLowerCase().includes(q));
    setFilteredBooks(matches.slice(0, 10));
    setShowBookDropdown(matches.length > 0 && !selectedBook);
  }, [bookInput, selectedBook]);

  const selectBook = (book: { name: string; chapters: number }) => {
    setSelectedBook(book);
    setBookInput(book.name);
    setChapter(1);
    setVerseFrom(1);
    setVerseTo(1);
    setShowBookDropdown(false);
  };

  const buildQuery = () => {
    if (!selectedBook) return '';
    return `${selectedBook.name} ${chapter}:${verseFrom}${verseTo > verseFrom ? `-${verseTo}` : ''}`;
  };

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
        setSelectedBg(DEFAULT_BACKGROUNDS[1]);
        setSelectedMediaType('image');
      } else {
        setError("Reference not found. Try a different book/chapter.");
        setResults([]);
      }
    } catch {
      setError("Network error. Could not reach Bible API.");
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  const handleStructuredSearch = () => {
    const q = buildQuery();
    if (q) fetchScripture(q, false);
  };

  const createServiceItem = (verses: Verse[]): ServiceItem => {
    const title = `${verses[0].book_name} ${verses[0].chapter}:${verses[0].verse}${verses.length > 1 ? '-' + verses[verses.length - 1].verse : ''}`;
    const versionLabel = VERSIONS.find(v => v.id === selectedVersion)?.name || selectedVersion.toUpperCase();
    return {
      id: `bible-${Date.now()}`,
      title,
      type: ItemType.BIBLE,
      theme: { backgroundUrl: selectedBg, mediaType: selectedMediaType, fontFamily: 'serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
      slides: verses.map(v => ({
        id: `v-${v.verse}-${Date.now()}`,
        content: v.text.trim(),
        label: `${v.book_name} ${v.chapter}:${v.verse} (${versionLabel})`
      }))
    };
  };

  const chapterCount = selectedBook?.chapters ?? 150;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
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

      <div className="p-3 space-y-2">
        {isVisionaryMode ? (
          /* ── AI / semantic search ── */
          <div className="space-y-2">
            <div className="relative">
              <SparklesIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-purple-600 animate-pulse" />
              <input
                type="text"
                className="w-full bg-zinc-900 border border-purple-900 focus:border-purple-500 rounded-sm py-2 pl-8 pr-3 text-xs text-white focus:outline-none font-mono"
                placeholder="e.g. I need peace and comfort..."
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchScripture(aiQuery, true); }}
              />
            </div>
            <button
              onClick={() => fetchScripture(aiQuery, true)}
              className="w-full py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-sm text-[9px] font-bold transition-all"
            >
              AI SEARCH
            </button>
          </div>
        ) : (
          /* ── Structured book / chapter / verse search ── */
          <div className="space-y-2">
            {/* Book autocomplete */}
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-zinc-600" />
              <input
                ref={bookInputRef}
                type="text"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-600 rounded-sm py-2 pl-8 pr-3 text-xs text-white focus:outline-none font-mono"
                placeholder="Book name (e.g. John)..."
                value={bookInput}
                onChange={e => { setBookInput(e.target.value); setSelectedBook(null); }}
                onFocus={() => { if (filteredBooks.length) setShowBookDropdown(true); }}
              />
              {/* Book suggestions dropdown */}
              {showBookDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-sm shadow-xl max-h-40 overflow-y-auto">
                  {filteredBooks.map(b => (
                    <button
                      key={b.name}
                      onMouseDown={() => selectBook(b)}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors font-mono"
                    >
                      {b.name} <span className="text-zinc-600">({b.chapters} ch.)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chapter + Verse row — shown once a book is selected */}
            {selectedBook && (
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">Chapter</label>
                  <select
                    value={chapter}
                    onChange={e => { setChapter(Number(e.target.value)); setVerseFrom(1); setVerseTo(1); }}
                    className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: chapterCount }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">From verse</label>
                  <select
                    value={verseFrom}
                    onChange={e => { const v = Number(e.target.value); setVerseFrom(v); if (verseTo < v) setVerseTo(v); }}
                    className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: 200 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">To verse</label>
                  <select
                    value={verseTo}
                    onChange={e => setVerseTo(Number(e.target.value))}
                    className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: 200 }, (_, i) => i + 1).filter(n => n >= verseFrom).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Preview of the reference being searched */}
            {selectedBook && (
              <div className="px-1 text-[9px] text-blue-500 font-mono">
                → {buildQuery()}
              </div>
            )}
          </div>
        )}

        {/* Version selector + Search button */}
        <div className="flex gap-2">
          <select
            value={selectedVersion}
            onChange={e => setSelectedVersion(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 py-1 px-2 rounded-sm focus:outline-none"
          >
            {VERSIONS.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.id.toUpperCase()})</option>
            ))}
          </select>
          <button
            onClick={() => isVisionaryMode ? fetchScripture(aiQuery, true) : handleStructuredSearch()}
            disabled={isVisionaryMode ? !aiQuery.trim() : !selectedBook}
            className="px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-sm text-[9px] font-bold transition-all active:scale-95"
          >
            SEARCH
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading || aiLoading ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-[10px] font-mono text-zinc-600 uppercase animate-pulse">{aiLoading ? 'AI Thinking...' : 'Searching...'}</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-[10px] text-red-400 font-mono opacity-60 uppercase">{error}</div>
        ) : results.length > 0 ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="space-y-2">
              <div className="px-1 text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
                {results[0].book_name} {results[0].chapter} — {results.length} verse{results.length > 1 ? 's' : ''}
              </div>
              {results.map((v, i) => (
                <div key={i} className="p-3 rounded-sm border bg-zinc-900/40 border-zinc-900">
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
                onClick={() => { onAddRequest(createServiceItem(results)); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 2000); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-[10px] font-bold transition-all active:scale-95 border ${showSuccess ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'}`}
              >
                {showSuccess ? 'SCHEDULED ✓' : 'SCHEDULE'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 opacity-20">
            <BibleIcon className="w-12 h-12 mx-auto mb-2 text-zinc-500" />
            <span className="text-[10px] font-mono tracking-widest uppercase">Bible Library</span>
          </div>
        )}
      </div>
    </div>
  );
};
