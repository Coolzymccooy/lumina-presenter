import React, { useEffect, useRef } from 'react';

interface StageSttPanelProps {
  isRecording: boolean;
  transcript: string;
  interimText?: string;
  onToggleRecording: () => void;
  onClose: () => void;
  compact?: boolean;
}

export const StageSttPanel: React.FC<StageSttPanelProps> = ({
  isRecording,
  transcript,
  interimText = '',
  onToggleRecording,
  onClose,
  compact = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  const rightOffset = compact ? 'right-4' : 'right-6';
  const leftOffset = compact ? 'left-4' : 'left-6';
  const bottomOffset = compact ? 'bottom-4' : 'bottom-6';

  return (
    <div className={`absolute ${bottomOffset} ${leftOffset} ${rightOffset} z-40 bg-zinc-950/95 border border-zinc-700 rounded-2xl shadow-2xl backdrop-blur-md`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full shrink-0 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}
          />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Sermon Recording {isRecording ? '— Live' : '— Paused'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleRecording}
            className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border transition-colors ${
              isRecording
                ? 'border-red-600 text-red-400 bg-red-950/40 hover:bg-red-950/60'
                : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
            }`}
            title={isRecording ? 'Pause recording' : 'Start recording'}
          >
            {isRecording ? 'Pause' : 'Record'}
          </button>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-xl leading-none"
            title="Close sermon recording (T)"
            aria-label="Close sermon recording panel"
          >
            ×
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="px-4 py-3 max-h-28 overflow-y-auto text-sm leading-relaxed">
        {!transcript && !interimText ? (
          <div className="text-zinc-600 italic text-sm">
            {isRecording
              ? 'Listening — transcript will appear here...'
              : 'Press Record to capture sermon notes via speech recognition.'}
          </div>
        ) : (
          <>
            <span className="text-zinc-200">{transcript}</span>
            {interimText && (
              <span className="text-zinc-500 italic"> {interimText}</span>
            )}
          </>
        )}
      </div>

      {transcript && (
        <div className="px-4 pb-2 flex justify-end">
          <span className="text-[9px] text-zinc-700">
            {transcript.split(/\s+/).filter(Boolean).length} words captured
          </span>
        </div>
      )}
    </div>
  );
};
