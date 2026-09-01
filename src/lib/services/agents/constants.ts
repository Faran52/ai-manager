import { agentOptions } from '@config/agents';

import { hasAgentSetup } from './utils/setupUtils';

import type { AgentId } from '@config/agents';

// An agent is managed once it claims the surface and SPECS names where to read it.
export const managedAgents: readonly AgentId[] = agentOptions.flatMap((option) => {
  return option.capabilities.manage && hasAgentSetup(option.id) ? [option.id] : [];
});
