import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { StatusHub, StatusHubProps } from './StatusHub';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  // Clean up any leftover portal children.
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
});

function render(ui: React.ReactElement) {
  act(() => {
    root.render(ui);
  });
}

function defaultProps(overrides: Partial<StatusHubProps> = {}): StatusHubProps {
  return {
    liveSessionId: 'live-05',
    isSessionIdFallback: false,
    isOnline: true,
    syncPendingCount: 0,
    cloudSyncStatus: 'ok',
    cloudSyncMessage: null,
    connections: { current: 3, total: 3 },
    onSessionIdClick: vi.fn(),
    onCloudSyncIssueClick: vi.fn(),
    ...overrides,
  };
}

describe('StatusHub', () => {
  it('renders pill with studio-session-id-button test id', () => {
    render(<StatusHub {...defaultProps()} />);
    const pill = container.querySelector('[data-testid="studio-session-id-button"]');
    expect(pill).toBeTruthy();
    expect(pill?.textContent).toContain('live-05');
  });

  it('shows green/ok tone when everything is healthy', () => {
    render(<StatusHub {...defaultProps()} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    expect(pill.className).toContain('border-emerald');
    expect(pill.textContent).toContain('ALL SYSTEMS GO');
  });

  it('shows error tone when cloudSyncStatus is "error"', () => {
    render(
      <StatusHub
        {...defaultProps({ cloudSyncStatus: 'error', cloudSyncMessage: 'Sync failed' })}
      />,
    );
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    expect(pill.className).toContain('border-red');
    expect(pill.textContent).toContain('ATTENTION');
  });

  it('shows warn tone when offline', () => {
    render(<StatusHub {...defaultProps({ isOnline: false })} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    expect(pill.className).toContain('border-amber');
    expect(pill.textContent).toContain('CHECK STATUS');
  });

  it('shows warn tone when syncing or pending count > 0', () => {
    render(<StatusHub {...defaultProps({ cloudSyncStatus: 'syncing', syncPendingCount: 2 })} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    expect(pill.className).toContain('border-amber');
  });

  it('clicking pill opens popover; clicking again closes', () => {
    render(<StatusHub {...defaultProps()} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    act(() => pill.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => pill.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Escape key closes the popover', () => {
    render(<StatusHub {...defaultProps()} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;

    act(() => pill.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('outside pointerdown closes the popover', () => {
    render(<StatusHub {...defaultProps()} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;

    act(() => pill.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    const outside = document.createElement('div');
    document.body.appendChild(outside);

    act(() => {
      outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Session row inside popover keeps studio-session-id test id', () => {
    render(<StatusHub {...defaultProps()} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    act(() => pill.click());

    const sessionId = document.querySelector('[data-testid="studio-session-id"]');
    expect(sessionId).toBeTruthy();
    expect(sessionId?.textContent).toContain('live-05');
  });

  it('clicking Session row fires onSessionIdClick and closes popover', () => {
    const onSessionIdClick = vi.fn();
    render(<StatusHub {...defaultProps({ onSessionIdClick })} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    act(() => pill.click());

    const sessionRow = document.querySelector(
      '[data-testid="status-hub-row-session"]',
    ) as HTMLElement;
    expect(sessionRow).toBeTruthy();

    act(() => sessionRow.click());

    expect(onSessionIdClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Cloud Sync row is NOT clickable when status is "ok"', () => {
    render(<StatusHub {...defaultProps({ cloudSyncStatus: 'ok' })} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    act(() => pill.click());

    const cloudRow = document.querySelector(
      '[data-testid="status-hub-row-cloud"]',
    ) as HTMLElement;
    expect(cloudRow.tagName).toBe('DIV');
  });

  it('Cloud Sync row IS clickable when status is "error" and fires onCloudSyncIssueClick', () => {
    const onCloudSyncIssueClick = vi.fn();
    render(
      <StatusHub
        {...defaultProps({
          cloudSyncStatus: 'error',
          cloudSyncMessage: 'Sync failed',
          onCloudSyncIssueClick,
        })}
      />,
    );
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    act(() => pill.click());

    const cloudRow = document.querySelector(
      '[data-testid="status-hub-row-cloud"]',
    ) as HTMLElement;
    expect(cloudRow.tagName).toBe('BUTTON');

    act(() => cloudRow.click());

    expect(onCloudSyncIssueClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders connections count in popover', () => {
    render(<StatusHub {...defaultProps({ connections: { current: 2, total: 3 } })} />);
    const pill = container.querySelector(
      '[data-testid="studio-session-id-button"]',
    ) as HTMLElement;
    act(() => pill.click());

    const connRow = document.querySelector(
      '[data-testid="status-hub-row-connections"]',
    ) as HTMLElement;
    expect(connRow.textContent).toContain('2 / 3');
  });
});
