import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TestPatterns } from './TestPatterns';

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

function render(pattern: ToolsTestPattern) {
  act(() => {
    root.render(<TestPatterns pattern={pattern} />);
  });
}

function wrapper() {
  return container.querySelector('[data-testid="tools-testpattern"]');
}

describe('TestPatterns', () => {
  it('renders nothing when pattern is off', () => {
    render('off');
    expect(wrapper()).toBeNull();
  });

  const activePatterns: Array<Exclude<ToolsTestPattern, 'off'>> = [
    'smpte',
    'pluge',
    'black',
    'white',
    'gradient',
    'checkerboard',
  ];

  it.each(activePatterns)('renders the %s pattern with a tagged data-pattern attribute', (p) => {
    render(p);
    const el = wrapper();
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-pattern')).toBe(p);
  });

  it('SMPTE top band has 7 color bars', () => {
    render('smpte');
    // Structure: wrapper > smpteContainer > 3 bands. The first band is the
    // 7-bar top row.
    const smpteContainer = wrapper()?.firstElementChild;
    const topBand = smpteContainer?.firstElementChild;
    expect(topBand?.children.length).toBe(7);
  });

  it('checkerboard renders a 16 x 9 = 144 cell grid', () => {
    render('checkerboard');
    const grid = wrapper()?.querySelector('.grid');
    expect(grid?.children.length).toBe(16 * 9);
  });

  it('does not intercept pointer events (pointer-events-none)', () => {
    render('smpte');
    const el = wrapper();
    expect(el?.className).toMatch(/pointer-events-none/);
  });
});
