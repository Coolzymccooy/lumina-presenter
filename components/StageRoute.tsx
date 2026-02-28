import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../services/firebase';
import { fetchServerSessionState, getOrCreateConnectionClientId, heartbeatSessionConnection } from '../services/serverApi';
import { AudienceDisplayState, ServiceItem, StageAlertState, StageTimerLayout } from '../types';
import { LoginScreen } from './LoginScreen';
import { StageDisplay } from './StageDisplay';

const STORAGE_KEY = 'lumina_session_v1';

type LocalStageState = {
  schedule?: ServiceItem[];
  activeItemId?: string | null;
  activeSlideIndex?: number;
  blackout?: boolean;
  audienceDisplay?: AudienceDisplayState;
  stageAlert?: StageAlertState;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
  timerSeconds?: number;
  timerDurationSec?: number;
  timerCueSpeaker?: string;
  timerCueAmberPercent?: number;
  timerCueRedPercent?: number;
  workspaceSettings?: {
    stageProfile?: 'classic' | 'compact' | 'high_contrast';
    stageTimerLayout?: StageTimerLayout;
  };
  updatedAt?: number;
};

type EffectiveStageState = {
  item: ServiceItem | null;
  slide: ServiceItem['slides'][number] | null;
  nextSlide: ServiceItem['slides'][number] | null;
  audienceOverlay?: AudienceDisplayState;
  stageAlert?: StageAlertState;
  blackout: boolean;
  timerMode: 'COUNTDOWN' | 'ELAPSED';
  timerSeconds: number;
  timerDurationSec: number;
  timerCueSpeaker: string;
  timerCueAmberPercent: number;
  timerCueRedPercent: number;
  stageProfile: 'classic' | 'compact' | 'high_contrast';
  stageTimerLayout?: StageTimerLayout;
  updatedAt: number;
  hasRenderable: boolean;
};

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
    };
  };

  const [{ sessionId, workspaceId }] = useState(getRouteParams);
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
  }, [workspaceId, sessionId]);

  useEffect(() => {
    const beat = async () => {
      await heartbeatSessionConnection(workspaceId, sessionId, 'stage', stageClientId, {
        route: 'stage',
        ua: navigator.userAgent || '',
      });
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [workspaceId, sessionId, stageClientId]);

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
    const stageProfile = source?.workspaceSettings?.stageProfile === 'compact'
      ? 'compact'
      : source?.workspaceSettings?.stageProfile === 'high_contrast'
        ? 'high_contrast'
        : 'classic';
    const stageTimerLayout = source?.workspaceSettings?.stageTimerLayout;
    const audienceOverlay = source?.audienceDisplay;
    const stageAlert = source?.stageAlert;
    const updatedAt = Number.isFinite(source?.updatedAt) ? Number(source.updatedAt) : 0;

    return {
      item: activeItem,
      slide: activeSlide,
      nextSlide,
      audienceOverlay,
      stageAlert,
      blackout: !!source?.blackout,
      timerMode,
      timerSeconds,
      timerDurationSec,
      timerCueSpeaker,
      timerCueAmberPercent,
      timerCueRedPercent,
      stageProfile,
      stageTimerLayout,
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
    const firstRenderable = candidates.find((entry) => entry.blackout || entry.hasRenderable);
    return firstRenderable || candidates[0];
  }, [localState, serverState, liveState]);

  useEffect(() => {
    if (effective.blackout || effective.hasRenderable) {
      setStableEffective(effective);
    }
  }, [effective]);

  const display = (effective.blackout || effective.hasRenderable)
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
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 text-xs uppercase tracking-[0.25em] font-mono">BLACKOUT ACTIVE</div>
      </div>
    );
  }

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
      timerLayout={display.stageTimerLayout}
      profile={display.stageProfile}
      audienceOverlay={display.audienceOverlay}
      stageAlert={display.stageAlert}
    />
  );
};
