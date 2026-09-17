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

describe('LruCache weighed by value', () => {
  const weigh = (value: number): number => {
    return value;
  };

  test('evicts until the incoming weight fits', () => {
    const cache = new LruCache<number>(10, weigh);

    cache.set('a', 4);
    cache.set('b', 4);
    cache.set('c', 4);

    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(4);
    expect(cache.get('c')).toBe(4);
  });

  test('releases the weight of a key it replaces', () => {
    const cache = new LruCache<number>(10, weigh);

    for (const weight of [9, 1]) {
      cache.set('a', weight);
    }
    cache.set('b', 9);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(9);
  });

  test('admits a value heavier than the whole cache, alone', () => {
    const cache = new LruCache<number>(10, weigh);

    cache.set('small', 2);
    cache.set('huge', 50);

    expect(cache.has('small')).toBe(false);
    expect(cache.get('huge')).toBe(50);
    expect(cache.size).toBe(1);
  });
});
