import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { MenuItem } from './MenuItem';

test('renders and invokes a reusable menu action', async () => {
  const onClick = vi.fn();

  render(<MenuItem icon={<i>icon</i>} onClick={onClick}>Copy</MenuItem>);
  await userEvent.click(screen.getByRole('menuitem', { name: /Copy/u }));

  expect(onClick).toHaveBeenCalledOnce();
});
