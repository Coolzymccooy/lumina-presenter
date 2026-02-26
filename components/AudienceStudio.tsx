import React, { useState, useEffect, useCallback } from 'react';
import {
    AudienceMessage,
    fetchAudienceMessages,
    updateAudienceMessageStatus,
    deleteAudienceMessage,
    AudienceCategory,
    AudienceStatus
} from '../services/serverApi';
import {
    ChatIcon,
    SparklesIcon,
    HelpIcon,
    HeartIcon,
    UserIcon,
    TrashIcon,
    PlayIcon,
    CheckIcon,
    RefreshIcon,
    XIcon
} from './Icons';

interface AudienceStudioProps {
    workspaceId: string;
    user: any;
    onProjectRequest: (text: string, label?: string) => void;
}

const CAT_CONFIG: Record<AudienceCategory, { label: string; icon: any; color: string; border: string; bg: string }> = {
    qa: { label: 'Q&A', icon: HelpIcon, color: 'text-blue-400', border: 'border-blue-900/30', bg: 'bg-blue-950/20' },
    prayer: { label: 'Prayer', icon: HeartIcon, color: 'text-rose-400', border: 'border-rose-900/30', bg: 'bg-rose-950/20' },
    testimony: { label: 'Testimony', icon: SparklesIcon, color: 'text-purple-400', border: 'border-purple-900/30', bg: 'bg-purple-950/20' },
    welcome: { label: 'Welcome', icon: UserIcon, color: 'text-emerald-400', border: 'border-emerald-900/30', bg: 'bg-emerald-950/20' },
    poll: { label: 'Poll', icon: ChatIcon, color: 'text-amber-400', border: 'border-amber-900/30', bg: 'bg-amber-950/20' },
};

export const AudienceStudio: React.FC<AudienceStudioProps> = ({ workspaceId, user, onProjectRequest }) => {
    const [messages, setMessages] = useState<AudienceMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<AudienceStatus | 'all'>('pending');
    const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

    const loadMessages = useCallback(async () => {
        if (!user) return;
        setLoading(true);
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
            setLoading(false);
        }
    }, [workspaceId, user, filter]);

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 5000);
        return () => clearInterval(interval);
    }, [loadMessages]);

    const handleStatusUpdate = async (msgId: number, status: AudienceStatus) => {
        try {
            const res = await updateAudienceMessageStatus(workspaceId, msgId, status, user);
            if (res?.ok) {
                setMessages(prev => prev.map(m => m.id === msgId ? res.message : m));
                if (status === 'projected') {
                    const msg = res.message;
                    const label = msg.submitter_name ? `${CAT_CONFIG[msg.category].label} from ${msg.submitter_name}` : CAT_CONFIG[msg.category].label;
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

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-sans">
            {/* Header */}
            <header className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/30 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <ChatIcon className="w-5 h-5 text-blue-500" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Audience Studio</h2>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 ml-2">
                        LIVE
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-[9px] text-zinc-500 font-mono">
                        LAST UPDATE: {new Date(lastRefresh).toLocaleTimeString()}
                    </div>
                    <button
                        onClick={loadMessages}
                        className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-500 hover:text-white"
                    >
                        <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="p-4 flex gap-2 overflow-x-auto pb-0">
                {(['all', 'pending', 'approved', 'projected', 'dismissed'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${filter === f
                                ? 'bg-blue-600 text-white border-transparent shadow-lg shadow-blue-900/20'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-20">
                        <ChatIcon className="w-12 h-12 mb-4" />
                        <p className="text-xs uppercase tracking-[0.2em]">No messages found</p>
                    </div>
                ) : (
                    messages.map(msg => {
                        const config = CAT_CONFIG[msg.category];
                        const Icon = config.icon;

                        return (
                            <div
                                key={msg.id}
                                className={`group relative bg-zinc-900/40 border ${config.border} rounded-xl p-4 transition-all hover:bg-zinc-900/60 overflow-hidden animate-in slide-in-from-bottom-2 duration-300`}
                            >
                                {/* Background Decor */}
                                <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.07]`}>
                                    <Icon className="w-32 h-32" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${config.bg}`}>
                                                <Icon className={`w-4 h-4 ${config.color}`} />
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${config.color}`}>
                                                {config.label}
                                            </span>
                                            {msg.submitter_name && (
                                                <>
                                                    <span className="text-zinc-700 text-[10px]">•</span>
                                                    <span className="text-[10px] font-bold text-zinc-400 capitalize">
                                                        {msg.submitter_name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-zinc-600 font-mono">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <p className="text-sm text-zinc-200 leading-relaxed font-medium mb-4 pr-12">
                                        "{msg.text}"
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                            {msg.status === 'pending' && (
                                                <button
                                                    onClick={() => handleStatusUpdate(msg.id, 'approved')}
                                                    className="flex items-center gap-1.5 bg-zinc-800 hover:bg-emerald-600/20 text-emerald-500 border border-zinc-700 hover:border-emerald-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                                                >
                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                    APPROVE
                                                </button>
                                            )}

                                            {(msg.status === 'pending' || msg.status === 'approved' || msg.status === 'projected') && (
                                                <button
                                                    onClick={() => handleStatusUpdate(msg.id, 'projected')}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 border ${msg.status === 'projected'
                                                            ? 'bg-amber-600 text-white border-transparent animate-pulse'
                                                            : 'bg-zinc-800 hover:bg-blue-600/20 text-blue-500 border-zinc-700 hover:border-blue-500/30'
                                                        }`}
                                                >
                                                    <PlayIcon className="w-3.5 h-3.5" />
                                                    {msg.status === 'projected' ? 'PROJECTING...' : 'PROJECT NOW'}
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-1.5">
                                            {msg.status !== 'dismissed' && (
                                                <button
                                                    onClick={() => handleStatusUpdate(msg.id, 'dismissed')}
                                                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded-lg transition-all active:scale-90"
                                                    title="Dismiss"
                                                >
                                                    <XIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(msg.id)}
                                                className="p-1.5 bg-zinc-800 hover:bg-rose-950/40 text-rose-900 hover:text-rose-500 rounded-lg transition-all active:scale-90"
                                                title="Delete"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
        </div>
    );
};
