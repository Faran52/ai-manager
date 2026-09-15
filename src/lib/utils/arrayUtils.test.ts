import { expect, test } from 'vitest';

import { toggleInArray } from './arrayUtils';

test('adds a value that is absent, to the end', () => {
  expect(toggleInArray(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
});

test('removes a value that is present, leaving the rest in order', () => {
  expect(toggleInArray(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
});

test('leaves the original untouched', () => {
  const values = ['a'];

  toggleInArray(values, 'b');

  expect(values).toEqual(['a']);
});
