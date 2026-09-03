import { mcpToolIdentity } from '../utils/mcpToolUtils';
import { inputRows } from '../utils/toolInputUtils';

import { BashToolBody } from './BashToolBody';
import { FileChangeBody } from './FileChangeBody';
import { McpToolBody } from './McpToolBody';
import { RowsList } from './RowsList';
import { TodoList } from './TodoList';
import { WebToolBody } from './WebToolBody';

import type { ToolCall } from '@services/history/historyService';
import type { FC } from 'react';

export interface ToolInputBodyProps {
  readonly call: ToolCall;
  // The change an agent recorded applying is the truthful one, so when there is
  // such a record the card shows that instead of the change that was asked for.
  readonly changeRecorded?: boolean | undefined;
}

export const ToolInputBody: FC<ToolInputBodyProps> = ({ call, changeRecorded = false }) => {
  const mcpIdentity = mcpToolIdentity(call);

  if (mcpIdentity != null) {
    return <McpToolBody call={call} identity={mcpIdentity} />;
  }

  switch (call.input.kind) {
    case 'bash':
      return <BashToolBody command={call.input.command} description={call.input.description} />;
    case 'file-write':
    case 'file-edit':
    case 'multi-edit':
      return changeRecorded ? null : <FileChangeBody input={call.input} />;
    case 'todo-write':
      return <TodoList todos={call.input.todos} />;
    case 'web-search':
    case 'web-fetch':
      return <WebToolBody input={call.input} />;
    case 'generic':
    case 'file-read':
    case 'search-files':
    case 'task':
    case 'skill':
      return <RowsList rows={inputRows(call.input)} />;
  }
};
