import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, hint, disabled = false, id }: ToggleProps) {
  const controlId = id ?? `toggle-${label?.toLowerCase().replace(/\s+/g, '-') ?? 'unlabeled'}`;
  return (
    <label
      htmlFor={controlId}
      className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label && (
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-zinc-200">{label}</span>
          {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
        </div>
      )}
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60
          ${checked ? 'bg-[#2563EB]' : 'bg-[#1F2937]'}
          ${disabled ? 'cursor-not-allowed' : ''}
        `.trim()}
      >
        <span
          className={`
            inline-block h-5 w-5 rounded-full bg-white shadow
            transform transition-transform duration-150
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
            mt-0.5
          `.trim()}
        />
      </button>
    </label>
  );
}
