import {
  AUTHORED_BLOCK,
  COMMAND_ARGS,
  COMMAND_NAME,
  INJECTED_CONTEXT_PREFIXES,
  WRAPPED_BLOCK,
} from '../constants';

import type {
  AssistantBlock,
  AssistantTurnEntry,
  HistoryEntry,
  ResultImage,
  SingleEdit,
  SystemTurnEntry,
  TodoItem,
  ToolCall,
  ToolCallInput,
  ToolInputRow,
  ToolOutcome,
  ToolStatus,
  UserTurnEntry,
} from '../../history/types';
import type {
  RawContentBlock,
  RawHistoryLine,
  RawMessagePayload,
  RawResultPart,
  RawSingleEdit,
  RawToolInput,
  RawToolResultBlock,
  RawToolUseBlock,
  RawToolUseResult,
} from '../../history/utils/claudeRawUtils';

interface SplitUserText {
  readonly text: string;
  readonly injectedText?: string | undefined;
  readonly meta: boolean;
}

const injectionBoundary = (text: string): number | undefined => {
  let boundary = Number.POSITIVE_INFINITY;

  for (const prefix of INJECTED_CONTEXT_PREFIXES) {
    const direct = text.startsWith(prefix) ? 0 : text.indexOf(`\n${prefix}`);

    if (direct >= 0) {
      boundary = Math.min(boundary, direct === 0 ? 0 : direct + 1);
    }
  }

  return Number.isFinite(boundary) ? boundary : undefined;
};

/*
 * Context injectors append their payload, so the first marker is the safe
 * display boundary. An authored block is read first because Cline appends
 * <environment_details> to the very <task> that holds the typed prompt, and
 * splitting on the marker would leave the prompt behind its own raw markup.
 */
export const splitUserText = (text: string): SplitUserText => {
  const tag = WRAPPED_BLOCK.exec(text)?.[1];
  const wrapped = tag != null && text.includes(`</${tag}>`);

  if (tag === AUTHORED_BLOCK && wrapped) {
    const closer = `</${tag}>`;
    const end = text.indexOf(closer);
    const trailing = text.slice(end + closer.length).trim();

    return {
      text: text.slice(tag.length + 2, end).trim(),
      ...(trailing.length === 0 ? {} : { injectedText: trailing }),
      meta: false,
    };
  }

  const boundary = injectionBoundary(text);

  if (boundary != null) {
    const visible = text.slice(0, boundary).trimEnd();

    return {
      text: visible,
      injectedText: text.slice(boundary).trim(),
      meta: visible.length === 0,
    };
  }

  return wrapped
    ? {
        text: '',
        injectedText: text,
        meta: true,
      }
    : {
        text,
        meta: false,
      };
};

const isRawHistoryLine = (value: unknown): value is RawHistoryLine => {
  return typeof value === 'object' && value !== null;
};

const nonEmpty = (value: string | undefined): string | undefined => {
  return value != null && value.length > 0 ? value : undefined;
};

const parseUsage = (
  payload: RawMessagePayload,
): AssistantTurnEntry['usage'] => {
  const usage = payload.usage;

  if (usage == null) {
    return undefined;
  }

  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
  };
};

const asBlocks = (payload: RawMessagePayload): readonly RawContentBlock[] => {
  return typeof payload.content === 'string' ? [] : (payload.content ?? []);
};

export const parseToolCall = (block: RawToolUseBlock): ToolCall | undefined => {
  const {
    id,
    name,
    input,
  } = block;

  if (id == null || id.length === 0) {
    return undefined;
  }

  const resolvedName = name ?? 'unknown';

  return {
    id,
    name: resolvedName,
    ...(block.server_name == null ? {} : { serverName: block.server_name }),
    input: parseToolInput(resolvedName, input ?? {}),
  };
};

const todoItems = (input: RawToolInput): readonly TodoItem[] => {
  return (input.todos ?? []).flatMap((todo) => {
    const content = todo.content ?? '';

    return content.length > 0
      ? [{
          content,
          status: todo.status ?? 'pending',
          activeForm: todo.activeForm,
        }]
      : [];
  });
};

