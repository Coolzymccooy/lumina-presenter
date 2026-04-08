import React from 'react';

interface StageLyricsConfidenceProps {
  nextSlideContent: string;
  compact?: boolean;
}

const extractFirstLine = (text: string): string => {
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim();
  const lines = stripped.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines[0] ?? '';
};

export const StageLyricsConfidence: React.FC<StageLyricsConfidenceProps> = ({
  nextSlideContent,
  compact = false,
}) => {
  const firstLine = extractFirstLine(nextSlideContent);
  if (!firstLine) return null;

  return (
    <div className="mt-2 pt-2 border-t border-zinc-800/50">
      <div className="text-[9px] uppercase tracking-[0.22em] font-black text-purple-400/60 mb-1">
        Next Line
      </div>
      <div
        className={`${compact ? 'text-sm' : 'text-base'} font-medium text-purple-300/40 leading-snug italic overflow-hidden`}
        style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
        title={firstLine}
      >
        {firstLine}
      </div>
    </div>
  );
};
