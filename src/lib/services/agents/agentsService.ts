import { readFile } from 'node:fs/promises';

import { agentOption, agentOptions } from '@config/agents';

import { containedIn } from '@utils/pathUtils';

import {
  listAntigravityProjects,
  listAntigravitySessions,
  loadAntigravityEntries,
} from '../history/utils/antigravityUtils';
import { listProjects, listSessions } from '../history/utils/claudeUtils';
import {
  listCodexProjects,
  listCodexSessions,
  parseCodexHistory,
} from '../history/utils/codexUtils';
import {
  listCopilotProjects,
  listCopilotSessions,
  loadCopilotEntries,
} from '../history/utils/copilotUtils';
import {
  listGeminiProjects,
  listGeminiSessions,
  loadGeminiEntries,
} from '../history/utils/geminiUtils';
import {
  listOpenCodeProjects,
  listOpenCodeSessions,
  loadOpenCodeEntries,
} from '../history/utils/openCodeUtils';
import {
  listOpenHandsProjects,
  listOpenHandsSessions,
  loadOpenHandsEntries,
} from '../history/utils/openHandsUtils';
import {
  listSqliteProjects,
  listSqliteSessions,
  loadSqliteEntries,
} from '../history/utils/sqliteUtils';
import {
  listStructuredProjects,
  listStructuredSessions,
  loadStructuredEntries,
} from '../history/utils/structuredUtils';
import { withRepoRoots } from '../history/utils/worktreeUtils';
import { parseHistoryLine } from '../session/utils/parserUtils';

import { compareProjects } from './utils/orderUtils';
import {
  CLAUDE_HOME_NAME,
  CODEX_HOME_NAME,
  rootProfileLabel,
} from './utils/rootsUtils';

import type { AgentId, AgentOption } from '@config/agents';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '../history/types';
import type { AgentPathMap } from './utils/rootsUtils';

export type AgentRoots = AgentPathMap;

interface FormatRoutes {
  readonly projects: (
    agent: AgentId,
    paths: readonly string[],
  ) => Promise<readonly ProjectSummary[]>;
  readonly sessions: (
    agent: AgentId,
    paths: readonly string[],
    projectId?: string,
  ) => Promise<readonly SessionSummary[]>;
  readonly entries: (
    filePath: string,
    allowedRoots: readonly string[],
  ) => Promise<readonly HistoryEntry[] | undefined>;
}

export { managedAgents } from './constants';
export type {
  AgentBinaryResolver,
  AgentBinaryRunner,
  AgentInstallCommand,
  AgentInstallInfo,
} from './utils/installUtils';
export {
  AGENT_INSTALLS,
  checkAgentInstalled,
  installableAgents,
  installCommandText,
  runAgentInstall,
} from './utils/installUtils';
export type { ModelAuthState } from './utils/modelAuthUtils';
export type {
  PluginActionName,
  PluginActionRequest,
} from './utils/pluginActionsUtils';
export { runPluginAction } from './utils/pluginActionsUtils';
export type {
  PluginCostAttribution,
  PluginCostEstimate,
} from './utils/pluginCostUtils';
export {
  attributePluginCosts,
  readPluginCosts,
} from './utils/pluginCostUtils';
export type { InstalledPlugin } from './utils/pluginsUtils';
export { readClaudePlugins } from './utils/pluginsUtils';
export type {
  AgentPathMap,
  RootResolutionOptions,
} from './utils/rootsUtils';
export { resolveAgentPaths } from './utils/rootsUtils';
export type {
  AgentSetup,
  McpServerSummary,
  RulesFileSummary,
  SetupScope,
} from './utils/setupUtils';
export {
  hasAgentSetup,
  readAgentSetup,
} from './utils/setupUtils';
export type {
  ModelCost,
  ModelUsage,
  ProjectTrust,
  ProjectUsage,
} from './utils/usageUtils';
export {
  readBlendedRate,
  readModelCosts,
  readProjectTrust,
  readProjectUsage,
} from './utils/usageUtils';
export type { SetupFinding } from './utils/validationUtils';
export { validateAgentSetup } from './utils/validationUtils';

export const pathsFor = (roots: AgentRoots, agent: AgentId): readonly string[] => {
  return roots[agent];
};

const PROFILE_HOME_NAME: Partial<Record<AgentId, string>> = {
  claude: CLAUDE_HOME_NAME,
  codex: CODEX_HOME_NAME,
};

// A caller holding one project or session own .profile wants just the root it
// came from, or a project id colliding across two profiles is counted twice.
export const pathsForProfile = (
  roots: AgentRoots,
  agent: AgentId,
  profile: string | undefined,
): readonly string[] => {
  const homeName = PROFILE_HOME_NAME[agent];

  if (homeName == null) {
    return pathsFor(roots, agent);
  }

  return pathsFor(roots, agent).filter((root) => {
    return rootProfileLabel(root, homeName) === profile;
  });
};

const PROJECT_ID_PATTERN = /^[^/\\]+$/u;

const withProjectAgent = (agent: AgentId, project: ProjectSummary, profile?: string): ProjectSummary => {
  return {
    ...project,
    agent,
    profile,
  };
};

const withSessionAgent = (agent: AgentId, session: SessionSummary, profile?: string): SessionSummary => {
  return {
    ...session,
    agent,
    profile,
  };
};

// Claude and Codex keep one root per profile, so a root's listings are tagged with
// its profile label before the merge. Every other format has one root and none.
const perRootWithProfile = async <T>(
  agent: AgentId,
  paths: readonly string[],
  list: (path: string) => Promise<readonly T[]>,
  tag: (agent: AgentId, item: T, profile?: string) => T,
): Promise<readonly T[]> => {
  const homeName = PROFILE_HOME_NAME[agent] ?? '';
  const perPath = await Promise.all(paths.map(async (path) => {
    const profile = rootProfileLabel(path, homeName);

    return (await list(path)).map((item) => {
      return tag(agent, item, profile);
    });
  }));

  return perPath.flat();
};

