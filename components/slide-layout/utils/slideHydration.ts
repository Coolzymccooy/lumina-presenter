import { SlideElement, SlideElementRole, ServiceItem, Slide, TextElementStyle, TextSlideElement } from '../../../types.ts';
import { normalizeFrame } from './frameMath.ts';

const createElementId = () => `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
    outlineColor: 'rgba(0,0,0,0.55)',
    outlineWidth: item?.theme?.shadow ? 1 : 0,
    shadow: item?.theme?.shadow ? '0 2px 12px rgba(0,0,0,0.45)' : 'none',
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
    return slide.elements.map((element, index) => ({
      ...element,
      frame: normalizeFrame({ ...element.frame, zIndex: Number.isFinite(element.frame?.zIndex) ? element.frame.zIndex : index }),
      visible: element.visible !== false,
      locked: !!element.locked,
    }));
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

