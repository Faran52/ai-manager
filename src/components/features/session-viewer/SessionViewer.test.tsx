import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  messageFilterBarStorageKey,
  messageNavigatorOpenStorageKey,
  messageNavigatorWidthStorageKey,
} from '@config/storageKeys';

import { SessionViewer } from './SessionViewer';

beforeEach(() => {
  localStorage.setItem(messageNavigatorOpenStorageKey, 'false');
});

afterEach(() => {
  // Unmount first, a viewer left mounted would refetch against the real fetch.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const stubPage = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      return new Response(
        JSON.stringify({
          entries: [
            {
              kind: 'user',
              uuid: 'u1',
              timestamp: '2026-05-05T10:00:00Z',
              sidechain: false,
              meta: false,
              text: 'the question',
              outcomes: [],
            },
          ],
          total: 4,
          hasMore: true,
          nextOffset: 1,
        }),
      );
    },
    ),
  );
};

describe('SessionViewer', () => {
  test('shows the empty state without a file', () => {
    render(<SessionViewer filePath={null} projectLabel="" sessionTitle={undefined} highlightTimestamp={undefined} />);

    expect(screen.getByText('No session selected')).toBeDefined();
  });

  test('names the branch the session was working on beside its project', async () => {
    stubPage();
    render(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        gitBranch="feat/login"
        highlightTimestamp={undefined}
      />,
    );

    expect(await screen.findByText('feat/login')).toBeDefined();
    expect(screen.getByText('webapp')).toBeDefined();
  });

  test('loads a feed with toolbar metadata and load-more', async () => {
    stubPage();
    render(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        highlightTimestamp={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('the question')).toBeDefined();
    });
    expect(screen.getByText('Login fix')).toBeDefined();
    expect(screen.getByText('webapp')).toBeDefined();
    expect(screen.getByText(/Load more/)).toBeDefined();
  });

  test('appends the next page when load more is pressed', async () => {
    let callCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        callCount += 1;
        const first = callCount === 1;

        return new Response(
          JSON.stringify({
            entries: [
              {
                kind: 'user',
                uuid: first ? 'u1' : 'u2',
                timestamp: 't',
                sidechain: false,
                meta: false,
                text: first ? 'first chunk' : 'second chunk',
                outcomes: [],
              },
            ],
            total: 2,
            hasMore: first,
            nextOffset: first ? 1 : 2,
          }),
        );
      }),
    );

    render(
      <SessionViewer filePath="/f.jsonl" projectLabel="p" sessionTitle={undefined} highlightTimestamp={undefined} />,
    );
    await waitFor(() => {
      expect(screen.getByText('first chunk')).toBeDefined();
    });

    await userEvent.click(screen.getByText(/Load more/));

    await waitFor(() => {
      expect(screen.getByText('second chunk')).toBeDefined();
    });
    expect(screen.queryByText(/Load more/)).toBeNull();
  });

  test('copies markdown through the export menu', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    stubPage();

    render(<SessionViewer filePath="/f.jsonl" projectLabel="proj" sessionTitle="T" highlightTimestamp={undefined} />);
    await waitFor(() => {
      expect(screen.getByText('the question')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('Copy markdown'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledOnce();
    });
    expect(String(writeText.mock.calls.at(0)?.at(0))).toContain('# T');
  });

  test('downloads a json export via the menu', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      return 'blob:x';
    });
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return undefined;
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      return undefined;
    });
    stubPage();

    render(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="proj"
        sessionTitle="My Title"
        highlightTimestamp={undefined}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('the question')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('JSON file'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

describe('SessionViewer states', () => {
  test('shows the error body when loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"vanished"}', { status: 404 });
    }));

    render(
      <SessionViewer
        filePath="/gone.jsonl"
        projectLabel="p"
        sessionTitle={undefined}
        highlightTimestamp={undefined}
      />,
    );

    expect(await screen.findByText('vanished')).toBeDefined();
  });

  test('toggles sidechain visibility and refetches', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({
        entries: [
          {
            kind: 'user',
            uuid: 'u1',
            timestamp: 't',
            sidechain: false,
            meta: false,
            text: 'main line',
            outcomes: [],
          },
        ],
        total: 1,
        messageCount: 1,
        hasMore: false,
        nextOffset: 1,
      });
    },
    );

    vi.stubGlobal('fetch', fetchMock);
    render(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle={undefined}
        highlightTimestamp={undefined}
      />,
    );
    await screen.findByText('main line');
    expect(screen.getByText('1 message')).toBeDefined();

    await userEvent.click(screen.getByText('Include subagent activity'));

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('hides subagent activity for unsupported agents', async () => {
    stubPage();

    render(
      <SessionViewer
        filePath="/f.jsonl"
        agent="codex"
        projectLabel="p"
        sessionTitle={undefined}
        highlightTimestamp={undefined}
      />,
    );
    await screen.findByText('the question');

    expect(screen.queryByText('Include subagent activity')).toBeNull();
  });

  test('scrolls to a highlighted timestamp once entries exist', async () => {
    stubPage();
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(() => {
      return undefined;
    });

    render(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle="T"
        highlightTimestamp="2026-05-05T10:00:00Z"
      />,
    );
    await screen.findByText('the question');

    // The entries arriving and the scroll effect running are separate commits,
    // so sampling the spy the moment the text appears is a race.
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled();
    });
  });

  test('does not re-scroll for an already-scrolled highlight', async () => {
    stubPage();
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(() => {
      return undefined;
    });

    const view = render(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle="T"
        highlightTimestamp="2026-05-05T10:00:00Z"
      />,
    );
    await screen.findByText('the question');

    view.rerender(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle="T"
        highlightTimestamp={undefined}
      />,
    );
    view.rerender(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle="T"
        highlightTimestamp="2026-05-05T10:00:00Z"
      />,
    );

    const afterRepeat = scrollSpy.mock.calls.length;

    view.rerender(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle="T"
        highlightTimestamp="2026-05-05T10:00:00Z"
      />,
    );

    expect(scrollSpy.mock.calls).toHaveLength(afterRepeat);
  });
});

