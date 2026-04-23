import React from 'react';
import { createPortal } from 'react-dom';

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Sans', value: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, ui-serif, serif' },
  { label: 'Mono', value: 'ui-monospace, Menlo, monospace' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif' },
  { label: 'Cursive', value: 'Brush Script MT, cursive' },
];

const FONT_SIZES: { label: string; em: number }[] = [
  { label: 'XS', em: 0.5 },
  { label: 'S', em: 0.75 },
  { label: 'M', em: 1.0 },
  { label: 'L', em: 1.25 },
  { label: 'XL', em: 1.5 },
  { label: '2x', em: 2.0 },
  { label: '3x', em: 3.0 },
  { label: '4x', em: 4.0 },
  { label: '6x', em: 6.0 },
  { label: '8x', em: 8.0 },
];

const PRESET_TEXT_COLORS = [
  '#ffffff', '#e2e8f0', '#fbbf24', '#f59e0b',
  '#34d399', '#10b981', '#60a5fa', '#3b82f6',
  '#f87171', '#ef4444', '#c084fc', '#a855f7',
  '#fb923c', '#f97316', '#f43f5e', '#000000',
];

const PRESET_HIGHLIGHT_COLORS = [
  'transparent',
  '#fbbf24b0', '#34d399b0', '#60a5fab0',
  '#f87171b0', '#c084fcb0', '#fb923cb0', '#ffffff40',
];

const TOOLBAR_HEIGHT_PX = 40;
const TOOLBAR_GAP_PX = 10;

interface CanvasFormatToolbarProps {
  anchorRef: React.RefObject<HTMLElement>;
  editorRef: React.RefObject<HTMLElement>;
  visible: boolean;
  align?: 'left' | 'center' | 'right';
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
  onAfterCommand?: () => void;
}

interface ToolBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

