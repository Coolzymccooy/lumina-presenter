/**
 * MotionCanvas – React wrapper for the Lumina Motion Engine.
 *
 * Renders a full-size <canvas> that displays an animated motion background.
 * Accepts a motion:// URL, extracts the scene ID, and drives the engine.
 *
 * Usage:
 *   <MotionCanvas sceneId="royal-worship" />
 *   <MotionCanvas motionUrl="motion://prayer-glow" />
 */

import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  MotionEngine,
  extractMotionSceneId,
  generateMotionPoster,
  getSceneDefinition,
  isMotionUrl,
  normalizeMotionSceneId,
} from '../services/motionEngine';

interface MotionCanvasProps {
  /** Scene ID (e.g. "royal-worship") – takes priority over motionUrl */
  sceneId?: string;
  /** Full motion URL (e.g. "motion://royal-worship") */
  motionUrl?: string;
  /** Whether the canvas should be animating (default: true) */
  isPlaying?: boolean;
  /** Additional className for the wrapper div */
  className?: string;
  /** Inline styles for the wrapper div */
  style?: React.CSSProperties;
  /** Pause preview loops when the tile scrolls offscreen. */
  pauseWhenOffscreen?: boolean;
  /** Explicit poster fallback shown behind the canvas. */
  posterUrl?: string;
}

export const MotionCanvas: React.FC<MotionCanvasProps> = memo(({
  sceneId: sceneIdProp,
  motionUrl,
  isPlaying = true,
  className,
  style,
  pauseWhenOffscreen = false,
  posterUrl,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MotionEngine | null>(null);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (
    typeof document === 'undefined' ? true : !document.hidden
  ));
  const [isInViewport, setIsInViewport] = useState(true);

  const candidateSceneId = sceneIdProp
    || (motionUrl && isMotionUrl(motionUrl) ? extractMotionSceneId(motionUrl) : null);
  const resolvedSceneId = useMemo(
    () => normalizeMotionSceneId(candidateSceneId || '', 'sermon-clean'),
    [candidateSceneId],
  );
  const sceneDefinition = useMemo(
    () => getSceneDefinition(resolvedSceneId),
    [resolvedSceneId],
  );
  const effectivePosterUrl = useMemo(
    () => posterUrl || (sceneDefinition ? generateMotionPoster(sceneDefinition) : ''),
    [posterUrl, sceneDefinition],
  );
  const shouldAnimate = Boolean(
    isPlaying
    && resolvedSceneId
    && isDocumentVisible
    && (!pauseWhenOffscreen || isInViewport),
  );

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new MotionEngine();
    engine.attach(canvas);
    engineRef.current = engine;

    return () => {
      engine.detach();
      engineRef.current = null;
    };
  }, []);

  // Load scene when sceneId changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !resolvedSceneId) return;
    const loaded = engine.loadScene(resolvedSceneId);
    setHasRenderedFrame(loaded && engine.renderOnce());
  }, [resolvedSceneId]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibilityChange = () => {
      setIsDocumentVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!pauseWhenOffscreen || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return undefined;
    }
    const node = wrapperRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsInViewport(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [pauseWhenOffscreen]);

  // Start/stop animation
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !resolvedSceneId) return;

    if (shouldAnimate) {
      if (!hasRenderedFrame) {
        setHasRenderedFrame(engine.renderOnce());
      }
      engine.start();
    } else {
      engine.stop();
    }

    return () => {
      engine.stop();
    };
  }, [hasRenderedFrame, resolvedSceneId, shouldAnimate]);

  // Handle resize
  useEffect(() => {
    const engine = engineRef.current;
    const node = wrapperRef.current;
    if (!engine || !node) return;

    const observer = new ResizeObserver(() => {
      engine.resize();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      {effectivePosterUrl && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${effectivePosterUrl})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          opacity: shouldAnimate && hasRenderedFrame ? 1 : 0,
        }}
      />
    </div>
  );
});

MotionCanvas.displayName = 'MotionCanvas';
