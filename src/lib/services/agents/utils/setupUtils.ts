import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';

import { readModelAuth } from './modelAuthUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type { ModelAuthState } from './modelAuthUtils';

export type SetupScope = 'user' | 'project';

export interface McpServerSummary {
  readonly name: string;
  readonly scope: SetupScope;
  readonly source: string;
  readonly command: string | undefined;
}

export interface RulesFileSummary {
  readonly path: string;
  readonly scope: SetupScope;
  readonly bytes: number;
  readonly modifiedMs: number;
}

export interface AgentSetup {
  readonly agent: AgentId;
  readonly mcpServers: readonly McpServerSummary[];
  readonly rules: readonly RulesFileSummary[];
  readonly modelAuth: ModelAuthState;
}

interface SetupLocation {
  readonly scope: SetupScope;
  readonly path: (home: string, projectPath: string) => string;
}

interface McpLocation extends SetupLocation {
  readonly read?: ((parsed: JsonValue, projectPath: string) => readonly string[])
    | undefined;
}

interface AgentSetupSpec {
  readonly mcp: readonly McpLocation[];
  readonly rules: readonly SetupLocation[];
}

const asObject = (value: JsonValue | undefined): JsonObject | undefined => {
  return isJsonObject(value) ? value : undefined;
};

const namesUnder = (parsed: JsonValue, key: string): readonly string[] => {
  return Object.keys(asObject(asObject(parsed)?.[key]) ?? {});
};

const topLevel = (key: string) => {
  return (parsed: JsonValue): readonly string[] => {
    return namesUnder(parsed, key);
  };
};

// Claude keeps each project's servers under its absolute path in a single user-level file.
const claudeProjectScoped = (parsed: JsonValue, projectPath: string): readonly string[] => {
  const entry = asObject(asObject(asObject(parsed)?.projects)?.[projectPath]);

  return Object.keys(asObject(entry?.mcpServers) ?? {});
};

const jsonMcpNames = async (
  file: string,
  read: NonNullable<McpLocation['read']>,
  projectPath: string,
): Promise<readonly string[]> => {
  try {
    return read(parseJsonContainer(await readFile(file, 'utf8')), projectPath);
  }
  catch {
    return [];
  }
};

const TOML_HEADER = '[mcp_servers.';

// Only the first segment names a server; read per line so the match cannot backtrack.
const tomlHeaderName = (line: string): string | undefined => {
  const trimmed = line.trimStart();

  if (!trimmed.startsWith(TOML_HEADER)) {
    return undefined;
  }

  const rest = trimmed.slice(TOML_HEADER.length);

  if (rest.startsWith('"')) {
    const close = rest.indexOf('"', 1);

    return close > 1 ? rest.slice(1, close) : undefined;
  }

  const end = rest.search(/[.\]]/u);

  return end > 0 ? rest.slice(0, end) : undefined;
};

const tomlMcpNames = async (file: string): Promise<readonly string[]> => {
  try {
    const content = await readFile(file, 'utf8');
    const names = content.split('\n').flatMap((line) => {
      const name = tomlHeaderName(line);

      return name == null ? [] : [name];
    });

    return [...new Set(names)];
  }
  catch {
    return [];
  }
};

