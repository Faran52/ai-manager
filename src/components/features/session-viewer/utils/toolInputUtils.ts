import type { ToolCall, ToolInputRow } from '@services/history/historyService';

interface RowedInputDiscriminator {
  readonly kind: 'file-read' | 'search-files' | 'web-search'
    | 'web-fetch' | 'task' | 'skill' | 'generic';
}

export type RowedInput = Extract<ToolCall['input'], RowedInputDiscriminator>;

// Flattens the structured tool inputs that render as label/value rows.
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
