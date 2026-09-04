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

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';

export type SettingsScope = 'user' | 'project' | 'local';

export type SettingsFormat = 'json' | 'toml';

export interface AgentSettingsSurface {
  readonly scope: SettingsScope;
  readonly path: string;
  readonly format: SettingsFormat;
  /*
   * Claude's settings.json is the only shape this editor has ever written, and
   * the only one whose permissions and env blocks it understands. Every other
   * agent keeps a file of its own schema, so writing Claude's keys into one
   * would invent configuration that agent never asked for.
   */
  readonly editable: boolean;
}

interface SurfaceSpec {
  readonly scope: SettingsScope;
  readonly format: SettingsFormat;
  readonly editable: boolean;
  readonly path: (home: string, project: string) => string;
}

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

/*
 * Where each agent keeps the file that configures it, rather than only where
 * Claude does. An agent absent here has no general settings file at all: it
 * configures MCP servers and rules in their own files, which the Health tab
 * already reads, and inventing a settings page for it would show an empty one.
 */
const SURFACES: Partial<Record<AgentId, readonly SurfaceSpec[]>> = {
  claude: [
    {
      scope: 'user',
      format: 'json',
      editable: true,
      path: (home) => {
        return join(home, '.claude', 'settings.json');
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

/**
 * The files an agent merges, in the order it merges them. A project path is
 * required for every scope but the user's, so without one only that scope
 * resolves and the rest are left out.
 */
export const settingsSurfacesFor = (
  agent: AgentId,
  projectPath: string,
  home: string = homedir(),
): readonly AgentSettingsSurface[] => {
  return (SURFACES[agent] ?? []).flatMap((spec) => {
    if (spec.scope !== 'user' && projectPath.length === 0) {
      return [];
    }

    return [{
      scope: spec.scope,
      format: spec.format,
      editable: spec.editable,
      path: spec.path(home, projectPath),
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
    }),
  };
};

/*
 * The section headers and root keys of a TOML file, which is as much as this
 * reads of one. Codex and Grok keep their configuration in TOML, and naming
 * what a file holds is enough to say where a setting lives without adding a
 * TOML dependency to write it.
 */
const tomlKeys = (text: string): readonly string[] => {
  const keys: string[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('[')) {
      const header = trimmed.slice(1, trimmed.indexOf(']'));

      const named = header.replace(/^\[/u, '').trim();

      if (named.length > 0) {
        /*
         * Only the outermost name. Codex writes a table per project and per
         * plugin, so keeping the full path listed hundreds of keys where the
         * question is which areas the file configures.
         */
        keys.push(named.split('.', 1).join(''));
      }

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
    preservedKeys: tomlKeys(text),
    format: surface.format,
    editable: surface.editable,
  };
};

/**
 * One agent's settings files, each reporting what it holds and whether this
 * editor may write it.
 *
 * A surface that is not editable still reports its keys, because knowing which
 * file carries a setting is the part that is hard to find, and reading it is
 * safe where writing its schema would be a guess.
 */
export const readAgentSettings = async (
  agent: AgentId,
  projectPath: string,
  home?: string,
): Promise<readonly ScopeSettings[]> => {
  return Promise.all(settingsSurfacesFor(agent, projectPath, home).map(async (surface) => {
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
  agent: AgentId = 'claude',
): Promise<ScopeSettings> => {
  if (scope !== 'user' && projectPath.length === 0) {
    throw new Error('Select a project before editing its settings.');
  }

  /*
   * The guard belongs here rather than only in the view. A surface is
   * read-only because its schema is not Claude's, so writing permissions and
   * env into it would invent configuration the agent never asked for, and a
   * request that reaches the service directly must be refused too.
   */
  const surface = settingsSurfacesFor(agent, projectPath, home).find((entry) => {
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
