import {
  chmod,
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

import { readStorageReport } from './storageService';

const fill = async (path: string, bytes: number): Promise<void> => {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, 'x'.repeat(bytes), 'utf8');
};

const newHome = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), 'storage-'));
};

const options = (home: string): { readonly env: Record<string, string>;
  readonly home: string; } => {
  return {
    env: {},
    home,
  };
};

describe('readStorageReport', () => {
  test('measures an agent root and names its largest contents', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'projects', 'big.jsonl'), 4_000);
    await fill(join(home, '.claude', 'history.jsonl'), 100);

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });

    expect(claude?.label).toBe('Claude Code');
    expect(claude?.bytes).toBeGreaterThanOrEqual(4_100);
    expect(claude?.entries[0]?.name).toBe('projects');
    expect(report.totalBytes).toBeGreaterThanOrEqual(4_100);
    expect(report.partial).toBe(false);
  });

  test('orders agents by what they hold', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'small.jsonl'), 100);
    await fill(join(home, '.codex', 'large.jsonl'), 9_000);

    const report = await readStorageReport(options(home));

    expect(report.agents.map((agent) => {
      return agent.agent;
    }).slice(0, 2)).toEqual(['codex', 'claude']);
  });

  test('leaves out agents that store nothing', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'only.jsonl'), 50);

    const report = await readStorageReport(options(home));

    expect(report.agents.map((agent) => {
      return agent.agent;
    })).toEqual(['claude']);
  });

  test('refuses to count a source tree as agent storage', async () => {
    const home = await newHome();

    await fill(join(home, 'Projects', 'app', 'node_modules', 'huge.js'), 50_000);

    const report = await readStorageReport(options(home));

    expect(report.agents.some((agent) => {
      return agent.agent === 'aider' || agent.agent === 'crush';
    })).toBe(false);
  });

  test('reports nothing for a home with no agents in it', async () => {
    const report = await readStorageReport(options(await newHome()));

    expect(report).toEqual({
      agents: [],
      totalBytes: 0,
      partial: false,
    });
  });

  test('says the total is a floor once the scan hits its limit', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'a.jsonl'), 100);
    await fill(join(home, '.claude', 'b.jsonl'), 100);
    await fill(join(home, '.codex', 'c.jsonl'), 100);

    const report = await readStorageReport(options(home), 2);

    expect(report.partial).toBe(true);
  });

  test('skips a directory it is not allowed to read', async () => {
    const home = await newHome();
    const locked = join(home, '.claude', 'locked');

    await fill(join(home, '.claude', 'readable.jsonl'), 200);
    await mkdir(locked, { recursive: true });
    await fill(join(locked, 'hidden.jsonl'), 5_000);
    await chmod(locked, 0o000);

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });

    await chmod(locked, 0o755);

    expect(claude?.bytes).toBeGreaterThanOrEqual(200);
    expect(claude?.bytes).toBeLessThan(5_000);
  });

  test('measures a root that is a single file rather than a directory', async () => {
    const home = await newHome();

    await fill(join(home, 'Library', 'Application Support', 'amazon-q', 'data.sqlite3'), 700);

    const report = await readStorageReport(options(home));
    const amazon = report.agents.find((agent) => {
      return agent.agent === 'amazonq';
    });

    expect(amazon?.bytes).toBe(700);
    expect(amazon?.entries).toEqual([]);
  });

  test('omits an agent whose root cannot be listed', async () => {
    const home = await newHome();
    const root = join(home, '.claude');

    await fill(join(root, 'inside.jsonl'), 300);
    await chmod(root, 0o000);

    const report = await readStorageReport(options(home));

    await chmod(root, 0o755);

    expect(report.agents.some((agent) => {
      return agent.agent === 'claude';
    })).toBe(false);
  });

  test('ignores a link that points at nothing', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'real.jsonl'), 400);
    await symlink(join(home, '.claude', 'absent.jsonl'), join(home, '.claude', 'dangling.jsonl'));

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });

    expect(claude?.bytes).toBe(400);
  });

  test('falls back to the real home when none is given', async () => {
    const report = await readStorageReport({ env: {} }, 1);

    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.totalBytes).toBe('number');
  });

  test('stops descending past its depth limit', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'a', 'b', 'c', 'd', 'e', 'deep.jsonl'), 8_000);
    await fill(join(home, '.claude', 'shallow.jsonl'), 60);

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });

    expect(claude?.bytes).toBeLessThan(8_000);
    expect(claude?.bytes).toBeGreaterThanOrEqual(60);
  });
});
