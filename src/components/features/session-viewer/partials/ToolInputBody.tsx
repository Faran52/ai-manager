import { BashToolBody } from './BashToolBody';
import { RowsList } from './RowsList';
import { TodoList } from './TodoList';
import { inputRows } from './toolInputRows';

import type { ToolCall } from '@services/history/historyService';
import type { FC } from 'react';

export interface ToolInputBodyProps {
  readonly call: ToolCall;
}

export const ToolInputBody: FC<ToolInputBodyProps> = ({ call }) => {
  switch (call.input.kind) {
    case 'bash':
      return <BashToolBody command={call.input.command} description={call.input.description} />;
    case 'todo-write':
      return <TodoList todos={call.input.todos} />;
    case 'generic':
    case 'file-read':
    case 'search-files':
    case 'web-search':
    case 'web-fetch':
    case 'task':
      return <RowsList rows={inputRows(call.input)} />;
    default:
      return null;
  }
};
