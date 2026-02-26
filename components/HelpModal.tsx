import React, { useMemo, useState } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

type TabId =
  | 'QUICK_START'
  | 'BUILD'
  | 'PRESENTER'
  | 'REMOTE'
  | 'SESSION_LINKING'
  | 'OUTPUT_STAGE'
  | 'SAFETY'
  | 'TROUBLE';

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('QUICK_START');

  const docs = useMemo(() => ({
    QUICK_START: {
      title: 'Quick Start',
      summary: 'Run service in 90 seconds with safe defaults.',
      steps: [
        'Login, open Workspace Settings, and set a unique Session ID (for example: main-campus-9am).',
        'Add items with +, or use TPL for templates and LYR for bulk lyrics import.',
        'Switch to PRESENT mode, click a run-sheet item, then click LAUNCH OUTPUT.',
        'Use NEXT/PREV or keyboard (Right/Left/Space) to control slides.',
        'Open STAGE DISPLAY for pastor confidence monitor.',
      ],
    },
    BUILD: {
      title: 'Build Studio',
      summary: 'Create and maintain structured service content fast.',
      steps: [
        'TPL (templates): quick bootstrap for Sunday, Youth, Prayer flows.',
        'LYR import supports three paths: paste lyrics, import Visual PowerPoint (.pptx), or import Text from PowerPoint (.pptx).',
        'Slide Editor also supports PPTX import directly: `PPTX VIS` (retain exact layout/background) and `PPTX TXT` (Lumina theme styling).',
        'Visual PowerPoint import renders each slide as an image so your original layout/design stays intact.',
        'Text PowerPoint import is fallback mode and extracts slide text + notes only.',
        'AI ASSIST: generate and reformat content blocks into projector-friendly slides.',
        'Motion/Media: attach image/video backgrounds per item.',
        'ROLLBACK: undo the most recent editing actions.',
      ],
    },
    PRESENTER: {
      title: 'Presenter Control Strip',
      summary: 'Real-time service operations for production and pastor timing.',
      steps: [
        'LOWER THIRDS toggles overlay rendering in output.',
        'Routing mode: PROJECTOR, STREAM, or LOBBY target rendering behavior.',
        'Timer: countdown/elapsed with Start, Pause, Reset controls.',
        'Cue automation: set cue seconds and toggle auto-advance.',
        'BLACKOUT immediately blanks output while preserving active slide state.',
      ],
    },
    REMOTE: {
      title: 'Pastor and Admin Remote',
      summary: 'How pastors and admins control slides from phone or secondary devices.',
      steps: [
        'Presenter owner clicks COPY REMOTE URL and shares it with trusted admins.',
        'Remote users sign in and can send NEXT/PREV/BLACKOUT only if allowlisted.',
        'Allowlist is controlled by Workspace Settings > Allowed Admin Emails.',
        'Owner account always has control; allowlisted admins can co-control same session.',
        'If remote buttons do not act, verify same Session ID on presenter and remote URL.',
      ],
    },
    SESSION_LINKING: {
      title: 'Multi-Campus Session Linking',
      summary: 'Session ID is the namespace that links presenter, output, stage, and remote together.',
      steps: [
        'Each service environment should use one Session ID (for example: campus-a-11am).',
        'All routes read that ID: /remote?session=..., /output?session=..., presenter live state.',
        'Different campuses/services should use different Session IDs to isolate control.',
        'Same Session ID means shared control/state across devices in real time.',
        'This enables parallel services without cross-campus command collisions.',
      ],
    },
    OUTPUT_STAGE: {
      title: 'Output and Stage',
      summary: 'Stable projector and stage monitor behavior.',
      steps: [
        'LAUNCH OUTPUT opens a same-origin window shell to avoid blob URL display.',
        'Browser popups must be allowed for projector/stage windows.',
        'STAGE DISPLAY supports profile modes: classic, compact, high contrast.',
        'COPY OBS URL provides authenticated output route for stream ingest.',
        'If projector opens blocked, allow popups and relaunch from presenter.',
      ],
    },
    SAFETY: {
      title: 'Guard Rails',
      summary: 'Regression safety features and recovery behaviors.',
      steps: [
        'Defensive remote-command parsing ignores malformed payloads instead of crashing.',
        'Sync failures are telemetry-logged and surfaced with non-blocking warning banners.',
        'Offline sync queue stores pending state updates and flushes on reconnect.',
        'Auth guard protects remote/output routes before session control is granted.',
        'Dev smoke-test harness is exposed as window.luminaSmokeTest() in development.',
      ],
    },
    TROUBLE: {
      title: 'Troubleshooting',
      summary: 'Fast diagnosis checklist for live issues.',
      steps: [
        'No projector window: verify popup permission and relaunch output.',
        'Remote cannot control: confirm signed-in account is owner or allowlisted.',
        'Phone cannot open URL: use local IP host (not localhost) and allow LAN in dev server.',
        'Visual PowerPoint import fails: install LibreOffice and ensure `soffice` is available on server PATH (or set `LUMINA_SOFFICE_BIN`).',
        'Sync mismatch: ensure same Session ID everywhere and check online status badge.',
        'Run smoke test in browser console: window.luminaSmokeTest().',
      ],
    },
  }), []);

  if (!isOpen) return null;

  const current = docs[activeTab];
  const tabButtons: Array<{ id: TabId; label: string }> = [
    { id: 'QUICK_START', label: 'Quick Start' },
    { id: 'BUILD', label: 'Build' },
    { id: 'PRESENTER', label: 'Presenter' },
    { id: 'REMOTE', label: 'Remote' },
    { id: 'SESSION_LINKING', label: 'Session Link' },
    { id: 'OUTPUT_STAGE', label: 'Output + Stage' },
    { id: 'SAFETY', label: 'Safety' },
    { id: 'TROUBLE', label: 'Troubleshoot' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm shadow-none w-full max-w-5xl h-[86vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950">
          <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-widest">
            <span className="w-5 h-5 rounded-sm bg-blue-600 flex items-center justify-center text-[10px] text-white">?</span>
            Documentation Hub
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs font-bold uppercase">Close</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 bg-zinc-950 border-r border-zinc-900 flex flex-col">
            {tabButtons.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l-2 ${
                  activeTab === tab.id ? 'bg-zinc-900 text-white border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-7 bg-zinc-900 text-zinc-300 leading-relaxed text-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white">{current.title}</h3>
              <p className="text-zinc-500 mt-1">{current.summary}</p>
            </div>

            <div className="space-y-3">
              {current.steps.map((step, idx) => (
                <div key={`${activeTab}-${idx}`} className="border border-zinc-800 bg-zinc-950/40 rounded-sm px-4 py-3">
                  <div className="text-[10px] tracking-wider uppercase text-blue-400 font-bold mb-1">Step {idx + 1}</div>
                  <div className="text-zinc-200">{step}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 border border-zinc-800 bg-zinc-950 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Operator Shortcuts</div>
              <div className="grid sm:grid-cols-3 gap-2 text-xs">
                <div className="border border-zinc-800 rounded-sm px-3 py-2">Next: Right / Space / PageDown</div>
                <div className="border border-zinc-800 rounded-sm px-3 py-2">Prev: Left / PageUp</div>
                <div className="border border-zinc-800 rounded-sm px-3 py-2">Blackout: B</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
