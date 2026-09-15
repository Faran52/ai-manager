import { sumBy } from 'es-toolkit';

import { isAgentId } from '@config/agents';

import {
  attributePluginCosts,
  checkAgentInstalled,
  installableAgents,
  installCommandText,
  listAgentProjects,
  listAgentSessions,
  managedAgents,
  pathsFor,
  pathsForProfile,
  readAgentSetup,
  readBlendedRate,
  readClaudePlugins,
  readPluginCosts,
  readProjectTrust,
  readProjectUsage,
  resolveAgentPaths,
  runAgentInstall,
  runPluginAction,
  validateAgentSetup,
} from '@services/agents/agentsService';
import {
  archiveRoot,
  createArchive,
  deleteArchive,
  listArchives,
  readArchive,
} from '@services/archive/archiveService';
import { listRecentEdits } from '@services/edits/editsService';
import { readFileHistory, readVersionDiff } from '@services/file-history/fileHistoryService';
import {
  dueForArchive,
  readRetentionPolicy,
  runRetention,
  writeRetentionPolicy,
} from '@services/retention/retentionService';
import { searchAgentHistory } from '@services/search/searchService';
import {
  deleteProject,
  deleteSession,
  loadSessionPage,
  renameSession,
} from '@services/session/sessionService';
import {
  isSettingsScope,
  readAgentSettings,
  writeScopeSettings,
} from '@services/settings/settingsService';
import { computeGlobalStats, computeProjectStats } from '@services/stats/statsService';
import { readStorageReport, reclaimStorage } from '@services/storage/storageService';
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
import type {
  AgentBinaryResolver,
  AgentBinaryRunner,
  AgentRoots,
  PluginActionName,
  PluginActionRequest,
  SetupScope,
} from '@services/agents/agentsService';
import type { EnvEntry } from '@services/settings/settingsService';
import type { UpdateConfig } from '@services/updates';
import type {
  AgentInstallBody,
  AgentSetupBody,
  ArchiveBody,
  CreateArchiveBody,
  FileHistoryBody,
  ListSessionsBody,
  LoadSessionBody,
  ProjectMutationBody,
  RecentEditsBody,
  ReclaimBody,
  SearchBody,
  SessionMutationBody,
  SettingsBody,
  WriteRetentionBody,
  WriteSettingsBody,
} from './contracts';

export interface EndpointDeps {
  readonly claudeDir?: string;
  readonly codexDir?: string;
  readonly home?: string;
  readonly pluginAction?: Parameters<typeof runPluginAction>[1];
  readonly pluginDetails?: Parameters<typeof readPluginCosts>[1];
  readonly agentInstallCheck?: AgentBinaryResolver;
  readonly agentInstall?: AgentBinaryRunner;
}

export interface UpdateEndpointDeps {
  readonly config?: UpdateConfig | undefined;
  readonly updateDeps?: Parameters<typeof checkForUpdate>[1] | undefined;
}

interface ProfileScoped {
  readonly profile?: string | undefined;
}

// The request plus the profile it names, resolved to a config dir by the handler.
type PluginActionInput = PluginActionRequest & ProfileScoped;

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