const sessionsUnder = (
  list: (path: string, id: string) => Promise<readonly SessionSummary[]>,
  ids: readonly string[],
) => {
  return async (path: string): Promise<readonly SessionSummary[]> => {
    return (await Promise.all(ids.map((id) => {
      return list(path, id);
    }))).flat();
  };
};

const claudeRoutes: FormatRoutes = {
  projects: (agent, paths) => {
    return perRootWithProfile(agent, paths, listProjects, withProjectAgent);
  },
  sessions: async (agent, paths, projectId) => {
    if (projectId != null && !PROJECT_ID_PATTERN.test(projectId)) {
      return [];
    }

    const allIds = projectId == null
      ? (await claudeRoutes.projects(agent, paths)).map((project) => {
          return project.id;
        })
      : [projectId];

    return perRootWithProfile(agent, paths, sessionsUnder(listSessions, allIds), withSessionAgent);
  },
  entries: async (filePath, allowedRoots) => {
    if (!await containedIn(allowedRoots, filePath)) {
      return undefined;
    }

    try {
      return (await readFile(filePath, 'utf8')).split('\n').flatMap((line) => {
        const entry = parseHistoryLine(line);

        return entry == null ? [] : [entry];
      });
    }
    catch {
      return undefined;
    }
  },
};

const codexRoutes: FormatRoutes = {
  projects: (agent, paths) => {
    return perRootWithProfile(agent, paths, listCodexProjects, withProjectAgent);
  },
  sessions: async (agent, paths, projectId) => {
    const ids = projectId == null
      ? (await codexRoutes.projects(agent, paths)).map((project) => {
          return project.id;
        })
      : [projectId];

    return perRootWithProfile(agent, paths, sessionsUnder(listCodexSessions, ids), withSessionAgent);
  },
  entries: async (filePath, allowedRoots) => {
    if (!await containedIn(allowedRoots, filePath)) {
      return undefined;
    }

    try {
      return parseCodexHistory(await readFile(filePath, 'utf8')).entries;
    }
    catch {
      return undefined;
    }
  },
};

const structuredEntries = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  if (!await containedIn(allowedRoots, filePath)) {
    return undefined;
  }

  return loadStructuredEntries(filePath);
};

const antigravityEntries = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  if (!await containedIn(allowedRoots, filePath)) {
    return undefined;
  }

  return loadAntigravityEntries(filePath);
};

const geminiEntries = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  if (!await containedIn(allowedRoots, filePath)) {
    return undefined;
  }

  return loadGeminiEntries(filePath);
};

const copilotEntries = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  if (!await containedIn(allowedRoots, filePath)) {
    return undefined;
  }

  return loadCopilotEntries(filePath);
};

const ROUTES_BY_FORMAT: Record<AgentOption['format'], FormatRoutes> = {
  claude: claudeRoutes,
  codex: codexRoutes,
  files: {
    projects: listStructuredProjects,
    sessions: listStructuredSessions,
    entries: structuredEntries,
  },
  copilot: {
    projects: listCopilotProjects,
    sessions: listCopilotSessions,
    entries: copilotEntries,
  },
  antigravity: {
    projects: listAntigravityProjects,
    sessions: listAntigravitySessions,
    entries: antigravityEntries,
  },
  gemini: {
    projects: listGeminiProjects,
    sessions: listGeminiSessions,
    entries: geminiEntries,
  },
  sqlite: {
    projects: listSqliteProjects,
    sessions: listSqliteSessions,
    entries: loadSqliteEntries,
  },
  opencode: {
    projects: listOpenCodeProjects,
    sessions: listOpenCodeSessions,
    entries: loadOpenCodeEntries,
  },
  openhands: {
    projects: listOpenHandsProjects,
    sessions: listOpenHandsSessions,
    entries: loadOpenHandsEntries,
  },
  grok: {
    projects: listStructuredProjects,
    sessions: listStructuredSessions,
    entries: structuredEntries,
  },
};

const routesFor = (agent: AgentId): FormatRoutes => {
  return ROUTES_BY_FORMAT[agentOption(agent).format];
};

export const listAgentProjects = async (roots: AgentRoots): Promise<readonly ProjectSummary[]> => {
  const projects = await Promise.all(agentOptions.map(async (option) => {
    return routesFor(option.id).projects(option.id, roots[option.id]);
  }));

  // Worktrees are resolved once over the merged list rather than in each of the
  // readers, which all report a folder without knowing what owns it.
  const tagged = await withRepoRoots(projects.flat());

  return [...tagged].sort(compareProjects);
};

/*
 * The newest sessions across every project on the machine. Capped because this
 * answers "what has been happening lately", drawn as one square per session.
 */
export const listNewestSessions = async (
  roots: AgentRoots,
  limit: number,
): Promise<readonly SessionSummary[]> => {
  const projects = await listAgentProjects(roots);
  const found = await Promise.all(projects.map(async (project) => {
    return routesFor(project.agent).sessions(project.agent, roots[project.agent], project.id);
  }));

  const newestFirst = found.flat().sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });

  return newestFirst.slice(0, limit);
};

export const listAgentSessions = async (
  roots: AgentRoots,
  agent: AgentId,
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  return routesFor(agent).sessions(agent, roots[agent], projectId);
};

export const loadAgentEntries = async (
  filePath: string,
  agent: AgentId,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  return routesFor(agent).entries(filePath, allowedRoots);
};
