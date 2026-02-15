import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState, updateLiveState } from '../services/firebase';
import { logActivity } from '../services/analytics';
import { LoginScreen } from './LoginScreen';

export const RemoteControl: React.FC = () => {
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
  const [state, setState] = useState<any>({});
  const [syncError, setSyncError] = useState('');
  const [commandStatus, setCommandStatus] = useState('');
  const [sending, setSending] = useState(false);

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
    return subscribeToState(
      (data) => {
        setState(data);
        setSyncError('');
      },
      sessionId,
      (error) => {
        const message = error?.message || 'Failed to subscribe to live session.';
        setSyncError(message);
        logActivity(user?.uid, 'ERROR', { type: 'REMOTE_SUBSCRIBE_FAIL', sessionId, message });
      }
    );
  }, [user, sessionId]);

  const ownerUid = state?.controllerOwnerUid || null;
  const allowedUids = Array.isArray(state?.controllerAllowedUids) ? state.controllerAllowedUids : [];
  const allowedEmails = Array.isArray(state?.controllerAllowedEmails)
    ? state.controllerAllowedEmails.map((e: string) => String(e).toLowerCase())
    : [];
  const userEmail = String(user?.email || '').toLowerCase();
  const canControl = useMemo(() => {
    if (!user?.uid || !ownerUid) return false;
    if (user.uid === ownerUid) return true;
    if (allowedUids.includes(user.uid)) return true;
    if (userEmail && allowedEmails.includes(userEmail)) return true;
    return false;
  }, [user?.uid, ownerUid, allowedUids, allowedEmails, userEmail]);

  const sendCommand = async (command: 'NEXT' | 'PREV' | 'BLACKOUT' | 'PLAY' | 'PAUSE' | 'STOP' | 'MUTE' | 'UNMUTE') => {
    if (!canControl) {
      setCommandStatus('Not authorized for this active session.');
      return;
    }

    setSending(true);
    setCommandStatus('');
    const ok = await updateLiveState({ remoteCommand: command, remoteCommandAt: Date.now() }, sessionId);
    setSending(false);

    if (!ok) {
      setCommandStatus('Command failed. Check login and Firestore permissions.');
      logActivity(user?.uid, 'ERROR', { type: 'REMOTE_COMMAND_FAIL', command, sessionId });
      return;
    }

    setCommandStatus(`Sent: ${command}`);
    window.setTimeout(() => setCommandStatus(''), 900);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <span className="text-sm">Loading remote access...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-2">Lumina Remote</h1>
      <p className="text-zinc-400 text-sm mb-2">Mobile control surface synced over Firebase.</p>
      <p className="text-zinc-500 text-xs mb-2">Session: {sessionId}</p>
      <p className="text-zinc-500 text-xs mb-4">Signed in as: {user?.email || user?.uid}</p>
      {ownerUid && (
        <p className="text-zinc-500 text-xs mb-4">Session owner UID: {ownerUid}</p>
      )}
      {!ownerUid && (
        <p className="text-amber-400 text-xs mb-4">No active session owner yet. Open presenter first.</p>
      )}
      {!canControl && ownerUid && (
        <p className="text-red-400 text-xs mb-4">Access denied: use owner account or an allowlisted admin email.</p>
      )}
      {syncError && <p className="text-red-400 text-xs mb-4">{syncError}</p>}
      {commandStatus && <p className="text-emerald-400 text-xs mb-4">{commandStatus}</p>}

      <div className="grid grid-cols-1 gap-3">
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('PREV')}
          className="p-4 rounded bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev Slide
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('NEXT')}
          className="p-4 rounded bg-blue-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Slide
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('BLACKOUT')}
          className="p-4 rounded bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Blackout
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('PLAY')}
          className="p-3 rounded bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          Play Video
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('PAUSE')}
          className="p-3 rounded bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          Pause Video
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('STOP')}
          className="p-3 rounded bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          Stop Video
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('MUTE')}
          className="p-3 rounded bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          Mute Output
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('UNMUTE')}
          className="p-3 rounded bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold col-span-2"
        >
          Unmute Output
        </button>
      </div>

      <div className="mt-6 text-xs text-zinc-500">
        <div>Current Item: {state.activeItemId || 'n/a'}</div>
        <div>Current Slide: {typeof state.activeSlideIndex === 'number' ? state.activeSlideIndex + 1 : 'n/a'}</div>
      </div>
    </div>
  );
};
