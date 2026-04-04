import React, { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type {
  MacroDefinition,
  MacroCategory,
  MacroExecutionResult,
  MacroAuditEntry,
} from '../types/macros';
import type { ServiceItem } from '../types';
import { executeMacro, simulateMacro } from '../services/macroEngine';
import type { MacroExecutionContext } from '../services/macroEngine';
import { saveMacro, deleteMacro } from '../services/macroRegistry';
import { getServerApiBaseUrl } from '../services/serverApi';
import { MacroBuilder } from './MacroBuilder';
import { PlusIcon, PlayIcon, EditIcon, TrashIcon, CheckIcon, XIcon } from './Icons';

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<MacroCategory, string> = {
  service_flow: 'Service Flow',
  worship: 'Worship',
  sermon: 'Sermon',
  streaming: 'Streaming',
  emergency: 'Emergency',
  stage: 'Stage',
  output: 'Output',
  media: 'Media',
  custom: 'Custom',
};

const CATEGORY_ORDER: MacroCategory[] = [
  'service_flow', 'worship', 'sermon', 'emergency', 'streaming', 'stage', 'output', 'media', 'custom',
];

// ─── Audit log (session-only, max 20 entries) ─────────────────────────────────

const MAX_AUDIT = 20;

// ─── Status chip ──────────────────────────────────────────────────────────────

const StatusChip: React.FC<{ status: MacroExecutionResult['status'] }> = ({ status }) => {
  const styles: Record<string, string> = {
    success: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50',
    partial: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
    failed: 'bg-red-950/50 text-red-400 border-red-800/50',
    rolled_back: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };
  const labels: Record<string, string> = {
    success: 'OK', partial: 'Partial', failed: 'Failed', rolled_back: 'Rolled back',
  };
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${styles[status] ?? styles.failed}`}>
      {labels[status] ?? status}
    </span>
  );
};

// ─── Confirm modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  macro: MacroDefinition;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ macro, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Confirm</div>
      <div className="mb-1 text-[15px] font-semibold text-zinc-100">{macro.name}</div>
      {macro.description && (
        <p className="mb-4 text-[12px] leading-relaxed text-zinc-400">{macro.description}</p>
      )}
      <p className="mb-4 text-[12px] text-zinc-500">
        This macro has {macro.actions.length} action{macro.actions.length !== 1 ? 's' : ''}. Run it now?
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-[12px] font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Run
        </button>
      </div>
    </div>
  </div>
);

// ─── Macro card ───────────────────────────────────────────────────────────────

interface MacroCardProps {
  macro: MacroDefinition;
  workspaceId: string;
  isRunning: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}

const MacroCard: React.FC<MacroCardProps> = ({
  macro, workspaceId, isRunning, onRun, onEdit, onDelete, onToggleEnabled,
}) => {
  const webhookTriggers = macro.triggers.filter(t => t.type === 'webhook' && typeof t.payload?.key === 'string');
  const serverBase = getServerApiBaseUrl();

  return (
  <div
    className={`rounded-xl border bg-zinc-900/60 p-3 transition-colors ${
      macro.isEnabled ? 'border-zinc-800' : 'border-zinc-800/40 opacity-50'
    }`}
  >
    <div className="flex items-start justify-between gap-2 mb-1.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-zinc-100">{macro.name}</div>
        {macro.description && (
          <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
            {macro.description}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onToggleEnabled}
          className={`rounded-full w-7 h-4 border transition-colors relative ${
            macro.isEnabled ? 'bg-blue-600 border-blue-500' : 'bg-zinc-700 border-zinc-600'
          }`}
          title={macro.isEnabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
              macro.isEnabled ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </button>
      </div>
    </div>

    <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
        {CATEGORY_LABELS[macro.category]}
      </span>
      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
        {macro.actions.length} step{macro.actions.length !== 1 ? 's' : ''}
      </span>
      {macro.triggers[0]?.type !== 'manual' && (
        <span className="rounded-full border border-blue-800/50 bg-blue-950/30 px-1.5 py-0.5 text-[9px] text-blue-400">
          auto
        </span>
      )}
      {macro.requiresConfirmation && (
        <span className="rounded-full border border-amber-800/50 bg-amber-950/30 px-1.5 py-0.5 text-[9px] text-amber-400">
          confirm
        </span>
      )}
    </div>

    {webhookTriggers.length > 0 && (
      <div className="mb-2 flex flex-col gap-1">
        {webhookTriggers.map((t) => {
          const key = t.payload!.key as string;
          const url = `${serverBase}/api/workspaces/${encodeURIComponent(workspaceId)}/macro-trigger/${encodeURIComponent(key)}`;
          return (
            <div key={key} className="flex items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2 py-1">
              <span className="shrink-0 rounded border border-blue-800/50 bg-blue-950/30 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-blue-400">POST</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-zinc-400">{url}</span>
              <button
                onClick={() => void navigator.clipboard.writeText(url)}
                className="shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
                title="Copy URL"
              >
                <CheckIcon className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    )}

    <div className="flex items-center gap-1.5">
      <button
        onClick={onRun}
        disabled={isRunning || !macro.isEnabled}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-blue-600 hover:bg-blue-950/20 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <PlayIcon className="h-3 w-3" />
        {isRunning ? 'Running…' : 'Run'}
      </button>
      {!macro.isTemplate && (
        <>
          <button
            onClick={onEdit}
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors"
            title="Edit"
          >
            <EditIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface MacroPanelProps {
  macros: MacroDefinition[];
  schedule: ServiceItem[];
  workspaceId: string;
  executionContext: MacroExecutionContext;
  auditLog: MacroAuditEntry[];
  onMacrosChange: (macros: MacroDefinition[]) => void;
  onAppendAudit: (entry: MacroAuditEntry) => void;
}

export const MacroPanel: React.FC<MacroPanelProps> = ({
  macros, schedule, workspaceId, executionContext, auditLog, onMacrosChange, onAppendAudit,
}) => {
  const [view, setView] = useState<'library' | 'builder' | 'console'>('library');
  const [editingMacro, setEditingMacro] = useState<MacroDefinition | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [pendingConfirm, setPendingConfirm] = useState<MacroDefinition | null>(null);
  const [filterCategory, setFilterCategory] = useState<MacroCategory | 'all'>('all');

  const appendAudit = onAppendAudit;

  const runMacro = useCallback(async (macro: MacroDefinition) => {
    if (runningIds.has(macro.id)) return;
    setRunningIds(prev => new Set(prev).add(macro.id));
    try {
      const result = await executeMacro(macro, executionContext);
      appendAudit({
        id: nanoid(),
        macroId: macro.id,
        macroName: macro.name,
        triggeredBy: 'manual',
        result,
        workspaceId,
        firedAt: new Date().toISOString(),
      });
    } finally {
      setRunningIds(prev => {
        const next = new Set(prev);
        next.delete(macro.id);
        return next;
      });
    }
  }, [runningIds, executionContext, appendAudit, workspaceId]);

  const handleRunRequest = useCallback((macro: MacroDefinition) => {
    if (macro.requiresConfirmation) {
      setPendingConfirm(macro);
    } else {
      void runMacro(macro);
    }
  }, [runMacro]);

  const handleSaveMacro = useCallback(async (macro: MacroDefinition) => {
    await saveMacro(workspaceId, macro);
    const existing = macros.find(m => m.id === macro.id);
    const next = existing
      ? macros.map(m => (m.id === macro.id ? macro : m))
      : [...macros, macro];
    onMacrosChange(next);
    setEditingMacro(null);
    setView('library');
  }, [workspaceId, macros, onMacrosChange]);

  const handleDelete = useCallback(async (macro: MacroDefinition) => {
    await deleteMacro(workspaceId, macro.id);
    onMacrosChange(macros.filter(m => m.id !== macro.id));
  }, [workspaceId, macros, onMacrosChange]);

  const handleToggleEnabled = useCallback(async (macro: MacroDefinition) => {
    const updated: MacroDefinition = { ...macro, isEnabled: !macro.isEnabled, updatedAt: new Date().toISOString() };
    await saveMacro(workspaceId, updated);
    onMacrosChange(macros.map(m => (m.id === macro.id ? updated : m)));
  }, [workspaceId, macros, onMacrosChange]);

  // Group macros by category (filtered)
  const grouped = React.useMemo(() => {
    const filtered = filterCategory === 'all' ? macros : macros.filter(m => m.category === filterCategory);
    const map = new Map<MacroCategory, MacroDefinition[]>();
    for (const macro of filtered) {
      const list = map.get(macro.category) ?? [];
      list.push(macro);
      map.set(macro.category, list);
    }
    return CATEGORY_ORDER.filter(cat => map.has(cat)).map(cat => ({ cat, macros: map.get(cat)! }));
  }, [macros, filterCategory]);

  return (
    <>
      {pendingConfirm && (
        <ConfirmModal
          macro={pendingConfirm}
          onConfirm={() => { void runMacro(pendingConfirm); setPendingConfirm(null); }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      <div data-testid="macro-panel" className="flex h-full min-h-0 min-w-0 flex-col bg-zinc-950">
        {/* Header */}
        <div className="border-b border-zinc-900 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Macros</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">Show automation.</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-blue-700/60 bg-blue-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-blue-300">
                {macros.filter(m => m.isEnabled).length} active
              </span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-2.5 flex gap-1">
            {(['library', 'console'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={`rounded-lg px-3 py-1 text-[10px] font-semibold capitalize transition-colors ${
                  view === tab
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab === 'console' ? `Log (${auditLog.length})` : 'Library'}
              </button>
            ))}
            <div className="flex-1" />
            {view === 'library' && (
              <button
                onClick={() => { setEditingMacro(null); setView('builder'); }}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300 hover:border-blue-600 hover:text-blue-300 transition-colors"
              >
                <PlusIcon className="h-3 w-3" />
                New
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          {/* Library */}
          {view === 'library' && (
            <div className="px-2.5 py-2.5 flex flex-col gap-4">
              {/* Category filter */}
              {macros.length > 4 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFilterCategory('all')}
                    className={`rounded-full px-2.5 py-0.5 text-[9px] font-semibold border transition-colors ${
                      filterCategory === 'all'
                        ? 'bg-zinc-700 border-zinc-600 text-zinc-200'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    All
                  </button>
                  {CATEGORY_ORDER.filter(c => macros.some(m => m.category === c)).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`rounded-full px-2.5 py-0.5 text-[9px] font-semibold border transition-colors ${
                        filterCategory === cat
                          ? 'bg-zinc-700 border-zinc-600 text-zinc-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              )}

              {grouped.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-10 text-center">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-[0.18em]">No macros yet</div>
                  <button
                    onClick={() => { setEditingMacro(null); setView('builder'); }}
                    className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    + Create your first macro
                  </button>
                </div>
              ) : (
                grouped.map(({ cat, macros: group }) => (
                  <section key={cat}>
                    <div className="mb-1.5 px-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.map(macro => (
                        <MacroCard
                          key={macro.id}
                          macro={macro}
                          workspaceId={workspaceId}
                          isRunning={runningIds.has(macro.id)}
                          onRun={() => handleRunRequest(macro)}
                          onEdit={() => { setEditingMacro(macro); setView('builder'); }}
                          onDelete={() => void handleDelete(macro)}
                          onToggleEnabled={() => void handleToggleEnabled(macro)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}

          {/* Builder */}
          {view === 'builder' && (
            <MacroBuilder
              initial={editingMacro}
              schedule={schedule}
              onSave={macro => void handleSaveMacro(macro)}
              onCancel={() => { setEditingMacro(null); setView('library'); }}
            />
          )}

          {/* Console / Audit log */}
          {view === 'console' && (
            <div className="px-2.5 py-2.5 flex flex-col gap-2">
              {auditLog.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-10 text-center text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  No macros fired this session.
                </div>
              ) : (
                auditLog.map(entry => (
                  <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="truncate text-[12px] font-semibold text-zinc-200">{entry.macroName}</div>
                      <StatusChip status={entry.result.status} />
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(entry.firedAt).toLocaleTimeString()} · {entry.result.durationMs}ms
                      · {entry.result.actionResults.length} actions
                      {entry.triggeredBy !== 'manual' && (
                        <span className="ml-1.5 rounded-full border border-blue-800/40 bg-blue-950/20 px-1.5 py-0.5 text-[8px] text-blue-400">{entry.triggeredBy}</span>
                      )}
                    </div>
                    {entry.result.actionResults.some(r => r.status === 'error') && (
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {entry.result.actionResults
                          .filter(r => r.status === 'error')
                          .map(r => (
                            <div key={r.actionId} className="text-[10px] text-red-400">
                              {r.type}: {r.error}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
