// Command and meta-text markers used when parsing Claude Code session lines.
export const COMMAND_NAME = /<command-name>([^<]+)<\/command-name>/;
export const COMMAND_ARGS = /<command-args>([^<]*)<\/command-args>/;
export const META_PREFIXES = ['<local-command-', '<system-reminder>'];
export const INJECTED_CONTEXT_PREFIXES = [
  ...META_PREFIXES,
  '<recommended_plugins>',
  '<environment_context>',
  '<app-context>',
  '<permissions',
  '<skills_instructions>',
  '<plugins_instructions>',
  '# AGENTS.md instructions for ',
  '# CLAUDE.md instructions for ',
];
export const WRAPPED_BLOCK = /^<([a-z][a-z\d_-]*)>/u;
