import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { SessionSelectionBar } from './SessionSelectionBar';

const noop = (): void => {
  return undefined;
};

test('toggles all sessions and enables the actions only with a selection', async () => {
  const onToggleAll = vi.fn();
  const onDelete = vi.fn();
  const { rerender } = render(
    <SessionSelectionBar
      selectedCount={0}
      allSelected={false}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      onArchive={noop}
      onExport={noop}
    />,
  );

  expect(screen.getByRole('button', { name: 'Delete selected' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Archive the selected sessions' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Export the selected sessions' }).hasAttribute('disabled')).toBe(true);

  await userEvent.click(screen.getByRole('button', { name: 'Select all sessions' }));
  expect(onToggleAll).toHaveBeenCalled();

  rerender(
    <SessionSelectionBar
      selectedCount={2}
      allSelected
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      onArchive={noop}
      onExport={noop}
    />,
  );

  expect(screen.getByText('2 selected')).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Clear selected sessions' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
  expect(onDelete).toHaveBeenCalled();
});

test('archives and exports the selection', async () => {
  const onArchive = vi.fn();
  const onExport = vi.fn();

  render(
    <SessionSelectionBar
      selectedCount={3}
      allSelected={false}
      onToggleAll={noop}
      onDelete={noop}
      onArchive={onArchive}
      onExport={onExport}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Archive the selected sessions' }));
  expect(onArchive).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: 'Export the selected sessions' }));
  expect(onExport).toHaveBeenCalledTimes(1);
});

test('locks every action while one is running', () => {
  render(
    <SessionSelectionBar
      selectedCount={3}
      allSelected={false}
      onToggleAll={noop}
      onDelete={noop}
      onArchive={noop}
      onExport={noop}
      busy
    />,
  );

  expect(screen.getByRole('button', { name: 'Archive the selected sessions' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Export the selected sessions' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Delete selected' }).hasAttribute('disabled')).toBe(true);
});
