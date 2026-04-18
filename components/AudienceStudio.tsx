import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    AudienceMessage,
    fetchAudienceMessages,
    updateAudienceMessageStatus,
    deleteAudienceMessage,
    subscribeAudienceMessagesStream,
} from '../services/serverApi';
import {
    AudienceCategory,
    AudienceStatus,
    AudienceDisplayState,
    StageAlertState,
    StageMessageCenterState,
    StageMessageCategory,
} from '../types';
import {
    ChatIcon,
    RefreshIcon,
} from './Icons';
import { CAT_CONFIG } from './audience-studio/constants';
import { useAudienceMode } from './audience-studio/hooks/useAudienceMode';
import { ModeSwitcher } from './audience-studio/primitives/ModeSwitcher';
import { SubmissionsPanel } from './audience-studio/panels/SubmissionsPanel';
import { QueuePanel } from './audience-studio/panels/QueuePanel';
import { StagePanel } from './audience-studio/panels/StagePanel';
import { BroadcastPanel } from './audience-studio/panels/BroadcastPanel';
import { ModeCounts } from './audience-studio/types';

interface AudienceStudioProps {
    workspaceId: string;
    user: any;
    onProjectRequest: (text: string, label?: string) => void;
    displayState: AudienceDisplayState;
    onUpdateDisplay: (patch: Partial<AudienceDisplayState>) => void;
    stageAlert: StageAlertState;
    stageMessageCenter: StageMessageCenterState;
    onQueueStageMessage: (payload: { text: string; category: StageMessageCategory; priority?: 'normal' | 'high'; templateKey?: string }) => void;
    onSendStageMessageNow: (payload: { text: string; category: StageMessageCategory; priority?: 'normal' | 'high'; templateKey?: string }) => void;
    onPromoteStageMessage: (messageId: string) => void;
    onRemoveQueuedStageMessage: (messageId: string) => void;
    onSendStageAlert: (text: string) => void;
    onClearStageAlert: () => void;
    canUseStageAlert: boolean;
}

