import {
  describe,
  expect,
  test,
} from 'vitest';

import { toErrorMessage } from './errorUtils';

describe('toErrorMessage', () => {
  test('uses Error messages directly', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  test('accepts thrown strings and falls back for anything else', () => {
    expect(toErrorMessage('plain')).toBe('plain');
    expect(toErrorMessage(42)).toBe('Something went wrong');
  });
});
