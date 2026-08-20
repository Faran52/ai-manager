import {
  describe,
  expect,
  it,
} from 'vitest';

import { uniqueKeys } from './reactKeyUtils';

describe('uniqueKeys', () => {
  it('returns bare identities for distinct items', () => {
    expect(uniqueKeys(['a', 'b'], (value) => {
      return value;
    })).toEqual(['a', 'b']);
  });

  it('suffixes repeats of the same identity', () => {
    expect(uniqueKeys(['a', 'a', 'a'], (value) => {
      return value;
    })).toEqual(['a', 'a-1', 'a-2']);
  });

  it('continues counting after interleaved identities', () => {
    expect(uniqueKeys(['a', 'b', 'a'], (value) => {
      return value;
    })).toEqual(['a', 'b', 'a-1']);
  });

  it('derives keys through the identity projection', () => {
    expect(uniqueKeys([
      {
        id: 'x',
        size: 1,
      },
      {
        id: 'x',
        size: 2,
      },
    ], (item) => {
      return `${item.id}:${String(item.size)}`;
    })).toEqual(['x:1', 'x:2']);
  });

  it('handles empty lists', () => {
    expect(uniqueKeys([], () => {
      return 'x';
    })).toEqual([]);
  });
});
