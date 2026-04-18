import React from 'react';
import { Mode, ModeCounts } from '../types';

interface ModeSwitcherProps {
  active: Mode;
  onChange: (mode: Mode) => void;
  counts: ModeCounts;
  pulseSubmissions?: boolean;
}

interface Segment {
  id: Mode;
  label: string;
  shortcut: string;
  hint: string;
}

const SEGMENTS: ReadonlyArray<Segment> = [
  { id: 'broadcast',   label: 'Broadcast',   shortcut: '1', hint: 'Send announcements to the audience screen as a scrolling ticker or pinned message. Pick a category, draft text, then push to ticker or pin.' },
  { id: 'stage',       label: 'Stage',       shortcut: '2', hint: 'Private pastor-only messages shown on the stage monitor. Queue timing/logistics prompts or send an urgent alert the congregation will not see.' },
  { id: 'queue',       label: 'Queue',       shortcut: '3', hint: 'Control what the audience display shows right now: toggle pin/ticker, auto-rotate cadence, reorder or clear the live queue.' },
  { id: 'submissions', label: 'Submissions', shortcut: '4', hint: 'Inbox of messages submitted by the audience (prayer, Q&A, testimony). Approve, reject, or promote each submission to the display queue.' },
];

export function ModeSwitcher({ active, onChange, counts, pulseSubmissions = false }: ModeSwitcherProps) {
  return (
    <div className="flex justify-center py-2 px-2 border-b border-[#1F2937] bg-[#0B0F17] overflow-x-auto">
      <div
        role="tablist"
        aria-label="Audience Studio modes"
        className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#111827] border border-[#1F2937]"
      >
        {SEGMENTS.map((seg) => {
          const isActive = seg.id === active;
          const count = counts[seg.id];
          const showBadge = !isActive && count > 0;
          const pulse = seg.id === 'submissions' && pulseSubmissions && !isActive;
          return (
            <button
              key={seg.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(seg.id)}
              title={`${seg.hint}\n\nShortcut: ${seg.shortcut}`}
              className={`
                relative inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full
                text-[11px] font-semibold whitespace-nowrap
                transition-all duration-100 active:scale-[0.96]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60
                ${isActive
                  ? 'bg-[#2563EB] text-white shadow-sm shadow-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1F2937]'}
              `.trim()}
            >
              <span>{seg.label}</span>
              {showBadge && (
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[15px] h-[15px] px-1
                    rounded-full text-[9px] font-bold leading-none
                    bg-[#1F2937] text-zinc-200
                    ${pulse ? 'ring-2 ring-rose-500/60 animate-pulse' : ''}
                  `.trim()}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
