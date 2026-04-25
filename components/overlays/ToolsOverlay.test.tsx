import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ToolsOverlay } from './ToolsOverlay';

let container: HTMLDivElement;
let root: Root;

function baseSettings(overrides: Partial<ToolsSettings> = {}): ToolsSettings {
  return {
    overlays: { safeAreas: false, centerCross: false },
    aspect: 'off',
    testPattern: 'off',
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ToolsOverlay', () => {
  it('renders nothing when every overlay is off', () => {
    act(() => {
      root.render(<ToolsOverlay settings={baseSettings()} />);
    });
    expect(container.querySelector('[data-testid="tools-overlay"]')).toBeNull();
  });

  it('renders the safe-areas layer when enabled', () => {
    act(() => {
      root.render(
        <ToolsOverlay settings={baseSettings({ overlays: { safeAreas: true, centerCross: false } })} />,
      );
    });
    expect(container.querySelector('[data-testid="tools-overlay"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tools-overlay-safeareas"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tools-overlay-centercross"]')).toBeNull();
    expect(container.querySelector('[data-testid="tools-overlay-aspect"]')).toBeNull();
  });

  it('renders the center cross when enabled', () => {
    act(() => {
      root.render(
        <ToolsOverlay settings={baseSettings({ overlays: { safeAreas: false, centerCross: true } })} />,
      );
    });
    expect(container.querySelector('[data-testid="tools-overlay-centercross"]')).not.toBeNull();
  });

  it('renders aspect markers whenever aspect is not off', () => {
    act(() => {
      root.render(<ToolsOverlay settings={baseSettings({ aspect: '16:9' })} />);
    });
    expect(container.querySelector('[data-testid="tools-overlay-aspect"]')?.getAttribute('data-aspect')).toBe('16:9');
  });

  it('stacks multiple overlays when all are enabled', () => {
    act(() => {
      root.render(
        <ToolsOverlay
          settings={baseSettings({
            overlays: { safeAreas: true, centerCross: true },
            aspect: '4:3',
          })}
        />,
      );
    });
    expect(container.querySelector('[data-testid="tools-overlay-safeareas"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tools-overlay-centercross"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tools-overlay-aspect"]')).not.toBeNull();
  });
});
