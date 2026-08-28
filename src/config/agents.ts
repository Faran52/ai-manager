export type AgentId
  = | 'aider'
    | 'amazonq'
    | 'antigravity'
    | 'claude'
    | 'cline'
    | 'codebuddy'
    | 'codex'
    | 'continue'
    | 'copilot'
    | 'crush'
    | 'cursor'
    | 'cursor-agent'
    | 'forgecode'
    | 'gemini'
    | 'goose'
    | 'grok'
    | 'kimi'
    | 'kiro'
    | 'llm'
    | 'ompi'
    | 'opencode'
    | 'openhands'
    | 'openinterpreter'
    | 'pearai'
    | 'pi'
    | 'qwen'
    | 'trae'
    | 'vibe'
    | 'zed';

export type SessionArtifact = 'file' | 'directory' | 'shared-db';

export interface AgentOption {
  readonly id: AgentId;
  readonly label: string;
  readonly format: 'antigravity' | 'claude' | 'codex' | 'copilot' | 'files' | 'gemini' | 'sqlite' | 'opencode';
  readonly artifact: SessionArtifact;
  readonly canDelete: boolean;
  readonly canDeleteProject: boolean;
  readonly canRename: boolean;
  readonly popular?: boolean | undefined;
  readonly supportsSidechains?: boolean | undefined;
  readonly resumeCommand?: string | undefined;
}

const readOnlyAgent = (
  id: AgentId,
  label: string,
  format: AgentOption['format'],
  popular = false,
): AgentOption => {
  return {
    id,
    label,
    format,
    artifact: format === 'sqlite' ? 'shared-db' : 'file',
    canDelete: false,
    canDeleteProject: false,
    canRename: false,
    popular,
  };
};

export const agentOptions: readonly AgentOption[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    format: 'claude',
    artifact: 'file',
    canDelete: true,
    canDeleteProject: true,
    canRename: true,
    popular: true,
    supportsSidechains: true,
    resumeCommand: 'claude --resume',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    format: 'codex',
    artifact: 'file',
    canDelete: true,
    canDeleteProject: false,
    canRename: true,
    popular: true,
    resumeCommand: 'codex resume',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    format: 'copilot',
    artifact: 'file',
    canDelete: true,
    canDeleteProject: false,
    canRename: false,
    popular: true,
  },
  readOnlyAgent('cursor', 'Cursor', 'sqlite', true),
  {
    id: 'opencode',
    label: 'OpenCode',
    format: 'opencode',
    artifact: 'shared-db',
    canDelete: true,
    canDeleteProject: false,
    canRename: false,
    popular: true,
  },
  readOnlyAgent('gemini', 'Gemini CLI', 'gemini', true),
  readOnlyAgent('cline', 'Cline / Roo / Kilo', 'files', true),
  readOnlyAgent('aider', 'Aider', 'files', true),
  readOnlyAgent('continue', 'Continue', 'files', true),
  readOnlyAgent('amazonq', 'Amazon Q', 'sqlite', true),
  readOnlyAgent('kiro', 'Kiro', 'sqlite', true),
  readOnlyAgent('goose', 'Goose', 'sqlite', true),
  readOnlyAgent('qwen', 'Qwen Code', 'files', true),
  readOnlyAgent('antigravity', 'Antigravity', 'antigravity'),
  readOnlyAgent('cursor-agent', 'Cursor Agent', 'files'),
  readOnlyAgent('forgecode', 'ForgeCode', 'sqlite'),
  readOnlyAgent('codebuddy', 'CodeBuddy Code', 'claude'),
  readOnlyAgent('grok', 'Grok CLI', 'files'),
  {
    id: 'kimi',
    label: 'Kimi',
    format: 'files',
    artifact: 'file',
    canDelete: false,
    canDeleteProject: false,
    canRename: false,
    resumeCommand: 'kimi -r',
  },
  readOnlyAgent('pearai', 'PearAI', 'files'),
  readOnlyAgent('crush', 'Crush', 'sqlite'),
  readOnlyAgent('llm', 'LLM', 'sqlite'),
  readOnlyAgent('openinterpreter', 'Open Interpreter', 'codex'),
  readOnlyAgent('pi', 'Pi', 'files'),
  readOnlyAgent('ompi', 'oh-my-pi', 'files'),
  readOnlyAgent('vibe', 'Mistral Vibe', 'files'),
  readOnlyAgent('zed', 'Zed', 'sqlite'),
  readOnlyAgent('openhands', 'OpenHands', 'files'),
  readOnlyAgent('trae', 'Trae', 'sqlite'),
];

const AGENTS_BY_ID = new Map<string, AgentOption>(agentOptions.map((option): [string, AgentOption] => {
  return [option.id, option];
}));

export const agentOption = (agent: string): AgentOption => {
  const option = AGENTS_BY_ID.get(agent);

  if (option == null) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  return option;
};

export const isAgentId = (value: string): value is AgentId => {
  return AGENTS_BY_ID.has(value);
};
