import React from 'react';
import { SlideRenderer } from '../SlideRenderer';
import type { ServiceItem, Slide } from '../../types';

export interface SermonFlashItem {
  title: string;
  slides: { id: string; content: string; label: string }[];
}

interface StageWorkspaceProps {
  activeItem: ServiceItem | null;
  activeSlide: Slide | null;
  activeSlideIndex: number;
  nextSlide: Slide | null;
  nextItem: ServiceItem | null;
  schedule: ServiceItem[];
  workspaceId: string;
  isOutputLive: boolean;
  isStageDisplayLive: boolean;
  blackout: boolean;
  onGoLive: (item: ServiceItem, slideIdx?: number) => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onToggleBlackout: () => void;
  showSermonRecorder: boolean;
  onToggleSermonRecorder: () => void;
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
  isCompactLayout?: boolean;
}

export function StageWorkspace({
  activeItem,
  activeSlide,
  activeSlideIndex,
  nextSlide,
  nextItem,
  schedule,
  workspaceId: _workspaceId,
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
  showSermonRecorder,
  onToggleSermonRecorder,
  isCompactLayout = false,
}: StageWorkspaceProps) {
  const speakerNotes = activeSlide?.notes || activeItem?.slides?.find((s) => s.notes)?.notes || '';
  const currentItemIdx = schedule.findIndex((i) => i.id === activeItem?.id);
  const upcomingItems = schedule.slice(currentItemIdx + 1, currentItemIdx + 4);

  return (
    <div
      className={`flex-1 min-w-0 bg-zinc-950 relative ${
        isCompactLayout
          ? 'flex min-h-0 flex-col overflow-y-auto'
          : 'flex overflow-hidden'
      }`}
    >
      <div
        className={`shrink-0 flex flex-col ${
          isCompactLayout
            ? 'w-full border-b border-zinc-800'
            : 'w-72 border-r border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">STAGE VIEW</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSermonRecorder}
              className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                showSermonRecorder
                  ? 'border-red-600 bg-red-950/40 text-red-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-400'
              }`}
              title="Sermon recorder - record, transcribe and flash to screen"
            >
              {showSermonRecorder ? 'REC' : 'Sermon'}
            </button>
            <div className={`h-1.5 w-1.5 rounded-full ${isOutputLive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className={`text-[9px] font-black tracking-widest ${isOutputLive ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {isOutputLive ? 'OUTPUT ON' : 'OUTPUT OFF'}
            </span>
          </div>
        </div>

        <div className="border-b border-zinc-800 px-3 py-3">
          <div className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600">NOW PLAYING</div>
          {activeItem ? (
            <div>
              <div className="truncate text-sm font-bold text-zinc-100">{activeItem.title}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{activeItem.type}</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="text-[10px] font-mono text-zinc-400">
                  Slide {activeSlideIndex + 1} / {activeItem.slides.length}
                </div>
                {blackout && (
                  <div className="rounded border border-red-700 bg-red-900/60 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-red-300">
                    BLACKOUT
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs italic text-zinc-600">No item active</div>
          )}
        </div>

        <div
          className={`border-b border-zinc-800 px-3 py-3 overflow-y-auto custom-scrollbar ${
            isCompactLayout ? 'max-h-52' : 'flex-1'
          }`}
        >
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">SPEAKER NOTES</div>
          {speakerNotes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{speakerNotes}</p>
          ) : (
            <p className="text-xs italic text-zinc-600">No notes for this slide.</p>
          )}
        </div>

        <div className="border-b border-zinc-800 px-3 py-3">
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">UP NEXT</div>
          <div className="flex flex-col gap-1">
            {upcomingItems.length > 0 ? upcomingItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onGoLive(item, 0)}
                className="flex items-center gap-2 rounded-sm border border-zinc-800 px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700" />
                <span className="truncate">{item.title}</span>
              </button>
            )) : (
              <div className="text-[10px] italic text-zinc-700">Queue empty</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 p-3">
          <div className="flex gap-2">
            <button
              onClick={onPrevSlide}
              className="flex-1 rounded-sm border border-zinc-700 bg-zinc-800 py-2 text-[10px] font-black tracking-widest text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              &larr; PREV
            </button>
            <button
              onClick={onNextSlide}
              className="flex-1 rounded-sm bg-blue-600 py-2 text-[10px] font-black tracking-widest text-white transition-colors hover:bg-blue-500"
            >
              NEXT &rarr;
            </button>
          </div>
          {isActiveVideo && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-900 p-1.5">
              <button
                onClick={onSeekBackward}
                title="Rewind 10s"
                className="flex-1 rounded-sm bg-zinc-800 py-1.5 text-[10px] font-black tracking-widest text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                -10s
              </button>
              <button
                onClick={onTogglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className={`flex-1 rounded-sm py-1.5 text-[10px] font-black tracking-widest transition-colors ${
                  isPlaying
                    ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                    : 'bg-emerald-700 text-white hover:bg-emerald-600'
                }`}
              >
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
              <button
                onClick={onSeekForward}
                title="Forward 10s"
                className="flex-1 rounded-sm bg-zinc-800 py-1.5 text-[10px] font-black tracking-widest text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                +10s
              </button>
              <button
                onClick={onToggleMute}
                title={outputMuted ? 'Unmute' : 'Mute'}
                className={`rounded-sm border px-2 py-1.5 text-[10px] font-black tracking-widest transition-colors ${
                  outputMuted
                    ? 'border-red-700 bg-red-900/50 text-red-300'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {outputMuted ? 'MUTED' : 'AUDIO'}
              </button>
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={onToggleBlackout}
            className={`w-full rounded-sm border py-2 text-[10px] font-black tracking-widest transition-colors ${
              blackout
                ? 'border-red-700 bg-red-900 text-red-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {blackout ? 'BLACKOUT ACTIVE' : 'BLACKOUT'}
          </button>
        </div>
      </div>

      <div className={`flex min-w-0 flex-col gap-3 ${isCompactLayout ? 'w-full p-3' : 'flex-1 p-4'}`}>
        <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-zinc-600">
          CURRENT - WHAT AUDIENCE SEES
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-sm border border-zinc-700 bg-black shadow-2xl">
            {blackout ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <span className="text-xl font-black tracking-[0.5em] text-red-500 opacity-60">BLACKOUT</span>
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
              <div className="absolute inset-0 flex items-center justify-center text-sm font-black tracking-widest text-zinc-700">
                NO ACTIVE SLIDE
              </div>
            )}
            <div className="absolute left-0 top-0 bg-black/60 px-2 py-1 text-[8px] font-black tracking-widest text-emerald-400">
              {isOutputLive ? 'LIVE' : 'NOT LIVE'}
            </div>
          </div>
        </div>

        {activeItem && (
          <div className="shrink-0">
            <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">SLIDES</div>
            <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
              {activeItem.slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => onGoLive(activeItem, idx)}
                  className={`relative aspect-video w-28 shrink-0 overflow-hidden rounded-sm border transition-all ${
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

      <div
        className={`shrink-0 gap-3 ${
          isCompactLayout
            ? 'grid w-full border-t border-zinc-800 p-3 md:grid-cols-2'
            : 'flex w-64 flex-col border-l border-zinc-800 p-4 xl:w-72'
        }`}
      >
        <div className="min-w-0">
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">NEXT SLIDE</div>
          <div className="relative aspect-video overflow-hidden rounded-sm border border-zinc-800 bg-black">
            {nextSlide && activeItem ? (
              <SlideRenderer slide={nextSlide} item={activeItem} fitContainer={true} isThumbnail={true} />
            ) : nextItem ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">NEXT ITEM</div>
                <div className="w-full truncate text-center text-xs font-bold text-zinc-400">{nextItem.title}</div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-widest text-zinc-700">
                END OF QUEUE
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">STAGE DISPLAY</div>
          <div className="relative aspect-video overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
            {isStageDisplayLive ? (
              <div className="absolute inset-0 flex items-center justify-center">
                {activeSlide && activeItem ? (
                  <SlideRenderer slide={activeSlide} item={activeItem} fitContainer={true} isThumbnail={true} />
                ) : null}
                <div className="absolute left-0 top-0 bg-purple-900/80 px-2 py-1 text-[8px] font-black tracking-widest text-purple-200">
                  STAGE ON
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-widest text-zinc-700">
                STAGE OFF
              </div>
            )}
          </div>
        </div>

        <div className={`flex min-h-0 flex-col ${isCompactLayout ? 'md:col-span-2' : 'flex-1 overflow-hidden'}`}>
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">RUN ORDER</div>
          <div
            className={`custom-scrollbar flex flex-col gap-0.5 ${
              isCompactLayout
                ? 'max-h-56 overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-950/60 p-1.5'
                : 'flex-1 overflow-y-auto'
            }`}
          >
            {schedule.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => onGoLive(item, 0)}
                className={`flex items-center gap-2 rounded-sm border-l-2 px-2 py-1.5 text-left text-[10px] transition-colors ${
                  item.id === activeItem?.id
                    ? 'border-l-emerald-500 bg-emerald-950/20 text-white'
                    : 'border-l-transparent text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300'
                }`}
              >
                <span className="w-4 shrink-0 font-mono text-zinc-700">{idx + 1}</span>
                <span className="truncate font-medium">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
