import {
  fireEvent,
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

import { RenameSessionDialog } from './RenameSessionDialog';

import type { SessionSummary } from '@services/history/historyService';

const session = (agent: 'claude' | 'codex'): SessionSummary => {
  return {
    agent,
    actualSessionId: 's',
    id: 's',
    filePath: '/s.jsonl',
    projectId: 'p',
    title: 'Old',
    messageCount: 1,
    firstTimestampMs: 0,
    lastTimestampMs: 0,
    modifiedMs: 0,
    sizeBytes: 1,
  };
};

test('submits a new native Claude title', async () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <RenameSessionDialog
      open
      session={session('claude')}
      busy={false}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
  expect(screen.getByText('Rename in Claude Code')).toBeDefined();
  await userEvent.clear(screen.getByLabelText('Session title'));
  expect(screen.getByRole('button', { name: 'Rename' }).hasAttribute('disabled')).toBe(true);
  await userEvent.type(screen.getByLabelText('Session title'), 'New');
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ agent: 'claude' }), 'New');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});

test('mounts closed without a dialog', () => {
  render(<RenameSessionDialog open={false} session={null} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.queryByRole('dialog')).toBeNull();
});

test('labels Codex native rename and its busy state', () => {
  render(<RenameSessionDialog open session={session('codex')} busy onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.getByText('Rename in Codex CLI')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Renaming…' }).hasAttribute('disabled')).toBe(true);
});

test('keeps the edited session through the exit animation', async () => {
  const { rerender } = render(
    <RenameSessionDialog open session={session('claude')} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
  );
  await userEvent.clear(screen.getByLabelText('Session title'));
  await userEvent.type(screen.getByLabelText('Session title'), 'Typed');

  rerender(<RenameSessionDialog open={false} session={null} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.getByRole('dialog')).toBeDefined();
  expect(screen.getByText('Rename in Claude Code')).toBeDefined();
  expect(screen.getByDisplayValue('Typed')).toBeDefined();

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('reseeds the field when a different session is renamed', () => {
  const first: SessionSummary = {
    ...session('claude'),
    id: 'one',
    title: 'First',
  };
  const second: SessionSummary = {
    ...session('claude'),
    id: 'two',
    title: 'Second',
  };
  const { rerender } = render(
    <RenameSessionDialog open session={first} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
  );
  expect(screen.getByDisplayValue('First')).toBeDefined();

  rerender(<RenameSessionDialog open session={second} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.getByDisplayValue('Second')).toBeDefined();
});

test('uses summary, preview, and empty title fallbacks without submitting blanks', () => {
  const onConfirm = vi.fn();
  const base = session('claude');
  const summarySession = {
    ...base,
    title: undefined,
    summary: 'Summary title',
  };
  const first = render(
    <RenameSessionDialog open session={summarySession} busy={false} onClose={vi.fn()} onConfirm={onConfirm} />,
  );
  expect(screen.getByDisplayValue('Summary title')).toBeDefined();
  first.unmount();

  const previewSession = {
    ...base,
    title: undefined,
    preview: 'Preview title',
  };
  const second = render(
    <RenameSessionDialog open session={previewSession} busy={false} onClose={vi.fn()} onConfirm={onConfirm} />,
  );
  expect(screen.getByDisplayValue('Preview title')).toBeDefined();
  second.unmount();

  const untitled = {
    ...base,
    title: undefined,
  };
  render(<RenameSessionDialog open session={untitled} busy={false} onClose={vi.fn()} onConfirm={onConfirm} />);
  fireEvent.submit(screen.getByRole('button', { name: 'Rename' }).closest('form') ?? document.body);
  expect(onConfirm).not.toHaveBeenCalled();
});
