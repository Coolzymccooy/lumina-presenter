
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
import { clearMediaCache } from './services/localMedia';
import { PlayIcon, PlusIcon, MonitorIcon, SparklesIcon, EditIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon, HelpIcon, VolumeXIcon, Volume2Icon, MusicIcon, BibleIcon, Settings } from './components/Icons'; // Added Settings Icon

// --- CONSTANTS ---
const STORAGE_KEY = 'lumina_session_v1';
const SETTINGS_KEY = 'lumina_workspace_settings_v1';
const LIVE_STATE_QUEUE_KEY = 'lumina_live_state_queue_v1';
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

  const [schedule, setSchedule] = useState<ServiceItem[]>(() => {
    const saved = getSavedState();
    return saved?.schedule || INITIAL_SCHEDULE;
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const saved = getSavedState();
    const savedSchedule = saved?.schedule || INITIAL_SCHEDULE;
    return saved?.selectedItemId || savedSchedule[0]?.id || '';
  });

  const [viewMode, setViewMode] = useState<'BUILDER' | 'PRESENTER'>(() => {
    const saved = getSavedState();
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
  const [isMotionLibOpen, setIsMotionLibOpen] = useState(false); // NEW
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isLyricsImportOpen, setIsLyricsImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('Imported Lyrics');
  const [importLyrics, setImportLyrics] = useState('');
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [autoCueEnabled, setAutoCueEnabled] = useState(false);
  const [autoCueSeconds, setAutoCueSeconds] = useState(7);
  const [autoCueRemaining, setAutoCueRemaining] = useState(7);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [isOutputLive, setIsOutputLive] = useState(false);
  const [isStageDisplayLive, setIsStageDisplayLive] = useState(false);
  const [lowerThirdsEnabled, setLowerThirdsEnabled] = useState(false);
  const [routingMode, setRoutingMode] = useState<'PROJECTOR' | 'STREAM' | 'LOBBY'>('PROJECTOR');
  const [teamPlaylists, setTeamPlaylists] = useState<any[]>([]);
  const [stageWin, setStageWin] = useState<Window | null>(null);
  const [timerMode, setTimerMode] = useState<'COUNTDOWN' | 'ELAPSED'>('COUNTDOWN');
  const [timerDurationMin, setTimerDurationMin] = useState(35);
  const [timerSeconds, setTimerSeconds] = useState(35 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(() => {
    const saved = getSavedState();
    return saved?.activeItemId || null;
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(() => {
    const saved = getSavedState();
    return saved?.activeSlideIndex ?? -1;
  });

  const [blackout, setBlackout] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [seekCommand, setSeekCommand] = useState<number | null>(null);
  const [seekAmount, setSeekAmount] = useState<number>(0);

  // --- AUDIO SOUNDTRACK STATE ---
  const [currentTrack, setCurrentTrack] = useState<GospelTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSlideRef = useRef<HTMLDivElement>(null);
  const antiSleepAudioRef = useRef<HTMLAudioElement>(null);
  const hasInitializedRemoteSnapshotRef = useRef(false);
  const lastRemoteCommandAtRef = useRef<number | null>(null);
  const lastSyncErrorRef = useRef<{ key: string; at: number } | null>(null);
  const historyRef = useRef<Array<{ schedule: ServiceItem[]; selectedItemId: string; at: number }>>([]);
  const [historyCount, setHistoryCount] = useState(0);
  type RemoteCommand = 'NEXT' | 'PREV' | 'BLACKOUT';
  const isRemoteCommand = (command: unknown): command is RemoteCommand =>
    command === 'NEXT' || command === 'PREV' || command === 'BLACKOUT';
  const isRecord = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

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

  const enqueueLiveState = useCallback((payload: any) => {
    try {
      const existing = parseJson<any[]>(localStorage.getItem(LIVE_STATE_QUEUE_KEY), []);
      existing.push({ sessionId: liveSessionId, payload, at: Date.now() });
      localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(existing));
      setSyncPendingCount(existing.length);
    } catch (error) {
      console.warn('Failed to queue live state', error);
      reportSyncFailure('queue', error, { queueOp: 'enqueue' });
    }
  }, [liveSessionId, reportSyncFailure]);

  const flushLiveStateQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const queued = parseJson<Array<{ sessionId: string; payload: any; at: number }>>(localStorage.getItem(LIVE_STATE_QUEUE_KEY), []);
      if (!queued.length) {
        setSyncPendingCount(0);
        return;
      }
      const failed: typeof queued = [];
      for (const entry of queued) {
        const ok = await updateLiveState(entry.payload, entry.sessionId || liveSessionId);
        if (!ok) failed.push(entry);
      }
      localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(failed));
      setSyncPendingCount(failed.length);
      if (!failed.length) setSyncIssue(null);
    } catch (error) {
      console.warn('Failed to flush queued live state', error);
      reportSyncFailure('flush', error, { queueOp: 'flush' });
    }
  }, [liveSessionId, reportSyncFailure]);

  const syncLiveState = useCallback(async (payload: any) => {
    if (!isFirebaseConfigured() || !user?.uid) return;
    if (!navigator.onLine) {
      enqueueLiveState(payload);
      return;
    }
    const ok = await updateLiveState(payload, liveSessionId);
    if (!ok) {
      reportSyncFailure('live-update', new Error('updateLiveState returned false'));
      enqueueLiveState(payload);
    } else {
      setSyncIssue(null);
    }
  }, [user?.uid, liveSessionId, enqueueLiveState, reportSyncFailure]);

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
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setWorkspaceSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load workspace settings', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(workspaceSettings));
    document.documentElement.dataset.theme = workspaceSettings.theme;
  }, [workspaceSettings]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIVE_STATE_QUEUE_KEY);
      const queued = raw ? JSON.parse(raw) : [];
      setSyncPendingCount(Array.isArray(queued) ? queued.length : 0);
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
    const saveData = { schedule, selectedItemId, viewMode, activeItemId, activeSlideIndex };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      setSaveError(false);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') setSaveError(true);
    }
  }, [schedule, selectedItemId, viewMode, activeItemId, activeSlideIndex, user]);



  useEffect(() => {
    if (!user?.uid) return;
    syncLiveState({
      scheduleSnapshot: schedule.slice(0, 20),
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
    (async () => {
      try {
        await upsertTeamPlaylist(user.uid, 'default-playlist', {
          title: 'Default Playlist',
          items: schedule,
        });
      } catch (error) {
        reportSyncFailure('playlist-upsert', error, { itemCount: schedule.length });
      }
    })();
  }, [schedule, user?.uid, user?.email, allowedAdminEmails, syncLiveState, reportSyncFailure]);

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
  const nextSlidePreview = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex + 1] || null : null;
  const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
  const routedItem = routingMode === 'LOBBY' ? lobbyItem : activeItem;
  const routedSlide = routingMode === 'LOBBY' ? lobbyItem?.slides?.[0] || activeSlide : activeSlide;
  const isActiveVideo = activeSlide && (activeSlide.mediaType === 'video' || (!activeSlide.mediaType && activeItem?.theme.mediaType === 'video'));
  const formatTimer = (total: number) => {
    const safe = Math.max(0, total);
    const mm = Math.floor(safe / 60).toString().padStart(2, '0');
    const ss = Math.floor(safe % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };
  const obsOutputUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/output?session=${encodeURIComponent(liveSessionId)}`
    : `/output?session=${encodeURIComponent(liveSessionId)}`;
  const remoteControlUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/remote?session=${encodeURIComponent(liveSessionId)}`
    : `/remote?session=${encodeURIComponent(liveSessionId)}`;
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

      const samples: Array<unknown> = ['NEXT', 'PREV', 'BLACKOUT', 'SKIP', null, 2];
      const marks = samples.map((sample) => isRemoteCommand(sample));
      const remoteGuardOk = marks[0] && marks[1] && marks[2] && !marks[3] && !marks[4] && !marks[5];
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
      if (isAIModalOpen || isSlideEditorOpen || isHelpOpen) return;
      if (viewMode !== 'PRESENTER') return;
      switch(e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); nextSlide(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prevSlide(); break;
        case 'b': setBlackout(prev => !prev); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, nextSlide, prevSlide, isAIModalOpen, isSlideEditorOpen, isHelpOpen]);




  useEffect(() => {
    if (!isFirebaseConfigured()) return;

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

      if (command === 'NEXT') nextSlide();
      if (command === 'PREV') prevSlide();
      if (command === 'BLACKOUT') setBlackout((prev) => !prev);

    }, liveSessionId, (error) => {
      reportSyncFailure('remote-subscribe', error);
    });

    const teamId = user?.uid || 'default-team';
    let unsubPlaylists = () => {};
    try {
      unsubPlaylists = subscribeToTeamPlaylists(teamId, (data) => {
        setTeamPlaylists(Array.isArray(data) ? data : []);
      });
    } catch (error) {
      reportSyncFailure('playlist-subscribe', error, { teamId });
    }
    return () => {
      unsubState();
      unsubPlaylists();

      hasInitializedRemoteSnapshotRef.current = false;
      lastRemoteCommandAtRef.current = null;


    };
  }, [user?.uid, nextSlide, prevSlide, liveSessionId, reportSyncFailure]);

  useEffect(() => {
    if (!user?.uid) return;
    syncLiveState({
      activeItemId,
      activeSlideIndex,
      blackout,
      lowerThirdsEnabled,
      routingMode,
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [activeItemId, activeSlideIndex, blackout, lowerThirdsEnabled, routingMode, user?.uid, user?.email, allowedAdminEmails, syncLiveState]);

  useEffect(() => {
    if (!user?.uid) return;
    syncLiveState({
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [user?.uid, user?.email, allowedAdminEmails, syncLiveState]);

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
          return prev > 0 ? prev - 1 : 0;
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
    if (!activeSlide && selectedItem && selectedItem.slides.length > 0) {
      goLive(selectedItem, 0);
    }

    // Turn OFF
    if (isOutputLive) {
      setIsOutputLive(false);
      try { outputWin?.close(); } catch {}
      setOutputWin(null);
      return;
    }

    // Turn ON: open immediately (must happen inside click handler to avoid popup blockers)
    // Open a same-origin blank window and inject shell HTML (avoids blob: URL display).
    const initialHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lumina Output (Projector)</title>
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
      "LuminaOutput",
      "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no"
    );

    if (!w || w.closed || typeof w.closed === "undefined") {
      setPopupBlocked(true);
      setIsOutputLive(false);
      setOutputWin(null);
      return;
    }

    try {
      w.document.open();
      w.document.write(initialHtml);
      w.document.close();
      w.document.title = "Lumina Output (Projector)";
    } catch (e) {
      console.error("Failed to initialize output window", e);
    }

    setPopupBlocked(false);
    setOutputWin(w);
    setIsOutputLive(true);
    try { w.focus(); } catch {}
  };

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
            <div onClick={() => setSelectedItemId(item.id)} className={`px-3 py-3 cursor-pointer flex items-center justify-between group transition-colors ${selectedItemId === item.id ? 'bg-zinc-900 border-l-2 border-l-blue-600' : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'} ${activeItemId === item.id ? 'bg-red-950/20' : ''}`}>
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
                    <button onClick={() => setIsLyricsImportOpen(true)} className="px-1.5 py-0.5 text-[9px] border border-zinc-800 rounded-sm hover:text-white hover:border-zinc-600">LYR</button>
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
                             <SlideRenderer slide={activeSlide} item={activeItem} isPlaying={isPlaying} seekCommand={seekCommand} seekAmount={seekAmount} isMuted={isPreviewMuted} lowerThirds={lowerThirdsEnabled} />
                         )}
                         <div className="absolute top-0 left-0 bg-zinc-900 text-zinc-500 text-[9px] font-bold px-2 py-0.5 border-r border-b border-zinc-800 flex items-center gap-2 z-50 shadow-md">PREVIEW <button onClick={() => setIsPreviewMuted(!isPreviewMuted)} className={`ml-2 hover:text-white transition-colors ${isPreviewMuted ? 'text-red-400' : 'text-green-400'}`}>{isPreviewMuted ? <VolumeXIcon className="w-3 h-3" /> : <Volume2Icon className="w-3 h-3" />}</button></div>
                    </div>
                </div>
                <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-6 gap-4">
                    <div className="flex items-center gap-2"><button onClick={prevSlide} className="h-12 w-14 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center border border-zinc-700 active:scale-95 transition-transform"><ArrowLeftIcon className="w-5 h-5" /></button><button onClick={nextSlide} className="h-12 w-28 rounded-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold text-sm tracking-wide active:scale-95 transition-transform"><ArrowRightIcon className="w-5 h-5 mr-1" /> NEXT</button></div>
                    {isActiveVideo && (<div className="flex items-center gap-2 bg-zinc-950 rounded-sm p-1 border border-zinc-800"><button onClick={() => triggerSeek(-10)} className="p-2.5 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded-sm"><RewindIcon className="w-4 h-4"/></button><button onClick={() => setIsPlaying(!isPlaying)} className={`p-2.5 rounded-sm ${isPlaying ? 'bg-zinc-800 text-white' : 'bg-green-900/50 text-green-400'}`}>{isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 fill-current" />}</button><button onClick={() => triggerSeek(10)} className="p-2.5 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded-sm"><ForwardIcon className="w-4 h-4"/></button></div>)}
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLowerThirdsEnabled((prev) => !prev)} className={`h-12 px-3 rounded-sm font-bold text-[10px] tracking-wider border ${lowerThirdsEnabled ? 'bg-blue-950 text-blue-400 border-blue-900' : 'bg-zinc-950 text-zinc-400 border-zinc-800'}`}>LOWER THIRDS</button>
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
                        <div className="text-[11px] font-mono text-cyan-300 w-12 text-center">{formatTimer(timerSeconds)}</div>
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

      {isOutputLive && (<OutputWindow
          externalWindow={outputWin}
          onClose={() => {
            setIsOutputLive(false);
            setOutputWin(null);
          }}
          onBlock={() => {
            setPopupBlocked(true);
            setIsOutputLive(false);
            setOutputWin(null);
          }}>{blackout ? (<div className="w-full h-full bg-black cursor-none"></div>) : (<SlideRenderer slide={routedSlide || activeSlide} item={routedItem} fitContainer={true} isPlaying={isPlaying} seekCommand={seekCommand} seekAmount={seekAmount} isMuted={false} isProjector={true} lowerThirds={lowerThirdsEnabled} />)}</OutputWindow>)}
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
          }}><StageDisplay currentSlide={activeSlide} nextSlide={nextSlidePreview} activeItem={activeItem} timerLabel="Pastor Timer" timerDisplay={formatTimer(timerSeconds)} timerMode={timerMode} profile={workspaceSettings.stageProfile} /></OutputWindow>)}
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
            <p className="text-xs text-zinc-500 mb-4">Separate slide chunks with a blank line.</p>
            <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} className="w-full mb-3 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm" placeholder="Song title" />
            <textarea value={importLyrics} onChange={(e) => setImportLyrics(e.target.value)} className="w-full h-56 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono" placeholder={'Verse 1 line 1\nVerse 1 line 2\n\nChorus line 1\nChorus line 2'} />
            <div className="flex justify-between mt-4">
              <button onClick={() => setIsLyricsImportOpen(false)} className="px-3 py-1.5 text-xs border border-zinc-700 rounded">Cancel</button>
              <button onClick={importLyricsAsItem} className="px-4 py-1.5 text-xs font-bold bg-blue-600 rounded">Import</button>
            </div>
          </div>
        </div>
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIItemGenerated} />
      {isProfileOpen && <ProfileSettings onClose={() => setIsProfileOpen(false)} onSave={(settings) => setWorkspaceSettings((prev) => ({ ...prev, ...settings }))} onLogout={handleLogout} currentSettings={workspaceSettings} />} {/* NEW */}
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
      <SlideEditorModal isOpen={isSlideEditorOpen} onClose={() => setIsSlideEditorOpen(false)} slide={editingSlide} onSave={(slide) => { if (!selectedItem) return; const slideExists = selectedItem.slides.find(s => s.id === slide.id); let newSlides = slideExists ? selectedItem.slides.map(s => s.id === slide.id ? slide : s) : [...selectedItem.slides, slide]; updateItem({ ...selectedItem, slides: newSlides }); setIsSlideEditorOpen(false); }} />
    </div>
  );
}

export default App;
