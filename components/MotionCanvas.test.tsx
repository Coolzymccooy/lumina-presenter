import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// jsdom does not implement ResizeObserver/IntersectionObserver — provide noop
// stubs so MotionCanvas's effects don't throw on mount.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || NoopObserver;
(globalThis as any).IntersectionObserver = (globalThis as any).IntersectionObserver || NoopObserver;

// Stub the MotionEngine so we can drive its behavior deterministically.
// renderOnce returns true to simulate a successful first-frame render —
// MotionCanvas should then keep the canvas at opacity 1 even when isPlaying
// is false (the LIVE NOW thumbnail case).
const engineCalls: string[] = [];
let renderOnceResult = true;

vi.mock('../services/motionEngine', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    MotionEngine: class {
      attach() { engineCalls.push('attach'); }
      detach() { engineCalls.push('detach'); }
      loadScene() { engineCalls.push('loadScene'); return true; }
      renderOnce() { engineCalls.push('renderOnce'); return renderOnceResult; }
      start() { engineCalls.push('start'); }
      stop() { engineCalls.push('stop'); }
      resize() { engineCalls.push('resize'); }
    },
  };
});

import { MotionCanvas } from './MotionCanvas';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  engineCalls.length = 0;
  renderOnceResult = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props: React.ComponentProps<typeof MotionCanvas>) {
  act(() => {
    root.render(<MotionCanvas {...props} />);
  });
}

describe('MotionCanvas', () => {
  it('renders the canvas at opacity 1 once a frame has been drawn, even when isPlaying is false', () => {
    // Regression: LIVE NOW / Stage Preview thumbnails passed isPlaying={false}
    // to save CPU. The previous opacity rule (`shouldAnimate && hasRenderedFrame`)
    // hid the canvas in that mode, so motion BGs rendered as black squares behind
    // the poster. The fix keeps the canvas visible whenever a frame has been
    // drawn, which is enough to show the static first frame in thumbnails.
    render({ motionUrl: 'motion://sermon-clean', isPlaying: false });
    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    expect(canvas).not.toBeNull();
    expect(canvas?.style.opacity).toBe('1');
  });

  it('still renders the canvas at opacity 1 when isPlaying is true (no regression for live output)', () => {
    render({ motionUrl: 'motion://sermon-clean', isPlaying: true });
    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    expect(canvas?.style.opacity).toBe('1');
  });

  it('hides the canvas (opacity 0) when no frame has rendered yet, so the poster shows underneath', () => {
    renderOnceResult = false;
    render({ motionUrl: 'motion://sermon-clean', isPlaying: false });
    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    expect(canvas?.style.opacity).toBe('0');
  });

  it('always renders the poster div behind the canvas so a fallback is visible while loading', () => {
    render({ motionUrl: 'motion://sermon-clean', isPlaying: false });
    // The poster is rendered as a div with aria-hidden="true" sitting behind
    // the canvas. jsdom drops `url(data:...)` from inline-style serialisation
    // so we just verify the element exists with the expected structure.
    const poster = container.querySelector('div[aria-hidden="true"]') as HTMLDivElement | null;
    expect(poster).not.toBeNull();
    expect(poster?.style.position).toBe('absolute');
  });

  it('does not call engine.start when isPlaying is false (avoids burning CPU on every thumbnail)', () => {
    render({ motionUrl: 'motion://sermon-clean', isPlaying: false });
    expect(engineCalls).not.toContain('start');
    // engine.stop is called as the cleanup path for the start/stop effect, which is fine.
  });

  it('calls engine.start when isPlaying is true', () => {
    render({ motionUrl: 'motion://sermon-clean', isPlaying: true });
    expect(engineCalls).toContain('start');
  });
});
