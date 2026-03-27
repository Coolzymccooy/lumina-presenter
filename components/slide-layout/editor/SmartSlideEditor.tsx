import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutPreset, Slide, SlideEditorTool, SlideElement, TextSlideElement, ServiceItem } from '../../../types.ts';
import { layoutPresets, getLayoutPreset } from '../presets/index.ts';
import { buildStructuredSlide, createTextElement, getRenderableElements, summarizeElementsToLegacyContent } from '../utils/slideHydration.ts';
import { SlideThumbnailsPanel } from './SlideThumbnailsPanel.tsx';
import { SlideCanvas } from './SlideCanvas.tsx';
import { InspectorPanel } from './InspectorPanel.tsx';
import { EditorToolbar } from './EditorToolbar.tsx';
import { bringElementForward, sendElementBackward } from '../utils/selectionMath.ts';
import { saveMedia } from '../../../services/localMedia.ts';
import { uploadWorkspaceMedia, type ActorLike } from '../../../services/serverApi.ts';

interface SmartSlideEditorProps {
  isOpen: boolean;
  item: ServiceItem | null;
  mode?: 'add' | 'edit';
  initialSlideId?: string | null;
  onClose: () => void;
  onSaveSlides: (slides: Slide[], selectedSlideId?: string | null) => void;
  onImportPowerPointVisual?: (file: File) => Promise<Slide[]>;
  onImportPowerPointText?: (file: File) => Promise<Slide[]>;
  workspaceId?: string;
  user?: ActorLike;
}

const createSlideId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const cloneSlide = (slide: Slide) => JSON.parse(JSON.stringify(slide)) as Slide;
const SMART_SLIDE_CLIPBOARD_KEY = 'lumina.smart-slide-editor.clipboard';

const createDuplicateLabel = (label?: string) => {
  const base = String(label || 'Slide').trim() || 'Slide';
  return / copy$/i.test(base) ? base : `${base} Copy`;
};

const readStoredSlideClipboard = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SMART_SLIDE_CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { type?: string; slide?: Slide };
    if (parsed?.type !== 'lumina-smart-slide' || !parsed.slide?.id) return null;
    return cloneSlide(parsed.slide);
  } catch {
    return null;
  }
};

const writeStoredSlideClipboard = (slide: Slide | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!slide) {
      window.sessionStorage.removeItem(SMART_SLIDE_CLIPBOARD_KEY);
      return;
    }
    window.sessionStorage.setItem(SMART_SLIDE_CLIPBOARD_KEY, JSON.stringify({
      type: 'lumina-smart-slide',
      slide: cloneSlide(slide),
    }));
  } catch {
    // Ignore clipboard persistence failures.
  }
};

const createEmptySlide = (item: ServiceItem | null, preset: LayoutPreset) => {
  const slide: Slide = {
    id: createSlideId(),
    label: 'New Slide',
    content: 'Your text here',
    type: preset.defaultSlideType,
    layoutType: preset.id,
    elements: preset.createElements(),
    backgroundUrl: item?.theme?.backgroundUrl || '',
    mediaType: item?.theme?.mediaType || 'image',
    mediaFit: 'cover',
    metadata: {},
  };
  return buildStructuredSlide(slide, item);
};

const createMediaOnlySlide = (item: ServiceItem | null, label: string, url: string, mediaType: 'image' | 'video') => buildStructuredSlide({
  id: createSlideId(),
  label,
  content: '',
  type: 'custom',
  layoutType: 'media',
  elements: [],
  backgroundUrl: url,
  mediaType,
  mediaFit: mediaType === 'video' ? 'cover' : 'contain',
  metadata: {},
}, item);

const getPrimaryEditableElementId = (slide: Slide | null, item: ServiceItem | null) => {
  if (!slide) return null;
  const firstEditable = getRenderableElements(slide, item).find((element) => element.type === 'text' && element.locked !== true);
  return firstEditable?.id || null;
};

const isDefaultSingleDraft = (slide: Slide | null, item: ServiceItem | null) => {
  if (!slide) return false;
  const elements = getRenderableElements(slide, item);
  if (slide.layoutType !== 'single' || elements.length !== 1) return false;
  const [first] = elements;
  if (!first || first.type !== 'text') return false;
  return String(slide.backgroundUrl || '').trim() === '' && String(first.content || '').trim() === 'Your text here';
};

