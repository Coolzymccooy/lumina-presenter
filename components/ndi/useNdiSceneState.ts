import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../../services/firebase';
import { fetchServerSessionState, getOrCreateConnectionClientId, heartbeatSessionConnection } from '../../services/serverApi';
import { ConnectionRole, ItemType, ServiceItem } from '../../types';

const STORAGE_KEY = 'lumina_session_v1';

type LocalPresenterState = {
  schedule?: ServiceItem[];
  activeItemId?: string | null;
  activeSlideIndex?: number;
  blackout?: boolean;
  holdScreenMode?: 'none' | 'clear' | 'logo';
  isPlaying?: boolean;
  outputMuted?: boolean;
  lowerThirdsEnabled?: boolean;
  routingMode?: 'PROJECTOR' | 'STREAM' | 'LOBBY';
  updatedAt?: number;
};

export type NdiSceneRouteParams = {
  sessionId: string;
  workspaceId: string;
  fillKey: boolean;
  hasExplicitWorkspace: boolean;
};

export type NdiSceneEffective = {
  item: ServiceItem | null;
  slide: ServiceItem['slides'][number] | null;
  blackout: boolean;
  holdScreenMode: 'none' | 'clear' | 'logo';
  isPlaying: boolean;
  lowerThirdsEnabled: boolean;
  hasRenderable: boolean;
  updatedAt: number;
};

export type NdiSceneState = {
  authReady: boolean;
  user: unknown;
  effective: NdiSceneEffective;
  canUseServerWorkspace: boolean;
  params: NdiSceneRouteParams;
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

const parseNdiSceneRouteParams = (): NdiSceneRouteParams => {
  const searchParams = new URLSearchParams(window.location.search);
  const fromSearch = (searchParams.get('session') || '').trim();
  const fromSearchWorkspace = (searchParams.get('workspace') || '').trim();
  const fromSearchFillKey = (searchParams.get('fillKey') || '').trim();

  const hash = window.location.hash || '';
  const queryStart = hash.indexOf('?');
  let fromHash = '';
  let fromHashWorkspace = '';
  let fromHashFillKey = '';
  if (queryStart >= 0) {
    const hashParams = new URLSearchParams(hash.slice(queryStart + 1));
    fromHash = (hashParams.get('session') || '').trim();
    fromHashWorkspace = (hashParams.get('workspace') || '').trim();
    fromHashFillKey = (hashParams.get('fillKey') || '').trim();
  }

  return {
    sessionId: fromSearch || fromHash || 'live',
    workspaceId: fromSearchWorkspace || fromHashWorkspace || 'default-workspace',
    fillKey: (fromSearchFillKey || fromHashFillKey) === '1',
    hasExplicitWorkspace: !!(fromSearchWorkspace || fromHashWorkspace),
  };
};

export function useNdiSceneState(routeLabel: string): NdiSceneState {
  const [params] = useState<NdiSceneRouteParams>(parseNdiSceneRouteParams);
  const { sessionId, workspaceId, hasExplicitWorkspace } = params;

  const clientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, sessionId, routeLabel as ConnectionRole),
    [workspaceId, sessionId, routeLabel]
  );

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<unknown>(null);
  const [liveState, setLiveState] = useState<Record<string, unknown>>({});
  const [localState, setLocalState] = useState<LocalPresenterState>(() => readLocalPresenterState());
  const [serverState, setServerState] = useState<Record<string, unknown> | null>(null);
  const localStateRawRef = useRef<string | null>(null);

  const canUseServerWorkspace = useMemo(
    () => !!workspaceId && (hasExplicitWorkspace || !!(user as { uid?: string } | null)?.uid),
    [workspaceId, hasExplicitWorkspace, user]
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
    if (!user || canUseServerWorkspace) return;
    return subscribeToState((data) => setLiveState(data), sessionId);
  }, [user, sessionId, canUseServerWorkspace]);

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
      await heartbeatSessionConnection(workspaceId, sessionId, routeLabel as ConnectionRole, clientId, {
        route: routeLabel,
        ua: navigator.userAgent || '',
      });
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [workspaceId, sessionId, clientId, canUseServerWorkspace, routeLabel]);

  const buildEffective = useCallback((source: Record<string, unknown> | null | undefined, schedule: ServiceItem[]): NdiSceneEffective => {
    const s = source || {};
    const activeItemId = typeof s.activeItemId === 'string' ? s.activeItemId : null;
    const rawSlideIndex = s.activeSlideIndex;
    const activeSlideIndex = typeof rawSlideIndex === 'number' ? rawSlideIndex : 0;
    const routingMode = s.routingMode as 'PROJECTOR' | 'STREAM' | 'LOBBY' | undefined;
    const blackout = !!s.blackout;
    const holdScreenMode = sanitizeHoldScreenMode(s.holdScreenMode);
    const isPlaying = typeof s.isPlaying === 'boolean' ? s.isPlaying : true;
    const lowerThirdsEnabled = !!s.lowerThirdsEnabled;
    const updatedAt = typeof s.updatedAt === 'number' ? s.updatedAt : 0;

    const activeItem = activeItemId
      ? (schedule.find((item) => item.id === activeItemId) || null)
      : null;
    const activeSlide = activeItem ? (activeItem.slides[activeSlideIndex] || activeItem.slides[0] || null) : null;

    if (routingMode === 'LOBBY') {
      const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
      const lobbySlide = lobbyItem?.slides?.[0] || activeSlide;
      return {
        item: lobbyItem || null,
        slide: lobbySlide,
        blackout,
        holdScreenMode,
        isPlaying,
        lowerThirdsEnabled,
        hasRenderable: !!(lobbyItem && lobbySlide),
        updatedAt,
      };
    }

    return {
      item: activeItem,
      slide: activeSlide,
      blackout,
      holdScreenMode,
      isPlaying,
      lowerThirdsEnabled,
      hasRenderable: !!(activeItem && activeSlide),
      updatedAt,
    };
  }, []);

  const liveSchedule = Array.isArray((liveState as { scheduleSnapshot?: ServiceItem[] })?.scheduleSnapshot)
    ? ((liveState as { scheduleSnapshot: ServiceItem[] }).scheduleSnapshot)
    : [];
  const localSchedule: ServiceItem[] = Array.isArray(localState?.schedule) ? localState.schedule : [];
  const serverSchedule = Array.isArray((serverState as { scheduleSnapshot?: ServiceItem[] })?.scheduleSnapshot)
    ? ((serverState as { scheduleSnapshot: ServiceItem[] }).scheduleSnapshot)
    : [];

  const effective = useMemo(() => {
    const candidates: NdiSceneEffective[] = [
      buildEffective(localState as Record<string, unknown>, localSchedule),
      buildEffective(serverState, serverSchedule),
      buildEffective(liveState, liveSchedule),
    ].sort((a, b) => b.updatedAt - a.updatedAt);

    const firstRenderable = candidates.find((candidate) => candidate.blackout || candidate.holdScreenMode !== 'none' || candidate.hasRenderable);
    return firstRenderable || candidates[0];
  }, [buildEffective, localState, localSchedule, serverState, serverSchedule, liveState, liveSchedule]);

  return {
    authReady: !authLoading,
    user,
    effective,
    canUseServerWorkspace,
    params,
  };
}
