import React, { useEffect, useState } from 'react';
import { subscribeToState, updateLiveState } from '../services/firebase';

export const RemoteControl: React.FC = () => {
  const [state, setState] = useState<any>({});

  useEffect(() => {
    return subscribeToState((data) => setState(data));
  }, []);

  const sendCommand = async (command: 'NEXT' | 'PREV' | 'BLACKOUT') => {
    await updateLiveState({ remoteCommand: command, remoteCommandAt: Date.now() });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-2">Lumina Remote</h1>
      <p className="text-zinc-400 text-sm mb-6">Mobile control surface synced over Firebase.</p>
      <div className="grid grid-cols-1 gap-3">
        <button onClick={() => sendCommand('PREV')} className="p-4 rounded bg-zinc-800">◀ Prev Slide</button>
        <button onClick={() => sendCommand('NEXT')} className="p-4 rounded bg-blue-600 font-bold">Next Slide ▶</button>
        <button onClick={() => sendCommand('BLACKOUT')} className="p-4 rounded bg-red-700">Blackout</button>
      </div>
      <div className="mt-6 text-xs text-zinc-500">
        <div>Current Item: {state.activeItemId || 'n/a'}</div>
        <div>Current Slide: {typeof state.activeSlideIndex === 'number' ? state.activeSlideIndex + 1 : 'n/a'}</div>
      </div>
    </div>
  );
};