describe('SessionViewer remaining states', () => {
  test('keeps showing the spinner while the first page is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Promise<Response>(() => {
        return undefined;
      });
    }));

    render(
      <SessionViewer
        filePath="/f.jsonl"
        projectLabel="p"
        sessionTitle={undefined}
        highlightTimestamp={undefined}
      />,
    );

    expect(screen.getByRole('status')).toBeDefined();
  });

  test('downloads a markdown export via the menu', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      return 'blob:m';
    });

    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return undefined;
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      return undefined;
    });
    stubPage();

    render(<SessionViewer filePath="/f.jsonl" projectLabel="proj" sessionTitle="Doc" highlightTimestamp={undefined} />);
    await screen.findByText('the question');

    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('Markdown file'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  test('downloads an html export via the menu', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      return 'blob:h';
    });

    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return undefined;
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      return undefined;
    });
    stubPage();

    render(<SessionViewer filePath="/f.jsonl" projectLabel="proj" sessionTitle="Doc" highlightTimestamp={undefined} />);
    await screen.findByText('the question');

    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('HTML file'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });
});

describe('SessionViewer feedback', () => {
  test('announces the copy and toggles the sidechain filter state', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    stubPage();

    render(<SessionViewer filePath="/f.jsonl" projectLabel="p" sessionTitle="T" highlightTimestamp={undefined} />);
    await screen.findByText('the question');

    const sidechainButton = screen.getByText('Include subagent activity').closest('button');

    if (sidechainButton != null) {
      await userEvent.click(sidechainButton);
    }

    expect(sidechainButton?.getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('Copy markdown'));

    expect(await screen.findByText('Copied!')).toBeDefined();
    await userEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Copy markdown')).toBeDefined();
  });
});

