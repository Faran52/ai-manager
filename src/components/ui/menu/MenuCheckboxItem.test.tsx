import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { Menu } from './Menu';
import { MenuCheckboxItem } from './MenuCheckboxItem';

const open = async (
  checked: boolean,
  onChange = vi.fn(),
  disabled = false,
): Promise<void> => {
  render(
    <Menu label="Filters" trigger={<button type="button">Open</button>}>
      <MenuCheckboxItem checked={checked} hint={12} onChange={onChange} disabled={disabled}>
        Claude Code
      </MenuCheckboxItem>
    </Menu>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
};

test('reports its checked state and its count', async () => {
  await open(true);

  const item = screen.getByRole('menuitemcheckbox', { name: /Claude Code/ });

  expect(item.getAttribute('aria-checked')).toBe('true');
  expect(item.textContent).toContain('12');
});

test('reports a change with the next state', async () => {
  const onChange = vi.fn();

  await open(false, onChange);
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Claude Code/ }));

  expect(onChange).toHaveBeenCalledWith(true);
});

/*
 * A filter list is read as a set. Closing on each tick would make choosing
 * three agents three separate trips through the menu.
 */
test('keeps the menu open after a tick', async () => {
  await open(false);
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /Claude Code/ }));

  expect(screen.getByRole('menu')).toBeDefined();
});

test('a disabled row shows its state but does not tick', async () => {
  const onChange = vi.fn();

  await open(true, onChange, true);
  const item = screen.getByRole('menuitemcheckbox', { name: /Claude Code/ });

  expect(item.getAttribute('aria-disabled')).toBe('true');
  expect(item.getAttribute('aria-checked')).toBe('true');

  await userEvent.click(item);

  expect(onChange).not.toHaveBeenCalled();
});
