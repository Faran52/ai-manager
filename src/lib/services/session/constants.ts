// Command and meta-text markers used when parsing Claude Code session lines.
export const COMMAND_NAME = /<command-name>([^<]+)<\/command-name>/;
export const COMMAND_ARGS = /<command-args>([^<]*)<\/command-args>/;
export const META_PREFIXES = ['<local-command-', '<system-reminder>'];
export const WRAPPED_BLOCK = /^<([a-z][a-z\d_-]*)>/u;
