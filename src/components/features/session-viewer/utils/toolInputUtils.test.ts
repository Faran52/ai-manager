import {
  describe,
  expect,
  test,
} from 'vitest';

import { inputRows } from './toolInputUtils';

import type { RowedInput } from './toolInputUtils';

const rowsOf = (input: RowedInput): readonly string[] => {
  return inputRows(input).map((row) => {
    return `${row.label}: ${row.value}`;
  });
};

describe('inputRows', () => {
  test('flattens a file read to its path', () => {
    expect(rowsOf({
      kind: 'file-read',
      path: '/a.md',
    })).toEqual(['read: /a.md']);
  });

  test('pairs the search tool with its pattern and optional scope', () => {
    expect(rowsOf({
      kind: 'search-files',
      tool: 'grep',
      pattern: 'foo',
    })).toEqual([
      'grep: foo',
    ]);
    expect(rowsOf({
      kind: 'search-files',
      tool: 'glob',
      pattern: '*.ts',
      searchPath: '/src',
    })).toEqual(['glob: *.ts', 'in: /src']);
  });

  test('reduces web calls to query and url', () => {
    expect(rowsOf({
      kind: 'web-search',
      query: 'astro',
    })).toEqual(['query: astro']);
    expect(rowsOf({
      kind: 'web-fetch',
      url: 'https://x.y',
    })).toEqual(['url: https://x.y']);
  });

  test('omits absent task fields and truncates long prompts', () => {
    const minimal = rowsOf({ kind: 'task' });

    expect(minimal).toEqual([]);

    const full = inputRows({
      kind: 'task',
      agentType: 'explore',
      description: 'look around',
      prompt: 'p'.repeat(400),
    });

    expect(full.map((row) => {
      return row.label;
    })).toEqual(['agent', 'task', 'prompt']);
    expect(full[2]?.value).toHaveLength(300);
  });

  test('rows a skill by its name and the prompt it was handed', () => {
    expect(rowsOf({
      kind: 'skill',
      skill: 'code-review',
      prompt: 'look at the diff',
    })).toEqual(['skill: code-review', 'prompt: look at the diff']);
    expect(rowsOf({ kind: 'skill' })).toEqual([]);
  });

  test('passes generic rows through', () => {
    expect(rowsOf({
      kind: 'generic',
      title: 'Tool',
      rows: [{
        label: 'mode',
        value: 'fast',
      }],
    })).toEqual(['mode: fast']);
  });
});
