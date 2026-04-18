import React from 'react';

/**
 * PowerPoint-style ribbon primitives. All buttons share a compact 28px (h-7)
 * height, uppercase micro-text, and tactile active-press feedback so the
 * ribbon feels responsive and premium.
 */

type ButtonSize = 'sm' | 'md' | 'lg';

export interface RibbonButtonProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  shortcut?: string;
  children?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'danger' | 'accent';
  size?: ButtonSize;
  icon?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const toneClasses = {
  neutral: {
    idle: 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100',
    active: 'border-cyan-600 bg-cyan-950/40 text-cyan-200 shadow-inner',
  },
  primary: {
    idle: 'border-blue-700/60 bg-blue-950/30 text-blue-200 hover:border-blue-500 hover:bg-blue-900/40 hover:text-white',
    active: 'border-blue-400 bg-blue-600/40 text-white shadow-inner',
  },
  danger: {
    idle: 'border-rose-900/70 bg-rose-950/20 text-rose-300 hover:border-rose-600 hover:text-rose-100',
    active: 'border-rose-500 bg-rose-600/30 text-white shadow-inner',
  },
  accent: {
    idle: 'border-amber-800/60 bg-amber-950/20 text-amber-200 hover:border-amber-500 hover:text-amber-100',
    active: 'border-amber-400 bg-amber-600/30 text-white shadow-inner',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-6 px-1.5 text-[9px]',
  md: 'h-7 px-2 text-[10px]',
  lg: 'h-10 px-3 text-[11px]',
};

function formatTitle(title?: string, shortcut?: string): string | undefined {
  if (!title && !shortcut) return undefined;
  if (title && shortcut) return `${title}\n\nShortcut: ${shortcut}`;
  return title ?? `Shortcut: ${shortcut}`;
}

export const RibbonButton: React.FC<RibbonButtonProps> = ({
  onClick,
  disabled = false,
  active = false,
  title,
  shortcut,
  children,
  tone = 'neutral',
  size = 'md',
  icon,
  className,
  'aria-label': ariaLabel,
}) => {
  const palette = toneClasses[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled}
      title={formatTitle(title, shortcut)}
      aria-label={ariaLabel ?? title}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded border font-bold uppercase tracking-wider ${sizeClasses[size]} ${active ? palette.active : palette.idle} active:scale-[0.94] active:shadow-inner transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:hover:border-zinc-800 ${className ?? ''}`.trim()}
    >
      {icon ? <span className="shrink-0 leading-none">{icon}</span> : null}
      {children ? <span className="leading-none">{children}</span> : null}
    </button>
  );
};

/**
 * Tiny letter-badge used to hint at keyboard shortcut or tool name. Kept for
 * continuity with the existing toolbar look while we migrate to proper icons.
 */
export const RibbonGlyph: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'primary' | 'accent' }> = ({ children, tone = 'neutral' }) => {
  const toneClass =
    tone === 'primary'
      ? 'bg-blue-500/20 text-blue-200'
      : tone === 'accent'
      ? 'bg-amber-500/20 text-amber-200'
      : 'bg-black/20 text-zinc-300';
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-black leading-none ${toneClass}`}>
      {children}
    </span>
  );
};

export interface RibbonSplitButtonProps {
  label: React.ReactNode;
  title?: string;
  shortcut?: string;
  onClick?: () => void;
  onToggleMenu?: () => void;
  menuOpen?: boolean;
  disabled?: boolean;
  active?: boolean;
  tone?: RibbonButtonProps['tone'];
  icon?: React.ReactNode;
}

/**
 * Split-button: primary action on the left, caret dropdown on the right. The
 * caret is a separate visual affordance so users can recognize the flyout
 * pattern from PowerPoint. Menu itself is rendered by the caller.
 */
export const RibbonSplitButton: React.FC<RibbonSplitButtonProps> = ({
  label,
  title,
  shortcut,
  onClick,
  onToggleMenu,
  menuOpen = false,
  disabled = false,
  active = false,
  tone = 'neutral',
  icon,
}) => {
  const palette = toneClasses[tone];
  return (
    <div className="inline-flex h-7 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
      <button
        type="button"
        onClick={onClick}
        onMouseDown={(event) => event.preventDefault()}
        disabled={disabled}
        title={formatTitle(title, shortcut)}
        aria-label={title}
        aria-pressed={active}
        className={`inline-flex h-7 items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider ${active ? palette.active : palette.idle} border-r border-zinc-800 active:scale-[0.96] active:shadow-inner transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100`}
      >
        {icon ? <span className="shrink-0 leading-none">{icon}</span> : null}
        <span className="leading-none">{label}</span>
      </button>
      <button
        type="button"
        onClick={onToggleMenu}
        onMouseDown={(event) => event.preventDefault()}
        disabled={disabled}
        title={title ? `${title} options` : 'More options'}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        className={`inline-flex h-7 w-6 items-center justify-center text-[10px] ${menuOpen ? 'bg-cyan-950/40 text-cyan-200' : palette.idle} active:scale-[0.94] transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100`}
      >
        <span aria-hidden>▾</span>
      </button>
    </div>
  );
};

