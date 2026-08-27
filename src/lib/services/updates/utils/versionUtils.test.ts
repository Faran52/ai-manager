import {
  describe,
  expect,
  test,
} from 'vitest';

import { compareVersions } from './versionUtils';

describe('compareVersions', () => {
  test('orders releases and ignores a leading v', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
  });

  test('compares uneven lengths and treats junk parts as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBeGreaterThan(0);
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
  });
});
