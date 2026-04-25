import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SaveButton } from './SaveButton';

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

function getBtn(): HTMLButtonElement | null {
  return container.querySelector('[data-testid="save-button"]') as HTMLButtonElement | null;
}
function getStamp() {
  return container.querySelector('[data-testid="save-last-saved"]');
}

describe('SaveButton', () => {
  it('shows default label + never-saved stamp', () => {
    act(() => {
      root.render(<SaveButton lastSavedAt={null} onSave={vi.fn()} />);
    });
    expect(getBtn()?.textContent).toMatch(/save/i);
    expect(getStamp()?.textContent).toMatch(/not yet saved/i);
  });

  it('calls onSave when clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(<SaveButton lastSavedAt={null} onSave={onSave} />);
    });
    await act(async () => {
      getBtn()?.click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('renders a Saved confirmation after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(<SaveButton lastSavedAt={null} onSave={onSave} />);
    });
    await act(async () => {
      getBtn()?.click();
    });
    expect(getBtn()?.textContent).toMatch(/saved/i);
  });

  it('ignores double clicks while saving', async () => {
    let resolve!: () => void;
    const onSave = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    act(() => {
      root.render(<SaveButton lastSavedAt={null} onSave={onSave} />);
    });
    // fire two clicks synchronously while the save is still pending
    act(() => {
      getBtn()?.click();
      getBtn()?.click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
      await onSave.mock.results[0].value;
    });
  });

  it('formats recent save as "just now"', () => {
    act(() => {
      root.render(<SaveButton lastSavedAt={Date.now() - 1000} onSave={vi.fn()} />);
    });
    expect(getStamp()?.textContent).toMatch(/just now/i);
  });

  it('formats older save in minutes', () => {
    act(() => {
      root.render(<SaveButton lastSavedAt={Date.now() - 5 * 60 * 1000} onSave={vi.fn()} />);
    });
    expect(getStamp()?.textContent).toMatch(/5m ago/i);
  });
});
