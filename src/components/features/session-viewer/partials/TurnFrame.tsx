import { User } from 'lucide-react';

import { AgentMark } from '@ui/index';

import type { AgentId } from '@config/agents';
import type { FC, ReactNode } from 'react';

export interface TurnFrameProps {
  readonly speaker: 'user' | 'assistant';
  /**
   * Whose reply this is, so the assistant mark carries that agent's hue, the
   * same circle the session list draws. Ignored on the user side, but kept on
   * both so the frame has one prop set.
   */
  readonly agent: AgentId;
  // A turn that continues the same speaker keeps the body column but drops the
  // mark, so one run of turns reads as one block under a single avatar.
  readonly continued?: boolean;
  readonly children: ReactNode;
}

/*
 * One shape for both sides of a turn: a round mark in the role's colour, then
 * the body. The transcript reads as turns down one column, not a stream of
 * bubbles bouncing left and right. The mark carries the role, so the body does
 * not have to shout it.
 */
export const TurnFrame: FC<TurnFrameProps> = ({
  speaker,
  agent,
  continued = false,
  children,
}) => {
  let mark: ReactNode;

  if (continued) {
    mark = <span aria-hidden="true" className="size-6 shrink-0" />;
  }
  else if (speaker === 'user') {
    mark = (
      <span
        aria-hidden="true"
        className="
          flex size-6 shrink-0 items-center justify-center rounded-full
          bg-accent text-foreground-2
        "
      >
        <User className="size-3" />
      </span>
    );
  }
  else {
    mark = <AgentMark agent={agent} className="size-6 text-eyebrow" />;
  }

  return (
    <div className="flex gap-3" data-turn-frame={speaker}>
      {mark}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};
