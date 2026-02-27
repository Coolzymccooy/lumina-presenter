import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Slide, ServiceItem, MediaType, AudienceDisplayState } from "../types";

import { getMedia, getCachedMedia } from "../services/localMedia";
import { DEFAULT_BACKGROUNDS } from "../constants";

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

  /** Mute audio (recommended true for preview). */
  isMuted?: boolean;

  /** When rendering inside the projector popout window. Enables a safer YouTube strategy. */
  isProjector?: boolean;
  lowerThirds?: boolean;
  showSlideLabel?: boolean;
  showProjectorHelper?: boolean;
  audienceOverlay?: AudienceDisplayState;
}

function safeString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
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
    normalized.includes("/video/") ||
    normalized.startsWith("blob:")
  );
}

// Internal canvas dimensions — slides are always laid out at this resolution
// then CSS-scaled to fill any container. Guarantees preview === output appearance.
const CANVAS_W = 1920;
const CANVAS_H = 1080;

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
  isMuted = false,
  isProjector = false,
  lowerThirds = false,
  showSlideLabel = true,
  showProjectorHelper = true,
  audienceOverlay,
}) => {
  const htmlVideoRef = useRef<HTMLVideoElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const [legacyLocalMediaMissing, setLegacyLocalMediaMissing] = useState(false);
  const [isYoutubeReady, setIsYoutubeReady] = useState(false);

  const rawBgUrl = useMemo(() => {
    return safeString(slide?.backgroundUrl) || safeString(item?.theme?.backgroundUrl) || "";
  }, [slide?.backgroundUrl, item?.theme?.backgroundUrl]);

  const hasBackground = !!rawBgUrl;

  // Prevent loading spinner flashes for cached local:// media
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!hasBackground) return "";
    if (rawBgUrl.startsWith("local://")) return getCachedMedia(rawBgUrl) || "";
    return rawBgUrl;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!hasBackground) return false;
    return rawBgUrl.startsWith("local://") && !getCachedMedia(rawBgUrl);
  });

  // Resolve local:// URLs async (only if a background exists)
  useEffect(() => {
    let active = true;

    async function run() {
      if (!hasBackground) {
        if (!active) return;
        setResolvedUrl("");
        setIsLoading(false);
        setMediaError(false);
        setLegacyLocalMediaMissing(false);
        return;
      }

      if (!rawBgUrl.startsWith("local://")) {
        if (!active) return;
        setResolvedUrl(rawBgUrl);
        setIsLoading(false);
        setMediaError(false);
        setLegacyLocalMediaMissing(false);
        return;
      }

      // local://
      const cached = getCachedMedia(rawBgUrl);
      if (cached) {
        if (!active) return;
        setResolvedUrl(cached);
        setIsLoading(false);
        setMediaError(false);
        setLegacyLocalMediaMissing(false);
        return;
      }

      setIsLoading(true);
      try {
        const url = await getMedia(rawBgUrl);
        if (!active) return;

        if (url) {
          setResolvedUrl(url);
          setMediaError(false);
          setLegacyLocalMediaMissing(false);
        } else {
          setResolvedUrl("");
          setMediaError(true);
          setLegacyLocalMediaMissing(true);
        }
      } catch {
        if (!active) return;
        setResolvedUrl("");
        setMediaError(true);
        setLegacyLocalMediaMissing(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [rawBgUrl, hasBackground]);

  // Decide media type
  const youtubeId = useMemo(() => getYoutubeId(resolvedUrl || ""), [resolvedUrl]);
  const isYoutube = !!youtubeId;

  const mediaType: MediaType = useMemo(() => {
    if (!hasBackground) return "image";
    if (isYoutube) return "video";
    if (looksLikeDirectVideo(resolvedUrl || rawBgUrl)) return "video";
    return (slide?.mediaType || item?.theme?.mediaType || "image") as MediaType;
  }, [hasBackground, isYoutube, slide?.mediaType, item?.theme?.mediaType, resolvedUrl, rawBgUrl]);

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

  useEffect(() => {
    setIsYoutubeReady(false);
  }, [youtubeId, resolvedUrl, slide?.id, item?.id]);

  // HTML5 video control (for non-YouTube)
  useEffect(() => {
    if (!hasBackground) return;
    if (!resolvedUrl) return;
    if (mediaType !== "video" || isYoutube) return;
    if (isLoading || mediaError) return;

    const v = htmlVideoRef.current;
    if (!v) return;

    // Keep mute in sync
    v.muted = isMuted || isThumbnail;

    if (!isPlaying || isThumbnail) {
      v.pause();
      return;
    }

    const p = v.play();
    p?.catch((err) => {
      if (err?.name === "NotAllowedError" && v && !v.muted) {
        v.muted = true;
        v.play().catch(() => { });
      }
    });
  }, [hasBackground, resolvedUrl, mediaType, isYoutube, isLoading, mediaError, isPlaying, isMuted, isThumbnail]);

  // Seek control (HTML5 only)
  useEffect(() => {
    if (!hasBackground) return;
    if (seekCommand === null) return;
    if (!seekAmount || !Number.isFinite(seekAmount)) return;
    if (mediaType !== "video" || isYoutube) return;
    if (isLoading || mediaError) return;

    const v = htmlVideoRef.current;
    if (!v) return;

    try {
      v.currentTime = Math.max(0, (v.currentTime || 0) + seekAmount);
    } catch {
      // ignore
    }
  }, [hasBackground, seekCommand, seekAmount, mediaType, isYoutube, isLoading, mediaError]);

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
    if (!seekAmount || !Number.isFinite(seekAmount)) return;
    if (seekAmount <= -3600) {
      postYoutubeCommand("seekTo", [0, true]);
      postYoutubeCommand("pauseVideo");
    }
  }, [hasBackground, isYoutube, isYoutubeReady, isLoading, mediaError, seekCommand, seekAmount, postYoutubeCommand]);

  const fallbackBackground = useMemo(() => {
    const seed = `${item?.id || "item"}:${slide?.id || "slide"}`;
    return DEFAULT_BACKGROUNDS[hashSeed(seed) % DEFAULT_BACKGROUNDS.length];
  }, [item?.id, slide?.id]);

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

  const textLayerStyle: React.CSSProperties = {
    fontFamily: item.theme?.fontFamily || "system-ui, sans-serif",
    color: item.theme?.textColor || "#fff",
    textShadow: item.theme?.shadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
  };

  const renderMedia = () => {
    // ✅ MVP rule: if there is no background configured, just render black (no “asset missing” behind text)
    if (!hasBackground) {
      return <div className="w-full h-full bg-black" />;
    }

    if (mediaError) {
      return (
        <div className="w-full h-full relative">
          <img src={fallbackBackground} alt="" className="w-full h-full object-cover" />
          {!isThumbnail && (
            <div className="absolute top-3 right-3 text-[9px] uppercase tracking-wider bg-black/50 text-amber-200 border border-amber-400/40 px-2 py-1 rounded">
              {legacyLocalMediaMissing
                ? "Legacy local VIS media missing — re-import PPTX VIS"
                : "Fallback Background"}
            </div>
          )}
        </div>
      );
    }

    if (isLoading && !isThumbnail) {
      return (
        <div className="w-full h-full relative">
          <img src={fallbackBackground} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        </div>
      );
    }

    // Solid color background
    if (mediaType === "color" && resolvedUrl) {
      return <div className="w-full h-full" style={{ backgroundColor: resolvedUrl }} />;
    }

    // YouTube embed (MVP: best-effort + projector-safe)
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
        // ✅ Force mute in projector to satisfy autoplay policies and reduce failures
        mute: isThumbnail || isMuted ? "1" : "0",
      });

      // Adding origin helps some browsers/contexts (especially popouts) avoid “player configuration error”.
      if (origin) params.set("origin", origin);

      const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;

      return (
        <div className="w-full h-full">
          <iframe
            ref={youtubeIframeRef}
            className="w-full h-full"
            src={src}
            title="YouTube"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              setIsYoutubeReady(true);
              window.setTimeout(() => {
                if (isMuted || isThumbnail) postYoutubeCommand("mute");
                else postYoutubeCommand("unMute");
                if (isPlaying && !isThumbnail) postYoutubeCommand("playVideo");
                else postYoutubeCommand("pauseVideo");
              }, 180);
            }}
            onError={handleMediaError}
          />
          {/* MVP helper (only in projector) */}
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

    // HTML5 video (local/blob/mp4)
    if (mediaType === "video" && resolvedUrl) {
      return (
        <video
          key={resolvedUrl}
          ref={htmlVideoRef}
          src={resolvedUrl}
          className="w-full h-full object-cover"
          loop
          muted={isThumbnail || isMuted}
          playsInline
          preload="auto"
          onError={handleMediaError}
        />
      );
    }

    // Image (never crop)
    if (resolvedUrl) {
      return (
        <img
          src={resolvedUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
          onError={handleMediaError}
        />
      );
    }

    return <img src={fallbackBackground} alt="" className="w-full h-full object-cover" />;
  };

  // ── Scale-canvas rendering ─────────────────────────────────────────────────
  // We always render the slide at CANVAS_W × CANVAS_H (1920 × 1080) using
  // fixed-pixel sizes, then CSS-scale it uniformly to fill the container.
  // This guarantees the preview small box and the fullscreen projector window
  // look pixel-identical — only the overall scale changes, never the layout.

  if (isThumbnail) {
    // Thumbnail: simple scaled-down wrapper without all the canvas machinery
    return (
      <div className="relative overflow-hidden w-full aspect-video bg-black select-none">
        <div className="absolute inset-0">{renderMedia()}</div>
        {hasReadableText && hasBackground && mediaType !== "color" && !mediaError && !isLoading && (
          <div className="absolute inset-0 bg-black/20" />
        )}
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center" style={textLayerStyle}>
          <div className="text-[0.65rem] whitespace-pre-wrap break-words leading-tight max-w-[92%]">{contentText}</div>
        </div>
      </div>
    );
  }

  return (
    <ScaledCanvas
      fitContainer={fitContainer}
      slide={slide}
      item={item}
      contentText={contentText}
      hasReadableText={hasReadableText}
      textPx={textPx}
      textLayerStyle={textLayerStyle}
      lowerThirds={lowerThirds}
      showSlideLabel={showSlideLabel}
      renderMedia={renderMedia}
      mediaType={mediaType}
      hasBackground={hasBackground}
      mediaError={mediaError}
      isLoading={isLoading}
      audienceOverlay={audienceOverlay}
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
  textPx: number;
  textLayerStyle: React.CSSProperties;
  lowerThirds: boolean;
  showSlideLabel: boolean;
  renderMedia: () => React.ReactNode;
  mediaType: string;
  hasBackground: boolean;
  mediaError: boolean;
  isLoading: boolean;
  audienceOverlay?: AudienceDisplayState;
}

