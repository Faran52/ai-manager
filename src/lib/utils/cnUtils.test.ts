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

  test('keeps a type-ramp font size beside a text colour', () => {
    expect(cn('text-ui', 'text-dim')).toBe('text-ui text-dim');
  });

  test('still lets a later type-ramp size win over an earlier one', () => {
    expect(cn('text-ui', 'text-body')).toBe('text-body');
  });
});
