import React, { useEffect, useMemo, useRef, useState } from "react";
import { Slide, ServiceItem, MediaType } from "../types";
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

/**
 * Shrinks text for long slides to avoid clipping.
 * Uses vh so it scales naturally on projector resolutions.
 */
function computeTextVh(size: string | undefined, text: string) {
  const base =
    size === "small"
      ? 3.0
      : size === "medium"
      ? 4.0
      : size === "xlarge"
      ? 7.0
      : 5.0;

  const lines = Math.max(1, text.split(/\n/).length);
  const len = text.length;

  const shrinkByLen =
    len > 900 ? 0.55 : len > 700 ? 0.65 : len > 500 ? 0.75 : len > 350 ? 0.85 : 1.0;

  const shrinkByLines =
    lines >= 10 ? 0.62 : lines >= 8 ? 0.72 : lines >= 6 ? 0.82 : lines >= 4 ? 0.92 : 1.0;

  const vh = base * Math.min(shrinkByLen, shrinkByLines);
  return Math.max(2.0, Math.min(vh, 8.0));
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
}) => {
  const htmlVideoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);

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
        return;
      }

      if (!rawBgUrl.startsWith("local://")) {
        if (!active) return;
        setResolvedUrl(rawBgUrl);
        setIsLoading(false);
        setMediaError(false);
        return;
      }

      // local://
      const cached = getCachedMedia(rawBgUrl);
      if (cached) {
        if (!active) return;
        setResolvedUrl(cached);
        setIsLoading(false);
        setMediaError(false);
        return;
      }

      setIsLoading(true);
      try {
        const url = await getMedia(rawBgUrl);
        if (!active) return;

        if (url) {
          setResolvedUrl(url);
          setMediaError(false);
        } else {
          setResolvedUrl("");
          setMediaError(true);
        }
      } catch {
        if (!active) return;
        setResolvedUrl("");
        setMediaError(true);
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
  }, [slide?.id, item?.id, rawBgUrl]);

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
        v.play().catch(() => {});
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

  const containerPadding = isThumbnail ? "p-2" : "p-8 md:p-16";
  const contentText = safeString(slide.content);
  const textVh = computeTextVh(item.theme?.fontSize, contentText);

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
              Fallback Background
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
        // ✅ Force mute in projector to satisfy autoplay policies and reduce failures
        mute: isThumbnail || isMuted || isProjector ? "1" : "0",
      });

      // Adding origin helps some browsers/contexts (especially popouts) avoid “player configuration error”.
      if (origin) params.set("origin", origin);

      const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;

      return (
        <div className="w-full h-full">
          <iframe
            className="w-full h-full"
            src={src}
            title="YouTube"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => setMediaError(true)}
          />
          {/* MVP helper (only in projector) */}
          {isProjector && !isThumbnail && (
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
          onError={() => setMediaError(true)}
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
          onError={() => setMediaError(true)}
        />
      );
    }

    return <img src={fallbackBackground} alt="" className="w-full h-full object-cover" />;
  };

  return (
    <div className={`relative overflow-hidden w-full ${fitContainer ? "h-full" : "aspect-video"} bg-black select-none`}>
      {/* Media layer */}
      <div className="absolute inset-0 flex items-center justify-center">{renderMedia()}</div>

      {/* Soft overlay for readability (skip for solid color + skip when no background) */}
      {hasBackground && mediaType !== "color" && !mediaError && !isLoading && (
        <div className="absolute inset-0 bg-black/20" />
      )}

      {/* Text layer */}
      <div
        className={`absolute inset-0 ${lowerThirds ? "flex items-end justify-center px-8 pb-12" : `flex flex-col items-center justify-center ${containerPadding} text-center`}`}
        style={textLayerStyle}
      >
        {lowerThirds ? (
          <div className="w-full max-w-[92%] text-center">
            <div className="inline-block max-w-full px-6 py-3 rounded-2xl bg-black/60 border border-white/15 backdrop-blur-md shadow-xl">
              <div
                className={[
                  "whitespace-pre-wrap",
                  "break-words",
                  "leading-tight",
                  "text-center",
                  isThumbnail ? "text-[0.65rem]" : "",
                ].join(" ")}
                style={!isThumbnail ? { fontSize: `${Math.max(2.2, textVh * 0.58)}vh` } : undefined}
              >
                {contentText}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full flex items-center justify-center">
            <div
              className={[
                "w-full",
                "max-w-[92%]",
                "max-h-full",
                "overflow-hidden",
                "whitespace-pre-wrap",
                "break-words",
                "leading-tight",
                "text-center",
                isThumbnail ? "text-[0.65rem]" : "",
              ].join(" ")}
              style={!isThumbnail ? { fontSize: `${textVh}vh` } : undefined}
            >
              {contentText}
            </div>
          </div>
        )}

        {/* Footer / Reference Layer */}
        {!isThumbnail && slide.label && !lowerThirds && (
           <div className="absolute bottom-6 right-8 max-w-[80%] opacity-90 transition-all duration-300">
             <span 
              className="text-[2.2vh] font-medium tracking-wide inline-block px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-lg" 
              style={{ 
                fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', 
                backgroundColor: 'rgba(0,0,0,0.4)', 
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                color: 'rgba(255,255,255,0.95)'
              }}
            >
              {slide.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
