import { SlideElement, SlideElementRole, ServiceItem, Slide, TextElementStyle, TextSlideElement } from '../../../types.ts';
import { normalizeFrame } from './frameMath.ts';

const createElementId = () => `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const almostEqual = (left: number | undefined, right: number, epsilon = 0.001) => Math.abs(Number(left || 0) - right) <= epsilon;

const getRoleDefaults = (role: SlideElementRole | undefined, item?: ServiceItem): TextElementStyle => {
  const fontFamily = item?.theme?.fontFamily || 'sans-serif';
  const textColor = item?.theme?.textColor || '#ffffff';
  const base: TextElementStyle = {
    fontFamily,
    color: textColor,
    fontWeight: 700,
    fontStyle: 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    lineHeight: 1.15,
    letterSpacing: 0,
    textTransform: 'none',
    outlineColor: 'rgba(4,10,24,0.92)',
    outlineWidth: item?.theme?.shadow ? 1.6 : 0,
    shadow: item?.theme?.shadow ? '0 4px 18px rgba(0,0,0,0.74), 0 0 26px rgba(255,255,255,0.10)' : 'none',
    opacity: 1,
    borderRadius: 0,
    padding: 16,
    backgroundColor: 'transparent',
    listStyleType: 'none',
    listIndent: 28,
  };

  if (role === 'title') return { ...base, fontSize: 82, fontWeight: 800 };
  if (role === 'subtitle') return { ...base, fontSize: 42, fontWeight: 600 };
  if (role === 'reference') return { ...base, fontSize: 34, fontWeight: 700, textAlign: 'right' };
  if (role === 'footer') return { ...base, fontSize: 26, fontWeight: 600 };
  if (role === 'note') return { ...base, fontSize: 22, fontWeight: 500, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14 };
  return { ...base, fontSize: 56, fontWeight: 700 };
};

export const createTextElement = ({
  name,
  role,
  content,
  frame,
  item,
  style,
  visible = true,
  locked = false,
}: {
  name: string;
  role?: SlideElementRole;
  content: string;
  frame: TextSlideElement['frame'];
  item?: ServiceItem | null;
  style?: Partial<TextElementStyle>;
  visible?: boolean;
  locked?: boolean;
}): TextSlideElement => ({
  id: createElementId(),
  type: 'text',
  name,
  role,
  content,
  frame: normalizeFrame(frame),
  style: { ...getRoleDefaults(role, item || undefined), ...(style || {}) },
  visible,
  locked,
});

export const hydrateLegacySlideElements = (slide: Slide, item?: ServiceItem | null): SlideElement[] => {
  const content = String(slide.content || '').trim();
  if (!content) return [];
  return [
    createTextElement({
      name: slide.label || 'Body',
      role: 'body',
      content,
      frame: { x: 0.1, y: 0.18, width: 0.8, height: 0.5, zIndex: 1 },
      item,
    }),
  ];
};

export const getRenderableElements = (slide: Slide, item?: ServiceItem | null): SlideElement[] => {
  if (Array.isArray(slide.elements) && slide.elements.length > 0) {
    const normalized = slide.elements.map((element, index) => ({
      ...element,
      frame: normalizeFrame({ ...element.frame, zIndex: Number.isFinite(element.frame?.zIndex) ? element.frame.zIndex : index }),
      visible: element.visible !== false,
      locked: !!element.locked,
    }));
    if (slide.layoutType === 'scripture-reference') {
      return normalized.map((element) => {
        if (element.type !== 'text') return element;

        const isLegacyScriptureBody = element.name === 'Scripture Body'
          && almostEqual(element.frame.x, 0.18)
          && almostEqual(element.frame.y, 0.28)
          && almostEqual(element.frame.width, 0.64)
          && almostEqual(element.frame.height, 0.18)
          && Number(element.style.fontSize || 0) <= 34;

        if (isLegacyScriptureBody) {
          return {
            ...element,
            frame: normalizeFrame({ ...element.frame, x: 0.15, y: 0.24, width: 0.7, height: 0.24 }),
            style: {
              ...element.style,
              fontSize: 56,
              lineHeight: 1.22,
            },
          };
        }

        const isLegacyReference = element.name === 'Reference'
          && almostEqual(element.frame.x, 0.62)
          && almostEqual(element.frame.y, 0.58)
          && almostEqual(element.frame.width, 0.24)
          && almostEqual(element.frame.height, 0.08)
          && Number(element.style.fontSize || 0) <= 24;

        if (isLegacyReference) {
          return {
            ...element,
            frame: normalizeFrame({ ...element.frame, x: 0.62, y: 0.61, width: 0.24, height: 0.1 }),
            style: {
              ...element.style,
              fontSize: 34,
              letterSpacing: 1.2,
              fontWeight: 800,
            },
          };
        }

        return element;
      });
    }
    return normalized;
  }
  return hydrateLegacySlideElements(slide, item);
};

export const summarizeElementsToLegacyContent = (elements: SlideElement[]) => {
  return elements
    .filter((element) => element.visible !== false && element.type === 'text')
    .sort((left, right) => left.frame.zIndex - right.frame.zIndex)
    .map((element) => element.content.trim())
    .filter(Boolean)
    .join('\n\n');
};

export const buildStructuredSlide = (slide: Slide, item?: ServiceItem | null): Slide => {
  const elements = getRenderableElements(slide, item);
  return {
    ...slide,
    type: slide.type || 'custom',
    layoutType: slide.layoutType || (elements.length > 1 ? 'custom-layout' : 'single'),
    elements,
    content: summarizeElementsToLegacyContent(elements) || slide.content || '',
    metadata: {
      ...(slide.metadata || {}),
      notes: slide.metadata?.notes || slide.notes || '',
    },
  };
};

