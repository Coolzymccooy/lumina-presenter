import React from 'react';
import { SafeAreas } from './SafeAreas';
import { CenterCross } from './CenterCross';
import { AspectMarkers } from './AspectMarkers';

interface ToolsOverlayProps {
  settings: ToolsSettings;
  /** Container aspect ratio for AspectMarkers (defaults to 16:9). */
  containerRatio?: number;
}

// Top-layer broadcast tooling overlay: safe areas, center cross, and aspect
// markers. Renders nothing when all overlays are off — zero cost on live
// services that don't use the Tools menu.
export const ToolsOverlay = React.memo(function ToolsOverlay({
  settings,
  containerRatio,
}: ToolsOverlayProps) {
  const { overlays, aspect } = settings;
  const hasAspect = aspect !== 'off';
  const hasSafe = overlays.safeAreas;
  const hasCross = overlays.centerCross;
  if (!hasAspect && !hasSafe && !hasCross) return null;
  return (
    <div
      data-testid="tools-overlay"
      className="pointer-events-none absolute inset-0 z-[80]"
      aria-hidden="true"
    >
      {hasAspect && <AspectMarkers aspect={aspect} containerRatio={containerRatio} />}
      {hasSafe && <SafeAreas />}
      {hasCross && <CenterCross />}
    </div>
  );
});
