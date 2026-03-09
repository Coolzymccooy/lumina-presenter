import React from 'react';
import { TextSlideElement } from '../../../types.ts';
import { CANVAS_HEIGHT, CANVAS_WIDTH, normalizedToPixels } from '../utils/frameMath.ts';

interface TextElementRendererProps {
  element: TextSlideElement;
  isSelected?: boolean;
  layoutMode?: 'absolute' | 'responsive' | 'fill-parent';
}

export const TextElementRenderer: React.FC<TextElementRendererProps> = ({ element, isSelected = false, layoutMode = 'absolute' }) => {
  if (element.visible === false) return null;
  const style = element.style || {};
  const listStyleType = style.listStyleType || 'none';
  const listItems = String(element.content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^([•*\-]\s+|\d+[.)]\s+)/, ''));
  const isList = listStyleType !== 'none' && listItems.length > 0;
  const justifyContent = style.verticalAlign === 'top' ? 'flex-start' : style.verticalAlign === 'bottom' ? 'flex-end' : 'center';
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
  return (
    <div
      className={`absolute overflow-hidden ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}
      style={{
        ...frameStyle,
        zIndex: element.frame.zIndex,
        transform: element.frame.rotation ? `rotate(${element.frame.rotation}deg)` : undefined,
        opacity: style.opacity ?? 1,
        borderRadius: style.borderRadius ?? 0,
        backgroundColor: style.backgroundColor || 'transparent',
        display: 'flex',
        alignItems: justifyContent,
        justifyContent: style.textAlign === 'left' ? 'flex-start' : style.textAlign === 'right' ? 'flex-end' : 'center',
        padding: style.padding ?? 0,
      }}
    >
      <div
        className="w-full whitespace-pre-wrap break-words"
        style={{
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textDecoration: style.textDecoration,
          color: style.color,
          textAlign: style.textAlign,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textTransform: style.textTransform,
          textShadow: style.shadow,
          WebkitTextStroke: style.outlineWidth ? `${style.outlineWidth}px ${style.outlineColor || 'transparent'}` : undefined,
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
                paddingInlineStart: style.listIndent ?? 28,
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
                paddingInlineStart: style.listIndent ?? 28,
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
        ) : (
          element.content
        )}
      </div>
    </div>
  );
};

