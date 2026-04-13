import type { ServiceItem, Slide } from '../types';

const normalizeText = (value?: string): string => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const buildBibleSlideSignature = (slide: Slide): string => {
  const label = normalizeText(slide.label);
  const content = normalizeText(slide.content);
  return `${label}::${content}`;
};

const serializeBibleSlideVisual = (slide: Slide): string => JSON.stringify({
  content: slide.content || '',
  label: slide.label || '',
  layoutType: slide.layoutType || '',
  backgroundUrl: slide.backgroundUrl || '',
  mediaType: slide.mediaType || '',
  mediaFit: slide.mediaFit || '',
  elements: slide.elements || [],
  alphaOverlayUrl: slide.alphaOverlayUrl || '',
});

const isSameTheme = (left: ServiceItem['theme'], right: ServiceItem['theme']): boolean => (
  String(left.backgroundUrl || '') === String(right.backgroundUrl || '')
  && String(left.mediaType || '') === String(right.mediaType || '')
  && String(left.fontFamily || '') === String(right.fontFamily || '')
  && String(left.textColor || '') === String(right.textColor || '')
  && Boolean(left.shadow) === Boolean(right.shadow)
  && String(left.fontSize || '') === String(right.fontSize || '')
);

export const isBibleGeneratedItem = (item: ServiceItem | null | undefined): item is ServiceItem => Boolean(
  item
  && (
    item.type === 'BIBLE'
    || item.type === 'SCRIPTURE'
    || item.metadata?.source === 'bible'
  ),
);

export const mergeBibleGeneratedItem = (existingItem: ServiceItem, incomingItem: ServiceItem): ServiceItem => {
  const existingBySignature = new Map<string, Slide[]>();
  existingItem.slides.forEach((slide) => {
    const signature = buildBibleSlideSignature(slide);
    const matches = existingBySignature.get(signature) || [];
    matches.push(slide);
    existingBySignature.set(signature, matches);
  });

  const usedSlideIds = new Set<string>();
  const nextSlides = incomingItem.slides.map((slide, index) => {
    const signature = buildBibleSlideSignature(slide);
    const matchedBySignature = (existingBySignature.get(signature) || []).find((candidate) => !usedSlideIds.has(candidate.id)) || null;
    const matchedByIndex = existingItem.slides[index] && !usedSlideIds.has(existingItem.slides[index].id)
      ? existingItem.slides[index]
      : null;
    const matchedSlide = matchedBySignature || matchedByIndex;

    if (!matchedSlide) {
      return slide;
    }

    usedSlideIds.add(matchedSlide.id);
    return {
      ...slide,
      id: matchedSlide.id,
      notes: slide.notes ?? matchedSlide.notes,
      metadata: slide.metadata ?? matchedSlide.metadata,
      alphaOverlayUrl: slide.alphaOverlayUrl ?? matchedSlide.alphaOverlayUrl,
    };
  });

  return {
    ...incomingItem,
    id: existingItem.id,
    metadata: {
      ...existingItem.metadata,
      ...incomingItem.metadata,
    },
    timerCue: incomingItem.timerCue ?? existingItem.timerCue,
    slides: nextSlides,
  };
};

export const areBibleGeneratedItemsVisuallyEqual = (left: ServiceItem, right: ServiceItem): boolean => {
  if (left.title !== right.title || left.type !== right.type) return false;
  if (!isSameTheme(left.theme, right.theme)) return false;
  if (left.slides.length !== right.slides.length) return false;
  return left.slides.every((slide, index) => serializeBibleSlideVisual(slide) === serializeBibleSlideVisual(right.slides[index]));
};
