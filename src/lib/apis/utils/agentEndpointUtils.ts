import {
  attributePluginCosts,
  checkAgentInstalled,
  installableAgents,
  installCommandText,
  managedAgents,
  pathsFor,
  readAgentSetup,
  readBlendedRate,
  readClaudePlugins,
  readPluginCosts,
  readProjectTrust,
  readProjectUsage,
  runAgentInstall,
  runPluginAction,
  validateAgentSetup,
} from '@services/agents/agentsService';

import {
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from '../apiHandler';
import { BAD_REQUEST } from '../constants';

import {
  claudeDirFor,
  isAgent,
  profileOf,
  resolveEndpointRoots,
} from './endpointDepsUtils';

import type { AgentId } from '@config/agents';
import type {
  PluginActionName,
  PluginActionRequest,
  SetupScope,
} from '@services/agents/agentsService';
import type { AgentInstallBody, AgentSetupBody } from '../contracts';
import type { EndpointDeps, ProfileScoped } from './endpointDepsUtils';

// The request plus the profile it names, resolved to a config dir by the handler.
type PluginActionInput = PluginActionRequest & ProfileScoped;

const isAgentSetupBody = (body: object): body is AgentSetupBody => {
  return 'projectPath' in body && typeof body.projectPath === 'string' && body.projectPath.length > 0;
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

const parseAgentInstallBody = (body: object): AgentInstallBody | undefined => {
  if (!('agent' in body) || !isAgent(body.agent) || !installableAgents.includes(body.agent)) {
    return undefined;
  }

  return { agent: body.agent };
};

export const handleAgentSetup = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isAgentSetupBody(body)) {
      return jsonError(BAD_REQUEST, 'A non-empty projectPath is required.');
    }

    /*
     * One Claude card per config dir: each keeps its own rules, MCP servers and
     * settings. Plugins, usage and trust stay facts about the default root.
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
 * Whether a CLI is on PATH is a fact about the machine, not the selected project,
 * so this checks every installable agent at once and takes no projectPath.
 */
export const handleAgentInstallCheck = (deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const entries = await Promise.all(installableAgents.map(async (agent) => {
      return [agent, {
        installed: await checkAgentInstalled(agent, deps?.agentInstallCheck),
        // installableAgents is built from AGENT_INSTALLS' own keys, so every entry
        // has a command; the fallback is only for installCommandText's signature.
        /* v8 ignore next */
        command: installCommandText(agent) ?? '',
      }] as const;
    }));

    return jsonOk({ agents: Object.fromEntries(entries) });
  });
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