const SPECS: Partial<Record<AgentId, AgentSetupSpec>> = {
  'claude': {
    mcp: [
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.claude.json');
        },
        read: topLevel('mcpServers'),
      },
      {
        scope: 'project',
        path: (home) => {
          return join(home, '.claude.json');
        },
        read: claudeProjectScoped,
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.mcp.json');
        },
        read: topLevel('mcpServers'),
      },
    ],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'CLAUDE.md');
        },
      },
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.claude', 'CLAUDE.md');
        },
      },
    ],
  },
  'codex': {
    mcp: [{
      scope: 'user',
      path: (home) => {
        return join(home, '.codex', 'config.toml');
      },
    }],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'AGENTS.md');
        },
      },
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.codex', 'AGENTS.md');
        },
      },
    ],
  },
  'gemini': {
    mcp: [
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.gemini', 'settings.json');
        },
        read: topLevel('mcpServers'),
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.gemini', 'settings.json');
        },
        read: topLevel('mcpServers'),
      },
    ],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'GEMINI.md');
        },
      },
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.gemini', 'GEMINI.md');
        },
      },
    ],
  },
  'copilot': {
    mcp: [{
      scope: 'project',
      path: (_home, project) => {
        return join(project, '.vscode', 'mcp.json');
      },
      read: topLevel('servers'),
    }],
    rules: [{
      scope: 'project',
      path: (_home, project) => {
        return join(project, '.github', 'copilot-instructions.md');
      },
    }],
  },
  'cursor': {
    mcp: [
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.cursor', 'mcp.json');
        },
        read: topLevel('mcpServers'),
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.cursor', 'mcp.json');
        },
        read: topLevel('mcpServers'),
      },
    ],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.cursor', 'rules');
        },
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'AGENTS.md');
        },
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.cursorrules');
        },
      },
    ],
  },
  'opencode': {
    mcp: [{
      scope: 'user',
      path: (home) => {
        return join(home, '.config', 'opencode', 'opencode.json');
      },
      read: topLevel('mcp'),
    }],
    rules: [{
      scope: 'project',
      path: (_home, project) => {
        return join(project, 'AGENTS.md');
      },
    }],
  },
  'antigravity': {
    mcp: [
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.gemini', 'config', 'mcp_config.json');
        },
        read: topLevel('mcpServers'),
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.agents', 'mcp_config.json');
        },
        read: topLevel('mcpServers'),
      },
    ],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'AGENTS.md');
        },
      },
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.gemini', 'GEMINI.md');
        },
      },
    ],
  },
  'grok': {
    mcp: [
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.grok', 'config.toml');
        },
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.grok', 'config.toml');
        },
      },
    ],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'AGENTS.md');
        },
      },
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.grok', 'AGENTS.md');
        },
      },
    ],
  },
  'cursor-agent': {
    mcp: [
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.cursor', 'mcp.json');
        },
        read: topLevel('mcpServers'),
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.cursor', 'mcp.json');
        },
        read: topLevel('mcpServers'),
      },
    ],
    rules: [
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, '.cursor', 'rules');
        },
      },
      {
        scope: 'project',
        path: (_home, project) => {
          return join(project, 'AGENTS.md');
        },
      },
      {
        scope: 'user',
        path: (home) => {
          return join(home, '.cursor', 'rules');
        },
      },
    ],
  },
};

// A rules location may be one file or a directory of them, as Cursor keeps `.cursor/rules`.
const rulesPresent = async (
  location: SetupLocation,
  home: string,
  projectPath: string,
): Promise<readonly RulesFileSummary[]> => {
  const path = location.path(home, projectPath);

  try {
    const facts = await stat(path);

    if (facts.isFile()) {
      return [{
        path,
        scope: location.scope,
        bytes: facts.size,
        modifiedMs: facts.mtimeMs,
      }];
    }

    if (!facts.isDirectory()) {
      return [];
    }

    const names = (await readdir(path)).sort((left, right) => {
      return left.localeCompare(right);
    });

    return await Promise.all(names.map(async (name) => {
      const child = join(path, name);

      const childFacts = await stat(child);

      return {
        path: child,
        scope: location.scope,
        bytes: childFacts.size,
        modifiedMs: childFacts.mtimeMs,
      };
    }));
  }
  catch {
    return [];
  }
};

const serversAt = async (
  location: McpLocation,
  home: string,
  projectPath: string,
): Promise<readonly McpServerSummary[]> => {
  const path = location.path(home, projectPath);
  const read = location.read;
  const names = read == null ? await tomlMcpNames(path) : await jsonMcpNames(path, read, projectPath);

  return names.map((name) => {
    return {
      name,
      scope: location.scope,
      source: path,
      command: undefined,
    };
  });
};

// A config surface is readable exactly when SPECS names where its files live.
export const hasAgentSetup = (agent: AgentId): boolean => {
  return SPECS[agent] != null;
};

// Only files named in SPECS are opened; credential stores beside them are never read.
export const readAgentMcp = async (
  agent: AgentId,
  projectPath: string,
  home = homedir(),
): Promise<readonly McpServerSummary[]> => {
  const spec = SPECS[agent];

  if (spec == null) {
    return [];
  }

  const servers = await Promise.all(spec.mcp.map((location) => {
    return serversAt(location, home, projectPath);
  }));

  return servers.flat();
};

export const readAgentRules = async (
  agent: AgentId,
  projectPath: string,
  home = homedir(),
): Promise<readonly RulesFileSummary[]> => {
  const spec = SPECS[agent];

  if (spec == null) {
    return [];
  }

  const files = await Promise.all(spec.rules.map((location) => {
    return rulesPresent(location, home, projectPath);
  }));

  return files.flat();
};

export const readAgentSetup = async (
  agent: AgentId,
  projectPath: string,
  home = homedir(),
): Promise<AgentSetup> => {
  const [mcpServers, rules, modelAuth] = await Promise.all([
    readAgentMcp(agent, projectPath, home),
    readAgentRules(agent, projectPath, home),
    readModelAuth(agent, home),
  ]);

  return {
    agent,
    mcpServers,
    rules,
    modelAuth,
  };
};
