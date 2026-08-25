import type { FC, ReactNode } from 'react';

export interface AgentDetailRowProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
}

// One shared label column so MCP, Rules and Plugins line up across every agent card.
export const AgentDetailRow: FC<AgentDetailRowProps> = ({
  icon,
  label,
  children,
}) => {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="
        flex w-24 shrink-0 items-center gap-1 text-muted-foreground
      "
      >
        {icon}
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap gap-1">
        {children}
      </dd>
    </div>
  );
};
