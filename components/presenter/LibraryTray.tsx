import React from 'react';
import { PresenterLibraryTab } from './types';

interface LibraryTabDefinition {
  id: PresenterLibraryTab;
  label: string;
}

interface LibraryTrayProps {
  title?: string;
  tabs: LibraryTabDefinition[];
  activeTab: PresenterLibraryTab;
  onTabChange: (tab: PresenterLibraryTab) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const LibraryTray: React.FC<LibraryTrayProps> = ({
  title = 'Library',
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  children,
  className = '',
}) => {
  return (
    <div data-testid="presenter-library-tray" className={`h-full min-h-0 bg-zinc-950 flex flex-col ${className}`}>
      <div className="shrink-0 border-b border-zinc-900 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">{title}</div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] transition-all ${
                  activeTab === tab.id
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {headerActions}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};
