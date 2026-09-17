import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';
import { initialsOf } from '@utils/initialsUtils';

import type { AgentId } from '@config/agents';
import type { FC } from 'react';

export interface AgentMarkProps {
  readonly agent: AgentId;
  // Size and text step come from the caller: a row wants size-7, a strip size-8,
  // a transcript avatar size-6.
  readonly className?: string;
}

// The circle a session carries wherever it appears: its agent's initials on the
// agent's own hue, keyed on `[data-agent]` in AgentTag.css.
export const AgentMark: FC<AgentMarkProps> = ({ agent, className }) => {
  return (
    <span
      data-agent={agent}
      className={cn(
        `
          agent-mark flex shrink-0 items-center justify-center rounded-full
          font-semibold
        `,
        className,
      )}
    >
      {initialsOf(agentOption(agent).label)}
    </span>
  );
};
