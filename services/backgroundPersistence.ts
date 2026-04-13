import type { MediaType, ServiceItem, ServiceItemBackgroundSource, Slide } from '../types';
import { isMotionUrl } from './motionEngine';

export type BackgroundSnapshot = {
  backgroundUrl: string;
  mediaType: MediaType;
  backgroundFallbackUrl?: string;
  backgroundFallbackMediaType?: MediaType;
  backgroundSourceUrl?: string;
  backgroundProvider?: string;
  backgroundCategory?: string;
  backgroundTitle?: string;
};

const COLOR_TOKEN_PATTERN = /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i;
const isRemoteMediaUrl = (url: string) => /^https?:\/\//i.test(String(url || '').trim());

const looksLikeVideoUrl = (url: string): boolean => {
  const normalized = String(url || '').trim().split('?')[0].toLowerCase();
  return normalized.endsWith('.mp4')
    || normalized.endsWith('.webm')
    || normalized.endsWith('.mov')
    || normalized.includes('/video/');
};

const inferMediaType = (backgroundUrl: string, explicitType?: MediaType): MediaType => {
  if (explicitType === 'image' || explicitType === 'video' || explicitType === 'color' || explicitType === 'motion') return explicitType;
  const trimmed = String(backgroundUrl || '').trim();
  if (!trimmed) return 'image';
  if (isMotionUrl(trimmed)) return 'motion';
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
  const slideMetadata = slide?.metadata;
  const backgroundFallbackUrl = slideUrl
    ? String(slideMetadata?.backgroundFallbackUrl || '').trim()
    : String(item?.metadata?.backgroundFallbackUrl || '').trim();
  const backgroundFallbackMediaType = slideUrl
    ? slideMetadata?.backgroundFallbackMediaType
    : item?.metadata?.backgroundFallbackMediaType;
  const backgroundSourceUrl = slideUrl
    ? String(slideMetadata?.backgroundSourceUrl || (isRemoteMediaUrl(slideUrl) ? slideUrl : '')).trim()
    : String(item?.metadata?.backgroundSourceUrl || '').trim();
  const backgroundProvider = slideUrl
    ? String(slideMetadata?.backgroundProvider || '').trim()
    : String(item?.metadata?.backgroundProvider || '').trim();
  const backgroundCategory = slideUrl
    ? String(slideMetadata?.backgroundCategory || '').trim()
    : String(item?.metadata?.backgroundCategory || '').trim();
  const backgroundTitle = slideUrl
    ? String(slideMetadata?.backgroundTitle || '').trim()
    : String(item?.metadata?.backgroundTitle || '').trim();
  return {
    backgroundUrl,
    mediaType: inferMediaType(backgroundUrl, slide?.mediaType || item?.theme?.mediaType),
    backgroundFallbackUrl: backgroundFallbackUrl || undefined,
    backgroundFallbackMediaType: backgroundFallbackUrl
      ? inferMediaType(backgroundFallbackUrl, backgroundFallbackMediaType || item?.theme?.mediaType)
      : undefined,
    backgroundSourceUrl: backgroundSourceUrl || undefined,
    backgroundProvider: backgroundProvider || undefined,
    backgroundCategory: backgroundCategory || undefined,
    backgroundTitle: backgroundTitle || undefined,
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
      backgroundFallbackUrl: prevailing.backgroundFallbackUrl || prevailing.backgroundUrl,
      backgroundFallbackMediaType: prevailing.backgroundFallbackMediaType || prevailing.mediaType,
      backgroundSourceUrl: prevailing.backgroundSourceUrl || prevailing.backgroundUrl,
      backgroundProvider: prevailing.backgroundProvider,
      backgroundCategory: prevailing.backgroundCategory,
      backgroundTitle: prevailing.backgroundTitle,
    },
    theme: {
      ...item.theme,
      backgroundUrl: prevailing.backgroundUrl,
      mediaType: prevailing.mediaType,
    },
  };
};

export const clearItemBackgroundFallback = (item: ServiceItem): ServiceItem => {
  const metadata = item.metadata;
  if (!metadata) return item;
  if (!metadata.backgroundFallbackUrl && !metadata.backgroundFallbackMediaType) return item;
  const {
    backgroundFallbackUrl: _backgroundFallbackUrl,
    backgroundFallbackMediaType: _backgroundFallbackMediaType,
    ...restMetadata
  } = metadata;
  return {
    ...item,
    metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
  };
};
