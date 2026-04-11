import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SlideRenderer } from '../SlideRenderer';
import { RichTextEditor } from '../RichTextEditor';
import { hydrateLegacySlideElements } from '../slide-layout/utils/slideHydration';
import type { ServiceItem, Slide, TextElementStyle } from '../../types';

interface BuilderPreviewPanelProps {
  item: ServiceItem;
  onUpdate: (item: ServiceItem) => void;
  onOpenSlideEditor: (slide: Slide) => void;
  onDeleteSlide: (slideId: string, e: React.MouseEvent) => void;
  onAddSlide: () => void;
  onStartLabelRename: (itemId: string, slideId: string, currentLabel: string, source?: 'runsheet' | 'thumbnail') => void;
  inlineSlideRename: { slideId: string; value: string; source: string } | null;
  inlineSlideRenameInputRef: React.RefObject<HTMLInputElement | null>;
  onInlineRenameChange: (value: string) => void;
  onInlineRenameCommit: (itemId: string, slideId: string, value: string) => void;
  onGoLive?: (item: ServiceItem, slideIdx: number) => void;
}

function getBodyStyle(slide: Slide): Partial<TextElementStyle> {
  const el = slide.elements?.find(e => e.type === 'text' && (e.role === 'body' || e.name === 'Body'));
  return el?.style ?? {};
}

function applyBodyStyle(slide: Slide, item: ServiceItem, patch: Partial<TextElementStyle>): Slide {
  const elements = slide.elements && slide.elements.length > 0
    ? slide.elements
    : hydrateLegacySlideElements(slide, item);
  return {
    ...slide,
    elements: elements.map(el => {
      if (el.type !== 'text') return el;
      if (el.role === 'body' || el.name === 'Body' || (!el.role && elements.length === 1)) {
        return { ...el, style: { ...el.style, ...patch } };
      }
      return el;
    }),
  };
}

// Sync text content into both slide.content AND any body element in elements[]
function applyContentChange(slide: Slide, newContent: string): Slide {
  const updatedSlide: Slide = { ...slide, content: newContent };
  if (slide.elements && slide.elements.length > 0) {
    updatedSlide.elements = slide.elements.map(el => {
      if (el.type !== 'text') return el;
      const isBody = el.role === 'body' || el.name === 'Body' || (!el.role && slide.elements!.length === 1);
      return isBody ? { ...el, content: newContent } : el;
    });
  }
  return updatedSlide;
}

