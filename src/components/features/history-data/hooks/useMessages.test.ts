import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useMessages } from './useMessages';

import type { HistoryEntry } from '@services/history/historyService';
import type { SessionPage } from '@services/session/sessionService';

interface HookProps {
  readonly include: boolean;
}

interface WatchProps {
  readonly filePath: string | null;
  readonly modifiedMs: number;
}

const offsetFrom = (body: BodyInit | null | undefined): number => {
  if (typeof body !== 'string') {
    throw new Error('request offset missing');
  }

  const parsed: unknown = JSON.parse(body);

  if (typeof parsed !== 'object' || parsed == null || !('offset' in parsed) || typeof parsed.offset !== 'number') {
    throw new Error('request offset missing');
  }

  return parsed.offset;
};

let page: (offset: number) => SessionPage;

const entry = (text: string): HistoryEntry => {
  return {
    kind: 'user',
    uuid: text,
    timestamp: 't',
    sidechain: false,
    meta: false,
    text,
    outcomes: [],
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

let fetchCalls = (): number => {
  return 0;
};

const stubFetch = (): void => {
  let calls = 0;
  fetchCalls = () => {
    return calls;
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const payload = page(offsetFrom(init?.body));

      return new Response(JSON.stringify(payload));
    }),
  );
};

describe('useMessages', () => {
  test('stays empty and ready without a file', async () => {
    const { result } = renderHook(() => {
      return useMessages(null, false);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });
    expect(result.current.entries).toEqual([]);
  });

  test('loads the first page then appends on loadMore', async () => {
    stubFetch();
    page = (offset) => {
      return offset === 0
        ? {
            entries: [entry('one')],
            total: 3,
            messageCount: 3,
            hasMore: true,
            nextOffset: 1,
          }
        : {
            entries: [entry('two'), entry('three')],
            total: 3,
            messageCount: 3,
            hasMore: false,
            nextOffset: 3,
          };
    };

    const { result } = renderHook(() => {
      return useMessages('/f.jsonl', false);
    });

    await waitFor(() => {
      expect(result.current.entries.map((e) => {
        return e.kind === 'user' ? e.text : '';
      })).toEqual(['one']);
    });
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });
    expect(result.current.messageCount).toBe(3);
    expect(result.current.hasMore).toBe(false);
  });

  test('refetches from scratch when the sidechain filter flips', async () => {
    stubFetch();
    page = (offset) => {
      return offset === 0
        ? {
            entries: [entry('main'), entry('side')],
            total: 2,
            messageCount: 2,
            hasMore: false,
            nextOffset: 2,
          }
        : {
            entries: [],
            total: 0,
            messageCount: 0,
            hasMore: false,
            nextOffset: 0,
          };
    };

    const { result, rerender } = renderHook(
      (props: HookProps) => {
        return useMessages('/f.jsonl', props.include);
      },
      { initialProps: { include: true } },
    );

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    rerender({ include: false });

    await waitFor(() => {
      expect(fetchCalls()).toBeGreaterThanOrEqual(2);
    });
    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });
  });

  test('reports load failures', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"gone"}', { status: 404 });
    }));

    const { result } = renderHook(() => {
      return useMessages('/missing.jsonl', false);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
    expect(result.current.error).toBe('gone');
  });
});

describe('useMessages guards', () => {
  test('ignores resolutions after unmount', () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }),
    );

    const { result, unmount } = renderHook(() => {
      return useMessages('/f.jsonl', false);
    });

    unmount();
    resolveFetch(Response.json(JSON.parse('{"entries":[],"total":0,"hasMore":false,"nextOffset":0}')));

    expect(result.current.entries).toEqual([]);
  });

  test('loadMore is a no-op when nothing remains', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({
        entries: [entry('only')],
        total: 1,
        hasMore: false,
        nextOffset: 1,
      });
    },
    );

    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => {
      return useMessages('/f.jsonl', false);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    act(() => {
      result.current.loadMore();
    });

    expect(fetchMock.mock.calls).toHaveLength(1);
  });
});

describe('useMessages live refresh', () => {
  test('reloads every loaded page when the source file changes', async () => {
    stubFetch();
    page = (offset) => {
      return offset === 0
        ? {
            entries: [entry('one')],
            total: 1,
            messageCount: 1,
            hasMore: false,
            nextOffset: 1,
          }
        : {
            entries: [],
            total: 0,
            messageCount: 0,
            hasMore: false,
            nextOffset: 0,
          };
    };

    const { result, rerender } = renderHook(
      (props: WatchProps) => {
        return useMessages(props.filePath, 'claude', false, props.modifiedMs);
      },
      {
        initialProps: {
          filePath: '/f.jsonl',
          modifiedMs: 1,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    page = () => {
      return {
        entries: [entry('one'), entry('two')],
        total: 2,
        messageCount: 2,
        hasMore: false,
        nextOffset: 2,
      };
    };

    rerender({
      filePath: '/f.jsonl',
      modifiedMs: 2,
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });
    expect(result.current.syncing).toBe(false);
    expect(result.current.phase).toBe('ready');
  });

  test('keeps the visible feed when a refresh fails', async () => {
    stubFetch();
    page = () => {
      return {
        entries: [entry('one')],
        total: 1,
        messageCount: 1,
        hasMore: true,
        nextOffset: 1,
      };
    };

    const { result, rerender } = renderHook(
      (props: WatchProps) => {
        return useMessages(props.filePath, 'claude', false, props.modifiedMs);
      },
      {
        initialProps: {
          filePath: '/f.jsonl',
          modifiedMs: 1,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"gone"}', { status: 500 });
    }));
    rerender({
      filePath: '/f.jsonl',
      modifiedMs: 2,
    });

    await waitFor(() => {
      expect(result.current.syncing).toBe(false);
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.error).toBeUndefined();
  });

  test('ignores a source change with no file to reload', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({
        entries: [],
        total: 0,
        messageCount: 0,
        hasMore: false,
        nextOffset: 0,
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(
      (props: WatchProps) => {
        return useMessages(props.filePath, 'claude', false, props.modifiedMs);
      },
      {
        initialProps: {
          filePath: null,
          modifiedMs: 1,
        },
      },
    );

    rerender({
      filePath: null,
      modifiedMs: 2,
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });
    expect(fetchMock.mock.calls).toHaveLength(0);
  });

  test('lets the first load win over a source change that arrives with it', async () => {
    stubFetch();
    page = () => {
      return {
        entries: [entry('one')],
        total: 1,
        messageCount: 1,
        hasMore: false,
        nextOffset: 1,
      };
    };

    const { result, rerender } = renderHook(
      (props: WatchProps) => {
        return useMessages(props.filePath, 'claude', false, props.modifiedMs);
      },
      {
        initialProps: {
          filePath: '/f.jsonl',
          modifiedMs: 1,
        },
      },
    );

    rerender({
      filePath: '/f.jsonl',
      modifiedMs: 2,
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });
    expect(fetchCalls()).toBe(1);
  });
});
