import {
  describe,
  expect,
  test,
} from 'vitest';

import { initialsOf } from './initialsUtils';

describe('initialsOf', () => {
  test('takes the capitals when a name carries two or more', () => {
    expect(initialsOf('Claude Code')).toBe('CC');
    expect(initialsOf('OpenCode')).toBe('OC');
  });

  test('falls back to the first two letters when there is only one capital', () => {
    expect(initialsOf('Kimi')).toBe('Ki');
  });

  test('takes the first two letters of a folder name that has no capitals', () => {
    expect(initialsOf('ai-chat-manager')).toBe('ai');
  });
});
