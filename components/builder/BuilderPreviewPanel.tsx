import React, { useState, useCallback } from 'react';
import { SlideRenderer } from '../SlideRenderer';
import type { ServiceItem, Slide } from '../../types';

interface BuilderPreviewPanelProps {
  item: ServiceItem;
  onUpdate: (item: ServiceItem) => void;
  onOpenSlideEditor: (slide: Slide) => void;
  onDeleteSlide: (slideId: string, e: React.MouseEvent) => void;
  onAddSlide: () => void;
  onStartLabelRename: (itemId: string, slideId: string, currentLabel: string, source: string) => void;
  inlineSlideRename: { slideId: string; value: string; source: string } | null;
  inlineSlideRenameInputRef: React.RefObject<HTMLInputElement>;
  onInlineRenameChange: (value: string) => void;
  onInlineRenameCommit: (itemId: string, slideId: string, value: string) => void;
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
}: BuilderPreviewPanelProps) {
  const [focusedIdx, setFocusedIdx] = useState<number>(0);

  const focusedSlide = item.slides[focusedIdx] ?? item.slides[0] ?? null;

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!focusedSlide) return;
    const newContent = e.target.value;
    onUpdate({
      ...item,
      slides: item.slides.map((s, i) =>
        i === focusedIdx ? { ...s, content: newContent } : s
      ),
    });
  }, [focusedSlide, focusedIdx, item, onUpdate]);

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
              {/* Mini live render */}
              <div className="absolute inset-0 pointer-events-none scale-[0.25] origin-top-left" style={{ width: '400%', height: '400%' }}>
                <SlideRenderer slide={slide} item={item} fitContainer={true} isThumbnail={true} />
              </div>

              {/* Focused indicator */}
              {focusedIdx === idx && (
                <div className="absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest z-10">
                  EDIT
                </div>
              )}

              {/* Label strip */}
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

              {/* Hover actions */}
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

          {/* Add slide */}
          <button
            onClick={onAddSlide}
            className="aspect-video border border-dashed border-zinc-800 rounded-sm flex flex-col items-center justify-center text-zinc-600 hover:text-zinc-400 bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors"
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Add Slide</span>
          </button>
        </div>
      </div>

      {/* Right: Preview + inline text editor */}
      {focusedSlide && (
        <div className="w-80 xl:w-96 shrink-0 border-l border-zinc-800 flex flex-col bg-zinc-950">
          {/* Preview header */}
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">PREVIEW</span>
            <span className="text-[9px] font-mono text-zinc-600">{focusedSlide.label || `Slide ${focusedIdx + 1}`}</span>
          </div>

          {/* Live preview canvas */}
          <div className="p-3">
            <div className="aspect-video w-full border border-zinc-700 rounded-sm overflow-hidden bg-black shadow-lg relative">
              <SlideRenderer slide={focusedSlide} item={item} fitContainer={true} isThumbnail={false} />
              <div className="absolute top-0 left-0 bg-black/60 text-[8px] font-black tracking-widest text-zinc-400 px-2 py-1">
                LIVE PREVIEW
              </div>
            </div>
          </div>

          {/* Inline text editor */}
          <div className="flex-1 flex flex-col px-3 pb-3 min-h-0 gap-2">
            <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">
              Slide Content
            </label>
            <textarea
              className="flex-1 w-full bg-zinc-900 border border-zinc-700 rounded-sm text-sm text-zinc-100 p-3 resize-none focus:outline-none focus:border-blue-500 transition-colors custom-scrollbar leading-relaxed min-h-[80px]"
              value={focusedSlide.content}
              onChange={handleContentChange}
              placeholder="Type slide content here..."
              spellCheck={false}
            />

            {/* Notes field */}
            {focusedSlide.notes !== undefined && (
              <>
                <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-600">
                  Speaker Notes
                </label>
                <textarea
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-sm text-xs text-zinc-400 p-2 resize-none focus:outline-none focus:border-zinc-600 transition-colors leading-relaxed"
                  rows={3}
                  value={focusedSlide.notes ?? ''}
                  onChange={(e) => {
                    onUpdate({
                      ...item,
                      slides: item.slides.map((s, i) =>
                        i === focusedIdx ? { ...s, notes: e.target.value } : s
                      ),
                    });
                  }}
                  placeholder="Speaker notes (visible on stage display only)"
                />
              </>
            )}

            <button
              onClick={() => onOpenSlideEditor(focusedSlide)}
              className="w-full py-2 rounded-sm border border-zinc-700 text-zinc-400 text-[10px] font-black tracking-widest hover:text-white hover:border-zinc-500 transition-colors"
            >
              FULL SLIDE EDITOR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
