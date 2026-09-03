import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { ToolExecutionCard } from './ToolExecutionCard';

import type { ToolCall, ToolOutcome } from '@services/history/historyService';

const bashCall: ToolCall = {
  id: 'tu1',
  name: 'Bash',
  input: {
    kind: 'bash',
    command: 'pnpm check',
  },
};

const okOutcome: ToolOutcome = {
  toolUseId: 'tu1',
  status: 'ok',
  images: [],
  text: 'all green',
};
const errorOutcome: ToolOutcome = {
  toolUseId: 'tu1',
  status: 'error',
  images: [],
  text: 'stack trace',
  stderr: 'npm err!',
};

describe('ToolExecutionCard', () => {
  test('starts collapsed for successful calls and expands on click', async () => {
    render(<ToolExecutionCard call={bashCall} outcome={okOutcome} />);

    expect(document.querySelector('[data-tool-card][data-status="ok"]')).not.toBeNull();
    expect(document.querySelector('[data-tool-detail]')?.textContent).toBe('pnpm check');
    expect(screen.queryByText('all green')).toBeNull();

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getAllByText('pnpm check').length).toBeGreaterThan(1);
    expect(screen.getByText('all green')).toBeDefined();
  });

  test('opens immediately when the result failed and shows streams', () => {
    render(<ToolExecutionCard call={bashCall} outcome={errorOutcome} />);

    expect(screen.getByText('Error')).toBeDefined();
    expect(screen.getByText('stack trace')).toBeDefined();
    expect(screen.getByText('npm err!')).toBeDefined();
  });

  test('reports an error without any payload text', () => {
    render(
      <ToolExecutionCard
        call={bashCall}
        outcome={{
          toolUseId: 'tu1',
          status: 'error',
          images: [],
        }}
      />,
    );

    expect(screen.getByText(/reported an error without details/)).toBeDefined();
  });

  test('renders structured patches for edits', async () => {
    const editCall: ToolCall = {
      id: 'tu2',
      name: 'Edit',
      input: {
        kind: 'file-edit',
        path: '/a.ts',
        oldString: 'b',
        newString: 'c',
        replaceAll: false,
      },
    };

    render(
      <ToolExecutionCard
        call={editCall}
        outcome={{
          toolUseId: 'tu2',
          status: 'ok',
          images: [],
          patch: [{
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: ['-b', '+c'],
          }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(document.querySelector('[data-patch-view]')).not.toBeNull();
  });

  test('falls back to outcome text when an edit has no patch', async () => {
    const editCall: ToolCall = {
      id: 'tu3',
      name: 'MultiEdit',
      input: {
        kind: 'multi-edit',
        path: '/a.ts',
        edits: [{
          oldString: 'x',
          newString: 'y',
          replaceAll: false,
        }],
      },
    };

    render(
      <ToolExecutionCard
        call={editCall}
        outcome={{
          toolUseId: 'tu3',
          status: 'ok',
          images: [],
          text: 'plain',
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('plain')).toBeDefined();
  });

  test('lists todo state with completion styling', async () => {
    const todoCall: ToolCall = {
      id: 'tu4',
      name: 'TodoWrite',
      input: {
        kind: 'todo-write',
        todos: [
          {
            content: 'done thing',
            status: 'completed',
          },
          {
            content: 'ship it',
            status: 'in_progress',
            activeForm: 'shipping it',
          },
        ],
      },
    };

    render(<ToolExecutionCard call={todoCall} outcome={undefined} />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('done thing')).toBeDefined();
    expect(screen.getByText('shipping it')).toBeDefined();
  });

  test('shows generic rows and embedded images', async () => {
    const genericCall: ToolCall = {
      id: 'tu5',
      name: 'NotebookEdit',
      input: {
        kind: 'generic',
        title: 'NotebookEdit',
        rows: [{
          label: 'file',
          value: '/n.ipynb',
        }],
      },
    };

    const { container } = render(
      <ToolExecutionCard
        call={genericCall}
        outcome={{
          toolUseId: 'tu5',
          status: 'ok',
          images: [{
            mediaType: 'image/png',
            data: 'QUJD',
          }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('/n.ipynb')).toBeDefined();

    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('data:image/png;base64,QUJD');
  });
});

describe('ToolExecutionCard input rows and image fallbacks', () => {
  test('renders row kinds for read, search, web and task tools', async () => {
    const calls: readonly ToolCall[] = [
      {
        id: '1',
        name: 'Read',
        input: {
          kind: 'file-read',
          path: '/a.ts',
        },
      },
      {
        id: '2',
        name: 'Grep',
        input: {
          kind: 'search-files',
          tool: 'grep',
          pattern: 'todo',
          searchPath: '/src',
        },
      },
      {
        id: '3',
        name: 'WebSearch',
        input: {
          kind: 'web-search',
          query: 'weather',
        },
      },
      {
        id: '4',
        name: 'WebFetch',
        input: {
          kind: 'web-fetch',
          url: 'https://x.dev',
        },
      },
      {
        id: '5',
        name: 'Task',
        input: {
          kind: 'task',
          agentType: 'scout',
          description: 'explore',
          prompt: 'go',
        },
      },
    ];

    for (const call of calls) {
      render(
        <ToolExecutionCard
          call={call}
          outcome={{
            toolUseId: call.id,
            status: 'ok',
            images: [],
          }}
        />,
      );
    }

    for (const button of screen.getAllByRole('button')) {
      await userEvent.click(button);
    }

    expect(screen.getByText('/a.ts')).toBeDefined();
    expect(screen.getByText('todo')).toBeDefined();
    expect(screen.getAllByText('weather').length).toBeGreaterThan(1);
    expect(screen.getByText('https://x.dev')).toBeDefined();
    expect(screen.getAllByText('scout').length).toBeGreaterThan(1);
    expect(screen.getByText('explore')).toBeDefined();

    const details = [...document.querySelectorAll('[data-tool-detail]')].map((node) => {
      return node.textContent;
    });

    expect(details).toEqual(['a.ts', 'todo · src', 'weather', 'x.dev', 'scout']);
  });

  test('skips images that have neither data nor url', async () => {
    const { container } = render(
      <ToolExecutionCard

        call={bashCall}
        outcome={{
          toolUseId: 'tu1',
          status: 'ok',
          images: [{
            mediaType: undefined,
            data: undefined,
            url: undefined,
          }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(container.querySelector('img')).toBeNull();
  });

  test('shows stderr alone when there is no stdout payload', async () => {
    render(
      <ToolExecutionCard
        call={bashCall}
        outcome={{
          toolUseId: 'tu1',
          status: 'interrupted',
          images: [],
          stderr: 'killed',
        }}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText('killed')).toBeDefined();
    expect(screen.getByText('Interrupted')).toBeDefined();
  });
});

describe('long payloads collapse behind details', () => {
  test('truncates output past the cap', async () => {
    render(
      <ToolExecutionCard
        call={bashCall}
        outcome={{
          toolUseId: 'tu1',
          status: 'ok',
          images: [],
          text: 'x'.repeat(4_500),
        }}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText(/4500 chars/)).toBeDefined();
  });
});

describe('todo fallback label', () => {
  test('shows content when an in-progress todo has no activeForm', async () => {
    render(
      <ToolExecutionCard
        call={{
          id: 'tu9',
          name: 'TodoWrite',
          input: {
            kind: 'todo-write',
            todos: [{
              content: 'plain step',
              status: 'in_progress',
            }],
          },
        }}
        outcome={undefined}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText('plain step')).toBeDefined();
  });
});

describe('optional-field arms on row tools', () => {
  test('glob without a path omits the location row', async () => {
    render(
      <ToolExecutionCard
        call={{
          id: 'g1',
          name: 'Glob',
          input: {
            kind: 'search-files',
            tool: 'glob',
            pattern: '*.md',
            searchPath:
  undefined,
          },
        }}
        outcome={undefined}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getAllByText('*.md').length).toBeGreaterThan(1);
    expect(screen.queryByText('/src')).toBeNull();
  });

  test('minimal task calls render only their present fields', async () => {
    render(
      <ToolExecutionCard
        call={{
          id: 'k1',
          name: 'Task',
          input: { kind: 'task' },
        }}
        outcome={undefined}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.queryByText('agent')).toBeNull();
  });

  test('keeps images visible alongside textual output', async () => {
    const { container } = render(
      <ToolExecutionCard
        call={bashCall}
        outcome={{
          toolUseId: 'tu1',
          status: 'ok',
          text: 'screenshot saved',
          images: [{
            mediaType: 'image/png',
            data: 'QUJD',
          }],
        }}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText('screenshot saved')).toBeDefined();
    expect(container.querySelector('img')).not.toBeNull();
  });
});

describe('bash descriptions and pending todos', () => {
  test('shows the italic description when present', async () => {
    render(
      <ToolExecutionCard
        call={{
          id: 'd1',
          name: 'Bash',
          input: {
            kind: 'bash',
            command: 'make',
            description: 'build it',
          },
        }}
        outcome={{
          toolUseId: 'd1',
          status: 'ok',
          images: [],
        }}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText('build it')).toBeDefined();
  });

  test('styles pending todos with the neutral tone and waits on no result of its own', async () => {
    const { container } = render(
      <ToolExecutionCard
        call={{
          id: 'p1',
          name: 'TodoWrite',
          input: {
            kind: 'todo-write',
            todos: [{
              content: 'later step',
              status: 'pending',
            }],
          },
        }}
        outcome={undefined}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(screen.getByText('later step')).toBeDefined();
    expect(container.querySelector('[data-status-badge="pending"]')).toBeNull();
  });
});

describe('mcp calls', () => {
  test('titles the card by server and tool and labels the result', async () => {
    render(
      <ToolExecutionCard
        call={{
          id: 'm1',
          name: 'search',
          serverName: 'linear',
          input: {
            kind: 'generic',
            title: 'search',
            rows: [{
              label: 'query',
              value: 'open bugs',
            }],
          },
        }}
        outcome={{
          toolUseId: 'm1',
          status: 'ok',
          images: [],
          text: 'two issues',
        }}
      />,
    );
    const button = screen.getAllByRole<HTMLButtonElement>('button').at(-1);

    if (button != null) {
      await userEvent.click(button);
    }

    expect(document.querySelector('[data-tool-card][data-tool-kind="mcp"]')).not.toBeNull();
    expect(screen.getAllByText('linear').length).toBeGreaterThan(0);
    expect(screen.getByText('two issues')).toBeDefined();
  });
});

describe('ToolExecutionCard file changes', () => {
  const writeCall: ToolCall = {
    id: 'tu9',
    name: 'Write',
    input: {
      kind: 'file-write',
      path: '/repo/new.ts',
      content: 'written line',
    },
  };

  test('shows the change a write asked for when nothing recorded what it applied', async () => {
    render(
      <ToolExecutionCard
        call={writeCall}
        outcome={{
          toolUseId: 'tu9',
          status: 'ok',
          images: [],
          text: 'File created',
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('+written line')).toBeDefined();
  });

  test('prefers the change the agent recorded applying', async () => {
    render(
      <ToolExecutionCard
        call={writeCall}
        outcome={{
          toolUseId: 'tu9',
          status: 'ok',
          images: [],
          patch: [{
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: ['+what landed'],
          }],
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('+what landed')).toBeDefined();
    expect(screen.queryByText('+written line')).toBeNull();
  });
});
