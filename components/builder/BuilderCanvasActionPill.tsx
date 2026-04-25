import React from 'react';
import { CopyIcon, EditIcon, MonitorIcon, PlayIcon, PlusIcon } from '../Icons';

interface BuilderCanvasActionPillProps {
  canAddSlide: boolean;
  canDuplicate: boolean;
  canEditLayout: boolean;
  canGoLive: boolean;
  outputLive: boolean;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onOpenFullEditor: () => void;
  onGoLive: () => void;
}

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: 'primary' | 'neutral' | 'danger';
  label: string;
  icon: React.ReactNode;
  testId?: string;
}

const PillButton: React.FC<PillButtonProps> = ({
  intent = 'neutral',
  label,
  icon,
  testId,
  className = '',
  ...props
}) => {
  const intentClass =
    intent === 'primary'
      ? 'text-cyan-100 hover:bg-cyan-500/15 focus-visible:ring-cyan-400/70 disabled:text-cyan-100/40'
      : intent === 'danger'
        ? 'text-red-100 hover:bg-red-500/18 focus-visible:ring-red-400/70 disabled:text-red-100/40'
        : 'text-zinc-200 hover:bg-white/8 focus-visible:ring-white/50 disabled:text-zinc-400/50';

  return (
    <button
      type="button"
      data-testid={testId}
      {...props}
      className={`group inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[10px] font-black uppercase tracking-[0.14em] outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed ${intentClass} ${className}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
          intent === 'primary'
            ? 'bg-cyan-500/25 text-cyan-200 group-hover:bg-cyan-400/35'
            : intent === 'danger'
              ? 'bg-red-500/25 text-red-200 group-hover:bg-red-400/40'
              : 'bg-white/10 text-zinc-200 group-hover:bg-white/15'
        }`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
};

const PillDivider: React.FC = () => (
  <span aria-hidden className="mx-0.5 h-5 w-px bg-white/10" />
);

export const BuilderCanvasActionPill: React.FC<BuilderCanvasActionPillProps> = ({
  canAddSlide,
  canDuplicate,
  canEditLayout,
  canGoLive,
  outputLive,
  onAddSlide,
  onDuplicateSlide,
  onOpenFullEditor,
  onGoLive,
}) => {
  return (
    <div
      data-testid="builder-canvas-action-pill"
      className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4"
    >
      <div className="pointer-events-auto relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-[conic-gradient(from_210deg_at_50%_50%,rgba(34,211,238,0.35),rgba(59,130,246,0.15),rgba(239,68,68,0.35),rgba(34,211,238,0.35))] blur-md opacity-70"
        />
        <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-[rgba(14,15,20,0.82)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <PillButton
            testId="builder-pill-add-slide"
            intent="primary"
            label="Add Slide"
            icon={<PlusIcon className="h-3 w-3" />}
            disabled={!canAddSlide}
            onClick={onAddSlide}
          />
          <PillButton
            testId="builder-pill-duplicate"
            label="Duplicate"
            icon={<CopyIcon className="h-3 w-3" />}
            disabled={!canDuplicate}
            onClick={onDuplicateSlide}
          />
          <PillDivider />
          <PillButton
            testId="builder-pill-full-editor"
            label="Full Editor"
            icon={<EditIcon className="h-3 w-3" />}
            disabled={!canEditLayout}
            onClick={onOpenFullEditor}
          />
          <PillDivider />
          <PillButton
            testId="builder-pill-go-live"
            intent="danger"
            label={outputLive ? 'Live On' : 'Go Live'}
            icon={outputLive ? <MonitorIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
            disabled={!canGoLive}
            onClick={onGoLive}
          />
        </div>
      </div>
    </div>
  );
};
