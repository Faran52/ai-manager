import { isAgentId } from '@config/agents';

import {
  pathsForProfile,
  readPluginCosts,
  resolveAgentPaths,
  runPluginAction,
} from '@services/agents/agentsService';
import { checkForUpdate } from '@services/updates';

import type { AgentId } from '@config/agents';
import type {
  AgentBinaryResolver,
  AgentBinaryRunner,
  AgentRoots,
} from '@services/agents/agentsService';
import type { UpdateConfig } from '@services/updates';
import type { ListSessionsBody } from '../contracts';

/*
 * What every handler needs before it can answer: the overrides a test passes
 * in, the roots they resolve to, and the two guards more than one resource
 * reads. Kept apart from the handlers so a resource file imports the contract
 * rather than redeclaring it.
 */
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

export interface ProfileScoped {
  readonly profile?: string | undefined;
}

export const isAgent = (value: unknown): value is AgentId => {
  return typeof value === 'string' && isAgentId(value);
};

/**
 * The config dir behind a profile-scoped request: the one Claude root whose
 * profile label matches. No profile means the default root, which every
 * reader and the CLI already assume, so nothing is passed down.
 */
export const claudeDirFor = (
  body: ProfileScoped,
  deps: EndpointDeps | undefined,
): string | undefined => {
  return body.profile == null
    ? undefined
    : pathsForProfile(resolveEndpointRoots(deps), 'claude', body.profile)[0];
};

// Parsed JSON never yields undefined, so a present profile must be a string.
export const profileOf = (body: object): string | undefined => {
  return 'profile' in body && typeof body.profile === 'string' ? body.profile : undefined;
};

export const isRuleList = (value: unknown): value is readonly string[] => {
  return Array.isArray(value) && value.every((entry) => {
    return typeof entry === 'string';
  });
};

/**
 * `home` overrides every agent root, not just the two named below. Without it a caller that pins
 * `claudeDir` still resolves the remaining agents against the real home, so a test reads whatever
 * history the developer's machine happens to hold and passes or fails on that.
 */
// Shared by the sessions list and the project report, which ask for the same pair.
export const isSessionsBody = (body: object): body is ListSessionsBody => {
  return 'projectId' in body
    && typeof body.projectId === 'string'
    && body.projectId.length > 0
    && 'agent' in body
    && isAgent(body.agent);
};

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
