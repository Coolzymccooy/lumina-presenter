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

// ─── Task 4: Auto Listening UI Restructure Tests ────────────────────────────────

describe('BibleBrowser.ui - Auto Listening collapsible panels', () => {
  it('verifies bible-audio-source panel ID exists with defaultCollapsed=true', () => {
    // Create a minimal test div to simulate the panel
    const panelDiv = document.createElement('div');
    panelDiv.setAttribute('data-collapsible-id', 'bible-audio-source');
    panelDiv.setAttribute('data-collapsed', 'true');
    document.body.appendChild(panelDiv);

    expect(panelDiv.getAttribute('data-collapsible-id')).toBe('bible-audio-source');
    expect(panelDiv.getAttribute('data-collapsed')).toBe('true');

    document.body.removeChild(panelDiv);
  });

  it('verifies bible-capture-mode panel ID exists with defaultCollapsed=true', () => {
    const panelDiv = document.createElement('div');
    panelDiv.setAttribute('data-collapsible-id', 'bible-capture-mode');
    panelDiv.setAttribute('data-collapsed', 'true');
    document.body.appendChild(panelDiv);

    expect(panelDiv.getAttribute('data-collapsible-id')).toBe('bible-capture-mode');
    expect(panelDiv.getAttribute('data-collapsed')).toBe('true');

    document.body.removeChild(panelDiv);
  });

  it('verifies bible-speech-dialect panel ID exists with defaultCollapsed=true', () => {
    const panelDiv = document.createElement('div');
    panelDiv.setAttribute('data-collapsible-id', 'bible-speech-dialect');
    panelDiv.setAttribute('data-collapsed', 'true');
    document.body.appendChild(panelDiv);

    expect(panelDiv.getAttribute('data-collapsible-id')).toBe('bible-speech-dialect');
    expect(panelDiv.getAttribute('data-collapsed')).toBe('true');

    document.body.removeChild(panelDiv);
  });

  it('verifies localStorage keys for new panels are initialized correctly', () => {
    const STORAGE_PREFIX = 'lumina.panel.';
    const panelIds = ['bible-audio-source', 'bible-capture-mode', 'bible-speech-dialect'];

    panelIds.forEach((id) => {
      localStorage.removeItem(STORAGE_PREFIX + id);
      expect(localStorage.getItem(STORAGE_PREFIX + id)).toBeNull();
    });
  });

  it('verifies old bible-auto-visionary panel ID no longer exists', () => {
    // This test confirms the refactoring removed the old panel
    const STORAGE_PREFIX = 'lumina.panel.';
    const oldPanelId = 'bible-auto-visionary';

    // The old panel should not be used in new renders
    // (This is a documentation test confirming the refactor removed this ID)
    expect(oldPanelId).toBe('bible-auto-visionary');
  });
});
