import React from 'react';
import type { ServiceItem, Slide, TextElementStyle, TextSlideElement } from '../../types';
import { RichTextEditor } from '../RichTextEditor';
import { getRenderableElements } from '../slide-layout/utils/slideHydration';

interface BuilderSlideQuickEditProps {
  item: ServiceItem | null;
  slide: Slide | null;
  selectedElementId: string | null;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  variant?: 'rail' | 'ribbon';
  showNotes?: boolean;
}

const findEditableTextElement = (
  slide: Slide | null,
  item: ServiceItem | null,
  selectedElementId: string | null,
): TextSlideElement | null => {
  if (!slide || !item) return null;
  const textElements = getRenderableElements(slide, item).filter((element): element is TextSlideElement => element.type === 'text');
  return textElements.find((element) => element.id === selectedElementId)
    || textElements.find((element) => element.role === 'body' || element.name === 'Body')
    || textElements[0]
    || null;
};

const updateTextElement = (
  slide: Slide,
  item: ServiceItem,
  selectedElementId: string | null,
  updater: (element: TextSlideElement) => TextSlideElement,
): Slide => {
  const elements = getRenderableElements(slide, item);
  const textElements = elements.filter((element): element is TextSlideElement => element.type === 'text');
  const target = textElements.find((element) => element.id === selectedElementId)
    || textElements.find((element) => element.role === 'body' || element.name === 'Body')
    || textElements[0]
    || null;

  if (!target) return slide;

  const nextElements = elements.map((element) => (
    element.id === target.id && element.type === 'text' ? updater(element) : element
  ));

  const nextContent = nextElements
    .filter((element): element is TextSlideElement => element.type === 'text' && element.visible !== false)
    .sort((left, right) => left.frame.zIndex - right.frame.zIndex)
    .map((element) => String(element.content || '').trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    ...slide,
    content: nextContent || slide.content || '',
    elements: nextElements,
  };
};

export const BuilderSlideQuickEdit: React.FC<BuilderSlideQuickEditProps> = ({
  item,
  slide,
  selectedElementId,
  onUpdateSlide,
  variant = 'rail',
  showNotes = true,
}) => {
  const textElement = React.useMemo(
    () => findEditableTextElement(slide, item, selectedElementId),
    [item, selectedElementId, slide],
  );
  const [contentDraft, setContentDraft] = React.useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setContentDraft(String(textElement?.content || slide?.content || ''));
  }, [slide?.id, textElement?.id, textElement?.content, slide?.content]);

  React.useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const commitText = React.useCallback((content: string) => {
    if (!item || !slide || !textElement) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateSlide((currentSlide) => updateTextElement(currentSlide, item, textElement.id, (element) => ({
        ...element,
        content,
      })));
    }, 160);
  }, [item, onUpdateSlide, slide, textElement]);

  const applyStyle = React.useCallback((patch: Partial<TextElementStyle>) => {
    if (!item || !textElement) return;
    onUpdateSlide((currentSlide) => updateTextElement(currentSlide, item, textElement.id, (element) => ({
      ...element,
      style: {
        ...element.style,
        ...patch,
      },
    })));
  }, [item, onUpdateSlide, textElement]);

  const align = (textElement?.style.textAlign || 'center') as 'left' | 'center' | 'right';
  const notesValue = slide?.notes || slide?.metadata?.notes || '';

  if (!item || !slide) {
    return (
      <div data-testid="builder-slide-content-quick-edit" className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700">
        Select a slide
      </div>
    );
  }

  const ribbonMode = variant === 'ribbon';

  return (
    <div data-testid="builder-slide-content-quick-edit" className={ribbonMode ? 'min-w-0' : 'space-y-3'}>
      {textElement ? (
        <RichTextEditor
          value={contentDraft}
          resetKey={`${slide.id}:${textElement.id}`}
          align={align}
          onAlignChange={(nextAlign) => applyStyle({ textAlign: nextAlign })}
          onChange={(html) => {
            setContentDraft(html);
            commitText(html);
          }}
          contentClassName={ribbonMode ? 'min-h-[38px] max-h-[54px] px-2 py-1.5 text-xs' : 'min-h-[84px] max-h-[168px] overflow-y-auto'}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-[11px] font-semibold text-zinc-500">
          This slide has no text layer yet. Use the canvas Text button to add one.
        </div>
      )}

      {showNotes && (
      <details className="group rounded-lg border border-zinc-800 bg-black/40">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
          <span>Speaker Notes</span>
          <span className="text-zinc-600 transition-transform group-open:rotate-90">{'>'}</span>
        </summary>
        <div className="border-t border-zinc-800 p-2">
          <textarea
            className="min-h-[72px] w-full resize-y rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-cyan-600"
            placeholder="Tap to add notes"
            value={notesValue}
            onChange={(event) => onUpdateSlide((current) => ({
              ...current,
              notes: event.target.value,
              metadata: { ...(current.metadata || {}), notes: event.target.value },
            }))}
          />
        </div>
      </details>
      )}
    </div>
  );
};
