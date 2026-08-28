import { PlugZap } from 'lucide-react';

import { inputRows } from '../utils/toolInputUtils';

import { RowsList } from './RowsList';

import type { ToolCall } from '@services/history/historyService';
import type { FC } from 'react';
import type { McpToolIdentity } from '../utils/mcpToolUtils';

export interface McpToolBodyProps {
  readonly call: ToolCall;
  readonly identity: McpToolIdentity;
}

export const McpToolBody: FC<McpToolBodyProps> = ({ call, identity }) => {
  const rows = call.input.kind === 'generic' ? inputRows(call.input) : [];

  return (
    <div className="space-y-2" data-mcp-tool-body>
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="
          grid size-6 shrink-0 place-items-center rounded-md bg-primary/10
          text-primary
        "
        >
          <PlugZap className="size-3.5" />
        </span>
        <span className="truncate font-mono text-muted-foreground">{identity.server}</span>
        <span className="text-border">/</span>
        <span className="truncate font-mono font-medium text-foreground">{identity.tool}</span>
      </div>
      {rows.length > 0 && <RowsList rows={rows} />}
    </div>
  );
};