const hasGenericSlideLabel = (slide: Slide | null) => {
  const label = String(slide?.label || '').trim().toLowerCase();
  return !label || label === 'new slide' || label === 'slide';
};

const isMostlyDefaultTextLayout = (slide: Slide | null, item: ServiceItem | null) => {
  if (!slide) return true;
  const elements = getRenderableElements(slide, item).filter((element) => element.type === 'text');
  if (!elements.length) return true;
  const normalized = elements.map((element) => String(element.content || '').trim().toLowerCase());
  const defaults = new Set([
    'your text here',
    'slide title',
    'main content goes here',
    'left content',
    'right content',
    'offering',
    'building project',
    'bank details or giving prompt',
    'special project details',
    'church announcement',
    'event details go here',
    'speaker name',
    'senior pastor',
    'main slide content',
    'optional corner note',
    '"for god so loved the world..."',
    'john 3:16',
  ]);
  return normalized.every((value) => defaults.has(value));
};

export const SmartSlideEditor: React.FC<SmartSlideEditorProps> = ({
  isOpen,
  item,
  mode = 'add',
  initialSlideId,
  onClose,
  onSaveSlides,
  onImportPowerPointVisual,
  onImportPowerPointText,
  workspaceId,
  user,
}) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<SlideEditorTool>('select');
  const [showGrid, setShowGrid] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pptxError, setPptxError] = useState<string | null>(null);
  const [pptxStatus, setPptxStatus] = useState('');
  const [isImportingPptx, setIsImportingPptx] = useState(false);
  const [pendingAsyncTaskCount, setPendingAsyncTaskCount] = useState(0);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [slideClipboard, setSlideClipboard] = useState<Slide | null>(() => readStoredSlideClipboard());
  const [editorNotice, setEditorNotice] = useState('');
  const [presetsCollapsed, setPresetsCollapsed] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const folderUploadRef = useRef<HTMLInputElement | null>(null);
  const pptxVisualRef = useRef<HTMLInputElement | null>(null);
  const pptxTextRef = useRef<HTMLInputElement | null>(null);
  const pendingAsyncTaskCountRef = useRef(0);

  useEffect(() => {
    if (!isOpen || !item) return;
    const existingSlides = item.slides.map((slide) => buildStructuredSlide(cloneSlide(slide), item));
    let nextSlides = existingSlides;
    let nextCurrentSlideId = initialSlideId || existingSlides[0]?.id || null;
    let nextSelectedElementId: string | null = null;

    if (mode === 'add' || !existingSlides.length) {
      const draftSlide = createEmptySlide(item, getLayoutPreset('single'));
      nextSlides = [...existingSlides, draftSlide];
      nextCurrentSlideId = draftSlide.id;
      nextSelectedElementId = draftSlide.elements?.[0]?.id || null;
    }

    setSlides(nextSlides);
    setCurrentSlideId(nextCurrentSlideId);
    setSelectedElementId(nextSelectedElementId);
    setActiveTool('select');
    setUploadError(null);
    setPptxError(null);
    setPptxStatus('');
    setEditorNotice('');
    setPresetsCollapsed(window.innerWidth < 1500 || window.innerHeight < 860);
    pendingAsyncTaskCountRef.current = 0;
    setPendingAsyncTaskCount(0);
  }, [isOpen, item, initialSlideId, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentSlide = useMemo(() => slides.find((slide) => slide.id === currentSlideId) || null, [slides, currentSlideId]);
  const selectedElement = useMemo(() => {
    const elements = currentSlide ? getRenderableElements(currentSlide, item) : [];
    return elements.find((element) => element.id === selectedElementId) || null;
  }, [currentSlide, selectedElementId, item]);

  const shouldStackInspector = viewport.width < 1180;
  const presetsColumnWidth = presetsCollapsed ? '3.5rem' : viewport.width < 1440 ? '11rem' : '13rem';
  const slidesColumnWidth = viewport.width < 1440 ? '7rem' : '7.5rem';
  const inspectorColumnWidth = viewport.width < 1440 ? '17rem' : '18.5rem';

  useEffect(() => {
    if (!currentSlide) {
      setSelectedElementId(null);
      return;
    }
    const nextSelectedId = getPrimaryEditableElementId(currentSlide, item);
    if (!nextSelectedId) {
      setSelectedElementId(null);
      return;
    }
    const stillExists = getRenderableElements(currentSlide, item).some((element) => element.id === selectedElementId);
    if (!selectedElementId || !stillExists) {
      setSelectedElementId(nextSelectedId);
    }
  }, [currentSlide, item, selectedElementId]);

  useEffect(() => {
    if (!editorNotice) return;
    const timeoutId = window.setTimeout(() => setEditorNotice(''), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [editorNotice]);

  const updateSlides = (updater: (current: Slide[]) => Slide[]) => setSlides((current) => updater(current).map((slide) => buildStructuredSlide(slide, item)));
  const updateCurrentSlide = (updater: (slide: Slide) => Slide) => {
    if (!currentSlideId) return;
    updateSlides((current) => current.map((slide) => slide.id === currentSlideId ? updater(slide) : slide));
  };

  const activateSlide = (nextSlide: Slide | null) => {
    setCurrentSlideId(nextSlide?.id || null);
    setSelectedElementId(getPrimaryEditableElementId(nextSlide, item));
  };

  const storeSlideClipboard = (slide: Slide | null) => {
    setSlideClipboard(slide ? cloneSlide(slide) : null);
    writeStoredSlideClipboard(slide);
  };

  const insertSlideAfter = (source: Slide, afterSlideId: string | null, notice: string) => {
    const nextSlide = buildStructuredSlide({
      ...cloneSlide(source),
      id: createSlideId(),
      label: createDuplicateLabel(source.label),
    }, item);
    setSlides((current) => {
      const index = afterSlideId ? current.findIndex((entry) => entry.id === afterSlideId) : -1;
      const next = [...current];
      if (index < 0) {
        next.push(nextSlide);
      } else {
        next.splice(index + 1, 0, nextSlide);
      }
      return next;
    });
    activateSlide(nextSlide);
    setEditorNotice(notice);
  };

  const updateElement = (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      elements: getRenderableElements(slide, item).map((element) => {
        if (element.id !== elementId || element.type !== 'text') return element;
        return updater({ ...element });
      }),
    }));
  };

  const persistUploadedMedia = async (file: File) => {
    const safeWorkspaceId = String(workspaceId || '').trim();
    if (safeWorkspaceId && user?.uid) {
      const uploaded = await uploadWorkspaceMedia(safeWorkspaceId, user, file);
      const sharedUrl = String(uploaded?.url || '').trim();
      if (uploaded?.ok && sharedUrl) return sharedUrl;
    }
    return saveMedia(file);
  };

  const beginAsyncTask = () => {
    pendingAsyncTaskCountRef.current += 1;
    setPendingAsyncTaskCount(pendingAsyncTaskCountRef.current);
  };

  const endAsyncTask = () => {
    pendingAsyncTaskCountRef.current = Math.max(0, pendingAsyncTaskCountRef.current - 1);
    setPendingAsyncTaskCount(pendingAsyncTaskCountRef.current);
  };

  const addSlideFromPreset = (presetId?: string) => {
    if (!item) return;
    const preset = getLayoutPreset(presetId || currentSlide?.layoutType || 'single');
    const nextSlide = createEmptySlide(item, preset);
    setSlides((current) => [...current, nextSlide]);
    activateSlide(nextSlide);
    setEditorNotice('New slide added.');
  };

  const handleCopySlide = (slideId: string) => {
    const source = slides.find((slide) => slide.id === slideId);
    if (!source) return;
    storeSlideClipboard(source);
    setEditorNotice(`Copied "${source.label || 'Slide'}".`);
  };

  const handlePasteSlide = (afterSlideId: string | null = currentSlideId) => {
    const source = slideClipboard || readStoredSlideClipboard();
    if (!source) {
      setEditorNotice('Copy a slide first.');
      return;
    }
    if (!slideClipboard) {
      setSlideClipboard(source);
    }
    insertSlideAfter(source, afterSlideId, 'Slide pasted.');
  };

  const handleDuplicateSlide = (slideId: string) => {
    const source = slides.find((slide) => slide.id === slideId);
    if (!source) return;
    insertSlideAfter(source, slideId, 'Slide duplicated.');
  };

  const handleDeleteSlide = (slideId: string) => {
    if (slides.length <= 1) return;
    const deletedIndex = slides.findIndex((slide) => slide.id === slideId);
    const nextSlides = slides.filter((slide) => slide.id !== slideId);
    setSlides(nextSlides);
    if (currentSlideId === slideId) {
      const nextActive = nextSlides[Math.min(deletedIndex, nextSlides.length - 1)] || null;
      activateSlide(nextActive);
    }
    setEditorNotice('Slide deleted.');
  };

  const handleMoveSlide = (slideId: string, direction: -1 | 1) => {
    setSlides((current) => {
      const index = current.findIndex((entry) => entry.id === slideId);
      if (index < 0) return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleAddTextBlock = () => {
    if (!currentSlide) return;
    const nextElement = createTextElement({
      name: 'Text Block',
      role: 'body',
      content: 'New text block',
      frame: { x: 0.18, y: 0.3, width: 0.64, height: 0.12, zIndex: getRenderableElements(currentSlide, item).length + 1 },
      item,
      style: { fontSize: 30 },
    });
    updateCurrentSlide((slide) => ({ ...slide, elements: [...getRenderableElements(slide, item), nextElement] }));
    setSelectedElementId(nextElement.id);
    setActiveTool('select');
  };

  const handleDuplicateElement = () => {
    if (!selectedElement || !currentSlide) return;
    const duplicatedSource = JSON.parse(JSON.stringify(selectedElement)) as SlideElement;
    const duplicate: SlideElement = {
      ...duplicatedSource,
      id: createSlideId(),
      name: `${selectedElement.name} Copy`,
      frame: {
        ...selectedElement.frame,
        x: Math.min(0.9 - selectedElement.frame.width, selectedElement.frame.x + 0.03),
        y: Math.min(0.9 - selectedElement.frame.height, selectedElement.frame.y + 0.03),
        zIndex: getRenderableElements(currentSlide, item).length + 1,
      },
    } as SlideElement;
    updateCurrentSlide((slide) => ({ ...slide, elements: [...getRenderableElements(slide, item), duplicate] }));
    setSelectedElementId(duplicate.id);
  };

  const handleDeleteElement = () => {
    if (!selectedElement) return;
    updateCurrentSlide((slide) => ({ ...slide, elements: getRenderableElements(slide, item).filter((element) => element.id !== selectedElement.id) }));
    setSelectedElementId(null);
  };

  const handleToggleLock = () => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    updateElement(selectedElement.id, (current) => ({ ...current, locked: !current.locked }));
  };

  const handleToggleVisibility = () => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    updateElement(selectedElement.id, (current) => ({ ...current, visible: !current.visible }));
  };

  const handleBringForward = () => {
    if (!selectedElement || !currentSlide) return;
    updateCurrentSlide((slide) => ({ ...slide, elements: bringElementForward(getRenderableElements(slide, item), selectedElement.id) }));
  };

  const handleSendBackward = () => {
    if (!selectedElement || !currentSlide) return;
    updateCurrentSlide((slide) => ({ ...slide, elements: sendElementBackward(getRenderableElements(slide, item), selectedElement.id) }));
  };

  const handleAlign = (mode: 'left' | 'center' | 'right') => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    updateElement(selectedElement.id, (current) => {
      const width = current.frame.width;
      const nextX = mode === 'left' ? 0.06 : mode === 'right' ? 0.94 - width : 0.5 - (width / 2);
      return { ...current, frame: { ...current.frame, x: nextX }, style: { ...current.style, textAlign: mode } };
    });
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = getLayoutPreset(presetId);
    if (!currentSlide) return;
    const hasBlocks = getRenderableElements(currentSlide, item).length > 0 || String(currentSlide.content || '').trim().length > 0;
    const needsConfirm = hasBlocks && !isDefaultSingleDraft(currentSlide, item) && currentSlide.layoutType !== preset.id && !isMostlyDefaultTextLayout(currentSlide, item);
    if (needsConfirm && !window.confirm(`Replace current layout with ${preset.label}?`)) return;
    const nextElements = preset.createElements();
    updateCurrentSlide((slide) => ({
      ...slide,
      type: preset.defaultSlideType,
      layoutType: preset.id,
      elements: nextElements,
      content: summarizeElementsToLegacyContent(nextElements),
    }));
    setSelectedElementId(nextElements[0]?.id || null);
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const MAX_FILE_SIZE_MB = 100;
    const MAX_FILE_COUNT = 50;
    const ALLOWED_TYPES = /^(image\/(jpeg|png|gif|webp|svg\+xml|bmp|avif)|video\/(mp4|webm|quicktime|x-msvideo|x-matroska))$/i;

    const rawFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (!rawFiles.length || !item) return;
    setUploadError(null);

    // Filter to supported media types only
    const supported = rawFiles.filter(f => ALLOWED_TYPES.test(f.type));
    const skippedCount = rawFiles.length - supported.length;

    if (supported.length === 0) {
      setUploadError(`No supported media files found. Accepted: images (JPG, PNG, GIF, WebP, SVG, AVIF) and videos (MP4, WebM, MOV, AVI, MKV).${skippedCount > 0 ? ` ${skippedCount} file(s) skipped.` : ''}`);
      return;
    }

    // Enforce file count limit
    const files = supported.slice(0, MAX_FILE_COUNT);
    const truncatedCount = supported.length - files.length;

    // Check individual file sizes
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      const names = oversized.slice(0, 3).map(f => `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)}MB)`).join(', ');
      setUploadError(`${oversized.length} file(s) exceed ${MAX_FILE_SIZE_MB}MB limit: ${names}${oversized.length > 3 ? '...' : ''}`);
      return;
    }

    const warnings: string[] = [];
    if (skippedCount > 0) warnings.push(`${skippedCount} unsupported file(s) skipped`);
    if (truncatedCount > 0) warnings.push(`limited to first ${MAX_FILE_COUNT} files (${truncatedCount} extra skipped)`);

    beginAsyncTask();
    setIsUploading(true);
    try {
      if (files.length > 1) {
        const uploadedSlides: Slide[] = [];
        for (const [index, file] of files.entries()) {
          const url = await persistUploadedMedia(file);
          uploadedSlides.push(createMediaOnlySlide(item, file.name.replace(/\.[^.]+$/, '') || `Slide ${index + 1}`, url, file.type.startsWith('video/') ? 'video' : 'image'));
        }
        setSlides((current) => [...current, ...uploadedSlides]);
        const firstUploaded = uploadedSlides[0] || null;
        setCurrentSlideId(firstUploaded?.id || currentSlideId);
        setSelectedElementId(null);
        if (warnings.length > 0) setUploadError(warnings.join('. ') + '.');
      } else {
        const file = files[0];
        const url = await persistUploadedMedia(file);
        updateCurrentSlide((slide) => ({
          ...slide,
          backgroundUrl: url,
          mediaType: file.type.startsWith('video/') ? 'video' : 'image',
          mediaFit: file.type.startsWith('video/') ? 'cover' : 'contain',
          label: hasGenericSlideLabel(slide) ? file.name.replace(/\.[^.]+$/, '') : slide.label,
          layoutType: slide.layoutType === 'media' || isMostlyDefaultTextLayout(slide, item) ? 'media' : slide.layoutType,
          elements: slide.layoutType === 'media' || isMostlyDefaultTextLayout(slide, item) ? [] : getRenderableElements(slide, item),
          content: slide.layoutType === 'media' || isMostlyDefaultTextLayout(slide, item) ? '' : slide.content,
        }));
        if (!currentSlide || currentSlide.layoutType === 'media' || isMostlyDefaultTextLayout(currentSlide, item)) {
          setSelectedElementId(null);
        }
      }
    } catch (error) {
      console.error(error);
      setUploadError('Failed to save media.');
    } finally {
      setIsUploading(false);
      endAsyncTask();
    }
  };

  const handlePowerPointImport = async (event: React.ChangeEvent<HTMLInputElement>, mode: 'visual' | 'text') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !item) return;
    const importer = mode === 'visual' ? onImportPowerPointVisual : onImportPowerPointText;
    if (!importer) return;
    setPptxError(null);
    setPptxStatus(mode === 'visual' ? 'Importing PowerPoint visuals...' : 'Importing PowerPoint text...');
    beginAsyncTask();
    setIsImportingPptx(true);
    try {
      const importedSlides = await importer(file);
      const structuredSlides = importedSlides.map((slide) => buildStructuredSlide(cloneSlide(slide), item));
      setSlides((current) => [...current, ...structuredSlides]);
      const firstImported = structuredSlides[0] || null;
      activateSlide(firstImported);
      setPptxStatus(`${structuredSlides.length} slide(s) imported.`);
    } catch (error: any) {
      setPptxError(error?.message || 'PowerPoint import failed.');
      setPptxStatus('');
    } finally {
      setIsImportingPptx(false);
      endAsyncTask();
    }
  };

  useEffect(() => {
    if (!isOpen || !currentSlide || !selectedElement || selectedElement.type !== 'text') return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const delta = event.shiftKey ? 0.01 : 0.0025;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (!selectedElement.locked) handleDeleteElement();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedElementId(null);
        return;
      }
      const movement = event.key === 'ArrowLeft' ? [-delta, 0] : event.key === 'ArrowRight' ? [delta, 0] : event.key === 'ArrowUp' ? [0, -delta] : event.key === 'ArrowDown' ? [0, delta] : null;
      if (!movement || selectedElement.locked) return;
      event.preventDefault();
      updateElement(selectedElement.id, (current) => ({
        ...current,
        frame: {
          ...current.frame,
          x: Math.max(0, Math.min(1 - current.frame.width, current.frame.x + movement[0])),
          y: Math.max(0, Math.min(1 - current.frame.height, current.frame.y + movement[1])),
        },
      }));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSlide, isOpen, selectedElement]);

  useEffect(() => {
    if (!isOpen || !currentSlide) return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const shortcut = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (shortcut && key === 'c') {
        event.preventDefault();
        handleCopySlide(currentSlide.id);
        return;
      }
      if (shortcut && key === 'v') {
        event.preventDefault();
        handlePasteSlide(currentSlide.id);
        return;
      }
      if (shortcut && key === 'd') {
        event.preventDefault();
        handleDuplicateSlide(currentSlide.id);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !selectedElement) {
        event.preventDefault();
        handleDeleteSlide(currentSlide.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSlide, isOpen, selectedElement, slideClipboard, slides]);

  if (!isOpen || !item) return null;

  const editorBusy = isUploading || isImportingPptx || pendingAsyncTaskCount > 0;
  const handleRequestClose = () => {
    if (pendingAsyncTaskCountRef.current > 0) return;
    onClose();
  };
  const handleConfirmSave = () => {
    if (pendingAsyncTaskCountRef.current > 0) return;
    onSaveSlides(slides.map((slide) => buildStructuredSlide(slide, item)), currentSlideId);
  };

  const presetsColumn = (
    <aside className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-[#05070e]">
      <div className="border-b border-zinc-800 px-2 py-3">
        <div className={`rounded-xl border border-zinc-800 bg-zinc-950/80 ${presetsCollapsed ? 'flex items-center justify-center px-2 py-2' : 'flex items-center justify-between gap-2 px-3 py-2.5'}`}>
          {!presetsCollapsed ? (
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Layout Presets</div>
          ) : null}
          <button
            type="button"
            data-testid="smart-presets-toggle"
            onClick={() => setPresetsCollapsed((current) => !current)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-[10px] font-bold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            title={presetsCollapsed ? 'Expand presets' : 'Collapse presets'}
            aria-label={presetsCollapsed ? 'Expand layout presets' : 'Collapse layout presets'}
          >
            {presetsCollapsed ? '>' : '<'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {layoutPresets.map((preset) => {
          const active = (currentSlide?.layoutType || 'single') === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`smart-preset-${preset.id}`}
              onClick={() => handleApplyPreset(preset.id)}
              className={`w-full rounded-xl border ${presetsCollapsed ? 'px-2 py-3 text-center' : 'px-3 py-3'} text-left transition-colors ${active ? 'border-blue-500 bg-blue-950/35 text-blue-100' : 'border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900'}`}
              title={preset.label}
            >
              {presetsCollapsed ? (
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">{preset.label.split(' ').map((part) => part[0]).join('').slice(0, 3)}</div>
              ) : (
                <>
                  <div className="text-sm font-bold">{preset.label}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-blue-300' : 'text-zinc-500'}`}>
                    {preset.description || `Apply ${preset.label.toLowerCase()} layout`}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );

  const canvasAndToolbar = (
    <div className="relative z-0 flex min-w-0 min-h-0 flex-col overflow-hidden bg-zinc-950" data-testid="smart-editor-canvas-shell">
      <div className="border-b border-zinc-800 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[12rem]">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Canvas</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-zinc-100">{currentSlide?.label || 'New Slide'}</div>
              <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                {getLayoutPreset(currentSlide?.layoutType || 'single').label}
              </span>
            </div>
          </div>
          <EditorToolbar
            canActOnSlide={!!currentSlide}
            canDeleteSlide={slides.length > 1}
            canPasteSlide={!!slideClipboard}
            canActOnElement={!!selectedElement}
            activeTool={activeTool}
            onSetTool={setActiveTool}
            onCopySlide={() => currentSlide && handleCopySlide(currentSlide.id)}
            onPasteSlide={() => handlePasteSlide(currentSlideId)}
            onDuplicateSlide={() => currentSlide && handleDuplicateSlide(currentSlide.id)}
            onDeleteSlide={() => currentSlide && handleDeleteSlide(currentSlide.id)}
            onAddText={handleAddTextBlock}
            onDuplicateElement={handleDuplicateElement}
            onDeleteElement={handleDeleteElement}
            onToggleLock={handleToggleLock}
            onToggleVisibility={handleToggleVisibility}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onAlign={handleAlign}
            showGrid={showGrid}
            showSafeArea={showSafeArea}
            onToggleGrid={() => setShowGrid((current) => !current)}
            onToggleSafeArea={() => setShowSafeArea((current) => !current)}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div className="min-h-0 flex-1">
          <SlideCanvas
            slide={currentSlide}
            item={item}
            selectedElementId={selectedElementId}
            showGrid={showGrid}
            showSafeArea={showSafeArea}
            onSelectElement={setSelectedElementId}
            onUpdateSlide={updateCurrentSlide}
          />
        </div>
      </div>
      <div className="border-t border-zinc-800 bg-[#060810] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {currentSlide?.elements?.length ? (
              <button type="button" onClick={() => updateCurrentSlide((slide) => ({ ...slide, elements: [], content: '', layoutType: 'media' }))} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 hover:border-zinc-500">
                Clear Text Blocks
              </button>
            ) : (
              <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Slide fits to screen automatically.</div>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {Math.max(1, slides.findIndex((slide) => slide.id === currentSlideId) + 1)} / {slides.length} slide(s)
          </div>
        </div>
      </div>
    </div>
  );

  const editorShell = (
    <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm">
      <input ref={uploadRef} type="file" className="hidden" multiple accept="image/*,video/*" data-testid="slide-editor-upload-input" onChange={handleBackgroundUpload} />
      {/* @ts-expect-error webkitdirectory is a non-standard attribute */}
      <input ref={folderUploadRef} type="file" className="hidden" multiple accept="image/*,video/*" webkitdirectory="" onChange={handleBackgroundUpload} data-testid="slide-editor-folder-upload-input" />
      <input ref={pptxVisualRef} type="file" className="hidden" accept=".pptx,.ppt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" onChange={(event) => handlePowerPointImport(event, 'visual')} />
      <input ref={pptxTextRef} type="file" className="hidden" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" onChange={(event) => handlePowerPointImport(event, 'text')} />
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-4">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.24em] text-zinc-100">{mode === 'edit' ? 'Edit Slide' : 'Add New Slide'}</div>
            <div className="mt-1 text-xs text-zinc-500">Smart Layout Slide Editor</div>
          </div>
          <div className="flex items-center gap-2">
            {uploadError && <span className="text-xs text-rose-300">{uploadError}</span>}
            {pptxError && <span className="text-xs text-rose-300">{pptxError}</span>}
            {pptxStatus && <span className="text-xs text-cyan-300">{pptxStatus}</span>}
            {editorNotice && <span className="text-xs text-cyan-300">{editorNotice}</span>}
            {editorBusy && <span className="text-xs text-zinc-500">WORKING...</span>}
            <button type="button" onClick={handleRequestClose} disabled={editorBusy} className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40">ESC</button>
            <button type="button" data-testid="slide-editor-confirm" onClick={handleConfirmSave} disabled={editorBusy} className="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:border-blue-900 disabled:bg-blue-950 disabled:text-blue-300/70">SAVE</button>
          </div>
        </div>

        {shouldStackInspector ? (
          <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: `${presetsColumnWidth} ${slidesColumnWidth} minmax(0,1fr)` }}>
            <div className="min-h-0">{presetsColumn}</div>
            <div className="min-h-0">
              <SlideThumbnailsPanel
                item={item}
                slides={slides}
                activeSlideId={currentSlideId}
                canPasteSlide={!!slideClipboard}
                onSelectSlide={(slideId) => {
                  const nextSlide = slides.find((slide) => slide.id === slideId) || null;
                  activateSlide(nextSlide);
                }}
                onAddSlide={() => addSlideFromPreset(currentSlide?.layoutType || 'single')}
                onCopySlide={handleCopySlide}
                onPasteSlide={handlePasteSlide}
                onDuplicateSlide={handleDuplicateSlide}
                onDeleteSlide={handleDeleteSlide}
                onMoveSlide={handleMoveSlide}
                rail
              />
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">{canvasAndToolbar}</div>
              <div className="relative z-20 h-[clamp(16rem,28vh,22rem)] shrink-0 overflow-hidden border-t border-zinc-800 bg-zinc-950" data-testid="smart-editor-inspector-shell">
                <InspectorPanel
                  slide={currentSlide}
                  selectedElement={selectedElement}
                  presets={layoutPresets}
                  onUpdateSlide={updateCurrentSlide}
                  onUpdateElement={updateElement}
                  onApplyPreset={handleApplyPreset}
                  onTriggerUpload={() => uploadRef.current?.click()}
                  onTriggerFolderUpload={() => folderUploadRef.current?.click()}
                  onTriggerPptxVisual={() => pptxVisualRef.current?.click()}
                  onTriggerPptxText={() => pptxTextRef.current?.click()}
                  onClearBackground={() => updateCurrentSlide((slide) => ({ ...slide, backgroundUrl: '', mediaType: 'image', mediaFit: 'cover' }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: `${presetsColumnWidth} ${slidesColumnWidth} minmax(0,1fr) ${inspectorColumnWidth}` }}>
            {presetsColumn}
            <SlideThumbnailsPanel
              item={item}
              slides={slides}
              activeSlideId={currentSlideId}
              canPasteSlide={!!slideClipboard}
              onSelectSlide={(slideId) => {
                const nextSlide = slides.find((slide) => slide.id === slideId) || null;
                activateSlide(nextSlide);
              }}
              onAddSlide={() => addSlideFromPreset(currentSlide?.layoutType || 'single')}
              onCopySlide={handleCopySlide}
              onPasteSlide={handlePasteSlide}
              onDuplicateSlide={handleDuplicateSlide}
              onDeleteSlide={handleDeleteSlide}
              onMoveSlide={handleMoveSlide}
              rail
            />
            {canvasAndToolbar}
            <InspectorPanel
              slide={currentSlide}
              selectedElement={selectedElement}
              presets={layoutPresets}
              onUpdateSlide={updateCurrentSlide}
              onUpdateElement={updateElement}
              onApplyPreset={handleApplyPreset}
              onTriggerUpload={() => uploadRef.current?.click()}
              onTriggerFolderUpload={() => folderUploadRef.current?.click()}
              onTriggerPptxVisual={() => pptxVisualRef.current?.click()}
              onTriggerPptxText={() => pptxTextRef.current?.click()}
              onClearBackground={() => updateCurrentSlide((slide) => ({ ...slide, backgroundUrl: '', mediaType: 'image', mediaFit: 'cover' }))}
            />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(editorShell, document.body);
};
