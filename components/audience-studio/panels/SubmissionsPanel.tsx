import React from 'react';
import { AudienceMessage } from '../../../services/serverApi';
import { AudienceStatus } from '../../../types';
import {
  ChatIcon,
  TrashIcon,
  PlayIcon,
  CheckIcon,
  XIcon,
} from '../../Icons';
import { CAT_CONFIG } from '../constants';

type Filter = AudienceStatus | 'all';

const FILTERS: ReadonlyArray<Filter> = ['all', 'pending', 'approved', 'projected', 'dismissed'];

interface SubmissionsPanelProps {
  messages: AudienceMessage[];
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onStatusUpdate: (msgId: number, status: AudienceStatus) => void;
  onDelete: (msgId: number) => void;
}

export function SubmissionsPanel({
  messages,
  filter,
  onFilterChange,
  onStatusUpdate,
  onDelete,
}: SubmissionsPanelProps) {
  return (
    <>
      <div className="p-3 sm:p-4 pb-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`w-full px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border truncate ${
                filter === f
                  ? 'bg-blue-600 text-white border-transparent shadow-lg shadow-blue-900/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 pb-24 md:pb-4 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-20">
            <ChatIcon className="w-12 h-12 mb-4" />
            <p className="text-xs uppercase tracking-[0.2em]">No messages found</p>
          </div>
        ) : (
          messages.map((msg) => {
            const config = CAT_CONFIG[msg.category];
            const Icon = config.icon;

            return (
              <div
                key={msg.id}
                className={`group relative bg-zinc-900/40 border ${config.border} rounded-xl p-4 transition-all hover:bg-zinc-900/60 overflow-hidden animate-in slide-in-from-bottom-2 duration-300`}
              >
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.07]">
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

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                      {msg.status === 'pending' && (
                        <button
                          onClick={() => onStatusUpdate(msg.id, 'approved')}
                          className="flex items-center gap-1.5 bg-zinc-800 hover:bg-emerald-600/20 text-emerald-500 border border-zinc-700 hover:border-emerald-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                          APPROVE
                        </button>
                      )}

                      {(msg.status === 'pending' || msg.status === 'approved' || msg.status === 'projected') && (
                        <button
                          onClick={() => onStatusUpdate(msg.id, 'projected')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 border ${
                            msg.status === 'projected'
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
                          onClick={() => onStatusUpdate(msg.id, 'dismissed')}
                          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded-lg transition-all active:scale-90"
                          title="Dismiss"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(msg.id)}
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
    </>
  );
}
