// components/ai-modal/WebSearchResultCard.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WebSearchResultCard } from './WebSearchResultCard';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const results = [
  { title: 'Way Maker — Sinach', url: 'https://naijalyrics.example/way-maker', domain: 'naijalyrics.example', snippet: 'Way maker, miracle worker…' },
  { title: 'Way Maker Lyrics', url: 'https://otherlyrics.example/way-maker', domain: 'otherlyrics.example', snippet: 'Promise keeper, light in the darkness' },
];

describe('WebSearchResultCard', () => {
  it('renders each result with title, domain, snippet', () => {
    act(() => root.render(<WebSearchResultCard results={results} onOpenSource={() => {}} captureStatus="idle" onGenerate={() => {}} />));
    expect(container.textContent).toContain('Way Maker — Sinach');
    expect(container.textContent).toContain('naijalyrics.example');
    expect(container.textContent).toContain('Promise keeper');
  });

  it('invokes onOpenSource with the clicked result url', () => {
    const onOpenSource = vi.fn();
    act(() => root.render(<WebSearchResultCard results={results} onOpenSource={onOpenSource} captureStatus="idle" onGenerate={() => {}} />));
    const btn = container.querySelector('button[data-role="open-source"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => { btn.click(); });
    expect(onOpenSource).toHaveBeenCalledWith(results[0]);
  });

  it('disables Generate button until captureStatus === "captured"', () => {
    act(() => root.render(<WebSearchResultCard results={results} onOpenSource={() => {}} captureStatus="armed" onGenerate={() => {}} />));
    const generate = container.querySelector('button[data-role="generate"]') as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
  });
});
