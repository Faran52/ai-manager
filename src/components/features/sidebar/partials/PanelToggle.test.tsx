import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { PanelToggle } from './PanelToggle';

describe('PanelToggle', () => {
  test('names itself for a keyboard and reports the toggle', async () => {
    const onToggle = vi.fn();

    render(<PanelToggle label="Hide projects" onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide projects' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
