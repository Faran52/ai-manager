import {
  describe,
  expect,
  test,
} from 'vitest';

import { slugOf } from './slugUtils';

describe('slugOf', () => {
  test('lowercases and dashes non-alphanumerics', () => {
    expect(slugOf('Fix: the Login Bug!')).toBe('fix-the-login-bug');
  });

  test('trims leading and trailing dashes', () => {
    expect(slugOf('--hello world--')).toBe('hello-world');
  });

  test('caps the slug at forty characters', () => {
    const long = 'a'.repeat(100);

    expect(slugOf(long)).toHaveLength(40);
  });

  test('never leaves a trailing dash after truncation', () => {
    expect(slugOf('word '.repeat(9))).toBe('word-word-word-word-word-word-word-word');
    expect(slugOf('word '.repeat(9)).endsWith('-')).toBe(false);
  });

  test('falls back to "session" when nothing survives', () => {
    expect(slugOf('???')).toBe('session');
    expect(slugOf('')).toBe('session');
  });
});
