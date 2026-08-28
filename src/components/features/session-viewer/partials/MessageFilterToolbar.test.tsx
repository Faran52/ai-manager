import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { defaultMessageFilters } from '../utils/messageFilterUtils';

import { MessageFilterToolbar } from './MessageFilterToolbar';

const onDismiss = vi.fn();

test('toggles and resets conversation filters', async () => {
  const onChange = vi.fn();
  const defaults = defaultMessageFilters();
  const { rerender } = render(
    <MessageFilterToolbar
      filters={defaults}
      total={8}
      visible={8}
      onChange={onChange}
      onDismiss={onDismiss}
    />,
  );

  expect(screen.getByText('8 items loaded')).toBeDefined();
  expect(screen.queryByText('User hidden')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Filter messages' }));
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'User messages' }));
  expect(onChange).toHaveBeenCalledWith({
    ...defaults,
    roles: {
      human: false,
      ai: true,
    },
  });

  rerender(
    <MessageFilterToolbar
      filters={{
        ...defaults,
        roles: {
          human: false,
          ai: true,
        },
      }}
      total={8}
      visible={4}
      onChange={onChange}
      onDismiss={onDismiss}
    />,
  );
  expect(screen.getByText('4 of 8 items shown')).toBeDefined();
  expect(screen.getByText('User hidden')).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Show User messages' }));
  expect(onChange).toHaveBeenLastCalledWith(defaults);
  await userEvent.click(screen.getByRole('button', { name: 'Reset conversation filters' }));
  expect(onChange).toHaveBeenLastCalledWith(defaults);

  rerender(
    <MessageFilterToolbar
      filters={defaults}
      total={1}
      visible={1}
      onChange={onChange}
      onDismiss={onDismiss}
    />,
  );
  expect(screen.getByText('1 item loaded')).toBeDefined();
});

test('asks to be dismissed', async () => {
  const dismiss = vi.fn();

  render(
    <MessageFilterToolbar
      filters={defaultMessageFilters()}
      total={2}
      visible={2}
      onChange={vi.fn()}
      onDismiss={dismiss}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Hide the filter bar' }));

  expect(dismiss).toHaveBeenCalledTimes(1);
});
