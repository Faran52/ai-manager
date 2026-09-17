import { parseToolInput } from '../../session/utils/parserUtils';
import {
  CLINE_NAME,
  CLINE_PARSER_NAMES,
  CLINE_PATH_TOOLS,
  CLINE_TASK_PROGRESS,
  CLINE_TOOLS,
} from '../constants';

import type { AssistantBlock } from '../types';
import type { RawTodoItem, RawToolInput } from './claudeRawUtils';

interface Tag {
  readonly name: string;
  readonly body: string;
  readonly start: number;
  readonly end: number;
}

const tagAt = (text: string, from: number): Tag | undefined => {
  for (let open = text.indexOf('<', from); open !== -1; open = text.indexOf('<', open + 1)) {
    const nameEnd = text.indexOf('>', open);

    if (nameEnd === -1) {
      return undefined;
    }

    const name = text.slice(open + 1, nameEnd);
    const close = CLINE_NAME.test(name) ? text.indexOf(`</${name}>`, nameEnd) : -1;

    if (close !== -1) {
      return {
        name,
        body: text.slice(nameEnd + 1, close),
        start: open,
        end: close + name.length + 3,
      };
    }
  }

  return undefined;
};

const paramsOf = (body: string): ReadonlyMap<string, string> => {
  const params = new Map<string, string>();
  let cursor = 0;

  for (let tag = tagAt(body, cursor); tag != null; tag = tagAt(body, cursor)) {
    params.set(tag.name, tag.body.trim());
    cursor = tag.end;
  }

  return params;
};

/* A checklist Cline writes as markdown, which is what every other agent sends as todos. */
const todosOf = (body: string): readonly RawTodoItem[] => {
  return body.split('\n').flatMap((line) => {
    const item = line.trim();

    if (!item.startsWith('- [')) {
      return [];
    }

    return [{
      content: item.slice(5).trim(),
      status: item.startsWith('- [x]') ? 'completed' : 'pending',
    }];
  });
};

const inputOf = (name: string, params: ReadonlyMap<string, string>): RawToolInput => {
  const path = params.get('path');
  const names = CLINE_PATH_TOOLS.has(name);

  return {
    command: params.get('command'),
    content: params.get('content') ?? params.get('diff'),
    ...(names && path != null ? { file_path: path } : {}),
    path: names ? undefined : path,
    pattern: params.get('regex') ?? params.get('pattern'),
    prompt: params.get('result') ?? params.get('response'),
    query: params.get('question') ?? params.get('query'),
    url: params.get('url'),
  };
};

const todoBlock = (body: string, id: string): readonly AssistantBlock[] => {
  const todos = todosOf(body);

  return todos.length === 0
    ? []
    : [{
        blockType: 'tool-use',
        call: {
          id,
          name: CLINE_TASK_PROGRESS,
          input: parseToolInput('TodoWrite', { todos }),
        },
      }];
};

const textBlock = (text: string): readonly AssistantBlock[] => {
  const trimmed = text.trim();

  return trimmed.length === 0
    ? []
    : [{
        blockType: 'text',
        text: trimmed,
      }];
};

// One assistant message split into prose and the calls it made. A progress
// checklist becomes todos nested or not, because Cline writes it both ways.
export const parseClineBlocks = (text: string, uuid: string): readonly AssistantBlock[] => {
  const blocks: AssistantBlock[] = [];
  let cursor = 0;
  let spoken = 0;

  for (let tag = tagAt(text, cursor); tag != null; tag = tagAt(text, cursor)) {
    cursor = tag.end;

    if (!CLINE_TOOLS.has(tag.name) && tag.name !== CLINE_TASK_PROGRESS) {
      continue;
    }

    blocks.push(...textBlock(text.slice(spoken, tag.start)));
    spoken = tag.end;

    if (tag.name === CLINE_TASK_PROGRESS) {
      blocks.push(...todoBlock(tag.body, `${uuid}-${String(blocks.length)}`));
      continue;
    }

    const params = paramsOf(tag.body);

    blocks.push({
      blockType: 'tool-use',
      call: {
        id: `${uuid}-${String(blocks.length)}`,
        name: tag.name,
        input: parseToolInput(CLINE_PARSER_NAMES.get(tag.name) ?? tag.name, inputOf(tag.name, params)),
      },
    });

    const progress = params.get(CLINE_TASK_PROGRESS);

    if (progress != null) {
      blocks.push(...todoBlock(progress, `${uuid}-${String(blocks.length)}`));
    }
  }

  blocks.push(...textBlock(text.slice(spoken)));

  return blocks;
};
