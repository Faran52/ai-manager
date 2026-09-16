import { expect, test } from 'vitest';

import { stubAgentEnv } from '@mocks/endpointRequestFixtures';

import { resolveEndpointRoots } from './endpointDepsUtils';

stubAgentEnv();

test('resolves default and overridden endpoint agent roots', () => {
  const defaults = resolveEndpointRoots(undefined);

  expect(defaults.claude.length).toBeGreaterThan(0);
  expect(resolveEndpointRoots({
    claudeDir: '/c',
    codexDir: '/x',
  }).claude).toEqual(['/c']);
  expect(resolveEndpointRoots({
    claudeDir: '/c',
    codexDir: '/x',
  }).codex).toEqual(['/x']);
});
