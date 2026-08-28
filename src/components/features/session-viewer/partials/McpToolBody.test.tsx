import { render, screen } from '@testing-library/react';

import { McpToolBody } from './McpToolBody';

import type { ToolCall } from '@services/history/historyService';

const genericCall: ToolCall = {
  id: 'c1',
  name: 'mcp__linear__search',
  input: {
    kind: 'generic',
    title: 'search',
    rows: [{
      label: 'query',
      value: 'open bugs',
    }],
  },
};

const identity = {
  server: 'linear',
  tool: 'search',
};

test('names the server and tool and lists generic input rows', () => {
  render(<McpToolBody call={genericCall} identity={identity} />);

  expect(screen.getByText('linear')).toBeDefined();
  expect(screen.getByText('search')).toBeDefined();
  expect(screen.getByText('open bugs')).toBeDefined();
});

test('omits rows for input the parser already typed', () => {
  render(
    <McpToolBody
      call={{
        id: 'c2',
        name: 'mcp__linear__run',
        input: {
          kind: 'bash',
          command: 'ls',
        },
      }}
      identity={identity}
    />,
  );

  expect(screen.queryByText('ls')).toBeNull();
});
