import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  numberAt,
  objectAt,
  parseJsonContainer,
  textAt,
} from './jsonUtils';

describe('parseJsonContainer', () => {
  it('keeps objects and arrays', () => {
    expect(parseJsonContainer('{"key":{"nested":null}}')).toEqual({ key: { nested: null } });
    expect(parseJsonContainer('[1,"two"]')).toEqual([1, 'two']);
  });

  it('yields null for primitives', () => {
    expect(parseJsonContainer('42')).toBeNull();
    expect(parseJsonContainer('"text"')).toBeNull();
    expect(parseJsonContainer('null')).toBeNull();
  });

  it('yields null for text that is not JSON', () => {
    expect(parseJsonContainer('{unterminated')).toBeNull();
    expect(parseJsonContainer('')).toBeNull();
  });
});

describe('field readers', () => {
  const source = {
    nested: { deep: true },
    name: 'x',
    empty: '',
    count: 3,
    huge: Number.POSITIVE_INFINITY,
  };

  it('reads an object, a non-empty string and a finite number under a key', () => {
    expect(objectAt(source, 'nested')).toEqual({ deep: true });
    expect(objectAt(source, 'name')).toBeUndefined();
    expect(objectAt('not an object', 'nested')).toBeUndefined();
    expect(textAt(source, 'name')).toBe('x');
    expect(textAt(source, 'empty')).toBeUndefined();
    expect(textAt(undefined, 'name')).toBeUndefined();
    expect(numberAt(source, 'count')).toBe(3);
    expect(numberAt(source, 'huge')).toBeUndefined();
    expect(numberAt(null, 'count')).toBeUndefined();
  });
});
