import React from 'react';
import type { ServiceItem, SpeakerTimerPreset } from '../../types';

interface BuilderCuePanelProps {
  item: ServiceItem | null;
  speakerPresets: SpeakerTimerPreset[];
  onUpdateItem: (item: ServiceItem) => void;
  surface?: 'drawer' | 'rail';
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-[8px] font-black uppercase tracking-[0.18em] text-zinc-300">{children}</label>
);

const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

export const BuilderCuePanel: React.FC<BuilderCuePanelProps> = ({
  item,
  speakerPresets,
  onUpdateItem,
  surface = 'rail',
}) => {
  const timerCue = item?.timerCue || { enabled: false, durationSec: 300 };
  const [selectedPresetId, setSelectedPresetId] = React.useState(timerCue.presetId || '');
  React.useEffect(() => {
    setSelectedPresetId(timerCue.presetId || '');
  }, [timerCue.presetId]);

  if (!item) {
    return (
      <div data-testid="builder-cue-panel" className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
        Select an item
      </div>
    );
  }

  const updateTimerCue = (patch: Partial<NonNullable<ServiceItem['timerCue']>>) => {
    onUpdateItem({
      ...item,
      timerCue: {
        ...timerCue,
        ...patch,
      },
    });
  };

  const applyPreset = (presetId = selectedPresetId) => {
    const preset = speakerPresets.find((entry) => entry.id === presetId);
    if (!preset) return updateTimerCue({ presetId: '' });
    updateTimerCue({
      enabled: true,
      presetId: preset.id,
      durationSec: preset.durationSec,
      speakerName: preset.speakerName || timerCue.speakerName || '',
      autoStartNext: preset.autoStartNextDefault,
      amberPercent: preset.amberPercent,
      redPercent: preset.redPercent,
    });
  };

  const durationSeconds = Math.max(10, Math.round(timerCue.durationSec || 300));
  const amber = clampNumber(Number(timerCue.amberPercent ?? 25), 1, 99, 25);
  const red = clampNumber(Number(timerCue.redPercent ?? 10), 1, 99, 10);
  const drawer = surface === 'drawer';

  if (drawer) {
    return (
      <div
        data-testid="builder-cue-panel"
        className="grid h-full min-h-0 grid-cols-[136px_minmax(132px,1fr)_58px_124px_minmax(132px,1fr)_70px_120px] items-center gap-1.5"
      >
        <label className="flex h-[54px] items-center gap-2 rounded-lg border border-zinc-600/80 bg-[#15161b] px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <input
            type="checkbox"
            checked={!!timerCue.enabled}
            onChange={(event) => updateTimerCue({ enabled: event.target.checked })}
            className="h-4 w-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200">Cue Timer</span>
            <span className="mt-0.5 block truncate text-[9px] text-zinc-400">{timerCue.enabled ? 'Enabled' : 'Disabled'}</span>
          </span>
        </label>

        <div className="min-w-0">
          <FieldLabel>Speaker Preset</FieldLabel>
          <select
            className="h-9 w-full rounded-lg border border-zinc-600 bg-[#090a0f] px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
            value={selectedPresetId}
            onChange={(event) => {
              setSelectedPresetId(event.target.value);
              if (!event.target.value) updateTimerCue({ presetId: '' });
            }}
          >
            <option value="">None</option>
            {speakerPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => applyPreset()}
          disabled={!selectedPresetId}
          className="h-9 rounded-lg border border-zinc-600 bg-zinc-800 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply
        </button>

        <div>
          <FieldLabel>Duration (Sec)</FieldLabel>
          <input
            type="number"
            min={10}
            max={7200}
            className="h-9 w-full rounded-lg border border-zinc-600 bg-[#090a0f] px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
            value={durationSeconds}
            onChange={(event) => updateTimerCue({ durationSec: clampNumber(Number(event.target.value), 10, 7200, durationSeconds) })}
          />
        </div>

        <div className="min-w-0">
          <FieldLabel>Speaker</FieldLabel>
          <input
            className="h-9 w-full rounded-lg border border-zinc-600 bg-[#090a0f] px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
            value={timerCue.speakerName || ''}
            onChange={(event) => updateTimerCue({ speakerName: event.target.value })}
            placeholder="Optional speaker name"
          />
        </div>

        <label className="flex h-[54px] items-center gap-2 rounded-lg border border-zinc-600/80 bg-[#15161b] px-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <input
            type="checkbox"
            checked={!!timerCue.autoStartNext}
            onChange={(event) => updateTimerCue({ autoStartNext: event.target.checked })}
            className="h-4 w-4 shrink-0"
          />
          Auto Next
        </label>

        <div className="rounded-lg border border-zinc-600/80 bg-[#15161b] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="mb-1 text-center text-[8px] font-black uppercase tracking-[0.18em] text-zinc-300">Cue Thresholds</div>
          <div className="grid grid-cols-2 items-end gap-1.5">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-center text-[8px] font-black uppercase tracking-[0.14em] text-amber-400">Amber %</span>
              <input
                type="number"
                min={1}
                max={99}
                value={amber}
                onChange={(event) => updateTimerCue({ amberPercent: clampNumber(Number(event.target.value), 1, 99, amber) })}
                className="h-7 w-full rounded-lg border border-amber-800/70 bg-[#090a0f] px-1 text-center text-xs tabular-nums text-amber-100 outline-none focus:border-amber-500"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-center text-[8px] font-black uppercase tracking-[0.14em] text-red-300">Red %</span>
              <input
                type="number"
                min={1}
                max={99}
                value={red}
                onChange={(event) => updateTimerCue({ redPercent: clampNumber(Number(event.target.value), 1, 99, red) })}
                className="h-7 w-full rounded-lg border border-red-800/70 bg-[#090a0f] px-1 text-center text-xs tabular-nums text-red-100 outline-none focus:border-red-500"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="builder-cue-panel"
      className="space-y-2"
    >
      <label className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">Timer Cue</span>
          <span className="mt-0.5 block truncate text-[9px] text-zinc-600">{timerCue.enabled ? 'Enabled' : 'Off for this item'}</span>
        </span>
        <input
          type="checkbox"
          checked={!!timerCue.enabled}
          onChange={(event) => updateTimerCue({ enabled: event.target.checked })}
          className="h-4 w-4 shrink-0"
        />
      </label>

      <div className={drawer ? 'min-w-0' : ''}>
        <FieldLabel>Preset</FieldLabel>
        {!!speakerPresets.length ? (
          <select
            className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
            value={selectedPresetId}
            onChange={(event) => {
              setSelectedPresetId(event.target.value);
              applyPreset(event.target.value);
            }}
          >
            <option value="">Custom</option>
            {speakerPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        ) : (
          <div className="flex h-9 items-center rounded-lg border border-zinc-800 bg-black px-2 text-[10px] font-semibold text-zinc-600">
            Custom
          </div>
        )}
      </div>

      <div>
        <FieldLabel>Duration (Sec)</FieldLabel>
        <input
          type="number"
          min={10}
          max={7200}
          className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
          value={durationSeconds}
          onChange={(event) => updateTimerCue({ durationSec: clampNumber(Number(event.target.value), 10, 7200, durationSeconds) })}
        />
      </div>

      <div className="min-w-0">
        <FieldLabel>Speaker</FieldLabel>
        <input
          className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
          value={timerCue.speakerName || ''}
          onChange={(event) => updateTimerCue({ speakerName: event.target.value })}
          placeholder="Optional name"
        />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-[11px] font-semibold text-zinc-300">
        <input
          type="checkbox"
          checked={!!timerCue.autoStartNext}
          onChange={(event) => updateTimerCue({ autoStartNext: event.target.checked })}
        />
        Auto-start next
      </label>

      <div className="rounded-lg border border-amber-800/50 bg-amber-950/15 p-2">
        <FieldLabel>Amber %</FieldLabel>
        <input
          type="number"
          min={1}
          max={99}
          value={amber}
          onChange={(event) => updateTimerCue({ amberPercent: clampNumber(Number(event.target.value), 1, 99, amber) })}
          className="h-8 w-full rounded-lg border border-amber-900/60 bg-black px-2 text-xs text-amber-100 outline-none focus:border-amber-500"
        />
      </div>
      <div className="rounded-lg border border-red-800/50 bg-red-950/15 p-2">
        <FieldLabel>Red %</FieldLabel>
        <input
          type="number"
          min={1}
          max={99}
          value={red}
          onChange={(event) => updateTimerCue({ redPercent: clampNumber(Number(event.target.value), 1, 99, red) })}
          className="h-8 w-full rounded-lg border border-red-900/60 bg-black px-2 text-xs text-red-100 outline-none focus:border-red-500"
        />
      </div>
    </div>
  );
};
