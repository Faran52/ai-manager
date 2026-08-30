import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { forgetSessionPrompts, readPromptHistory } from './promptsService';

// Shaped like the lines Claude Code writes, with each field optional so a test
// can leave one out and prove the reader skips the line.
interface RawPrompt {
  readonly display?: string | undefined;
  readonly timestamp?: number | undefined;
  readonly project?: string | undefined;
  readonly sessionId?: string | undefined;
}

const newHome = async (lines: readonly RawPrompt[], extra = ''): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'prompts-'));

  await mkdir(join(home, '.claude'), { recursive: true });
  await writeFile(
    join(home, '.claude', 'history.jsonl'),
    `${lines.map((line) => {
      return JSON.stringify(line);
    }).join('\n')}\n${extra}`,
    'utf8',
  );

  return home;
};

const prompt = (text: string, project: string, sessionId: string, timestamp: number): RawPrompt => {
  return {
    display: text,
    project,
    sessionId,
    timestamp,
  };
};

describe('readPromptHistory', () => {
  test('reads prompts newest first and names each project', async () => {
    const home = await newHome([
      prompt('older question', '/repo/alpha', 's1', 1_000),
      prompt('newer question', '/repo/beta', 's2', 5_000),
    ]);
    const history = await readPromptHistory(home);

    expect(history.total).toBe(2);
    expect(history.prompts.map((entry) => {
      return entry.text;
    })).toEqual(['newer question', 'older question']);
    expect(history.prompts[0]?.projectName).toBe('beta');
    expect(history.projects.map((project) => {
      return project.projectName;
    })).toEqual(['beta', 'alpha']);
  });

  test('points a prompt at its transcript only while the transcript survives', async () => {
    const home = await newHome([
      prompt('kept', '/repo/alpha', 'alive', 2_000),
      prompt('lost', '/repo/alpha', 'gone', 1_000),
    ]);
    const projectDir = join(home, '.claude', 'projects', '-repo-alpha');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'alive.jsonl'), '', 'utf8');

    const history = await readPromptHistory(home);

    expect(history.prompts[0]?.filePath).toBe(join(projectDir, 'alive.jsonl'));
    expect(history.prompts[1]?.filePath).toBeUndefined();
    expect(history.projects[0]?.orphaned).toBe(false);
  });

  test('flattens dots in a project path the way Claude Code names its folders', async () => {
    const home = await newHome([prompt('q', '/Users/some.one/Projects/app', 's1', 1_000)]);
    const projectDir = join(home, '.claude', 'projects', '-Users-some-one-Projects-app');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 's1.jsonl'), '', 'utf8');

    expect((await readPromptHistory(home)).prompts[0]?.filePath)
      .toBe(join(projectDir, 's1.jsonl'));
  });

  test('marks a project whose every transcript is gone', async () => {
    const home = await newHome([
      prompt('one', '/repo/lost', 's1', 2_000),
      prompt('two', '/repo/lost', 's2', 1_000),
    ]);
    const history = await readPromptHistory(home);

    expect(history.projects).toHaveLength(1);
    expect(history.projects[0]).toMatchObject({
      projectName: 'lost',
      promptCount: 2,
      orphaned: true,
    });
  });

  test('skips lines it cannot use and tolerates a trailing blank', async () => {
    const home = await newHome(
      [
        prompt('good', '/repo/alpha', 's1', 1_000),
        {
          display: '',
          project: '/repo/alpha',
          sessionId: 's1',
          timestamp: 1_000,
        },
        {
          display: 'no project',
          sessionId: 's1',
          timestamp: 1_000,
        },
        {
          display: 'no session',
          project: '/repo/alpha',
          timestamp: 1_000,
        },
        {
          display: 'no time',
          project: '/repo/alpha',
          sessionId: 's1',
        },
      ],
      'not json\n\n',
    );
    const history = await readPromptHistory(home);

    expect(history.total).toBe(1);
    expect(history.prompts[0]?.text).toBe('good');
  });

  test('trims a path that ends in a separator down to its folder', async () => {
    const home = await newHome([prompt('q', '/repo/alpha/', 's1', 1_000)]);

    expect((await readPromptHistory(home)).prompts[0]?.projectName).toBe('alpha');
  });

  test('reports nothing when the agent has never recorded a prompt', async () => {
    const home = await mkdtemp(join(tmpdir(), 'prompts-empty-'));

    expect(await readPromptHistory(home)).toEqual({
      prompts: [],
      projects: [],
      total: 0,
    });
  });

  test('falls back to the real home when no directory is given', async () => {
    const history = await readPromptHistory();

    expect(Array.isArray(history.prompts)).toBe(true);
    expect(typeof history.total).toBe('number');
  });

  test('caps how many prompts it hands back while still counting them all', async () => {
    const lines = Array.from({ length: 2_100 }, (_, index) => {
      return prompt(`q${String(index)}`, '/repo/alpha', 's1', index);
    });
    const history = await readPromptHistory(await newHome(lines));

    expect(history.total).toBe(2_100);
    expect(history.prompts).toHaveLength(2_000);
    expect(history.prompts[0]?.text).toBe('q2099');
  });
});

describe('forgetSessionPrompts', () => {
  const emptyHome = async (): Promise<string> => {
    const home = await mkdtemp(join(tmpdir(), 'forget-'));

    await mkdir(join(home, '.claude'), { recursive: true });

    return home;
  };

  test('removes one session and leaves everything else as it was', async () => {
    const home = await emptyHome();
    const path = join(home, '.claude', 'history.jsonl');
    const lines = [
      JSON.stringify({
        display: 'kept one',
        project: '/repo',
        sessionId: 'keep',
        timestamp: 3,
      }),
      'not json at all',
      JSON.stringify({
        display: 'goes',
        project: '/repo',
        sessionId: 'drop',
        timestamp: 2,
      }),
      JSON.stringify({
        display: 'kept two',
        project: '/repo',
        sessionId: 'keep',
        timestamp: 1,
      }),
    ];

    await writeFile(path, lines.join('\n'), 'utf8');

    expect(await forgetSessionPrompts('drop', home)).toBe(1);
    expect((await readFile(path, 'utf8')).split('\n')).toEqual([
      lines[0],
      'not json at all',
      lines[3],
    ]);
  });

  test('changes nothing when the session left no prompts', async () => {
    const home = await emptyHome();
    const path = join(home, '.claude', 'history.jsonl');
    const line = JSON.stringify({
      display: 'kept',
      project: '/repo',
      sessionId: 'keep',
      timestamp: 1,
    });

    await writeFile(path, line, 'utf8');

    expect(await forgetSessionPrompts('absent', home)).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(line);
  });

  test('does nothing where no record was ever kept', async () => {
    expect(await forgetSessionPrompts('any', await mkdtemp(join(tmpdir(), 'no-history-')))).toBe(0);
  });
});
