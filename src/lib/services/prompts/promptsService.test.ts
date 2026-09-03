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

import { forgetSessionPrompts } from './promptsService';

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
