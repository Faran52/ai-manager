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

export interface AgentCapabilities {
  readonly history: boolean;
  readonly manage: boolean;
}

export interface AgentOption {
  readonly id: AgentId;
  readonly label: string;
  readonly format: 'antigravity' | 'claude' | 'codex' | 'copilot'
    | 'files' | 'gemini' | 'grok' | 'openhands' | 'sqlite' | 'opencode';
  readonly artifact: SessionArtifact;
  readonly canDelete: boolean;
  readonly canDeleteProject: boolean;
  readonly canRename: boolean;
  readonly capabilities: AgentCapabilities;
  readonly popular?: boolean | undefined;
  readonly supportsSidechains?: boolean | undefined;
  readonly resumeCommand?: string | undefined;
}

const capable = (manage: boolean): AgentCapabilities => {
  return {
    history: true,
    manage,
  };
};

const DIRECTORY_SESSIONS = new Set<AgentId>(['antigravity', 'cline', 'openhands']);

const sessionArtifact = (id: AgentId, format: AgentOption['format']): SessionArtifact => {
  if (DIRECTORY_SESSIONS.has(id)) {
    return 'directory';
  }

  return format === 'sqlite' ? 'shared-db' : 'file';
};

const UNDECODED_STORES = new Set<AgentId>(['amazonq', 'forgecode', 'kiro', 'trae']);

// manage records whether the agent has a configuration surface worth managing.
// Tier 2 carries it but surfaces only once an adapter proves the surface.
const plainAgent = (
  id: AgentId,
  label: string,
  format: AgentOption['format'],
  popular = false,
  manage = false,
): AgentOption => {
  const deletable = !UNDECODED_STORES.has(id);

  return {
    id,
    label,
    format,
    artifact: sessionArtifact(id, format),
    canDelete: deletable,
    canDeleteProject: deletable,
    canRename: false,
    capabilities: capable(manage),
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
    capabilities: capable(true),
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
    canDeleteProject: true,
    canRename: true,
    capabilities: capable(true),
    popular: true,
    resumeCommand: 'codex resume',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    format: 'copilot',
    artifact: 'file',
    canDelete: true,
    canDeleteProject: true,
    canRename: false,
    capabilities: capable(true),
    popular: true,
  },
  plainAgent('cursor', 'Cursor', 'sqlite', true, true),
  {
    id: 'opencode',
    label: 'OpenCode',
    format: 'opencode',
    artifact: 'shared-db',
    canDelete: true,
    canDeleteProject: true,
    canRename: false,
    capabilities: capable(true),
    popular: true,
  },
  plainAgent('gemini', 'Gemini CLI', 'gemini', true, true),
  plainAgent('cline', 'Cline / Roo / Kilo', 'files', true, true),
  plainAgent('aider', 'Aider', 'files', true, true),
  plainAgent('continue', 'Continue', 'files', true, true),
  plainAgent('amazonq', 'Amazon Q', 'sqlite', true, true),
  plainAgent('kiro', 'Kiro', 'sqlite', true),
  plainAgent('goose', 'Goose', 'sqlite', true, true),
  plainAgent('qwen', 'Qwen Code', 'files', true, true),
  plainAgent('antigravity', 'Antigravity', 'antigravity', false, true),
  plainAgent('cursor-agent', 'Cursor Agent', 'files', false, true),
  plainAgent('forgecode', 'ForgeCode', 'sqlite'),
  plainAgent('codebuddy', 'CodeBuddy Code', 'claude'),
  plainAgent('grok', 'Grok CLI', 'grok', false, true),
  {
    id: 'kimi',
    label: 'Kimi',
    format: 'files',
    artifact: 'file',
    canDelete: true,
    canDeleteProject: true,
    canRename: false,
    capabilities: capable(false),
    resumeCommand: 'kimi -r',
  },
  plainAgent('pearai', 'PearAI', 'files'),
  plainAgent('crush', 'Crush', 'sqlite'),
  plainAgent('llm', 'LLM', 'sqlite'),
  plainAgent('openinterpreter', 'Open Interpreter', 'files'),
  plainAgent('pi', 'Pi', 'files'),
  plainAgent('ompi', 'oh-my-pi', 'files'),
  plainAgent('vibe', 'Mistral Vibe', 'files'),
  plainAgent('zed', 'Zed', 'sqlite', false, true),
  plainAgent('openhands', 'OpenHands', 'openhands'),
  plainAgent('trae', 'Trae', 'sqlite'),
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

/*
 * A project or session found under a sibling root (".claude-personal") carries
 * that root's profile name, so its badge says which one, not "Claude Code".
 */
export const agentBadgeLabel = (agent: AgentId, profile?: string): string => {
  const label = agentOption(agent).label;

  return profile == null ? label : `${label} ${profile}`;
};

/*
 * Here rather than settingsService: the picker is client code and that module
 * reads the filesystem. A settings test asserts the two lists match.
 */
const SETTINGS_AGENTS = new Set<AgentId>(['claude', 'codex', 'gemini', 'opencode', 'grok']);

export const settingsAgents: readonly AgentId[] = agentOptions.flatMap((option) => {
  return SETTINGS_AGENTS.has(option.id) ? [option.id] : [];
});

/*
 * Of those, the ones that also read a file inside the project, so the prompt to
 * pick one is shown only where it would actually reveal another scope.
 */
const PROJECT_SCOPED_SETTINGS = new Set<AgentId>(['claude', 'gemini', 'grok']);

export const projectScopedSettingsAgents: readonly AgentId[] = agentOptions.flatMap((option) => {
  return PROJECT_SCOPED_SETTINGS.has(option.id) ? [option.id] : [];
});
