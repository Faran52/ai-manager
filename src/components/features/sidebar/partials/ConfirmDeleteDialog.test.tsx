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

import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

import type { SessionSummary } from '@services/history/historyService';

const SESSION: SessionSummary = {
  agent: 'claude',
  actualSessionId: 's',
  id: 's',
  filePath: '/s.jsonl',
  projectId: 'p',
  title: 'Important',
  messageCount: 1,
  firstTimestampMs: 0,
  lastTimestampMs: 0,
  modifiedMs: 0,
  sizeBytes: 1,
};

test('mounts closed without a dialog', () => {
  render(<ConfirmDeleteDialog sessions={[]} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.queryByRole('dialog')).toBeNull();
});

test('confirms permanent deletion and keeps the last target through the exit', async () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const { rerender } = render(
    <ConfirmDeleteDialog sessions={[SESSION]} busy={false} onClose={onClose} onConfirm={onConfirm} />,
  );

  expect(screen.getByText(/Important/u)).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(onConfirm).toHaveBeenCalledWith([SESSION]);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();

  rerender(<ConfirmDeleteDialog sessions={[]} busy onClose={onClose} onConfirm={onConfirm} />);
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(screen.getByText(/Important/u)).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('uses every non-title session label fallback', () => {
  const base = SESSION;
  const cases = [
    {
      ...base,
      title: undefined,
      summary: 'Summary',
    },
    {
      ...base,
      title: undefined,
      preview: 'Preview',
    },
    {
      ...base,
      title: undefined,
    },
  ];

  for (const item of cases) {
    const view = render(
      <ConfirmDeleteDialog sessions={[item]} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    const label = item.summary ?? item.preview ?? item.actualSessionId;

    expect(screen.getByText(`“${label}” will be permanently deleted.`)).toBeDefined();
    view.unmount();
  }
});

test('keeps an oversized title readable in the confirmation', () => {
  const sprawling = `<environment_context>\n<cwd>/Users/a/Projects/app</cwd>\n${'<root>/x</root>'.repeat(200)}`;

  render(
    <ConfirmDeleteDialog
      sessions={[{
        ...SESSION,
        title: sprawling,
      }]}
      busy={false}
      onClose={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );

  const shown = screen.getByText(/will be permanently deleted/u).textContent;

  expect(shown.length).toBeLessThan(140);
  expect(shown).not.toContain('\n');
  expect(shown).toContain('…');
});

test('states that deletion is irreversible', () => {
  render(<ConfirmDeleteDialog sessions={[SESSION]} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.getByText('This cannot be undone.')).toBeDefined();
});

test('confirms deletion for multiple selected sessions', async () => {
  const onConfirm = vi.fn();

  render(
    <ConfirmDeleteDialog
      sessions={[SESSION, {
        ...SESSION,
        id: 'two',
        filePath: '/two.jsonl',
      }]}
      busy={false}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  );

  expect(screen.getByText('Delete 2 sessions permanently?')).toBeDefined();
  expect(screen.getByText('2 selected sessions will be permanently deleted.')).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Delete 2 permanently' }));
  expect(onConfirm).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's' })]));
});
