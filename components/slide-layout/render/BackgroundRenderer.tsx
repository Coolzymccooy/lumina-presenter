import React, { useEffect, useMemo, useState } from 'react';
import { MediaType } from '../../../types.ts';
import { getCachedMediaAsset, getMediaAsset } from '../../../services/localMedia.ts';

interface BackgroundRendererProps {
  backgroundUrl?: string;
  mediaType?: MediaType;
  mediaFit?: 'cover' | 'contain';
}

const isVideoUrl = (value: string) => {
  const normalized = value.split('?')[0].toLowerCase();
  return normalized.endsWith('.mp4') || normalized.endsWith('.webm') || normalized.endsWith('.mov') || normalized.includes('/video/');
};

export const BackgroundRenderer: React.FC<BackgroundRendererProps> = ({
  backgroundUrl,
  mediaType,
  mediaFit = 'cover',
}) => {
  const rawUrl = String(backgroundUrl || '').trim();
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!rawUrl.startsWith('local://')) return rawUrl;
    return getCachedMediaAsset(rawUrl)?.url || '';
  });
  const [resolvedKind, setResolvedKind] = useState<'image' | 'video' | 'other' | null>(() => {
    if (!rawUrl.startsWith('local://')) return null;
    return getCachedMediaAsset(rawUrl)?.kind || null;
  });

  useEffect(() => {
    let active = true;
    if (!rawUrl) {
      setResolvedUrl('');
      setResolvedKind(null);
      return;
    }
    if (!rawUrl.startsWith('local://')) {
      setResolvedUrl(rawUrl);
      setResolvedKind(null);
      return;
    }
    const cached = getCachedMediaAsset(rawUrl);
    if (cached) {
      setResolvedUrl(cached.url);
      setResolvedKind(cached.kind);
      return;
    }
    void getMediaAsset(rawUrl).then((asset) => {
      if (!active) return;
      setResolvedUrl(asset?.url || '');
      setResolvedKind(asset?.kind || null);
    }).catch(() => {
      if (!active) return;
      setResolvedUrl('');
      setResolvedKind(null);
    });
    return () => { active = false; };
  }, [rawUrl]);

  const effectiveType = useMemo<MediaType>(() => {
    if (mediaType) return mediaType;
    if (resolvedKind === 'video') return 'video';
    if (resolvedKind === 'image') return 'image';
    if (resolvedUrl.startsWith('#')) return 'color';
    if (isVideoUrl(resolvedUrl)) return 'video';
    return 'image';
  }, [mediaType, resolvedKind, resolvedUrl]);

  if (!rawUrl) return <div className="absolute inset-0 bg-black" />;
  if (effectiveType === 'color') return <div className="absolute inset-0" style={{ backgroundColor: resolvedUrl || rawUrl }} />;

  if (effectiveType === 'video' && resolvedUrl) {
    return <video className="absolute inset-0 h-full w-full object-cover" src={resolvedUrl} muted loop autoPlay playsInline />;
  }

  if (resolvedUrl) {
    const objectClass = mediaFit === 'contain' ? 'object-contain' : 'object-cover';
    return (
      <img
        className={`absolute inset-0 h-full w-full ${objectClass}`}
        src={resolvedUrl}
        alt=""
        draggable={false}
        onError={() => {
          setResolvedUrl('');
          setResolvedKind(null);
        }}
      />
    );
  }

  return <div className="absolute inset-0 bg-black" />;
};

