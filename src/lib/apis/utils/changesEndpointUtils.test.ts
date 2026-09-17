import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  expect,
  test,
  vi,
} from 'vitest';

import { encodeReference } from '@services/history/utils/sqliteUtils';

import { HEARTBEAT_MS } from '../constants';

import { handleChangeStream } from './changesEndpointUtils';

interface Session {
  readonly home: string;
  readonly filePath: string;
}

const streamFor = async (filePath: string, home: string, controller: AbortController): Promise<Response> => {
  return handleChangeStream(new Request(
    `https://local/api/changes?file=${encodeURIComponent(filePath)}`,
    { signal: controller.signal },
  ), { home });
};

const reading = (response: Response): { next: () => Promise<string>;
  cancel: () => Promise<void>; } => {
  const reader = response.body?.getReader();

  if (reader == null) {
    throw new Error('the change stream carried no body');
  }

  const decoder = new TextDecoder();

  return {
    next: async () => {
      return decoder.decode((await reader.read()).value);
    },
    cancel: async () => {
      await reader.cancel();
    },
  };
};

// A transcript somewhere the resolved roots will admit it.
const session = async (): Promise<Session> => {
  const home = await mkdtemp(join(tmpdir(), 'changes-home-'));
  const directory = join(home, '.claude', 'projects', 'demo');

  await mkdir(directory, { recursive: true });

  const filePath = join(directory, 'session.jsonl');

  await writeFile(filePath, '{}\n', 'utf8');

  return {
    home,
    filePath,
  };
};

test('refuses a request that names no file', async () => {
  const controller = new AbortController();
  const response = await handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }));

  expect(response.status).toBe(400);
});

test('refuses a file outside the agent roots rather than watching it', async () => {
  const { home } = await session();
  const controller = new AbortController();
  const outside = await mkdtemp(join(tmpdir(), 'changes-outside-'));
  const stray = join(outside, 'secret.jsonl');

  await writeFile(stray, 'x', 'utf8');

  const response = await streamFor(stray, home, controller);

  expect(response.status).toBe(400);
});

test('announces itself, then says so when the open conversation grows', async () => {
  const { home, filePath } = await session();
  const controller = new AbortController();
  const response = await streamFor(filePath, home, controller);

  expect(response.headers.get('content-type')).toBe('text/event-stream');

  const stream = reading(response);

  expect(await stream.next()).toContain('event: ready');

  await writeFile(filePath, '{}\n{"more":1}\n', 'utf8');

  expect(await stream.next()).toBe('event: changed\ndata: 1\n\n');

  await stream.cancel();
  controller.abort();
});

test('ends the stream when the request is aborted', async () => {
  const { home, filePath } = await session();
  const controller = new AbortController();
  const response = await streamFor(filePath, home, controller);
  const reader = response.body?.getReader();

  if (reader == null) {
    throw new Error('the change stream carried no body');
  }

  await reader.read();
  controller.abort();

  expect((await reader.read()).done).toBe(true);
});

test('watches a session held in a database, and shrugs at the absent sidecar', async () => {
  const home = await mkdtemp(join(tmpdir(), 'changes-db-'));
  const directory = join(home, '.claude', 'projects', 'demo');

  await mkdir(directory, { recursive: true });

  const databasePath = join(directory, 'state.vscdb');

  await writeFile(databasePath, 'not really sqlite', 'utf8');

  const controller = new AbortController();
  const response = await streamFor(encodeReference({
    databasePath,
    table: 'chat',
  }), home, controller);
  const stream = reading(response);

  expect(await stream.next()).toContain('event: ready');

  await writeFile(databasePath, 'still not sqlite, but longer', 'utf8');

  expect(await stream.next()).toBe('event: changed\ndata: 1\n\n');

  await stream.cancel();
  controller.abort();
});

test('keeps the connection warm while nothing is happening', async () => {
  const { home, filePath } = await session();
  const controller = new AbortController();

  // Installed before the stream, or its interval is a real one already.
  vi.useFakeTimers({ shouldAdvanceTime: true });

  const response = await streamFor(filePath, home, controller);
  const stream = reading(response);

  await stream.next();

  vi.advanceTimersByTime(HEARTBEAT_MS);

  expect(await stream.next()).toBe(': ping\n\n');

  vi.useRealTimers();

  await stream.cancel();
  controller.abort();
});
