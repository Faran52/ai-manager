import { expect, test } from 'vitest';

import { draftOf, managedCount } from './settingsDraftUtils';

import type { ScopeSettings } from '@services/settings/settingsService';

const SCOPE: ScopeSettings = {
  scope: 'user',
  path: '/home/settings.json',
  exists: true,
  readable: true,
  editable: true,
  permissions: {
    allow: ['Bash(git status:*)'],
    deny: [],
    ask: ['Bash(git push:*)'],
    additionalDirectories: ['../shared'],
  },
  env: [{
    name: 'A',
    value: '1',
  }],
  preservedKeys: ['hooks'],
};

test('a draft is the editable part of the file, and its count is every managed entry', () => {
  const draft = draftOf(SCOPE);

  expect(draft).toEqual({
    permissions: SCOPE.permissions,
    env: SCOPE.env,
  });
  expect(managedCount(draft)).toBe(4);
});
