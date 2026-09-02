import { expect, test } from 'vitest';

import { isForeignOrigin } from './originUtils';

const SELF = 'http://localhost:4321';

test('accepts a request the app made of itself', () => {
  expect(isForeignOrigin(SELF, SELF)).toBe(false);
});

test('accepts a request that carries no origin at all', () => {
  expect(isForeignOrigin(null, SELF)).toBe(false);
});

test('rejects another site reaching the loopback port', () => {
  expect(isForeignOrigin('http://evil.example', SELF)).toBe(true);
});

test('rejects a look-alike origin on another port', () => {
  expect(isForeignOrigin('http://localhost:9999', SELF)).toBe(true);
});
