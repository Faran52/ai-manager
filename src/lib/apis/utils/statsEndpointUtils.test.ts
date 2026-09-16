import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  jsonOf,
  newDirWithSession,
  post,
  stubAgentEnv,
} from '@mocks/endpointRequestFixtures';

import { handleProjectStats } from './statsEndpointUtils';

stubAgentEnv();

describe('handleProjectStats', () => {
  test('returns undefined stats for an empty project', async () => {
    const dir = await newDirWithSession();
    const response = await handleProjectStats(
      post({
        projectId: 'ghost',
        agent: 'claude',
      }),
      {
        claudeDir: dir,
        codexDir: dir,
      },
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ stats: null });
  });

  test('aggregates stats for a real project', async () => {
    const dir = await newDirWithSession();
    const response = await handleProjectStats(
      post({
        projectId: 'proj',
        agent: 'claude',
      }),
      {
        claudeDir: dir,
        codexDir: dir,
      },
    );

    const body = await jsonOf(response);

    expect(JSON.stringify(body)).toContain('"inputTokens":3');
  });
});

describe('stats validation', () => {
  test('rejects stats requests without a projectId', async () => {
    expect((await handleProjectStats(post({}))).status).toBe(400);
  });

  test('returns empty stats when a agent has no configured test path', async () => {
    const response = await handleProjectStats(post({
      projectId: 'p',
      agent: 'continue',
    }), {
      claudeDir: '/missing',
      codexDir: '/missing',
    });

    expect(await jsonOf(response)).toEqual({ stats: null });
  });

  test('routes Codex stats through the Codex history root', async () => {
    const response = await handleProjectStats(post({
      projectId: 'p',
      agent: 'codex',
    }), {
      claudeDir: '/missing-claude',
      codexDir: '/missing-codex',
    });

    expect(await jsonOf(response)).toEqual({ stats: null });
  });
});
