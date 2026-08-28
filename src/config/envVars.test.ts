import {
  describe,
  expect,
  test,
} from 'vitest';

import { envVar } from './envVars';

describe('envVar', () => {
  test('prefers what the build baked in', () => {
    expect(envVar('baked', 'live')).toBe('baked');
  });

  test('falls back to the running environment', () => {
    expect(envVar('', 'live')).toBe('live');
  });

  test('reports an unset value as undefined rather than blank', () => {
    expect(envVar('', undefined)).toBeUndefined();
    expect(envVar('', '')).toBeUndefined();
  });
});
