import { ElementFrame, SlideElement } from '../../../types.ts';

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const MIN_FRAME_WIDTH = 0.08;
export const MIN_FRAME_HEIGHT = 0.06;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const clamp01 = (value: number) => clamp(value, 0, 1);

export const sortElementsByLayer = <T extends SlideElement>(elements: T[]) => {
  return [...elements].sort((left, right) => left.frame.zIndex - right.frame.zIndex);
};

export const normalizeFrame = (frame: ElementFrame): ElementFrame => {
  const width = clamp(frame.width, MIN_FRAME_WIDTH, 1);
  const height = clamp(frame.height, MIN_FRAME_HEIGHT, 1);
  const x = clamp(frame.x, 0, 1 - width);
  const y = clamp(frame.y, 0, 1 - height);
  return {
    ...frame,
    x,
    y,
    width,
    height,
    zIndex: Number.isFinite(frame.zIndex) ? frame.zIndex : 0,
  };
};

export const normalizedToPixels = (frame: ElementFrame, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) => ({
  left: frame.x * width,
  top: frame.y * height,
  width: frame.width * width,
  height: frame.height * height,
});

export const pixelsToNormalized = (
  rect: { left: number; top: number; width: number; height: number },
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
  zIndex = 0,
): ElementFrame => normalizeFrame({
  x: rect.left / width,
  y: rect.top / height,
  width: rect.width / width,
  height: rect.height / height,
  zIndex,
});

export const nudgeFrame = (frame: ElementFrame, deltaX: number, deltaY: number) => normalizeFrame({
  ...frame,
  x: frame.x + deltaX,
  y: frame.y + deltaY,
});

