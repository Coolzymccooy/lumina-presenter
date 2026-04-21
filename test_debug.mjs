import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { StudioMenu } from './components/layout/StudioMenu';

const user = userEvent.setup();
const onSelectTab = vi.fn();
render(<StudioMenu activeTab={null} onSelectTab={onSelectTab} />);

await user.click(screen.getByRole('button', { name: /studio/i }));
await user.keyboard('{ArrowDown}');
await user.keyboard('{ArrowDown}');

const activeElement = document.activeElement;
console.log('Active element:', activeElement?.tagName, activeElement?.getAttribute('data-testid'));

await user.keyboard('{Enter}');
console.log('onSelectTab called:', onSelectTab.mock.calls);
