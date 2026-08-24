import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { SessionSelectionBar } from './SessionSelectionBar';

test('toggles all sessions and enables deletion only with a selection', async () => {
  const onToggleAll = vi.fn();
  const onDelete = vi.fn();
  const { rerender } = render(
    <SessionSelectionBar selectedCount={0} allSelected={false} onToggleAll={onToggleAll} onDelete={onDelete} />,
  );

  expect(screen.getByRole('button', { name: 'Delete selected' }).hasAttribute('disabled')).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Select all sessions' }));
  expect(onToggleAll).toHaveBeenCalled();

  rerender(<SessionSelectionBar selectedCount={2} allSelected onToggleAll={onToggleAll} onDelete={onDelete} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear selected sessions' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
  expect(onDelete).toHaveBeenCalled();
});
