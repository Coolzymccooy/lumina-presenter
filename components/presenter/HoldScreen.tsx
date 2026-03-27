import React from 'react';

type HoldScreenView = 'blackout' | 'clear' | 'logo';

interface HoldScreenProps {
  view: HoldScreenView;
  churchName?: string;
  compact?: boolean;
}

export const HoldScreen: React.FC<HoldScreenProps> = ({ view, churchName, compact = false }) => {
  if (view === 'blackout') {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-mono uppercase tracking-[0.25em] text-zinc-600`}>
          BLACKOUT ACTIVE
        </div>
      </div>
    );
  }

  if (view === 'clear') {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="text-center px-6">
          <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-[0.3em] text-zinc-600`}>
            Clear
          </div>
          <div className={`${compact ? 'mt-2 text-[10px]' : 'mt-3 text-xs'} font-mono uppercase tracking-[0.25em] text-zinc-500`}>
            WAITING FOR LIVE CONTENT
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.32),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.2),transparent_34%),linear-gradient(180deg,#111827,#09090b)] flex items-center justify-center">
      <div className="text-center px-6">
        <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-[0.36em] text-cyan-200/75`}>
          Lumina
        </div>
        <div className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-3xl'} font-black tracking-tight text-white`}>
          {churchName?.trim() || 'Presenter Ready'}
        </div>
        <div className={`${compact ? 'mt-2 text-[9px]' : 'mt-3 text-xs'} uppercase tracking-[0.28em] text-zinc-300/75`}>
          Logo Hold
        </div>
      </div>
    </div>
  );
};
