import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { SearchDialog } from './SearchDialog';

import type { SearchController } from '@features/history-data';
import type { SearchHit } from '@services/search/searchService';

afterEach(() => {
  vi.useRealTimers();
});

const hit = (over?: Partial<SearchHit>): SearchHit => {
  return {
    agent: 'claude',
    filePath: '/r/a.jsonl',
    projectId: 'p1',
    sessionId: 'sessA',
    role: 'user',
    timestampMs: Date.UTC(2026, 0, 5),
    before: 'before ',
    match: 'needle',
    after: ' after',
    ...over,
  };
};

const names = new Map([
  ['p1', 'webapp'],
  ['p2', 'cli'],
]);

describe('SearchDialog', () => {
  test('does not repeat a search when the controller result changes', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const controller: SearchController = {
      phase: 'idle',
      query: '',
      outcome: undefined,
      error: undefined,
      run,
    };
    const { rerender } = render(
      <SearchDialog open onClose={vi.fn()} search={controller} projectNames={names} onJump={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Search history'), { target: { value: 'needle' } });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(run).toHaveBeenCalledOnce();

    rerender(
      <SearchDialog
        open
        onClose={vi.fn()}
        search={{
          ...controller,
          phase: 'ready',
          outcome: {
            hits: [],
            truncated: false,
          },
        }}
        projectNames={names}
        onJump={vi.fn()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(run).toHaveBeenCalledOnce();
  });

  test('prompts below two characters and debounces a search request', async () => {
    const search = controller_stub();

    render(
      <SearchDialog
        open
        onClose={() => {
          return undefined;
        }}
        search={search}
        projectNames={names}
        onJump={() => {
          return undefined;
        }}
      />,
    );

    expect(screen.getByText('Type at least two characters.')).toBeDefined();

    await userEvent.type(screen.getByLabelText('Search history'), 'ne');

    await waitForRun(search);
    expect(search.run).toHaveBeenCalledWith('ne', null);
  });

  const waitForRun = (search: SearchController) => {
    return vi.waitFor(() => {
      expect(search.run).toHaveBeenCalled();
    });
  };

  const controller_stub = (): SearchController => {
    const run = vi.fn();

    return {
      phase: 'idle',
      query: '',
      outcome: undefined,
      error: undefined,
      run,
    };
  };

  test('groups hits per session and jumps on selection', async () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    const search: SearchController = {
      phase: 'ready',
      query: 'needle',
      outcome: {
        hits: [hit(), hit({
          sessionId: 'sessB',
          filePath: '/r/b.jsonl',
          projectId: 'p2',
          role: 'assistant',
        })],
        truncated: false,
      },
      error: undefined,
      run: vi.fn(),
    };

    render(
      <SearchDialog open onClose={onClose} search={search} projectNames={names} onJump={onJump} />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'ne');

    expect(await screen.findAllByText('needle')).toHaveLength(2);

    const hitButton = screen.getAllByRole<HTMLButtonElement>('button', { name: /user/ }).at(0);

    if (hitButton != null) {
      await userEvent.click(hitButton);
    }

    expect(onJump).toHaveBeenCalledWith(hit());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders the error phase and the no-match branch after a query', async () => {
    const base = {
      open: true,
      onClose: () => {
        return undefined;
      },
      projectNames: new Map<string, string>(),
      onJump: () => {
        return undefined;
      },
    };
    const errorController: SearchController = {
      phase: 'error',
      query: 'x',
      outcome: undefined,
      error: 'boom',
      run: () => {
        return undefined;
      },
    };

    const { rerender } = render(
      <SearchDialog {...base} search={errorController} />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'zz');

    rerender(
      <SearchDialog
        {...base}
        search={{
          phase: 'ready',
          query: 'zz',
          outcome: {
            hits: [],
            truncated: false,
          },
          error: undefined,
          run: () => {
            return undefined;
          },
        }}
      />,
    );

    expect(screen.getByText('No matches.')).toBeDefined();
  });
});

describe('SearchDialog grouping and phases', () => {
  test('merges hits from one session into a single group with role labels', async () => {
    const search: SearchController = {
      phase: 'ready',
      query: 'needle',
      outcome: {
        hits: [
          hit(),
          hit({ role: 'assistant' }),
          hit({ role: 'system' }),
          hit({
            role: 'summary',
            timestampMs: 0,
          }),
        ],
        truncated: false,
      },
      error: undefined,
      run: vi.fn(),
    };

    render(
      <SearchDialog
        open
        onClose={() => {
          return undefined;
        }}
        search={search}
        projectNames={names}
        onJump={() => {
          return undefined;
        }}
      />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'ne');

    expect(await screen.findAllByText('needle')).toHaveLength(4);
    expect(screen.getByText('assistant')).toBeDefined();
    expect(screen.getAllByText('system').length).toBeGreaterThan(0);
  });

  test('narrows the results to what the person typed', async () => {
    const search: SearchController = {
      phase: 'ready',
      query: 'needle',
      outcome: {
        hits: [hit(), hit({ role: 'assistant' })],
        truncated: false,
      },
      error: undefined,
      run: vi.fn(),
    };

    render(
      <SearchDialog
        open
        onClose={() => {
          return undefined;
        }}
        search={search}
        projectNames={names}
        onJump={() => {
          return undefined;
        }}
      />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'ne');

    expect(await screen.findAllByText('needle')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Prompts only' }));

    expect(screen.getAllByText('needle')).toHaveLength(1);
    expect(screen.queryByText('assistant')).toBeNull();
  });

  test('shows the searching state while a query is pending', async () => {
    const search: SearchController = {
      phase: 'loading',
      query: 'ne',
      outcome: undefined,
      error: undefined,
      run: vi.fn(),
    };

    render(
      <SearchDialog
        open
        onClose={() => {
          return undefined;
        }}
        search={search}
        projectNames={names}
        onJump={() => {
          return undefined;
        }}
      />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'ne');

    expect(screen.getByText('Searching…')).toBeDefined();
  });
});

describe('SearchDialog outcome edge cases', () => {
  test('treats a ready phase without an outcome as no matches', async () => {
    const search: SearchController = {
      phase: 'ready',
      query: 'zz',
      outcome: undefined,
      error: undefined,
      run: vi.fn(),
    };

    render(
      <SearchDialog
        open
        onClose={() => {
          return undefined;
        }}
        search={search}
        projectNames={names}
        onJump={() => {
          return undefined;
        }}
      />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'zz');

    expect(screen.getByText('No matches.')).toBeDefined();
  });

  test('falls back to the raw project id for unknown projects', async () => {
    const search: SearchController = {
      phase: 'ready',
      query: 'needle',
      outcome: {
        hits: [hit({ projectId: 'mystery' })],
        truncated: false,
      },
      error: undefined,
      run: vi.fn(),
    };

    render(
      <SearchDialog
        open
        onClose={() => {
          return undefined;
        }}
        search={search}
        projectNames={names}
        onJump={() => {
          return undefined;
        }}
      />,
    );
    await userEvent.type(screen.getByLabelText('Search history'), 'ne');

    expect(await screen.findByText(/mystery ·/)).toBeDefined();
  });
});
