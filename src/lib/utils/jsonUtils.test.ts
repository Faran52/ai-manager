import {
  describe,
  expect,
  it,
} from 'vitest';

import { parseJsonContainer } from './jsonUtils';

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