const ToolBtn: React.FC<ToolBtnProps> = ({ active = false, label, className = '', children, ...rest }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    {...rest}
    className={`inline-flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-colors ${
      active ? 'bg-cyan-500/25 text-cyan-100' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="mx-0.5 h-4 w-px shrink-0 bg-zinc-700/70" />;

export const CanvasFormatToolbar: React.FC<CanvasFormatToolbarProps> = ({
  anchorRef,
  editorRef,
  visible,
  align,
  onAlignChange,
  onAfterCommand,
}) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [state, setState] = React.useState({ bold: false, italic: false, underline: false, foreColor: '' });
  const [picker, setPicker] = React.useState<'text' | 'highlight' | 'font' | 'size' | null>(null);
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  const refreshState = React.useCallback(() => {
    try {
      setState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        foreColor: document.queryCommandValue('foreColor') || '',
      });
    } catch {
      // queryCommandState can fail when selection is outside an editable host.
    }
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    refreshState();
    const handler = () => refreshState();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [visible, refreshState]);

  React.useEffect(() => {
    if (!visible) {
      setPicker(null);
    }
  }, [visible]);

  React.useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;

    const toolbarEl = hostRef.current;
    const toolbarWidth = toolbarEl?.offsetWidth ?? 360;

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const preferredLeft = rect.left + rect.width / 2 - toolbarWidth / 2;
      const clampedLeft = Math.max(12, Math.min(viewportWidth - toolbarWidth - 12, preferredLeft));
      const preferredTop = rect.top - TOOLBAR_HEIGHT_PX - TOOLBAR_GAP_PX;
      const top = preferredTop < 12 ? rect.bottom + TOOLBAR_GAP_PX : preferredTop;
      setPosition({ top, left: clampedLeft });
    };

    update();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(anchor);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [visible, anchorRef]);

  const focusEditor = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement !== editor) {
      (editor as HTMLElement).focus();
    }
  }, [editorRef]);

  const exec = React.useCallback((command: string, value?: string) => {
    focusEditor();
    try {
      document.execCommand(command, false, value);
    } catch {
      // execCommand can throw in non-editable contexts — selection was already lost.
    }
    refreshState();
    onAfterCommand?.();
  }, [focusEditor, onAfterCommand, refreshState]);

  const applyFontSize = React.useCallback((em: number) => {
    const editor = editorRef.current as HTMLElement | null;
    if (!editor) return;
    focusEditor();
    try {
      document.execCommand('fontSize', false, '7');
      editor.querySelectorAll('font[size="7"]').forEach((node) => {
        const span = document.createElement('span');
        span.style.fontSize = `${em}em`;
        span.innerHTML = (node as HTMLElement).innerHTML;
        node.replaceWith(span);
      });
    } catch {
      // Font size marker fallback failed — editable host was not focused.
    }
    refreshState();
    onAfterCommand?.();
  }, [editorRef, focusEditor, onAfterCommand, refreshState]);

  if (!visible || !position) return null;

  const fgCss = state.foreColor && state.foreColor !== 'rgb(0, 0, 0)' && state.foreColor !== '#000000'
    ? state.foreColor
    : '#ffffff';

  const content = (
    <div
      ref={hostRef}
      data-canvas-toolbar-root
      role="toolbar"
      aria-label="Slide text formatting"
      onMouseDown={(event) => event.preventDefault()}
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
      className="flex items-center gap-0.5 rounded-xl border border-zinc-700 bg-[#15161b]/95 px-1.5 py-1 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <ToolBtn active={state.bold} label="Bold" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}>
        <span className="font-black">B</span>
      </ToolBtn>
      <ToolBtn active={state.italic} label="Italic" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}>
        <span className="italic font-semibold">I</span>
      </ToolBtn>
      <ToolBtn active={state.underline} label="Underline" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}>
        <span className="underline font-semibold">U</span>
      </ToolBtn>

      <Divider />

      <div className="relative shrink-0" data-canvas-toolbar-root>
        <button
          type="button"
          title="Text color"
          onMouseDown={(e) => { e.preventDefault(); setPicker((p) => (p === 'text' ? null : 'text')); }}
          className="inline-flex h-7 w-7 flex-col items-center justify-center gap-[2px] rounded-md hover:bg-zinc-800"
        >
          <span className="text-[11px] font-bold leading-none" style={{ color: fgCss }}>A</span>
          <span className="h-[2px] w-4 rounded-full" style={{ backgroundColor: fgCss }} />
        </button>
        {picker === 'text' && (
          <div
            className="absolute left-0 top-9 w-40 rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 shadow-2xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-500">Text Color</div>
            <div className="grid grid-cols-8 gap-1">
              {PRESET_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onMouseDown={(e) => { e.preventDefault(); exec('foreColor', color); setPicker(null); }}
                  className="h-4 w-4 rounded border border-zinc-600 transition-transform hover:scale-125"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="shrink-0 text-[8px] text-zinc-500">Custom</span>
              <input
                type="color"
                defaultValue="#ffffff"
                className="h-5 flex-1 cursor-pointer rounded border border-zinc-700 bg-transparent"
                onInput={(e) => exec('foreColor', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="relative shrink-0" data-canvas-toolbar-root>
        <button
          type="button"
          title="Highlight"
          onMouseDown={(e) => { e.preventDefault(); setPicker((p) => (p === 'highlight' ? null : 'highlight')); }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-800"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="11" width="14" height="3" rx="1" fill="#fbbf24" opacity="0.75" />
            <text x="8" y="11" textAnchor="middle" dominantBaseline="auto" fontSize="8" fontWeight="700" fill="currentColor">ab</text>
          </svg>
        </button>
        {picker === 'highlight' && (
          <div
            className="absolute left-0 top-9 w-40 rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 shadow-2xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-500">Highlight</div>
            <div className="flex flex-wrap gap-1">
              {PRESET_HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color === 'transparent' ? 'None' : color}
                  onMouseDown={(e) => { e.preventDefault(); exec('hiliteColor', color); setPicker(null); }}
                  className="h-5 w-5 rounded border border-zinc-600 transition-transform hover:scale-110"
                  style={
                    color === 'transparent'
                      ? { background: 'repeating-conic-gradient(#555 0% 25%, transparent 0% 50%) 0 0 / 8px 8px' }
                      : { backgroundColor: color }
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Divider />

      <div className="relative shrink-0" data-canvas-toolbar-root>
        <button
          type="button"
          title="Font family"
          onMouseDown={(e) => { e.preventDefault(); setPicker((p) => (p === 'font' ? null : 'font')); }}
          className="inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          Aa
          <svg className="h-2 w-2 text-zinc-500" viewBox="0 0 8 8" fill="currentColor"><path d="M0 2l4 4 4-4H0z" /></svg>
        </button>
        {picker === 'font' && (
          <div
            className="absolute left-0 top-9 min-w-[140px] rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-1.5 pb-1 text-[8px] font-black uppercase tracking-widest text-zinc-500">Font</div>
            {FONT_FAMILIES.map((family) => (
              <button
                key={family.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); exec('fontName', family.value); setPicker(null); }}
                className="block w-full rounded-lg px-2 py-1 text-left text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                style={{ fontFamily: family.value }}
              >
                {family.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative shrink-0" data-canvas-toolbar-root>
        <button
          type="button"
          title="Font size"
          onMouseDown={(e) => { e.preventDefault(); setPicker((p) => (p === 'size' ? null : 'size')); }}
          className="inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-[10px] font-mono text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
            <text x="1" y="12" fontSize="11" fontWeight="800" fontFamily="monospace">T</text>
            <text x="7" y="10" fontSize="7" fontWeight="600" fontFamily="monospace">T</text>
          </svg>
          <svg className="h-2 w-2 text-zinc-500" viewBox="0 0 8 8" fill="currentColor"><path d="M0 2l4 4 4-4H0z" /></svg>
        </button>
        {picker === 'size' && (
          <div
            className="absolute left-0 top-9 min-w-[84px] rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-1.5 pb-1 text-[8px] font-black uppercase tracking-widest text-zinc-500">Size</div>
            {FONT_SIZES.map((size) => (
              <button
                key={size.em}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFontSize(size.em); setPicker(null); }}
                className="block w-full rounded-lg px-2 py-0.5 text-left text-[11px] font-mono text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                {size.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      <ToolBtn label="Clear formatting" onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" d="M4 3h8M6 3l-.5 4h5L10 3M3 13l10-10" />
        </svg>
      </ToolBtn>

      {onAlignChange && (
        <>
          <Divider />
          {(['left', 'center', 'right'] as const).map((value) => (
            <ToolBtn
              key={value}
              active={align === value}
              label={`Align ${value}`}
              onMouseDown={(e) => { e.preventDefault(); onAlignChange(value); }}
            >
              <AlignIcon align={value} />
            </ToolBtn>
          ))}
        </>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
  if (align === 'left') {
    return (
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
        <rect x="1" y="7" width="9" height="1.5" rx="0.5" />
        <rect x="1" y="11" width="11" height="1.5" rx="0.5" />
      </svg>
    );
  }
  if (align === 'center') {
    return (
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
        <rect x="3.5" y="7" width="9" height="1.5" rx="0.5" />
        <rect x="2.5" y="11" width="11" height="1.5" rx="0.5" />
      </svg>
    );
  }
  return (
    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
      <rect x="6" y="7" width="9" height="1.5" rx="0.5" />
      <rect x="4" y="11" width="11" height="1.5" rx="0.5" />
    </svg>
  );
}