describe('SessionViewer conversation filters', () => {
  test('filters human and AI content types and resets the timeline', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json({
        entries: [
          {
            kind: 'user',
            uuid: 'u1',
            timestamp: 't1',
            sidechain: false,
            meta: false,
            text: 'visible question',
            outcomes: [],
          },
          {
            kind: 'user',
            uuid: 'u2',
            timestamp: 't2',
            sidechain: false,
            meta: false,
            text: '',
            command: '/review',
            outcomes: [],
          },
          {
            kind: 'assistant',
            uuid: 'a1',
            timestamp: 't3',
            sidechain: false,
            model: 'model-x',
            blocks: [
              {
                blockType: 'text',
                text: 'visible answer',
              },
              {
                blockType: 'thinking',
                thinking: 'private reasoning',
              },
              {
                blockType: 'tool-use',
                call: {
                  id: 'tool-1',
                  name: 'Read',
                  input: {
                    kind: 'generic',
                    rows: [],
                  },
                },
              },
            ],
          },
        ],
        total: 3,
        messageCount: 3,
        hasMore: false,
        nextOffset: 3,
      });
    }));

    render(<SessionViewer filePath="/f.jsonl" projectLabel="p" sessionTitle="T" highlightTimestamp={undefined} />);
    await screen.findByText('visible answer');

    await userEvent.click(screen.getByRole('button', { name: 'Filter messages' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Assistant messages' }));
    expect(screen.queryByText('visible answer')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show Assistant messages' }));

    await userEvent.click(screen.getByRole('button', { name: 'Filter messages' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Thinking' }));
    expect(screen.queryByText('private reasoning')).toBeNull();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Tool activity' }));
    expect(screen.queryByText('Read')).toBeNull();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Commands' }));
    expect(screen.queryByText('/review')).toBeNull();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'User messages' }));
    expect(screen.queryByText('visible question')).toBeNull();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Text messages' }));
    expect(screen.queryByText('visible answer')).toBeNull();

    await userEvent.click(screen.getByLabelText('Reset conversation filters'));
    expect(screen.getByText('visible question')).toBeDefined();
    expect(screen.getByText('visible answer')).toBeDefined();
  });
});

describe('SessionViewer title fallbacks', () => {
  test('falls back to the generic title for symbol-only names', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      return 'blob:s';
    });
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
      return undefined;
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      return undefined;
    });
    stubPage();

    render(<SessionViewer filePath="/f.jsonl" projectLabel="p" sessionTitle="!!!" highlightTimestamp={undefined} />);
    await screen.findByText('the question');

    await userEvent.click(screen.getByText('Export'));
    await userEvent.click(screen.getByText('JSON file'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  test('uses the generic title when the file path has no basename', async () => {
    stubPage();

    render(<SessionViewer filePath="/" projectLabel="p" sessionTitle={undefined} highlightTimestamp={undefined} />);

    expect(screen.getByText('Session')).toBeDefined();
    await screen.findByText('the question');
  });
});

