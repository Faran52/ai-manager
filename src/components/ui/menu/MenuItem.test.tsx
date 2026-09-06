import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { Menu } from './Menu';
import { MenuItem } from './MenuItem';

test('renders its icon beside its label and reports a selection', async () => {
  const onSelect = vi.fn();

  render(
    <Menu label="Actions" trigger={<button type="button">Open</button>}>
      <MenuItem icon={<span data-testid="icon" />} onSelect={onSelect}>
        Copy path
      </MenuItem>
    </Menu>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));

  expect(screen.getByTestId('icon')).toBeDefined();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Copy path' }));

  expect(onSelect).toHaveBeenCalledTimes(1);
});
