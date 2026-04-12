import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Slide, ServiceItem, MediaType, AudienceDisplayState, AudienceQrProjectionState } from "../types";

import { getMediaAsset, getCachedMediaAsset } from "../services/localMedia";
import { ElementRenderer } from "./slide-layout/render/ElementRenderer";
import { PROGRAM_MEDIA_PRESENTATION_FILTER, shouldShowScriptureReferenceLabel, shouldUseScriptureReadingPanel, TEXT_CONTRAST_BACKGROUND_OVERLAY } from "./slide-layout/render/backgroundTone";
import { getRenderableElements } from "./slide-layout/utils/slideHydration";
import { SlideBrandingOverlay, type SlideBrandingConfig } from "./SlideBrandingOverlay";
import { VideoBackground } from "./video/VideoBackground";
import { AlphaOverlay } from "./video/AlphaOverlay";

interface SlideRendererProps {
  slide: Slide | null;
  item: ServiceItem | null;

  /** If true: fill parent height (Preview/Output panes). If false: keep 16:9 via aspect-video. */
  fitContainer?: boolean;

  /** Thumbnails: smaller padding + no autoplay. */
  isThumbnail?: boolean;

  /** Playback controls (Preview controls; Output mirrors). */
  isPlaying?: boolean;
  seekCommand?: number | null;
  seekAmount?: number;
  /** Absolute playback position (seconds) to seek to — takes priority over relative seekAmount for YouTube. */
  seekTarget?: number | null;
  /** Wall-clock sync anchor: when epochMs was set, video was at offsetSec. Used to sync late-loading iframes. */
  videoSyncEpoch?: { epochMs: number; offsetSec: number } | null;

  /** Mute audio (recommended true for preview). */
  isMuted?: boolean;

  /** When rendering inside the projector popout window. Enables a safer YouTube strategy. */
  isProjector?: boolean;
  lowerThirds?: boolean;
  showSlideLabel?: boolean;
  showProjectorHelper?: boolean;
  audienceOverlay?: AudienceDisplayState;
  projectedAudienceQr?: AudienceQrProjectionState;
  /** Church branding strips shown on left/right edges. Only pass on full-size (non-thumbnail) renders. */
  branding?: SlideBrandingConfig;
}

function safeString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function getYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  return m?.[1] ?? null;
}

function looksLikeDirectVideo(url: string): boolean {
  if (!url) return false;
  const normalized = url.split("?")[0].toLowerCase();
  return (
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".mov") ||
    normalized.includes("/video/")
  );
}

// Internal canvas dimensions — slides are always laid out at this resolution
// then CSS-scaled to fill any container. Guarantees preview === output appearance.
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const CANVAS_ASPECT = CANVAS_W / CANVAS_H;

