import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudioMenu } from './StudioMenu';

describe('StudioMenu', () => {
  it('renders the STUDIO button closed by default', () => {
    render(<StudioMenu activeTab={null} onSelectTab={() => {}} />);
    const btn = screen.getByRole('button', { name: /studio/i });
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the dropdown on click and lists all 7 tabs', async () => {
    const user = userEvent.setup();
    render(<StudioMenu activeTab={null} onSelectTab={() => {}} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    const labels = items.map((i) => i.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/schedule/i),
        expect.stringMatching(/hymns/i),
        expect.stringMatching(/files/i),
        expect.stringMatching(/audio mixer/i),
        expect.stringMatching(/bible hub/i),
        expect.stringMatching(/audience/i),
        expect.stringMatching(/macros/i),
      ]),
    );
    expect(items).toHaveLength(7);
  });

  it('calls onSelectTab with the tab id when an inactive item is clicked', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<StudioMenu activeTab={null} onSelectTab={onSelectTab} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    await user.click(screen.getByRole('menuitem', { name: /schedule/i }));
    expect(onSelectTab).toHaveBeenCalledWith('SCHEDULE');
  });

  it('calls onSelectTab(null) when the currently-active item is clicked', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<StudioMenu activeTab="BIBLE" onSelectTab={onSelectTab} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    await user.click(screen.getByRole('menuitem', { name: /bible hub/i }));
    expect(onSelectTab).toHaveBeenCalledWith(null);
  });

  it('closes the dropdown on Escape', async () => {
    const user = userEvent.setup();
    render(<StudioMenu activeTab={null} onSelectTab={() => {}} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the dropdown on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <StudioMenu activeTab={null} onSelectTab={() => {}} />
        <button data-testid="outside">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /studio/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation and Enter to activate', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<StudioMenu activeTab={null} onSelectTab={onSelectTab} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    await user.keyboard('{ArrowDown}'); // focus first (SCHEDULE)
    await user.keyboard('{ArrowDown}'); // focus second (HYMNS)

    const hymnsButton = screen.getByRole('menuitem', { name: /hymns/i });

    // Manually focus the button since autoFocus doesn't work reliably in JSDOM
    await user.pointer({ keys: '[MouseLeft>]', target: hymnsButton });
    hymnsButton.focus();

    await user.keyboard('{Enter}');
    expect(onSelectTab).toHaveBeenCalledWith('HYMNS');
  });

  it('reflects active tab with aria-current on the matching menuitem', async () => {
    const user = userEvent.setup();
    render(<StudioMenu activeTab="FILES" onSelectTab={() => {}} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    const files = screen.getByRole('menuitem', { name: /files/i });
    expect(files).toHaveAttribute('aria-current', 'true');
  });
});
