import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { ScopeTabs } from './ScopeTabs';

import type { ScopeSettings } from '@services/settings/settingsService';

const scope = (overrides: Partial<ScopeSettings>): ScopeSettings => {
  return {
    scope: 'user',
    path: '/home/settings.json',
    exists: true,
    readable: true,
    editable: true,
    permissions: {
      allow: ['Bash(git status:*)'],
      deny: [],
      ask: [],
      additionalDirectories: [],
    },
    env: [],
    preservedKeys: [],
    ...overrides,
  };
};

test('counts what each file holds, marks a parked edit and switches on a click', async () => {
  const onSelect = vi.fn();
  const scopes = [
    scope({}),
    scope({
      scope: 'project',
      path: '/repo/.claude/settings.json',
      exists: false,
    }),
    scope({
      scope: 'local',
      path: '/repo/.claude/settings.local.json',
      editable: false,
      preservedKeys: [{ name: 'hooks' }],
    }),
  ];

  render(
    <ScopeTabs
      scopes={scopes}
      active="user"
      drafts={{
        '/home/settings.json': {
          permissions: {
            allow: ['a', 'b'],
            deny: [],
            ask: [],
            additionalDirectories: [],
          },
          env: [],
        },
      }}
      onSelect={onSelect}
    />,
  );

  const user = screen.getByRole('button', { name: /User/u });

  expect(user.getAttribute('aria-current')).toBe('true');
  expect(user.textContent).toContain('2');
  expect(user.querySelector('[title="Unsaved changes"]')).not.toBeNull();
  expect(screen.getByRole('button', { name: /Project/u }).textContent).toContain('—');
  expect(screen.getByRole('button', { name: /Local/u }).textContent).not.toContain('0');

  await userEvent.click(screen.getByRole('button', { name: /Project/u }));
  expect(onSelect).toHaveBeenCalledWith('project');
});
