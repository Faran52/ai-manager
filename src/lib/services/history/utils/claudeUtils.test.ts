import {
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { listProjects, listSessions } from './claudeUtils';

import type { RawHistoryLine } from './claudeRawUtils';

type FixtureLine = RawHistoryLine | string;

const newDir = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), 'reader-'));
};

const writeSession = async (
  dir: string,
  projectId: string,
  fileName: string,
  content: string,
): Promise<void> => {
  const projectDir = join(dir, 'projects', projectId);

  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, fileName), content, 'utf8');
};

const jsonl = (lines: readonly FixtureLine[]): string => {
  return lines.map((line) => {
    return JSON.stringify(line);
  }).join('\n');
};

const turn = (text: string, extra: RawHistoryLine = {}): RawHistoryLine => {
  return {
    type: 'user',
    uuid: `u-${text.slice(0, 8)}`,
    timestamp: '2026-03-05T12:00:00Z',
    cwd: '/repo/main-app',
    message: {
      role: 'user',
      content: text,
    },
    ...extra,
  };
};

describe('listSessions', () => {
  test('returns empty for a missing project directory', async () => {
    const dir = await newDir();

    await expect(listSessions(dir, 'ghost')).resolves.toEqual([]);
  });

  test('summarises sessions with titles, summaries and previews', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      '-repo-main-app',
      'aaa.jsonl',
      [
        '',
        ...[
          {
            type: 'mode',
            mode: 'normal',
          },
          {
            type: 'summary',
            summary: 'Fixing the login flow',
          },
          turn('please fix the bug'),
          {
            type: 'assistant',
            uuid: 'a1',
            timestamp: '2026-03-05T12:01:00Z',
            message: {
              role: 'assistant',
              content: [{
                type: 'text',
                text: 'done',
              }],
            },
          },
        ].map((line) => {
          return JSON.stringify(line);
        }),
        '{"type":"custom-title","customTitle":"Login fix"}',
      ].join('\n'),
    );
    await writeSession(dir, '-repo-main-app', 'notes.txt', 'ignored');

    const sessions = await listSessions(dir, '-repo-main-app');

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'aaa',
      projectId: '-repo-main-app',
      title: 'Login fix',
      summary: 'Fixing the login flow',
      preview: 'please fix the bug',
      messageCount: 2,
      cwd: '/repo/main-app',
    });
  });

  test('skips files without countable messages and orders by recency', async () => {
    const dir = await newDir();

    await writeSession(dir, 'p', 'noise.jsonl', jsonl([{
      type: 'mode',
      mode: 'bypass',
    }]));
    await writeSession(
      dir,
      'p',
      'old.jsonl',
      jsonl([turn('early', { timestamp: '2026-01-01T00:00:00Z' })]),
    );
    await writeSession(
      dir,
      'p',
      'new.jsonl',
      jsonl([turn('late', { timestamp: '2026-06-01T00:00:00Z' })]),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions.map((session) => {
      return session.id;
    })).toEqual(['new', 'old']);
  });

  test('ignores sidechain turns in the message count and previews', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      'p',
      's.jsonl',
      jsonl([
        turn('visible question'),
        turn('hidden agent note', { isSidechain: true }),
      ]),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions[0]).toMatchObject({
      messageCount: 1,
      preview: 'visible question',
    });
  });

  test('keeps scanning after a malformed title line', async () => {
    const dir = await newDir();

    const content = ['{"type":"custom-title","customTitle":', jsonl([turn('hello')])].join('\n');

    await writeSession(dir, 'p', 's.jsonl', content);

    const sessions = await listSessions(dir, 'p');

    expect(sessions[0]).toMatchObject({
      title: undefined,
      preview: 'hello',
    });
  });
});

