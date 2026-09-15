import { join } from 'node:path';

import type { AgentId } from '@config/agents';
import type {
  SettingsFormat,
  SettingsPermissions,
  SettingsScope,
} from './settingsService';

export interface SurfaceSpec {
  readonly scope: SettingsScope;
  readonly format: SettingsFormat;
  readonly editable: boolean;
  readonly path: (home: string, project: string, claudeDir: string) => string;
}

export const PERMISSION_KEYS = ['allow', 'deny', 'ask', 'additionalDirectories'] as const;

export const EDITED_KEYS = new Set<string>(['permissions', 'env']);

export const MAX_RULES = 500;

export const MAX_RULE_LENGTH = 400;

// An agent absent here has no general settings file: it configures servers and
// rules in their own files, which the Health tab already reads.
export const SURFACES: Partial<Record<AgentId, readonly SurfaceSpec[]>> = {
  claude: [
    {
      scope: 'user',
      format: 'json',
      editable: true,
      path: (_home, _project, claudeDir) => {
        return join(claudeDir, 'settings.json');
      },
    },
    {
      scope: 'project',
      format: 'json',
      editable: true,
      path: (_home, project) => {
        return join(project, '.claude', 'settings.json');
      },
    },
    {
      scope: 'local',
      format: 'json',
      editable: true,
      path: (_home, project) => {
        return join(project, '.claude', 'settings.local.json');
      },
    },
  ],
  gemini: [
    {
      scope: 'user',
      format: 'json',
      editable: false,
      path: (home) => {
        return join(home, '.gemini', 'settings.json');
      },
    },
    {
      scope: 'project',
      format: 'json',
      editable: false,
      path: (_home, project) => {
        return join(project, '.gemini', 'settings.json');
      },
    },
  ],
  opencode: [{
    scope: 'user',
    format: 'json',
    editable: false,
    path: (home) => {
      return join(home, '.config', 'opencode', 'opencode.json');
    },
  }],
  codex: [{
    scope: 'user',
    format: 'toml',
    editable: false,
    path: (home) => {
      return join(home, '.codex', 'config.toml');
    },
  }],
  grok: [
    {
      scope: 'user',
      format: 'toml',
      editable: false,
      path: (home) => {
        return join(home, '.grok', 'config.toml');
      },
    },
    {
      scope: 'project',
      format: 'toml',
      editable: false,
      path: (_home, project) => {
        return join(project, '.grok', 'config.toml');
      },
    },
  ],
};

export const EMPTY_PERMISSIONS: SettingsPermissions = {
  allow: [],
  deny: [],
  ask: [],
  additionalDirectories: [],
};
