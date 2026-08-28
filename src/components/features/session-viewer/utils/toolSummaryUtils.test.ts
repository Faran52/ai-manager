import { toolSummary } from './toolSummaryUtils';

import type {
  ToolCall,
  ToolCallInput,
  ToolOutcome,
} from '@services/history/historyService';

const call = (name: string, input: ToolCallInput, serverName?: string): ToolCall => {
  return {
    id: 'c1',
    name,
    ...(serverName == null ? {} : { serverName }),
    input,
  };
};

test('names an mcp call by its tool and server', () => {
  expect(toolSummary(call('search', {
    kind: 'generic',
    title: 'search',
    rows: [],
  }, 'linear'))).toEqual({
    label: 'search',
    detail: 'linear',
    tone: 'plug',
  });
});

test('shows a read as its basename and window', () => {
  expect(toolSummary(call('Read', {
    kind: 'file-read',
    path: '/repo/src/auth.ts',
    offset: 1,
    limit: 80,
  })).detail).toBe('auth.ts (L1–81)');

  expect(toolSummary(call('Read', {
    kind: 'file-read',
    path: '/repo/src/auth.ts',
  })).detail).toBe('auth.ts');

  expect(toolSummary(call('Read', {
    kind: 'file-read',
    path: '/repo/src/auth.ts',
    limit: 40,
  })).detail).toBe('auth.ts (L1–41)');

  expect(toolSummary(call('Read', {
    kind: 'file-read',
    path: '/repo/src/auth.ts',
    offset: 20,
  })).detail).toBe('auth.ts (L20–)');
});

test('strips trailing slashes and keeps a bare name whole', () => {
  expect(toolSummary(call('Write', {
    kind: 'file-write',
    path: '/repo/src/',
    content: '',
  })).detail).toBe('src');

  expect(toolSummary(call('Write', {
    kind: 'file-write',
    path: 'notes.md',
    content: '',
  })).detail).toBe('notes.md');
});

test('adds the line totals an edit produced', () => {
  const patched: ToolOutcome = {
    toolUseId: 'c1',
    status: 'ok',
    images: [],
    patch: [{
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 3,
      lines: ['-old', '+new', '+extra', ' kept'],
    }],
  };

  expect(toolSummary(call('Edit', {
    kind: 'file-edit',
    path: '/repo/a.ts',
    oldString: 'x',
    newString: 'y',
    replaceAll: false,
  }), patched).detail).toBe('a.ts · +2 −1');
});

test('omits totals when the edit has no patch or an empty one', () => {
  const edit: ToolCallInput = {
    kind: 'file-edit',
    path: '/repo/a.ts',
    oldString: 'x',
    newString: 'y',
    replaceAll: false,
  };

  expect(toolSummary(call('Edit', edit)).detail).toBe('a.ts');
  expect(toolSummary(call('Edit', edit), {
    toolUseId: 'c1',
    status: 'ok',
    images: [],
    patch: [{
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [' kept'],
    }],
  }).detail).toBe('a.ts');
});

test('counts the edits in a multi-edit', () => {
  expect(toolSummary(call('MultiEdit', {
    kind: 'multi-edit',
    path: '/repo/a.ts',
    edits: [
      {
        oldString: '1',
        newString: '2',
        replaceAll: false,
      },
      {
        oldString: '3',
        newString: '4',
        replaceAll: false,
      },
    ],
  })).detail).toBe('a.ts · ×2');
});

test('shows a search pattern with and without its folder', () => {
  expect(toolSummary(call('Grep', {
    kind: 'search-files',
    tool: 'grep',
    pattern: 'session',
    searchPath: '/repo/src',
  }))).toEqual({
    label: 'Grep',
    detail: 'session · src',
    tone: 'search',
  });

  expect(toolSummary(call('Glob', {
    kind: 'search-files',
    tool: 'glob',
    pattern: '*.md',
  })).detail).toBe('*.md');
});

test('collapses a multi-line command and caps a long one', () => {
  expect(toolSummary(call('Bash', {
    kind: 'bash',
    command: 'pnpm check\n  && pnpm build',
  }))).toEqual({
    label: 'Bash',
    detail: 'pnpm check && pnpm build',
    tone: 'shell',
  });

  const long = toolSummary(call('Bash', {
    kind: 'bash',
    command: 'x'.repeat(200),
  })).detail;

  expect(long).toHaveLength(90);
  expect(long.endsWith('…')).toBe(true);
});

test('shows a query for a search and a host for a fetch', () => {
  expect(toolSummary(call('WebSearch', {
    kind: 'web-search',
    query: 'astro islands',
  })).tone).toBe('web');
  expect(toolSummary(call('WebFetch', {
    kind: 'web-fetch',
    url: 'https://example.com/docs/a',
  })).detail).toBe('example.com');
  expect(toolSummary(call('WebFetch', {
    kind: 'web-fetch',
    url: 'not a url',
  })).detail).toBe('not a url');
});

test('prefers an agent type over a description, and falls back to neither', () => {
  expect(toolSummary(call('Task', {
    kind: 'task',
    agentType: 'scout',
    description: 'explore',
  })).detail).toBe('scout');
  expect(toolSummary(call('Task', {
    kind: 'task',
    description: 'explore',
  })).detail).toBe('explore');
  expect(toolSummary(call('Task', { kind: 'task' })).detail).toBe('');
});

test('counts todos and leaves a generic tool undetailed', () => {
  expect(toolSummary(call('TodoWrite', {
    kind: 'todo-write',
    todos: [{
      content: 'ship',
      status: 'pending',
    }],
  })).detail).toBe('×1');

  expect(toolSummary(call('NotebookEdit', {
    kind: 'generic',
    title: 'NotebookEdit',
    rows: [],
  }))).toEqual({
    label: 'NotebookEdit',
    detail: '',
    tone: 'plain',
  });
});
