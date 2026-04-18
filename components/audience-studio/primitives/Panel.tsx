import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function Panel({ children, className = '', padded = true }: PanelProps) {
  const pad = padded ? 'p-4' : '';
  return (
    <div
      className={`rounded-xl bg-[#111827] border border-[#1F2937] ${pad} ${className}`}
    >
      {children}
    </div>
  );
}
