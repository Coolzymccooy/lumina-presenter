import React from 'react';
import { AudienceCategory, AudienceDisplayState } from '../../../types';
import { AudienceMessage } from '../../../services/serverApi';

interface BroadcastPanelProps {
  canUseStageAlert: boolean;
  broadcastCategory: AudienceCategory;
  onBroadcastCategoryChange: (cat: AudienceCategory) => void;
  broadcastDraft: string;
  onBroadcastDraftChange: (value: string) => void;
  broadcastHistory: AudienceMessage[];
  displayState: AudienceDisplayState;
  adminBroadcastQueue: AudienceMessage[];
  onPushBroadcast: (mode: 'ticker' | 'pinned') => void;
  onResendFromHistory: (source: AudienceMessage, mode: 'ticker' | 'pinned') => void;
  onRemoveAdminBroadcast: (messageId: number) => void;
  onRemoveAllAdminBroadcasts: () => void;
}

const BROADCAST_QUICK_TEMPLATES = [
  'Scan the QR code to submit prayer requests and questions.',
  'Please include your name with your message.',
  'We are receiving live testimonies now. Scan and share.',
];

export function BroadcastPanel({
  canUseStageAlert,
  broadcastCategory,
  onBroadcastCategoryChange,
  broadcastDraft,
  onBroadcastDraftChange,
  broadcastHistory,
  displayState,
  adminBroadcastQueue,
  onPushBroadcast,
  onResendFromHistory,
  onRemoveAdminBroadcast,
  onRemoveAllAdminBroadcasts,
}: BroadcastPanelProps) {
  return (
    <div className="px-3 sm:px-4 py-3 border-b border-zinc-900 bg-zinc-900/10 space-y-3 max-h-[48vh] overflow-y-auto custom-scrollbar">
      <div className="bg-black/20 rounded-lg p-2 border border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Audience Broadcast (Ticker/Pin)</span>
          <span className={`text-[9px] font-black uppercase tracking-widest ${canUseStageAlert ? 'text-emerald-400' : 'text-rose-400'}`}>
            Admin allowlisted: {canUseStageAlert ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(['welcome', 'qa', 'prayer', 'testimony', 'poll'] as AudienceCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => onBroadcastCategoryChange(cat)}
              disabled={!canUseStageAlert}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all duration-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                broadcastCategory === cat
                  ? 'bg-blue-600/25 border-blue-500/60 text-blue-200 shadow-sm shadow-blue-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {BROADCAST_QUICK_TEMPLATES.map((template) => (
            <button
              key={template}
              onClick={() => onBroadcastDraftChange(template)}
              disabled={!canUseStageAlert}
              className="px-2 py-1 rounded-md text-[10px] font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:border-blue-500/60 hover:text-blue-200 active:scale-95 active:bg-blue-600/10 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {template.length > 30 ? `${template.slice(0, 30)}...` : template}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={broadcastDraft}
          onChange={(e) => onBroadcastDraftChange(e.target.value)}
          placeholder={canUseStageAlert ? 'Broadcast audience message (ticker or pinned)...' : 'Only allowlisted admin can broadcast audience notices.'}
          disabled={!canUseStageAlert}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-600 disabled:opacity-60 resize-none"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => onPushBroadcast('ticker')}
            disabled={!canUseStageAlert || !broadcastDraft.trim()}
            className="px-3 py-2 rounded-md text-[10px] font-black tracking-wider bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 active:scale-[0.96] active:bg-blue-700 active:shadow-inner transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            SEND TO TICKER
          </button>
          <button
            onClick={() => onPushBroadcast('pinned')}
            disabled={!canUseStageAlert || !broadcastDraft.trim()}
            className="px-3 py-2 rounded-md text-[10px] font-black tracking-wider bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-500 hover:text-white active:scale-[0.96] active:bg-zinc-900 active:shadow-inner transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            SHOW PINNED
          </button>
        </div>
        <div className="mt-2 border border-zinc-800 rounded-md p-2 bg-zinc-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
              Broadcast History ({broadcastHistory.length})
            </span>
            <button
              onClick={onRemoveAllAdminBroadcasts}
              disabled={!canUseStageAlert || adminBroadcastQueue.length === 0}
              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider border border-rose-900/70 rounded text-rose-300 hover:bg-rose-500/10 hover:border-rose-700 hover:text-rose-200 active:scale-95 active:bg-rose-500/20 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Remove All
            </button>
          </div>
          {broadcastHistory.length === 0 ? (
            <div className="text-[10px] text-zinc-600">No admin broadcasts sent yet.</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {broadcastHistory.map((entry) => {
                const inQueue = displayState.queue.some((message) => message.id === entry.id);
                return (
                  <div key={entry.id} className="p-2 rounded border border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] uppercase tracking-wider font-black text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 shrink-0">
                        {entry.category}
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-widest shrink-0 ${inQueue ? 'text-emerald-400' : 'text-zinc-600'}`}>
                        {inQueue ? '● Live' : 'Archived'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-200 leading-snug mb-2 line-clamp-2">
                      {entry.text}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => onResendFromHistory(entry, 'ticker')}
                        disabled={!canUseStageAlert}
                        className="flex-1 min-w-[60px] px-2 py-1 text-[9px] font-black uppercase tracking-wider border border-zinc-700 bg-zinc-900 rounded text-zinc-200 hover:bg-blue-600/20 hover:border-blue-500/60 hover:text-blue-200 active:scale-[0.94] active:bg-blue-600/40 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        Ticker
                      </button>
                      <button
                        onClick={() => onResendFromHistory(entry, 'pinned')}
                        disabled={!canUseStageAlert}
                        className="flex-1 min-w-[60px] px-2 py-1 text-[9px] font-black uppercase tracking-wider border border-zinc-700 bg-zinc-900 rounded text-zinc-200 hover:bg-amber-600/20 hover:border-amber-500/60 hover:text-amber-200 active:scale-[0.94] active:bg-amber-600/40 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        Pin
                      </button>
                      {inQueue && (
                        <button
                          onClick={() => onRemoveAdminBroadcast(entry.id)}
                          disabled={!canUseStageAlert}
                          className="flex-1 min-w-[60px] px-2 py-1 text-[9px] font-black uppercase tracking-wider border border-rose-900/70 bg-rose-950/40 rounded text-rose-300 hover:bg-rose-500/20 hover:border-rose-600 hover:text-rose-100 active:scale-[0.94] active:bg-rose-600/40 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
