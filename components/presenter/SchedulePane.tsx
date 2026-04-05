import React from 'react';

interface SchedulePaneProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SchedulePane: React.FC<SchedulePaneProps> = ({
  title,
  subtitle,
  badge,
  actions,
  rail,
  children,
  className = '',
}) => {
  return (
    <div data-testid="presenter-schedule-pane" className={`h-full min-h-0 bg-zinc-950 border-r border-zinc-900 flex ${rail ? 'flex-row' : 'flex-col'} ${className}`}>
      {rail}
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="shrink-0 border-b border-zinc-900 px-2.5 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">{title}</h3>
                {badge}
              </div>
              {subtitle && (
                <p className="mt-1 text-[10px] text-zinc-500">{subtitle}</p>
              )}
            </div>
            {actions}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
