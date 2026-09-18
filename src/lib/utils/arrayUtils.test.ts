import { expect, test } from 'vitest';

import {
  maxOf,
  minOf,
  toggleInArray,
} from './arrayUtils';

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

test('maxOf picks the largest value and reads an empty list as zero', () => {
  expect(maxOf([{ n: 3 }, { n: 9 }, { n: 4 }], (item) => {
    return item.n;
  })).toBe(9);
  expect(maxOf([], () => {
    return 1;
  })).toBe(0);
});

test('minOf picks the smallest value and reads an empty list as zero', () => {
  expect(minOf([{ n: 3 }, { n: 9 }, { n: 4 }], (item) => {
    return item.n;
  })).toBe(3);
  expect(minOf([], () => {
    return 1;
  })).toBe(0);
});