type CanvasFrame = {
  viewportWidth: number;
  viewportHeight: number;
  renderWidth: number;
  renderHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

const EMPTY_CANVAS_FRAME: CanvasFrame = {
  viewportWidth: 0,
  viewportHeight: 0,
  renderWidth: CANVAS_W,
  renderHeight: CANVAS_H,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

function computeCanvasFrame(width: number, height: number): CanvasFrame {
  const viewportWidth = Math.max(0, Math.round(width));
  const viewportHeight = Math.max(0, Math.round(height));

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return EMPTY_CANVAS_FRAME;
  }

  let renderWidth = viewportWidth;
  let renderHeight = Math.round(renderWidth / CANVAS_ASPECT);

  if (renderHeight > viewportHeight) {
    renderHeight = viewportHeight;
    renderWidth = Math.round(renderHeight * CANVAS_ASPECT);
  }

  renderWidth = Math.max(1, Math.min(viewportWidth, renderWidth));
  renderHeight = Math.max(1, Math.min(viewportHeight, renderHeight));

  return {
    viewportWidth,
    viewportHeight,
    renderWidth,
    renderHeight,
    offsetX: Math.floor((viewportWidth - renderWidth) / 2),
    offsetY: Math.floor((viewportHeight - renderHeight) / 2),
    scale: Math.min(renderWidth / CANVAS_W, renderHeight / CANVAS_H),
  };
}

function canvasFramesEqual(a: CanvasFrame, b: CanvasFrame): boolean {
  return (
    a.viewportWidth === b.viewportWidth
    && a.viewportHeight === b.viewportHeight
    && a.renderWidth === b.renderWidth
    && a.renderHeight === b.renderHeight
    && a.offsetX === b.offsetX
    && a.offsetY === b.offsetY
  );
}

const STABLE_MEDIA_LAYER_STYLE: React.CSSProperties = {
  display: "block",
  backfaceVisibility: "hidden",
  transform: "translateZ(0)",
};

type RetainedBackgroundAsset = {
  url: string;
  mediaType: MediaType;
  imageFit: "cover" | "contain";
  youtubeId: string | null;
};

/**
 * Returns fixed pixel font size for the internal 1920×1080 canvas.
 * Because the canvas is always the same size, layout is identical in
 * preview (small box) and fullscreen projector output.
 */
function computeTextPx(size: string | undefined, text: string): number {
  const base =
    size === "small" ? 48
      : size === "medium" ? 62
        : size === "xlarge" ? 96
          : 76; // "large" default

  const len = text.length;
  const linesCount = Math.max(1, text.split(/\n/).length);

  // More aggressive shrinking for very long text
  const shrinkByLen =
    len > 1200 ? 0.45 : len > 900 ? 0.50 : len > 700 ? 0.60 : len > 500 ? 0.70 : len > 350 ? 0.80 : 1.0;

  // More aggressive shrinking for many lines
  const shrinkByLines =
    linesCount >= 14 ? 0.50 : linesCount >= 11 ? 0.60 : linesCount >= 8 ? 0.70 : linesCount >= 5 ? 0.85 : 1.0;

  return Math.round(Math.max(28, base * Math.min(shrinkByLen, shrinkByLines)));
}

function getBestOrigin(): string {
  // YouTube embeds in about:blank popouts can be picky.
  // If possible, use the opener origin (same-origin) so the embed has a stable origin.
  try {
    const o = window.opener?.location?.origin;
    if (o && o !== "null") return o;
  } catch {
    // ignore
  }
  try {
    const o = window.location?.origin;
    if (o && o !== "null" && o !== "about:blank") return o;
  } catch {
    // ignore
  }
  return "";
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({
  slide,
  item,
  fitContainer = false,
  isThumbnail = false,
  isPlaying = true,
  seekCommand = null,
  seekAmount = 0,
  seekTarget = null,
  videoSyncEpoch = null,
  isMuted = false,
  isProjector = false,
  lowerThirds = false,
  showSlideLabel = true,
  showProjectorHelper = true,
  audienceOverlay,
  projectedAudienceQr,
  branding,
}) => {
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);
  const lastStableBackgroundRef = useRef<RetainedBackgroundAsset | null>(null);
  // Reactive mirror of lastStableBackgroundRef — triggers re-render for floor layer.
  const [retainedFloor, setRetainedFloor] = useState<RetainedBackgroundAsset | null>(null);
  const [isCurrentMediaReady, setIsCurrentMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [legacyLocalMediaMissing, setLegacyLocalMediaMissing] = useState(false);
  const [isYoutubeReady, setIsYoutubeReady] = useState(false);

  const slideBackgroundUrl = useMemo(() => safeString(slide?.backgroundUrl), [slide?.backgroundUrl]);
  const itemBackgroundUrl = useMemo(() => safeString(item?.theme?.backgroundUrl), [item?.theme?.backgroundUrl]);
  const itemBackgroundSourceUrl = useMemo(() => safeString(item?.metadata?.backgroundSourceUrl), [item?.metadata?.backgroundSourceUrl]);
  const itemBackgroundThumbnailUrl = useMemo(() => item?.metadata?.backgroundThumbnailUrl || undefined, [item?.metadata?.backgroundThumbnailUrl]);
  const projectorSafeItemBackgroundUrl = useMemo(
    () => (slideBackgroundUrl ? "" : safeString(item?.metadata?.backgroundFallbackUrl)),
    [slideBackgroundUrl, item?.metadata?.backgroundFallbackUrl],
  );
  const effectiveItemMediaType = useMemo(
    () => (
      !slideBackgroundUrl
      && item?.metadata?.backgroundSource === "inherited"
      && projectorSafeItemBackgroundUrl
        ? (item?.metadata?.backgroundFallbackMediaType || item?.theme?.mediaType)
        : item?.theme?.mediaType
    ),
    [
      slideBackgroundUrl,
      item?.metadata?.backgroundSource,
      item?.metadata?.backgroundFallbackMediaType,
      item?.theme?.mediaType,
      projectorSafeItemBackgroundUrl,
    ],
  );
  const rawBgUrl = useMemo(() => {
    if (slideBackgroundUrl) return slideBackgroundUrl;
    if (item?.metadata?.backgroundSource === "inherited" && projectorSafeItemBackgroundUrl) {
      return projectorSafeItemBackgroundUrl;
    }
    return itemBackgroundUrl || "";
  }, [slideBackgroundUrl, item?.metadata?.backgroundSource, projectorSafeItemBackgroundUrl, itemBackgroundUrl]);
  const sourceRecoveryUrl = useMemo(() => {
    if (slideBackgroundUrl) return "";
    if (!rawBgUrl.startsWith("local://")) return "";
    if (!itemBackgroundSourceUrl || itemBackgroundSourceUrl === rawBgUrl) return "";
    return itemBackgroundSourceUrl;
  }, [slideBackgroundUrl, rawBgUrl, itemBackgroundSourceUrl]);

  const hasBackground = !!rawBgUrl;

  // Prevent loading spinner flashes for cached local:// media
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!hasBackground) return "";
    if (rawBgUrl.startsWith("local://")) return getCachedMediaAsset(rawBgUrl)?.url || "";
    return rawBgUrl;
  });
  const [resolvedLocalKind, setResolvedLocalKind] = useState<"image" | "video" | "other" | null>(() => {
    if (!hasBackground || !rawBgUrl.startsWith("local://")) return null;
    return getCachedMediaAsset(rawBgUrl)?.kind || null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!hasBackground) return false;
    return rawBgUrl.startsWith("local://") && !getCachedMediaAsset(rawBgUrl);
  });

  // Keep media state aligned with the incoming slide before paint so the live
  // renderer does not keep showing a previous image while advancing through
  // visual-only decks (uploaded images / PPT visual imports).
  useLayoutEffect(() => {
    if (!hasBackground) {
      setResolvedUrl("");
      setResolvedLocalKind(null);
      setIsLoading(false);
      setMediaError(false);
      setLegacyLocalMediaMissing(false);
      return;
    }

    if (!rawBgUrl.startsWith("local://")) {
      setResolvedUrl(rawBgUrl);
      setResolvedLocalKind(null);
      setIsLoading(false);
      setMediaError(false);
      setLegacyLocalMediaMissing(false);
      return;
    }

    const cached = getCachedMediaAsset(rawBgUrl);
    setResolvedUrl(cached?.url || "");
    setResolvedLocalKind(cached?.kind || null);
    setIsLoading(!cached);
    setMediaError(false);
    setLegacyLocalMediaMissing(false);
  }, [hasBackground, rawBgUrl]);

  // Resolve uncached local:// URLs async (only if a background exists)
  useEffect(() => {
    if (!hasBackground || !rawBgUrl.startsWith("local://")) return undefined;
    const cached = getCachedMediaAsset(rawBgUrl);
    if (cached) return undefined;

    let active = true;
    setIsLoading(true);

    void getMediaAsset(rawBgUrl).then((asset) => {
      if (!active) return;
      if (asset?.url) {
        setResolvedUrl(asset.url);
        setResolvedLocalKind(asset.kind);
        setMediaError(false);
        setLegacyLocalMediaMissing(false);
        return;
      }
      if (sourceRecoveryUrl) {
        setResolvedUrl(sourceRecoveryUrl);
        setResolvedLocalKind(null);
        setMediaError(false);
        setLegacyLocalMediaMissing(false);
        return;
      }
      setResolvedUrl("");
      setResolvedLocalKind(null);
      setMediaError(true);
      setLegacyLocalMediaMissing(true);
    }).catch(() => {
      if (!active) return;
      if (sourceRecoveryUrl) {
        setResolvedUrl(sourceRecoveryUrl);
        setResolvedLocalKind(null);
        setMediaError(false);
        setLegacyLocalMediaMissing(false);
        return;
      }
      setResolvedUrl("");
      setResolvedLocalKind(null);
      setMediaError(true);
      setLegacyLocalMediaMissing(true);
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [rawBgUrl, hasBackground, sourceRecoveryUrl]);

  // Decide media type
  const youtubeId = useMemo(() => getYoutubeId(resolvedUrl || ""), [resolvedUrl]);
  const isYoutube = !!youtubeId;

  const mediaType: MediaType = useMemo(() => {
    if (!hasBackground) return "image";
    const effectiveUrl = resolvedUrl || rawBgUrl;
    if (slideBackgroundUrl) {
      if (slide?.mediaType === "color" || effectiveUrl.startsWith("#")) return "color";
      if (slide?.mediaType === "video") return "video";
      if (slide?.mediaType === "image") return "image";
      if (rawBgUrl.startsWith("local://") && resolvedLocalKind === "video") return "video";
      if (rawBgUrl.startsWith("local://") && resolvedLocalKind === "image") return "image";
      if (isYoutube) return "video";
      if (looksLikeDirectVideo(effectiveUrl)) return "video";
      return "image";
    }
    if (itemBackgroundUrl || projectorSafeItemBackgroundUrl) {
      if (effectiveItemMediaType === "color" || effectiveUrl.startsWith("#")) return "color";
      if (effectiveItemMediaType === "video") return "video";
      if (effectiveItemMediaType === "image") return "image";
      if (rawBgUrl.startsWith("local://") && resolvedLocalKind === "video") return "video";
      if (rawBgUrl.startsWith("local://") && resolvedLocalKind === "image") return "image";
      if (isYoutube) return "video";
      if (looksLikeDirectVideo(effectiveUrl)) return "video";
    }
    if (effectiveUrl.startsWith("#")) return "color";
    if (looksLikeDirectVideo(effectiveUrl)) return "video";
    return "image";
  }, [hasBackground, isYoutube, slide?.mediaType, effectiveItemMediaType, resolvedUrl, rawBgUrl, slideBackgroundUrl, itemBackgroundUrl, projectorSafeItemBackgroundUrl, resolvedLocalKind]);

  const imageFit = useMemo<'cover' | 'contain'>(() => {
    if (slide?.mediaFit === 'contain' || slide?.mediaFit === 'cover') return slide.mediaFit;
    if (mediaType === 'image' && rawBgUrl.startsWith('local://')) return 'contain';
    return 'cover';
  }, [slide?.mediaFit, mediaType, rawBgUrl]);

  // Reset errors when slide changes
  useEffect(() => {
    setMediaError(false);
    setLegacyLocalMediaMissing(false);
  }, [slide?.id, item?.id, rawBgUrl]);

  const handleMediaError = useCallback(() => {
    setMediaError(true);
    if (rawBgUrl.startsWith("local://")) {
      setLegacyLocalMediaMissing(true);
    }
  }, [rawBgUrl]);

  const buildRetainedAsset = useCallback((): RetainedBackgroundAsset | null => {
    if (!hasBackground) return null;
    if (mediaType === "color" && rawBgUrl) {
      return {
        url: rawBgUrl,
        mediaType: "color",
        imageFit,
        youtubeId: null,
      };
    }
    if (!resolvedUrl) return null;
    return {
      url: resolvedUrl,
      mediaType,
      imageFit,
      youtubeId,
    };
  }, [hasBackground, mediaType, rawBgUrl, resolvedUrl, imageFit, youtubeId]);

  const markCurrentMediaReady = useCallback(() => {
    setIsCurrentMediaReady(true);
    const next = buildRetainedAsset();
    if (!next) return;
    lastStableBackgroundRef.current = next;
    setRetainedFloor((prev) => (
      prev
      && prev.url === next.url
      && prev.mediaType === next.mediaType
      && prev.imageFit === next.imageFit
      && prev.youtubeId === next.youtubeId
        ? prev
        : next
    ));
  }, [buildRetainedAsset]);

  // Stable ref so the callback ref below never changes identity between renders,
  // avoiding the React "old ref gets null, new ref gets node" re-fire cycle.
  const markCurrentMediaReadyRef = useRef(markCurrentMediaReady);
  useEffect(() => {
    markCurrentMediaReadyRef.current = markCurrentMediaReady;
  }, [markCurrentMediaReady]);

  // Callback ref for <img> elements.  When a blob URL is already in the
  // browser's decoded-image cache, the 'load' event fires synchronously
  // before React attaches the onLoad handler, so it is silently missed.
  // Checking node.complete here catches that race and immediately marks the
  // media ready, preventing the retained-floor from hanging forever.
  const imgCallbackRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) {
      markCurrentMediaReadyRef.current();
    }
  }, []); // intentionally empty — uses stable ref above

  useEffect(() => {
    setIsYoutubeReady(false);
  }, [youtubeId, resolvedUrl, slide?.id, item?.id]);

  const isDataUriBg = rawBgUrl.startsWith('data:');

  // Reset readiness when the actual background source/type changes.
  // Deliberately excludes markCurrentMediaReady so its identity change between
  // slides (due to imageFit/buildRetainedAsset) does NOT reset the floor.
  useEffect(() => {
    if (!hasBackground) {
      setIsCurrentMediaReady(true);
      return;
    }
    setIsCurrentMediaReady(false);
  }, [hasBackground, rawBgUrl, resolvedUrl, mediaType, youtubeId]);

  // For instant-ready types (solid color, data-URI image) notify immediately.
  useEffect(() => {
    if (!hasBackground) return;
    if (!mediaError && !isLoading && (mediaType === "color" || (isDataUriBg && mediaType !== "video"))) {
      markCurrentMediaReady();
    }
  }, [hasBackground, mediaError, isLoading, mediaType, isDataUriBg, markCurrentMediaReady]);

  // HTML5 video play/pause and seek are now handled inside VideoBackground.

  const postYoutubeCommand = useCallback((func: string, args: any[] = []) => {
    const frameWindow = youtubeIframeRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.postMessage(JSON.stringify({
      event: "command",
      func,
      args,
    }), "*");
  }, []);

  useEffect(() => {
    if (!hasBackground || !isYoutube || !isYoutubeReady || isLoading || mediaError || isThumbnail) return;
    if (isPlaying) postYoutubeCommand("playVideo");
    else postYoutubeCommand("pauseVideo");
  }, [hasBackground, isYoutube, isYoutubeReady, isLoading, mediaError, isThumbnail, isPlaying, postYoutubeCommand]);

  useEffect(() => {
    if (!hasBackground || !isYoutube || !isYoutubeReady || isLoading || mediaError) return;
    if (isMuted || isThumbnail) postYoutubeCommand("mute");
    else postYoutubeCommand("unMute");
  }, [hasBackground, isYoutube, isYoutubeReady, isLoading, mediaError, isMuted, isThumbnail, postYoutubeCommand]);

  useEffect(() => {
    if (!hasBackground || !isYoutube || !isYoutubeReady || isLoading || mediaError) return;
    if (seekCommand === null) return;
    // Prefer absolute seekTarget; fall back to restart sentinel
    if (seekTarget !== null && Number.isFinite(seekTarget)) {
      postYoutubeCommand("seekTo", [Math.max(0, seekTarget), true]);
    } else if (seekAmount <= -3600) {
      postYoutubeCommand("seekTo", [0, true]);
      postYoutubeCommand("pauseVideo");
    }
  }, [hasBackground, isYoutube, isYoutubeReady, isLoading, mediaError, seekCommand, seekTarget, seekAmount, postYoutubeCommand]);

  const hasStructuredElements = Array.isArray(slide?.elements) && slide.elements.length > 0;
  // Guardrail: data-URI backgrounds (SVG split-panel, gradient SVG) always load — never
  // trigger the retained-background fallback for structured-element slides.
  const structuredElements = useMemo(
    () => (hasStructuredElements && slide ? getRenderableElements(slide, item) : []),
    [hasStructuredElements, slide, item]
  );

  if (!slide || !item) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500">
        <span className="uppercase tracking-widest text-sm font-mono">BLACK SCREEN</span>
      </div>
    );
  }

  const contentText = safeString(slide.content);
  const hasReadableText = contentText.trim().length > 0;
  const textPx = computeTextPx(item.theme?.fontSize, contentText);
  const hasRenderableStructuredText = structuredElements.some(
    (element) => element.type === "text" && element.visible !== false && safeString(element.content).trim().length > 0
  );
  const hasTextOverlay = hasStructuredElements ? hasRenderableStructuredText : hasReadableText;
  const usesScriptureReadingPanel = shouldUseScriptureReadingPanel({
    itemType: item.type,
    layoutType: slide.layoutType,
    hasStructuredElements,
    hasReadableText,
    hasBackground,
    mediaType,
  });
  const usesMediaTextProtection = !hasStructuredElements && hasReadableText && hasBackground && mediaType !== "color";
  const textStrokeWidth = usesScriptureReadingPanel ? 1.8 : usesMediaTextProtection && item.theme?.shadow ? 0.9 : 0;

  const textLayerStyle: React.CSSProperties = {
    fontFamily: item.theme?.fontFamily || "system-ui, sans-serif",
    color: item.theme?.textColor || "#fff",
    textShadow: usesScriptureReadingPanel
      ? "0 8px 32px rgba(0,0,0,0.94), 0 3px 10px rgba(0,0,0,0.88), 0 0 18px rgba(255,255,255,0.08)"
      : item.theme?.shadow
        ? "0 4px 16px rgba(0,0,0,0.82), 0 0 18px rgba(255,255,255,0.10)"
        : usesMediaTextProtection
          ? "0 4px 12px rgba(0,0,0,0.9)"
          : "none",
    WebkitTextStroke: textStrokeWidth ? `${textStrokeWidth}px rgba(0,0,0,0.62)` : undefined,
    paintOrder: textStrokeWidth ? "stroke fill" : undefined,
  };

  const renderRetainedBackground = (message?: string, loading = false) => {
    const retained = lastStableBackgroundRef.current;
    const retainedMediaStyle = !isThumbnail && retained?.mediaType !== "color"
      ? { filter: PROGRAM_MEDIA_PRESENTATION_FILTER }
      : undefined;
    const overlay = !isThumbnail && message ? (
      <div className="absolute top-3 right-3 text-[9px] uppercase tracking-wider bg-black/60 text-amber-100 border border-amber-300/30 px-2 py-1 rounded">
        {message}
      </div>
    ) : null;

    if (!retained) {
      return (
        <div className="w-full h-full relative bg-black">
          {loading && !isThumbnail && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          )}
          {overlay}
        </div>
      );
    }

    let content: React.ReactNode;
    if (retained.mediaType === "color") {
      content = <div className="w-full h-full" style={{ backgroundColor: retained.url }} />;
    } else if (retained.mediaType === "video" && retained.youtubeId) {
      const origin = getBestOrigin();
      const params = new URLSearchParams({
        autoplay: "1",
        controls: "0",
        modestbranding: "1",
        rel: "0",
        playsinline: "1",
        iv_load_policy: "3",
        loop: "1",
        playlist: retained.youtubeId,
        enablejsapi: "1",
        mute: "1",
      });
      if (origin) params.set("origin", origin);
      content = (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${retained.youtubeId}?${params.toString()}`}
          title="Retained YouTube background"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
        />
      );
    } else if (retained.mediaType === "video" || retained.mediaType === "video-alpha") {
      content = (
        <video
          src={retained.url}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
        />
      );
    } else if (retained.imageFit === "contain") {
      content = (
        <div className="w-full h-full relative overflow-hidden bg-black">
          <div
            className="absolute inset-0 bg-center bg-cover scale-110 blur-2xl opacity-90"
            style={{ backgroundImage: `url(${retained.url})` }}
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <img
              src={retained.url}
              alt=""
              className="w-full h-full object-contain"
              style={STABLE_MEDIA_LAYER_STYLE}
              draggable={false}
            />
          </div>
        </div>
      );
    } else {
      content = (
        <img
          src={retained.url}
          alt=""
          className="w-full h-full object-cover"
          style={STABLE_MEDIA_LAYER_STYLE}
          draggable={false}
        />
      );
    }

    return (
      <div className="w-full h-full relative">
        {retainedMediaStyle ? (
          <div className="w-full h-full" style={retainedMediaStyle}>
            {content}
          </div>
        ) : content}
        {loading && !isThumbnail && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
        {overlay}
      </div>
    );
  };

  const renderMedia = () => {
    if (!hasBackground) {
      return <div className="w-full h-full bg-black" />;
    }

    // Data URIs (SVG split-panel, gradient SVG) are always immediately available in memory.
    // Bypass resolvedUrl state, loading states, and error fallback completely — use rawBgUrl directly.
    // If the data URI itself fails (malformed SVG), fall through to the mediaError retained-background path.
    if (isDataUriBg && !mediaError) {
      return (
        <img
          src={rawBgUrl}
          alt=""
          className="w-full h-full object-cover"
          style={STABLE_MEDIA_LAYER_STYLE}
          draggable={false}
          onLoad={markCurrentMediaReady}
          onError={handleMediaError}
        />
      );
    }

    if (mediaError) {
      if (isThumbnail) {
        return renderRetainedBackground(
          legacyLocalMediaMissing ? "Background missing" : "Background unavailable",
        );
      }
      return (
        <div
          className="absolute top-3 right-3 text-[9px] uppercase tracking-wider bg-black/60 text-amber-100 border border-amber-300/30 px-2 py-1 rounded"
          style={{ zIndex: 20 }}
        >
          {legacyLocalMediaMissing
            ? "Background missing — keeping last live visual"
            : "Background unavailable — keeping last live visual"}
        </div>
      );
    }

    if (isLoading && !isThumbnail) {
      return null;
    }

    if (mediaType === "color" && resolvedUrl) {
      return <div className="w-full h-full" style={{ backgroundColor: resolvedUrl }} />;
    }

    if (mediaType === "video" && isYoutube && youtubeId) {
      const origin = getBestOrigin();
      const params = new URLSearchParams({
        autoplay: isThumbnail ? "0" : "1",
        controls: "0",
        modestbranding: "1",
        rel: "0",
        playsinline: "1",
        iv_load_policy: "3",
        loop: "1",
        playlist: youtubeId,
        enablejsapi: "1",
        mute: isThumbnail || isMuted ? "1" : "0",
      });
      if (origin) params.set("origin", origin);
      const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;

      return (
        <div className="w-full h-full" style={!isThumbnail ? { filter: PROGRAM_MEDIA_PRESENTATION_FILTER } : undefined}>
          <iframe
            ref={youtubeIframeRef}
            className="w-full h-full"
            src={src}
            title="YouTube"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              markCurrentMediaReady();
              setIsYoutubeReady(true);
              window.setTimeout(() => {
                if (isMuted || isThumbnail) postYoutubeCommand("mute");
                else postYoutubeCommand("unMute");
                // Seek to correct position so late-loading iframes stay in sync with the live output
                const syncPos = (() => {
                  if (seekTarget !== null && Number.isFinite(seekTarget)) return Math.max(0, seekTarget);
                  if (videoSyncEpoch) {
                    const elapsed = (Date.now() - videoSyncEpoch.epochMs) / 1000;
                    return Math.max(0, videoSyncEpoch.offsetSec + elapsed);
                  }
                  return null;
                })();
                if (syncPos !== null && syncPos > 1) {
                  postYoutubeCommand("seekTo", [syncPos, true]);
                }
                if (isPlaying && !isThumbnail) postYoutubeCommand("playVideo");
                else postYoutubeCommand("pauseVideo");
              }, 180);
            }}
            onError={handleMediaError}
          />
          {isProjector && showProjectorHelper && !isThumbnail && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-black/55 text-white/90 text-xs px-3 py-2 rounded-md">
                If YouTube refuses to play in projector mode, open it in YouTube or use a downloaded MP4.
              </div>
            </div>
          )}
        </div>
      );
    }

    if (mediaType === "video" && resolvedUrl) {
      return (
        <VideoBackground
          src={resolvedUrl}
          active={!isLoading && !mediaError}
          muted={isThumbnail || isMuted}
          filter={!isThumbnail ? PROGRAM_MEDIA_PRESENTATION_FILTER : undefined}
          isThumbnail={isThumbnail}
          isPlaying={!isThumbnail && isPlaying}
          poster={!isThumbnail ? itemBackgroundThumbnailUrl : undefined}
          onError={handleMediaError}
          onReady={markCurrentMediaReady}
        />
      );
    }

    if (resolvedUrl) {
      if (imageFit === "contain") {
        return (
          <div
            className="w-full h-full relative overflow-hidden bg-black"
            style={!isThumbnail ? { filter: PROGRAM_MEDIA_PRESENTATION_FILTER } : undefined}
          >
            <div
              data-testid="slide-renderer-image-backdrop"
              className="absolute inset-0 bg-center bg-cover scale-110 blur-2xl opacity-90"
              style={{ backgroundImage: `url(${resolvedUrl})` }}
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <img
                data-testid="slide-renderer-image"
                data-media-fit="contain"
                ref={imgCallbackRef}
                src={resolvedUrl}
                alt=""
                className="w-full h-full object-contain"
                style={STABLE_MEDIA_LAYER_STYLE}
                draggable={false}
                onLoad={markCurrentMediaReady}
                onError={handleMediaError}
              />
            </div>
          </div>
        );
      }
      return (
        <img
          data-testid="slide-renderer-image"
          data-media-fit="cover"
          ref={imgCallbackRef}
          src={resolvedUrl}
          alt=""
          className="w-full h-full object-cover"
          style={!isThumbnail
            ? { ...STABLE_MEDIA_LAYER_STYLE, filter: PROGRAM_MEDIA_PRESENTATION_FILTER }
            : STABLE_MEDIA_LAYER_STYLE}
          draggable={false}
          onLoad={markCurrentMediaReady}
          onError={handleMediaError}
        />
      );
    }

    return renderRetainedBackground("Background unavailable - keeping last live visual");
  };

  // ── Scale-canvas rendering ─────────────────────────────────────────────────
  // We always render the slide at CANVAS_W × CANVAS_H (1920 × 1080) using
  // fixed-pixel sizes, then CSS-scale it uniformly to fill the container.
  // This guarantees the preview small box and the fullscreen projector window
  // look pixel-identical — only the overall scale changes, never the layout.

  if (isThumbnail) {
    return (
      <ScaledCanvas
        fitContainer={true}
        slide={slide}
        item={item}
        contentText={contentText}
        hasReadableText={hasReadableText}
        hasStructuredElements={hasStructuredElements}
        structuredElements={structuredElements}
        hasTextOverlay={hasTextOverlay}
        textPx={textPx}
        textLayerStyle={textLayerStyle}
        useReadingPanel={usesScriptureReadingPanel}
        lowerThirds={false}
        showSlideLabel={false}
        renderMedia={renderMedia}
        mediaType={mediaType}
        hasBackground={hasBackground}
        mediaError={mediaError}
        isLoading={isLoading}
        isThumbnail={true}
      />
    );
  }

  const shouldRenderFloor = !!retainedFloor && (mediaError || isLoading || !isCurrentMediaReady);

  return (
    <ScaledCanvas
      fitContainer={fitContainer}
      slide={slide}
      item={item}
      contentText={contentText}
      hasReadableText={hasReadableText}
      hasStructuredElements={hasStructuredElements}
      structuredElements={structuredElements}
      hasTextOverlay={hasTextOverlay}
      textPx={textPx}
      textLayerStyle={textLayerStyle}
      useReadingPanel={usesScriptureReadingPanel}
      lowerThirds={lowerThirds}
      showSlideLabel={showSlideLabel}
      renderMedia={renderMedia}
      renderFloor={shouldRenderFloor ? () => retainedFloor ? <RetainedFloor asset={retainedFloor} /> : null : undefined}
      mediaType={mediaType}
      hasBackground={hasBackground}
      mediaError={mediaError}
      isLoading={isLoading}
      audienceOverlay={audienceOverlay}
      projectedAudienceQr={projectedAudienceQr}
      branding={branding}
      alphaOverlayUrl={slide.alphaOverlayUrl}
    />
  );
};

// ── ScaledCanvas ─────────────────────────────────────────────────────────────
// Renders at 1920×1080 then scales to fill any container.
interface ScaledCanvasProps {
  fitContainer: boolean;
  slide: Slide;
  item: ServiceItem;
  contentText: string;
  hasReadableText: boolean;
  hasStructuredElements: boolean;
  structuredElements: ReturnType<typeof getRenderableElements>;
  hasTextOverlay: boolean;
  textPx: number;
  textLayerStyle: React.CSSProperties;
  useReadingPanel: boolean;
  lowerThirds: boolean;
  showSlideLabel: boolean;
  renderMedia: () => React.ReactNode;
  renderFloor?: () => React.ReactNode;
  mediaType: string;
  hasBackground: boolean;
  mediaError: boolean;
  isLoading: boolean;
  audienceOverlay?: AudienceDisplayState;
  projectedAudienceQr?: AudienceQrProjectionState;
  branding?: SlideBrandingConfig;
  alphaOverlayUrl?: string;
  isThumbnail?: boolean;
}

const ScaledCanvas: React.FC<ScaledCanvasProps> = ({
  fitContainer, slide, item, contentText, hasReadableText, hasStructuredElements, structuredElements, hasTextOverlay, textPx, textLayerStyle, useReadingPanel,
  lowerThirds, showSlideLabel, renderMedia, renderFloor, mediaType, hasBackground, mediaError, isLoading,
  audienceOverlay, projectedAudienceQr, branding, alphaOverlayUrl, isThumbnail = false,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [canvasFrame, setCanvasFrame] = useState<CanvasFrame>(EMPTY_CANVAS_FRAME);

  // Legacy text path: render HTML if the content contains markup (from rich-text editor)
  const contentIsHtml = /<[a-zA-Z][^>]*>/.test(contentText);
  const renderText = contentIsHtml
    ? <span dangerouslySetInnerHTML={{ __html: contentText }} />
    : contentText;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateFrame = (width: number, height: number) => {
      const nextFrame = computeCanvasFrame(width, height);
      setCanvasFrame((prev) => (canvasFramesEqual(prev, nextFrame) ? prev : nextFrame));
    };

    // Initial measurement — read once synchronously before observer fires
    const initRect = el.getBoundingClientRect();
    updateFrame(initRect.width, initRect.height);

    let rafId: number | null = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // Use contentRect provided by the observer — avoids forced synchronous
      // layout (getBoundingClientRect inside an observer callback) which can
      // create a repaint→observe→repaint loop that makes the canvas shake.
      const { width, height } = entry.contentRect;
      // Debounce via rAF so rapid consecutive observations don't cause
      // oscillating scale state (the primary source of PPTX + split-panel shake).
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateFrame(width, height);
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const labelPx = Math.round(CANVAS_H * 0.026);   // ~28px at 1080p
  const labelPadH = Math.round(CANVAS_H * 0.014);
  const labelPadV = Math.round(CANVAS_H * 0.009);
  const shouldRenderReferenceLabel = !!slide.label
    && !lowerThirds
    && slide.layoutType !== 'ticker'
    && shouldShowScriptureReferenceLabel({
      itemType: item?.type,
      layoutType: slide.layoutType,
      showSlideLabel,
    });
  const projectedQrScale = projectedAudienceQr?.scale && Number.isFinite(projectedAudienceQr.scale)
    ? Math.max(0.7, Math.min(2.2, projectedAudienceQr.scale))
    : 1;
  const projectedQrPanelWidth = Math.max(360, Math.min(840, Math.round(520 * projectedQrScale)));
  const projectedQrImageSize = Math.max(240, Math.min(560, Math.round(projectedQrPanelWidth * 0.68)));
  const projectedQrTitlePx = Math.max(20, Math.min(42, Math.round(28 * projectedQrScale)));
  const projectedQrBodyPx = Math.max(12, Math.min(26, Math.round(18 * projectedQrScale)));
  const projectedQrPadding = Math.max(12, Math.min(24, Math.round(18 * projectedQrScale)));
  const tickerQueue = audienceOverlay?.tickerEnabled && Array.isArray(audienceOverlay.queue) ? audienceOverlay.queue : [];
  const tickerLoopItems = tickerQueue.length ? [...tickerQueue, ...tickerQueue] : [];
  const tickerCharacterCount = tickerQueue.reduce((sum, entry) => (
    sum
    + String(entry.submitter_name || 'AUDIENCE').length
    + String(entry.text || '').length
  ), 0);
  const tickerDuration = Math.max(22, Math.min(90, tickerCharacterCount * 0.2));
  const tickerBandHeight = Math.round(CANVAS_H * 0.072);
  const tickerLabelWidth = Math.round(CANVAS_W * 0.14);
  const tickerItemGap = Math.round(CANVAS_W * 0.028);
  const tickerTextPx = Math.round(CANVAS_H * 0.024);
  const tickerNamePx = Math.round(CANVAS_H * 0.019);

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden w-full bg-black select-none ${fitContainer ? "h-full" : "aspect-video"
        }`}
    >
      {/* Fixed-size 1920×1080 canvas, CSS-scaled to fit the wrapper */}
      <div
        style={{
          position: "absolute",
          width: CANVAS_W,
          height: CANVAS_H,
          top: canvasFrame.offsetY,
          left: canvasFrame.offsetX,
          transform: `scale(${canvasFrame.scale})`,
          transformOrigin: "top left",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Floor layer — always-on last-stable background; prevents black flash during load/error */}
        {renderFloor && (
          <div style={{ position: "absolute", inset: 0 }}>{renderFloor()}</div>
        )}

        {/* Media layer — live background rendered on top of floor */}
        <div style={{ position: "absolute", inset: 0 }}>{renderMedia()}</div>

        {/* Alpha-channel video overlay — z-20 (above background, below text) */}
        {alphaOverlayUrl && (
          <AlphaOverlay src={alphaOverlayUrl} isThumbnail={isThumbnail} />
        )}

        {/* Soft overlay — z-30 */}
        {hasTextOverlay && hasBackground && mediaType !== "color" && !mediaError && !isLoading && (
          <div style={{ position: "absolute", inset: 0, background: TEXT_CONTRAST_BACKGROUND_OVERLAY }} />
        )}

        {/* Branding strips — left series label + right church name */}
        {branding && <SlideBrandingOverlay config={branding} />}

        {/* Text layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            ...textLayerStyle,
          }}
        >
          {hasStructuredElements ? (
            <ElementRenderer elements={structuredElements} layoutMode="absolute" />
          ) : slide.layoutType === 'ticker' ? (
            /* ── Ticker layout: centered text + scrolling ticker band at bottom ── */
            <>
              <style>{`@keyframes lumina-ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
              {/* Centered verse text */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: `${CANVAS_H * 0.06}px ${CANVAS_W * 0.06}px ${CANVAS_H * 0.22}px` }}>
                <div style={{ width: "100%", maxWidth: "92%", fontSize: textPx, lineHeight: 1.35, whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "center", overflow: "hidden" }}>
                  {renderText}
                </div>
              </div>
              {/* Ticker band at bottom */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: CANVAS_H * 0.14, background: "linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.88) 30%)", display: "flex", alignItems: "center", overflow: "hidden" }}>
                {slide.label && (
                  <div style={{ position: "relative", zIndex: 2, padding: `0 ${CANVAS_W * 0.025}px`, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                    <div style={{ width: 4, height: CANVAS_H * 0.07, background: "#3b82f6", borderRadius: 4 }} />
                    <span style={{ fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', fontSize: Math.round(CANVAS_H * 0.024), fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#93c5fd", textShadow: "0 1px 4px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>{slide.label}</span>
                  </div>
                )}
                <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                  <div style={{ display: "inline-block", whiteSpace: "nowrap", animation: `lumina-ticker ${Math.max(12, contentText.length * 0.18)}s linear infinite`, fontSize: Math.round(CANVAS_H * 0.032), fontFamily: '"Georgia", "Times New Roman", serif', fontStyle: "italic", fontWeight: 400, color: "rgba(255,255,255,0.92)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                    {renderText}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: lowerThirds ? "flex-end" : "center",
                padding: lowerThirds
                  ? `0 ${CANVAS_W * 0.04}px ${CANVAS_H * 0.07}px`
                  : slide.layoutType === 'scripture_ref'
                    ? `${CANVAS_H * 0.06}px ${CANVAS_W * 0.06}px ${CANVAS_H * 0.22}px`
                    : `${CANVAS_H * 0.08}px ${CANVAS_W * 0.04}px`,
                textAlign: "center",
              }}
            >
              {lowerThirds ? (
                <div style={{ width: "100%", maxWidth: "92%", textAlign: "center" }}>
                  <div
                    style={{
                      display: "inline-block",
                      maxWidth: "100%",
                      padding: `${labelPadH * 2}px ${labelPadV * 4}px`,
                      borderRadius: 20,
                      background: "rgba(0,0,0,0.60)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: Math.round(textPx * 0.58),
                        lineHeight: 1.3,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {renderText}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {useReadingPanel ? (
                    <div
                      style={{
                        width: "100%",
                        maxWidth: slide.layoutType === "scripture_ref" ? "88%" : "84%",
                        padding: `${CANVAS_H * 0.035}px ${CANVAS_W * 0.03}px`,
                        borderRadius: 30,
                        background: "linear-gradient(180deg, rgba(8,12,20,0.56) 0%, rgba(8,12,20,0.40) 100%)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        backdropFilter: "blur(14px)",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.40)",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          fontSize: textPx,
                          lineHeight: 1.33,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          textAlign: "center",
                          overflow: "hidden",
                        }}
                      >
                        {renderText}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "92%",
                        fontSize: textPx,
                        lineHeight: 1.35,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        textAlign: "center",
                        overflow: "hidden",
                      }}
                    >
                      {renderText}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scripture / slide reference label */}
          {shouldRenderReferenceLabel && (
            slide.layoutType === 'scripture_ref' ? (
              /* ── Scripture + Reference: prominent centered bottom label ── */
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: CANVAS_H * 0.18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)" }}>
                <div style={{ width: CANVAS_W * 0.4, height: 1, background: "rgba(255,255,255,0.15)", marginBottom: CANVAS_H * 0.025 }} />
                <span style={{ fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', fontSize: Math.round(CANVAS_H * 0.038), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.98)", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                  {slide.label}
                </span>
              </div>
            ) : (
              /* ── Standard: small pill at bottom-right ──────────────────── */
              <div
                style={{
                  position: "absolute",
                  bottom: CANVAS_H * 0.048,
                  right: CANVAS_W * 0.04,
                  maxWidth: "80%",
                  opacity: 0.92,
                }}
              >
                <span
                  style={{
                    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                    fontSize: labelPx,
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    display: "inline-block",
                    padding: `${labelPadH}px ${labelPadH * 2}px`,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    color: "rgba(255,255,255,0.95)",
                  }}
                >
                  {slide.label}
                </span>
              </div>
            )
          )}
        </div>

        {/* ── Audience Overlays ────────────────────────────────────────────── */}
        {audienceOverlay && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100 }}>
            {/* Pinned / Active Message Overlay */}
            {(audienceOverlay.pinnedMessageId || audienceOverlay.activeMessageId) && !audienceOverlay.tickerEnabled && (
              <div
                key={audienceOverlay.pinnedMessageId || audienceOverlay.activeMessageId}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{
                  position: "absolute",
                  bottom: CANVAS_H * 0.05,
                  left: CANVAS_W * 0.05,
                  maxWidth: CANVAS_W * 0.45,
                  background: "rgba(0,0,0,0.75)",
                  border: "2px solid rgba(59,130,246,0.4)",
                  borderRadius: 16,
                  padding: "16px 24px",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
                }}
              >
                {(() => {
                  const msgId = audienceOverlay.pinnedMessageId || audienceOverlay.activeMessageId;
                  const msg = audienceOverlay.queue.find(m => m.id === msgId);
                  if (!msg) return null;
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {msg.submitter_name || "AUDIENCE"}
                        </span>
                      </div>
                      <div style={{ fontSize: 28, color: "white", fontWeight: 500, lineHeight: 1.3 }}>
                        {msg.text}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Scrolling Ticker */}
            {tickerQueue.length > 0 && (
              <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: tickerBandHeight,
                background: "linear-gradient(180deg, rgba(4,10,18,0.78), rgba(2,6,14,0.94))",
                borderTop: "1px solid rgba(148,163,184,0.15)",
                backdropFilter: "blur(18px)",
                display: "grid",
                gridTemplateColumns: `${tickerLabelWidth}px minmax(0, 1fr)`,
                alignItems: "stretch",
                overflow: "hidden",
                boxShadow: "0 -10px 30px rgba(0,0,0,0.25)"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: "linear-gradient(90deg, rgba(30,64,175,0.22), rgba(3,7,18,0.1))",
                  borderRight: "1px solid rgba(96,165,250,0.2)",
                  position: "relative",
                  zIndex: 2,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 16px rgba(56,189,248,0.45)" }} />
                  <span style={{ color: "#dbeafe", fontWeight: 900, fontSize: tickerNamePx, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                    Audience Feed
                  </span>
                </div>
                <div style={{ position: "relative", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(90deg, rgba(2,6,23,0.98) 0%, rgba(2,6,23,0.0) 8%, rgba(2,6,23,0.0) 92%, rgba(2,6,23,0.98) 100%)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }} />
                <div
                  key={`ticker-${tickerQueue.map((entry) => entry.id).join('-')}-${tickerQueue.length}`}
                  className="flex whitespace-nowrap items-center"
                  style={{
                    width: "max-content",
                    minWidth: "200%",
                    height: "100%",
                    gap: tickerItemGap,
                    padding: `0 ${tickerItemGap}px`,
                    willChange: "transform",
                    transform: "translate3d(0,0,0)",
                    animation: `luminaTickerLoop ${tickerDuration}s linear infinite`,
                    WebkitFontSmoothing: "antialiased",
                    textRendering: "geometricPrecision",
                  }}
                >
                  {tickerLoopItems.map((m, i) => (
                    <div key={`${m.id || 'msg'}-${i}`} style={{ display: "flex", alignItems: "center", gap: 14, flex: "0 0 auto" }}>
                      <span style={{ color: "#3b82f6", fontWeight: 900, fontSize: tickerNamePx }}>&bull;</span>
                      <span style={{ color: "white", fontSize: tickerTextPx, fontWeight: 650, letterSpacing: "0.01em" }}>
                        <span style={{ color: "#93c5fd", marginRight: 8, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.submitter_name || "Audience"}</span>
                        {m.text}
                      </span>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audience QR Projection */}
        {projectedAudienceQr?.visible && projectedAudienceQr.audienceUrl && (
          <div
            style={{
              position: "absolute",
              top: CANVAS_H * 0.04,
              right: CANVAS_W * 0.03,
              width: projectedQrPanelWidth,
              pointerEvents: "none",
              zIndex: 120,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                background: "rgba(0,0,0,0.78)",
                border: "2px solid rgba(59,130,246,0.55)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                padding: `${projectedQrPadding}px ${projectedQrPadding}px ${Math.max(10, projectedQrPadding - 2)}px`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: Math.max(8, Math.round(10 * projectedQrScale)),
                backdropFilter: "blur(10px)",
              }}
            >
              <div style={{ fontSize: projectedQrTitlePx, fontWeight: 900, letterSpacing: "0.08em", color: "#93c5fd", textTransform: "uppercase" }}>
                Scan To Participate
              </div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: Math.max(8, Math.round(12 * projectedQrScale)),
                  width: projectedQrImageSize,
                  height: projectedQrImageSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=460x460&data=${encodeURIComponent(projectedAudienceQr.audienceUrl)}`}
                  alt="Audience QR Code"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  draggable={false}
                />
              </div>
              <div style={{ fontSize: projectedQrBodyPx, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                Open camera and scan this code to submit.
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes luminaTickerLoop {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
};

// ── RetainedFloor ─────────────────────────────────────────────────────────────
// Renders the last stable background asset as a static floor layer.
// Lives below the live media layer in DOM order so it never occludes text.
// No loading states, no error handling — it only renders what was last confirmed good.
function RetainedFloor({ asset }: { asset: RetainedBackgroundAsset }) {
  if (asset.mediaType === "color") {
    return <div className="w-full h-full" style={{ backgroundColor: asset.url }} />;
  }
  if (asset.mediaType === "video" && !asset.youtubeId) {
    return (
      <VideoBackground
        src={asset.url}
        active={true}
        muted={true}
        isThumbnail={true}
      />
    );
  }
  if (asset.mediaType === "image") {
    return (
      <img
        src={asset.url}
        alt=""
        className="w-full h-full"
        style={{ objectFit: asset.imageFit ?? "cover" }}
        draggable={false}
      />
    );
  }
  return null;
}
