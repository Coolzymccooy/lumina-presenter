import React from 'react';
import {
  CAPTURE_MODE_PRESETS,
  type CaptureModeId,
} from '../../services/audioCapture/capturePresets';

interface CaptureModePckerProps {
  selected: CaptureModeId;
  suggested: CaptureModeId;
  onSelect: (id: CaptureModeId) => void;
}

export const CaptureModePicker: React.FC<CaptureModePckerProps> = ({
  selected,
  suggested,
  onSelect,
}) => {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Capture Mode
      </label>
      <div className="flex flex-wrap gap-1">
        {CAPTURE_MODE_PRESETS.map((preset) => {
          const isSelected = preset.id === selected;
          const isSuggested = preset.id === suggested && !isSelected;

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              title={preset.description}
              className={`px-2 py-1 rounded-md text-[9px] font-medium transition-colors border ${
                isSelected
                  ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
                  : isSuggested
                    ? 'bg-zinc-800/80 border-emerald-700/40 text-emerald-300/80 hover:border-emerald-600/60'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
              }`}
            >
              {preset.name}
              {isSuggested && (
                <span className="ml-1 text-[7px] text-emerald-400/70">suggested</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