describe('file URL labels', () => {
  test('reduces file URL title, summary and preview to their file names', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      'p',
      'urls.jsonl',
      [
        JSON.stringify({
          type: 'summary',
          summary: 'file:///Users/dev/pics/photo shot.png',
        }),
        JSON.stringify(turn('file:///Users/dev/docs/notes.pdf')),
        '{"type":"custom-title","customTitle":"file:///Users/dev/pics/cover.png"}',
      ].join('\n'),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions[0]).toMatchObject({
      title: 'cover.png',
      summary: 'photo shot.png',
      preview: 'notes.pdf',
    });
  });

  test('falls back off an unusable file URL preview to later text', async () => {
    const dir = await newDir();

    await writeSession(dir, 'p', 'broken.jsonl', jsonl([turn('file://%zz'), turn('real question')]));

    const sessions = await listSessions(dir, 'p');

    expect(sessions[0]).toMatchObject({ preview: 'real question' });
  });
});

describe('preview selection', () => {
  test('skips commands, meta echoes and tagged text', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      'p',
      's.jsonl',
      jsonl([
        {
          type: 'user',
          uuid: 'u1',
          timestamp: 't',
          isMeta: true,
          message: {
            role: 'user',
            content: '<local-command-stdout>ok</local-command-stdout>',
          },
        },
        turn('!shell escape'),
        turn('/slash command'),
        turn('<tagged>payload</tagged>'),
        turn('the first genuine question'),
      ]),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions[0]).toMatchObject({ preview: 'the first genuine question' });
  });

  test('truncates long previews on a word-collapsed single line', async () => {
    const longText = `word ${'x'.repeat(200)}`;
    const dir = await newDir();

    await writeSession(dir, 'p', 's.jsonl', jsonl([turn(`multi\nline\n${longText}`)]));

    const sessions = await listSessions(dir, 'p');

    expect(sessions[0]?.preview?.length).toBeLessThanOrEqual(140);
    expect(sessions[0]?.preview?.includes('\n')).toBe(false);
    expect(sessions[0]?.preview?.endsWith('…')).toBe(true);
  });
});

describe('listProjects', () => {
  test('returns empty when the projects root is missing', async () => {
    const dir = await newDir();

    await expect(listProjects(dir)).resolves.toEqual([]);
  });

  test('names projects from the most recent cwd and aggregates counts', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      '-home-dev-webapp',
      'a.jsonl',
      jsonl([
        turn('one', {
          timestamp: '2026-02-01T00:00:00Z',
          cwd: '/home/dev/webapp',
        }),
        {
          type: 'assistant',
          uuid: 'a1',
          timestamp: '2026-02-01T01:00:00Z',
          message: {
            role: 'assistant',
            content: [{
              type: 'text',
              text: 'x',
            }],
          },
        },
      ]),
    );
    await writeSession(
      dir,
      '-home-dev-other',
      'b.jsonl',
      jsonl([turn('two', {
        timestamp: '2026-04-01T00:00:00Z',
        cwd: '/home/dev/other',
      })]),
    );

    const projects = await listProjects(dir);

    expect(projects).toHaveLength(2);
    expect(projects[0]).toMatchObject({
      id: '-home-dev-other',
      name: 'other',
      actualPath: '/home/dev/other',
      sessionCount: 1,
      messageCount: 1,
    });
    expect(projects[1]).toMatchObject({
      id: '-home-dev-webapp',
      name: 'webapp',
      actualPath: '/home/dev/webapp',
      messageCount: 2,
    });
  });

  test('falls back to a folder-name derived title without any cwd', async () => {
    const dir = await newDir();

    await writeSession(dir, 'standalone-project', 'a.jsonl', jsonl([{
      ...turn('hi'),
      cwd: undefined,
    }]));

    const projects = await listProjects(dir);

    expect(projects[0]).toMatchObject({
      name: 'project',
      actualPath: undefined,
    });
  });

  test('drops projects whose only file carries no messages', async () => {
    const dir = await newDir();

    await writeSession(dir, 'empty-proj', 'a.jsonl', jsonl([{
      type: 'mode',
      mode: 'normal',
    }]));

    await expect(listProjects(dir)).resolves.toEqual([]);
  });

  test('ignores plain files inside projects directory', async () => {
    const dir = await newDir();
    const root = join(dir, 'projects');

    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'stray.txt'), 'nope', 'utf8');

    await expect(listProjects(dir)).resolves.toEqual([]);
  });
});