const ScaledCanvas: React.FC<ScaledCanvasProps> = ({
  fitContainer, slide, item, contentText, hasReadableText, textPx, textLayerStyle,
  lowerThirds, showSlideLabel, renderMedia, mediaType, hasBackground, mediaError, isLoading,
  audienceOverlay,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      const sx = width / CANVAS_W;
      const sy = height / CANVAS_H;
      setScale(Math.min(sx, sy));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labelPx = Math.round(CANVAS_H * 0.026);   // ~28px at 1080p
  const labelPadH = Math.round(CANVAS_H * 0.014);
  const labelPadV = Math.round(CANVAS_H * 0.009);

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
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Media layer */}
        <div style={{ position: "absolute", inset: 0 }}>{renderMedia()}</div>

        {/* Soft overlay */}
        {hasReadableText && hasBackground && mediaType !== "color" && !mediaError && !isLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
        )}

        {/* Text layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: lowerThirds ? "flex-end" : "center",
            padding: lowerThirds ? `0 ${CANVAS_W * 0.04}px ${CANVAS_H * 0.07}px` : `${CANVAS_H * 0.08}px ${CANVAS_W * 0.04}px`,
            textAlign: "center",
            ...textLayerStyle,
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
                  {contentText}
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
                {contentText}
              </div>
            </div>
          )}

          {/* Scripture / slide reference label */}
          {showSlideLabel && slide.label && !lowerThirds && (
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
            {audienceOverlay.tickerEnabled && audienceOverlay.queue.length > 0 && (
              <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 64,
                background: "rgba(0,0,0,0.85)",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                display: "flex",
                alignItems: "center",
                overflow: "hidden"
              }}>
                <div className="flex animate-scroll whitespace-nowrap items-center gap-12" style={{
                  animation: `scroll ${Math.max(15, audienceOverlay.queue.length * 8)}s linear infinite`
                }}>
                  {/* Double the queue for seamless loop */}
                  {[...audienceOverlay.queue, ...audienceOverlay.queue].map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "#3b82f6", fontWeight: 900, fontSize: 14 }}>•</span>
                      <span style={{ color: "white", fontSize: 24, fontWeight: 600 }}>
                        <span style={{ color: "#93c5fd", marginRight: 8 }}>{m.submitter_name || "AUDIENCE"}:</span>
                        {m.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          display: flex;
          width: max-content;
        }
      `}</style>
    </div>
  );
};
