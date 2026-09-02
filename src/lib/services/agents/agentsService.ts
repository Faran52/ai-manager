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
  listSqliteProjects,
  listSqliteSessions,
  loadSqliteEntries,
} from '../history/utils/sqliteUtils';
import {
  listStructuredProjects,
  listStructuredSessions,
  loadStructuredEntries,
} from '../history/utils/structuredUtils';
import { parseHistoryLine } from '../session/utils/parserUtils';

import { compareProjects } from './utils/orderUtils';

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

const PROJECT_ID_PATTERN = /^[^/\\]+$/u;

const withProjectAgent = (agent: AgentId, project: ProjectSummary): ProjectSummary => {
  return {
    ...project,
    agent,
  };
};

const withSessionAgent = (agent: AgentId, session: SessionSummary): SessionSummary => {
  return {
    ...session,
    agent,
  };
};

const claudeRoutes: FormatRoutes = {
  projects: async (agent, paths) => {
    return (await Promise.all(paths.map(listProjects))).flat().map((project) => {
      return withProjectAgent(agent, project);
    });
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

    return (await Promise.all(paths.flatMap((path) => {
      return allIds.map(async (id) => {
        return listSessions(path, id);
      });
    }))).flat().map((session) => {
      return withSessionAgent(agent, session);
    });
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
  projects: async (agent, paths) => {
    return (await Promise.all(paths.map(listCodexProjects))).flat().map((project) => {
      return withProjectAgent(agent, project);
    });
  },
  sessions: async (agent, paths, projectId) => {
    const ids = projectId == null
      ? (await codexRoutes.projects(agent, paths)).map((project) => {
          return project.id;
        })
      : [projectId];

    return (await Promise.all(paths.flatMap((path) => {
      return ids.map(async (id) => {
        return listCodexSessions(path, id);
      });
    }))).flat().map((session) => {
      return withSessionAgent(agent, session);
    });
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

  return projects.flat().sort(compareProjects);
};

/*
 * The newest sessions across every project on the machine. A cap is applied
 * because this answers "what has been happening lately" rather than "list
 * everything", and the answer is drawn as one square per session.
 */
export const listNewestSessions = async (
  roots: AgentRoots,
  limit: number,
): Promise<readonly SessionSummary[]> => {
  const projects = await listAgentProjects(roots);
  const found = await Promise.all(projects.map(async (project) => {
    return routesFor(project.agent).sessions(project.agent, roots[project.agent], project.id);
  }));

  return found.flat().sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  }).slice(0, limit);
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