export interface RibbonPickerProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  title?: string;
  width?: string;
  ariaLabel?: string;
}

/**
 * Compact dropdown picker used for font family / size / preset selectors at
 * the ribbon level. Native <select> keeps the component lightweight and
 * accessible out-of-the-box.
 */
export function RibbonPicker<T extends string | number>({
  value,
  options,
  onChange,
  disabled = false,
  title,
  width,
  ariaLabel,
}: RibbonPickerProps<T>) {
  return (
    <select
      value={String(value)}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      onChange={(event) => {
        const next = event.target.value;
        const match = options.find((opt) => String(opt.value) === next);
        if (match) onChange(match.value);
      }}
      className="h-7 rounded border border-zinc-800 bg-zinc-950 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:border-zinc-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      style={width ? { width } : undefined}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export interface RibbonNumberProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  title?: string;
  width?: string;
  suffix?: string;
  ariaLabel?: string;
}

export const RibbonNumber: React.FC<RibbonNumberProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  title,
  width = '3.5rem',
  suffix,
  ariaLabel,
}) => {
  return (
    <div className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 text-[10px] font-bold text-zinc-200 focus-within:border-blue-500 hover:border-zinc-600 transition-colors">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        title={title}
        aria-label={ariaLabel ?? title}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-6 min-w-0 bg-transparent text-center text-[10px] font-bold tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-40"
        style={{ width }}
      />
      {suffix ? <span className="text-[9px] text-zinc-500 leading-none">{suffix}</span> : null}
    </div>
  );
};

export interface RibbonColorSwatchProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  title: string;
  label?: string;
  shortcut?: string;
}

/**
 * Compact color picker shown as a swatch + label. Relies on native
 * <input type="color"> underneath for reliability across browsers.
 */
export const RibbonColorSwatch: React.FC<RibbonColorSwatchProps> = ({
  value,
  onChange,
  disabled = false,
  title,
  label,
  shortcut,
}) => {
  const displayed = value && value.length > 0 ? value : '#ffffff';
  return (
    <label
      title={formatTitle(title, shortcut)}
      className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:border-zinc-600 active:scale-[0.96] transition-all duration-100 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className="inline-block h-4 w-4 rounded-sm border border-zinc-700"
        style={{ backgroundColor: displayed }}
        aria-hidden
      />
      {label ? <span className="leading-none">{label}</span> : null}
      <input
        type="color"
        value={displayed}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
      />
    </label>
  );
};

export interface RibbonGroupProps {
  title: string;
  children: React.ReactNode;
  /** Minimum width of the title label column for tidy vertical alignment. */
  titleMinWidth?: string;
  /** Additional classes applied to the body row. */
  bodyClassName?: string;
}

export const RibbonGroup: React.FC<RibbonGroupProps> = ({ title, children, titleMinWidth, bodyClassName }) => {
  return (
    <div className="inline-flex shrink-0 flex-col items-stretch rounded-md border border-zinc-800 bg-zinc-950/70 px-1.5 pt-1 pb-0.5">
      <div className={`flex flex-nowrap items-center gap-1 ${bodyClassName ?? ''}`}>{children}</div>
      <div
        className="mt-1 border-t border-zinc-800/60 pt-0.5 text-center text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
        style={titleMinWidth ? { minWidth: titleMinWidth } : undefined}
      >
        {title}
      </div>
    </div>
  );
};

export const RibbonRow: React.FC<{ children: React.ReactNode; dense?: boolean }> = ({ children, dense = false }) => (
  <div
    className={`flex w-full flex-nowrap items-stretch gap-1.5 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/70 ${dense ? 'p-1' : 'p-1.5'}`}
  >
    {children}
  </div>
);

export const RibbonSeparator: React.FC = () => (
  <span className="mx-1 h-6 w-px shrink-0 bg-zinc-800" aria-hidden />
);
