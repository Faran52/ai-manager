import { checkForUpdate, updateConfigFromEnv } from '@services/updates';

import { jsonOk, withJsonErrors } from '../apiHandler';

import type { UpdateEndpointDeps } from './endpointDepsUtils';

// Resolved in the default rather than the body, so passing `config: undefined`
// means "no feed" instead of falling through to whatever the build baked in.
export const handleUpdateCheck = (
  deps: UpdateEndpointDeps = { config: updateConfigFromEnv() },
): Promise<Response> => {
  return withJsonErrors(async () => {
    const { config } = deps;

    if (config == null) {
      return jsonOk({ update: { stage: 'unsupported' } });
    }

    return jsonOk({ update: await checkForUpdate(config, deps.updateDeps) });
  });
};
