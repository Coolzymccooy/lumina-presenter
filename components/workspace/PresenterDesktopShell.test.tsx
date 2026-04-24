import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresenterDesktopShell } from './PresenterDesktopShell';

describe('PresenterDesktopShell', () => {
  it('renders compact panes with matching tab controls and switches the active pane', async () => {
    const user = userEvent.setup();

    render(
      <PresenterDesktopShell
        mode="builder"
        isCompactLayout={true}
        leftPane={<div>Run sheet pane</div>}
        centerPane={<div>Canvas pane</div>}
        rightPane={<div>Rail pane</div>}
        bottomPane={<div>Dock pane</div>}
      />,
    );

    expect(screen.getByTestId('builder-desktop-shell-compact')).toBeInTheDocument();

    const centerTab = screen.getByTestId('compact-shell-tab-center');
    const leftTab = screen.getByTestId('compact-shell-tab-left');
    const rightTab = screen.getByTestId('compact-shell-tab-right');
    const bottomTab = screen.getByTestId('compact-shell-tab-bottom');

    expect(centerTab).toHaveAttribute('aria-selected', 'true');
    expect(leftTab).toHaveAttribute('aria-controls', 'compact-shell-pane-left');
    expect(screen.getByTestId('compact-shell-pane-left')).toHaveAttribute('id', 'compact-shell-pane-left');
    expect(screen.getByTestId('compact-shell-pane-center')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('compact-shell-pane-left')).toHaveAttribute('aria-hidden', 'true');

    await user.click(rightTab);
    expect(rightTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('compact-shell-pane-right')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('compact-shell-pane-center')).toHaveAttribute('aria-hidden', 'true');

    await user.click(bottomTab);
    expect(bottomTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('compact-shell-pane-bottom')).toHaveAttribute('aria-hidden', 'false');
  });

  it('omits hidden or missing panes from the compact tab bar', () => {
    render(
      <PresenterDesktopShell
        mode="stage"
        isCompactLayout={true}
        hideRightPane={true}
        leftPane={<div>Config pane</div>}
        centerPane={<div>Stage pane</div>}
      />,
    );

    expect(screen.getByTestId('stage-desktop-shell-compact')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByTestId('compact-shell-tab-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compact-shell-tab-bottom')).not.toBeInTheDocument();
  });
});
