import { readStorageReport, reclaimStorage } from '@services/storage/storageService';

import {
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from '../apiHandler';
import { BAD_REQUEST } from '../constants';

import type { ReclaimBody } from '../contracts';
import type { EndpointDeps } from './endpointDepsUtils';

const isReclaimBody = (body: object): body is ReclaimBody => {
  return 'paths' in body
    && Array.isArray(body.paths)
    && body.paths.length > 0
    && body.paths.every((path) => {
      return typeof path === 'string' && path.length > 0;
    });
};

export const handleStorageReport = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    return jsonOk(await readStorageReport(deps?.home == null
      ? { env: process.env }
      : {
          env: process.env,
          home: deps.home,
        }));
  });
};

export const handleReclaimStorage = async (
  request: Request,
  deps?: EndpointDeps,
): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isReclaimBody(body)) {
      return jsonError(BAD_REQUEST, 'At least one path is required.');
    }

    return jsonOk({
      result: await reclaimStorage(body.paths, deps?.home == null
        ? { env: process.env }
        : {
            env: process.env,
            home: deps.home,
          }),
    });
  });
};
