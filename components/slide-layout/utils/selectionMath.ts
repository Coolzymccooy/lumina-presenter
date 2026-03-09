import { SlideElement } from '../../../types.ts';

export const bringElementForward = (elements: SlideElement[], elementId: string) => {
  const ordered = [...elements].sort((a, b) => a.frame.zIndex - b.frame.zIndex);
  const index = ordered.findIndex((entry) => entry.id === elementId);
  if (index < 0 || index === ordered.length - 1) return elements;
  const current = ordered[index];
  const next = ordered[index + 1];
  const currentZ = current.frame.zIndex;
  current.frame.zIndex = next.frame.zIndex;
  next.frame.zIndex = currentZ;
  return [...ordered];
};

export const sendElementBackward = (elements: SlideElement[], elementId: string) => {
  const ordered = [...elements].sort((a, b) => a.frame.zIndex - b.frame.zIndex);
  const index = ordered.findIndex((entry) => entry.id === elementId);
  if (index <= 0) return elements;
  const current = ordered[index];
  const prev = ordered[index - 1];
  const currentZ = current.frame.zIndex;
  current.frame.zIndex = prev.frame.zIndex;
  prev.frame.zIndex = currentZ;
  return [...ordered];
};

