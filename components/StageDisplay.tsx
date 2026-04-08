import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ServiceItem, Slide, StageAlertLayout, StageAlertState, StageFlowLayout, StageMessageCenterState, StageTimerFlashColor, StageTimerLayout, StageTimerVariant } from '../types';
import { getCachedMedia, getMedia } from '../services/localMedia';
import { SlideRenderer } from './SlideRenderer';
import type { SlideBrandingConfig } from './SlideBrandingOverlay';
import { StageRunOrderPanel } from './stage/StageRunOrderPanel';
import { StageKeyboardOverlay } from './stage/StageKeyboardOverlay';
import { StageLyricsConfidence } from './stage/StageLyricsConfidence';
import { StageAutoAdvance } from './stage/StageAutoAdvance';
import { StageSttPanel } from './stage/StageSttPanel';
import { StageOperatorBadge } from './stage/StageOperatorBadge';

interface StageDisplayProps {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  activeItem: ServiceItem | null;
  timerLabel?: string;
  timerDisplay?: string;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
  isTimerOvertime?: boolean;
  timerRemainingSec?: number;
  timerDurationSec?: number;
  timerAmberPercent?: number;
  timerRedPercent?: number;
  timerFlashActive?: boolean;
  timerFlashColor?: StageTimerFlashColor;
  timerLayout?: StageTimerLayout;
  onTimerLayoutChange?: (layout: StageTimerLayout) => void;
  stageAlertLayout?: StageAlertLayout;
  onStageAlertLayoutChange?: (layout: StageAlertLayout) => void;
  profile?: 'classic' | 'compact' | 'high_contrast';
  flowLayout?: StageFlowLayout;
  audienceOverlay?: any;
  stageAlert?: StageAlertState;
  stageMessageCenter?: StageMessageCenterState;
  embedded?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  className?: string;
  branding?: SlideBrandingConfig;

  // ── Tier 2 — Near-term additions ─────────────────────────────────────────
  /** Full service schedule — enables click-to-go run order panel */
  schedule?: ServiceItem[];
  /** Currently active item id, used to highlight in run order */
  activeItemId?: string | null;
  /** Called when operator clicks an item in the run order */
  onItemSelect?: (itemId: string) => void;
  /** Called when operator triggers next slide (keyboard / auto-advance) */
  onNextSlide?: () => void;
  /** Called when operator triggers previous slide */
  onPrevSlide?: () => void;

  // ── Tier 3 — Power features ───────────────────────────────────────────────
  /** Number of connected stage/controller clients for multi-operator badge */
  operatorCount?: number;
  /** Whether auto-advance is enabled */
  autoAdvanceEnabled?: boolean;
  /** Auto-advance delay in seconds */
  autoAdvanceSec?: number;
  /** Toggle auto-advance on/off */
  onAutoAdvanceToggle?: () => void;
  /** Change auto-advance delay */
  onAutoAdvanceSecsChange?: (secs: number) => void;
  /** Whether the STT sermon recording panel is open */
  showSttPanel?: boolean;
  /** Whether speech recognition is actively recording */
  sttIsRecording?: boolean;
  /** Committed transcript text */
  sttTranscript?: string;
  /** Interim (in-flight) transcript */
  sttInterimText?: string;
  /** Toggle STT recording on/off */
  onSttToggleRecording?: () => void;
  /** Close the STT panel */
  onSttClose?: () => void;
}

const DEFAULT_LAYOUT: StageTimerLayout = {
  x: 24,
  y: 24,
  width: 360,
  height: 150,
  fontScale: 1,
  variant: 'top-right',
  locked: false,
};

const DEFAULT_ALERT_LAYOUT: StageAlertLayout = {
  x: 120,
  y: 84,
  width: 920,
  height: 116,
  fontScale: 1,
  locked: false,
};

const PRESET_VARIANTS: StageTimerVariant[] = ['top-right', 'top-left', 'bottom-right', 'compact-bar'];
const isVariant = (value: unknown): value is StageTimerVariant =>
  value === 'top-right' || value === 'top-left' || value === 'bottom-right' || value === 'compact-bar';
const isFlowLayout = (value: unknown): value is StageFlowLayout =>
  value === 'balanced' || value === 'speaker_focus' || value === 'preview_focus' || value === 'minimal_next';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type StageViewportOverride = {
  width: number;
  height: number;
};

const resolveViewport = (hostWindow?: Window | null, viewportOverride?: StageViewportOverride | null) => {
  if (viewportOverride && Number.isFinite(viewportOverride.width) && Number.isFinite(viewportOverride.height)) {
    return {
      vw: Math.max(320, Math.round(viewportOverride.width)),
      vh: Math.max(180, Math.round(viewportOverride.height)),
    };
  }
  const target = hostWindow || (typeof window === 'undefined' ? null : window);
  return {
    vw: target?.innerWidth || 1280,
    vh: target?.innerHeight || 720,
  };
};

const applyLayoutPreset = (
  variant: StageTimerVariant,
  baseLocked = false,
  hostWindow?: Window | null,
  viewportOverride?: StageViewportOverride | null,
): StageTimerLayout => {
  const { vw, vh } = resolveViewport(hostWindow, viewportOverride);
  const margin = 24;
  if (variant === 'top-left') {
    return { ...DEFAULT_LAYOUT, variant, x: margin, y: margin, width: 360, height: 150, locked: baseLocked };
  }
  if (variant === 'bottom-right') {
    return { ...DEFAULT_LAYOUT, variant, x: Math.max(margin, vw - 360 - margin), y: Math.max(margin, vh - 170 - margin), width: 360, height: 150, locked: baseLocked };
  }
  if (variant === 'compact-bar') {
    return { ...DEFAULT_LAYOUT, variant, x: Math.max(margin, vw - 540 - margin), y: Math.max(margin, vh - 104 - margin), width: 540, height: 84, fontScale: 0.9, locked: baseLocked };
  }
  return { ...DEFAULT_LAYOUT, variant, x: Math.max(margin, vw - 360 - margin), y: margin, width: 360, height: 150, locked: baseLocked };
};

const normalizeLayout = (
  value: StageTimerLayout | undefined | null,
  hostWindow?: Window | null,
  viewportOverride?: StageViewportOverride | null,
): StageTimerLayout => {
  const raw = value || DEFAULT_LAYOUT;
  const variant = isVariant(raw.variant) ? raw.variant : DEFAULT_LAYOUT.variant;
  const preset = applyLayoutPreset(variant, !!raw.locked, hostWindow, viewportOverride);
  const width = Number.isFinite(raw.width) ? clamp(raw.width, 220, 1600) : preset.width;
  const height = Number.isFinite(raw.height) ? clamp(raw.height, 72, 900) : preset.height;
  const fontScale = Number.isFinite(raw.fontScale) ? clamp(raw.fontScale, 0.6, 3.4) : preset.fontScale;
  const { vw, vh } = resolveViewport(hostWindow, viewportOverride);
  return {
    x: Number.isFinite(raw.x) ? clamp(raw.x, 0, Math.max(0, vw - width)) : preset.x,
    y: Number.isFinite(raw.y) ? clamp(raw.y, 0, Math.max(0, vh - height)) : preset.y,
    width,
    height,
    fontScale,
    variant,
    locked: !!raw.locked,
  };
};

