import type { AgentSetup, InstalledPlugin } from '@services/agents/agentsService';

// Set up means MCP servers, rules files, or, for Claude, plugins.
export const agentIsConfigured = (
  setup: AgentSetup,
  plugins: readonly InstalledPlugin[],
): boolean => {
  return setup.mcpServers.length > 0
    || setup.rules.length > 0
    || (setup.agent === 'claude' && plugins.length > 0);
};
