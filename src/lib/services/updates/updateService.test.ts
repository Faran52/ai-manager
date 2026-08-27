import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  checkForUpdate,
  resetUpdateState,
  updateState,
} from './updateService';

const config = {
  baseUrl: 'https://releases.example.com/app',
  currentVersion: '1.0.0',
};

const feed = (version: string): string => {
  return JSON.stringify({
    version,
    notes: 'Notes',
    artifacts: {
      darwin: {
        name: `app-${version}.zip`,
        sha256: 'a'.repeat(64),
      },
    },
  });
};

const respondWith = (body: string, ok = true): typeof globalThis.fetch => {
  return () => {
    return Promise.resolve({
      ok,
      text: () => {
        return Promise.resolve(body);
      },
    } as Response);
  };
};

afterEach(() => {
  resetUpdateState();
  vi.unstubAllGlobals();
});

describe('checkForUpdate', () => {
  test('reports an available release with its artifact url', async () => {
    const state = await checkForUpdate(config, {
      platform: 'darwin',
      fetch: respondWith(feed('1.2.0')),
    });

    expect(state).toMatchObject({
      stage: 'available',
      version: '1.2.0',
      notes: 'Notes',
      artifactPath: 'https://releases.example.com/app/app-1.2.0.zip',
    });
    expect(updateState()).toBe(state);
  });

  test('stays idle when the feed is not newer', async () => {
    const state = await checkForUpdate(config, {
      platform: 'darwin',
      fetch: respondWith(feed('0.9.0')),
    });

    expect(state.stage).toBe('idle');
  });

  test('stays idle when the feed has no artifact for this platform', async () => {
    const state = await checkForUpdate(config, {
      platform: 'linux',
      fetch: respondWith(feed('2.0.0')),
    });

    expect(state.stage).toBe('idle');
  });

  test('stays idle on an error response or an unreadable feed', async () => {
    expect((await checkForUpdate(config, {
      platform: 'darwin',
      fetch: respondWith('', false),
    })).stage).toBe('idle');

    expect((await checkForUpdate(config, {
      platform: 'darwin',
      fetch: respondWith('not json'),
    })).stage).toBe('idle');
  });

  test('records why a failed check gave up', async () => {
    const state = await checkForUpdate(config, {
      platform: 'darwin',
      fetch: () => {
        return Promise.reject(new Error('offline'));
      },
    });

    expect(state).toMatchObject({ stage: 'idle' });
    expect(state.reason).toContain('offline');
  });

  test('reads the platform and fetch from the desktop runtime when none are injected', async () => {
    vi.stubGlobal('Deno', { build: { os: 'darwin' } });
    vi.stubGlobal('fetch', () => {
      return Promise.resolve({
        ok: true,
        text: () => {
          return Promise.resolve(feed('3.0.0'));
        },
      });
    });

    expect((await checkForUpdate(config)).version).toBe('3.0.0');
  });

  test('is unsupported when the runtime reports an unknown platform', async () => {
    vi.stubGlobal('Deno', { build: { os: 'plan9' } });

    expect((await checkForUpdate(config)).stage).toBe('unsupported');
  });

  test('is unsupported away from a desktop runtime', async () => {
    expect((await checkForUpdate(config, { fetch: respondWith(feed('2.0.0')) })).stage)
      .toBe('unsupported');
  });
});
