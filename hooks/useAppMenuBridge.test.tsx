import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useAppMenuBridge } from './useAppMenuBridge';

let container: HTMLDivElement;
let root: Root;
let commandCb: ((cmd: ToolsCommand) => void) | null = null;
const setAppMenuStateMock = vi.fn<(payload: AppMenuState) => void>();

function Harness({ state, onCommand }: { state: AppMenuState | null; onCommand: (cmd: ToolsCommand) => void }) {
  useAppMenuBridge(state, onCommand);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  commandCb = null;
  setAppMenuStateMock.mockReset();
  (globalThis as unknown as { window: Window }).window.electron = {
    tools: {
      setAppMenuState: setAppMenuStateMock,
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

function defaultState(): AppMenuState {
  return {
    sessionActive: false,
    viewMode: 'PRESENTER',
    blackout: false,
    outputMuted: false,
    lowerThirdsEnabled: false,
    routingMode: 'PROJECTOR',
    audienceWindowOpen: false,
    stageWindowOpen: false,
    lastSavedAt: null,
  };
}

describe('useAppMenuBridge', () => {
  it('pushes the initial state on mount', async () => {
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={vi.fn()} />);
    });
    expect(setAppMenuStateMock).toHaveBeenCalledWith(defaultState());
  });

  it('pushes again when blackout flips', async () => {
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={vi.fn()} />);
    });
    setAppMenuStateMock.mockClear();
    await act(async () => {
      root.render(<Harness state={{ ...defaultState(), blackout: true }} onCommand={vi.fn()} />);
    });
    expect(setAppMenuStateMock).toHaveBeenCalledWith({ ...defaultState(), blackout: true });
  });

  it('does not push when state is null', async () => {
    await act(async () => {
      root.render(<Harness state={null} onCommand={vi.fn()} />);
    });
    expect(setAppMenuStateMock).not.toHaveBeenCalled();
  });

  it('delivers a menu command to onCommand', async () => {
    const onCommand = vi.fn();
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={onCommand} />);
    });
    await act(async () => {
      commandCb?.({ type: 'file.save' });
    });
    expect(onCommand).toHaveBeenCalledWith({ type: 'file.save' });
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
      commandCb?.({ type: 'transport.next-slide' });
    });
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith({ type: 'transport.next-slide' });
  });

  it('no-ops when window.electron.tools is absent', async () => {
    delete (globalThis as unknown as { window: Window & { electron?: unknown } }).window.electron;
    await act(async () => {
      root.render(<Harness state={defaultState()} onCommand={vi.fn()} />);
    });
    expect(setAppMenuStateMock).not.toHaveBeenCalled();
  });
});
