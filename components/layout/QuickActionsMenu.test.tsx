import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickActionsMenu } from './QuickActionsMenu';

type HarnessProps = Omit<React.ComponentProps<typeof QuickActionsMenu>, 'anchorRef'>;

function Harness(props: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} data-testid="anchor-btn">anchor</button>
      <QuickActionsMenu {...props} anchorRef={anchorRef} />
    </>
  );
}

describe('QuickActionsMenu', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Harness isOpen={false} onClose={() => {}} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    expect(screen.queryByTestId('quick-actions-menu')).not.toBeInTheDocument();
  });

  it('renders the 4 action buttons when isOpen is true (non-electron)', () => {
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    expect(screen.getByTestId('quick-actions-connect-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-aether-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-ai-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-machine-mode-btn')).toBeInTheDocument();
  });

  it('shows START SERVICE in electron mode', () => {
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={true} desktopServiceState={{ outputOpen: false, stageOpen: false }} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    expect(screen.getByTestId('quick-actions-start-service-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-actions-machine-mode-btn')).not.toBeInTheDocument();
  });

  it('calls onOpenConnect("audience") when CONNECT is clicked', async () => {
    const user = userEvent.setup();
    const onOpenConnect = vi.fn();
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={onOpenConnect} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    await user.click(screen.getByTestId('quick-actions-connect-btn'));
    expect(onOpenConnect).toHaveBeenCalledWith('audience');
  });

  it('calls onOpenConnect("aether") when AETHER is clicked', async () => {
    const user = userEvent.setup();
    const onOpenConnect = vi.fn();
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={onOpenConnect} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    await user.click(screen.getByTestId('quick-actions-aether-btn'));
    expect(onOpenConnect).toHaveBeenCalledWith('aether');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <div>
        <Harness isOpen={true} onClose={onClose} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />
        <div data-testid="outside-zone" style={{ width: 500, height: 500 }}>outside</div>
      </div>,
    );
    await user.click(screen.getByTestId('outside-zone'));
    expect(onClose).toHaveBeenCalled();
  });
});
