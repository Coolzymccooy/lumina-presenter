import React from 'react';
import { TextSlideElement } from '../../../types.ts';
import { CANVAS_HEIGHT, CANVAS_WIDTH, normalizedToPixels } from '../utils/frameMath.ts';

interface TextElementRendererProps {
  element: TextSlideElement;
  isSelected?: boolean;
  layoutMode?: 'absolute' | 'responsive' | 'fill-parent';
}

const scalePxValue = (value: number | undefined, scale: number, fallback = 0) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Number(value) * scale);
};

const scaleShadow = (shadow: string | undefined, scale: number) => {
  if (!shadow || shadow === 'none') return shadow || 'none';
  return shadow.replace(/(-?\d*\.?\d+)px/g, (_, raw) => `${(Number(raw) * scale).toFixed(2).replace(/\.00$/, '')}px`);
};

export const TextElementRenderer: React.FC<TextElementRendererProps> = ({ element, isSelected = false, layoutMode = 'absolute' }) => {
  if (element.visible === false) return null;
  const style = element.style || {};
  const outerRef = React.useRef<HTMLDivElement | null>(null);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const baseFontSize = Number(style.fontSize || 56);
  const [renderScale, setRenderScale] = React.useState(1);
  const [fittedFontSize, setFittedFontSize] = React.useState(baseFontSize);
  const listStyleType = style.listStyleType || 'none';
  const contentStr = String(element.content || '');
  const isHtmlContent = /<[a-zA-Z][^>]*>/.test(contentStr);
  const listItems = contentStr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^([•*\-]\s+|\d+[.)]\s+)/, ''));
  const isList = !isHtmlContent && listStyleType !== 'none' && listItems.length > 0;
  const justifyContent = style.verticalAlign === 'top' ? 'flex-start' : style.verticalAlign === 'bottom' ? 'flex-end' : 'center';
  const styleSignature = [
    element.content,
    style.fontFamily,
    style.fontWeight,
    style.fontStyle,
    style.textDecoration,
    style.textAlign,
    style.lineHeight,
    style.letterSpacing,
    style.textTransform,
    style.listStyleType,
    style.listIndent,
    style.padding,
    style.outlineWidth,
    layoutMode,
  ].join('|');
  const frameStyle = layoutMode === 'responsive'
    ? {
      left: `${element.frame.x * 100}%`,
      top: `${element.frame.y * 100}%`,
      width: `${element.frame.width * 100}%`,
      height: `${element.frame.height * 100}%`,
    }
    : layoutMode === 'fill-parent'
      ? {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
      }
    : normalizedToPixels(element.frame, CANVAS_WIDTH, CANVAS_HEIGHT);

  React.useLayoutEffect(() => {
    const node = outerRef.current;
    if (!node) return;

    const updateScale = () => {
      const heightScale = element.frame.height > 0 ? node.clientHeight / (element.frame.height * CANVAS_HEIGHT) : 1;
      const widthScale = element.frame.width > 0 ? node.clientWidth / (element.frame.width * CANVAS_WIDTH) : 1;
      const nextScale = Math.min(
        Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1,
        Number.isFinite(heightScale) && heightScale > 0 ? heightScale : 1,
      );
      setRenderScale((current) => (Math.abs(current - nextScale) > 0.001 ? nextScale : current));
    };

    updateScale();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(node);
    return () => observer.disconnect();
  }, [element.frame.height, element.frame.width]);

  React.useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const availableWidth = outer.clientWidth;
    const availableHeight = outer.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaledBaseFontSize = Math.max(1, baseFontSize * renderScale);
    const minimumFontSize = Math.max(10 * renderScale, Math.min(scaledBaseFontSize, 18 * renderScale));

    const applySize = (value: number) => {
      inner.style.fontSize = `${value}px`;
    };

    const fits = () => inner.scrollHeight <= availableHeight + 1 && inner.scrollWidth <= availableWidth + 1;

    let nextFontSize = scaledBaseFontSize;
    applySize(nextFontSize);

    if (!fits()) {
      let low = minimumFontSize;
      let high = scaledBaseFontSize;
      let best = minimumFontSize;

      applySize(low);
      if (fits()) {
        while (high - low > 0.5) {
          const mid = (low + high) / 2;
          applySize(mid);
          if (fits()) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }
        nextFontSize = best;
      } else {
        nextFontSize = minimumFontSize;
      }
    }

    setFittedFontSize((current) => (Math.abs(current - nextFontSize) > 0.2 ? nextFontSize : current));
  }, [baseFontSize, renderScale, styleSignature]);

  const scaledPadding = scalePxValue(style.padding, renderScale, 0);
  const scaledBorderRadius = scalePxValue(style.borderRadius, renderScale, 0);
  const scaledLetterSpacing = Number.isFinite(style.letterSpacing) ? Number(style.letterSpacing) * renderScale : undefined;
  const scaledOutlineWidth = Number.isFinite(style.outlineWidth) ? Math.max(0, Number(style.outlineWidth) * renderScale) : undefined;
  const scaledListIndent = Number.isFinite(style.listIndent) ? Number(style.listIndent) * renderScale : undefined;
  const scaledShadow = scaleShadow(style.shadow, renderScale);

  return (
    <div
      ref={outerRef}
      className={`absolute overflow-hidden ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}
      style={{
        ...frameStyle,
        zIndex: element.frame.zIndex,
        transform: element.frame.rotation ? `rotate(${element.frame.rotation}deg)` : undefined,
        opacity: style.opacity ?? 1,
        borderRadius: scaledBorderRadius,
        backgroundColor: style.backgroundColor || 'transparent',
        display: 'flex',
        alignItems: justifyContent,
        justifyContent: style.textAlign === 'left' ? 'flex-start' : style.textAlign === 'right' ? 'flex-end' : 'center',
        padding: scaledPadding,
      }}
    >
      <div
        ref={innerRef}
        className="w-full whitespace-pre-wrap break-words"
        style={{
          fontFamily: style.fontFamily,
          fontSize: fittedFontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textDecoration: style.textDecoration,
          color: style.color,
          textAlign: style.textAlign,
          lineHeight: style.lineHeight,
          letterSpacing: scaledLetterSpacing,
          textTransform: style.textTransform,
          textShadow: scaledShadow,
          WebkitTextStroke: scaledOutlineWidth ? `${scaledOutlineWidth}px ${style.outlineColor || 'transparent'}` : undefined,
        }}
      >
        {isList ? (
          listStyleType === 'decimal' ? (
            <ol
              data-testid={`slide-text-list-${element.id}`}
              className="m-0"
              style={{
                listStyleType: 'decimal',
                listStylePosition: 'outside',
                paddingInlineStart: scaledListIndent ?? 28 * renderScale,
                marginInlineStart: 0,
              }}
            >
              {listItems.map((item, index) => (
                <li key={`${element.id}-li-${index}`} data-testid={`slide-text-list-item-${element.id}`} className="mb-[0.22em] last:mb-0">
                  {item}
                </li>
              ))}
            </ol>
          ) : (
            <ul
              data-testid={`slide-text-list-${element.id}`}
              className="m-0"
              style={{
                listStyleType,
                listStylePosition: 'outside',
                paddingInlineStart: scaledListIndent ?? 28 * renderScale,
                marginInlineStart: 0,
              }}
            >
              {listItems.map((item, index) => (
                <li key={`${element.id}-li-${index}`} data-testid={`slide-text-list-item-${element.id}`} className="mb-[0.22em] last:mb-0">
                  {item}
                </li>
              ))}
            </ul>
          )
        ) : isHtmlContent ? (
          <span dangerouslySetInnerHTML={{ __html: contentStr }} />
        ) : (
          element.content
        )}
      </div>
    </div>
  );
};

