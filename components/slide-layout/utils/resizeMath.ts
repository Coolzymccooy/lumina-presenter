import { ElementFrame } from '../../../types.ts';
import { clamp, normalizeFrame } from './frameMath.ts';

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const resizeFrame = (frame: ElementFrame, handle: ResizeHandle, deltaX: number, deltaY: number): ElementFrame => {
  let next = { ...frame };

  if (handle.includes('e')) next.width += deltaX;
  if (handle.includes('s')) next.height += deltaY;
  if (handle.includes('w')) {
    next.x += deltaX;
    next.width -= deltaX;
  }
  if (handle.includes('n')) {
    next.y += deltaY;
    next.height -= deltaY;
  }

  next.width = clamp(next.width, 0.08, 1);
  next.height = clamp(next.height, 0.06, 1);
  next.x = clamp(next.x, 0, 1 - next.width);
  next.y = clamp(next.y, 0, 1 - next.height);

  return normalizeFrame(next);
};

