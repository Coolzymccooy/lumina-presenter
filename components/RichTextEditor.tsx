import React, { useEffect, useRef, useState, useCallback } from 'react';

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

interface ToolBtnProps {
  active: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}

const ToolBtn: React.FC<ToolBtnProps> = ({ active, onMouseDown, title, children }) => (
  <button
    type="button"
    onMouseDown={onMouseDown}
    title={title}
    className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${
      active ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
    }`}
  >
    {children}
  </button>
);

interface RichTextEditorProps {
  /** Current HTML content */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  contentClassName?: string;
  /** Pass slide.id — editor resets when this changes (slide switch), not on every keystroke */
  resetKey?: string | number;
  /** Current whole-element alignment (controlled by parent) */
  align?: 'left' | 'center' | 'right';
  onAlignChange?: (align: 'left' | 'center' | 'right') => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Type slide content here...',
  contentClassName = '',
  resetKey,
  align,
  onAlignChange,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [foreColor, setForeColor] = useState('');
  const [showColors, setShowColors] = useState<'text' | 'highlight' | null>(null);

  // Reset editor when the active slide changes (resetKey changes)
  useEffect(() => {
    const el = editorRef.current;
    if (el) el.innerHTML = valueRef.current ?? '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColors) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-color-picker]')) setShowColors(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColors]);

  const updateFormatState = useCallback(() => {
    try {
      setBold(document.queryCommandState('bold'));
      setItalic(document.queryCommandState('italic'));
      setUnderline(document.queryCommandState('underline'));
      setForeColor(document.queryCommandValue('foreColor'));
    } catch { /* not in editable context */ }
  }, []);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
    updateFormatState();
  }, [onChange, updateFormatState]);

  const exec = useCallback((command: string, val?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, val);
    handleInput();
  }, [handleInput]);

  const pickColor = useCallback((color: string, type: 'text' | 'highlight') => {
    if (type === 'text') {
      exec('foreColor', color);
    } else {
      exec('hiliteColor', color);
    }
    setShowColors(null);
  }, [exec]);

  // Resolve foreColor for the A indicator (browser returns rgb(...))
  const fgCss = foreColor && foreColor !== 'rgb(0, 0, 0)' && foreColor !== '#000000'
    ? foreColor
    : '#ffffff';

  return (
    <div className="flex flex-col gap-1.5">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-px flex-wrap bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5">
        {/* Bold */}
        <ToolBtn active={bold} onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Bold (Ctrl+B)">
          <span className="font-black text-[11px] leading-none">B</span>
        </ToolBtn>

        {/* Italic */}
        <ToolBtn active={italic} onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Italic (Ctrl+I)">
          <span className="italic font-semibold text-[11px] leading-none">I</span>
        </ToolBtn>

        {/* Underline */}
        <ToolBtn active={underline} onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} title="Underline (Ctrl+U)">
          <span className="underline font-semibold text-[11px] leading-none">U</span>
        </ToolBtn>

        <div className="w-px h-4 bg-zinc-700 mx-0.5 shrink-0" />

        {/* Text color */}
        <div className="relative shrink-0" data-color-picker>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setShowColors(p => p === 'text' ? null : 'text'); }}
            title="Text color"
            className="w-6 h-6 rounded flex flex-col items-center justify-center gap-[2px] hover:bg-zinc-800 transition-colors"
          >
            <span className="font-bold text-[11px] leading-none" style={{ color: fgCss }}>A</span>
            <div className="w-3.5 h-[2px] rounded-full" style={{ backgroundColor: fgCss }} />
          </button>

          {showColors === 'text' && (
            <div
              className="absolute top-8 left-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 shadow-2xl"
              style={{ width: 156 }}
              data-color-picker
            >
              <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Text Color</div>
              <div className="grid grid-cols-8 gap-1">
                {PRESET_TEXT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickColor(c, 'text'); }}
                    className="w-4 h-4 rounded border border-zinc-600 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[8px] text-zinc-500 shrink-0">Custom</span>
                <input
                  type="color"
                  defaultValue="#ffffff"
                  className="flex-1 h-5 rounded cursor-pointer bg-transparent border border-zinc-700"
                  onInput={(e) => {
                    const el = editorRef.current;
                    if (el) el.focus();
                    exec('foreColor', (e.target as HTMLInputElement).value);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative shrink-0" data-color-picker>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setShowColors(p => p === 'highlight' ? null : 'highlight'); }}
            title="Highlight color"
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="11" width="14" height="3" rx="1" fill="#fbbf24" opacity="0.75" />
              <text x="8" y="11" textAnchor="middle" dominantBaseline="auto" fontSize="8" fontWeight="700" fill="currentColor">ab</text>
            </svg>
          </button>

          {showColors === 'highlight' && (
            <div
              className="absolute top-8 left-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 shadow-2xl"
              style={{ width: 136 }}
              data-color-picker
            >
              <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Highlight</div>
              <div className="flex flex-wrap gap-1">
                {PRESET_HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickColor(c, 'highlight'); }}
                    className="w-5 h-5 rounded border border-zinc-600 hover:scale-110 transition-transform"
                    style={
                      c === 'transparent'
                        ? { background: 'repeating-conic-gradient(#555 0% 25%, transparent 0% 50%) 0 0 / 8px 8px' }
                        : { backgroundColor: c }
                    }
                    title={c === 'transparent' ? 'None' : c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-zinc-700 mx-0.5 shrink-0" />

        {/* Clear formatting */}
        <ToolBtn active={false} onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }} title="Clear formatting">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" d="M4 3h8M6 3l-.5 4h5L10 3M3 13l10-10" />
          </svg>
        </ToolBtn>

        {/* Alignment — only shown if parent provides onAlignChange */}
        {onAlignChange && (
          <>
            <div className="w-px h-4 bg-zinc-700 mx-0.5 shrink-0" />
            {(['left', 'center', 'right'] as const).map((a) => (
              <ToolBtn
                key={a}
                active={align === a}
                onMouseDown={(e) => { e.preventDefault(); onAlignChange(a); }}
                title={`Align ${a}`}
              >
                <AlignIcon align={a} />
              </ToolBtn>
            ))}
          </>
        )}
      </div>

      {/* ── Editable area ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={updateFormatState}
        onMouseUp={updateFormatState}
        onSelect={updateFormatState}
        data-placeholder={placeholder}
        spellCheck={false}
        className={`bg-zinc-900 border border-zinc-700 rounded-sm text-sm text-zinc-100 p-3 focus:outline-none focus:border-blue-500 transition-colors whitespace-pre-wrap break-words overflow-y-auto custom-scrollbar leading-relaxed rte-area ${contentClassName}`}
      />
    </div>
  );
};

function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
  if (align === 'left') return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
      <rect x="1" y="7" width="9" height="1.5" rx="0.5" />
      <rect x="1" y="11" width="11" height="1.5" rx="0.5" />
    </svg>
  );
  if (align === 'center') return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
      <rect x="3.5" y="7" width="9" height="1.5" rx="0.5" />
      <rect x="2.5" y="11" width="11" height="1.5" rx="0.5" />
    </svg>
  );
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
      <rect x="6" y="7" width="9" height="1.5" rx="0.5" />
      <rect x="4" y="11" width="11" height="1.5" rx="0.5" />
    </svg>
  );
}
