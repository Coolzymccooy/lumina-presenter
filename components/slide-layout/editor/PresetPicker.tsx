import React from 'react';
import { LayoutPreset } from '../../../types.ts';

interface PresetPickerProps {
  presets: LayoutPreset[];
  value: string;
  onChange: (presetId: string) => void;
}

export const PresetPicker: React.FC<PresetPickerProps> = ({ presets, value, onChange }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="h-10 rounded border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200"
  >
    {presets.map((preset) => (
      <option key={preset.id} value={preset.id}>{preset.label}</option>
    ))}
  </select>
);

