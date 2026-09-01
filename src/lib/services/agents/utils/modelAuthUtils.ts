import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { agentOption } from '@config/agents';

import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';

import type { AgentId, AgentOption } from '@config/agents';
import type { JsonValue } from '@utils/jsonUtils';

/*
 * Model and auth configuration is read-only and per-agent. Each format carries
 * its own shape here; this is where agents diverge, so it is not abstracted
 * into a shared interface. A surface that has no model or auth concept
 * collapses to its format tag.
 */
export type ModelAuthState
  = | {
    readonly format: 'claude';
    readonly model: string | undefined;
    readonly authMethod: 'api-key' | 'oauth' | 'env' | 'none';
  }
  | {
    readonly format: 'codex';
    readonly model: string | undefined;
    readonly provider: string | undefined;
    readonly authMethod: 'oauth' | 'api-key' | 'none';
  }
  | {
    readonly format: 'gemini';
    readonly model: string | undefined;
    readonly authMethod: 'api-key' | 'oauth' | 'env';
  }
  | {
    readonly format: 'opencode';
    readonly model: string | undefined;
  }
  | {
    readonly format: 'copilot';
    readonly model: string | undefined;
  }
  | {
    readonly format: 'antigravity';
    readonly model: string | undefined;
  }
  | {
    readonly format: 'grok';
    readonly model: string | undefined;
    readonly authMethod: 'api-key' | 'env';
  }
  | { readonly format: 'files' }
  | { readonly format: 'sqlite' };

const readJson = async (file: string): Promise<JsonValue> => {
  try {
    return parseJsonContainer(await readFile(file, 'utf8'));
  }
  catch {
    return null;
  }
};

const readClaudeModelAuth = async (home: string): Promise<ModelAuthState> => {
  const parsed = await readJson(join(home, '.claude', 'settings.json'));
  const settings = isJsonObject(parsed) ? parsed : {};
  const model = typeof settings.model === 'string' ? settings.model : undefined;
  const env = isJsonObject(settings.env) ? settings.env : {};

  let authMethod: 'api-key' | 'oauth' | 'env' | 'none' = 'none';
  if (typeof env.ANTHROPIC_API_KEY === 'string') {
    authMethod = 'api-key';
  }
  else if (typeof env.ANTHROPIC_AUTH_TOKEN === 'string') {
    authMethod = 'oauth';
  }
  else if (Object.keys(env).length > 0) {
    authMethod = 'env';
  }

  return {
    format: 'claude',
    model,
    authMethod,
  };
};

// Codex keeps model selection in TOML and credentials in a sidecar JSON file.
const readCodexModelAuth = async (home: string): Promise<ModelAuthState> => {
  let model: string | undefined;
  let provider: string | undefined;

  try {
    const content = await readFile(join(home, '.codex', 'config.toml'), 'utf8');
    const lines = content.split('\n');
    let inModelSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inModelSection = trimmed === '[model]';
        continue;
      }

      if (!inModelSection) {
        continue;
      }

      const match = /^(\w+)\s*=\s*"([^"]*)"/u.exec(trimmed);
      if (match?.[1] === 'model') {
        model = match[2];
      }
      if (match?.[1] === 'provider') {
        provider = match[2];
      }
    }
  }
  catch {
    // No config file means no model or provider to report.
  }

  let authMethod: 'oauth' | 'api-key' | 'none' = 'none';
  const authParsed = await readJson(join(home, '.codex', 'auth.json'));

  if (isJsonObject(authParsed)) {
    authMethod = isJsonObject(authParsed.tokens)
      ? 'oauth'
      : 'api-key';
  }

  return {
    format: 'codex',
    model,
    provider,
    authMethod,
  };
};

const readGeminiModelAuth = async (home: string): Promise<ModelAuthState> => {
  const parsed = await readJson(join(home, '.gemini', 'settings.json'));
  const settings = isJsonObject(parsed) ? parsed : {};
  const model = typeof settings.model === 'string' ? settings.model : undefined;

  return {
    format: 'gemini',
    model,
    authMethod: 'env',
  };
};

const readOpenCodeModelAuth = async (home: string): Promise<ModelAuthState> => {
  const parsed = await readJson(join(home, '.config', 'opencode', 'opencode.json'));
  const config = isJsonObject(parsed) ? parsed : {};
  const model = typeof config.model === 'string' ? config.model : undefined;

  return {
    format: 'opencode',
    model,
  };
};

// Grok CLI keeps its model and feature flags in TOML; auth is via XAI_API_KEY.
const readGrokModelAuth = async (home: string): Promise<ModelAuthState> => {
  let model: string | undefined;

  try {
    const content = await readFile(join(home, '.grok', 'config.toml'), 'utf8');
    const lines = content.split('\n');
    let inModelSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inModelSection = trimmed === '[model]';
        continue;
      }

      if (!inModelSection) {
        continue;
      }

      const match = /^(\w+)\s*=\s*"([^"]*)"/u.exec(trimmed);
      if (match?.[1] === 'model') {
        model = match[2];
      }
    }
  }
  catch {
    // No config file means no model to report.
  }

  const authMethod: 'api-key' | 'env' = process.env.XAI_API_KEY != null ? 'api-key' : 'env';

  return {
    format: 'grok',
    model,
    authMethod,
  };
};

const agentFormat = (agent: AgentId): AgentOption['format'] => {
  return agentOption(agent).format;
};

export const readModelAuth = async (
  agent: AgentId,
  home = homedir(),
): Promise<ModelAuthState> => {
  switch (agentFormat(agent)) {
    case 'claude':
      return readClaudeModelAuth(home);
    case 'codex':
      return readCodexModelAuth(home);
    case 'gemini':
      return readGeminiModelAuth(home);
    case 'grok':
      return readGrokModelAuth(home);
    case 'opencode':
      return readOpenCodeModelAuth(home);
    case 'copilot':
      return {
        format: 'copilot',
        model: undefined,
      };
    case 'antigravity':
      return {
        format: 'antigravity',
        model: undefined,
      };
    case 'files':
      return { format: 'files' };
    case 'sqlite':
      return { format: 'sqlite' };
  }
};
