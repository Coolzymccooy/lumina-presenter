import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState } from '../services/firebase';
import { ItemType, ServiceItem } from '../types';
import { LoginScreen } from './LoginScreen';
import { SlideRenderer } from './SlideRenderer';

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

  const scheduleSnapshot: ServiceItem[] = Array.isArray(liveState?.scheduleSnapshot) ? liveState.scheduleSnapshot : [];
  const activeItem = scheduleSnapshot.find((item) => item.id === liveState?.activeItemId) || null;
  const activeSlideIndex = typeof liveState?.activeSlideIndex === 'number' ? liveState.activeSlideIndex : -1;
  const activeSlide = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex] : null;

  const routed = useMemo(() => {
    if (liveState?.routingMode === 'LOBBY') {
      const lobbyItem = scheduleSnapshot.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
      return {
        item: lobbyItem || null,
        slide: lobbyItem?.slides?.[0] || activeSlide,
      };
    }
    return { item: activeItem, slide: activeSlide };
  }, [liveState?.routingMode, scheduleSnapshot, activeItem, activeSlide]);

  if (authLoading) {
    return <div className="h-screen w-screen bg-black text-zinc-500 flex items-center justify-center text-xs">Loading output...</div>;
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="h-screen w-screen bg-black">
      {liveState?.blackout ? (
        <div className="w-full h-full bg-black" />
      ) : (
        <SlideRenderer
          slide={routed.slide || null}
          item={routed.item || null}
          fitContainer={true}
          isMuted={false}
          isProjector={true}
          lowerThirds={!!liveState?.lowerThirdsEnabled}
        />
      )}
    </div>
  );
};