const makeSlideId = () => `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Returns the HTML/text content to show in the editor for this slide */
function getEditorContent(slide: Slide): string {
  const bodyEl = slide.elements?.find(
    el => el.type === 'text' && (el.role === 'body' || el.name === 'Body'),
  );
  return bodyEl?.content ?? slide.content ?? '';
}

function NotesPreview({ text }: { text: string }) {
  const plain = text.trim();
  if (!plain) return null;
  const words = plain.split(/\s+/).slice(0, 8).join(' ');
  return <span className="truncate text-amber-400/70 italic">{words}{plain.split(/\s+/).length > 8 ? '…' : ''}</span>;
}

function isVideoSlide(slide: Slide | null, item: ServiceItem): boolean {
  if (!slide) return false;
  const bgUrl = slide.backgroundUrl || item.theme?.backgroundUrl || '';
  const mediaType = slide.mediaType || item.theme?.mediaType || '';
  return mediaType === 'video' || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(bgUrl) || /youtu\.?be/i.test(bgUrl);
}

export function BuilderPreviewPanel({
  item,
  onUpdate,
  onOpenSlideEditor,
  onDeleteSlide,
  onAddSlide,
  onStartLabelRename,
  inlineSlideRename,
  inlineSlideRenameInputRef,
  onInlineRenameChange,
  onInlineRenameCommit,
  onGoLive,
}: BuilderPreviewPanelProps) {
  const [focusedIdx, setFocusedIdx] = useState<number>(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const focusedSlide = item.slides[focusedIdx] ?? item.slides[0] ?? null;
  const bodyStyle = focusedSlide ? getBodyStyle(focusedSlide) : {};

  // Stable refs so debounced callback always sees latest values without recreating
  const focusedSlideRef = useRef(focusedSlide);
  const itemRef = useRef(item);
  const focusedIdxRef = useRef(focusedIdx);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  focusedSlideRef.current = focusedSlide;
  itemRef.current = item;
  focusedIdxRef.current = focusedIdx;

  // Quick-add a blank slide inline (stays in Builder, no modal)
  const handleQuickAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: makeSlideId(),
      content: '',
      label: `Slide ${item.slides.length + 1}`,
    };
    const newItem = { ...item, slides: [...item.slides, newSlide] };
    onUpdate(newItem);
    setFocusedIdx(item.slides.length);
  }, [item, onUpdate]);

  // Debounced — thumbnails only re-render 200ms after typing stops, not on every keystroke
  const handleContentChange = useCallback((html: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const slide = focusedSlideRef.current;
      const cur = itemRef.current;
      const idx = focusedIdxRef.current;
      if (!slide) return;
      const updated = applyContentChange(slide, html);
      onUpdate({ ...cur, slides: cur.slides.map((s, i) => i === idx ? updated : s) });
    }, 200);
  }, [onUpdate]);

  const applyStyle = useCallback((patch: Partial<TextElementStyle>) => {
    if (!focusedSlide) return;
    const updated = applyBodyStyle(focusedSlide, item, patch);
    onUpdate({ ...item, slides: item.slides.map((s, i) => i === focusedIdx ? updated : s) });
  }, [focusedSlide, focusedIdx, item, onUpdate]);

  const setAlign = (a: 'left' | 'center' | 'right') => applyStyle({ textAlign: a });
  const align = (bodyStyle.textAlign ?? 'center') as 'left' | 'center' | 'right';

  // Focus textarea when notes panel opens
  useEffect(() => {
    if (notesOpen && notesRef.current) {
      notesRef.current.focus();
    }
  }, [notesOpen]);

  // Reset notes panel when switching slides
  useEffect(() => {
    setNotesOpen(false);
  }, [focusedSlide?.id]);

  return (
    <div className="flex-1 flex overflow-hidden min-w-0">
      {/* Left: Slide grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-w-0">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {item.slides.map((slide, idx) => (
            <div
              key={slide.id}
              onClick={() => setFocusedIdx(idx)}
              className={`group relative aspect-video bg-zinc-900 border rounded-sm overflow-hidden cursor-pointer transition-all shadow-lg ${
                focusedIdx === idx
                  ? 'border-blue-500 ring-1 ring-blue-500/40 shadow-blue-900/20'
                  : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="absolute inset-0 pointer-events-none">
                <SlideRenderer slide={slide} item={item} fitContainer={true} isThumbnail={true} />
              </div>

              {focusedIdx === idx && (
                <div className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest z-10">
                  EDIT
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 p-1.5 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent z-10">
                <div className="flex-1 min-w-0">
                  {inlineSlideRename?.slideId === slide.id && inlineSlideRename.source === 'thumbnail' ? (
                    <input
                      ref={inlineSlideRenameInputRef}
                      type="text"
                      value={inlineSlideRename.value}
                      onChange={(e) => onInlineRenameChange(e.target.value)}
                      onBlur={() => onInlineRenameCommit(item.id, slide.id, inlineSlideRename.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onInlineRenameCommit(item.id, slide.id, inlineSlideRename.value)}
                      className="w-full bg-zinc-800 text-[9px] font-mono text-white px-1 rounded outline-none border border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="px-1.5 py-0.5 bg-black/75 border border-zinc-700 rounded text-[9px] font-mono text-zinc-300 truncate">
                      {slide.label || `Slide ${idx + 1}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 z-20 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStartLabelRename(item.id, slide.id, slide.label || `Slide ${idx + 1}`, 'thumbnail'); }}
                  className="p-1 bg-zinc-900/90 border border-zinc-700 rounded-sm hover:text-cyan-300 text-zinc-400"
                  title="Rename"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenSlideEditor(slide); }}
                  className="p-1 bg-zinc-900/90 border border-zinc-700 rounded-sm hover:text-blue-400 text-zinc-400"
                  title="Full editor"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSlide(slide.id, e); }}
                  className="p-1 bg-zinc-900/90 border border-zinc-700 rounded-sm hover:text-red-400 text-zinc-400"
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}

          {/* Add slide — split into Quick Add (inline) + Full Editor */}
          <div className="aspect-video border border-dashed border-zinc-800 rounded-sm overflow-hidden bg-zinc-900/10 flex flex-col">
            <button
              onClick={handleQuickAddSlide}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/60"
              title="Quick add — stays in Builder for fast editing"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="text-[9px] font-black uppercase tracking-widest">Quick Add</span>
            </button>
            <button
              onClick={onAddSlide}
              className="shrink-0 py-1.5 flex items-center justify-center gap-1 text-zinc-700 hover:text-zinc-400 hover:bg-zinc-800/20 transition-colors"
              title="Open full slide editor"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <span className="text-[8px] font-black uppercase tracking-widest">Full Editor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Preview + inline text editor */}
      {focusedSlide && (
        <div className="w-80 xl:w-96 shrink-0 border-l border-zinc-800 flex flex-col bg-zinc-950">
          {/* Preview header */}
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">PREVIEW</span>
            <span className="text-[9px] font-mono text-zinc-600">{focusedSlide.label || `Slide ${focusedIdx + 1}`}</span>
          </div>

          {/* Live preview canvas */}
          <div className="p-3 shrink-0">
            <div className="aspect-video w-full border border-zinc-700 rounded-sm overflow-hidden bg-black shadow-lg relative">
              <SlideRenderer
                slide={focusedSlide}
                item={item}
                fitContainer={true}
                isThumbnail={false}
                isPlaying={isVideoSlide(focusedSlide, item) ? previewPlaying : true}
                isMuted={previewMuted}
              />
              <div className="absolute top-0 left-0 bg-black/60 text-[8px] font-black tracking-widest text-zinc-400 px-2 py-1">
                LIVE PREVIEW
              </div>
              {isVideoSlide(focusedSlide, item) && (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1">
                  <button
                    onClick={() => setPreviewPlaying(p => !p)}
                    className="text-white hover:text-zinc-200 transition-colors"
                    title={previewPlaying ? 'Pause' : 'Play'}
                  >
                    {previewPlaying
                      ? <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
                      : <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16"><path d="M3 2l11 6-11 6V2z"/></svg>
                    }
                  </button>
                  <button
                    onClick={() => setPreviewMuted(m => !m)}
                    className={`transition-colors ${previewMuted ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                    title={previewMuted ? 'Unmute' : 'Mute'}
                  >
                    {previewMuted
                      ? <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16"><path d="M9 2v12l-5-4H1V6h3L9 2zm5.5 3.5l-1.4 1.4a3 3 0 010 2.2l1.4 1.4A5 5 0 0114.5 8a5 5 0 00-.5-2.5h.5z" opacity=".4"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5"/></svg>
                      : <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16"><path d="M9 2v12l-5-4H1V6h3L9 2zm4.5 1.5l-1.4 1.4a3 3 0 010 5.2l1.4 1.4A5 5 0 0013.5 8a5 5 0 00-.5-3.5h.5z"/></svg>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable editor area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 flex flex-col gap-3 min-h-0">
            {/* Slide Content */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Slide Content
              </label>
              <RichTextEditor
                value={getEditorContent(focusedSlide)}
                onChange={handleContentChange}
                resetKey={focusedSlide.id}
                align={align}
                onAlignChange={setAlign}
                contentClassName="min-h-[100px] max-h-[200px] overflow-y-auto"
              />
            </div>

            {/* Speaker Notes toggle */}
            <div className="rounded-sm overflow-hidden border border-zinc-800/70">
              <button
                type="button"
                onClick={() => setNotesOpen(o => !o)}
                className={`w-full flex items-center gap-2 px-3 py-2 transition-colors ${
                  notesOpen
                    ? 'bg-amber-950/30 border-b border-amber-900/40'
                    : 'bg-zinc-900/40 hover:bg-zinc-800/40'
                }`}
              >
                {/* Mic / notes icon */}
                <svg className={`w-3 h-3 shrink-0 transition-colors ${notesOpen ? 'text-amber-400' : 'text-zinc-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
                </svg>

                <span className={`text-[9px] font-black uppercase tracking-[0.22em] transition-colors ${notesOpen ? 'text-amber-400' : 'text-zinc-500'}`}>
                  Speaker Notes
                </span>

                {/* Notes preview / dot indicator when collapsed */}
                {!notesOpen && (
                  <span className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
                    {focusedSlide.notes?.trim() ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 shrink-0" />
                        <NotesPreview text={focusedSlide.notes} />
                      </>
                    ) : (
                      <span className="text-[9px] text-zinc-700 italic">tap to add notes</span>
                    )}
                  </span>
                )}

                {/* Chevron */}
                <svg
                  className={`w-3 h-3 shrink-0 text-zinc-600 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {notesOpen && (
                <div className="bg-amber-950/10 p-2.5">
                  <textarea
                    ref={notesRef}
                    className="w-full bg-zinc-900/70 border border-amber-900/30 rounded-sm text-xs text-zinc-300 p-2.5 resize-none focus:outline-none focus:border-amber-700/60 transition-colors leading-relaxed placeholder:text-zinc-600"
                    rows={5}
                    value={focusedSlide.notes ?? ''}
                    onChange={(e) => {
                      onUpdate({
                        ...item,
                        slides: item.slides.map((s, i) =>
                          i === focusedIdx ? { ...s, notes: e.target.value } : s
                        ),
                      });
                    }}
                    placeholder="Write your speaker notes here — only visible to you on Stage view…"
                  />
                  {focusedSlide.notes?.trim() && (
                    <div className="mt-1 text-right text-[9px] text-zinc-600 font-mono">
                      {focusedSlide.notes.trim().split(/\s+/).length} words
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons — pinned at bottom */}
          <div className="shrink-0 border-t border-zinc-800 px-3 py-2.5 flex gap-1.5">
            {onGoLive && (
              <button
                onClick={() => onGoLive(item, focusedIdx)}
                className="flex-1 py-2 rounded-sm border border-emerald-700/60 bg-emerald-950/20 text-emerald-300 text-[10px] font-black tracking-widest hover:bg-emerald-950/40 hover:border-emerald-600 transition-colors flex items-center justify-center gap-1"
                title="Project this slide to the live output now"
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                PROJECT
              </button>
            )}
            <button
              onClick={() => onOpenSlideEditor(focusedSlide)}
              className={`py-2 rounded-sm border border-zinc-700 text-zinc-400 text-[10px] font-black tracking-widest hover:text-white hover:border-zinc-500 transition-colors ${onGoLive ? 'flex-1' : 'w-full'}`}
            >
              FULL EDITOR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
