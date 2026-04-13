import React from 'react';
import { QrCodeIcon, MonitorIcon, SparklesIcon } from '../Icons';

export interface RightDockProps {
  isOpen: boolean;
  machineMode: boolean;
  onToggleMachineMode: () => void;
  onOpenConnect: (panel: 'audience' | 'aether') => void;
  onOpenAI: () => void;
  hasElectronDisplayControl?: boolean;
  onOpenDisplaySetup?: () => void;
  desktopServiceState?: { outputOpen: boolean; stageOpen: boolean };
}

export function RightDock({
  isOpen,
  machineMode,
  onToggleMachineMode,
  onOpenConnect,
  onOpenAI,
  hasElectronDisplayControl = false,
  onOpenDisplaySetup,
  desktopServiceState,
}: RightDockProps) {
  if (!isOpen) return null;

  return (
    <aside className="flex flex-col w-56 shrink-0 border-l border-zinc-800 bg-zinc-950/80 backdrop-blur-md z-[90]">
      {/* Dock header */}
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">QUICK ACTIONS</span>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {/* CONNECT */}
        <button
          data-testid="rightdock-connect-btn"
          onClick={() => onOpenConnect('audience')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/10 border border-blue-900/30 text-blue-400 hover:bg-blue-600/20 text-[10px] font-black tracking-widest transition-all active:scale-95 text-left"
        >
          <QrCodeIcon className="w-4 h-4 shrink-0" />
          <div className="flex flex-col">
            <span>CONNECT</span>
            <span className="text-[8px] text-blue-500/70 font-semibold normal-case tracking-normal">Audience devices</span>
          </div>
        </button>

        {/* AETHER */}
        <button
          data-testid="rightdock-aether-btn"
          onClick={() => onOpenConnect('aether')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cyan-600/10 border border-cyan-900/30 text-cyan-300 hover:bg-cyan-600/20 text-[10px] font-black tracking-widest transition-all active:scale-95 text-left"
        >
          <MonitorIcon className="w-4 h-4 shrink-0" />
          <div className="flex flex-col">
            <span>AETHER</span>
            <span className="text-[8px] text-cyan-500/70 font-semibold normal-case tracking-normal">Multi-screen bridge</span>
          </div>
        </button>

        {/* AI ASSIST */}
        <button
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

        {/* START SERVICE / MACHINE MODE */}
        {hasElectronDisplayControl ? (
          <button
            data-testid="rightdock-start-service-btn"
            onClick={onOpenDisplaySetup}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border text-left ${
              desktopServiceState?.outputOpen || desktopServiceState?.stageOpen
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="text-base leading-none">⚡</span>
            <div className="flex flex-col">
              <span>START SERVICE</span>
              <span className={`text-[8px] font-semibold normal-case tracking-normal ${desktopServiceState?.outputOpen || desktopServiceState?.stageOpen ? 'text-cyan-200/70' : 'text-zinc-600'}`}>
                {desktopServiceState?.outputOpen || desktopServiceState?.stageOpen ? 'Service running' : 'Launch display outputs'}
              </span>
            </div>
          </button>
        ) : (
          <button
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
    </aside>
  );
}
