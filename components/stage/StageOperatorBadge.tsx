import React from 'react';

interface StageOperatorBadgeProps {
  operatorCount: number;
  sessionId?: string;
}

export const StageOperatorBadge: React.FC<StageOperatorBadgeProps> = ({
  operatorCount,
  sessionId,
}) => {
  if (operatorCount <= 1) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-950/40 px-2.5 py-1 backdrop-blur-sm"
      title={sessionId ? `Session: ${sessionId}` : undefined}
    >
      <div className="relative h-1.5 w-1.5 shrink-0">
        <div className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-60" />
        <div className="relative rounded-full bg-violet-400 h-1.5 w-1.5" />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-violet-300">
        {operatorCount} Operators
      </span>
    </div>
  );
};
