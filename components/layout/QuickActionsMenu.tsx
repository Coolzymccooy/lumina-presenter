import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { QrCodeIcon, MonitorIcon, SparklesIcon } from '../Icons';

export type DesktopServiceState = { outputOpen: boolean; stageOpen: boolean };

export interface QuickActionsMenuProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;

  onOpenConnect: (mode: 'audience' | 'aether') => void;
  onOpenAI: () => void;

  hasElectronDisplayControl: boolean;
  desktopServiceState: DesktopServiceState | null;
  onStartService: () => void;
  onStopService: () => void;

  machineMode: boolean;
  onToggleMachineMode: () => void;
}

export function QuickActionsMenu(props: QuickActionsMenuProps) {
  const {
    anchorRef,
    isOpen,
    onClose,
    onOpenConnect,
    onOpenAI,
    hasElectronDisplayControl,
    desktopServiceState,
    onStartService,
    machineMode,
    onToggleMachineMode,
  } = props;

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !pos) return null;

  const isServiceRunning = desktopServiceState?.outputOpen || desktopServiceState?.stageOpen;

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      role="menu"
      data-testid="quick-actions-menu"
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 200 }}
      className="w-56 rounded-md border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/50 p-2"
    >
      <div className="px-1 pb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">QUICK ACTIONS</span>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          role="menuitem"
          data-testid="quick-actions-connect-btn"
          onClick={() => onOpenConnect('audience')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/10 border border-blue-900/30 text-blue-400 hover:bg-blue-600/20 text-[10px] font-black tracking-widest transition-all active:scale-95 text-left"
        >
          <QrCodeIcon className="w-4 h-4 shrink-0" />
          <div className="flex flex-col">
            <span>CONNECT</span>
            <span className="text-[8px] text-blue-500/70 font-semibold normal-case tracking-normal">Audience devices</span>
          </div>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="quick-actions-aether-btn"
          onClick={() => onOpenConnect('aether')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cyan-600/10 border border-cyan-900/30 text-cyan-300 hover:bg-cyan-600/20 text-[10px] font-black tracking-widest transition-all active:scale-95 text-left"
        >
          <MonitorIcon className="w-4 h-4 shrink-0" />
          <div className="flex flex-col">
            <span>AETHER</span>
            <span className="text-[8px] text-cyan-500/70 font-semibold normal-case tracking-normal">Multi-screen bridge</span>
          </div>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="quick-actions-ai-btn"
          onClick={onOpenAI}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/30 text-zinc-300 hover:text-white hover:bg-zinc-800 text-[10px] font-black tracking-widest transition-all text-left"
        >
          <SparklesIcon className="w-4 h-4 shrink-0 text-purple-400" />
          <div className="flex flex-col">
            <span>AI ASSIST</span>
            <span className="text-[8px] text-zinc-500 font-semibold normal-case tracking-normal">Gemini / lyrics / help</span>
          </div>
        </button>
        <div className="h-px bg-zinc-800 my-1" />
        {hasElectronDisplayControl ? (
          <button
            type="button"
            role="menuitem"
            data-testid="quick-actions-start-service-btn"
            onClick={onStartService}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border text-left ${
              isServiceRunning
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="text-base leading-none">⚡</span>
            <div className="flex flex-col">
              <span>START SERVICE</span>
              <span className={`text-[8px] font-semibold normal-case tracking-normal ${isServiceRunning ? 'text-cyan-200/70' : 'text-zinc-600'}`}>
                {isServiceRunning ? 'Service running' : 'Launch display outputs'}
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            data-testid="quick-actions-machine-mode-btn"
            onClick={onToggleMachineMode}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border text-left ${
              machineMode
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="text-base leading-none">⚡</span>
            <div className="flex flex-col">
              <span>MACHINE MODE</span>
              <span className={`text-[8px] font-semibold normal-case tracking-normal ${machineMode ? 'text-cyan-200/70' : 'text-zinc-600'}`}>
                {machineMode ? 'Active — minimal UI' : 'Distraction-free view'}
              </span>
            </div>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
