import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { readModelAuth } from './modelAuthUtils';

const workspace = async (): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'model-auth-'));

  await mkdir(home, { recursive: true });

  return home;
};

describe('readModelAuth', () => {
  test('reports no model and no auth when Claude settings are absent', async () => {
    const home = await workspace();

    expect(await readModelAuth('claude', home)).toEqual({
      format: 'claude',
      model: undefined,
      authMethod: 'none',
    });
  });

  test('reads the model from Claude settings', async () => {
    const home = await workspace();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      model: 'claude-sonnet-4-20250514',
    }));

    expect(await readModelAuth('claude', home)).toEqual({
      format: 'claude',
      model: 'claude-sonnet-4-20250514',
      authMethod: 'none',
    });
  });

  test('detects API key auth from Claude settings env', async () => {
    const home = await workspace();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      env: { ANTHROPIC_API_KEY: 'sk-ant-...' },
    }));

    expect(await readModelAuth('claude', home)).toMatchObject({
      format: 'claude',
      authMethod: 'api-key',
    });
  });

  test('detects OAuth auth from Claude settings env', async () => {
    const home = await workspace();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      env: { ANTHROPIC_AUTH_TOKEN: 'oauth-token' },
    }));

    expect(await readModelAuth('claude', home)).toMatchObject({
      format: 'claude',
      authMethod: 'oauth',
    });
  });

  test('reads the model from Codex TOML config', async () => {
    const home = await workspace();

    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'config.toml'), [
      '[model]',
      'provider = "openai"',
      'model = "o4-mini"',
      '',
      '[mcp_servers.context7]',
      'command = "npx"',
    ].join('\n'));

    expect(await readModelAuth('codex', home)).toEqual({
      format: 'codex',
      model: 'o4-mini',
      provider: 'openai',
      authMethod: 'none',
    });
  });

  test('detects OAuth auth from Codex tokens file', async () => {
    const home = await workspace();

    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'auth.json'), JSON.stringify({
      tokens: { access_token: 'xyz' },
    }));

    expect(await readModelAuth('codex', home)).toMatchObject({
      format: 'codex',
      authMethod: 'oauth',
    });
  });

  test('falls back to api-key auth when Codex auth file has no tokens', async () => {
    const home = await workspace();

    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'auth.json'), JSON.stringify({
      OPENAI_API_KEY: 'sk-...',
    }));

    expect(await readModelAuth('codex', home)).toMatchObject({
      format: 'codex',
      authMethod: 'api-key',
    });
  });

  test('reads the model from Gemini settings', async () => {
    const home = await workspace();

    await mkdir(join(home, '.gemini'), { recursive: true });
    await writeFile(join(home, '.gemini', 'settings.json'), JSON.stringify({
      model: 'gemini-2.5-flash',
    }));

    expect(await readModelAuth('gemini', home)).toEqual({
      format: 'gemini',
      model: 'gemini-2.5-flash',
      authMethod: 'env',
    });
  });

  test('reports no model when Gemini settings are absent', async () => {
    const home = await workspace();

    expect(await readModelAuth('gemini', home)).toEqual({
      format: 'gemini',
      model: undefined,
      authMethod: 'env',
    });
  });

  test('reads the model from OpenCode config', async () => {
    const home = await workspace();

    await mkdir(join(home, '.config', 'opencode'), { recursive: true });
    await writeFile(join(home, '.config', 'opencode', 'opencode.json'), JSON.stringify({
      model: 'claude-sonnet-4-20250514',
    }));

    expect(await readModelAuth('opencode', home)).toEqual({
      format: 'opencode',
      model: 'claude-sonnet-4-20250514',
    });
  });

  test('survives malformed OpenCode config without a model', async () => {
    const home = await workspace();

    await mkdir(join(home, '.config', 'opencode'), { recursive: true });
    await writeFile(join(home, '.config', 'opencode', 'opencode.json'), '{ truncated');

    expect(await readModelAuth('opencode', home)).toEqual({
      format: 'opencode',
      model: undefined,
    });
  });

  test('reports env auth when Claude settings carry unknown env vars', async () => {
    const home = await workspace();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      env: { SOME_VAR: 'value' },
    }));

    expect(await readModelAuth('claude', home)).toMatchObject({
      format: 'claude',
      authMethod: 'env',
    });
  });

  test('collapses to a format tag for a copilot-format agent', async () => {
    const home = await workspace();

    expect(await readModelAuth('copilot', home)).toEqual({
      format: 'copilot',
      model: undefined,
    });
  });

  test('collapses to a format tag for an antigravity-format agent', async () => {
    const home = await workspace();

    expect(await readModelAuth('antigravity', home)).toEqual({
      format: 'antigravity',
      model: undefined,
    });
  });

  test('collapses to a format tag for a files-format agent', async () => {
    const home = await workspace();

    expect(await readModelAuth('aider', home)).toEqual({ format: 'files' });
  });

  test('collapses to a format tag for a sqlite-format agent', async () => {
    const home = await workspace();

    expect(await readModelAuth('cursor', home)).toEqual({ format: 'sqlite' });
  });

  test('reads the model from Grok TOML config', async () => {
    const home = await workspace();

    await mkdir(join(home, '.grok'), { recursive: true });
    await writeFile(join(home, '.grok', 'config.toml'), [
      '[telemetry]',
      'model = "ignored"',
      '[model]',
      'model = "grok-4"',
    ].join('\n'));

    expect(await readModelAuth('grok', home)).toEqual({
      format: 'grok',
      model: 'grok-4',
      authMethod: 'env',
    });
  });

  test('reports env auth when XAI_API_KEY is set', async () => {
    const home = await workspace();

    await mkdir(join(home, '.grok'), { recursive: true });
    await writeFile(join(home, '.grok', 'config.toml'), '[model]\nmodel = "grok-4"\n');

    const previous = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'xai-test-key';

    try {
      expect(await readModelAuth('grok', home)).toMatchObject({
        format: 'grok',
        authMethod: 'api-key',
      });
    }
    finally {
      if (previous === undefined) {
        delete process.env.XAI_API_KEY;
      }
      else {
        process.env.XAI_API_KEY = previous;
      }
    }
  });

  test('reports no model when Grok config is absent', async () => {
    const home = await workspace();

    expect(await readModelAuth('grok', home)).toEqual({
      format: 'grok',
      model: undefined,
      authMethod: 'env',
    });
  });

  test('collapses to a format tag for cursor-agent (files format)', async () => {
    const home = await workspace();

    expect(await readModelAuth('cursor-agent', home)).toEqual({ format: 'files' });
  });
});
