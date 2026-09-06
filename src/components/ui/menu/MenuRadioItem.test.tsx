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
import { MenuRadioGroup } from './MenuRadioItem';

const OPTIONS = [
  {
    value: 'newest',
    label: 'Newest first',
  },
  {
    value: 'oldest',
    label: 'Oldest first',
  },
];

const open = async (onChange = vi.fn()): Promise<void> => {
  render(
    <Menu label="Order" trigger={<button type="button">Open</button>}>
      <MenuRadioGroup options={OPTIONS} value="newest" onChange={onChange} />
    </Menu>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
};

test('marks only the value in force', async () => {
  await open();

  expect(screen.getByRole('menuitemradio', { name: 'Newest first' }).getAttribute('aria-checked'))
    .toBe('true');
  expect(screen.getByRole('menuitemradio', { name: 'Oldest first' }).getAttribute('aria-checked'))
    .toBe('false');
});

/*
 * Order is a single value, so choosing one is the end of the interaction and
 * the menu closes. That is what separates it from the checkbox rows above it.
 */
test('reports the chosen value and closes', async () => {
  const onChange = vi.fn();

  await open(onChange);
  await userEvent.click(screen.getByRole('menuitemradio', { name: 'Oldest first' }));

  expect(onChange).toHaveBeenCalledWith('oldest');
  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
