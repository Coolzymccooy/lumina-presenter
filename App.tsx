
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { INITIAL_SCHEDULE, MOCK_SONGS, DEFAULT_BACKGROUNDS, GOSPEL_TRACKS, GospelTrack } from './constants';
import { ServiceItem, Slide, ItemType } from './types';
import { SlideRenderer } from './components/SlideRenderer';
import { AIModal } from './components/AIModal';
import { SlideEditorModal } from './components/SlideEditorModal';
import { ItemEditorPanel } from './components/ItemEditorPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HelpModal } from './components/HelpModal';
import { OutputWindow } from './components/OutputWindow';
import { LoginScreen } from './components/LoginScreen';
import { AudioLibrary } from './components/AudioLibrary';
import { BibleBrowser } from './components/BibleBrowser';
import { LandingPage } from './components/LandingPage'; // NEW
import { ProfileSettings } from './components/ProfileSettings'; // NEW
import { MotionLibrary } from './components/MotionLibrary'; // NEW
import { StageDisplay } from './components/StageDisplay';
import { logActivity, analyzeSentimentContext } from './services/analytics';
import { auth, isFirebaseConfigured, subscribeToState, subscribeToTeamPlaylists, updateLiveState, upsertTeamPlaylist } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";
import { clearMediaCache, saveMedia } from './services/localMedia';
import { fetchServerSessionState, importVisualPptxDeck, loadLatestWorkspaceSnapshot, resolveWorkspaceId, saveServerSessionState, saveWorkspaceSettings, saveWorkspaceSnapshot } from './services/serverApi';
import { parsePptxFile } from './services/pptxImport';
import { PlayIcon, PlusIcon, MonitorIcon, SparklesIcon, EditIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon, HelpIcon, VolumeXIcon, Volume2Icon, MusicIcon, BibleIcon, Settings } from './components/Icons'; // Added Settings Icon

// --- CONSTANTS ---
const STORAGE_KEY = 'lumina_session_v1';
const SETTINGS_KEY = 'lumina_workspace_settings_v1';
const SETTINGS_UPDATED_AT_KEY = 'lumina_workspace_settings_updated_at_v1';
const LIVE_STATE_QUEUE_KEY = 'lumina_live_state_queue_v1';
const CLOUD_PLAYLIST_SUFFIX = 'default-playlist-v2';
const SYNC_BACKOFF_BASE_MS = 5000;
const SYNC_BACKOFF_MAX_MS = 60000;
const MAX_LIVE_QUEUE_SIZE = 40;
const SILENT_AUDIO_B64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASCCOkiJAAAAAAAAAAAAAAAAAAAAAAA=";

type WorkspaceSettings = {
  churchName: string;
  ccli: string;
  defaultVersion: string;
  theme: 'dark' | 'light' | 'midnight';
  remoteAdminEmails: string;
  sessionId: string;
  stageProfile: 'classic' | 'compact' | 'high_contrast';
  machineMode: boolean;
};

type SmokeTestResult = {
  name: string;
  ok: boolean;
  details: string;
};

type CloudPlaylistRecord = {
  id: string;
  title?: string;
  updatedAt?: number;
  items?: ServiceItem[];
  selectedItemId?: string;
  activeItemId?: string | null;
  activeSlideIndex?: number;
  workspaceSettings?: Partial<WorkspaceSettings>;
};

const buildCloudPlaylistId = (uid: string) => `${uid}-${CLOUD_PLAYLIST_SUFFIX}`;

const getYoutubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  return m?.[1] ?? null;
};

const looksLikeVideoUrl = (url: string): boolean => {
  if (!url) return false;
  if (getYoutubeId(url)) return true;
  const normalized = url.split('?')[0].toLowerCase();
  return normalized.endsWith('.mp4')
    || normalized.endsWith('.webm')
    || normalized.endsWith('.mov')
    || normalized.includes('/video/')
    || normalized.startsWith('blob:');
};

const sanitizeWorkspaceSettings = (value: unknown): Partial<WorkspaceSettings> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const safe: Partial<WorkspaceSettings> = {};
  if (typeof raw.churchName === 'string') safe.churchName = raw.churchName;
  if (typeof raw.ccli === 'string') safe.ccli = raw.ccli;
  if (typeof raw.defaultVersion === 'string') safe.defaultVersion = raw.defaultVersion;
  if (raw.theme === 'dark' || raw.theme === 'light' || raw.theme === 'midnight') safe.theme = raw.theme;
  if (typeof raw.remoteAdminEmails === 'string') safe.remoteAdminEmails = raw.remoteAdminEmails;
  if (typeof raw.sessionId === 'string') safe.sessionId = raw.sessionId;
  if (raw.stageProfile === 'classic' || raw.stageProfile === 'compact' || raw.stageProfile === 'high_contrast') {
    safe.stageProfile = raw.stageProfile;
  }
  if (typeof raw.machineMode === 'boolean') safe.machineMode = raw.machineMode;
  return safe;
};

declare global {
  interface Window {
    luminaSmokeTest?: () => {
      ok: boolean;
      sessionId: string;
      timestamp: string;
      results: SmokeTestResult[];
    };
  }
}

const PauseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
);
const RewindIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
);
const ForwardIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
);

