import { cn } from '@utils/cnUtils';

import type { TodoItem } from '@services/history/historyService';
import type { FC } from 'react';

export interface TodoListProps {
  readonly todos: readonly TodoItem[];
}

const TODO_TONES: Record<string, string> = {
  completed: 'text-ok',
  in_progress: 'text-primary',
};

export const TodoList: FC<TodoListProps> = ({ todos }) => {
  return (
    <ul className="space-y-1 text-xs" data-todo-list>
      {todos.map((todo, index) => {
        return (
          <li
            key={`${todo.status}-${todo.content}-${String(index)}`}
            className="flex items-start gap-2"
          >
            <span
              aria-hidden="true"
              className={cn('mt-0.5 size-3.5 shrink-0 rounded-full border', TODO_TONES[todo.status] ?? `
                text-muted-foreground
              `)}
            >
              {todo.status === 'completed' ? '✓' : ''}
            </span>
            <span className={cn(todo.status === 'completed'
              ? 'text-muted-foreground line-through'
              : 'text-foreground')}
            >
              {todo.status === 'in_progress' && todo.activeForm != null ? todo.activeForm : todo.content}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
