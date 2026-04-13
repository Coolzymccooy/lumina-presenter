export const TEXT_CONTRAST_BACKGROUND_OVERLAY = 'rgba(0,0,0,0.10)';
export const PROGRAM_MEDIA_PRESENTATION_FILTER = 'brightness(1.06) saturate(1.06) contrast(1.03)';
/** Canvas-rendered motion backgrounds need a stronger boost to match the vibrancy of photos/videos. */
export const MOTION_CANVAS_PRESENTATION_FILTER = 'brightness(0.95) saturate(1.35) contrast(1.12)';

type ScriptureReadingPanelCandidate = {
  itemType?: string;
  layoutType?: string;
  hasStructuredElements: boolean;
  hasReadableText: boolean;
  hasBackground: boolean;
  mediaType: string;
};

export const shouldUseScriptureReadingPanel = ({
  itemType,
  layoutType,
  hasStructuredElements,
  hasReadableText,
  hasBackground,
  mediaType,
}: ScriptureReadingPanelCandidate): boolean => {
  if (hasStructuredElements || !hasReadableText || !hasBackground) return false;
  if (mediaType === 'color') return false;
  return itemType === 'BIBLE' || itemType === 'SCRIPTURE' || layoutType === 'scripture_ref';
};

type ScriptureReferenceLabelCandidate = {
  itemType?: string;
  layoutType?: string;
  showSlideLabel: boolean;
};

export const shouldShowScriptureReferenceLabel = ({
  itemType,
  layoutType,
  showSlideLabel,
}: ScriptureReferenceLabelCandidate): boolean => (
  showSlideLabel
  || itemType === 'BIBLE'
  || itemType === 'SCRIPTURE'
  || layoutType === 'scripture_ref'
);
