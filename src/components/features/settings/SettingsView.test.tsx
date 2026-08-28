import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { SettingsView } from './SettingsView';

import type { AsyncResource } from '@features/history-data';
import type { ScopeSettings, SettingsScope } from '@services/settings/settingsService';

afterEach(() => {
  vi.unstubAllGlobals();
});

const noop = (): void => {
  return undefined;
};

const scope = (name: SettingsScope, overrides: Partial<ScopeSettings> = {}): ScopeSettings => {
  return {
    scope: name,
    path: `/home/.claude/${name}.json`,
    exists: true,
    readable: true,
    permissions: {
      allow: ['Bash(ls:*)'],
      deny: [],
      ask: [],
      additionalDirectories: [],
    },
    env: [],
    preservedKeys: [],
    ...overrides,
  };
};

const resource = (
  status: AsyncResource<readonly ScopeSettings[]>['status'],
  data: readonly ScopeSettings[] | undefined,
  reload = noop,
): AsyncResource<readonly ScopeSettings[]> => {
  return {
    status,
    data,
    reload,
  };
};

test('shows the active scope with its path and rules', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user'), scope('project'), scope('local')])}
      projectPath="/repo"
    />,
  );

  expect(screen.getByText('/home/.claude/user.json')).toBeDefined();
  expect(screen.getByText('Bash(ls:*)')).toBeDefined();
  expect(screen.getByText('Allowed')).toBeDefined();
  expect(screen.getByText('Environment variables')).toBeDefined();
});

test('switches to another scope and shows its own file', async () => {
  render(
    <SettingsView
      settings={resource('ready', [
        scope('user'),
        scope('project', {
          permissions: {
            allow: [],
            deny: ['Read(./.env)'],
            ask: [],
            additionalDirectories: [],
          },
        }),
      ])}
      projectPath="/repo"
    />,
  );

  await userEvent.click(screen.getByText('Project'));

  expect(screen.getByText('/home/.claude/project.json')).toBeDefined();
  expect(screen.getByText('Read(./.env)')).toBeDefined();
  expect(screen.queryByText('Bash(ls:*)')).toBeNull();
});

test('nudges towards a project when only the user scope is available', () => {
  render(<SettingsView settings={resource('ready', [scope('user')])} projectPath={null} />);

  expect(screen.getByText(/Pick a project in the sidebar/)).toBeDefined();
});

test('names a file that does not exist yet and the keys it will keep', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user', {
        exists: false,
        preservedKeys: ['hooks', 'statusLine'],
      })])}
      projectPath="/repo"
    />,
  );

  expect(screen.getByText(/will be created on save/)).toBeDefined();
  expect(screen.getByText(/hooks, statusLine/)).toBeDefined();
});

test('refuses to save over a file it could not parse', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user', { readable: false })])}
      projectPath="/repo"
    />,
  );

  expect(screen.getByText(/not valid JSON/)).toBeDefined();
  expect(screen.getByText('Save settings').closest('button')?.disabled).toBe(true);
});

test('waits while loading and reports a read failure', () => {
  const { rerender } = render(
    <SettingsView settings={resource('loading', undefined)} projectPath="/repo" />,
  );

  expect(screen.queryByText('Save settings')).toBeNull();

  rerender(
    <SettingsView
      settings={{
        status: 'error',
        error: 'denied',
        reload: noop,
      }}
      projectPath="/repo"
    />,
  );
  expect(screen.getByText('denied')).toBeDefined();
});

test('says so when the chosen scope is not among the loaded ones', () => {
  render(<SettingsView settings={resource('ready', [scope('project')])} projectPath="/repo" />);

  expect(screen.getByText('No settings file for this scope')).toBeDefined();
});

test('saves an edited rule list and reloads', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ scope: scope('user') });
  }));

  render(
    <SettingsView settings={resource('ready', [scope('user')], reload)} projectPath="/repo" />,
  );

  await userEvent.type(screen.getByLabelText('Add a rule to Denied'), 'Read(./.env)');
  await userEvent.click(screen.getAllByText('Add')[1] ?? document.body);
  await userEvent.click(screen.getByText('Save settings'));

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
  expect(await screen.findByText('Saved')).toBeDefined();
});

test('reports a failed save', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Response('{"error":"read-only file system"}', { status: 500 });
  }));

  render(<SettingsView settings={resource('ready', [scope('user')])} projectPath={null} />);
  await userEvent.click(screen.getByText('Save settings'));

  expect(await screen.findByText('read-only file system')).toBeDefined();
});

test('edits directories and environment variables before saving', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ scope: scope('user') });
  }));

  render(<SettingsView settings={resource('ready', [scope('user')])} projectPath="/repo" />);

  await userEvent.type(screen.getByLabelText('Add a rule to Additional directories'), '../shared');
  await userEvent.click(screen.getAllByText('Add')[3] ?? document.body);
  expect(screen.getByText('../shared')).toBeDefined();

  await userEvent.type(screen.getByLabelText('Variable name'), 'A');
  await userEvent.type(screen.getByLabelText('Value'), 'b');
  await userEvent.click(screen.getAllByText('Add').at(-1) ?? document.body);

  expect(screen.getByText('A')).toBeDefined();
});
