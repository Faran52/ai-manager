import {
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { ToastStack } from './ToastStack';

test('stays mounted as a live region with nothing to show', () => {
  render(<ToastStack toasts={[]} onDismiss={vi.fn()} />);

  expect(screen.getByRole('status')).toBeDefined();
});

test('shows every active toast', () => {
  render(
    <ToastStack
      toasts={[
        {
          id: 1,
          text: 'First',
          variant: 'info',
        },
        {
          id: 2,
          text: 'Second',
          variant: 'error',
        },
      ]}
      onDismiss={vi.fn()}
    />,
  );

  expect(screen.getByText('First')).toBeDefined();
  expect(screen.getByText('Second')).toBeDefined();
});

test('dismisses only the toast whose close button was pressed', async () => {
  const onDismiss = vi.fn();

  render(
    <ToastStack
      toasts={[
        {
          id: 1,
          text: 'First',
          variant: 'info',
        },
        {
          id: 2,
          text: 'Second',
          variant: 'info',
        },
      ]}
      onDismiss={onDismiss}
    />,
  );

  const second = screen.getByText('Second').closest<HTMLElement>('[data-toast]');

  if (second == null) {
    throw new Error('the second toast never rendered');
  }

  await userEvent.click(within(second).getByRole('button', { name: 'Close notification' }));

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith(2);
});
