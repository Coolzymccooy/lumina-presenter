import React from 'react';

interface LivePaneProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const LivePane: React.FC<LivePaneProps> = ({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = '',
}) => {
  return (
    <div data-testid="presenter-live-pane" className={`h-full min-h-0 bg-zinc-950 border-l border-zinc-900 flex flex-col ${className}`}>
      <div className="shrink-0 border-b border-zinc-900 px-2.5 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="mt-1 text-[10px] text-zinc-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};
