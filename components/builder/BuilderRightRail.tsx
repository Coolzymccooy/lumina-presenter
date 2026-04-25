import React from 'react';
import type { ServiceItem, Slide, SpeakerTimerPreset } from '../../types';
import { SlideRenderer } from '../SlideRenderer';
import { BuilderCuePanel } from './BuilderCuePanel';
import { BuilderInspectorAccordion } from './BuilderInspectorAccordion';

interface BuilderRightRailProps {
  selectedItem: ServiceItem | null;
  selectedSlide: Slide | null;
  selectedElementId: string | null;
  activeItem: ServiceItem | null;
  activeSlide: Slide | null;
  activeSlideIndex: number;
  schedule: ServiceItem[];
  isStageDisplayLive: boolean;
  speakerPresets: SpeakerTimerPreset[];
  onUpdateItem: (item: ServiceItem) => void;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  onSelectItem: (itemId: string) => void;
  onGoLive: (item: ServiceItem, slideIndex: number) => void;
}

type BuilderRailTab = 'live' | 'design' | 'cue';

const RailCard = ({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={`rounded-lg border border-zinc-600/80 bg-[#15161b] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${className}`}>
    <div className="flex items-center justify-between gap-2 border-b border-zinc-700/70 bg-[#1c1d22] px-3 py-2">
      <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-200">{title}</h3>
      {action}
    </div>
    <div className="p-3">{children}</div>
  </section>
);

const MiniPreview = ({
  slide,
  item,
  emptyLabel,
}: {
  slide: Slide | null;
  item: ServiceItem | null;
  emptyLabel: string;
}) => (
  <div className="rounded-xl border border-zinc-600/70 bg-[#222329] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
    <div className="aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-[#090a0f]">
      {slide && item ? (
        <SlideRenderer slide={slide} item={item} fitContainer isThumbnail />
      ) : (
        <div className="flex h-full items-center justify-center text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
          {emptyLabel}
        </div>
      )}
      </div>
  </div>
);

export const BuilderRightRail: React.FC<BuilderRightRailProps> = ({
  selectedItem,
  selectedSlide,
  selectedElementId,
  activeItem,
  activeSlide,
  activeSlideIndex,
  schedule,
  isStageDisplayLive,
  speakerPresets,
  onUpdateItem,
  onUpdateSlide,
  onSelectItem,
  onGoLive,
}) => {
  const [activeTab, setActiveTab] = React.useState<BuilderRailTab>('live');
  const activeScheduleIndex = activeItem ? schedule.findIndex((item) => item.id === activeItem.id) : -1;
  const moreInQueue = activeScheduleIndex >= 0 ? schedule.slice(activeScheduleIndex + 1) : schedule;
  const selectedSlideIndex = selectedItem && selectedSlide
    ? selectedItem.slides.findIndex((slide) => slide.id === selectedSlide.id)
    : -1;
  const tabs: Array<{ id: BuilderRailTab; label: string }> = [
    { id: 'live', label: 'Live' },
    { id: 'design', label: 'Design' },
    { id: 'cue', label: 'Cue' },
  ];

  return (
    <aside
      data-testid="builder-right-rail"
      className="flex h-full min-h-0 flex-col border-l border-zinc-800 bg-[#101116] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="shrink-0 border-b border-zinc-800 bg-[linear-gradient(180deg,rgba(31,32,38,0.98)_0%,rgba(16,17,22,0.98)_100%)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Builder Rail</div>
          <div className="flex rounded-lg border border-zinc-700 bg-[#090a0f] p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-6 rounded-md px-2 text-[8px] font-black uppercase tracking-[0.14em] ${
                  activeTab === tab.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-zinc-300">
          <span className={`h-2 w-2 rounded-full ${isStageDisplayLive ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
          Stage {isStageDisplayLive ? 'online' : 'standby'}
        </div>
      </div>
      {activeTab === 'live' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Pinned region: Live Now + Stage Preview never scroll out of view */}
          <div className="shrink-0 space-y-3 p-3 pb-2">
            <RailCard
              title="Live Now"
              action={activeSlide ? <span className="rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white">Live</span> : null}
            >
              <MiniPreview slide={activeSlide} item={activeItem} emptyLabel="Nothing live" />
              <div className="mt-2 min-w-0">
                <div className="truncate text-sm font-black text-zinc-50">{activeItem?.title || 'No live item'}</div>
                <div className="mt-0.5 truncate text-[10px] font-mono text-zinc-300">
                  {activeSlide ? `${activeSlideIndex + 1}. ${activeSlide.label || `Slide ${activeSlideIndex + 1}`}` : 'Output idle'}
                </div>
              </div>
            </RailCard>

            <RailCard
              title="Stage Preview"
              action={selectedSlide ? (
                <button
                  type="button"
                  onClick={() => selectedItem && selectedSlideIndex >= 0 && onGoLive(selectedItem, selectedSlideIndex)}
                  className="rounded border border-red-700/70 bg-red-950/40 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-red-100 hover:border-red-500"
                >
                  Go Live
                </button>
              ) : null}
            >
              <MiniPreview slide={selectedSlide} item={selectedItem} emptyLabel="No preview" />
              <div className="mt-2 min-w-0">
                <div className="truncate text-sm font-black text-zinc-50">{selectedItem?.title || 'Select an item'}</div>
                <div className="mt-0.5 truncate text-[10px] font-mono text-zinc-300">
                  {selectedSlide && selectedSlideIndex >= 0 ? `${selectedSlideIndex + 1}. ${selectedSlide.label || `Slide ${selectedSlideIndex + 1}`}` : 'No selected slide'}
                </div>
              </div>
            </RailCard>
          </div>

          {/* Queue card — sized to display exactly 2 items cleanly. Anything
              past 2 scrolls internally so there's never a clipped third card
              peeking at the bottom of the rail. */}
          <div className="shrink-0 px-3 pb-3">
            <RailCard
              title="More In Queue"
              action={moreInQueue.length > 2 ? (
                <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                  {moreInQueue.length}
                </span>
              ) : null}
            >
              <div className="max-h-[112px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {moreInQueue.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    onDoubleClick={() => item.slides.length > 0 && onGoLive(item, 0)}
                    className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-zinc-800 bg-black/40 p-1.5 text-left hover:border-zinc-600"
                  >
                    <div className="aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
                      {item.slides[0] ? <SlideRenderer slide={item.slides[0]} item={item} fitContainer isThumbnail /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold text-zinc-200">{item.title}</div>
                      <div className="truncate text-[9px] uppercase tracking-[0.12em] text-zinc-600">{item.slides.length} slides</div>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-600">{index + 1}</span>
                  </button>
                ))}
                {!moreInQueue.length && (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700">
                    Queue clear
                  </div>
                )}
              </div>
            </RailCard>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
          {activeTab === 'design' && (
            <RailCard
              title="Inspector"
              action={selectedElementId ? <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-cyan-200">Layer</span> : null}
              className="bg-zinc-950"
            >
              <BuilderInspectorAccordion
                item={selectedItem}
                slide={selectedSlide}
                selectedElementId={selectedElementId}
                onUpdateItem={onUpdateItem}
                onUpdateSlide={onUpdateSlide}
              />
            </RailCard>
          )}

          {activeTab === 'cue' && (
            <RailCard title="Cue Setup" className="bg-zinc-950">
              <BuilderCuePanel item={selectedItem} speakerPresets={speakerPresets} onUpdateItem={onUpdateItem} />
            </RailCard>
          )}
        </div>
      )}
    </aside>
  );
};
