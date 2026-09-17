import { isAgentId } from '@config/agents';

import {
  pathsForProfile,
  readPluginCosts,
  resolveAgentPaths,
  runPluginAction,
} from '@services/agents/agentsService';

import type { AgentId } from '@config/agents';
import type {
  AgentBinaryResolver,
  AgentBinaryRunner,
  AgentRoots,
} from '@services/agents/agentsService';
import type { ListSessionsBody } from '../contracts';

/*
 * What every handler needs before it can answer. Kept apart from the handlers so
 * a resource file imports the contract rather than redeclaring it.
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

export interface ProfileScoped {
  readonly profile?: string | undefined;
}

export const isAgent = (value: unknown): value is AgentId => {
  return typeof value === 'string' && isAgentId(value);
};

// The config dir behind a profile-scoped request: the one Claude root whose label
// matches. No profile means the default root, which readers already assume.
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

// Shared by the sessions list and the project report, which ask for the same pair.
export const isSessionsBody = (body: object): body is ListSessionsBody => {
  return 'projectId' in body
    && typeof body.projectId === 'string'
    && body.projectId.length > 0
    && 'agent' in body
    && isAgent(body.agent);
};

/*
 * `home` overrides every agent root, not only the two named. Without it a test
 * that pins claudeDir still reads the other agents from the real home.
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
