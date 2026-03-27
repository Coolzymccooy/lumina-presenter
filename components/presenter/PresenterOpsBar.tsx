import React from 'react';

interface PresenterOpsBarProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

export const PresenterOpsBar: React.FC<PresenterOpsBarProps> = ({ title, badge, children, className = '' }) => {
  return (
    <div className={`rounded-xl border border-zinc-800/80 bg-[linear-gradient(160deg,rgba(28,28,34,0.95),rgba(10,10,14,1))] p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[8px] uppercase tracking-[0.22em] text-zinc-500 font-black">{title}</span>
        {badge && (
          <span className="rounded-full border border-cyan-800/50 bg-cyan-950/30 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.16em] text-cyan-300">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};
