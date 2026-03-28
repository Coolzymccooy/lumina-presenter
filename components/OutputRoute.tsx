import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../services/firebase';
import { fetchServerSessionState, getOrCreateConnectionClientId, heartbeatSessionConnection } from '../services/serverApi';
import { AudienceDisplayState, AudienceMessage, AudienceQrProjectionState, ItemType, ServiceItem } from '../types';
import { HoldScreen } from './presenter/HoldScreen';
import { LoginScreen } from './LoginScreen';
import { SlideRenderer } from './SlideRenderer';

const STORAGE_KEY = 'lumina_session_v1';

type RoutingMode = 'PROJECTOR' | 'STREAM' | 'LOBBY';
type LocalPresenterState = {
  schedule?: ServiceItem[];
  activeItemId?: string | null;
  activeSlideIndex?: number;
  blackout?: boolean;
  holdScreenMode?: 'none' | 'clear' | 'logo';
  isPlaying?: boolean;
  outputMuted?: boolean;
  seekCommand?: number | null;
  seekAmount?: number;
  lowerThirdsEnabled?: boolean;
  routingMode?: RoutingMode;
  audienceDisplay?: AudienceDisplayState;
  audienceQrProjection?: AudienceQrProjectionState;
  workspaceSettings?: {
    churchName?: string;
  };
  updatedAt?: number;
};

type EffectiveOutputState = {
  item: ServiceItem | null;
  slide: ServiceItem['slides'][number] | null;
  blackout: boolean;
  holdScreenMode: 'none' | 'clear' | 'logo';
  churchName: string;
  isPlaying: boolean;
  outputMuted: boolean;
  seekCommand: number | null;
  seekAmount: number;
  lowerThirdsEnabled: boolean;
  audienceOverlay: AudienceDisplayState | null;
  projectedAudienceQr: AudienceQrProjectionState | null;
  updatedAt: number;
  hasRenderable: boolean;
};

const sanitizeAudienceMessage = (value: unknown): AudienceMessage | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'number' || typeof raw.text !== 'string' || typeof raw.category !== 'string') return null;
  return {
    id: raw.id,
    workspace_id: typeof raw.workspace_id === 'string' ? raw.workspace_id : '',
    category: raw.category as AudienceMessage['category'],
    text: raw.text,
    submitter_name: typeof raw.submitter_name === 'string' ? raw.submitter_name : null,
    status: (typeof raw.status === 'string' ? raw.status : 'approved') as AudienceMessage['status'],
    created_at: typeof raw.created_at === 'number' ? raw.created_at : Date.now(),
    updated_at: typeof raw.updated_at === 'number' ? raw.updated_at : Date.now(),
  };
};

const sanitizeAudienceOverlay = (value: unknown): AudienceDisplayState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const queue = Array.isArray(raw.queue)
    ? raw.queue.map(sanitizeAudienceMessage).filter((entry): entry is AudienceMessage => !!entry)
    : [];
  return {
    queue,
    autoRotate: !!raw.autoRotate,
    rotateSeconds: typeof raw.rotateSeconds === 'number' && Number.isFinite(raw.rotateSeconds)
      ? Math.max(3, Math.min(120, Math.round(raw.rotateSeconds)))
      : 8,
    pinnedMessageId: typeof raw.pinnedMessageId === 'number' && Number.isFinite(raw.pinnedMessageId) ? raw.pinnedMessageId : null,
    tickerEnabled: !!raw.tickerEnabled,
    activeMessageId: typeof raw.activeMessageId === 'number' && Number.isFinite(raw.activeMessageId) ? raw.activeMessageId : null,
  };
};

