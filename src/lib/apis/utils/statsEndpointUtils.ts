import { pathsFor } from '@services/agents/agentsService';
import { computeGlobalStats, computeProjectStats } from '@services/stats/statsService';

import {
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from '../apiHandler';
import { BAD_REQUEST } from '../constants';

import { isSessionsBody, resolveEndpointRoots } from './endpointDepsUtils';

import type { EndpointDeps } from './endpointDepsUtils';

export const handleProjectStats = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isSessionsBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty projectId is required.');
    }

    const roots = resolveEndpointRoots(deps);
    const stats = await computeProjectStats(pathsFor(roots, body.agent), body.projectId, body.agent);

    return jsonOk({ stats: stats ?? null });
  });
};

export const handleGlobalStats = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    return jsonOk({ stats: await computeGlobalStats(resolveEndpointRoots(deps)) });
  });
};
