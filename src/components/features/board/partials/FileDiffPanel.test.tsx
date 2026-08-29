import {
  render,
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

import { parseJsonContainer } from '@utils/jsonUtils';

import { FileDiffPanel } from './FileDiffPanel';

import type { FileHistoryResponse } from '@lib/apis/contracts';
import type { FileVersion } from '@services/file-history/fileHistoryService';

const version = (number: number): FileVersion => {
  return {
    version: number,
    savedMs: number,
    sizeBytes: 10,
  };
};

const hunk = {
  oldStart: 1,
  oldLines: 2,
  newStart: 1,
  newLines: 2,
  lines: [' kept', '-gone', '+added'],
};

const respond = (body: FileHistoryResponse): typeof fetch => {
  return vi.fn(() => {
    return Promise.resolve(Response.json(body));
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const panel = (): ReturnType<typeof render> => {
  return render(<FileDiffPanel sessionId="s1" path="/repo/a.ts" />);
};

test('shows the change a version made against the one before it', async () => {
  vi.stubGlobal('fetch', respond({
    history: {
      path: '/repo/a.ts',
      versions: [version(1), version(2)],
    },
    diff: {
      version: 2,
      hunks: [hunk],
      firstRecorded: false,
    },
  }));
  panel();

  expect(await screen.findByText('-gone')).toBeDefined();
  expect(screen.getByText('+added')).toBeDefined();
  expect(screen.getByRole('button', { name: 'v2' })).toBeDefined();
  expect(screen.queryByText('Nothing is stored from before this change.')).toBeNull();
});

test('warns that the oldest version has nothing to compare against', async () => {
  vi.stubGlobal('fetch', respond({
    history: {
      path: '/repo/a.ts',
      versions: [version(1)],
    },
    diff: {
      version: 1,
      hunks: [hunk],
      firstRecorded: true,
    },
  }));
  panel();

  expect(await screen.findByText('Nothing is stored from before this change.')).toBeDefined();
});

test('asks for the version the reader picked', async () => {
  const asked: string[] = [];

  vi.stubGlobal('fetch', vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    asked.push(typeof init?.body === 'string' ? init.body : '{}');

    return Promise.resolve(Response.json({
      history: {
        path: '/repo/a.ts',
        versions: [version(1), version(2)],
      },
      diff: {
        version: 2,
        hunks: [hunk],
        firstRecorded: false,
      },
    }));
  }));
  panel();

  await userEvent.click(await screen.findByRole('button', { name: 'v1' }));

  await waitFor(() => {
    expect(asked).toHaveLength(2);
  });

  expect(parseJsonContainer(asked[1] ?? '{}')).toMatchObject({ version: 1 });
});

test('says when a session kept no snapshots of the file', async () => {
  vi.stubGlobal('fetch', respond({
    history: {
      path: '/repo/a.ts',
      versions: [],
    },
    diff: null,
  }));
  panel();

  expect(await screen.findByText('No file snapshots were kept for this session.')).toBeDefined();
});

test('reports a failure to read the stored changes', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.reject(new Error('offline'));
  }));
  panel();

  expect(await screen.findByText('The stored changes could not be read.')).toBeDefined();
});

test('says so when two snapshots either side of a change are identical', async () => {
  vi.stubGlobal('fetch', respond({
    history: {
      path: '/repo/a.ts',
      versions: [version(1), version(2)],
    },
    diff: {
      version: 2,
      hunks: [],
      firstRecorded: false,
    },
  }));
  panel();

  expect(await screen.findByText('The snapshots either side of this change are identical.'))
    .toBeDefined();
});
