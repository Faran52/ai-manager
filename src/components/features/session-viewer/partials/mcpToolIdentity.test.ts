import { mcpToolIdentity } from './mcpToolIdentity';

import type { ToolCall } from '@services/history/historyService';

const call = (name: string, serverName?: string): ToolCall => {
  return {
    id: 'c1',
    name,
    ...(serverName == null ? {} : { serverName }),
    input: {
      kind: 'generic',
      title: name,
      rows: [],
    },
  };
};

test('prefers a declared server name over the prefixed tool name', () => {
  expect(mcpToolIdentity(call('search', 'linear'))).toEqual({
    server: 'linear',
    tool: 'search',
  });
});

test('splits a prefixed name and ignores an unprefixed one', () => {
  expect(mcpToolIdentity(call('mcp__linear__list__issues'))).toEqual({
    server: 'linear',
    tool: 'list__issues',
  });
  expect(mcpToolIdentity(call('Bash'))).toBeUndefined();
});

test('falls back to the whole name when the prefix carries no tool', () => {
  expect(mcpToolIdentity(call('mcp__linear'))).toEqual({
    server: 'linear',
    tool: 'mcp__linear',
  });
});
