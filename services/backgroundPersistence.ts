import type { MediaType, ServiceItem, ServiceItemBackgroundSource, Slide } from '../types';

export type BackgroundSnapshot = {
  backgroundUrl: string;
  mediaType: MediaType;
};

const COLOR_TOKEN_PATTERN = /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i;

const looksLikeVideoUrl = (url: string): boolean => {
  const normalized = String(url || '').trim().split('?')[0].toLowerCase();
  return normalized.endsWith('.mp4')
    || normalized.endsWith('.webm')
    || normalized.endsWith('.mov')
    || normalized.includes('/video/');
};

const inferMediaType = (backgroundUrl: string, explicitType?: MediaType): MediaType => {
  if (explicitType === 'image' || explicitType === 'video' || explicitType === 'color') return explicitType;
  const trimmed = String(backgroundUrl || '').trim();
  if (!trimmed) return 'image';
  if (COLOR_TOKEN_PATTERN.test(trimmed)) return 'color';
  return looksLikeVideoUrl(trimmed) ? 'video' : 'image';
};

export const stampItemBackgroundSource = (
  item: ServiceItem,
  backgroundSource: ServiceItemBackgroundSource,
): ServiceItem => {
  if (item.metadata?.backgroundSource === backgroundSource) return item;
  return {
    ...item,
    metadata: {
      ...item.metadata,
      backgroundSource,
    },
  };
};

export const getItemBackgroundSource = (item: ServiceItem | null | undefined): ServiceItemBackgroundSource | null => {
  const value = item?.metadata?.backgroundSource;
  return value === 'system' || value === 'user' || value === 'inherited' ? value : null;
};

export const hasExplicitSlideBackgrounds = (item: ServiceItem | null | undefined): boolean => {
  if (!item || !Array.isArray(item.slides)) return false;
  return item.slides.some((slide) => String(slide.backgroundUrl || '').trim().length > 0);
};

export const getBackgroundSnapshotFromItem = (
  item: ServiceItem | null | undefined,
  slide: Slide | null | undefined,
): BackgroundSnapshot | null => {
  const slideUrl = String(slide?.backgroundUrl || '').trim();
  const themeUrl = String(item?.theme?.backgroundUrl || '').trim();
  const backgroundUrl = slideUrl || themeUrl;
  if (!backgroundUrl) return null;
  return {
    backgroundUrl,
    mediaType: inferMediaType(backgroundUrl, slide?.mediaType || item?.theme?.mediaType),
  };
};

export const inheritPrevailingBackground = (
  item: ServiceItem,
  prevailing: BackgroundSnapshot | null | undefined,
): ServiceItem => {
  if (!prevailing?.backgroundUrl) return item;
  if (getItemBackgroundSource(item) !== 'system') return item;
  if (hasExplicitSlideBackgrounds(item)) return item;
  return {
    ...item,
    metadata: {
      ...item.metadata,
      backgroundSource: 'inherited',
    },
    theme: {
      ...item.theme,
      backgroundUrl: prevailing.backgroundUrl,
      mediaType: prevailing.mediaType,
    },
  };
};
