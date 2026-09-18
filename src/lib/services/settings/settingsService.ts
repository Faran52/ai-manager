import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { isAgentId } from '@config/agents';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';

import {
  EDITED_KEYS,
  EMPTY_PERMISSIONS,
  MAX_RULE_LENGTH,
  MAX_RULES,
  PERMISSION_KEYS,
  SURFACES,
} from './constants';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type { SurfaceSpec } from './constants';

export type SettingsScope = 'user' | 'project' | 'local';

export type SettingsFormat = 'json' | 'toml';

export interface AgentSettingsSurface {
  readonly scope: SettingsScope;
  readonly path: string;
  readonly format: SettingsFormat;
  /*
   * Claude settings.json is the only shape this editor understands: writing Claude
   * keys into another agent's schema invents configuration it never asked for.
   */
  readonly editable: boolean;
}

export interface SettingsPermissions {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
  readonly ask: readonly string[];
  readonly additionalDirectories: readonly string[];
}

export interface PreservedKey {
  readonly name: string;
  // Absent for TOML, which is read for key names without parsing values.
  readonly value?: string | undefined;
}

export interface ScopeSettings {
  readonly scope: SettingsScope;
  readonly path: string;
  readonly exists: boolean;
  readonly readable: boolean;
  readonly permissions: SettingsPermissions;
  readonly env: readonly EnvEntry[];
  // Keys this editor does not understand, kept so a write cannot drop them.
  readonly preservedKeys: readonly PreservedKey[];
  readonly format?: SettingsFormat | undefined;
  readonly editable?: boolean | undefined;
}

export interface EnvEntry {
  readonly name: string;
  readonly value: string;
}

export interface SettingsPatch {
  readonly permissions: SettingsPermissions;
  readonly env: readonly EnvEntry[];
}

interface SettingsFileRoot {
  readonly root: JsonObject | undefined;
  readonly exists: boolean;
}

export const settingsScopes: readonly SettingsScope[] = ['user', 'project', 'local'];

const isScope = (value: string): value is SettingsScope => {
  return settingsScopes.some((scope) => {
    return scope === value;
  });
};

export const isSettingsScope = isScope;

// The agents SURFACES covers, checked against config's picker list in a test.
const surfacedAgentsWith = (
  predicate: (specs: readonly SurfaceSpec[]) => boolean,
): readonly AgentId[] => {
  return Object.entries(SURFACES).flatMap(([key, specs]) => {
    return isAgentId(key) && predicate(specs) ? [key] : [];
  });
};

export const surfacedAgents: readonly AgentId[] = surfacedAgentsWith(() => {
  return true;
});

// The agents whose surfaces include a file inside the project.
export const projectScopedAgents: readonly AgentId[] = surfacedAgentsWith((specs) => {
  return specs.some((spec) => {
    return spec.scope !== 'user';
  });
});

export const hasAgentSettings = (agent: AgentId): boolean => {
  return SURFACES[agent] != null;
};

// The files an agent merges, in the order it merges them. Every scope but the
// user's needs a project path, so without one only that scope resolves.
export const settingsSurfacesFor = (
  agent: AgentId,
  projectPath: string,
  home: string = homedir(),
  claudeDir: string = join(home, '.claude'),
): readonly AgentSettingsSurface[] => {
  return (SURFACES[agent] ?? []).flatMap((spec) => {
    if (spec.scope !== 'user' && projectPath.length === 0) {
      return [];
    }

    return [{
      scope: spec.scope,
      format: spec.format,
      editable: spec.editable,
      path: spec.path(home, projectPath, claudeDir),
    }];
  });
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

const readRoot = async (path: string): Promise<SettingsFileRoot> => {
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

const HELD_MAX = 60;

const heldScalar = (value: JsonValue | undefined): string => {
  return isJsonObject(value) || isJsonArray(value) ? '…' : String(value);
};

// One level deep and capped: a scalar reads as itself, a container as what it names inside.
const heldValue = (value: JsonValue | undefined): string => {
  let text = heldScalar(value);

  if (isJsonObject(value)) {
    text = Object.keys(value).join(', ');
  }
  else if (isJsonArray(value)) {
    text = value.map(heldScalar).join(', ');
  }

  return text.length > HELD_MAX ? `${text.slice(0, HELD_MAX - 1)}…` : text;
};

const readJsonSurface = async (surface: AgentSettingsSurface): Promise<ScopeSettings> => {
  const { scope, path } = surface;
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
    }).map((name) => {
      return {
        name,
        value: heldValue(root[name]),
      };
    }),
  };
};

