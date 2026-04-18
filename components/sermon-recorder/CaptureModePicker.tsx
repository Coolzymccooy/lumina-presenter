import React from 'react';
import {
  CAPTURE_MODE_PRESETS,
  type CaptureModeId,
} from '../../services/audioCapture/capturePresets';

interface CaptureModePickerProps {
  selected: CaptureModeId;
  suggested: CaptureModeId;
  onSelect: (id: CaptureModeId) => void;
}

export const CaptureModePicker: React.FC<CaptureModePickerProps> = ({
  selected,
  suggested,
  onSelect,
}) => {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Capture Mode
      </label>
      <div className="flex flex-wrap gap-1.5">
        {CAPTURE_MODE_PRESETS.map((preset) => {
          const isSelected = preset.id === selected;
          const isSuggested = preset.id === suggested && !isSelected;

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              title={preset.description}
              className={`px-2.5 py-1.5 rounded-md text-[9px] font-semibold transition-colors border ${
                isSelected
                  ? 'bg-red-950/70 border-red-500/60 text-red-50 shadow-[0_0_0_1px_rgba(239,68,68,0.22)]'
                  : isSuggested
                    ? 'bg-zinc-800/80 border-emerald-700/40 text-emerald-300/90 hover:border-emerald-600/60'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              <span>{preset.name}</span>
              {isSelected && (
                <span className="ml-1 text-[7px] uppercase tracking-wider text-red-200/80">active</span>
              )}
              {isSuggested && (
                <span className="ml-1 text-[7px] uppercase tracking-wider text-emerald-300/80">suggested</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
