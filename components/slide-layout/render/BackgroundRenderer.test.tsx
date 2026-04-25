import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Mock MotionCanvas BEFORE importing the renderer so the actual canvas-driven
// implementation is not pulled in (it touches requestAnimationFrame, registers
// scenes, and would make assertions noisy).
vi.mock('../../MotionCanvas', () => ({
  MotionCanvas: (props: { motionUrl?: string; isPlaying?: boolean; className?: string }) => (
    <div
      data-testid="motion-canvas-stub"
      data-motion-url={props.motionUrl || ''}
      data-is-playing={String(props.isPlaying ?? true)}
      className={props.className}
    />
  ),
}));

// Mock the local media store so getCachedMediaAsset / getMediaAsset are
// deterministic and do not require IndexedDB.
const cachedAssets = new Map<string, { url: string; kind: 'image' | 'video' | 'other' }>();
const lookupAssets = new Map<string, { url: string; kind: 'image' | 'video' | 'other' }>();

vi.mock('../../../services/localMedia.ts', () => ({
  getCachedMediaAsset: (localUrl: string) => cachedAssets.get(localUrl) || null,
  getMediaAsset: async (localUrl: string) => lookupAssets.get(localUrl) || null,
}));

import { BackgroundRenderer } from './BackgroundRenderer';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  cachedAssets.clear();
  lookupAssets.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props: React.ComponentProps<typeof BackgroundRenderer>) {
  act(() => {
    root.render(<BackgroundRenderer {...props} />);
  });
}

describe('BackgroundRenderer', () => {
  it('renders a plain black placeholder when no backgroundUrl is provided', () => {
    render({ backgroundUrl: '' });
    const div = container.firstElementChild as HTMLElement | null;
    expect(div?.tagName).toBe('DIV');
    expect(div?.className).toContain('bg-black');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[data-testid="motion-canvas-stub"]')).toBeNull();
  });

  it('renders MotionCanvas for motion:// URLs (regression: avoids ERR_UNKNOWN_URL_SCHEME from <img src="motion://...">)', () => {
    render({ backgroundUrl: 'motion://sermon-clean', mediaType: 'motion' });
    const stub = container.querySelector('[data-testid="motion-canvas-stub"]');
    expect(stub).not.toBeNull();
    expect(stub?.getAttribute('data-motion-url')).toBe('motion://sermon-clean');
    // Critical: no <img> attempt that would trigger ERR_UNKNOWN_URL_SCHEME
    expect(container.querySelector('img')).toBeNull();
  });

  it('passes isPlaying through to MotionCanvas', () => {
    render({ backgroundUrl: 'motion://prayer-glow', mediaType: 'motion', isPlaying: false });
    const stub = container.querySelector('[data-testid="motion-canvas-stub"]');
    expect(stub?.getAttribute('data-is-playing')).toBe('false');
  });

  it('renders motion canvas even when caller forgets to set mediaType (URL alone is enough)', () => {
    render({ backgroundUrl: 'motion://royal-worship' });
    expect(container.querySelector('[data-testid="motion-canvas-stub"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders an <img> for data: URIs (Quick gradient swatches and Bible split-panel SVG)', () => {
    const dataUri = 'data:image/svg+xml;utf8,%3Csvg/%3E';
    render({ backgroundUrl: dataUri, mediaType: 'image' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(dataUri);
  });

  it('renders an <img> for remote https URLs (Pexels images)', () => {
    const url = 'https://images.pexels.com/photos/1/test.jpg';
    render({ backgroundUrl: url, mediaType: 'image' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(url);
  });

  it('renders a <video> when mediaType is video', () => {
    const url = 'https://example.com/clip.mp4';
    render({ backgroundUrl: url, mediaType: 'video' });
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe(url);
  });

  it('renders a coloured <div> when mediaType is color', () => {
    render({ backgroundUrl: '#1d4ed8', mediaType: 'color' });
    const colorDiv = container.firstElementChild as HTMLElement | null;
    expect(colorDiv?.tagName).toBe('DIV');
    expect(colorDiv?.style.backgroundColor).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses getCachedMediaAsset synchronously for local:// URLs that are warm in cache', () => {
    cachedAssets.set('local://abc123', { url: 'blob:http://localhost/abc123', kind: 'image' });
    render({ backgroundUrl: 'local://abc123' });
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('blob:http://localhost/abc123');
  });

  it('renders the black placeholder when a local:// URL has no cached asset and getMediaAsset returns null', () => {
    render({ backgroundUrl: 'local://missing-on-this-device' });
    // No <img> with the local:// URL — that would trigger ERR_UNKNOWN_URL_SCHEME.
    const img = container.querySelector('img');
    expect(img?.getAttribute('src') ?? '').not.toContain('local://');
  });

  it('respects mediaFit: contain renders object-contain class on <img>', () => {
    render({ backgroundUrl: 'https://example.com/photo.jpg', mediaType: 'image', mediaFit: 'contain' });
    const img = container.querySelector('img');
    expect(img?.className).toContain('object-contain');
  });

  it('respects mediaFit: cover (default) renders object-cover class on <img>', () => {
    render({ backgroundUrl: 'https://example.com/photo.jpg', mediaType: 'image' });
    const img = container.querySelector('img');
    expect(img?.className).toContain('object-cover');
  });
});
