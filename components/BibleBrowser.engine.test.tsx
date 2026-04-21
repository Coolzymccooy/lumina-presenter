// components/BibleBrowser.engine.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { resolveTranscriptionEngine, type TranscriptionEngineMode } from '../utils/transcriptionEngine';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CollapsiblePanel } from './ui/CollapsiblePanel';

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
  beforeEach(() => {
    // Clear localStorage to ensure defaultCollapsed={true} takes effect
    localStorage.removeItem('lumina.panel.bible-audio-source');
    localStorage.removeItem('lumina.panel.bible-capture-mode');
    localStorage.removeItem('lumina.panel.bible-speech-dialect');
  });

  describe('CollapsiblePanel behavior', () => {
    it('renders three new panels with correct attributes and defaultCollapsed=true', () => {
      act(() => {
        root.render(
          <>
            <CollapsiblePanel
              id="bible-audio-source"
              title="Audio Source"
              defaultCollapsed={true}
            >
              <div>Audio content</div>
            </CollapsiblePanel>
            <CollapsiblePanel
              id="bible-capture-mode"
              title="Capture Mode"
              defaultCollapsed={true}
            >
              <div>Capture content</div>
            </CollapsiblePanel>
            <CollapsiblePanel
              id="bible-speech-dialect"
              title="Speech Dialect"
              defaultCollapsed={true}
            >
              <div>Dialect content</div>
            </CollapsiblePanel>
          </>
        );
      });

      // Verify all three panels are rendered with correct attributes
      const audioPanel = container.querySelector('[data-collapsible-id="bible-audio-source"]');
      const capturePanel = container.querySelector('[data-collapsible-id="bible-capture-mode"]');
      const dialectPanel = container.querySelector('[data-collapsible-id="bible-speech-dialect"]');

      expect(audioPanel).not.toBeNull();
      expect(audioPanel?.getAttribute('data-collapsed')).toBe('true');

      expect(capturePanel).not.toBeNull();
      expect(capturePanel?.getAttribute('data-collapsed')).toBe('true');

      expect(dialectPanel).not.toBeNull();
      expect(dialectPanel?.getAttribute('data-collapsed')).toBe('true');
    });
  });

  describe('Source-level regression guards', () => {
    const bibleBrowserSrc = readFileSync(
      resolve(__dirname, 'BibleBrowser.tsx'),
      'utf8'
    );

    it('uses new bible-audio-source panel id', () => {
      expect(bibleBrowserSrc).toContain('id="bible-audio-source"');
    });

    it('uses new bible-capture-mode panel id', () => {
      expect(bibleBrowserSrc).toContain('id="bible-capture-mode"');
    });

    it('uses new bible-speech-dialect panel id', () => {
      expect(bibleBrowserSrc).toContain('id="bible-speech-dialect"');
    });

    it('no longer references old bible-auto-visionary panel id', () => {
      expect(bibleBrowserSrc).not.toContain('bible-auto-visionary');
    });

    it('each new panel uses defaultCollapsed={true}', () => {
      // Check that defaultCollapsed={true} appears multiple times (at least 3)
      const matches = bibleBrowserSrc.match(/defaultCollapsed=\{true\}/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });
  });
});
