import { expect, test } from 'vitest';

import { versionLine } from './aboutUtils';

test('names the commit beside the version when the build knows it', () => {
  expect(versionLine('Version 0.3.0', 'fdc3677')).toBe('Version 0.3.0 (fdc3677)');
});

test('leaves the version alone rather than showing empty parentheses', () => {
  expect(versionLine('Version 0.3.0', '')).toBe('Version 0.3.0');
});
