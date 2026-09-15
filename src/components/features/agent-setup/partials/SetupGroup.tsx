import { Eyebrow } from '@ui/index';

import type { FC, ReactNode } from 'react';

export interface SetupGroupProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly tone?: 'default' | 'warn';
}

// The label column is fixed so MCP, RULES and MODEL line up down the left. A
// crowded group wraps inside its own line rather than shoving the next along.
export const SetupGroup: FC<SetupGroupProps> = ({
  label,
  children,
  tone = 'default',
}) => {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-3">
      <Eyebrow
        as="dt"
        size="figure"
        tone={tone === 'warn' ? 'warn' : 'muted'}
        className="pt-0.5"
      >
        {label}
      </Eyebrow>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-1">
        {children}
      </dd>
    </div>
  );
};
