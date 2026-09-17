import {
  describe,
  expect,
  test,
} from 'vitest';

import { shellQuote } from './shellQuoteUtils';

describe('shellQuote', () => {
  test('wraps plain values in single quotes', () => {
    expect(shellQuote('abc')).toBe('\'abc\'');
  });

  test('escapes embedded single quotes the POSIX way', () => {
    expect(shellQuote("it's")).toBe('\'it\'\\\'\'s\'');
  });

  test('keeps shell metacharacters literal', () => {
    expect(shellQuote('a b;c | d')).toBe('\'a b;c | d\'');
  });
});
