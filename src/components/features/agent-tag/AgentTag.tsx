import { agentOption } from '@config/agents';

import type { AgentId } from '@config/agents';
import type { FC } from 'react';

export interface AgentTagProps {
  readonly agent: AgentId;
}

export const AgentTag: FC<AgentTagProps> = ({ agent }) => {
  const label = agentOption(agent).label;

  return (
    <span className="agent-tag" data-agent={agent} title={label}>
      {label}
    </span>
  );
};
