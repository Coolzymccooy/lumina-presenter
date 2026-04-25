import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NdiStatusBadge } from './NdiStatusBadge';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function baseState(overrides: Partial<NdiStatus> = {}): NdiStatus {
  return {
    active: true,
    broadcastMode: true,
    resolution: '1080p',
    width: 1920,
    height: 1080,
    audioEnabled: true,
    audio: { framesPerSecond: 50, framesSent: 1000, droppedFrames: 0 },
    sources: [
      { id: 'program', sourceName: 'Lumina-Program', fillKey: false, active: true, lastError: null },
      { id: 'lyrics', sourceName: 'Lumina-Lyrics', fillKey: true, active: true, lastError: null },
      { id: 'lowerThirds', sourceName: 'Lumina-LowerThirds', fillKey: true, active: true, lastError: null },
    ],
    ...overrides,
  };
}

function render(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

function badge() {
  return container.querySelector('[data-testid="ndi-status-badge"]');
}

function source(id: string) {
  return container.querySelector(`[data-source="${id}"]`);
}

function audio() {
  return container.querySelector('[data-testid="ndi-status-audio"]');
}

describe('NdiStatusBadge', () => {
  it('renders a compact NDI OFF pill when NDI is inactive', () => {
    render(<NdiStatusBadge ndiState={baseState({ active: false })} audioEnabled />);
    const el = badge();
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-active')).toBe('false');
    expect(el?.textContent).toMatch(/off/i);
    // No per-source rows in OFF state
    expect(source('program')).toBeNull();
    expect(audio()).toBeNull();
  });

  it('shows all three sources in broadcast mode', () => {
    render(<NdiStatusBadge ndiState={baseState()} audioEnabled />);
    expect(source('program')).not.toBeNull();
    expect(source('lyrics')).not.toBeNull();
    expect(source('lowerThirds')).not.toBeNull();
  });

  it('shows only program when broadcast mode is off', () => {
    render(<NdiStatusBadge ndiState={baseState({ broadcastMode: false })} audioEnabled />);
    expect(source('program')).not.toBeNull();
    expect(source('lyrics')).toBeNull();
    expect(source('lowerThirds')).toBeNull();
  });

  it('marks an inactive source with data-active=false', () => {
    render(<NdiStatusBadge
      ndiState={baseState({
        sources: [
          { id: 'program', sourceName: 'Lumina-Program', fillKey: false, active: true, lastError: null },
          { id: 'lyrics', sourceName: 'Lumina-Lyrics', fillKey: true, active: false, lastError: null },
          { id: 'lowerThirds', sourceName: 'Lumina-LowerThirds', fillKey: true, active: true, lastError: null },
        ],
      })}
      audioEnabled
    />);
    expect(source('program')?.getAttribute('data-active')).toBe('true');
    expect(source('lyrics')?.getAttribute('data-active')).toBe('false');
    expect(source('lowerThirds')?.getAttribute('data-active')).toBe('true');
  });

  it('marks a source with lastError via data-error=true', () => {
    render(<NdiStatusBadge
      ndiState={baseState({
        sources: [
          { id: 'program', sourceName: 'Lumina-Program', fillKey: false, active: false, lastError: 'Sender init failed' },
          { id: 'lyrics', sourceName: 'Lumina-Lyrics', fillKey: true, active: true, lastError: null },
          { id: 'lowerThirds', sourceName: 'Lumina-LowerThirds', fillKey: true, active: true, lastError: null },
        ],
      })}
      audioEnabled
    />);
    expect(source('program')?.getAttribute('data-error')).toBe('true');
    expect(source('lyrics')?.getAttribute('data-error')).toBe('false');
  });

  it('renders audio fps when audio is live', () => {
    render(<NdiStatusBadge ndiState={baseState()} audioEnabled />);
    expect(audio()?.getAttribute('data-state')).toBe('live');
    expect(audio()?.textContent).toMatch(/50 fps/i);
  });

  it('renders AUDIO OFF when audioEnabled is false on the runtime state', () => {
    render(<NdiStatusBadge
      ndiState={baseState({ audioEnabled: false, audio: null })}
      audioEnabled={false}
    />);
    expect(audio()?.getAttribute('data-state')).toBe('off');
    expect(audio()?.textContent).toMatch(/audio off/i);
  });

  it('renders IFRAME warning state when audioWarningCode is iframe-media', () => {
    render(<NdiStatusBadge
      ndiState={baseState()}
      audioEnabled
      audioWarningCode="iframe-media"
    />);
    expect(audio()?.getAttribute('data-state')).toBe('warning');
    expect(audio()?.textContent).toMatch(/iframe/i);
  });

  it('renders SILENT state when audio is enabled but no frames are flowing', () => {
    render(<NdiStatusBadge
      ndiState={baseState({ audio: { framesPerSecond: 0, framesSent: 0, droppedFrames: 0 } })}
      audioEnabled
    />);
    expect(audio()?.getAttribute('data-state')).toBe('silent');
    expect(audio()?.textContent).toMatch(/silent/i);
  });

  it('tooltip summarizes source list + audio state', () => {
    render(<NdiStatusBadge ndiState={baseState()} audioEnabled />);
    const title = badge()?.getAttribute('title') || '';
    expect(title).toMatch(/Lumina-Program/);
    expect(title).toMatch(/Lumina-Lyrics/);
    expect(title).toMatch(/Lumina-LowerThirds/);
    expect(title).toMatch(/Audio: 50 fps/);
  });
});
