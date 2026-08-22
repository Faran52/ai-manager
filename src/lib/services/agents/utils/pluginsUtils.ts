import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';

import { type SetupScope } from './setupUtils';

import type { JsonObject, JsonValue } from '@utils/jsonUtils';

export interface InstalledPlugin {
  readonly id: string;
  readonly marketplace: string;
  readonly scope: SetupScope;
  readonly enabled: boolean;
  readonly version: string;
  readonly knownMarketplace: boolean;
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

const stringAt = (record: JsonObject, key: string): string | undefined => {
  const value = record[key];

  return typeof value === 'string' ? value : undefined;
};

// This project's install wins; one recorded for another project does not apply at all.
const applicableInstall = (installs: JsonValue, projectPath: string): JsonObject | undefined => {
  const entries = (isJsonArray(installs) ? installs : []).flatMap((install) => {
    return isJsonObject(install) ? [install] : [];
  });
  const forProject = entries.find((install) => {
    return stringAt(install, 'scope') === 'project' && stringAt(install, 'projectPath') === projectPath;
  });

  return forProject ?? entries.find((install) => {
    return stringAt(install, 'scope') === 'user';
  });
};

// Read from the files Claude Code maintains, so no subprocess is involved.
export const readClaudePlugins = async (
  projectPath: string,
  home = homedir(),
): Promise<readonly InstalledPlugin[]> => {
  const [installed, known, userSettings, projectSettings] = await Promise.all([
    readJson(join(home, '.claude', 'plugins', 'installed_plugins.json')),
    readJson(join(home, '.claude', 'plugins', 'known_marketplaces.json')),
    readJson(join(home, '.claude', 'settings.json')),
    readJson(join(projectPath, '.claude', 'settings.json')),
  ]);

  const enabled = {
    ...objectAt(userSettings, 'enabledPlugins'),
    ...objectAt(projectSettings, 'enabledPlugins'),
  };
  const marketplaces = new Set([
    ...Object.keys(isJsonObject(known) ? known : {}),
    ...Object.keys(objectAt(userSettings, 'extraKnownMarketplaces')),
    ...Object.keys(objectAt(projectSettings, 'extraKnownMarketplaces')),
  ]);

  return Object.entries(objectAt(installed, 'plugins')).flatMap(([id, installs]) => {
    const install = applicableInstall(installs, projectPath);
    const marketplace = id.split('@')[1];

    if (install == null || marketplace == null) {
      return [];
    }

    const scope: SetupScope = stringAt(install, 'scope') === 'project' ? 'project' : 'user';

    return [{
      id,
      marketplace,
      scope,
      enabled: enabled[id] === true,
      version: stringAt(install, 'version') ?? 'unknown',
      knownMarketplace: marketplaces.has(marketplace),
    }];
  }).sort((left, right) => {
    return left.id.localeCompare(right.id);
  });
};
