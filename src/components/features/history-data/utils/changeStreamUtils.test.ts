import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { subscribeToSessionChanges } from './changeStreamUtils';

interface FakeSource {
  readonly url: string;
  readonly closed: () => boolean;
  readonly emit: () => void;
}

const opened: FakeSource[] = [];

class StubEventSource {
  public readonly url: string;

  private readonly handlers = new Set<() => void>();

  private isClosed = false;

  public constructor(url: string) {
    this.url = url;

    opened.push({
      url,
      closed: () => {
        return this.isClosed;
      },
      emit: () => {
        for (const handler of [...this.handlers]) {
          handler();
        }
      },
    });
  }

  public addEventListener(name: string, handler: () => void): void {
    if (name === 'changed') {
      this.handlers.add(handler);
    }
  }

  public close(): void {
    this.isClosed = true;
  }
}

vi.stubGlobal('EventSource', StubEventSource);

afterEach(() => {
  opened.length = 0;
});

test('watches the one conversation it was given, name and all', () => {
  const stop = subscribeToSessionChanges('/history/a project/session one.jsonl', vi.fn());

  expect(opened).toHaveLength(1);
  expect(opened[0]?.url).toBe(
    '/api/changes?file=%2Fhistory%2Fa%20project%2Fsession%20one.jsonl',
  );

  stop();
});

test('reports a change to the reader', () => {
  const onChange = vi.fn();
  const stop = subscribeToSessionChanges('/history/session.jsonl', onChange);

  opened[0]?.emit();

  expect(onChange).toHaveBeenCalledTimes(1);

  stop();
});

test('stops watching when the conversation is closed', () => {
  const stop = subscribeToSessionChanges('/history/session.jsonl', vi.fn());

  expect(opened[0]?.closed()).toBe(false);

  stop();

  expect(opened[0]?.closed()).toBe(true);
});
