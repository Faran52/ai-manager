import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

import type { ReactElement } from 'react';

const subject = (open: boolean, onClose: () => void): ReactElement => {
  return (
    <ConfirmDialog
      open={open}
      labelledBy="confirm-title"
      icon={<i data-testid="icon" />}
      heading="Move to Trash?"
      description={<p>Are you sure?</p>}
      confirmLabel="Move it"
      onClose={onClose}
      onConfirm={vi.fn()}
    />
  );
};

describe('ConfirmDialog', () => {
  it('renders heading, description and confirm label', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        labelledBy="confirm-title"
        icon={<i data-testid="icon" />}
        heading="Move to Trash?"
        description={<p>Are you sure?</p>}
        confirmLabel="Move it"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Move to Trash?')).toBeDefined();
    expect(screen.getByText('Are you sure?')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Move it' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables actions while busy and swaps the confirm label', async () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        labelledBy="confirm-title"
        icon={null}
        heading="Busy"
        description={null}
        confirmLabel="Go"
        busyLabel="Going…"
        busy
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Going…' });

    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes through the cancel action', async () => {
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        labelledBy="confirm-title"
        icon={null}
        heading="Cancel me"
        description={null}
        confirmLabel="Go"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed and keeps its content through the exit', async () => {
    const { container, rerender } = render(subject(false, vi.fn()));

    expect(container.hasChildNodes()).toBe(false);

    rerender(subject(true, vi.fn()));
    expect(screen.getByRole('dialog')).toBeDefined();

    rerender(subject(false, vi.fn()));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Are you sure?')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
