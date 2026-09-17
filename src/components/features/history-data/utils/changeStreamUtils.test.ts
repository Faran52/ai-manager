import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { subscribeToChanges } from './changeStreamUtils';

interface FakeSource {
  readonly url: string;
  readonly closed: () => boolean;
  readonly emit: () => void;
}

const opened: FakeSource[] = [];

class StubEventSource {
  private readonly handlers = new Set<() => void>();

  private isClosed = false;

  public readonly url: string;

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

test('opens one stream however many lists are watching', () => {
  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = subscribeToChanges(first);
  const stopSecond = subscribeToChanges(second);

  expect(opened).toHaveLength(1);
  expect(opened[0]?.url).toBe('/api/changes');

  opened[0]?.emit();

  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);

  stopFirst();
  stopSecond();
});

test('closes the stream once the last list stops watching, and opens a new one after', () => {
  const stop = subscribeToChanges(vi.fn());

  expect(opened[0]?.closed()).toBe(false);

  stop();

  expect(opened[0]?.closed()).toBe(true);

  const stopAgain = subscribeToChanges(vi.fn());

  expect(opened).toHaveLength(2);

  stopAgain();
});

test('holds the stream open while another list is still watching', () => {
  const stayed = vi.fn();
  const stopFirst = subscribeToChanges(vi.fn());
  const stopSecond = subscribeToChanges(stayed);

  stopFirst();

  expect(opened[0]?.closed()).toBe(false);

  opened[0]?.emit();

  expect(stayed).toHaveBeenCalledTimes(1);

  stopSecond();
});
