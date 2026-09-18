import { diffLines } from '@services/history/historyService';

import type {
  FileEditInput,
  FileWriteInput,
  MultiEditInput,
  ToolCall,
  ToolInputRow,
} from '@services/history/historyService';

interface RowedInputDiscriminator {
  readonly kind: 'file-read' | 'search-files' | 'web-search'
    | 'web-fetch' | 'task' | 'skill' | 'generic';
}

export type RowedInput = Extract<ToolCall['input'], RowedInputDiscriminator>;

export type FileChange = FileEditInput | FileWriteInput | MultiEditInput;

export const inputRows = (input: RowedInput): readonly ToolInputRow[] => {
  switch (input.kind) {
    case 'file-read':
      return [{
        label: 'read',
        value: input.path,
      }];
    case 'search-files':
      return [
        {
          label: input.tool,
          value: input.pattern,
        },
        ...(input.searchPath != null
          ? [{
              label: 'in',
              value: input.searchPath,
            }]
          : []),
      ];
    case 'web-search':
      return [{
        label: 'query',
        value: input.query,
      }];
    case 'web-fetch':
      return [{
        label: 'url',
        value: input.url,
      }];
    case 'task':
      return [
        ...(input.agentType != null
          ? [{
              label: 'agent',
              value: input.agentType,
            }]
          : []),
        ...(input.description != null
          ? [{
              label: 'task',
              value: input.description,
            }]
          : []),
        ...(input.prompt != null
          ? [{
              label: 'prompt',
              value: input.prompt.slice(0, 300),
            }]
          : []),
      ];
    case 'skill':
      return [
        ...(input.skill != null
          ? [{
              label: 'skill',
              value: input.skill,
            }]
          : []),
        ...(input.prompt != null
          ? [{
              label: 'prompt',
              value: input.prompt.slice(0, 300),
            }]
          : []),
      ];
    case 'generic':
      return [...input.rows];
  }
};

// The request rather than the result: where an agent recorded the change it
// actually applied, the card shows that instead.
export const changeOf = (input: FileChange): ReturnType<typeof diffLines> => {
  if (input.kind === 'file-write') {
    return diffLines('', input.content);
  }

  if (input.kind === 'file-edit') {
    return diffLines(input.oldString, input.newString);
  }

  return input.edits.flatMap((edit) => {
    return diffLines(edit.oldString, edit.newString);
  });
};
