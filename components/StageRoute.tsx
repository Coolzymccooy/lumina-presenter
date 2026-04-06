import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../services/firebase';
import { fetchServerSessionState, fetchSessionConnections, getOrCreateConnectionClientId, heartbeatSessionConnection, saveServerSessionState, saveWorkspaceSettings } from '../services/serverApi';
import { AudienceDisplayState, ServiceItem, StageAlertLayout, StageAlertState, StageAutoAdvanceConfig, StageFlowLayout, StageMessageCategory, StageMessageCenterState, StageSttState, StageTimerFlashColor, StageTimerFlashState, StageTimerLayout } from '../types';
import { HoldScreen } from './presenter/HoldScreen';
import { LoginScreen } from './LoginScreen';
import { StageDisplay } from './StageDisplay';
import type { SlideBrandingConfig } from './SlideBrandingOverlay';

const STORAGE_KEY = 'lumina_session_v1';

type LocalStageState = {
  schedule?: ServiceItem[];
  activeItemId?: string | null;
  activeSlideIndex?: number;
  blackout?: boolean;
  holdScreenMode?: 'none' | 'clear' | 'logo';
  audienceDisplay?: AudienceDisplayState;
  stageAlert?: StageAlertState;
  stageMessageCenter?: StageMessageCenterState;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
  timerSeconds?: number;
  timerDurationSec?: number;
  timerCueSpeaker?: string;
  timerCueAmberPercent?: number;
  timerCueRedPercent?: number;
  stageTimerFlash?: StageTimerFlashState;
  workspaceSettings?: {
    stageProfile?: 'classic' | 'compact' | 'high_contrast';
    stageTimerLayout?: StageTimerLayout;
    stageAlertLayout?: StageAlertLayout;
    stageFlowLayout?: StageFlowLayout;
    churchName?: string;
    slideBrandingEnabled?: boolean;
    slideBrandingSeriesLabel?: string;
    slideBrandingStyle?: 'minimal' | 'bold' | 'frosted';
    slideBrandingOpacity?: number;
  };
  updatedAt?: number;
};

type EffectiveStageState = {
  item: ServiceItem | null;
  slide: ServiceItem['slides'][number] | null;
  nextSlide: ServiceItem['slides'][number] | null;
  audienceOverlay?: AudienceDisplayState;
  stageAlert?: StageAlertState;
  stageMessageCenter?: StageMessageCenterState;
  blackout: boolean;
  holdScreenMode: 'none' | 'clear' | 'logo';
  churchName: string;
  timerMode: 'COUNTDOWN' | 'ELAPSED';
  timerSeconds: number;
  timerDurationSec: number;
  timerCueSpeaker: string;
  timerCueAmberPercent: number;
  timerCueRedPercent: number;
  stageTimerFlash: StageTimerFlashState;
  stageProfile: 'classic' | 'compact' | 'high_contrast';
  stageTimerLayout?: StageTimerLayout;
  stageAlertLayout?: StageAlertLayout;
  stageFlowLayout: StageFlowLayout;
  branding: SlideBrandingConfig;
  updatedAt: number;
  hasRenderable: boolean;
};

const VALID_FLASH_COLORS: StageTimerFlashColor[] = ['white', 'amber', 'red', 'cyan'];

