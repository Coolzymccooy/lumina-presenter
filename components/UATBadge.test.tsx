import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
  document.head.innerHTML = '';
});

async function loadBadge() {
  vi.resetModules();
  return await import('./UATBadge');
}

describe('UATBadge', () => {
  it('renders nothing when VITE_APP_STAGE is unset', async () => {
    vi.stubEnv('VITE_APP_STAGE', '');
    const { UATBadge } = await loadBadge();
    const { container } = render(<UATBadge />);
    expect(container.querySelector('[data-testid="uat-badge"]')).toBeNull();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('renders nothing when VITE_APP_STAGE is "prod"', async () => {
    vi.stubEnv('VITE_APP_STAGE', 'prod');
    const { UATBadge } = await loadBadge();
    const { container } = render(<UATBadge />);
    expect(container.querySelector('[data-testid="uat-badge"]')).toBeNull();
  });

  it('renders the UAT pill and injects robots noindex when VITE_APP_STAGE is "uat"', async () => {
    vi.stubEnv('VITE_APP_STAGE', 'uat');
    const { UATBadge } = await loadBadge();
    const { container } = render(<UATBadge />);
    const pill = container.querySelector('[data-testid="uat-badge"]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('UAT');
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toBe('noindex, nofollow');
  });

  it('treats stage casing case-insensitively', async () => {
    vi.stubEnv('VITE_APP_STAGE', 'UAT');
    const { UATBadge } = await loadBadge();
    const { container } = render(<UATBadge />);
    expect(container.querySelector('[data-testid="uat-badge"]')).not.toBeNull();
  });

  it('updates an existing robots meta rather than duplicating it', async () => {
    const existing = document.createElement('meta');
    existing.name = 'robots';
    existing.content = 'index, follow';
    document.head.appendChild(existing);

    vi.stubEnv('VITE_APP_STAGE', 'uat');
    const { UATBadge } = await loadBadge();
    render(<UATBadge />);

    const robotsMetas = document.querySelectorAll('meta[name="robots"]');
    expect(robotsMetas.length).toBe(1);
    expect(robotsMetas[0].getAttribute('content')).toBe('noindex, nofollow');
  });
});
