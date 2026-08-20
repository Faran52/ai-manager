import {
  describe,
  expect,
  test,
} from 'vitest';

import { cn } from './cnUtils';

describe('cn', () => {
  test('joins truthy classes and drops falsy ones', () => {
    const conditional: string | undefined = undefined;

    expect(cn('a', conditional, null, 'c')).toBe('a c');
  });

  test('lets later tailwind classes win conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
