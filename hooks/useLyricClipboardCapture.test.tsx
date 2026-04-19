// hooks/useLyricClipboardCapture.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLyricClipboardCapture, type UseLyricClipboardReturn } from './useLyricClipboardCapture';

let container: HTMLDivElement;
let root: Root;
let latest: UseLyricClipboardReturn | null = null;
let capturedCb: ((p: { text: string; sourceUrl: string }) => void) | null = null;
const armMock = vi.fn(async () => ({ ok: true }));
const disarmMock = vi.fn(async () => ({ ok: true }));

function Harness() { latest = useLyricClipboardCapture(); return null; }

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  capturedCb = null;
  armMock.mockClear();
  disarmMock.mockClear();
  (globalThis as any).window.electron = {
    lyricClipboard: {
      arm: armMock,
      disarm: disarmMock,
      onCaptured: (cb: (p: { text: string; sourceUrl: string }) => void) => { capturedCb = cb; return () => { capturedCb = null; }; },
    },
  };
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as any).window.electron;
});

describe('useLyricClipboardCapture', () => {
  it('arm() delegates to IPC bridge', async () => {
    act(() => root.render(<Harness />));
    await act(async () => { await latest!.arm('https://x.example/a'); });
    expect(armMock).toHaveBeenCalledWith('https://x.example/a');
  });

  it('surfaces captured text via state', async () => {
    act(() => root.render(<Harness />));
    act(() => { capturedCb?.({ text: 'LYRICS', sourceUrl: 'https://x/y' }); });
    expect(latest?.captured).toEqual({ text: 'LYRICS', sourceUrl: 'https://x/y' });
  });

  it('returns a no-op when electron bridge is absent', async () => {
    delete (globalThis as any).window.electron;
    act(() => root.render(<Harness />));
    await act(async () => { await latest!.arm('https://x'); });
    expect(latest?.isSupported).toBe(false);
  });
});
