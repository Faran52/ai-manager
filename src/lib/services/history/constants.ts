// Byte-level markers the Claude Code JSONL format is scanned with.
export const TIMESTAMP_PREFIX = '"timestamp":"';
export const SUMMARY_MARKER = '"type":"summary"';
export const TITLE_MARKER = '"customTitle"';
export const USER_MARKER = '"type":"user"';
export const ASSISTANT_MARKER = '"type":"assistant"';
export const SIDECHAIN_MARKER = '"isSidechain":true';
export const CWD_PREFIX = '"cwd":"';
export const JSONL_SUFFIX = '.jsonl';
