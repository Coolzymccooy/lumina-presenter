import React from 'react';

interface SafeAreaOverlayProps {
  showGrid: boolean;
  showSafeArea: boolean;
}

export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({ showGrid, showSafeArea }) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {showGrid && (
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '10% 10%',
        }} />
      )}
      {showSafeArea && (
        <>
          <div className="absolute inset-[6%] border border-cyan-400/60 rounded-sm" />
          <div className="absolute inset-[10%] border border-amber-300/40 rounded-sm" />
        </>
      )}
    </div>
  );
};

