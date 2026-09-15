import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { ToastProvider, useToast } from './ToastProvider';

import type { ReactNode } from 'react';
import type { ToastVariant } from './Toast';
import type { ToastProviderProps } from './ToastProvider';

interface PusherProps {
  readonly text: string;
  readonly variant?: ToastVariant;
}

const wrapper = ({ children }: ToastProviderProps): ReactNode => {
  return <ToastProvider>{children}</ToastProvider>;
};

const Pusher = ({ text, variant }: PusherProps): ReactNode => {
  const { push } = useToast();

  return (
    <button
      type="button"
      aria-label={`push ${text}`}
      onClick={() => {
        push(text, variant);
      }}
    >
      push
    </button>
  );
};

afterEach(() => {
  vi.useRealTimers();
});

test('throws for a caller outside the provider', () => {
  expect(() => {
    renderHook(() => {
      return useToast();
    });
  }).toThrow('useToast must be used within a ToastProvider');
});

test('shows a pushed toast, defaulting to info', async () => {
  render(<Pusher text="Saved" />, { wrapper });
  await userEvent.click(screen.getByRole('button', { name: 'push Saved' }));

  expect(screen.getByText('Saved')).toBeDefined();
  expect(document.querySelector('[data-toast][data-variant="info"]')).not.toBeNull();
});

test('carries the variant it was pushed with', async () => {
  render(<Pusher text="Could not save" variant="error" />, { wrapper });
  await userEvent.click(screen.getByRole('button', { name: 'push Could not save' }));

  expect(document.querySelector('[data-toast][data-variant="error"]')).not.toBeNull();
});

test('stacks more than one toast at a time', async () => {
  render(
    <>
      <Pusher text="First" />
      <Pusher text="Second" variant="warning" />
    </>,
    { wrapper },
  );

  await userEvent.click(screen.getByRole('button', { name: 'push First' }));
  await userEvent.click(screen.getByRole('button', { name: 'push Second' }));

  expect(screen.getByText('First')).toBeDefined();
  expect(screen.getByText('Second')).toBeDefined();
});

test('closing one early removes it without waiting', async () => {
  render(<Pusher text="Saved" />, { wrapper });
  await userEvent.click(screen.getByRole('button', { name: 'push Saved' }));
  await userEvent.click(screen.getByRole('button', { name: 'Close notification' }));

  expect(screen.queryByText('Saved')).toBeNull();
});

test('dismisses on its own after a while', async () => {
  vi.useFakeTimers();
  render(<Pusher text="Saved" />, { wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'push Saved' }));

  expect(screen.getByText('Saved')).toBeDefined();

  act(() => {
    vi.advanceTimersByTime(5_000);
  });
  vi.useRealTimers();

  await waitFor(() => {
    expect(screen.queryByText('Saved')).toBeNull();
  });
});
