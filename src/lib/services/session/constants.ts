// Command and meta-text markers used when parsing Claude Code session lines.
export const COMMAND_NAME = /<command-name>([^<]+)<\/command-name>/;
export const COMMAND_ARGS = /<command-args>([^<]*)<\/command-args>/;
// The /command chip carries everything the caveat and the echo do, so those
// tags are stripped outright. The stdout is genuine text, so it is unwrapped.
export const COMMAND_ECHO
  = /<(command-(?:name|message|args)|local-command-caveat)>[\s\S]*?<\/\1>\s*/gu;
export const COMMAND_OUTPUT
  = /^\s*<local-command-(?:stdout|stderr)>[\s\S]*<\/local-command-(?:stdout|stderr)>\s*$/u;
export const COMMAND_OUTPUT_TAGS
  = /^\s*<local-command-(?:stdout|stderr)>|<\/local-command-(?:stdout|stderr)>\s*$/gu;
export const META_PREFIXES = ['<local-command-', '<system-reminder>'];
export const INJECTED_CONTEXT_PREFIXES = [
  ...META_PREFIXES,
  '<recommended_plugins>',
  '<environment_context>',
  '<environment_details>',
  '<app-context>',
  '<permissions',
  '<skills_instructions>',
  '<plugins_instructions>',
  '# AGENTS.md instructions for ',
  '# CLAUDE.md instructions for ',
  // Claude Code feeds a skill's SKILL.md back as a user message under this line.
  'Base directory for this skill: ',
];
export const WRAPPED_BLOCK = /^<([a-z][a-z\d_-]*)>/u;

/*
 * Cline wraps the typed prompt in <task>, so unlike every other WRAPPED_BLOCK its
 * content is the message, not context. Hiding it titled the session by a tool result.
 */
export const AUTHORED_BLOCK = 'task';
