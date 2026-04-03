import React, { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';
import type {
  MacroDefinition,
  MacroAction,
  MacroActionType,
  MacroCategory,
  MacroTriggerType,
} from '../types/macros';
import type { ServiceItem } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ id: MacroCategory; label: string }> = [
  { id: 'service_flow', label: 'Service Flow' },
  { id: 'worship', label: 'Worship' },
  { id: 'sermon', label: 'Sermon' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'stage', label: 'Stage' },
  { id: 'output', label: 'Output' },
  { id: 'media', label: 'Media' },
  { id: 'custom', label: 'Custom' },
];

const TRIGGERS: Array<{ id: MacroTriggerType; label: string; description: string }> = [
  { id: 'manual', label: 'Manual', description: 'Click or keyboard shortcut' },
  { id: 'item_start', label: 'Item Start', description: 'When a run sheet item goes live' },
  { id: 'slide_enter', label: 'Slide Enter', description: 'When a specific slide is shown' },
  { id: 'timer_end', label: 'Timer End', description: 'When the speaker timer reaches zero' },
  { id: 'service_mode_change', label: 'Service Mode', description: 'When service mode changes' },
];

const ACTION_TYPES: Array<{ id: MacroActionType; label: string; group: string }> = [
  { id: 'next_slide', label: 'Next Slide', group: 'Navigation' },
  { id: 'prev_slide', label: 'Previous Slide', group: 'Navigation' },
  { id: 'go_to_item', label: 'Go to Item', group: 'Navigation' },
  { id: 'go_to_slide', label: 'Go to Slide', group: 'Navigation' },
  { id: 'clear_output', label: 'Clear Output', group: 'Output' },
  { id: 'set_theme', label: 'Set Theme', group: 'Output' },
  { id: 'show_message', label: 'Show Stage Message', group: 'Stage' },
  { id: 'hide_message', label: 'Hide Stage Message', group: 'Stage' },
  { id: 'start_timer', label: 'Start Timer', group: 'Timer' },
  { id: 'stop_timer', label: 'Stop Timer', group: 'Timer' },
  { id: 'trigger_aether_scene', label: 'Aether Scene', group: 'Integration' },
  { id: 'wait', label: 'Wait (delay)', group: 'Flow' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionPayloadEditorProps {
  action: MacroAction;
  schedule: ServiceItem[];
  onChange: (updated: MacroAction) => void;
}

const ActionPayloadEditor: React.FC<ActionPayloadEditorProps> = ({ action, schedule, onChange }) => {
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...action, payload: { ...action.payload, ...patch } });

  const p = action.payload as Record<string, unknown>;

  switch (action.type) {
    case 'go_to_item':
      return (
        <select
          className="mt-1.5 w-full rounded bg-zinc-800 px-2 py-1.5 text-[12px] text-zinc-100 border border-zinc-700 outline-none"
          value={String(p.itemId ?? '')}
          onChange={e => {
            const item = schedule.find(i => i.id === e.target.value);
            set({ itemId: e.target.value, itemTitle: item?.title ?? '' });
          }}
        >
          <option value="">— select item —</option>
          {schedule.map(item => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      );

    case 'show_message':
      return (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <input
            className="w-full rounded bg-zinc-800 px-2 py-1.5 text-[12px] text-zinc-100 border border-zinc-700 outline-none placeholder:text-zinc-600"
            placeholder="Stage message text…"
            value={String(p.text ?? '')}
            onChange={e => set({ text: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-500 shrink-0">Duration (ms)</label>
            <input
              type="number"
              className="w-24 rounded bg-zinc-800 px-2 py-1 text-[12px] text-zinc-100 border border-zinc-700 outline-none"
              placeholder="0 = persistent"
              value={p.durationMs !== undefined ? String(p.durationMs) : ''}
              onChange={e => set({ durationMs: e.target.value ? Number(e.target.value) : 0 })}
            />
          </div>
        </div>
      );

    case 'start_timer':
      return (
        <div className="mt-1.5 flex items-center gap-2">
          <label className="text-[10px] text-zinc-500 shrink-0">Duration (sec)</label>
          <input
            type="number"
            className="w-24 rounded bg-zinc-800 px-2 py-1 text-[12px] text-zinc-100 border border-zinc-700 outline-none"
            placeholder="e.g. 2400"
            value={p.durationSec !== undefined ? String(p.durationSec) : ''}
            onChange={e => set({ durationSec: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input
            className="flex-1 rounded bg-zinc-800 px-2 py-1 text-[12px] text-zinc-100 border border-zinc-700 outline-none placeholder:text-zinc-600"
            placeholder="Label (optional)"
            value={String(p.label ?? '')}
            onChange={e => set({ label: e.target.value })}
          />
        </div>
      );

    case 'trigger_aether_scene':
      return (
        <input
          className="mt-1.5 w-full rounded bg-zinc-800 px-2 py-1.5 text-[12px] text-zinc-100 border border-zinc-700 outline-none placeholder:text-zinc-600"
          placeholder="Aether scene name / ID"
          value={String(p.sceneId ?? '')}
          onChange={e => set({ sceneId: e.target.value, sceneName: e.target.value })}
        />
      );

    case 'wait':
      return (
        <div className="mt-1.5 flex items-center gap-2">
          <label className="text-[10px] text-zinc-500 shrink-0">Delay (ms)</label>
          <input
            type="number"
            className="w-28 rounded bg-zinc-800 px-2 py-1 text-[12px] text-zinc-100 border border-zinc-700 outline-none"
            placeholder="e.g. 1000"
            value={p.delayMs !== undefined ? String(p.delayMs) : ''}
            onChange={e => set({ delayMs: e.target.value ? Number(e.target.value) : 0 })}
          />
        </div>
      );

    default:
      return null;
  }
};

interface ActionRowProps {
  action: MacroAction;
  index: number;
  total: number;
  schedule: ServiceItem[];
  onChange: (updated: MacroAction) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({
  action, index, total, schedule, onChange, onRemove, onMoveUp, onMoveDown,
}) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[9px] font-black text-zinc-600 w-4 text-center">{index + 1}</span>
      <select
        className="flex-1 rounded bg-zinc-800 px-2 py-1.5 text-[12px] text-zinc-100 border border-zinc-700 outline-none"
        value={action.type}
        onChange={e => onChange({ ...action, type: e.target.value as MacroActionType, payload: {} })}
      >
        {ACTION_TYPES.map(at => (
          <option key={at.id} value={at.id}>{at.group} — {at.label}</option>
        ))}
      </select>
      <button
        onClick={onMoveUp}
        disabled={index === 0}
        className="shrink-0 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors px-1"
        title="Move up"
      >↑</button>
      <button
        onClick={onMoveDown}
        disabled={index === total - 1}
        className="shrink-0 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors px-1"
        title="Move down"
      >↓</button>
      <button
        onClick={onRemove}
        className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors px-1"
        title="Remove action"
      >✕</button>
    </div>
    <ActionPayloadEditor action={action} schedule={schedule} onChange={onChange} />
    <div className="mt-2 flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
        <input
          type="checkbox"
          className="accent-blue-500"
          checked={action.continueOnError ?? false}
          onChange={e => onChange({ ...action, continueOnError: e.target.checked })}
        />
        Continue on error
      </label>
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] text-zinc-500 shrink-0">Delay before (ms)</label>
        <input
          type="number"
          className="w-20 rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-100 border border-zinc-700 outline-none"
          placeholder="0"
          value={action.delayMs !== undefined ? String(action.delayMs) : ''}
          onChange={e => onChange({ ...action, delayMs: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface MacroBuilderProps {
  initial?: MacroDefinition | null;
  schedule: ServiceItem[];
  onSave: (macro: MacroDefinition) => void;
  onCancel: () => void;
}

export const MacroBuilder: React.FC<MacroBuilderProps> = ({
  initial, schedule, onSave, onCancel,
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<MacroCategory>(initial?.category ?? 'service_flow');
  const [triggerType, setTriggerType] = useState<MacroTriggerType>(
    initial?.triggers[0]?.type ?? 'manual',
  );
  const [actions, setActions] = useState<MacroAction[]>(initial?.actions ?? []);
  const [requiresConfirmation, setRequiresConfirmation] = useState(
    initial?.requiresConfirmation ?? false,
  );

  const addAction = useCallback(() => {
    setActions(prev => [
      ...prev,
      { id: nanoid(), type: 'next_slide', payload: {} },
    ]);
  }, []);

  const updateAction = useCallback((index: number, updated: MacroAction) => {
    setActions(prev => prev.map((a, i) => (i === index ? updated : a)));
  }, []);

  const removeAction = useCallback((index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveAction = useCallback((index: number, direction: -1 | 1) => {
    setActions(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const macro: MacroDefinition = {
      id: initial?.id ?? nanoid(),
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      scope: 'workspace',
      triggers: [{ type: triggerType }],
      actions,
      tags: initial?.tags ?? [],
      isEnabled: initial?.isEnabled ?? true,
      requiresConfirmation,
      isTemplate: false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(macro);
  };

  const isValid = name.trim().length > 0 && actions.length > 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Name + Category */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Details</div>
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
          placeholder="Macro name…"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="text-[10px] text-zinc-500 shrink-0">Category</label>
          <select
            className="flex-1 rounded bg-zinc-800 px-2 py-1.5 text-[12px] text-zinc-100 border border-zinc-700 outline-none"
            value={category}
            onChange={e => setCategory(e.target.value as MacroCategory)}
          >
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Trigger */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Trigger</div>
        <div className="flex flex-wrap gap-1.5">
          {TRIGGERS.map(t => (
            <button
              key={t.id}
              onClick={() => setTriggerType(t.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-colors ${
                triggerType === t.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
              title={t.description}
            >
              {t.label}
            </button>
          ))}
        </div>
        {triggerType !== 'manual' && (
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            {TRIGGERS.find(t => t.id === triggerType)?.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Actions <span className="text-zinc-600 font-normal normal-case tracking-normal">({actions.length})</span>
          </div>
          <button
            onClick={addAction}
            className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[10px] text-zinc-300 hover:border-blue-600 hover:text-blue-300 transition-colors"
          >
            + Add action
          </button>
        </div>
        {actions.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-zinc-600">
            No actions yet — add one above.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {actions.map((action, i) => (
              <ActionRow
                key={action.id}
                action={action}
                index={i}
                total={actions.length}
                schedule={schedule}
                onChange={updated => updateAction(i, updated)}
                onRemove={() => removeAction(i)}
                onMoveUp={() => moveAction(i, -1)}
                onMoveDown={() => moveAction(i, 1)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-2">Options</div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={requiresConfirmation}
            onChange={e => setRequiresConfirmation(e.target.checked)}
          />
          Require confirmation before running
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-[12px] font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {initial ? 'Save changes' : 'Create macro'}
        </button>
      </div>
    </div>
  );
};
