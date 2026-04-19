import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CollapsiblePanel, expandPanel } from './CollapsiblePanel';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

function render(ui: React.ReactElement) {
  act(() => {
    root.render(ui);
  });
}

describe('CollapsiblePanel', () => {
  it('renders header and body when expanded', () => {
    render(
      <CollapsiblePanel id="t1" title="Transport" data-testid="panel">
        <div data-testid="body-content">hello</div>
      </CollapsiblePanel>,
    );

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute('data-collapsed')).toBe('false');

    const body = container.querySelector('[data-testid="body-content"]') as HTMLElement;
    expect(body).toBeTruthy();
    const bodyWrapper = body.parentElement!;
    expect(bodyWrapper.style.display).not.toBe('none');
    expect(bodyWrapper.getAttribute('aria-hidden')).toBe('false');
  });

  it('hides body via display:none when collapsed but keeps DOM mounted', () => {
    render(
      <CollapsiblePanel
        id="t2"
        title="Transport"
        defaultCollapsed
        data-testid="panel"
      >
        <div data-testid="body-content">hello</div>
      </CollapsiblePanel>,
    );

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('true');

    const body = container.querySelector('[data-testid="body-content"]') as HTMLElement;
    expect(body).toBeTruthy();
    const bodyWrapper = body.parentElement!;
    expect(bodyWrapper.style.display).toBe('none');
    expect(bodyWrapper.getAttribute('aria-hidden')).toBe('true');
  });

  it('toggling persists "1"/"0" to localStorage at lumina.panel.<id>', () => {
    render(
      <CollapsiblePanel id="t3" title="Transport" data-testid="panel">
        <div>x</div>
      </CollapsiblePanel>,
    );

    expect(window.localStorage.getItem('lumina.panel.t3')).toBe('0');

    const header = container.querySelector(
      '[data-testid="panel-header"]',
    ) as HTMLElement;
    expect(header).toBeTruthy();

    act(() => {
      header.click();
    });

    expect(window.localStorage.getItem('lumina.panel.t3')).toBe('1');

    act(() => {
      header.click();
    });

    expect(window.localStorage.getItem('lumina.panel.t3')).toBe('0');
  });

  it('uses defaultCollapsed only when no localStorage entry exists', () => {
    window.localStorage.setItem('lumina.panel.t4', '0');

    render(
      <CollapsiblePanel
        id="t4"
        title="Transport"
        defaultCollapsed
        data-testid="panel"
      >
        <div>x</div>
      </CollapsiblePanel>,
    );

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('false');
  });

  it('respects defaultCollapsed when localStorage is empty', () => {
    render(
      <CollapsiblePanel
        id="t5"
        title="Transport"
        defaultCollapsed
        data-testid="panel"
      >
        <div>x</div>
      </CollapsiblePanel>,
    );

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('true');
  });

  it('CustomEvent("lumina:panel-expand") with matching id force-expands the panel', () => {
    render(
      <CollapsiblePanel
        id="t6"
        title="Transport"
        defaultCollapsed
        data-testid="panel"
      >
        <div>x</div>
      </CollapsiblePanel>,
    );

    let wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('true');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('lumina:panel-expand', { detail: { id: 't6' } }),
      );
    });

    wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('false');
  });

  it('expandPanel(id) helper dispatches the same event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <CollapsiblePanel
        id="t7"
        title="Transport"
        defaultCollapsed
        data-testid="panel"
      >
        <div>x</div>
      </CollapsiblePanel>,
    );

    act(() => {
      expandPanel('t7');
    });

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('false');

    const dispatched = dispatchSpy.mock.calls.find(
      ([event]) => event instanceof CustomEvent && event.type === 'lumina:panel-expand',
    );
    expect(dispatched).toBeTruthy();

    dispatchSpy.mockRestore();
  });

  it('CustomEvent with non-matching id does NOT expand', () => {
    render(
      <CollapsiblePanel
        id="t8"
        title="Transport"
        defaultCollapsed
        data-testid="panel"
      >
        <div>x</div>
      </CollapsiblePanel>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('lumina:panel-expand', { detail: { id: 'other' } }),
      );
    });

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('true');
  });

  it('rightSlot click does not toggle the panel', () => {
    render(
      <CollapsiblePanel
        id="t9"
        title="Transport"
        data-testid="panel"
        rightSlot={<button data-testid="right-btn">action</button>}
      >
        <div>x</div>
      </CollapsiblePanel>,
    );

    const wrapper = container.querySelector('[data-testid="panel"]') as HTMLElement;
    expect(wrapper.getAttribute('data-collapsed')).toBe('false');

    const rightBtn = container.querySelector('[data-testid="right-btn"]') as HTMLElement;
    act(() => {
      rightBtn.click();
    });

    expect(wrapper.getAttribute('data-collapsed')).toBe('false');
  });
});