describe('reader robustness', () => {
  test('skips directories named like session files and dash-only ids', async () => {
    const dir = await newDir();
    const projectDir = join(dir, 'projects', 'p');

    await mkdir(join(projectDir, 'fake.jsonl'), { recursive: true });
    await writeSession(dir, 'p', 'real.jsonl', jsonl([turn('hello')]));

    const sessions = await listSessions(dir, 'p');

    expect(sessions.map((s) => {
      return s.id;
    })).toEqual(['real']);
  });

  test('derives the fallback name from a bare dash id', async () => {
    const dir = await newDir();

    const noCwd: RawHistoryLine = {
      type: 'user',
      uuid: 'u-nocwd',
      timestamp: '2026-01-01T00:00:00Z',
      message: {
        role: 'user',
        content: 'hello',
      },
    };

    await writeSession(dir, '-', 'a.jsonl', jsonl([noCwd]));

    const projects = await listProjects(dir);

    expect(projects.at(0)?.name).toBe('-');
  });
});

describe('reader caching and odd cwd values', () => {
  test('serves the second listing from cache and drops empty cwds', async () => {
    const dir = await newDir();

    const emptyCwd: RawHistoryLine = {
      type: 'user',
      uuid: 'u-e',
      timestamp: '2026-01-01T00:00:00Z',
      cwd: '',
      message: {
        role: 'user',
        content: 'hello',
      },
    };

    await writeSession(dir, 'p', 'a.jsonl', jsonl([emptyCwd]));

    const first = await listSessions(dir, 'p');
    const second = await listSessions(dir, 'p');

    expect(second).toEqual(first);
    expect(first.at(0)?.cwd).toBeUndefined();
  });
});

describe('reader stat failures', () => {
  test('skips broken symlinks that cannot be stat-ed', async () => {
    const dir = await newDir();
    const projectDir = join(dir, 'projects', 'p');

    await mkdir(projectDir, { recursive: true });
    await symlink(join(dir, 'nowhere.jsonl'), join(projectDir, 'ghost.jsonl'));
    await writeSession(dir, 'p', 'real.jsonl', jsonl([turn('hello')]));

    const sessions = await listSessions(dir, 'p');

    expect(sessions.map((s) => {
      return s.id;
    })).toEqual(['real']);
  });
});

describe('quoted-value and marker edge fixtures', () => {
  test('ignores unterminated cwd values', async () => {
    const dir = await newDir();
    const projectDir = join(dir, 'projects', 'p');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'a.jsonl'), '{"type":"user","cwd":"', 'utf8');

    const sessions = await listSessions(dir, 'p');

    expect(sessions.at(0)?.cwd).toBeUndefined();
  });

  test('keeps the first custom title and first preview', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      'p',
      's.jsonl',
      jsonl([
        turn('first genuine question'),
        turn('second question also fine'),
        '{"type":"summary","summary":"ignored summary"}',
        'mentioning summary inline',
      ]),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions.at(0)?.preview).toBe('first genuine question');
  });

  test('drops empty custom titles', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      'p',
      's.jsonl',
      ['{"type":"custom-title","customTitle":""}', jsonl([turn('hi')])].join('\n'),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions.at(0)?.title).toBeUndefined();
  });

  test('treats a JSON-string marker line as a non-title', async () => {
    const dir = await newDir();

    await writeSession(
      dir,
      'p',
      's.jsonl',
      ['"a string mentioning \\"customTitle\\" here"', jsonl([turn('hello')])].join('\n'),
    );

    const sessions = await listSessions(dir, 'p');

    expect(sessions.at(0)?.title).toBeUndefined();
  });
});