// Naming what a file holds is enough to say where a setting lives, without
// adding a TOML dependency to write it.
const tomlKeys = (text: string): readonly string[] => {
  const keys: string[] = [];
  let inTable = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('[')) {
      inTable = true;

      const header = trimmed.slice(1, trimmed.indexOf(']'));

      const named = header.replace(/^\[/u, '').trim();

      if (named.length > 0) {
        /*
         * Only the outermost name: Codex writes a table per project and per plugin,
         * so full paths listed hundreds of keys for a question about areas.
         */
        keys.push(named.split('.', 1).join(''));
      }

      continue;
    }

    /*
     * A key under a table belongs to the table its header already named. Collecting
     * these too listed sixty keys for a file configuring thirteen areas.
     */
    if (inTable) {
      continue;
    }

    const equals = trimmed.indexOf('=');

    if (equals > 0) {
      keys.push(trimmed.slice(0, equals).trim());
    }
  }

  return [...new Set(keys)];
};

const readTomlSurface = async (
  surface: AgentSettingsSurface,
): Promise<ScopeSettings> => {
  let text: string;

  try {
    text = await readFile(surface.path, 'utf8');
  }
  catch {
    return {
      scope: surface.scope,
      path: surface.path,
      exists: false,
      readable: true,
      permissions: EMPTY_PERMISSIONS,
      env: [],
      preservedKeys: [],
      format: surface.format,
      editable: surface.editable,
    };
  }

  return {
    scope: surface.scope,
    path: surface.path,
    exists: true,
    readable: true,
    permissions: EMPTY_PERMISSIONS,
    env: [],
    preservedKeys: tomlKeys(text).map((name) => {
      return { name };
    }),
    format: surface.format,
    editable: surface.editable,
  };
};

// A surface that is not editable still reports its keys: knowing which file
// carries a setting is the hard part, and reading is safe where writing is a guess.
export const readAgentSettings = async (
  agent: AgentId,
  projectPath: string,
  home?: string,
  claudeDir?: string,
): Promise<readonly ScopeSettings[]> => {
  return Promise.all(settingsSurfacesFor(agent, projectPath, home, claudeDir).map(async (surface) => {
    if (surface.format === 'toml') {
      return readTomlSurface(surface);
    }

    const read = await readJsonSurface(surface);

    return {
      ...read,
      format: surface.format,
      editable: surface.editable,
    };
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

// Replaces only the two blocks this editor owns and writes the rest back untouched:
// a settings file also holds hooks and a status line, and losing those is the bug.
export const writeScopeSettings = async (
  scope: SettingsScope,
  projectPath: string,
  patch: SettingsPatch,
  home?: string,
  agent: AgentId = 'claude',
  claudeDir?: string,
): Promise<ScopeSettings> => {
  if (scope !== 'user' && projectPath.length === 0) {
    throw new Error('Select a project before editing its settings.');
  }

  // The guard belongs here rather than only in the view, because a request that
  // reaches the service directly must be refused too.
  const surface = settingsSurfacesFor(agent, projectPath, home, claudeDir).find((entry) => {
    return entry.scope === scope;
  });

  if (surface == null) {
    throw new Error('This agent has no settings file for that scope.');
  }

  if (!surface.editable) {
    throw new Error('This agent\'s settings are read-only here.');
  }

  const { path } = surface;
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

  return readJsonSurface(surface);
};
