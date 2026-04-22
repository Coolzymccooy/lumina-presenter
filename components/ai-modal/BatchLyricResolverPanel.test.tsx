import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BatchLyricResolverPanel } from './BatchLyricResolverPanel';
import type { BatchSongResolution } from '../../services/lyricSources/types';

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

const sourceResolution: BatchSongResolution = {
  song: { id: '1-joy-overflow', section: 'Praise', title: 'Joy overflow' },
  status: 'sources',
  sources: [{ title: 'Joy Overflow Lyrics', url: 'https://lyrics.test/joy', domain: 'lyrics.test', snippet: 'source', provider: 'tavily' }],
};

describe('BatchLyricResolverPanel', () => {
  it('renders parsed song statuses and source cards', () => {
    act(() => root.render(
      <BatchLyricResolverPanel
        serviceList="Praise"
        resolutions={[sourceResolution]}
        isResolving={false}
        generatingSongId={null}
        onServiceListChange={() => {}}
        onResolve={() => {}}
        onOpenSource={() => {}}
        onPastedLyricsChange={() => {}}
        onGenerate={() => {}}
      />,
    ));
    expect(container.textContent).toContain('Joy overflow');
    expect(container.textContent).toContain('Joy Overflow Lyrics');
    expect(container.textContent).toContain('tavily');
  });

  it('keeps generate disabled until lyrics are pasted for source results', () => {
    act(() => root.render(
      <BatchLyricResolverPanel
        serviceList="Praise"
        resolutions={[sourceResolution]}
        isResolving={false}
        generatingSongId={null}
        onServiceListChange={() => {}}
        onResolve={() => {}}
        onOpenSource={() => {}}
        onPastedLyricsChange={() => {}}
        onGenerate={() => {}}
      />,
    ));
    const generate = container.querySelector('button[data-testid="batch-generate"]') as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
  });

  it('inserts the template when the panel is empty', () => {
    const onServiceListChange = vi.fn();
    act(() => root.render(
      <BatchLyricResolverPanel
        serviceList=""
        resolutions={[]}
        isResolving={false}
        generatingSongId={null}
        onServiceListChange={onServiceListChange}
        onResolve={() => {}}
        onOpenSource={() => {}}
        onPastedLyricsChange={() => {}}
        onGenerate={() => {}}
      />,
    ));
    const templateBtn = container.querySelector('button[data-testid="batch-use-template"]') as HTMLButtonElement;
    act(() => { templateBtn.click(); });
    expect(onServiceListChange).toHaveBeenCalledTimes(1);
    const inserted = onServiceListChange.mock.calls[0][0] as string;
    expect(inserted).toContain('Call to worship');
    expect(inserted).toContain('1. Olowogbogboro');
    expect(inserted).toContain('- Amazing Grace');
    expect(inserted).toContain('a) We bring the sacrifice of praise');
  });

  it('confirms before overwriting an existing list', () => {
    const onServiceListChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => root.render(
      <BatchLyricResolverPanel
        serviceList="Praise\n- Existing song"
        resolutions={[]}
        isResolving={false}
        generatingSongId={null}
        onServiceListChange={onServiceListChange}
        onResolve={() => {}}
        onOpenSource={() => {}}
        onPastedLyricsChange={() => {}}
        onGenerate={() => {}}
      />,
    ));
    const templateBtn = container.querySelector('button[data-testid="batch-use-template"]') as HTMLButtonElement;
    act(() => { templateBtn.click(); });
    expect(confirmSpy).toHaveBeenCalled();
    expect(onServiceListChange).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('supports browser/manual paste path', () => {
    const onPastedLyricsChange = vi.fn();
    const onGenerate = vi.fn();
    const pasted = { ...sourceResolution, pastedLyrics: 'Joy overflow in my heart\nSing a new song' };
    act(() => root.render(
      <BatchLyricResolverPanel
        serviceList="Praise"
        resolutions={[pasted]}
        isResolving={false}
        generatingSongId={null}
        onServiceListChange={() => {}}
        onResolve={() => {}}
        onOpenSource={() => {}}
        onPastedLyricsChange={onPastedLyricsChange}
        onGenerate={onGenerate}
      />,
    ));
    const textarea = container.querySelector('textarea[data-testid^="batch-lyrics-paste"]') as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, 'Updated lyrics');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onPastedLyricsChange).toHaveBeenCalled();
    const generate = container.querySelector('button[data-testid="batch-generate"]') as HTMLButtonElement;
    expect(generate.disabled).toBe(false);
    act(() => { generate.click(); });
    expect(onGenerate).toHaveBeenCalledWith(pasted);
  });
});
