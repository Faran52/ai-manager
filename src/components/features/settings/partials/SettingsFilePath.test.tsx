import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SettingsFilePath } from './SettingsFilePath';

import type { ScopeSettings } from '@services/settings/settingsService';

const scope = (overrides: Partial<ScopeSettings>): ScopeSettings => {
  return {
    scope: 'user',
    path: '/home/me/.claude/settings.json',
    exists: true,
    readable: true,
    editable: true,
    permissions: {
      allow: [],
      deny: [],
      ask: [],
      additionalDirectories: [],
    },
    env: [],
    preservedKeys: [],
    ...overrides,
  };
};

test('prints the path with a break after each slash and says when the file is missing', () => {
  const { container, rerender } = render(<SettingsFilePath scope={scope({})} />);

  expect(container.querySelectorAll('wbr')).toHaveLength(4);
  expect(screen.queryByText(/will be created on save/u)).toBeNull();

  rerender(<SettingsFilePath scope={scope({ exists: false })} />);
  expect(screen.getByText(/will be created on save/u)).toBeDefined();

  rerender(
    <SettingsFilePath scope={scope({
      exists: false,
      editable: false,
    })}
    />,
  );
  expect(screen.getByText(/not on disk/u)).toBeDefined();
});
