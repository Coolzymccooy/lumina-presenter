import React from 'react';
import { StageAlertState, StageMessageCategory, StageMessageCenterState } from '../../../types';
import { STAGE_TEMPLATES } from '../constants';

interface StagePanelProps {
  canUseStageAlert: boolean;
  stageAlert: StageAlertState;
  stageMessageCenter: StageMessageCenterState;
  stageAlertDraft: string;
  onStageAlertDraftChange: (value: string) => void;
  stageCategory: StageMessageCategory;
  onStageCategoryChange: (cat: StageMessageCategory) => void;
  onQueueStageMessage: (payload: { text: string; category: StageMessageCategory; priority?: 'normal' | 'high'; templateKey?: string }) => void;
  onSendStageMessageNow: (payload: { text: string; category: StageMessageCategory; priority?: 'normal' | 'high'; templateKey?: string }) => void;
  onPromoteStageMessage: (messageId: string) => void;
  onRemoveQueuedStageMessage: (messageId: string) => void;
  onSendStageAlert: (text: string) => void;
  onClearStageAlert: () => void;
}

export function StagePanel({
  canUseStageAlert,
  stageAlert,
  stageMessageCenter,
  stageAlertDraft,
  onStageAlertDraftChange,
  stageCategory,
  onStageCategoryChange,
  onQueueStageMessage,
  onSendStageMessageNow,
  onPromoteStageMessage,
  onRemoveQueuedStageMessage,
  onSendStageAlert,
  onClearStageAlert,
}: StagePanelProps) {
  const stageQueue = Array.isArray(stageMessageCenter?.queue) ? stageMessageCenter.queue : [];
  const activeStageId = stageMessageCenter?.activeMessageId || null;
  const activeStageIdx = activeStageId ? stageQueue.findIndex((entry) => entry.id === activeStageId) : -1;
  const stageTemplates = STAGE_TEMPLATES;

  return (
    <div className="px-3 sm:px-4 py-3 border-b border-zinc-900 bg-zinc-900/10 space-y-3 max-h-[48vh] overflow-y-auto custom-scrollbar">
      <div className="bg-black/20 rounded-lg p-2 border border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Pastor Message Center (Stage Only)</span>
          <span className={`text-[9px] font-black uppercase tracking-widest ${canUseStageAlert ? 'text-emerald-400' : 'text-rose-400'}`}>
            Admin allowlisted: {canUseStageAlert ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-1">
          {(['urgent', 'timing', 'logistics'] as StageMessageCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => onStageCategoryChange(cat)}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                stageCategory === cat
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {stageTemplates[stageCategory].map((template) => (
            <button
              key={template.key}
              onClick={() => onStageAlertDraftChange(template.label)}
              disabled={!canUseStageAlert}
              className="px-2 py-1 rounded-md text-[10px] font-bold border border-zinc-700 text-zinc-300 hover:border-amber-500/60 hover:text-amber-200 disabled:opacity-40"
            >
              {template.label}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={stageAlertDraft}
          onChange={(e) => onStageAlertDraftChange(e.target.value)}
          placeholder={canUseStageAlert ? 'Send private alert to stage display...' : 'Only allowlisted admin can send stage alerts.'}
          disabled={!canUseStageAlert}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-600 disabled:opacity-60 resize-none"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              const text = stageAlertDraft.trim();
              if (!text) return;
              onQueueStageMessage({ text, category: stageCategory, priority: stageCategory === 'urgent' ? 'high' : 'normal' });
              onStageAlertDraftChange('');
            }}
            disabled={!canUseStageAlert || !stageAlertDraft.trim()}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold border border-zinc-700 text-zinc-200 disabled:opacity-40 hover:border-zinc-600"
          >
            QUEUE
          </button>
          <button
            onClick={() => {
              const text = stageAlertDraft.trim();
              if (!text) return;
              onSendStageMessageNow({ text, category: stageCategory, priority: stageCategory === 'urgent' ? 'high' : 'normal' });
              onStageAlertDraftChange('');
            }}
            disabled={!canUseStageAlert || !stageAlertDraft.trim()}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold border border-transparent bg-amber-600 text-white disabled:opacity-40"
          >
            SEND NOW
          </button>
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              onStageAlertDraftChange('');
              onClearStageAlert();
            }}
            disabled={!canUseStageAlert || !stageAlert?.active}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold border border-zinc-700 text-zinc-400 disabled:opacity-40 hover:border-zinc-600"
          >
            CLEAR ACTIVE
          </button>
          <button
            onClick={() => onSendStageAlert(stageAlertDraft)}
            disabled={!canUseStageAlert || !stageAlertDraft.trim()}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold border border-zinc-700 text-zinc-300 disabled:opacity-40"
          >
            LEGACY SEND
          </button>
        </div>
        {stageQueue.length > 0 && (
          <div className="mt-2 border border-zinc-800 rounded-md p-2 bg-zinc-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                Queue {activeStageIdx >= 0 ? `${activeStageIdx + 1}/${stageQueue.length}` : `0/${stageQueue.length}`}
              </span>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scrollbar">
              {stageQueue.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-1.5 rounded border ${entry.id === activeStageId ? 'border-amber-500/60 bg-amber-900/20' : 'border-zinc-800 bg-zinc-950/60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-zinc-400">
                        {entry.category} {entry.priority === 'high' ? '• HIGH' : ''}
                      </div>
                      <div className="text-[11px] text-zinc-200 truncate">{entry.text}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.id !== activeStageId && (
                        <button
                          onClick={() => onPromoteStageMessage(entry.id)}
                          className="px-1.5 py-0.5 text-[9px] font-bold border border-zinc-700 rounded text-zinc-200"
                        >
                          Promote
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveQueuedStageMessage(entry.id)}
                        className="px-1.5 py-0.5 text-[9px] font-bold border border-rose-900/70 rounded text-rose-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