const sanitizeAudienceQrProjection = (value: unknown): AudienceQrProjectionState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const audienceUrl = typeof raw.audienceUrl === 'string' ? raw.audienceUrl.trim() : '';
  if (!audienceUrl) return null;
  return {
    visible: !!raw.visible,
    audienceUrl,
    scale: typeof raw.scale === 'number' && Number.isFinite(raw.scale)
      ? Math.min(2.2, Math.max(0.7, raw.scale))
      : 1,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
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

const sanitizeHoldScreenMode = (value: unknown): 'none' | 'clear' | 'logo' => (
  value === 'clear' || value === 'logo' ? value : 'none'
);

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
      hasExplicitWorkspace: !!(fromSearchWorkspace || fromHashWorkspace),
    };
  };
  const [{ sessionId, workspaceId, fullscreen, hasExplicitWorkspace }] = useState(getRouteParams);
  const outputClientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, sessionId, 'output'),
    [workspaceId, sessionId]
  );

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>({});
  const [localState, setLocalState] = useState<LocalPresenterState>(() => readLocalPresenterState());
  const [serverState, setServerState] = useState<Record<string, any> | null>(null);
  const [stableEffective, setStableEffective] = useState<EffectiveOutputState | null>(null);
  const localStateRawRef = useRef<string | null>(null);
  const canUseServerWorkspace = useMemo(
    () => !!workspaceId && (hasExplicitWorkspace || !!user?.uid),
    [workspaceId, hasExplicitWorkspace, user?.uid]
  );

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
        setLocalState(parsed && typeof parsed === 'object' ? parsed as LocalPresenterState : {});
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
      await heartbeatSessionConnection(workspaceId, sessionId, 'output', outputClientId, {
        route: 'output',
        ua: navigator.userAgent || '',
      });
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [workspaceId, sessionId, outputClientId, canUseServerWorkspace]);

  const liveSchedule: ServiceItem[] = Array.isArray(liveState?.scheduleSnapshot) ? liveState.scheduleSnapshot : [];
  const localSchedule: ServiceItem[] = Array.isArray(localState?.schedule) ? localState.schedule : [];
  const serverSchedule: ServiceItem[] = Array.isArray(serverState?.scheduleSnapshot) ? serverState.scheduleSnapshot : [];
  const hasLocalSchedule = localSchedule.length > 0;

  const buildEffective = useCallback((source: any, schedule: ServiceItem[]): EffectiveOutputState => {
    const activeItemId = typeof source?.activeItemId === 'string' ? source.activeItemId : null;
    const rawSlideIndex = source?.activeSlideIndex;
    const activeSlideIndex = typeof rawSlideIndex === 'number' ? rawSlideIndex : 0;
    const routingMode = source?.routingMode as RoutingMode | undefined;
    const blackout = !!source?.blackout;
    const holdScreenMode = sanitizeHoldScreenMode(source?.holdScreenMode);
    const isPlaying = typeof source?.isPlaying === 'boolean' ? source.isPlaying : true;
    const outputMuted = !!source?.outputMuted;
    const seekCommand = typeof source?.seekCommand === 'number' ? source.seekCommand : null;
    const seekAmount = typeof source?.seekAmount === 'number' ? source.seekAmount : 0;
    const lowerThirdsEnabled = !!source?.lowerThirdsEnabled;
    const audienceOverlay = sanitizeAudienceOverlay(source?.audienceDisplay);
    const projectedAudienceQr = sanitizeAudienceQrProjection(source?.audienceQrProjection);
    const updatedAt = typeof source?.updatedAt === 'number' ? source.updatedAt : 0;
    const churchName = typeof source?.workspaceSettings?.churchName === 'string' ? source.workspaceSettings.churchName : '';

    const activeItem = activeItemId
      ? (schedule.find((item) => item.id === activeItemId) || null)
      : null;
    const activeSlide = activeItem ? (activeItem.slides[activeSlideIndex] || activeItem.slides[0] || null) : null;
    if (routingMode === 'LOBBY') {
      const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
      const lobbySlide = lobbyItem?.slides?.[0] || activeSlide;
      const hasRenderable = !!(lobbyItem && lobbySlide);
      return {
        item: lobbyItem || null,
        slide: lobbySlide,
        blackout,
        holdScreenMode,
        churchName,
        isPlaying,
        outputMuted,
        seekCommand,
        seekAmount,
        lowerThirdsEnabled,
        audienceOverlay,
        projectedAudienceQr,
        updatedAt,
        hasRenderable,
      };
    }

    const hasRenderable = !!(activeItem && activeSlide);
    return {
      item: activeItem,
      slide: activeSlide,
      blackout,
      holdScreenMode,
      churchName,
      isPlaying,
      outputMuted,
      seekCommand,
      seekAmount,
      lowerThirdsEnabled,
      audienceOverlay,
      projectedAudienceQr,
      updatedAt,
      hasRenderable,
    };
  }, []);

  const effective = useMemo(() => {
    const candidates: EffectiveOutputState[] = [
      buildEffective(localState, localSchedule),
      buildEffective(serverState, serverSchedule),
      buildEffective(liveState, liveSchedule),
    ].sort((a, b) => b.updatedAt - a.updatedAt);

    const firstRenderable = candidates.find((candidate) => candidate.blackout || candidate.holdScreenMode !== 'none' || candidate.hasRenderable);
    return firstRenderable || candidates[0];
  }, [buildEffective, localState, localSchedule, serverState, serverSchedule, liveState, liveSchedule]);

  useEffect(() => {
    if (effective.blackout || effective.holdScreenMode !== 'none' || effective.hasRenderable) {
      setStableEffective(effective);
    }
  }, [effective]);

  const display = (effective.blackout || effective.holdScreenMode !== 'none' || effective.hasRenderable)
    ? effective
    : (stableEffective || effective);

  if (authLoading && !hasLocalSchedule) {
    return <div className="h-screen w-screen bg-black text-zinc-500 flex items-center justify-center text-xs">Loading output...</div>;
  }

  if (!user && !hasLocalSchedule) {
    return <LoginScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="h-screen w-screen bg-black">
      {display.blackout ? (
        <HoldScreen view="blackout" />
      ) : display.holdScreenMode === 'clear' ? (
        <HoldScreen view="clear" />
      ) : display.holdScreenMode === 'logo' ? (
        <HoldScreen view="logo" churchName={display.churchName} />
      ) : !display.hasRenderable ? (
        <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500 text-xs font-mono uppercase tracking-[0.25em]">WAITING FOR LIVE CONTENT</div>
      ) : (
        <SlideRenderer
          slide={display.slide || null}
          item={display.item || null}
          fitContainer={true}
          isPlaying={display.isPlaying}
          seekCommand={display.seekCommand}
          seekAmount={display.seekAmount}
          isMuted={display.outputMuted}
          isProjector={true}
          lowerThirds={display.lowerThirdsEnabled}
          showSlideLabel={
            display.item?.type === ItemType.BIBLE
            || display.item?.type === ItemType.SCRIPTURE
            || display.slide?.layoutType === 'scripture_ref'
          }
          showProjectorHelper={false}
          audienceOverlay={display.audienceOverlay || undefined}
          projectedAudienceQr={display.projectedAudienceQr || undefined}
        />
      )}
    </div>
  );
};

