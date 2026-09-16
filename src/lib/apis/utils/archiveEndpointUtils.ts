import { sumBy } from 'es-toolkit';

import {
  createArchive,
  deleteArchive,
  listArchives,
  readArchive,
} from '@services/archive/archiveService';
import {
  dueForArchive,
  readRetentionPolicy,
  runRetention,
  writeRetentionPolicy,
} from '@services/retention/retentionService';

import {
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from '../apiHandler';
import { BAD_REQUEST, NOT_FOUND } from '../constants';

import {
  isAgent,
  isRuleList,
  resolveEndpointRoots,
} from './endpointDepsUtils';

import type {
  ArchiveBody,
  CreateArchiveBody,
  WriteRetentionBody,
} from '../contracts';
import type { EndpointDeps } from './endpointDepsUtils';

const isArchiveBody = (body: object): body is ArchiveBody => {
  return 'id' in body && typeof body.id === 'string' && body.id.length > 0;
};

const isCreateArchiveBody = (body: object): body is CreateArchiveBody => {
  if ('note' in body && typeof body.note !== 'string') {
    return false;
  }

  return !('sessionKeys' in body) || isRuleList(body.sessionKeys);
};

const isWriteRetentionBody = (body: object): body is WriteRetentionBody => {
  if (!('policy' in body) || typeof body.policy !== 'object' || body.policy === null) {
    return false;
  }

  const { policy } = body;

  return 'enabled' in policy && typeof policy.enabled === 'boolean'
    && 'olderThanDays' in policy && typeof policy.olderThanDays === 'number'
    && Number.isInteger(policy.olderThanDays) && policy.olderThanDays >= 1
    && 'agents' in policy && Array.isArray(policy.agents) && policy.agents.every(isAgent);
};

export const handleListArchives = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    return jsonOk({ archives: await listArchives(deps?.home) });
  });
};

export const handleReadArchive = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isArchiveBody(body)) {
      return jsonError(BAD_REQUEST, 'An archive id is required.');
    }

    return jsonOk({ archive: await readArchive(body.id, deps?.home) ?? null });
  });
};

export const handleCreateArchive = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isCreateArchiveBody(body)) {
      return jsonError(BAD_REQUEST, 'A note must be text.');
    }

    const manifest = await createArchive(
      resolveEndpointRoots(deps),
      body.note ?? '',
      deps?.home,
      body.sessionKeys == null ? undefined : new Set(body.sessionKeys),
    );

    return jsonOk({
      archive: {
        id: manifest.id,
        createdMs: manifest.createdMs,
        note: manifest.note,
        sessionCount: manifest.sessions.length,
        sizeBytes: sumBy(manifest.sessions, (session) => {
          return session.sizeBytes;
        }),
        agents: [...new Set(manifest.sessions.map((session) => {
          return session.agent;
        }))],
      },
    });
  });
};

export const handleDeleteArchive = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isArchiveBody(body)) {
      return jsonError(BAD_REQUEST, 'An archive id is required.');
    }

    if (!await deleteArchive(body.id, deps?.home)) {
      return jsonError(NOT_FOUND, 'No such archive.');
    }

    return jsonOk({ ok: true });
  });
};

export const handleRetentionStatus = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const policy = await readRetentionPolicy(deps?.home);

    return jsonOk({
      policy,
      due: await dueForArchive(resolveEndpointRoots(deps), policy, deps?.home),
    });
  });
};

export const handleWriteRetention = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isWriteRetentionBody(body)) {
      return jsonError(BAD_REQUEST, 'A valid retention policy is required.');
    }

    const policy = await writeRetentionPolicy(body.policy, deps?.home);

    return jsonOk({
      policy,
      due: await dueForArchive(resolveEndpointRoots(deps), policy, deps?.home),
    });
  });
};

export const handleRunRetention = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    return jsonOk({ result: await runRetention(resolveEndpointRoots(deps), deps?.home) });
  });
};
