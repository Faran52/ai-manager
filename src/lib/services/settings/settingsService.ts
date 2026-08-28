import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';

import type { JsonObject, JsonValue } from '@utils/jsonUtils';

export type SettingsScope = 'user' | 'project' | 'local';

export interface SettingsPermissions {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
  readonly ask: readonly string[];
  readonly additionalDirectories: readonly string[];
}

export interface ScopeSettings {
  readonly scope: SettingsScope;
  readonly path: string;
  readonly exists: boolean;
  readonly readable: boolean;
  readonly permissions: SettingsPermissions;
  readonly env: readonly EnvEntry[];
  // Keys this editor does not understand, kept so a write cannot drop them.
  readonly preservedKeys: readonly string[];
}

export interface EnvEntry {
  readonly name: string;
  readonly value: string;
}

export interface SettingsPatch {
  readonly permissions: SettingsPermissions;
  readonly env: readonly EnvEntry[];
}

export const settingsScopes: readonly SettingsScope[] = ['user', 'project', 'local'];

const PERMISSION_KEYS = ['allow', 'deny', 'ask', 'additionalDirectories'] as const;
const EDITED_KEYS = new Set<string>(['permissions', 'env']);
const MAX_RULES = 500;
const MAX_RULE_LENGTH = 400;

const isScope = (value: string): value is SettingsScope => {
  return settingsScopes.some((scope) => {
    return scope === value;
  });
};

export const isSettingsScope = isScope;

/**
 * The three files Claude Code merges, in the order it merges them. A project
 * path is required for the two project scopes, so the user scope is the only
 * one that resolves without one.
 */
export const settingsPathFor = (
  scope: SettingsScope,
  projectPath: string,
  home: string = homedir(),
): string => {
  if (scope === 'user') {
    return join(home, '.claude', 'settings.json');
  }

  return join(projectPath, '.claude', scope === 'local' ? 'settings.local.json' : 'settings.json');
};

const stringList = (value: JsonValue | undefined): readonly string[] => {
  if (!isJsonArray(value)) {
    return [];
  }

  return value.filter((entry) => {
    return typeof entry === 'string';
  });
};

const envEntries = (value: JsonValue | undefined): readonly EnvEntry[] => {
  if (!isJsonObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([name, raw]) => {
    return typeof raw === 'string'
      ? [{
          name,
          value: raw,
        }]
      : [];
  });
};

const permissionsFrom = (root: JsonObject): SettingsPermissions => {
  const block = isJsonObject(root.permissions) ? root.permissions : undefined;

  return {
    allow: stringList(block?.allow),
    deny: stringList(block?.deny),
    ask: stringList(block?.ask),
    additionalDirectories: stringList(block?.additionalDirectories),
  };
};

const EMPTY_PERMISSIONS: SettingsPermissions = {
  allow: [],
  deny: [],
  ask: [],
  additionalDirectories: [],
};

const readRoot = async (path: string): Promise<{
  readonly root: JsonObject | undefined;
  readonly exists: boolean;
}> => {
  let text: string;

  try {
    text = await readFile(path, 'utf8');
  }
  catch {
    return {
      root: undefined,
      exists: false,
    };
  }

  const parsed = parseJsonContainer(text);

  return {
    root: isJsonObject(parsed) ? parsed : undefined,
    exists: true,
  };
};

export const readScopeSettings = async (
  scope: SettingsScope,
  projectPath: string,
  home?: string,
): Promise<ScopeSettings> => {
  const path = settingsPathFor(scope, projectPath, home);
  const { root, exists } = await readRoot(path);

  if (root == null) {
    return {
      scope,
      path,
      exists,
      readable: !exists,
      permissions: EMPTY_PERMISSIONS,
      env: [],
      preservedKeys: [],
    };
  }

  return {
    scope,
    path,
    exists,
    readable: true,
    permissions: permissionsFrom(root),
    env: envEntries(root.env),
    preservedKeys: Object.keys(root).filter((key) => {
      return !EDITED_KEYS.has(key);
    }),
  };
};

export const readSettings = async (
  projectPath: string,
  home?: string,
): Promise<readonly ScopeSettings[]> => {
  const scopes = projectPath.length > 0 ? settingsScopes : ['user' as const];

  return Promise.all(scopes.map(async (scope) => {
    return readScopeSettings(scope, projectPath, home);
  }));
};

const cleanRules = (rules: readonly string[]): readonly string[] => {
  const seen = new Set<string>();

  for (const rule of rules) {
    const trimmed = rule.trim();

    if (trimmed.length > 0 && trimmed.length <= MAX_RULE_LENGTH) {
      seen.add(trimmed);
    }
  }

  return [...seen].slice(0, MAX_RULES);
};

const cleanEnv = (entries: readonly EnvEntry[]): JsonObject => {
  const result: Record<string, string> = {};

  for (const entry of entries) {
    const name = entry.name.trim();

    if (name.length > 0 && name.length <= MAX_RULE_LENGTH) {
      result[name] = entry.value;
    }
  }

  return result;
};

/**
 * Reads, replaces only the two blocks this editor owns, and writes the rest
 * back untouched. A settings file usually also holds hooks and a status line,
 * and losing those to a permissions edit would be the worst kind of bug.
 */
export const writeScopeSettings = async (
  scope: SettingsScope,
  projectPath: string,
  patch: SettingsPatch,
  home?: string,
): Promise<ScopeSettings> => {
  if (scope !== 'user' && projectPath.length === 0) {
    throw new Error('Select a project before editing its settings.');
  }

  const path = settingsPathFor(scope, projectPath, home);
  const { root, exists } = await readRoot(path);

  if (exists && root == null) {
    throw new Error('This settings file is not valid JSON. Fix it by hand before editing here.');
  }

  const filled = PERMISSION_KEYS.map((key) => {
    return {
      key,
      rules: cleanRules(patch.permissions[key]),
    };
  }).filter((entry) => {
    return entry.rules.length > 0;
  });
  const env = cleanEnv(patch.env);
  const preserved = Object.fromEntries(Object.entries(root ?? {}).filter(([key]) => {
    return !EDITED_KEYS.has(key);
  }));
  const next: JsonObject = {
    ...preserved,
    ...(filled.length === 0
      ? {}
      : {
          permissions: Object.fromEntries(filled.map((entry) => {
            return [entry.key, entry.rules];
          })),
        }),
    ...(Object.keys(env).length === 0 ? {} : { env }),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  return readScopeSettings(scope, projectPath, home);
};
