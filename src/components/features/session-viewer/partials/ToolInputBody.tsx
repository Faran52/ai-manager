import { mcpToolIdentity } from '../utils/mcpToolUtils';
import { inputRows } from '../utils/toolInputUtils';

import { BashToolBody } from './BashToolBody';
import { McpToolBody } from './McpToolBody';
import { RowsList } from './RowsList';
import { TodoList } from './TodoList';
import { WebToolBody } from './WebToolBody';

import type { ToolCall } from '@services/history/historyService';
import type { FC } from 'react';

export interface ToolInputBodyProps {
  readonly call: ToolCall;
}

export const ToolInputBody: FC<ToolInputBodyProps> = ({ call }) => {
  const mcpIdentity = mcpToolIdentity(call);

  if (mcpIdentity != null) {
    return <McpToolBody call={call} identity={mcpIdentity} />;
  }

  switch (call.input.kind) {
    case 'bash':
      return <BashToolBody command={call.input.command} description={call.input.description} />;
    case 'todo-write':
      return <TodoList todos={call.input.todos} />;
    case 'web-search':
    case 'web-fetch':
      return <WebToolBody input={call.input} />;
    case 'generic':
    case 'file-read':
    case 'search-files':
    case 'task':
      return <RowsList rows={inputRows(call.input)} />;
    default:
      return null;
  }
};
