import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../services/firebase';
import { fetchServerSessionState } from '../services/serverApi';
import { ItemType, ServiceItem } from '../types';
import { LoginScreen } from './LoginScreen';
import { SlideRenderer } from './SlideRenderer';

const STORAGE_KEY = 'lumina_session_v1';

type RoutingMode = 'PROJECTOR' | 'STREAM' | 'LOBBY';
type LocalPresenterState = {
  schedule?: ServiceItem[];
  activeItemId?: string | null;
  activeSlideIndex?: number;
  blackout?: boolean;
  isPlaying?: boolean;
  outputMuted?: boolean;
  seekCommand?: number | null;
  seekAmount?: number;
  lowerThirdsEnabled?: boolean;
  routingMode?: RoutingMode;
  updatedAt?: number;
};

type EffectiveOutputState = {
  item: ServiceItem | null;
  slide: ServiceItem['slides'][number] | null;
  blackout: boolean;
  isPlaying: boolean;
  outputMuted: boolean;
  seekCommand: number | null;
  seekAmount: number;
  lowerThirdsEnabled: boolean;
  updatedAt: number;
  hasRenderable: boolean;
};

const readLocalPresenterState = (): LocalPresenterState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LocalPresenterState;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

export const OutputRoute: React.FC = () => {
  const getRouteParams = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = (searchParams.get('session') || '').trim();
    const fromSearchWorkspace = (searchParams.get('workspace') || '').trim();
    const fromSearchFullscreen = (searchParams.get('fullscreen') || '').trim();

    const hash = window.location.hash || '';
    const queryStart = hash.indexOf('?');
    let fromHash = '';
    let fromHashWorkspace = '';
    let fromHashFullscreen = '';
    if (queryStart >= 0) {
      const hashParams = new URLSearchParams(hash.slice(queryStart + 1));
      fromHash = (hashParams.get('session') || '').trim();
      fromHashWorkspace = (hashParams.get('workspace') || '').trim();
      fromHashFullscreen = (hashParams.get('fullscreen') || '').trim();
    }

    return {
      sessionId: fromSearch || fromHash || 'live',
      workspaceId: fromSearchWorkspace || fromHashWorkspace || 'default-workspace',
      fullscreen: fromSearchFullscreen || fromHashFullscreen,
    };
  };
  const [{ sessionId, workspaceId, fullscreen }] = useState(getRouteParams);

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>({});
  const [localState, setLocalState] = useState<LocalPresenterState>(() => readLocalPresenterState());
  const [serverState, setServerState] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToState((data) => setLiveState(data), sessionId);
  }, [user, sessionId]);

  useEffect(() => {
    if (fullscreen !== '1') return;
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {
      // Browser may block fullscreen without additional gesture.
    });
  }, [fullscreen]);

  useEffect(() => {
    const refresh = () => setLocalState(readLocalPresenterState());
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) refresh();
    };

    window.addEventListener('storage', onStorage);
    const intervalId = window.setInterval(refresh, 450);
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
    const id = window.setInterval(refresh, 700);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, sessionId]);

  const liveSchedule: ServiceItem[] = Array.isArray(liveState?.scheduleSnapshot) ? liveState.scheduleSnapshot : [];
  const localSchedule: ServiceItem[] = Array.isArray(localState?.schedule) ? localState.schedule : [];
  const serverSchedule: ServiceItem[] = Array.isArray(serverState?.scheduleSnapshot) ? serverState.scheduleSnapshot : [];
  const hasLocalSchedule = localSchedule.length > 0;

  const buildEffective = useCallback((source: any, schedule: ServiceItem[]): EffectiveOutputState => {
    const activeItemId = source?.activeItemId;
    const rawSlideIndex = source?.activeSlideIndex;
    const activeSlideIndex = typeof rawSlideIndex === 'number' ? rawSlideIndex : 0;
    const routingMode = source?.routingMode as RoutingMode | undefined;
    const blackout = !!source?.blackout;
    const isPlaying = typeof source?.isPlaying === 'boolean' ? source.isPlaying : true;
    const outputMuted = !!source?.outputMuted;
    const seekCommand = typeof source?.seekCommand === 'number' ? source.seekCommand : null;
    const seekAmount = typeof source?.seekAmount === 'number' ? source.seekAmount : 0;
    const lowerThirdsEnabled = !!source?.lowerThirdsEnabled;
    const updatedAt = typeof source?.updatedAt === 'number' ? source.updatedAt : 0;

    const activeItem = schedule.find((item) => item.id === activeItemId) || schedule[0] || null;
    const activeSlide = activeItem ? (activeItem.slides[activeSlideIndex] || activeItem.slides[0] || null) : null;
    if (routingMode === 'LOBBY') {
      const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
      const lobbySlide = lobbyItem?.slides?.[0] || activeSlide;
      const hasRenderable = !!(lobbyItem && lobbySlide);
      return {
        item: lobbyItem || null,
        slide: lobbySlide,
        blackout,
        isPlaying,
        outputMuted,
        seekCommand,
        seekAmount,
        lowerThirdsEnabled,
        updatedAt,
        hasRenderable,
      };
    }

    const hasRenderable = !!(activeItem && activeSlide);
    return { item: activeItem, slide: activeSlide, blackout, isPlaying, outputMuted, seekCommand, seekAmount, lowerThirdsEnabled, updatedAt, hasRenderable };
  }, []);

  const effective = useMemo(() => {
    const candidates: EffectiveOutputState[] = [
      buildEffective(localState, localSchedule),
      buildEffective(serverState, serverSchedule),
      buildEffective(liveState, liveSchedule),
    ].sort((a, b) => b.updatedAt - a.updatedAt);

    const firstRenderable = candidates.find((candidate) => candidate.blackout || candidate.hasRenderable);
    return firstRenderable || candidates[0];
  }, [buildEffective, localState, localSchedule, serverState, serverSchedule, liveState, liveSchedule]);

  if (authLoading && !hasLocalSchedule) {
    return <div className="h-screen w-screen bg-black text-zinc-500 flex items-center justify-center text-xs">Loading output...</div>;
  }

  if (!user && !hasLocalSchedule) {
    return <LoginScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="h-screen w-screen bg-black">
      {effective.blackout ? (
        <div className="w-full h-full bg-black" />
      ) : (
        <SlideRenderer
          slide={effective.slide || null}
          item={effective.item || null}
          fitContainer={true}
          isPlaying={effective.isPlaying}
          seekCommand={effective.seekCommand}
          seekAmount={effective.seekAmount}
          isMuted={effective.outputMuted}
          isProjector={true}
          lowerThirds={effective.lowerThirdsEnabled}
          showSlideLabel={false}
          showProjectorHelper={false}
        />
      )}
    </div>
  );
};

