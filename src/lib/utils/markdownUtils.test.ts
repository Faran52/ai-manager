import {
  describe,
  expect,
  test,
} from 'vitest';

import { hasMarkdownMarkup } from './markdownUtils';

describe('hasMarkdownMarkup', () => {
  test('flags a heading', () => {
    expect(hasMarkdownMarkup('# Report\n\nthe body follows')).toBe(true);
  });

  test('flags a fenced code block', () => {
    expect(hasMarkdownMarkup('here you go\n```ts\nconst a = 1\n```')).toBe(true);
  });

  test('flags a blockquote', () => {
    expect(hasMarkdownMarkup('> quoted from somewhere else')).toBe(true);
  });

  test('flags a thematic break', () => {
    expect(hasMarkdownMarkup('above the line\n\n---\n\nbelow the line')).toBe(true);
  });

  test('flags a list of two or more items', () => {
    expect(hasMarkdownMarkup('Findings\n- first issue\n- second issue')).toBe(true);
  });

  test('keeps a single bullet line in a log as plain text', () => {
    expect(hasMarkdownMarkup('Building project\n- 1 warning suppressed\nBuild finished')).toBe(false);
  });

  test('keeps prose with incidental punctuation as plain text', () => {
    expect(hasMarkdownMarkup('run cat a.md | grep foo, then x * 2 * y for the total')).toBe(false);
  });

  test('treats an empty string as plain text', () => {
    expect(hasMarkdownMarkup('')).toBe(false);
  });
});
