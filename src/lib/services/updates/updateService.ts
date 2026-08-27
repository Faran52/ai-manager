import { parseUpdateManifest } from './utils/manifestUtils';
import { compareVersions } from './utils/versionUtils';

import type {
  UpdateConfig,
  UpdateManifest,
  UpdatePlatform,
  UpdateState,
} from './types';

export interface UpdateDeps {
  readonly fetch?: typeof globalThis.fetch | undefined;
  readonly platform?: UpdatePlatform | undefined;
}

const IDLE: UpdateState = { stage: 'idle' };

let state: UpdateState = IDLE;

export const updateState = (): UpdateState => {
  return state;
};

export const resetUpdateState = (): void => {
  state = IDLE;
};

const runtimePlatform = (deps: UpdateDeps): UpdatePlatform | undefined => {
  if (deps.platform != null) {
    return deps.platform;
  }

  const os = (globalThis as { Deno?: { build?: { os?: string } } }).Deno?.build?.os;

  if (os === 'darwin' || os === 'linux' || os === 'windows') {
    return os;
  }

  return undefined;
};

const fetchManifest = async (
  config: UpdateConfig,
  deps: UpdateDeps,
): Promise<UpdateManifest | undefined> => {
  const request = deps.fetch ?? globalThis.fetch;
  const response = await request(`${config.baseUrl}/latest.json`);

  if (!response.ok) {
    return undefined;
  }

  return parseUpdateManifest(await response.text(), config.publicKey);
};

export const checkForUpdate = async (
  config: UpdateConfig,
  deps: UpdateDeps = {},
): Promise<UpdateState> => {
  const platform = runtimePlatform(deps);

  if (platform == null) {
    state = { stage: 'unsupported' };

    return state;
  }

  try {
    const manifest = await fetchManifest(config, deps);
    const artifact = manifest?.artifacts[platform];

    if (manifest == null || artifact == null) {
      state = IDLE;

      return state;
    }

    if (compareVersions(manifest.version, config.currentVersion) <= 0) {
      state = IDLE;

      return state;
    }

    state = {
      stage: 'available',
      version: manifest.version,
      notes: manifest.notes,
      artifactPath: `${config.baseUrl}/${artifact.name}`,
    };

    return state;
  }
  catch (error) {
    state = {
      stage: 'idle',
      reason: String(error),
    };

    return state;
  }
};