const isReclaimBody = (body: object): body is ReclaimBody => {
  return 'paths' in body
    && Array.isArray(body.paths)
    && body.paths.length > 0
    && body.paths.every((path) => {
      return typeof path === 'string' && path.length > 0;
    });
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

const isArchiveBody = (body: object): body is ArchiveBody => {
  return 'id' in body && typeof body.id === 'string' && body.id.length > 0;
};

const isCreateArchiveBody = (body: object): body is CreateArchiveBody => {
  if ('note' in body && typeof body.note !== 'string') {
    return false;
  }

  return !('sessionKeys' in body) || isRuleList(body.sessionKeys);
};

const isSettingsBody = (body: object): body is SettingsBody => {
  if (!('projectPath' in body) || typeof body.projectPath !== 'string') {
    return false;
  }

  // Absent means Claude, which is what every caller meant before the picker.
  // Parsed JSON never yields undefined, so a present key must name an agent.
  return (!('agent' in body) || isAgent(body.agent))
    && (!('profile' in body) || typeof body.profile === 'string');
};

/**
 * The config dir behind a profile-scoped request: the one Claude root whose
 * profile label matches. No profile means the default root, which every
 * reader and the CLI already assume, so nothing is passed down.
 */
const claudeDirFor = (
  body: ProfileScoped,
  deps: EndpointDeps | undefined,
): string | undefined => {
  return body.profile == null
    ? undefined
    : pathsForProfile(resolveEndpointRoots(deps), 'claude', body.profile)[0];
};

// Parsed JSON never yields undefined, so a present profile must be a string.
const profileOf = (body: object): string | undefined => {
  return 'profile' in body && typeof body.profile === 'string' ? body.profile : undefined;
};

const isRuleList = (value: unknown): value is readonly string[] => {
  return Array.isArray(value) && value.every((entry) => {
    return typeof entry === 'string';
  });
};

const isEnvEntry = (value: unknown): value is EnvEntry => {
  return typeof value === 'object' && value !== null
    && 'name' in value && typeof value.name === 'string'
    && 'value' in value && typeof value.value === 'string';
};

const isWriteSettingsBody = (body: object): body is WriteSettingsBody => {
  if (!isSettingsBody(body)
    || !('scope' in body) || typeof body.scope !== 'string' || !isSettingsScope(body.scope)
    || !('patch' in body) || typeof body.patch !== 'object' || body.patch === null) {
    return false;
  }

  const { patch } = body;

  if (!('permissions' in patch) || typeof patch.permissions !== 'object' || patch.permissions === null
    || !('env' in patch) || !Array.isArray(patch.env)) {
    return false;
  }

  const { permissions } = patch;
  const lists = ['allow', 'deny', 'ask', 'additionalDirectories'];

  return lists.every((key) => {
    return key in permissions && isRuleList(Reflect.get(permissions, key));
  }) && patch.env.every(isEnvEntry);
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

export const handleReadSettings = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isSettingsBody(body)) {
      return jsonError(BAD_REQUEST, 'A project path is required.');
    }

    return jsonOk({
      scopes: await readAgentSettings(
        body.agent ?? 'claude',
        body.projectPath,
        deps?.home,
        claudeDirFor(body, deps),
      ),
    });
  });
};

export const handleWriteSettings = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isWriteSettingsBody(body)) {
      return jsonError(BAD_REQUEST, 'A scope and a complete settings patch are required.');
    }

    // Every scope but the user one is written inside a project, so a request
    // without one is asking for a file with no place to live.
    if (body.scope !== 'user' && body.projectPath.length === 0) {
      return jsonError(BAD_REQUEST, 'Select a project before editing its settings.');
    }

    return jsonOk({
      scope: await writeScopeSettings(
        body.scope,
        body.projectPath,
        body.patch,
        deps?.home,
        body.agent ?? 'claude',
        claudeDirFor(body, deps),
      ),
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

export const handleAgentSetup = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isAgentSetupBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty projectPath is required.');
    }

    /*
     * One Claude card per config dir (~/.claude, ~/.claude-personal, ...):
     * each keeps its own rules, MCP servers and settings. Plugins, usage
     * and trust stay facts about the default root.
     */
    const perDir = (agent: AgentId): readonly (string | undefined)[] => {
      return agent === 'claude' ? pathsFor(resolveEndpointRoots(deps), agent) : [undefined];
    };
    const [setups, findings, usage, plugins, trust] = await Promise.all([
      Promise.all(managedAgents.flatMap((agent) => {
        return perDir(agent).map((claudeDir) => {
          return readAgentSetup(agent, body.projectPath, deps?.home, claudeDir);
        });
      })),
      Promise.all(managedAgents.flatMap((agent) => {
        return perDir(agent).map((claudeDir) => {
          return validateAgentSetup(agent, body.projectPath, deps?.home, claudeDir);
        });
      })),
      readProjectUsage(body.projectPath, deps?.home),
      readClaudePlugins(body.projectPath, deps?.home),
      readProjectTrust(body.projectPath, deps?.home),
    ]);

    return jsonOk({
      setups,
      findings: findings.flat(),
      usage: usage ?? null,
      plugins,
      trust,
    });
  });
};

