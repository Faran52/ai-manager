import {
  afterEach,
  expect,
  test,
} from 'vitest';

import { storedWidth } from './storedWidthUtils';

const RANGE = {
  min: 200,
  max: 400,
  fallback: 300,
};

afterEach(() => {
  localStorage.clear();
});

test('reads a stored width, clamps it to the range and falls back when it is unusable', () => {
  localStorage.setItem('w', '250');
  expect(storedWidth('w', RANGE)).toBe(250);

  localStorage.setItem('w', '9999');
  expect(storedWidth('w', RANGE)).toBe(400);

  localStorage.setItem('w', '10');
  expect(storedWidth('w', RANGE)).toBe(300);

  localStorage.setItem('w', 'garbage');
  expect(storedWidth('w', RANGE)).toBe(300);

  expect(storedWidth('missing', RANGE)).toBe(300);
});
