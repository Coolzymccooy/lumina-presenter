import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WebSearchResultCard } from './WebSearchResultCard';

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

const results = [
  { title: 'Way Maker - Sinach', url: 'https://naijalyrics.example/way-maker', domain: 'naijalyrics.example', snippet: 'Way maker, miracle worker...', provider: 'tavily' as const },
  { title: 'Way Maker Lyrics', url: 'https://otherlyrics.example/way-maker', domain: 'otherlyrics.example', snippet: 'Promise keeper, light in the darkness', provider: 'brave' as const },
];

function renderCard(overrides: Partial<React.ComponentProps<typeof WebSearchResultCard>> = {}) {
  const props: React.ComponentProps<typeof WebSearchResultCard> = {
    results,
    onOpenSource: () => {},
    captureStatus: 'idle',
    manualLyrics: '',
    onManualLyricsChange: () => {},
    onGenerate: () => {},
    ...overrides,
  };
  act(() => root.render(<WebSearchResultCard {...props} />));
}

describe('WebSearchResultCard', () => {
  it('renders each result with title, provider, domain, and snippet', () => {
    renderCard();
    expect(container.textContent).toContain('Way Maker - Sinach');
    expect(container.textContent).toContain('tavily - naijalyrics.example');
    expect(container.textContent).toContain('Promise keeper');
  });

  it('invokes onOpenSource with the clicked result url', () => {
    const onOpenSource = vi.fn();
    renderCard({ onOpenSource });
    const btn = container.querySelector('button[data-role="open-source"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => { btn.click(); });
    expect(onOpenSource).toHaveBeenCalledWith(results[0]);
  });

  it('disables Generate until capture or manual paste is available', () => {
    renderCard({ captureStatus: 'armed' });
    const generate = container.querySelector('button[data-role="generate"]') as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
  });

  it('enables Generate when manual lyrics are pasted in browser mode', () => {
    renderCard({ manualLyrics: 'Way maker\nMiracle worker' });
    const generate = container.querySelector('button[data-role="generate"]') as HTMLButtonElement;
    expect(generate.disabled).toBe(false);
  });
});
