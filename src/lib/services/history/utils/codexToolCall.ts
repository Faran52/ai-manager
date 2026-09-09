import { basename } from 'node:path';

import type {
  ChangedFile,
  PatchHunk,
  TodoItem,
  ToolCall,
  ToolInputRow,
} from '../types';

export interface DecodedCodexTool {
  readonly call: ToolCall;
  /*
   * Codex desktop records an apply_patch inside the call's own JS source, and
   * its patch_apply_end events arrive after the output that would pair with
   * them, so the diff is read here and handed to the paired outcome directly.
   */
  readonly patch?: readonly PatchHunk[] | undefined;
  readonly changed?: readonly ChangedFile[] | undefined;
}

interface PatchedFile {
  readonly path: string;
  readonly op: 'add' | 'update' | 'delete';
  readonly hunk: PatchHunk | undefined;
}

const PATCH_OPEN = '*** Begin Patch';
const PATCH_CLOSE = '*** End Patch';
const FILE_HEADER = /^\*\*\* (?:Add|Update|Delete) File: /u;
const HELPER = /\btools\.([A-Za-z_$][\w$]*)\s*\(/u;
const SHELL_FIELD = /[{,]\s*["']?(?:cmd|command)["']?\s*:\s*/gu;
/**
 * A "key": "value" pair, as it appears in a JSON argument blob or an embedded
 * object literal. Values holding an escaped quote are cut at it, which is fine
 * for a display row.
 */
const JSON_PAIR = /"([A-Za-z_$][\w$]*)"\s*:\s*"([^"]*)"/gu;
const ROW_LIMIT = 300;
const ESCAPES = new Map([
  ['n', '\n'],
  ['t', '\t'],
  ['r', '\r'],
]);

const opOf = (header: string): PatchedFile['op'] => {
  if (header.includes('Add')) {
    return 'add';
  }

  if (header.includes('Delete')) {
    return 'delete';
  }

  return 'update';
};

// Reads a "..." or `...` literal that opens at `open`, unescaping the common
// sequences. Codex writes cmd values and whole patches as escaped JS strings.
const readLiteral = (source: string, open: number): string | undefined => {
  const quote = source.charAt(open);

  if (quote !== '"' && quote !== '`') {
    return undefined;
  }

  let body = '';
  let escaped = false;

  for (let index = open + 1; index < source.length; index += 1) {
    const char = source.charAt(index);

    if (escaped) {
      body += ESCAPES.get(char) ?? char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === quote) {
      return body;
    }

    body += char;
  }

  return undefined;
};

const unescape = (value: string): string => {
  return value.replaceAll(/\\(.)/gu, (_, char: string) => {
    return ESCAPES.get(char) ?? char;
  });
};

const keyPattern = (name: string): RegExp => {
  return new RegExp(`[{,]\\s*["']?${name.replaceAll(/[$]/gu, '\\$&')}["']?\\s*:\\s*`, 'u');
};

const stringField = (source: string, name: string): string | undefined => {
  const match = keyPattern(name).exec(source);

  return match?.index == null ? undefined : readLiteral(source, match.index + match[0].length);
};

// The last string literal inside a `[...]`, which is where a `["bash","-lc",...]`
// style command keeps the part worth showing.
const lastArrayString = (source: string, open: number): string | undefined => {
  const close = source.indexOf(']', open);
  const slice = close < 0 ? source.slice(open) : source.slice(open, close);

  return [...slice.matchAll(/"((?:[^"\\]|\\.)*)"/gu)]
    .map((match) => {
      /* v8 ignore next -- the pattern always captures group 1 when it matches */
      return unescape(match[1] ?? '');
    })
    .filter((part) => {
      return part.length > 0;
    })
    .at(-1);
};

const shellCommands = (source: string): readonly string[] => {
  return [...source.matchAll(SHELL_FIELD)].flatMap((match) => {
    const at = match.index + match[0].length;
    const value = source.charAt(at) === '['
      ? lastArrayString(source, at)
      : readLiteral(source, at);

    return value != null && value.length > 0 ? [value] : [];
  });
};

// The patch text: the string literal that carries `*** Begin Patch`, or the bare
// span when it was not written as a literal.
const patchText = (source: string): string | undefined => {
  const marker = source.indexOf(PATCH_OPEN);

  if (marker < 0) {
    return undefined;
  }

  const open = source.lastIndexOf('"', marker);
  const literal = open < 0 ? undefined : readLiteral(source, open);

  if (literal != null) {
    return literal;
  }

  const close = source.indexOf(PATCH_CLOSE, marker);

  return close < 0 ? source.slice(marker) : source.slice(marker, close + PATCH_CLOSE.length);
};

const hunkOf = (lines: readonly string[]): PatchHunk | undefined => {
  const body = lines.filter((line) => {
    return /^[ +-]/u.test(line);
  });

  if (body.length === 0) {
    return undefined;
  }

  const oldLines = body.filter((line) => {
    return line.startsWith(' ') || line.startsWith('-');
  }).length;
  const newLines = body.filter((line) => {
    return line.startsWith(' ') || line.startsWith('+');
  }).length;

  return {
    oldStart: 1,
    oldLines,
    newStart: 1,
    newLines,
    lines: body,
  };
};

