import { appConfig } from '@config/appConfig';

import type { UpdateConfig } from './types';

// The release feed is optional, a build without one simply never offers updates.
export const updateConfigFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): UpdateConfig | undefined => {
  const baseUrl = env.UPDATE_FEED_URL;

  if (baseUrl == null || baseUrl.length === 0) {
    return undefined;
  }

  return {
    baseUrl,
    currentVersion: appConfig.version,
    publicKey: env.UPDATE_PUBLIC_KEY,
  };
};
