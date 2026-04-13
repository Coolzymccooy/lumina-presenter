import React from 'react';
import { getAllJourneys } from '../engine/guide-registry';
import { useGuideEngine } from '../hooks/useGuideEngine';
import type { GuideJourney, GuideCategory } from '../types/guide.types';

interface GuidedToursPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_META: Record<GuideCategory, { label: string; color: string; bg: string; border: string }> = {
  setup: {
    label: 'Setup',
    color: 'text-cyan-300',
    bg: 'bg-cyan-950/30',
    border: 'border-cyan-800/40',
  },
  presentation: {
    label: 'Presentation',
    color: 'text-blue-300',
    bg: 'bg-blue-950/30',
    border: 'border-blue-800/40',
  },
  scripture: {
    label: 'Scripture',
    color: 'text-amber-300',
    bg: 'bg-amber-950/30',
    border: 'border-amber-800/40',
  },
  output: {
    label: 'Output',
    color: 'text-emerald-300',
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-800/40',
  },
  stage: {
    label: 'Stage',
    color: 'text-purple-300',
    bg: 'bg-purple-950/30',
    border: 'border-purple-800/40',
  },
  live: {
    label: 'Live',
    color: 'text-rose-300',
    bg: 'bg-rose-950/30',
    border: 'border-rose-800/40',
  },
  ai: {
    label: 'AI',
    color: 'text-violet-300',
    bg: 'bg-violet-950/30',
    border: 'border-violet-800/40',
  },
};

function groupByCategory(journeys: GuideJourney[]): [GuideCategory, GuideJourney[]][] {
  const map = new Map<GuideCategory, GuideJourney[]>();
  for (const j of journeys) {
    if (!map.has(j.category)) map.set(j.category, []);
    map.get(j.category)!.push(j);
  }
  const order: GuideCategory[] = ['setup', 'presentation', 'scripture', 'output', 'stage', 'live', 'ai'];
  return order
    .filter((c) => map.has(c))
    .map((c) => [c, map.get(c)!]);
}

export function GuidedToursPanel({ isOpen, onClose }: GuidedToursPanelProps) {
  const { start, completedJourneyIds } = useGuideEngine();

  if (!isOpen) return null;

  const allJourneys = getAllJourneys();
  const groups = groupByCategory(allJourneys);
  const completedSet = new Set(completedJourneyIds);

  const handleLaunch = (journey: GuideJourney) => {
    onClose();
    start(journey);
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="guided-tours-panel"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950 shadow-[0_36px_100px_rgba(0,0,0,0.6)] overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-zinc-900 flex items-start justify-between gap-4">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.28em] text-indigo-400 mb-1">Lumina Guide</div>
            <h2 className="text-xl font-black tracking-tight text-white">Guided Tours</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pick a tour and Lumina will walk you through it step by step.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-1 shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Journey list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
          {groups.map(([category, journeys]) => {
            const meta = CATEGORY_META[category];
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.22em] border ${meta.bg} ${meta.color} ${meta.border}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 h-px bg-zinc-900" />
                </div>

                <div className="space-y-2">
                  {journeys.map((journey) => {
                    const done = completedSet.has(journey.id);
                    return (
                      <div
                        key={journey.id}
                        className={`group flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                          done
                            ? 'border-zinc-800 bg-zinc-900/40 opacity-70 hover:opacity-100 hover:border-zinc-700'
                            : 'border-zinc-800 bg-zinc-900/40 hover:border-indigo-600/50 hover:bg-indigo-950/20'
                        }`}
                        onClick={() => handleLaunch(journey)}
                        data-testid={`guided-tour-item-${journey.id}`}
                      >
                        {/* Done badge */}
                        <div className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm ${
                          done
                            ? 'border-emerald-700/50 bg-emerald-950/50 text-emerald-400'
                            : `${meta.border} ${meta.bg} ${meta.color}`
                        }`}>
                          {done ? '✓' : '▶'}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-zinc-100 leading-snug">{journey.title}</div>
                          {journey.description && (
                            <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{journey.description}</div>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="shrink-0 flex items-center gap-2">
                          {journey.estimatedMinutes && (
                            <span className="text-[9px] font-bold text-zinc-600 tracking-wide">
                              ~{journey.estimatedMinutes}m
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-zinc-600">
                            {journey.steps.length} steps
                          </span>
                          {done && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border border-emerald-800/50 bg-emerald-950/30 text-emerald-400">
                              Done
                            </span>
                          )}
                          <span className={`text-zinc-700 group-hover:text-indigo-400 transition-colors text-sm`}>→</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {allJourneys.length === 0 && (
            <div className="text-center py-12 text-zinc-600 text-sm">
              No guided tours available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-zinc-900 flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">
            {completedJourneyIds.length}/{allJourneys.length} completed
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-[11px] font-black tracking-widest hover:border-zinc-500 transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
