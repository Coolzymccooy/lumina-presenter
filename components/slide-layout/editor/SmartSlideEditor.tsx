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
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [presetsCollapsed, setPresetsCollapsed] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const pptxVisualRef = useRef<HTMLInputElement | null>(null);
  const pptxTextRef = useRef<HTMLInputElement | null>(null);

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

  const shouldStackInspector = viewport.width < 1360 || (viewport.width < 1500 && viewport.height < 860);
  const canvasMaxWidthStyle = { maxWidth: shouldStackInspector ? 840 : 1040 };
  const presetsColumnWidth = presetsCollapsed ? '3.75rem' : '14rem';

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

  const updateSlides = (updater: (current: Slide[]) => Slide[]) => setSlides((current) => updater(current).map((slide) => buildStructuredSlide(slide, item)));
  const updateCurrentSlide = (updater: (slide: Slide) => Slide) => {
    if (!currentSlideId) return;
    updateSlides((current) => current.map((slide) => slide.id === currentSlideId ? updater(slide) : slide));
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

  const addSlideFromPreset = (presetId?: string) => {
    if (!item) return;
    const preset = getLayoutPreset(presetId || currentSlide?.layoutType || 'single');
    const nextSlide = createEmptySlide(item, preset);
    setSlides((current) => [...current, nextSlide]);
    setCurrentSlideId(nextSlide.id);
    setSelectedElementId(nextSlide.elements?.[0]?.id || null);
  };

  const handleDuplicateSlide = (slideId: string) => {
    const source = slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const duplicated = buildStructuredSlide({ ...cloneSlide(source), id: createSlideId(), label: `${source.label || 'Slide'} Copy` }, item);
    setSlides((current) => {
      const index = current.findIndex((entry) => entry.id === slideId);
      const next = [...current];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const handleDeleteSlide = (slideId: string) => {
    if (slides.length <= 1) return;
    const nextSlides = slides.filter((slide) => slide.id !== slideId);
    setSlides(nextSlides);
    if (currentSlideId === slideId) {
      const nextActive = nextSlides[0] || null;
      setCurrentSlideId(nextActive?.id || null);
      setSelectedElementId(getPrimaryEditableElementId(nextActive, item));
    }
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
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !item) return;
    setUploadError(null);
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
    setIsImportingPptx(true);
    try {
      const importedSlides = await importer(file);
      const structuredSlides = importedSlides.map((slide) => buildStructuredSlide(cloneSlide(slide), item));
      setSlides((current) => [...current, ...structuredSlides]);
      const firstImported = structuredSlides[0] || null;
      setCurrentSlideId(firstImported?.id || currentSlideId);
      setSelectedElementId(getPrimaryEditableElementId(firstImported, item));
      setPptxStatus(`${structuredSlides.length} slide(s) imported.`);
    } catch (error: any) {
      setPptxError(error?.message || 'PowerPoint import failed.');
      setPptxStatus('');
    } finally {
      setIsImportingPptx(false);
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

  if (!isOpen || !item) return null;

  const presetsColumn = (
    <aside className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-[#05070e]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-4">
        {!presetsCollapsed ? (
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Layout Presets</div>
        ) : (
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">LP</div>
        )}
        <button
          type="button"
          data-testid="smart-presets-toggle"
          onClick={() => setPresetsCollapsed((current) => !current)}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:text-white"
          title={presetsCollapsed ? 'Expand presets' : 'Collapse presets'}
        >
          {presetsCollapsed ? '>' : '<'}
        </button>
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
      <div className="border-b border-zinc-800 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <EditorToolbar
            canActOnElement={!!selectedElement}
            activeTool={activeTool}
            onSetTool={setActiveTool}
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
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto w-full space-y-3 xl:space-y-4" style={canvasMaxWidthStyle}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Canvas</div>
              <div className="mt-1 text-sm text-zinc-200">{currentSlide?.label || 'New Slide'}</div>
            </div>
            <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Layout</span>
              <span className="rounded bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100">{getLayoutPreset(currentSlide?.layoutType || 'single').label}</span>
            </div>
          </div>
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
      <div className="border-t border-zinc-800 bg-[#060810] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleAddTextBlock} className="inline-flex items-center gap-3 text-sm font-bold text-zinc-200 hover:text-white">
              <span className="text-xl leading-none text-blue-400">+</span>
              ADD TEXT BLOCK
            </button>
            {currentSlide?.elements?.length ? (
              <button type="button" onClick={() => updateCurrentSlide((slide) => ({ ...slide, elements: [], content: '', layoutType: 'media' }))} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300 hover:border-zinc-500">
                Clear Text Blocks
              </button>
            ) : null}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{slides.length} slide(s)</div>
        </div>
      </div>
    </div>
  );

  const editorShell = (
    <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm">
      <input ref={uploadRef} type="file" className="hidden" multiple accept="image/*,video/*" data-testid="slide-editor-upload-input" onChange={handleBackgroundUpload} />
      <input ref={pptxVisualRef} type="file" className="hidden" accept=".pptx,.ppt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" onChange={(event) => handlePowerPointImport(event, 'visual')} />
      <input ref={pptxTextRef} type="file" className="hidden" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" onChange={(event) => handlePowerPointImport(event, 'text')} />
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-4">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.24em] text-zinc-100">{mode === 'edit' ? 'Edit Slide' : 'Add New Slide'}</div>
            <div className="mt-1 text-xs text-zinc-500">Smart Layout Slide Editor</div>
          </div>
          <div className="flex items-center gap-2">
            {uploadError && <span className="text-xs text-rose-300">{uploadError}</span>}
            {pptxError && <span className="text-xs text-rose-300">{pptxError}</span>}
            {pptxStatus && <span className="text-xs text-cyan-300">{pptxStatus}</span>}
            {(isUploading || isImportingPptx) && <span className="text-xs text-zinc-500">WORKING...</span>}
            <button type="button" onClick={onClose} className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300">ESC</button>
            <button type="button" data-testid="slide-editor-confirm" onClick={() => onSaveSlides(slides.map((slide) => buildStructuredSlide(slide, item)), currentSlideId)} className="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-xs font-bold text-white">SAVE</button>
          </div>
        </div>

        {shouldStackInspector ? (
          <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: `${presetsColumnWidth} 6.5rem minmax(0,1fr)` }}>
            <div className="min-h-0">{presetsColumn}</div>
            <div className="min-h-0">
              <SlideThumbnailsPanel
                item={item}
                slides={slides}
                activeSlideId={currentSlideId}
                onSelectSlide={(slideId) => {
                  const nextSlide = slides.find((slide) => slide.id === slideId) || null;
                  setCurrentSlideId(slideId);
                  setSelectedElementId(getPrimaryEditableElementId(nextSlide, item));
                }}
                onAddSlide={() => addSlideFromPreset(currentSlide?.layoutType || 'single')}
                onDuplicateSlide={handleDuplicateSlide}
                onDeleteSlide={handleDeleteSlide}
                onMoveSlide={handleMoveSlide}
                rail
              />
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">{canvasAndToolbar}</div>
              <div className="relative z-20 h-[clamp(22rem,38vh,28rem)] shrink-0 overflow-hidden border-t border-zinc-800 bg-zinc-950" data-testid="smart-editor-inspector-shell">
                <InspectorPanel
                  slide={currentSlide}
                  selectedElement={selectedElement}
                  presets={layoutPresets}
                  onUpdateSlide={updateCurrentSlide}
                  onUpdateElement={updateElement}
                  onApplyPreset={handleApplyPreset}
                  onTriggerUpload={() => uploadRef.current?.click()}
                  onTriggerPptxVisual={() => pptxVisualRef.current?.click()}
                  onTriggerPptxText={() => pptxTextRef.current?.click()}
                  onClearBackground={() => updateCurrentSlide((slide) => ({ ...slide, backgroundUrl: '', mediaType: 'image', mediaFit: 'cover' }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: `${presetsColumnWidth} 6.5rem minmax(0,1fr) 20rem` }}>
            {presetsColumn}
            <SlideThumbnailsPanel
              item={item}
              slides={slides}
              activeSlideId={currentSlideId}
              onSelectSlide={(slideId) => {
                const nextSlide = slides.find((slide) => slide.id === slideId) || null;
                setCurrentSlideId(slideId);
                setSelectedElementId(getPrimaryEditableElementId(nextSlide, item));
              }}
              onAddSlide={() => addSlideFromPreset(currentSlide?.layoutType || 'single')}
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