const normalizeAlertLayout = (
  value: StageAlertLayout | undefined | null,
  hostWindow?: Window | null,
  viewportOverride?: StageViewportOverride | null,
): StageAlertLayout => {
  const raw = value || DEFAULT_ALERT_LAYOUT;
  const { vw, vh } = resolveViewport(hostWindow, viewportOverride);
  const width = Number.isFinite(raw.width) ? clamp(raw.width, 320, 1800) : DEFAULT_ALERT_LAYOUT.width;
  const height = Number.isFinite(raw.height) ? clamp(raw.height, 88, 640) : DEFAULT_ALERT_LAYOUT.height;
  return {
    x: Number.isFinite(raw.x) ? clamp(raw.x, 0, Math.max(0, vw - width)) : clamp(DEFAULT_ALERT_LAYOUT.x, 0, Math.max(0, vw - width)),
    y: Number.isFinite(raw.y) ? clamp(raw.y, 0, Math.max(0, vh - height)) : clamp(DEFAULT_ALERT_LAYOUT.y, 0, Math.max(0, vh - height)),
    width,
    height,
    fontScale: Number.isFinite(raw.fontScale) ? clamp(raw.fontScale, 0.7, 2.2) : DEFAULT_ALERT_LAYOUT.fontScale,
    locked: !!raw.locked,
  };
};

const layoutsEqual = (left: StageTimerLayout, right: StageTimerLayout) => (
  left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height
  && left.fontScale === right.fontScale
  && left.variant === right.variant
  && left.locked === right.locked
);

const alertLayoutsEqual = (left: StageAlertLayout, right: StageAlertLayout) => (
  left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height
  && left.fontScale === right.fontScale
  && left.locked === right.locked
);

