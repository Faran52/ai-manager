import { isAgentId } from '@config/agents';

import {
  listAgentProjects,
  listAgentSessions,
  managedAgents,
  pathsFor,
  readAgentSetup,
  readClaudePlugins,
  readProjectTrust,
  readProjectUsage,
  resolveAgentPaths,
  validateAgentSetup,
} from '@services/agents/agentsService';
import { searchAgentHistory } from '@services/search/searchService';
import {
  deleteProject,
  deleteSession,
  loadSessionPage,
  renameSession,
} from '@services/session/sessionService';
import { computeProjectStats } from '@services/stats/statsService';
import { checkForUpdate, updateConfigFromEnv } from '@services/updates';

import {
  clampLimit,
  clampOffset,
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from './apiHandler';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from '@services/agents/agentsService';
import type { UpdateConfig } from '@services/updates';
import type {
  AgentSetupBody,
  ListSessionsBody,
  LoadSessionBody,
  ProjectMutationBody,
  SearchBody,
  SessionMutationBody,
} from './contracts';

export interface EndpointDeps {
  readonly claudeDir?: string;
  readonly codexDir?: string;
  readonly home?: string;
}

export interface UpdateEndpointDeps {
  readonly config?: UpdateConfig | undefined;
  readonly updateDeps?: Parameters<typeof checkForUpdate>[1] | undefined;
}

const isAgent = (value: unknown): value is AgentId => {
  return typeof value === 'string' && isAgentId(value);
};

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

const isAgentSetupBody = (body: object): body is AgentSetupBody => {
  return 'projectPath' in body && typeof body.projectPath === 'string' && body.projectPath.length > 0;
};

const isSessionsBody = (body: object): body is ListSessionsBody => {
  return 'projectId' in body
    && typeof body.projectId === 'string'
    && body.projectId.length > 0
    && 'agent' in body
    && isAgent(body.agent);
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

/**
 * `home` overrides every agent root, not just the two named below. Without it a caller that pins
 * `claudeDir` still resolves the remaining agents against the real home, so a test reads whatever
 * history the developer's machine happens to hold and passes or fails on that.
 */
export const resolveEndpointRoots = (deps: EndpointDeps | undefined): AgentRoots => {
  const paths = resolveAgentPaths(deps?.home == null
    ? { env: process.env }
    : {
        env: process.env,
        home: deps.home,
      });

  if (deps == null) {
    return paths;
  }

  return {
    ...paths,
    claude: deps.claudeDir != null ? [deps.claudeDir] as const : paths.claude,
    codex: deps.codexDir != null ? [deps.codexDir] as const : paths.codex,
  };
};

const BAD_REQUEST = 400;
const NOT_FOUND = 404;

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

    const page = await loadSessionPage(parsed.filePath, {
      offset: clampOffset(parsed.offset),
      limit: clampLimit(parsed.limit),
      includeSidechain: parsed.includeSidechain === true,
    }, parsed.agent, pathsFor(resolveEndpointRoots(deps), parsed.agent));

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

export const handleDeleteSession = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const target = body == null ? undefined : parseMutationBody(body);

    if (target == null) {
      return jsonError(BAD_REQUEST, 'A valid session target is required.');
    }

    await deleteSession(resolveEndpointRoots(deps), target);

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

export const handleAgentSetup = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isAgentSetupBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty projectPath is required.');
    }

    const [setups, findings, usage, plugins, trust] = await Promise.all([
      Promise.all(managedAgents.map((agent) => {
        return readAgentSetup(agent, body.projectPath, deps?.home);
      })),
      validateAgentSetup(body.projectPath, deps?.home),
      readProjectUsage(body.projectPath, deps?.home),
      readClaudePlugins(body.projectPath, deps?.home),
      readProjectTrust(body.projectPath, deps?.home),
    ]);

    return jsonOk({
      setups,
      findings,
      usage: usage ?? null,
      plugins,
      trust,
    });
  });
};
