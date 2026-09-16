import { homedir } from 'node:os';
import { join } from 'node:path';

import { readJsonFile } from '@utils/jsonFileUtils';
import {
  isJsonArray,
  isJsonObject,
  objectAt,
  textAt,
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

// This project's install wins; one recorded for another project does not apply at all.
const applicableInstall = (installs: JsonValue, projectPath: string): JsonObject | undefined => {
  const entries = (isJsonArray(installs) ? installs : []).flatMap((install) => {
    return isJsonObject(install) ? [install] : [];
  });
  const forProject = entries.find((install) => {
    return textAt(install, 'scope') === 'project' && textAt(install, 'projectPath') === projectPath;
  });

  return forProject ?? entries.find((install) => {
    return textAt(install, 'scope') === 'user';
  });
};

// Read from the files Claude Code maintains, so no subprocess is involved.
export const readClaudePlugins = async (
  projectPath: string,
  home = homedir(),
  claudeDir = join(home, '.claude'),
): Promise<readonly InstalledPlugin[]> => {
  const [installed, known, userSettings, projectSettings] = await Promise.all([
    readJsonFile(join(claudeDir, 'plugins', 'installed_plugins.json')),
    readJsonFile(join(claudeDir, 'plugins', 'known_marketplaces.json')),
    readJsonFile(join(claudeDir, 'settings.json')),
    readJsonFile(join(projectPath, '.claude', 'settings.json')),
  ]);

  const enabled = {
    ...(objectAt(userSettings, 'enabledPlugins') ?? {}),
    ...(objectAt(projectSettings, 'enabledPlugins') ?? {}),
  };
  const marketplaces = new Set([
    ...Object.keys(isJsonObject(known) ? known : {}),
    ...Object.keys((objectAt(userSettings, 'extraKnownMarketplaces') ?? {})),
    ...Object.keys((objectAt(projectSettings, 'extraKnownMarketplaces') ?? {})),
  ]);

  const applicable = Object.entries((objectAt(installed, 'plugins') ?? {})).flatMap(([id, installs]) => {
    const install = applicableInstall(installs, projectPath);
    const marketplace = id.split('@')[1];

    if (install == null || marketplace == null) {
      return [];
    }

    const scope: SetupScope = textAt(install, 'scope') === 'project' ? 'project' : 'user';

    return [{
      id,
      marketplace,
      scope,
      enabled: enabled[id] === true,
      version: textAt(install, 'version') ?? 'unknown',
      knownMarketplace: marketplaces.has(marketplace),
    }];
  });

  return applicable.sort((left, right) => {
    return left.id.localeCompare(right.id);
  });
};
