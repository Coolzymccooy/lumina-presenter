import React, { useMemo } from 'react';
import { rankDevices, type RankedDevice } from '../../services/audioCapture/devicePicker';

interface SourcePickerProps {
  devices: MediaDeviceInfo[];
  selectedId: string | undefined;
  resolvedDefaultLabel?: string | null;
  onSelect: (deviceId: string | undefined) => void;
}

const KindBadge: React.FC<{ ranked: RankedDevice }> = ({ ranked }) => {
  const colors = ranked.recommended
    ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50'
    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';

  return (
    <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colors}`}>
      {ranked.recommended ? 'Recommended' : ranked.kind.replace('-', ' ')}
    </span>
  );
};

const SelectedBadge: React.FC = () => (
  <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/60 bg-red-950/60 text-red-200">
    Selected
  </span>
);

export const SourcePicker: React.FC<SourcePickerProps> = ({
  devices,
  selectedId,
  resolvedDefaultLabel,
  onSelect,
}) => {
  const ranked = useMemo(() => rankDevices(devices), [devices]);

  if (ranked.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Audio Source
      </label>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        <button
          onClick={() => onSelect(undefined)}
          className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left text-[10px] transition-colors ${
            !selectedId
              ? 'bg-zinc-800 border border-red-500/60 text-zinc-100 shadow-[0_0_0_1px_rgba(239,68,68,0.22)]'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="truncate font-semibold">Default microphone</div>
            <div className={`text-[8px] mt-0.5 ${!selectedId ? 'text-zinc-300' : 'text-zinc-500'}`}>
              {resolvedDefaultLabel
                ? `Currently routes to ${resolvedDefaultLabel}`
                : 'Uses the OS default route until a safe physical mic is found.'}
            </div>
          </div>
          {!selectedId && <SelectedBadge />}
        </button>

        {ranked.map((rankedDevice) => {
          const isSelected = selectedId === rankedDevice.device.deviceId;

          return (
            <button
              key={rankedDevice.device.deviceId}
              onClick={() => onSelect(rankedDevice.device.deviceId)}
              className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left text-[10px] transition-colors ${
                isSelected
                  ? 'bg-zinc-800 border border-red-500/60 text-zinc-100 shadow-[0_0_0_1px_rgba(239,68,68,0.22)]'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold">
                  {rankedDevice.device.label || `Microphone ${rankedDevice.device.deviceId.slice(0, 6)}`}
                </div>
                <div className={`text-[8px] mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {rankedDevice.hint}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {isSelected && <SelectedBadge />}
                <KindBadge ranked={rankedDevice} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