// Keys `parseToolInput` already renders through a typed shape, so a generic row would repeat them.
const TYPED_INPUT_KEYS = new Set([
  'file_path',
  'path',
  'pattern',
  'query',
  'url',
  'command',
  'description',
  'prompt',
  'skill',
  'limit',
  'offset',
]);

const genericRows = (input: RawToolInput): readonly ToolInputRow[] => {
  const candidates: readonly (readonly [string, unknown])[] = [
    ['file', input.file_path],
    ['path', input.path],
    ['pattern', input.pattern],
    ['query', input.query],
    ['url', input.url],
    ['command', input.command],
    ['description', input.description],
    ['prompt', input.prompt],
    ['skill', input.skill],
  ];

  const rows = candidates.flatMap<ToolInputRow>(([label, value]) => {
    return typeof value === 'string' && value.length > 0
      ? [{
          label,
          value,
        }]
      : [];
  });

  if (typeof input.limit === 'number') {
    rows.push({
      label: 'limit',
      value: String(input.limit),
    });
  }

  if (typeof input.offset === 'number') {
    rows.push({
      label: 'offset',
      value: String(input.offset),
    });
  }

  for (const [label, value] of Object.entries(input)) {
    if (TYPED_INPUT_KEYS.has(label) || value == null) {
      continue;
    }

    const formatted = typeof value === 'string' ? value : JSON.stringify(value);

    if (formatted.length > 0) {
      rows.push({
        label,
        value: formatted,
      });
    }
  }

  return rows;
};

/*
 * Agents disagree about casing for the same field: Claude writes file_path and
 * OpenCode writes filePath. Reading both here keeps one shape for everything
 * downstream, and stops an edit arriving with no file attached to it.
 */
const pathOf = (input: RawToolInput): string => {
  return input.file_path ?? input.filePath ?? '';
};

const editOf = (edit: RawSingleEdit): SingleEdit => {
  return {
    oldString: edit.old_string ?? edit.oldString ?? '',
    newString: edit.new_string ?? edit.newString ?? '',
    replaceAll: (edit.replace_all ?? edit.replaceAll) === true,
  };
};

export const parseToolInput = (name: string, input: RawToolInput): ToolCallInput => {
  switch (name) {
    case 'Bash':
      return {
        kind: 'bash',
        command: input.command ?? '',
        description: input.description,
      };
    case 'Write':
      return {
        kind: 'file-write',
        path: pathOf(input),
        content: input.content ?? '',
      };
    case 'Edit': {
      return {
        kind: 'file-edit',
        path: pathOf(input),
        ...editOf(input),
      };
    }
    case 'MultiEdit': {
      return {
        kind: 'multi-edit',
        path: pathOf(input),
        edits: (input.edits ?? []).map(editOf),
      };
    }
    case 'Read':
      return {
        kind: 'file-read',
        path: pathOf(input),
        offset: input.offset,
        limit: input.limit,
      };
    case 'Glob':
      return {
        kind: 'search-files',
        tool: 'glob',
        pattern: input.pattern ?? '',
        searchPath: input.path,
      };
    case 'Grep':
      return {
        kind: 'search-files',
        tool: 'grep',
        pattern: input.pattern ?? '',
        searchPath: input.path,
      };
    case 'WebSearch':
    case 'web_search':
      return {
        kind: 'web-search',
        query: input.query ?? '',
      };
    case 'WebFetch':
    case 'web_fetch':
      return {
        kind: 'web-fetch',
        url: input.url ?? '',
        prompt: input.prompt,
      };
    case 'TodoWrite':
      return {
        kind: 'todo-write',
        todos: todoItems(input),
      };
    case 'Task':
    case 'Agent':
      return {
        kind: 'task',
        agentType: input.subagent_type,
        description: input.description,
        prompt: input.prompt,
      };
    default:
      return {
        kind: 'generic',
        title: name,
        rows: genericRows(input),
      };
  }
};

