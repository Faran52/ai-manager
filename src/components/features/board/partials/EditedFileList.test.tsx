import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { parseJsonContainer } from '@utils/jsonUtils';

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

test('opens the stored changes for the session that made them', async () => {
  let asked: string | undefined;
  const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    asked = typeof init?.body === 'string' ? init.body : undefined;

    return Promise.resolve(Response.json({
      history: {
        path: '/repo/src/a.ts',
        versions: [{
          version: 1,
          savedMs: NOW,
          sizeBytes: 4,
        }],
      },
      diff: {
        version: 1,
        hunks: [{
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: ['+written'],
        }],
        firstRecorded: true,
      },
    }));
  });

  vi.stubGlobal('fetch', fetchMock);
  render(
    <EditedFileList
      files={[file]}
      projectPath="/repo"
      nowMs={NOW}
      onOpenEdit={() => {
        return undefined;
      }}
    />,
  );

  await userEvent.click(screen.getByText('src/a.ts'));
  await userEvent.click(screen.getAllByLabelText('Show changes')[0] ?? document.body);

  expect(await screen.findByText('+written')).toBeDefined();
  expect(parseJsonContainer(asked ?? '{}')).toMatchObject({ sessionId: 's1' });

  await userEvent.click(screen.getAllByLabelText('Show changes')[0] ?? document.body);

  expect(screen.queryByText('+written')).toBeNull();

  vi.unstubAllGlobals();
});
