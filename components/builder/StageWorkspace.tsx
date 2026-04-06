import React from 'react';
import { SlideRenderer } from '../SlideRenderer';
import type { ServiceItem, Slide } from '../../types';

interface StageWorkspaceProps {
  activeItem: ServiceItem | null;
  activeSlide: Slide | null;
  activeSlideIndex: number;
  nextSlide: Slide | null;
  nextItem: ServiceItem | null;
  schedule: ServiceItem[];
  isOutputLive: boolean;
  isStageDisplayLive: boolean;
  blackout: boolean;
  onGoLive: (item: ServiceItem, slideIdx?: number) => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onToggleBlackout: () => void;
  // Video transport
  isPlaying: boolean;
  isActiveVideo: boolean;
  seekTarget: number | null;
  videoSyncEpoch: { epochMs: number; offsetSec: number } | null;
  seekCommand: number | null;
  seekAmount: number;
  outputMuted: boolean;
  onTogglePlay: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onToggleMute: () => void;
}

export function StageWorkspace({
  activeItem,
  activeSlide,
  activeSlideIndex,
  nextSlide,
  nextItem,
  schedule,
  isOutputLive,
  isStageDisplayLive,
  blackout,
  onGoLive,
  onPrevSlide,
  onNextSlide,
  onToggleBlackout,
  isPlaying,
  isActiveVideo,
  seekTarget,
  videoSyncEpoch,
  seekCommand,
  seekAmount,
  outputMuted,
  onTogglePlay,
  onSeekForward,
  onSeekBackward,
  onToggleMute,
}: StageWorkspaceProps) {
  const speakerNotes = activeSlide?.notes || activeItem?.slides?.find(s => s.notes)?.notes || '';
  const currentItemIdx = schedule.findIndex(i => i.id === activeItem?.id);
  const upcomingItems = schedule.slice(currentItemIdx + 1, currentItemIdx + 4);

  return (
    <div className="flex-1 flex bg-zinc-950 min-w-0 overflow-hidden">

      {/* LEFT: Stage info panel */}
      <div className="w-72 shrink-0 border-r border-zinc-800 flex flex-col">

        {/* Status bar */}
        <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">STAGE VIEW</span>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isOutputLive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className={`text-[9px] font-black tracking-widest ${isOutputLive ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {isOutputLive ? 'OUTPUT ON' : 'OUTPUT OFF'}
            </span>
          </div>
        </div>

        {/* Now Playing */}
        <div className="px-3 py-3 border-b border-zinc-800">
          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">NOW PLAYING</div>
          {activeItem ? (
            <div>
              <div className="text-sm font-bold text-zinc-100 truncate">{activeItem.title}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{activeItem.type}</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="text-[10px] font-mono text-zinc-400">
                  Slide {activeSlideIndex + 1} / {activeItem.slides.length}
                </div>
                {blackout && (
                  <div className="px-1.5 py-0.5 bg-red-900/60 border border-red-700 rounded text-[9px] font-black text-red-300 tracking-widest">
                    BLACKOUT
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-zinc-600 text-xs italic">No item active</div>
          )}
        </div>

        {/* Speaker Notes */}
        <div className="flex-1 px-3 py-3 border-b border-zinc-800 overflow-y-auto custom-scrollbar">
          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-2">SPEAKER NOTES</div>
          {speakerNotes ? (
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{speakerNotes}</p>
          ) : (
            <p className="text-zinc-600 text-xs italic">No notes for this slide.</p>
          )}
        </div>

        {/* Up Next queue */}
        <div className="px-3 py-3 border-b border-zinc-800">
          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-2">UP NEXT</div>
          <div className="flex flex-col gap-1">
            {upcomingItems.length > 0 ? upcomingItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onGoLive(item, 0)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm border border-zinc-800 hover:border-zinc-600 text-left text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />
                <span className="truncate">{item.title}</span>
              </button>
            )) : (
              <div className="text-zinc-700 text-[10px] italic">Queue empty</div>
            )}
          </div>
        </div>

        {/* Transport controls */}
        <div className="p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={onPrevSlide}
              className="flex-1 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black tracking-widest transition-colors border border-zinc-700"
            >
              ← PREV
            </button>
            <button
              onClick={onNextSlide}
              className="flex-1 py-2 rounded-sm bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black tracking-widest transition-colors"
            >
              NEXT →
            </button>
          </div>
          {isActiveVideo && (
            <div className="flex items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-900 p-1.5">
              <button
                onClick={onSeekBackward}
                title="Rewind 10s"
                className="flex-1 py-1.5 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black tracking-widest transition-colors"
              >
                ⏮ -10s
              </button>
              <button
                onClick={onTogglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className={`flex-1 py-1.5 rounded-sm text-[10px] font-black tracking-widest transition-colors ${
                  isPlaying
                    ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                    : 'bg-emerald-700 text-white hover:bg-emerald-600'
                }`}
              >
                {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
              </button>
              <button
                onClick={onSeekForward}
                title="Forward 10s"
                className="flex-1 py-1.5 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black tracking-widest transition-colors"
              >
                +10s ⏭
              </button>
              <button
                onClick={onToggleMute}
                title={outputMuted ? 'Unmute' : 'Mute'}
                className={`px-2 py-1.5 rounded-sm text-[10px] font-black tracking-widest transition-colors border ${
                  outputMuted
                    ? 'bg-red-900/50 border-red-700 text-red-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {outputMuted ? '🔇' : '🔊'}
              </button>
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={onToggleBlackout}
            className={`w-full py-2 rounded-sm text-[10px] font-black tracking-widest transition-colors border ${
              blackout
                ? 'bg-red-900 border-red-700 text-red-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {blackout ? '■ BLACKOUT ACTIVE' : 'BLACKOUT'}
          </button>
        </div>
      </div>

      {/* CENTRE: Current slide on stage (large) */}
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1">
          CURRENT — WHAT AUDIENCE SEES
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl aspect-video border border-zinc-700 rounded-sm overflow-hidden bg-black shadow-2xl relative">
            {blackout ? (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <span className="text-red-500 font-black text-xl tracking-[0.5em] opacity-60">BLACKOUT</span>
              </div>
            ) : activeSlide && activeItem ? (
              <SlideRenderer
                slide={activeSlide}
                item={activeItem}
                fitContainer={true}
                isPlaying={isPlaying}
                seekCommand={seekCommand}
                seekAmount={seekAmount}
                seekTarget={seekTarget}
                videoSyncEpoch={videoSyncEpoch}
                isMuted={true}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-black text-sm tracking-widest">
                NO ACTIVE SLIDE
              </div>
            )}
            <div className="absolute top-0 left-0 bg-black/60 text-[8px] font-black tracking-widest px-2 py-1 text-emerald-400">
              {isOutputLive ? '● LIVE' : '○ NOT LIVE'}
            </div>
          </div>
        </div>

        {/* Slide strip for current item */}
        {activeItem && (
          <div className="shrink-0">
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-2">SLIDES</div>
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
              {activeItem.slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => onGoLive(activeItem, idx)}
                  className={`shrink-0 w-28 aspect-video border rounded-sm overflow-hidden relative transition-all ${
                    idx === activeSlideIndex
                      ? 'border-blue-500 ring-1 ring-blue-500/40'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <SlideRenderer slide={slide} item={activeItem} fitContainer={true} isThumbnail={true} />
                  </div>
                  {idx === activeSlideIndex && (
                    <div className="absolute inset-0 border border-blue-500/20 bg-blue-500/5" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Next slide preview */}
      <div className="w-64 xl:w-72 shrink-0 border-l border-zinc-800 flex flex-col p-4 gap-3">
        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">NEXT SLIDE</div>
        <div className="aspect-video border border-zinc-800 rounded-sm overflow-hidden bg-black relative">
          {nextSlide && activeItem ? (
            <SlideRenderer slide={nextSlide} item={activeItem} fitContainer={true} isThumbnail={true} />
          ) : nextItem ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2">
              <div className="text-[9px] font-black text-zinc-600 tracking-widest uppercase">NEXT ITEM</div>
              <div className="text-xs font-bold text-zinc-400 text-center truncate w-full">{nextItem.title}</div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-[10px] font-black tracking-widest">
              END OF QUEUE
            </div>
          )}
        </div>

        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">STAGE DISPLAY</div>
        <div className="aspect-video border border-zinc-800 rounded-sm overflow-hidden bg-zinc-900 relative">
          {isStageDisplayLive ? (
            <div className="absolute inset-0 flex items-center justify-center">
              {activeSlide && activeItem ? (
                <SlideRenderer slide={activeSlide} item={activeItem} fitContainer={true} isThumbnail={true} />
              ) : null}
              <div className="absolute top-0 left-0 bg-purple-900/80 text-[8px] font-black tracking-widest px-2 py-1 text-purple-200">
                STAGE ON
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-[10px] font-black tracking-widest">
              STAGE OFF
            </div>
          )}
        </div>

        {/* Full run order */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-2">RUN ORDER</div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
            {schedule.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => onGoLive(item, 0)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-sm text-left text-[10px] transition-colors border-l-2 ${
                  item.id === activeItem?.id
                    ? 'text-white border-l-emerald-500 bg-emerald-950/20'
                    : 'text-zinc-500 border-l-transparent hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <span className="font-mono text-zinc-700 w-4 shrink-0">{idx + 1}</span>
                <span className="truncate font-medium">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
