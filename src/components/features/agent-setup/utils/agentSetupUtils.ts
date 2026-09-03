import type { AgentSetup, InstalledPlugin } from '@services/agents/agentsService';

export interface ModelSummary {
  readonly model: string | undefined;
  readonly authMethod: string | undefined;
  readonly provider: string | undefined;
}

// Set up means MCP servers, rules files, or, for Claude, plugins.
export const agentIsConfigured = (
  setup: AgentSetup,
  plugins: readonly InstalledPlugin[],
): boolean => {
  return setup.mcpServers.length > 0
    || setup.rules.length > 0
    || (setup.agent === 'claude' && plugins.length > 0);
};

/*
 * ModelAuthState is a union per agent format, and the file and sqlite readers
 * carry no model or credentials at all. Reading it by key presence keeps the
 * table free of a per-format switch it would have to grow for every new agent.
 */
export const modelSummaryOf = (state: AgentSetup['modelAuth']): ModelSummary => {
  return {
    model: 'model' in state ? state.model : undefined,
    authMethod: 'authMethod' in state ? state.authMethod : undefined,
    provider: 'provider' in state ? state.provider : undefined,
  };
};