const isResultPartList = (
  value: string | readonly RawResultPart[] | RawResultPart | undefined,
): value is readonly RawResultPart[] => {
  return Array.isArray(value);
};

const resultPartText = (part: RawResultPart): string => {
  if (part.text != null) {
    return part.text;
  }

  if (part.url != null) {
    return [part.title, part.url, part.page_age].filter(Boolean).join('\n');
  }

  if (typeof part.content === 'string') {
    return part.content;
  }

  if (isResultPartList(part.content)) {
    return partText(part.content);
  }

  if (part.content != null && typeof part.content === 'object') {
    return resultPartText(part.content);
  }

  return '';
};

const partText = (parts: readonly RawResultPart[]): string => {
  return parts
    .map(resultPartText)
    .filter((text) => {
      return text.length > 0;
    })
    .join('\n\n');
};

const attachedImages = (blocks: readonly RawContentBlock[]): readonly ResultImage[] => {
  return blocks.flatMap((block) => {
    if (block.type !== 'image') {
      return [];
    }

    const source = block.source;

    return source?.media_type == null
      ? []
      : [{
          mediaType: source.media_type,
          data: source.data,
          url: source.url,
        }];
  });
};

const partImages = (parts: readonly RawResultPart[]): readonly ResultImage[] => {
  return parts.flatMap((part) => {
    const source = part.source;

    if (source?.media_type == null) {
      return [];
    }

    return [{
      mediaType: source.media_type,
      data: source.data,
      url: source.url,
    }];
  });
};

const outcomeStatus = (block: RawToolResultBlock, sideChannel: RawToolUseResult | undefined): ToolStatus => {
  if (block.is_error === true) {
    return 'error';
  }

  return sideChannel?.interrupted === true ? 'interrupted' : 'ok';
};

const outcomeText = (content: RawToolResultBlock['content']): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (isResultPartList(content)) {
    return partText(content);
  }

  return resultPartText(content ?? {});
};

const outcomeFromBlock = (
  block: RawToolResultBlock,
  sideChannel: RawToolUseResult | undefined,
): ToolOutcome => {
  const content = block.content;
  const parts = isResultPartList(content) ? content : [];
  const text = outcomeText(content);
  const images = partImages(parts);
  const patch = (sideChannel?.structuredPatch ?? []).flatMap((hunk) => {
    const lines = hunk.lines ?? [];

    return lines.length > 0
      ? [
          {
            oldStart: hunk.oldStart ?? 0,
            oldLines: hunk.oldLines ?? lines.length,
            newStart: hunk.newStart ?? 0,
            newLines: hunk.newLines ?? lines.length,
            lines,
          },
        ]
      : [];
  });
  const status = outcomeStatus(block, sideChannel);

  return {
    toolUseId: block.tool_use_id ?? '',
    status,
    text: nonEmpty(text),
    images,
    patch: patch.length > 0 ? patch : undefined,
    stdout: nonEmpty(sideChannel?.stdout),
    stderr: nonEmpty(sideChannel?.stderr),
    filePath: nonEmpty(sideChannel?.filePath),
  };
};

const commandLabel = (text: string): string | undefined => {
  const name = COMMAND_NAME.exec(text)?.[1];

  if (name == null) {
    return undefined;
  }

  const args = COMMAND_ARGS.exec(text)?.[1]?.trim() ?? '';

  return args.length > 0 ? `${name} ${args}` : name;
};

const userText = (content: string | undefined, blocks: readonly RawContentBlock[]): string => {
  if (content != null) {
    return content;
  }

  return blocks
    .map((block) => {
      return block.type === 'text' ? (block.text ?? '') : '';
    })
    .filter((text) => {
      return text.length > 0;
    })
    .join('\n\n');
};

