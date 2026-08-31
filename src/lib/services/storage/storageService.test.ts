import {
  access,
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

import { readStorageReport, reclaimStorage } from './storageService';

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
      reclaimableBytes: 0,
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

  test('counts nothing for an entry it cannot even look at', async () => {
    const home = await newHome();
    const guarded = join(home, '.claude', 'guarded');

    await fill(join(home, '.claude', 'readable.jsonl'), 700);
    await fill(join(guarded, 'hidden.jsonl'), 5_000);
    // Listable but not traversable, so the name is known and nothing else is.
    await chmod(guarded, 0o600);

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });

    await chmod(guarded, 0o700);

    expect(claude?.bytes).toBe(700);
  });

  test('measures a root that is a single file rather than a directory', async () => {
    const home = await newHome();

    // The XDG path, which is an amazon-q root on every platform. The macOS
    // Application Support path is not one when the suite runs on Linux CI.
    await fill(join(home, '.local', 'share', 'amazon-q', 'data.sqlite3'), 700);

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

  test('counts a link as nothing, however large what it points at is', async () => {
    const home = await newHome();

    await fill(join(home, 'elsewhere', 'huge.bin'), 90_000);
    await fill(join(home, '.claude', 'real.jsonl'), 400);
    await symlink(join(home, 'elsewhere', 'huge.bin'), join(home, '.claude', 'linked.bin'));
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

    await fill(join(home, '.claude', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'deep.jsonl'), 8_000);
    await fill(join(home, '.claude', 'shallow.jsonl'), 60);

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });

    expect(claude?.bytes).toBeLessThan(8_000);
    expect(claude?.bytes).toBeGreaterThanOrEqual(60);
  });
});

const gone = async (path: string): Promise<boolean> => {
  try {
    await access(path);

    return false;
  }
  catch {
    return true;
  }
};

describe('reclaimStorage', () => {
  test('marks rebuildable working files and leaves history alone', async () => {
    const home = await newHome();

    await fill(join(home, '.claude', 'cache', 'blob'), 900);
    await fill(join(home, '.claude', 'projects', 'a.jsonl'), 100);

    const report = await readStorageReport(options(home));
    const claude = report.agents.find((agent) => {
      return agent.agent === 'claude';
    });
    const byName = new Map((claude?.entries ?? []).map((entry) => {
      return [entry.name, entry.reclaimable];
    }));

    expect(byName.get('cache')).toBe(true);
    expect(byName.get('projects')).toBe(false);
    expect(claude?.reclaimableBytes).toBe(900);
    expect(report.reclaimableBytes).toBe(900);
  });

  test('deletes what it was asked to and reports what it freed', async () => {
    const home = await newHome();
    const cache = join(home, '.claude', 'cache');

    await fill(join(cache, 'blob'), 900);
    await fill(join(home, '.claude', 'projects', 'a.jsonl'), 100);

    const result = await reclaimStorage([cache], options(home));

    expect(result.removed).toEqual([cache]);
    expect(result.freedBytes).toBe(900);
    expect(result.refused).toEqual([]);
    expect(await gone(cache)).toBe(true);
    expect(await gone(join(home, '.claude', 'projects', 'a.jsonl'))).toBe(false);
  });

  test('refuses a path that is not a rebuildable name', async () => {
    const home = await newHome();
    const projects = join(home, '.claude', 'projects');

    await fill(join(projects, 'a.jsonl'), 100);

    const result = await reclaimStorage([projects], options(home));

    expect(result.removed).toEqual([]);
    expect(result.refused).toEqual([projects]);
    expect(result.freedBytes).toBe(0);
    expect(await gone(projects)).toBe(false);
  });

  test('refuses a path outside every root it knows about', async () => {
    const home = await newHome();
    const outside = join(home, 'elsewhere', 'cache');

    await fill(join(outside, 'blob'), 100);
    await fill(join(home, '.claude', 'keep.jsonl'), 10);

    const result = await reclaimStorage([outside], options(home));

    expect(result.refused).toEqual([outside]);
    expect(await gone(outside)).toBe(false);
  });

  test('refuses a nested path even under a root it knows', async () => {
    const home = await newHome();
    const nested = join(home, '.claude', 'projects', 'cache');

    await fill(join(nested, 'blob'), 100);

    const result = await reclaimStorage([nested], options(home));

    expect(result.refused).toEqual([nested]);
    expect(await gone(nested)).toBe(false);
  });

  test('treats a log database and its companions as rebuildable', async () => {
    const home = await newHome();
    const database = join(home, '.codex', 'logs_2.sqlite');

    await fill(database, 300);
    await fill(join(home, '.codex', 'sessions', 'keep.jsonl'), 50);

    const result = await reclaimStorage([database], options(home));

    expect(result.removed).toEqual([database]);
    expect(await gone(database)).toBe(true);
    expect(await gone(join(home, '.codex', 'sessions', 'keep.jsonl'))).toBe(false);
  });

  test('reports a path it could not remove rather than claiming it did', async () => {
    const home = await newHome();
    const cache = join(home, '.claude', 'cache');

    await fill(join(cache, 'blob'), 100);
    await chmod(join(home, '.claude'), 0o500);

    const result = await reclaimStorage([cache], options(home));

    await chmod(join(home, '.claude'), 0o700);

    expect(result.removed).toEqual([]);
    expect(result.refused).toEqual([cache]);
  });

  test('asks for the same thing twice and acts on it once', async () => {
    const home = await newHome();
    const cache = join(home, '.claude', 'cache');

    await fill(join(cache, 'blob'), 400);

    const result = await reclaimStorage([cache, cache], options(home));

    expect(result.removed).toEqual([cache]);
    expect(result.freedBytes).toBe(400);
  });
});
