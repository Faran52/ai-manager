import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { readProjectUsage } from './usageUtils';

const PROJECT = '/repo/alpha';

const homeWith = async (config: object): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'usage-'));

  await writeFile(join(home, '.claude.json'), JSON.stringify(config));

  return home;
};

describe('readProjectUsage', () => {
  test('reads totals and orders models by what they cost', async () => {
    const home = await homeWith({
      projects: {
        [PROJECT]: {
          lastCost: 12.5,
          lastTotalInputTokens: 100,
          lastTotalOutputTokens: 200,
          lastTotalCacheReadInputTokens: 3000,
          lastDuration: 60000,
          lastStartTime: 1700000000000,
          lastModelUsage: {
            cheap: {
              costUSD: 0.5,
              inputTokens: 10,
              outputTokens: 20,
            },
            dear: {
              costUSD: 12,
              inputTokens: 90,
              outputTokens: 180,
              cacheReadInputTokens: 3000,
              cacheCreationInputTokens: 7,
            },
          },
        },
      },
    });

    expect(await readProjectUsage(PROJECT, home)).toEqual({
      costUsd: 12.5,
      inputTokens: 100,
      outputTokens: 200,
      cacheReadTokens: 3000,
      durationMs: 60000,
      lastActiveMs: 1700000000000,
      models: [
        {
          model: 'dear',
          inputTokens: 90,
          outputTokens: 180,
          cacheReadTokens: 3000,
          cacheCreationTokens: 7,
          costUsd: 12,
        },
        {
          model: 'cheap',
          inputTokens: 10,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.5,
        },
      ],
    });
  });

  test('reports nothing for a project with no recorded usage', async () => {
    const home = await homeWith({ projects: { [PROJECT]: { hasTrustDialogAccepted: true } } });

    expect(await readProjectUsage(PROJECT, home)).toBeUndefined();
  });

  test('reports nothing for a project it has never seen', async () => {
    const home = await homeWith({ projects: {} });

    expect(await readProjectUsage('/elsewhere', home)).toBeUndefined();
  });

  test('reports nothing when the config is absent or unreadable', async () => {
    const missing = await mkdtemp(join(tmpdir(), 'usage-empty-'));
    const broken = await mkdtemp(join(tmpdir(), 'usage-broken-'));

    await writeFile(join(broken, '.claude.json'), '{ truncated');

    expect(await readProjectUsage(PROJECT, missing)).toBeUndefined();
    expect(await readProjectUsage(PROJECT, broken)).toBeUndefined();
  });

  test('reads past entries that are not shaped like usage', async () => {
    const home = await homeWith({
      projects: {
        [PROJECT]: {
          lastCost: 'free',
          lastTotalInputTokens: Number.POSITIVE_INFINITY,
          lastModelUsage: {
            broken: 'text',
            fine: { costUSD: 1 },
          },
        },
      },
    });

    expect(await readProjectUsage(PROJECT, home)).toMatchObject({
      costUsd: 0,
      inputTokens: 0,
      models: [expect.objectContaining({
        model: 'fine',
        costUsd: 1,
      })],
    });
  });
});
