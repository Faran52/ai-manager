import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { EditedFileList } from './EditedFileList';

import type { EditedFile } from '@services/edits/editsService';

const NOW = Date.parse('2026-08-28T12:00:00Z');

const file: EditedFile = {
  path: '/repo/src/a.ts',
  edits: 3,
  writes: 1,
  sessionCount: 2,
  lastEditedMs: NOW - 60_000,
  recent: [
    {
      kind: 'edit',
      sessionId: 's1',
      sessionTitle: 'Login fix',
      sessionFilePath: '/sessions/s1.jsonl',
      timestampMs: NOW - 60_000,
      changes: 3,
    },
    {
      kind: 'write',
      sessionId: 's2',
      sessionTitle: 'First draft',
      sessionFilePath: '/sessions/s2.jsonl',
      timestampMs: NOW - 600_000,
      changes: 1,
    },
  ],
};

const noop = (): void => {
  return undefined;
};

test('shortens the path against the project and counts every change', () => {
  render(
    <EditedFileList files={[file]} projectPath="/repo" nowMs={NOW} onOpenEdit={noop} />,
  );

  expect(screen.getByText('src/a.ts')).toBeDefined();
  expect(screen.getByText('4 changes')).toBeDefined();
});

test('keeps a path that lies outside the project whole', () => {
  render(
    <EditedFileList files={[file]} projectPath="/elsewhere" nowMs={NOW} onOpenEdit={noop} />,
  );

  expect(screen.getByText('/repo/src/a.ts')).toBeDefined();
});

test('keeps the path whole when the project has none', () => {
  render(
    <EditedFileList files={[file]} projectPath={undefined} nowMs={NOW} onOpenEdit={noop} />,
  );

  expect(screen.getByText('/repo/src/a.ts')).toBeDefined();
});

test('expands to the sessions that touched it, then collapses', async () => {
  render(
    <EditedFileList files={[file]} projectPath="/repo" nowMs={NOW} onOpenEdit={noop} />,
  );

  expect(screen.queryByText('Login fix')).toBeNull();

  await userEvent.click(screen.getByText('src/a.ts'));

  expect(screen.getByText('Login fix')).toBeDefined();
  expect(screen.getByText('First draft')).toBeDefined();
  expect(screen.getByText('edited')).toBeDefined();
  expect(screen.getByText('wrote')).toBeDefined();

  await userEvent.click(screen.getByText('src/a.ts'));
  expect(screen.getByText('src/a.ts')).toBeDefined();
});

test('opens the session an edit came from', async () => {
  const onOpenEdit = vi.fn();

  render(
    <EditedFileList files={[file]} projectPath="/repo" nowMs={NOW} onOpenEdit={onOpenEdit} />,
  );

  await userEvent.click(screen.getByText('src/a.ts'));
  await userEvent.click(screen.getByText('Login fix'));

  expect(onOpenEdit).toHaveBeenCalledWith(file.recent[0]);
});