const isPluginActionName = (value: unknown): value is PluginActionName => {
  return value === 'install' || value === 'enable' || value === 'disable';
};

const isSetupScope = (value: unknown): value is SetupScope => {
  return value === 'user' || value === 'project';
};

const parsePluginActionBody = (body: object): PluginActionInput | undefined => {
  if (!('action' in body) || !isPluginActionName(body.action)
    || !('plugin' in body) || typeof body.plugin !== 'string'
    || body.plugin.length === 0 || /\s/u.test(body.plugin)
    || !('scope' in body) || !isSetupScope(body.scope)
    || !('projectPath' in body) || typeof body.projectPath !== 'string' || body.projectPath.length === 0) {
    return undefined;
  }

  return {
    action: body.action,
    plugin: body.plugin,
    scope: body.scope,
    projectPath: body.projectPath,
    profile: profileOf(body),
  };
};

export const handlePluginAction = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const target = body == null ? undefined : parsePluginActionBody(body);

    if (target == null) {
      return jsonError(BAD_REQUEST, 'A valid plugin action is required.');
    }

    const result = await runPluginAction({
      ...target,
      home: deps?.home,
      claudeDir: claudeDirFor(target, deps),
    }, deps?.pluginAction);

    if (!result.ok) {
      return jsonError(502, result.output.length > 0 ? result.output : 'The Claude CLI rejected the plugin action.');
    }

    return jsonOk({ ok: true });
  });
};

export const handlePluginCosts = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isAgentSetupBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty projectPath is required.');
    }

    const claudeDir = claudeDirFor({ profile: profileOf(body) }, deps);
    const [plugins, usage, blendedRate] = await Promise.all([
      readClaudePlugins(body.projectPath, deps?.home, claudeDir),
      readProjectUsage(body.projectPath, deps?.home),
      readBlendedRate(deps?.home),
    ]);
    const estimates = await readPluginCosts({
      plugins,
      home: deps?.home,
      claudeDir,
    }, deps?.pluginDetails);

    return jsonOk({ costs: attributePluginCosts(usage, estimates, blendedRate) });
  });
};

/*
 * Whether a CLI is on PATH is a fact about this machine, not about whichever
 * project happens to be selected, so this checks every installable agent at
 * once rather than taking a projectPath the way the setup endpoints do.
 */
export const handleAgentInstallCheck = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const entries = await Promise.all(installableAgents.map(async (agent) => {
      return [agent, {
        installed: await checkAgentInstalled(agent, deps?.agentInstallCheck),
        /**
         * installableAgents is built from AGENT_INSTALLS' own keys, so every
         * entry here always has a command; the fallback exists only because
         * installCommandText's signature admits any AgentId, not just these.
         */
        /* v8 ignore next */
        command: installCommandText(agent) ?? '',
      }] as const;
    }));

    return jsonOk({ agents: Object.fromEntries(entries) });
  });
};

const parseAgentInstallBody = (body: object): AgentInstallBody | undefined => {
  if (!('agent' in body) || !isAgent(body.agent) || !installableAgents.includes(body.agent)) {
    return undefined;
  }

  return { agent: body.agent };
};

export const handleAgentInstall = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);
    const target = body == null ? undefined : parseAgentInstallBody(body);

    if (target == null) {
      return jsonError(BAD_REQUEST, 'A supported agent is required.');
    }

    const result = await runAgentInstall(target.agent, deps?.agentInstall);

    if (!result.ok) {
      return jsonError(502, result.output.length > 0 ? result.output : 'The install command failed.');
    }

    return jsonOk({ ok: true });
  });
};

export const handleGlobalStats = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    return jsonOk({ stats: await computeGlobalStats(resolveEndpointRoots(deps)) });
  });
};