const parsePatchEnvelope = (text: string): readonly PatchedFile[] => {
  const files: PatchedFile[] = [];
  let path = '';
  let op: PatchedFile['op'] = 'update';
  let lines: string[] = [];

  const flush = (): void => {
    if (path.length > 0) {
      files.push({
        path,
        op,
        hunk: hunkOf(lines),
      });
    }
  };

  for (const line of text.split('\n')) {
    const header = FILE_HEADER.exec(line)?.[0];

    if (header != null) {
      flush();
      path = line.slice(header.length).trim();
      op = opOf(header);
      lines = [];
      continue;
    }

    // A hunk marker with no line numbers to keep, and the envelope's own fences.
    if (line.startsWith('@@') || line.startsWith('*** ')) {
      continue;
    }

    lines.push(line);
  }

  flush();

  return files;
};

const patchDecoded = (id: string, files: readonly PatchedFile[]): DecodedCodexTool => {
  const paths = [...new Set(files.map((file) => {
    return file.path;
  }))];
  const only = paths.length === 1 ? paths[0] : undefined;
  const hunks = files.flatMap((file) => {
    if (file.hunk == null) {
      return [];
    }

    // Across more than one file the diff has to say which file each hunk is in;
    // a single-file patch already names it on the card.
    return [only == null
      ? {
          ...file.hunk,
          file: file.path,
        }
      : file.hunk];
  });
  const changed: readonly ChangedFile[] = paths.map((path) => {
    const ops = files.filter((file) => {
      return file.path === path;
    });

    return {
      path,
      added: ops.some((file) => {
        return file.op === 'add';
      }) && !ops.some((file) => {
        return file.op === 'delete';
      }),
    };
  });
  const patch = hunks.length > 0 ? hunks : undefined;

  if (only != null) {
    return {
      call: {
        id,
        name: 'apply_patch',
        input: {
          kind: 'file-edit',
          path: only,
          oldString: '',
          newString: '',
          replaceAll: false,
        },
      },
      patch,
      changed,
    };
  }

  return {
    call: {
      id,
      name: 'apply_patch',
      input: {
        kind: 'generic',
        title: 'apply_patch',
        rows: files.map((file) => {
          return {
            label: file.op,
            value: basename(file.path),
          };
        }),
      },
    },
    patch,
    changed,
  };
};

const planTodos = (source: string): readonly TodoItem[] => {
  const opener = /["']?plan["']?\s*:\s*\[/u.exec(source);

  if (opener?.index == null) {
    return [];
  }

  const slice = source.slice(opener.index + opener[0].length);

  return [...slice.matchAll(/\{[^{}]*\}/gu)].flatMap((match) => {
    const step = stringField(match[0], 'step') ?? stringField(match[0], 'description');

    return step == null || step.length === 0
      ? []
      : [{
          content: step,
          status: stringField(match[0], 'status') ?? 'pending',
        }];
  });
};

/**
 * Every `"key": "value"` pair we can read, whether the source is a JSON argument
 * blob or JS with an embedded object literal. Enough to fill a card that would
 * otherwise be blank.
 */
const fieldRows = (source: string): readonly ToolInputRow[] => {
  const seen = new Set<string>();

  return [...source.matchAll(JSON_PAIR)].flatMap((match) => {
    const label = match[1];
    const raw = match[2];

    if (label == null || raw == null || seen.has(label)) {
      return [];
    }

    seen.add(label);

    return [{
      label,
      value: unescape(raw).slice(0, ROW_LIMIT),
    }];
  });
};

const mcpDecoded = (id: string, source: string, helper: string): DecodedCodexTool => {
  const rest = helper.slice('mcp__'.length);
  const separator = rest.indexOf('__');
  const server = separator < 0 ? rest : rest.slice(0, separator);
  const tool = separator < 0 ? rest : rest.slice(separator + 2);

  return {
    call: {
      id,
      name: tool,
      serverName: server,
      input: {
        kind: 'generic',
        title: tool,
        rows: fieldRows(source),
      },
    },
  };
};

const genericDecoded = (id: string, name: string, source: string): DecodedCodexTool => {
  return {
    call: {
      id,
      name,
      input: {
        kind: 'generic',
        title: name,
        rows: fieldRows(source),
      },
    },
  };
};

/**
 * Codex records a tool call as JS source that calls a `tools.*` helper (newer
 * `exec`) or as a JSON argument blob (older `function_call`). This reads either
 * into the shared `ToolCall` shape so no Codex call renders as a blank card.
 */
export const decodeCodexTool = (
  name: string | undefined,
  source: string | undefined,
  callId: string,
): DecodedCodexTool => {
  const src = source ?? '';
  const patch = patchText(src);

  if (patch != null) {
    return patchDecoded(callId, parsePatchEnvelope(patch));
  }

  const helper = HELPER.exec(src)?.[1];

  if (helper?.startsWith('mcp__') === true) {
    return mcpDecoded(callId, src, helper);
  }

  if (helper === 'update_plan') {
    return {
      call: {
        id: callId,
        name: 'update_plan',
        input: {
          kind: 'todo-write',
          todos: planTodos(src),
        },
      },
    };
  }

  const commands = shellCommands(src);
  // `name` is the wrapper Codex ran the call under, always `exec` for the newer
  // format, so the shell decision rests on the helper or an older name instead.
  const shell = commands.length > 0
    || helper === 'exec_command'
    || helper === 'exec'
    || name === 'shell'
    || name === 'exec_command'
    || name === 'local_shell';

  if (shell) {
    return {
      call: {
        id: callId,
        name: 'Bash',
        input: {
          kind: 'bash',
          command: commands.join('\n'),
          description: undefined,
        },
      },
    };
  }

  return genericDecoded(callId, helper ?? name ?? 'tool', src);
};