describe('SessionViewer message navigator', () => {
  const openViewer = (): void => {
    render(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        highlightTimestamp={undefined}
      />,
    );
  };

  test('opens by default, closes from its header and reopens from the toolbar', async () => {
    localStorage.setItem(messageNavigatorOpenStorageKey, 'true');
    stubPage();
    openViewer();

    await waitFor(() => {
      expect(screen.getByLabelText('Message navigator')).toBeDefined();
    });

    await userEvent.click(screen.getByLabelText('Close message navigator'));
    expect(screen.queryByLabelText('Message navigator')).toBeNull();
    expect(localStorage.getItem(messageNavigatorOpenStorageKey)).toBe('false');

    await userEvent.click(screen.getByText('Navigator'));
    expect(screen.getByLabelText('Message navigator')).toBeDefined();
  });

  test('toggles with the keyboard shortcut and ignores other keys', async () => {
    stubPage();
    openViewer();

    await waitFor(() => {
      expect(screen.getByText('Navigator')).toBeDefined();
    });

    fireEvent.keyDown(window, {
      key: 'M',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(screen.getByLabelText('Message navigator')).toBeDefined();

    fireEvent.keyDown(window, {
      key: 'm',
      metaKey: true,
      shiftKey: true,
    });
    expect(screen.queryByLabelText('Message navigator')).toBeNull();

    fireEvent.keyDown(window, {
      key: 'm',
      shiftKey: true,
    });
    expect(screen.queryByLabelText('Message navigator')).toBeNull();
  });

  test('scrolls the timeline to the entry the navigator picked', async () => {
    localStorage.setItem(messageNavigatorOpenStorageKey, 'true');
    stubPage();
    openViewer();

    await waitFor(() => {
      expect(screen.getByLabelText('User 1')).toBeDefined();
    });
    await userEvent.click(screen.getByLabelText('User 1'));

    expect(screen.getAllByText('the question').length).toBeGreaterThan(1);
  });

  test('restores, clamps and remembers the navigator width', async () => {
    localStorage.setItem(messageNavigatorOpenStorageKey, 'true');
    localStorage.setItem(messageNavigatorWidthStorageKey, '9999');
    stubPage();
    openViewer();

    await waitFor(() => {
      expect(screen.getByLabelText('Message navigator').style.width).toBe('420px');
    });

    const divider = screen.getByLabelText('Resize message navigator');

    divider.setPointerCapture = (): void => {
      return undefined;
    };
    divider.hasPointerCapture = (): boolean => {
      return true;
    };

    fireEvent.pointerDown(divider, {
      pointerId: 1,
      clientX: 100,
    });
    fireEvent.pointerMove(divider, {
      pointerId: 1,
      clientX: 140,
    });

    expect(screen.getByLabelText('Message navigator').style.width).toBe('380px');
    expect(localStorage.getItem(messageNavigatorWidthStorageKey)).toBe('380');
  });

  test('falls back to the default width when nothing usable is stored', async () => {
    localStorage.setItem(messageNavigatorOpenStorageKey, 'true');
    localStorage.setItem(messageNavigatorWidthStorageKey, 'wide');
    stubPage();
    openViewer();

    await waitFor(() => {
      expect(screen.getByLabelText('Message navigator').style.width).toBe('280px');
    });
  });
});

describe('SessionViewer live watching', () => {
  test('marks the live badge while a refresh is in flight', async () => {
    let releaseRefresh = (): void => {
      return undefined;
    };
    let calls = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        calls += 1;
        const payload = JSON.stringify({
          entries: [{
            kind: 'user',
            uuid: 'u1',
            timestamp: '2026-05-05T10:00:00Z',
            sidechain: false,
            meta: false,
            text: 'the question',
            outcomes: [],
          }],
          total: 1,
          messageCount: 1,
          hasMore: false,
          nextOffset: 1,
        });

        if (calls === 1) {
          return Promise.resolve(new Response(payload));
        }

        return new Promise<Response>((resolve) => {
          releaseRefresh = () => {
            resolve(new Response(payload));
          };
        });
      }),
    );

    const { rerender } = render(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        highlightTimestamp={undefined}
        sourceModifiedMs={1}
      />,
    );

    await screen.findByText('the question');
    expect(screen.getByTitle('Watching for transcript updates')).toBeDefined();

    rerender(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        highlightTimestamp={undefined}
        sourceModifiedMs={2}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Checking for transcript updates')).toBeDefined();
    });

    releaseRefresh();
    await waitFor(() => {
      expect(screen.getByTitle('Watching for transcript updates')).toBeDefined();
    });
  });
});

describe('SessionViewer filter bar', () => {
  test('dismisses the bar, remembers it, and brings it back from the header', async () => {
    stubPage();
    render(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        highlightTimestamp={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filter messages' })).toBeDefined();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Hide the filter bar' }));

    expect(screen.queryByRole('button', { name: 'Filter messages' })).toBeNull();
    expect(localStorage.getItem(messageFilterBarStorageKey)).toBe('false');

    await userEvent.click(screen.getByText('Filters'));
    expect(screen.getByRole('button', { name: 'Filter messages' })).toBeDefined();
  });

  test('starts hidden when it was dismissed last time', async () => {
    localStorage.setItem(messageFilterBarStorageKey, 'false');
    stubPage();
    render(
      <SessionViewer
        filePath="/sessions/s.jsonl"
        projectLabel="webapp"
        sessionTitle="Login fix"
        highlightTimestamp={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeDefined();
    });
    expect(screen.queryByRole('button', { name: 'Filter messages' })).toBeNull();
  });
});