export const AudienceStudio: React.FC<AudienceStudioProps> = ({
    workspaceId,
    user,
    onProjectRequest,
    displayState,
    onUpdateDisplay,
    stageAlert,
    stageMessageCenter,
    onQueueStageMessage,
    onSendStageMessageNow,
    onPromoteStageMessage,
    onRemoveQueuedStageMessage,
    onSendStageAlert,
    onClearStageAlert,
    canUseStageAlert,
}) => {
    const [messages, setMessages] = useState<AudienceMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<AudienceStatus | 'all'>('pending');
    const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
    const [stageAlertDraft, setStageAlertDraft] = useState('');
    const [stageCategory, setStageCategory] = useState<StageMessageCategory>('urgent');
    const [broadcastDraft, setBroadcastDraft] = useState('');
    const [broadcastCategory, setBroadcastCategory] = useState<AudienceCategory>('welcome');
    const [broadcastHistory, setBroadcastHistory] = useState<AudienceMessage[]>([]);
    const refreshInFlightRef = useRef(false);
    const refreshQueuedRef = useRef(false);
    const [mode, setMode] = useAudienceMode('broadcast');

    const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
        if (!user) return;
        const silent = options?.silent === true;
        if (refreshInFlightRef.current) {
            refreshQueuedRef.current = true;
            return;
        }
        refreshInFlightRef.current = true;
        if (!silent) {
            setLoading(true);
        }
        try {
            const statusFilter = filter === 'all' ? undefined : filter;
            const res = await fetchAudienceMessages(workspaceId, user, statusFilter);
            if (res?.ok) {
                setMessages(res.messages);
                setLastRefresh(Date.now());
            }
        } catch (err) {
            console.error('Failed to load audience messages', err);
        } finally {
            refreshInFlightRef.current = false;
            if (!silent) {
                setLoading(false);
            }
            if (refreshQueuedRef.current) {
                refreshQueuedRef.current = false;
                window.setTimeout(() => {
                    void loadMessages({ silent: true });
                }, 0);
            }
        }
    }, [workspaceId, user, filter]);

    useEffect(() => {
        void loadMessages();
    }, [loadMessages]);

    useEffect(() => {
        if (!user) return;

        let disposed = false;
        let unsubscribe: null | (() => void) = null;
        const refreshQuietly = () => {
            if (disposed) return;
            void loadMessages({ silent: true });
        };

        void (async () => {
            const nextUnsubscribe = await subscribeAudienceMessagesStream(workspaceId, user, {
                onEvent: () => {
                    refreshQuietly();
                },
                onError: (error) => {
                    console.warn('Audience message stream dropped; falling back to reconnect.', error);
                },
            });
            if (disposed) {
                nextUnsubscribe();
                return;
            }
            unsubscribe = nextUnsubscribe;
        })();

        const interval = window.setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            refreshQuietly();
        }, 10000);

        const handleWindowFocus = () => refreshQuietly();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshQuietly();
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            disposed = true;
            window.clearInterval(interval);
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            unsubscribe?.();
        };
    }, [loadMessages]);

    const activeStageMessage = stageMessageCenter?.queue?.find((entry) => entry.id === stageMessageCenter?.activeMessageId) || null;

    useEffect(() => {
        if (activeStageMessage?.text) {
            setStageAlertDraft(activeStageMessage.text);
            return;
        }
        if (stageAlert?.active && stageAlert?.text) {
            setStageAlertDraft(stageAlert.text);
        }
    }, [activeStageMessage?.id, activeStageMessage?.text, stageAlert?.active, stageAlert?.text]);

    const handleStatusUpdate = async (msgId: number, status: AudienceStatus) => {
        try {
            const res = await updateAudienceMessageStatus(workspaceId, msgId, status, user);
            if (res?.ok) {
                setMessages(prev => prev.map(m => m.id === msgId ? res.message : m));
                if (status === 'projected') {
                    const msg = res.message;
                    const label = msg.submitter_name ? `${CAT_CONFIG[msg.category].label} from ${msg.submitter_name}` : CAT_CONFIG[msg.category].label;

                    // Add to display queue if not already there
                    const inQueue = displayState.queue.some(m => m.id === msg.id);
                    if (!inQueue) {
                        onUpdateDisplay({
                            queue: [...displayState.queue, msg],
                            activeMessageId: msg.id
                        });
                    } else {
                        onUpdateDisplay({ activeMessageId: msg.id });
                    }

                    onProjectRequest(msg.text, label);
                }
            }
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleDelete = async (msgId: number) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            const res = await deleteAudienceMessage(workspaceId, msgId, user);
            if (res?.ok) {
                setMessages(prev => prev.filter(m => m.id !== msgId));
            }
        } catch (err) {
            console.error('Failed to delete message', err);
        }
    };

    const stageQueue = Array.isArray(stageMessageCenter?.queue) ? stageMessageCenter.queue : [];

    const isAdminBroadcastMessage = (message: AudienceMessage) =>
        message.id < 0 && (message.submitter_name || '').trim().toUpperCase() === 'ADMIN';

    const nextLocalBroadcastId = () => {
        const entropy = Math.floor(Math.random() * 1000);
        return -(Date.now() * 1000 + entropy);
    };

    const createBroadcastMessage = (text: string, category: AudienceCategory): AudienceMessage => {
        const now = Date.now();
        const localId = nextLocalBroadcastId();
        return {
            id: localId,
            workspace_id: workspaceId,
            category,
            text: text.trim(),
            submitter_name: 'ADMIN',
            status: 'projected',
            created_at: now,
            updated_at: now,
        };
    };

    const buildDisplayPatchAfterQueueUpdate = (queue: AudienceMessage[], preferredActiveId?: number | null) => {
        const nextActive = typeof preferredActiveId === 'number' && queue.some((entry) => entry.id === preferredActiveId)
            ? preferredActiveId
            : (queue[0]?.id ?? null);
        const nextPinned = typeof displayState.pinnedMessageId === 'number' && queue.some((entry) => entry.id === displayState.pinnedMessageId)
            ? displayState.pinnedMessageId
            : null;
        return {
            queue,
            activeMessageId: nextActive,
            pinnedMessageId: nextPinned,
            tickerEnabled: queue.length > 0 ? displayState.tickerEnabled : false,
        } as Partial<AudienceDisplayState>;
    };

    const rememberBroadcast = (message: AudienceMessage) => {
        setBroadcastHistory((prev) => [message, ...prev.filter((entry) => entry.id !== message.id)].slice(0, 25));
    };

    const pushBroadcastToAudience = (mode: 'ticker' | 'pinned') => {
        const text = broadcastDraft.trim();
        if (!text || !canUseStageAlert) return;
        const message = createBroadcastMessage(text, broadcastCategory);
        const queue = [...displayState.queue, message];
        rememberBroadcast(message);
        if (mode === 'ticker') {
            onUpdateDisplay({
                queue,
                activeMessageId: message.id,
                tickerEnabled: true,
                pinnedMessageId: displayState.pinnedMessageId,
            });
        } else {
            onUpdateDisplay({
                queue,
                activeMessageId: message.id,
                pinnedMessageId: message.id,
                tickerEnabled: false,
            });
        }
        setBroadcastDraft('');
    };

    const removeAdminBroadcast = (messageId: number) => {
        const queue = displayState.queue.filter((entry) => entry.id !== messageId);
        onUpdateDisplay(buildDisplayPatchAfterQueueUpdate(queue, displayState.activeMessageId));
    };

    const removeAllAdminBroadcasts = () => {
        const queue = displayState.queue.filter((entry) => !isAdminBroadcastMessage(entry));
        onUpdateDisplay(buildDisplayPatchAfterQueueUpdate(queue, displayState.activeMessageId));
    };

    const resendFromHistory = (source: AudienceMessage, mode: 'ticker' | 'pinned') => {
        if (!canUseStageAlert) return;
        const message = createBroadcastMessage(source.text, source.category);
        const queue = [...displayState.queue, message];
        rememberBroadcast(message);
        if (mode === 'ticker') {
            onUpdateDisplay({
                queue,
                activeMessageId: message.id,
                tickerEnabled: true,
            });
            return;
        }
        onUpdateDisplay({
            queue,
            activeMessageId: message.id,
            pinnedMessageId: message.id,
            tickerEnabled: false,
        });
    };

    useEffect(() => {
        const existingAdminQueue = displayState.queue.filter(isAdminBroadcastMessage);
        if (!existingAdminQueue.length) return;
        setBroadcastHistory((prev) => {
            const prevIds = new Set(prev.map((entry) => entry.id));
            const incoming = existingAdminQueue.filter((entry) => !prevIds.has(entry.id));
            if (!incoming.length) return prev;
            return [...incoming, ...prev].slice(0, 25);
        });
    }, [displayState.queue]);

    const adminBroadcastQueue = displayState.queue.filter(isAdminBroadcastMessage);

    const pendingSubmissionsCount = messages.filter((m) => m.status === 'pending').length;
    const modeCounts: ModeCounts = {
        broadcast: 0,
        stage: stageQueue.length,
        queue: displayState.queue.length,
        submissions: pendingSubmissionsCount,
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === '1') { setMode('broadcast'); e.preventDefault(); }
            else if (e.key === '2') { setMode('stage'); e.preventDefault(); }
            else if (e.key === '3') { setMode('queue'); e.preventDefault(); }
            else if (e.key === '4') { setMode('submissions'); e.preventDefault(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [setMode]);

    return (
        <div className="flex flex-col h-full min-h-0 bg-zinc-950 text-zinc-300 font-sans">
            {/* Header */}
            <header className="px-3 py-2 border-b border-zinc-900 flex items-center gap-2 bg-zinc-900/30 backdrop-blur-md">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <ChatIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <h2 className="text-[11px] font-black uppercase tracking-wider text-white whitespace-nowrap">Audience</h2>
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20 shrink-0">
                        LIVE
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[9px] text-zinc-500 font-mono hidden sm:block">
                        {new Date(lastRefresh).toLocaleTimeString()}
                    </div>
                    <button
                        onClick={() => {
                            void loadMessages();
                        }}
                        className="p-1 hover:bg-zinc-800 rounded-md transition-all active:scale-90 text-zinc-500 hover:text-white"
                        title="Refresh"
                    >
                        <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <ModeSwitcher
                active={mode}
                onChange={setMode}
                counts={modeCounts}
                pulseSubmissions={pendingSubmissionsCount > 0}
            />

            <div key={mode} className="animate-mode-fade">
            {mode === 'stage' && (
                <StagePanel
                    canUseStageAlert={canUseStageAlert}
                    stageAlert={stageAlert}
                    stageMessageCenter={stageMessageCenter}
                    stageAlertDraft={stageAlertDraft}
                    onStageAlertDraftChange={setStageAlertDraft}
                    stageCategory={stageCategory}
                    onStageCategoryChange={setStageCategory}
                    onQueueStageMessage={onQueueStageMessage}
                    onSendStageMessageNow={onSendStageMessageNow}
                    onPromoteStageMessage={onPromoteStageMessage}
                    onRemoveQueuedStageMessage={onRemoveQueuedStageMessage}
                    onSendStageAlert={onSendStageAlert}
                    onClearStageAlert={onClearStageAlert}
                />
            )}

            {mode === 'queue' && (
                <QueuePanel displayState={displayState} onUpdateDisplay={onUpdateDisplay} />
            )}

            {mode === 'submissions' && (
                <SubmissionsPanel
                    messages={messages}
                    filter={filter}
                    onFilterChange={setFilter}
                    onStatusUpdate={(id, status) => { void handleStatusUpdate(id, status); }}
                    onDelete={(id) => { void handleDelete(id); }}
                />
            )}

            {mode === 'broadcast' && (
                <BroadcastPanel
                    canUseStageAlert={canUseStageAlert}
                    broadcastCategory={broadcastCategory}
                    onBroadcastCategoryChange={setBroadcastCategory}
                    broadcastDraft={broadcastDraft}
                    onBroadcastDraftChange={setBroadcastDraft}
                    broadcastHistory={broadcastHistory}
                    displayState={displayState}
                    adminBroadcastQueue={adminBroadcastQueue}
                    onPushBroadcast={pushBroadcastToAudience}
                    onResendFromHistory={resendFromHistory}
                    onRemoveAdminBroadcast={removeAdminBroadcast}
                    onRemoveAllAdminBroadcasts={removeAllAdminBroadcasts}
                />
            )}
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
        @keyframes modeFadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
        .animate-mode-fade { animation: modeFadeIn 140ms ease-out; }
      `}</style>
        </div>
    );
};
