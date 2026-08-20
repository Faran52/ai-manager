import {
  describe,
  expect,
  test,
} from 'vitest';

import { LruCache } from './lruCacheUtils';

describe('LruCache', () => {
  test('rejects non-positive capacity', () => {
    expect(() => {
      return new LruCache(0);
    }).toThrow('at least 1');
  });

  test('evicts the least recently used entry when over capacity', () => {
    const cache = new LruCache<number>(2);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  test('get refreshes recency', () => {
    const cache = new LruCache<number>(2);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  test('overwriting an existing key keeps it resident', () => {
    const cache = new LruCache<number>(2);

    for (const [key, value] of new Map([['first', 1], ['second', 2]])) {
      cache.set(key, value);
    }
    cache.set('first', 9);

    expect(cache.size).toBe(2);
    expect(cache.get('first')).toBe(9);
    expect(cache.get('second')).toBe(2);
  });
});

describe('LruCache edge cases', () => {
  test('get on a missing key returns undefined without side effects', () => {
    const cache = new LruCache<number>(2);

    cache.set('a', 1);

    expect(cache.get('missing')).toBeUndefined();
    expect(cache.size).toBe(1);
  });
});
