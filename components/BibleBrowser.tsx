import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BibleIcon, SearchIcon, PlayIcon, SparklesIcon } from './Icons';
import { ServiceItem, ItemType, MediaType } from '../types';
import { DEFAULT_BACKGROUNDS } from '../constants';
import { BibleStylePicker } from './BibleStylePicker.tsx';
import {
  generateBibleStyle,
  applyBibleStyle,
  type BibleStyleFamily,
  type BibleStyleMode,
} from '../services/bibleStyleEngine.ts';
import {
  getSermonProcessingJob,
  retrySermonProcessingJob,
  semanticBibleSearch,
  semanticBibleSearchMulti,
  transcribeSermonChunk,
  transcribeSermonAudio,
  type SermonProcessingJob,
  type TranscribeSermonChunkResult,
} from '../services/geminiService';
import { summarizeSermon, canSummarize, type SermonSummary } from '../services/sermonSummaryService';
import { archiveSermon } from '../services/sermonArchive';
import { SermonSummaryPanel } from './SermonSummaryPanel';
import { createBundledTopicBibleMemoryProvider, type BibleMemoryQueryOrigin } from '../services/bibleMemory.ts';
import { resolveBibleIntent } from '../services/bibleIntentResolver.ts';
import {
  buildStructuredBibleDraft,
  buildStructuredBibleRange,
  isStructuredBibleRangeReady,
} from '../services/bibleStructuredSelection.ts';
import {
  BIBLE_BOOKS,
  buildStructuredBibleReference,
  getChapterVerseCount,
  lookupBibleReference,
  normalizeBibleReference,
  type BibleVerse as Verse,
} from '../services/bibleLookup';

interface BibleBrowserProps {
  onAddRequest: (item: ServiceItem) => void;
  onProjectRequest: (item: ServiceItem) => void;
  onLiveStyleUpdate?: (item: ServiceItem) => void;
  speechLocaleMode: VisionarySpeechLocaleMode;
  onSpeechLocaleModeChange: (mode: VisionarySpeechLocaleMode) => void;
  compact?: boolean;
  hasPptxItems?: boolean;
  workspaceId?: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

type VisionarySpeechLocaleMode = 'auto' | 'en-GB' | 'en-US';
type TranscriptionEngineMode = 'browser_stt' | 'cloud_fallback' | 'disabled';
type CloudRecorderState = 'idle' | 'recording' | 'cooldown' | 'uploading' | 'error';

const VERSIONS = [
  // Public domain — no key required
  { id: 'kjv',   name: 'King James Version' },
  { id: 'web',   name: 'World English Bible' },
  { id: 'bbe',   name: 'Bible in Basic English' },
  { id: 'asv',   name: 'American Standard Version' },
  { id: 'ylt',   name: "Young's Literal Translation" },
  { id: 'darby', name: 'Darby Translation' },
  { id: 'dra',   name: 'Douay-Rheims 1899' },
  { id: 'webbe', name: 'WEB British Edition' },
  // Licensed — requires SCRIPTURE_API_BIBLE_KEY on server
  { id: 'niv',   name: 'New International Version' },
  { id: 'nkjv',  name: 'New King James Version' },
  { id: 'esv',   name: 'English Standard Version' },
  { id: 'nlt',   name: 'New Living Translation' },
  { id: 'amp',   name: 'Amplified Bible' },
  { id: 'msg',   name: 'The Message' },
];

const AUTO_DEBOUNCE_MS = 2500;
const AUTO_REQUERY_COOLDOWN_MS = 15000;
const AUTO_REPEAT_REFERENCE_WINDOW_MS = 120000;
const AUTO_WORD_BUFFER = 90;
const AUTO_ERROR_COOLDOWN_MS = 10000;
const AUTO_NETWORK_ERROR_LIMIT = 3;
const AUTO_RESTART_BASE_MS = 600;
const AUTO_MIC_PREFLIGHT_COOLDOWN_MS = 120000;
const AUTO_NETWORK_FALLBACK_THRESHOLD = 2;
const CLOUD_FALLBACK_CHUNK_MS = 15000;
const CLOUD_FALLBACK_RETRY_MS = 3500;
const CLOUD_BROWSER_PROBE_INTERVAL_MS = 45000;
const ENGINE_TOAST_MS = 4200;
const BENIGN_SPEECH_ERRORS = new Set(['no-speech', 'aborted']);
const TRANSIENT_SPEECH_ERRORS = new Set(['network']);
const PERMISSION_SPEECH_ERRORS = new Set(['not-allowed', 'service-not-allowed']);
const DEVICE_SPEECH_ERRORS = new Set(['audio-capture']);
const LOCAL_FIRST_BIBLE_INTENT_ENABLED = /^(1|true|yes|on)$/i.test(String(import.meta.env.VITE_ENABLE_LOCAL_FIRST_BIBLE_INTENT || '').trim());

const getQueryParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    const direct = new URLSearchParams(window.location.search || '').get(key);
    if (direct) return String(direct).trim();
  } catch {
    // ignore
  }
  try {
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const fromHash = new URLSearchParams(hashQuery).get(key);
    if (fromHash) return String(fromHash).trim();
  } catch {
    // ignore
  }
  return '';
};

const getFallbackSessionContext = () => ({
  workspaceId: getQueryParam('workspace') || 'default-workspace',
  sessionId: getQueryParam('session') || 'live',
});

const createFallbackClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `visionary-${crypto.randomUUID()}`;
  }
  return `visionary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      if (!value) {
        reject(new Error('BLOB_READ_FAILED'));
        return;
      }
      const commaIdx = value.indexOf(',');
      resolve(commaIdx >= 0 ? value.slice(commaIdx + 1) : value);
    };
    reader.onerror = () => reject(new Error('BLOB_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
};

const pickSupportedRecorderMimeType = (): 'audio/webm;codecs=opus' | 'audio/webm' | 'audio/mp4' | null => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return null;
};

const getSpeechCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as WindowWithSpeech;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

const isElectronRuntime = (): boolean => (
  typeof navigator !== 'undefined'
  && String(navigator.userAgent || '').toLowerCase().includes('electron')
);

const normalizeLocale = (value: string): string => value.trim().replace(/_/g, '-');

const unique = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  items.forEach((entry) => {
    const normalized = normalizeLocale(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const getNavigatorLocales = (): string[] => {
  if (typeof window === 'undefined') return [];
  const browserLocales = Array.isArray(window.navigator.languages) ? window.navigator.languages : [];
  const navigatorLocale = typeof window.navigator.language === 'string' ? window.navigator.language : '';
  const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  return unique([...browserLocales, navigatorLocale, intlLocale].filter(Boolean));
};

const regionFromLocale = (locale: string): string => {
  const parts = normalizeLocale(locale).split('-');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toUpperCase();
};

export const resolveSpeechLanguageCandidates = (
  mode: VisionarySpeechLocaleMode,
  navigatorLocales: string[]
): string[] => {
  if (mode === 'en-GB') return ['en-GB', 'en-US'];
  if (mode === 'en-US') return ['en-US', 'en-GB'];

  const regionHints = navigatorLocales
    .map(regionFromLocale)
    .filter(Boolean);

  if (regionHints.includes('GB')) return ['en-GB', 'en-US'];
  if (regionHints.includes('US')) return ['en-US', 'en-GB'];
  return ['en-US', 'en-GB'];
};

export const BibleBrowser: React.FC<BibleBrowserProps> = ({
  onAddRequest,
  onProjectRequest,
  onLiveStyleUpdate,
  speechLocaleMode,
  onSpeechLocaleModeChange,
  compact = false,
  hasPptxItems = false,
  workspaceId = 'default-workspace',
}) => {
  const [referenceInput, setReferenceInput] = useState('');
  const [bookInput, setBookInput] = useState('');
  const [selectedBook, setSelectedBook] = useState<{ name: string; chapters: number } | null>(null);
  const [chapter, setChapter] = useState<number>(1);
  const [verseFrom, setVerseFrom] = useState<number>(1);
  const [verseTo, setVerseTo] = useState<number | null>(null);
  const [showBookDropdown, setShowBookDropdown] = useState(false);
  const [filteredBooks, setFilteredBooks] = useState<{ name: string; chapters: number }[]>([]);
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
  const [bibleLayout, setBibleLayout] = useState<'standard' | 'scripture_ref' | 'ticker'>('standard');
  const [bibleFontSize, setBibleFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('large');
  const [bibleStyleMode, setBibleStyleMode] = useState<BibleStyleMode>('classic');
  const [bibleStyleFamily, setBibleStyleFamily] = useState<BibleStyleFamily | null>(null);
  const [bibleStyleSeed, setBibleStyleSeed] = useState<string>('');

  const [autoVisionaryEnabled, setAutoVisionaryEnabled] = useState(false);
  const [autoProjectEnabled, setAutoProjectEnabled] = useState(true);
  const [autoListening, setAutoListening] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoTranscript, setAutoTranscript] = useState('');
  const [autoReferences, setAutoReferences] = useState<string[]>([]);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoSupportError, setAutoSupportError] = useState<string | null>(null);
  const [activeSpeechLanguage, setActiveSpeechLanguage] = useState('en-US');
  const [transcriptionEngine, setTranscriptionEngine] = useState<TranscriptionEngineMode>('disabled');
  const [cloudRecorderState, setCloudRecorderState] = useState<CloudRecorderState>('idle');
  const [engineToast, setEngineToast] = useState<string | null>(null);
  const [cloudCooldownUntil, setCloudCooldownUntil] = useState(0);
  const [browserRestartNonce, setBrowserRestartNonce] = useState(0);

  const bookInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const cloudStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const processTimerRef = useRef<number | null>(null);
  const processAutoTranscriptRef = useRef<() => Promise<void>>(async () => {});
  const cloudRetryTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const transcriptBufferRef = useRef('');
  const lastProcessAtRef = useRef(0);
  const lastReferenceRef = useRef<{ reference: string; at: number }>({ reference: '', at: 0 });
  const lastSpeechErrorAtRef = useRef(0);
  const consecutiveNetworkErrorsRef = useRef(0);
  const restartDelayMsRef = useRef(AUTO_RESTART_BASE_MS);
  const speechCandidatesRef = useRef<string[]>(['en-US', 'en-GB']);
  const activeSpeechCandidateIndexRef = useRef(0);
  const autoEnabledRef = useRef(false);
  const autoProjectRef = useRef(autoProjectEnabled);
  const autoBusyRef = useRef(false);
  const transcriptionEngineRef = useRef<TranscriptionEngineMode>('disabled');
  const micPreflightOkRef = useRef(false);
  const micPreflightAtRef = useRef(0);
  const cloudQueueRef = useRef<Blob[]>([]);
  const cloudUploadInFlightRef = useRef(false);
  const cloudStartInFlightRef = useRef(false);
  const cloudRecorderMimeTypeRef = useRef<'audio/webm;codecs=opus' | 'audio/webm' | 'audio/mp4'>('audio/webm;codecs=opus');
  const probeInFlightRef = useRef(false);
  const lastBrowserProbeAtRef = useRef(0);
  const fallbackClientIdRef = useRef(createFallbackClientId());
  const fallbackContextRef = useRef(getFallbackSessionContext());
  const bibleMemoryProviderRef = useRef(createBundledTopicBibleMemoryProvider());

  // ── Sermon Recording ──────────────────────────────────────────────────────
  const [sermonRecording, setSermonRecording] = useState(false);
  const [sermonWordCount, setSermonWordCount] = useState(0);
  const [sermonElapsed, setSermonElapsed] = useState(0);
  const [sermonSummarizing, setSermonSummarizing] = useState(false);
  const [sermonTranscribing, setSermonTranscribing] = useState(false);
  const [sermonProcessingJob, setSermonProcessingJob] = useState<SermonProcessingJob | null>(null);
  const [sermonSummary, setSermonSummary] = useState<SermonSummary | null>(null);
  const [sermonSummaryOpen, setSermonSummaryOpen] = useState(false);
  const [sermonSummaryError, setSermonSummaryError] = useState<string | null>(null);
  const [sermonMicWarning, setSermonMicWarning] = useState<string | null>(null);
  const [sermonArchived, setSermonArchived] = useState(false);
  const sermonTranscriptRef = useRef('');
  const sermonRecordingRef = useRef(false);
  const sermonStartedAtRef = useRef<number | null>(null);
  const sermonAutoEnabledVisionaryRef = useRef(false);
  const sermonRestartAttemptRef = useRef(0);
  // Audio blob collection for full-file transcription (ScribeAI pattern)
  const sermonAudioChunksRef = useRef<Blob[]>([]);
  const sermonAudioMimeTypeRef = useRef<string>('audio/webm');
  // Dedicated sermon recorder — always captures audio during sermon, independent of cloud fallback
  const sermonRecorderRef = useRef<MediaRecorder | null>(null);
  const sermonStreamRef = useRef<MediaStream | null>(null);

  const resolveSemanticReference = useCallback(async (
    rawQuery: string,
    origin: BibleMemoryQueryOrigin,
    contextHints: string[] = []
  ): Promise<{ reference: string | null; shouldProjectInstantly: boolean }> => {
    const trimmedQuery = String(rawQuery || '').trim();
    if (!trimmedQuery) {
      return {
        reference: null,
        shouldProjectInstantly: false,
      };
    }

    const exactReference = normalizeBibleReference(trimmedQuery);
    if (exactReference) {
      return {
        reference: exactReference,
        shouldProjectInstantly: true,
      };
    }

    if (!LOCAL_FIRST_BIBLE_INTENT_ENABLED) {
      return {
        reference: await semanticBibleSearch(trimmedQuery),
        shouldProjectInstantly: true,
      };
    }

    const resolution = await resolveBibleIntent({
      rawText: trimmedQuery,
      translationId: selectedVersion,
      origin,
      allowRemoteRerank: true,
      preferInstantProject: origin !== 'voice_partial',
      contextHints,
      recentReferences: [referenceInput, lastReferenceRef.current.reference].filter(Boolean),
    }, {
      memoryProvider: bibleMemoryProviderRef.current,
      remoteResolver: {
        id: 'gemini-semantic-search',
        resolve: async (input) => {
          const startedAt = Date.now();
          const reference = await semanticBibleSearch(input.rawText);
          const normalizedReference = normalizeBibleReference(reference);
          if (!normalizedReference) return null;
          return {
            reference: normalizedReference,
            confidence: 0.84,
            model: 'gemini-semantic-search',
            reason: 'Remote semantic rerank after local memory scoring.',
            latencyMs: Math.max(0, Date.now() - startedAt),
          };
        },
      },
    });

    return {
      reference: resolution.chosen?.reference || null,
      shouldProjectInstantly: resolution.shouldProjectInstantly,
    };
  }, [referenceInput, selectedVersion]);

  useEffect(() => {
    autoProjectRef.current = autoProjectEnabled;
  }, [autoProjectEnabled]);

  useEffect(() => {
    transcriptionEngineRef.current = transcriptionEngine;
  }, [transcriptionEngine]);

  useEffect(() => {
    if (!bookInput.trim()) {
      setFilteredBooks([]);
      setShowBookDropdown(false);
      return;
    }
    const q = bookInput.toLowerCase();
    const matches = BIBLE_BOOKS.filter((b) => b.name.toLowerCase().startsWith(q) || b.name.toLowerCase().includes(q));
    setFilteredBooks(matches.slice(0, 10));
    setShowBookDropdown(matches.length > 0 && !selectedBook);
  }, [bookInput, selectedBook]);

  const clearTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const stopRecognition = useCallback(() => {
    clearTimer(restartTimerRef);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    }
    recognitionRef.current = null;
    setAutoListening(false);
  }, []);

  const ensureMicCaptureReady = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (typeof window === 'undefined') return { ok: false, reason: 'Window context unavailable for microphone capture.' };
    if (micPreflightOkRef.current && (Date.now() - micPreflightAtRef.current) < AUTO_MIC_PREFLIGHT_COOLDOWN_MS) {
      return { ok: true };
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      // Some Chromium builds omit preflight support but still allow SpeechRecognition.
      return { ok: true };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      micPreflightOkRef.current = true;
      micPreflightAtRef.current = Date.now();
      return { ok: true };
    } catch (error) {
      micPreflightOkRef.current = false;
      micPreflightAtRef.current = Date.now();
      const code = String((error as { name?: string })?.name || '').toLowerCase();

      if (code === 'notallowederror' || code === 'securityerror') {
        return { ok: false, reason: 'Microphone permission denied. Allow microphone access for Lumina and try again.' };
      }
      if (code === 'notfounderror' || code === 'devicesnotfounderror' || code === 'overconstrainederror') {
        return { ok: false, reason: 'No usable microphone found. Select a valid input device in OS sound settings.' };
      }
      if (code === 'notreadableerror' || code === 'aborterror') {
        return { ok: false, reason: 'Microphone is busy or unavailable. Close other apps using the mic and retry.' };
      }
      return { ok: false, reason: 'Microphone preflight failed. Check OS mic permission, input device, and internet.' };
    }
  }, []);

  const showEngineToast = useCallback((message: string) => {
    setEngineToast(message);
    clearTimer(toastTimerRef);
    toastTimerRef.current = window.setTimeout(() => {
      setEngineToast(null);
    }, ENGINE_TOAST_MS);
  }, []);

  const stopCloudFallbackCapture = useCallback(() => {
    clearTimer(cloudRetryTimerRef);
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    const stream = cloudStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    }
    cloudStreamRef.current = null;
    cloudQueueRef.current = [];
    cloudUploadInFlightRef.current = false;
    setCloudRecorderState('idle');
  }, []);

  const stopAllVisionaryCapture = useCallback(() => {
    stopRecognition();
    stopCloudFallbackCapture();
    setAutoListening(false);
  }, [stopCloudFallbackCapture, stopRecognition]);

  const selectBook = (book: { name: string; chapters: number }) => {
    setSelectedBook(book);
    setBookInput(book.name);
    setChapter(1);
    setVerseFrom(1);
    setVerseTo(null);
    setReferenceInput('');
    setError(null);
    setShowBookDropdown(false);
  };

  const buildQuery = () => {
    return buildStructuredBibleRange(selectedBook?.name || '', chapter, verseFrom, verseTo);
  };

  const structuredDraft = buildStructuredBibleDraft(selectedBook?.name || '', chapter, verseFrom, verseTo);

  const syncStructuredSelection = useCallback((reference: string) => {
    const normalized = normalizeBibleReference(reference);
    if (!normalized) return;
    const matchedBook = [...BIBLE_BOOKS]
      .sort((a, b) => b.name.length - a.name.length)
      .find((book) => normalized.toLowerCase().startsWith(book.name.toLowerCase()));
    if (!matchedBook) return;
    const remainder = normalized.slice(matchedBook.name.length).trim();
    const match = remainder.match(/^(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/);
    if (!match) return;

    const nextChapter = Math.max(1, Number(match[1] || 1));
    const nextVerseFrom = Math.max(1, Number(match[2] || 1));
    const nextVerseTo = Math.max(nextVerseFrom, Number(match[3] || nextVerseFrom));

    setSelectedBook(matchedBook);
    setBookInput(matchedBook.name);
    setChapter(nextChapter);
    setVerseFrom(nextVerseFrom);
    setVerseTo(nextVerseTo);
  }, []);

  const createServiceItem = useCallback((
    verses: Verse[],
    overrideLayout?: typeof bibleLayout,
    overrideFontSize?: typeof bibleFontSize,
    overrideStyleMode?: BibleStyleMode,
    overrideStyleFamily?: BibleStyleFamily | null,
    overrideStyleSeed?: string,
  ): ServiceItem => {
    const title = `${verses[0].book_name} ${verses[0].chapter}:${verses[0].verse}${verses.length > 1 ? `-${verses[verses.length - 1].verse}` : ''}`;
    const versionLabel = VERSIONS.find((v) => v.id === selectedVersion)?.name || selectedVersion.toUpperCase();
    const layout = overrideLayout ?? bibleLayout;
    const fontSize = overrideFontSize ?? bibleFontSize;
    const styleMode = overrideStyleMode ?? bibleStyleMode;
    const styleFamily = overrideStyleFamily !== undefined ? overrideStyleFamily : bibleStyleFamily;
    const styleSeed = overrideStyleSeed !== undefined ? overrideStyleSeed : bibleStyleSeed;

    // Classic mode: use original background/layout system unchanged
    if (styleMode === 'classic') {
      return {
        id: `bible-${Date.now()}`,
        title,
        type: ItemType.BIBLE,
        theme: {
          backgroundUrl: selectedBg,
          mediaType: selectedMediaType,
          fontFamily: 'serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize,
        },
        slides: verses.map((v) => ({
          id: `v-${v.verse}-${Date.now()}`,
          content: v.text.trim(),
          label: `${v.book_name} ${v.chapter}:${v.verse} (${versionLabel})`,
          layoutType: layout !== 'standard' ? layout : undefined,
        })),
      };
    }

    // Smart-random or Preset mode: use style engine
    const combinedText = verses.map((v) => v.text.trim()).join(' ');
    const reference = title;
    const profile = generateBibleStyle({
      verseText: combinedText,
      reference,
      mode: styleMode,
      family: styleFamily ?? undefined,
      manualSeed: styleSeed || undefined,
    });

    const verseList = verses.map((v) => ({
      text: v.text.trim(),
      label: `${v.book_name} ${v.chapter}:${v.verse} (${versionLabel})`,
    }));
    const { theme, slides: styledSlides } = applyBibleStyle(verseList, profile);

    return {
      id: `bible-${Date.now()}`,
      title,
      type: ItemType.BIBLE,
      theme: { ...theme, fontSize },
      slides: verses.map((v, i) => ({
        id: `v-${v.verse}-${Date.now() + i}`,
        content: v.text.trim(),
        label: `${v.book_name} ${v.chapter}:${v.verse} (${versionLabel})`,
        backgroundUrl: styledSlides[i]?.backgroundUrl,
        mediaType: styledSlides[i]?.mediaType,
        elements: styledSlides[i]?.elements,
      })),
    };
  }, [selectedBg, selectedMediaType, selectedVersion, bibleLayout, bibleFontSize, bibleStyleMode, bibleStyleFamily, bibleStyleSeed]);

  const fetchScripture = useCallback(async (query: string, useSemantic = false, silent = false): Promise<Verse[]> => {
    if (!query.trim()) return [];
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    const showVerses = (verses: Verse[], ref: string) => {
      setResults(verses);
      setSelectedBg(DEFAULT_BACKGROUNDS[1]);
      setSelectedMediaType('image');
      const normalizedReference = normalizeBibleReference(ref);
      if (normalizedReference) {
        setReferenceInput(normalizedReference);
        syncStructuredSelection(normalizedReference);
      }
      if (silent) setError(null);
    };

    try {
      let finalQuery = query.trim();
      const exactReference = normalizeBibleReference(finalQuery);
      if (exactReference) {
        finalQuery = exactReference;
      } else if (useSemantic) {
        setAiLoading(true);

        // LOCAL-FIRST: instantly surface bible memory results while AI thinks
        let localShownRef: string | null = null;
        let localVerses: Verse[] = [];
        try {
          const localResolution = await resolveBibleIntent({
            rawText: finalQuery,
            translationId: selectedVersion,
            origin: 'typed',
            allowRemoteRerank: false,
            preferInstantProject: true,
            contextHints: [finalQuery],
            recentReferences: [referenceInput, lastReferenceRef.current.reference].filter(Boolean),
          }, { memoryProvider: bibleMemoryProviderRef.current });
          if (localResolution.chosen?.reference) {
            localVerses = await lookupBibleReference(localResolution.chosen.reference, selectedVersion);
            if (localVerses.length) {
              localShownRef = localResolution.chosen.reference;
              showVerses(localVerses, localShownRef);
              if (!silent) setLoading(false);
            }
          }
        } catch { /* local failure — continue to AI */ }

        // AI: full semantic resolution (may refine or confirm local result)
        const semanticResolution = await resolveSemanticReference(finalQuery, 'typed', [finalQuery]);
        if (!semanticResolution.reference) {
          if (!localShownRef && !silent) {
            setError('No scripture match found. Try a clearer topic or direct reference.');
            setResults([]);
          }
          return localVerses;
        }
        finalQuery = semanticResolution.reference;

        // If AI confirmed the same reference, no extra fetch needed
        if (localShownRef && normalizeBibleReference(localShownRef) === normalizeBibleReference(finalQuery)) {
          return localVerses;
        }
      }

      const verses = await lookupBibleReference(finalQuery, selectedVersion);
      if (verses.length) {
        showVerses(verses, finalQuery);
        return verses;
      }
      if (!silent) {
        setError('Reference not found. Try a different book/chapter.');
        setResults([]);
      }
      return [];
    } catch (err) {
      if (!silent) {
        const isNetworkError = err instanceof TypeError;
        setError(isNetworkError
          ? 'Network error. Could not reach Bible API. Structured passage lookup needs internet unless this passage was already cached on this device.'
          : 'Reference not found. Check the passage and try again.');
      }
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setAiLoading(false);
    }
  }, [resolveSemanticReference, selectedVersion, syncStructuredSelection, referenceInput]);

  const scheduleAutoProcess = useCallback(() => {
    clearTimer(processTimerRef);
    processTimerRef.current = window.setTimeout(() => {
      void processAutoTranscriptRef.current();
    }, AUTO_DEBOUNCE_MS);
  }, []);

  const appendTranscriptChunk = useCallback((chunk: string) => {
    const cleaned = String(chunk || '').trim();
    if (!cleaned) return;
    const next = `${transcriptBufferRef.current} ${cleaned}`.trim().split(/\s+/).slice(-AUTO_WORD_BUFFER).join(' ');
    transcriptBufferRef.current = next;
    setAutoTranscript(next);
    setAutoError(null);
    scheduleAutoProcess();
    // Also feed the full sermon accumulator when recording
    if (sermonRecordingRef.current) {
      sermonTranscriptRef.current = sermonTranscriptRef.current
        ? `${sermonTranscriptRef.current} ${cleaned}`
        : cleaned;
      const wc = sermonTranscriptRef.current.trim().split(/\s+/).filter(Boolean).length;
      setSermonWordCount(wc);
    }
  }, [scheduleAutoProcess]);

  const stopSermonCapture = useCallback(() => {
    try {
      if (sermonRecorderRef.current && sermonRecorderRef.current.state !== 'inactive') {
        sermonRecorderRef.current.stop();
      }
    } catch { /* ignore */ }
    sermonRecorderRef.current = null;
    try {
      sermonStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch { /* ignore */ }
    sermonStreamRef.current = null;
  }, []);

  const startSermonCapture = useCallback(async (): Promise<void> => {
    stopSermonCapture();
    try {
      const mimeType = pickSupportedRecorderMimeType() ?? 'audio/webm';
      sermonAudioMimeTypeRef.current = mimeType;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      sermonStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data?.size && sermonRecordingRef.current) {
          sermonAudioChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => { /* silent — we'll use what was collected */ };
      recorder.start(5000);
      sermonRecorderRef.current = recorder;
    } catch { /* mic unavailable — will rely on STT transcript only */ }
  }, [stopSermonCapture]);

  const finalizeSermonTranscript = useCallback(async (
    rawTranscript: string,
    providedSummary?: SermonSummary | null,
  ): Promise<boolean> => {
    const transcript = String(rawTranscript || '').trim();
    if (!transcript) {
      setSermonSummaryError('No transcript was captured. Try recording a longer segment with microphone access enabled.');
      return false;
    }

    sermonTranscriptRef.current = transcript;
    setSermonWordCount(transcript.split(/\s+/).filter(Boolean).length);
    setSermonSummaryError(null);

    if (providedSummary) {
      setSermonSummary({ ...providedSummary });
      setSermonSummaryOpen(true);
      setSermonArchived(false);
      return true;
    }

    setSermonSummarizing(true);
    const accentHint = speechLocaleMode === 'en-GB' ? 'uk' : 'standard';
    const result = await summarizeSermon(transcript, accentHint);
    setSermonSummarizing(false);
    if (result.ok && result.summary) {
      setSermonSummary({ ...result.summary });
      setSermonSummaryOpen(true);
      setSermonArchived(false);
      return true;
    }

    setSermonSummaryError(result.error || 'Summarization failed. Please try again.');
    return false;
  }, [speechLocaleMode]);

  const handleRetrySermonProcessing = useCallback(async () => {
    if (!sermonProcessingJob?.id) return;
    setSermonTranscribing(true);
    setSermonSummaryError(null);
    const result = await retrySermonProcessingJob(sermonProcessingJob.id);
    if (!result.ok) {
      setSermonTranscribing(false);
      const retryError = 'error' in result ? result.error : 'Unable to retry saved sermon audio.';
      setSermonSummaryError(retryError || 'Unable to retry saved sermon audio.');
      return;
    }
    setSermonProcessingJob(result.job);
  }, [sermonProcessingJob]);

  const toggleSermonRecording = useCallback(async () => {
    if (sermonRecordingRef.current) {
      // STOP — ScribeAI pattern: always transcribe full audio first, fall back to STT words
      sermonRecordingRef.current = false;
      setSermonRecording(false);
      stopSermonCapture();
      if (sermonAutoEnabledVisionaryRef.current) {
        sermonAutoEnabledVisionaryRef.current = false;
        setAutoVisionaryEnabled(false);
      }

      const audioChunks = sermonAudioChunksRef.current.slice();
      sermonAudioChunksRef.current = [];
      const sttTranscript = sermonTranscriptRef.current.trim();
      let transcript = '';

      // Primary: full-file Gemini transcription
      if (audioChunks.length > 0) {
        setSermonTranscribing(true);
        setSermonProcessingJob(null);
        setSermonSummaryError(null);
        const mimeType = sermonAudioMimeTypeRef.current;
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const locale = speechLocaleMode === 'en-GB' ? 'en-GB' : 'en-US';
        const accentHint = speechLocaleMode === 'en-GB' ? 'uk' : 'standard';
        const result = await transcribeSermonAudio(audioBlob, mimeType, locale, accentHint, {
          allowDeferred: true,
          workspaceId,
        });
        if (!result.ok && 'deferred' in result && result.deferred) {
          setSermonProcessingJob(result.job);
          setSermonSummaryError(null);
          return;
        }
        setSermonTranscribing(false);
        if (result.ok && result.transcript) {
          transcript = result.transcript;
        }
      }

      // Fallback: whatever browser STT captured live
      if (!transcript) transcript = sttTranscript;
      await finalizeSermonTranscript(transcript);
    } else {
      // START — launch dedicated sermon recorder immediately + Auto Visionary for live word count
      sermonTranscriptRef.current = '';
      sermonAudioChunksRef.current = [];
      sermonRecordingRef.current = true;
      sermonStartedAtRef.current = Date.now();
      sermonRestartAttemptRef.current = 0;
      setSermonWordCount(0);
      setSermonElapsed(0);
      setSermonTranscribing(false);
      setSermonSummarizing(false);
      setSermonProcessingJob(null);
      setSermonSummary(null);
      setSermonSummaryOpen(false);
      setSermonSummaryError(null);
      const electronRuntime = isElectronRuntime();
      setSermonMicWarning(
        electronRuntime
          ? 'Live captions are unavailable in Electron. Audio is still being recorded and will be transcribed after you stop.'
          : null
      );
      setSermonArchived(false);
      setSermonRecording(true);
      void startSermonCapture();
      if (!autoEnabledRef.current && !electronRuntime) {
        sermonAutoEnabledVisionaryRef.current = true;
        setAutoVisionaryEnabled(true);
      }
    }
  }, [finalizeSermonTranscript, speechLocaleMode, startSermonCapture, stopSermonCapture, workspaceId]);

  useEffect(() => {
    const jobId = sermonProcessingJob?.id;
    if (!jobId) return;

    let cancelled = false;
    let timerId: number | null = null;

    const pollJob = async (delayMs = 1500) => {
      timerId = window.setTimeout(async () => {
        const result = await getSermonProcessingJob(jobId);
        if (cancelled) return;

        if (!result.ok) {
          setSermonTranscribing(false);
          const fallbackTranscript = sermonTranscriptRef.current.trim();
          if (fallbackTranscript) {
            await finalizeSermonTranscript(fallbackTranscript);
            return;
          }
          const pollError = 'error' in result ? result.error : 'Unable to check saved sermon transcription.';
          setSermonSummaryError(pollError || 'Unable to check saved sermon transcription.');
          return;
        }

        const job = result.job;
        setSermonProcessingJob(job);

        if (job.status === 'completed') {
          setSermonTranscribing(false);
          setSermonProcessingJob(null);
          await finalizeSermonTranscript(job.transcript || '', job.summary || null);
          return;
        }

        if (job.status === 'failed') {
          setSermonTranscribing(false);
          const fallbackTranscript = sermonTranscriptRef.current.trim();
          if (fallbackTranscript) {
            await finalizeSermonTranscript(fallbackTranscript);
            return;
          }
          setSermonSummaryError(job.error || 'Saved sermon transcription failed.');
          return;
        }

        const nextDelay = job.retryAfterMs > 0
          ? Math.min(15000, Math.max(3000, job.retryAfterMs))
          : 4000;
        await pollJob(nextDelay);
      }, Math.max(500, delayMs));
    };

    void pollJob(sermonProcessingJob.retryAfterMs > 0
      ? Math.min(15000, Math.max(1500, sermonProcessingJob.retryAfterMs))
      : 1500);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [finalizeSermonTranscript, sermonProcessingJob?.id]);

  // Elapsed timer while sermon is recording
  useEffect(() => {
    if (!sermonRecording) return;
    const id = window.setInterval(() => {
      if (sermonStartedAtRef.current !== null) {
        setSermonElapsed(Math.floor((Date.now() - sermonStartedAtRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [sermonRecording]);

  // Auto-restart STT if it dies while sermon is recording (up to 3 attempts)
  useEffect(() => {
    if (!sermonRecording) return;
    if (isElectronRuntime()) {
      setSermonMicWarning('Live captions are unavailable in Electron. Audio is still being recorded and will be transcribed after you stop.');
      return;
    }
    if (autoVisionaryEnabled) {
      sermonRestartAttemptRef.current = 0;
      setSermonMicWarning(null);
      return;
    }
    sermonRestartAttemptRef.current += 1;
    if (sermonRestartAttemptRef.current <= 3) {
      setSermonMicWarning('Mic interrupted — restarting capture...');
      const id = window.setTimeout(() => {
        if (sermonRecordingRef.current) {
          setAutoVisionaryEnabled(true);
        }
      }, 3000);
      return () => window.clearTimeout(id);
    }
    setSermonMicWarning('Mic unavailable after 3 retries. Words captured so far will still be summarized.');
  }, [sermonRecording, autoVisionaryEnabled]);

  // Create a service item from sermon key points for projection
  const createSermonRecapItem = useCallback((summary: SermonSummary): ServiceItem => {
    const ts = Date.now();
    const slides: ServiceItem['slides'] = [
      { id: `sr-title-${ts}`, label: 'Sermon Title', content: summary.title },
      { id: `sr-theme-${ts}`, label: 'Main Theme', content: summary.mainTheme },
      ...summary.keyPoints.map((point, i) => ({
        id: `sr-kp-${i}-${ts}`,
        label: `Key Point ${i + 1}`,
        content: point,
      })),
      ...(summary.callToAction
        ? [{ id: `sr-cta-${ts}`, label: 'Call to Action', content: summary.callToAction }]
        : []),
    ];
    return {
      id: `sermon-recap-${ts}`,
      title: summary.title || 'Sermon Recap',
      type: ItemType.ANNOUNCEMENT,
      theme: {
        backgroundUrl: DEFAULT_BACKGROUNDS[1],
        mediaType: 'image',
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'medium',
      },
      slides,
    };
  }, []);

  const processCloudQueue = useCallback(async () => {
    if (!autoEnabledRef.current || transcriptionEngineRef.current !== 'cloud_fallback') return;
    if (cloudUploadInFlightRef.current) return;
    if (!cloudQueueRef.current.length) return;
    const nowTs = Date.now();
    if (cloudCooldownUntil > nowTs) {
      const waitMs = Math.max(1000, cloudCooldownUntil - nowTs);
      clearTimer(cloudRetryTimerRef);
      cloudRetryTimerRef.current = window.setTimeout(() => {
        void processCloudQueue();
      }, waitMs);
      return;
    }

    cloudUploadInFlightRef.current = true;
    setCloudRecorderState('uploading');
    const chunk = cloudQueueRef.current.shift();
    if (!chunk) {
      cloudUploadInFlightRef.current = false;
      setCloudRecorderState('recording');
      return;
    }

    try {
      const base64 = await blobToBase64(chunk);
      const locale = activeSpeechLanguage === 'en-GB' ? 'en-GB' : 'en-US';
      const response: TranscribeSermonChunkResult = await transcribeSermonChunk({
        audioBase64: base64,
        mimeType: cloudRecorderMimeTypeRef.current,
        locale,
        workspaceId: fallbackContextRef.current.workspaceId,
        sessionId: fallbackContextRef.current.sessionId,
        clientId: fallbackClientIdRef.current,
      });

      if (response.ok) {
        appendTranscriptChunk(response.transcript);
        setAutoError(null);
        setCloudRecorderState('recording');
      } else if (response.mode === 'cooldown') {
        const retryAfterMs = Math.max(1000, Number(response.retryAfterMs || 0));
        const resumeAt = Date.now() + retryAfterMs;
        // Discard stale queued audio — it's irrelevant after a long cooldown and
        // would cause a burst of requests the moment cooldown expires, re-triggering
        // the same quota error immediately.
        cloudQueueRef.current = [];
        setCloudCooldownUntil(resumeAt);
        setCloudRecorderState('cooldown');
        setAutoError(`Cloud transcription cooling down. Retrying in ${Math.ceil(retryAfterMs / 1000)}s.`);
        clearTimer(cloudRetryTimerRef);
        cloudRetryTimerRef.current = window.setTimeout(() => {
          setCloudCooldownUntil(0);
          void processCloudQueue();
        }, retryAfterMs);
      } else if (response.mode === 'transient_error') {
        setCloudRecorderState('error');
        setAutoError('Cloud transcription transient error. Retrying shortly.');
        clearTimer(cloudRetryTimerRef);
        cloudRetryTimerRef.current = window.setTimeout(() => {
          void processCloudQueue();
        }, CLOUD_FALLBACK_RETRY_MS);
      } else {
        setCloudRecorderState('error');
        setAutoError('Cloud transcription unavailable. Turn Auto Visionary OFF/ON to retry.');
        setAutoVisionaryEnabled(false);
      }
    } catch {
      setCloudRecorderState('error');
      setAutoError('Cloud transcription failed. Retrying shortly.');
      clearTimer(cloudRetryTimerRef);
      cloudRetryTimerRef.current = window.setTimeout(() => {
        void processCloudQueue();
      }, CLOUD_FALLBACK_RETRY_MS);
    } finally {
      cloudUploadInFlightRef.current = false;
      if (autoEnabledRef.current && transcriptionEngineRef.current === 'cloud_fallback' && cloudQueueRef.current.length > 0) {
        void processCloudQueue();
      }
    }
  }, [activeSpeechLanguage, appendTranscriptChunk, cloudCooldownUntil]);

  const startCloudFallbackCapture = useCallback(async (): Promise<boolean> => {
    if (cloudStartInFlightRef.current) return true;
    cloudStartInFlightRef.current = true;
    try {
      if (typeof window === 'undefined') return false;
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return false;
      const supportedMime = pickSupportedRecorderMimeType();
      if (!supportedMime) {
        setAutoError('Cloud fallback recorder is unavailable in this browser.');
        return false;
      }

      const micReady = await ensureMicCaptureReady();
      if (!micReady.ok) {
        setAutoError(micReady.reason || 'Microphone initialization failed.');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stopCloudFallbackCapture();
      cloudStreamRef.current = stream;
      cloudRecorderMimeTypeRef.current = supportedMime;
      cloudQueueRef.current = [];
      setCloudCooldownUntil(0);

      // Track mimeType for sermon audio submission
      sermonAudioMimeTypeRef.current = supportedMime;

      const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
      recorder.ondataavailable = (event: BlobEvent) => {
        const chunk = event.data;
        if (!chunk || !chunk.size) return;
        // During sermon recording, skip live cloud transcription — dedicated sermon recorder handles capture
        if (sermonRecordingRef.current) return;
        cloudQueueRef.current.push(chunk);
        void processCloudQueue();
      };
      recorder.onerror = () => {
        setCloudRecorderState('error');
        setAutoError('Cloud recorder error. Retrying capture.');
      };
      recorder.onstop = () => {
        if (autoEnabledRef.current && transcriptionEngineRef.current === 'cloud_fallback') {
          setCloudRecorderState('error');
          setAutoError('Cloud recorder stopped unexpectedly. Restarting.');
          clearTimer(cloudRetryTimerRef);
          cloudRetryTimerRef.current = window.setTimeout(() => {
            void startCloudFallbackCapture();
          }, CLOUD_FALLBACK_RETRY_MS);
        }
      };
      recorder.start(CLOUD_FALLBACK_CHUNK_MS);
      mediaRecorderRef.current = recorder;
      setCloudRecorderState('recording');
      setAutoListening(true);
      return true;
    } catch {
      setCloudRecorderState('error');
      setAutoError('Unable to start cloud fallback recorder.');
      return false;
    } finally {
      cloudStartInFlightRef.current = false;
    }
  }, [ensureMicCaptureReady, processCloudQueue, stopCloudFallbackCapture]);

  const probeBrowserSpeechRecovery = useCallback(async () => {
    if (!autoEnabledRef.current || transcriptionEngineRef.current !== 'cloud_fallback') return;
    if (isElectronRuntime()) return;
    if (probeInFlightRef.current) return;
    const nowTs = Date.now();
    if ((nowTs - lastBrowserProbeAtRef.current) < CLOUD_BROWSER_PROBE_INTERVAL_MS) return;
    lastBrowserProbeAtRef.current = nowTs;
    probeInFlightRef.current = true;
    try {
      const SpeechCtor = getSpeechCtor();
      if (!SpeechCtor) return;
      const locale = activeSpeechLanguage === 'en-GB' ? 'en-GB' : 'en-US';
      const probeOk = await new Promise<boolean>((resolve) => {
        let settled = false;
        const recognition = new SpeechCtor();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = locale;
        recognition.onstart = () => {
          if (settled) return;
          settled = true;
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          resolve(true);
        };
        recognition.onerror = () => {
          if (settled) return;
          settled = true;
          resolve(false);
        };
        recognition.onend = () => {
          if (settled) return;
          settled = true;
          resolve(false);
        };
        try {
          recognition.start();
        } catch {
          settled = true;
          resolve(false);
          return;
        }
        window.setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          resolve(false);
        }, 3000);
      });

      if (probeOk && autoEnabledRef.current) {
        stopCloudFallbackCapture();
        setTranscriptionEngine('browser_stt');
        setBrowserRestartNonce((prev) => prev + 1);
        setAutoError(null);
        setCloudRecorderState('idle');
        showEngineToast('Browser speech recovered; switched back.');
      }
    } finally {
      probeInFlightRef.current = false;
    }
  }, [activeSpeechLanguage, showEngineToast, stopCloudFallbackCapture]);

  const activateCloudFallback = useCallback(async () => {
    stopRecognition();
    setTranscriptionEngine('cloud_fallback');
    setAutoListening(true);
    setAutoError('Switching to cloud fallback for reliable transcription...');
    showEngineToast('Switched to Cloud Fallback for reliability.');
    const started = await startCloudFallbackCapture();
    if (!started) {
      setAutoVisionaryEnabled(false);
      setAutoListening(false);
    }
  }, [showEngineToast, startCloudFallbackCapture, stopRecognition]);

  const processAutoTranscript = useCallback(async () => {
    if (autoBusyRef.current) return;
    const transcript = transcriptBufferRef.current.trim();
    if (transcript.split(/\s+/).length < 6) return;
    const now = Date.now();
    if (now - lastProcessAtRef.current < AUTO_REQUERY_COOLDOWN_MS) return;

    lastProcessAtRef.current = now;
    autoBusyRef.current = true;
    setAutoBusy(true);
    setAutoError(null);

    let localProjectedRef: string | null = null;

    try {
      // Phase 1 — local memory (instant, no network)
      try {
        const localResolution = await resolveBibleIntent(
          {
            rawText: transcript,
            translationId: selectedVersion,
            origin: 'voice_partial',
            allowRemoteRerank: false,
            preferInstantProject: true,
            recentReferences: [lastReferenceRef.current.reference].filter(Boolean),
          },
          { memoryProvider: bibleMemoryProviderRef.current }
        );
        const localRef = localResolution.chosen?.reference;
        if (localRef) {
          setAutoReferences([localRef]);
          setAiQuery(localRef);
          const last = lastReferenceRef.current;
          const isLocalRepeat =
            last.reference.toLowerCase() === localRef.toLowerCase() &&
            now - last.at < AUTO_REPEAT_REFERENCE_WINDOW_MS;
          if (!isLocalRepeat && localResolution.shouldProjectInstantly) {
            const verses = await fetchScripture(localRef, false, true);
            if (verses.length && autoProjectRef.current) {
              lastReferenceRef.current = { reference: localRef, at: Date.now() };
              onProjectRequest(createServiceItem(verses));
              localProjectedRef = localRef;
            }
          }
        }
      } catch { /* local failure — continue to Gemini */ }

      // Phase 2 — Gemini semantic search (enriches tiles)
      const references = await semanticBibleSearchMulti(transcript, 4);
      if (!references.length) return;
      setAutoReferences(references);
      const primary = references[0];
      setAiQuery(primary);

      const last = lastReferenceRef.current;
      const isGeminiRepeat =
        last.reference.toLowerCase() === primary.toLowerCase() &&
        now - last.at < AUTO_REPEAT_REFERENCE_WINDOW_MS;
      if (isGeminiRepeat || localProjectedRef?.toLowerCase() === primary.toLowerCase()) return;

      const verses = await fetchScripture(primary, false, true);
      if (!verses.length) {
        lastReferenceRef.current = { reference: primary, at: Date.now() };
        return;
      }

      lastReferenceRef.current = { reference: primary, at: Date.now() };
      if (autoProjectRef.current) {
        onProjectRequest(createServiceItem(verses));
      }
    } catch {
      setAutoError('Auto matching failed. Keep speaking or run manual AI Search.');
    } finally {
      autoBusyRef.current = false;
      setAutoBusy(false);
    }
  }, [createServiceItem, fetchScripture, onProjectRequest, selectedVersion, semanticBibleSearchMulti]);

  useEffect(() => {
    processAutoTranscriptRef.current = processAutoTranscript;
  }, [processAutoTranscript]);

  const handleAutoReferenceClick = useCallback(async (reference: string) => {
    setAiQuery(reference);
    const verses = await fetchScripture(reference, false, true);
    if (verses.length && autoProjectRef.current) {
      onProjectRequest(createServiceItem(verses));
    }
  }, [createServiceItem, fetchScripture, onProjectRequest]);

  useEffect(() => {
    const enabled = autoVisionaryEnabled && isVisionaryMode;
    autoEnabledRef.current = enabled;
    if (!enabled) {
      setTranscriptionEngine('disabled');
      setCloudCooldownUntil(0);
      setAutoError(null);
      stopAllVisionaryCapture();
      return;
    }
    setAutoSupportError(null);
    if (transcriptionEngine === 'disabled') {
      setTranscriptionEngine(isElectronRuntime() ? 'cloud_fallback' : 'browser_stt');
    }
  }, [autoVisionaryEnabled, isVisionaryMode, stopAllVisionaryCapture, transcriptionEngine]);

  useEffect(() => {
    if (!autoEnabledRef.current || transcriptionEngine !== 'browser_stt') return;
    let cancelled = false;
    stopCloudFallbackCapture();
    const initializeRecognition = async () => {
      const SpeechCtor = getSpeechCtor();
      if (!SpeechCtor) {
        setAutoSupportError('Auto listening is not available in this browser.');
        setAutoVisionaryEnabled(false);
        return;
      }

      setAutoSupportError(null);
      setAutoError(null);
      setCloudRecorderState('idle');
      setCloudCooldownUntil(0);

      const micReady = await ensureMicCaptureReady();
      if (cancelled || !autoEnabledRef.current || transcriptionEngine !== 'browser_stt') return;
      if (!micReady.ok) {
        setAutoError(micReady.reason || 'Microphone initialization failed.');
        setAutoVisionaryEnabled(false);
        return;
      }

      consecutiveNetworkErrorsRef.current = 0;
      restartDelayMsRef.current = AUTO_RESTART_BASE_MS;
      const navigatorLocales = getNavigatorLocales();
      const speechCandidates = resolveSpeechLanguageCandidates(speechLocaleMode, navigatorLocales);
      speechCandidatesRef.current = speechCandidates;
      activeSpeechCandidateIndexRef.current = 0;

      const recognition = new SpeechCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechCandidates[0];
      setActiveSpeechLanguage(speechCandidates[0]);
      setAutoListening(false);

      recognition.onresult = (event) => {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const phrase = String(result?.[0]?.transcript || '').trim();
          if (!phrase || !result?.isFinal) continue;
          finalChunk += ` ${phrase}`;
        }
        if (!finalChunk.trim()) return;
        appendTranscriptChunk(finalChunk);
        consecutiveNetworkErrorsRef.current = 0;
        restartDelayMsRef.current = AUTO_RESTART_BASE_MS;
      };

      recognition.onerror = (event) => {
        const code = event?.error ? String(event.error) : 'unknown';
        if (BENIGN_SPEECH_ERRORS.has(code)) return;

        if (PERMISSION_SPEECH_ERRORS.has(code)) {
          setAutoError('Microphone permission denied. Allow microphone access for this app/browser.');
          setAutoVisionaryEnabled(false);
          stopRecognition();
          return;
        }

        if (DEVICE_SPEECH_ERRORS.has(code)) {
          setAutoError('No usable microphone detected. Check your input device and OS sound settings.');
          setAutoVisionaryEnabled(false);
          stopRecognition();
          return;
        }

        if (TRANSIENT_SPEECH_ERRORS.has(code)) {
          consecutiveNetworkErrorsRef.current += 1;
          const nowTs = Date.now();
          if (nowTs - lastSpeechErrorAtRef.current < AUTO_ERROR_COOLDOWN_MS) return;
          lastSpeechErrorAtRef.current = nowTs;
          const currentLanguage = recognition.lang || speechCandidatesRef.current[activeSpeechCandidateIndexRef.current] || 'en-US';

          if (consecutiveNetworkErrorsRef.current >= AUTO_NETWORK_FALLBACK_THRESHOLD) {
            void activateCloudFallback();
            return;
          }

          if (consecutiveNetworkErrorsRef.current >= AUTO_NETWORK_ERROR_LIMIT) {
            setAutoError(`Speech service unreachable on ${currentLanguage}. Turn Auto Visionary OFF/ON to retry.`);
            setAutoVisionaryEnabled(false);
            stopRecognition();
            return;
          }

          const speechCandidatesForRetry = speechCandidatesRef.current;
          let languageForMessage = currentLanguage;
          if (speechCandidatesForRetry.length > 1) {
            activeSpeechCandidateIndexRef.current = (activeSpeechCandidateIndexRef.current + 1) % speechCandidatesForRetry.length;
            const nextLanguage = speechCandidatesForRetry[activeSpeechCandidateIndexRef.current];
            recognition.lang = nextLanguage;
            setActiveSpeechLanguage(nextLanguage);
            languageForMessage = nextLanguage;
          }

          const triesLeft = AUTO_NETWORK_FALLBACK_THRESHOLD - consecutiveNetworkErrorsRef.current;
          setAutoError(`Temporary speech network glitch on ${languageForMessage}. ${Math.max(0, triesLeft)} browser retry left before cloud fallback.`);
          restartDelayMsRef.current = Math.min(3000, AUTO_RESTART_BASE_MS + (consecutiveNetworkErrorsRef.current * 700));
          return;
        }

        setAutoError(`Mic error: ${code}`);
      };

      recognition.onend = () => {
        setAutoListening(false);
        if (!autoEnabledRef.current || transcriptionEngine !== 'browser_stt') return;
        clearTimer(restartTimerRef);
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
            setAutoListening(true);
          } catch {
            setAutoError('Could not restart microphone capture.');
          }
        }, restartDelayMsRef.current);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setAutoListening(true);
      } catch {
        setAutoError('Could not start microphone capture.');
        setAutoVisionaryEnabled(false);
        stopRecognition();
      }
    };

    void initializeRecognition();
    return () => {
      cancelled = true;
      stopRecognition();
    };
  }, [activateCloudFallback, appendTranscriptChunk, browserRestartNonce, ensureMicCaptureReady, speechLocaleMode, stopCloudFallbackCapture, stopRecognition, transcriptionEngine]);

  useEffect(() => {
    if (!autoEnabledRef.current || transcriptionEngine !== 'cloud_fallback') return;
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      void startCloudFallbackCapture();
    }
  }, [startCloudFallbackCapture, transcriptionEngine]);

  useEffect(() => {
    if (!autoEnabledRef.current || transcriptionEngine !== 'cloud_fallback') return;
    const id = window.setInterval(() => {
      void probeBrowserSpeechRecovery();
    }, CLOUD_BROWSER_PROBE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [probeBrowserSpeechRecovery, transcriptionEngine]);

  useEffect(() => () => {
    stopAllVisionaryCapture();
    clearTimer(processTimerRef);
    clearTimer(toastTimerRef);
  }, [stopAllVisionaryCapture]);

  const handleStructuredSearch = () => {
    const q = buildQuery();
    if (!q) {
      if (selectedBook) {
        setError('Choose a To verse before searching this passage.');
      }
      return;
    }
    setReferenceInput(q);
    void fetchScripture(q, false);
  };

  const handleManualSearch = () => {
    const exactReference = normalizeBibleReference(referenceInput);
    if (exactReference) {
      setReferenceInput(exactReference);
      syncStructuredSelection(exactReference);
      void fetchScripture(exactReference, false);
      return;
    }
    if (isStructuredBibleRangeReady(selectedBook?.name || '', verseTo) === false && selectedBook) {
      setError('Choose a To verse before searching this passage.');
      return;
    }
    handleStructuredSearch();
  };

  const chapterCount = selectedBook?.chapters ?? 150;
  const verseCount = selectedBook ? getChapterVerseCount(selectedBook.name, chapter) : 50;
  const resolvedCandidates = resolveSpeechLanguageCandidates(speechLocaleMode, getNavigatorLocales());
  const localeModeLabel = speechLocaleMode === 'auto' ? 'Auto' : 'Manual';
  const localeStatusLanguage = autoListening ? activeSpeechLanguage : resolvedCandidates[0];
  const engineLabel = (
    transcriptionEngine === 'cloud_fallback'
      ? 'Cloud Fallback'
      : transcriptionEngine === 'browser_stt'
        ? 'Browser STT'
        : 'Disabled'
  );
  const sermonTranscribingStatusText = sermonProcessingJob?.status === 'queued'
    ? `Saved audio queued for retry${sermonProcessingJob.retryAfterMs > 0 ? ` in about ${Math.max(1, Math.ceil(sermonProcessingJob.retryAfterMs / 1000))}s` : ''}.`
    : sermonProcessingJob?.phase === 'summarize'
      ? 'Transcript ready. Generating sermon summary...'
      : sermonProcessingJob?.status === 'processing'
        ? 'Transcribing saved audio...'
        : 'Transcribing audio... this may take a moment.';
  const autoStatusText = autoSupportError
    || (!isVisionaryMode ? 'Turn on Visionary mode to enable auto listening.' : '')
    || (autoBusy ? 'Analyzing live speech...' : '')
    || (transcriptionEngine === 'cloud_fallback'
      ? (
        cloudRecorderState === 'cooldown'
          ? 'Cloud fallback cooling down...'
          : cloudRecorderState === 'uploading'
            ? 'Cloud fallback uploading audio chunk...'
            : cloudRecorderState === 'recording'
              ? 'Cloud fallback listening for sermon context...'
          : 'Cloud fallback starting...'
      )
      : (autoListening ? 'Listening for sermon context...' : (autoVisionaryEnabled ? 'Starting microphone...' : 'Auto listen is off.')));
  const rootClassName = compact
    ? 'relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-900/80 bg-zinc-950'
    : 'relative flex flex-col h-full bg-zinc-950';
  const headerClassName = compact
    ? 'h-9 px-2.5 border-b border-zinc-900 font-bold text-zinc-500 text-[9px] uppercase tracking-[0.22em] flex items-center justify-between bg-zinc-950'
    : 'h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex items-center justify-between bg-zinc-950';
  const controlsClassName = compact
    ? 'shrink-0 px-2.5 py-2 space-y-2 border-b border-zinc-900/80 bg-zinc-950/95 overflow-y-auto custom-scrollbar max-h-[44%]'
    : 'p-3 space-y-2';
  const resultsClassName = compact
    ? 'min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar'
    : 'flex-1 overflow-y-auto p-2 scrollbar-thin';
  const primaryInputClassName = compact
    ? 'w-full bg-zinc-900 border border-blue-900/70 focus:border-blue-500 rounded-sm py-1.5 pl-8 pr-3 text-[11px] text-white focus:outline-none font-mono'
    : 'w-full bg-zinc-900 border border-blue-900/70 focus:border-blue-500 rounded-sm py-2 pl-8 pr-3 text-xs text-white focus:outline-none font-mono';
  const secondaryInputClassName = compact
    ? 'w-full bg-zinc-900 border border-zinc-800 focus:border-blue-600 rounded-sm py-1.5 pl-8 pr-3 text-[11px] text-white focus:outline-none font-mono'
    : 'w-full bg-zinc-900 border border-zinc-800 focus:border-blue-600 rounded-sm py-2 pl-8 pr-3 text-xs text-white focus:outline-none font-mono';
  const visionaryInputClassName = compact
    ? 'w-full bg-zinc-900 border border-purple-900 focus:border-purple-500 rounded-sm py-1.5 pl-8 pr-3 text-[11px] text-white focus:outline-none font-mono'
    : 'w-full bg-zinc-900 border border-purple-900 focus:border-purple-500 rounded-sm py-2 pl-8 pr-3 text-xs text-white focus:outline-none font-mono';
  const actionFooterClassName = compact
    ? 'flex gap-2 p-1 pt-2 sticky bottom-0 bg-zinc-950/90 backdrop-blur-md pb-2'
    : 'flex gap-2 p-1 pt-2 sticky bottom-0 bg-zinc-950/80 backdrop-blur-md pb-4';

  return (
    <div className={rootClassName}>
      <div className={headerClassName}>
        <div className="flex items-center">
          <BibleIcon className="w-3 h-3 mr-2" />
          {compact ? 'Bible Hub' : 'Scripture Engine'}
        </div>
        <button
          onClick={() => setIsVisionaryMode(!isVisionaryMode)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm border transition-all ${compact ? 'text-[8px]' : 'text-[9px]'} ${isVisionaryMode ? 'bg-purple-950/30 text-purple-400 border-purple-800' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
        >
          <SparklesIcon className="w-2 h-2" />
          {isVisionaryMode ? (compact ? 'VISIONARY' : 'VISIONARY ON') : 'AI MODE'}
        </button>
      </div>

      <div className={controlsClassName}>
        {isVisionaryMode ? (
          <div className="space-y-2">
            <div className="relative">
              <SparklesIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-purple-600 animate-pulse" />
              <input
                type="text"
                className={visionaryInputClassName}
                placeholder="e.g. I need peace and comfort..."
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchScripture(aiQuery, true); }}
              />
            </div>
            <button
              onClick={() => fetchScripture(aiQuery, true)}
              className={`w-full bg-purple-700 hover:bg-purple-600 text-white rounded-sm font-bold transition-all ${compact ? 'py-1.5 text-[8px]' : 'py-1.5 text-[9px]'}`}
            >
              AI SEARCH
            </button>
            <div className="rounded-sm border border-purple-900/60 bg-purple-950/20 p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold tracking-wider text-purple-300 uppercase">Auto Visionary (Mic)</span>
                <button
                  onClick={() => setAutoVisionaryEnabled((prev) => !prev)}
                  className={`px-2 py-1 rounded-sm text-[9px] font-bold border ${autoVisionaryEnabled ? 'bg-emerald-700/40 text-emerald-300 border-emerald-700' : 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}
                >
                  {autoVisionaryEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Auto Project to Stage/Output</span>
                <button
                  onClick={() => setAutoProjectEnabled((prev) => !prev)}
                  className={`px-2 py-1 rounded-sm text-[9px] font-bold border ${autoProjectEnabled ? 'bg-cyan-700/40 text-cyan-300 border-cyan-700' : 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}
                >
                  {autoProjectEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Speech Dialect</span>
                <select
                  value={speechLocaleMode}
                  onChange={(e) => onSpeechLocaleModeChange(e.target.value as VisionarySpeechLocaleMode)}
                  className={`bg-zinc-900 border border-zinc-700 rounded-sm px-2 py-1 text-zinc-200 ${compact ? 'text-[8px]' : 'text-[9px]'}`}
                >
                  <option value="auto">Auto (System Locale)</option>
                  <option value="en-GB">English (UK) - en-GB</option>
                  <option value="en-US">English (US) - en-US</option>
                </select>
              </div>
              <div className="text-[9px] text-cyan-300 font-mono">
                Dialect: {localeStatusLanguage} ({localeModeLabel})
              </div>
              <div className="flex items-center gap-2 text-[9px] font-mono">
                <span className="text-zinc-400">Engine:</span>
                <span className={`font-bold ${transcriptionEngine === 'cloud_fallback' ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {engineLabel}
                </span>
              </div>
              {engineToast && (
                <div className="text-[9px] text-amber-200 font-mono border border-amber-700/60 rounded-sm p-1.5 bg-amber-950/25">
                  {engineToast}
                </div>
              )}
              <div className="text-[9px] text-zinc-300 font-mono">{autoStatusText}</div>
              {cloudCooldownUntil > Date.now() && (
                <div className="text-[9px] text-amber-300 font-mono">
                  Cooldown: {Math.max(1, Math.ceil((cloudCooldownUntil - Date.now()) / 1000))}s
                </div>
              )}
              {autoReferences.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Matches</div>
                  <div className="flex flex-wrap gap-1">
                    {autoReferences.map((ref) => (
                      <button
                        key={ref}
                        onClick={() => void handleAutoReferenceClick(ref)}
                        className="text-[9px] text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-800/50 rounded px-1.5 py-0.5 hover:bg-cyan-900/60 active:bg-cyan-900/80 transition-colors truncate max-w-[140px]"
                        title={`Load ${ref}`}
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {autoTranscript && (
                <div className="text-[9px] text-zinc-400 font-mono border border-zinc-800 rounded-sm p-1.5 max-h-16 overflow-y-auto">
                  Heard: {autoTranscript}
                </div>
              )}
              {autoError && autoVisionaryEnabled && (
                <div className="flex items-start gap-1.5 bg-rose-950/40 border border-rose-800/50 rounded px-2 py-1">
                  <span className="text-rose-400 text-[10px] leading-tight shrink-0 mt-px">⚠</span>
                  <span className="text-[9px] text-rose-300 font-mono leading-tight line-clamp-2">{autoError}</span>
                  <button
                    onClick={() => setAutoError(null)}
                    className="ml-auto text-rose-500 hover:text-rose-300 text-[10px] shrink-0 leading-tight"
                    title="Dismiss"
                  >✕</button>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-blue-500" />
              <input
                type="text"
                className={primaryInputClassName}
                placeholder="Direct reference (e.g. John 3:16-19)"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualSearch(); }}
              />
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 w-3.5 h-3.5 text-zinc-600" />
              <input
                ref={bookInputRef}
                type="text"
                className={secondaryInputClassName}
                placeholder="Book name (e.g. John)..."
                value={bookInput}
                onChange={(e) => { setBookInput(e.target.value); setSelectedBook(null); }}
                onFocus={() => { if (filteredBooks.length) setShowBookDropdown(true); }}
              />
              {showBookDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-sm shadow-xl max-h-40 overflow-y-auto">
                  {filteredBooks.map((b) => (
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

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">Version</label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                >
                  {VERSIONS.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.id.toUpperCase()})</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">Quick book</label>
                <select
                  data-testid="bible-browser-quick-book"
                  value={selectedBook?.name || ''}
                  onChange={(e) => {
                    const next = BIBLE_BOOKS.find((book) => book.name === e.target.value) || null;
                    if (next) {
                      selectBook(next);
                    } else {
                      setSelectedBook(null);
                      setBookInput('');
                      setVerseTo(null);
                      setReferenceInput('');
                    }
                  }}
                  className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                >
                  <option value="">All Bible books</option>
                  {BIBLE_BOOKS.map((book) => (
                    <option key={book.name} value={book.name}>{book.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBook && (
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">Chapter</label>
                  <select
                    data-testid="bible-browser-chapter"
                    value={chapter}
                    onChange={(e) => {
                      const nextChapter = Number(e.target.value);
                      setChapter(nextChapter);
                      setVerseFrom(1);
                      setVerseTo(null);
                      setReferenceInput('');
                      setError(null);
                    }}
                    className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">From verse</label>
                  <select
                    data-testid="bible-browser-from-verse"
                    value={verseFrom}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVerseFrom(v);
                      setVerseTo(null);
                      setReferenceInput('');
                      setError(null);
                    }}
                    className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: verseCount }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] text-zinc-600 uppercase tracking-wider px-0.5">To verse</label>
                  <select
                    data-testid="bible-browser-to-verse"
                    value={verseTo ?? ''}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setVerseTo(null);
                        setReferenceInput('');
                        setError(null);
                        return;
                      }
                      const nextVerseTo = Number(e.target.value);
                      setVerseTo(nextVerseTo);
                      setReferenceInput(buildStructuredBibleReference(selectedBook.name, chapter, verseFrom, nextVerseTo));
                      setError(null);
                    }}
                    className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 py-1.5 px-2 rounded-sm focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Select</option>
                    {Array.from({ length: verseCount }, (_, i) => i + 1).filter((n) => n >= verseFrom).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedBook && (
              <div
                data-testid="bible-browser-structured-preview"
                className={`px-1 text-[9px] font-mono ${buildQuery() ? 'text-blue-500' : 'text-amber-400'}`}
              >
                -&gt; {structuredDraft}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            data-testid="bible-browser-search"
            onClick={() => void (isVisionaryMode ? fetchScripture(aiQuery, true) : handleManualSearch())}
            disabled={isVisionaryMode ? !aiQuery.trim() : !(normalizeBibleReference(referenceInput) || buildQuery())}
            className={`flex-1 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-sm font-bold transition-all active:scale-95 ${compact ? 'py-1.5 text-[8px]' : 'text-[9px]'}`}
          >
            {isVisionaryMode ? 'AI SEARCH' : 'SEARCH PASSAGE'}
          </button>
        </div>
      </div>

      {/* ── Sermon Recording strip (always visible when Visionary mode on) ── */}
      {isVisionaryMode && (
        <div className="shrink-0 px-2.5 py-2 border-b border-zinc-900/80 bg-zinc-950/95">
          <div className="rounded-sm border border-rose-900/50 bg-rose-950/15 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold tracking-wider text-rose-300 uppercase">Record Sermon</span>
              <button
                onClick={() => { void toggleSermonRecording(); }}
                disabled={sermonSummarizing || sermonTranscribing}
                className={`px-2 py-1 rounded-sm text-[9px] font-bold border transition-colors disabled:opacity-50 ${
                  sermonRecording
                    ? 'bg-rose-700/60 text-rose-200 border-rose-600 animate-pulse'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-rose-700 hover:text-rose-300'
                }`}
              >
                {sermonTranscribing ? 'Transcribing…' : sermonSummarizing ? 'Summarizing…' : sermonRecording ? '⏹ Stop & Summarize' : '⏺ Start Recording'}
              </button>
            </div>
            {sermonRecording && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[9px] font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sermonMicWarning ? 'bg-amber-400 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                  <span className={sermonMicWarning ? 'text-amber-300' : 'text-rose-300'}>
                    {Math.floor(sermonElapsed / 60)}:{String(sermonElapsed % 60).padStart(2, '0')} · {sermonWordCount.toLocaleString()} words
                  </span>
                </div>
                {sermonMicWarning && (
                  <div className="text-[9px] text-amber-300 font-mono">{sermonMicWarning}</div>
                )}
              </div>
            )}
            {sermonTranscribing && (
              <div className="text-[9px] text-zinc-400 font-mono animate-pulse">{sermonTranscribingStatusText}</div>
            )}
            {false && sermonTranscribing && (
              <div className="text-[9px] text-zinc-400 font-mono animate-pulse">Transcribing audio… this may take a moment.</div>
            )}
            {sermonSummaryError && !sermonRecording && !sermonTranscribing && (
              <div className="flex items-start gap-1.5 bg-rose-950/40 border border-rose-800/50 rounded px-2 py-1">
                <span className="text-rose-400 text-[10px] leading-tight shrink-0 mt-px">⚠</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="block text-[9px] text-rose-300 font-mono leading-tight">{sermonSummaryError}</span>
                  {sermonProcessingJob?.status === 'failed' && (
                    <button
                      onClick={() => { void handleRetrySermonProcessing(); }}
                      className="px-2 py-0.5 rounded-sm border border-amber-700/60 bg-amber-950/30 text-[9px] font-bold text-amber-200 hover:bg-amber-900/40 transition-colors"
                    >
                      Retry Saved Audio
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSermonSummaryError(null)}
                  className="ml-auto text-rose-500 hover:text-rose-300 text-[10px] shrink-0 leading-tight"
                  title="Dismiss"
                >✕</button>
              </div>
            )}
            {sermonSummary && !sermonRecording && (
              <button
                onClick={() => setSermonSummaryOpen(true)}
                className="w-full py-1 rounded-sm bg-purple-900/40 border border-purple-700/50 text-purple-200 text-[9px] font-bold hover:bg-purple-900/70 transition-colors"
              >
                View Summary
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Verse results (scrollable) ── */}
      <div className={resultsClassName}>
        {loading || aiLoading ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-[10px] font-mono text-zinc-600 uppercase animate-pulse">{aiLoading ? 'AI Thinking...' : 'Searching...'}</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-[10px] text-red-400 font-mono opacity-60 uppercase">{error}</div>
        ) : results.length > 0 ? (
          <div className="space-y-2 animate-in fade-in duration-500">
            <div className="px-1 text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
              {results[0].book_name} {results[0].chapter} - {results.length} verse{results.length > 1 ? 's' : ''}
            </div>
            {results.map((v, i) => (
              <div key={i} className="p-3 rounded-sm border bg-zinc-900/40 border-zinc-900">
                <div className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter mb-1">Verse {v.verse}</div>
                <p className="text-[11px] leading-relaxed text-zinc-200 font-serif italic">"{v.text.trim()}"</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 opacity-20">
            <BibleIcon className="w-12 h-12 mx-auto mb-2 text-zinc-500" />
            <span className="text-[10px] font-mono tracking-widest uppercase">Bible Library</span>
          </div>
        )}
      </div>

      {/* ── Persistent controls footer — always visible when results exist ── */}
      {results.length > 0 && (
        <div className="shrink-0 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-md">
          {/* Layout + Size + Style chips */}
          <div className={`${compact ? 'px-2.5 pt-2 pb-1' : 'px-3 pt-2.5 pb-1'} space-y-1.5`}>
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] text-zinc-600 uppercase tracking-widest font-bold w-10 shrink-0">Layout</span>
              {([['standard', 'Standard'], ['scripture_ref', 'Scripture + Ref'], ['ticker', 'Ticker']] as const).map(([key, label]) => (
                <button key={key} onClick={() => { setBibleLayout(key); (onLiveStyleUpdate ?? onProjectRequest)(createServiceItem(results, key)); }}
                  className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wide transition-all ${bibleLayout === key ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'}`}
                >{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] text-zinc-600 uppercase tracking-widest font-bold w-10 shrink-0">Size</span>
              {([['small', 'SM'], ['medium', 'MD'], ['large', 'LG'], ['xlarge', 'XL']] as const).map(([key, label]) => (
                <button key={key} onClick={() => { setBibleFontSize(key); (onLiveStyleUpdate ?? onProjectRequest)(createServiceItem(results, undefined, key)); }}
                  className={`px-2 py-1 rounded text-[8px] font-bold tracking-wide transition-all ${bibleFontSize === key ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40' : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'}`}
                >{label}</button>
              ))}
            </div>
            <BibleStylePicker
              mode={bibleStyleMode}
              family={bibleStyleFamily}
              onModeChange={(m) => {
                setBibleStyleMode(m);
                (onLiveStyleUpdate ?? onProjectRequest)(createServiceItem(results, undefined, undefined, m));
              }}
              onFamilyChange={(f) => {
                setBibleStyleFamily(f);
                (onLiveStyleUpdate ?? onProjectRequest)(createServiceItem(results, undefined, undefined, undefined, f));
              }}
              onRandomize={() => {
                const newSeed = `rand-${Date.now()}`;
                setBibleStyleSeed(newSeed);
                (onLiveStyleUpdate ?? onProjectRequest)(createServiceItem(results, undefined, undefined, undefined, undefined, newSeed));
              }}
              compact={compact}
              hasPptxItems={hasPptxItems}
            />
          </div>
          {/* Action buttons */}
          <div className={actionFooterClassName}>
            <button
              onClick={() => onProjectRequest(createServiceItem(results))}
              className={`flex-1 flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 rounded-sm font-bold transition-all group active:scale-95 ${compact ? 'py-2 text-[9px]' : 'py-2.5 text-[10px]'}`}
            >
              <PlayIcon className="w-3 h-3 fill-current group-hover:text-white" />
              PROJECT NOW
            </button>
            <button
              onClick={() => {
                onAddRequest(createServiceItem(results));
                setShowSuccess(true);
                window.setTimeout(() => setShowSuccess(false), 2000);
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-sm font-bold transition-all active:scale-95 border ${compact ? 'py-2 text-[9px]' : 'py-2.5 text-[10px]'} ${showSuccess ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'}`}
            >
              {showSuccess ? 'SCHEDULED OK' : 'SCHEDULE'}
            </button>
          </div>
        </div>
      )}

      {/* ── Sermon Summary overlay ─────────────────────────────────── */}
      {sermonSummary && sermonSummaryOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-zinc-950/98 backdrop-blur-sm">
          <SermonSummaryPanel
            summary={sermonSummary}
            wordCount={sermonWordCount}
            archived={sermonArchived}
            onClose={() => setSermonSummaryOpen(false)}
            onArchive={async () => {
              const result = await archiveSermon(sermonSummary, sermonWordCount, workspaceId);
              if (result) setSermonArchived(true);
            }}
            onProjectRecap={() => {
              const item = createSermonRecapItem(sermonSummary);
              onProjectRequest(item);
            }}
            onAddToSchedule={(text) => {
              const item = createSermonRecapItem(sermonSummary);
              onAddRequest(item);
              void navigator.clipboard.writeText(text);
            }}
          />
        </div>
      )}
    </div>
  );
};
