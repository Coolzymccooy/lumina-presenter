import React from 'react';
import { LayoutPreset, MediaType, Slide, SlideElement, TextSlideElement } from '../../../types.ts';
import { BackgroundRenderer } from '../render/BackgroundRenderer.tsx';

interface InspectorPanelProps {
  slide: Slide | null;
  selectedElement: SlideElement | null;
  presets: LayoutPreset[];
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  onUpdateElement: (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => void;
  onApplyPreset: (presetId: string) => void;
  onTriggerUpload: () => void;
  onTriggerFolderUpload: () => void;
  onTriggerPptxVisual: () => void;
  onTriggerPptxText: () => void;
  onClearBackground: () => void;
  onTriggerLogoUpload: () => void;
}

type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const LOGO_POSITIONS: Array<{ value: LogoPosition; label: string }> = [
  { value: 'top-left', label: 'TL' },
  { value: 'top-right', label: 'TR' },
  { value: 'bottom-left', label: 'BL' },
  { value: 'bottom-right', label: 'BR' },
];

const clampLogoSize = (value: number): number => {
  if (!Number.isFinite(value)) return 12;
  return Math.min(50, Math.max(1, Math.round(value)));
};

const FONT_FAMILY_OPTIONS = [
  { label: 'Aptos', value: '"Aptos", "Segoe UI", system-ui, sans-serif' },
  { label: 'Aptos Display', value: '"Aptos Display", "Aptos", "Segoe UI", system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Inter', value: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { label: 'Montserrat', value: '"Montserrat", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">{children}</label>
);

const Section = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => (
  <details open={defaultOpen} className="group rounded-lg border border-zinc-800 bg-zinc-900/70">
    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
      <span>{title}</span>
      <span className="text-zinc-600 transition-transform group-open:rotate-90">{'>'}</span>
    </summary>
    <div className="space-y-3 border-t border-zinc-800 p-3">{children}</div>
  </details>
);

const ToggleButton = ({
  active,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button
    type="button"
    {...props}
    className={`rounded border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] ${
      active ? 'border-cyan-600 bg-cyan-950/40 text-cyan-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

const normalizeHexColor = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;
  return value.startsWith('#') ? value : fallback;
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  slide,
  selectedElement,
  presets,
  onUpdateSlide,
  onUpdateElement,
  onApplyPreset,
  onTriggerUpload,
  onTriggerFolderUpload,
  onTriggerPptxVisual,
  onTriggerPptxText,
  onClearBackground,
  onTriggerLogoUpload,
}) => {
  const textElement = selectedElement?.type === 'text' ? selectedElement : null;
  const showCompactTextEditor = !!textElement;

  return (
    <div data-inspector-root className="flex h-full min-h-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Inspector</div>
        <div className="mt-1 text-xs text-zinc-200">{slide?.label || 'New Slide'}</div>
      </div>
      {/* Media Tools — pinned outside scroll area so it's always visible */}
      <div className="shrink-0 border-b border-cyan-900/40 bg-zinc-900/70 px-3 py-2.5">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">Media Tools</div>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={onTriggerUpload} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-[9px] font-bold text-zinc-100 hover:border-cyan-600 hover:text-white transition-colors">
            Upload Media
          </button>
          <button type="button" onClick={onTriggerFolderUpload} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-[9px] font-bold text-zinc-100 hover:border-cyan-600 hover:text-white transition-colors">
            Upload Folder
          </button>
          <button type="button" onClick={onClearBackground} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:border-rose-600 hover:text-rose-200 transition-colors">
            Clear Media
          </button>
          <button type="button" onClick={onTriggerPptxVisual} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-[9px] font-bold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors">
            PPTX Visual
          </button>
          <button type="button" onClick={onTriggerPptxText} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-[9px] font-bold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors">
            PPTX Text
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
        {showCompactTextEditor ? (
          <>
            <Section title="Quick Edit" defaultOpen>
              {slide ? (
                <div>
                  <FieldLabel>Label</FieldLabel>
                  <input
                    data-testid="smart-slide-label"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={slide.label || ''}
                    onChange={(event) => onUpdateSlide((current) => ({ ...current, label: event.target.value }))}
                  />
                </div>
              ) : null}
              <div>
                <FieldLabel>Text</FieldLabel>
                <textarea
                  data-testid="smart-element-content"
                  className="min-h-[7rem] w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  value={textElement.content}
                  onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, content: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Font</FieldLabel>
                  <select
                    data-testid="smart-element-font-family"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.fontFamily || FONT_FAMILY_OPTIONS[0].value}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, fontFamily: event.target.value } }))}
                  >
                    {FONT_FAMILY_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Font Size</FieldLabel>
                  <input
                    data-testid="smart-element-font-size"
                    type="number"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.fontSize || 48}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, fontSize: Number(event.target.value) || 48 } }))}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Quick Style</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  <ToggleButton
                    data-testid="smart-element-bold"
                    active={Number(textElement.style.fontWeight || 700) >= 700}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: { ...current.style, fontWeight: Number(current.style.fontWeight || 700) >= 700 ? 500 : 700 },
                    }))}
                  >
                    Bold
                  </ToggleButton>
                  <ToggleButton
                    data-testid="smart-element-italic"
                    active={textElement.style.fontStyle === 'italic'}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: { ...current.style, fontStyle: current.style.fontStyle === 'italic' ? 'normal' : 'italic' },
                    }))}
                  >
                    Italic
                  </ToggleButton>
                  <ToggleButton
                    data-testid="smart-element-underline"
                    active={(textElement.style.textDecoration || '').includes('underline')}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: {
                        ...current.style,
                        textDecoration: (current.style.textDecoration || '').includes('underline') ? 'none' : 'underline',
                      },
                    }))}
                  >
                    Underline
                  </ToggleButton>
                  <ToggleButton
                    data-testid="smart-element-uppercase"
                    active={textElement.style.textTransform === 'uppercase'}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: { ...current.style, textTransform: current.style.textTransform === 'uppercase' ? 'none' : 'uppercase' },
                    }))}
                  >
                    Upper
                  </ToggleButton>
                  <ToggleButton
                    data-testid="smart-element-bullets"
                    active={(textElement.style.listStyleType || 'none') !== 'none' && textElement.style.listStyleType !== 'decimal'}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: {
                        ...current.style,
                        textAlign: current.style.textAlign === 'right' ? 'right' : 'left',
                        listStyleType: current.style.listStyleType && current.style.listStyleType !== 'none' && current.style.listStyleType !== 'decimal' ? 'none' : 'disc',
                      },
                    }))}
                  >
                    Bullets
                  </ToggleButton>
                  <ToggleButton
                    data-testid="smart-element-numbered"
                    active={textElement.style.listStyleType === 'decimal'}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: {
                        ...current.style,
                        textAlign: current.style.textAlign === 'right' ? 'right' : 'left',
                        listStyleType: current.style.listStyleType === 'decimal' ? 'none' : 'decimal',
                      },
                    }))}
                  >
                    Numbers
                  </ToggleButton>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Text Align</FieldLabel>
                  <select
                    data-testid="smart-element-text-align"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.textAlign || 'center'}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, textAlign: event.target.value as TextSlideElement['style']['textAlign'] } }))}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Line Height</FieldLabel>
                  <input
                    data-testid="smart-element-line-height"
                    type="number"
                    min="0.8"
                    max="2.4"
                    step="0.05"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.lineHeight ?? 1.15}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, lineHeight: Number(event.target.value) || 1.15 } }))}
                  />
                </div>
              </div>
            </Section>

            <Section title="Typography" defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Weight</FieldLabel>
                  <input
                    data-testid="smart-element-font-weight"
                    type="number"
                    min="100"
                    max="900"
                    step="100"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={Number(textElement.style.fontWeight || 700)}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, fontWeight: Number(event.target.value) || 700 } }))}
                  />
                </div>
                <div>
                  <FieldLabel>Letter Spacing</FieldLabel>
                  <input
                    data-testid="smart-element-letter-spacing"
                    type="number"
                    min="-4"
                    max="20"
                    step="0.5"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.letterSpacing ?? 0}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, letterSpacing: Number(event.target.value) || 0 } }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Transform</FieldLabel>
                  <select
                    data-testid="smart-element-transform"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.textTransform || 'none'}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, textTransform: event.target.value as TextSlideElement['style']['textTransform'] } }))}
                  >
                    <option value="none">None</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Vertical Align</FieldLabel>
                  <select
                    data-testid="smart-element-vertical-align"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.verticalAlign || 'middle'}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, verticalAlign: event.target.value as TextSlideElement['style']['verticalAlign'] } }))}
                  >
                    <option value="top">Top</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>List Style</FieldLabel>
                  <select
                    data-testid="smart-element-list-style"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.listStyleType || 'none'}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: {
                        ...current.style,
                        listStyleType: event.target.value as TextSlideElement['style']['listStyleType'],
                        textAlign: event.target.value === 'none' ? current.style.textAlign : (current.style.textAlign === 'right' ? 'right' : 'left'),
                      },
                    }))}
                  >
                    <option value="none">None</option>
                    <option value="disc">Bullet</option>
                    <option value="circle">Circle</option>
                    <option value="square">Square</option>
                    <option value="decimal">Numbered</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>List Indent</FieldLabel>
                  <input
                    data-testid="smart-element-list-indent"
                    type="number"
                    min="0"
                    max="120"
                    step="2"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.listIndent ?? 28}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: { ...current.style, listIndent: Number(event.target.value) || 0 },
                    }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Text Color</FieldLabel>
                  <input
                    data-testid="smart-element-text-color"
                    type="color"
                    className="h-10 w-full rounded border border-zinc-700 bg-zinc-950 px-2"
                    value={normalizeHexColor(textElement.style.color, '#ffffff')}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, color: event.target.value } }))}
                  />
                </div>
                <div>
                  <FieldLabel>Background</FieldLabel>
                  <input
                    data-testid="smart-element-background-color"
                    type="color"
                    className="h-10 w-full rounded border border-zinc-700 bg-zinc-950 px-2"
                    value={normalizeHexColor(textElement.style.backgroundColor, '#000000')}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, backgroundColor: event.target.value } }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Outline Color</FieldLabel>
                  <input
                    data-testid="smart-element-outline-color"
                    type="color"
                    className="h-10 w-full rounded border border-zinc-700 bg-zinc-950 px-2"
                    value={normalizeHexColor(textElement.style.outlineColor, '#000000')}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, outlineColor: event.target.value } }))}
                  />
                </div>
                <div>
                  <FieldLabel>Outline Width</FieldLabel>
                  <input
                    data-testid="smart-element-outline-width"
                    type="number"
                    min="0"
                    max="12"
                    step="0.5"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.outlineWidth ?? 0}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, outlineWidth: Number(event.target.value) || 0 } }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Opacity</FieldLabel>
                  <input
                    data-testid="smart-element-opacity"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.opacity ?? 1}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, opacity: Number(event.target.value) } }))}
                  />
                </div>
                <div>
                  <FieldLabel>Padding</FieldLabel>
                  <input
                    data-testid="smart-element-padding"
                    type="number"
                    min="0"
                    max="80"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.style.padding ?? 16}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, style: { ...current.style, padding: Number(event.target.value) || 0 } }))}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Effects</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <ToggleButton
                    data-testid="smart-element-shadow"
                    active={textElement.style.shadow !== 'none' && !!textElement.style.shadow}
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: {
                        ...current.style,
                        shadow: current.style.shadow && current.style.shadow !== 'none' ? 'none' : '0 2px 12px rgba(0,0,0,0.45)',
                      },
                    }))}
                  >
                    Shadow
                  </ToggleButton>
                  <ToggleButton
                    data-testid="smart-element-reset-type"
                    onClick={() => onUpdateElement(textElement.id, (current) => ({
                      ...current,
                      style: {
                        ...current.style,
                        fontStyle: 'normal',
                        textDecoration: 'none',
                        textTransform: 'none',
                        letterSpacing: 0,
                        lineHeight: 1.15,
                        outlineWidth: 0,
                        shadow: 'none',
                      },
                    }))}
                  >
                    Reset Type
                  </ToggleButton>
                </div>
              </div>
            </Section>

            <Section title="Block">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <input
                    data-testid="smart-element-name"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.name}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Role</FieldLabel>
                  <select
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.role || 'body'}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, role: event.target.value as TextSlideElement['role'] }))}
                  >
                    <option value="title">Title</option>
                    <option value="subtitle">Subtitle</option>
                    <option value="body">Body</option>
                    <option value="reference">Reference</option>
                    <option value="footer">Footer</option>
                    <option value="note">Note</option>
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Block Layout">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>X</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.frame.x}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, frame: { ...current.frame, x: Number(event.target.value) || 0 } }))}
                  />
                </div>
                <div>
                  <FieldLabel>Y</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.frame.y}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, frame: { ...current.frame, y: Number(event.target.value) || 0 } }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Width</FieldLabel>
                  <input
                    type="number"
                    min="0.08"
                    max="1"
                    step="0.01"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.frame.width}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, frame: { ...current.frame, width: Number(event.target.value) || current.frame.width } }))}
                  />
                </div>
                <div>
                  <FieldLabel>Height</FieldLabel>
                  <input
                    type="number"
                    min="0.06"
                    max="1"
                    step="0.01"
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                    value={textElement.frame.height}
                    onChange={(event) => onUpdateElement(textElement.id, (current) => ({ ...current, frame: { ...current.frame, height: Number(event.target.value) || current.frame.height } }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateElement(textElement.id, (current) => ({ ...current, visible: !current.visible }))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200"
                >
                  {textElement.visible ? 'HIDE' : 'SHOW'}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateElement(textElement.id, (current) => ({ ...current, locked: !current.locked }))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200"
                >
                  {textElement.locked ? 'UNLOCK' : 'LOCK'}
                </button>
              </div>
            </Section>
          </>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-6 py-10 text-center text-zinc-500">
            Select a text block to edit its content and style.
          </div>
        )}

        {slide && (
          <>
            <Section title="Slide">
              <div>
                <FieldLabel>Layout Preset</FieldLabel>
                <select
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                  value={slide.layoutType || 'single'}
                  onChange={(event) => onApplyPreset(event.target.value)}
                >
                  {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
              </div>
            </Section>

            <Section title="Background" defaultOpen={!showCompactTextEditor}>
              <div className="relative aspect-[16/7] overflow-hidden rounded border border-zinc-800 bg-black">
                <BackgroundRenderer backgroundUrl={slide.backgroundUrl} mediaType={slide.mediaType as MediaType | undefined} mediaFit={slide.mediaFit || 'cover'} />
              </div>
              <div>
                <FieldLabel>Background URL / Color</FieldLabel>
                <input
                  data-testid="smart-background-url"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                  value={slide.backgroundUrl || ''}
                  onChange={(event) => onUpdateSlide((current) => ({ ...current, backgroundUrl: event.target.value || undefined }))}
                />
              </div>
              <div>
                <FieldLabel>Media Type</FieldLabel>
                <select
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                  value={slide.mediaType || 'image'}
                  onChange={(event) => onUpdateSlide((current) => ({ ...current, mediaType: event.target.value as MediaType }))}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="color">Color</option>
                </select>
              </div>
              <div>
                <FieldLabel>Image Fit</FieldLabel>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`rounded border px-3 py-2 text-[10px] font-bold ${slide.mediaFit !== 'contain' ? 'border-zinc-600 bg-zinc-800 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}
                    onClick={() => onUpdateSlide((current) => ({ ...current, mediaFit: 'cover' }))}
                  >
                    FILL FRAME
                  </button>
                  <button
                    type="button"
                    data-testid="slide-editor-fit-to-screen"
                    className={`rounded border px-3 py-2 text-[10px] font-bold ${slide.mediaFit === 'contain' ? 'border-cyan-600 bg-cyan-950/40 text-cyan-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}
                    onClick={() => onUpdateSlide((current) => ({ ...current, mediaFit: 'contain' }))}
                  >
                    FIT TO SCREEN
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Logo">
              {slide.logoUrl ? (
                <>
                  <div>
                    <FieldLabel>Position</FieldLabel>
                    <div className="grid grid-cols-4 gap-1.5">
                      {LOGO_POSITIONS.map((option) => {
                        const active = (slide.logoPosition || 'bottom-right') === option.value;
                        return (
                          <ToggleButton
                            key={option.value}
                            active={active}
                            onClick={() => onUpdateSlide((current) => ({ ...current, logoPosition: option.value }))}
                            title={`Anchor logo to ${option.value.replace('-', ' ')}`}
                          >
                            {option.label}
                          </ToggleButton>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Size ({clampLogoSize(slide.logoSize ?? 12)}% of stage)</FieldLabel>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={clampLogoSize(slide.logoSize ?? 12)}
                      onChange={(event) => {
                        const next = clampLogoSize(Number(event.target.value));
                        onUpdateSlide((current) => ({ ...current, logoSize: next }));
                      }}
                      className="w-full accent-cyan-500"
                      aria-label="Logo size"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onTriggerLogoUpload}
                      className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100 hover:border-cyan-600 hover:text-white active:scale-[0.96] transition-all"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSlide((current) => ({ ...current, logoUrl: undefined }))}
                      className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 hover:border-rose-600 hover:text-rose-200 active:scale-[0.96] transition-all"
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <div className="mb-2 text-[10px] text-zinc-500">No logo on this slide.</div>
                  <button
                    type="button"
                    onClick={onTriggerLogoUpload}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100 hover:border-cyan-600 hover:text-white active:scale-[0.96] transition-all"
                  >
                    Add Logo
                  </button>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
};
