import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../services/firebase';
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
  lowerThirdsEnabled?: boolean;
  routingMode?: RoutingMode;
  updatedAt?: number;
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
  const getSessionId = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = (searchParams.get('session') || '').trim();
    if (fromSearch) return fromSearch;

    const hash = window.location.hash || '';
    const queryStart = hash.indexOf('?');
    if (queryStart >= 0) {
      const hashParams = new URLSearchParams(hash.slice(queryStart + 1));
      const fromHash = (hashParams.get('session') || '').trim();
      if (fromHash) return fromHash;
    }

    return 'live';
  };
  const [sessionId] = useState(getSessionId);

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [liveState, setLiveState] = useState<any>({});
  const [localState, setLocalState] = useState<LocalPresenterState>(() => readLocalPresenterState());

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

  const liveSchedule: ServiceItem[] = Array.isArray(liveState?.scheduleSnapshot) ? liveState.scheduleSnapshot : [];
  const localSchedule: ServiceItem[] = Array.isArray(localState?.schedule) ? localState.schedule : [];
  const liveUpdatedAt = typeof liveState?.updatedAt === 'number' ? liveState.updatedAt : 0;
  const localUpdatedAt = typeof localState?.updatedAt === 'number' ? localState.updatedAt : 0;
  const preferLocal = localSchedule.length > 0 && (liveSchedule.length === 0 || localUpdatedAt > liveUpdatedAt);

  const effective = useMemo(() => {
    const schedule = preferLocal ? localSchedule : liveSchedule;
    const activeItemId = preferLocal ? localState.activeItemId : liveState?.activeItemId;
    const rawSlideIndex = preferLocal ? localState.activeSlideIndex : liveState?.activeSlideIndex;
    const activeSlideIndex = typeof rawSlideIndex === 'number' ? rawSlideIndex : -1;
    const routingMode = (preferLocal ? localState.routingMode : liveState?.routingMode) as RoutingMode | undefined;
    const blackout = preferLocal ? !!localState.blackout : !!liveState?.blackout;
    const lowerThirdsEnabled = preferLocal ? !!localState.lowerThirdsEnabled : !!liveState?.lowerThirdsEnabled;

    const activeItem = schedule.find((item) => item.id === activeItemId) || null;
    const activeSlide = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex] : null;
    if (routingMode === 'LOBBY') {
      const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
      return {
        item: lobbyItem || null,
        slide: lobbyItem?.slides?.[0] || activeSlide,
        blackout,
        lowerThirdsEnabled,
      };
    }

    return { item: activeItem, slide: activeSlide, blackout, lowerThirdsEnabled };
  }, [preferLocal, liveSchedule, localSchedule, localState, liveState]);

  if (authLoading && !preferLocal) {
    return <div className="h-screen w-screen bg-black text-zinc-500 flex items-center justify-center text-xs">Loading output...</div>;
  }

  if (!user && !preferLocal) {
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
          isMuted={false}
          isProjector={true}
          lowerThirds={effective.lowerThirdsEnabled}
        />
      )}
    </div>
  );
};

