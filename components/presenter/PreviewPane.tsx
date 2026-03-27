import React from 'react';

interface PreviewPaneProps {
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  stage: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  title,
  subtitle,
  badge,
  actions,
  stage,
  footer,
  className = '',
}) => {
  return (
    <div data-testid="presenter-preview-pane" className={`h-full min-h-0 bg-zinc-950 flex flex-col ${className}`}>
      <div className="shrink-0 border-b border-zinc-900 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">Canvas</h3>
              {badge}
            </div>
            <div className="mt-1 truncate text-[1.7rem] font-black tracking-tight text-white">{title}</div>
            {subtitle && <div className="mt-1.5">{subtitle}</div>}
          </div>
          {actions}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {stage}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-zinc-900">
          {footer}
        </div>
      )}
    </div>
  );
};
