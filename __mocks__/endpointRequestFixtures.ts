import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterEach,
  beforeEach,
  vi,
} from 'vitest';

import type { MessagesResponse } from '@lib/apis/contracts';
import type { RawHistoryLine } from '@services/history/historyService';

/*
 * Every endpoint suite has to be pinned to a temp home, or a reader resolves
 * the developer's own agent roots and the run passes or fails on whatever
 * history that machine happens to hold.
 */
export const stubAgentEnv = (): void => {
  beforeEach(() => {
    vi.stubEnv('XDG_DATA_HOME', tmpdir());
    vi.stubEnv('XDG_CONFIG_HOME', tmpdir());
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
    vi.stubEnv('CODEX_HOME', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
};

export const post = (body: object | string): Request => {
  return new Request('https://localhost/api/x', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
};

export const jsonOf = async (response: Response): Promise<object | undefined> => {
  const parsed: unknown = JSON.parse(await response.text());

  return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
};

export const isObjectLike = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null;
};

export const isMessagesPageShape = (value: object): value is MessagesResponse => {
  return 'entries' in value && 'total' in value && Array.isArray(value.entries);
};

// A Claude root holding one project with one two-turn transcript, which is the
// smallest history every read endpoint can be asked a real question about.
export const newDirWithSession = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'api-'));
  const projectDir = join(dir, 'projects', 'proj');

  await mkdir(projectDir, { recursive: true });

  const lines: readonly RawHistoryLine[] = [
    {
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-06-01T10:00:00Z',
      message: {
        role: 'user',
        content: 'find the needle',
      },
    },
    {
      type: 'assistant',
      uuid: 'a1',
      timestamp: '2026-06-01T10:00:10Z',
      message: {
        role: 'assistant',
        model: 'm1',
        usage: {
          input_tokens: 3,
          output_tokens: 4,
        },
        content: [{
          type: 'text',
          text: 'done',
        }],
      },
    },
  ];

  await writeFile(join(projectDir, 's.jsonl'), lines.map((line) => {
    return JSON.stringify(line);
  }).join('\n'), 'utf8');

  return dir;
};