export const StageDisplay: React.FC<StageDisplayProps> = ({
  currentSlide,
  nextSlide,
  activeItem,
  timerLabel = 'Service Timer',
  timerDisplay = '00:00',
  timerMode = 'COUNTDOWN',
  isTimerOvertime = false,
  timerRemainingSec = 0,
  timerDurationSec = 0,
  timerAmberPercent = 25,
  timerRedPercent = 10,
  timerFlashActive = false,
  timerFlashColor = 'white',
  timerLayout,
  onTimerLayoutChange,
  stageAlertLayout,
  onStageAlertLayoutChange,
  profile = 'classic',
  flowLayout = 'balanced',
  audienceOverlay,
  stageAlert,
  stageMessageCenter,
  embedded = false,
  viewportWidth,
  viewportHeight,
  className = '',
  branding,
  // Tier 2
  schedule = [],
  activeItemId = null,
  onItemSelect,
  onNextSlide,
  onPrevSlide,
  // Tier 3
  operatorCount = 1,
  autoAdvanceEnabled = false,
  autoAdvanceSec = 10,
  onAutoAdvanceToggle,
  onAutoAdvanceSecsChange,
  showSttPanel = false,
  sttIsRecording = false,
  sttTranscript = '',
  sttInterimText = '',
  onSttToggleRecording,
  onSttClose,
}) => {
  const viewportOverride = useMemo<StageViewportOverride | null>(() => (
    embedded
      && Number.isFinite(viewportWidth)
      && Number.isFinite(viewportHeight)
      ? {
        width: Math.max(320, Number(viewportWidth)),
        height: Math.max(180, Number(viewportHeight)),
      }
      : null
  ), [embedded, viewportHeight, viewportWidth]);
  const [time, setTime] = useState(new Date());
  const [layout, setLayout] = useState<StageTimerLayout>(() => normalizeLayout(timerLayout, undefined, viewportOverride));
  const [alertLayout, setAlertLayout] = useState<StageAlertLayout>(() => normalizeAlertLayout(stageAlertLayout, undefined, viewportOverride));
  const lastExternalTimerLayoutRef = useRef<StageTimerLayout>(normalizeLayout(timerLayout, undefined, viewportOverride));
  const lastExternalAlertLayoutRef = useRef<StageAlertLayout>(normalizeAlertLayout(stageAlertLayout, undefined, viewportOverride));
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const [alertDragMode, setAlertDragMode] = useState<'move' | 'resize' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; layout: StageTimerLayout } | null>(null);
  const alertDragStartRef = useRef<{ x: number; y: number; layout: StageAlertLayout } | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const alertDragPointerIdRef = useRef<number | null>(null);
  const dragCaptureTargetRef = useRef<HTMLElement | null>(null);
  const alertDragCaptureTargetRef = useRef<HTMLElement | null>(null);
  const timerWidgetRef = useRef<HTMLDivElement | null>(null);
  const alertWidgetRef = useRef<HTMLDivElement | null>(null);
  const [timerBounds, setTimerBounds] = useState<{ width: number; height: number }>({ width: layout.width, height: layout.height });
  const [alertBounds, setAlertBounds] = useState<{ width: number; height: number }>({ width: alertLayout.width, height: alertLayout.height });
  const [controlsMenuOpen, setControlsMenuOpen] = useState(false);
  const [showRunOrder, setShowRunOrder] = useState(false);
  const [showKeyboardOverlay, setShowKeyboardOverlay] = useState(false);
  const [showAutoAdvanceWidget, setShowAutoAdvanceWidget] = useState(false);
  const getHostWindow = useCallback(() => (
    timerWidgetRef.current?.ownerDocument?.defaultView
    || (typeof window === 'undefined' ? null : window)
  ), []);

  const getPreferredBackground = useCallback((slide: Slide | null) => (
    (typeof slide?.backgroundUrl === 'string' && slide.backgroundUrl.trim())
    || (typeof activeItem?.theme?.backgroundUrl === 'string' && activeItem.theme.backgroundUrl.trim())
    || ''
  ), [activeItem?.theme?.backgroundUrl]);
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string>('');
  const [nextMediaUrl, setNextMediaUrl] = useState<string>('');
  const clockFormatter = useMemo(
    () => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }),
    []
  );

  const publishLayout = useCallback((next: StageTimerLayout) => {
    setLayout(next);
    onTimerLayoutChange?.(next);
  }, [onTimerLayoutChange]);

  const publishAlertLayout = useCallback((next: StageAlertLayout) => {
    setAlertLayout(next);
    onStageAlertLayoutChange?.(next);
  }, [onStageAlertLayoutChange]);

  useEffect(() => {
    const normalized = normalizeLayout(timerLayout, getHostWindow(), viewportOverride);
    if (!layoutsEqual(normalized, lastExternalTimerLayoutRef.current)) {
      lastExternalTimerLayoutRef.current = normalized;
      if (!layoutsEqual(normalized, layout)) {
        setLayout(normalized);
      }
    }
  }, [timerLayout, layout, getHostWindow, viewportOverride]);

  useEffect(() => {
    const normalized = normalizeAlertLayout(stageAlertLayout, getHostWindow(), viewportOverride);
    if (!alertLayoutsEqual(normalized, lastExternalAlertLayoutRef.current)) {
      lastExternalAlertLayoutRef.current = normalized;
      if (!alertLayoutsEqual(normalized, alertLayout)) {
        setAlertLayout(normalized);
      }
    }
  }, [stageAlertLayout, alertLayout, getHostWindow, viewportOverride]);

  useEffect(() => {
    const hostWindow = getHostWindow();
    if (!hostWindow && !viewportOverride) return;
    const onResize = () => {
      const normalized = normalizeLayout(layout, hostWindow, viewportOverride);
      if (!layoutsEqual(normalized, layout)) publishLayout(normalized);
      const normalizedAlert = normalizeAlertLayout(alertLayout, hostWindow, viewportOverride);
      if (!alertLayoutsEqual(normalizedAlert, alertLayout)) publishAlertLayout(normalizedAlert);
    };
    if (hostWindow) {
      hostWindow.addEventListener('resize', onResize);
      return () => hostWindow.removeEventListener('resize', onResize);
    }
    return undefined;
  }, [layout, alertLayout, publishLayout, publishAlertLayout, getHostWindow, viewportOverride]);

  useEffect(() => {
    const node = timerWidgetRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const hostWindow = node.ownerDocument?.defaultView || null;
    const normalized = normalizeLayout(layout, hostWindow, viewportOverride);
    if (!layoutsEqual(normalized, layout)) {
      publishLayout(normalized);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(0, Math.round(entry.contentRect.width));
      const nextHeight = Math.max(0, Math.round(entry.contentRect.height));
      setTimerBounds((prev) => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [layout, publishLayout, viewportOverride]);

  useEffect(() => {
    const node = alertWidgetRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const hostWindow = node.ownerDocument?.defaultView || null;
    const normalized = normalizeAlertLayout(alertLayout, hostWindow, viewportOverride);
    if (!alertLayoutsEqual(normalized, alertLayout)) {
      publishAlertLayout(normalized);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(0, Math.round(entry.contentRect.width));
      const nextHeight = Math.max(0, Math.round(entry.contentRect.height));
      setAlertBounds((prev) => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [alertLayout, publishAlertLayout, viewportOverride]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const raw = getPreferredBackground(currentSlide);
      if (!raw) {
        setCurrentMediaUrl('');
        return;
      }
      if (!raw.startsWith('local://')) {
        setCurrentMediaUrl(raw);
        return;
      }
      const cached = getCachedMedia(raw);
      if (cached) {
        setCurrentMediaUrl(cached);
        return;
      }
      try {
        const resolved = await getMedia(raw);
        if (!cancelled) setCurrentMediaUrl(resolved || '');
      } catch {
        if (!cancelled) setCurrentMediaUrl('');
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [currentSlide?.id, currentSlide?.backgroundUrl, getPreferredBackground]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const raw = getPreferredBackground(nextSlide);
      if (!raw) {
        setNextMediaUrl('');
        return;
      }
      if (!raw.startsWith('local://')) {
        setNextMediaUrl(raw);
        return;
      }
      const cached = getCachedMedia(raw);
      if (cached) {
        setNextMediaUrl(cached);
        return;
      }
      try {
        const resolved = await getMedia(raw);
        if (!cancelled) setNextMediaUrl(resolved || '');
      } catch {
        if (!cancelled) setNextMediaUrl('');
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [nextSlide?.id, nextSlide?.backgroundUrl, getPreferredBackground]);

  useEffect(() => {
    if (!dragMode) return;
    const hostWindow = getHostWindow();
    const hostDocument = timerWidgetRef.current?.ownerDocument || hostWindow?.document;
    if (!hostWindow || !hostDocument) return;
    const onMove = (event: PointerEvent) => {
      const pointerId = dragPointerIdRef.current;
      if (pointerId !== null && event.pointerId !== pointerId) return;
      const start = dragStartRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const { vw, vh } = resolveViewport(hostWindow, viewportOverride);

      if (dragMode === 'move') {
        const next = {
          ...start.layout,
          x: clamp(start.layout.x + dx, 0, Math.max(0, vw - start.layout.width)),
          y: clamp(start.layout.y + dy, 0, Math.max(0, vh - start.layout.height)),
        };
        publishLayout(next);
      } else if (dragMode === 'resize') {
        const width = clamp(start.layout.width + dx, 220, 1600);
        const height = clamp(start.layout.height + dy, 72, 900);
        const next = {
          ...start.layout,
          width,
          height,
          x: clamp(start.layout.x, 0, Math.max(0, vw - width)),
          y: clamp(start.layout.y, 0, Math.max(0, vh - height)),
          variant: 'top-right' as StageTimerVariant,
        };
        publishLayout(next);
      }
    };
    const onUp = (event?: PointerEvent) => {
      const pointerId = dragPointerIdRef.current;
      if (event && pointerId !== null && event.pointerId !== pointerId) return;
      const captureTarget = dragCaptureTargetRef.current;
      if (
        pointerId !== null
        && captureTarget
        && typeof captureTarget.hasPointerCapture === 'function'
        && captureTarget.hasPointerCapture(pointerId)
        && typeof captureTarget.releasePointerCapture === 'function'
      ) {
        try {
          captureTarget.releasePointerCapture(pointerId);
        } catch {
          // ignore release errors
        }
      }
      dragPointerIdRef.current = null;
      dragCaptureTargetRef.current = null;
      setDragMode(null);
      dragStartRef.current = null;
    };
    hostDocument.addEventListener('pointermove', onMove);
    hostDocument.addEventListener('pointerup', onUp);
    hostDocument.addEventListener('pointercancel', onUp);
    return () => {
      hostDocument.removeEventListener('pointermove', onMove);
      hostDocument.removeEventListener('pointerup', onUp);
      hostDocument.removeEventListener('pointercancel', onUp);
    };
  }, [dragMode, publishLayout, getHostWindow, viewportOverride]);

  useEffect(() => {
    if (!alertDragMode) return;
    const hostWindow = getHostWindow();
    const hostDocument = alertWidgetRef.current?.ownerDocument || hostWindow?.document;
    if (!hostWindow || !hostDocument) return;
    const onMove = (event: PointerEvent) => {
      const pointerId = alertDragPointerIdRef.current;
      if (pointerId !== null && event.pointerId !== pointerId) return;
      const start = alertDragStartRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const { vw, vh } = resolveViewport(hostWindow, viewportOverride);

      if (alertDragMode === 'move') {
        const next = {
          ...start.layout,
          x: clamp(start.layout.x + dx, 0, Math.max(0, vw - start.layout.width)),
          y: clamp(start.layout.y + dy, 0, Math.max(0, vh - start.layout.height)),
        };
        publishAlertLayout(next);
      } else if (alertDragMode === 'resize') {
        const width = clamp(start.layout.width + dx, 320, 1800);
        const height = clamp(start.layout.height + dy, 88, 640);
        const next = {
          ...start.layout,
          width,
          height,
          x: clamp(start.layout.x, 0, Math.max(0, vw - width)),
          y: clamp(start.layout.y, 0, Math.max(0, vh - height)),
        };
        publishAlertLayout(next);
      }
    };
    const onUp = (event?: PointerEvent) => {
      const pointerId = alertDragPointerIdRef.current;
      if (event && pointerId !== null && event.pointerId !== pointerId) return;
      const captureTarget = alertDragCaptureTargetRef.current;
      if (
        pointerId !== null
        && captureTarget
        && typeof captureTarget.hasPointerCapture === 'function'
        && captureTarget.hasPointerCapture(pointerId)
        && typeof captureTarget.releasePointerCapture === 'function'
      ) {
        try {
          captureTarget.releasePointerCapture(pointerId);
        } catch {
          // ignore release errors
        }
      }
      alertDragPointerIdRef.current = null;
      alertDragCaptureTargetRef.current = null;
      setAlertDragMode(null);
      alertDragStartRef.current = null;
    };
    hostDocument.addEventListener('pointermove', onMove);
    hostDocument.addEventListener('pointerup', onUp);
    hostDocument.addEventListener('pointercancel', onUp);
    return () => {
      hostDocument.removeEventListener('pointermove', onMove);
      hostDocument.removeEventListener('pointerup', onUp);
      hostDocument.removeEventListener('pointercancel', onUp);
    };
  }, [alertDragMode, publishAlertLayout, getHostWindow, viewportOverride]);

  const compact = profile === 'compact';
  const highContrast = profile === 'high_contrast';
  const currentTitle = typeof activeItem?.title === 'string' && activeItem.title.trim() ? activeItem.title : 'Waiting for Service...';
  // Item-level sermon outline notes (Tier 2)
  const itemNotes = typeof activeItem?.metadata?.notes === 'string' ? activeItem.metadata.notes.trim() : '';
  // Per-slide speaker notes (Tier 2)
  const slideNotes = typeof currentSlide?.notes === 'string' ? currentSlide.notes.trim() : '';
  const currentText = typeof currentSlide?.content === 'string' && currentSlide.content.trim() ? currentSlide.content : '';
  const nextText = typeof nextSlide?.content === 'string' && nextSlide.content.trim() ? nextSlide.content : '';
  const currentTextIsHtml = /<[a-zA-Z][^>]*>/.test(currentText);
  const nextTextIsHtml = /<[a-zA-Z][^>]*>/.test(nextText);
  const currentHasText = currentText.length > 0;
  const nextHasText = nextText.length > 0;
  const currentReferenceLabel = currentHasText && (
    activeItem?.type === 'BIBLE'
    || activeItem?.type === 'SCRIPTURE'
    || currentSlide?.layoutType === 'scripture_ref'
  )
    ? String(currentSlide?.label || '').trim()
    : '';
  const looksLikeVideo = (url: string) => {
    const normalized = url.split('?')[0].toLowerCase();
    return normalized.endsWith('.mp4') || normalized.endsWith('.webm') || normalized.endsWith('.mov') || normalized.includes('/video/');
  };
  const currentMediaIsVideo = currentMediaUrl ? looksLikeVideo(currentMediaUrl) : false;
  const nextMediaIsVideo = nextMediaUrl ? looksLikeVideo(nextMediaUrl) : false;
  const safeTimerDisplay = typeof timerDisplay === 'string' && timerDisplay.trim() ? timerDisplay : '00:00';
  const audienceQueue = Array.isArray(audienceOverlay?.queue) ? audienceOverlay.queue : [];
  const activeAudienceId = audienceOverlay?.pinnedMessageId || audienceOverlay?.activeMessageId;
  const activeAudienceMessage = audienceQueue.find((entry: any) => entry?.id === activeAudienceId) || null;
  const tickerItems = audienceQueue;
  const tickerLoopItems = tickerItems.length ? [...tickerItems, ...tickerItems] : [];
  const tickerCharacterCount = tickerItems.reduce((sum: number, entry: any) => (
    sum
    + String(entry?.submitter_name || 'AUDIENCE').length
    + String(entry?.text || '').length
  ), 0);
  const tickerDuration = Math.max(20, Math.min(90, tickerCharacterCount * 0.22));
  const tickerBandHeight = embedded ? 54 : 64;
  const tickerLabelWidth = embedded ? 132 : 170;
  const tickerTextSize = embedded ? 16 : 18;
  const tickerNameSize = embedded ? 10 : 11;
  const tickerGap = embedded ? 28 : 40;
  const showTicker = !!audienceOverlay?.tickerEnabled && audienceQueue.length > 0;
  const showPinned = !!activeAudienceMessage && !showTicker;
  const showAudienceBadge = showTicker || showPinned;
  const stageQueue = Array.isArray(stageMessageCenter?.queue) ? stageMessageCenter.queue : [];
  const stageActiveId = typeof stageMessageCenter?.activeMessageId === 'string' ? stageMessageCenter.activeMessageId : null;
  const activeQueuedStageMessage = stageActiveId ? (stageQueue.find((entry) => entry.id === stageActiveId) || null) : null;
  const legacyStageMessage = !activeQueuedStageMessage && stageAlert?.active && stageAlert?.text?.trim()
    ? {
      id: `legacy-${stageAlert.updatedAt || 0}`,
      category: 'urgent',
      text: stageAlert.text,
      priority: 'high',
      author: stageAlert.author,
    }
    : null;
  const activeStageMessage = activeQueuedStageMessage || legacyStageMessage;
  const activeStageQueueIndex = activeQueuedStageMessage
    ? Math.max(0, stageQueue.findIndex((entry) => entry.id === activeQueuedStageMessage.id))
    : -1;
  const showStageAlert = !!activeStageMessage?.text?.trim();

  const safeDurationSec = Math.max(0, Number(timerDurationSec || 0));
  const safeRemainingSec = Number.isFinite(timerRemainingSec) ? Number(timerRemainingSec) : 0;
  const safeAmberPct = clamp(Number(timerAmberPercent || 25), 1, 99);
  const safeRedPct = clamp(Number(timerRedPercent || 10), 1, 99);
  const remainingRatio = safeDurationSec > 0
    ? clamp((safeRemainingSec / safeDurationSec), 0, 1)
    : 1;
  const isCountdown = timerMode === 'COUNTDOWN';
  const toneClass = isTimerOvertime
    ? 'text-red-400 border-red-500/60 bg-red-950/35'
    : !isCountdown
      ? 'text-cyan-300 border-cyan-500/50 bg-cyan-950/25'
      : remainingRatio <= safeRedPct / 100
        ? 'text-red-400 border-red-500/60 bg-red-950/35'
        : remainingRatio <= safeAmberPct / 100
          ? 'text-amber-300 border-amber-500/50 bg-amber-950/30'
          : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/25';
  const flashToneClass = timerFlashColor === 'amber'
    ? 'text-amber-100 border-amber-300/90 bg-amber-950/42 shadow-[0_0_48px_rgba(251,191,36,0.35)]'
    : timerFlashColor === 'red'
      ? 'text-rose-50 border-rose-300/90 bg-rose-950/44 shadow-[0_0_56px_rgba(251,113,133,0.36)]'
      : timerFlashColor === 'cyan'
        ? 'text-cyan-50 border-cyan-200/90 bg-cyan-950/42 shadow-[0_0_56px_rgba(34,211,238,0.36)]'
        : 'text-white border-white/90 bg-white/12 shadow-[0_0_56px_rgba(255,255,255,0.22)]';
  const timerWidgetToneClass = timerFlashActive ? flashToneClass : toneClass;
  const timerFlashPulseClass = timerFlashActive ? 'lumina-stage-timer-flash' : '';
  const timerFlashTextClass = timerFlashActive ? 'lumina-stage-timer-flash-text' : '';

  const startDrag = (mode: 'move' | 'resize', event: React.PointerEvent<HTMLElement>) => {
    if (layout.locked) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragPointerIdRef.current = event.pointerId;
    dragCaptureTargetRef.current = event.currentTarget;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture errors
      }
    }
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      layout,
    };
    setDragMode(mode);
  };

  const startAlertDrag = (mode: 'move' | 'resize', event: React.PointerEvent<HTMLElement>) => {
    if (alertLayout.locked) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    alertDragPointerIdRef.current = event.pointerId;
    alertDragCaptureTargetRef.current = event.currentTarget;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture errors
      }
    }
    alertDragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      layout: alertLayout,
    };
    setAlertDragMode(mode);
  };

  const applyPreset = (variant: StageTimerVariant) => {
    const next = applyLayoutPreset(variant, layout.locked, getHostWindow(), viewportOverride);
    publishLayout(next);
  };

  const applyAlertPreset = (preset: 'top-center' | 'top-left' | 'bottom-center') => {
    const hostWindow = getHostWindow();
    const { vw, vh } = resolveViewport(hostWindow, viewportOverride);
    const margin = 24;
    const width = clamp(alertLayout.width, 320, 1800);
    const height = clamp(alertLayout.height, 88, 640);
    let x = alertLayout.x;
    let y = alertLayout.y;
    if (preset === 'top-center') {
      x = Math.max(0, Math.round((vw - width) / 2));
      y = margin;
    } else if (preset === 'top-left') {
      x = margin;
      y = margin;
    } else if (preset === 'bottom-center') {
      x = Math.max(0, Math.round((vw - width) / 2));
      y = Math.max(margin, vh - height - margin);
    }
    publishAlertLayout({
      ...alertLayout,
      x: clamp(x, 0, Math.max(0, vw - width)),
      y: clamp(y, 0, Math.max(0, vh - height)),
      width,
      height,
    });
  };

  const toggleLock = () => {
    publishLayout({ ...layout, locked: !layout.locked });
  };
  const toggleAlertLock = () => {
    publishAlertLayout({ ...alertLayout, locked: !alertLayout.locked });
  };
  const stopWidgetDrag = (event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const widgetFontScale = clamp(layout.fontScale, 0.6, 3.4);
  const measuredWidth = Math.max(220, timerBounds.width || layout.width);
  const measuredHeight = Math.max(72, timerBounds.height || layout.height);
  const timerTextMaxWidth = Math.max(80, measuredWidth - 26);
  const timerTextMaxHeight = Math.max(26, measuredHeight - (layout.variant === 'compact-bar' ? 46 : 78));
  const estimatedChars = Math.max(1, safeTimerDisplay.length);
  const fitByWidth = timerTextMaxWidth / (estimatedChars * 0.56);
  const fitByHeight = timerTextMaxHeight / 0.9;
  const maxFitFont = Math.max(18, Math.min(fitByWidth, fitByHeight));
  const requestedTimerFont = (layout.variant === 'compact-bar' ? 46 : 60) * widgetFontScale;
  const timerFontPx = clamp(Math.min(requestedTimerFont, maxFitFont), 18, layout.variant === 'compact-bar' ? 280 : 460);
  const timerTextSize = `${Math.round(timerFontPx)}px`;
  const subtitleSize = `${Math.round(clamp(10 * widgetFontScale, 8, 16))}px`;
  const collapseControls = !layout.locked && (measuredWidth < 560 || measuredHeight < 132);
  const stageCategory = activeStageMessage?.category || 'urgent';
  const stagePriorityHigh = activeStageMessage?.priority === 'high';
  const stageBannerTone = stageCategory === 'timing'
    ? 'bg-amber-950/80 border-amber-500/50 text-amber-50'
      : stageCategory === 'logistics'
        ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-50'
        : 'bg-rose-950/80 border-rose-500/50 text-rose-50';
  const measuredAlertWidth = Math.max(320, alertBounds.width || alertLayout.width);
  const measuredAlertHeight = Math.max(88, alertBounds.height || alertLayout.height);
  const alertFontScale = clamp(alertLayout.fontScale, 0.7, 2.2);
  const alertTitleSize = `${Math.round(clamp(10 * alertFontScale, 9, 20))}px`;
  const alertBodyPx = clamp(Math.min(measuredAlertHeight * 0.42, measuredAlertWidth * 0.06) * alertFontScale, 16, 66);
  const alertBodySize = `${Math.round(alertBodyPx)}px`;
  const alertMetaSize = `${Math.round(clamp(10 * alertFontScale, 9, 16))}px`;
  const safeFlowLayout = isFlowLayout(flowLayout) ? flowLayout : 'balanced';
  const flowGridRows = safeFlowLayout === 'speaker_focus'
    ? 'auto minmax(0,1.45fr) minmax(0,0.55fr)'
    : safeFlowLayout === 'preview_focus'
      ? 'auto minmax(0,0.75fr) minmax(0,1.25fr)'
      : safeFlowLayout === 'minimal_next'
        ? 'auto minmax(0,1.7fr) minmax(0,0.35fr)'
        : 'auto minmax(0,1fr) minmax(0,1fr)';
  const currentTextClass = safeFlowLayout === 'speaker_focus'
    ? (compact ? 'text-6xl' : 'text-8xl')
    : safeFlowLayout === 'preview_focus'
      ? (compact ? 'text-4xl' : 'text-6xl')
      : safeFlowLayout === 'minimal_next'
        ? (compact ? 'text-6xl' : 'text-8xl')
        : (compact ? 'text-5xl' : 'text-7xl');
  const nextTextClass = safeFlowLayout === 'speaker_focus'
    ? (compact ? 'text-2xl' : 'text-3xl')
    : safeFlowLayout === 'preview_focus'
      ? (compact ? 'text-4xl' : 'text-5xl')
      : safeFlowLayout === 'minimal_next'
        ? (compact ? 'text-xl' : 'text-2xl')
        : (compact ? 'text-3xl' : 'text-4xl');
  const nextPanelOpacityClass = safeFlowLayout === 'minimal_next' ? 'opacity-80' : '';
  const flowBadgeLabel = safeFlowLayout === 'speaker_focus'
    ? 'Speaker Focus'
    : safeFlowLayout === 'preview_focus'
      ? 'Preview Focus'
      : safeFlowLayout === 'minimal_next'
        ? 'Minimal Next'
        : 'Balanced';

  useEffect(() => {
    if (!collapseControls || layout.locked) {
      setControlsMenuOpen(false);
    }
  }, [collapseControls, layout.locked]);

  return (
    <div
      className={`relative ${embedded ? 'h-full w-full' : 'h-screen w-screen'} overflow-hidden text-white p-8 grid gap-8 font-sans ${highContrast ? 'bg-black' : 'bg-black'} ${className}`}
      style={{ gridTemplateRows: flowGridRows }}
    >
      <div className="flex justify-between items-start border-b border-gray-800 pb-4 gap-6">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold ${highContrast ? 'text-white' : 'text-gray-400'} truncate max-w-2xl`}>
            {currentTitle}
          </h1>
          {/* Item-level sermon outline notes — Tier 2 */}
          {itemNotes && (
            <div className={`${compact ? 'text-xs' : 'text-sm'} text-amber-300/70 leading-snug max-w-2xl`}
              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
              title={itemNotes}
            >
              <span className="text-[9px] uppercase tracking-widest font-black text-amber-500/60 mr-1.5">Outline</span>
              {itemNotes}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className={`${compact ? 'text-4xl' : 'text-6xl'} font-mono font-bold text-yellow-500`}>
            {clockFormatter.format(time)}
          </div>
          {/* Header control buttons — Tier 2 */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold border border-zinc-700/70 rounded px-2 py-0.5 bg-black/30">
              Flow {flowBadgeLabel}
            </div>
            {/* Multi-operator badge — Tier 3 */}
            <StageOperatorBadge operatorCount={operatorCount} />
            <button
              onClick={() => setShowRunOrder((v) => !v)}
              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${showRunOrder ? 'border-zinc-300 text-white bg-zinc-800' : 'border-zinc-700 text-zinc-400 hover:border-zinc-400'}`}
              title="Toggle run order (R)"
            >
              Order
            </button>
            <button
              onClick={() => setShowAutoAdvanceWidget((v) => !v)}
              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${showAutoAdvanceWidget ? (autoAdvanceEnabled ? 'border-green-600 text-green-400' : 'border-zinc-300 text-white bg-zinc-800') : 'border-zinc-700 text-zinc-400 hover:border-zinc-400'}`}
              title="Toggle auto-advance widget (A)"
            >
              Auto
            </button>
            <button
              onClick={() => setShowKeyboardOverlay((v) => !v)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-400 transition-colors"
              title="Keyboard shortcuts (?)"
            >
              Keys
            </button>
          </div>
          {showAudienceBadge && (
            <div className="bg-blue-600/15 border border-blue-500/40 rounded-lg px-3 py-2 max-w-[260px] backdrop-blur-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-0.5">Audience Active</div>
              <div className="text-xs font-medium leading-tight text-blue-100">
                {showTicker ? 'Ticker Running' : 'Message Displaying'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col min-h-0 overflow-hidden">
        <span className="text-sm font-bold text-green-500 uppercase tracking-widest mb-2 shrink-0">CURRENT</span>
        {currentSlide ? (
          <div className="flex gap-4 min-h-0 flex-1 overflow-hidden">
            {/* Scaled replica of the projected output */}
            <div className="shrink-0 rounded-xl overflow-hidden border border-zinc-700/50 shadow-xl" style={{ width: compact ? 320 : 480, aspectRatio: '16/9' }}>
              <SlideRenderer
                slide={currentSlide}
                item={activeItem}
                fitContainer={true}
                isThumbnail={false}
                isMuted={true}
                isPlaying={true}
                branding={branding}
              />
            </div>
            {/* Speaker reading text — large, clear, never overflows */}
            <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
              {currentHasText ? (
                <div className={`${currentTextClass} font-bold leading-snug text-white overflow-hidden`} style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 6, overflow: 'hidden' }}>
                  {currentTextIsHtml ? <span dangerouslySetInnerHTML={{ __html: currentText }} /> : currentText}
                </div>
              ) : (
                <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold leading-tight text-zinc-500`}>
                  Visual slide active
                </div>
              )}
              {currentReferenceLabel && (
                <div className="mt-3 shrink-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-slate-950/80 px-4 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.32)] backdrop-blur-md">
                    <span className="text-[10px] uppercase tracking-[0.22em] font-black text-cyan-300/80">Ref</span>
                    <span className="text-sm font-bold uppercase tracking-[0.08em] text-white/95">{currentReferenceLabel}</span>
                  </div>
                </div>
              )}
              {/* Per-slide speaker notes — Tier 2 */}
              {slideNotes && (
                <div className="mt-3 shrink-0">
                  <div className="text-[9px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-1">Speaker Notes</div>
                  <div
                    className={`${compact ? 'text-xs' : 'text-sm'} text-zinc-400 leading-snug`}
                    style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}
                  >
                    {slideNotes}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${compact ? 'text-4xl' : 'text-5xl'} font-bold leading-tight text-zinc-500`}>
            Waiting for active slide
          </div>
        )}
      </div>

      {showStageAlert && (
        <div
          ref={alertWidgetRef}
          data-testid="stage-alert-widget"
          className={`absolute border rounded-2xl backdrop-blur-md shadow-2xl z-40 ${stageBannerTone}`}
          style={{
            left: alertLayout.x,
            top: alertLayout.y,
            width: alertLayout.width,
            height: alertLayout.height,
            minHeight: 88,
            overflow: 'hidden',
            touchAction: alertLayout.locked ? 'auto' : 'none',
          }}
        >
          <div
            data-testid="stage-alert-drag-surface"
            onPointerDown={(event) => startAlertDrag('move', event)}
            className={`relative w-full h-full px-5 py-3 ${alertLayout.locked ? 'cursor-default' : 'cursor-move'} flex flex-col justify-between overflow-hidden`}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="font-black uppercase tracking-[0.2em] truncate pr-2" style={{ fontSize: alertTitleSize }}>
                Pastor Alert - {stageCategory}
                {stagePriorityHigh ? ' - HIGH' : ''}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeStageQueueIndex >= 0 && stageQueue.length > 0 && (
                  <div className="uppercase tracking-[0.2em] opacity-80" style={{ fontSize: alertTitleSize }}>
                    {activeStageQueueIndex + 1}/{stageQueue.length}
                  </div>
                )}
                {!alertLayout.locked && (
                  <>
                    <button
                      onPointerDown={stopWidgetDrag}
                      onClick={() => publishAlertLayout({ ...alertLayout, fontScale: clamp(alertLayout.fontScale - 0.1, 0.7, 2.2) })}
                      className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                      title="Reduce alert text size"
                    >
                      A-
                    </button>
                    <button
                      onPointerDown={stopWidgetDrag}
                      onClick={() => publishAlertLayout({ ...alertLayout, fontScale: clamp(alertLayout.fontScale + 0.1, 0.7, 2.2) })}
                      className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                      title="Increase alert text size"
                    >
                      A+
                    </button>
                    <button
                      onPointerDown={stopWidgetDrag}
                      onClick={() => applyAlertPreset('top-center')}
                      className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                      title="Snap alert to top center"
                    >
                      TOP C
                    </button>
                    <button
                      onPointerDown={stopWidgetDrag}
                      onClick={() => applyAlertPreset('top-left')}
                      className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                      title="Snap alert to top left"
                    >
                      TOP L
                    </button>
                    <button
                      onPointerDown={stopWidgetDrag}
                      onClick={() => applyAlertPreset('bottom-center')}
                      className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                      title="Snap alert to bottom center"
                    >
                      BOT C
                    </button>
                  </>
                )}
                <button
                  onPointerDown={stopWidgetDrag}
                  onClick={toggleAlertLock}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/30 hover:border-white/60"
                  title={alertLayout.locked ? 'Unlock alert widget' : 'Lock alert widget'}
                >
                  {alertLayout.locked ? 'Locked' : 'Free'}
                </button>
              </div>
            </div>
            <div className="font-semibold leading-snug truncate" style={{ fontSize: alertBodySize }}>
              {activeStageMessage?.text}
            </div>
            {activeStageMessage?.author && (
              <div className="uppercase tracking-wider opacity-80 mt-1 truncate" style={{ fontSize: alertMetaSize }}>
                From {activeStageMessage.author}
              </div>
            )}
          </div>

          {!alertLayout.locked && (
            <div
              data-testid="stage-alert-resize-handle"
              onPointerDown={(event) => startAlertDrag('resize', event)}
              className="absolute right-1 bottom-1 h-6 w-6 cursor-se-resize rounded-sm border border-white/50 bg-black/40 flex items-center justify-center"
              title="Resize alert widget"
            >
              <span className="text-[10px] leading-none text-white/80">::</span>
            </div>
          )}
        </div>
      )}
      <div className={`flex flex-col min-h-0 overflow-hidden ${nextPanelOpacityClass} ${highContrast ? 'bg-black border-white/30' : 'bg-gray-900/50 border-gray-800'} p-6 rounded-xl border`}>
        <span className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-2 shrink-0">NEXT</span>
        {nextSlide ? (
          <div className="flex gap-4 min-h-0 flex-1 overflow-hidden">
            <div className="shrink-0 rounded-lg overflow-hidden border border-zinc-700/40 opacity-80" style={{ width: compact ? 200 : 280, aspectRatio: '16/9' }}>
              <SlideRenderer
                slide={nextSlide}
                item={activeItem}
                fitContainer={true}
                isThumbnail={false}
                isMuted={true}
                isPlaying={false}
                branding={branding}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
              {nextHasText ? (
                <div className={`${nextTextClass} font-medium ${highContrast ? 'text-white' : 'text-gray-400'} leading-snug opacity-70 overflow-hidden`} style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 5, overflow: 'hidden' }}>
                  {nextTextIsHtml ? <span dangerouslySetInnerHTML={{ __html: nextText }} /> : nextText}
                </div>
              ) : (
                <div className={`${nextTextClass} font-medium ${highContrast ? 'text-white' : 'text-gray-500'} leading-snug opacity-60`}>
                  Visual slide
                </div>
              )}
              {!nextHasText && (
                <div className="mt-2 text-[10px] uppercase tracking-wider text-blue-300 font-bold opacity-80">
                  {nextSlide?.label || (nextMediaUrl ? 'Visual Slide Preview' : 'End of Item')}
                </div>
              )}
              {/* Lyrics confidence monitor — Tier 3: dim first line of the slide after next */}
              {nextHasText && (
                <StageLyricsConfidence
                  nextSlideContent={nextText}
                  compact={compact}
                />
              )}
            </div>
          </div>
        ) : (
          <div className={`${nextTextClass} font-medium ${highContrast ? 'text-white' : 'text-gray-500'} leading-snug opacity-60`}>
            End of Item
          </div>
        )}
      </div>

      <div
        ref={timerWidgetRef}
        data-testid="stage-timer-widget"
        data-timer-flash-active={timerFlashActive ? 'true' : 'false'}
        data-timer-flash-color={timerFlashColor}
        className={`absolute z-30 rounded-xl border backdrop-blur-sm shadow-2xl ${timerWidgetToneClass} ${timerFlashPulseClass}`}
        style={{
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
          minHeight: layout.variant === 'compact-bar' ? 74 : 120,
          overflow: 'hidden',
          touchAction: layout.locked ? 'auto' : 'none',
        }}
      >
        <div
          data-testid="stage-timer-drag-surface"
          onPointerDown={(event) => startDrag('move', event)}
          className={`relative w-full h-full rounded-xl p-3 ${layout.locked ? 'cursor-default' : 'cursor-move'} flex flex-col justify-between overflow-hidden`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`text-[10px] uppercase tracking-[0.2em] font-black opacity-90 truncate pr-2 ${timerFlashTextClass}`}>
              {timerLabel} ({timerMode})
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!layout.locked && collapseControls && (
                <button
                  onPointerDown={stopWidgetDrag}
                  onClick={() => setControlsMenuOpen((prev) => !prev)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/30 hover:border-white/60"
                  title="Toggle timer controls"
                >
                  Menu
                </button>
              )}
              <button
                onPointerDown={stopWidgetDrag}
                onClick={toggleLock}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/30 hover:border-white/60"
                title={layout.locked ? 'Unlock timer widget' : 'Lock timer widget'}
              >
                {layout.locked ? 'Locked' : 'Free'}
              </button>
            </div>
          </div>

          <div
            className={`font-mono font-black leading-none text-center whitespace-nowrap overflow-hidden ${timerFlashTextClass}`}
            style={{ fontSize: timerTextSize }}
          >
            {safeTimerDisplay}
          </div>

          <div className="flex items-center justify-between gap-2 overflow-hidden">
            <div className={`opacity-80 truncate ${timerFlashTextClass}`} style={{ fontSize: subtitleSize }}>
              {isTimerOvertime ? 'OVERTIME' : (isCountdown ? `${safeAmberPct}% / ${safeRedPct}%` : 'Elapsed')}
            </div>
            {!layout.locked && !collapseControls && (
              <div className="flex gap-1 flex-wrap justify-end max-w-[72%] overflow-hidden">
                <button
                  onPointerDown={stopWidgetDrag}
                  onClick={() => publishLayout({ ...layout, fontScale: clamp(layout.fontScale - 0.1, 0.6, 3.4) })}
                  className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                  title="Reduce timer text size"
                >
                  A-
                </button>
                <button
                  onPointerDown={stopWidgetDrag}
                  onClick={() => publishLayout({ ...layout, fontScale: clamp(layout.fontScale + 0.1, 0.6, 3.4) })}
                  className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                  title="Increase timer text size"
                >
                  A+
                </button>
                {PRESET_VARIANTS.map((variant) => (
                  <button
                    key={variant}
                    onPointerDown={stopWidgetDrag}
                    onClick={() => applyPreset(variant)}
                    className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${layout.variant === variant ? 'border-white/70 text-white' : 'border-white/30 text-white/70 hover:border-white/60'}`}
                    title={`Move timer to ${variant}`}
                  >
                    {variant === 'compact-bar' ? 'bar' : variant.replace('-', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!layout.locked && collapseControls && controlsMenuOpen && (
            <div
              onPointerDown={stopWidgetDrag}
              className="absolute right-2 top-9 max-w-[90%] rounded-md border border-white/25 bg-black/80 p-2 backdrop-blur-sm"
            >
              <div className="flex gap-1 flex-wrap justify-end">
                <button
                  onPointerDown={stopWidgetDrag}
                  onClick={() => publishLayout({ ...layout, fontScale: clamp(layout.fontScale - 0.1, 0.6, 3.4) })}
                  className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/80 hover:border-white/60"
                >
                  A-
                </button>
                <button
                  onPointerDown={stopWidgetDrag}
                  onClick={() => publishLayout({ ...layout, fontScale: clamp(layout.fontScale + 0.1, 0.6, 3.4) })}
                  className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/80 hover:border-white/60"
                >
                  A+
                </button>
                {PRESET_VARIANTS.map((variant) => (
                  <button
                    key={`menu-${variant}`}
                    onPointerDown={stopWidgetDrag}
                    onClick={() => applyPreset(variant)}
                    className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${layout.variant === variant ? 'border-white/70 text-white' : 'border-white/30 text-white/70 hover:border-white/60'}`}
                  >
                    {variant === 'compact-bar' ? 'bar' : variant.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!layout.locked && (
          <div
            data-testid="stage-timer-resize-handle"
            onPointerDown={(event) => startDrag('resize', event)}
            className="absolute right-1 bottom-1 h-6 w-6 cursor-se-resize rounded-sm border border-white/50 bg-black/40 flex items-center justify-center"
            title="Resize timer widget"
          >
            <span className="text-[10px] leading-none text-white/80">↘</span>
          </div>
        )}
      </div>

      {showPinned && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-3xl bg-black/75 border border-blue-500/35 rounded-2xl px-5 py-3 backdrop-blur-md shadow-2xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-1">
            {activeAudienceMessage?.submitter_name || 'Audience'}
          </div>
          <div className="text-xl font-semibold leading-snug text-white">
            {activeAudienceMessage?.text || ''}
          </div>
        </div>
      )}

      {showTicker && (
        <div
          className="absolute left-0 right-0 bottom-0 border-t border-white/15 overflow-hidden"
          style={{
            height: tickerBandHeight,
            background: 'linear-gradient(180deg, rgba(2,6,23,0.78), rgba(2,6,23,0.94))',
            backdropFilter: 'blur(14px)',
            display: 'grid',
            gridTemplateColumns: `${tickerLabelWidth}px minmax(0, 1fr)`,
          }}
        >
          <div
            className="relative z-[2] flex items-center justify-center gap-2 border-r border-blue-300/15"
            style={{ background: 'linear-gradient(90deg, rgba(30,64,175,0.18), rgba(2,6,23,0.08))' }}
          >
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.45)]" />
            <span
              className="font-black uppercase text-blue-100"
              style={{ fontSize: tickerNameSize, letterSpacing: '0.18em' }}
            >
              Audience Feed
            </span>
          </div>
          <div className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 z-[2]"
              style={{ background: 'linear-gradient(90deg, rgba(2,6,23,0.98) 0%, rgba(2,6,23,0) 8%, rgba(2,6,23,0) 92%, rgba(2,6,23,0.98) 100%)' }}
            />
            <div
              key={`stage-ticker-${audienceQueue.map((entry: any) => entry.id).join('-')}-${audienceQueue.length}`}
              className="flex h-full min-w-[200%] items-center whitespace-nowrap"
              style={{
                gap: tickerGap,
                padding: `0 ${tickerGap}px`,
                willChange: 'transform',
                transform: 'translate3d(0,0,0)',
                animation: `stageTickerLoop ${tickerDuration}s linear infinite`,
                WebkitFontSmoothing: 'antialiased',
                textRendering: 'geometricPrecision',
              }}
            >
              {tickerLoopItems.map((entry: any, idx: number) => (
                <div key={`${entry.id || 'msg'}-${idx}`} className="flex shrink-0 items-center gap-3">
                  <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: tickerNameSize + 2 }}>&bull;</span>
                  <span style={{ color: '#f8fafc', fontSize: tickerTextSize, fontWeight: 650, letterSpacing: '0.01em' }}>
                    <span
                      style={{
                        color: '#93c5fd',
                        fontWeight: 900,
                        marginRight: 8,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        fontSize: tickerNameSize + 1,
                      }}
                    >
                      {entry.submitter_name || 'Audience'}
                    </span>
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Run order panel — Tier 2: click-to-go */}
      {showRunOrder && !embedded && (
        <StageRunOrderPanel
          schedule={schedule}
          activeItemId={activeItemId}
          onItemSelect={(id) => {
            onItemSelect?.(id);
            setShowRunOrder(false);
          }}
          onClose={() => setShowRunOrder(false)}
        />
      )}

      {/* Keyboard shortcuts overlay — Tier 2 */}
      {showKeyboardOverlay && !embedded && (
        <StageKeyboardOverlay onClose={() => setShowKeyboardOverlay(false)} />
      )}

      {/* Auto-advance widget — Tier 3 */}
      {showAutoAdvanceWidget && !embedded && onNextSlide && (
        <StageAutoAdvance
          enabled={autoAdvanceEnabled}
          delaySec={autoAdvanceSec}
          onToggle={() => onAutoAdvanceToggle?.()}
          onDelayChange={(s) => onAutoAdvanceSecsChange?.(s)}
          onAdvance={() => onNextSlide()}
          compact={compact}
        />
      )}

      {/* Sermon recording / STT panel — Tier 3 */}
      {showSttPanel && !embedded && (
        <StageSttPanel
          isRecording={sttIsRecording}
          transcript={sttTranscript}
          interimText={sttInterimText}
          onToggleRecording={() => onSttToggleRecording?.()}
          onClose={() => onSttClose?.()}
          compact={compact}
        />
      )}

      <style>{`
        @keyframes stageTickerLoop {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes luminaStageTimerFlash {
          0%, 42%, 100% { opacity: 1; filter: brightness(1); }
          16%, 28% { opacity: 0.28; filter: brightness(1.55); }
        }
        @keyframes luminaStageTimerFlashText {
          0%, 42%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(255,255,255,0); filter: brightness(1); }
          16%, 28% { opacity: 0.18; text-shadow: 0 0 28px currentColor, 0 0 44px currentColor; filter: brightness(1.85); }
        }
        .lumina-stage-timer-flash {
          animation: luminaStageTimerFlash 0.78s ease-in-out infinite;
        }
        .lumina-stage-timer-flash-text {
          animation: luminaStageTimerFlashText 0.78s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
