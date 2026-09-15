import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSub } from './MenuSub';

const open = async (): Promise<void> => {
  render(
    <Menu label="Funnel" trigger={<button type="button">Open</button>}>
      <MenuSub label="Agents" value="3 of 3">
        <MenuItem onSelect={vi.fn()}>Claude Code</MenuItem>
      </MenuSub>
    </Menu>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
};

test('states what the row is set to on the trigger', async () => {
  await open();

  expect(screen.getByRole('menuitem', { name: /Agents/ }).textContent).toContain('3 of 3');
});

test('opens its list on the arrow pointing toward it', async () => {
  await open();
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{ArrowRight}');

  expect(await screen.findByRole('menuitem', { name: 'Claude Code' })).toBeDefined();
});

test('closes its list on the arrow pointing away', async () => {
  await open();
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{ArrowRight}');
  await screen.findByRole('menuitem', { name: 'Claude Code' });
  await userEvent.keyboard('{ArrowLeft}');

  await waitFor(() => {
    expect(screen.queryByRole('menuitem', { name: 'Claude Code' })).toBeNull();
  });
});
