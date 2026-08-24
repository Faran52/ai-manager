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
