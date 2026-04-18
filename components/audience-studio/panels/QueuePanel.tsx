import React from 'react';
import { AudienceDisplayState } from '../../../types';
import { CAT_CONFIG } from '../constants';

interface QueuePanelProps {
  displayState: AudienceDisplayState;
  onUpdateDisplay: (patch: Partial<AudienceDisplayState>) => void;
}

export function QueuePanel({ displayState, onUpdateDisplay }: QueuePanelProps) {
  return (
    <div className="px-3 sm:px-4 py-3 border-b border-zinc-900 bg-zinc-900/10 space-y-3 max-h-[48vh] overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Pin Visible</span>
          <div
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${displayState.pinnedMessageId ? 'bg-blue-600' : 'bg-zinc-800'}`}
            onClick={() => onUpdateDisplay({ pinnedMessageId: displayState.pinnedMessageId ? null : displayState.activeMessageId })}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${displayState.pinnedMessageId ? 'left-4' : 'left-0.5'}`} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Ticker Running</span>
          <div
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${displayState.tickerEnabled ? 'bg-blue-600' : 'bg-zinc-800'}`}
            onClick={() => onUpdateDisplay({ tickerEnabled: !displayState.tickerEnabled })}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${displayState.tickerEnabled ? 'left-4' : 'left-0.5'}`} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center justify-between gap-2 min-w-[180px] flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Auto-Rotate</span>
          <div
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${displayState.autoRotate ? 'bg-blue-600' : 'bg-zinc-800'}`}
            onClick={() => onUpdateDisplay({ autoRotate: !displayState.autoRotate })}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${displayState.autoRotate ? 'left-4' : 'left-0.5'}`} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <input
            type="number"
            value={displayState.rotateSeconds}
            onChange={(e) => onUpdateDisplay({ rotateSeconds: parseInt(e.target.value) || 5 })}
            className="w-10 bg-zinc-800 border border-zinc-700 rounded text-[10px] px-1 py-0.5 text-white font-mono text-center"
          />
          <span className="text-[9px] text-zinc-600 uppercase">SEC</span>
        </div>
      </div>

      {displayState.queue.length > 0 && (
        <div className="bg-black/20 rounded-lg p-2 border border-zinc-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{displayState.queue.length} messages in queue</span>
            <button
              onClick={() => onUpdateDisplay({ queue: [], activeMessageId: null, pinnedMessageId: null })}
              className="px-2 py-0.5 text-[9px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 uppercase font-black rounded border border-rose-900/60 transition-all active:scale-95"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {displayState.queue.map((m, idx) => {
              const isActive = displayState.activeMessageId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => onUpdateDisplay({ activeMessageId: m.id })}
                  className={`flex items-start gap-2 p-2 rounded border transition-all cursor-pointer active:scale-[0.99] ${isActive ? 'bg-blue-600/15 border-blue-500/50 shadow-sm shadow-blue-500/20' : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60'}`}
                >
                  <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${isActive ? 'bg-blue-500 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-700'}`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${isActive ? 'text-blue-200' : 'text-zinc-300'}`}>
                        {m.submitter_name || CAT_CONFIG[m.category].label}
                      </span>
                      <span className="text-[8px] text-zinc-600 uppercase shrink-0">
                        {CAT_CONFIG[m.category].label}
                      </span>
                      {isActive && (
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest shrink-0 ml-auto">
                          ● Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 leading-snug line-clamp-2 italic">"{m.text}"</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
