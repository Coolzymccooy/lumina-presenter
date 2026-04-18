import React, { useEffect, useState } from 'react';
import { getCachedMediaAsset, getMediaAsset } from '../../../services/localMedia.ts';

type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface LogoOverlayProps {
  logoUrl?: string;
  position?: LogoPosition;
  /** Width as a percentage of stage width (1-50). Defaults to 12. */
  sizePercent?: number;
}

const positionClasses: Record<LogoPosition, string> = {
  'top-left': 'top-[4%] left-[4%]',
  'top-right': 'top-[4%] right-[4%]',
  'bottom-left': 'bottom-[4%] left-[4%]',
  'bottom-right': 'bottom-[4%] right-[4%]',
};

function clampSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return 12;
  const n = Number(value);
  if (n < 1) return 1;
  if (n > 50) return 50;
  return n;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  logoUrl,
  position = 'bottom-right',
  sizePercent,
}) => {
  const raw = String(logoUrl || '').trim();
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!raw) return '';
    if (!raw.startsWith('local://')) return raw;
    return getCachedMediaAsset(raw)?.url || '';
  });

  useEffect(() => {
    let active = true;
    if (!raw) {
      setResolvedUrl('');
      return;
    }
    if (!raw.startsWith('local://')) {
      setResolvedUrl(raw);
      return;
    }
    const cached = getCachedMediaAsset(raw);
    if (cached) {
      setResolvedUrl(cached.url);
      return;
    }
    void getMediaAsset(raw).then((asset) => {
      if (!active) return;
      setResolvedUrl(asset?.url || '');
    }).catch(() => {
      if (!active) return;
      setResolvedUrl('');
    });
    return () => { active = false; };
  }, [raw]);

  if (!resolvedUrl) return null;

  const width = clampSize(sizePercent);

  return (
    <img
      className={`absolute ${positionClasses[position]} pointer-events-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]`}
      src={resolvedUrl}
      alt=""
      draggable={false}
      style={{ width: `${width}%`, height: 'auto' }}
      onError={() => setResolvedUrl('')}
    />
  );
};
