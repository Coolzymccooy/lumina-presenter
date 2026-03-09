import React from 'react';
import { SlideElement } from '../../../types.ts';
import { sortElementsByLayer } from '../utils/frameMath.ts';
import { TextElementRenderer } from './TextElementRenderer.tsx';

interface ElementRendererProps {
  elements: SlideElement[];
  selectedElementId?: string | null;
  layoutMode?: 'absolute' | 'responsive' | 'fill-parent';
}

export const ElementRenderer: React.FC<ElementRendererProps> = ({ elements, selectedElementId, layoutMode = 'absolute' }) => {
  return (
    <>
      {sortElementsByLayer(elements).map((element) => {
        if (element.type === 'text') {
          return <TextElementRenderer key={element.id} element={element} isSelected={selectedElementId === element.id} layoutMode={layoutMode} />;
        }
        return null;
      })}
    </>
  );
};

