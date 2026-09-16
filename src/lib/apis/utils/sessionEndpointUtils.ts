import {
  listAgentProjects,
  listAgentSessions,
  pathsFor,
} from '@services/agents/agentsService';
import { archiveRoot } from '@services/archive/archiveService';
import { listRecentEdits } from '@services/edits/editsService';
import { readFileHistory, readVersionDiff } from '@services/file-history/fileHistoryService';
import { searchAgentHistory } from '@services/search/searchService';
import {
  deleteProject,
  deleteSession,
  loadSessionPage,
  renameSession,
} from '@services/session/sessionService';

import {
  clampLimit,
  clampOffset,
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from '../apiHandler';
import { BAD_REQUEST, NOT_FOUND } from '../constants';

import {
  isAgent,
  isSessionsBody,
  resolveEndpointRoots,
} from './endpointDepsUtils';

import type {
  FileHistoryBody,
  LoadSessionBody,
  ProjectMutationBody,
  RecentEditsBody,
  SearchBody,
  SessionMutationBody,
} from '../contracts';
import type { EndpointDeps } from './endpointDepsUtils';

const parseMutationBody = (body: object): SessionMutationBody | undefined => {
  if (!('agent' in body) || !isAgent(body.agent)
    || !('filePath' in body) || typeof body.filePath !== 'string' || body.filePath.length === 0
    || !('actualSessionId' in body)
    || typeof body.actualSessionId !== 'string'
    || body.actualSessionId.length === 0) {
    return undefined;
  }

  return {
    agent: body.agent,
    filePath: body.filePath,
    actualSessionId: body.actualSessionId,
  };
};

const parseProjectMutationBody = (body: object): ProjectMutationBody | undefined => {
  if (!('agent' in body) || !isAgent(body.agent)
    || !('projectId' in body) || typeof body.projectId !== 'string' || body.projectId.length === 0) {
    return undefined;
  }

  return {
    agent: body.agent,
    projectId: body.projectId,
  };
};

const isRecentEditsBody = (body: object): body is RecentEditsBody => {
  if ('projectId' in body && typeof body.projectId !== 'string') {
    return false;
  }

  return !('agent' in body) || isAgent(body.agent);
};

const isFileHistoryBody = (body: object): body is FileHistoryBody => {
  if ('version' in body && typeof body.version !== 'number') {
    return false;
  }

  return 'sessionId' in body
    && typeof body.sessionId === 'string'
    && body.sessionId.length > 0
    && 'path' in body
    && typeof body.path === 'string'
    && body.path.length > 0;
};

const isSearchBody = (body: object): body is SearchBody => {
  if (!('query' in body) || typeof body.query !== 'string') {
    return false;
  }

  return !('projectId' in body) || typeof body.projectId === 'string';
};

export const parseLoadSessionBody = (body: object): LoadSessionBody | undefined => {
  if (!('filePath' in body) || typeof body.filePath !== 'string' || body.filePath.length === 0) {
    return undefined;
  }

  const offset = 'offset' in body && typeof body.offset === 'number' ? body.offset : undefined;
  const limit = 'limit' in body && typeof body.limit === 'number' ? body.limit : undefined;
  const includeSidechain = 'includeSidechain' in body && body.includeSidechain === true;
  const agent = 'agent' in body && isAgent(body.agent) ? body.agent : undefined;

  return agent == null
    ? undefined
    : {
        filePath: body.filePath,
        agent,
        offset,
        limit,
        includeSidechain,
      };
};

export const handleListProjects = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    return jsonOk({ projects: await listAgentProjects(resolveEndpointRoots(deps)) });
  });
};

export const handleListSessions = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isSessionsBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty projectId is required.');
    }

    return jsonOk({ sessions: await listAgentSessions(resolveEndpointRoots(deps), body.agent, body.projectId) });
  });
};

export const handleLoadSession = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const parsed = body != null ? parseLoadSessionBody(body) : undefined;

    if (parsed == null) {
      return jsonError(BAD_REQUEST, 'A non-empty filePath is required.');
    }

    // The archive root joins the agent's own roots so a transcript the agent has
    // since deleted still opens in the viewer from its backup.
    const page = await loadSessionPage(parsed.filePath, {
      offset: clampOffset(parsed.offset),
      limit: clampLimit(parsed.limit),
      includeSidechain: parsed.includeSidechain === true,
    }, parsed.agent, [
      ...pathsFor(resolveEndpointRoots(deps), parsed.agent),
      archiveRoot(deps?.home),
    ]);

    if (page == null) {
      return jsonError(NOT_FOUND, 'Session file not found.');
    }

    return jsonOk(page);
  });
};

export const handleSearch = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isSearchBody(body)) {
      return jsonError(BAD_REQUEST, 'A query string is required.');
    }

    return jsonOk(await searchAgentHistory(resolveEndpointRoots(deps), body.query, body.projectId));
  });
};

export const handleRecentEdits = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isRecentEditsBody(body)) {
      return jsonError(BAD_REQUEST, 'A projectId must be a string and an agent must be known.');
    }

    return jsonOk({
      files: await listRecentEdits(resolveEndpointRoots(deps), body.agent, body.projectId),
    });
  });
};

export const handleFileHistory = async (
  request: Request,
  deps?: EndpointDeps,
): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isFileHistoryBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty sessionId and path are required.');
    }

    const history = await readFileHistory(body.sessionId, body.path, deps?.home);
    const wanted = body.version ?? history.versions.at(-1)?.version;

    return jsonOk({
      history,
      diff: wanted == null
        ? null
        : await readVersionDiff(body.sessionId, body.path, wanted, deps?.home) ?? null,
    });
  });
};

export const handleDeleteSession = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const target = body == null ? undefined : parseMutationBody(body);

    if (target == null) {
      return jsonError(BAD_REQUEST, 'A valid session target is required.');
    }

    await deleteSession(resolveEndpointRoots(deps), target, deps?.home);

    return jsonOk({ ok: true });
  });
};

export const handleDeleteProject = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const target = body == null ? undefined : parseProjectMutationBody(body);

    if (target == null) {
      return jsonError(BAD_REQUEST, 'A valid project target is required.');
    }

    await deleteProject(resolveEndpointRoots(deps), target);

    return jsonOk({ ok: true });
  });
};

export const handleRenameSession = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const target = body == null ? undefined : parseMutationBody(body);
    const title = body != null && 'title' in body && typeof body.title === 'string' ? body.title : undefined;

    if (target == null || title == null) {
      return jsonError(BAD_REQUEST, 'A valid session target and title are required.');
    }

    await renameSession(resolveEndpointRoots(deps), target, title);

    return jsonOk({ ok: true });
  });
};
