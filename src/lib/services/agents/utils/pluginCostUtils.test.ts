import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  attributePluginCosts,
  parsePluginDetails,
  readPluginCosts,
} from './pluginCostUtils';

import type { ClaudeCliRunner } from './claudeCliUtils';
import type { ProjectUsage } from './usageUtils';

const DETAILS = `
context7
  Description: docs lookup

Component inventory
  MCP servers (1)

Projected token cost
  Always-on:   ~449 tok   added to every session

Per-component (rounded)
componentalways-onon-invoke
context7~0~2.5k

On-invoke cost is paid each time a skill or agent fires.
`;

const runner = (ok: boolean, output: string): ClaudeCliRunner => {
  return vi.fn(() => {
    return Promise.resolve({
      ok,
      output,
    });
  });
};

const usage = (costUsd: number, inputTokens: number, cacheReadTokens: number): ProjectUsage => {
  return {
    costUsd,
    inputTokens,
    outputTokens: 0,
    cacheReadTokens,
    durationMs: 0,
    lastActiveMs: 0,
    models: [],
  };
};

describe('parsePluginDetails', () => {
  test('reads the always-on and peak per-invoke estimates', () => {
    expect(parsePluginDetails(DETAILS)).toEqual({
      alwaysOnTokens: 449,
      onInvokeTokens: 2500,
    });
  });

  test('reports zeros for an output without cost lines', () => {
    expect(parsePluginDetails('nothing useful here')).toEqual({
      alwaysOnTokens: 0,
      onInvokeTokens: 0,
    });
  });

  test('ignores a token that does not read as a number', () => {
    expect(parsePluginDetails('  Always-on:   ~1.2.3 tok')).toEqual({
      alwaysOnTokens: 0,
      onInvokeTokens: 0,
    });
  });
});

describe('readPluginCosts', () => {
  test('asks the cli only about enabled plugins', async () => {
    const run = runner(true, DETAILS);

    await expect(readPluginCosts({
      plugins: [
        {
          id: 'on@a',
          enabled: true,
        },
        {
          id: 'off@b',
          enabled: false,
        },
      ],
      home: '/home/x',
    }, run)).resolves.toEqual([
      {
        plugin: 'on@a',
        alwaysOnTokens: 449,
        onInvokeTokens: 2500,
      },
    ]);
    expect(run).toHaveBeenCalledWith(['plugin', 'details', 'on@a'], { cwd: '/home/x' });
  });

  test('treats a failed lookup as a zero estimate', async () => {
    const run = runner(false, 'missing');

    await expect(readPluginCosts({
      plugins: [{
        id: 'on@a',
        enabled: true,
      }],
    }, run)).resolves.toEqual([{
      plugin: 'on@a',
      alwaysOnTokens: 0,
      onInvokeTokens: 0,
    }]);
  });
});

describe('attributePluginCosts', () => {
  test('prices always-on context at the blended input-token rate', () => {
    expect(attributePluginCosts(usage(0.05, 900, 100), [{
      plugin: 'on@a',
      alwaysOnTokens: 400,
      onInvokeTokens: 2500,
    }])).toEqual([{
      plugin: 'on@a',
      alwaysOnTokens: 400,
      onInvokeTokens: 2500,
      estimatedCostUsd: 0.02,
    }]);
  });

  test('attributes nothing without recorded usage', () => {
    expect(attributePluginCosts(undefined, [{
      plugin: 'on@a',
      alwaysOnTokens: 400,
      onInvokeTokens: 2500,
    }])).toEqual([{
      plugin: 'on@a',
      alwaysOnTokens: 400,
      onInvokeTokens: 2500,
      estimatedCostUsd: 0,
    }]);
  });

  test('attributes nothing when no input tokens were billed', () => {
    expect(attributePluginCosts(usage(0.05, 0, 0), [{
      plugin: 'on@a',
      alwaysOnTokens: 400,
      onInvokeTokens: 2500,
    }])).toEqual([{
      plugin: 'on@a',
      alwaysOnTokens: 400,
      onInvokeTokens: 2500,
      estimatedCostUsd: 0,
    }]);
  });
});
