import React, { useMemo } from 'react';
import { rankDevices, type RankedDevice } from '../../services/audioCapture/devicePicker';

interface SourcePickerProps {
  devices: MediaDeviceInfo[];
  selectedId: string | undefined;
  onSelect: (deviceId: string | undefined) => void;
}

const KindBadge: React.FC<{ ranked: RankedDevice }> = ({ ranked }) => {
  const colors = ranked.recommended
    ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50'
    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';

  return (
    <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colors}`}>
      {ranked.recommended ? '★ Recommended' : ranked.kind.replace('-', ' ')}
    </span>
  );
};

export const SourcePicker: React.FC<SourcePickerProps> = ({ devices, selectedId, onSelect }) => {
  const ranked = useMemo(() => rankDevices(devices), [devices]);

  if (ranked.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-1">
      <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Audio Source
      </label>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        <button
          onClick={() => onSelect(undefined)}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[10px] transition-colors ${
            !selectedId
              ? 'bg-zinc-800 border border-zinc-600 text-zinc-200'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <span className="flex-1 truncate">Default microphone</span>
        </button>
        {ranked.map((r) => (
          <button
            key={r.device.deviceId}
            onClick={() => onSelect(r.device.deviceId)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[10px] transition-colors ${
              selectedId === r.device.deviceId
                ? 'bg-zinc-800 border border-zinc-600 text-zinc-200'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="truncate">
                {r.device.label || `Microphone ${r.device.deviceId.slice(0, 6)}`}
              </div>
              <div className="text-[8px] text-zinc-500 mt-0.5">{r.hint}</div>
            </div>
            <KindBadge ranked={r} />
          </button>
        ))}
      </div>
    </div>
  );
};
