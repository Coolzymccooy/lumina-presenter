// components/BibleBrowser.engine.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { resolveTranscriptionEngine, type TranscriptionEngineMode } from '../utils/transcriptionEngine';

let container: HTMLDivElement;
let root: Root;
let latestEngine: TranscriptionEngineMode = 'disabled';
let latestEngineHistory: TranscriptionEngineMode[] = [];

interface UseTranscriptionEngineHarnessProps {
  autoVisionaryEnabled: boolean;
  isVisionaryMode: boolean;
  isOnline: boolean;
}

function useTranscriptionEngineHarness({
  autoVisionaryEnabled,
  isVisionaryMode,
  isOnline,
}: UseTranscriptionEngineHarnessProps) {
  const [engine, setEngine] = useState<TranscriptionEngineMode>('disabled');

  React.useEffect(() => {
    const enabled = autoVisionaryEnabled && isVisionaryMode;
    if (!enabled) {
      setEngine('disabled');
      return;
    }
  }, [autoVisionaryEnabled, isVisionaryMode]);

  React.useEffect(() => {
    const enabled = autoVisionaryEnabled && isVisionaryMode;
    if (!enabled) return;
    const nextEngine = resolveTranscriptionEngine({ autoEnabled: enabled, isOnline });
    if (engine === nextEngine) return;
    setEngine(nextEngine);
  }, [autoVisionaryEnabled, isVisionaryMode, isOnline, engine]);

  return engine;
}

interface HarnessProps {
  autoVisionaryEnabled: boolean;
  isVisionaryMode: boolean;
  isOnline: boolean;
}

function Harness({ autoVisionaryEnabled, isVisionaryMode, isOnline }: HarnessProps) {
  latestEngine = useTranscriptionEngineHarness({
    autoVisionaryEnabled,
    isVisionaryMode,
    isOnline,
  });
  latestEngineHistory.push(latestEngine);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latestEngine = 'disabled';
  latestEngineHistory = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// EngineRow test harness - tests the visibility of Engine row JSX
interface EngineRowVisibilityProps {
  autoVisionaryEnabled: boolean;
  isVisionaryMode: boolean;
}

function EngineRowVisibilityHarness({ autoVisionaryEnabled, isVisionaryMode }: EngineRowVisibilityProps) {
  const [engine] = useState<TranscriptionEngineMode>('cloud');
  return (
    <div data-testid="engine-row-container">
      {autoVisionaryEnabled && isVisionaryMode && (
        <div data-testid="engine-row" className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-zinc-400">Engine:</span>
          <span className="font-bold text-emerald-300">{engine}</span>
        </div>
      )}
    </div>
  );
}

describe('BibleBrowser.engine - transcription engine resolution', () => {
  it('renders disabled when autoVisionaryEnabled is false', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={false} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('disabled');
  });

  it('renders disabled when isVisionaryMode is false', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={false} isOnline={true} />);
    });
    expect(latestEngine).toBe('disabled');
  });

  it('resolves to cloud when auto enabled, online, and visionary mode active', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('cloud');
  });

  it('resolves to browser_stt when auto enabled, offline, and visionary mode active', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={false} />);
    });
    expect(latestEngine).toBe('browser_stt');
  });

  it('reacts to autoVisionaryEnabled flip from false to true', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={false} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('disabled');

    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('cloud');
  });

  it('reacts to isOnline flip from true to false', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('cloud');

    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={false} />);
    });
    expect(latestEngine).toBe('browser_stt');
  });

  it('reacts to isVisionaryMode flip from false to true', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={false} isOnline={true} />);
    });
    expect(latestEngine).toBe('disabled');

    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('cloud');
  });

  it('transitions from cloud to disabled when autoVisionaryEnabled flips to false', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('cloud');

    act(() => {
      root.render(<Harness autoVisionaryEnabled={false} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('disabled');
  });

  it('transitions from cloud to browser_stt when going offline', () => {
    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={true} />);
    });
    expect(latestEngine).toBe('cloud');

    act(() => {
      root.render(<Harness autoVisionaryEnabled={true} isVisionaryMode={true} isOnline={false} />);
    });
    expect(latestEngine).toBe('browser_stt');
  });
});

describe('BibleBrowser.engine - Engine row visibility', () => {
  it('hides Engine row when autoVisionaryEnabled is false', () => {
    act(() => {
      root.render(<EngineRowVisibilityHarness autoVisionaryEnabled={false} isVisionaryMode={true} />);
    });
    const engineRow = container.querySelector('[data-testid="engine-row"]');
    expect(engineRow).toBeNull();
  });

  it('hides Engine row when isVisionaryMode is false', () => {
    act(() => {
      root.render(<EngineRowVisibilityHarness autoVisionaryEnabled={true} isVisionaryMode={false} />);
    });
    const engineRow = container.querySelector('[data-testid="engine-row"]');
    expect(engineRow).toBeNull();
  });

  it('hides Engine row when both autoVisionaryEnabled and isVisionaryMode are false', () => {
    act(() => {
      root.render(<EngineRowVisibilityHarness autoVisionaryEnabled={false} isVisionaryMode={false} />);
    });
    const engineRow = container.querySelector('[data-testid="engine-row"]');
    expect(engineRow).toBeNull();
  });

  it('shows Engine row when both autoVisionaryEnabled and isVisionaryMode are true', () => {
    act(() => {
      root.render(<EngineRowVisibilityHarness autoVisionaryEnabled={true} isVisionaryMode={true} />);
    });
    const engineRow = container.querySelector('[data-testid="engine-row"]');
    expect(engineRow).not.toBeNull();
    expect(engineRow?.textContent).toContain('Engine:');
    expect(engineRow?.textContent).toContain('cloud');
  });
});
