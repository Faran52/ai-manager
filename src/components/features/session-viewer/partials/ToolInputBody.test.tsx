import { render, screen } from '@testing-library/react';

import { ToolInputBody } from './ToolInputBody';

import type { ToolCall } from '@services/history/historyService';

const call = (input: ToolCall['input']): ToolCall => {
  return {
    id: input.kind,
    name: input.kind,
    input,
  };
};

test('renders each supported tool input family', () => {
  const inputs: readonly ToolCall['input'][] = [
    {
      kind: 'bash',
      command: 'ls',
    },
    {
      kind: 'todo-write',
      todos: [{
        content: 'ship',
        status: 'pending',
      }],
    },
    {
      kind: 'file-read',
      path: '/a.ts',
    },
    {
      kind: 'search-files',
      tool: 'grep',
      pattern: 'todo',
      searchPath: '/src',
    },
    {
      kind: 'web-search',
      query: 'query',
    },
    {
      kind: 'web-fetch',
      url: 'https://example.com',
    },
    {
      kind: 'task',
      agentType: 'worker',
      description: 'inspect',
      prompt: 'go',
    },
    {
      kind: 'generic',
      title: 'generic',
      rows: [{
        label: 'key',
        value: 'value',
      }],
    },
  ];

  for (const input of inputs) {
    const { unmount } = render(<ToolInputBody call={call(input)} />);

    expect(document.body.hasChildNodes()).toBe(true);
    unmount();
  }

  render(
    <ToolInputBody
      call={call({
        kind: 'file-edit',
        path: '/a',
        oldString: '',
        newString: '',
        replaceAll: false,
      })}
    />,
  );
  expect(screen.queryByText('/a')).toBeNull();
});

test('shows the change a file tool asked for', () => {
  render(
    <ToolInputBody
      call={call({
        kind: 'file-write',
        path: '/repo/new.ts',
        content: 'written',
      })}
    />,
  );

  expect(screen.getByText('+written')).toBeDefined();
});

test('leaves the asked-for change out once the agent recorded what it applied', () => {
  render(
    <ToolInputBody
      changeRecorded
      call={call({
        kind: 'file-write',
        path: '/repo/new.ts',
        content: 'written',
      })}
    />,
  );

  expect(screen.queryByText('+written')).toBeNull();
});

test('renders an mcp call through its server identity', () => {
  render(
    <ToolInputBody
      call={{
        id: 'm1',
        name: 'mcp__linear__search',
        input: {
          kind: 'generic',
          title: 'search',
          rows: [{
            label: 'query',
            value: 'open bugs',
          }],
        },
      }}
    />,
  );

  expect(screen.getByText('linear')).toBeDefined();
  expect(screen.getByText('search')).toBeDefined();
});
