import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, subscribeToState, updateLiveState } from '../services/firebase';
import { logActivity } from '../services/analytics';
import { getOrCreateConnectionClientId, heartbeatSessionConnection, resolveWorkspaceId, sendServerRemoteCommand } from '../services/serverApi';
import { LoginScreen } from './LoginScreen';

export const RemoteControl: React.FC = () => {
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
      workspaceHint: fromSearchWorkspace || fromHashWorkspace || '',
    };
  };
  const [{ sessionId, workspaceHint }] = useState(getRouteParams);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<any>({});
  const [syncError, setSyncError] = useState('');
  const [commandStatus, setCommandStatus] = useState('');
  const [sending, setSending] = useState(false);
  const workspaceId = useMemo(() => resolveWorkspaceId(user, workspaceHint || 'default-workspace'), [user?.uid, workspaceHint]);
  const remoteClientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, sessionId, 'remote'),
    [workspaceId, sessionId]
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

  useEffect(() => {
    const beat = async () => {
      await heartbeatSessionConnection(workspaceId, sessionId, 'remote', remoteClientId, {
        route: 'remote',
        uid: user?.uid || '',
      });
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [workspaceId, sessionId, remoteClientId, user?.uid]);

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
    const [firebaseOk, serverOk] = await Promise.all([
      updateLiveState({ remoteCommand: command, remoteCommandAt: Date.now() }, sessionId),
      sendServerRemoteCommand(workspaceId, sessionId, user, command).then((response) => !!response?.ok),
    ]);
    setSending(false);

    if (!firebaseOk && !serverOk) {
      setCommandStatus('Command failed. Check login and Firestore permissions.');
      logActivity(user?.uid, 'ERROR', { type: 'REMOTE_COMMAND_FAIL', command, sessionId });
      return;
    }

    setCommandStatus(firebaseOk ? `Sent: ${command}` : `Sent via server: ${command}`);
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
    <div className="min-h-screen supports-[height:100dvh]:min-h-[100dvh] bg-zinc-950 text-white p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Lumina Remote</h1>
      <p className="text-zinc-400 text-xs sm:text-sm mb-3">Mobile control surface synced over Firebase.</p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 mb-4 space-y-1.5">
        <p className="text-zinc-500 text-[11px] sm:text-xs">Session: {sessionId}</p>
        <p className="text-zinc-500 text-[11px] sm:text-xs truncate">Signed in as: {user?.email || user?.uid}</p>
      </div>
      {ownerUid && (
        <p className="text-zinc-500 text-[11px] sm:text-xs mb-3 truncate">Session owner UID: {ownerUid}</p>
      )}
      {!ownerUid && (
        <p className="text-amber-400 text-[11px] sm:text-xs mb-3">No active session owner yet. Open presenter first.</p>
      )}
      {!canControl && ownerUid && (
        <p className="text-red-400 text-[11px] sm:text-xs mb-3">Access denied: use owner account or an allowlisted admin email.</p>
      )}
      {syncError && <p className="text-red-400 text-[11px] sm:text-xs mb-3">{syncError}</p>}
      {commandStatus && <p className="text-emerald-400 text-[11px] sm:text-xs mb-3">{commandStatus}</p>}

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('PREV')}
          className="p-3.5 sm:p-4 rounded bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          Prev Slide
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('NEXT')}
          className="p-3.5 sm:p-4 rounded bg-blue-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base col-span-2"
        >
          Next Slide
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('BLACKOUT')}
          className="p-3.5 sm:p-4 rounded bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base col-span-2"
        >
          Blackout
        </button>
      </div>

      <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('PLAY')}
          className="p-2.5 sm:p-3 rounded bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
        >
          Play Video
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('PAUSE')}
          className="p-2.5 sm:p-3 rounded bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
        >
          Pause Video
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('STOP')}
          className="p-2.5 sm:p-3 rounded bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
        >
          Stop Video
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('MUTE')}
          className="p-2.5 sm:p-3 rounded bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
        >
          Mute Output
        </button>
        <button
          disabled={!canControl || sending}
          onClick={() => sendCommand('UNMUTE')}
          className="p-2.5 sm:p-3 rounded bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold col-span-2"
        >
          Unmute Output
        </button>
      </div>

      <div className="mt-4 sm:mt-6 text-[11px] sm:text-xs text-zinc-500 space-y-1">
        <div>Current Item: {state.activeItemId || 'n/a'}</div>
        <div>Current Slide: {typeof state.activeSlideIndex === 'number' ? state.activeSlideIndex + 1 : 'n/a'}</div>
      </div>
    </div>
  );
};