const readLocalState = (): LocalStageState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LocalStageState;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeLocalStageWorkspaceSettings = (updates: Partial<NonNullable<LocalStageState['workspaceSettings']>>): LocalStageState => {
  const current = readLocalState();
  const next: LocalStageState = {
    ...current,
    workspaceSettings: {
      ...(current.workspaceSettings || {}),
      ...updates,
    },
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

const sanitizeStageMessageCenter = (value: unknown): StageMessageCenterState | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const queue = Array.isArray(raw.queue)
    ? raw.queue
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        const msg = entry as Record<string, unknown>;
        const text = typeof msg.text === 'string' ? msg.text.trim() : '';
        if (!text) return null;
        return {
          id: typeof msg.id === 'string' && msg.id.trim() ? msg.id.trim() : `msg-${Date.now().toString(36)}`,
          category: (msg.category === 'timing' || msg.category === 'logistics' ? msg.category : 'urgent') as StageMessageCategory,
          text,
          priority: (msg.priority === 'high' ? 'high' : 'normal') as 'high' | 'normal',
          target: 'stage_only' as const,
          createdAt: typeof msg.createdAt === 'number' && Number.isFinite(msg.createdAt) ? msg.createdAt : Date.now(),
          author: typeof msg.author === 'string' && msg.author.trim() ? msg.author.trim() : null,
          templateKey: typeof msg.templateKey === 'string' && msg.templateKey.trim() ? msg.templateKey.trim() : undefined,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    : [];
  const activeMessageId = typeof raw.activeMessageId === 'string' && queue.some((entry) => entry.id === raw.activeMessageId)
    ? raw.activeMessageId
    : (queue[0]?.id || null);
  const lastSentAt = typeof raw.lastSentAt === 'number' && Number.isFinite(raw.lastSentAt)
    ? raw.lastSentAt
    : (queue[0]?.createdAt || 0);
  return {
    queue,
    activeMessageId,
    lastSentAt,
  };
};

const sanitizeStageTimerFlash = (value: unknown): StageTimerFlashState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { active: false, color: 'white', updatedAt: 0 };
  }
  const raw = value as Record<string, unknown>;
  const color = typeof raw.color === 'string' && VALID_FLASH_COLORS.includes(raw.color as StageTimerFlashColor)
    ? raw.color as StageTimerFlashColor
    : 'white';
  return {
    active: !!raw.active,
    color,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
};

const sanitizeHoldScreenMode = (value: unknown): 'none' | 'clear' | 'logo' => (
  value === 'clear' || value === 'logo' ? value : 'none'
);

export const StageRoute: React.FC = () => {
  const getRouteParams = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = (searchParams.get('session') || '').trim();
    const fromSearchWorkspace = (searchParams.get('workspace') || '').trim();

    const hash = window.location.hash || '';
    const queryStart = hash.indexOf('?');
    let fromHash = '';
    let fromHashWorkspace = '';
    if (queryStart >= 0) {
      const hashParams = new URLSearchParams(hash.slice(queryStart + 1));
      fromHash = (hashParams.get('session') || '').trim();
      fromHashWorkspace = (hashParams.get('workspace') || '').trim();
    }

    return {
      sessionId: fromSearch || fromHash || 'live',
      workspaceId: fromSearchWorkspace || fromHashWorkspace || 'default-workspace',
      hasExplicitWorkspace: !!(fromSearchWorkspace || fromHashWorkspace),
    };
  };

  const [{ sessionId, workspaceId, hasExplicitWorkspace }] = useState(getRouteParams);
  const stageClientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, sessionId, 'stage'),
    [workspaceId, sessionId]
  );

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>({});
  const [localState, setLocalState] = useState<LocalStageState>(() => readLocalState());
  const [serverState, setServerState] = useState<Record<string, any> | null>(null);
  const [stableEffective, setStableEffective] = useState<EffectiveStageState | null>(null);
  const localStateRawRef = useRef<string | null>(null);
  const pendingWorkspaceLayoutRef = useRef<Partial<NonNullable<LocalStageState['workspaceSettings']>>>({});
  const workspaceLayoutSaveTimeoutRef = useRef<number | null>(null);

  // ── Tier 2+3 state ────────────────────────────────────────────────────────
  const [operatorCount, setOperatorCount] = useState(1);
  const [autoAdvance, setAutoAdvance] = useState<StageAutoAdvanceConfig>({ enabled: false, delaySeconds: 10 });
  const [showSttPanel, setShowSttPanel] = useState(false);
  const [sttState, setSttState] = useState<StageSttState>({
    isRecording: false,
    transcript: '',
    interimText: '',
    lastUpdatedAt: 0,
  });
  const sttRecognitionRef = useRef<any>(null);
  const canUseServerWorkspace = useMemo(
    () => !!workspaceId && (hasExplicitWorkspace || !!user?.uid),
    [workspaceId, hasExplicitWorkspace, user?.uid]
  );

  const persistWorkspaceLayoutsLocally = useCallback((updates: Partial<NonNullable<LocalStageState['workspaceSettings']>>) => {
    try {
      const next = writeLocalStageWorkspaceSettings(updates);
      localStateRawRef.current = JSON.stringify(next);
      setLocalState(next);
      setServerState((prev) => prev ? ({
        ...prev,
        workspaceSettings: {
          ...(prev.workspaceSettings || {}),
          ...updates,
        },
        updatedAt: Date.now(),
      }) : prev);
    } catch (error) {
      console.warn('Failed to persist stage layout locally.', error);
    }
  }, []);

  const queueWorkspaceLayoutSave = useCallback((updates: Partial<NonNullable<LocalStageState['workspaceSettings']>>) => {
    pendingWorkspaceLayoutRef.current = {
      ...pendingWorkspaceLayoutRef.current,
      ...updates,
    };
    if (workspaceLayoutSaveTimeoutRef.current !== null) {
      window.clearTimeout(workspaceLayoutSaveTimeoutRef.current);
    }
    workspaceLayoutSaveTimeoutRef.current = window.setTimeout(async () => {
      const nextSettings = pendingWorkspaceLayoutRef.current;
      pendingWorkspaceLayoutRef.current = {};
      workspaceLayoutSaveTimeoutRef.current = null;
      if (!user || !canUseServerWorkspace || Object.keys(nextSettings).length === 0) return;
      try {
        await saveWorkspaceSettings(workspaceId, user, nextSettings);
      } catch (error) {
        console.warn('Failed to persist stage layout to workspace settings.', error);
      }
    }, 420);
  }, [canUseServerWorkspace, user, workspaceId]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const getActiveSlideIndex = useCallback(() => {
    const src = serverState || liveState || {};
    const idx = typeof src?.activeSlideIndex === 'number' ? src.activeSlideIndex : 0;
    return Math.max(0, idx);
  }, [serverState, liveState]);

  const getActiveItemSlideCount = useCallback(() => {
    const src = serverState || liveState || {};
    const schedule: ServiceItem[] = Array.isArray(src?.scheduleSnapshot)
      ? src.scheduleSnapshot
      : (Array.isArray(src?.schedule) ? src.schedule : []);
    const activeItemId = typeof src?.activeItemId === 'string' ? src.activeItemId : null;
    const item = activeItemId ? schedule.find((s) => s.id === activeItemId) : null;
    return item?.slides?.length ?? 0;
  }, [serverState, liveState]);

  const handleNextSlide = useCallback(async () => {
    if (!user || !canUseServerWorkspace) return;
    const current = getActiveSlideIndex();
    const total = getActiveItemSlideCount();
    if (current + 1 >= total) return;
    try {
      await saveServerSessionState(workspaceId, sessionId, user, { activeSlideIndex: current + 1, updatedAt: Date.now() });
    } catch (err) {
      console.warn('Stage: failed to advance slide', err);
    }
  }, [user, canUseServerWorkspace, workspaceId, sessionId, getActiveSlideIndex, getActiveItemSlideCount]);

  const handlePrevSlide = useCallback(async () => {
    if (!user || !canUseServerWorkspace) return;
    const current = getActiveSlideIndex();
    if (current <= 0) return;
    try {
      await saveServerSessionState(workspaceId, sessionId, user, { activeSlideIndex: current - 1, updatedAt: Date.now() });
    } catch (err) {
      console.warn('Stage: failed to go back slide', err);
    }
  }, [user, canUseServerWorkspace, workspaceId, sessionId, getActiveSlideIndex]);

  const handleItemSelect = useCallback(async (itemId: string) => {
    if (!user || !canUseServerWorkspace) return;
    try {
      await saveServerSessionState(workspaceId, sessionId, user, {
        activeItemId: itemId,
        activeSlideIndex: 0,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Stage: failed to select item', err);
    }
  }, [user, canUseServerWorkspace, workspaceId, sessionId]);

  // ── STT helpers ───────────────────────────────────────────────────────────
  const handleSttToggleRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Stage: SpeechRecognition API not available in this browser.');
      return;
    }
    if (sttState.isRecording) {
      sttRecognitionRef.current?.stop();
      setSttState((prev) => ({ ...prev, isRecording: false, interimText: '', lastUpdatedAt: Date.now() }));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setSttState((prev) => ({
        ...prev,
        transcript: prev.transcript + final,
        interimText: interim,
        lastUpdatedAt: Date.now(),
      }));
    };
    recognition.onerror = () => {
      setSttState((prev) => ({ ...prev, isRecording: false, interimText: '' }));
    };
    recognition.onend = () => {
      setSttState((prev) => ({ ...prev, isRecording: false, interimText: '' }));
    };
    sttRecognitionRef.current = recognition;
    recognition.start();
    setSttState((prev) => ({ ...prev, isRecording: true, lastUpdatedAt: Date.now() }));
  }, [sttState.isRecording]);

  // ── Keyboard shortcuts handler — Tier 2 ──────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key.toLowerCase() === 'b') {
        // Blackout is managed by the presenter; stage view can show it but not toggle
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNextSlide, handlePrevSlide]);

  // Cleanup STT on unmount
  useEffect(() => () => {
    sttRecognitionRef.current?.stop();
  }, []);

  // ── Operator count polling — Tier 3 ──────────────────────────────────────
  useEffect(() => {
    if (!canUseServerWorkspace) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetchSessionConnections(workspaceId, sessionId);
        if (!active || !res?.ok) return;
        const stageCount = (res.counts?.byRole?.['stage'] || 0) + (res.counts?.byRole?.['controller'] || 0);
        setOperatorCount(Math.max(1, stageCount));
      } catch {
        // non-fatal
      }
    };
    poll();
    const id = window.setInterval(poll, 8000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, sessionId, canUseServerWorkspace]);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToState((data) => setLiveState(data), sessionId);
  }, [user, sessionId]);

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === localStateRawRef.current) return;
        localStateRawRef.current = raw;
        if (!raw) {
          setLocalState({});
          return;
        }
        const parsed = JSON.parse(raw);
        setLocalState(parsed && typeof parsed === 'object' ? parsed as LocalStageState : {});
      } catch {
        setLocalState({});
      }
    };
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) refresh();
    };

    window.addEventListener('storage', onStorage);
    const intervalId = window.setInterval(refresh, 1200);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!canUseServerWorkspace) return;
    let active = true;
    const refresh = async () => {
      const response = await fetchServerSessionState(workspaceId, sessionId);
      if (!active) return;
      if (response?.ok && response.state) {
        setServerState(response.state);
      }
    };
    refresh();
    const id = window.setInterval(refresh, 1200);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, sessionId, canUseServerWorkspace]);

  useEffect(() => {
    if (!canUseServerWorkspace) return;
    const beat = async () => {
      await heartbeatSessionConnection(workspaceId, sessionId, 'stage', stageClientId, {
        route: 'stage',
        ua: navigator.userAgent || '',
      });
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [workspaceId, sessionId, stageClientId, canUseServerWorkspace]);

  useEffect(() => () => {
    if (workspaceLayoutSaveTimeoutRef.current !== null) {
      window.clearTimeout(workspaceLayoutSaveTimeoutRef.current);
      workspaceLayoutSaveTimeoutRef.current = null;
    }
  }, []);

  const buildEffective = (source: any): EffectiveStageState => {
    const schedule = Array.isArray(source?.scheduleSnapshot)
      ? source.scheduleSnapshot
      : (Array.isArray(source?.schedule) ? source.schedule : []);
    const activeItemId = typeof source?.activeItemId === 'string' ? source.activeItemId : null;
    const activeSlideIndex = typeof source?.activeSlideIndex === 'number' ? source.activeSlideIndex : 0;
    const activeItem = activeItemId
      ? (schedule.find((entry: ServiceItem) => entry.id === activeItemId) || null)
      : null;
    const activeSlide = activeItem ? (activeItem.slides?.[activeSlideIndex] || activeItem.slides?.[0] || null) : null;
    const nextSlide = activeItem ? (activeItem.slides?.[activeSlideIndex + 1] || null) : null;

    const timerMode = source?.timerMode === 'ELAPSED' ? 'ELAPSED' : 'COUNTDOWN';
    const timerSeconds = Number.isFinite(source?.timerSeconds) ? Number(source.timerSeconds) : 0;
    const timerDurationSec = Number.isFinite(source?.timerDurationSec) ? Number(source.timerDurationSec) : 0;
    const timerCueSpeaker = typeof source?.timerCueSpeaker === 'string' ? source.timerCueSpeaker : '';
    const timerCueAmberPercent = Number.isFinite(source?.timerCueAmberPercent) ? Number(source.timerCueAmberPercent) : 25;
    const timerCueRedPercent = Number.isFinite(source?.timerCueRedPercent) ? Number(source.timerCueRedPercent) : 10;
    const stageTimerFlash = sanitizeStageTimerFlash(source?.stageTimerFlash);
    const stageProfile = source?.workspaceSettings?.stageProfile === 'compact'
      ? 'compact'
      : source?.workspaceSettings?.stageProfile === 'high_contrast'
        ? 'high_contrast'
        : 'classic';
    const stageTimerLayout = source?.workspaceSettings?.stageTimerLayout;
    const stageAlertLayout = source?.workspaceSettings?.stageAlertLayout;
    const stageFlowLayout = source?.workspaceSettings?.stageFlowLayout === 'speaker_focus'
      || source?.workspaceSettings?.stageFlowLayout === 'preview_focus'
      || source?.workspaceSettings?.stageFlowLayout === 'minimal_next'
      ? source.workspaceSettings.stageFlowLayout
      : 'balanced';
    const audienceOverlay = source?.audienceDisplay;
    const stageAlert = source?.stageAlert;
    const stageMessageCenter = sanitizeStageMessageCenter(source?.stageMessageCenter);
    const updatedAt = Number.isFinite(source?.updatedAt) ? Number(source.updatedAt) : 0;
    const holdScreenMode = sanitizeHoldScreenMode(source?.holdScreenMode);
    const churchName = typeof source?.workspaceSettings?.churchName === 'string' ? source.workspaceSettings.churchName : '';
    const branding: SlideBrandingConfig = {
      enabled: !!source?.workspaceSettings?.slideBrandingEnabled,
      churchName,
      seriesLabel: typeof source?.workspaceSettings?.slideBrandingSeriesLabel === 'string' ? source.workspaceSettings.slideBrandingSeriesLabel : '',
      style: (source?.workspaceSettings?.slideBrandingStyle === 'bold' || source?.workspaceSettings?.slideBrandingStyle === 'frosted') ? source.workspaceSettings.slideBrandingStyle : 'minimal',
      textOpacity: typeof source?.workspaceSettings?.slideBrandingOpacity === 'number' ? source.workspaceSettings.slideBrandingOpacity : 0.82,
    };

    return {
      item: activeItem,
      slide: activeSlide,
      nextSlide,
      audienceOverlay,
      stageAlert,
      stageMessageCenter,
      blackout: !!source?.blackout,
      holdScreenMode,
      churchName,
      timerMode,
      timerSeconds,
      timerDurationSec,
      timerCueSpeaker,
      timerCueAmberPercent,
      timerCueRedPercent,
      stageTimerFlash,
      stageProfile,
      stageTimerLayout,
      stageAlertLayout,
      stageFlowLayout,
      branding,
      updatedAt,
      hasRenderable: !!(activeItem && activeSlide),
    };
  };

  const effective = useMemo(() => {
    const candidates = [
      buildEffective(localState),
      buildEffective(serverState),
      buildEffective(liveState),
    ].sort((left, right) => right.updatedAt - left.updatedAt);
    const firstRenderable = candidates.find((entry) => entry.blackout || entry.holdScreenMode !== 'none' || entry.hasRenderable);
    return firstRenderable || candidates[0];
  }, [localState, serverState, liveState]);

  useEffect(() => {
    if (effective.blackout || effective.holdScreenMode !== 'none' || effective.hasRenderable) {
      setStableEffective(effective);
    }
  }, [effective]);

  const display = (effective.blackout || effective.holdScreenMode !== 'none' || effective.hasRenderable)
    ? effective
    : (stableEffective || effective);

  const hasLocalSchedule = Array.isArray(localState?.schedule) && localState.schedule.length > 0;
  if (authLoading && !hasLocalSchedule) {
    return <div className="h-screen w-screen bg-black text-zinc-500 flex items-center justify-center text-xs">Loading stage view...</div>;
  }

  if (!user && !hasLocalSchedule) {
    return <LoginScreen onLoginSuccess={(nextUser) => setUser(nextUser)} />;
  }

  if (display.blackout) {
    return <HoldScreen view="blackout" />;
  }

  if (display.holdScreenMode === 'clear') {
    return <HoldScreen view="clear" />;
  }

  if (display.holdScreenMode === 'logo') {
    return <HoldScreen view="logo" churchName={display.churchName} />;
  }

  // Derive the live schedule from whichever state source has it
  const liveSchedule: ServiceItem[] = useMemo(() => {
    const src = serverState || liveState || {};
    return Array.isArray(src?.scheduleSnapshot)
      ? src.scheduleSnapshot
      : (Array.isArray(src?.schedule) ? src.schedule : []);
  }, [serverState, liveState]);

  const liveActiveItemId: string | null = useMemo(() => {
    const src = serverState || liveState || {};
    return typeof src?.activeItemId === 'string' ? src.activeItemId : null;
  }, [serverState, liveState]);

  return (
    <StageDisplay
      currentSlide={display.slide || null}
      nextSlide={display.nextSlide || null}
      activeItem={display.item || null}
      timerLabel={display.timerCueSpeaker ? `${display.timerCueSpeaker} Timer` : 'Pastor Timer'}
      timerDisplay={(() => {
        const total = Number.isFinite(display.timerSeconds) ? display.timerSeconds : 0;
        const negative = total < 0;
        const abs = Math.abs(total);
        const mm = Math.floor(abs / 60).toString().padStart(2, '0');
        const ss = Math.floor(abs % 60).toString().padStart(2, '0');
        return `${negative ? '-' : ''}${mm}:${ss}`;
      })()}
      timerMode={display.timerMode}
      isTimerOvertime={display.timerMode === 'COUNTDOWN' && display.timerSeconds < 0}
      timerRemainingSec={display.timerSeconds}
      timerDurationSec={display.timerDurationSec}
      timerAmberPercent={display.timerCueAmberPercent}
      timerRedPercent={display.timerCueRedPercent}
      timerFlashActive={display.stageTimerFlash.active}
      timerFlashColor={display.stageTimerFlash.color}
      timerLayout={display.stageTimerLayout}
      onTimerLayoutChange={(layout) => {
        persistWorkspaceLayoutsLocally({ stageTimerLayout: layout });
        queueWorkspaceLayoutSave({ stageTimerLayout: layout });
      }}
      stageAlertLayout={display.stageAlertLayout}
      onStageAlertLayoutChange={(layout) => {
        persistWorkspaceLayoutsLocally({ stageAlertLayout: layout });
        queueWorkspaceLayoutSave({ stageAlertLayout: layout });
      }}
      flowLayout={display.stageFlowLayout}
      profile={display.stageProfile}
      audienceOverlay={display.audienceOverlay}
      stageAlert={display.stageAlert}
      stageMessageCenter={display.stageMessageCenter}
      branding={display.branding}
      // ── Tier 2 ─────────────────────────────────────────────────────────────
      schedule={liveSchedule}
      activeItemId={liveActiveItemId}
      onItemSelect={handleItemSelect}
      onNextSlide={handleNextSlide}
      onPrevSlide={handlePrevSlide}
      // ── Tier 3 ─────────────────────────────────────────────────────────────
      operatorCount={operatorCount}
      autoAdvanceEnabled={autoAdvance.enabled}
      autoAdvanceSec={autoAdvance.delaySeconds}
      onAutoAdvanceToggle={() => setAutoAdvance((prev) => ({ ...prev, enabled: !prev.enabled }))}
      onAutoAdvanceSecsChange={(secs) => setAutoAdvance((prev) => ({ ...prev, delaySeconds: secs }))}
      showSttPanel={showSttPanel}
      sttIsRecording={sttState.isRecording}
      sttTranscript={sttState.transcript}
      sttInterimText={sttState.interimText}
      onSttToggleRecording={handleSttToggleRecording}
      onSttClose={() => setShowSttPanel(false)}
    />
  );
};
