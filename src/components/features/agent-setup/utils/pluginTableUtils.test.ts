import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  costIn,
  costsById,
  ordered,
  toggleSort,
  tokensIn,
  versionIn,
} from './pluginTableUtils';

import type { InstalledPlugin } from '@services/agents/agentsService';

const plugin = (id: string, overrides: Partial<InstalledPlugin> = {}): InstalledPlugin => {
  return {
    id,
    marketplace: 'official',
    scope: 'user',
    enabled: true,
    version: '1.0.0',
    knownMarketplace: true,
    ...overrides,
  };
};

describe('cell text', () => {
  test('prints a dot for nothing and a figure otherwise', () => {
    expect(tokensIn(0)).toBe('·');
    expect(tokensIn(1234)).toBe('1,234');
    expect(costIn(0)).toBe('·');
    expect(costIn(0.0012)).toBe('$1.20');
  });

  test('shortens a commit id standing in for a version and blanks an unknown one', () => {
    expect(versionIn('unknown')).toBe('·');
    expect(versionIn('')).toBe('·');
    expect(versionIn('0123456789abcdef')).toBe('0123456');
    expect(versionIn('2.1.0')).toBe('2.1.0');
  });
});

describe('ordered', () => {
  const byId = costsById([{
    plugin: 'b',
    alwaysOnTokens: 200,
    onInvokeTokens: 5,
    estimatedCostUsd: 0.02,
  }, {
    plugin: 'a',
    alwaysOnTokens: 50,
    onInvokeTokens: 9,
    estimatedCostUsd: 0.01,
  }]);
  const plugins = [plugin('b', { enabled: false }), plugin('c', { scope: 'project' }), plugin('a')];

  const idsBy = (key: Parameters<typeof toggleSort>[1], direction: 'asc' | 'desc'): string[] => {
    return ordered(plugins, byId, {
      key,
      direction,
    }).map((item) => {
      return item.id;
    });
  };

  test('sorts by name, by a cost column with missing costs as zero, and by state', () => {
    expect(idsBy('plugin', 'asc')).toEqual(['a', 'b', 'c']);
    expect(idsBy('plugin', 'desc')).toEqual(['c', 'b', 'a']);
    expect(idsBy('alwaysOn', 'desc')).toEqual(['b', 'a', 'c']);
    expect(idsBy('perTurns', 'asc')).toEqual(['c', 'a', 'b']);
    expect(idsBy('state', 'asc')).toEqual(['b', 'a', 'c']);
    expect(idsBy('scope', 'asc')).toEqual(['c', 'a', 'b']);
    expect(idsBy('version', 'asc')).toEqual(['a', 'b', 'c']);
    expect(idsBy('perInvoke', 'asc')).toEqual(['c', 'b', 'a']);
  });

  test('a missing cost read sorts everything as zero', () => {
    expect(ordered(plugins, costsById(null), {
      key: 'alwaysOn',
      direction: 'asc',
    }).map((item) => {
      return item.id;
    })).toEqual(['a', 'b', 'c']);
  });
});

test('toggleSort flips direction on the same column and starts ascending on a new one', () => {
  const start = {
    key: 'plugin' as const,
    direction: 'asc' as const,
  };

  expect(toggleSort(start, 'plugin')).toEqual({
    key: 'plugin',
    direction: 'desc',
  });
  expect(toggleSort(start, 'version')).toEqual({
    key: 'version',
    direction: 'asc',
  });
});
