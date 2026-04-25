import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useToolsMenu, type UseToolsMenuReturn } from './useToolsMenu';

let container: HTMLDivElement;
let root: Root;
let latest: UseToolsMenuReturn | null = null;
let stateCb: ((s: ToolsSettings) => void) | null = null;

const getSettingsMock = vi.fn<() => Promise<ToolsSettings>>();
const setSettingsMock = vi.fn<(patch: ToolsSettingsPatch) => Promise<ToolsSettings>>();

function Harness() {
  latest = useToolsMenu();
  return null;
}

function initial(): ToolsSettings {
  return {
    overlays: { safeAreas: false, centerCross: false },
    aspect: 'off',
    testPattern: 'off',
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  stateCb = null;
  getSettingsMock.mockReset();
  setSettingsMock.mockReset();
  getSettingsMock.mockResolvedValue(initial());
  setSettingsMock.mockImplementation(async (patch) => ({
    ...initial(),
    ...patch,
    overlays: { ...initial().overlays, ...(patch.overlays || {}) },
  }));
  (globalThis as unknown as { window: Window }).window.electron = {
    tools: {
      getSettings: getSettingsMock,
      setSettings: setSettingsMock,
      onState: (cb) => {
        stateCb = cb;
        return () => {
          stateCb = null;
        };
      },
    },
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as unknown as { window: Window & { electron?: unknown } }).window.electron;
});

describe('useToolsMenu', () => {
  it('hydrates from getSettings on mount', async () => {
    getSettingsMock.mockResolvedValueOnce({
      overlays: { safeAreas: true, centerCross: false },
      aspect: '16:9',
      testPattern: 'smpte',
    });
    await act(async () => {
      root.render(<Harness />);
    });
    expect(latest?.settings.aspect).toBe('16:9');
    expect(latest?.settings.overlays.safeAreas).toBe(true);
    expect(latest?.settings.testPattern).toBe('smpte');
    expect(latest?.isSupported).toBe(true);
  });

  it('setAspect dispatches a patch through setSettings', async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      latest!.setAspect('4:3');
    });
    expect(setSettingsMock).toHaveBeenCalledWith({ aspect: '4:3' });
    expect(latest?.settings.aspect).toBe('4:3');
  });

  it('setTestPattern dispatches a patch through setSettings', async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      latest!.setTestPattern('pluge');
    });
    expect(setSettingsMock).toHaveBeenCalledWith({ testPattern: 'pluge' });
    expect(latest?.settings.testPattern).toBe('pluge');
  });

  it('setOverlay dispatches a nested overlays patch', async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      latest!.setOverlay('safeAreas', true);
    });
    expect(setSettingsMock).toHaveBeenCalledWith({ overlays: { safeAreas: true } });
    expect(latest?.settings.overlays.safeAreas).toBe(true);
  });

  it('updates state when a menu-driven tools:state event arrives', async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      stateCb?.({
        overlays: { safeAreas: true, centerCross: true },
        aspect: '1:1',
        testPattern: 'checkerboard',
      });
    });
    expect(latest?.settings.aspect).toBe('1:1');
    expect(latest?.settings.overlays.centerCross).toBe(true);
    expect(latest?.settings.testPattern).toBe('checkerboard');
  });

  it('reports isSupported=false when window.electron.tools is absent', async () => {
    delete (globalThis as unknown as { window: Window & { electron?: unknown } }).window.electron;
    await act(async () => {
      root.render(<Harness />);
    });
    expect(latest?.isSupported).toBe(false);
    await act(async () => {
      latest!.setAspect('16:9');
    });
    expect(setSettingsMock).not.toHaveBeenCalled();
  });
});