function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [viewState, setViewState] = useState<'landing' | 'studio'>('landing'); // NEW: Top-level routing
  
  const [saveError, setSaveError] = useState<boolean>(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  
  // ✅ Projector popout window handle (opened in click handler to avoid popup blockers)
  const [outputWin, setOutputWin] = useState<Window | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'SCHEDULE' | 'AUDIO' | 'BIBLE'>('SCHEDULE');

  const parseJson = <T,>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const getSavedState = () => {
    try {
      return parseJson(localStorage.getItem(STORAGE_KEY), null as any);
    } catch (e) {
      console.warn("State load failed", e);
      return null;
    }
  };
  const initialSavedStateRef = useRef<any>(null);
  if (initialSavedStateRef.current === null) {
    initialSavedStateRef.current = getSavedState();
  }
  const initialSavedState = initialSavedStateRef.current;

  const [schedule, setSchedule] = useState<ServiceItem[]>(() => {
    const saved = initialSavedState;
    return saved?.schedule || INITIAL_SCHEDULE;
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const saved = initialSavedState;
    const savedSchedule = saved?.schedule || INITIAL_SCHEDULE;
    return saved?.selectedItemId || savedSchedule[0]?.id || '';
  });

  const [viewMode, setViewMode] = useState<'BUILDER' | 'PRESENTER'>(() => {
    const saved = initialSavedState;
    return saved?.viewMode || 'BUILDER';
  });

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSlideEditorOpen, setIsSlideEditorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); // NEW
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    churchName: 'My Church',
    ccli: '',
    defaultVersion: 'kjv',
    theme: 'dark',
    remoteAdminEmails: '',
    sessionId: 'live',
    stageProfile: 'classic',
    machineMode: false,
  });
  const allowedAdminEmails = useMemo(() => {
    const raw = workspaceSettings.remoteAdminEmails || '';
    const parsed = raw
      .split(/[\n,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .map((entry) => {
        const [email] = entry.split(/[:|]/);
        return email.trim();
      })
      .filter(Boolean);
    return Array.from(new Set(parsed));
  }, [workspaceSettings.remoteAdminEmails]);
  const liveSessionId = useMemo(() => (workspaceSettings.sessionId || 'live').trim() || 'live', [workspaceSettings.sessionId]);
  const workspaceId = useMemo(() => resolveWorkspaceId(user), [user?.uid]);
  const [isMotionLibOpen, setIsMotionLibOpen] = useState(false); // NEW
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isLyricsImportOpen, setIsLyricsImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('Imported Lyrics');
  const [importLyrics, setImportLyrics] = useState('');
  const [importModalError, setImportModalError] = useState<string | null>(null);
  const [isImportingDeck, setIsImportingDeck] = useState(false);
  const [importDeckStatus, setImportDeckStatus] = useState('');
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [autoCueEnabled, setAutoCueEnabled] = useState(false);
  const [autoCueSeconds, setAutoCueSeconds] = useState(7);
  const [autoCueRemaining, setAutoCueRemaining] = useState(7);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [isOutputLive, setIsOutputLive] = useState(false);
  const [isStageDisplayLive, setIsStageDisplayLive] = useState(false);
  const [lowerThirdsEnabled, setLowerThirdsEnabled] = useState(false);
  const [routingMode, setRoutingMode] = useState<'PROJECTOR' | 'STREAM' | 'LOBBY'>('PROJECTOR');
  const [teamPlaylists, setTeamPlaylists] = useState<CloudPlaylistRecord[]>([]);
  const [cloudBootstrapComplete, setCloudBootstrapComplete] = useState(!isFirebaseConfigured());
  const [stageWin, setStageWin] = useState<Window | null>(null);
  const [timerMode, setTimerMode] = useState<'COUNTDOWN' | 'ELAPSED'>('COUNTDOWN');
  const [timerDurationMin, setTimerDurationMin] = useState(35);
  const [timerSeconds, setTimerSeconds] = useState(35 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(() => {
    const saved = initialSavedState;
    return saved?.activeItemId || null;
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(() => {
    const saved = initialSavedState;
    return saved?.activeSlideIndex ?? -1;
  });

  const [blackout, setBlackout] = useState(() => {
    const saved = initialSavedState;
    return !!saved?.blackout;
  });
  const [isPlaying, setIsPlaying] = useState(() => {
    const saved = initialSavedState;
    return typeof saved?.isPlaying === 'boolean' ? saved.isPlaying : true;
  });
  const [outputMuted, setOutputMuted] = useState(() => {
    const saved = initialSavedState;
    return !!saved?.outputMuted;
  });
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [seekCommand, setSeekCommand] = useState<number | null>(() => {
    const saved = initialSavedState;
    return typeof saved?.seekCommand === 'number' ? saved.seekCommand : null;
  });
  const [seekAmount, setSeekAmount] = useState<number>(() => {
    const saved = initialSavedState;
    return typeof saved?.seekAmount === 'number' ? saved.seekAmount : 0;
  });

  // --- AUDIO SOUNDTRACK STATE ---
  const [currentTrack, setCurrentTrack] = useState<GospelTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSlideRef = useRef<HTMLDivElement>(null);
  const antiSleepAudioRef = useRef<HTMLAudioElement>(null);
  const hasInitializedRemoteSnapshotRef = useRef(false);
  const hasHydratedCloudStateRef = useRef(false);
  const hasHydratedServerSnapshotRef = useRef(false);
  const workspaceSettingsUpdatedAtRef = useRef<number>(0);
  const lastRemoteCommandAtRef = useRef<number | null>(null);
  const lastServerRemoteCommandAtRef = useRef<number | null>(null);
  const lastSyncErrorRef = useRef<{ key: string; at: number } | null>(null);
  const syncFailureStreakRef = useRef(0);
  const syncBackoffUntilRef = useRef(0);
  const historyRef = useRef<Array<{ schedule: ServiceItem[]; selectedItemId: string; at: number }>>([]);
  const [historyCount, setHistoryCount] = useState(0);
  type RemoteCommand = 'NEXT' | 'PREV' | 'BLACKOUT' | 'PLAY' | 'PAUSE' | 'STOP' | 'MUTE' | 'UNMUTE';
  const isRemoteCommand = (command: unknown): command is RemoteCommand =>
    command === 'NEXT'
    || command === 'PREV'
    || command === 'BLACKOUT'
    || command === 'PLAY'
    || command === 'PAUSE'
    || command === 'STOP'
    || command === 'MUTE'
    || command === 'UNMUTE';
  const isRecord = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
  const cloudPlaylistId = useMemo(() => (
    user?.uid ? buildCloudPlaylistId(user.uid) : ''
  ), [user?.uid]);

  const reportSyncFailure = useCallback((source: string, error: unknown, meta: Record<string, any> = {}) => {
    const message = error instanceof Error ? error.message : String(error || 'Unknown sync failure');
    const key = `${source}:${message}`;
    const now = Date.now();
    const last = lastSyncErrorRef.current;
    if (last && last.key === key && now - last.at < 8000) return;
    lastSyncErrorRef.current = { key, at: now };
    setSyncIssue(`${source}: ${message}`);
    logActivity(user?.uid, 'ERROR', {
      type: 'LIVE_SYNC_FAILURE',
      source,
      message,
      sessionId: liveSessionId,
      ...meta,
    });
  }, [user?.uid, liveSessionId]);

  const computeSyncBackoffMs = useCallback((failureStreak: number) => {
    return Math.min(SYNC_BACKOFF_MAX_MS, SYNC_BACKOFF_BASE_MS * (2 ** Math.max(0, failureStreak - 1)));
  }, []);

  const buildSyncPausedMessage = useCallback((seconds: number) => {
    return `Live sync paused for ${seconds}s (permissions). Presenter continues locally.`;
  }, []);

  const resetSyncBackoff = useCallback(() => {
    syncFailureStreakRef.current = 0;
    syncBackoffUntilRef.current = 0;
  }, []);

  const applySyncBackoff = useCallback((source: 'live-update' | 'flush') => {
    syncFailureStreakRef.current += 1;
    const streak = syncFailureStreakRef.current;
    const backoffMs = computeSyncBackoffMs(streak);
    const retryAt = Date.now() + backoffMs;
    syncBackoffUntilRef.current = retryAt;
    const seconds = Math.max(1, Math.ceil(backoffMs / 1000));
    reportSyncFailure('live-sync-backoff', new Error('Firestore write denied for live session'), {
      source,
      streak,
      backoffMs,
      retryAt,
    });
    setSyncIssue(buildSyncPausedMessage(seconds));
  }, [buildSyncPausedMessage, computeSyncBackoffMs, reportSyncFailure]);

  const enqueueLiveState = useCallback((payload: any) => {
    try {
      const existing = parseJson<any[]>(localStorage.getItem(LIVE_STATE_QUEUE_KEY), []);
      const next = [...existing, { sessionId: liveSessionId, payload, at: Date.now() }].slice(-MAX_LIVE_QUEUE_SIZE);
      localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(next));
      setSyncPendingCount(next.length);
    } catch (error) {
      console.warn('Failed to queue live state', error);
      reportSyncFailure('queue', error, { queueOp: 'enqueue' });
    }
  }, [liveSessionId, reportSyncFailure]);

  const flushLiveStateQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const now = Date.now();
    if (syncBackoffUntilRef.current > now) {
      const remainingSeconds = Math.max(1, Math.ceil((syncBackoffUntilRef.current - now) / 1000));
      setSyncIssue(buildSyncPausedMessage(remainingSeconds));
      return;
    }
    try {
      const queued = parseJson<Array<{ sessionId: string; payload: any; at: number }>>(localStorage.getItem(LIVE_STATE_QUEUE_KEY), []);
      if (!queued.length) {
        setSyncPendingCount(0);
        return;
      }
      const failed: typeof queued = [];
      for (let idx = 0; idx < queued.length; idx += 1) {
        const entry = queued[idx];
        const [firebaseOk, serverOk] = await Promise.all([
          updateLiveState(entry.payload, entry.sessionId || liveSessionId),
          saveServerSessionState(workspaceId, entry.sessionId || liveSessionId, user, entry.payload).then((response) => !!response?.ok),
        ]);
        if (!firebaseOk && !serverOk) {
          failed.push(...queued.slice(idx));
          applySyncBackoff('flush');
          break;
        }
      }
      localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(failed));
      setSyncPendingCount(failed.length);
      if (!failed.length) {
        resetSyncBackoff();
        setSyncIssue(null);
      }
    } catch (error) {
      console.warn('Failed to flush queued live state', error);
      reportSyncFailure('flush', error, { queueOp: 'flush' });
    }
  }, [liveSessionId, workspaceId, user, reportSyncFailure, applySyncBackoff, resetSyncBackoff, buildSyncPausedMessage]);

  const syncLiveState = useCallback(async (payload: any) => {
    if (!user?.uid) return;
    if (!navigator.onLine) {
      enqueueLiveState(payload);
      return;
    }
    const now = Date.now();
    if (syncBackoffUntilRef.current > now) {
      const remainingSeconds = Math.max(1, Math.ceil((syncBackoffUntilRef.current - now) / 1000));
      setSyncIssue(buildSyncPausedMessage(remainingSeconds));
      return;
    }
    const [firebaseOk, serverOk] = await Promise.all([
      isFirebaseConfigured() ? updateLiveState(payload, liveSessionId) : Promise.resolve(false),
      saveServerSessionState(workspaceId, liveSessionId, user, payload).then((response) => !!response?.ok),
    ]);
    if (!firebaseOk && !serverOk) {
      applySyncBackoff('live-update');
      enqueueLiveState(payload);
    } else {
      resetSyncBackoff();
      if (!firebaseOk && serverOk) {
        setSyncIssue('Firebase sync denied; server sync active.');
      } else {
        setSyncIssue(null);
      }
    }
  }, [user?.uid, user, workspaceId, liveSessionId, enqueueLiveState, applySyncBackoff, resetSyncBackoff, buildSyncPausedMessage]);

  // --- SESSION PERSISTENCE LOGIC ---
  useEffect(() => {
    if (isFirebaseConfigured() && auth) {
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
        // Auto-enter workspace if authenticated
        if (u) setViewState('studio'); 
      });
      return () => unsub();
    }

    // demo mode fallback
    const demoUser = localStorage.getItem("lumina_demo_user");
    if (demoUser) {
        setUser(JSON.parse(demoUser));
        setViewState('studio');
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      hasHydratedCloudStateRef.current = true;
      setCloudBootstrapComplete(true);
      return;
    }
    if (!user?.uid) {
      hasHydratedCloudStateRef.current = false;
      setCloudBootstrapComplete(false);
      return;
    }
    hasHydratedCloudStateRef.current = false;
    setCloudBootstrapComplete(false);
  }, [user?.uid]);

  useEffect(() => {
    resetSyncBackoff();
    hasHydratedServerSnapshotRef.current = false;
    lastServerRemoteCommandAtRef.current = null;
  }, [user?.uid, liveSessionId, resetSyncBackoff]);


  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = sanitizeWorkspaceSettings(JSON.parse(savedSettings));
        setWorkspaceSettings((prev) => ({ ...prev, ...parsed }));
      }
      const savedUpdatedAt = Number(localStorage.getItem(SETTINGS_UPDATED_AT_KEY) || '0');
      workspaceSettingsUpdatedAtRef.current = Number.isFinite(savedUpdatedAt) ? savedUpdatedAt : 0;
    } catch (error) {
      console.warn('Failed to load workspace settings', error);
    }
  }, []);

  useEffect(() => {
    const updatedAt = Date.now();
    workspaceSettingsUpdatedAtRef.current = updatedAt;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(workspaceSettings));
      localStorage.setItem(SETTINGS_UPDATED_AT_KEY, String(updatedAt));
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        setSaveError(true);
      } else {
        console.warn('Failed to persist workspace settings', error);
      }
    }
    document.documentElement.dataset.theme = workspaceSettings.theme;
  }, [workspaceSettings]);

  useEffect(() => {
    if (!user?.uid) return;
    const id = window.setTimeout(() => {
      saveWorkspaceSettings(workspaceId, user, workspaceSettings);
    }, 700);
    return () => window.clearTimeout(id);
  }, [workspaceId, user, workspaceSettings]);

  useEffect(() => {
    if (!user?.uid || hasHydratedServerSnapshotRef.current) return;
    hasHydratedServerSnapshotRef.current = true;

    (async () => {
      const response = await loadLatestWorkspaceSnapshot(workspaceId, user);
      const snapshot = response?.snapshot;
      if (!snapshot?.payload) return;

      const localUpdatedAt = typeof initialSavedStateRef.current?.updatedAt === 'number'
        ? initialSavedStateRef.current.updatedAt
        : 0;
      if (localUpdatedAt > snapshot.updatedAt) return;

      const payload = snapshot.payload;
      if (Array.isArray(payload.schedule) && payload.schedule.length > 0) {
        setSchedule(payload.schedule);
      }
      if (typeof payload.selectedItemId === 'string') {
        setSelectedItemId(payload.selectedItemId);
      }
      if (typeof payload.activeItemId === 'string') {
        setActiveItemId(payload.activeItemId);
      } else {
        setActiveItemId(null);
      }
      if (typeof payload.activeSlideIndex === 'number') {
        setActiveSlideIndex(payload.activeSlideIndex);
      }
      if (payload.workspaceSettings && typeof payload.workspaceSettings === 'object') {
        const localSettingsUpdatedAt = workspaceSettingsUpdatedAtRef.current;
        if (snapshot.updatedAt >= localSettingsUpdatedAt) {
          const snapshotSettings = sanitizeWorkspaceSettings(payload.workspaceSettings);
          if (Object.keys(snapshotSettings).length > 0) {
            workspaceSettingsUpdatedAtRef.current = snapshot.updatedAt;
            setWorkspaceSettings((prev) => ({ ...prev, ...snapshotSettings }));
          }
        }
      }
    })();
  }, [workspaceId, user?.uid, user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIVE_STATE_QUEUE_KEY);
      const queued = raw ? JSON.parse(raw) : [];
      if (Array.isArray(queued)) {
        const trimmed = queued.slice(-MAX_LIVE_QUEUE_SIZE);
        if (trimmed.length !== queued.length) {
          localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(trimmed));
        }
        setSyncPendingCount(trimmed.length);
      } else {
        setSyncPendingCount(0);
      }
    } catch {
      setSyncPendingCount(0);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      flushLiveStateQueue();
    };
    window.addEventListener('online', onOnline);
    flushLiveStateQueue();
    return () => window.removeEventListener('online', onOnline);
  }, [flushLiveStateQueue]);

  useEffect(() => {
    const cleanup = () => clearMediaCache();
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);

  useEffect(() => {
    if (viewMode === 'PRESENTER' && antiSleepAudioRef.current) {
        antiSleepAudioRef.current.play().catch(e => console.log("Anti-sleep audio needs interaction", e));
    } else if (antiSleepAudioRef.current) {
        antiSleepAudioRef.current.pause();
    }
  }, [viewMode]);

  // --- AUDIO PLAYER EFFECT ---
  useEffect(() => {
    if (!audioRef.current) {
        audioRef.current = new Audio();
    }
    
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
        if (audio.duration) {
            setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
    };

    const handleEnded = () => {
        setIsAudioPlaying(false);
        setAudioProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
      if (audioRef.current) {
          audioRef.current.volume = audioVolume;
      }
  }, [audioVolume]);

  const handlePlayTrack = (track: GospelTrack) => {
      if (audioRef.current) {
          if (currentTrack?.id === track.id) {
              toggleAudio();
          } else {
              audioRef.current.src = track.url;
              audioRef.current.play().catch(e => console.error("Audio playback error", e));
              setCurrentTrack(track);
              setIsAudioPlaying(true);
              logActivity(user?.uid, 'ERROR', { type: 'AUDIO_PLAY', track: track.title }); 
          }
      }
  };

  const toggleAudio = () => {
      if (audioRef.current && currentTrack) {
          if (isAudioPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.play();
          }
          setIsAudioPlaying(!isAudioPlaying);
      }
  };

  const stopAudio = () => {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsAudioPlaying(false);
          setAudioProgress(0);
          setCurrentTrack(null);
      }
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    if (!isFirebaseConfigured()) {
        localStorage.setItem('lumina_demo_user', JSON.stringify(loggedInUser));
    }
    logActivity(loggedInUser.uid, 'SESSION_START');
    setViewState('studio'); // Transition to app
  };

  const handleLogout = () => {
    if (user) logActivity(user.uid, 'SESSION_END');
    if (isFirebaseConfigured() && auth) auth.signOut();
    else localStorage.removeItem('lumina_demo_user');
    setUser(null);
    setViewState('landing'); // Return to home
  };

  useEffect(() => {
    if (!user) return;
    const id = window.setTimeout(() => {
      const saveData = {
        schedule,
        selectedItemId,
        viewMode,
        activeItemId,
        activeSlideIndex,
        blackout,
        isPlaying,
        outputMuted,
        seekCommand,
        seekAmount,
        lowerThirdsEnabled,
        routingMode,
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
        setSaveError(false);
      } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') setSaveError(true);
      }
    }, 180);
    return () => window.clearTimeout(id);
  }, [schedule, selectedItemId, viewMode, activeItemId, activeSlideIndex, blackout, isPlaying, outputMuted, seekCommand, seekAmount, lowerThirdsEnabled, routingMode, user]);



  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    const updatedAt = Date.now();
    syncLiveState({
      scheduleSnapshot: schedule.slice(0, 20),
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
    (async () => {
      try {
        await upsertTeamPlaylist(user.uid, cloudPlaylistId, {
          title: 'Default Playlist',
          items: schedule,
          selectedItemId,
          activeItemId,
          activeSlideIndex,
          workspaceSettings,
          updatedAt,
        });
        await saveWorkspaceSnapshot(workspaceId, user, {
          schedule,
          selectedItemId,
          activeItemId,
          activeSlideIndex,
          workspaceSettings,
          updatedAt,
        });
      } catch (error) {
        reportSyncFailure('playlist-upsert', error, { itemCount: schedule.length });
      }
    })();
  }, [
    schedule,
    selectedItemId,
    activeItemId,
    activeSlideIndex,
    workspaceSettings,
    user?.uid,
    user?.email,
    allowedAdminEmails,
    syncLiveState,
    reportSyncFailure,
    cloudBootstrapComplete,
    cloudPlaylistId,
    workspaceId,
    user,
  ]);

  useEffect(() => {
    if (viewMode === 'PRESENTER' && activeSlideRef.current) {
        activeSlideRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSlideIndex, activeItemId, viewMode]);

  const hasSavedSession = (() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  const selectedItem = schedule.find(i => i.id === selectedItemId) || null;
  const activeItem = schedule.find(i => i.id === activeItemId) || null;
  const activeSlide = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex] : null;
  const previewLowerThirds = lowerThirdsEnabled && routingMode !== 'PROJECTOR';
  const nextSlidePreview = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex + 1] || null : null;
  const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
  const activeBackgroundUrl = (activeSlide?.backgroundUrl || activeItem?.theme?.backgroundUrl || '').trim();
  const isActiveVideo = !!activeSlide && (
    activeSlide.mediaType === 'video'
    || (!activeSlide.mediaType && activeItem?.theme.mediaType === 'video')
    || looksLikeVideoUrl(activeBackgroundUrl)
  );
  const formatTimer = (total: number) => {
    const negative = total < 0;
    const abs = Math.abs(total);
    const mm = Math.floor(abs / 60).toString().padStart(2, '0');
    const ss = Math.floor(abs % 60).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${mm}:${ss}`;
  };
  const isTimerOvertime = timerMode === 'COUNTDOWN' && timerSeconds < 0;
  const buildSharedRouteUrl = (route: 'output' | 'remote') => (
    typeof window !== 'undefined'
      ? `${window.location.origin}/#/${route}?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&fullscreen=1`
      : `/#/${route}?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&fullscreen=1`
  );
  const obsOutputUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('output')
    : `/#/output?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&fullscreen=1`;
  const remoteControlUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('remote')
    : `/#/remote?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&fullscreen=1`;
  const cloneSchedule = (value: ServiceItem[]) => JSON.parse(JSON.stringify(value)) as ServiceItem[];
  const pushHistory = () => {
    historyRef.current.push({
      schedule: cloneSchedule(schedule),
      selectedItemId,
      at: Date.now(),
    });
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    setHistoryCount(historyRef.current.length);
  };
  const rollbackLastChange = () => {
    const last = historyRef.current.pop();
    if (!last) return;
    setSchedule(last.schedule);
    setSelectedItemId(last.selectedItemId);
    setHistoryCount(historyRef.current.length);
  };

  const buildTemplate = (templateId: 'CLASSIC' | 'YOUTH' | 'PRAYER'): ServiceItem[] => {
    const now = Date.now();
    const baseTheme = {
      backgroundUrl: DEFAULT_BACKGROUNDS[0],
      mediaType: 'image' as const,
      fontFamily: 'sans-serif',
      textColor: '#ffffff',
      shadow: true,
      fontSize: 'large' as const,
    };
    if (templateId === 'CLASSIC') {
      return cloneSchedule(INITIAL_SCHEDULE).map((item, idx) => ({ ...item, id: `${now}-${idx}` }));
    }
    if (templateId === 'YOUTH') {
      return [
        {
          id: `${now}-1`,
          title: 'Countdown + Hype',
          type: ItemType.ANNOUNCEMENT,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[9], fontSize: 'xlarge' },
          slides: [
            { id: `${now}-1a`, label: 'Start', content: 'Service starts in 05:00' },
            { id: `${now}-1b`, label: 'Welcome', content: 'Welcome to Youth Night' },
          ],
        },
        {
          id: `${now}-2`,
          title: 'Worship Set',
          type: ItemType.SONG,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[7], fontSize: 'large' },
          slides: [
            { id: `${now}-2a`, label: 'Verse 1', content: 'You are here, moving in our midst' },
            { id: `${now}-2b`, label: 'Chorus', content: 'Way maker, miracle worker' },
          ],
        },
        {
          id: `${now}-3`,
          title: 'Message + Call',
          type: ItemType.ANNOUNCEMENT,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[2], fontSize: 'medium' },
          slides: [
            { id: `${now}-3a`, label: 'Main Point', content: 'Faith over fear' },
            { id: `${now}-3b`, label: 'Response', content: 'Prayer team available at the front' },
          ],
        },
      ];
    }
    return [
      {
        id: `${now}-p1`,
        title: 'Prayer + Reflection',
        type: ItemType.SCRIPTURE,
        theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[5], fontFamily: 'serif', fontSize: 'medium' },
        slides: [
          { id: `${now}-p1a`, label: 'Reading', content: 'Psalm 23:1-3' },
          { id: `${now}-p1b`, label: 'Meditation', content: 'Be still and know that I am God.' },
        ],
      },
      {
        id: `${now}-p2`,
        title: 'Intercession',
        type: ItemType.ANNOUNCEMENT,
        theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[10], fontSize: 'large' },
        slides: [
          { id: `${now}-p2a`, label: 'Prayer Focus', content: 'Families, healing, and community leaders' },
        ],
      },
    ];
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    window.luminaSmokeTest = () => {
      const results: SmokeTestResult[] = [];
      const templates: Array<'CLASSIC' | 'YOUTH' | 'PRAYER'> = ['CLASSIC', 'YOUTH', 'PRAYER'];
      templates.forEach((templateId) => {
        const built = buildTemplate(templateId);
        const ok = Array.isArray(built)
          && built.length > 0
          && built.every((item) => item && Array.isArray(item.slides) && item.slides.length > 0);
        results.push({
          name: `template:${templateId.toLowerCase()}`,
          ok,
          details: ok ? `items=${built.length}` : 'Template returned invalid item/slide structure',
        });
      });

      const cueOk = Number.isFinite(autoCueSeconds) && autoCueSeconds >= 2 && autoCueSeconds <= 120;
      results.push({
        name: 'cue:bounds',
        ok: cueOk,
        details: cueOk ? `autoCueSeconds=${autoCueSeconds}` : `Out of bounds: ${autoCueSeconds}`,
      });

      const samples: Array<unknown> = ['NEXT', 'PREV', 'BLACKOUT', 'PLAY', 'PAUSE', 'STOP', 'MUTE', 'UNMUTE', 'SKIP', null, 2];
      const marks = samples.map((sample) => isRemoteCommand(sample));
      const remoteGuardOk = marks[0] && marks[1] && marks[2] && marks[3] && marks[4] && marks[5] && marks[6] && marks[7] && !marks[8] && !marks[9] && !marks[10];
      results.push({
        name: 'remote:command-guard',
        ok: remoteGuardOk,
        details: `accepted=${samples.filter((_, idx) => marks[idx]).join(',') || 'none'}`,
      });

      return {
        ok: results.every((entry) => entry.ok),
        sessionId: liveSessionId,
        timestamp: new Date().toISOString(),
        results,
      };
    };

    return () => {
      delete window.luminaSmokeTest;
    };
  }, [autoCueSeconds, liveSessionId]);

  const applyTemplate = (templateId: 'CLASSIC' | 'YOUTH' | 'PRAYER') => {
    const template = buildTemplate(templateId);
    if (!template.length) return;
    historyRef.current.push({ schedule: cloneSchedule(schedule), selectedItemId, at: Date.now() });
    setHistoryCount(historyRef.current.length);
    setSchedule(template);
    setSelectedItemId(template[0].id);
    setActiveItemId(null);
    setActiveSlideIndex(-1);
    setIsTemplateOpen(false);
  };

  const importLyricsAsItem = () => {
    setImportModalError(null);
    const raw = importLyrics.trim();
    if (!raw) return;
    const chunks = raw
      .split(/\n\s*\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!chunks.length) return;
    const now = Date.now();
    const slides: Slide[] = chunks.map((content, idx) => ({
      id: `${now}-${idx}`,
      label: `Part ${idx + 1}`,
      content,
    }));
    const newItem: ServiceItem = {
      id: `${now}`,
      title: importTitle.trim() || 'Imported Lyrics',
      type: ItemType.SONG,
      slides,
      theme: {
        backgroundUrl: DEFAULT_BACKGROUNDS[0],
        mediaType: 'image',
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'large',
      },
    };
    addItem(newItem);
    setImportTitle('Imported Lyrics');
    setImportLyrics('');
    setIsLyricsImportOpen(false);
  };

  const resolveImportedDeckTitle = (fallbackTitle: string) => {
    const customTitle = importTitle.trim();
    if (customTitle && customTitle.toLowerCase() !== 'imported lyrics') return customTitle;
    return fallbackTitle || 'Imported Presentation';
  };

  const base64ToFile = (base64: string, filename: string, mimeType = 'image/png') => {
    const raw = (base64 || '').trim();
    const clean = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let idx = 0; idx < binary.length; idx += 1) {
      bytes[idx] = binary.charCodeAt(idx);
    }
    return new File([bytes], filename, { type: mimeType });
  };

  const buildTextSlidesFromPptx = async (file: File) => {
    const parsed = await parsePptxFile(file);
    const now = Date.now();
    const slides: Slide[] = parsed.slides.map((entry, idx) => ({
      id: `${now}-pptx-text-${idx + 1}`,
      label: entry.label || `Slide ${idx + 1}`,
      content: entry.content,
      notes: entry.notes,
    }));
    return {
      suggestedTitle: parsed.title,
      slides,
    };
  };

  const buildVisualSlidesFromPptx = async (
    file: File,
    onProgress?: (message: string) => void
  ) => {
    if (!user?.uid) {
      throw new Error('Please sign in before importing PowerPoint visuals.');
    }
    const converted = await importVisualPptxDeck(workspaceId, user, file);
    if (!converted?.ok || !Array.isArray(converted.slides) || !converted.slides.length) {
      throw new Error(converted?.message || 'Visual PowerPoint import failed.');
    }

    const parsedFallback = await parsePptxFile(file).catch(() => null);
    const now = Date.now();
    const slides: Slide[] = [];
    for (let idx = 0; idx < converted.slides.length; idx += 1) {
      const entry = converted.slides[idx];
      onProgress?.(`Saving slide ${idx + 1} of ${converted.slides.length}...`);
      const fileName = entry?.name || `slide-${idx + 1}.png`;
      const imageFile = base64ToFile(entry?.imageBase64 || '', fileName, 'image/png');
      const localUrl = await saveMedia(imageFile);
      slides.push({
        id: `${now}-pptx-visual-${idx + 1}`,
        label: `Slide ${idx + 1}`,
        content: '',
        backgroundUrl: localUrl,
        mediaType: 'image',
        notes: parsedFallback?.slides?.[idx]?.notes || '',
      });
    }
    return {
      suggestedTitle: file.name.replace(/\.[^.]+$/, ''),
      slides,
    };
  };

  const importPowerPointTextAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Parsing PowerPoint text...');
    try {
      const parsed = await buildTextSlidesFromPptx(file);
      const now = Date.now();
      const slides = parsed.slides;

      const importedItem: ServiceItem = {
        id: `${now}`,
        title: resolveImportedDeckTitle(parsed.suggestedTitle),
        type: ItemType.ANNOUNCEMENT,
        slides,
        theme: {
          backgroundUrl: DEFAULT_BACKGROUNDS[0],
          mediaType: 'image',
          fontFamily: 'sans-serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: 'large',
        },
      };

      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: slides.length, mode: 'text' });
      setImportTitle('Imported Lyrics');
      setImportLyrics('');
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      const message = error?.message || 'PowerPoint import failed.';
      setImportModalError(message);
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importPowerPointVisualAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Rendering slide visuals...');
    try {
      const converted = await buildVisualSlidesFromPptx(file, (status) => setImportDeckStatus(status));
      const now = Date.now();
      const slides = converted.slides;

      const importedItem: ServiceItem = {
        id: `${now}`,
        title: resolveImportedDeckTitle(converted.suggestedTitle),
        type: ItemType.MEDIA,
        slides,
        theme: {
          backgroundUrl: '',
          mediaType: 'image',
          fontFamily: 'sans-serif',
          textColor: '#ffffff',
          shadow: false,
          fontSize: 'medium',
        },
      };

      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: slides.length, mode: 'visual' });
      setImportTitle('Imported Lyrics');
      setImportLyrics('');
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      const message = error?.message || 'Visual PowerPoint import failed.';
      setImportModalError(message);
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importPowerPointVisualSlidesForSlideEditor = async (file: File): Promise<Slide[]> => {
    const visual = await buildVisualSlidesFromPptx(file);
    logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: visual.slides.length, mode: 'visual_slide_editor' });
    return visual.slides;
  };

  const importPowerPointTextSlidesForSlideEditor = async (file: File): Promise<Slide[]> => {
    const text = await buildTextSlidesFromPptx(file);
    logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: text.slides.length, mode: 'text_slide_editor' });
    return text.slides;
  };


  const addItem = (item: ServiceItem) => {
    pushHistory();
    setSchedule(prev => [...prev, item]);
    setSelectedItemId(item.id);
    logActivity(user?.uid, 'ADD_ITEM', { type: item.type, title: item.title });
  };

  const handleAIItemGenerated = (item: ServiceItem) => {
      const sentiment = analyzeSentimentContext(item.title + ' ' + (item.slides[0]?.content || ''));
      logActivity(user?.uid, 'AI_GENERATION', { sentiment, slideCount: item.slides.length, type: item.type });
      addItem(item);
  };

  const updateItem = (updatedItem: ServiceItem) => {
    pushHistory();
    setSchedule(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const removeItem = (id: string) => {
    pushHistory();
    logActivity(user?.uid, 'DELETE_ITEM', { itemId: id });
    const newSchedule = schedule.filter(i => i.id !== id);
    setSchedule(newSchedule);
    if (selectedItemId === id) setSelectedItemId(newSchedule[0]?.id || '');
  };

  const addEmptyItem = () => {
    const newItem: ServiceItem = {
      id: Date.now().toString(),
      title: "New Item",
      type: ItemType.ANNOUNCEMENT,
      slides: [],
      theme: { backgroundUrl: DEFAULT_BACKGROUNDS[2], fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' }
    };
    addItem(newItem);
  };

  const goLive = (item: ServiceItem, slideIndex: number = 0) => {
    if (!item || !Array.isArray(item.slides) || item.slides.length === 0) return;
    const boundedIndex = Math.max(0, Math.min(item.slides.length - 1, slideIndex));
    setActiveItemId(item.id);
    setActiveSlideIndex(boundedIndex);
    setBlackout(false);
    setIsPlaying(true);
    logActivity(user?.uid, 'PRESENTATION_START', { itemTitle: item.title });
  };

  const nextSlide = useCallback(() => {
    setBlackout((prev) => (prev ? false : prev));
    if (!activeItem) return;
    if (activeSlideIndex < activeItem.slides.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
    } else {
      const currentItemIdx = schedule.findIndex(i => i.id === activeItem.id);
      if (currentItemIdx < schedule.length - 1) {
        const nextItem = schedule[currentItemIdx + 1];
        if (!nextItem || !Array.isArray(nextItem.slides) || nextItem.slides.length === 0) return;
        setActiveItemId(nextItem.id);
        setActiveSlideIndex(0);
        setIsPlaying(true);
      }
    }
  }, [activeItem, activeSlideIndex, schedule]);

  const prevSlide = useCallback(() => {
    setBlackout((prev) => (prev ? false : prev));
    if (!activeItem) return;
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
    } else {
      const currentItemIdx = schedule.findIndex(i => i.id === activeItem.id);
      if (currentItemIdx > 0) {
        const prevItem = schedule[currentItemIdx - 1];
        if (!prevItem || !Array.isArray(prevItem.slides) || prevItem.slides.length === 0) return;
        setActiveItemId(prevItem.id);
        setActiveSlideIndex(prevItem.slides.length - 1);
        setIsPlaying(true);
      }
    }
  }, [activeItem, activeSlideIndex, schedule]);

  const triggerSeek = (seconds: number) => {
     setSeekAmount(seconds);
     setSeekCommand(Date.now());
  };

  const stopProgramVideo = useCallback(() => {
    setIsPlaying(false);
    // Large negative seek safely clamps to zero in the renderer.
    setSeekAmount(-86400);
    setSeekCommand(Date.now());
  }, []);

  const executeRemoteCommand = useCallback((command: RemoteCommand) => {
    if (command === 'NEXT') nextSlide();
    if (command === 'PREV') prevSlide();
    if (command === 'BLACKOUT') setBlackout((prev) => !prev);
    if (command === 'PLAY') setIsPlaying(true);
    if (command === 'PAUSE') setIsPlaying(false);
    if (command === 'STOP') stopProgramVideo();
    if (command === 'MUTE') setOutputMuted(true);
    if (command === 'UNMUTE') setOutputMuted(false);
  }, [nextSlide, prevSlide, stopProgramVideo]);

  const handleSaveSlideFromEditor = (slideToSave: Slide) => {
    if (!selectedItem) return;
    const slideExists = selectedItem.slides.find((entry) => entry.id === slideToSave.id);
    const nextSlides = slideExists
      ? selectedItem.slides.map((entry) => (entry.id === slideToSave.id ? slideToSave : entry))
      : [...selectedItem.slides, slideToSave];
    updateItem({ ...selectedItem, slides: nextSlides });
    setIsSlideEditorOpen(false);
  };

  const handleInsertSlidesFromEditor = (slidesToInsert: Slide[], replaceCurrentId?: string | null) => {
    if (!selectedItem || !slidesToInsert.length) return;
    const incoming = slidesToInsert.map((entry, idx) => ({
      ...entry,
      id: entry.id || `${Date.now()}-import-${idx + 1}`,
    }));

    const nextSlides = [...selectedItem.slides];
    if (replaceCurrentId) {
      const targetIndex = nextSlides.findIndex((entry) => entry.id === replaceCurrentId);
      if (targetIndex >= 0) {
        const [first, ...rest] = incoming;
        const replacement = { ...first, id: replaceCurrentId };
        nextSlides.splice(targetIndex, 1, replacement, ...rest);
      } else {
        nextSlides.push(...incoming);
      }
    } else {
      nextSlides.push(...incoming);
    }

    updateItem({ ...selectedItem, slides: nextSlides });
    setIsSlideEditorOpen(false);
  };

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide);
    setIsSlideEditorOpen(true);
  };

  const handleDeleteSlide = (slideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedItem) return;
    const newSlides = selectedItem.slides.filter(s => s.id !== slideId);
    updateItem({ ...selectedItem, slides: newSlides });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      if (isTypingTarget) return;
      if (isAIModalOpen || isSlideEditorOpen || isHelpOpen || isProfileOpen || isMotionLibOpen || isTemplateOpen || isLyricsImportOpen) return;
      if (viewMode !== 'PRESENTER') return;
      switch(e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); nextSlide(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prevSlide(); break;
        case 'b': setBlackout(prev => !prev); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, nextSlide, prevSlide, isAIModalOpen, isSlideEditorOpen, isHelpOpen, isProfileOpen, isMotionLibOpen, isTemplateOpen, isLyricsImportOpen]);




  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid) return;

    let unsubPlaylists = () => {};
    try {
      unsubPlaylists = subscribeToTeamPlaylists(
        user.uid,
        (data) => {
          const playlists = Array.isArray(data) ? (data as CloudPlaylistRecord[]) : [];
          setTeamPlaylists(playlists);

          if (hasHydratedCloudStateRef.current) return;
          hasHydratedCloudStateRef.current = true;
          setCloudBootstrapComplete(true);

          const preferred = playlists.find((entry) => entry.id === cloudPlaylistId) || playlists[0];
          if (!preferred) return;

          const localUpdatedAt = typeof initialSavedStateRef.current?.updatedAt === 'number'
            ? initialSavedStateRef.current.updatedAt
            : 0;

          const cloudUpdatedAt = typeof preferred.updatedAt === 'number' ? preferred.updatedAt : 0;
          if (localUpdatedAt > cloudUpdatedAt) return;

          if (Array.isArray(preferred.items) && preferred.items.length > 0) {
            const nextSchedule = preferred.items as ServiceItem[];
            setSchedule(nextSchedule);

            const preferredSelected = typeof preferred.selectedItemId === 'string' ? preferred.selectedItemId : '';
            const selectedExists = nextSchedule.some((item) => item.id === preferredSelected);
            setSelectedItemId(selectedExists ? preferredSelected : nextSchedule[0]?.id || '');

            const preferredActiveItemId = typeof preferred.activeItemId === 'string' ? preferred.activeItemId : null;
            const activeItem = preferredActiveItemId
              ? nextSchedule.find((item) => item.id === preferredActiveItemId)
              : null;
            if (activeItem) {
              const rawActiveIndex = typeof preferred.activeSlideIndex === 'number' ? preferred.activeSlideIndex : 0;
              const boundedIndex = Math.max(0, Math.min(activeItem.slides.length - 1, rawActiveIndex));
              setActiveItemId(activeItem.id);
              setActiveSlideIndex(activeItem.slides.length > 0 ? boundedIndex : -1);
            } else {
              setActiveItemId(null);
              setActiveSlideIndex(-1);
            }
          }

          const cloudSettings = sanitizeWorkspaceSettings(preferred.workspaceSettings);
          const localSettingsUpdatedAt = workspaceSettingsUpdatedAtRef.current;
          if (Object.keys(cloudSettings).length > 0 && cloudUpdatedAt >= localSettingsUpdatedAt) {
            workspaceSettingsUpdatedAtRef.current = cloudUpdatedAt;
            setWorkspaceSettings((prev) => ({ ...prev, ...cloudSettings }));
          }
        },
        (error) => {
          reportSyncFailure('playlist-subscribe', error, { teamId: user.uid });
          if (!hasHydratedCloudStateRef.current) {
            hasHydratedCloudStateRef.current = true;
            setCloudBootstrapComplete(true);
          }
        }
      );
    } catch (error) {
      reportSyncFailure('playlist-subscribe', error, { teamId: user.uid });
      if (!hasHydratedCloudStateRef.current) {
        hasHydratedCloudStateRef.current = true;
        setCloudBootstrapComplete(true);
      }
    }

    return () => {
      unsubPlaylists();
    };
  }, [user?.uid, cloudPlaylistId, reportSyncFailure]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid || !cloudBootstrapComplete) return;

    const unsubState = subscribeToState((data) => {
      if (!isRecord(data)) {
        reportSyncFailure('remote-snapshot-parse', new Error('Snapshot payload is not an object'));
        return;
      }

      const rawIncomingAt = data.remoteCommandAt;
      const incomingAt = typeof rawIncomingAt === 'number' && Number.isFinite(rawIncomingAt) ? rawIncomingAt : null;

      // First snapshot should only initialize marker to avoid replaying stale commands.
      if (!hasInitializedRemoteSnapshotRef.current) {
        hasInitializedRemoteSnapshotRef.current = true;
        lastRemoteCommandAtRef.current = incomingAt;
        return;
      }

      if (!incomingAt || incomingAt === lastRemoteCommandAtRef.current) return;
      lastRemoteCommandAtRef.current = incomingAt;

      const command = data.remoteCommand;
      if (!isRemoteCommand(command)) {
        reportSyncFailure('remote-command-parse', new Error('Unsupported remote command payload'), {
          command: String(command),
          remoteCommandAt: incomingAt,
        });
        return;
      }

      executeRemoteCommand(command);

    }, liveSessionId, (error) => {
      reportSyncFailure('remote-subscribe', error);
    });

    return () => {
      unsubState();
      hasInitializedRemoteSnapshotRef.current = false;
      lastRemoteCommandAtRef.current = null;
    };
  }, [user?.uid, cloudBootstrapComplete, executeRemoteCommand, liveSessionId, reportSyncFailure]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    let active = true;
    const pollServerCommands = async () => {
      const response = await fetchServerSessionState(workspaceId, liveSessionId);
      if (!active || !response?.state) return;
      const data = response.state;
      const rawIncomingAt = data.remoteCommandAt;
      const incomingAt = typeof rawIncomingAt === 'number' && Number.isFinite(rawIncomingAt) ? rawIncomingAt : null;
      if (!incomingAt || incomingAt === lastServerRemoteCommandAtRef.current) return;
      lastServerRemoteCommandAtRef.current = incomingAt;

      const command = data.remoteCommand;
      if (!isRemoteCommand(command)) return;
      executeRemoteCommand(command);
    };
    pollServerCommands();
    const id = window.setInterval(pollServerCommands, 650);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, liveSessionId, user?.uid, cloudBootstrapComplete, executeRemoteCommand]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    syncLiveState({
      activeItemId,
      activeSlideIndex,
      blackout,
      isPlaying,
      outputMuted,
      seekCommand,
      seekAmount,
      lowerThirdsEnabled,
      routingMode,
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [activeItemId, activeSlideIndex, blackout, isPlaying, outputMuted, seekCommand, seekAmount, lowerThirdsEnabled, routingMode, user?.uid, user?.email, allowedAdminEmails, syncLiveState, cloudBootstrapComplete]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    syncLiveState({
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [user?.uid, user?.email, allowedAdminEmails, syncLiveState, cloudBootstrapComplete]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let active = true;
    navigator.requestMIDIAccess().then((access) => {
      if (!active) return;
      const onMidiMessage = (event: any) => {
        const [status, note, velocity] = event.data || [];
        if ((status & 0xf0) !== 0x90 || velocity === 0) return;
        if (note === 60) nextSlide();
        if (note === 59) prevSlide();
        if (note === 58) setBlackout((prev) => !prev);
      };

      access.inputs.forEach((input) => {
        input.onmidimessage = onMidiMessage;
      });
    }).catch((error) => console.warn('MIDI unavailable', error));

    return () => {
      active = false;
    };
  }, [nextSlide, prevSlide]);

  useEffect(() => {
    if (!timerRunning) return;

    const id = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (timerMode === 'COUNTDOWN') {
          return prev - 1;
        }
        return prev + 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerRunning, timerMode]);

  useEffect(() => {
    if (!autoCueEnabled) return;
    if (viewMode !== 'PRESENTER') return;
    if (!activeItem) return;

    setAutoCueRemaining(autoCueSeconds);
    const id = window.setInterval(() => {
      setAutoCueRemaining((prev) => {
        if (prev <= 1) {
          nextSlide();
          return autoCueSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoCueEnabled, autoCueSeconds, viewMode, activeItemId, nextSlide, activeItem]);

  // ✅ Launch Output handler (opens window synchronously from user gesture — popup-safe)
  const handleToggleOutput = () => {
    if (!activeItem && selectedItem && selectedItem.slides.length > 0) {
      goLive(selectedItem, 0);
    } else if (activeItem && !activeSlide && activeItem.slides.length > 0) {
      goLive(activeItem, 0);
    }

    if (isOutputLive) {
      setIsOutputLive(false);
      try { outputWin?.close(); } catch {}
      setOutputWin(null);
      return;
    }

    const width = window.screen?.availWidth || 1280;
    const height = window.screen?.availHeight || 720;
    const w = window.open(
      obsOutputUrl,
      "LuminaOutput",
      `popup=yes,width=${width},height=${height},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes`
    );

    if (!w || w.closed || typeof w.closed === "undefined") {
      setPopupBlocked(true);
      setIsOutputLive(false);
      setOutputWin(null);
      return;
    }

    setPopupBlocked(false);
    setOutputWin(w);
    setIsOutputLive(true);
    try {
      w.focus();
      w.moveTo?.(0, 0);
      w.resizeTo?.(width, height);
    } catch {}
    try {
      const fsAttempt = w.document?.documentElement?.requestFullscreen?.();
      fsAttempt?.catch(() => {});
    } catch {}
  };

  useEffect(() => {
    if (!isOutputLive || !outputWin) return;
    const checkClosed = window.setInterval(() => {
      if (outputWin.closed) {
        setIsOutputLive(false);
        setOutputWin(null);
        window.clearInterval(checkClosed);
      }
    }, 500);
    return () => window.clearInterval(checkClosed);
  }, [isOutputLive, outputWin]);

  const handleToggleStageDisplay = () => {
    if (isStageDisplayLive) {
      setIsStageDisplayLive(false);
      try { stageWin?.close(); } catch {}
      setStageWin(null);
      return;
    }

    const initialHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lumina Stage Display</title>
    <style>
      body { margin: 0; padding: 0; background-color: black; overflow: hidden; }
      #output-root { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="output-root"></div>
  </body>
</html>`;

    const w = window.open(
      "",
      "LuminaStageDisplay",
      "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no"
    );

    if (!w || w.closed || typeof w.closed === "undefined") {
      setPopupBlocked(true);
      setIsStageDisplayLive(false);
      setStageWin(null);
      return;
    }

    try {
      w.document.open();
      w.document.write(initialHtml);
      w.document.close();
      w.document.title = "Lumina Stage Display";
    } catch (e) {
      console.error("Failed to initialize stage display window", e);
    }

    setPopupBlocked(false);
    setStageWin(w);
    setIsStageDisplayLive(true);
    try { w.focus(); } catch {}
  };

  if (authLoading) return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-xs animate-pulse">LOADING NEURAL HUB...</div>;

  // ROUTING: LANDING PAGE
  if (viewState === 'landing') {
      return <LandingPage onEnter={() => setViewState('studio')} onLogout={user ? handleLogout : undefined} isAuthenticated={!!user} hasSavedSession={hasSavedSession} />;
  }

  // ROUTING: LOGIN (If not authenticated and trying to enter)
  if (!user && viewState === 'studio') {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }
  
  const ScheduleList = () => (
    <div className="flex-1 overflow-y-auto bg-zinc-950">
      {teamPlaylists.length > 0 && (<div className="px-3 py-2 text-[10px] text-emerald-400 border-b border-zinc-900">Cloud Playlists Synced: {teamPlaylists.length}</div>)}
      {schedule.map((item, idx) => (
        <div key={item.id} className="flex flex-col border-b border-zinc-900">
            <div onClick={() => {
              setSelectedItemId(item.id);
              if (viewMode === 'PRESENTER') {
                setBlackout(false);
                if (Array.isArray(item.slides) && item.slides.length > 0) {
                  const currentIdx = activeItemId === item.id && activeSlideIndex >= 0 ? activeSlideIndex : 0;
                  goLive(item, currentIdx);
                }
              }
            }} className={`px-3 py-3 cursor-pointer flex items-center justify-between group transition-colors ${selectedItemId === item.id ? 'bg-zinc-900 border-l-2 border-l-blue-600' : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'} ${activeItemId === item.id ? 'bg-red-950/20' : ''}`}>
              <div className="flex flex-col truncate flex-1 min-w-0 pr-2">
                <span className={`font-medium text-sm truncate ${activeItemId === item.id ? 'text-red-500' : 'text-zinc-300'}`}>{item.title}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1 flex items-center gap-1">{item.type}</span>
              </div>
              <div className="flex gap-1 items-center">
                {activeItemId === item.id && <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2"></div>}
                {viewMode === 'BUILDER' ? (
                    <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-1 hover:text-red-400 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4" /></button>
                ) : (
                    <button onClick={(e) => { e.stopPropagation(); goLive(item); }} className={`p-1 transition-colors ${activeItemId === item.id ? 'text-red-500' : 'text-zinc-600 hover:text-white'}`}><PlayIcon className="w-4 h-4 fill-current" /></button>
                )}
              </div>
            </div>
            {selectedItemId === item.id && item.slides.length > 0 && (
                <div className="bg-zinc-950 border-b border-zinc-900">
                    {item.slides.map((slide, sIdx) => (
                        <div key={slide.id} className={`pl-8 pr-3 py-2 text-xs text-zinc-500 hover:text-zinc-200 cursor-pointer border-l-2 ${activeItemId === item.id && activeSlideIndex === sIdx ? 'text-red-400 font-bold border-l-red-600 bg-red-950/10' : 'border-l-transparent hover:bg-zinc-900/30'}`} onClick={(e) => { e.stopPropagation(); if (viewMode === 'PRESENTER') goLive(item, sIdx); }}>
                            <div className="flex justify-between items-center"><span className="truncate flex-1 font-mono text-[10px] opacity-80">{slide.label || `SLIDE ${sIdx + 1}`}</span>{activeItemId === item.id && activeSlideIndex === sIdx && <span className="text-[9px] uppercase tracking-widest text-red-600 font-bold">LIVE</span>}</div>
                            <div className="truncate opacity-70 mt-0.5 font-sans">{slide.content.substring(0,40)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      ))}
    </div>
  );

  // ROUTING: STUDIO (MAIN APP)
  return (
    <div className={`theme-${workspaceSettings.theme} flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] bg-zinc-950 text-zinc-200 font-sans selection:bg-blue-900 selection:text-white relative`}>
      <audio ref={antiSleepAudioRef} src={SILENT_AUDIO_B64} loop muted />
      {saveError && <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-4 py-2 rounded-sm shadow-xl z-50 flex items-center gap-3 text-xs font-bold animate-pulse"><span>⚠ STORAGE FULL: Changes are NOT saving.</span><button onClick={() => setSaveError(false)} className="hover:text-zinc-300">✕</button></div>}
      {syncIssue && <div className="absolute top-24 right-4 z-50 max-w-md bg-amber-950/90 border border-amber-800 text-amber-200 px-3 py-2 rounded-sm text-[11px]"><span className="font-bold">SYNC WARNING:</span> {syncIssue}</div>}
      {popupBlocked && <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4"><div className="bg-zinc-900 border border-red-500 p-6 max-w-md rounded-lg shadow-2xl text-center"><div className="text-red-500 mb-2"><MonitorIcon className="w-12 h-12 mx-auto" /></div><h2 className="text-xl font-bold text-white mb-2">Projection Blocked</h2><p className="text-zinc-400 text-sm mb-4">The browser blocked the projector window. Check address bar pop-up settings.</p><button onClick={() => { setPopupBlocked(false); setIsOutputLive(false); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold transition-colors">I Understand</button></div></div>}

      <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <div 
            onClick={() => setViewState('landing')}
            className="flex items-center gap-2 text-zinc-100 font-mono tracking-tighter text-lg font-bold cursor-pointer hover:opacity-80 transition-opacity"
          >
            LUMINA <span className="px-1.5 py-0.5 rounded-sm bg-zinc-900 text-[10px] text-zinc-500 border border-zinc-800">v2.1</span>
          </div>
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex gap-1 hidden md:flex">
            <button onClick={() => setViewMode('BUILDER')} className={`px-3 py-1 rounded-sm text-xs font-medium border ${viewMode === 'BUILDER' ? 'bg-zinc-900 text-white border-zinc-700' : 'text-zinc-500 border-transparent'}`}>BUILD</button>
            <button onClick={() => setViewMode('PRESENTER')} className={`px-3 py-1 rounded-sm text-xs font-medium border ${viewMode === 'PRESENTER' ? 'bg-zinc-900 text-white border-zinc-700' : 'text-zinc-500 border-transparent'}`}>PRESENT</button>
            <button onClick={rollbackLastChange} disabled={historyCount === 0} className="px-3 py-1 rounded-sm text-xs font-medium border border-zinc-700 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed">ROLLBACK</button>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-sm border border-zinc-800 text-zinc-400">SESSION {liveSessionId}</span>
            <span className={`px-2 py-0.5 rounded-sm border ${navigator.onLine ? 'border-emerald-900 text-emerald-400' : 'border-amber-900 text-amber-400'}`}>{navigator.onLine ? 'ONLINE' : 'OFFLINE'}</span>
            {syncPendingCount > 0 && <span className="px-2 py-0.5 rounded-sm border border-amber-900 text-amber-400">QUEUED {syncPendingCount}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setIsHelpOpen(true)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-sm"><HelpIcon className="w-4 h-4" /></button>
           <button onClick={() => setIsProfileOpen(true)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-sm"><Settings className="w-4 h-4" /></button>
           <button onClick={() => setWorkspaceSettings((prev) => ({ ...prev, machineMode: !prev.machineMode }))} className={`px-3 py-1.5 rounded-sm text-xs font-bold border ${workspaceSettings.machineMode ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>MACHINE</button>
           <button onClick={handleLogout} className="px-3 py-1.5 rounded-sm text-xs font-bold border bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white">LOGOUT</button>
           <button onClick={() => setIsAIModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-blue-900 rounded-sm text-xs"><SparklesIcon className="w-3 h-3" />AI ASSIST</button>
           <button onClick={handleToggleOutput} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold border ${isOutputLive ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}><MonitorIcon className="w-3 h-3" />{isOutputLive ? 'OUTPUT ACTIVE' : 'LAUNCH OUTPUT'}</button>
           <button onClick={handleToggleStageDisplay} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold border ${isStageDisplayLive ? 'bg-purple-950/30 text-purple-400 border-purple-900' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>STAGE DISPLAY</button>
           <button onClick={() => navigator.clipboard?.writeText(remoteControlUrl)} className="px-3 py-1.5 rounded-sm text-xs font-bold border bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white">COPY REMOTE URL</button>
        </div>
      </header>

      {/* MOBILE NAV BAR (Visible only on small screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around p-3 z-50">
         <button onClick={() => setViewMode('BUILDER')} className={`flex flex-col items-center gap-1 ${viewMode === 'BUILDER' ? 'text-white' : 'text-zinc-500'}`}><EditIcon className="w-5 h-5"/> <span className="text-[10px] font-bold">BUILD</span></button>
         <button onClick={() => setViewMode('PRESENTER')} className={`flex flex-col items-center gap-1 ${viewMode === 'PRESENTER' ? 'text-white' : 'text-zinc-500'}`}><PlayIcon className="w-5 h-5"/> <span className="text-[10px] font-bold">PRESENT</span></button>
         <button onClick={handleToggleOutput} className={`flex flex-col items-center gap-1 ${isOutputLive ? 'text-emerald-400' : 'text-zinc-500'}`}><MonitorIcon className="w-5 h-5"/> <span className="text-[10px] font-bold">OUTPUT</span></button>
      </div>

      <div className="flex-1 flex overflow-hidden mb-16 md:mb-0">
        {/* Sidebar with Tabs (Hidden on Mobile unless Builder Mode) */}
        <div className={`w-full md:w-64 bg-zinc-950 border-r border-zinc-900 flex-col shrink-0 ${viewMode === 'BUILDER' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex border-b border-zinc-900 bg-zinc-950">
             <button onClick={() => setActiveSidebarTab('SCHEDULE')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeSidebarTab === 'SCHEDULE' ? 'text-blue-500 border-blue-600 bg-zinc-900/50' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>Items</button>
             <button onClick={() => setActiveSidebarTab('AUDIO')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeSidebarTab === 'AUDIO' ? 'text-blue-500 border-blue-600 bg-zinc-900/50' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>Audio</button>
             <button onClick={() => setActiveSidebarTab('BIBLE')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeSidebarTab === 'BIBLE' ? 'text-blue-500 border-blue-600 bg-zinc-900/50' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}>Bible</button>
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeSidebarTab === 'SCHEDULE' ? (
               <>
                <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex justify-between items-center bg-zinc-950">
                  <span>Run Sheet</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setIsTemplateOpen(true)} className="px-1.5 py-0.5 text-[9px] border border-zinc-800 rounded-sm hover:text-white hover:border-zinc-600">TPL</button>
                    <button onClick={() => { setImportModalError(null); setImportDeckStatus(''); setIsLyricsImportOpen(true); }} className="px-1.5 py-0.5 text-[9px] border border-zinc-800 rounded-sm hover:text-white hover:border-zinc-600">LYR</button>
                    <button onClick={addEmptyItem} className="hover:text-white p-1 hover:bg-zinc-900 rounded-sm"><PlusIcon className="w-3 h-3" /></button>
                  </div>
                </div>
                <ScheduleList />
               </>
            ) : activeSidebarTab === 'AUDIO' ? (
                <AudioLibrary 
                    currentTrackId={currentTrack?.id || null}
                    isPlaying={isAudioPlaying}
                    progress={audioProgress}
                    onPlay={handlePlayTrack}
                    onToggle={toggleAudio}
                    onStop={stopAudio}
                    onVolumeChange={setAudioVolume}
                    volume={audioVolume}
                />
            ) : (
                <BibleBrowser 
                  onAddRequest={(item: ServiceItem) => {
                    addItem(item);
                    setActiveSidebarTab('SCHEDULE');
                  }}
                  onProjectRequest={(item: ServiceItem) => {
                    addItem(item);
                    goLive(item, 0);
                    setActiveSidebarTab('SCHEDULE');
                  }}
                />
            )}
          </div>
        </div>

        {/* ... (Existing Builder/Presenter Logic) ... */}
        {viewMode === 'BUILDER' ? (
          <div className="flex-1 flex bg-zinc-950 hidden md:flex">
             <div className="w-56 bg-zinc-900/30 border-r border-zinc-900 flex flex-col hidden lg:flex">
                <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex items-center">Library</div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {MOCK_SONGS.map((song, i) => (<div key={i} className="p-2 bg-zinc-900 rounded-sm cursor-pointer hover:bg-zinc-800 border border-zinc-800/50" onClick={() => setIsAIModalOpen(true)}><div className="font-bold text-xs text-zinc-300">{song.title}</div></div>))}
                </div>
             </div>
             <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden">
               {selectedItem ? (
                 <>
                   <ItemEditorPanel 
                      item={selectedItem} 
                      onUpdate={updateItem} 
                      onOpenLibrary={() => setIsMotionLibOpen(true)}
                   />
                   <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedItem.slides.map((slide, idx) => (
                              <div key={slide.id} className="group relative">
                                  <div className="aspect-video bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800 group-hover:border-blue-500/50 transition-all"><SlideRenderer slide={slide} item={selectedItem} fitContainer={true} isThumbnail={true} /></div>
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1"><button onClick={() => handleEditSlide(slide)} className="p-1 bg-zinc-900 border border-zinc-700 rounded-sm hover:text-blue-400 text-zinc-400"><EditIcon className="w-3 h-3"/></button><button onClick={(e) => handleDeleteSlide(slide.id, e)} className="p-1 bg-zinc-900 border border-zinc-700 rounded-sm hover:text-red-400 text-zinc-400"><TrashIcon className="w-3 h-3"/></button></div>
                              </div>
                          ))}
                           <button onClick={() => { setEditingSlide(null); setIsSlideEditorOpen(true); }} className="aspect-video border border-dashed border-zinc-800 rounded-sm flex flex-col items-center justify-center text-zinc-600 hover:text-zinc-400 bg-zinc-900/20"><PlusIcon className="w-6 h-6 mb-2" /><span className="text-xs font-medium uppercase tracking-wide">Add Slide</span></button>
                      </div>
                   </div>
                 </>
               ) : <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-xs uppercase">SELECT_ITEM_TO_EDIT</div>}
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row bg-black">
            <div className="flex-1 flex flex-col relative">
                <div className="flex-1 relative flex items-center justify-center bg-zinc-950 overflow-hidden border-r border-zinc-900">
                    <div className="aspect-video w-full max-w-4xl border border-zinc-800 bg-black relative group">
                         {blackout ? (<div className="w-full h-full bg-black flex items-center justify-center text-red-900 font-mono text-xs font-bold tracking-[0.2em]">BLACKOUT</div>) : (
                             <SlideRenderer slide={activeSlide} item={activeItem} isPlaying={isPlaying} seekCommand={seekCommand} seekAmount={seekAmount} isMuted={isPreviewMuted} lowerThirds={previewLowerThirds} />
                          )}
                         <div className="absolute top-0 left-0 bg-zinc-900 text-zinc-500 text-[9px] font-bold px-2 py-0.5 border-r border-b border-zinc-800 flex items-center gap-2 z-50 shadow-md">PREVIEW <button onClick={() => setIsPreviewMuted(!isPreviewMuted)} className={`ml-2 hover:text-white transition-colors ${isPreviewMuted ? 'text-red-400' : 'text-green-400'}`}>{isPreviewMuted ? <VolumeXIcon className="w-3 h-3" /> : <Volume2Icon className="w-3 h-3" />}</button></div>
                    </div>
                </div>
                <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-6 gap-4">
                    <div className="flex items-center gap-2"><button onClick={prevSlide} className="h-12 w-14 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center border border-zinc-700 active:scale-95 transition-transform"><ArrowLeftIcon className="w-5 h-5" /></button><button onClick={nextSlide} className="h-12 w-28 rounded-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold text-sm tracking-wide active:scale-95 transition-transform"><ArrowRightIcon className="w-5 h-5 mr-1" /> NEXT</button></div>
                    {isActiveVideo && (<div className="flex items-center gap-2 bg-zinc-950 rounded-sm p-1 border border-zinc-800"><button onClick={() => triggerSeek(-10)} className="p-2.5 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded-sm"><RewindIcon className="w-4 h-4"/></button><button onClick={() => setIsPlaying(!isPlaying)} className={`p-2.5 rounded-sm ${isPlaying ? 'bg-zinc-800 text-white' : 'bg-green-900/50 text-green-400'}`}>{isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 fill-current" />}</button><button onClick={() => triggerSeek(10)} className="p-2.5 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded-sm"><ForwardIcon className="w-4 h-4"/></button></div>)}
                    <div className="flex items-center gap-2">
                      <button onClick={() => { if (routingMode !== 'PROJECTOR') setLowerThirdsEnabled((prev) => !prev); }} title={routingMode === 'PROJECTOR' ? 'Projector mode keeps full-screen text (lower thirds disabled).' : 'Toggle lower thirds overlay'} className={`h-12 px-3 rounded-sm font-bold text-[10px] tracking-wider border ${previewLowerThirds ? 'bg-blue-950 text-blue-400 border-blue-900' : 'bg-zinc-950 text-zinc-400 border-zinc-800'} ${routingMode === 'PROJECTOR' ? 'opacity-60 cursor-not-allowed' : ''}`}>LOWER THIRDS</button>
                      <select value={routingMode} onChange={(e) => setRoutingMode(e.target.value as any)} className="h-12 px-2 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-sm">
                        <option value="PROJECTOR">Projector</option>
                        <option value="STREAM">Stream</option>
                        <option value="LOBBY">Lobby</option>
                      </select>
                      <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12">
                        <select value={timerMode} onChange={(e) => {
                          const mode = e.target.value as 'COUNTDOWN' | 'ELAPSED';
                          setTimerMode(mode);
                          setTimerRunning(false);
                          setTimerSeconds(mode === 'COUNTDOWN' ? timerDurationMin * 60 : 0);
                        }} className="bg-transparent text-zinc-300 text-[10px]">
                          <option value="COUNTDOWN">Countdown</option>
                          <option value="ELAPSED">Elapsed</option>
                        </select>
                        {timerMode === 'COUNTDOWN' && (
                          <input type="number" min={1} max={180} value={timerDurationMin} onChange={(e) => {
                            const value = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                            setTimerDurationMin(value);
                            if (!timerRunning) setTimerSeconds(value * 60);
                          }} className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200" />
                        )}
                        <div className={`text-[11px] font-mono w-14 text-center ${isTimerOvertime ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>{formatTimer(timerSeconds)}</div>
                        <button onClick={() => setTimerRunning((p) => !p)} className="text-[10px] px-2 py-1 bg-zinc-800 rounded">{timerRunning ? 'Pause' : 'Start'}</button>
                        <button onClick={() => {
                          setTimerRunning(false);
                          setTimerSeconds(timerMode === 'COUNTDOWN' ? timerDurationMin * 60 : 0);
                        }} className="text-[10px] px-2 py-1 bg-zinc-800 rounded">Reset</button>
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12">
                        <span className="text-[10px] text-zinc-400">Cue</span>
                        <input type="number" min={2} max={120} value={autoCueSeconds} onChange={(e) => {
                          const value = Math.max(2, Math.min(120, Number(e.target.value) || 2));
                          setAutoCueSeconds(value);
                          setAutoCueRemaining(value);
                        }} className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200" />
                        <button onClick={() => setAutoCueEnabled((p) => !p)} className={`text-[10px] px-2 py-1 rounded ${autoCueEnabled ? 'bg-cyan-900/40 text-cyan-300' : 'bg-zinc-800 text-zinc-300'}`}>{autoCueEnabled ? `On ${autoCueRemaining}s` : 'Off'}</button>
                      </div>
                      <button onClick={() => navigator.clipboard?.writeText(obsOutputUrl)} className="h-12 px-3 rounded-sm font-bold text-[10px] tracking-wider border bg-zinc-950 text-zinc-300 border-zinc-800 hover:text-white">COPY OBS URL</button>
                      <button onClick={() => setBlackout(!blackout)} className={`h-12 px-4 rounded-sm font-bold text-xs tracking-wider border active:scale-95 transition-all ${blackout ? 'bg-red-950 text-red-500 border-red-900' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'}`}>{blackout ? 'UNBLANK' : 'BLACKOUT'}</button>
                    </div>
                </div>
            </div>
            <div className={`w-full lg:w-72 bg-zinc-950 border-l border-zinc-900 flex flex-col h-64 lg:h-auto border-t lg:border-t-0 ${workspaceSettings.machineMode ? 'hidden' : 'hidden md:flex'}`}>
                <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-500 text-[10px] uppercase tracking-wider flex justify-between items-center bg-zinc-950"><span>Live Queue</span>{activeItem && <span className="text-red-500 animate-pulse">● LIVE</span>}</div>
                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 lg:grid-cols-2 gap-2 content-start scroll-smooth">
                    {activeItem?.slides.map((slide, idx) => (<div key={slide.id} ref={activeSlideIndex === idx ? activeSlideRef : null} onClick={() => { setActiveSlideIndex(idx); setBlackout(false); setIsPlaying(true); }} className={`cursor-pointer rounded-sm overflow-hidden border transition-all relative aspect-video ${activeSlideIndex === idx ? 'ring-2 ring-red-500 border-red-500 opacity-100' : 'border-zinc-800 opacity-50 hover:opacity-80'}`}><div className="absolute inset-0 pointer-events-none"><SlideRenderer slide={slide} item={activeItem} fitContainer={true} isThumbnail={true} /></div><div className="absolute bottom-0 left-0 right-0 bg-black/80 text-zinc-300 text-[9px] px-1 py-0.5 font-mono truncate border-t border-zinc-800">{idx + 1}. {slide.label}</div></div>))}
                    {!activeItem && <div className="col-span-3 lg:col-span-2 text-center text-zinc-700 text-xs font-mono py-10 uppercase">NO_ACTIVE_ITEM</div>}
                </div>
            </div>
          </div>
        )}
      </div>

      {isStageDisplayLive && (<OutputWindow
          externalWindow={stageWin}
          onClose={() => {
            setIsStageDisplayLive(false);
            setStageWin(null);
          }}
          onBlock={() => {
            setPopupBlocked(true);
            setIsStageDisplayLive(false);
            setStageWin(null);
          }}><StageDisplay currentSlide={activeSlide} nextSlide={nextSlidePreview} activeItem={activeItem} timerLabel="Pastor Timer" timerDisplay={formatTimer(timerSeconds)} timerMode={timerMode} isTimerOvertime={isTimerOvertime} profile={workspaceSettings.stageProfile} /></OutputWindow>)}
      {isTemplateOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-zinc-200 mb-1">Apply Service Template</h3>
            <p className="text-xs text-zinc-500 mb-4">Replaces the current run sheet.</p>
            <div className="grid grid-cols-1 gap-2 mb-4">
              <button onClick={() => applyTemplate('CLASSIC')} className="text-left px-3 py-2 border border-zinc-800 rounded hover:border-zinc-600"><div className="text-sm font-semibold">Classic Sunday</div><div className="text-[11px] text-zinc-500">Welcome + Worship + Message</div></button>
              <button onClick={() => applyTemplate('YOUTH')} className="text-left px-3 py-2 border border-zinc-800 rounded hover:border-zinc-600"><div className="text-sm font-semibold">Youth Night</div><div className="text-[11px] text-zinc-500">Countdown + Hype + Response</div></button>
              <button onClick={() => applyTemplate('PRAYER')} className="text-left px-3 py-2 border border-zinc-800 rounded hover:border-zinc-600"><div className="text-sm font-semibold">Prayer Service</div><div className="text-[11px] text-zinc-500">Reflection + Intercession</div></button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setIsTemplateOpen(false)} className="px-3 py-1.5 text-xs border border-zinc-700 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
      {isLyricsImportOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-zinc-200 mb-1">Import Lyrics</h3>
            <p className="text-xs text-zinc-500 mb-4">Paste lyrics with blank lines or import a PowerPoint deck as visual slides.</p>
            <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} className="w-full mb-3 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm" placeholder="Song title" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                <span className="font-semibold">Retain Exact Layout (.pptx Visual)</span>
                <input type="file" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="hidden" onChange={importPowerPointVisualAsItem} disabled={isImportingDeck} />
                <div className="text-[10px] text-zinc-500 mt-1">Keeps original PowerPoint design/background exactly. Requires backend + LibreOffice.</div>
              </label>
              <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                <span className="font-semibold">Use Lumina Theme (.pptx Text)</span>
                <input type="file" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="hidden" onChange={importPowerPointTextAsItem} disabled={isImportingDeck} />
                <div className="text-[10px] text-zinc-500 mt-1">Imports text/notes so you can style with Lumina backgrounds.</div>
              </label>
            </div>
            {importDeckStatus && <div className="mb-2 text-[11px] text-cyan-300 border border-cyan-900/60 bg-cyan-950/20 rounded px-3 py-2">{importDeckStatus}</div>}
            <textarea value={importLyrics} onChange={(e) => setImportLyrics(e.target.value)} className="w-full h-56 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono" placeholder={'Verse 1 line 1\nVerse 1 line 2\n\nChorus line 1\nChorus line 2'} />
            {importModalError && <div className="mt-2 text-xs text-red-400 border border-red-900/60 bg-red-950/30 rounded px-3 py-2">{importModalError}</div>}
            <div className="flex justify-between mt-4">
              <button onClick={() => { setIsLyricsImportOpen(false); setImportModalError(null); setImportDeckStatus(''); }} className="px-3 py-1.5 text-xs border border-zinc-700 rounded" disabled={isImportingDeck}>Cancel</button>
              <button onClick={importLyricsAsItem} className="px-4 py-1.5 text-xs font-bold bg-blue-600 rounded" disabled={isImportingDeck}>Import Lyrics</button>
            </div>
          </div>
        </div>
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIItemGenerated} />
      {isProfileOpen && <ProfileSettings onClose={() => setIsProfileOpen(false)} onSave={(settings) => setWorkspaceSettings((prev) => ({ ...prev, ...settings }))} onLogout={handleLogout} currentSettings={workspaceSettings} currentUser={user} />} {/* NEW */}
      {isMotionLibOpen && (
        <MotionLibrary 
            onClose={() => setIsMotionLibOpen(false)} 
            onSelect={(url, mediaType = 'video') => { 
                if (selectedItem) {
                    updateItem({ ...selectedItem, theme: { ...selectedItem.theme, backgroundUrl: url, mediaType } });
                    logActivity(user?.uid, 'UPDATE_THEME', { type: 'MOTION_BG', itemId: selectedItem.id, mediaType });
                }
                setIsMotionLibOpen(false); 
            }} 
        />
      )}
      <SlideEditorModal
        isOpen={isSlideEditorOpen}
        onClose={() => setIsSlideEditorOpen(false)}
        slide={editingSlide}
        onSave={handleSaveSlideFromEditor}
        onImportPowerPointVisual={importPowerPointVisualSlidesForSlideEditor}
        onImportPowerPointText={importPowerPointTextSlidesForSlideEditor}
        onInsertSlides={handleInsertSlidesFromEditor}
      />
    </div>
  );
}

export default App;
