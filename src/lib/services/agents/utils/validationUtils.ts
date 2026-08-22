import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';

export interface SetupFinding {
  readonly agent: AgentId;
  readonly kind: 'hook' | 'marketplace' | 'plugin' | 'mcp';
  readonly summary: string;
  readonly detail: string;
}

const readJson = async (file: string): Promise<JsonValue> => {
  try {
    return parseJsonContainer(await readFile(file, 'utf8'));
  }
  catch {
    return null;
  }
};

const objectAt = (parsed: JsonValue, key: string): JsonObject => {
  const root = isJsonObject(parsed) ? parsed[key] : undefined;

  return isJsonObject(root) ? root : {};
};

const stringsAt = (parsed: JsonObject, key: string): readonly string[] => {
  return (isJsonArray(parsed[key]) ? parsed[key] : []).flatMap((entry) => {
    return typeof entry === 'string' ? [entry] : [];
  });
};

const QUOTES = ["'", '"'];

const firstToken = (command: string): string | undefined => {
  const trimmed = command.trimStart();
  const quote = QUOTES.find((candidate) => {
    return trimmed.startsWith(candidate);
  });

  if (quote == null) {
    return trimmed.split(/\s/u)[0];
  }

  const close = trimmed.indexOf(quote, 1);

  return close > 1 ? trimmed.slice(1, close) : undefined;
};

// A bare command resolves through PATH, which this cannot see, so only paths are checked.
const hookScriptPath = (command: string): string | undefined => {
  const token = firstToken(command);

  return token?.includes('/') === true ? token : undefined;
};

const hookCommands = (settings: JsonValue): readonly string[] => {
  return Object.values(objectAt(settings, 'hooks')).flatMap((matchers) => {
    return (isJsonArray(matchers) ? matchers : []).flatMap((matcher) => {
      const entries = isJsonObject(matcher) ? matcher.hooks : undefined;

      return (isJsonArray(entries) ? entries : []).flatMap((entry) => {
        const command = isJsonObject(entry) ? entry.command : undefined;

        return typeof command === 'string' ? [command] : [];
      });
    });
  });
};

const brokenHooks = async (settings: JsonValue): Promise<readonly SetupFinding[]> => {
  const paths = hookCommands(settings).flatMap((command) => {
    const path = hookScriptPath(command);

    return path == null ? [] : [path];
  });
  const checked = await Promise.all(paths.map(async (path) => {
    try {
      await access(path, constants.X_OK);

      return [];
    }
    catch {
      return [{
        agent: 'claude' as const,
        kind: 'hook' as const,
        summary: 'Hook script is missing or not executable',
        detail: path,
      }];
    }
  }));

  return checked.flat();
};

const unknownMarketplaces = (settings: JsonValue, known: JsonValue): readonly SetupFinding[] => {
  const names = new Set([
    ...Object.keys(isJsonObject(known) ? known : {}),
    ...Object.keys(objectAt(settings, 'extraKnownMarketplaces')),
  ]);

  return Object.keys(objectAt(settings, 'enabledPlugins')).flatMap((entry) => {
    const marketplace = entry.split('@')[1];

    if (marketplace == null || names.has(marketplace)) {
      return [];
    }

    return [{
      agent: 'claude' as const,
      kind: 'plugin' as const,
      summary: 'Plugin is enabled from a marketplace this machine does not know',
      detail: entry,
    }];
  });
};

// A relative directory source resolves against the settings file that declared it.
const missingMarketplaceDirs = async (
  settings: JsonValue,
  base: string,
): Promise<readonly SetupFinding[]> => {
  const entries = Object.entries(objectAt(settings, 'extraKnownMarketplaces'));
  const checked = await Promise.all(entries.map(async ([name, value]) => {
    const source = isJsonObject(value) ? value.source : undefined;
    const kind = isJsonObject(source) ? source.source : undefined;
    const path = isJsonObject(source) ? source.path : undefined;

    if (kind !== 'directory' || typeof path !== 'string') {
      return [];
    }

    const absolute = isAbsolute(path) ? path : resolve(base, path);

    try {
      await access(absolute, constants.R_OK);

      return [];
    }
    catch {
      return [{
        agent: 'claude' as const,
        kind: 'marketplace' as const,
        summary: 'Marketplace folder no longer resolves',
        detail: `${name} → ${absolute}`,
      }];
    }
  }));

  return checked.flat();
};

const unapprovedMcp = (projectMcp: JsonValue, userConfig: JsonValue, projectPath: string): readonly SetupFinding[] => {
  const declared = Object.keys(objectAt(projectMcp, 'mcpServers'));

  if (declared.length === 0) {
    return [];
  }

  const entry = objectAt(objectAt(userConfig, 'projects'), projectPath);
  const approved = new Set(stringsAt(entry, 'enabledMcpjsonServers'));
  const refused = new Set(stringsAt(entry, 'disabledMcpjsonServers'));

  return declared.flatMap((name) => {
    return approved.has(name) || refused.has(name)
      ? []
      : [{
          agent: 'claude' as const,
          kind: 'mcp' as const,
          summary: 'Project MCP server has never been approved, so it stays inactive',
          detail: name,
        }];
  });
};

// Every finding names a file or entry the reader can fix; nothing here changes anything.
export const validateAgentSetup = async (
  projectPath: string,
  home = homedir(),
): Promise<readonly SetupFinding[]> => {
  const [userSettings, projectSettings, known, userConfig, projectMcp] = await Promise.all([
    readJson(join(home, '.claude', 'settings.json')),
    readJson(join(projectPath, '.claude', 'settings.json')),
    readJson(join(home, '.claude', 'plugins', 'known_marketplaces.json')),
    readJson(join(home, '.claude.json')),
    readJson(join(projectPath, '.mcp.json')),
  ]);

  const [userHooks, projectHooks, userDirs, projectDirs] = await Promise.all([
    brokenHooks(userSettings),
    brokenHooks(projectSettings),
    missingMarketplaceDirs(userSettings, home),
    missingMarketplaceDirs(projectSettings, projectPath),
  ]);

  return [
    ...userHooks,
    ...projectHooks,
    ...userDirs,
    ...projectDirs,
    ...unknownMarketplaces(userSettings, known),
    ...unknownMarketplaces(projectSettings, known),
    ...unapprovedMcp(projectMcp, userConfig, projectPath),
  ];
};
