import React from 'react';
import type { ServiceItem, Slide, TextAlign, TextSlideElement } from '../../types';
import { getRenderableElements } from '../slide-layout/utils/slideHydration';

interface BuilderInspectorAccordionProps {
  item: ServiceItem | null;
  slide: Slide | null;
  selectedElementId: string | null;
  onUpdateItem: (item: ServiceItem) => void;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
}

const FONT_OPTIONS = [
  { label: 'Aptos', value: '"Aptos", "Segoe UI", system-ui, sans-serif' },
  { label: 'Inter', value: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { label: 'Montserrat', value: '"Montserrat", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'System', value: 'system-ui, sans-serif' },
];

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{children}</label>
);

const Section = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => (
  <details open={defaultOpen} className="group rounded-lg border border-zinc-800 bg-zinc-950/70">
    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
      <span>{title}</span>
      <span className="text-zinc-600 transition-transform group-open:rotate-90">{'>'}</span>
    </summary>
    <div className="space-y-3 border-t border-zinc-800 p-3">{children}</div>
  </details>
);

const ToggleButton = ({
  active,
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button
    type="button"
    {...props}
    className={`h-8 rounded-lg border px-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
      active
        ? 'border-cyan-500 bg-cyan-950/50 text-cyan-200'
        : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100'
    } ${className}`}
  >
    {children}
  </button>
);

const normalizeColorValue = (value: string | undefined, fallback: string) => {
  if (!value || !value.startsWith('#')) return fallback;
  return value;
};

const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

export const BuilderInspectorAccordion: React.FC<BuilderInspectorAccordionProps> = ({
  item,
  slide,
  selectedElementId,
  onUpdateItem,
  onUpdateSlide,
}) => {
  const selectedTextElement = React.useMemo<TextSlideElement | null>(() => {
    if (!item || !slide || !selectedElementId) return null;
    const element = getRenderableElements(slide, item).find((entry) => entry.id === selectedElementId);
    return element?.type === 'text' ? element : null;
  }, [item, selectedElementId, slide]);

  const updateTextElement = React.useCallback((updater: (element: TextSlideElement) => TextSlideElement) => {
    if (!item || !selectedTextElement) return;
    onUpdateSlide((currentSlide) => ({
      ...currentSlide,
      elements: getRenderableElements(currentSlide, item).map((element) => {
        if (element.id !== selectedTextElement.id || element.type !== 'text') return element;
        return updater(element);
      }),
    }));
  }, [item, onUpdateSlide, selectedTextElement]);

  const updateTheme = (patch: Partial<ServiceItem['theme']>) => {
    if (!item) return;
    onUpdateItem({ ...item, theme: { ...item.theme, ...patch } });
  };

  const selectedFontSize = clampNumber(Number(selectedTextElement?.style.fontSize || 56), 8, 220, 56);
  const selectedLineHeight = clampNumber(Number(selectedTextElement?.style.lineHeight || 1.15), 0.7, 3, 1.15);
  const selectedLetterSpacing = clampNumber(Number(selectedTextElement?.style.letterSpacing || 0), -4, 24, 0);

  if (!item) {
    return (
      <div data-testid="builder-inspector" className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
        Select an item
      </div>
    );
  }

  return (
    <div data-testid="builder-inspector" className="space-y-2">
      <Section title="Text" defaultOpen={!!selectedTextElement}>
        {selectedTextElement ? (
          <>
            <div>
              <FieldLabel>Content</FieldLabel>
              <textarea
                data-testid="builder-inspector-text-content"
                className="min-h-[86px] w-full resize-y rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
                value={selectedTextElement.content}
                onChange={(event) => updateTextElement((element) => ({ ...element, content: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ToggleButton
                active={Number(selectedTextElement.style.fontWeight || 700) >= 700}
                onClick={() => updateTextElement((element) => ({
                  ...element,
                  style: {
                    ...element.style,
                    fontWeight: Number(element.style.fontWeight || 700) >= 700 ? 500 : 800,
                  },
                }))}
              >
                Bold
              </ToggleButton>
              <ToggleButton
                active={selectedTextElement.style.fontStyle === 'italic'}
                onClick={() => updateTextElement((element) => ({
                  ...element,
                  style: {
                    ...element.style,
                    fontStyle: element.style.fontStyle === 'italic' ? 'normal' : 'italic',
                  },
                }))}
              >
                Italic
              </ToggleButton>
              <ToggleButton
                active={(selectedTextElement.style.textDecoration || '').includes('underline')}
                onClick={() => updateTextElement((element) => ({
                  ...element,
                  style: {
                    ...element.style,
                    textDecoration: (element.style.textDecoration || '').includes('underline') ? 'none' : 'underline',
                  },
                }))}
              >
                Under
              </ToggleButton>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-[11px] font-semibold text-zinc-500">
            Select a text layer on the canvas to edit content here.
          </div>
        )}
      </Section>

      <Section title="Typography" defaultOpen={!!selectedTextElement}>
        {selectedTextElement ? (
          <>
            <div>
              <FieldLabel>Font</FieldLabel>
              <select
                className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
                value={selectedTextElement.style.fontFamily || item.theme.fontFamily || FONT_OPTIONS[0].value}
                onChange={(event) => updateTextElement((element) => ({
                  ...element,
                  style: { ...element.style, fontFamily: event.target.value },
                }))}
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <FieldLabel>Size</FieldLabel>
                <input
                  type="number"
                  min={8}
                  max={220}
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
                  value={selectedFontSize}
                  onChange={(event) => updateTextElement((element) => ({
                    ...element,
                    style: { ...element.style, fontSize: clampNumber(Number(event.target.value), 8, 220, selectedFontSize) },
                  }))}
                />
              </div>
              <div>
                <FieldLabel>Line</FieldLabel>
                <input
                  type="number"
                  min={0.7}
                  max={3}
                  step={0.05}
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
                  value={selectedLineHeight}
                  onChange={(event) => updateTextElement((element) => ({
                    ...element,
                    style: { ...element.style, lineHeight: clampNumber(Number(event.target.value), 0.7, 3, selectedLineHeight) },
                  }))}
                />
              </div>
              <div>
                <FieldLabel>Track</FieldLabel>
                <input
                  type="number"
                  min={-4}
                  max={24}
                  step={0.5}
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
                  value={selectedLetterSpacing}
                  onChange={(event) => updateTextElement((element) => ({
                    ...element,
                    style: { ...element.style, letterSpacing: clampNumber(Number(event.target.value), -4, 24, selectedLetterSpacing) },
                  }))}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Align</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {(['left', 'center', 'right'] as TextAlign[]).map((align) => (
                  <ToggleButton
                    key={align}
                    active={(selectedTextElement.style.textAlign || 'center') === align}
                    onClick={() => updateTextElement((element) => ({
                      ...element,
                      style: { ...element.style, textAlign: align },
                    }))}
                  >
                    {align}
                  </ToggleButton>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Color</FieldLabel>
              <input
                type="color"
                className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-black p-1"
                value={normalizeColorValue(selectedTextElement.style.color, item.theme.textColor || '#ffffff')}
                onChange={(event) => updateTextElement((element) => ({
                  ...element,
                  style: { ...element.style, color: event.target.value },
                }))}
              />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-[11px] font-semibold text-zinc-500">
            Typography controls follow the selected canvas text layer.
          </div>
        )}
      </Section>

      <Section title="Layout" defaultOpen={!selectedTextElement}>
        <div>
          <FieldLabel>Item Title</FieldLabel>
          <input
            className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-3 text-xs text-zinc-100 outline-none focus:border-cyan-500"
            value={item.title}
            onChange={(event) => onUpdateItem({ ...item, title: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Slide Label</FieldLabel>
          <input
            disabled={!slide}
            className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-3 text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-40"
            value={slide?.label || ''}
            onChange={(event) => onUpdateSlide((current) => ({ ...current, label: event.target.value }))}
          />
        </div>
        {selectedTextElement && (
          <div className="grid grid-cols-4 gap-2">
            {[
              ['X', selectedTextElement.frame.x],
              ['Y', selectedTextElement.frame.y],
              ['W', selectedTextElement.frame.width],
              ['H', selectedTextElement.frame.height],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <FieldLabel>{label}</FieldLabel>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
                  value={Number(value).toFixed(2)}
                  onChange={(event) => {
                    const nextValue = clampNumber(Number(event.target.value), 0, 1, Number(value));
                    updateTextElement((element) => ({
                      ...element,
                      frame: {
                        ...element.frame,
                        [String(label).toLowerCase() === 'w' ? 'width' : String(label).toLowerCase() === 'h' ? 'height' : String(label).toLowerCase()]: nextValue,
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Design Options">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-[11px] font-semibold text-zinc-300">
            <input
              type="checkbox"
              checked={item.theme.shadow}
              onChange={(event) => updateTheme({ shadow: event.target.checked })}
            />
            Text Shadow
          </label>
          <input
            aria-label="Theme text color"
            type="color"
            className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-black p-1"
            value={normalizeColorValue(item.theme.textColor, '#ffffff')}
            onChange={(event) => updateTheme({ textColor: event.target.value })}
          />
        </div>
        <button
          type="button"
          disabled={!slide?.backgroundUrl}
          onClick={() => onUpdateSlide((current) => ({ ...current, backgroundUrl: '', mediaType: undefined }))}
          className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 hover:border-rose-700 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Clear Slide Background
        </button>
      </Section>

      <Section title="Notes">
        <div>
          <FieldLabel>Slide Notes</FieldLabel>
          <textarea
            disabled={!slide}
            className="min-h-[84px] w-full resize-y rounded-lg border border-zinc-700 bg-black px-3 py-2 text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-40"
            value={slide?.notes || slide?.metadata?.notes || ''}
            onChange={(event) => onUpdateSlide((current) => ({
              ...current,
              notes: event.target.value,
              metadata: { ...(current.metadata || {}), notes: event.target.value },
            }))}
          />
        </div>
        <div>
          <FieldLabel>Item Notes</FieldLabel>
          <textarea
            className="min-h-[72px] w-full resize-y rounded-lg border border-zinc-700 bg-black px-3 py-2 text-xs text-zinc-100 outline-none focus:border-cyan-500"
            value={item.metadata?.notes || ''}
            onChange={(event) => onUpdateItem({
              ...item,
              metadata: { ...(item.metadata || {}), notes: event.target.value },
            })}
          />
        </div>
      </Section>

      <Section title="Animation">
        <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-[11px] font-semibold text-zinc-500">
          Motion presets stay in the full editor for this migration pass.
        </div>
      </Section>

    </div>
  );
};
