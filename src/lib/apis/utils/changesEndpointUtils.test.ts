import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { handleChangeStream } from './changesEndpointUtils';

interface Stream {
  readonly next: () => Promise<string>;
  readonly cancel: () => Promise<void>;
}

const reading = (response: Response): Stream => {
  const reader = response.body?.getReader();

  if (reader == null) {
    throw new Error('the change stream carried no body');
  }

  const decoder = new TextDecoder();

  return {
    next: async () => {
      const { value } = await reader.read();

      return decoder.decode(value);
    },
    cancel: async () => {
      await reader.cancel();
    },
  };
};

test('announces itself, then says so when a watched file is written', async () => {
  const root = await mkdtemp(join(tmpdir(), 'changes-'));
  const controller = new AbortController();
  const response = handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }), undefined, {
    roots: [root],
    debounceMs: 10,
  });

  expect(response.headers.get('content-type')).toBe('text/event-stream');

  const stream = reading(response);

  expect(await stream.next()).toContain('event: ready');

  await writeFile(join(root, 'rollout-1.jsonl'), '{}', 'utf8');

  expect(await stream.next()).toContain('event: changed');

  await stream.cancel();
  controller.abort();
});

test('collapses a burst of writes into one event', async () => {
  const root = await mkdtemp(join(tmpdir(), 'changes-burst-'));
  const controller = new AbortController();
  const response = handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }), undefined, {
    roots: [root],
    debounceMs: 40,
  });
  const stream = reading(response);

  await stream.next();

  for (const name of ['a', 'b', 'c']) {
    await writeFile(join(root, `rollout-${name}.jsonl`), '{}', 'utf8');
  }

  expect(await stream.next()).toBe('event: changed\ndata: 1\n\n');

  await stream.cancel();
  controller.abort();
});

test('skips a root that is not there rather than refusing to stream', async () => {
  const controller = new AbortController();
  const response = handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }), undefined, { roots: ['/nowhere/at/all'] });
  const stream = reading(response);

  expect(await stream.next()).toContain('event: ready');

  await stream.cancel();
  controller.abort();
});

test('keeps the connection warm while nothing is happening', async () => {
  const root = await mkdtemp(join(tmpdir(), 'changes-idle-'));
  const controller = new AbortController();
  const response = handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }), undefined, {
    roots: [root],
    heartbeatMs: 10,
  });
  const stream = reading(response);

  await stream.next();

  expect(await stream.next()).toBe(': ping\n\n');

  await stream.cancel();
  controller.abort();
});

test('ends the stream when the request is aborted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'changes-abort-'));
  const controller = new AbortController();
  const response = handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }), undefined, { roots: [root] });
  const reader = response.body?.getReader();

  if (reader == null) {
    throw new Error('the change stream carried no body');
  }

  await reader.read();
  controller.abort();

  expect((await reader.read()).done).toBe(true);
});

test('watches the agent roots when it is handed none', async () => {
  const home = await mkdtemp(join(tmpdir(), 'changes-home-'));
  const controller = new AbortController();
  const response = handleChangeStream(new Request('https://local/api/changes', {
    signal: controller.signal,
  }), { home });
  const stream = reading(response);

  expect(await stream.next()).toContain('event: ready');

  await stream.cancel();
  controller.abort();
});
