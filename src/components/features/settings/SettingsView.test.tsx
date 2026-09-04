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
    format: 'json',
    editable: true,
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
      agent="claude"
      onSelectAgent={noop}
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
      agent="claude"
      onSelectAgent={noop}
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

test('parks an unsaved edit when the scope changes rather than discarding it', async () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user'), scope('project')])}
      projectPath="/repo"
      agent="claude"
      onSelectAgent={noop}
    />,
  );

  await userEvent.click(screen.getByTitle('Add a rule to Denied'));
  await userEvent.type(screen.getByLabelText('Add a rule to Denied'), 'Read(./.env){Enter}');
  expect(screen.getByText('Unsaved changes')).toBeDefined();
  // The tab counts the parked edit, not the file it has not been written to yet.
  expect(screen.getByText('User').closest('button')?.textContent).toContain('2');

  await userEvent.click(screen.getByText('Project'));
  expect(screen.queryByText('Read(./.env)')).toBeNull();
  expect(screen.queryByText('Unsaved changes')).toBeNull();

  await userEvent.click(screen.getByText('User'));
  expect(screen.getByText('Read(./.env)')).toBeDefined();
  expect(screen.getByText('Unsaved changes')).toBeDefined();
});

test('nudges towards a project when only the user scope is available', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user')])}
      projectPath={null}
      agent="claude"
      onSelectAgent={noop}
    />,
  );

  expect(screen.getByText(/Pick a project in the sidebar/)).toBeDefined();
});

test('names a file that does not exist yet and the keys it will keep', () => {
  render(
    <SettingsView
      agent="claude"
      onSelectAgent={noop}
      settings={resource('ready', [scope('user', {
        exists: false,
        preservedKeys: ['hooks', 'statusLine'],
      })])}
      projectPath="/repo"
    />,
  );

  expect(screen.getByText(/will be created on save/)).toBeDefined();
  expect(screen.getByText('hooks')).toBeDefined();
  expect(screen.getByText('statusLine')).toBeDefined();
});

test('refuses to save over a file it could not parse', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user', { readable: false })])}
      agent="claude"
      onSelectAgent={noop}
      projectPath="/repo"
    />,
  );

  expect(screen.getByText(/not valid JSON/)).toBeDefined();
  expect(screen.getByText('Save settings').closest('button')?.disabled).toBe(true);
});

test('waits while loading and reports a read failure', () => {
  const { rerender } = render(
    <SettingsView
      settings={resource('loading', undefined)}
      projectPath="/repo"
      agent="claude"
      onSelectAgent={noop}
    />,
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
      agent="claude"
      onSelectAgent={noop}
    />,
  );
  expect(screen.getByText('denied')).toBeDefined();
});

test('says so when the chosen scope is not among the loaded ones', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('project')])}
      projectPath="/repo"
      agent="claude"
      onSelectAgent={noop}
    />,
  );

  expect(screen.getByText('No settings file for this scope')).toBeDefined();
});

test('saves an edited rule list and reloads', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ scope: scope('user') });
  }));

  render(
    <SettingsView
      settings={resource('ready', [scope('user')], reload)}
      projectPath="/repo"
      agent="claude"
      onSelectAgent={noop}
    />,
  );

  await userEvent.click(screen.getByTitle('Add a rule to Denied'));
  await userEvent.type(screen.getByLabelText('Add a rule to Denied'), 'Read(./.env){Enter}');
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

  render(
    <SettingsView
      settings={resource('ready', [scope('user')])}
      projectPath={null}
      agent="claude"
      onSelectAgent={noop}
    />,
  );
  await userEvent.click(screen.getByText('Save settings'));

  expect(await screen.findByText('read-only file system')).toBeDefined();
});

test('edits directories and environment variables before saving', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ scope: scope('user') });
  }));

  render(
    <SettingsView
      settings={resource('ready', [scope('user')])}
      projectPath="/repo"
      agent="claude"
      onSelectAgent={noop}
    />,
  );

  await userEvent.click(screen.getByTitle('Add a rule to Additional directories'));
  await userEvent.type(
    screen.getByLabelText('Add a rule to Additional directories'),
    '../shared{Enter}',
  );
  expect(screen.getByText('../shared')).toBeDefined();

  await userEvent.click(screen.getByTitle('Add an environment variable'));
  await userEvent.type(screen.getByLabelText('Variable name'), 'A');
  await userEvent.type(screen.getByLabelText('Value'), 'b{Enter}');

  expect(screen.getByText('A')).toBeDefined();
});

test('offers only the agents that keep a settings file, and reports the pick', async () => {
  const onSelectAgent = vi.fn();

  render(
    <SettingsView
      settings={resource('ready', [scope('user')])}
      projectPath="/repo"
      agent="claude"
      onSelectAgent={onSelectAgent}
    />,
  );

  expect(screen.getByRole('button', { name: 'Codex CLI' })).toBeDefined();
  // Copilot configures MCP servers and rules, but keeps no settings file.
  expect(screen.queryByRole('button', { name: 'GitHub Copilot' })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Codex CLI' }));

  expect(onSelectAgent).toHaveBeenCalledWith('codex');
});

test('reads a surface it may not write instead of offering the editors', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user', {
        path: '/home/.codex/config.toml',
        format: 'toml',
        editable: false,
        preservedKeys: ['model', 'mcp_servers.webstorm'],
      })])}
      projectPath="/repo"
      agent="codex"
      onSelectAgent={noop}
    />,
  );

  expect(screen.getByText('/home/.codex/config.toml')).toBeDefined();
  expect(screen.getByText('Read-only here')).toBeDefined();
  expect(screen.getByText('model')).toBeDefined();
  expect(screen.getByText('mcp_servers.webstorm')).toBeDefined();
  // None of the Claude-shaped editors, and nothing to press that would write.
  expect(screen.queryByText('Allowed')).toBeNull();
  expect(screen.queryByText('Environment variables')).toBeNull();
  expect(screen.queryByText('Save settings')).toBeNull();
});

test('says a read-only file that exists holds nothing yet', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user', {
        format: 'toml',
        editable: false,
      })])}
      projectPath="/repo"
      agent="codex"
      onSelectAgent={noop}
    />,
  );

  expect(screen.getByText(/no settings in it yet/u)).toBeDefined();
  expect(screen.queryByText('not on disk')).toBeNull();
});

test('never promises to create a file it has no way to write', () => {
  render(
    <SettingsView
      settings={resource('ready', [scope('user', {
        exists: false,
        format: 'toml',
        editable: false,
      })])}
      projectPath="/repo"
      agent="codex"
      onSelectAgent={noop}
    />,
  );

  // The read-only branch has no Save button, so the two together were a
  // contradiction: three of the five agents opened on one.
  expect(screen.getByText('not on disk')).toBeDefined();
  expect(screen.queryByText(/will be created on save/u)).toBeNull();
  expect(screen.queryByText('Save settings')).toBeNull();
  expect(screen.getByText(/does not exist yet/u)).toBeDefined();
});

test('says an agent has no settings file of its own', () => {
  render(
    <SettingsView
      settings={resource('ready', [])}
      projectPath="/repo"
      agent="copilot"
      onSelectAgent={noop}
    />,
  );

  expect(screen.getByText(/no settings file of its own/u)).toBeDefined();
});
