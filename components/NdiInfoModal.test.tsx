import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NdiInfoModal } from './NdiInfoModal';

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
  // modal portals to document.body — clean any leftover nodes
  document.querySelectorAll('[data-testid="ndi-info-modal"]').forEach((n) => n.remove());
});

function baseNdiState(overrides: Partial<NdiStatus> = {}): NdiStatus {
  return {
    active: true,
    broadcastMode: true,
    resolution: '1080p',
    width: 1920,
    height: 1080,
    audioEnabled: true,
    audio: { framesPerSecond: 50, framesSent: 100, droppedFrames: 0 },
    sources: [
      { id: 'program', sourceName: 'Lumina-Program', fillKey: false, active: true, lastError: null },
      { id: 'lyrics', sourceName: 'Lumina-Lyrics', fillKey: true, active: true, lastError: null },
      { id: 'lowerThirds', sourceName: 'Lumina-LowerThirds', fillKey: true, active: true, lastError: null },
    ],
    ...overrides,
  };
}

function menuState(overrides: Partial<ToolsNdiMenuState> = {}): ToolsNdiMenuState {
  return {
    active: true,
    broadcastMode: true,
    audioEnabled: true,
    resolution: '1080p',
    ...overrides,
  };
}

const baseProps = {
  onClose: vi.fn(),
  onToggleActive: vi.fn(),
  onToggleBroadcast: vi.fn(),
  onToggleAudio: vi.fn(),
  onSetResolution: vi.fn(),
};

function render(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

function modal() {
  return document.querySelector('[data-testid="ndi-info-modal"]');
}

describe('NdiInfoModal', () => {
  beforeEach(() => {
    Object.values(baseProps).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) (fn as ReturnType<typeof vi.fn>).mockReset();
    });
  });

  it('renders nothing when open is false', () => {
    render(<NdiInfoModal open={false} ndiState={baseNdiState()} menuState={menuState()} {...baseProps} />);
    expect(modal()).toBeNull();
  });

  it('renders descriptive text for each setting', () => {
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} />);
    const text = modal()?.textContent || '';
    expect(text).toMatch(/Broadcast Mode/);
    expect(text).toMatch(/transparent Lumina-Lyrics/);
    expect(text).toMatch(/Resolution/);
    expect(text).toMatch(/1080p is the safe default/);
    expect(text).toMatch(/Embed Program Audio/);
    expect(text).toMatch(/YouTube, Vimeo, and SoundCloud/);
  });

  it('shows the live badge when NDI is active', () => {
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} />);
    expect(modal()?.textContent).toMatch(/Live/);
  });

  it('shows Off when NDI is inactive', () => {
    render(<NdiInfoModal open ndiState={baseNdiState({ active: false })} menuState={menuState({ active: false })} {...baseProps} />);
    expect(modal()?.textContent).toMatch(/Off/);
  });

  it('lists sources when NDI is active', () => {
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} />);
    const text = modal()?.textContent || '';
    expect(text).toMatch(/Lumina-Program/);
    expect(text).toMatch(/Lumina-Lyrics/);
    expect(text).toMatch(/Lumina-LowerThirds/);
  });

  it('hides source list section when NDI is inactive', () => {
    render(<NdiInfoModal open ndiState={baseNdiState({ active: false })} menuState={menuState({ active: false })} {...baseProps} />);
    // Descriptive copy mentions 'Lumina-Program' once; the source-list
    // section adds a 'SOURCES' header — present only when active.
    expect(modal()?.textContent).not.toMatch(/Sources/);
  });

  it('Close button invokes onClose', () => {
    const onClose = vi.fn();
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} onClose={onClose} />);
    const btn = Array.from(modal()?.querySelectorAll('button') || []).find((b) => b.textContent?.trim() === 'Close');
    act(() => {
      btn?.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape key invokes onClose', () => {
    const onClose = vi.fn();
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} onClose={onClose} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders audio state when audioEnabled', () => {
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} />);
    expect(modal()?.textContent).toMatch(/Program Audio/);
    expect(modal()?.textContent).toMatch(/50 fps/);
  });

  it('renders iframe warning in audio row when audioWarningCode=iframe-media', () => {
    render(<NdiInfoModal open ndiState={baseNdiState()} menuState={menuState()} {...baseProps} audioWarningCode="iframe-media" />);
    expect(modal()?.textContent).toMatch(/Iframe/);
  });
});
