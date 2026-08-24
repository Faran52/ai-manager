import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ConfirmDeleteProjectDialog } from './ConfirmDeleteProjectDialog';

import type { ProjectSummary } from '@services/history/historyService';

const PROJECT: ProjectSummary = {
  agent: 'claude',
  id: 'p',
  name: 'Important',
  sessionCount: 3,
  messageCount: 8,
  lastActivityMs: 0,
};

test('mounts closed without a dialog', () => {
  render(<ConfirmDeleteProjectDialog project={null} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.queryByRole('dialog')).toBeNull();
});

test('confirms permanent project history deletion and preserves source wording', async () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const { rerender } = render(
    <ConfirmDeleteProjectDialog project={PROJECT} busy={false} onClose={onClose} onConfirm={onConfirm} />,
  );

  expect(screen.getByText(/3 stored sessions/u)).toBeDefined();
  expect(screen.getByText('This cannot be undone.')).toBeDefined();
  expect(screen.getByText(/source project folder on disk is untouched/u)).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(onConfirm).toHaveBeenCalledWith(PROJECT);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();

  rerender(<ConfirmDeleteProjectDialog project={PROJECT} busy onClose={onClose} onConfirm={onConfirm} />);
  expect(screen.getByRole('button', { name: 'Deleting…' }).hasAttribute('disabled')).toBe(true);
  rerender(<ConfirmDeleteProjectDialog project={null} busy onClose={onClose} onConfirm={onConfirm} />);
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(screen.getByText(/3 stored sessions/u)).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
