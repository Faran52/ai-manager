import {
  describe,
  expect,
  test,
} from 'vitest';

import { jsonOf, stubAgentEnv } from '@mocks/endpointRequestFixtures';

import { handleUpdateCheck } from './updateEndpointUtils';

stubAgentEnv();

describe('handleUpdateCheck', () => {
  test('reports unsupported when no release feed is configured', async () => {
    const response = await handleUpdateCheck({ config: undefined });

    expect(await jsonOf(response)).toEqual({ update: { stage: 'unsupported' } });
  });

  test('passes a configured feed through to the checker', async () => {
    const response = await handleUpdateCheck({
      config: {
        baseUrl: 'https://releases.example.com/app',
        currentVersion: '1.0.0',
      },
      updateDeps: {
        platform: 'darwin',
        fetch: () => {
          return Promise.resolve(new Response(JSON.stringify({
            version: '2.0.0',
            artifacts: {
              darwin: {
                name: 'app-2.0.0.zip',
                sha256: 'a'.repeat(64),
              },
            },
          })));
        },
      },
    });

    expect(await jsonOf(response)).toMatchObject({
      update: {
        stage: 'available',
        version: '2.0.0',
      },
    });
  });
});
