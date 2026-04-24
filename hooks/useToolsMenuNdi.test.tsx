import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useToolsMenuNdi } from './useToolsMenuNdi';

let container: HTMLDivElement;
let root: Root;
let commandCb: ((cmd: ToolsCommand) => void) | null = null;
const setNdiMenuStateMock = vi.fn<(payload: ToolsNdiMenuState) => void>();

function Harness({ state, onCommand }: { state: ToolsNdiMenuState | null; onCommand: (cmd: ToolsCommand) => void }) {
  useToolsMenuNdi(state, onCommand);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  commandCb = null;
  setNdiMenuStateMock.mockReset();
  (globalThis as unknown as { window: Window }).window.electron = {
    tools: {
      setNdiMenuState: setNdiMenuStateMock,
      onCommand: (cb) => {
        commandCb = cb;
        return () => {
          commandCb = null;
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

function defaultState(): ToolsNdiMenuState {
  return { active: false, broadcastMode: false, audioEnabled: false, resolution: '1080p' };
}

describe('useToolsMenuNdi', () => {
  it('pushes the initial state on mount', async () => {
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={vi.fn()} />);
    });
    expect(setNdiMenuStateMock).toHaveBeenCalledWith(defaultState());
  });

  it('pushes a new state when any tracked field changes', async () => {
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={vi.fn()} />);
    });
    setNdiMenuStateMock.mockClear();
    await act(async () => {
      root.render(<Harness state={{ ...defaultState(), active: true }} onCommand={vi.fn()} />);
    });
    expect(setNdiMenuStateMock).toHaveBeenCalledWith({
      ...defaultState(),
      active: true,
    });
  });

  it('does not push when state is null', async () => {
    await act(async () => {
      root.render(<Harness state={null} onCommand={vi.fn()} />);
    });
    expect(setNdiMenuStateMock).not.toHaveBeenCalled();
  });

  it('invokes onCommand when a tools:command arrives', async () => {
    const onCommand = vi.fn();
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={onCommand} />);
    });
    await act(async () => {
      commandCb?.({ type: 'ndi.toggle-broadcast' });
    });
    expect(onCommand).toHaveBeenCalledWith({ type: 'ndi.toggle-broadcast' });
  });

  it('uses the latest onCommand across re-renders', async () => {
    const firstHandler = vi.fn();
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={firstHandler} />);
    });
    const secondHandler = vi.fn();
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={secondHandler} />);
    });
    await act(async () => {
      commandCb?.({ type: 'ndi.toggle-active' });
    });
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith({ type: 'ndi.toggle-active' });
  });

  it('is a no-op when window.electron.tools is absent', async () => {
    delete (globalThis as unknown as { window: Window & { electron?: unknown } }).window.electron;
    const onCommand = vi.fn();
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={onCommand} />);
    });
    expect(setNdiMenuStateMock).not.toHaveBeenCalled();
  });
});
