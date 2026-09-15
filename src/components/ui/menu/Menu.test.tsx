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

const open = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
};

const menu = (onSelect = vi.fn()): ReturnType<typeof render> => {
  return render(
    <Menu label="Actions" trigger={<button type="button">Open</button>}>
      <MenuItem onSelect={onSelect}>First</MenuItem>
      <MenuItem onSelect={vi.fn()}>Second</MenuItem>
    </Menu>,
  );
};

test('opens from its trigger and names itself', async () => {
  menu();

  expect(screen.queryByRole('menu')).toBeNull();
  await open();

  expect(screen.getByRole('menu', { name: 'Actions' })).toBeDefined();
});

test('runs an item and closes', async () => {
  const onSelect = vi.fn();

  menu(onSelect);
  await open();
  await userEvent.click(screen.getByRole('menuitem', { name: 'First' }));

  expect(onSelect).toHaveBeenCalledTimes(1);
  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

test('walks its items with the arrow keys', async () => {
  menu();
  await open();
  await userEvent.keyboard('{ArrowDown}');

  expect(document.activeElement?.textContent).toBe('First');

  await userEvent.keyboard('{ArrowDown}');

  expect(document.activeElement?.textContent).toBe('Second');

  await userEvent.keyboard('{Home}');

  expect(document.activeElement?.textContent).toBe('First');
});

test('closes on escape without running anything', async () => {
  const onSelect = vi.fn();

  menu(onSelect);
  await open();
  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
  expect(onSelect).not.toHaveBeenCalled();
});

test('anchors to a cursor point when given one', () => {
  render(
    <Menu
      open
      label="Actions"
      position={{
        x: 120,
        y: 60,
      }}
      trigger={<span aria-hidden />}
      onOpenChange={vi.fn()}
    >
      <MenuItem onSelect={vi.fn()}>First</MenuItem>
    </Menu>,
  );

  const anchor = document.querySelector('[aria-haspopup="menu"]');

  expect(anchor?.getAttribute('style')).toContain('left: 120px');
  expect(anchor?.getAttribute('style')).toContain('top: 60px');
});