const parseUserTurn = (raw: RawHistoryLine): UserTurnEntry | undefined => {
  const payload = raw.message;

  if (payload == null) {
    return undefined;
  }

  const blocks = asBlocks(payload);
  const outcomeBlocks = blocks.filter((block): block is RawToolResultBlock => {
    return block.type === 'tool_result'
      || block.type === 'mcp_tool_result'
      || block.type === 'web_search_tool_result'
      || block.type === 'web_fetch_tool_result';
  });
  const sideChannel = typeof raw.toolUseResult === 'string' ? undefined : raw.toolUseResult;
  const outcomes = outcomeBlocks.map((block) => {
    return outcomeFromBlock(
      block,
      outcomeBlocks.length === 1 ? sideChannel : undefined,
    );
  });
  const text = userText(typeof payload.content === 'string' ? payload.content : undefined, blocks);
  const splitText = splitUserText(text);
  const command = typeof payload.content === 'string' ? commandLabel(payload.content) : undefined;
  const images = attachedImages(blocks);

  return {
    kind: 'user',
    uuid: raw.uuid ?? '',
    timestamp: raw.timestamp ?? '',
    sidechain: raw.isSidechain === true,
    meta: raw.isMeta === true || splitText.meta,
    text: command != null ? '' : splitText.text,
    ...(splitText.injectedText == null ? {} : { injectedText: splitText.injectedText }),
    command,
    ...(images.length === 0 ? {} : { images }),
    outcomes,
  };
};

const parseAssistantTurn = (raw: RawHistoryLine): AssistantTurnEntry | undefined => {
  const payload = raw.message;

  if (payload == null) {
    return undefined;
  }

  const blocks: AssistantBlock[] = [];

  for (const block of asBlocks(payload)) {
    switch (block.type) {
      case 'text': {
        const text = block.text ?? '';

        if (text.length > 0) {
          blocks.push({
            blockType: 'text',
            text,
          });
        }
        break;
      }
      case 'thinking': {
        const thinking = block.thinking ?? '';

        if (thinking.length > 0) {
          blocks.push({
            blockType: 'thinking',
            thinking,
          });
        }
        break;
      }
      case 'redacted_thinking':
        blocks.push({ blockType: 'redacted' });
        break;
      case 'tool_use':
      case 'mcp_tool_use':
      case 'server_tool_use': {
        const call = parseToolCall(block);

        if (call != null) {
          blocks.push({
            blockType: 'tool-use',
            call,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    kind: 'assistant',
    uuid: raw.uuid ?? '',
    timestamp: raw.timestamp ?? '',
    sidechain: raw.isSidechain === true,
    model: payload.model,
    stopReason: payload.stop_reason,
    usage: parseUsage(payload),
    costUsd: raw.costUSD,
    durationMs: raw.durationMs,
    blocks,
  };
};

const systemText = (raw: RawHistoryLine): string => {
  const content = raw.content;

  if (typeof content === 'string' && content.length > 0) {
    return content;
  }

  const label = raw.subtype ?? 'system event';

  return raw.level == null ? label : `${label} (${raw.level})`;
};

const parseSystemTurn = (raw: RawHistoryLine): SystemTurnEntry => {
  return {
    kind: 'system',
    uuid: raw.uuid ?? '',
    timestamp: raw.timestamp ?? '',
    sidechain: raw.isSidechain === true,
    level: raw.level,
    subtype: raw.subtype,
    text: systemText(raw),
  };
};

const fromRawLine = (raw: RawHistoryLine): HistoryEntry | undefined => {
  switch (raw.type) {
    case 'user':
      return parseUserTurn(raw);
    case 'assistant':
      return parseAssistantTurn(raw);
    case 'system':
      return parseSystemTurn(raw);
    case 'summary': {
      const text = raw.summary ?? '';

      return text.length > 0
        ? {
            kind: 'summary',
            text,
          }
        : undefined;
    }
    default:
      return undefined;
  }
};

export const parseHistoryLine = (line: string): HistoryEntry | undefined => {
  const trimmed = line.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(trimmed);

    return isRawHistoryLine(value) ? fromRawLine(value) : undefined;
  }
  catch {
    return undefined;
  }
};
