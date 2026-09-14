import { isAgentId } from '@config/agents';

import { resolveBinary, runBinary } from './binaryUtils';

import type { AgentId } from '@config/agents';
import type { BinaryRunResult } from './binaryUtils';

export interface AgentInstallCommand {
  readonly bin: string;
  readonly args: readonly string[];
}

export interface AgentInstallInfo {
  // The binary this agent's own CLI installs, checked to tell "already
  // installed" apart from "not found" before ever offering to install it.
  readonly checkBin: string;
  readonly install: AgentInstallCommand;
}

export type AgentBinaryResolver = (bin: string) => Promise<boolean>;

export type AgentBinaryRunner = (bin: string, args: readonly string[]) => Promise<BinaryRunResult>;

/*
 * Only agents with one verified, official, single-command install, checked
 * directly against their own docs, npm, or PyPI page. Deliberately not all 13
 * unmanaged agents:
 *
 * - PearAI and Trae are GUI desktop apps distributed as a per-OS installer,
 *   not a package-manager command.
 * - ForgeCode and Kimi both have naming collisions across unrelated projects
 *   sharing the name, with no way to tell which one a user means.
 * - Kiro's setup is gated behind an interactive AWS Builder ID sign-in, not a
 *   plain install.
 * - oh-my-pi's own docs say it needs the Bun runtime "to run from source",
 *   not confidently just a plain npm install.
 *
 * Guessing any of these wrong means running the wrong command on a real
 * machine, so they stay uncovered until named explicitly.
 */
export const AGENT_INSTALLS: Partial<Record<AgentId, AgentInstallInfo>> = {
  codebuddy: {
    checkBin: 'codebuddy',
    install: {
      bin: 'npm',
      args: ['install', '-g', '@tencent-ai/codebuddy-code'],
    },
  },
  crush: {
    checkBin: 'crush',
    install: {
      bin: 'npm',
      args: ['install', '-g', '@charmland/crush'],
    },
  },
  llm: {
    checkBin: 'llm',
    install: {
      bin: 'pip',
      args: ['install', '-U', 'llm'],
    },
  },
  openhands: {
    checkBin: 'openhands',
    install: {
      bin: 'pip',
      args: ['install', 'openhands-ai'],
    },
  },
  openinterpreter: {
    checkBin: 'interpreter',
    install: {
      bin: 'pip',
      args: ['install', 'open-interpreter'],
    },
  },
  pi: {
    checkBin: 'pi',
    install: {
      bin: 'npm',
      args: ['install', '-g', '@earendil-works/pi-coding-agent'],
    },
  },
  vibe: {
    checkBin: 'vibe',
    install: {
      bin: 'pip',
      args: ['install', 'mistral-vibe'],
    },
  },
};

// Object.keys widens to string[], so isAgentId narrows it back rather than a cast.
// AGENT_INSTALLS' own keys are already alphabetised, so this lists in that order too.
export const installableAgents: readonly AgentId[] = Object.keys(AGENT_INSTALLS).filter(isAgentId);

// Shown before the command ever runs, so a reader can see exactly what they are approving.
export const installCommandText = (agent: AgentId): string | undefined => {
  const info = AGENT_INSTALLS[agent];

  return info == null ? undefined : [info.install.bin, ...info.install.args].join(' ');
};

const isOnPath: AgentBinaryResolver = async (bin) => {
  return await resolveBinary(bin) != null;
};

// Installs can fetch and build a wheel or an npm tree, so the ceiling is generous.
const TIMEOUT_MS = 180_000;

const runResolved: AgentBinaryRunner = async (bin, args) => {
  const resolved = await resolveBinary(bin);

  if (resolved == null) {
    return {
      ok: false,
      output: `${bin} was not found on PATH.`,
    };
  }

  return runBinary(resolved, args, { timeoutMs: TIMEOUT_MS });
};

export const checkAgentInstalled = async (
  agent: AgentId,
  resolve: AgentBinaryResolver = isOnPath,
): Promise<boolean> => {
  const info = AGENT_INSTALLS[agent];

  return info != null && await resolve(info.checkBin);
};

export const runAgentInstall = async (
  agent: AgentId,
  run: AgentBinaryRunner = runResolved,
): Promise<BinaryRunResult> => {
  const info = AGENT_INSTALLS[agent];

  if (info == null) {
    return {
      ok: false,
      output: `No verified install command for ${agent}.`,
    };
  }

  return run(info.install.bin, info.install.args);
};
