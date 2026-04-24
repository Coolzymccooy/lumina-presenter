import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AspectMarkers } from './AspectMarkers';

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

function renderAspect(aspect: Exclude<ToolsAspect, 'off'>, containerRatio?: number) {
  act(() => {
    root.render(<AspectMarkers aspect={aspect} containerRatio={containerRatio} />);
  });
}

function bars() {
  return Array.from(container.querySelectorAll('[data-testid="tools-overlay-aspect"] > div')) as HTMLElement[];
}

describe('AspectMarkers', () => {
  it('16:9 inside a 16:9 container draws no bars (same ratio)', () => {
    renderAspect('16:9');
    expect(bars()).toHaveLength(0);
  });

  it('4:3 inside a 16:9 container pillarboxes (two vertical bars)', () => {
    renderAspect('4:3');
    const sideBars = bars().filter((el) => /inset-y-0/.test(el.className || ''));
    expect(sideBars.length).toBeGreaterThanOrEqual(2);
    const firstWidth = sideBars[0].style.width;
    expect(firstWidth).toMatch(/%$/);
    const pct = parseFloat(firstWidth);
    // 16:9 container, 4:3 target → target fills 75% of container width,
    // so each bar is (100 - 75) / 2 = 12.5%.
    expect(pct).toBeCloseTo(12.5, 1);
  });

  it('1:1 inside a 16:9 container pillarboxes with larger bars than 4:3', () => {
    renderAspect('1:1');
    const sideBars = bars().filter((el) => /inset-y-0/.test(el.className || ''));
    const firstWidth = parseFloat(sideBars[0].style.width);
    // 16:9 container, 1:1 target → target fills 56.25% width, bars 21.875% each.
    expect(firstWidth).toBeCloseTo(21.875, 1);
  });

  it('16:9 inside a 4:3 container letterboxes (two horizontal bars)', () => {
    renderAspect('16:9', 4 / 3);
    const topBottom = bars().filter((el) => /inset-x-0/.test(el.className || ''));
    expect(topBottom.length).toBeGreaterThanOrEqual(2);
    const firstHeight = parseFloat(topBottom[0].style.height);
    // 4:3 container, 16:9 target → target fills 75% of container height,
    // bars 12.5% each.
    expect(firstHeight).toBeCloseTo(12.5, 1);
  });

  it('exposes the chosen aspect via data-aspect', () => {
    renderAspect('1:1');
    const root = container.querySelector('[data-testid="tools-overlay-aspect"]');
    expect(root?.getAttribute('data-aspect')).toBe('1:1');
  });
});
