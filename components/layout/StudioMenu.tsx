import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MonitorIcon,
  MusicIcon,
  CopyIcon,
  Volume2Icon,
  BibleIcon,
  ChatIcon,
  SparklesIcon,
} from '../Icons';
import { Tooltip } from '../ui';

export type SidebarTab = 'SCHEDULE' | 'HYMNS' | 'FILES' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'MACROS';

export interface StudioMenuProps {
  activeTab: SidebarTab | null;
  onSelectTab: (tab: SidebarTab | null) => void;
}

type MenuItem = {
  id: SidebarTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'info' | 'ai';
  tooltip: React.ReactNode;
};

const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: 'SCHEDULE',
    label: 'Schedule',
    icon: MonitorIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Today's run sheet.</strong>
        <br />
        Build and reorder the live order of service — songs, scriptures, sermons, videos, announcements.
      </span>
    ),
  },
  {
    id: 'HYMNS',
    label: 'Hymns',
    icon: MusicIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Your hymn & song library.</strong>
        <br />
        Search, add, or import worship songs. Drop any hymn straight onto the Schedule with a click.
      </span>
    ),
  },
  {
    id: 'FILES',
    label: 'Files',
    icon: CopyIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Saved run sheets & templates.</strong>
        <br />
        Re-open last week's service or load a recurring template. Nothing prepped is ever lost.
      </span>
    ),
  },
  {
    id: 'AUDIO',
    label: 'Audio Mixer',
    icon: Volume2Icon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Live sound control.</strong>
        <br />
        Adjust per-source volume, mute/solo channels, and route audio in real time.
      </span>
    ),
  },
  {
    id: 'BIBLE',
    label: 'Bible Hub',
    icon: BibleIcon,
    variant: 'ai',
    tooltip: (
      <span>
        <strong className="text-violet-300">Scripture, instantly.</strong>
        <br />
        Look up passages across translations and turn on <strong className="text-violet-300">Auto Listening</strong>.
      </span>
    ),
  },
  {
    id: 'AUDIENCE',
    label: 'Audience',
    icon: ChatIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Engage the room.</strong>
        <br />
        Open polls, prayer requests, Q&amp;A, giving prompts, and live audience interactions.
      </span>
    ),
  },
  {
    id: 'MACROS',
    label: 'Macros',
    icon: SparklesIcon,
    variant: 'ai',
    tooltip: (
      <span>
        <strong className="text-violet-300">One-tap automations.</strong>
        <br />
        Chain actions into a single button — built once, fired anytime.
      </span>
    ),
  },
];

export function StudioMenu({ activeTab, onSelectTab }: StudioMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusIndex(-1);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
      setFocusIndex(-1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => (i + 1) % MENU_ITEMS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => (i <= 0 ? MENU_ITEMS.length - 1 : i - 1));
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen && focusIndex >= 0) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [isOpen, focusIndex]);

  const handleItemClick = (tab: SidebarTab) => {
    onSelectTab(tab === activeTab ? null : tab);
    setIsOpen(false);
    setFocusIndex(-1);
  };

  const activeLabel = activeTab
    ? MENU_ITEMS.find((m) => m.id === activeTab)?.label ?? null
    : null;

  return (
    <div className="relative" data-testid="studio-menu-root">
      <Tooltip placement="right" variant="info" content="Open Studio navigation">
        <button
          ref={buttonRef}
          type="button"
          data-testid="studio-menu-button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls="studio-menu-dropdown"
          onClick={() => {
            setIsOpen((v) => !v);
            setFocusIndex(-1);
          }}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-sm border text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
            isOpen || activeTab !== null
              ? 'bg-zinc-800 border-zinc-700 text-white'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
          }`}
        >
          <span className="truncate">
            STUDIO{activeLabel ? <span className="text-zinc-500"> › {activeLabel.toUpperCase()}</span> : null}
          </span>
          <span aria-hidden className="text-[8px]">{isOpen ? '▴' : '▾'}</span>
        </button>
      </Tooltip>

      {isOpen && (
        <div
          ref={menuRef}
          id="studio-menu-dropdown"
          role="menu"
          data-testid="studio-menu-dropdown"
          className="absolute left-0 top-full mt-1 w-56 rounded-md border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-xl shadow-black/40 z-[100] p-1"
        >
          {MENU_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab;
            return (
              <Tooltip key={item.id} placement="right" variant={item.variant} content={item.tooltip}>
                <button
                  ref={(node) => {
                    itemRefs.current[idx] = node;
                  }}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? 'true' : undefined}
                  autoFocus={isOpen && focusIndex === idx}
                  data-testid={`studio-menu-item-${item.id.toLowerCase()}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-left transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold tracking-tight uppercase">{item.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
